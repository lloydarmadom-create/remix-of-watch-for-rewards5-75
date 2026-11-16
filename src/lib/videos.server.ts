import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

import type { OEmbedInfo, ParsedVideo } from "@/lib/creator-videos";
import { normalizeIp } from "@/lib/ip";

/**
 * The visitor's real network address, read from the request on the server (never from the
 * browser): cf-connecting-ip, then x-forwarded-for, then x-real-ip. Normalized so alt accounts
 * on the same Wi-Fi or phone network match.
 */
export function clientIp(): string | null {
  return (
    normalizeIp(getRequestHeader("cf-connecting-ip")) ||
    normalizeIp(getRequestHeader("x-forwarded-for")) ||
    normalizeIp(getRequestHeader("x-real-ip")) ||
    normalizeIp(getRequestIP({ xForwardedFor: true }))
  );
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

export type ChannelInfo =
  | { status: "found"; name: string; avatarUrl: string | null; url: string }
  | { status: "not_found" }
  | { status: "unavailable"; url: string };

const metaContent = (html: string, prop: string) => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i");
  const alt = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  return (html.match(re)?.[1] ?? html.match(alt)?.[1] ?? "").trim() || null;
};
const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Public name and picture of a YouTube or TikTok channel, so the player can confirm it's theirs. */
export async function fetchChannelInfo(platform: "youtube" | "tiktok", handle: string): Promise<ChannelInfo> {
  const url =
    platform === "youtube"
      ? /^UC[A-Za-z0-9_-]{22}$/.test(handle)
        ? `https://www.youtube.com/channel/${handle}`
        : `https://www.youtube.com/@${handle}`
      : `https://www.tiktok.com/@${handle}`;
  try {
    if (platform === "tiktok") {
      const o = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      });
      if (o.ok) {
        const j = (await o.json()) as Record<string, unknown>;
        const name = typeof j["author_name"] === "string" ? j["author_name"] : typeof j["title"] === "string" ? j["title"] : null;
        if (name) {
          return { status: "found", name: name.slice(0, 120), avatarUrl: typeof j["thumbnail_url"] === "string" ? j["thumbnail_url"] : null, url };
        }
      }
      if (o.status === 400 || o.status === 404) return { status: "not_found" };
    }
    const res = await fetch(url, {
      headers: { "accept-language": "en-US,en;q=0.8", "user-agent": "Mozilla/5.0 (compatible; WatchForRewardsBot/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { status: "unavailable", url };
    const html = (await res.text()).slice(0, 400_000);
    const title = metaContent(html, "og:title");
    if (!title) return { status: "unavailable", url };
    return { status: "found", name: decode(title).slice(0, 120), avatarUrl: metaContent(html, "og:image"), url };
  } catch (err) {
    console.error("channel lookup failed", platform, handle, err);
    return { status: "unavailable", url };
  }
}
