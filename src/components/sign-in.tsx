"use client";

import { useState } from "react";
import { sendSignInEmail, verifyCode } from "@/lib/store";

/**
 * Passwordless sign-in. Supabase emails a link and a one-time code; the code is
 * the reliable path on phones, where the link may open in a different browser
 * than the installed app.
 */
export function SignIn() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const field = "h-11 w-full rounded-xl border border-rule-strong bg-surface px-3.5 text-[15px] outline-none placeholder:text-muted focus:border-ink";
  const button = "h-11 w-full rounded-xl bg-ink text-[15px] font-medium text-paper hover:bg-accent hover:text-accent-ink disabled:opacity-50";

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 pt-16 pb-32">
      {step === "email" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await sendSignInEmail(email.trim());
              setStep("code");
            });
          }}
          className="flex flex-col gap-3"
        >
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Sign in</h1>
          <p className="mb-2 text-[15px] text-ink-2">Use the same email on every device and your timer follows you.</p>
          <input type="email" required autoFocus autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          <button type="submit" disabled={busy} className={button}>
            {busy ? "Sending…" : "Email me a sign-in code"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => verifyCode(email.trim(), code.trim()));
          }}
          className="flex flex-col gap-3"
        >
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Check your email</h1>
          <p className="mb-2 text-[15px] text-ink-2">
            We sent a code to <span className="font-medium text-ink">{email}</span>. Enter it here, or tap the link in the email.
          </p>
          <input
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6,10}"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`${field} num text-center text-[22px] tracking-[0.3em]`}
          />
          <button type="submit" disabled={busy} className={button}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="text-sm text-muted hover:text-ink"
          >
            Use a different email
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm text-ink">
          {error}
        </p>
      )}
    </div>
  );
}
