REVOKE ALL ON public.transactions FROM anon;
REVOKE ALL ON public.app_settings FROM anon;
GRANT SELECT ON public.app_settings TO anon;
REVOKE INSERT, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.app_settings FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.transactions FROM authenticated;