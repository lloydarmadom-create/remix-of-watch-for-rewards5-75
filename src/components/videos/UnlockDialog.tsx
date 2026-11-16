import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Gem, Heart, Loader2, Pause, Star, type LucideIcon } from "lucide-react";

import { SponsorAd } from "@/components/ads/SponsorAd";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { errorText, refreshEarnings, useEarnStatus } from "@/hooks/use-earn";
import { refreshVideos, type FeedVideo } from "@/hooks/use-videos";
import { supabase } from "@/integrations/supabase/client";
import { UNLOCK_SECONDS, VIDEO_REWARDS } from "@/lib/creator-videos";
import { formatCoins } from "@/lib/earning";
import { claimVideoView } from "@/lib/videos.functions";

export type UnlockResult = { counted: boolean; viewerReward: number; creatorReward: number; reason: string | null };

type Phase = "starting" | "watching" | "check" | "claiming" | "error";
const SHAPES: { name: string; icon: LucideIcon }[] = [
  { name: "coin", icon: Coins },
  { name: "gem", icon: Gem },
  { name: "star", icon: Star },
  { name: "heart", icon: Heart },
];

function makeChallenge() {
  const order = [...SHAPES].sort(() => Math.random() - 0.5);
  const target = order[Math.floor(Math.random() * order.length)]!.name;
  return { order, target };
}

/** Ad countdown + human check that unlocks one creator video for rewards. */
export function UnlockDialog({
  video,
  onClose,
  onUnlocked,
}: {
  video: FeedVideo | null;
  onClose: () => void;
  onUnlocked: (video: FeedVideo, result: UnlockResult) => void;
}) {
  const queryClient = useQueryClient();
  const claim = useServerFn(claimVideoView);
  const status = useEarnStatus();
  const [phase, setPhase] = useState<Phase>("starting");
  const [unlockId, setUnlockId] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(UNLOCK_SECONDS * 1000);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ReturnType<typeof makeChallenge> | null>(null);
  const [wrong, setWrong] = useState(false);

  // Start a fresh unlock each time a video is chosen.
  useEffect(() => {
    if (!video) return;
    let cancelled = false;
    setPhase("starting");
    setError(null);
    setUnlockId(null);
    setWrong(false);
    void supabase.rpc("start_video_unlock", { p_video_id: video.id }).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err || !data) {
        setError(errorText(err));
        setPhase("error");
        return;
      }
      setUnlockId(data);
      setPhase("watching");
    });
    return () => {
      cancelled = true;
    };
  }, [video]);

  // Countdown that only runs while this tab is visible.
  useEffect(() => {
    if (phase !== "watching") return;
    let left = UNLOCK_SECONDS * 1000;
    let last = performance.now();
    setRemainingMs(left);
    setPaused(document.hidden);
    const onVisibility = () => {
      last = performance.now();
      setPaused(document.hidden);
    };
    const id = window.setInterval(() => {
      const t = performance.now();
      if (!document.hidden) left -= t - last;
      last = t;
      setRemainingMs(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(id);
        setChallenge(makeChallenge());
        setPhase("check");
      }
    }, 200);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase]);

  const answer = useCallback(
    async (name: string, e: MouseEvent) => {
      if (!video || !unlockId || !challenge) return;
      if (!e.isTrusted || name !== challenge.target) {
        setWrong(true);
        setChallenge(makeChallenge());
        return;
      }
      setPhase("claiming");
      try {
        const result = await claim({ data: { unlockId } });
        refreshEarnings(queryClient);
        refreshVideos(queryClient);
        onUnlocked(video, result);
      } catch (err) {
        setError(errorText(err));
        setPhase("error");
      }
    },
    [video, unlockId, challenge, claim, queryClient, onUnlocked],
  );

  const reward = video ? VIDEO_REWARDS[video.format].viewer : 0;
  const progress = 1 - remainingMs / (UNLOCK_SECONDS * 1000);

  return (
    <Dialog open={!!video} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="vault max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto border-vault-rim bg-vault p-4">
        <DialogTitle className="pr-6 text-base font-bold">Unlock video</DialogTitle>
        <DialogDescription className="-mt-1 line-clamp-2 text-xs text-muted-foreground">
          {video?.title} · earn +{formatCoins(reward)} Coin
        </DialogDescription>

        <SponsorAd network={status.data?.next_network ?? "aads"}>
          {phase === "watching" && paused ? (
            <div className="absolute inset-0 grid place-items-center bg-background/85 backdrop-blur-sm">
              <div className="text-center">
                <Pause className="mx-auto size-7 text-gold" />
                <p className="mt-2 text-sm font-semibold">Paused</p>
                <p className="text-xs text-muted-foreground">Stay on this tab to keep the timer running.</p>
              </div>
            </div>
          ) : null}
        </SponsorAd>

        {phase === "starting" ? (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Preparing ad…
          </p>
        ) : phase === "watching" ? (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-vault-inner">
              <div
                className="h-full rounded-full bg-cyan transition-[width] duration-200 ease-linear"
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-center font-mono text-sm tabular-nums text-muted-foreground">
              {Math.ceil(remainingMs / 1000)}s left
            </p>
          </div>
        ) : phase === "check" && challenge ? (
          <div className="text-center">
            <p className="text-sm font-semibold">
              Quick check: tap the <span className="text-gold">{challenge.target}</span>
            </p>
            {wrong ? <p className="text-xs text-destructive">Not quite, try again.</p> : null}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {challenge.order.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  type="button"
                  aria-label={name}
                  onClick={(e) => void answer(name, e)}
                  className="vault-well grid aspect-square cursor-pointer place-items-center text-cyan transition-transform active:scale-95"
                >
                  <Icon className="size-6" />
                </button>
              ))}
            </div>
          </div>
        ) : phase === "claiming" ? (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking and unlocking…
          </p>
        ) : (
          <div className="space-y-3">
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive ring-1 ring-destructive/25">
              {error}
            </p>
            <Button variant="slate" size="tactile-sm" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
