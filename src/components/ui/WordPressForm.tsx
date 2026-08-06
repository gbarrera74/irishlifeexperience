"use client";

import { useState } from "react";

export type FormField = {
  label: string;
  type: string;
  required: boolean;
  placeholder?: string | null;
  options?: string | null;
  html?: string | null;
  id: string;
};

type Status = "idle" | "sending" | "sent" | "error";

/**
 * Renders the Elementor form definitions captured by scripts/extract_pages.py.
 *
 * Submissions are emailed and never stored — the WordPress original wrote every
 * one to wp_e_submissions, which is how years of applicant and medical data
 * accumulated on an unpatched host.
 */
export default function WordPressForm({
  name,
  fields,
  submitLabel = "Submit",
  source,
}: {
  name: string;
  fields: FormField[];
  submitLabel?: string;
  source: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/api/inquiry/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formName: name, source, fields: data }),
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
      <div role="status" className="rounded-lg bg-accent/10 px-6 py-8 text-center">
        <h3 className="font-display text-xl font-bold text-navy">Thank you — we&apos;ve got it.</h3>
        <p className="mt-2 text-navy/80">Someone from our team will be in touch shortly.</p>
      </div>
    );
  }

  const input =
    "w-full rounded-md border border-navy/20 bg-white px-4 py-2.5 text-navy outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";
  const labelCls = "mb-1.5 block font-sans text-[15px] font-semibold text-navy";

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-3xl text-left">
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label htmlFor={`${name}-company`}>Company</label>
        <input id={`${name}-company`} name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5">
        {fields.map((f, i) => {
          const id = `${name}-${f.id || i}`;
          const options = (f.options || "").split("\n").map((o) => o.trim()).filter(Boolean);

          // Elementor "html" fields are section headings inside the form.
          if (f.type === "html") {
            // Elementor html fields are in-form headings/notes; the body sits in
            // `html`, with `label` used as its heading.
            return (
              <div key={id} className="mt-4">
                {f.label && (
                  <h3 className="font-display text-xl font-bold text-navy">{f.label}</h3>
                )}
                {f.html && (
                  <div
                    className="mt-2 text-navy [&_a]:text-green-mid [&_a]:underline [&_p]:my-2"
                    dangerouslySetInnerHTML={{ __html: f.html }}
                  />
                )}
              </div>
            );
          }
          if (f.type === "step") {
            return (
              <h3 key={id} className="mt-6 border-b border-navy/15 pb-2 font-display text-2xl font-bold text-navy">
                {f.label}
              </h3>
            );
          }
          if (f.type === "honeypot" || f.type === "recaptcha" || f.type === "recaptcha_v3") return null;

          const labelText = f.label || f.placeholder || "";

          if (f.type === "radio" || f.type === "checkbox") {
            return (
              <fieldset key={id}>
                <legend className={labelCls}>
                  {labelText}
                  {f.required && <span aria-hidden="true"> *</span>}
                </legend>
                <div className="flex flex-wrap gap-4">
                  {options.map((o) => (
                    <label key={o} className="flex items-center gap-2 text-navy">
                      <input
                        type={f.type === "radio" ? "radio" : "checkbox"}
                        name={f.id}
                        value={o}
                        required={f.required && f.type === "radio"}
                      />
                      {o}
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          }

          if (f.type === "select") {
            return (
              <div key={id}>
                <label className={labelCls} htmlFor={id}>
                  {labelText}
                  {f.required && <span aria-hidden="true"> *</span>}
                </label>
                <select id={id} name={f.id} required={f.required} className={input} defaultValue="">
                  <option value="" disabled>
                    {f.placeholder || "Select"}
                  </option>
                  {options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            );
          }

          if (f.type === "textarea") {
            return (
              <div key={id}>
                <label className={labelCls} htmlFor={id}>
                  {labelText}
                  {f.required && <span aria-hidden="true"> *</span>}
                </label>
                <textarea id={id} name={f.id} rows={4} required={f.required} className={input} />
              </div>
            );
          }

          const htmlType = ["email", "tel", "date", "time", "number", "url"].includes(f.type)
            ? f.type
            : "text";

          return (
            <div key={id}>
              <label className={labelCls} htmlFor={id}>
                {labelText}
                {f.required && <span aria-hidden="true"> *</span>}
              </label>
              <input
                id={id}
                name={f.id}
                type={htmlType}
                required={f.required}
                placeholder={f.placeholder || undefined}
                className={input}
              />
            </div>
          );
        })}
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
        {status === "sending" ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}
