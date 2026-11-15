import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, Gift, Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip, VaultCard } from "@/components/vault/VaultCard";
import { supabase } from "@/integrations/supabase/client";
import { logInSchema, signUpSchema } from "@/lib/auth-schema";
import { clearStoredReferral, getStoredReferral } from "@/lib/referral";
import { cn } from "@/lib/utils";

type Mode = "signup" | "login";

export const fieldClass =
  "vault-well h-11 w-full border-0 px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus-visible:ring-2 focus-visible:ring-emerald/60";

function friendlyError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "That email and password don't match.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "That email already has an account. Try logging in.";
  if (m.includes("email not confirmed")) return "Confirm your email first, then log in.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries. Wait a minute and try again.";
  return "Something went wrong. Please try again.";
}

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"email" | "password" | "ageConfirmed", string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);

  useEffect(() => setRefCode(getStoredReferral()), []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setFormError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed =
      mode === "signup"
        ? signUpSchema.safeParse({ email, password, ageConfirmed })
        : logInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: Partial<Record<"email" | "password" | "ageConfirmed", string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof next;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: refCode ? { ref: refCode } : {},
          },
        });
        if (error) throw error;
        clearStoredReferral();
        if (!data.session) setConfirmSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setFormError(friendlyError(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  };

  if (confirmSent) {
    return (
      <VaultCard accent="emerald" className="animate-rise p-6 text-center">
        <MailCheck className="mx-auto size-9 text-emerald" />
        <h2 className="mt-3 text-lg font-bold">Check your inbox</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a confirmation link to {email}. Open it, then come back to log in.
        </p>
        <Button variant="slate" size="tactile-sm" className="mt-5" onClick={() => { setConfirmSent(false); switchMode("login"); }}>
          Back to log in
        </Button>
      </VaultCard>
    );
  }

  return (
    <VaultCard accent="emerald" className="animate-rise p-5">
      <div className="vault-well grid grid-cols-2 gap-1 p-1" role="tablist" aria-label="Account">
        {(["signup", "login"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className="h-9 cursor-pointer rounded-lg font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors aria-selected:bg-vault-raised aria-selected:text-foreground aria-selected:shadow-press-slate"
          >
            {m === "signup" ? "Sign up" : "Log in"}
          </button>
        ))}
      </div>

      {mode === "signup" && refCode ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-gold/10 px-3 py-2 ring-1 ring-gold/25">
          <Gift className="size-4 text-gold" />
          <p className="flex-1 text-xs text-gold">Invite code applied</p>
          <Chip tone="gold">{refCode}</Chip>
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3.5">
        <Field label="Email" error={errors.email} htmlFor="auth-email">
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={fieldClass}
            aria-invalid={!!errors.email}
          />
        </Field>
        <Field label="Password" error={errors.password} htmlFor="auth-password">
          <div className="relative">
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              className={cn(fieldClass, "pr-11")}
              aria-invalid={!!errors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        {mode === "signup" ? (
          <div>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-emerald"
              />
              <span>
                I'm 13 or older and I've read the{" "}
                <Link to="/privacy" className="text-cyan underline underline-offset-4">
                  privacy policy
                </Link>
                .
              </span>
            </label>
            {errors.ageConfirmed ? (
              <p className="mt-1 text-xs text-destructive">{errors.ageConfirmed}</p>
            ) : null}
          </div>
        ) : null}

        {formError ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive ring-1 ring-destructive/25">
            {formError}
          </p>
        ) : null}

        <Button type="submit" variant="emerald" size="tactile" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {mode === "signup" ? "Create account" : "Log in"}
        </Button>
      </form>
    </VaultCard>
  );
}

export function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string | undefined;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block font-display text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
