-- Baseline LOCAL reconstruída de catálogos remotos READ ONLY em 18/11/2026.
-- Não enviar ao remoto já provisionado. Não inclui schemas gerenciados Auth/Storage.
-- Fonte: security-catalog + structure-catalog; PostgreSQL remoto 17.12.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
CREATE TYPE public."user_access_level" AS ENUM ('admin', 'member');
CREATE TYPE public."content_format_enum" AS ENUM ('Estático', 'Carrossel', 'Reels', 'Stories', 'Vídeo');
CREATE TYPE public."content_status_enum" AS ENUM ('Planejado', 'Em produção', 'Em revisão', 'Aguardando aprovação', 'Aprovado', 'Agendado', 'Publicado', 'Pendente');
CREATE TABLE public."profiles" (
  "id" uuid NOT NULL,
  "name" character varying(120) NOT NULL,
  "email" character varying(255) NOT NULL,
  "role" character varying(80) DEFAULT 'Social Media & Conteúdo'::character varying NOT NULL,
  "access_level" user_access_level DEFAULT 'member'::user_access_level NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."clients" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" character varying(150) NOT NULL,
  "segment" character varying(120) DEFAULT 'Marketing Digital'::character varying NOT NULL,
  "accent_color" character varying(32) DEFAULT 'rgb(37, 99, 235)'::character varying NOT NULL,
  "monthly_goal" integer DEFAULT 16 NOT NULL,
  "manager" character varying(120) DEFAULT 'Camila Rocha'::character varying NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public."editorial_contents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "title" character varying(255) NOT NULL,
  "date" date NOT NULL,
  "time" character varying(5) DEFAULT '12:00'::character varying NOT NULL,
  "format" content_format_enum DEFAULT 'Carrossel'::content_format_enum NOT NULL,
  "status" content_status_enum DEFAULT 'Planejado'::content_status_enum NOT NULL,
  "copy" text DEFAULT ''::text NOT NULL,
  "art_text" text DEFAULT ''::text NOT NULL,
  "briefing" text DEFAULT ''::text NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."clients" ADD CONSTRAINT "clients_monthly_goal_check" CHECK (((monthly_goal >= 1) AND (monthly_goal <= 500)));
ALTER TABLE public."clients" ADD CONSTRAINT "clients_name_check" CHECK ((char_length(TRIM(BOTH FROM name)) >= 1));
ALTER TABLE public."clients" ADD CONSTRAINT "clients_pkey" PRIMARY KEY (id);
ALTER TABLE public."editorial_contents" ADD CONSTRAINT "editorial_contents_pkey" PRIMARY KEY (id);
ALTER TABLE public."editorial_contents" ADD CONSTRAINT "editorial_contents_time_check" CHECK ((("time")::text ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text));
ALTER TABLE public."editorial_contents" ADD CONSTRAINT "editorial_contents_title_check" CHECK ((char_length(TRIM(BOTH FROM title)) >= 1));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_email_key" UNIQUE (email);
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_name_check" CHECK ((char_length(TRIM(BOTH FROM name)) >= 2));
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public."clients" ADD CONSTRAINT "clients_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."editorial_contents" ADD CONSTRAINT "editorial_contents_client_id_fkey" FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;
ALTER TABLE public."editorial_contents" ADD CONSTRAINT "editorial_contents_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."editorial_contents" ADD CONSTRAINT "editorial_contents_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_profiles_access_active ON public.profiles USING btree (access_level, is_active);
CREATE INDEX idx_clients_name ON public.clients USING btree (name);
CREATE INDEX idx_editorial_contents_date_time ON public.editorial_contents USING btree (date, "time");
CREATE INDEX idx_editorial_contents_client_date ON public.editorial_contents USING btree (client_id, date);
CREATE INDEX idx_editorial_contents_status_date ON public.editorial_contents USING btree (status, date);
CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name TEXT;
  v_role TEXT;
BEGIN
  v_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), ''),
    split_part(NEW.email, '@', 1)
  );

  v_role := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data ->> 'role'), ''),
    'Social Media & Conteúdo'
  );

  INSERT INTO public.profiles (id, name, email, role, access_level, is_active)
  VALUES (
    NEW.id,
    v_name,
    lower(trim(NEW.email)),
    v_role,
    'member',
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_is_admin BOOLEAN;
BEGIN
  -- Permite execuções administrativas diretas via SQL Editor / Service Role (auth.uid() IS NULL)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND access_level = 'admin'
      AND is_active = TRUE
  ) INTO v_caller_is_admin;

  IF NOT v_caller_is_admin THEN
    IF NEW.access_level IS DISTINCT FROM OLD.access_level THEN
      RAISE EXCEPTION 'Operação negada: apenas administradores podem alterar o nível de acesso.';
    END IF;

    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Operação negada: apenas administradores podem ativar ou desativar usuários.';
    END IF;

    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Operação negada: alteração direta de e-mail no perfil não permitida.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.is_active_team_member()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = TRUE
  );
$function$
;
CREATE OR REPLACE FUNCTION public.is_active_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND access_level = 'admin'
      AND is_active = TRUE
  );
