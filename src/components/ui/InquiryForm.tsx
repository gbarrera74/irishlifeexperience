"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

const YEARS = ["2027", "2028", "2029", "2030"];
const GRADES = ["8", "9", "10", "11", "12"];

/**
 * Replaces the "Learn More" Elementor form that appears on the home page and
 * across the marketing pages. Posts to /api/inquiry.
 *
 * `variant="full"` adds phone + message (the /contact and /programs flavour);
 * `variant="lead"` is the compact hero form.
 */
export default function InquiryForm({
  variant = "lead",
  source,
  className = "",
  tone = "light",
  inline = false,
}: {
  variant?: "lead" | "full";
  source: string;
  className?: string;
  /** "onDark" is the hero treatment: white labels over a dark translucent panel. */
  tone?: "light" | "onDark";
  /** Lay the lead fields out in a single row, as the hero form does on desktop. */
  inline?: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      // Trailing slash matters: next.config.ts sets trailingSlash: true, which
      // 308-redirects "/api/inquiry" and costs an extra round trip.
      const res = await fetch("/api/inquiry/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, source }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong. Please try again.");
      }
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        className={`rounded-lg bg-green/10 px-6 py-8 text-center ${className}`}
      >
        <h3 className="font-display text-xl font-semibold text-green-dark">
          Thank you — we&apos;ve got it.
        </h3>
        <p className="mt-2 text-navy/80">
          Someone from our team will be in touch shortly.
        </p>
      </div>
    );
  }

  const field =
    "w-full rounded-md border border-navy/15 bg-white px-4 py-2.5 text-navy outline-none focus:border-green focus:ring-2 focus:ring-green/30";
  const label = `mb-1.5 block font-display text-sm font-semibold ${
    tone === "onDark" ? "text-white" : "text-navy"
  }`;
  const grid =
    inline && variant === "lead"
      ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      : "grid gap-4 sm:grid-cols-2";

  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      {/* Honeypot — the Elementor original used one too. Bots fill it, people can't see it. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <div className={grid}>
        <div>
          <label className={label} htmlFor="firstName">
            First Name
          </label>
          <input id="firstName" name="firstName" required className={field} autoComplete="given-name" />
        </div>
        <div>
          <label className={label} htmlFor="lastName">
            Last Name
          </label>
          <input id="lastName" name="lastName" required className={field} autoComplete="family-name" />
        </div>
        <div className={variant === "full" || inline ? "" : "sm:col-span-2"}>
          <label className={label} htmlFor="email">
            E-Mail
          </label>
          <input id="email" name="email" type="email" required className={field} autoComplete="email" />
        </div>

        {variant === "full" && (
          <div>
            <label className={label} htmlFor="phone">
              Mobile Phone
            </label>
            <input id="phone" name="phone" type="tel" className={field} autoComplete="tel" />
          </div>
        )}

        <div>
          <label className={label} htmlFor="year">
            Program Year
          </label>
          <select id="year" name="year" className={field} defaultValue="">
            <option value="" disabled>
              Select a Year
            </option>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="grade">
            Grade
          </label>
          <select id="grade" name="grade" className={field} defaultValue="">
            <option value="" disabled>
              Select a Grade
            </option>
            {GRADES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>

        {variant === "full" && (
          <div className="sm:col-span-2">
            <label className={label} htmlFor="message">
              Message
            </label>
            <textarea id="message" name="message" rows={5} className={field} />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-6 rounded-[20px] border border-accent bg-accent px-9 py-3 font-display text-[12px] font-extrabold tracking-[1.8px] text-white capitalize transition-colors hover:bg-transparent hover:text-accent disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Learn More"}
      </button>
    </form>
  );
}
