# Validação local: roteiro sem escrita no remoto

> Atualização: as etapas de leitura remota e reconstrução da baseline pública foram concluídas via consultas READ ONLY no painel. A rota portátil foi testada; veja [DATABASE_SECURITY_RESULTS.md](DATABASE_SECURITY_RESULTS.md). Os comandos de pg_dump abaixo continuam como alternativa para exportação completa, mas não foram usados nesta execução.

## Estado e próximo passo

**Próximo passo para homologação completa:** disponibilizar Docker e testar a cadeia numa stack Supabase local com Auth/PostgREST reais. Não aplicar nada no remoto. A baseline pública já foi extraída de catálogo; o major confirmado é 17 (remoto 17.12).

A configuração foi gerada pela CLI 2.117.0. Node local: 26.13.1. Docker e clientes PostgreSQL não foram encontrados nos locais verificados. Instalar Docker Desktop para Windows com containers Linux e os clientes PostgreSQL (`psql`, `pg_dump`) antes das etapas que os exigem. O pg_dump deve ser de versão compatível, igual ou mais recente que o servidor. Para uso via npm, a documentação atual exige Node 20 ou superior; preferir a CLI instalada e registrar sua versão, sem atualizar automaticamente.

## 1. Conferir ferramentas, sem iniciar banco

Na raiz do projeto, PowerShell:

```powershell
$env:DO_NOT_TRACK = '1'
supabase.cmd --version
docker --version
docker info
psql --version
pg_dump --version
node supabase/scripts/preflight.mjs
```

`config.toml` já foi criado por `supabase.cmd init`. Não repetir com `--force`. A baseline está presente; a checagem ainda acusa as ferramentas ausentes para a rota Docker. Não modifica banco nem instala ferramentas. Os binários PostgreSQL portáteis da rota QA ficam isolados em `supabase/qa/`, fora do PATH.

## 2. Extrair DDL sem dados e sem tocar no histórico

No painel do projeto correto, obter host, porta, database e usuário da conexão direta ou do pooler em **session mode**, além do certificado CA quando necessário. Confirmar o projeto pelo nome e referência. Não usar connection string HTTP nem chave anon/service_role como senha PostgreSQL. Não colocar senha em comando, arquivo versionado ou conversa; `-W` solicita a senha interativamente. Usar uma conta existente autorizada a ler todo o schema; não criar roles remotas nesta preparação.

Substituir apenas os parâmetros de conexão abaixo. O certificado fica em caminho privado local. TLS deve validar o servidor. Não desabilitar validação para contornar erro de conexão.

```powershell
$env:PGHOST = '<HOST_DO_PROJETO>'
$env:PGPORT = '<PORTA_DIRECT_OU_SESSION>'
$env:PGDATABASE = 'postgres'
$env:PGUSER = '<USUARIO_DA_CONEXAO>'
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = '<CAMINHO_DO_CERTIFICADO_CA>'
$env:PGOPTIONS = '-c default_transaction_read_only=on -c lock_timeout=5000'
New-Item -ItemType Directory -Force supabase/snapshots | Out-Null

# Verificação somente leitura; senha solicitada pelo cliente.
psql -X -W -v ON_ERROR_STOP=1 -c 'SHOW server_version;'

# Objetos e permissões de public, sem registros, sem DROP e sem owner remoto.
pg_dump -W --schema-only --schema=public --no-owner --lock-wait-timeout=5s --file=supabase/snapshots/public_schema.sql

# Inventário: constraints, funções, triggers, RLS, grants, extensões etc.
psql -X -W -v ON_ERROR_STOP=1 -f supabase/scripts/inspect_remote_schema.sql -o supabase/snapshots/catalog.txt
```

Verificar `$LASTEXITCODE` após cada comando; interromper se diferente de zero. Não tratar arquivo parcial como exportação válida. Os comandos só leem o remoto; o pg_dump pode adquirir locks de leitura e gerar carga, portanto usar horário adequado. Não são backup dos dados. Guardar os arquivos brutos fora do Git (`snapshots/` está ignorado): corpos de funções e defaults podem conter informações sensíveis mesmo num dump sem dados.

Se o catálogo indicar histórico existente, consultar **somente leitura** `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version` em sessão com as mesmas opções. Não usar `migration repair`. Registrar as versões para evitar confundir a futura baseline local com uma mudança a enviar ao remoto.

O catálogo inclui `pg_get_triggerdef` para triggers não internos de auth.users. Extrair do resultado **apenas os triggers customizados do aplicativo**, com sua definição real, estado habilitado e função referenciada. O dump de public contém a função se ela estiver nesse schema, mas não contém o trigger ligado a auth.users. Se houver funções auxiliares em outros schemas, exportá-las/revisá-las também. Não copiar o schema gerenciado auth inteiro, seus registros, nem substituir tabelas Auth no local.

