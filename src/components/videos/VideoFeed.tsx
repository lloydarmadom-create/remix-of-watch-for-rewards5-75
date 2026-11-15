import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCheck, Eye, Lock, Play, Store, UserRound, X } from "lucide-react";

import { UnlockDialog, type UnlockResult } from "@/components/videos/UnlockDialog";
import { VideoPlayer } from "@/components/videos/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Chip, VaultCard } from "@/components/vault/VaultCard";
import { useAuth, useProfile } from "@/hooks/use-auth";
import { useApprovedVideos, useWatchedVideos, type FeedVideo } from "@/hooks/use-videos";
import { FORMAT_LABEL, PLATFORM_LABEL, VIDEO_REWARDS, idFromKey, thumbnailFor } from "@/lib/creator-videos";
import { atCoinCap, formatCoins } from "@/lib/earning";

type Notice = { videoId: string; result: UnlockResult };

export function VideoFeed() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const videos = useApprovedVideos();
  const watched = useWatchedVideos();
  const [unlocking, setUnlocking] = useState<FeedVideo | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const onUnlocked = useCallback((video: FeedVideo, result: UnlockResult) => {
    setUnlocking(null);
    setPlaying(video.id);
    setNotice({ videoId: video.id, result });
  }, []);

  const capped = profile ? atCoinCap(profile.coin_balance) : false;

  if (videos.isLoading) {
    return (
      <div className="space-y-3">
        <VaultCard className="h-64 skeleton-shimmer" />
        <VaultCard className="h-64 skeleton-shimmer" />
      </div>
    );
  }
  if (videos.isError) {
    return <VaultCard className="p-4 text-sm text-destructive">Couldn't load videos. Please reload the page.</VaultCard>;
  }
  if (!videos.data?.length) {
    return (
      <VaultCard className="p-6 text-center">
        <Play className="mx-auto size-7 text-cyan" />
        <p className="mt-2 font-display font-semibold">No approved videos yet</p>
        <p className="mt-1 text-xs text-muted-foreground">New creator drops appear here once the admin approves them.</p>
      </VaultCard>
    );
  }

  return (
    <div className="space-y-3">
      {capped ? (
        <VaultCard accent="gold" className="flex items-center gap-3 p-3">
          <Store className="size-4 shrink-0 text-gold" />
          <p className="flex-1 text-xs text-muted-foreground">Your vault is full at 1,500 coins. Spend coins in the Store to earn from videos again.</p>
          <Button asChild variant="gold" size="tactile-sm">
            <Link to="/store">Store</Link>
          </Button>
        </VaultCard>
      ) : null}

      {videos.data.map((v) => {
        const id = idFromKey(v.video_key);
        const own = v.creator_id === user?.id;
        const isWatched = watched.data?.has(v.id) ?? false;
        const isPlaying = playing === v.id;
        const thumb = thumbnailFor(v.platform, id, v.thumbnail_url);
        const reward = VIDEO_REWARDS[v.format].viewer;
        const n = notice?.videoId === v.id ? notice.result : null;

        return (
          <VaultCard key={v.id} as="article" accent={isPlaying ? "cyan" : "none"} className="animate-rise p-3">
            {isPlaying ? (
              <div className="relative">
                <VideoPlayer platform={v.platform} id={id} format={v.format} title={v.title} />
                <button
                  type="button"
                  aria-label="Close player"
                  onClick={() => setPlaying(null)}
                  className="absolute right-2 top-2 grid size-8 cursor-pointer place-items-center rounded-full bg-background/80 text-foreground ring-1 ring-border"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="vault-well relative aspect-video overflow-hidden">
                {thumb ? (
                  <img src={thumb} alt="" loading="lazy" className="size-full object-cover opacity-80" />
                ) : (
                  <div className="grid size-full place-items-center">
                    <Play className="size-8 text-cyan" />
                  </div>
                )}
                <div className="absolute left-2 top-2 flex gap-1.5">
                  <Chip tone="cyan" className="bg-background/80">
                    {FORMAT_LABEL[v.format]}
                  </Chip>
                  {isWatched ? (
                    <Chip tone="emerald" className="bg-background/80">
                      <CheckCheck className="size-3" /> Watched
                    </Chip>
                  ) : null}
                </div>
              </div>
            )}

            {n ? (
              <p
                role="status"
                className={
                  n.counted
                    ? "mt-2.5 rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold ring-1 ring-gold/25"
                    : "mt-2.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground ring-1 ring-border"
                }
              >
                {n.counted
                  ? `+${formatCoins(n.viewerReward)} Coin added. The creator earned +${formatCoins(n.creatorReward)}.`
                  : "WATCHED: this video was already counted for your account or network in the last 24 hours. No coins this time, enjoy the video."}
              </p>
            ) : null}

            <div className="mt-2.5 flex items-start gap-3 px-0.5">
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 font-display text-sm font-semibold">{v.title}</h3>
                <p className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                  <UserRound className="size-3" /> @{v.creator_handle} · {PLATFORM_LABEL[v.platform]}
                  <span className="inline-flex items-center gap-1">
                    · <Eye className="size-3" /> {v.view_count}
                  </span>
                </p>
              </div>
              {!own && !isWatched ? <Chip tone="gold">+{formatCoins(reward)}</Chip> : null}
            </div>

            {isPlaying ? null : own ? (
              <p className="vault-well mt-2.5 px-3 py-2 text-center text-xs text-muted-foreground">
                Your video. Creators can't watch or earn from their own videos.
              </p>
            ) : isWatched ? (
              <Button variant="slate" size="tactile-sm" className="mt-2.5 w-full" onClick={() => setPlaying(v.id)}>
                <Play /> Play again (no reward)
              </Button>
            ) : (
              <Button
                variant="cyan"
                size="tactile-sm"
                className="mt-2.5 w-full"
                disabled={capped || profile?.is_banned}
                onClick={() => {
                  setNotice(null);
                  setUnlocking(v);
                }}
              >
                <Lock /> Watch ad to unlock · +{formatCoins(reward)}
              </Button>
            )}
          </VaultCard>
        );
      })}

      <UnlockDialog video={unlocking} onClose={() => setUnlocking(null)} onUnlocked={onUnlocked} />
    </div>
  );
}
