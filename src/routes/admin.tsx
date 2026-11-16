import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Inbox, ShieldAlert } from "lucide-react";

import { AdNetworksCard } from "@/components/admin/AdNetworksCard";
import { AppSettingsCard } from "@/components/admin/AppSettingsCard";
import { AuditLogCard } from "@/components/admin/AuditLogCard";
import { PayoutQueue } from "@/components/admin/PayoutQueue";
import { PlayersCard } from "@/components/admin/PlayersCard";
import { RobloxChanges } from "@/components/admin/RobloxChanges";
import { VaultStockCard } from "@/components/admin/VaultStockCard";
import { VideoReviewQueue } from "@/components/admin/VideoReviewQueue";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORT_CATEGORIES } from "@/lib/support";

// Hidden route. Access is decided only by the database's admin check; the browser never
// knows which account is the admin. Data itself is protected by row-level security.
export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/", replace: true });
    const { data: isAdmin, error } = await supabase.rpc("is_admin");
    if (error || isAdmin !== true) throw redirect({ to: "/", replace: true });
  },
  pendingComponent: () => null,
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

const categoryLabel = (v: string) => SUPPORT_CATEGORIES.find((c) => c.value === v)?.label ?? v;

type Status = "unread" | "read" | "resolved";

function AdminPage() {
  const queryClient = useQueryClient();
  const messages = useQuery({
    queryKey: ["admin", "contact_messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("id, sender_name, reply_email, category, message, status, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("contact_messages").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "contact_messages"] }),
  });

  const unread = messages.data?.filter((m) => m.status === "unread").length ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Restricted" title="Admin console." />

      <VaultCard accent="gold" className="flex items-start gap-3 p-4">
        <IconTile tone="gold">
          <ShieldAlert />
        </IconTile>
        <p className="text-sm text-muted-foreground">
          All admin decisions on accounts, rewards and payouts are final and cannot be appealed.
        </p>
      </VaultCard>

      <PayoutQueue />
      <VaultStockCard />
      <AppSettingsCard />
      <AdNetworksCard />
      <RobloxChanges />
      <VideoReviewQueue />

      <section aria-labelledby="inbox" className="space-y-2.5">
        <div className="flex items-center justify-between px-1 pt-2">
          <h2 id="inbox" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Inbox className="size-4" /> Support inbox
          </h2>
          <Chip tone={unread ? "emerald" : "muted"}>{unread} unread</Chip>
        </div>

        {messages.isLoading ? (
          <VaultCard className="h-28 skeleton-shimmer" />
        ) : messages.isError ? (
          <VaultCard className="p-4 text-sm text-destructive">Couldn't load messages.</VaultCard>
        ) : messages.data?.length ? (
          messages.data.map((m) => (
            <VaultCard key={m.id} accent={m.status === "unread" ? "emerald" : "none"} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold">{m.sender_name}</p>
                  <a href={`mailto:${m.reply_email}`} className="block truncate text-xs text-cyan underline-offset-4 hover:underline">
                    {m.reply_email}
                  </a>
                </div>
                <Chip tone={m.status === "unread" ? "emerald" : m.status === "resolved" ? "cyan" : "muted"}>
                  {m.status}
                </Chip>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.7rem] text-muted-foreground">
                <Chip tone="gold">{categoryLabel(m.category)}</Chip>
                <span>{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                {m.user_id ? <span>· signed-in player</span> : <span>· guest</span>}
              </div>
              <p className="vault-well mt-3 whitespace-pre-wrap break-words p-3 text-sm">{m.message}</p>
              <div className="mt-3 flex gap-2">
                {m.status !== "read" ? (
                  <Button variant="slate" size="tactile-sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: m.id, status: "read" })}>
                    Mark read
                  </Button>
                ) : null}
                {m.status !== "resolved" ? (
                  <Button variant="emerald" size="tactile-sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: m.id, status: "resolved" })}>
                    Resolve
                  </Button>
                ) : null}
              </div>
            </VaultCard>
          ))
        ) : (
          <VaultCard className="p-6 text-center text-sm text-muted-foreground">No messages yet.</VaultCard>
        )}
      </section>

      <PlayersCard />
      <AuditLogCard />
    </div>
  );
}
