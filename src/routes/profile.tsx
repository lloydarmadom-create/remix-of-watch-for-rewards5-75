import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Ban,
  ChevronRight,
  Cookie,
  LifeBuoy,
  LogOut,
  ShieldCheck,
  ShieldHalf,
  UserRound,
} from "lucide-react";

import { AuthPanel } from "@/components/auth/AuthPanel";
import { InviteCard } from "@/components/earn/InviteCard";
import { openCookieSettings } from "@/components/consent/CookieConsent";
import { PageHeader } from "@/components/layout/PageHeader";
import { openContactSupport } from "@/components/support/ContactSupport";
import { CreatorHandleCard } from "@/components/videos/CreatorHandleCard";
import { Button } from "@/components/ui/button";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useNow } from "@/hooks/use-earn";
import { formatCoins, streakState } from "@/lib/earning";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Watch For Rewards" },
      { name: "description", content: "Sign in, share your invite link, and manage privacy and support." },
      { property: "og:title", content: "Profile — Watch For Rewards" },
      { property: "og:description", content: "Sign in, share your invite link, and manage privacy and support." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const rowClass =
  "flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-muted/60";

function ProfilePage() {
  const { user, ready } = useAuth();

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Profile" title={user ? "Your player card." : "Join the vault."}>
        {user ? undefined : "Create a free account with just your email."}
      </PageHeader>

      {user ? <AdminConsoleButton /> : null}

      {!ready ? (
        <VaultCard className="h-64 skeleton-shimmer" />
      ) : user ? (
        <PlayerCard />
      ) : (
        <AuthPanel />
      )}

      <VaultCard className="animate-rise p-2">
        <button type="button" onClick={openContactSupport} className={rowClass}>
          <IconTile tone="cyan" className="size-9">
            <LifeBuoy />
          </IconTile>
          <span className="flex-1 text-sm font-semibold">Contact support</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
        <Link to="/privacy" className={rowClass}>
          <IconTile tone="emerald" className="size-9">
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
      </VaultCard>
    </div>
  );
}

function PlayerCard() {
  const { user } = useAuth();
  const { data: profile, isLoading, isError } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const now = useNow();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/profile", replace: true });
  };

  return (
    <>
      <VaultCard accent="emerald" className="animate-rise p-5">
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-emerald/10 ring-2 ring-emerald/40 shadow-glow-emerald">
            <UserRound className="size-7 text-emerald" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold">{user?.email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Chip tone="gold">Level {profile?.level ?? 0}</Chip>
              {profile?.referred_by ? <Chip tone="cyan">Invited</Chip> : null}
            </div>
          </div>
        </div>

        {profile?.is_banned ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 ring-1 ring-destructive/25">
            <Ban className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">
              This account is suspended. Admin decisions are final.
            </p>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Stat label="Coins" value={isLoading ? "…" : formatCoins(profile?.coin_balance)} gold />
          <Stat
            label="Streak"
            value={
              isLoading || !profile || !now
                ? "…"
                : `${streakState(profile.streak_count, profile.last_check_in_at, now).current}d`
            }
          />
        </div>
        {isError ? (
          <p className="mt-3 text-xs text-destructive">We couldn't load your profile. Please reload the page.</p>
        ) : null}

        <Button variant="slate" size="tactile-sm" className="mt-4 w-full" onClick={signOut}>
          <LogOut /> Log out
        </Button>
      </VaultCard>

      <CreatorHandleCard />
      <InviteCard />
    </>
  );
}

/** Only shown when the database confirms this account is the admin. */
function AdminConsoleButton() {
  const { data: isAdmin } = useIsAdmin();
  if (!isAdmin) return null;
  return (
    <Button asChild variant="gold" size="tactile" className="animate-rise w-full">
      <Link to="/admin">
        <ShieldHalf /> Admin Console
      </Link>
    </Button>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="vault-well p-3">
      <p className="font-display text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className={gold ? "text-gold-gradient mt-1 font-mono text-2xl font-semibold" : "mt-1 font-mono text-2xl font-semibold"}>
        {value}
      </p>
    </div>
  );
}
