import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Settings2 } from "lucide-react";

import { isAdUnitId, SponsorAd } from "@/components/ads/SponsorAd";

import { Field, fieldClass } from "@/components/auth/AuthPanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";
import { appSettingsKey, errorText, useAppSettings, type AppSettings } from "@/hooks/use-earn";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function AppSettingsCard() {
  const { data, isLoading } = useAppSettings();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);

  // Load once; the minute-by-minute refresh must not wipe edits in progress.
  useEffect(() => {
    if (data) setDraft((d) => d ?? data);
  }, [data]);

  const save = useMutation({
    mutationFn: async (next: AppSettings) => {
      const { error } = await supabase
        .from("app_settings")
        .update({
          maintenance_mode: next.maintenance_mode,
          maintenance_message: next.maintenance_message.trim() || "Vault maintenance in progress. Be right back!",
          testing_mode: next.testing_mode,
          aads_unit_id: next.aads_unit_id.trim(),
          // Vault stock is never written here: redemptions change it live, so it has its own panel.
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appSettingsKey });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    },
  });

  if (isLoading || !draft) return <VaultCard className="h-64 skeleton-shimmer" />;

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <VaultCard accent="cyan" className="p-4">
      <div className="flex items-center gap-3">
        <IconTile tone="cyan">
          <Settings2 />
        </IconTile>
        <h2 className="font-display font-semibold">App settings</h2>
      </div>

      <div className="mt-4 space-y-3.5">
        <Toggle
          label="Maintenance mode"
          hint="Everyone except you sees the Vault Maintenance screen."
          checked={draft.maintenance_mode}
          onChange={(v) => set("maintenance_mode", v)}
          warn
        />
        <Field label="Maintenance message" htmlFor="set-msg">
          <textarea
            id="set-msg"
            rows={2}
            maxLength={280}
            value={draft.maintenance_message}
            onChange={(e) => set("maintenance_message", e.target.value)}
            className={cn(fieldClass, "h-auto py-2.5")}
          />
        </Field>
        <Toggle
          label="Testing mode"
          hint="Shows a test ad in the Sponsored Slot instead of the ad network."
          checked={draft.testing_mode}
          onChange={(v) => set("testing_mode", v)}
        />
        <Field label="A-ADS unit ID" htmlFor="set-aads">
          <input
            id="set-aads"
            inputMode="numeric"
            value={draft.aads_unit_id}
            onChange={(e) => set("aads_unit_id", e.target.value.replace(/\D/g, "").slice(0, 12))}
            placeholder="e.g. 2412345"
            className={cn(fieldClass, "font-mono")}
          />
        </Field>
        <AdUnitPreview unit={draft.aads_unit_id} testing={draft.testing_mode} />
      </div>

      {save.isError ? <p className="mt-3 text-xs text-destructive">{errorText(save.error)}</p> : null}
      <Button
        variant="cyan"
        size="tactile-sm"
        className="mt-4 w-full"
        disabled={save.isPending}
        onClick={() => save.mutate(draft)}
      >
        {save.isPending ? <Loader2 className="animate-spin" /> : null}
        {saved ? "Saved" : "Save settings"}
      </Button>
    </VaultCard>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  warn,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  warn?: boolean;
}) {
  return (
    <label className="vault-well flex cursor-pointer items-center gap-3 p-3">
      <div className="flex-1">
        <p className={cn("text-sm font-semibold", warn && checked && "text-gold")}>{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-emerald" />
    </label>
  );
}

/** Live 300x250 preview of the unit typed above, so the admin can check it before saving. */
function AdUnitPreview({ unit, testing }: { unit: string; testing: boolean }) {
  const [shown, setShown] = useState(unit);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(unit), 600);
    return () => window.clearTimeout(id);
  }, [unit]);
  const live = !testing && isAdUnitId(shown);
  const status = live ? "Live preview" : testing ? "Testing mode" : shown ? "Invalid ID" : "No unit ID";

  return (
    <div className="vault-well p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="font-display text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          A-ADS preview · 300 × 250
        </p>
        <Chip tone={live ? "emerald" : "gold"}>{status}</Chip>
      </div>
      <SponsorAd preview={{ unit: shown, testing }} />
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {testing
          ? "Testing mode is on, so players see the test placeholder."
          : live
            ? "Save settings to show this unit to players."
            : "Enter your A-ADS unit ID to preview the real ad."}
      </p>
    </div>
  );
}
