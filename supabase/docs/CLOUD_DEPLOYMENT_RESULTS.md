# Aplicação autorizada na homologação — 18/11/2026

Destino confirmado imediatamente antes: OP Editorial Control Hub - Homologacao, cjbwmoxqkrrlryonuenn, ACTIVE_HEALTHY, PostgreSQL 17.12. O projeto principal ejinklwazxjzdsiwbadw não recebeu operações de banco. Sem Docker, seeds ou integração do frontend.

Comando exato autorizado executado com CLI 2.117.0:

```powershell
$env:DO_NOT_TRACK = '1'
supabase.cmd db push --linked --project-ref cjbwmoxqkrrlryonuenn --skip-vault
if ($LASTEXITCODE -ne 0) {
    throw 'Aplicação interrompida: conferir erro e estado antes de continuar.'
}
```

Exit code 0; dryRun=false; seeds=[]; roles=[]. Nenhuma falha de migração ou correção automática.

## Migrações efetivamente aplicadas e registradas no histórico

| Versão | Arquivo | Resultado |
| --- | --- | --- |
| 20261118170000 | initial_remote_schema.sql | Aplicada e histórico confirmado |
| 20261118171000 | last_admin_hardening.sql | Aplicada e histórico confirmado |
| 20261118180000 | admin_invariant.sql | Aplicada e histórico confirmado |
| 20261118181000 | function_permissions.sql | Aplicada e histórico confirmado |
| 20261118182000 | table_permissions.sql | Aplicada e histórico confirmado |

## Verificações remotas executadas após aplicação

Consulta de catálogo em BEGIN READ ONLY / ROLLBACK, transaction_read_only=on. Evidência: `../reports/cloud-deployment-catalog.json`; consulta reproduzível: `../scripts/verify_cloud_deployment.sql` (requer histórico e objetos existentes).

- profiles, clients e editorial_contents presentes, owner postgres e RLS habilitado nas três.
- editorial_security.admin_state presente, RLS habilitado, nenhuma permissão de tabela para anon/authenticated/service_role; uma linha com active_count=0 e revision=0, coerente com profiles vazio.
- Onze policies presentes, destinadas a authenticated, com expressões esperadas de membro/admin ativo.
- Onze triggers customizados presentes e habilitados. protect_profile_privileges vinculado BEFORE UPDATE FOR EACH ROW; proteção DELETE de profiles, DELETE de auth.users, TRUNCATE e contador/serialização instalados.
- Onze funções presentes, owner postgres, todas com search_path=pg_catalog, pg_temp. EXECUTE negado a anon e service_role nas funções auditadas; authenticated pode executar apenas os dois helpers RLS. Funções de trigger sem EXECUTE direto das roles API.
- authenticated tem SELECT/UPDATE/DELETE em profiles e não INSERT; CRUD em clients/editorial_contents, condicionado à RLS. service_role tem CRUD nas três tabelas públicas. anon sem privilégios nas tabelas auditadas.
- TRUNCATE/TRIGGER/REFERENCES/MAINTAIN negados às três roles API nas tabelas auditadas.
- Histórico contém exatamente as cinco versões acima.
- auth.users continua com dois usuários; profiles/clients/editorial_contents com zero registros. Dois usuários sem perfil. Nenhuma exclusão, alteração de usuários ou seed foi executado.

Essas são verificações de implantação e catálogo, não testes funcionais com JWT real. Não declarar Auth/PostgREST homologados por esses resultados.

## Próximo provisionamento — ainda não executado

1. Conferir os dois usuários por identificadores no ambiente autorizado e validar os dados mínimos para profiles: id Auth, nome, email, cargo. Definir explicitamente quem será admin e quem será member; metadata não é fonte de autorização.
2. Preparar script específico e revisável para inserir somente perfis ausentes desses dois IDs, com checagens de destino/quantidade, transação, sem sobrescrever perfis existentes e sem modificar auth.users. Selecionar explicitamente is_active e access_level.
3. Aprovar e executar esse provisionamento separado, criando ao menos um administrador ativo. Conferir contador e associação Auth/profile; não alterar manualmente admin_state.
4. Definir política de cadastro/convites: signup atual cria member ativo. Confirmar restrição adequada antes de liberar uso.

## Testes pendentes

As 93 asserções pgTAP e 27 corridas aprovadas continuam sendo resultados locais. Nenhuma suíte pgTAP nem cenário Auth/PostgREST foi executado no Cloud nesta etapa. Adaptar as fixtures atuais (que exigem Auth vazio) para preservar os dois usuários; não executar platform-fixture.sql no Cloud. Instalação pgTAP, criação/limpeza de usuários de QA e testes de mutação exigem escopo separado.

Executar os seis grupos já definidos: login/JWT/perfil ativo; anon/inativo; refresh/expiração/logout; cadastro/convite/metadata; exclusão administrativa Auth; privilégios e elevação via API. Usar contas artificiais próprias para testes destrutivos e nunca os dois usuários preexistentes. A cobertura de último admin precisa considerar o administrador de bootstrap para não mascarar o cenário.

**Aplicação das cinco migrações: concluída. Homologação funcional Auth/PostgREST: pendente. Integração do frontend: não iniciada.**
