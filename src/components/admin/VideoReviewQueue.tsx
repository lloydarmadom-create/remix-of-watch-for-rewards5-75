import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Check, Clapperboard, ExternalLink, Play, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, VaultCard } from "@/components/vault/VaultCard";
import { BotFlagList, ScanChips } from "@/components/videos/BotFlags";
import { VideoPlayer } from "@/components/videos/VideoPlayer";
import { errorText } from "@/hooks/use-earn";
import { FULL_COLUMNS, refreshVideos, type CreatorVideo } from "@/hooks/use-videos";
import { supabase } from "@/integrations/supabase/client";
import { FORMAT_LABEL, PLATFORM_LABEL, idFromKey } from "@/lib/creator-videos";

type Tab = "pending" | "approved" | "rejected";
const TABS: Tab[] = ["pending", "approved", "rejected"];

/** Admin review of creator submissions: bot scan flags, preview, approve / reject. */
export function VideoReviewQueue() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");

  const videos = useQuery({
    queryKey: ["creator_videos", "admin", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_videos")
        .select(FULL_COLUMNS)
        .eq("status", tab)
        .order("created_at", { ascending: tab === "pending" })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as CreatorVideo[];
    },
  });

  const review = useMutation({
    mutationFn: async (v: { id: string; decision: Tab; note: string }) => {
      const { error } = await supabase.rpc("admin_review_video", {
        p_video_id: v.id,
        p_decision: v.decision,
        p_note: v.note,
      });
      if (error) throw error;
      return v.decision;
    },
    onSuccess: () => refreshVideos(queryClient),
  });

  return (
    <section aria-labelledby="review-queue" className="space-y-2.5">
      <div className="flex items-center justify-between px-1 pt-2">
        <h2 id="review-queue" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Clapperboard className="size-4" /> Creator video review
        </h2>
        {tab === "pending" && videos.data ? (
          <Chip tone={videos.data.length ? "gold" : "muted"}>{videos.data.length} waiting</Chip>
        ) : null}
      </div>

      <div className="vault-well grid grid-cols-3 gap-1 p-1" role="tablist" aria-label="Review status">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "rounded-lg bg-card py-2 font-display text-xs font-semibold capitalize text-foreground shadow-sm ring-1 ring-border"
                : "rounded-lg py-2 font-display text-xs font-semibold capitalize text-muted-foreground"
            }
          >
            {t}
          </button>
        ))}
      </div>

      {review.isError ? (
        <p role="alert" className="px-1 text-xs text-destructive">{errorText(review.error)}</p>
      ) : null}

      {videos.isLoading ? (
        <VaultCard className="h-40 skeleton-shimmer" />
      ) : videos.isError ? (
        <VaultCard className="p-4 text-sm text-destructive">Couldn't load videos.</VaultCard>
      ) : videos.data?.length ? (
        videos.data.map((v) => (
          <ReviewCard key={v.id} video={v} busy={review.isPending} onDecide={(decision, note) => review.mutate({ id: v.id, decision, note })} />
        ))
      ) : (
        <VaultCard className="p-6 text-center text-sm text-muted-foreground">
          {tab === "pending" ? "Queue is clear. No videos waiting." : `No ${tab} videos.`}
        </VaultCard>
      )}
    </section>
  );
}

function ReviewCard({
  video: v,
  busy,
  onDecide,
}: {
  video: CreatorVideo;
  busy: boolean;
  onDecide: (decision: Tab, note: string) => void;
}) {
  const [note, setNote] = useState(v.review_note ?? "");
  const [preview, setPreview] = useState(false);
  const accent = v.risk_level === "high" ? "gold" : v.status === "approved" ? "emerald" : "none";

  return (
    <VaultCard accent={accent} className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 font-display font-semibold">{v.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            @{v.creator_handle} · {PLATFORM_LABEL[v.platform]} ·{" "}
            {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
          </p>
        </div>
        <Chip tone="cyan">{FORMAT_LABEL[v.format]}</Chip>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[0.7rem]">
        <ScanChips scan={v.scan_status} risk={v.risk_level} />
        {v.status === "approved" ? <Chip tone="emerald">{v.view_count} views</Chip> : null}
      </div>

      {v.source_title || v.source_author ? (
        <div className="vault-well mt-3 space-y-0.5 p-2.5 text-xs">
          <p className="font-display text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">Public listing</p>
          {v.source_title ? <p className="line-clamp-2">{v.source_title}</p> : null}
          {v.source_author ? <p className="text-muted-foreground">by {v.source_author}</p> : null}
        </div>
      ) : null}

      <BotFlagList flags={v.bot_flags} className="mt-3" />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="slate" size="tactile-sm" onClick={() => setPreview((p) => !p)}>
          <Play /> {preview ? "Hide preview" : "Preview"}
        </Button>
        <Button asChild variant="slate" size="tactile-sm">
          <a href={v.video_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Open
          </a>
        </Button>
      </div>
      {preview ? (
        <VideoPlayer platform={v.platform} id={idFromKey(v.video_key)} format={v.format} title={v.title} className="mt-3" />
      ) : null}

      <Input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 280))}
        placeholder="Note to creator (optional)"
        aria-label="Note to creator"
        className="mt-3"
      />
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {v.status !== "approved" ? (
          <Button variant="emerald" size="tactile-sm" disabled={busy} onClick={() => onDecide("approved", note)}>
            <Check /> Approve
          </Button>
        ) : (
          <Button variant="slate" size="tactile-sm" disabled={busy} onClick={() => onDecide("pending", note)}>
            Back to pending
          </Button>
        )}
        {v.status !== "rejected" ? (
          <Button variant="slate" size="tactile-sm" disabled={busy} onClick={() => onDecide("rejected", note)} className="text-destructive">
            <X /> Reject
          </Button>
        ) : (
          <Button variant="slate" size="tactile-sm" disabled={busy} onClick={() => onDecide("pending", note)}>
            Back to pending
          </Button>
        )}
      </div>
    </VaultCard>
  );
}
