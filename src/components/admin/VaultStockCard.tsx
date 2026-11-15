import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bitcoin, Gamepad2, Loader2, Vault } from "lucide-react";

import { Field, fieldClass } from "@/components/auth/AuthPanel";
import { Button } from "@/components/ui/button";
import { IconTile, VaultCard } from "@/components/vault/VaultCard";
import { appSettingsKey, errorText, useAppSettings } from "@/hooks/use-earn";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Vault stock lives apart from App settings. Changes are sent as +/- amounts, so a payout
 * taken while this screen is open is never overwritten.
 */
export function VaultStockCard() {
  const { data } = useAppSettings();
  const queryClient = useQueryClient();
  const [sats, setSats] = useState("");
  const [robux, setRobux] = useState("");

  const adjust = useMutation({
    mutationFn: async ({ s, r }: { s: number; r: number }) => {
      const { error } = await supabase.rpc("admin_adjust_stock", { p_sats_delta: s, p_robux_delta: r });
      if (error) throw error;
    },
    onSuccess: () => {
      setSats("");
      setRobux("");
      void queryClient.invalidateQueries({ queryKey: appSettingsKey });
      void queryClient.invalidateQueries({ queryKey: ["admin", "audit_logs"] });
    },
  });

  const s = Math.trunc(Number(sats) || 0);
  const r = Math.trunc(Number(robux) || 0);

  return (
    <VaultCard accent="gold" className="p-4">
      <div className="flex items-center gap-3">
        <IconTile tone="gold">
          <Vault />
        </IconTile>
        <div>
          <h2 className="font-display font-semibold">Vault stock</h2>
          <p className="text-xs text-muted-foreground">Add or remove stock. Payouts update it live.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Current icon={<Bitcoin className="size-4 text-gold" />} label="Sats" value={data?.sats_stock} />
        <Current icon={<Gamepad2 className="size-4 text-emerald" />} label="Robux" value={data?.robux_stock} />
        <Field label="Sats change" htmlFor="stock-sats">
          <input
            id="stock-sats"
            inputMode="numeric"
            value={sats}
            onChange={(e) => setSats(e.target.value.replace(/[^\d-]/g, "").slice(0, 8))}
            placeholder="+500 or -100"
            className={cn(fieldClass, "font-mono")}
          />
        </Field>
        <Field label="Robux change" htmlFor="stock-robux">
          <input
            id="stock-robux"
            inputMode="numeric"
            value={robux}
            onChange={(e) => setRobux(e.target.value.replace(/[^\d-]/g, "").slice(0, 8))}
            placeholder="+100 or -15"
            className={cn(fieldClass, "font-mono")}
          />
        </Field>
      </div>

      {adjust.isError ? <p className="mt-3 text-xs text-destructive">{errorText(adjust.error)}</p> : null}
      <Button
        variant="gold"
        size="tactile-sm"
        className="mt-4 w-full"
        disabled={adjust.isPending || (s === 0 && r === 0)}
        onClick={() => adjust.mutate({ s, r })}
      >
        {adjust.isPending ? <Loader2 className="animate-spin" /> : null}
        Update stock
      </Button>
    </VaultCard>
  );
}

function Current({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | undefined }) {
  return (
    <div className="vault-well flex items-center gap-2.5 p-3">
      {icon}
      <div>
        <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">{label} in vault</p>
        <p className="font-mono text-lg font-semibold tabular-nums">{value?.toLocaleString("en-US") ?? "…"}</p>
      </div>
    </div>
  );
}
