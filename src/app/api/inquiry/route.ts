import { NextResponse } from "next/server";

/**
 * Inquiry form handler — the replacement for Elementor's form actions.
 *
 * Delivery is intentionally a single seam (`deliver`) so the transport can be
 * whatever the site ends up using. Nothing is written to a database: the
 * WordPress site stored every submission in wp_e_submissions, which is how it
 * accumulated years of personal data on an unpatched host. Email-only means
 * there is no store to breach.
 */

const RECIPIENTS = (process.env.INQUIRY_TO ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type Inquiry = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  year?: string;
  grade?: string;
  message?: string;
  source: string;
};

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/** Crude per-instance rate limit — enough to stop casual form spam. */
const hits = new Map<string, { n: number; reset: number }>();
function rateLimited(ip: string) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.reset) {
    hits.set(ip, { n: 1, reset: now + 60_000 });
    return false;
  }
  rec.n += 1;
  return rec.n > 5;
}

/**
 * The one place that talks to the mail provider. SendGrid already authenticates
 * this domain — its DKIM CNAMEs predate the migration — so the transport reuses
 * that account rather than introducing a second sender to verify.
 */
async function sendMail(opts: { subject: string; text: string; replyTo?: string }) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key || RECIPIENTS.length === 0) {
    throw new Error("MAIL_NOT_CONFIGURED");
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: RECIPIENTS.map((email) => ({ email })) }],
      from: { email: process.env.INQUIRY_FROM ?? "website@irishlifeexperience.com" },
      ...(opts.replyTo ? { reply_to: { email: opts.replyTo } } : {}),
      subject: opts.subject,
      content: [{ type: "text/plain", value: opts.text }],
    }),
  });

  // SendGrid answers 202 Accepted and an empty body on success. On failure the
  // body names the cause (unverified sender, bad key), which is worth logging.
  if (!res.ok) {
    throw new Error(`mail transport failed: ${res.status} ${await res.text()}`);
  }
}

async function deliver(inquiry: Inquiry) {
  const lines = [
    `Source page: ${inquiry.source}`,
    `Name:        ${inquiry.firstName} ${inquiry.lastName}`,
    `Email:       ${inquiry.email}`,
    inquiry.phone ? `Phone:       ${inquiry.phone}` : null,
    inquiry.year ? `Program year: ${inquiry.year}` : null,
    inquiry.grade ? `Grade:       ${inquiry.grade}` : null,
    inquiry.message ? `\nMessage:\n${inquiry.message}` : null,
  ].filter(Boolean);

  await sendMail({
    subject: `Website inquiry — ${inquiry.firstName} ${inquiry.lastName}`,
    text: lines.join("\n"),
    replyTo: inquiry.email,
  });
}

async function deliverRaw(formName: string, lines: string[], source: string) {
  await sendMail({
    subject: `${formName} — website submission`,
    text: [`Form: ${formName}`, `Source page: ${source}`, "", ...lines].join("\n"),
  });
}

function mailError(err: unknown) {
  if (err instanceof Error && err.message === "MAIL_NOT_CONFIGURED") {
    console.error("Submission received but mail is not configured. Set SENDGRID_API_KEY and INQUIRY_TO.");
    return NextResponse.json(
      { error: "The form isn't accepting messages yet. Please email us directly." },
      { status: 503 },
    );
  }
  console.error("Delivery failed", err);
  return NextResponse.json(
    { error: "We couldn't send that. Please try again shortly." },
    { status: 502 },
  );
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: a filled "company" field means a bot. Accept silently so it
  // doesn't learn anything, but send nothing.
  if (body.company) return NextResponse.json({ ok: true });

  // Generic submissions from the migrated Elementor forms: an arbitrary field
  // map plus the form's name. Delivered as a readable list, never stored.
  const raw = body as unknown as { formName?: string; fields?: Record<string, string> };
  if (raw.fields && typeof raw.fields === "object") {
    const lines = Object.entries(raw.fields)
      .filter(([k, v]) => k !== "company" && String(v).trim())
      .map(([k, v]) => `${k}: ${v}`);
    if (!lines.length) {
      return NextResponse.json({ error: "Please complete the form." }, { status: 400 });
    }
    try {
      await deliverRaw(raw.formName ?? "Website form", lines, body.source ?? "unknown");
    } catch (err) {
      return mailError(err);
    }
    return NextResponse.json({ ok: true });
  }

  const firstName = (body.firstName ?? "").trim();
  const lastName = (body.lastName ?? "").trim();
  const email = (body.email ?? "").trim();

  if (!firstName || !lastName || !isEmail(email)) {
    return NextResponse.json(
      { error: "Please provide your name and a valid email address." },
      { status: 400 },
    );
  }

  try {
    await deliver({
      firstName,
      lastName,
      email,
      phone: body.phone?.trim(),
      year: body.year?.trim(),
      grade: body.grade?.trim(),
      message: body.message?.trim(),
      source: body.source ?? "unknown",
    });
  } catch (err) {
    if (err instanceof Error && err.message === "MAIL_NOT_CONFIGURED") {
      console.error(
        "Inquiry received but mail is not configured. Set SENDGRID_API_KEY and INQUIRY_TO.",
      );
      return NextResponse.json(
        { error: "The form isn't accepting messages yet. Please email us directly." },
        { status: 503 },
      );
    }
    console.error("Inquiry delivery failed", err);
    return NextResponse.json(
      { error: "We couldn't send that. Please try again shortly." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
