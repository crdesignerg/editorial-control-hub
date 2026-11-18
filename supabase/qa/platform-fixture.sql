-- SOMENTE QA portátil. Emula a fronteira Auth/PostgREST; NÃO é schema Supabase completo.
-- Nunca colocar este arquivo em migrations/ ou executá-lo no remoto.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE supabase_auth_admin NOLOGIN;
CREATE ROLE supabase_admin NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
GRANT USAGE ON SCHEMA public, auth, extensions TO anon, authenticated, service_role, supabase_auth_admin;
CREATE TABLE auth.users (
 id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}', aud text, role text
);
ALTER TABLE auth.users OWNER TO supabase_auth_admin;
GRANT ALL ON auth.users TO service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.sub',true),''),
   NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
CREATE EXTENSION pgtap WITH SCHEMA extensions;
