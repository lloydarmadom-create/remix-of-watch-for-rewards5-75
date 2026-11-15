import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { needsAnswer, onConsentChange, readChoice, saveChoices, type Purpose } from "@/lib/consent";

const PURPOSES: Purpose[] = ["analytics", "advertising"];
const OPEN_EVENT = "open-cookie-settings";

/** Opens the Cookie settings panel from anywhere (footer, profile). */
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type View = "banner" | "settings";

export function CookieConsent() {
  const [view, setView] = useState<View | null>(null);
  const [draft, setDraft] = useState<Record<Purpose, boolean>>({
    analytics: false,
    advertising: false,
  });
  const [gpc, setGpc] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadDraft = () =>
    setDraft({
      analytics: readChoice("analytics") === "granted",
      advertising: readChoice("advertising") === "granted",
    });

  useEffect(() => {
    setGpc(
      (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true,
    );
    let cancelled = false;
    void needsAnswer(PURPOSES).then((needed) => {
      if (!cancelled && needed) setView((v) => v ?? "banner");
    });
    const onOpen = () => {
      loadDraft();
      setView("settings");
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    const off = onConsentChange(loadDraft);
    return () => {
      cancelled = true;
      window.removeEventListener(OPEN_EVENT, onOpen);
      off();
    };
  }, []);

  useEffect(() => {
    if (view) panelRef.current?.focus();
  }, [view]);

  if (!view) return null;

  const decideAll = (choice: "granted" | "denied") => {
    saveChoices({ analytics: choice, advertising: choice });
    setView(null);
  };

  const saveSettings = () => {
    saveChoices({
      analytics: draft.analytics ? "granted" : "denied",
      advertising: draft.advertising ? "granted" : "denied",
    });
    setView(null);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 px-3">
      <div
        ref={panelRef}
        role="region"
        aria-label={view === "banner" ? "Cookie choices" : "Cookie settings"}
        tabIndex={-1}
        className="vault pointer-events-auto relative mx-auto w-full max-w-lg animate-rise p-4 outline-none"
      >
        <button
          type="button"
          onClick={() => setView(null)}
          aria-label="Close"
          className="absolute right-3 top-3 grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        {view === "banner" ? (
          <>
            <div className="flex items-center gap-2 pr-8">
              <Cookie className="size-5 text-gold" />
              <h2 className="text-base font-bold">Accept cookies?</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              We count visits without cookies. If you accept, we also measure clicks, and our
              advertising partners use cookies to show and measure ads.{" "}
              <Link to="/privacy" className="text-cyan underline underline-offset-4">
                Privacy policy
              </Link>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Button variant="emerald" size="tactile-sm" onClick={() => decideAll("granted")}>
                Accept all
              </Button>
              <Button variant="slate" size="tactile-sm" onClick={() => decideAll("denied")}>
                Reject all
              </Button>
            </div>
            <button
              type="button"
              onClick={() => {
                loadDraft();
                setView("settings");
              }}
              className="mt-3 w-full cursor-pointer text-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Cookie settings
            </button>
          </>
        ) : (
          <>
            <h2 className="pr-8 text-base font-bold">Cookie settings</h2>
            {gpc ? (
              <p className="mt-2 rounded-lg bg-cyan/10 px-3 py-2 text-xs text-cyan ring-1 ring-cyan/20">
                Your browser's privacy signal (Global Privacy Control) is on, so optional tracking
                stays off.
              </p>
            ) : null}
            <ul className="mt-3 space-y-2">
              <li className="vault-well flex items-start justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-semibold">Necessary</p>
                  <p className="text-xs text-muted-foreground">
                    Keeps the app working and remembers your choices.
                  </p>
                </div>
                <span className="font-display text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-emerald">
                  Always on
                </span>
              </li>
              <ConsentRow
                id="consent-analytics"
                title="Analytics, provided by Lovable"
                body="Measures clicks so we can improve the app."
                checked={!gpc && draft.analytics}
                disabled={gpc}
                onChange={(v) => setDraft((d) => ({ ...d, analytics: v }))}
              />
              <ConsentRow
                id="consent-advertising"
                title="Advertising, provided by our advertising partners"
                body="Cookies used to show and measure ads."
                checked={!gpc && draft.advertising}
                disabled={gpc}
                onChange={(v) => setDraft((d) => ({ ...d, advertising: v }))}
              />
            </ul>
            <Button
              variant="emerald"
              size="tactile-sm"
              className="mt-4 w-full"
              onClick={saveSettings}
            >
              Save choices
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ConsentRow({
  id,
  title,
  body,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  body: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <li className="vault-well flex items-start justify-between gap-3 p-3">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{body}</span>
      </label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="mt-0.5 data-[state=checked]:bg-emerald"
      />
    </li>
  );
}
