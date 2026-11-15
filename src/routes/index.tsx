import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { DailyTrivia } from "@/components/earn/DailyTrivia";
import { InviteCard } from "@/components/earn/InviteCard";
import { RobuxTaxCalculator } from "@/components/earn/RobuxTaxCalculator";
import { SponsoredSlot } from "@/components/earn/SponsoredSlot";
import { StreakCard } from "@/components/earn/StreakCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Chip, VaultCard } from "@/components/vault/VaultCard";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { COIN_CAP, MAX_LEVEL, formatCoins, levelProgress } from "@/lib/earning";

const DESCRIPTION =
  "Watch sponsored ads, keep a daily check-in streak, invite friends and use free Roblox tools to stack coins toward gaming and crypto rewards.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Earn coins — Watch For Rewards" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Earn coins — Watch For Rewards" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EarnPage,
});

function EarnPage() {
  const { user, ready } = useAuth();

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Earn" title="Stack coins, your way.">
        Every ad, check-in and invite adds to your vault.
      </PageHeader>

      <BalanceCard />
      <SponsoredSlot />
      {ready && user ? (
        <>
          <StreakCard />
          <InviteCard />
        </>
      ) : null}

      <section aria-labelledby="tools" className="space-y-3">
        <h2 id="tools" className="px-1 pt-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Gaming tools
        </h2>
        <RobuxTaxCalculator />
        <DailyTrivia />
      </section>
    </div>
  );
}

function BalanceCard() {
  const { user, ready } = useAuth();
  const { data: profile } = useProfile();
  const balance = user ? (profile?.coin_balance ?? 0) : 0;
  const lvl = levelProgress(profile?.lifetime_earned ?? 0);

  return (
    <VaultCard accent="gold" className="animate-rise p-5">
      <div className="flex items-center justify-between">
        <p className="font-display text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Vault balance
        </p>
        {user ? (
          <Chip tone="gold">
            Level {lvl.level}
            {lvl.maxed ? " · Max" : ""}
          </Chip>
        ) : (
          <Chip tone="emerald">
            <Sparkles className="size-3" /> Free
          </Chip>
        )}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-gold-gradient font-mono text-5xl font-semibold leading-none tabular-nums">
          {formatCoins(balance)}
        </span>
        <span className="pb-1 font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">coins</span>
      </div>

      {user ? (
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between font-display text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            <span>{lvl.maxed ? `Max level ${MAX_LEVEL}` : `Level ${lvl.level + 1} in ${formatCoins(lvl.needed - lvl.intoLevel)} coins`}</span>
            <span>Cap {COIN_CAP.toLocaleString("en-US")}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-vault-inner">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-500"
              style={{ width: `${(lvl.intoLevel / lvl.needed) * 100}%` }}
            />
          </div>
        </div>
      ) : ready ? (
        <Button asChild variant="emerald" size="tactile" className="mt-4 w-full">
          <Link to="/profile">Create free account</Link>
        </Button>
      ) : null}
    </VaultCard>
  );
}
