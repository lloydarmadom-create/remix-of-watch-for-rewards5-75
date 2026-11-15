import { createFileRoute } from "@tanstack/react-router";
import { Clapperboard, Flag, Gift, Lock, ShieldAlert, Users, Wallet } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";

// Hidden route: not linked from the navigation and kept out of search engines.
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — Watch For Rewards" },
      { name: "description", content: "Restricted staff area." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin console — Watch For Rewards" },
      { property: "og:description", content: "Restricted staff area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const MODULES = [
  { name: "Players", icon: Users },
  { name: "Payout queue", icon: Wallet },
  { name: "Videos", icon: Clapperboard },
  { name: "Store items", icon: Gift },
  { name: "Reports", icon: Flag },
];

function AdminPage() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Restricted" title="Admin console.">
        Staff access only. Controls unlock after staff sign-in is set up.
      </PageHeader>

      <VaultCard accent="gold" className="flex items-start gap-3 p-4">
        <IconTile tone="gold">
          <ShieldAlert />
        </IconTile>
        <p className="text-sm text-muted-foreground">
          All admin decisions on accounts, rewards and payouts are final and cannot be appealed.
        </p>
      </VaultCard>

      <div className="grid grid-cols-2 gap-3">
        {MODULES.map((m) => (
          <VaultCard key={m.name} className="p-4 opacity-80">
            <div className="flex items-center justify-between">
              <IconTile tone="muted">
                <m.icon />
              </IconTile>
              <Lock className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-3 font-display font-semibold">{m.name}</p>
            <Chip className="mt-1.5">Locked</Chip>
          </VaultCard>
        ))}
      </div>
    </div>
  );
}