Alternativa: `supabase.cmd db dump --linked --schema public --file ...` exporta DDL por padrão, mas depende de link/Docker e ainda exige conferir objetos externos a public. A rota principal acima evita vínculo e não altera histórico. Não usar `db pull`: ele pode criar/atualizar metadados de migrações remotas. Prefixar `00000000000000` no nome passado ao pull não impõe o timestamp do arquivo gerado.

## 3. Revisar e consolidar baseline, ainda sem executá-la

1. Confirmar as 3 tabelas, 3 enums, constraints, índices, defaults, owners necessários às funções SECURITY DEFINER, GRANTs/REVOKEs e todas as policies (inclusive eventuais extras). Comparar com o diagnóstico.
2. Confirmar `on_auth_user_created` e sua função; `trg_protect_profile_privileges` precisa executar a função correta em BEFORE UPDATE FOR EACH ROW e estar habilitado. Conferir triggers updated_at e de DELETE.
3. Conferir extensões e dependências externas; não inventar esquema com base apenas na documentação. `--no-owner` exige revisar ownership das funções no destino, sem reproduzir owners inexistentes.
4. Produzir `supabase/migrations/20261118170000_initial_remote_schema.sql` a partir da exportação revisada. O nome é uma ordem de baseline local, não a data de criação do remoto. Preservar o dump bruto. Adaptar `CREATE SCHEMA public` ao public já existente no Supabase local e remover comandos específicos de psql, como `\restrict`/`\unrestrict`, se presentes, antes de usar o executor de migrações. Não remover permissões de segurança para conseguir aplicar.
5. Anexar as definições customizadas revisadas em auth.users, após as funções de que dependem. Não inserir dados de produção. Não copiar schema_migrations remoto para o local.
6. Se o dump já contém o hardening, comparar definições: reaplicar o arquivo antigo pode sobrescrever uma versão mais nova. Decidir a cadeia local com base nesse diff. Não editar migração já aplicada remotamente; correções recebem nova versão.
7. Manter `[db].major_version = 17`, confirmado no remoto (17.12). Conferir também Auth/convites: o modelo cria perfis ativos, portanto signup aberto requer avaliação antes de integrar usuários reais.

**Ponto de parada solicitado pelo usuário:** apresentar o diagnóstico atualizado, lista de migrações em ordem e o comando local exato antes de executá-lo. Isso foi cumprido para a execução portátil, já concluída. A baseline foi reconstruída do catálogo real e testada; as etapas 2 e 3 documentam o procedimento para uma futura reexportação, não uma pendência atual.

## 4. Execução futura, exclusivamente local

Somente após resolver a etapa 3 e apresentar a revisão:

```powershell
# Em um novo terminal, sem PG* remoto da etapa de exportação.
$env:DO_NOT_TRACK = '1'
node supabase/scripts/preflight.mjs
# Avançar apenas com pré-requisitos resolvidos e revisão manual concluída.
supabase.cmd start
supabase.cmd test db --local supabase/tests
```

`start` pode aplicar migrações durante a criação do ambiente, por isso também está suspenso. Não é necessário executar migration up por hábito após uma primeira inicialização bem-sucedida. Para migrações novas, usar somente `supabase.cmd migration up --local` após revisão. Não usar `--linked`, `--project-ref` ou `--db-url` para migrar/testar nesta fase. Não executar `db push`, `db reset` remoto, `migration repair` nem alterações pelo SQL Editor.

Não exportar registros de auth.users para testes. A suíte cria fixtures artificiais e recusa dados preexistentes; fecha com ROLLBACK. Se já houver dados locais úteis, preparar outra instância local descartável em vez de apagá-los. Não executar reset automaticamente.

Resultado já obtido na rota portátil: 93 asserções pgTAP e 27 cenários de concorrência, sem falhas, nos níveis READ COMMITTED, REPEATABLE READ e SERIALIZABLE. Os testes concorrentes ficam separados em `qa/concurrency.mjs`, chamados pelo executor portátil. A homologação na stack Supabase deve repetir a cobertura de banco e acrescentar Auth/PostgREST reais; o executor portátil usa uma fixture Auth mínima e não comprova esses fluxos. Consulte o relatório de resultados para reprodução e limitações.

Fontes: [pg_dump PostgreSQL](https://www.postgresql.org/docs/current/app-pgdump.html), [CLI Supabase](https://supabase.com/docs/reference/cli/supabase-db-dump), [instalação CLI](https://supabase.com/docs/guides/local-development/cli/getting-started). Flags locais conferidas na ajuda da CLI instalada 2.117.0.
