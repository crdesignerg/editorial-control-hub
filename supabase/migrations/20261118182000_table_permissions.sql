-- Corrige ACL real: roles API tinham TRUNCATE/TRIGGER/REFERENCES/MAINTAIN
-- e não tinham CRUD. RLS não substitui GRANT e não protege TRUNCATE.
BEGIN;
REVOKE ALL ON TABLE public.profiles, public.clients, public.editorial_contents
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients, public.editorial_contents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.clients, public.editorial_contents TO service_role;
COMMIT;
