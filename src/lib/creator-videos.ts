// Creator Videos rules shared by the browser (display) and the server (review bot).
// The database functions enforce the reward amounts and 24-hour limits; keep both in step.

export type Platform = "youtube" | "tiktok";
export type VideoFormat = "short" | "full";

/** Coins paid per counted view: creator and viewer. */
export const VIDEO_REWARDS: Record<VideoFormat, { creator: number; viewer: number }> = {
  short: { creator: 0.35, viewer: 0.3 },
  full: { creator: 0.45, viewer: 0.4 },
};
export const UNLOCK_SECONDS = 15;
export const SUBMIT_GAP_HOURS = 24;
export const REWATCH_HOURS = 24;

export const AGREEMENT_TEXT =
  "This is my original content, and I agree that all admin approvals, rejections, view audits, and bans are 100% final with no appeals.";

export const PLATFORM_LABEL: Record<Platform, string> = { youtube: "YouTube", tiktok: "TikTok" };
export const FORMAT_LABEL: Record<VideoFormat, string> = { short: "Short", full: "Full video" };

const HOUR = 3_600_000;
export const HANDLE_RE = /^[A-Za-z0-9._-]{2,30}$/;

/** Accepts "@name", "name" or a channel/profile link; returns the bare handle or null. */
export function normalizeHandle(input: string): string | null {
  let h = input.trim();
  const fromUrl = h.match(/(?:youtube\.com|tiktok\.com)\/@([^/?#\s]+)/i);
  if (fromUrl?.[1]) h = fromUrl[1];
  const channelId = h.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/i);
  if (channelId?.[1]) return channelId[1];
  h = h.replace(/^@+/, "");
  return HANDLE_RE.test(h) ? h : null;
}

/**
 * Strict channel check for linking: a youtube.com / tiktok.com channel link, or an @handle.
 * Returns the bare handle, or a message explaining what's wrong.
 */
export function parseChannelInput(platform: Platform, raw: string): { ok: true; handle: string } | { ok: false; error: string } {
  const v = raw.trim();
  const site = platform === "youtube" ? "youtube.com" : "tiktok.com";
  const example = platform === "youtube" ? "youtube.com/@yourchannel or @yourchannel" : "tiktok.com/@yourname or @yourname";
  if (!v) return { ok: false, error: `Enter your ${PLATFORM_LABEL[platform]} channel: ${example}.` };
  const isUrl = /^(https?:\/\/)?([a-z0-9-]+\.)*(youtube|tiktok)\.com\//i.test(v) || /:\/\//.test(v);
  if (isUrl) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    } catch {
      return { ok: false, error: `That link doesn't look right. Use ${example}.` };
    }
    const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
    if (host !== site) return { ok: false, error: `Use a ${site} channel link, like ${example}.` };
    const handle = normalizeHandle(`${site}${url.pathname}`);
    const isChannelPath = /^\/@[^/]+\/?$/.test(url.pathname) || (platform === "youtube" && /^\/channel\/UC[A-Za-z0-9_-]{22}\/?$/.test(url.pathname));
    if (!handle || !isChannelPath) return { ok: false, error: `Paste your channel link, not a video link: ${example}.` };
    return { ok: true, handle };
  }
  if (!v.startsWith("@")) return { ok: false, error: `Start your handle with @, like @yourchannel, or paste your ${site} link.` };
  const handle = normalizeHandle(v);
  if (!handle) return { ok: false, error: "Handles use 2–30 letters, numbers, dots, dashes or underscores." };
  return { ok: true, handle };
}

export type ParsedVideo = {
  platform: Platform;
  id: string;
  key: string;
  canonicalUrl: string;
  /** Handle written in the link itself (TikTok links include it). */
  urlHandle: string | null;
};

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Reads a YouTube or TikTok video link. Returns null for anything else. */
export function parseVideoUrl(raw: string): ParsedVideo | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, "");
  const path = url.pathname;

  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    let id: string | null = null;
    if (host === "youtu.be") id = path.split("/")[1] ?? null;
    else if (path === "/watch") id = url.searchParams.get("v");
    else id = path.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1] ?? null;
    if (!id || !YT_ID.test(id)) return null;
    return {
      platform: "youtube",
      id,
      key: `youtube:${id}`,
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
      urlHandle: null,
    };
  }

  if (host === "tiktok.com") {
    const m = path.match(/^\/@([A-Za-z0-9._-]{2,30})\/video\/(\d{8,25})/);
    if (!m) return null;
    const [, handle, id] = m as unknown as [string, string, string];
    return {
      platform: "tiktok",
      id,
      key: `tiktok:${id}`,
      canonicalUrl: `https://www.tiktok.com/@${handle}/video/${id}`,
      urlHandle: handle,
    };
  }
  return null;
}

