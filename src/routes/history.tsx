import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Bitcoin, CalendarCheck, Clapperboard, Gamepad2, Gift, Play, ScrollText, SlidersHorizontal, Undo2, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";
import { useAuth } from "@/hooks/use-auth";
import { useMyPayouts, type MyPayout } from "@/hooks/use-payouts";
import { supabase } from "@/integrations/supabase/client";
import { formatCoins } from "@/lib/earning";
import { REWARDS, STATUS_LABEL } from "@/lib/payouts";

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

const FILTERS = ["All", "Earned", "Withdrawals"] as const;
type Filter = (typeof FILTERS)[number];

const KIND = {
  ad: { icon: Play, tone: "cyan", label: "Ad watched" },
  streak: { icon: CalendarCheck, tone: "gold", label: "Daily check-in" },
  referral: { icon: Users, tone: "emerald", label: "Invite reward" },
  redeem: { icon: Gift, tone: "gold", label: "Reward redeemed" },
  refund: { icon: Undo2, tone: "emerald", label: "Payout refunded" },
  video_view: { icon: Clapperboard, tone: "cyan", label: "Video watched" },
  video_creator: { icon: Clapperboard, tone: "emerald", label: "Creator reward" },
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

  const payouts = useMyPayouts();
  const withdrawals = payouts.data ?? [];
  const rows = (tx.data ?? []).filter((t) => (filter === "Earned" ? Number(t.amount) > 0 && t.kind !== "refund" : true));
  const loading = tx.isLoading || payouts.isLoading;
  const nothing = filter === "Withdrawals" ? withdrawals.length === 0 : rows.length === 0 && (filter === "Earned" || withdrawals.length === 0);

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

      {!ready || (user && loading) ? (
        <VaultCard className="h-40 skeleton-shimmer" />
      ) : !user ? (
        <Empty title="Sign in to see your ledger" body="Coins you earn and rewards you redeem will show up here.">
          <Button asChild variant="emerald" size="tactile-sm" className="mt-5">
            <Link to="/profile">Sign in</Link>
          </Button>
        </Empty>
      ) : tx.isError ? (
        <VaultCard className="p-4 text-sm text-destructive">We couldn't load your history. Please reload the page.</VaultCard>
      ) : nothing ? (
        <Empty
          title={filter === "Withdrawals" ? "No withdrawals yet" : "Nothing here yet"}
          body={filter === "Withdrawals" ? "Rewards you redeem in the Store show up here with their status." : "Coins you earn and rewards you redeem will show up here."}
        >
          <Button asChild variant="cyan" size="tactile-sm" className="mt-5">
            <Link to="/">Watch an ad</Link>
          </Button>
        </Empty>
      ) : (
        <div className="space-y-4">
          {filter !== "Earned" && withdrawals.length ? <Withdrawals list={withdrawals} /> : null}
          {filter !== "Withdrawals" && rows.length ? (
        <section aria-label="Coin ledger" className="space-y-2">
          {filter === "All" ? <SectionTitle>Coin ledger</SectionTitle> : null}
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
        </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</h2>;
}

function Withdrawals({ list }: { list: MyPayout[] }) {
  return (
    <section aria-label="Withdrawals" className="space-y-2">
      <SectionTitle>Withdrawals</SectionTitle>
      <VaultCard className="animate-rise divide-y divide-border p-0">
        {list.map((p) => {
          const sats = p.category === "sats";
          const tone = p.status === "paid" ? "emerald" : p.status === "pending" ? "gold" : "muted";
          return (
            <div key={p.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <IconTile tone={sats ? "gold" : "emerald"} className="size-9">
                  {sats ? <Bitcoin /> : <Gamepad2 />}
                </IconTile>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{REWARDS[p.reward]?.title ?? p.reward}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })} · −{formatCoins(Number(p.coins_cost))} coins
                  </p>
                </div>
                <Chip tone={tone} className="shrink-0">
                  {STATUS_LABEL[p.status] ?? p.status}
                </Chip>
              </div>
              <p className="mt-1.5 truncate pl-12 font-mono text-[0.68rem] text-muted-foreground">
                {sats ? p.destination : `Gamepass ${p.gamepass_id ?? ""}`}
              </p>
              {p.admin_note && p.status !== "pending" ? (
                <p className="mt-1 pl-12 text-xs text-muted-foreground">Note: {p.admin_note}</p>
              ) : null}
            </div>
          );
        })}
      </VaultCard>
    </section>
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
