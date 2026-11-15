import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { useAppSettings } from "@/hooks/use-earn";
import { cn } from "@/lib/utils";

// Only one A-ADS frame may exist on screen. Every ad box asks for the single lease;
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

export const isAdUnitId = (unit: string) => /^\d{1,12}$/.test(unit);

export function aadsSrc(unit: string) {
  return `https://ad.a-ads.com/${unit}?size=${AD_WIDTH}x${AD_HEIGHT}`;
}

/** Whether the real ad network unit should show (unit set and testing mode off). */
export function useLiveAdUnit() {
  const { data } = useAppSettings();
  const unit = data?.aads_unit_id ?? "";
  const live = !!data && !data.testing_mode && isAdUnitId(unit);
  return { unit, live, testing: !!data?.testing_mode, loaded: !!data };
}

/** The single isolated 300x250 A-ADS slot, or a clean test placeholder. */
export function SponsorAd({
  className,
  children,
  preview,
}: {
  className?: string;
  children?: ReactNode;
  /** Admin preview: show this unit instead of the saved one. */
  preview?: { unit: string; testing: boolean };
}) {
  const saved = useLiveAdUnit();
  const unit = preview ? preview.unit : saved.unit;
  const live = preview ? !preview.testing && isAdUnitId(preview.unit) : saved.live;
  const holdsLease = useAdLease(live);

  return (
    <div
      className={cn("vault-well relative mx-auto grid max-w-full place-items-center overflow-hidden", className)}
      style={{ width: AD_WIDTH, height: AD_HEIGHT }}
    >
      {live && holdsLease ? (
        <iframe
          key={unit}
          data-aa={unit}
          src={aadsSrc(unit)}
          title="Sponsored"
          width={AD_WIDTH}
          height={AD_HEIGHT}
          scrolling="no"
          className="block border-0 bg-transparent"
          style={{ width: AD_WIDTH, height: AD_HEIGHT, overflow: "hidden" }}
        />
      ) : (
        <div className="px-6 text-center">
          <Sparkles className="mx-auto size-7 text-cyan" />
          <p className="mt-2 font-display text-sm font-semibold">Test ad</p>
          <p className="text-xs text-muted-foreground">
            {live ? "The sponsor is showing in another slot." : "Sponsor content appears here."}
          </p>
          <p className="mt-2 font-mono text-[0.65rem] text-muted-foreground">300 × 250</p>
        </div>
      )}
      {children}
    </div>
  );
}