/** Video id from a stored key such as "youtube:dQw4w9WgXcQ". */
export function idFromKey(key: string) {
  return key.split(":")[1] ?? "";
}

/**
 * Embeddable player URL. YouTube needs the page origin (and a referrer) or it refuses to play
 * inside other sites; playsinline keeps it inside the app on phones instead of going fullscreen.
 */
export function embedUrl(platform: Platform, id: string, origin?: string) {
  if (platform === "youtube") {
    const q = new URLSearchParams({ playsinline: "1", rel: "0", autoplay: "1", modestbranding: "1", enablejsapi: "0" });
    if (origin) q.set("origin", origin);
    return `https://www.youtube.com/embed/${encodeURIComponent(id)}?${q.toString()}`;
  }
  return `https://www.tiktok.com/player/v1/${encodeURIComponent(id)}?autoplay=1&rel=0&music_info=1&description=1`;
}

/** The video's own page, for opening it in the YouTube / TikTok app. */
export function watchUrl(platform: Platform, id: string) {
  return platform === "youtube" ? `https://www.youtube.com/watch?v=${id}` : `https://www.tiktok.com/embed/v2/${id}`;
}

export function thumbnailFor(platform: Platform, id: string, stored: string | null) {
  if (platform === "youtube") return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  return stored;
}

const NOISE = new Set(["shorts", "short", "fyp", "foryou", "foryoupage", "viral", "hd", "4k", "video", "the", "a"]);

