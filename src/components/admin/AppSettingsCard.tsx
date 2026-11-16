import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Settings2 } from "lucide-react";

import { SettingToggle } from "@/components/admin/SettingToggle";
import { Field, fieldClass } from "@/components/auth/AuthPanel";
import { Button } from "@/components/ui/button";
import { IconTile, VaultCard } from "@/components/vault/VaultCard";
import { appSettingsKey, errorText, useAppSettings } from "@/hooks/use-earn";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Draft = { maintenance_mode: boolean; maintenance_message: string; testing_mode: boolean };

/** Maintenance and testing switches. Ads, auto-pay and vault stock each have their own panel. */
export function AppSettingsCard() {
  const { data, isLoading } = useAppSettings();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(false);

  // Load once; the minute-by-minute refresh must not wipe edits in progress.
  useEffect(() => {
    if (data) {
      setDraft(
        (d) => d ?? { maintenance_mode: data.maintenance_mode, maintenance_message: data.maintenance_message, testing_mode: data.testing_mode },
      );
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async (next: Draft) => {
      const { error } = await supabase
        .from("app_settings")
        .update({
          maintenance_mode: next.maintenance_mode,
          maintenance_message: next.maintenance_message.trim() || "Vault maintenance in progress. Be right back!",
          testing_mode: next.testing_mode,
          updated_at: new Date().toISOString(),
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

  if (isLoading || !draft) return <VaultCard className="h-48 skeleton-shimmer" />;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <VaultCard accent="cyan" className="p-4">
      <div className="flex items-center gap-3">
        <IconTile tone="cyan">
          <Settings2 />
        </IconTile>
        <h2 className="font-display font-semibold">App settings</h2>
      </div>

      <div className="mt-4 space-y-3.5">
        <SettingToggle
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
        <SettingToggle
          label="Testing mode"
          hint="Shows a test ad instead of the ad networks and skips Store cooldowns."
          checked={draft.testing_mode}
          onChange={(v) => set("testing_mode", v)}
        />
      </div>

      {save.isError ? <p className="mt-3 text-xs text-destructive">{errorText(save.error)}</p> : null}
      <Button variant="cyan" size="tactile-sm" className="mt-4 w-full" disabled={save.isPending} onClick={() => save.mutate(draft)}>
        {save.isPending ? <Loader2 className="animate-spin" /> : null}
        {saved ? "Saved" : "Save settings"}
      </Button>
    </VaultCard>
  );
}
