import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { captureReferralFromUrl } from "@/lib/referral";

type AuthState = { session: Session | null; user: User | null; ready: boolean };

const AuthContext = createContext<AuthState>({ session: null, user: null, ready: false });

/** Single app-wide auth listener. Mounted once in the root route. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, user: null, ready: false });
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    captureReferralFromUrl();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, user: session?.user ?? null, ready: true });
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ session, user: session?.user ?? null, ready: true });
    });

    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export type PlayerProfile = {
  email: string;
  referral_code: string;
  referred_by: string | null;
  coin_balance: number;
  level: number;
  is_banned: boolean;
  streak_count: number;
  created_at: string;
};

/** The signed-in player's own profile row (RLS limits it to their row). */
export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<PlayerProfile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("email, referral_code, referred_by, coin_balance, level, is_banned, streak_count, created_at")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
