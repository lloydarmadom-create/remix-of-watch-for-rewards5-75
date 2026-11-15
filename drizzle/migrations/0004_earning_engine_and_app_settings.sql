-- 1. App settings (single row, public read so visitors can see maintenance mode)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text NOT NULL DEFAULT 'Vault maintenance in progress. Be right back!',
  testing_mode boolean NOT NULL DEFAULT false,
  aads_unit_id text NOT NULL DEFAULT '',
  sats_stock integer NOT NULL DEFAULT 1000,
  robux_stock integer NOT NULL DEFAULT 500,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_single_row CHECK (id = 1),
  CONSTRAINT app_settings_message_len CHECK (char_length(maintenance_message) BETWEEN 1 AND 280),
  CONSTRAINT app_settings_aads_unit_fmt CHECK (aads_unit_id ~ '^[0-9]{0,12}$'),
  CONSTRAINT app_settings_stock_nonneg CHECK (sats_stock >= 0 AND robux_stock >= 0)
);
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS maintenance_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS maintenance_message text NOT NULL DEFAULT 'Vault maintenance in progress. Be right back!';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS testing_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS aads_unit_id text NOT NULL DEFAULT '';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS sats_stock integer NOT NULL DEFAULT 1000;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS robux_stock integer NOT NULL DEFAULT 500;
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT UPDATE (maintenance_mode, maintenance_message, testing_mode, aads_unit_id, sats_stock, robux_stock) ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_settings_read ON public.app_settings;
CREATE POLICY app_settings_read ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS app_settings_admin_update ON public.app_settings;
CREATE POLICY app_settings_admin_update ON public.app_settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS app_settings_touch ON public.app_settings;
CREATE TRIGGER app_settings_touch BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.vault_settings IS 'DEPRECATED: earning rules now live in the earning functions; app-wide switches live in app_settings';

-- 2. Player progress columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lifetime_earned numeric NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ads_completed integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_check_in_at timestamptz;
UPDATE public.profiles SET lifetime_earned = coin_balance WHERE lifetime_earned = 0 AND coin_balance > 0;
UPDATE public.profiles p SET ads_completed = sub.n
  FROM (SELECT user_id, count(*)::int AS n FROM public.ad_sessions WHERE completed_at IS NOT NULL GROUP BY user_id) sub
 WHERE sub.user_id = p.id;
UPDATE public.profiles SET level = least(100, floor(lifetime_earned / 15))::int WHERE lifetime_earned > 0;

-- 3. Coin ledger
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  kind text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transactions_kind_valid CHECK (kind IN ('ad', 'streak', 'referral', 'redeem', 'adjustment'))
);
CREATE INDEX IF NOT EXISTS transactions_user_created_idx ON public.transactions (user_id, created_at DESC);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transactions_select_own ON public.transactions;
CREATE POLICY transactions_select_own ON public.transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- 4. Private helpers
CREATE OR REPLACE FUNCTION private.maintenance_blocks()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT s.maintenance_mode FROM public.app_settings s WHERE s.id = 1), false)
     AND NOT private.is_admin_account();
