CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_admin_account()
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
REVOKE EXECUTE ON FUNCTION private.is_admin_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin_account() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.is_admin_account();
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;