-- Funções confirmadas por catálogo remoto READ ONLY em 18/11/2026.
BEGIN;
ALTER FUNCTION public.handle_new_auth_user() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.handle_updated_at() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.is_active_team_member() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.is_active_admin() SET search_path = pg_catalog, pg_temp;
REVOKE ALL ON FUNCTION public.handle_new_auth_user(), public.handle_updated_at()
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_active_team_member(), public.is_active_admin()
FROM PUBLIC, anon, authenticated, service_role;
-- Policies destinam-se a authenticated. anon não precisa executar helpers.
GRANT EXECUTE ON FUNCTION public.is_active_team_member(), public.is_active_admin() TO authenticated;
COMMIT;
