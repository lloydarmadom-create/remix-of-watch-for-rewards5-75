import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, LifeBuoy, Loader2 } from "lucide-react";

import { Field, fieldClass } from "@/components/auth/AuthPanel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORT_CATEGORIES, supportSchema } from "@/lib/support";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "open-contact-support";
const COOLDOWN_KEY = "wfr_support_sent_at";
const COOLDOWN_MS = 60_000;

/** Opens the Contact Support form from anywhere (profile, footer, privacy page). */
export function openContactSupport() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const empty = { sender_name: "", reply_email: "", category: "", message: "" };

export function ContactSupport() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof empty, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const onOpen = () => {
      setSent(false);
      setFormError(null);
      setErrors({});
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (open && user?.email) {
      setValues((v) => (v.reply_email ? v : { ...v, reply_email: user.email ?? "" }));
    }
  }, [open, user]);

  const set = (key: keyof typeof empty) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = supportSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof typeof empty, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof empty;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      const last = Number(localStorage.getItem(COOLDOWN_KEY) ?? 0);
      if (Date.now() - last < COOLDOWN_MS) {
        setFormError("You just sent a message. Please wait a minute before sending another.");
        return;
      }
    } catch {
      /* storage unavailable */
    }

    setBusy(true);
    const { error } = await supabase.from("contact_messages").insert({
      user_id: user?.id ?? null,
      ...parsed.data,
    });
    setBusy(false);
    if (error) {
      setFormError("We couldn't send your message. Please try again.");
      return;
    }
    try {
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setValues({ ...empty, reply_email: user?.email ?? "" });
    setSent(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="vault max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto border-vault-rim bg-vault p-5">
        {sent ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto size-10 text-emerald" />
            <DialogTitle className="mt-3 text-lg font-bold">Message sent</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              Our team will reply to the email you gave us.
            </DialogDescription>
            <Button variant="slate" size="tactile-sm" className="mt-5" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 pr-6">
              <LifeBuoy className="size-5 text-cyan" />
              <DialogTitle className="text-lg font-bold">Contact support</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              Tell us what's up and we'll get back to you by email.
            </DialogDescription>
            <form onSubmit={onSubmit} noValidate className="mt-2 space-y-3.5">
              <Field label="Name or username" htmlFor="support-name" error={errors.sender_name}>
                <input
                  id="support-name"
                  value={values.sender_name}
                  onChange={(e) => set("sender_name")(e.target.value)}
                  maxLength={60}
                  autoComplete="nickname"
                  className={fieldClass}
                />
              </Field>
              <Field label="Reply email" htmlFor="support-email" error={errors.reply_email}>
                <input
                  id="support-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={values.reply_email}
                  onChange={(e) => set("reply_email")(e.target.value)}
                  maxLength={255}
                  className={fieldClass}
                />
              </Field>
              <Field label="Category" htmlFor="support-category" error={errors.category}>
                <select
                  id="support-category"
                  value={values.category}
                  onChange={(e) => set("category")(e.target.value)}
                  className={cn(fieldClass, "cursor-pointer appearance-none")}
                >
                  <option value="" disabled>
                    Choose one…
                  </option>
                  {SUPPORT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Message" htmlFor="support-message" error={errors.message}>
                <textarea
                  id="support-message"
                  value={values.message}
                  onChange={(e) => set("message")(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  className={cn(fieldClass, "h-auto resize-none py-3")}
                />
                <p className="mt-1 text-right font-mono text-[0.65rem] text-muted-foreground">
                  {values.message.length}/2000
                </p>
              </Field>
              {formError ? (
                <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive ring-1 ring-destructive/25">
                  {formError}
                </p>
              ) : null}
              <Button type="submit" variant="cyan" size="tactile" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                Send message
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
