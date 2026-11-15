import { embedUrl, type Platform, type VideoFormat } from "@/lib/creator-videos";
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
  return (
    <div
      className={cn(
        "vault-well mx-auto overflow-hidden",
        vertical ? "aspect-[9/16] w-full max-w-[300px]" : "aspect-video w-full",
        className,
      )}
    >
      <iframe
        src={embedUrl(platform, id)}
        title={title}
        className="size-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