function plain(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Lowercase title without hashtags, emoji, punctuation or filler words, for comparing re-uploads. */
export function normalizeTitle(title: string) {
  return plain(title.replace(/#[\p{L}\p{N}_]+/gu, " "))
    .split(" ")
    .filter((w) => w && !NOISE.has(w))
    .join(" ");
}

function bigrams(s: string) {
  const t = s.replace(/\s+/g, "");
  const out = new Map<string, number>();
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** 0–1 similarity between two normalized titles (Dice coefficient on letter pairs). */
export function titleSimilarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let total = 0;
  A.forEach((n) => (total += n));
  B.forEach((n) => (total += n));
  if (total === 0) return 0;
  let overlap = 0;
  A.forEach((n, g) => (overlap += Math.min(n, B.get(g) ?? 0)));
  return (2 * overlap) / total;
}

export const MOVIE_KEYWORDS = [
  "movie clip",
  "full movie",
  "movie scene",
  "film clip",
  "episode",
  "full episode",
  "scene",
  "official trailer",
  "trailer",
  "season",
  "tv show",
  "netflix",
  "disney",
  "pixar",
  "marvel",
  "hbo",
  "prime video",
  "hulu",
  "paramount",
  "dreamworks",
  "warner bros",
  "nickelodeon",
  "cartoon network",
  "crunchyroll",
];

/** Movie/TV words found in a title (whole words only). */
export function findMovieKeywords(text: string) {
  const t = ` ${plain(text)} `;
  const hits = MOVIE_KEYWORDS.filter((k) => t.includes(` ${k} `));
  if (/\bs\d{1,2}\s?e\d{1,3}\b/i.test(text)) hits.push("SxxExx");
  return hits;
}

export type Severity = "high" | "medium" | "low";
/** The existing video a duplicate / re-upload flag points at, so the admin can compare both. */
export type FlagRef = { id: string | null; title: string; url: string; platform: Platform; key: string | null };
export type BotFlag = { code: string; severity: Severity; label: string; detail: string; ref?: FlagRef };
export type MatchRow = {
  id?: string;
  creator_id?: string;
  title?: string;
  normalized_title?: string;
  canonical_url?: string;
  platform?: string;
  video_key?: string;
};
const refFrom = (m: MatchRow | undefined): FlagRef | undefined =>
  m?.canonical_url
    ? {
        id: m.id ?? null,
        title: m.title ?? "",
        url: m.canonical_url,
        platform: (m.platform === "tiktok" ? "tiktok" : "youtube") as Platform,
        key: m.video_key ?? null,
      }
    : undefined;
export type ScanStatus = "clean" | "flagged" | "partial";
export type RiskLevel = "low" | "medium" | "high";

export type OEmbedInfo = {
  title: string | null;
  authorName: string | null;
  authorUrl: string | null;
  thumbnailUrl: string | null;
} | null;

function handleFromAuthorUrl(url: string | null) {
  return url?.match(/\/@([^/?#]+)/)?.[1] ?? null;
}

const compact = (s: string) => plain(s).replace(/\s+/g, "");

/** The automated review bot: flags duplicates, re-uploads, channel mismatches and movie/TV clips. */
export function scanSubmission(input: {
  userId: string;
  parsed: ParsedVideo;
  title: string;
  linkedHandle: string;
  oembed: OEmbedInfo;
  sameVideo: (MatchRow & { creator_id: string })[];
  otherTitles: (MatchRow & { normalized_title: string })[];
}): { flags: BotFlag[]; scanStatus: ScanStatus; riskLevel: RiskLevel } {
  const flags: BotFlag[] = [];
  const { parsed, oembed } = input;
  const linked = input.linkedHandle.replace(/^@/, "").toLowerCase();

  if (input.sameVideo.length) {
    const mine = input.sameVideo.some((v) => v.creator_id === input.userId);
    const others = input.sameVideo.some((v) => v.creator_id !== input.userId);
    const earliest = input.sameVideo.find((v) => v.creator_id !== input.userId) ?? input.sameVideo[0];
    const ref = refFrom(earliest);
    flags.push({
      code: "duplicate_video",
      severity: "high",
      label: "Duplicate video",
      detail: others
        ? "This exact video was already submitted by another account."
        : mine
          ? "You already submitted this exact video."
          : "This exact video is already in the hub.",
      ...(ref ? { ref } : {}),
    });
  }

  const norm = normalizeTitle(input.title);
  const sourceNorm = oembed?.title ? normalizeTitle(oembed.title) : "";
  let best = 0;
  let bestRow: MatchRow | undefined;
  for (const t of input.otherTitles) {
    if (!t.normalized_title) continue;
    const score = Math.max(titleSimilarity(norm, t.normalized_title), titleSimilarity(sourceNorm, t.normalized_title));
    if (score > best) {
      best = score;
      bestRow = t;
    }
  }
  if (best >= 0.85 && Math.max(norm.length, sourceNorm.length) >= 6) {
    const ref = refFrom(bestRow);
    flags.push({
      code: "similar_title",
      severity: "high",
      label: "Possible re-upload",
      detail: `Title is ${Math.round(best * 100)}% similar to another creator's video${bestRow?.title ? `: "${bestRow.title.slice(0, 80)}"` : ""}.`,
      ...(ref ? { ref } : {}),
    });
  }

  const sourceHandle = parsed.urlHandle ?? handleFromAuthorUrl(oembed?.authorUrl ?? null);
  if (sourceHandle) {
    if (sourceHandle.toLowerCase() !== linked) {
      flags.push({
        code: "channel_mismatch",
        severity: "high",
        label: "Channel mismatch",
        detail: `Video belongs to @${sourceHandle}, but your linked handle is @${linked}.`,
      });
    }
  } else if (oembed?.authorName && compact(oembed.authorName) !== compact(linked)) {
    flags.push({
      code: "channel_unverified",
      severity: "medium",
      label: "Channel not confirmed",
      detail: `Video is from "${oembed.authorName}", which couldn't be matched to @${linked}.`,
    });
  }

  const keywords = Array.from(new Set([...findMovieKeywords(input.title), ...findMovieKeywords(oembed?.title ?? "")]));
  if (keywords.length) {
    flags.push({
      code: "movie_tv_clip",
      severity: "high",
      label: "Movie/TV clip words",
      detail: `Found: ${keywords.join(", ")}.`,
    });
  }

  if (!oembed) {
    flags.push({
      code: "metadata_unavailable",
      severity: "medium",
      label: "No public details",
      detail: "The video's public title and channel couldn't be fetched. It may be private, deleted or blocked.",
    });
  } else if (oembed.title && titleSimilarity(norm, sourceNorm) < 0.5) {
    flags.push({
      code: "title_differs",
      severity: "low",
      label: "Title differs",
      detail: `The video's real title is "${oembed.title.slice(0, 100)}".`,
    });
  }

  const riskLevel: RiskLevel = flags.some((f) => f.severity === "high")
    ? "high"
    : flags.some((f) => f.severity === "medium")
      ? "medium"
      : "low";
  const onlyMissingData = flags.length > 0 && flags.every((f) => f.code === "metadata_unavailable" || f.severity === "low");
  const scanStatus: ScanStatus = flags.length === 0 ? "clean" : onlyMissingData && !oembed ? "partial" : flags.every((f) => f.severity === "low") ? "clean" : "flagged";
  return { flags, scanStatus, riskLevel };
}

/** When the creator can submit their next video. */
export function submitCooldown(lastSubmittedAt: string | null, now: number) {
  if (!lastSubmittedAt) return { canSubmit: true, nextAt: null as number | null };
  const nextAt = new Date(lastSubmittedAt).getTime() + SUBMIT_GAP_HOURS * HOUR;
  return { canSubmit: now >= nextAt, nextAt };
}
