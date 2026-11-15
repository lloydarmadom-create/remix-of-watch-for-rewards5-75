import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { useAppSettings, type AppSettings } from "@/hooks/use-earn";
import {
  bannerDocument,
  isAdUnitId,
  networkCode,
  networkLabel,
  networkReady,
  type AdNetworkId,
} from "@/lib/ad-networks";
import { cn } from "@/lib/utils";

export { isAdUnitId };

// Only one ad frame may exist on screen. Every ad box asks for the single lease;
// whoever holds it renders the real frame, the rest show the placeholder.
const lease = {
  holder: null as symbol | null,
  queue: [] as symbol[],
  listeners: new Set<() => void>(),
};
const emit = () => lease.listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  lease.listeners.add(l);
  return () => lease.listeners.delete(l);
};

function useAdLease(enabled: boolean) {
  const [token] = useState(() => Symbol("ad"));
  const holder = useSyncExternalStore(subscribe, () => lease.holder, () => null);
  useEffect(() => {
    if (!enabled) return;
    if (lease.holder === null) lease.holder = token;
    else lease.queue.push(token);
    emit();
    return () => {
      lease.queue = lease.queue.filter((t) => t !== token);
      if (lease.holder === token) lease.holder = lease.queue.shift() ?? null;
      emit();
    };
  }, [enabled, token]);
  return enabled && holder === token;
}

export const AD_WIDTH = 300;
export const AD_HEIGHT = 250;

export function aadsSrc(unit: string) {
  return `https://ad.a-ads.com/${unit.trim()}?size=${AD_WIDTH}x${AD_HEIGHT}`;
}

/**
 * What a slot should show for a network: the network itself when it's ready,
 * otherwise A-ADS as the fallback, otherwise the test placeholder.
 */
export function resolveAd(settings: AppSettings | null | undefined, network: AdNetworkId) {
  if (!settings || settings.testing_mode) return null;
  if (networkReady(network, settings)) return network;
  if (networkReady("aads", settings)) return "aads" as const;
  return null;
}

/** The single isolated 300x250 ad slot for one network, or a clean test placeholder. */
export function SponsorAd({
  className,
  children,
  network = "aads",
  preview,
}: {
  className?: string;
  children?: ReactNode;
  /** Which network should serve this slot (from the rotation). */
  network?: AdNetworkId;
  /** Admin preview: render these unsaved settings instead of the saved ones. */
  preview?: AppSettings;
}) {
  const { data: saved } = useAppSettings();
  const settings = preview ?? saved;
  const shown = resolveAd(settings, network);
  const holdsLease = useAdLease(shown !== null);

  const srcDoc = useMemo(() => {
    if (!settings || !shown || shown === "aads") return null;
    return bannerDocument(networkCode(shown, settings), AD_WIDTH, AD_HEIGHT);
  }, [settings, shown]);

  return (
    <div
      className={cn("vault-well relative mx-auto grid max-w-full place-items-center overflow-hidden", className)}
      style={{ width: AD_WIDTH, height: AD_HEIGHT }}
    >
      {shown && holdsLease && settings ? (
        shown === "aads" ? (
          <iframe
            key={`aads-${settings.aads_unit_id}`}
            data-aa={settings.aads_unit_id.trim()}
            src={aadsSrc(settings.aads_unit_id)}
            title="Sponsored"
            width={AD_WIDTH}
            height={AD_HEIGHT}
            scrolling="no"
            className="block border-0 bg-transparent"
            style={{ width: AD_WIDTH, height: AD_HEIGHT, overflow: "hidden" }}
          />
        ) : (
          <iframe
            key={`${shown}-${srcDoc?.length ?? 0}`}
            srcDoc={srcDoc ?? ""}
            title={`Sponsored · ${networkLabel(shown, settings)}`}
            width={AD_WIDTH}
            height={AD_HEIGHT}
            scrolling="no"
            // Scripts run, but never with the app's origin, so they can't read the player's session.
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
            referrerPolicy="no-referrer-when-downgrade"
            className="block border-0 bg-transparent"
            style={{ width: AD_WIDTH, height: AD_HEIGHT, overflow: "hidden" }}
          />
        )
      ) : (
        <div className="px-6 text-center">
          <Sparkles className="mx-auto size-7 text-cyan" />
          <p className="mt-2 font-display text-sm font-semibold">Test ad</p>
          <p className="text-xs text-muted-foreground">
            {shown ? "The sponsor is showing in another slot." : "Sponsor content appears here."}
          </p>
          <p className="mt-2 font-mono text-[0.65rem] text-muted-foreground">300 × 250</p>
        </div>
      )}
      {children}
    </div>
  );
}
