import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone } from "lucide-react";

import { SponsorAd } from "@/components/ads/SponsorAd";
import { Field, fieldClass } from "@/components/auth/AuthPanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";
import { appSettingsKey, errorText, useAppSettings, type AppSettings } from "@/hooks/use-earn";
import { supabase } from "@/integrations/supabase/client";
import {
  AD_NETWORKS,
  ADS_PER_NETWORK,
  isAdUnitId,
  networkLabel,
  networkReady,
  type AdNetworkId,
  type AdNetworkSettings,
} from "@/lib/ad-networks";
import { cn } from "@/lib/utils";

const ENABLED_KEY: Record<AdNetworkId, keyof AdNetworkSettings> = {
  aads: "aads_enabled",
  adsterra: "adsterra_enabled",
  monetag: "monetag_enabled",
  bitmedia: "bitmedia_enabled",
  coinzilla: "coinzilla_enabled",
  custom: "custom_ad_enabled",
};
const CODE_KEY: Record<Exclude<AdNetworkId, "aads">, keyof AdNetworkSettings> = {
  adsterra: "adsterra_code",
  monetag: "monetag_code",
  bitmedia: "bitmedia_code",
  coinzilla: "coinzilla_code",
  custom: "custom_ad_code",
};

const pickAds = (s: AppSettings): AdNetworkSettings => ({
  aads_enabled: s.aads_enabled,
  aads_unit_id: s.aads_unit_id,
  adsterra_enabled: s.adsterra_enabled,
  adsterra_code: s.adsterra_code,
  monetag_enabled: s.monetag_enabled,
  monetag_code: s.monetag_code,
  bitmedia_enabled: s.bitmedia_enabled,
  bitmedia_code: s.bitmedia_code,
  coinzilla_enabled: s.coinzilla_enabled,
  coinzilla_code: s.coinzilla_code,
  custom_ad_enabled: s.custom_ad_enabled,
  custom_ad_name: s.custom_ad_name,
  custom_ad_code: s.custom_ad_code,
});

