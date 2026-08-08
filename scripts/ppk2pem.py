#!/usr/bin/env python3
"""Convert an unencrypted PuTTY .ppk (v2/v3) RSA key to an OpenSSH PEM private key.

Pure stdlib. Only handles ssh-rsa with Encryption: none.
"""
import base64
import sys


def parse_ppk(path):
    fields = {}
    lines = open(path).read().splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if ":" not in line:
            i += 1
            continue
        key, val = line.split(":", 1)
        val = val.strip()
        if key.endswith("-Lines"):
            n = int(val)
            body = "".join(lines[i + 1 : i + 1 + n])
            fields[key[: -len("-Lines")]] = base64.b64decode(body)
            i += 1 + n
        else:
            fields[key] = val
            i += 1
    return fields


def read_mpint_blob(blob):
    """Iterate ssh-format length-prefixed strings."""
    out = []
    i = 0
    while i < len(blob):
        n = int.from_bytes(blob[i : i + 4], "big")
        i += 4
        out.append(blob[i : i + n])
        i += n
    return out


# --- minimal DER encoder ---
def der_len(n):
    if n < 0x80:
        return bytes([n])
    b = n.to_bytes((n.bit_length() + 7) // 8, "big")
    return bytes([0x80 | len(b)]) + b


def der_int(i):
    b = i.to_bytes((i.bit_length() + 8) // 8, "big") if i else b"\x00"
    return b"\x02" + der_len(len(b)) + b


def der_seq(items):
    body = b"".join(items)
    return b"\x30" + der_len(len(body)) + body


def egcd(a, b):
    if a == 0:
        return b, 0, 1
    g, y, x = egcd(b % a, a)
    return g, x - (b // a) * y, y


def modinv(a, m):
    g, x, _ = egcd(a % m, m)
    if g != 1:
        raise ValueError("no modular inverse")
    return x % m


def main():
    src, dst = sys.argv[1], sys.argv[2]
    f = parse_ppk(src)
    alg = f.get("PuTTY-User-Key-File-2") or f.get("PuTTY-User-Key-File-3")
    if alg != "ssh-rsa":
        raise SystemExit(f"unsupported key type: {alg}")
    if f.get("Encryption", "none") != "none":
        raise SystemExit("key is encrypted; decrypt it first")

    pub = read_mpint_blob(f["Public"])
    # pub = [b'ssh-rsa', e, n]
    e = int.from_bytes(pub[1], "big")
    n = int.from_bytes(pub[2], "big")

    priv = read_mpint_blob(f["Private"])
    # priv = [d, p, q, iqmp]
    d = int.from_bytes(priv[0], "big")
    p = int.from_bytes(priv[1], "big")
    q = int.from_bytes(priv[2], "big")

    if p * q != n:
        raise SystemExit("p*q != n — key did not parse correctly")

    # PuTTY stores iqmp for its own (p,q) order; recompute everything to be safe.
    # OpenSSL PKCS#1 requires q^-1 mod p, with p > q by convention.
    if p < q:
        p, q = q, p
    dp = d % (p - 1)
    dq = d % (q - 1)
    iqmp = modinv(q, p)

    der = der_seq(
        [der_int(v) for v in (0, n, e, d, p, q, dp, dq, iqmp)]
    )
    b64 = base64.b64encode(der).decode()
    pem = "-----BEGIN RSA PRIVATE KEY-----\n"
    pem += "\n".join(b64[i : i + 64] for i in range(0, len(b64), 64))
    pem += "\n-----END RSA PRIVATE KEY-----\n"
    with open(dst, "w") as fh:
        fh.write(pem)
    print(f"wrote {dst} ({n.bit_length()}-bit RSA)")


if __name__ == "__main__":
    main()
