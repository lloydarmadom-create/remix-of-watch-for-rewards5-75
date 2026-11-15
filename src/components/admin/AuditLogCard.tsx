import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ScrollText } from "lucide-react";

import { AdminSection, shortId } from "@/components/admin/AdminSection";
import { Button } from "@/components/ui/button";
import { VaultCard } from "@/components/vault/VaultCard";
import { supabase } from "@/integrations/supabase/client";

const LABELS: Record<string, string> = {
  stock_adjusted: "Stock adjusted",
  user_banned: "Player banned",
  user_unbanned: "Player unbanned",
  payout_paid: "Payout marked paid",
  payout_rejected: "Payout rejected & refunded",
  payout_requested: "Payout requested",
  repeat_view_claim: "Repeat video reward blocked",
};

const label = (event: string) => LABELS[event] ?? event.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function detailText(detail: unknown) {
  if (!detail || typeof detail !== "object") return "";
  return Object.entries(detail as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== "" && typeof v !== "object")
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");
}

export function AuditLogCard() {
  const [limit, setLimit] = useState(50);
  const logs = useQuery({
    queryKey: ["admin", "audit_logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, user_id, event, video_id, ip_address, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });

  return (
    <AdminSection id="audit" icon={<ScrollText />} title="Audit logs">
      {logs.isLoading ? (
        <VaultCard className="h-32 skeleton-shimmer" />
      ) : logs.isError ? (
        <VaultCard className="p-4 text-sm text-destructive">Couldn't load audit logs.</VaultCard>
      ) : logs.data?.length ? (
        <VaultCard className="divide-y divide-border p-0">
          {logs.data.map((l) => {
            const extra = detailText(l.detail);
            return (
              <div key={l.id} className="px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold">{label(l.event)}</p>
                  <time className="shrink-0 font-mono text-[0.68rem] text-muted-foreground" dateTime={l.created_at}>
                    {format(new Date(l.created_at), "MMM d, HH:mm")}
                  </time>
                </div>
                <p className="break-all font-mono text-[0.68rem] text-muted-foreground">
                  {l.user_id ? `player ${shortId(l.user_id)}` : "system"}
                  {l.video_id ? ` · video ${shortId(l.video_id)}` : ""}
                  {l.ip_address ? ` · ip ${l.ip_address}` : ""}
                  {extra ? ` · ${extra}` : ""}
                </p>
              </div>
            );
          })}
          {logs.data.length >= limit ? (
            <div className="p-2">
              <Button variant="slate" size="sm" className="w-full" onClick={() => setLimit((n) => n + 50)}>
                Load more
              </Button>
            </div>
          ) : null}
        </VaultCard>
      ) : (
        <VaultCard className="p-6 text-center text-sm text-muted-foreground">Nothing logged yet.</VaultCard>
      )}
    </AdminSection>
  );
}