$$;
REVOKE EXECUTE ON FUNCTION private.maintenance_blocks() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.credit_coins(p_user uuid, p_amount numeric, p_kind text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.profiles
     SET coin_balance = coin_balance + p_amount,
         lifetime_earned = lifetime_earned + greatest(p_amount, 0),
         level = least(100, floor((lifetime_earned + greatest(p_amount, 0)) / 15))::int
   WHERE id = p_user;
  INSERT INTO public.transactions (user_id, amount, kind, note) VALUES (p_user, p_amount, p_kind, p_note);
END;
$$;
REVOKE EXECUTE ON FUNCTION private.credit_coins(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;

-- 5. Ads: +1 coin after 15 s, max 60 per rolling 11 hours, paused at 1,500 coins
CREATE OR REPLACE FUNCTION public.start_ad_view()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p public.profiles%ROWTYPE;
  recent integer;
  session_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF private.maintenance_blocks() THEN RAISE EXCEPTION 'Vault maintenance in progress'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF p.is_banned THEN RAISE EXCEPTION 'This account is suspended'; END IF;
  IF p.coin_balance >= 1500 THEN RAISE EXCEPTION 'Coin limit reached. Spend coins in the Store first'; END IF;

  SELECT count(*) INTO recent FROM public.ad_sessions
   WHERE user_id = auth.uid() AND completed_at > now() - interval '11 hours';
  IF recent >= 60 THEN RAISE EXCEPTION 'Ad limit reached. Try again when a slot frees up'; END IF;

  -- Only one ad can run at a time
  DELETE FROM public.ad_sessions WHERE user_id = auth.uid() AND completed_at IS NULL;
  INSERT INTO public.ad_sessions (user_id) VALUES (auth.uid()) RETURNING id INTO session_id;
  RETURN session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_ad_view(p_session_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.ad_sessions%ROWTYPE;
  p public.profiles%ROWTYPE;
  recent integer;
  new_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF private.maintenance_blocks() THEN RAISE EXCEPTION 'Vault maintenance in progress'; END IF;
  SELECT * INTO s FROM public.ad_sessions WHERE id = p_session_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ad session not found'; END IF;
  IF s.completed_at IS NOT NULL THEN RAISE EXCEPTION 'Ad already counted'; END IF;
  IF now() - s.started_at < interval '15 seconds' THEN RAISE EXCEPTION 'Ad not finished yet'; END IF;

  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF p.is_banned THEN RAISE EXCEPTION 'This account is suspended'; END IF;
  IF p.coin_balance >= 1500 THEN RAISE EXCEPTION 'Coin limit reached. Spend coins in the Store first'; END IF;
  SELECT count(*) INTO recent FROM public.ad_sessions
   WHERE user_id = auth.uid() AND completed_at > now() - interval '11 hours';
  IF recent >= 60 THEN RAISE EXCEPTION 'Ad limit reached. Try again when a slot frees up'; END IF;

  UPDATE public.ad_sessions SET completed_at = now(), coins_awarded = 1 WHERE id = s.id;
  UPDATE public.profiles SET ads_completed = ads_completed + 1 WHERE id = p.id
    RETURNING ads_completed INTO new_count;
  PERFORM private.credit_coins(p.id, 1, 'ad', 'Sponsored ad watched');

  -- Referrer earns +1 coin each time this friend reaches another 20 finished ads
  IF p.referred_by IS NOT NULL AND new_count % 20 = 0
     AND EXISTS (SELECT 1 FROM public.profiles r WHERE r.id = p.referred_by AND NOT r.is_banned) THEN
    PERFORM private.credit_coins(p.referred_by, 1, 'referral', 'Invited friend finished ' || new_count || ' ads');
  END IF;
  RETURN 1;
END;
$$;

-- 6. Daily check-in: 24 h between check-ins, reset after 48 h, day 3 and day 7 pay 5 coins
CREATE OR REPLACE FUNCTION public.claim_streak()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p public.profiles%ROWTYPE;
  new_streak integer;
  cycle_day integer;
  reward numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF private.maintenance_blocks() THEN RAISE EXCEPTION 'Vault maintenance in progress'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF p.is_banned THEN RAISE EXCEPTION 'This account is suspended'; END IF;
  IF p.last_check_in_at IS NOT NULL AND now() - p.last_check_in_at < interval '24 hours' THEN
    RAISE EXCEPTION 'Next check-in is not ready yet';
  END IF;

  IF p.last_check_in_at IS NULL OR now() - p.last_check_in_at > interval '48 hours' THEN
    new_streak := 1;
  ELSE
    new_streak := p.streak_count + 1;
  END IF;
  cycle_day := ((new_streak - 1) % 7) + 1;
  reward := CASE WHEN cycle_day IN (3, 7) THEN 5 ELSE 1 END;

  UPDATE public.profiles
     SET streak_count = new_streak,
         last_check_in_at = now(),
         last_streak_on = (now() AT TIME ZONE 'utc')::date
   WHERE id = p.id;
  PERFORM private.credit_coins(p.id, reward, 'streak', 'Daily check-in, day ' || new_streak);
  RETURN new_streak;
END;
$$;

-- 7. Earn status for the dashboard (ad window + invites)
CREATE OR REPLACE FUNCTION public.get_earn_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cnt integer;
  oldest timestamptz;
  invited integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT count(*), min(completed_at) INTO cnt, oldest FROM public.ad_sessions
   WHERE user_id = auth.uid() AND completed_at > now() - interval '11 hours';
  SELECT count(*) INTO invited FROM public.profiles WHERE referred_by = auth.uid();
  RETURN jsonb_build_object('ads_in_window', cnt, 'oldest_in_window', oldest, 'invited_count', invited);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_earn_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_earn_status() TO authenticated;