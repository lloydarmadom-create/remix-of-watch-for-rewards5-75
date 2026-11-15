import { createFileRoute, Link } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { MySubmissions } from "@/components/videos/MySubmissions";
import { SubmitVideoCard } from "@/components/videos/SubmitVideoCard";
import { VideoFeed } from "@/components/videos/VideoFeed";
import { Button } from "@/components/ui/button";
import { IconTile, VaultCard } from "@/components/vault/VaultCard";
import { useAuth } from "@/hooks/use-auth";
import { VIDEO_REWARDS } from "@/lib/creator-videos";
import { formatCoins } from "@/lib/earning";

const DESCRIPTION =
  "Watch creator Shorts and videos from YouTube and TikTok to earn coins, or submit your own and earn every time someone watches.";

export const Route = createFileRoute("/videos")({
  head: () => ({
    meta: [
      { title: "Creator Videos & Shorts — Watch For Rewards" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Creator Videos & Shorts — Watch For Rewards" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VideosPage,
});

function VideosPage() {
  const { user, ready } = useAuth();

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Creator hub" title="Videos & Shorts.">
        Watch to earn +{formatCoins(VIDEO_REWARDS.short.viewer)} per Short and +{formatCoins(VIDEO_REWARDS.full.viewer)} per
        full video. Creators earn +{formatCoins(VIDEO_REWARDS.short.creator)} / +{formatCoins(VIDEO_REWARDS.full.creator)} per view.
      </PageHeader>

      {!ready ? (
        <VaultCard className="h-48 skeleton-shimmer" />
      ) : !user ? (
        <VaultCard accent="cyan" className="animate-rise p-5">
          <div className="flex items-center gap-3">
            <IconTile tone="cyan">
              <Clapperboard />
            </IconTile>
            <p className="text-sm text-muted-foreground">
              Sign in to watch creator videos for coins, or submit your own YouTube and TikTok videos.
            </p>
          </div>
          <Button asChild variant="cyan" size="tactile" className="mt-4 w-full">
            <Link to="/profile">Sign in to start</Link>
          </Button>
        </VaultCard>
      ) : (
        <>
          <SubmitVideoCard />
          <MySubmissions />
          <section aria-labelledby="feed" className="space-y-3">
            <h2 id="feed" className="px-1 pt-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Approved videos
            </h2>
            <VideoFeed />
          </section>
        </>
      )}
    </div>
  );
}