$function$
;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_protect_profile_privileges BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION protect_profile_privileges();
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_editorial_contents_updated_at BEFORE UPDATE ON public.editorial_contents FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
ALTER TABLE public."clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."editorial_contents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_delete_admin_only" ON public."profiles" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_active_admin());
CREATE POLICY "profiles_update_own_or_admin" ON public."profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((is_active_admin() OR ((id = auth.uid()) AND is_active_team_member()))) WITH CHECK ((is_active_admin() OR ((id = auth.uid()) AND is_active_team_member() AND (access_level = 'member'::user_access_level))));
CREATE POLICY "profiles_select_active_team" ON public."profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_active_team_member());
CREATE POLICY "clients_delete_admin_only" ON public."clients" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_active_admin());
CREATE POLICY "clients_update_active_team" ON public."clients" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_active_team_member()) WITH CHECK (is_active_team_member());
CREATE POLICY "clients_insert_active_team" ON public."clients" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_active_team_member());
CREATE POLICY "clients_select_active_team" ON public."clients" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_active_team_member());
CREATE POLICY "contents_delete_active_team" ON public."editorial_contents" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_active_team_member());
CREATE POLICY "contents_update_active_team" ON public."editorial_contents" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_active_team_member()) WITH CHECK (is_active_team_member());
CREATE POLICY "contents_insert_active_team" ON public."editorial_contents" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_active_team_member());
CREATE POLICY "contents_select_active_team" ON public."editorial_contents" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_active_team_member());
REVOKE ALL ON public."profiles" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public."clients" FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public."editorial_contents" FROM PUBLIC, anon, authenticated, service_role;
GRANT INSERT ON public."profiles" TO "postgres" WITH GRANT OPTION;
GRANT SELECT ON public."profiles" TO "postgres" WITH GRANT OPTION;
GRANT UPDATE ON public."profiles" TO "postgres" WITH GRANT OPTION;
GRANT DELETE ON public."profiles" TO "postgres" WITH GRANT OPTION;
GRANT TRUNCATE ON public."profiles" TO "postgres" WITH GRANT OPTION;
GRANT REFERENCES ON public."profiles" TO "postgres" WITH GRANT OPTION;
GRANT TRIGGER ON public."profiles" TO "postgres" WITH GRANT OPTION;
GRANT TRUNCATE ON public."profiles" TO "anon";
GRANT REFERENCES ON public."profiles" TO "anon";
GRANT TRIGGER ON public."profiles" TO "anon";
GRANT TRUNCATE ON public."profiles" TO "authenticated";
GRANT REFERENCES ON public."profiles" TO "authenticated";
GRANT TRIGGER ON public."profiles" TO "authenticated";
GRANT TRUNCATE ON public."profiles" TO "service_role";
GRANT REFERENCES ON public."profiles" TO "service_role";
GRANT TRIGGER ON public."profiles" TO "service_role";
GRANT INSERT ON public."clients" TO "postgres" WITH GRANT OPTION;
GRANT SELECT ON public."clients" TO "postgres" WITH GRANT OPTION;
GRANT UPDATE ON public."clients" TO "postgres" WITH GRANT OPTION;
GRANT DELETE ON public."clients" TO "postgres" WITH GRANT OPTION;
GRANT TRUNCATE ON public."clients" TO "postgres" WITH GRANT OPTION;
GRANT REFERENCES ON public."clients" TO "postgres" WITH GRANT OPTION;
GRANT TRIGGER ON public."clients" TO "postgres" WITH GRANT OPTION;
GRANT TRUNCATE ON public."clients" TO "anon";
GRANT REFERENCES ON public."clients" TO "anon";
GRANT TRIGGER ON public."clients" TO "anon";
GRANT TRUNCATE ON public."clients" TO "authenticated";
GRANT REFERENCES ON public."clients" TO "authenticated";
GRANT TRIGGER ON public."clients" TO "authenticated";
GRANT TRUNCATE ON public."clients" TO "service_role";
GRANT REFERENCES ON public."clients" TO "service_role";
GRANT TRIGGER ON public."clients" TO "service_role";
GRANT INSERT ON public."editorial_contents" TO "postgres" WITH GRANT OPTION;
GRANT SELECT ON public."editorial_contents" TO "postgres" WITH GRANT OPTION;
GRANT UPDATE ON public."editorial_contents" TO "postgres" WITH GRANT OPTION;
GRANT DELETE ON public."editorial_contents" TO "postgres" WITH GRANT OPTION;
GRANT TRUNCATE ON public."editorial_contents" TO "postgres" WITH GRANT OPTION;
GRANT REFERENCES ON public."editorial_contents" TO "postgres" WITH GRANT OPTION;
GRANT TRIGGER ON public."editorial_contents" TO "postgres" WITH GRANT OPTION;
GRANT TRUNCATE ON public."editorial_contents" TO "anon";
GRANT REFERENCES ON public."editorial_contents" TO "anon";
GRANT TRIGGER ON public."editorial_contents" TO "anon";
GRANT TRUNCATE ON public."editorial_contents" TO "authenticated";
GRANT REFERENCES ON public."editorial_contents" TO "authenticated";
GRANT TRIGGER ON public."editorial_contents" TO "authenticated";
GRANT TRUNCATE ON public."editorial_contents" TO "service_role";
GRANT REFERENCES ON public."editorial_contents" TO "service_role";
GRANT TRIGGER ON public."editorial_contents" TO "service_role";
GRANT MAINTAIN ON public."clients" TO "postgres";
GRANT MAINTAIN ON public."clients" TO "anon";
GRANT MAINTAIN ON public."clients" TO "authenticated";
GRANT MAINTAIN ON public."clients" TO "service_role";
GRANT MAINTAIN ON public."editorial_contents" TO "postgres";
GRANT MAINTAIN ON public."editorial_contents" TO "anon";
GRANT MAINTAIN ON public."editorial_contents" TO "authenticated";
GRANT MAINTAIN ON public."editorial_contents" TO "service_role";
GRANT MAINTAIN ON public."profiles" TO "postgres";
GRANT MAINTAIN ON public."profiles" TO "anon";
GRANT MAINTAIN ON public."profiles" TO "authenticated";
GRANT MAINTAIN ON public."profiles" TO "service_role";
COMMIT;
