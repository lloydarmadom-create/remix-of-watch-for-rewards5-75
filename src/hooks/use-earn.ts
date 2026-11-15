import { useEffect, useState } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

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

export type AppSettings = {
  maintenance_mode: boolean;
  maintenance_message: string;
  testing_mode: boolean;
  aads_unit_id: string;
  sats_stock: number;
  robux_stock: number;
};

export const appSettingsKey = ["app_settings"] as const;

/** Shared app switches (public read). Re-checked every minute so maintenance applies quickly. */
export function useAppSettings() {
  return useQuery({
    queryKey: appSettingsKey,
    refetchInterval: 60_000,
    queryFn: async (): Promise<AppSettings | null> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("maintenance_mode, maintenance_message, testing_mode, aads_unit_id, sats_stock, robux_stock")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
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

export type EarnStatus = { ads_in_window: number; oldest_in_window: string | null; invited_count: number };

export function useEarnStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["earn_status", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<EarnStatus> => {
      const { data, error } = await supabase.rpc("get_earn_status");
      if (error) throw error;
      const d = (data ?? {}) as Partial<EarnStatus>;
      return {
        ads_in_window: Number(d.ads_in_window ?? 0),
        oldest_in_window: d.oldest_in_window ?? null,
        invited_count: Number(d.invited_count ?? 0),
      };
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
