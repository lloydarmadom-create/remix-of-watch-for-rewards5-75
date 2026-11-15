import { createFileRoute, Link } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { VaultCard } from "@/components/vault/VaultCard";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — Watch For Rewards" },
      { name: "description", content: "Every point you earn and every reward you redeem, in one ledger." },
      { property: "og:title", content: "History — Watch For Rewards" },
      { property: "og:description", content: "Every point you earn and every reward you redeem, in one ledger." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

const FILTERS = ["All", "Earned", "Redeemed"];

function HistoryPage() {
  return (
    <div>
      <PageHeader eyebrow="History" title="Your ledger." />
      <div className="mb-3 flex gap-2" role="tablist" aria-label="Filter history">
        {FILTERS.map((f, i) => (
          <button
            key={f}
            role="tab"
            aria-selected={i === 0}
            className="cursor-pointer rounded-full px-3.5 py-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground ring-1 ring-border transition-colors aria-selected:bg-emerald/10 aria-selected:text-emerald aria-selected:ring-emerald/30"
          >
            {f}
          </button>
        ))}
      </div>
      <VaultCard className="animate-rise p-6 text-center">
        <div className="vault-well mx-auto grid size-16 place-items-center">
          <ScrollText className="size-7 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-lg font-bold">Nothing here yet</h2>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
          Points you earn and rewards you redeem will show up here.
        </p>
        <Button asChild variant="cyan" size="tactile-sm" className="mt-5">
          <Link to="/videos">Watch a video</Link>
        </Button>
      </VaultCard>
    </div>
  );
}
