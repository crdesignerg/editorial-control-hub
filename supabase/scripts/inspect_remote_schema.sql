-- Somente leitura. Não lê registros de usuários, clientes ou publicações.
-- Executar via psql -X -v ON_ERROR_STOP=1 -f ... (ver runbook).
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SHOW server_version;
SHOW transaction_read_only;
SHOW default_transaction_isolation;
SHOW lc_messages;

SELECT n.nspname AS schema_name, c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_get_userbyid(c.relowner) AS owner, c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') ORDER BY c.relname;

SELECT table_name, column_name, data_type, udt_schema, udt_name,
       is_nullable, column_default, character_maximum_length
FROM information_schema.columns WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

SELECT t.typname, e.enumlabel, e.enumsortorder
FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder;

SELECT c.conrelid::regclass AS table_name, c.conname, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' ORDER BY 1, 2;

SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename, indexname;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public', 'auth', 'storage')
ORDER BY schemaname, tablename, policyname;

SELECT p.oid::regprocedure AS signature, pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef, p.provolatile, p.proconfig, p.proacl, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f' ORDER BY 1;

-- Inclui vínculos em auth.users: exportar só public não os inclui.
SELECT n.nspname AS schema_name, c.relname, t.tgname, t.tgenabled,
       p.oid::regprocedure AS function_name, pg_get_triggerdef(t.oid, true) || ';' AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal AND (n.nspname = 'public' OR (n.nspname = 'auth' AND c.relname = 'users'))
ORDER BY n.nspname, c.relname, t.tgname;

SELECT n.nspname, n.nspacl FROM pg_namespace n
WHERE n.nspname IN ('public', 'auth', 'extensions');
SELECT defaclrole::regrole, defaclnamespace::regnamespace, defaclobjtype, defaclacl
FROM pg_default_acl ORDER BY 1, 2, 3;
SELECT e.extname, e.extversion, n.nspname FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace ORDER BY e.extname;
SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete FROM pg_publication;
SELECT pubname, schemaname, tablename FROM pg_publication_tables
WHERE schemaname = 'public' ORDER BY pubname, tablename;
SELECT to_regclass('supabase_migrations.schema_migrations') AS migration_history_table;
-- Privilégios efetivos incluem herança/PUBLIC, não apenas grants explícitos.
SELECT r.rolname, c.oid::regclass AS table_name,
       has_table_privilege(r.oid, c.oid, 'SELECT') AS can_select,
       has_table_privilege(r.oid, c.oid, 'INSERT') AS can_insert,
       has_table_privilege(r.oid, c.oid, 'UPDATE') AS can_update,
       has_table_privilege(r.oid, c.oid, 'DELETE') AS can_delete,
       has_table_privilege(r.oid, c.oid, 'TRUNCATE') AS can_truncate
FROM pg_roles r CROSS JOIN pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
  AND n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY r.rolname, c.relname;
ROLLBACK;
