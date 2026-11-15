import { createFileRoute } from "@tanstack/react-router";
import { Lock, Play } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Chip, VaultCard } from "@/components/vault/VaultCard";

export const Route = createFileRoute("/videos")({
  head: () => ({
    meta: [
      { title: "Videos — Watch For Rewards" },
      { name: "description", content: "Watch short videos and earn points for every one you finish." },
      { property: "og:title", content: "Videos — Watch For Rewards" },
      { property: "og:description", content: "Watch short videos and earn points for every one you finish." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VideosPage,
});

function VideosPage() {
  return (
    <div>
      <PageHeader eyebrow="Videos" title="Watch. Finish. Get paid in points.">
        New drops land here as soon as your account is ready.
      </PageHeader>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <VaultCard
            key={i}
            accent={i === 0 ? "cyan" : "none"}
            className="animate-rise p-2.5"
          >
            <div className="vault-well relative grid aspect-video place-items-center overflow-hidden">
              <span className="grid size-10 place-items-center rounded-full bg-cyan/12 text-cyan ring-1 ring-cyan/30">
                {i === 0 ? <Play className="size-4 translate-x-px" /> : <Lock className="size-4" />}
              </span>
            </div>
            <div className="mt-2.5 space-y-1.5 px-0.5">
              <div className="skeleton-shimmer h-2.5 w-4/5 rounded-full" />
              <div className="skeleton-shimmer h-2.5 w-1/2 rounded-full" />
            </div>
            <div className="mt-2.5 flex items-center justify-between px-0.5">
              <Chip tone="gold">+— pts</Chip>
              <span className="font-mono text-[0.65rem] text-muted-foreground">0:00</span>
            </div>
          </VaultCard>
        ))}
      </div>
    </div>
  );
}
