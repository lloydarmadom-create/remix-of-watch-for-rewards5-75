import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";

import { AdminSection } from "@/components/admin/AdminSection";
import { fieldClass } from "@/components/auth/AuthPanel";
import { Button } from "@/components/ui/button";
import { Chip, VaultCard } from "@/components/vault/VaultCard";
import { errorText } from "@/hooks/use-earn";
import { supabase } from "@/integrations/supabase/client";
import { formatCoins } from "@/lib/earning";
import { cn } from "@/lib/utils";

const key = ["admin", "players"] as const;
const PAGE = 40;

export function PlayersCard() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [onlyBanned, setOnlyBanned] = useState(false);

  const players = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_profiles");
      if (error) throw error;
      return data ?? [];
    },
  });

  const setBanned = useMutation({
    mutationFn: async ({ id, banned }: { id: string; banned: boolean }) => {
      const { error } = await supabase.rpc("admin_set_banned", { p_user_id: id, p_banned: banned });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: ["admin", "audit_logs"] });
    },
  });

  const term = q.trim().toLowerCase();
  const all = players.data ?? [];
  const bannedCount = all.filter((p) => p.is_banned).length;
  const filtered = all.filter(
    (p) =>
      (!onlyBanned || p.is_banned) &&
      (!term ||
        p.email.toLowerCase().includes(term) ||
        p.referral_code.toLowerCase().includes(term) ||
        (p.roblox_username ?? "").toLowerCase().includes(term)),
  );

  return (
    <AdminSection id="players" icon={<Users />} title="Players" count={`${all.length} · ${bannedCount} banned`}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Email, invite code or Roblox name"
            aria-label="Search players"
            className={cn(fieldClass, "h-10 pl-9")}
          />
        </div>
        <Button variant={onlyBanned ? "gold" : "slate"} size="tactile-sm" onClick={() => setOnlyBanned((v) => !v)}>
          Banned
        </Button>
      </div>
      {setBanned.isError ? <p className="px-1 text-xs text-destructive">{errorText(setBanned.error)}</p> : null}
      {players.isLoading ? (
        <VaultCard className="h-32 skeleton-shimmer" />
      ) : players.isError ? (
        <VaultCard className="p-4 text-sm text-destructive">Couldn't load players.</VaultCard>
      ) : filtered.length ? (
        <VaultCard className="divide-y divide-border p-0">
          {filtered.slice(0, PAGE).map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.email}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatCoins(Number(p.coin_balance))} coins · Lv {p.level} · {p.ads_completed} ads
                  {p.roblox_username ? ` · ${p.roblox_username}` : ""}
                </p>
              </div>
              {p.is_banned ? <Chip className="shrink-0">Banned</Chip> : null}
              <Button
                variant={p.is_banned ? "emerald" : "slate"}
                size="sm"
                className="shrink-0"
                disabled={setBanned.isPending}
                onClick={() => setBanned.mutate({ id: p.id, banned: !p.is_banned })}
              >
                {p.is_banned ? "Unban" : "Ban"}
              </Button>
            </div>
          ))}
          {filtered.length > PAGE ? (
            <p className="px-4 py-2.5 text-center text-xs text-muted-foreground">
              Showing {PAGE} of {filtered.length}. Search to narrow it down.
            </p>
          ) : null}
        </VaultCard>
      ) : (
        <VaultCard className="p-6 text-center text-sm text-muted-foreground">No players match.</VaultCard>
      )}
    </AdminSection>
  );
}
