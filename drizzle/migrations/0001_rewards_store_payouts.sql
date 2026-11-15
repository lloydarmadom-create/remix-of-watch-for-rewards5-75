-- Remixed databases lose triggers on auth.users; keep the sign-up profile trigger in place.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Roblox identity (verified on the server, locked to the profile).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS roblox_user_id bigint,
  ADD COLUMN IF NOT EXISTS roblox_display_name text,
  ADD COLUMN IF NOT EXISTS roblox_avatar_url text,
  ADD COLUMN IF NOT EXISTS roblox_verified_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_roblox_user_id_key
  ON public.profiles (roblox_user_id) WHERE roblox_user_id IS NOT NULL;
REVOKE UPDATE (roblox_username) ON public.profiles FROM authenticated;

-- Vault stock changes only through redeem / refund / admin stock functions.
REVOKE UPDATE (sats_stock, robux_stock) ON public.app_settings FROM authenticated;

-- Ledger gains refunds.
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_kind_valid;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_kind_valid
  CHECK (kind = ANY (ARRAY['ad','streak','referral','redeem','refund','adjustment','video_view','video_creator']));

CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward text NOT NULL CHECK (reward IN ('sats_20', 'robux_5', 'robux_10')),
  category text NOT NULL CHECK (category IN ('sats', 'robux')),
  coins_cost numeric NOT NULL CHECK (coins_cost > 0),
  stock_cost integer NOT NULL CHECK (stock_cost > 0),
  payout_amount integer NOT NULL CHECK (payout_amount > 0),
  destination text NOT NULL CHECK (char_length(destination) BETWEEN 1 AND 2000),
  roblox_user_id bigint,
  roblox_username text,
  gamepass_id bigint,
  gamepass_name text,
  gamepass_price integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  admin_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX payout_requests_user_idx ON public.payout_requests (user_id, category, created_at DESC);
CREATE INDEX payout_requests_status_idx ON public.payout_requests (status, created_at);
GRANT SELECT ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY payout_requests_read ON public.payout_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE TABLE public.roblox_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_username text,
  old_user_id bigint,
  new_username text NOT NULL,
  new_user_id bigint NOT NULL,
  new_display_name text,
  new_avatar_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE UNIQUE INDEX roblox_change_requests_one_pending
  ON public.roblox_change_requests (user_id) WHERE status = 'pending';
