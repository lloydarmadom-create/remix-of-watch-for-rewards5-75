import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Settings2 } from "lucide-react";

import { Field, fieldClass } from "@/components/auth/AuthPanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { IconTile, VaultCard } from "@/components/vault/VaultCard";
import { appSettingsKey, errorText, useAppSettings, type AppSettings } from "@/hooks/use-earn";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function AppSettingsCard() {
  const { data, isLoading } = useAppSettings();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setDraft(data);
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
          sats_stock: Math.max(0, Math.floor(next.sats_stock)),
          robux_stock: Math.max(0, Math.floor(next.robux_stock)),
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
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Sats stock" htmlFor="set-sats">
            <input
              id="set-sats"
              type="number"
              min={0}
              value={draft.sats_stock}
              onChange={(e) => set("sats_stock", Number(e.target.value) || 0)}
              className={cn(fieldClass, "font-mono")}
            />
          </Field>
          <Field label="Robux stock" htmlFor="set-robux">
            <input
              id="set-robux"
              type="number"
              min={0}
              value={draft.robux_stock}
              onChange={(e) => set("robux_stock", Number(e.target.value) || 0)}
              className={cn(fieldClass, "font-mono")}
            />
          </Field>
        </div>
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
