-- ============ 1. Table access (fresh remixes arrive without grants) ============
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

GRANT SELECT, UPDATE ON public.vault_settings TO authenticated;
GRANT ALL ON public.vault_settings TO service_role;

GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

GRANT ALL ON public.ad_sessions TO service_role;

GRANT INSERT ON public.contact_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;

-- ============ 2. Creator handle on profiles ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS creator_platform text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS creator_handle text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_creator_platform_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_creator_platform_check
  CHECK (creator_platform IS NULL OR creator_platform IN ('youtube', 'tiktok'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_creator_handle_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_creator_handle_check
  CHECK (creator_handle IS NULL OR creator_handle ~ '^[A-Za-z0-9._-]{2,30}$');
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_creator_pair_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_creator_pair_check
  CHECK ((creator_platform IS NULL) = (creator_handle IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_creator_channel_unique
  ON public.profiles (creator_platform, lower(creator_handle)) WHERE creator_handle IS NOT NULL;

GRANT SELECT ON public.profiles TO authenticated;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (roblox_username, youtube_handle, tiktok_handle, creator_platform, creator_handle)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- ============ 3. Ledger kinds for video earnings ============
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_kind_valid;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_kind_valid
  CHECK (kind IN ('ad', 'streak', 'referral', 'redeem', 'adjustment', 'video_view', 'video_creator'));

-- ============ 4. Settings rows the app expects ============
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.vault_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============ 5. Profile creation that can never block sign-up ============
CREATE OR REPLACE FUNCTION private.create_profile_for(p_id uuid, p_email text, p_ref text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  ref_code text := upper(trim(coalesce(p_ref, '')));
  referrer uuid;
  new_code text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_id) THEN RETURN; END IF;
  IF ref_code ~ '^[A-Z0-9]{4,16}$' THEN
    SELECT p.id INTO referrer FROM public.profiles p WHERE p.referral_code = ref_code AND p.id <> p_id;
  END IF;
  LOOP
    new_code := upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = new_code);
  END LOOP;
  INSERT INTO public.profiles (id, email, referral_code, referred_by)
  VALUES (p_id, coalesce(p_email, ''), new_code, referrer)
  ON CONFLICT (id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION private.create_profile_for(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM private.create_profile_for(NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'ref');
  EXCEPTION WHEN OTHERS THEN
    -- Never fail the sign-up; the app calls ensure_profile() on first load as a fallback.
    RAISE WARNING 'Profile setup deferred for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  u auth.users%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO u FROM auth.users WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  PERFORM private.create_profile_for(u.id, u.email, u.raw_user_meta_data ->> 'ref');
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_profile() TO authenticated;

-- Backfill profiles for accounts created while the trigger was missing
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT u.id, u.email, u.raw_user_meta_data ->> 'ref' AS ref FROM auth.users u
           WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id) LOOP
    PERFORM private.create_profile_for(r.id, r.email, r.ref);
  END LOOP;
END $$;

-- ============ 6. Creator videos ============
CREATE TABLE IF NOT EXISTS public.creator_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('youtube', 'tiktok')),
  creator_handle text NOT NULL,
  video_url text NOT NULL,
  canonical_url text NOT NULL,
  video_key text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  normalized_title text NOT NULL DEFAULT '',
  format text NOT NULL CHECK (format IN ('short', 'full')),
  agreed_terms boolean NOT NULL CHECK (agreed_terms),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'flagged', 'partial')),
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  bot_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_title text,
  source_author text,
  source_author_url text,
  thumbnail_url text,
  view_count integer NOT NULL DEFAULT 0,
  review_note text NOT NULL DEFAULT '',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creator_videos_creator_idx ON public.creator_videos (creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creator_videos_key_idx ON public.creator_videos (video_key);
CREATE INDEX IF NOT EXISTS creator_videos_status_idx ON public.creator_videos (status, created_at DESC);

GRANT SELECT ON public.creator_videos TO authenticated;
GRANT ALL ON public.creator_videos TO service_role;
ALTER TABLE public.creator_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS creator_videos_read ON public.creator_videos;
CREATE POLICY creator_videos_read ON public.creator_videos
  FOR SELECT TO authenticated
  USING (status = 'approved' OR creator_id = auth.uid() OR public.is_admin());

DROP TRIGGER IF EXISTS creator_videos_touch ON public.creator_videos;
CREATE TRIGGER creator_videos_touch BEFORE UPDATE ON public.creator_videos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ 7. Unlocks, views, audit log ============
CREATE TABLE IF NOT EXISTS public.video_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.creator_videos(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  outcome text
);
CREATE INDEX IF NOT EXISTS video_unlocks_viewer_idx ON public.video_unlocks (viewer_id, started_at DESC);
GRANT ALL ON public.video_unlocks TO service_role;
ALTER TABLE public.video_unlocks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.video_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.creator_videos(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_address text,
  viewer_reward numeric NOT NULL DEFAULT 0,
  creator_reward numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS video_views_viewer_idx ON public.video_views (video_id, viewer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS video_views_ip_idx ON public.video_views (video_id, ip_address, created_at DESC);
GRANT SELECT ON public.video_views TO authenticated;
GRANT ALL ON public.video_views TO service_role;
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS video_views_admin_read ON public.video_views;
CREATE POLICY video_views_admin_read ON public.video_views
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event text NOT NULL,
  video_id uuid REFERENCES public.creator_videos(id) ON DELETE SET NULL,
  ip_address text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_admin_read ON public.audit_logs;
CREATE POLICY audit_logs_admin_read ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

-- ============ 8. Submission (server only, after the review bot runs) ============
CREATE OR REPLACE FUNCTION public.submit_creator_video(
  p_user uuid, p_platform text, p_video_url text, p_canonical_url text, p_video_key text,
  p_title text, p_normalized_title text, p_format text, p_agreed boolean,
  p_scan_status text, p_risk_level text, p_flags jsonb,
  p_source_title text, p_source_author text, p_source_author_url text, p_thumbnail_url text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  p public.profiles%ROWTYPE;
  last_at timestamptz;
  new_id uuid;
BEGIN
  IF coalesce((SELECT s.maintenance_mode FROM public.app_settings s WHERE s.id = 1), false) THEN
    RAISE EXCEPTION 'Vault maintenance in progress';
  END IF;
  SELECT * INTO p FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF p.is_banned THEN RAISE EXCEPTION 'This account is suspended'; END IF;
  IF p.creator_handle IS NULL THEN RAISE EXCEPTION 'Link your YouTube or TikTok handle in Profile first'; END IF;
  IF p.creator_platform <> p_platform THEN
    RAISE EXCEPTION 'This link is not from your linked % channel', p.creator_platform;
  END IF;
  IF NOT coalesce(p_agreed, false) THEN RAISE EXCEPTION 'You must accept the creator agreement'; END IF;
  SELECT max(created_at) INTO last_at FROM public.creator_videos WHERE creator_id = p_user;
  IF last_at IS NOT NULL AND now() - last_at < interval '24 hours' THEN
    RAISE EXCEPTION 'You can submit 1 video every 24 hours';
  END IF;

  INSERT INTO public.creator_videos (
    creator_id, platform, creator_handle, video_url, canonical_url, video_key, title, normalized_title,
    format, agreed_terms, status, scan_status, risk_level, bot_flags,
    source_title, source_author, source_author_url, thumbnail_url
  ) VALUES (
    p_user, p_platform, p.creator_handle, p_video_url, p_canonical_url, p_video_key, p_title, p_normalized_title,
    p_format, true, 'pending', p_scan_status, p_risk_level, coalesce(p_flags, '[]'::jsonb),
    p_source_title, p_source_author, p_source_author_url, p_thumbnail_url
  ) RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_creator_video(uuid, text, text, text, text, text, text, text, boolean, text, text, jsonb, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_creator_video(uuid, text, text, text, text, text, text, text, boolean, text, text, jsonb, text, text, text, text) TO service_role;

-- ============ 9. Admin review ============
CREATE OR REPLACE FUNCTION public.admin_review_video(p_video_id uuid, p_decision text, p_note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_decision NOT IN ('approved', 'rejected', 'pending') THEN RAISE EXCEPTION 'Unknown decision'; END IF;
  UPDATE public.creator_videos
     SET status = p_decision,
         review_note = left(coalesce(p_note, ''), 280),
         reviewed_at = CASE WHEN p_decision = 'pending' THEN NULL ELSE now() END
   WHERE id = p_video_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Video not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_video(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_video(uuid, text, text) TO authenticated;

-- ============ 10. Unlock + reward ============
CREATE OR REPLACE FUNCTION public.start_video_unlock(p_video_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  p public.profiles%ROWTYPE;
  v public.creator_videos%ROWTYPE;
  unlock_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF private.maintenance_blocks() THEN RAISE EXCEPTION 'Vault maintenance in progress'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF p.is_banned THEN RAISE EXCEPTION 'This account is suspended'; END IF;
  IF p.coin_balance >= 1500 THEN RAISE EXCEPTION 'Coin limit reached. Spend coins in the Store first'; END IF;
  SELECT * INTO v FROM public.creator_videos WHERE id = p_video_id;
  IF NOT FOUND OR v.status <> 'approved' THEN RAISE EXCEPTION 'This video is not available'; END IF;
  IF v.creator_id = auth.uid() THEN RAISE EXCEPTION 'You cannot watch or earn from your own video'; END IF;

  -- One unlock at a time
  DELETE FROM public.video_unlocks WHERE viewer_id = auth.uid() AND completed_at IS NULL;
  INSERT INTO public.video_unlocks (video_id, viewer_id) VALUES (p_video_id, auth.uid()) RETURNING id INTO unlock_id;
  RETURN unlock_id;
END;
$$;
REVOKE ALL ON FUNCTION public.start_video_unlock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_video_unlock(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_video_view(p_user uuid, p_unlock_id uuid, p_ip text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  u public.video_unlocks%ROWTYPE;
  v public.creator_videos%ROWTYPE;
  viewer public.profiles%ROWTYPE;
  creator public.profiles%ROWTYPE;
  same_user boolean;
  same_ip boolean;
  base_viewer numeric;
  base_creator numeric;
  viewer_amt numeric := 0;
  creator_amt numeric := 0;
BEGIN
  IF coalesce((SELECT s.maintenance_mode FROM public.app_settings s WHERE s.id = 1), false) THEN
    RAISE EXCEPTION 'Vault maintenance in progress';
  END IF;
  SELECT * INTO u FROM public.video_unlocks WHERE id = p_unlock_id AND viewer_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unlock not found. Start the ad again'; END IF;
  IF u.completed_at IS NOT NULL THEN RAISE EXCEPTION 'This unlock was already used'; END IF;
  IF now() - u.started_at < interval '15 seconds' THEN RAISE EXCEPTION 'Ad not finished yet'; END IF;

  SELECT * INTO v FROM public.creator_videos WHERE id = u.video_id FOR UPDATE;
  IF NOT FOUND OR v.status <> 'approved' THEN RAISE EXCEPTION 'This video is not available'; END IF;
  IF v.creator_id = p_user THEN RAISE EXCEPTION 'You cannot watch or earn from your own video'; END IF;

  SELECT * INTO viewer FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF viewer.is_banned THEN RAISE EXCEPTION 'This account is suspended'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.video_views w WHERE w.video_id = v.id AND w.viewer_id = p_user
                   AND w.created_at > now() - interval '24 hours') INTO same_user;
  SELECT p_ip IS NOT NULL AND EXISTS (SELECT 1 FROM public.video_views w WHERE w.video_id = v.id AND w.ip_address = p_ip
                   AND w.created_at > now() - interval '24 hours') INTO same_ip;

  IF same_user OR same_ip THEN
    UPDATE public.video_unlocks SET completed_at = now(), outcome = 'repeat' WHERE id = u.id;
    INSERT INTO public.audit_logs (user_id, event, video_id, ip_address, detail)
    VALUES (p_user, 'repeat_reward_claim', v.id, p_ip,
            jsonb_build_object('same_account', same_user, 'same_ip', same_ip, 'video_title', v.title));
    RETURN jsonb_build_object('counted', false, 'viewer_reward', 0, 'creator_reward', 0,
                              'reason', CASE WHEN same_user THEN 'same_account' ELSE 'same_ip' END);
  END IF;

  IF v.format = 'short' THEN base_viewer := 0.30; base_creator := 0.35;
  ELSE base_viewer := 0.40; base_creator := 0.45; END IF;

  viewer_amt := least(base_viewer, greatest(0, 1500 - viewer.coin_balance));
  SELECT * INTO creator FROM public.profiles WHERE id = v.creator_id FOR UPDATE;
  IF FOUND AND NOT creator.is_banned THEN
    creator_amt := least(base_creator, greatest(0, 1500 - creator.coin_balance));
  END IF;

  UPDATE public.video_unlocks SET completed_at = now(), outcome = 'counted' WHERE id = u.id;
  INSERT INTO public.video_views (video_id, viewer_id, ip_address, viewer_reward, creator_reward)
  VALUES (v.id, p_user, p_ip, viewer_amt, creator_amt);
  UPDATE public.creator_videos SET view_count = view_count + 1 WHERE id = v.id;

  IF viewer_amt > 0 THEN
    PERFORM private.credit_coins(p_user, viewer_amt, 'video_view', 'Watched: ' || left(v.title, 80));
  END IF;
  IF creator_amt > 0 THEN
    PERFORM private.credit_coins(v.creator_id, creator_amt, 'video_creator', 'View on: ' || left(v.title, 80));
  END IF;

  RETURN jsonb_build_object('counted', true, 'viewer_reward', viewer_amt, 'creator_reward', creator_amt);
END;
$$;
REVOKE ALL ON FUNCTION public.complete_video_view(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_video_view(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.watched_video_ids(p_user uuid, p_ip text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT w.video_id FROM public.video_views w
   WHERE w.created_at > now() - interval '24 hours'
     AND (w.viewer_id = p_user OR (p_ip IS NOT NULL AND w.ip_address = p_ip));
$$;
REVOKE ALL ON FUNCTION public.watched_video_ids(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.watched_video_ids(uuid, text) TO service_role;

-- private.credit_coins is called by service-role functions too
GRANT USAGE ON SCHEMA private TO service_role;