-- Somente leitura. Destino deve ser explicitamente cjbwmoxqkrrlryonuenn na CLI.
BEGIN READ ONLY;
SET LOCAL statement_timeout='30s';
SELECT jsonb_build_object(
 'read_only',current_setting('transaction_read_only'),
 'tables',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity,'owner',pg_get_userbyid(c.relowner))) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','editorial_security') AND c.relkind='r'),
 'history',(SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations),
 'counts',jsonb_build_object('auth_users',(SELECT count(*) FROM auth.users),'profiles',(SELECT count(*) FROM public.profiles),'clients',(SELECT count(*) FROM public.clients),'contents',(SELECT count(*) FROM public.editorial_contents),'users_without_profile',(SELECT count(*) FROM auth.users u WHERE NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=u.id))),
 'admin_state',(SELECT jsonb_agg(to_jsonb(s)) FROM editorial_security.admin_state s),
 'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='public'),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid))) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND (n.nspname='public' OR t.tgrelid='auth.users'::regclass)),
 'functions',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'definer',p.prosecdef,'owner',pg_get_userbyid(p.proowner),'config',p.proconfig,'definition',pg_get_functiondef(p.oid),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'member_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE'))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','editorial_security') AND p.prokind='f'),
 'privileges',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'table',c.oid::regclass::text,'select',has_table_privilege(r.oid,c.oid,'SELECT'),'insert',has_table_privilege(r.oid,c.oid,'INSERT'),'update',has_table_privilege(r.oid,c.oid,'UPDATE'),'delete',has_table_privilege(r.oid,c.oid,'DELETE'),'truncate',has_table_privilege(r.oid,c.oid,'TRUNCATE'),'trigger',has_table_privilege(r.oid,c.oid,'TRIGGER'),'references',has_table_privilege(r.oid,c.oid,'REFERENCES'),'maintain',has_table_privilege(r.oid,c.oid,'MAINTAIN'))) FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE r.rolname IN ('anon','authenticated','service_role') AND n.nspname IN ('public','editorial_security') AND c.relkind='r')
) AS verification;
ROLLBACK;
