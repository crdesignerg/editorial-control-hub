-- Executar exclusivamente em banco local descartável. Transação inteira revertida.
BEGIN;
SET LOCAL search_path=public,extensions;
SET LOCAL statement_timeout='30s';
SELECT no_plan();

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM auth.users) THEN RAISE EXCEPTION 'QA exige Auth local vazio'; END IF;
END $$;
CREATE FUNCTION pg_temp.session_as(db_role text, uid text DEFAULT '') RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
 EXECUTE 'SET LOCAL ROLE ' || quote_ident(db_role);
 PERFORM set_config('request.jwt.claim.sub',uid,true);
 PERFORM set_config('request.jwt.claims',json_build_object('sub',nullif(uid,''),'role',db_role)::text,true);
END $$;
-- Resultado observável: linhas afetadas ou SQLSTATE. Não oculta falhas em testes.
CREATE FUNCTION pg_temp.effect(statement text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint; BEGIN EXECUTE statement; GET DIAGNOSTICS n=ROW_COUNT; RETURN n::text;
EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE; END $$;

INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('11111111-1111-1111-1111-111111111111','admin1@qa.test','{"name":"Admin One","access_level":"admin"}'),
 ('22222222-2222-2222-2222-222222222222','member@qa.test','{"name":"Member One","is_active":false}'),
 ('33333333-3333-3333-3333-333333333333','inactive@qa.test','{"name":"Inactive One"}'),
 ('44444444-4444-4444-4444-444444444444','admin2@qa.test','{"name":"Admin Two"}');
SELECT is((SELECT access_level::text FROM public.profiles WHERE id='11111111-1111-1111-1111-111111111111'),'member','signup ignora admin em metadata');
SELECT ok((SELECT is_active FROM public.profiles WHERE id='22222222-2222-2222-2222-222222222222'),'signup ignora is_active em metadata conforme contrato');
UPDATE public.profiles SET access_level='admin' WHERE id IN ('11111111-1111-1111-1111-111111111111','44444444-4444-4444-4444-444444444444');
UPDATE public.profiles SET is_active=false WHERE id='33333333-3333-3333-3333-333333333333';
INSERT INTO public.clients(id,name) VALUES('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Client QA');
INSERT INTO public.editorial_contents(id,client_id,title,date) VALUES('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Content QA',CURRENT_DATE);

SELECT ok(EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.profiles'::regclass AND tgname='trg_protect_profile_privileges' AND tgtype=19 AND tgenabled='O' AND tgfoid='public.protect_profile_privileges()'::regprocedure),'trigger BEFORE UPDATE ROW vinculado e habilitado');
SELECT ok(NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','editorial_security') AND p.prosecdef AND NOT coalesce(p.proconfig @> ARRAY['search_path=pg_catalog, pg_temp'],false)),'SECURITY DEFINER com search_path restrito');
SELECT ok(NOT has_function_privilege('anon','public.protect_profile_privileges()','EXECUTE'),'anon sem EXECUTE no trigger');
SELECT ok(NOT has_function_privilege('authenticated','public.handle_new_auth_user()','EXECUTE'),'member sem EXECUTE no signup trigger');
SELECT ok(has_function_privilege('authenticated','public.is_active_admin()','EXECUTE'),'helper RLS executável por authenticated');
SELECT ok(NOT has_function_privilege('anon','public.is_active_admin()','EXECUTE'),'anon sem EXECUTE no helper');
SELECT ok(NOT has_schema_privilege('authenticated','editorial_security','USAGE'),'estado administrativo privado');
SELECT ok(NOT has_table_privilege('service_role','public.profiles','TRUNCATE'),'service_role sem TRUNCATE');

SELECT pg_temp.session_as('anon');
SELECT is(pg_temp.effect('SELECT * FROM public.profiles'),'42501','anon SELECT profiles negado');
SELECT is(pg_temp.effect('SELECT * FROM public.clients'),'42501','anon SELECT clients negado');
SELECT is(pg_temp.effect('SELECT * FROM public.editorial_contents'),'42501','anon SELECT contents negado');
SELECT is(pg_temp.effect('INSERT INTO public.clients(name) VALUES (''Visitor'')'),'42501','anon INSERT negado');
SELECT is(pg_temp.effect('UPDATE public.profiles SET access_level=''admin'''),'42501','anon UPDATE privilégios negado');
SELECT is(pg_temp.effect('DELETE FROM public.editorial_contents'),'42501','anon DELETE negado');
SELECT is(pg_temp.effect('TRUNCATE public.clients CASCADE'),'42501','anon TRUNCATE negado');

RESET ROLE;
SELECT pg_temp.session_as('authenticated','33333333-3333-3333-3333-333333333333');
SELECT is(pg_temp.effect('SELECT * FROM public.profiles'),'0','inativo sem leitura de perfis');
SELECT is(pg_temp.effect('SELECT * FROM public.clients'),'0','inativo sem leitura de clientes');
SELECT is(pg_temp.effect('SELECT * FROM public.editorial_contents'),'0','inativo sem leitura de pautas');
SELECT is(pg_temp.effect('INSERT INTO public.clients(name) VALUES (''Inactive'')'),'42501','inativo INSERT negado');
SELECT is(pg_temp.effect('UPDATE public.profiles SET is_active=true'),'0','inativo não se reativa');
SELECT is(pg_temp.effect('UPDATE public.clients SET name=''Inactive'''),'0','inativo UPDATE clients filtrado');
SELECT is(pg_temp.effect('UPDATE public.editorial_contents SET title=''Inactive'''),'0','inativo UPDATE contents filtrado');
SELECT is(pg_temp.effect('DELETE FROM public.profiles'),'0','inativo DELETE profiles filtrado');
SELECT is(pg_temp.effect('DELETE FROM public.clients'),'0','inativo DELETE clients filtrado');
SELECT is(pg_temp.effect('DELETE FROM public.editorial_contents'),'0','inativo DELETE contents filtrado');

RESET ROLE;
SELECT pg_temp.session_as('authenticated','22222222-2222-2222-2222-222222222222');
SELECT is(pg_temp.effect('SELECT * FROM public.profiles'),'4','member lê equipe');
SELECT is(pg_temp.effect('UPDATE public.profiles SET access_level=''admin'' WHERE id=auth.uid()'),'P0001','member não se promove');
SELECT is(pg_temp.effect('UPDATE public.profiles SET is_active=false WHERE id=auth.uid()'),'P0001','member não altera is_active');
SELECT is(pg_temp.effect('UPDATE public.profiles SET email=''other@qa.test'' WHERE id=auth.uid()'),'P0001','member não altera email');
SELECT is(pg_temp.effect('UPDATE public.profiles SET id=gen_random_uuid() WHERE id=auth.uid()'),'42501','member não altera identidade');
SELECT is(pg_temp.effect('UPDATE public.profiles SET name=''Other'' WHERE id<>auth.uid()'),'0','member não edita terceiros');
SELECT is(pg_temp.effect('UPDATE public.profiles SET name=''Member Changed'',role=''Designer'' WHERE id=auth.uid()'),'1','member edita nome e cargo');
SELECT is((SELECT role FROM public.profiles WHERE id=auth.uid())::text,'Designer','cargo funcional efetivamente atualizado');
SELECT is(pg_temp.effect('INSERT INTO public.clients(name) VALUES (''Member Client'')'),'1','member cria cliente');
SELECT is(pg_temp.effect('UPDATE public.clients SET monthly_goal=20 WHERE id=''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''),'1','member atualiza cliente');
SELECT is(pg_temp.effect('DELETE FROM public.clients'),'0','member não exclui cliente');
SELECT is(pg_temp.effect('DELETE FROM public.profiles WHERE id=auth.uid()'),'0','member não exclui perfil');
SELECT is(pg_temp.effect('UPDATE public.editorial_contents SET title=''Updated'''),'1','member atualiza publicação');
SELECT is(pg_temp.effect('INSERT INTO public.profiles(id,name,email) VALUES (gen_random_uuid(),''Injected'',''inject@qa.test'')'),'42501','member não insere perfil diretamente');
SELECT is(pg_temp.effect('TRUNCATE public.profiles CASCADE'),'42501','member não usa TRUNCATE');

RESET ROLE;
-- Claims fraudulentas não convertem authenticated em papel de manutenção.
SELECT pg_temp.session_as('authenticated');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT is(pg_temp.effect('UPDATE public.profiles SET access_level=''admin'''),'0','JWT sem sub não dá acesso');
-- Exercita o trigger sem depender de RLS: policy permissiva existe só na transação QA.
RESET ROLE;
CREATE POLICY qa_permissive_update ON public.profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY qa_permissive_select ON public.profiles FOR SELECT TO authenticated USING (true);
SELECT pg_temp.session_as('authenticated');
SELECT is(pg_temp.effect('UPDATE public.profiles SET access_level=''admin'' WHERE id=''22222222-2222-2222-2222-222222222222'''),'42501','trigger rejeita auth.uid NULL mesmo com RLS permissivo');
RESET ROLE;
DROP POLICY qa_permissive_update ON public.profiles;
DROP POLICY qa_permissive_select ON public.profiles;

SELECT pg_temp.session_as('authenticated','11111111-1111-1111-1111-111111111111');
SELECT is(pg_temp.effect('UPDATE public.profiles SET is_active=true WHERE id=''33333333-3333-3333-3333-333333333333'''),'1','admin reativa usuário');
SELECT ok((SELECT is_active FROM public.profiles WHERE id='33333333-3333-3333-3333-333333333333'),'reativação confirmada');
SELECT is(pg_temp.effect('UPDATE public.profiles SET access_level=''admin'' WHERE id=''22222222-2222-2222-2222-222222222222'''),'1','admin promove outro usuário');
SELECT is(pg_temp.effect('DELETE FROM public.profiles WHERE id=''33333333-3333-3333-3333-333333333333'''),'1','admin exclui perfil de membro');
SELECT is(pg_temp.effect('DELETE FROM public.clients WHERE id=''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''),'23503','FK bloqueia cliente com pautas');

RESET ROLE;
SELECT pg_temp.session_as('service_role');
SELECT is(pg_temp.effect('UPDATE public.profiles SET access_level=''member'''),'P0001','UPDATE em lote não elimina todos os admins');
SELECT is(pg_temp.effect('DELETE FROM public.profiles'),'P0001','DELETE em lote não elimina todos os admins');
SELECT is(pg_temp.effect('UPDATE public.profiles SET access_level=''member'' WHERE id<>''11111111-1111-1111-1111-111111111111'''),'2','manutenção legítima rebaixa admins extras');
SELECT is(pg_temp.effect('UPDATE public.profiles SET access_level=''member'' WHERE id=''11111111-1111-1111-1111-111111111111'''),'P0001','service_role não rebaixa último admin sem JWT');
SELECT is(pg_temp.effect('UPDATE public.profiles SET is_active=false WHERE id=''11111111-1111-1111-1111-111111111111'''),'P0001','service_role não desativa último admin');
SELECT is(pg_temp.effect('DELETE FROM public.profiles WHERE id=''11111111-1111-1111-1111-111111111111'''),'P0001','service_role não exclui último admin');
SELECT is(pg_temp.effect('UPDATE public.profiles SET name=''Maintained'' WHERE id=''11111111-1111-1111-1111-111111111111'''),'1','service_role mantém edição legítima');

RESET ROLE;
SELECT pg_temp.session_as('supabase_auth_admin');
SELECT is(pg_temp.effect('DELETE FROM auth.users WHERE id=''11111111-1111-1111-1111-111111111111'''),'P0001','Auth admin não exclui último admin por cascata');
SELECT is(pg_temp.effect('DELETE FROM auth.users WHERE id=''44444444-4444-4444-4444-444444444444'''),'1','Auth admin pode excluir usuário comum');
RESET ROLE;
SELECT ok(NOT EXISTS(SELECT 1 FROM public.profiles WHERE id='44444444-4444-4444-4444-444444444444'),'cascata legítima remove perfil');
SELECT is(pg_temp.effect('DELETE FROM auth.users WHERE id=''11111111-1111-1111-1111-111111111111'''),'P0001','postgres também preserva último admin');
SELECT is(pg_temp.effect('TRUNCATE auth.users CASCADE'),'42501','TRUNCATE administrativo explicitamente bloqueado');
SELECT is((SELECT active_count FROM editorial_security.admin_state),1::bigint,'contador final mantém um admin');
SELECT is((SELECT count(*) FROM public.profiles WHERE access_level='admin' AND is_active),1::bigint,'dados finais mantêm um admin');
SELECT is(pg_temp.effect('INSERT INTO public.profiles(id,name,email,access_level) VALUES (''11111111-1111-1111-1111-111111111111'',''Duplicate'',''duplicate@qa.test'',''admin'') ON CONFLICT(id) DO NOTHING'),'0','ON CONFLICT DO NOTHING não insere linha');
SELECT is((SELECT active_count FROM editorial_security.admin_state),1::bigint,'UPSERT ignorado não duplica contador');
SELECT is(pg_temp.effect('INSERT INTO public.profiles(id,name,email,access_level) VALUES (''11111111-1111-1111-1111-111111111111'',''Updated Admin'',''admin1@qa.test'',''admin'') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name'),'1','UPSERT legítimo atualiza perfil');
SELECT is((SELECT active_count FROM editorial_security.admin_state),1::bigint,'UPSERT atualizado mantém contador consistente');
SELECT * FROM finish();
ROLLBACK;
