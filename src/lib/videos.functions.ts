import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  SUBMIT_GAP_HOURS,
  normalizeTitle,
  parseVideoUrl,
  scanSubmission,
  submitCooldown,
} from "@/lib/creator-videos";

const submissionSchema = z.object({
  url: z.string().trim().min(10).max(500),
  title: z.string().trim().min(3, "Title needs at least 3 characters").max(120, "Keep the title under 120 characters"),
  format: z.enum(["short", "full"]),
  agreed: z.literal(true, { errorMap: () => ({ message: "You must accept the creator agreement" }) }),
});

/** Submits a creator video. The review bot runs here, on the server, before the video is saved as pending. */
export const submitCreatorVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => submissionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const parsed = parseVideoUrl(data.url);
    if (!parsed) {
      throw new Error("Paste a full YouTube or TikTok video link, like youtube.com/watch?v=… or tiktok.com/@name/video/…");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("creator_platform, creator_handle, is_banned")
      .eq("id", userId)
      .maybeSingle();
    if (profileError || !profile) throw new Error("We couldn't load your profile. Please try again.");
    if (profile.is_banned) throw new Error("This account is suspended");
    if (!profile.creator_handle || !profile.creator_platform) {
      throw new Error("Link your YouTube or TikTok handle in Profile first");
    }
    if (profile.creator_platform !== parsed.platform) {
      throw new Error(`Your linked channel is on ${profile.creator_platform === "youtube" ? "YouTube" : "TikTok"}. Submit a video from that channel.`);
    }

    const { data: last } = await supabase
      .from("creator_videos")
      .select("created_at")
      .eq("creator_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!submitCooldown(last?.created_at ?? null, Date.now()).canSubmit) {
      throw new Error(`You can submit 1 video every ${SUBMIT_GAP_HOURS} hours`);
    }

    const { fetchOEmbed } = await import("@/lib/videos.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const oembed = await fetchOEmbed(parsed);

    const [same, others] = await Promise.all([
      supabaseAdmin.from("creator_videos").select("creator_id").eq("video_key", parsed.key).limit(20),
      supabaseAdmin
        .from("creator_videos")
        .select("normalized_title")
        .neq("creator_id", userId)
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);
    if (same.error || others.error) {
      console.error("review bot lookup failed", same.error ?? others.error);
      throw new Error("The review bot couldn't run. Please try again in a minute.");
    }

    const scan = scanSubmission({
      userId,
      parsed,
      title: data.title,
      linkedHandle: profile.creator_handle,
      oembed,
      sameVideo: same.data ?? [],
      otherTitles: others.data ?? [],
    });

    const { data: id, error } = await supabaseAdmin.rpc("submit_creator_video", {
      p_user: userId,
      p_platform: parsed.platform,
      p_video_url: data.url,
      p_canonical_url: parsed.canonicalUrl,
      p_video_key: parsed.key,
      p_title: data.title,
      p_normalized_title: normalizeTitle(data.title),
      p_format: data.format,
      p_agreed: data.agreed,
      p_scan_status: scan.scanStatus,
      p_risk_level: scan.riskLevel,
      p_flags: scan.flags,
      p_source_title: oembed?.title ?? null,
      p_source_author: oembed?.authorName ?? null,
      p_source_author_url: oembed?.authorUrl ?? null,
      p_thumbnail_url: oembed?.thumbnailUrl ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { id: id as unknown as string, ...scan };
  });

/** Pays out a finished unlock. The viewer's network address is read here, never sent by the browser. */
export const claimVideoView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ unlockId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { clientIp } = await import("@/lib/videos.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("complete_video_view", {
      p_user: context.userId,
      p_unlock_id: data.unlockId,
      p_ip: clientIp() as string,
    });
    if (error) throw new Error(error.message);
    const r = (result ?? {}) as Record<string, unknown>;
    return {
      counted: r["counted"] === true,
      viewerReward: Number(r["viewer_reward"] ?? 0),
      creatorReward: Number(r["creator_reward"] ?? 0),
      reason: typeof r["reason"] === "string" ? r["reason"] : null,
    };
  });

/** Videos this account, or anyone on the same network, already watched in the last 24 hours. */
export const getWatchedVideoIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { clientIp } = await import("@/lib/videos.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("watched_video_ids", {
      p_user: context.userId,
      p_ip: clientIp() as string,
    });
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as string[]).map(String);
  });
