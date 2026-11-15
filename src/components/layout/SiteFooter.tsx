import { Link } from "@tanstack/react-router";

import { openCookieSettings } from "@/components/consent/CookieConsent";

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-lg px-4 pb-32 pt-8">
      <div className="border-t border-border pt-5 text-center">
        <p className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Not affiliated with Roblox Corporation.
        </p>
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <Link to="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
            Privacy policy
          </Link>
          <span aria-hidden className="size-1 rounded-full bg-border" />
          <button
            type="button"
            onClick={openCookieSettings}
            className="cursor-pointer underline-offset-4 hover:text-foreground hover:underline"
          >
            Cookie settings
          </button>
        </div>
        <p className="mt-3 text-[0.7rem] text-muted-foreground/70">
          © {new Date().getFullYear()} Watch For Rewards · For players 13+
        </p>
      </div>
    </footer>
  );
}
