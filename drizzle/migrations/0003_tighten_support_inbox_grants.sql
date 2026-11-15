REVOKE ALL ON public.contact_messages FROM anon;
GRANT INSERT ON public.contact_messages TO anon;
REVOKE ALL ON public.contact_messages FROM authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;