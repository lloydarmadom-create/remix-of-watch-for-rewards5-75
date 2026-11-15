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
  h = h.replace(/^@+/, "");
  return HANDLE_RE.test(h) ? h : null;
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

export function embedUrl(platform: Platform, id: string) {
  return platform === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&autoplay=1`
    : `https://www.tiktok.com/player/v1/${id}?rel=0&autoplay=1`;
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
export type BotFlag = { code: string; severity: Severity; label: string; detail: string };
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
  sameVideo: { creator_id: string }[];
  otherTitles: { normalized_title: string }[];
}): { flags: BotFlag[]; scanStatus: ScanStatus; riskLevel: RiskLevel } {
  const flags: BotFlag[] = [];
  const { parsed, oembed } = input;
  const linked = input.linkedHandle.replace(/^@/, "").toLowerCase();

  if (input.sameVideo.length) {
    const mine = input.sameVideo.some((v) => v.creator_id === input.userId);
    const others = input.sameVideo.some((v) => v.creator_id !== input.userId);
    flags.push({
      code: "duplicate_video",
      severity: "high",
      label: "Duplicate video",
      detail: others
        ? "This exact video was already submitted by another account."
        : mine
          ? "You already submitted this exact video."
          : "This exact video is already in the hub.",
    });
  }

  const norm = normalizeTitle(input.title);
  const sourceNorm = oembed?.title ? normalizeTitle(oembed.title) : "";
  let best = 0;
  for (const t of input.otherTitles) {
    if (!t.normalized_title) continue;
    best = Math.max(best, titleSimilarity(norm, t.normalized_title), titleSimilarity(sourceNorm, t.normalized_title));
  }
  if (best >= 0.85 && Math.max(norm.length, sourceNorm.length) >= 6) {
    flags.push({
      code: "similar_title",
      severity: "high",
      label: "Possible re-upload",
      detail: `Title is ${Math.round(best * 100)}% similar to another creator's video.`,
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
