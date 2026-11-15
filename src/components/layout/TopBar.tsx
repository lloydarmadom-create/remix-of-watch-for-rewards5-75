import { Link } from "@tanstack/react-router";

import { Wordmark } from "@/components/brand/Logo";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { formatCoins } from "@/lib/earning";

export function TopBar() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const balance = user ? (profile?.coin_balance ?? 0) : 0;

  return (
    <div className="sticky top-0 z-30 border-b border-vault-rim/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between px-4">
        <Link to="/" aria-label="Watch For Rewards home">
          <Wordmark />
        </Link>
        <Link
          to="/profile"
          className="vault-well flex items-center gap-1.5 px-2.5 py-1.5"
          aria-label={`Coin balance: ${formatCoins(balance)}`}
        >
          <span aria-hidden className="size-3.5 rounded-full bg-gold shadow-glow-gold" />
          <span className="font-mono text-sm font-semibold tabular-nums text-gold">{formatCoins(balance)}</span>
          <span className="font-display text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
            coins
          </span>
        </Link>
      </div>
    </div>
  );
}
