import { useQuery, type QueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { PayoutStatus, RewardCategory, RewardId } from "@/lib/payouts";

export type MyPayout = {
  id: string;
  reward: RewardId;
  category: RewardCategory;
  coins_cost: number;
  payout_amount: number;
  destination: string;
  gamepass_id: number | null;
  status: PayoutStatus;
  admin_note: string;
  created_at: string;
  resolved_at: string | null;
};

/** The signed-in player's own payout requests (row-level security limits them to their rows). */
export function useMyPayouts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["payouts", "mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_requests")
        .select("id, reward, category, coins_cost, payout_amount, destination, gamepass_id, status, admin_note, created_at, resolved_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as MyPayout[];
    },
  });
}

/** A Roblox username change waiting for admin approval, if any. */
export function usePendingRobloxChange() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["roblox_change", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roblox_change_requests")
        .select("id, new_username, created_at")
        .eq("user_id", user!.id)
        .eq("status", "pending")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Refreshes everything a redemption or payout decision changes. */
export function refreshPayouts(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["payouts"] });
  void queryClient.invalidateQueries({ queryKey: ["profile"] });
  void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  void queryClient.invalidateQueries({ queryKey: ["app_settings"] });
  void queryClient.invalidateQueries({ queryKey: ["roblox_change"] });
}
