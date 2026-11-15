import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Cookie, LifeBuoy, Mail, ShieldCheck, UserRound } from "lucide-react";

import { openCookieSettings } from "@/components/consent/CookieConsent";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Watch For Rewards" },
      { name: "description", content: "Manage your Watch For Rewards account, privacy and cookie settings." },
      { property: "og:title", content: "Profile — Watch For Rewards" },
      { property: "og:description", content: "Manage your Watch For Rewards account, privacy and cookie settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const rowClass =
  "flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-muted/60";

function ProfilePage() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Profile" title="Your player card." />

      <VaultCard accent="emerald" className="animate-rise p-5">
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl bg-emerald/10 ring-2 ring-emerald/40 shadow-glow-emerald">
            <UserRound className="size-7 text-emerald" />
          </div>
          <div>
            <p className="font-display text-lg font-bold">Guest player</p>
            <p className="text-xs text-muted-foreground">Sign in to save your points.</p>
            <Chip tone="gold" className="mt-1.5">Level 0</Chip>
          </div>
        </div>
        <Button variant="emerald" size="tactile" className="mt-5 w-full" disabled>
          <Mail /> Continue with email
        </Button>
        <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">
          Sign-in is coming soon. Players must be 13 or older.
        </p>
      </VaultCard>

      <VaultCard className="animate-rise p-2">
        <Link to="/privacy" className={rowClass}>
          <IconTile tone="cyan" className="size-9">
            <ShieldCheck />
          </IconTile>
          <span className="flex-1 text-sm font-semibold">Privacy policy</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        <button type="button" onClick={openCookieSettings} className={rowClass}>
          <IconTile tone="gold" className="size-9">
            <Cookie />
          </IconTile>
          <span className="flex-1 text-sm font-semibold">Cookie settings</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
        <div className={rowClass} aria-disabled>
          <IconTile tone="muted" className="size-9">
            <LifeBuoy />
          </IconTile>
          <span className="flex-1 text-sm font-semibold">Support</span>
          <Chip>Soon</Chip>
        </div>
      </VaultCard>
    </div>
  );
}
