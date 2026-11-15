import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, ChevronRight, Flame, Play, Sparkles, Target } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Earn points — Watch For Rewards" },
      {
        name: "description",
        content: "Watch videos and complete tasks to stack points toward gaming and crypto rewards.",
      },
      { property: "og:title", content: "Earn points — Watch For Rewards" },
      {
        property: "og:description",
        content: "Watch videos and complete tasks to stack points toward gaming and crypto rewards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EarnPage,
});

const WAYS = [
  { title: "Watch videos", body: "Short clips, instant points.", tone: "cyan", icon: Play, to: "/videos", live: true },
  { title: "Daily check-in", body: "Keep your streak alive.", tone: "gold", icon: CalendarCheck, live: false },
  { title: "Missions", body: "Bigger tasks, bigger drops.", tone: "emerald", icon: Target, live: false },
] as const;

function EarnPage() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Earn" title="Stack points, your way.">
        Every video and mission adds to your vault.
      </PageHeader>

      <VaultCard accent="gold" className="animate-rise p-5">
        <div className="flex items-center justify-between">
          <p className="font-display text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Vault balance
          </p>
          <Chip tone="emerald">
            <Sparkles className="size-3" /> Live
          </Chip>
        </div>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-gold-gradient font-mono text-5xl font-semibold leading-none tabular-nums">
            0
          </span>
          <span className="pb-1 font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
            points
          </span>
        </div>
        <div className="vault-well mt-4 flex items-center gap-3 p-3">
          <Flame className="size-5 text-gold" />
          <div className="flex-1">
            <p className="text-sm font-semibold">0-day streak</p>
            <p className="text-xs text-muted-foreground">Sign in to start your first streak.</p>
          </div>
        </div>
        <Button asChild variant="emerald" size="tactile" className="mt-4 w-full">
          <Link to="/profile">Start earning</Link>
        </Button>
      </VaultCard>

      <section aria-labelledby="ways" className="space-y-2.5">
        <h2 id="ways" className="px-1 pt-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Ways to earn
        </h2>
        {WAYS.map((w, i) => {
          const inner = (
            <VaultCard className="flex items-center gap-3 p-3.5" accent="none">
              <IconTile tone={w.tone}>
                <w.icon />
              </IconTile>
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold">{w.title}</p>
                <p className="text-xs text-muted-foreground">{w.body}</p>
              </div>
              {w.live ? (
                <ChevronRight className="size-5 text-muted-foreground" />
              ) : (
                <Chip>Soon</Chip>
              )}
            </VaultCard>
          );
          return (
            <div key={w.title} className="animate-rise" style={{ animationDelay: `${80 + i * 60}ms` }}>
              {"to" in w ? (
                <Link to={w.to} className="block rounded-2xl transition-transform active:scale-[0.99]">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
