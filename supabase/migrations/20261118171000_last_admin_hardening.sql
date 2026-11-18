-- ============================================================================
-- MIGRAÇÃO: 20261118171000_last_admin_hardening.sql
-- PROJETO: Editorial Control Hub — OP Growth Digital
-- OBJETIVO: Proteger o último administrador ativo contra rebaixamento,
--           desativação (UPDATE), exclusão (DELETE) e condições de corrida.
-- PRÉ-REQUISITO: Migração inicial (tabelas public.profiles, public.clients,
--                public.editorial_contents e políticas RLS já aplicadas).
-- ============================================================================

BEGIN;

-- 1. Atualiza função de proteção em UPDATE com lock transacional anti-concorrência
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_is_admin BOOLEAN;
  v_remaining_active_admins INTEGER;
BEGIN
  -- Sessão administrativa direta via SQL Editor / Service Role (sem JWT de usuário)
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
      RAISE EXCEPTION 'Operação negada: apenas administradores podem alterar o nível de acesso.'
        USING ERRCODE = 'P0001';
    END IF;

    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Operação negada: apenas administradores podem ativar ou desativar usuários.'
        USING ERRCODE = 'P0001';
    END IF;

    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Operação negada: alteração direta de e-mail no perfil não permitida.'
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    -- Se o registro deixar de ser admin ativo (rebaixamento ou desativação)
    IF (OLD.access_level = 'admin' AND OLD.is_active = TRUE)
       AND (NEW.access_level <> 'admin' OR NEW.is_active = FALSE) THEN

      -- Serializa alterações de privilégio administrativo na transação atual
      PERFORM pg_advisory_xact_lock(hashtext('public.profiles.last_admin_guard'));

      SELECT count(*) INTO v_remaining_active_admins
      FROM public.profiles
      WHERE id <> OLD.id
        AND access_level = 'admin'
        AND is_active = TRUE;

      IF v_remaining_active_admins = 0 THEN
        RAISE EXCEPTION 'Operação negada: não é possível remover ou desativar o único administrador ativo do sistema.'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Função e trigger para impedir DELETE do último administrador ativo
CREATE OR REPLACE FUNCTION public.protect_last_admin_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining_active_admins INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN OLD;
  END IF;

  IF OLD.access_level = 'admin' AND OLD.is_active = TRUE THEN
    PERFORM pg_advisory_xact_lock(hashtext('public.profiles.last_admin_guard'));

    SELECT count(*) INTO v_remaining_active_admins
    FROM public.profiles
    WHERE id <> OLD.id
      AND access_level = 'admin'
      AND is_active = TRUE;

    IF v_remaining_active_admins = 0 THEN
      RAISE EXCEPTION 'Operação negada: não é possível excluir o único administrador ativo do sistema.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_last_admin_delete ON public.profiles;
CREATE TRIGGER trg_protect_last_admin_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_last_admin_delete();

COMMIT;
