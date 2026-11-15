-- ===== Sign-up step on auth.users (dropped by remixes) =====
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== New columns =====
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS aads_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS adsterra_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS adsterra_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS monetag_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monetag_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bitmedia_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bitmedia_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS coinzilla_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coinzilla_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS custom_ad_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_ad_name text NOT NULL DEFAULT 'AdMaven',
  ADD COLUMN IF NOT EXISTS custom_ad_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS auto_pay_lightning boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lightning_provider text NOT NULL DEFAULT 'manual';
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_lightning_provider_check;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_lightning_provider_check
  CHECK (lightning_provider IN ('manual', 'zbd', 'blink', 'speed', 'alby'));

ALTER TABLE public.ad_sessions ADD COLUMN IF NOT EXISTS network text NOT NULL DEFAULT 'aads';
CREATE INDEX IF NOT EXISTS ad_sessions_user_network_idx ON public.ad_sessions (user_id, network, completed_at);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason text NOT NULL DEFAULT '';

ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS auto_pay_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS payment_ref text;

CREATE INDEX IF NOT EXISTS video_views_ip_idx ON public.video_views (ip_address, created_at);
CREATE INDEX IF NOT EXISTS video_views_viewer_idx ON public.video_views (viewer_id, created_at);

-- Anti-cheat results for each payout (admin only; players never see the bot's reasons)
CREATE TABLE IF NOT EXISTS public.payout_reviews (
  payout_id uuid PRIMARY KEY REFERENCES public.payout_requests(id) ON DELETE CASCADE,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  request_ip text,
  outcome text NOT NULL DEFAULT 'held',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payout_reviews TO authenticated;
GRANT ALL ON public.payout_reviews TO service_role;
ALTER TABLE public.payout_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payout_reviews_admin_read ON public.payout_reviews;
CREATE POLICY payout_reviews_admin_read ON public.payout_reviews FOR SELECT TO authenticated USING (public.is_admin());

-- ===== Tight table access (remix copies came with broad grants, incl. TRUNCATE) =====
REVOKE ALL ON public.ad_sessions, public.app_settings, public.audit_logs, public.contact_messages,
  public.creator_videos, public.payout_requests, public.profiles, public.roblox_change_requests,
  public.transactions, public.vault_settings, public.video_unlocks, public.video_views
  FROM anon, authenticated;
GRANT ALL ON public.ad_sessions, public.app_settings, public.audit_logs, public.contact_messages,
  public.creator_videos, public.payout_requests, public.profiles, public.roblox_change_requests,
  public.transactions, public.vault_settings, public.video_unlocks, public.video_views
  TO service_role;

-- App settings: everyone reads the switches and ad codes, never the vault stock.
REVOKE UPDATE (maintenance_mode, maintenance_message, testing_mode, aads_unit_id) ON public.app_settings FROM authenticated;
GRANT SELECT (id, maintenance_mode, maintenance_message, testing_mode, aads_unit_id, updated_at,
  aads_enabled, adsterra_enabled, adsterra_code, monetag_enabled, monetag_code, bitmedia_enabled, bitmedia_code,
  coinzilla_enabled, coinzilla_code, custom_ad_enabled, custom_ad_name, custom_ad_code,
  auto_pay_lightning, lightning_provider) ON public.app_settings TO anon, authenticated;
GRANT UPDATE (maintenance_mode, maintenance_message, testing_mode, aads_unit_id, updated_at,
  aads_enabled, adsterra_enabled, adsterra_code, monetag_enabled, monetag_code, bitmedia_enabled, bitmedia_code,
  coinzilla_enabled, coinzilla_code, custom_ad_enabled, custom_ad_name, custom_ad_code,
  auto_pay_lightning, lightning_provider) ON public.app_settings TO authenticated;

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT SELECT ON public.creator_videos TO authenticated;
GRANT SELECT ON public.payout_requests TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (creator_platform, creator_handle, youtube_handle, tiktok_handle) ON public.profiles TO authenticated;
GRANT SELECT ON public.roblox_change_requests TO authenticated;
GRANT SELECT ON public.transactions TO authenticated;
GRANT SELECT, UPDATE ON public.vault_settings TO authenticated;
GRANT SELECT ON public.video_unlocks TO authenticated;
GRANT SELECT ON public.video_views TO authenticated;

-- ===== Table triggers (also dropped by remixes) =====
DROP TRIGGER IF EXISTS profiles_lock_active ON public.profiles;
CREATE TRIGGER profiles_lock_active BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_active_profile();

DROP TRIGGER IF EXISTS creator_videos_touch ON public.creator_videos;
CREATE TRIGGER creator_videos_touch BEFORE UPDATE ON public.creator_videos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- A confirmed creator channel stays locked; only the admin can change it.
CREATE OR REPLACE FUNCTION public.lock_creator_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND OLD.creator_handle IS NOT NULL
     AND (NEW.creator_handle IS DISTINCT FROM OLD.creator_handle OR NEW.creator_platform IS DISTINCT FROM OLD.creator_platform)
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Your channel is locked to your profile. Contact support to change it.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.lock_creator_channel() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_lock_channel ON public.profiles;
CREATE TRIGGER profiles_lock_channel BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_creator_channel();

-- ===== Ad network rotation: up to 10 ads per network per 11 hours, A-ADS fills the rest =====
CREATE OR REPLACE FUNCTION private.ad_network_ready(s public.app_settings, n text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE n
    WHEN 'aads' THEN s.aads_enabled AND s.aads_unit_id ~ '^[0-9]{1,12}$'
    WHEN 'adsterra' THEN s.adsterra_enabled AND btrim(s.adsterra_code) <> ''
    WHEN 'monetag' THEN s.monetag_enabled AND btrim(s.monetag_code) <> ''
    WHEN 'bitmedia' THEN s.bitmedia_enabled AND btrim(s.bitmedia_code) <> ''
    WHEN 'coinzilla' THEN s.coinzilla_enabled AND btrim(s.coinzilla_code) <> ''
    WHEN 'custom' THEN s.custom_ad_enabled AND btrim(s.custom_ad_code) <> ''
    ELSE false END;
$$;

CREATE OR REPLACE FUNCTION private.pick_ad_network(p_user uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.app_settings%ROWTYPE;
  n text;
  used integer;
BEGIN
  SELECT * INTO s FROM public.app_settings WHERE id = 1;
  IF NOT FOUND THEN RETURN 'aads'; END IF;
  FOREACH n IN ARRAY ARRAY['aads', 'adsterra', 'monetag', 'bitmedia', 'coinzilla', 'custom'] LOOP
    IF private.ad_network_ready(s, n) THEN
      SELECT count(*) INTO used FROM public.ad_sessions
       WHERE user_id = p_user AND network = n AND completed_at > now() - interval '11 hours';
      IF used < 10 THEN RETURN n; END IF;
    END IF;
  END LOOP;
  RETURN 'aads';
END;
$$;

CREATE OR REPLACE FUNCTION public.start_ad_view_v2()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p public.profiles%ROWTYPE;
  recent integer;
  net text;
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

  net := private.pick_ad_network(auth.uid());
  DELETE FROM public.ad_sessions WHERE user_id = auth.uid() AND completed_at IS NULL;
  INSERT INTO public.ad_sessions (user_id, network) VALUES (auth.uid(), net) RETURNING id INTO session_id;
  RETURN jsonb_build_object('session_id', session_id, 'network', net);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.start_ad_view_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_ad_view_v2() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_earn_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cnt integer;
  oldest timestamptz;
  invited integer;
  counts jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT count(*), min(completed_at) INTO cnt, oldest FROM public.ad_sessions
   WHERE user_id = auth.uid() AND completed_at > now() - interval '11 hours';
  SELECT coalesce(jsonb_object_agg(network, c), '{}'::jsonb) INTO counts FROM (
    SELECT network, count(*) c FROM public.ad_sessions
     WHERE user_id = auth.uid() AND completed_at > now() - interval '11 hours' GROUP BY network) x;
  SELECT count(*) INTO invited FROM public.profiles WHERE referred_by = auth.uid();
  RETURN jsonb_build_object('ads_in_window', cnt, 'oldest_in_window', oldest, 'invited_count', invited,
    'network_counts', counts, 'next_network', private.pick_ad_network(auth.uid()));
END;
$$;

-- ===== Creator videos: strict account + network check, 24-hour unlocks =====
CREATE OR REPLACE FUNCTION public.complete_video_view(p_user uuid, p_unlock_id uuid, p_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
  IF v.creator_id = p_user THEN RAISE EXCEPTION 'Your own videos play free and earn 0 coins'; END IF;

  SELECT * INTO viewer FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF viewer.is_banned THEN RAISE EXCEPTION 'This account is suspended'; END IF;

  -- Both checks run before any coins move: this account, or anyone on this network, in the last 24 hours.
  SELECT EXISTS (SELECT 1 FROM public.video_views w WHERE w.video_id = v.id AND w.viewer_id = p_user
                   AND w.created_at > now() - interval '24 hours')
      OR EXISTS (SELECT 1 FROM public.video_unlocks x WHERE x.video_id = v.id AND x.viewer_id = p_user
                   AND x.id <> u.id AND x.completed_at > now() - interval '24 hours')
    INTO same_user;
  SELECT p_ip IS NOT NULL AND EXISTS (SELECT 1 FROM public.video_views w WHERE w.video_id = v.id AND w.ip_address = p_ip
                   AND w.created_at > now() - interval '24 hours') INTO same_ip;

  IF same_user OR same_ip THEN
    UPDATE public.video_unlocks SET completed_at = now(), outcome = 'repeat' WHERE id = u.id;
    INSERT INTO public.audit_logs (user_id, event, video_id, ip_address, detail)
    VALUES (p_user, 'SAME_IP_DUPLICATE_VIEW', v.id, p_ip,
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

CREATE OR REPLACE FUNCTION public.unlocked_videos(p_user uuid, p_ip text)
RETURNS TABLE (video_id uuid, unlocked_until timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT x.video_id, max(x.at) + interval '24 hours' FROM (
    SELECT w.video_id, w.created_at AS at FROM public.video_views w
     WHERE w.created_at > now() - interval '24 hours'
       AND (w.viewer_id = p_user OR (p_ip IS NOT NULL AND w.ip_address = p_ip))
    UNION ALL
    SELECT u.video_id, u.completed_at FROM public.video_unlocks u
     WHERE u.viewer_id = p_user AND u.completed_at > now() - interval '24 hours'
  ) x GROUP BY x.video_id;
$$;
REVOKE EXECUTE ON FUNCTION public.unlocked_videos(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlocked_videos(uuid, text) TO service_role;

-- ===== Admin tools =====
CREATE OR REPLACE FUNCTION public.admin_set_ban(p_user_id uuid, p_banned boolean, p_reason text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  reason text := left(btrim(coalesce(p_reason, '')), 500);
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_user_id = auth.uid() AND p_banned THEN RAISE EXCEPTION 'You cannot ban your own account'; END IF;
  UPDATE public.profiles SET is_banned = p_banned, ban_reason = CASE WHEN p_banned THEN reason ELSE '' END
   WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player not found'; END IF;
  INSERT INTO public.audit_logs (user_id, event, detail)
  VALUES (p_user_id, CASE WHEN p_banned THEN 'user_banned' ELSE 'user_unbanned' END,
          jsonb_build_object('by', auth.uid(), 'reason', reason));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_ban(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_ban(uuid, boolean, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_adjust_coins(p_user_id uuid, p_amount numeric, p_note text DEFAULT '')
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p public.profiles%ROWTYPE;
  amt numeric := round(coalesce(p_amount, 0), 2);
  note text := left(btrim(coalesce(p_note, '')), 200);
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF amt = 0 THEN RAISE EXCEPTION 'Enter an amount other than 0'; END IF;
  IF abs(amt) > 100000 THEN RAISE EXCEPTION 'Adjust at most 100,000 coins at a time'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player not found'; END IF;
  IF p.coin_balance + amt < 0 THEN
    RAISE EXCEPTION 'That would leave % coins. They only have %', (p.coin_balance + amt), p.coin_balance;
  END IF;
  PERFORM private.adjust_balance(p_user_id, amt, 'admin_adjust',
    CASE WHEN amt > 0 THEN 'Admin grant' ELSE 'Admin deduction' END || CASE WHEN note <> '' THEN ': ' || note ELSE '' END);
  INSERT INTO public.audit_logs (user_id, event, detail)
  VALUES (p_user_id, 'ADMIN_COIN_ADJUST', jsonb_build_object('by', auth.uid(), 'amount', amt, 'note', note,
          'balance_before', p.coin_balance, 'balance_after', p.coin_balance + amt));
  RETURN p.coin_balance + amt;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_coins(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_coins(uuid, numeric, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_get_stock()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN (SELECT jsonb_build_object('sats_stock', s.sats_stock, 'robux_stock', s.robux_stock)
            FROM public.app_settings s WHERE s.id = 1);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_stock() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_stock() TO authenticated, service_role;

-- ===== Pre-payout anti-cheat bot =====
CREATE OR REPLACE FUNCTION public.screen_payout(p_payout_id uuid, p_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.payout_requests%ROWTYPE;
  p public.profiles%ROWTYPE;
  ledger numeric;
  flags jsonb := '[]'::jsonb;
  n integer;
BEGIN
  SELECT * INTO r FROM public.payout_requests WHERE id = p_payout_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout not found'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = r.user_id;

  SELECT coalesce(sum(t.amount), 0) INTO ledger FROM public.transactions t WHERE t.user_id = r.user_id;
  IF abs(ledger - p.coin_balance) > 0.01 THEN
    flags := flags || jsonb_build_object('code', 'ledger_mismatch', 'label', 'Balance doesn''t match ledger',
      'detail', format('Balance %s coins, but the earnings ledger adds up to %s.', p.coin_balance, ledger));
  END IF;

  SELECT count(*) INTO n FROM public.audit_logs a
   WHERE a.user_id = r.user_id AND a.event IN ('SAME_IP_DUPLICATE_VIEW', 'repeat_reward_claim');
  IF n > 0 THEN
    flags := flags || jsonb_build_object('code', 'cheat_flags', 'label', 'Cheat / same-IP flags',
      'detail', format('%s duplicate or same-network view attempts on record.', n));
  END IF;

  SELECT count(DISTINCT x.uid) INTO n FROM (
    SELECT w.viewer_id AS uid FROM public.video_views w
     WHERE w.viewer_id <> r.user_id AND w.ip_address IS NOT NULL AND w.ip_address IN (
       SELECT DISTINCT w2.ip_address FROM public.video_views w2 WHERE w2.viewer_id = r.user_id AND w2.ip_address IS NOT NULL
       UNION SELECT p_ip WHERE p_ip IS NOT NULL)
    UNION
    SELECT pr.user_id FROM public.payout_reviews rv JOIN public.payout_requests pr ON pr.id = rv.payout_id
     WHERE pr.user_id <> r.user_id AND p_ip IS NOT NULL AND rv.request_ip = p_ip
  ) x;
  IF n > 0 THEN
    flags := flags || jsonb_build_object('code', 'shared_ip', 'label', 'Shared IP',
      'detail', format('%s other account(s) used the same network.', n));
  END IF;

  SELECT count(DISTINCT pr.user_id) INTO n FROM public.payout_requests pr
   WHERE pr.user_id <> r.user_id AND lower(pr.destination) = lower(r.destination);
  IF n > 0 THEN
    flags := flags || jsonb_build_object('code', 'shared_wallet', 'label', 'Shared Lightning wallet',
      'detail', format('%s other account(s) were paid to this same wallet.', n));
  END IF;

  SELECT count(*) INTO n FROM (
    SELECT s.completed_at - lag(s.completed_at) OVER (ORDER BY s.completed_at) AS gap
      FROM public.ad_sessions s WHERE s.user_id = r.user_id AND s.completed_at IS NOT NULL
  ) g WHERE g.gap < interval '15 seconds';
  IF n > 0 THEN
    flags := flags || jsonb_build_object('code', 'fast_ads', 'label', 'Unrealistic ad timing',
      'detail', format('%s ads finished less than 15 seconds apart.', n));
  END IF;

  SELECT count(*) INTO n FROM public.ad_sessions s
   WHERE s.user_id = r.user_id AND s.completed_at > now() - interval '24 hours';
  IF n > 131 THEN
    flags := flags || jsonb_build_object('code', 'too_many_ads', 'label', 'Too many ads',
      'detail', format('%s ads in the last 24 hours (limit allows about 131).', n));
  END IF;

  INSERT INTO public.payout_reviews (payout_id, flags, request_ip, outcome)
  VALUES (r.id, flags, p_ip, CASE WHEN jsonb_array_length(flags) = 0 THEN 'clean' ELSE 'held' END)
  ON CONFLICT (payout_id) DO UPDATE SET flags = EXCLUDED.flags, request_ip = EXCLUDED.request_ip, outcome = EXCLUDED.outcome;
  RETURN flags;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.screen_payout(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.screen_payout(uuid, text) TO service_role;

-- Claims the payout for sending so it can never be paid twice.
CREATE OR REPLACE FUNCTION public.begin_auto_pay(p_payout_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.payout_requests SET auto_pay_status = 'sending'
   WHERE id = p_payout_id AND status = 'pending' AND auto_pay_status = 'none';
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.begin_auto_pay(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_auto_pay(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_auto_pay(p_payout_id uuid, p_paid boolean, p_ref text, p_flags jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.payout_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.payout_requests WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN RETURN; END IF;
  IF p_paid THEN
    UPDATE public.payout_requests
       SET status = 'paid', auto_pay_status = 'paid', payment_ref = left(p_ref, 300),
           admin_note = 'Paid automatically', resolved_at = now()
     WHERE id = r.id;
    UPDATE public.payout_reviews SET outcome = 'auto_paid' WHERE payout_id = r.id;
    INSERT INTO public.audit_logs (user_id, event, detail)
    VALUES (r.user_id, 'PAYOUT_AUTO_PAID', jsonb_build_object('payout_id', r.id, 'reward', r.reward, 'ref', left(p_ref, 300)));
  ELSE
    UPDATE public.payout_requests SET auto_pay_status = 'held' WHERE id = r.id;
    INSERT INTO public.payout_reviews (payout_id, flags, outcome) VALUES (r.id, coalesce(p_flags, '[]'::jsonb), 'held')
    ON CONFLICT (payout_id) DO UPDATE SET flags = EXCLUDED.flags, outcome = 'held';
    INSERT INTO public.audit_logs (user_id, event, detail)
    VALUES (r.user_id, 'PAYOUT_HELD_FOR_REVIEW', jsonb_build_object('payout_id', r.id, 'reward', r.reward, 'flags', coalesce(p_flags, '[]'::jsonb)));
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.finish_auto_pay(uuid, boolean, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_auto_pay(uuid, boolean, text, jsonb) TO service_role;