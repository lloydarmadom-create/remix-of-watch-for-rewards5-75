import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { CalendarCheck, Gift, Play, ScrollText, SlidersHorizontal, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { IconTile, VaultCard } from "@/components/vault/VaultCard";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatCoins } from "@/lib/earning";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — Watch For Rewards" },
      { name: "description", content: "Every coin you earn and every reward you redeem, in one ledger." },
      { property: "og:title", content: "History — Watch For Rewards" },
      { property: "og:description", content: "Every coin you earn and every reward you redeem, in one ledger." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

const FILTERS = ["All", "Earned", "Redeemed"] as const;
type Filter = (typeof FILTERS)[number];

const KIND = {
  ad: { icon: Play, tone: "cyan", label: "Ad watched" },
  streak: { icon: CalendarCheck, tone: "gold", label: "Daily check-in" },
  referral: { icon: Users, tone: "emerald", label: "Invite reward" },
  redeem: { icon: Gift, tone: "gold", label: "Reward redeemed" },
  adjustment: { icon: SlidersHorizontal, tone: "muted", label: "Balance adjustment" },
} as const;

function HistoryPage() {
  const { user, ready } = useAuth();
  const [filter, setFilter] = useState<Filter>("All");

  const tx = useQuery({
    queryKey: ["transactions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, amount, kind, note, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const rows = (tx.data ?? []).filter((t) =>
    filter === "All" ? true : filter === "Earned" ? Number(t.amount) > 0 : t.kind === "redeem",
  );

  return (
    <div>
      <PageHeader eyebrow="History" title="Your ledger." />
      <div className="mb-3 flex gap-2" role="tablist" aria-label="Filter history">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            type="button"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className="cursor-pointer rounded-full px-3.5 py-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground ring-1 ring-border transition-colors aria-selected:bg-emerald/10 aria-selected:text-emerald aria-selected:ring-emerald/30"
          >
            {f}
          </button>
        ))}
      </div>

      {!ready || (user && tx.isLoading) ? (
        <VaultCard className="h-40 skeleton-shimmer" />
      ) : !user ? (
        <Empty title="Sign in to see your ledger" body="Coins you earn and rewards you redeem will show up here.">
          <Button asChild variant="emerald" size="tactile-sm" className="mt-5">
            <Link to="/profile">Sign in</Link>
          </Button>
        </Empty>
      ) : tx.isError ? (
        <VaultCard className="p-4 text-sm text-destructive">We couldn't load your history. Please reload the page.</VaultCard>
      ) : rows.length === 0 ? (
        <Empty title="Nothing here yet" body="Coins you earn and rewards you redeem will show up here.">
          <Button asChild variant="cyan" size="tactile-sm" className="mt-5">
            <Link to="/">Watch an ad</Link>
          </Button>
        </Empty>
      ) : (
        <VaultCard className="animate-rise divide-y divide-border p-0">
          {rows.map((t) => {
            const k = KIND[t.kind as keyof typeof KIND] ?? KIND.adjustment;
            const amount = Number(t.amount);
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <IconTile tone={k.tone} className="size-9">
                  <k.icon />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.note || k.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                  </p>
                </div>
                <span className={amount >= 0 ? "font-mono text-sm font-semibold text-gold" : "font-mono text-sm font-semibold text-muted-foreground"}>
                  {amount >= 0 ? "+" : "−"}
                  {formatCoins(Math.abs(amount))}
                </span>
              </div>
            );
          })}
        </VaultCard>
      )}
    </div>
  );
}

function Empty({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <VaultCard className="animate-rise p-6 text-center">
      <div className="vault-well mx-auto grid size-16 place-items-center">
        <ScrollText className="size-7 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
      {children}
    </VaultCard>
  );
}
