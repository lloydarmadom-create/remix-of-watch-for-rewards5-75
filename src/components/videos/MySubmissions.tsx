import { formatDistanceToNow } from "date-fns";
import { Eye } from "lucide-react";

import { BotFlagList, ScanChips } from "@/components/videos/BotFlags";
import { Chip, VaultCard } from "@/components/vault/VaultCard";
import { useMySubmissions } from "@/hooks/use-videos";
import { FORMAT_LABEL } from "@/lib/creator-videos";

const STATUS_TONE = { pending: "gold", approved: "emerald", rejected: "muted" } as const;

export function MySubmissions() {
  const { data, isLoading } = useMySubmissions();
  if (isLoading || !data?.length) return null;

  return (
    <section aria-labelledby="my-subs" className="space-y-2.5">
      <h2 id="my-subs" className="px-1 pt-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Your submissions
      </h2>
      {data.map((v) => (
        <VaultCard key={v.id} accent={v.status === "approved" ? "emerald" : "none"} className="p-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 font-display text-sm font-semibold">{v.title}</p>
            <Chip tone={STATUS_TONE[v.status]}>{v.status}</Chip>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.7rem] text-muted-foreground">
            <Chip tone="cyan">{FORMAT_LABEL[v.format]}</Chip>
            <ScanChips scan={v.scan_status} risk={v.risk_level} />
            <span>{formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}</span>
            {v.status === "approved" ? (
              <span className="inline-flex items-center gap-1">
                · <Eye className="size-3" /> {v.view_count} views
              </span>
            ) : null}
          </div>
          <BotFlagList flags={v.bot_flags} className="mt-2.5" />
          {v.review_note ? (
            <p className="vault-well mt-2.5 p-2.5 text-xs text-muted-foreground">Admin note: {v.review_note}</p>
          ) : null}
        </VaultCard>
      ))}
    </section>
  );
}
