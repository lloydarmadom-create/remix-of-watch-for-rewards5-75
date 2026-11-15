import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, Gift, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip, VaultCard } from "@/components/vault/VaultCard";
import { supabase } from "@/integrations/supabase/client";
import { logInSchema, signUpSchema } from "@/lib/auth-schema";
import { clearStoredReferral, getStoredReferral } from "@/lib/referral";
import { cn } from "@/lib/utils";

type Mode = "signup" | "login";

export const fieldClass =
  "vault-well h-11 w-full border-0 px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus-visible:ring-2 focus-visible:ring-emerald/60";

/** The exact message from the sign-in service, so players see the real reason. */
function authErrorMessage(err: unknown) {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string" && err.message) {
    return err.message;
  }
  return "Something went wrong. Please try again.";
}

export function AuthPanel({ initialMode = "signup" }: { initialMode?: Mode } = {}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"email" | "password" | "ageConfirmed", string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
          options: { data: refCode ? { ref: refCode } : {} },
        });
        if (error) throw error;
        clearStoredReferral();
        // Accounts are confirmed instantly; if no session came back, sign straight in.
        if (!data.session) {
          const { error: loginError } = await supabase.auth.signInWithPassword({
            email: parsed.data.email,
            password: parsed.data.password,
          });
          if (loginError) throw loginError;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setFormError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

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
