-- Remixed databases lose the trigger on auth.users; restore it so every sign-up gets a profile.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for any accounts created while the trigger was missing.
SELECT private.create_profile_for(u.id, u.email, u.raw_user_meta_data ->> 'ref')
  FROM auth.users u
 WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- Video and audit tables are written only by security-definer functions.
REVOKE ALL ON public.audit_logs, public.creator_videos, public.video_unlocks, public.video_views FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs, public.creator_videos, public.video_unlocks, public.video_views FROM authenticated;
GRANT SELECT ON public.audit_logs, public.creator_videos, public.video_views TO authenticated;
GRANT ALL ON public.audit_logs, public.creator_videos, public.video_unlocks, public.video_views TO service_role;