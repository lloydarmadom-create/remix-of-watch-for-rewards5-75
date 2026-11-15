-- 1. Player level
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_level_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_level_check CHECK (level >= 0);

-- 2. Hardened single-account admin check (email must match both the signed token and the real account row)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'lloydarmadom@gmail.com'
    AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND lower(u.email) = 'lloydarmadom@gmail.com'
    );
$$;

-- 3. Sign-up: guaranteed-unique referral code + referral link capture
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  ref_code text := upper(trim(coalesce(NEW.raw_user_meta_data ->> 'ref', '')));
  referrer uuid;
  new_code text;
BEGIN
  IF ref_code ~ '^[A-Z0-9]{4,16}$' THEN
    SELECT p.id INTO referrer FROM public.profiles p WHERE p.referral_code = ref_code;
  END IF;

  LOOP
    new_code := upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = new_code);
  END LOOP;

  INSERT INTO public.profiles (id, email, referral_code, referred_by)
  VALUES (NEW.id, coalesce(NEW.email, ''), new_code, referrer)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Backfill any account created before the profile trigger existed
INSERT INTO public.profiles (id, email, referral_code)
SELECT u.id, coalesce(u.email, ''), upper(substr(md5(u.id::text || clock_timestamp()::text), 1, 8))
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- 4. Profiles: players read their own row; they may only edit social handles. Balances, level, bans, referrals are server-only.
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (roblox_username, youtube_handle, tiktok_handle) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

DROP POLICY IF EXISTS admin_select_profiles ON public.profiles;
CREATE POLICY admin_select_profiles ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin());

-- Ad sessions are only touched through the secured functions
REVOKE ALL ON public.ad_sessions FROM anon, authenticated;
GRANT ALL ON public.ad_sessions TO service_role;

-- Vault settings: signed-in read, admin-only update (policies already exist)
REVOKE ALL ON public.vault_settings FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.vault_settings TO authenticated;
GRANT ALL ON public.vault_settings TO service_role;

-- 5. Support inbox
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_name text NOT NULL,
  reply_email text NOT NULL,
  category text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'unread',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_messages_sender_name_len CHECK (char_length(btrim(sender_name)) BETWEEN 1 AND 60),
  CONSTRAINT contact_messages_reply_email_fmt CHECK (char_length(reply_email) <= 255 AND reply_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  CONSTRAINT contact_messages_category_valid CHECK (category IN ('account', 'rewards', 'bug', 'privacy', 'other')),
  CONSTRAINT contact_messages_message_len CHECK (char_length(btrim(message)) BETWEEN 10 AND 2000),
  CONSTRAINT contact_messages_status_valid CHECK (status IN ('unread', 'read', 'resolved'))
);

GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY contact_messages_send ON public.contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'unread' AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY contact_messages_admin_read ON public.contact_messages
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY contact_messages_admin_update ON public.contact_messages
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY contact_messages_admin_delete ON public.contact_messages
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE INDEX contact_messages_created_at_idx ON public.contact_messages (created_at DESC);

-- 6. Function access
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_active_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_banned(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_streak() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.start_ad_view() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_ad_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_banned(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_streak() TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_ad_view() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ad_view(uuid) TO authenticated;