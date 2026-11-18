-- ============================================================================
-- SUÍTE DE AUDITORIA RLS (pgTAP) — Editorial Control Hub
-- Arquivo: supabase/tests/rls_security_audit.test.sql
-- Execução: supabase.cmd test db --local (somente banco local descartável)
-- Cobertura sequencial; não comprova concorrência nem toda a matriz CRUD.
-- ============================================================================

BEGIN;

SET LOCAL search_path = public, extensions;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

-- Não desativar administradores preexistentes para preparar fixtures.
-- Esta checagem não identifica o host: --local continua obrigatório.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users)
     OR EXISTS (SELECT 1 FROM public.profiles)
     OR EXISTS (SELECT 1 FROM public.clients)
     OR EXISTS (SELECT 1 FROM public.editorial_contents) THEN
    RAISE EXCEPTION 'Auditoria exige banco local descartável sem dados preexistentes.';
  END IF;
END;
$$;

SELECT plan(26);

-- ============================================================================
-- HELPERS TEMPORÁRIOS: SIMULAÇÃO FIEL DE SESSÃO SUPABASE AUTH (auth.uid())
-- ============================================================================
CREATE OR REPLACE FUNCTION pg_temp.simulate_authenticated_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );

  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Falha na simulação JWT: auth.uid() retornou %, esperado %', auth.uid(), p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.simulate_anon_user()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);

  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Falha na simulação Anon: auth.uid() deveria ser NULL, retornou %', auth.uid();
  END IF;
END;
$$;

-- ============================================================================
-- 1. VERIFICAÇÃO DE RLS E ESTRUTURA DAS TABELAS
-- ============================================================================
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass),
  'Teste 01: RLS habilitado em public.profiles'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.clients'::regclass),
  'Teste 02: RLS habilitado em public.clients'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.editorial_contents'::regclass),
  'Teste 03: RLS habilitado em public.editorial_contents'
);

-- ============================================================================
-- 2. FIXTURES ISOLADAS (SOFREM ROLLBACK AO FINAL)
-- ============================================================================
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'audit_admin_1@opgrowth.test',
    '{"name":"Admin Audit 1","role":"Head de Conteúdo","access_level":"admin"}',
    'authenticated',
    'authenticated'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'audit_member@opgrowth.test',
    '{"name":"Colaborador Audit","role":"Redator / Copywriter"}',
    'authenticated',
    'authenticated'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'audit_inactive@opgrowth.test',
    '{"name":"Inativo Audit","role":"Designer / Diretor de Arte"}',
    'authenticated',
    'authenticated'
  );

-- Teste 04: Trigger on_auth_user_created ignora injeção de access_level='admin'
SELECT is(
  (SELECT access_level::text FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'),
  'member',
  'Teste 04: Trigger on_auth_user_created força access_level = member mesmo se metadata enviar admin'
);

-- Configura papéis da fixture como superuser/postgres
UPDATE public.profiles SET access_level = 'admin' WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE public.profiles SET is_active = FALSE WHERE id = '33333333-3333-3333-3333-333333333333';

INSERT INTO public.clients (id, name, segment, accent_color, monthly_goal, manager, created_by)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Cliente Teste RLS',
  'SaaS B2B',
  'rgb(37, 99, 235)',
  16,
  'Admin Audit 1',
  '11111111-1111-1111-1111-111111111111'
);

INSERT INTO public.editorial_contents (
  id, client_id, title, date, time, format, status, copy, art_text, briefing, created_by
)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Pauta Teste RLS',
  CURRENT_DATE,
  '10:00',
  'Carrossel',
  'Planejado',
  'Copy inicial',
  'Arte inicial',
  'Briefing inicial',
  '11111111-1111-1111-1111-111111111111'
);

-- ============================================================================
-- 3. CENÁRIO A: VISITANTE NÃO AUTENTICADO (anon)
-- ============================================================================
SELECT pg_temp.simulate_anon_user();

SELECT throws_ok('SELECT id FROM public.profiles', '42501', NULL, 'Teste 05: Anon sem GRANT SELECT profiles');
SELECT throws_ok('SELECT id FROM public.clients', '42501', NULL, 'Teste 06: Anon sem GRANT SELECT clients');
SELECT throws_ok('SELECT id FROM public.editorial_contents', '42501', NULL, 'Teste 07: Anon sem GRANT SELECT editorial_contents');
SELECT throws_ok(
  $$INSERT INTO public.clients (name) VALUES ('Invasor Anon')$$,
  '42501',
  NULL,
  'Teste 08: Anon bloqueado em INSERT clients (SQLSTATE 42501)'
);

-- ============================================================================
-- 4. CENÁRIO B: USUÁRIO INATIVO (is_active = FALSE)
-- ============================================================================
RESET ROLE;
SELECT pg_temp.simulate_authenticated_user('33333333-3333-3333-3333-333333333333');

SELECT is_empty('SELECT id FROM public.profiles', 'Teste 09: Inativo bloqueado em SELECT profiles');
SELECT is_empty('SELECT id FROM public.clients', 'Teste 10: Inativo bloqueado em SELECT clients');
SELECT is_empty('SELECT id FROM public.editorial_contents', 'Teste 11: Inativo bloqueado em SELECT editorial_contents');
SELECT throws_ok(
  $$INSERT INTO public.editorial_contents (client_id, title, date) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Post Inativo', CURRENT_DATE)$$,
  '42501',
  'new row violates row-level security policy for table "editorial_contents"',
  'Teste 12: Inativo bloqueado em INSERT editorial_contents (SQLSTATE 42501)'
);

