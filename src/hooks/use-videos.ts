import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { BotFlag, Platform, RiskLevel, ScanStatus, VideoFormat } from "@/lib/creator-videos";
import { getWatchedVideoIds } from "@/lib/videos.functions";

export type FeedVideo = {
  id: string;
  creator_id: string;
  platform: Platform;
  creator_handle: string;
  video_key: string;
  title: string;
  format: VideoFormat;
  thumbnail_url: string | null;
  view_count: number;
  created_at: string;
};

export type CreatorVideo = FeedVideo & {
  video_url: string;
  status: "pending" | "approved" | "rejected";
  scan_status: ScanStatus | "pending";
  risk_level: RiskLevel;
  bot_flags: BotFlag[];
  source_title: string | null;
  source_author: string | null;
  source_author_url: string | null;
  review_note: string;
  reviewed_at: string | null;
};

const FEED_COLUMNS = "id, creator_id, platform, creator_handle, video_key, title, format, thumbnail_url, view_count, created_at";
export const FULL_COLUMNS = `${FEED_COLUMNS}, video_url, status, scan_status, risk_level, bot_flags, source_title, source_author, source_author_url, review_note, reviewed_at`;

/** Approved videos for the hub feed. */
export function useApprovedVideos() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["creator_videos", "approved", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_videos")
        .select(FEED_COLUMNS)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as unknown as FeedVideo[];
    },
  });
}

/** The signed-in creator's own submissions, newest first. */
export function useMySubmissions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["creator_videos", "mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_videos")
        .select(FULL_COLUMNS)
        .eq("creator_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as CreatorVideo[];
    },
  });
}

/** Video ids already watched in the last 24 hours by this account or its network. */
export function useWatchedVideos() {
  const { user } = useAuth();
  const fetchWatched = useServerFn(getWatchedVideoIds);
  return useQuery({
    queryKey: ["watched_videos", user?.id],
    enabled: !!user,
    queryFn: async () => new Set(await fetchWatched()),
  });
}

export function refreshVideos(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["creator_videos"] });
  void queryClient.invalidateQueries({ queryKey: ["watched_videos"] });
}
