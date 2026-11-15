import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bitcoin, Check, ExternalLink, Gamepad2, Loader2, Undo2, Wallet } from "lucide-react";

import { AdminSection } from "@/components/admin/AdminSection";
import { fieldClass } from "@/components/auth/AuthPanel";
import { Button } from "@/components/ui/button";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";
import { errorText } from "@/hooks/use-earn";
import { refreshPayouts } from "@/hooks/use-payouts";
import { supabase } from "@/integrations/supabase/client";
import { formatCoins } from "@/lib/earning";
import { gamepassUrl, REWARDS, STATUS_LABEL, type PayoutStatus, type RewardId } from "@/lib/payouts";
import { cn } from "@/lib/utils";

const key = ["admin", "payouts"] as const;

export function PayoutQueue() {
  const [view, setView] = useState<"pending" | "resolved">("pending");
  const payouts = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_requests")
        .select("id, user_id, reward, category, coins_cost, stock_cost, payout_amount, destination, roblox_username, roblox_user_id, gamepass_id, gamepass_name, gamepass_price, status, admin_note, created_at, resolved_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const ids = [...new Set(data.map((p) => p.user_id))];
      const emails = new Map<string, string>();
      if (ids.length) {
        const { data: people } = await supabase.from("profiles").select("id, email").in("id", ids);
        people?.forEach((p) => emails.set(p.id, p.email));
      }
      return data.map((p) => ({ ...p, email: emails.get(p.user_id) ?? "Unknown player" }));
    },
  });

  const pending = payouts.data?.filter((p) => p.status === "pending") ?? [];
  // Oldest request first, so payouts go out in order.
  const list = view === "pending" ? [...pending].reverse() : (payouts.data ?? []).filter((p) => p.status !== "pending");

  return (
    <AdminSection id="payouts" icon={<Wallet />} title="Payout queue" count={`${pending.length} pending`} countTone={pending.length ? "gold" : "muted"}>
      <div className="vault-well grid grid-cols-2 gap-1 p-1" role="tablist" aria-label="Payout queue view">
        {(["pending", "resolved"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className="cursor-pointer rounded-lg py-2 font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground aria-selected:bg-vault-raised aria-selected:text-foreground"
          >
            {v === "pending" ? "Pending" : "Resolved"}
          </button>
        ))}
      </div>
      {payouts.isLoading ? (
        <VaultCard className="h-32 skeleton-shimmer" />
      ) : payouts.isError ? (
        <VaultCard className="p-4 text-sm text-destructive">Couldn't load payouts.</VaultCard>
      ) : list.length ? (
        list.map((p) => <PayoutRow key={p.id} p={p} />)
      ) : (
        <VaultCard className="p-6 text-center text-sm text-muted-foreground">
          {view === "pending" ? "No payouts waiting. Nice." : "No resolved payouts yet."}
        </VaultCard>
      )}
    </AdminSection>
  );
}

type Row = {
  id: string;
  email: string;
  reward: string;
  category: string;
  coins_cost: number;
  stock_cost: number;
  payout_amount: number;
  destination: string;
  roblox_username: string | null;
  roblox_user_id: number | null;
  gamepass_id: number | null;
  gamepass_name: string | null;
  gamepass_price: number | null;
  status: string;
  admin_note: string;
  created_at: string;
  resolved_at: string | null;
};

function PayoutRow({ p }: { p: Row }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const reward = REWARDS[p.reward as RewardId];
  const robux = p.category === "robux";
  const status = p.status as PayoutStatus;

  const resolve = useMutation({
    mutationFn: async (decision: "paid" | "rejected") => {
      const { error } = await supabase.rpc("admin_resolve_payout", { p_id: p.id, p_decision: decision, p_note: note.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: ["admin", "audit_logs"] });
      refreshPayouts(queryClient);
    },
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.destination);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <VaultCard accent={status === "pending" ? "gold" : "none"} className="p-4">
      <div className="flex items-start gap-3">
        <IconTile tone={robux ? "emerald" : "gold"}>{robux ? <Gamepad2 /> : <Bitcoin />}</IconTile>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold">{reward?.title ?? p.reward}</p>
          <p className="truncate text-xs text-muted-foreground">{p.email}</p>
        </div>
        <Chip tone={status === "pending" ? "gold" : status === "paid" ? "emerald" : "muted"}>{STATUS_LABEL[status] ?? p.status}</Chip>
      </div>

      <div className="vault-well mt-3 space-y-1.5 p-3 text-xs">
        <Line label="Requested" value={formatDistanceToNow(new Date(p.created_at), { addSuffix: true })} />
        <Line label="Coins spent" value={formatCoins(Number(p.coins_cost))} />
        <Line label={robux ? "Robux from stock" : "Sats from stock"} value={String(p.stock_cost)} />
        {robux ? (
          <>
            <Line label="Roblox user" value={`${p.roblox_username ?? "?"} · ${p.roblox_user_id ?? "?"}`} />
            <Line label="Gamepass" value={`${p.gamepass_name ?? ""} · ${p.gamepass_price ?? "?"} Robux`} />
          </>
        ) : null}
        <div className="flex items-start justify-between gap-3 pt-1">
          <span className="shrink-0 text-muted-foreground">{robux ? "Buy this pass" : "Send to"}</span>
          {robux && p.gamepass_id ? (
            <a
              href={gamepassUrl(p.gamepass_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-cyan underline-offset-4 hover:underline"
            >
              {p.gamepass_id} <ExternalLink className="size-3" />
            </a>
          ) : (
            <button type="button" onClick={copy} className="min-w-0 cursor-pointer break-all text-right font-mono text-cyan">
              {copied ? "Copied" : p.destination}
            </button>
          )}
        </div>
        {p.admin_note ? <Line label="Note" value={p.admin_note} /> : null}
      </div>

      {status === "pending" ? (
        <>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 280))}
            placeholder="Note for the record (optional)"
            aria-label="Admin note"
            className={cn(fieldClass, "mt-3 h-10")}
          />
          {resolve.isError ? <p className="mt-2 text-xs text-destructive">{errorText(resolve.error)}</p> : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="slate" size="tactile-sm" disabled={resolve.isPending} onClick={() => resolve.mutate("rejected")}>
              {resolve.isPending && resolve.variables === "rejected" ? <Loader2 className="animate-spin" /> : <Undo2 />}
              Reject & Auto-Refund
            </Button>
            <Button variant="emerald" size="tactile-sm" disabled={resolve.isPending} onClick={() => resolve.mutate("paid")}>
              {resolve.isPending && resolve.variables === "paid" ? <Loader2 className="animate-spin" /> : <Check />}
              Mark Paid
            </Button>
          </div>
        </>
      ) : null}
    </VaultCard>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all text-right">{value}</span>
    </div>
  );
}
