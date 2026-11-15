export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ad_sessions: {
        Row: {
          coins_awarded: number
          completed_at: string | null
          id: string
          started_at: string
          user_id: string
        }
        Insert: {
          coins_awarded?: number
          completed_at?: string | null
          id?: string
          started_at?: string
          user_id: string
        }
        Update: {
          coins_awarded?: number
          completed_at?: string | null
          id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          aads_unit_id: string
          id: number
          maintenance_message: string
          maintenance_mode: boolean
          robux_stock: number
          sats_stock: number
          testing_mode: boolean
          updated_at: string
        }
        Insert: {
          aads_unit_id?: string
          id?: number
          maintenance_message?: string
          maintenance_mode?: boolean
          robux_stock?: number
          sats_stock?: number
          testing_mode?: boolean
          updated_at?: string
        }
        Update: {
          aads_unit_id?: string
          id?: number
          maintenance_message?: string
          maintenance_mode?: boolean
          robux_stock?: number
          sats_stock?: number
          testing_mode?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          created_at: string
          detail: Json
          event: string
          id: string
          ip_address: string | null
          user_id: string | null
          video_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json
          event: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
          video_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json
          event?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "creator_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          reply_email: string
          sender_name: string
          status: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          message: string
          reply_email: string
          sender_name: string
          status?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          reply_email?: string
          sender_name?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_videos: {
        Row: {
          agreed_terms: boolean
          bot_flags: Json
          canonical_url: string
          created_at: string
          creator_handle: string
          creator_id: string
          format: string
          id: string
          normalized_title: string
          platform: string
          review_note: string
          reviewed_at: string | null
          risk_level: string
          scan_status: string
          source_author: string | null
          source_author_url: string | null
          source_title: string | null
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_key: string
          video_url: string
          view_count: number
        }
        Insert: {
          agreed_terms: boolean
          bot_flags?: Json
          canonical_url: string
          created_at?: string
          creator_handle: string
          creator_id: string
          format: string
          id?: string
          normalized_title?: string
          platform: string
          review_note?: string
          reviewed_at?: string | null
          risk_level?: string
          scan_status?: string
          source_author?: string | null
          source_author_url?: string | null
          source_title?: string | null
          status?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_key: string
          video_url: string
          view_count?: number
        }
        Update: {
          agreed_terms?: boolean
          bot_flags?: Json
          canonical_url?: string
          created_at?: string
          creator_handle?: string
          creator_id?: string
          format?: string
          id?: string
          normalized_title?: string
          platform?: string
          review_note?: string
          reviewed_at?: string | null
          risk_level?: string
          scan_status?: string
          source_author?: string | null
          source_author_url?: string | null
          source_title?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_key?: string
          video_url?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "creator_videos_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ads_completed: number
          coin_balance: number
          created_at: string
          creator_handle: string | null
          creator_platform: string | null
          email: string
          id: string
          is_banned: boolean
          last_check_in_at: string | null
          last_streak_on: string | null
          level: number
          lifetime_earned: number
          referral_code: string
          referred_by: string | null
          roblox_username: string | null
          streak_count: number
          tiktok_handle: string | null
          updated_at: string
          youtube_handle: string | null
        }
        Insert: {
          ads_completed?: number
          coin_balance?: number
          created_at?: string
          creator_handle?: string | null
          creator_platform?: string | null
          email?: string
          id: string
          is_banned?: boolean
          last_check_in_at?: string | null
          last_streak_on?: string | null
          level?: number
          lifetime_earned?: number
          referral_code: string
          referred_by?: string | null
          roblox_username?: string | null
          streak_count?: number
          tiktok_handle?: string | null
          updated_at?: string
          youtube_handle?: string | null
        }
        Update: {
          ads_completed?: number
          coin_balance?: number
          created_at?: string
          creator_handle?: string | null
          creator_platform?: string | null
          email?: string
          id?: string
          is_banned?: boolean
          last_check_in_at?: string | null
          last_streak_on?: string | null
          level?: number
          lifetime_earned?: number
          referral_code?: string
          referred_by?: string | null
          roblox_username?: string | null
          streak_count?: number
          tiktok_handle?: string | null
          updated_at?: string
          youtube_handle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          note: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          note?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_settings: {
        Row: {
          ad_min_seconds: number
          coins_per_ad: number
          daily_ad_limit: number
          id: number
          streak_coins: number
          updated_at: string
        }
        Insert: {
          ad_min_seconds?: number
          coins_per_ad?: number
          daily_ad_limit?: number
          id?: number
          streak_coins?: number
          updated_at?: string
        }
        Update: {
          ad_min_seconds?: number
          coins_per_ad?: number
          daily_ad_limit?: number
          id?: number
          streak_coins?: number
          updated_at?: string
        }
        Relationships: []
      }
      video_unlocks: {
        Row: {
          completed_at: string | null
          id: string
          outcome: string | null
          started_at: string
          video_id: string
          viewer_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          outcome?: string | null
          started_at?: string
          video_id: string
          viewer_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          outcome?: string | null
          started_at?: string
          video_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_unlocks_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "creator_videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_unlocks_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_views: {
        Row: {
          created_at: string
          creator_reward: number
          id: string
          ip_address: string | null
          video_id: string
          viewer_id: string
          viewer_reward: number
        }
        Insert: {
          created_at?: string
          creator_reward?: number
          id?: string
          ip_address?: string | null
          video_id: string
          viewer_id: string
          viewer_reward?: number
        }
        Update: {
          created_at?: string
          creator_reward?: number
          id?: string
          ip_address?: string | null
          video_id?: string
          viewer_id?: string
          viewer_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_views_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "creator_videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_profiles: {
        Args: never
        Returns: {
          ads_completed: number
          coin_balance: number
          created_at: string
          creator_handle: string | null
          creator_platform: string | null
          email: string
          id: string
          is_banned: boolean
          last_check_in_at: string | null
          last_streak_on: string | null
          level: number
          lifetime_earned: number
          referral_code: string
          referred_by: string | null
          roblox_username: string | null
          streak_count: number
          tiktok_handle: string | null
          updated_at: string
          youtube_handle: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_review_video: {
        Args: { p_decision: string; p_note?: string; p_video_id: string }
        Returns: undefined
      }
      admin_set_banned: {
        Args: { p_banned: boolean; p_user_id: string }
        Returns: undefined
      }
      claim_streak: { Args: never; Returns: number }
      complete_ad_view: { Args: { p_session_id: string }; Returns: number }
      complete_video_view: {
        Args: { p_ip: string; p_unlock_id: string; p_user: string }
        Returns: Json
      }
      ensure_profile: { Args: never; Returns: undefined }
      get_earn_status: { Args: never; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      start_ad_view: { Args: never; Returns: string }
      start_video_unlock: { Args: { p_video_id: string }; Returns: string }
      submit_creator_video: {
        Args: {
          p_agreed: boolean
          p_canonical_url: string
          p_flags: Json
          p_format: string
          p_normalized_title: string
          p_platform: string
          p_risk_level: string
          p_scan_status: string
          p_source_author: string
          p_source_author_url: string
          p_source_title: string
          p_thumbnail_url: string
          p_title: string
          p_user: string
          p_video_key: string
          p_video_url: string
        }
        Returns: string
      }
      watched_video_ids: {
        Args: { p_ip: string; p_user: string }
        Returns: string[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
