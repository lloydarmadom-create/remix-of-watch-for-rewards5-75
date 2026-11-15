import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

import type { OEmbedInfo, ParsedVideo } from "@/lib/creator-videos";

/** The visitor's network address, read from the request on the server (never from the browser). */
export function clientIp(): string | null {
  const raw =
    getRequestHeader("cf-connecting-ip") ||
    getRequestIP({ xForwardedFor: true }) ||
    getRequestHeader("x-real-ip") ||
    "";
  const ip = raw.split(",")[0]?.trim().slice(0, 64);
  return ip || null;
}

/** Public title/channel from the platform's oEmbed service. Null when unavailable. */
export async function fetchOEmbed(video: ParsedVideo): Promise<OEmbedInfo> {
  const endpoint =
    video.platform === "youtube"
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(video.canonicalUrl)}`
      : `https://www.tiktok.com/oembed?url=${encodeURIComponent(video.canonicalUrl)}`;
  try {
    const res = await fetch(endpoint, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null);
    const authorUrl =
      str(j["author_url"]) ?? (str(j["author_unique_id"]) ? `https://www.tiktok.com/@${str(j["author_unique_id"])}` : null);
    const info = {
      title: str(j["title"]),
      authorName: str(j["author_name"]),
      authorUrl,
      thumbnailUrl: str(j["thumbnail_url"]),
    };
    return info.title || info.authorName || info.authorUrl ? info : null;
  } catch (err) {
    console.error("oEmbed lookup failed", video.key, err);
    return null;
  }
}
