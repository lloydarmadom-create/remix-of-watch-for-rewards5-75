import { useEffect, useState } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { asNetwork, type AdNetworkId, type AdNetworkSettings } from "@/lib/ad-networks";

/** Current time, refreshed on an interval, for live countdowns. */
export function useNow(intervalMs = 1000) {
  // 0 until mounted, so server and browser render the same first frame.
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export type LightningProvider = "manual" | "zbd" | "blink" | "speed" | "alby";

/** Public app switches. Vault stock is not here: only the admin can read it (useAdminStock). */
export type AppSettings = AdNetworkSettings & {
  maintenance_mode: boolean;
  maintenance_message: string;
  testing_mode: boolean;
  auto_pay_lightning: boolean;
  lightning_provider: LightningProvider;
};

export const APP_SETTINGS_COLUMNS =
  "maintenance_mode, maintenance_message, testing_mode, aads_unit_id, aads_enabled, adsterra_enabled, adsterra_code, monetag_enabled, monetag_code, bitmedia_enabled, bitmedia_code, coinzilla_enabled, coinzilla_code, custom_ad_enabled, custom_ad_name, custom_ad_code, auto_pay_lightning, lightning_provider";

export const appSettingsKey = ["app_settings"] as const;

/** Shared app switches (public read). Re-checked every minute so maintenance applies quickly. */
export function useAppSettings() {
  return useQuery({
    queryKey: appSettingsKey,
    refetchInterval: 60_000,
    queryFn: async (): Promise<AppSettings | null> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select(APP_SETTINGS_COLUMNS)
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as AppSettings | null;
    },
  });
}

/** Asks the database whether the signed-in account is the admin. */
export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_admin", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_admin");
      if (error) return false;
      return data === true;
    },
  });
}

export type EarnStatus = {
  ads_in_window: number;
  oldest_in_window: string | null;
  invited_count: number;
  /** Ads served per network in the current 11-hour cycle. */
  network_counts: Record<string, number>;
  /** The network that serves this player's next ad. */
  next_network: AdNetworkId;
};

export function useEarnStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["earn_status", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<EarnStatus> => {
      const { data, error } = await supabase.rpc("get_earn_status");
      if (error) throw error;
      const d = (data ?? {}) as Partial<EarnStatus>;
      const counts: Record<string, number> = {};
      Object.entries(d.network_counts ?? {}).forEach(([k, v]) => (counts[k] = Number(v) || 0));
      return {
        ads_in_window: Number(d.ads_in_window ?? 0),
        oldest_in_window: d.oldest_in_window ?? null,
        invited_count: Number(d.invited_count ?? 0),
        network_counts: counts,
        next_network: asNetwork(d.next_network),
      };
    },
  });
}

export const adminStockKey = ["admin", "stock"] as const;

/** Vault stock. Admin only; the database refuses everyone else. */
export function useAdminStock() {
  return useQuery({
    queryKey: adminStockKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_stock");
      if (error) throw error;
      const d = (data ?? {}) as { sats_stock?: number; robux_stock?: number };
      return { sats_stock: Number(d.sats_stock ?? 0), robux_stock: Number(d.robux_stock ?? 0) };
    },
  });
}

/** Refreshes everything that changes when coins are earned. */
export function refreshEarnings(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["profile"] });
  void queryClient.invalidateQueries({ queryKey: ["earn_status"] });
  void queryClient.invalidateQueries({ queryKey: ["transactions"] });
}

export function errorText(err: unknown) {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") return err.message;
  return "Something went wrong. Please try again.";
}
