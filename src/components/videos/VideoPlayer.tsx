import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { embedUrl, PLATFORM_LABEL, watchUrl, type Platform, type VideoFormat } from "@/lib/creator-videos";
import { cn } from "@/lib/utils";

/** Embedded YouTube/TikTok player. Vertical for Shorts and TikTok, wide for full YouTube videos. */
export function VideoPlayer({
  platform,
  id,
  format,
  title,
  className,
}: {
  platform: Platform;
  id: string;
  format: VideoFormat;
  title: string;
  className?: string;
}) {
  const vertical = platform === "tiktok" || format === "short";
  // The page origin is only known in the browser; render the frame once it is.
  const [origin, setOrigin] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => setLoaded(false), [platform, id]);

  return (
    <div className={className}>
      <div
        className={cn(
          "vault-well relative mx-auto overflow-hidden bg-background",
          vertical ? "aspect-[9/16] w-full max-w-[320px]" : "aspect-video w-full",
        )}
      >
        {!loaded ? (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 className="size-6 animate-spin text-cyan" />
          </div>
        ) : null}
        {origin ? (
          <iframe
            key={`${platform}-${id}`}
            src={embedUrl(platform, id, origin)}
            title={title}
            onLoad={() => setLoaded(true)}
            className="relative size-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : null}
      </div>
      <a
        href={watchUrl(platform, id)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 flex items-center justify-center gap-1 text-[0.7rem] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Not playing? Open on {PLATFORM_LABEL[platform]} <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
