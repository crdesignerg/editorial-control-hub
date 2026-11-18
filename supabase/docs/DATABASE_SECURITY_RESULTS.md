# Correções e evidências de segurança — 18/11/2026

**Resultado: correções aprovadas nos testes PostgreSQL locais executados, com ressalvas de integração. Não declarar o Supabase remoto seguro: ele não recebeu as correções.**

## Estrutura remota confirmada em leitura

Projeto confirmado pelo usuário e pelo painel: `ejinklwazxjzdsiwbadw`, OP - Editorial Control HUB. Consultas executadas no SQL Editor com `BEGIN READ ONLY`, SELECT de catálogos e `ROLLBACK`. A primeira consulta retornou `transaction_read_only=on` e PostgreSQL **17.12**. Não foram executados DDL, DML ou comandos de histórico de migrações no remoto. O painel cria um rascunho privado da consulta; isso não é alteração do schema ou da tabela de histórico.

Foram exportadas 20 linhas de funções/triggers/policies e 132 linhas de estrutura/ACLs. Uma terceira consulta confirmou privilégios efetivos com `has_table_privilege`. Nenhum registro de usuário, cliente ou publicação foi exportado.

Fatos confirmados:

- `trg_protect_profile_privileges` existe, habilitado (`O`), BEFORE UPDATE FOR EACH ROW em public.profiles, apontando para protect_profile_privileges(). A pendência original era de comprovação, não um trigger remotamente ausente.
- A função remota só protege campos; não tem invariante do último admin e aceita `auth.uid() IS NULL` indiscriminadamente. Não havia protect_last_admin_delete nem trigger DELETE correspondente.
- `on_auth_user_created` existe em auth.users e usa handle_new_auth_user(); metadata não controla access_level ou is_active.
- As 3 tabelas, 3 enums, 14 constraints, 5 índices adicionais, 5 funções, 5 triggers e 11 policies de aplicação foram reconstruídos a partir das definições exportadas. A FK profiles → auth.users é ON DELETE CASCADE.
- RLS está habilitado nas 3 tabelas, sem FORCE. Os helpers RLS são SECURITY DEFINER, owner postgres; ACL de função nula significa permissões padrão, incluindo EXECUTE público.
- **ACL incorreta:** anon/authenticated/service_role têm SELECT/INSERT/UPDATE/DELETE efetivamente falsos nas 3 tabelas e TRUNCATE verdadeiro. ACLs também concedem REFERENCES/TRIGGER/MAINTAIN. Policies corretas não compensam esses GRANTs.
- `to_regclass('supabase_migrations.schema_migrations')` retornou NULL: a tabela de histórico não existia na consulta. Ela não foi criada.

Arquivos brutos, ignorados pelo Git: `supabase/snapshots/security-catalog.csv` (SHA256 `442859e496cbf8fb20834a24790c420a884e56f5935c85a7adcde43b80fe5142`) e `structure-catalog.csv` (`e10273340d48ab51460ab82e9b0749c156a22ac3f47ef9cf0cbfbea59dbab5c6`). A baseline é uma reconstrução do schema público auditado, não um pg_dump completo do projeto ou backup de dados.

## Correções preparadas e executadas somente localmente

| Arquivo em migrations/ | Função |
| --- | --- |
| 20261118170000_initial_remote_schema.sql | Baseline pública derivada dos catálogos reais, inclusive ACLs antigas para reprodução fiel. Somente para banco novo/local. |
| 20261118171000_last_admin_hardening.sql | Arquivo original preservado integralmente; aplicado na cadeia local antes das correções novas. |
| 20261118180000_admin_invariant.sql | Contador privado transacional; serialização de DML em perfis; validação do papel real de manutenção; trigger BEFORE UPDATE explícito; proteção contra remoção do último admin em UPDATE, DELETE, cascata Auth e TRUNCATE. |
| 20261118181000_function_permissions.sql | search_path restrito nas funções auditadas; revogação de EXECUTE público e de roles API nas funções de trigger; EXECUTE dos helpers RLS somente para authenticated além do owner. |
| 20261118182000_table_permissions.sql | Remove ACLs antigas; anon sem acesso; authenticated com CRUD adequado às policies e sem INSERT em profiles; service_role com CRUD de manutenção, sem TRUNCATE/TRIGGER/REFERENCES/MAINTAIN. |

O contador em editorial_security.admin_state é privado, sem GRANTs API e com RLS habilitado. Toda mutação de profiles escreve na linha sentinela antes de validar privilégios. A contagem é ajustada em AFTER ROW, só para linhas efetivamente modificadas, incluindo UPSERT. A escrita real provoca conflito de serialização para snapshots antigos; não depende de uma simples leitura COUNT após advisory lock.

`auth.uid() IS NULL` não é mais autorização. A função de manutenção verifica o papel PostgreSQL efetivo via configuração de SET ROLE, ou session_user quando não há SET ROLE. Os nomes permitidos são postgres, supabase_admin, service_role e supabase_auth_admin, sem confiar no campo role do JWT. Essas rotas continuam podendo criar/promover o primeiro admin, editar perfis e excluir usuários comuns, mas não podem remover o último admin por DML normal.

A migração exige execução como postgres e recusa perfis preexistentes sem admin ativo. Banco completamente vazio pode iniciar com zero admins para bootstrap; deve-se promover explicitamente o primeiro antes de liberar uso. Para trocar o único administrador, promover o substituto primeiro e só depois rebaixar/excluir o anterior. Não há bypass secreto para esvaziar o sistema.

## Testes efetivamente executados

