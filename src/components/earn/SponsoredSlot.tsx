import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Ban, Clock, Loader2, Pause, Play, Store } from "lucide-react";

import { SponsorAd } from "@/components/ads/SponsorAd";

import { Button } from "@/components/ui/button";
import { Chip, VaultCard } from "@/components/vault/VaultCard";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { errorText, refreshEarnings, useAppSettings, useEarnStatus, useNow } from "@/hooks/use-earn";
import { supabase } from "@/integrations/supabase/client";
import { ADS_PER_NETWORK, asNetwork, networkLabel, type AdNetworkId } from "@/lib/ad-networks";
import {
  AD_LIMIT,
  AD_SECONDS,
  AD_WINDOW_HOURS,
  COIN_CAP,
  COINS_PER_AD,
  adWindowState,
  atCoinCap,
  formatCoins,
  formatCountdown,
} from "@/lib/earning";

type Phase = "idle" | "starting" | "watching" | "claiming" | "done";

export function SponsoredSlot() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: settings } = useAppSettings();
  const status = useEarnStatus();
  const queryClient = useQueryClient();
  const now = useNow();

  const [phase, setPhase] = useState<Phase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [network, setNetwork] = useState<AdNetworkId | null>(null);
  const [remainingMs, setRemainingMs] = useState(AD_SECONDS * 1000);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finishing = useRef(false);

  const complete = useCallback(
    async (id: string) => {
      if (finishing.current) return;
      finishing.current = true;
      setPhase("claiming");
      const { error: err } = await supabase.rpc("complete_ad_view", { p_session_id: id });
      finishing.current = false;
      refreshEarnings(queryClient);
      if (err) {
        setError(errorText(err));
        setPhase("idle");
        return;
      }
      setPhase("done");
      window.setTimeout(() => setPhase((p) => (p === "done" ? "idle" : p)), 2600);
    },
    [queryClient],
  );

  // 15-second countdown that only runs while this tab is visible.
  useEffect(() => {
    if (phase !== "watching" || !sessionId) return;
    let left = AD_SECONDS * 1000;
    let last = performance.now();
    setRemainingMs(left);
    setPaused(document.hidden);

    const onVisibility = () => {
      last = performance.now();
      setPaused(document.hidden);
    };
    const id = window.setInterval(() => {
      const t = performance.now();
      if (!document.hidden) left -= t - last;
      last = t;
      setRemainingMs(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(id);
        void complete(sessionId);
      }
    }, 200);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase, sessionId, complete]);

  const start = async () => {
    setError(null);
    setPhase("starting");
    const { data, error: err } = await supabase.rpc("start_ad_view_v2");
    const started = (data ?? null) as { session_id?: string; network?: string } | null;
    if (err || !started?.session_id) {
      setError(errorText(err));
      setPhase("idle");
      refreshEarnings(queryClient);
      return;
    }
    setNetwork(asNetwork(started.network));
    setSessionId(started.session_id);
    setPhase("watching");
  };

  const window11 = adWindowState(
    status.data?.ads_in_window ?? 0,
    status.data?.oldest_in_window ?? null,
    now || Date.now(),
  );
  const capped = profile ? atCoinCap(profile.coin_balance) : false;
  const banned = profile?.is_banned === true;

  // When the oldest slot expires, re-check the window from the server.
  useEffect(() => {
    if (window11.resetsAt && now && now >= window11.resetsAt) {
      void queryClient.invalidateQueries({ queryKey: ["earn_status"] });
    }
  }, [now, window11.resetsAt, queryClient]);

  const progress = 1 - remainingMs / (AD_SECONDS * 1000);
  const active = phase === "watching" || phase === "claiming";
  // While an ad runs, show the network the server picked; otherwise the one up next.
  const slotNetwork: AdNetworkId = (active && network) || status.data?.next_network || "aads";
  const servedHere = status.data?.network_counts[slotNetwork] ?? 0;

  return (
    <VaultCard accent="cyan" className="animate-rise p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Sponsored slot
          </span>
          {settings?.testing_mode ? <Chip tone="gold">Test mode</Chip> : null}
        </div>
        {user ? (
          <Chip tone={window11.blocked ? "gold" : "cyan"}>
            {window11.used}/{AD_LIMIT} ads
          </Chip>
        ) : null}
      </div>

      <SponsorAd className="mt-3" network={slotNetwork}>
        {phase === "done" ? (
          <div className="animate-rise absolute inset-0 grid place-items-center bg-background/85 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-gold-gradient font-mono text-4xl font-semibold">+{formatCoins(COINS_PER_AD)}</p>
              <p className="mt-1 font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">Coin added</p>
            </div>
          </div>
        ) : null}
        {active && paused ? (
          <div className="absolute inset-0 grid place-items-center bg-background/85 backdrop-blur-sm">
            <div className="text-center">
              <Pause className="mx-auto size-7 text-gold" />
              <p className="mt-2 text-sm font-semibold">Paused</p>
              <p className="text-xs text-muted-foreground">Stay on this tab to keep the timer running.</p>
            </div>
          </div>
        ) : null}
      </SponsorAd>

      {!active && phase !== "done" ? (
        <p className="mt-2.5 text-center text-xs text-muted-foreground">
          Watch {AD_SECONDS}s · earn +{formatCoins(COINS_PER_AD)} Coin
          {user && !settings?.testing_mode ? (
            <>
              {" "}· {networkLabel(slotNetwork, settings)} {Math.min(servedHere, ADS_PER_NETWORK)}/{ADS_PER_NETWORK}
            </>
          ) : null}
        </p>
      ) : null}

      {active ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-vault-inner">
            <div
              className="h-full rounded-full bg-cyan transition-[width] duration-200 ease-linear"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-center font-mono text-sm tabular-nums text-muted-foreground">
            {phase === "claiming" ? "Adding your coin…" : `${Math.ceil(remainingMs / 1000)}s left`}
          </p>
        </div>
      ) : !user ? (
        <Button asChild variant="cyan" size="tactile" className="mt-3 w-full">
          <Link to="/profile">Sign in to watch ads</Link>
        </Button>
      ) : banned ? (
        <Notice icon={<Ban className="size-4 text-destructive" />}>This account is suspended.</Notice>
      ) : capped ? (
        <>
          <Notice icon={<Store className="size-4 text-gold" />}>
            Your vault is full at {COIN_CAP.toLocaleString("en-US")} coins. Spend coins in the Store to keep
            watching. You can redeem any time.
          </Notice>
          <Button asChild variant="gold" size="tactile" className="mt-3 w-full">
            <Link to="/store">Go to Store</Link>
          </Button>
        </>
      ) : window11.blocked ? (
        <>
          <Button variant="cyan" size="tactile" className="mt-3 w-full" disabled>
            <Clock /> Next ad in {window11.resetsAt && now ? formatCountdown(window11.resetsAt - now) : "…"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            You've hit {AD_LIMIT} ads in {AD_WINDOW_HOURS} hours. A slot opens when your oldest ad expires.
          </p>
        </>
      ) : (
        <Button
          variant="cyan"
          size="tactile"
          className="mt-3 w-full"
          onClick={start}
          disabled={phase !== "idle" || status.isLoading}
        >
          {phase === "starting" ? <Loader2 className="animate-spin" /> : <Play />} Watch ad
        </Button>
      )}

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive ring-1 ring-destructive/25">
          {error}
        </p>
      ) : null}
    </VaultCard>
  );
}

function Notice({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="vault-well mt-3 flex items-start gap-2.5 p-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="text-xs text-muted-foreground">{children}</p>
    </div>
  );
}
