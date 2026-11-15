import { MonitorPlay } from "lucide-react";

import { SponsorAd, useLiveAdUnit } from "@/components/ads/SponsorAd";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";

/** Live preview of the single 300x250 A-ADS unit, exactly as players see it. */
export function AdPreviewCard() {
  const { unit, live, testing, loaded } = useLiveAdUnit();
  const status = !loaded ? "Loading" : live ? "Live" : testing ? "Testing mode" : unit ? "Invalid ID" : "No unit ID";

  return (
    <VaultCard accent="cyan" className="p-4">
      <div className="flex items-center gap-3">
        <IconTile tone="cyan">
          <MonitorPlay />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold">A-ADS preview</p>
          <p className="text-xs text-muted-foreground">300 × 250 · one ad frame per page</p>
        </div>
        <Chip tone={live ? "emerald" : "gold"}>{status}</Chip>
      </div>
      <SponsorAd className="mt-3" />
      {!live && loaded ? (
        <p className="mt-2.5 text-center text-xs text-muted-foreground">
          {testing
            ? "Testing mode is on, so players see the test placeholder."
            : "Add your A-ADS unit ID above to show the real ad."}
        </p>
      ) : null}
    </VaultCard>
  );
}