-- ============================================================================
-- 5. CENÁRIO C: COLABORADOR COMUM ATIVO (access_level = member)
-- ============================================================================
RESET ROLE;
SELECT pg_temp.simulate_authenticated_user('22222222-2222-2222-2222-222222222222');

SELECT ok(
  (SELECT count(*) >= 3 FROM public.profiles),
  'Teste 13: Colaborador ativo lê perfis da equipe'
);

-- Tentativa de auto-promoção para admin (bloqueado por trigger/RLS)
SELECT throws_ok(
  $$UPDATE public.profiles SET access_level = 'admin' WHERE id = '22222222-2222-2222-2222-222222222222'$$,
  'P0001',
  'Operação negada: apenas administradores podem alterar o nível de acesso.',
  'Teste 14: Colaborador bloqueado ao tentar alterar próprio access_level para admin'
);

-- Tentativa de alterar nome de outro usuário (RLS USING filtra e resulta em 0 linhas afetadas)
UPDATE public.profiles SET name = 'Hack Terceiro' WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT is(
  (SELECT name::text FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'),
  'Admin Audit 1',
  'Teste 15: Colaborador não altera perfil de terceiros (0 linhas afetadas)'
);

-- Colaborador pode editar o próprio nome e cargo funcional
UPDATE public.profiles SET name = 'Colaborador Editado', role = 'Head de Operações'
WHERE id = '22222222-2222-2222-2222-222222222222';
SELECT is(
  (SELECT name::text FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222'),
  'Colaborador Editado',
  'Teste 16: Colaborador atualiza próprio nome/cargo com sucesso'
);

-- Colaborador cria publicação (UPDATE de publicação ainda não coberto)
INSERT INTO public.editorial_contents (id, client_id, title, date, time, format, status)
VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Nova Pauta Membro',
  CURRENT_DATE,
  '15:30',
  'Reels',
  'Em produção'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.editorial_contents WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'Teste 17: Colaborador ativo cria nova publicação'
);

-- Colaborador NÃO pode excluir clientes (policy clients_delete_admin_only filtra)
DELETE FROM public.clients WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT ok(
  EXISTS (SELECT 1 FROM public.clients WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Teste 18: Colaborador comum bloqueado ao tentar deletar cliente'
);

-- Colaborador pode excluir publicação (conforme botão de lixeira do Drawer no frontend)
DELETE FROM public.editorial_contents WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.editorial_contents WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'Teste 19: Colaborador ativo exclui publicação'
);

-- ============================================================================
-- 6. CENÁRIO D: ADMINISTRADOR ATIVO E PROTEÇÃO DO ÚLTIMO ADMIN
-- ============================================================================
RESET ROLE;
SELECT pg_temp.simulate_authenticated_user('11111111-1111-1111-1111-111111111111');

-- Único admin ativo NÃO pode desativar a si mesmo
SELECT throws_ok(
  $$UPDATE public.profiles SET is_active = FALSE WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  'P0001',
  'Operação negada: não é possível remover ou desativar o único administrador ativo do sistema.',
  'Teste 20: Único administrador ativo bloqueado ao tentar desativar a si mesmo'
);

-- Único admin ativo NÃO pode rebaixar a si mesmo
SELECT throws_ok(
  $$UPDATE public.profiles SET access_level = 'member' WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  'P0001',
  'Operação negada: não é possível remover ou desativar o único administrador ativo do sistema.',
  'Teste 21: Único administrador ativo bloqueado ao tentar rebaixar a si mesmo'
);

-- Único admin ativo NÃO pode excluir a si mesmo
SELECT throws_ok(
  $$DELETE FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  'P0001',
  'Operação negada: não é possível excluir o único administrador ativo do sistema.',
  'Teste 22: Único administrador ativo bloqueado ao tentar excluir o próprio perfil'
);

-- Admin pode reativar e promover um segundo administrador
UPDATE public.profiles SET is_active = TRUE, access_level = 'admin'
WHERE id = '33333333-3333-3333-3333-333333333333';
SELECT is(
  (SELECT access_level::text FROM public.profiles WHERE id = '33333333-3333-3333-3333-333333333333'),
  'admin',
  'Teste 23: Administrador ativo promove segundo administrador'
);

-- Agora que existe um 2º admin ativo, o 1º admin pode se rebaixar se desejar
UPDATE public.profiles SET access_level = 'member'
WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT is(
  (SELECT access_level::text FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111111'),
  'member',
  'Teste 24: Rebaixamento permitido quando permanece pelo menos 1 admin ativo'
);

-- Retorna como o 2º admin ativo para testar integridade referencial de exclusão
RESET ROLE;
SELECT pg_temp.simulate_authenticated_user('33333333-3333-3333-3333-333333333333');

-- FK ON DELETE RESTRICT impede deletar cliente com publicações vinculadas
SELECT throws_ok(
  $$DELETE FROM public.clients WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  '23503',
  NULL,
  'Teste 25: FK ON DELETE RESTRICT impede excluir cliente com publicações vinculadas (SQLSTATE 23503)'
);

-- Após remover a publicação, admin consegue excluir o cliente
DELETE FROM public.editorial_contents WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DELETE FROM public.clients WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.clients WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Teste 26: Admin exclui cliente após remover conteúdos dependentes'
);

SELECT * FROM finish();
ROLLBACK;
