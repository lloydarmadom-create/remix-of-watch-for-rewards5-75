import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Clock, Flame, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";
import { useProfile } from "@/hooks/use-auth";
import { errorText, refreshEarnings, useNow } from "@/hooks/use-earn";
import { supabase } from "@/integrations/supabase/client";
import { STREAK_RESET_HOURS, formatCountdown, streakReward, streakState } from "@/lib/earning";
import { cn } from "@/lib/utils";

export function StreakCard() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  if (!profile || !now) return <VaultCard className="h-48 skeleton-shimmer" />;

  const s = streakState(profile.streak_count, profile.last_check_in_at, now);
  const cycleStart = Math.floor((s.nextDay - 1) / 7) * 7;
  const resetAt = profile.last_check_in_at
    ? new Date(profile.last_check_in_at).getTime() + STREAK_RESET_HOURS * 3_600_000
    : null;

  const checkIn = async () => {
    setBusy(true);
    setError(null);
    const reward = s.reward;
    const { data, error: err } = await supabase.rpc("claim_streak");
    setBusy(false);
    refreshEarnings(queryClient);
    if (err) {
      setError(errorText(err));
      return;
    }
    setFlash(`+${reward} ${reward === 1 ? "Coin" : "Coins"} · Day ${data}`);
    window.setTimeout(() => setFlash(null), 3000);
  };

  return (
    <VaultCard accent="gold" className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <IconTile tone="gold">
          <Flame />
        </IconTile>
        <div className="flex-1">
          <p className="font-display font-semibold">Daily check-in</p>
          <p className="text-xs text-muted-foreground">
            {s.current > 0 ? `${s.current}-day streak` : "No active streak"} · days 3 and 7 pay +5
          </p>
        </div>
        {flash ? <Chip tone="gold">{flash}</Chip> : null}
      </div>

      <ol className="mt-4 grid grid-cols-7 gap-1.5" aria-label="This week's check-ins">
        {Array.from({ length: 7 }, (_, i) => {
          const day = cycleStart + i + 1;
          const done = day <= s.current;
          const bonus = streakReward(i + 1) > 1;
          return (
            <li
              key={day}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg py-2 ring-1",
                done ? "bg-gold/15 ring-gold/40" : "bg-vault-inner ring-vault-rim",
                day === s.nextDay && s.canCheckIn && "ring-2 ring-gold",
              )}
            >
              <span className="font-display text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">D{day}</span>
              <span className={cn("font-mono text-xs font-semibold", bonus ? "text-gold" : "text-foreground")}>
                +{streakReward(i + 1)}
              </span>
            </li>
          );
        })}
      </ol>

      {s.canCheckIn ? (
        <Button variant="gold" size="tactile" className="mt-4 w-full" onClick={checkIn} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <CalendarCheck />} Check in · +{s.reward}{" "}
          {s.reward === 1 ? "Coin" : "Coins"}
        </Button>
      ) : (
        <Button variant="slate" size="tactile" className="mt-4 w-full" disabled>
          <Clock /> Next check-in in {formatCountdown(s.readyAt - now)}
        </Button>
      )}
      {s.canCheckIn && s.current > 0 && resetAt ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Check in within {formatCountdown(resetAt - now)} to keep your streak.
        </p>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-center text-xs text-destructive">{error}</p> : null}
    </VaultCard>
  );
}