Ambiente: PostgreSQL nativo portátil **17.11**, pacote fixo embedded-postgres 17.11.0-beta.19, pgTAP **1.3.4**, Node 26.13.1. Cluster novo, senha efêmera gerada em memória, apenas `127.0.0.1:55439`, sem serviço Windows instalado. Cada execução usa diretório próprio; servidor encerrado ao final.

| Verificação | Resultado final |
| --- | --- |
| Aplicação das 5 migrações na cadeia local | 5 PASS |
| admin_security_extended.test.sql | 67 PASS, 0 falhas |
| rls_security_audit.test.sql | 26 PASS, 0 falhas |
| Concorrência, duas conexões reais | 27 PASS, 0 falhas |
| Reprodução da ACL remota antes da correção | anon TRUNCATE=true; authenticated SELECT=false, confirmado localmente |
| Verificação de frontend/package/lockfile principal | Sem alteração |

Total: **93 asserções pgTAP + 27 cenários concorrentes**. O [relatório JSON](../reports/latest-local-security.json) inclui versões, horários, hashes das migrações e resultado de cada corrida. Os TAPs estão em `supabase/reports/`.

A suíte ampliada testa visitante, inativo, membro e administrador; metadata maliciosa, autopromoção, email/is_active/id, edição de terceiros, CRUD, GRANTs, EXECUTE, search_path, NULL UID mesmo com policies deliberadamente permissivas dentro da transação QA, service_role sem JWT, postgres e supabase_auth_admin, cascata legítima e proibida, operações em lote e UPSERT. As policies permissivas de teste são removidas e toda a suíte termina em ROLLBACK.

Concorrência: 9 combinações de rebaixamento/DELETE profiles/DELETE auth.users em cada nível READ COMMITTED, REPEATABLE READ e SERIALIZABLE. A sessão B estabelece snapshot antes da alteração A; o teste confirma bloqueio real via pg_blocking_pids, faz COMMIT de A e verifica rejeição de B e contador/dados finais iguais a 1. READ COMMITTED retornou P0001 nos 9 casos; os outros níveis retornaram 40001 nos 18 casos. Essas exceções são resultados esperados de proteção, não testes falhos.

Falha de infraestrutura registrada na primeira tentativa: pg_ctl não conseguiu criar token restrito dentro do sandbox Windows (erro 87); nenhuma migração/teste ocorreu nessa tentativa. A execução fora desse sandbox, ainda limitada ao cluster local, completou. A primeira suíte passou com 87 asserções; após incluir lote/UPSERT e proteção de bootstrap, a execução final passou com 93. Não houve asserção pgTAP falhando nas execuções concluídas.

## Reprodução local

Na raiz do projeto:

```powershell
npm.cmd ci --prefix supabase/qa --no-audit --no-fund
node supabase/qa/setup-pgtap.mjs
node supabase/qa/run-local.mjs
```

O download de pgTAP é fixado na tag oficial v1.3.4 e verificado por SHA256. Pacotes e lockfile ficam em qa/, separados do frontend. O executor não aceita URI de banco, host remoto ou credenciais externas. Não precisa reconstruir a baseline para repetir testes: o SQL revisado já está versionável. `qa/build-baseline.mjs` só é usado se os catálogos forem reexportados e a reconstrução for revisada novamente.

## Limitações e riscos que permanecem

1. **Remoto permanece no estado anterior.** As permissões TRUNCATE e as falhas de proteção confirmadas não foram removidas nele. Não houve autorização para implantação e nada foi aplicado.
2. **Não foi usada a stack Supabase completa.** Docker continua ausente. Auth é uma fixture mínima para auth.users/auth.uid()/roles; não foram testados GoTrue, PostgREST, JWT real, fluxo HTTP de signup/login/remoção ou permissões gerenciadas de plataforma. É necessário repetir em Supabase local antes de aprovar implantação.
3. **Patch PostgreSQL diferente:** remoto 17.12, local 17.11. Major alinhado, sem alegar paridade completa.
4. **Auth de produção:** cadastro aberto/convites não foi verificado. O contrato atual ainda cria member ativo; signup aberto pode conceder acesso interno. Banimento, soft-delete de Auth, recuperação de conta e capacidade real de login do admin não são garantidos pelo contador de profiles.
5. **Administrador de infraestrutura não é adversário contido:** superuser/owner pode alterar tabelas de controle, desabilitar triggers ou executar DDL. A proteção cobre DML normal com triggers ativos, não abuso de autoridade irrestrita.
6. **Serialização tem custo:** alterações de perfil disputam uma linha sentinela. Corridas testadas preservam segurança, mas podem exigir retry de transação completa após 40001/40P01. Não foi realizado benchmark de carga nem prova de ausência de deadlocks em todas as operações possíveis.
7. **Escopo da baseline:** não exporta schemas gerenciados, configuração Auth, extensões globais, publicações Realtime, default privileges globais ou outros serviços. A liberação remota deve incluir revisão de default ACLs para que tabelas futuras não recebam privilégios excessivos.

**Recomendação:** homologar primeiro a cadeia em stack Supabase local real. Depois preparar implantação explícita somente das correções, com conferência do estado atual e autorização do usuário. Não usar db push indiscriminadamente: a baseline recria objetos já existentes e o histórico remoto precisa de uma estratégia própria, também sujeita à autorização. Este trabalho não altera histórico remoto.

Fontes técnicas: [PostgreSQL — TRUNCATE](https://www.postgresql.org/docs/17/sql-truncate.html), [isolamento transacional](https://www.postgresql.org/docs/17/transaction-iso.html), [SECURITY DEFINER](https://www.postgresql.org/docs/17/sql-createfunction.html), [fonte pgTAP v1.3.4](https://github.com/theory/pgtap/tree/v1.3.4). Evidência específica do projeto: catálogos exportados e testes locais acima.
