import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, UserCog } from "lucide-react";

import { AdminSection } from "@/components/admin/AdminSection";
import { Button } from "@/components/ui/button";
import { VaultCard } from "@/components/vault/VaultCard";
import { errorText } from "@/hooks/use-earn";
import { supabase } from "@/integrations/supabase/client";

const key = ["admin", "roblox_changes"] as const;

export function RobloxChanges() {
  const queryClient = useQueryClient();
  const requests = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roblox_change_requests")
        .select("id, user_id, old_username, old_user_id, new_username, new_user_id, new_display_name, new_avatar_url, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => {
      const { error } = await supabase.rpc("admin_review_roblox_change", { p_id: id, p_decision: decision });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: ["admin", "audit_logs"] });
    },
  });

  const list = requests.data ?? [];

  return (
    <AdminSection id="roblox-changes" icon={<UserCog />} title="Roblox username changes" count={`${list.length} pending`} countTone={list.length ? "gold" : "muted"}>
      {requests.isLoading ? (
        <VaultCard className="h-24 skeleton-shimmer" />
      ) : requests.isError ? (
        <VaultCard className="p-4 text-sm text-destructive">Couldn't load change requests.</VaultCard>
      ) : list.length ? (
        list.map((r) => (
          <VaultCard key={r.id} accent="gold" className="p-4">
            <div className="flex items-center gap-3">
              {r.new_avatar_url ? (
                <img src={r.new_avatar_url} alt="" className="size-11 rounded-xl bg-vault-inner object-cover ring-1 ring-border" />
              ) : null}
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex flex-wrap items-center gap-1.5 font-mono">
                  <span className="text-muted-foreground line-through">{r.old_username ?? "none"}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                  <span className="font-semibold">{r.new_username}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  ID {r.new_user_id} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="slate" size="tactile-sm" disabled={review.isPending} onClick={() => review.mutate({ id: r.id, decision: "rejected" })}>
                Reject
              </Button>
              <Button variant="emerald" size="tactile-sm" disabled={review.isPending} onClick={() => review.mutate({ id: r.id, decision: "approved" })}>
                Approve
              </Button>
            </div>
          </VaultCard>
        ))
      ) : (
        <VaultCard className="p-6 text-center text-sm text-muted-foreground">No username changes waiting.</VaultCard>
      )}
      {review.isError ? <p className="px-1 text-xs text-destructive">{errorText(review.error)}</p> : null}
    </AdminSection>
  );
}