GRANT SELECT ON public.roblox_change_requests TO authenticated;
GRANT ALL ON public.roblox_change_requests TO service_role;
ALTER TABLE public.roblox_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY roblox_change_requests_read ON public.roblox_change_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- Balance change that is not an earning (redeem, refund): lifetime earnings and level stay put.
CREATE OR REPLACE FUNCTION private.adjust_balance(p_user uuid, p_amount numeric, p_kind text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  UPDATE public.profiles SET coin_balance = coin_balance + p_amount WHERE id = p_user;
  INSERT INTO public.transactions (user_id, amount, kind, note) VALUES (p_user, p_amount, p_kind, p_note);
END;
$$;
REVOKE ALL ON FUNCTION private.adjust_balance(uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.short_wait(p_remaining interval)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT CASE
    WHEN extract(epoch FROM p_remaining) >= 86400
      THEN floor(extract(epoch FROM p_remaining) / 86400)::int || 'd ' || floor(mod(extract(epoch FROM p_remaining)::numeric, 86400) / 3600)::int || 'h'
    ELSE floor(extract(epoch FROM p_remaining) / 3600)::int || 'h ' || greatest(1, ceil(mod(extract(epoch FROM p_remaining)::numeric, 3600) / 60))::int || 'm'
  END;
$$;

-- Called by the server after it verified the Roblox account with Roblox's public API.
CREATE OR REPLACE FUNCTION public.lock_roblox_identity(
  p_user uuid, p_username text, p_roblox_id bigint, p_display text, p_avatar text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  p public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF p.is_banned THEN RAISE EXCEPTION 'This account is suspended'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE roblox_user_id = p_roblox_id AND id <> p_user) THEN
    RAISE EXCEPTION 'That Roblox account is already linked to another player';
  END IF;

  IF p.roblox_user_id IS NULL THEN
    UPDATE public.profiles
       SET roblox_username = p_username, roblox_user_id = p_roblox_id, roblox_display_name = p_display,
           roblox_avatar_url = p_avatar, roblox_verified_at = now()
     WHERE id = p_user;
    INSERT INTO public.audit_logs (user_id, event, detail)
    VALUES (p_user, 'roblox_locked', jsonb_build_object('username', p_username, 'roblox_id', p_roblox_id));
    RETURN 'locked';
  ELSIF p.roblox_user_id = p_roblox_id THEN
    -- Same Roblox account (maybe renamed on Roblox): refresh the details.
    UPDATE public.profiles
       SET roblox_username = p_username, roblox_display_name = p_display, roblox_avatar_url = p_avatar,
           roblox_verified_at = now()
     WHERE id = p_user;
    RETURN 'unchanged';
  END IF;

  UPDATE public.roblox_change_requests
     SET new_username = p_username, new_user_id = p_roblox_id, new_display_name = p_display,
         new_avatar_url = p_avatar, created_at = now()
   WHERE user_id = p_user AND status = 'pending';
  IF NOT FOUND THEN
    INSERT INTO public.roblox_change_requests
      (user_id, old_username, old_user_id, new_username, new_user_id, new_display_name, new_avatar_url)
    VALUES (p_user, p.roblox_username, p.roblox_user_id, p_username, p_roblox_id, p_display, p_avatar);
  END IF;
  INSERT INTO public.audit_logs (user_id, event, detail)
  VALUES (p_user, 'roblox_change_requested',
          jsonb_build_object('from', p.roblox_username, 'to', p_username, 'roblox_id', p_roblox_id));
  RETURN 'change_requested';
END;
$$;

-- Called by the server after it validated the destination (and, for Robux, verified the Gamepass live).
CREATE OR REPLACE FUNCTION public.redeem_reward(
  p_user uuid, p_reward text, p_destination text,
  p_roblox_user_id bigint DEFAULT NULL, p_gamepass_id bigint DEFAULT NULL,
  p_gamepass_name text DEFAULT NULL, p_gamepass_price integer DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  s public.app_settings%ROWTYPE;
  p public.profiles%ROWTYPE;
  cat text; cost numeric; stock int; amount int; wait interval; label text;
  last_at timestamptz;
  new_id uuid;
BEGIN
  CASE p_reward
    WHEN 'sats_20' THEN cat := 'sats'; cost := 120; stock := 20; amount := 20; wait := interval '24 hours'; label := '20 Sats (Lightning)';
    WHEN 'robux_5' THEN cat := 'robux'; cost := 500; stock := 7; amount := 5; wait := interval '7 days'; label := '5 Robux';
    WHEN 'robux_10' THEN cat := 'robux'; cost := 1000; stock := 15; amount := 10; wait := interval '7 days'; label := '10 Robux';
    ELSE RAISE EXCEPTION 'Unknown reward';
  END CASE;

  SELECT * INTO s FROM public.app_settings WHERE id = 1 FOR UPDATE;
  IF coalesce(s.maintenance_mode, false) THEN RAISE EXCEPTION 'Vault maintenance in progress'; END IF;

  SELECT * INTO p FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF p.is_banned THEN RAISE EXCEPTION 'This account is suspended'; END IF;

  IF NOT coalesce(s.testing_mode, false) THEN
    SELECT max(created_at) INTO last_at FROM public.payout_requests
     WHERE user_id = p_user AND category = cat AND status <> 'rejected';
    IF last_at IS NOT NULL AND now() - last_at < wait THEN
      RAISE EXCEPTION 'Your % cooldown ends in %', CASE cat WHEN 'sats' THEN 'Sats' ELSE 'Robux' END,
        private.short_wait(wait - (now() - last_at));
    END IF;
  END IF;

  IF p.coin_balance < cost THEN
    RAISE EXCEPTION 'Not enough coins: % needs % coins', label, cost::int;
  END IF;

  IF cat = 'sats' THEN
    IF s.sats_stock < stock THEN RAISE EXCEPTION 'Sats are out of stock right now. Check back soon'; END IF;
    UPDATE public.app_settings SET sats_stock = sats_stock - stock, updated_at = now() WHERE id = 1;
  ELSE
    IF p.roblox_user_id IS NULL OR p.roblox_user_id <> p_roblox_user_id THEN
      RAISE EXCEPTION 'Verify your Roblox username first';
    END IF;
    IF p_gamepass_id IS NULL OR p_gamepass_price IS DISTINCT FROM stock THEN
      RAISE EXCEPTION 'The Gamepass must be for sale at exactly % Robux', stock;
    END IF;
    IF s.robux_stock < stock THEN RAISE EXCEPTION 'Robux are out of stock right now. Check back soon'; END IF;
    UPDATE public.app_settings SET robux_stock = robux_stock - stock, updated_at = now() WHERE id = 1;
  END IF;

  PERFORM private.adjust_balance(p_user, -cost, 'redeem', 'Redeemed ' || label);

  INSERT INTO public.payout_requests (
    user_id, reward, category, coins_cost, stock_cost, payout_amount, destination,
    roblox_user_id, roblox_username, gamepass_id, gamepass_name, gamepass_price
  ) VALUES (
    p_user, p_reward, cat, cost, stock, amount, left(p_destination, 2000),
    CASE WHEN cat = 'robux' THEN p.roblox_user_id END,
    CASE WHEN cat = 'robux' THEN p.roblox_username END,
    p_gamepass_id, left(p_gamepass_name, 120), p_gamepass_price
  ) RETURNING id INTO new_id;

  INSERT INTO public.audit_logs (user_id, event, detail)
  VALUES (p_user, 'payout_requested', jsonb_build_object('payout_id', new_id, 'reward', p_reward, 'coins', cost));
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_payout(p_id uuid, p_decision text, p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  r public.payout_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_decision NOT IN ('paid', 'rejected') THEN RAISE EXCEPTION 'Unknown decision'; END IF;
  SELECT * INTO r FROM public.payout_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'This payout was already %', r.status; END IF;

  UPDATE public.payout_requests
     SET status = p_decision, admin_note = left(coalesce(p_note, ''), 280), resolved_at = now()
   WHERE id = p_id;

  IF p_decision = 'rejected' THEN
    PERFORM private.adjust_balance(r.user_id, r.coins_cost, 'refund',
      'Refund: ' || CASE r.reward WHEN 'sats_20' THEN '20 Sats' WHEN 'robux_5' THEN '5 Robux' ELSE '10 Robux' END);
    IF r.category = 'sats' THEN
      UPDATE public.app_settings SET sats_stock = sats_stock + r.stock_cost, updated_at = now() WHERE id = 1;
    ELSE
      UPDATE public.app_settings SET robux_stock = robux_stock + r.stock_cost, updated_at = now() WHERE id = 1;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (user_id, event, detail)
  VALUES (r.user_id, 'payout_' || p_decision, jsonb_build_object('payout_id', p_id, 'reward', r.reward, 'by', auth.uid()));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_roblox_change(p_id uuid, p_decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  r public.roblox_change_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Unknown decision'; END IF;
  SELECT * INTO r FROM public.roblox_change_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'This request was already %', r.status; END IF;

  IF p_decision = 'approved' THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE roblox_user_id = r.new_user_id AND id <> r.user_id) THEN
      RAISE EXCEPTION 'That Roblox account is already linked to another player';
    END IF;
    UPDATE public.profiles
       SET roblox_username = r.new_username, roblox_user_id = r.new_user_id,
           roblox_display_name = r.new_display_name, roblox_avatar_url = r.new_avatar_url,
           roblox_verified_at = now()
     WHERE id = r.user_id;
  END IF;

  UPDATE public.roblox_change_requests SET status = p_decision, resolved_at = now() WHERE id = p_id;
  INSERT INTO public.audit_logs (user_id, event, detail)
  VALUES (r.user_id, 'roblox_change_' || p_decision,
          jsonb_build_object('from', r.old_username, 'to', r.new_username, 'by', auth.uid()));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_stock(p_sats_delta integer, p_robux_delta integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.app_settings
     SET sats_stock = greatest(0, sats_stock + coalesce(p_sats_delta, 0)),
         robux_stock = greatest(0, robux_stock + coalesce(p_robux_delta, 0)),
         updated_at = now()
   WHERE id = 1;
  INSERT INTO public.audit_logs (user_id, event, detail)
  VALUES (auth.uid(), 'stock_adjusted', jsonb_build_object('sats', p_sats_delta, 'robux', p_robux_delta));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_banned(p_user_id uuid, p_banned boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot ban your own account'; END IF;
  UPDATE public.profiles SET is_banned = p_banned WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player not found'; END IF;
  INSERT INTO public.audit_logs (user_id, event, detail)
  VALUES (p_user_id, CASE WHEN p_banned THEN 'user_banned' ELSE 'user_unbanned' END, jsonb_build_object('by', auth.uid()));
END;
$$;

REVOKE ALL ON FUNCTION public.lock_roblox_identity(uuid, text, bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_reward(uuid, text, text, bigint, bigint, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_roblox_identity(uuid, text, bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, text, text, bigint, bigint, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.admin_resolve_payout(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_review_roblox_change(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_adjust_stock(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_banned(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_payout(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_review_roblox_change(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_adjust_stock(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_banned(uuid, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.short_wait(interval) FROM PUBLIC, anon, authenticated;