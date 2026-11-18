# Diagnóstico da preparação do Database

> Diagnóstico histórico da primeira revisão. A leitura remota e as correções posteriores estão em [DATABASE_SECURITY_RESULTS.md](DATABASE_SECURITY_RESULTS.md); a baseline já foi obtida. Não interpretar os bloqueios históricos como estado atual.

Data: 18/11/2026. Classificação: **Aprovada com ressalvas para preparação; não recomendada a execução de migrações no estado atual.**

## Evidência e escopo

Lidos integralmente os quatro arquivos recebidos: DATABASE_INTEGRATION.md, DATABASE_SCHEMA_REFERENCE.md, 20261118171000_last_admin_hardening.sql e rls_security_audit.test.sql. Leitura adicional dos tipos em src/app.tsx, package.json, inventário de arquivos e ferramentas. Nenhuma conexão com o banco remoto foi realizada. Afirmações sobre o schema remoto permanecem não confirmadas.

## Achados

| Prioridade | Achado | Consequência / ação necessária |
| --- | --- | --- |
| Bloqueador | Só existe a migração de hardening; não há CREATE TABLE nem baseline do aplicativo | Não é possível reconstruir o banco vazio. Extrair o schema real antes de iniciar o Supabase local. |
| Alta | Hardening substitui protect_profile_privileges(), mas não cria trg_protect_profile_privileges | A proteção de UPDATE depende do trigger da baseline, ativo e associado à função correta. CREATE OR REPLACE FUNCTION isolado não instala trigger. |
| Alta | Guia original usava db pull como se fosse estritamente leitura | Pode criar/atualizar histórico remoto. Preferir pg_dump --schema-only e consultas READ ONLY, sem link/pull/repair. |
| Alta | Timestamp no argumento de db pull é parte do nome, não garantia da versão ordenada | Preparar baseline revisada anterior a 20261118171000, por exemplo 20261118170000_initial_remote_schema.sql. Nunca renumerar história remota nesta etapa. |
| Alta | As duas funções de hardening retornam antecipadamente se auth.uid() é NULL | SQL administrativo e operações de serviço sem identidade de usuário podem remover o último admin. NULL não comprova que o chamador é administrador; RLS, GRANTs e RPCs precisam fechar as outras vias. |
| Alta | Concorrência não aparece na suíte: há uma conexão e uma transação | A presença de advisory lock não comprova a garantia anunciada. Testar duas sessões com UPDATE/UPDATE, DELETE/DELETE e UPDATE/DELETE, operações em lote e revalidação de autorização. |
| Alta | Contagem após advisory lock depende de visibilidade transacional | Em REPEATABLE READ, snapshots preexistentes podem continuar vendo outro admin já removido por uma transação concorrente. Validar isolamentos suportados e corrigir estratégia se a garantia for universal. Não foi reproduzido em execução nesta tarefa. |
| Alta, condicional | Cadastro cria member ativo e membros ativos leem a carteira compartilhada | Se signup público estiver habilitado no remoto, qualquer novo cadastro pode receber acesso interno. Conferir configuração Auth/convites; metadata sem admin não resolve acesso indevido à equipe. |
| Média | 26 asserções reais, mas cobertura menor que a documentação original | Não cobrem toda a matriz CRUD, email/is_active de membro, alteração de publicação, deleção de outro perfil, cascata Auth ou todas as constraints. |
| Média | Testes de anon pressupõem SELECT concedido e RLS filtrando linhas | Se GRANT revogado, a mesma negação de acesso pode ocorrer como 42501 e o teste falhar. Fixar contrato após exportar ACLs, sem conceder acesso só para satisfazer testes. |
| Média | throws_ok exige texto exato em alguns testes | Depende da mensagem do trigger/servidor e de lc_messages. SQLSTATE sozinho também não distingue RLS de ausência de GRANT; verificar causa. |
| Média | Testes 16 e 23 afirmam dois efeitos, mas verificam só nome e access_level, respectivamente | Expandir para verificar role e is_active; teste 25 comprova violação FK, não diferencia RESTRICT de NO ACTION imediato. |
| Média | UPDATE global de administradores na fixture original | Removido; agora a suíte recusa tabelas com dados preexistentes, antes de inserir fixtures. ROLLBACK não justifica rodar testes no remoto. |
| Média | pgTAP sem schema/search_path explícito | Preparado extensions + search_path local; disponibilidade e permissões ainda dependem do runtime. |
| Baixa | Referência citava src/types/editorial.ts e accessLevel existente | Tipos estão em src/app.tsx; accessLevel é proposta futura. Documentação corrigida, frontend intacto. |

