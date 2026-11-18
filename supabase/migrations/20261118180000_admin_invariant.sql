-- CANDIDATA: validar contra baseline real antes de implantação remota.
-- Não reescreve a migração anterior. Invariante não depende de JWT presente.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE auth.users, public.profiles IN SHARE ROW EXCLUSIVE MODE;

DO $$ BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Execute como postgres para preservar ownership das funções';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.profiles'::regclass AND confrelid='auth.users'::regclass
      AND contype='f' AND confdeltype='c') THEN
    RAISE EXCEPTION 'Baseline incompatível: profiles precisa da FK CASCADE para auth.users';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles) AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE access_level='admin' AND is_active
  ) THEN RAISE EXCEPTION 'Perfis existentes sem administrador ativo: resolver bootstrap antes da migração'; END IF;
END $$;

CREATE SCHEMA editorial_security AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA editorial_security FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE editorial_security.admin_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  active_count bigint NOT NULL CHECK (active_count >= 0),
  revision bigint NOT NULL DEFAULT 0
);
INSERT INTO editorial_security.admin_state(singleton, active_count)
SELECT true, count(*) FROM public.profiles WHERE access_level='admin' AND is_active;
REVOKE ALL ON editorial_security.admin_state FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE editorial_security.admin_state ENABLE ROW LEVEL SECURITY;

-- SET ROLE é controlado pelo PostgreSQL; claims JWT não escolhem esta allowlist.
-- Dentro de SECURITY DEFINER, current_user seria o owner e NÃO o chamador.
CREATE FUNCTION editorial_security.maintenance_caller() RETURNS boolean
LANGUAGE sql STABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT COALESCE(NULLIF(current_setting('role', true), 'none'), session_user::text)
    IN ('postgres', 'supabase_admin', 'service_role', 'supabase_auth_admin')
$$;

-- Uma escrita real na linha sentinela serializa mudanças. Sob RR/Serializable,
-- snapshot antigo provoca 40001 em vez de permitir write skew na contagem.
CREATE FUNCTION editorial_security.track_active_admins() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE delta integer := 0; remaining bigint;
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.access_level='admin' AND OLD.is_active THEN delta := delta-1; END IF;
  IF TG_OP <> 'DELETE' AND NEW.access_level='admin' AND NEW.is_active THEN delta := delta+1; END IF;
  UPDATE editorial_security.admin_state
     SET active_count=active_count+delta, revision=revision+1
   WHERE singleton AND (delta >= 0 OR active_count+delta >= 1)
   RETURNING active_count INTO remaining;
  IF NOT FOUND THEN
    IF TG_OP='DELETE' THEN
      RAISE EXCEPTION 'Operação negada: não é possível excluir o único administrador ativo do sistema.' USING ERRCODE='P0001';
    ELSE
      RAISE EXCEPTION 'Operação negada: não é possível remover ou desativar o único administrador ativo do sistema.' USING ERRCODE='P0001';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION editorial_security.serialize_profiles() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  UPDATE editorial_security.admin_state SET revision=revision+1 WHERE singleton;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estado administrativo ausente.'; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.protect_profile_privileges() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE caller uuid := auth.uid(); caller_admin boolean; caller_active boolean;
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Identidade do perfil é imutável.' USING ERRCODE='42501';
  END IF;
  IF editorial_security.maintenance_caller() THEN RETURN NEW; END IF;
  IF caller IS NULL THEN RAISE EXCEPTION 'Identidade autenticada obrigatória.' USING ERRCODE='42501'; END IF;
  SELECT p.is_active, p.is_active AND p.access_level='admin'
    INTO caller_active, caller_admin FROM public.profiles p WHERE p.id=caller;
  IF NOT COALESCE(caller_active,false) THEN
    RAISE EXCEPTION 'Usuário inativo ou inexistente.' USING ERRCODE='42501';
  END IF;
  IF NOT COALESCE(caller_admin,false) THEN
    IF caller <> OLD.id THEN RAISE EXCEPTION 'Edição de terceiros não permitida.' USING ERRCODE='42501'; END IF;
    IF NEW.access_level IS DISTINCT FROM OLD.access_level THEN
      RAISE EXCEPTION 'Operação negada: apenas administradores podem alterar o nível de acesso.' USING ERRCODE='P0001';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Operação negada: apenas administradores podem ativar ou desativar usuários.' USING ERRCODE='P0001';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Operação negada: alteração direta de e-mail no perfil não permitida.' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.protect_last_admin_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  -- A contagem será protegida pelo trigger AFTER na mesma transação.
  IF NOT editorial_security.maintenance_caller() AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_active AND access_level='admin'
  ) THEN RAISE EXCEPTION 'Exclusão de perfil requer administrador ativo.' USING ERRCODE='42501'; END IF;
  RETURN OLD;
END $$;

CREATE FUNCTION editorial_security.protect_auth_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE remaining bigint;
BEGIN
  UPDATE editorial_security.admin_state SET revision=revision+1 WHERE singleton
    RETURNING active_count INTO remaining;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estado administrativo ausente.'; END IF;
  IF remaining <= 1 AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id=OLD.id AND access_level='admin' AND is_active
  ) THEN RAISE EXCEPTION 'Operação negada: não é possível excluir o único administrador ativo do sistema.' USING ERRCODE='P0001'; END IF;
  RETURN OLD;
END $$;

CREATE FUNCTION editorial_security.reject_truncate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN RAISE EXCEPTION 'TRUNCATE bloqueado: preserve o administrador ativo.' USING ERRCODE='42501'; END $$;

-- AFTER: contabiliza apenas linhas efetivamente modificadas, inclusive UPSERT.
CREATE TRIGGER aaa_profiles_serialize BEFORE INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH STATEMENT EXECUTE FUNCTION editorial_security.serialize_profiles();
CREATE TRIGGER zzz_profiles_admin_state AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION editorial_security.track_active_admins();
DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();
DROP TRIGGER IF EXISTS trg_protect_last_admin_delete ON public.profiles;
CREATE TRIGGER trg_protect_last_admin_delete BEFORE DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_last_admin_delete();
CREATE TRIGGER trg_auth_last_admin BEFORE DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION editorial_security.protect_auth_delete();
CREATE TRIGGER trg_profiles_no_truncate BEFORE TRUNCATE ON public.profiles
FOR EACH STATEMENT EXECUTE FUNCTION editorial_security.reject_truncate();
CREATE TRIGGER trg_auth_no_truncate BEFORE TRUNCATE ON auth.users
FOR EACH STATEMENT EXECUTE FUNCTION editorial_security.reject_truncate();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA editorial_security FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.protect_profile_privileges(), public.protect_last_admin_delete()
FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
