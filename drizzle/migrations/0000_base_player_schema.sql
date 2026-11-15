-- Base schema for Watch For Rewards (idempotent)

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  referral_code text NOT NULL UNIQUE,
  referred_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  coin_balance numeric NOT NULL DEFAULT 0 CHECK (coin_balance >= 0),
  is_banned boolean NOT NULL DEFAULT false,
  streak_count integer NOT NULL DEFAULT 0 CHECK (streak_count >= 0),
  last_streak_on date NULL,
  roblox_username text NULL CHECK (roblox_username IS NULL OR char_length(roblox_username) <= 40),
  youtube_handle text NULL CHECK (youtube_handle IS NULL OR char_length(youtube_handle) <= 60),
  tiktok_handle text NULL CHECK (tiktok_handle IS NULL OR char_length(tiktok_handle) <= 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (roblox_username, youtube_handle, tiktok_handle) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Admin check placeholder (replaced by later migrations)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND lower(u.email) = 'lloydarmadom@gmail.com'
    );
$$;

-- Banned players cannot edit their profile; keep updated_at fresh
CREATE OR REPLACE FUNCTION public.lock_active_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.id AND OLD.is_banned THEN
    RAISE EXCEPTION 'This account is suspended';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_lock_active ON public.profiles;
CREATE TRIGGER profiles_lock_active
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_active_profile();

-- Sign-up profile creation (body replaced by later migration)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, referral_code)
  VALUES (NEW.id, coalesce(NEW.email, ''), upper(substr(md5(gen_random_uuid()::text), 1, 8)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Reward settings (single row)
CREATE TABLE IF NOT EXISTS public.vault_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  coins_per_ad numeric NOT NULL DEFAULT 5 CHECK (coins_per_ad >= 0),
  ad_min_seconds integer NOT NULL DEFAULT 30 CHECK (ad_min_seconds >= 5),
  daily_ad_limit integer NOT NULL DEFAULT 20 CHECK (daily_ad_limit >= 0),
  streak_coins numeric NOT NULL DEFAULT 10 CHECK (streak_coins >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.vault_settings TO authenticated;
GRANT ALL ON public.vault_settings TO service_role;

ALTER TABLE public.vault_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vault_settings_read ON public.vault_settings;
CREATE POLICY vault_settings_read ON public.vault_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS vault_settings_admin_update ON public.vault_settings;
CREATE POLICY vault_settings_admin_update ON public.vault_settings
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.vault_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Video watch sessions (only touched via secured functions)
CREATE TABLE IF NOT EXISTS public.ad_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  coins_awarded numeric NOT NULL DEFAULT 0
);

GRANT ALL ON public.ad_sessions TO service_role;

ALTER TABLE public.ad_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ad_sessions_user_started_idx ON public.ad_sessions (user_id, started_at DESC);

-- Daily streak claim: once per UTC day
CREATE OR REPLACE FUNCTION public.claim_streak()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  p public.profiles%ROWTYPE;
  today date := (now() AT TIME ZONE 'utc')::date;
  reward numeric;
  new_streak integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF p.is_banned THEN RAISE EXCEPTION 'This account is suspended'; END IF;
  IF p.last_streak_on = today THEN RAISE EXCEPTION 'Already claimed today'; END IF;

  new_streak := CASE WHEN p.last_streak_on = today - 1 THEN p.streak_count + 1 ELSE 1 END;
  SELECT streak_coins INTO reward FROM public.vault_settings WHERE id = 1;

  UPDATE public.profiles
     SET streak_count = new_streak,
         last_streak_on = today,
         coin_balance = coin_balance + coalesce(reward, 0)
   WHERE id = p.id;
  RETURN new_streak;
END;
$$;

-- Start a video watch
CREATE OR REPLACE FUNCTION public.start_ad_view()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  banned boolean;
  limit_per_day integer;
  done_today integer;
  session_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT is_banned INTO banned FROM public.profiles WHERE id = auth.uid();
  IF banned IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF banned THEN RAISE EXCEPTION 'This account is suspended'; END IF;

  SELECT daily_ad_limit INTO limit_per_day FROM public.vault_settings WHERE id = 1;
  SELECT count(*) INTO done_today FROM public.ad_sessions
   WHERE user_id = auth.uid() AND completed_at IS NOT NULL
     AND completed_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc';
  IF done_today >= coalesce(limit_per_day, 0) THEN RAISE EXCEPTION 'Daily video limit reached'; END IF;

  INSERT INTO public.ad_sessions (user_id) VALUES (auth.uid()) RETURNING id INTO session_id;
  RETURN session_id;
END;
$$;

-- Finish a video watch and award coins
CREATE OR REPLACE FUNCTION public.complete_ad_view(p_session_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  s public.ad_sessions%ROWTYPE;
  cfg public.vault_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO s FROM public.ad_sessions WHERE id = p_session_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF s.completed_at IS NOT NULL THEN RAISE EXCEPTION 'Session already completed'; END IF;

  SELECT * INTO cfg FROM public.vault_settings WHERE id = 1;
  IF now() - s.started_at < make_interval(secs => cfg.ad_min_seconds) THEN
    RAISE EXCEPTION 'Video not finished yet';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_banned) THEN
    RAISE EXCEPTION 'This account is suspended';
  END IF;

  UPDATE public.ad_sessions SET completed_at = now(), coins_awarded = cfg.coins_per_ad WHERE id = s.id;
  UPDATE public.profiles SET coin_balance = coin_balance + cfg.coins_per_ad WHERE id = auth.uid();
  RETURN cfg.coins_per_ad;
END;
$$;

-- Admin: list players
CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN QUERY SELECT * FROM public.profiles ORDER BY created_at DESC;
END;
$$;

-- Admin: ban / unban a player
CREATE OR REPLACE FUNCTION public.admin_set_banned(p_user_id uuid, p_banned boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.profiles SET is_banned = p_banned WHERE id = p_user_id;
END;
$$;