## Matriz de compatibilidade estática

| Grupo | Resultado |
| --- | --- |
| profiles | id, name, email, role, access_level e is_active usados no SQL existem no dicionário. Tipos, NOT NULL, defaults e FK reais pendentes. |
| clients | id, name, segment, accent_color, monthly_goal, manager e created_by conferem. Fixtures omitem campos dependendo dos defaults documentados. |
| editorial_contents | id, client_id, title, date, time, format, status, copy, art_text, briefing e created_by conferem. created_at, updated_at e updated_by não são efetivamente auditados. |
| Enums | admin/member, Carrossel/Reels e Planejado/Em produção são valores documentados. Os 5 formatos e 8 estados conferem com src/app.tsx; enums reais não extraídos. |
| Funções no hardening | protect_profile_privileges() e protect_last_admin_delete() conferem; mensagens P0001 coincidem com testes 14, 20, 21 e 22. |
| Funções só documentadas | handle_updated_at(), handle_new_auth_user(), is_active_team_member() e is_active_admin() não têm implementação nos arquivos fornecidos. Conferir owner, SECURITY DEFINER, search_path, permissões EXECUTE e ausência de recursão RLS. |
| Triggers | trg_protect_last_admin_delete é criado no hardening. trg_protect_profile_privileges, on_auth_user_created e os três triggers updated_at dependem do remoto. Nomes e vínculos devem ser conferidos no catálogo. |
| Policies | 11 nomes documentados, nenhum CREATE POLICY fornecido. A suíte testa parte do comportamento, não nomes, roles, USING, WITH CHECK ou policies adicionais permissivas. Compatibilidade real inconclusiva. |
| Integração | snake_case/camelCase consistente nos campos listados. Não há biblioteca Supabase no package.json; frontend funcionando não comprova persistência remota. Nenhuma integração implementada nesta tarefa. |

## Preparação executada

CLI instalada 2.117.0 e Node 26.13.1 verificados. `supabase.cmd init` gerou config.toml; seed desabilitado porque não existe seed.sql. Major PostgreSQL 17 é default provisório, não versão remota confirmada. Usado DO_NOT_TRACK=1 para evitar escrita de telemetria fora do workspace e executável .cmd para contornar o shim .ps1 bloqueado pela política normal do PowerShell, sem alterar essa política.

Docker/psql/pg_dump não disponíveis no PATH verificado; Docker Desktop/PostgreSQL também não encontrados nos caminhos padrão consultados. Isso não prova ausência em todo o computador. Não foram instalados nem iniciados serviços. Nenhum pacote React ou arquivo fora de supabase/ foi alterado no projeto.

Hardening SQL preservado integralmente até obter a baseline, pois não se sabe se já foi aplicado no remoto. Se já aplicado, correções devem receber nova migração, não reescrever histórico. pgTAP recebeu apenas preparação de ambiente e segurança das fixtures; não foi executado.

## Critério para avançar

Obter exportação sem dados, inventário de catálogo e versão remota; conferir grants, funções, triggers em auth.users, policies e histórico existente em leitura; consolidar baseline revisada antes do hardening; instalar/iniciar Docker e alinhar versão PostgreSQL. Só então apresentar o SQL e o comando local antes de executar migrações. Depois, rodar suíte sequencial e complementar cobertura e concorrência antes de aprovar a segurança.

Fontes: arquivos locais; ajuda da CLI 2.117.0; [Supabase CLI](https://supabase.com/docs/reference/cli/supabase-db-dump), [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [isolamento PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html), [SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html).