/** The 6 ad network slots: on/off, unit ID or banner code, and a live 300x250 preview. */
export function AdNetworksCard() {
  const { data, isLoading } = useAppSettings();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<AdNetworkSettings | null>(null);
  const [previewing, setPreviewing] = useState<AdNetworkId>("aads");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setDraft((d) => d ?? pickAds(data));
  }, [data]);

  const save = useMutation({
    mutationFn: async (next: AdNetworkSettings) => {
      const { error } = await supabase
        .from("app_settings")
        .update({
          ...next,
          aads_unit_id: next.aads_unit_id.trim(),
          custom_ad_name: next.custom_ad_name.trim().slice(0, 40) || "AdMaven",
          adsterra_code: next.adsterra_code.trim(),
          monetag_code: next.monetag_code.trim(),
          bitmedia_code: next.bitmedia_code.trim(),
          coinzilla_code: next.coinzilla_code.trim(),
          custom_ad_code: next.custom_ad_code.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appSettingsKey });
      void queryClient.invalidateQueries({ queryKey: ["earn_status"] });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    },
  });

  if (isLoading || !draft || !data) return <VaultCard className="h-64 skeleton-shimmer" />;

  const set = <K extends keyof AdNetworkSettings>(key: K, value: AdNetworkSettings[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  const readyCount = AD_NETWORKS.filter((n) => networkReady(n, draft)).length;
  // Preview uses the unsaved draft, with testing mode off so the real banner shows.
  const previewSettings: AppSettings = { ...data, ...draft, testing_mode: false };

  return (
    <VaultCard accent="emerald" className="p-4">
      <div className="flex items-center gap-3">
        <IconTile tone="emerald">
          <Megaphone />
        </IconTile>
        <div className="flex-1">
          <h2 className="font-display font-semibold">Ad networks</h2>
          <p className="text-xs text-muted-foreground">
            Each network serves up to {ADS_PER_NETWORK} ads per player every 11 hours. Empty or switched-off slots are
            skipped and A-ADS fills the gap.
          </p>
        </div>
        <Chip tone={readyCount ? "emerald" : "gold"}>{readyCount}/6 live</Chip>
      </div>

      {data.testing_mode ? (
        <p className="mt-3 rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold ring-1 ring-gold/25">
          Testing mode is on, so players see the test placeholder instead of these ads.
        </p>
      ) : null}

      <div className="mt-4 space-y-2.5">
        {AD_NETWORKS.map((n, i) => {
          const enabled = draft[ENABLED_KEY[n]] as boolean;
          const ready = networkReady(n, draft);
          return (
            <div key={n} className="vault-well space-y-2.5 p-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-6 place-items-center rounded-md bg-muted font-mono text-[0.7rem]">{i + 1}</span>
                <p className="flex-1 text-sm font-semibold">
                  {n === "custom" ? `${networkLabel(n, draft)} · network #6` : networkLabel(n)}
                </p>
                <Chip tone={ready ? "emerald" : enabled ? "gold" : "muted"}>{ready ? "Live" : enabled ? "Needs code" : "Off"}</Chip>
                <Switch
                  aria-label={`Use ${networkLabel(n, draft)}`}
                  checked={enabled}
                  onCheckedChange={(v) => set(ENABLED_KEY[n], v as never)}
                  className="data-[state=checked]:bg-emerald"
                />
              </div>
              {n === "aads" ? (
                <Field label="A-ADS unit ID" htmlFor="ad-aads">
                  <input
                    id="ad-aads"
                    inputMode="numeric"
                    value={draft.aads_unit_id}
                    onChange={(e) => set("aads_unit_id", e.target.value.replace(/\D/g, "").slice(0, 12))}
                    placeholder="e.g. 2412345"
                    className={cn(fieldClass, "font-mono")}
                    aria-invalid={draft.aads_unit_id !== "" && !isAdUnitId(draft.aads_unit_id)}
                  />
                </Field>
              ) : (
                <>
                  {n === "custom" ? (
                    <Field label="Network name" htmlFor="ad-custom-name">
                      <input
                        id="ad-custom-name"
                        value={draft.custom_ad_name}
                        maxLength={40}
                        onChange={(e) => set("custom_ad_name", e.target.value)}
                        placeholder="AdMaven"
                        className={fieldClass}
                      />
                    </Field>
                  ) : null}
                  <Field label="300 × 250 banner code (script or iframe)" htmlFor={`ad-${n}`}>
                    <textarea
                      id={`ad-${n}`}
                      rows={3}
                      maxLength={8000}
                      spellCheck={false}
                      value={draft[CODE_KEY[n]] as string}
                      onChange={(e) => set(CODE_KEY[n], e.target.value as never)}
                      placeholder={'<script src="…"></script>'}
                      className={cn(fieldClass, "h-auto py-2.5 font-mono text-[0.7rem]")}
                    />
                  </Field>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="vault-well mt-3 p-3">
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <p className="mr-auto font-display text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Live preview · 300 × 250
          </p>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Network to preview">
          {AD_NETWORKS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={previewing === n}
              onClick={() => setPreviewing(n)}
              className="cursor-pointer rounded-full px-2.5 py-1 text-[0.7rem] font-semibold text-muted-foreground ring-1 ring-border aria-checked:bg-emerald/15 aria-checked:text-emerald aria-checked:ring-emerald/40"
            >
              {networkLabel(n, draft)}
            </button>
          ))}
        </div>
        <SponsorAd network={previewing} preview={previewSettings} />
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {networkReady(previewing, draft)
            ? "Save to show this network to players."
            : networkReady("aads", draft)
              ? `${networkLabel(previewing, draft)} isn't ready, so players would get A-ADS here.`
              : "Add a code or A-ADS unit ID to preview a real ad."}
        </p>
      </div>

      {save.isError ? <p className="mt-3 text-xs text-destructive">{errorText(save.error)}</p> : null}
      <Button variant="emerald" size="tactile-sm" className="mt-4 w-full" disabled={save.isPending} onClick={() => save.mutate(draft)}>
        {save.isPending ? <Loader2 className="animate-spin" /> : null}
        {saved ? "Saved" : "Save ad networks"}
      </Button>
    </VaultCard>
  );
}
