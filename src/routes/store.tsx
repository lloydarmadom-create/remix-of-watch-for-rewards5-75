import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bitcoin, Clock, Gamepad2, Lock, Timer } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { RobuxRedeemDialog } from "@/components/store/RobuxRedeemDialog";
import { SatsRedeemDialog } from "@/components/store/SatsRedeemDialog";
import { PolicyCard, VaultStockBars } from "@/components/store/StoreBits";
import { Button } from "@/components/ui/button";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { useAppSettings, useNow } from "@/hooks/use-earn";
import { useMyPayouts } from "@/hooks/use-payouts";
import { formatCoins, formatCountdown } from "@/lib/earning";
import { precheckRedemption, REWARD_LIST, rewardCooldown, type Reward, type RewardId } from "@/lib/payouts";

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "Rewards store — Watch For Rewards" },
      { name: "description", content: "Trade your coins for Bitcoin Sats over Lightning or Robux via your own Gamepass." },
      { property: "og:title", content: "Rewards store — Watch For Rewards" },
      { property: "og:description", content: "Trade your coins for Bitcoin Sats over Lightning or Robux via your own Gamepass." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const { data: settings } = useAppSettings();
  const [open, setOpen] = useState<RewardId | null>(null);
  const satsReward = REWARD_LIST.find((r) => r.category === "sats")!;
  const robuxOpen = open === "robux_5" || open === "robux_10" ? REWARD_LIST.find((r) => r.id === open)! : null;

  return (
    <div className="space-y-3">
      <PageHeader eyebrow="Store" title="Cash in your vault.">
        Spend coins on real Sats and Robux. Every payout is checked and sent by hand.
      </PageHeader>
      <PolicyCard />
      <VaultStockBars sats={settings?.sats_stock} robux={settings?.robux_stock} />
      {settings?.testing_mode ? (
        <p className="rounded-lg bg-gold/10 px-3 py-2 text-center text-xs text-gold ring-1 ring-gold/25">
          Testing mode is on: cooldowns are skipped.
        </p>
      ) : null}
      {REWARD_LIST.map((r) => (
        <RewardCard key={r.id} reward={r} onRedeem={() => setOpen(r.id)} />
      ))}

      <SatsRedeemDialog reward={satsReward} open={open === "sats_20"} onOpenChange={(o) => setOpen(o ? "sats_20" : null)} />
      {robuxOpen ? (
        <RobuxRedeemDialog key={robuxOpen.id} reward={robuxOpen} open onOpenChange={(o) => setOpen(o ? robuxOpen.id : null)} />
      ) : null}
    </div>
  );
}

function RewardCard({ reward, onRedeem }: { reward: Reward; onRedeem: () => void }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: settings } = useAppSettings();
  const payouts = useMyPayouts();
  const now = useNow();

  const sats = reward.category === "sats";
  const tone = sats ? "gold" : "emerald";
  const balance = Number(profile?.coin_balance ?? 0);
  const testing = !!settings?.testing_mode;
  const cd = rewardCooldown(reward.category, payouts.data ?? [], now || Date.now(), testing);
  const ready = !!user && !!profile && !!settings && !payouts.isLoading;
  const blocker =
    user && profile && settings && !payouts.isLoading
      ? precheckRedemption({
        reward,
        coinBalance: balance,
        isBanned: profile.is_banned,
        maintenance: settings.maintenance_mode,
        testingMode: testing,
        stock: sats ? settings.sats_stock : settings.robux_stock,
        payouts: payouts.data ?? [],
        now: now || Date.now(),
        robloxUserId: 1, // username is verified inside the redeem window
      })
    : null;
  const pct = Math.min(100, (balance / reward.coins) * 100);

  return (
    <VaultCard accent={tone} className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <IconTile tone={tone}>{sats ? <Bitcoin /> : <Gamepad2 />}</IconTile>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold">{reward.title}</p>
          <p className="text-xs text-muted-foreground">
            {sats ? "Bitcoin Lightning" : `Needs a ${reward.gamepassPrice} Robux Gamepass`}
          </p>
        </div>
        <span className="font-mono text-sm font-semibold text-gold">{reward.coins.toLocaleString("en-US")}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip>
          <Timer className="size-3" /> {sats ? "24-hour Sats cooldown" : "7-day Robux cooldown"}
        </Chip>
        <Chip>−{reward.stockCost} {sats ? "Sats" : "Robux"} stock</Chip>
        {user ? (
          cd.bypassed ? (
            <Chip tone="gold">Cooldown off</Chip>
          ) : cd.ready ? (
            <Chip tone="emerald">Ready</Chip>
          ) : (
            <Chip tone="cyan">
              <Clock className="size-3" />
              {cd.readyAt && now ? formatCountdown(cd.readyAt - now) : "…"}
            </Chip>
          )
        ) : null}
      </div>

      {user ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[0.7rem] text-muted-foreground">
            <span>Your coins</span>
            <span className="font-mono">
              {formatCoins(balance)} / {reward.coins.toLocaleString("en-US")}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-vault-inner">
            <div className={sats ? "h-full rounded-full bg-gold" : "h-full rounded-full bg-emerald"} style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      {!user ? (
        <Button asChild variant="slate" size="tactile-sm" className="mt-4 w-full">
          <Link to="/profile">
            <Lock /> Sign in to redeem
          </Link>
        </Button>
      ) : (
        <>
          <Button variant={tone} size="tactile-sm" className="mt-4 w-full" disabled={!ready || !!blocker} onClick={onRedeem}>
            {blocker ? <Lock /> : null} Redeem {reward.title}
          </Button>
          {blocker ? <p className="mt-2 text-center text-xs text-muted-foreground">{blocker}.</p> : null}
        </>
      )}
    </VaultCard>
  );
}
