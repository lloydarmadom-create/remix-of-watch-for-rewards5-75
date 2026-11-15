import { createFileRoute } from "@tanstack/react-router";
import { Bitcoin, Gamepad2, Gift, Lock } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "Rewards store — Watch For Rewards" },
      { name: "description", content: "Trade your points for gift cards, game credit and crypto payouts." },
      { property: "og:title", content: "Rewards store — Watch For Rewards" },
      { property: "og:description", content: "Trade your points for gift cards, game credit and crypto payouts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StorePage,
});

const ITEMS = [
  { name: "Game credit", note: "Top up your favorite games", tone: "emerald", icon: Gamepad2 },
  { name: "Gift cards", note: "Popular stores and platforms", tone: "gold", icon: Gift },
  { name: "Crypto payout", note: "Straight to your wallet", tone: "cyan", icon: Bitcoin },
] as const;

function StorePage() {
  return (
    <div>
      <PageHeader eyebrow="Store" title="Cash in your vault.">
        Rewards unlock as you earn. Prices show here at launch.
      </PageHeader>
      <div className="space-y-3">
        {ITEMS.map((item) => (
          <VaultCard key={item.name} accent={item.tone} className="animate-rise p-4">
            <div className="flex items-center gap-3">
              <IconTile tone={item.tone}>
                <item.icon />
              </IconTile>
              <div className="flex-1">
                <p className="font-display text-base font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.note}</p>
              </div>
              <Chip>Soon</Chip>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="font-mono text-sm text-muted-foreground">— pts</span>
              <Button variant="slate" size="tactile-sm" disabled>
                <Lock /> Redeem
              </Button>
            </div>
          </VaultCard>
        ))}
      </div>
    </div>
  );
}
