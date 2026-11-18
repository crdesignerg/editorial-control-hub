# Pré-verificação Cloud — 18/11/2026

> Registro anterior à aplicação. A aplicação posteriormente autorizada está documentada em [CLOUD_DEPLOYMENT_RESULTS.md](CLOUD_DEPLOYMENT_RESULTS.md).

Destino exclusivo: cjbwmoxqkrrlryonuenn (homologação). Excluído: ejinklwazxjzdsiwbadw (principal).

CLI 2.117.0 autenticada fora do sandbox. `db query` exige `--linked` junto de `--project-ref`; o ref explícito evita depender de vínculo local. Não foi executado `supabase link`.

Consultas BEGIN READ ONLY / ROLLBACK confirmaram PostgreSQL 17.12, executor postgres, transaction_read_only=on. Nenhuma relação em public/editorial_security/supabase_migrations; nenhuma função ou policy da aplicação, nenhum enum público e nenhum trigger customizado em auth.users. `to_regclass('supabase_migrations.schema_migrations')` retornou NULL: não consultar SELECT version nessa tabela antes de confirmar sua existência. pgTAP está disponível, mas não instalado.

**Existem dois usuários Auth. O banco não está integralmente vazio.** Não foram lidos emails ou metadata. Não excluir usuários nem inserir perfis automaticamente nesta aplicação. O trigger de signup não retroage; a implantação das cinco migrações deixará esses usuários sem perfil até um provisionamento separado e aprovado. A invariante permite bootstrap com profiles vazio.

## Prévia executada com sucesso

```powershell
supabase.cmd db push --linked --project-ref cjbwmoxqkrrlryonuenn --dry-run --skip-vault
```

Retorno: dryRun=true; cinco migrações pendentes; seeds=[]; roles=[]. Ordem:

1. 20261118170000_initial_remote_schema.sql
2. 20261118171000_last_admin_hardening.sql
3. 20261118180000_admin_invariant.sql
4. 20261118181000_function_permissions.sql
5. 20261118182000_table_permissions.sql

Hashes das cinco migrações conferem com latest-local-security.json. Consulta após dry-run confirmou public_tables=0, auth_users=2 e histórico ainda ausente. A CLI informa “Initialising login role”; isso é inicialização de acesso gerenciada pela ferramenta, não aplicação das migrações. Não se afirma ausência universal de efeitos internos da plataforma.

## Comando proposto — NÃO EXECUTADO, exige aprovação

```powershell
$env:DO_NOT_TRACK = '1'
supabase.cmd db push --linked --project-ref cjbwmoxqkrrlryonuenn --skip-vault
if ($LASTEXITCODE -ne 0) { throw 'Aplicação interrompida: conferir erro e estado antes de continuar.' }
```

Efeitos: criar objetos da aplicação e schema privado editorial_security, instalar triggers customizados em auth.users, ajustar grants/EXECUTE/search_path e registrar versões no histórico da homologação. Sem seeds, roles.sql, Vault, reset, exclusão de usuários ou escrita no principal. Não instalar pgTAP nem executar fixtures como parte deste comando.

`db push` aplica a cadeia com as transações dos arquivos; não é a proposta anterior de lote único atômico. Existe possibilidade de aplicação parcial em erro e de estado intermediário com ACL antiga. Não usar o projeto para tráfego ou signup durante a janela. Em falha, interromper, consultar catálogo/histórico e apresentar diagnóstico; não reexecutar automaticamente nem executar repair/reset. Se for exigida atomicidade da cadeia inteira, preparar e validar um executor separado antes da aprovação, não envolver simplesmente os arquivos com BEGIN extra.

Após sucesso, consultar catálogo completo com inspect_remote_schema.sql e consultar as versões do histórico somente após confirmar existência. O retorno db query pode exibir apenas o último resultado; usar consultas consolidadas ou uma por relatório para não perder evidências.

## Testes e liberação

Nenhum teste pgTAP/Auth/PostgREST executado no Cloud. Os 93 pgTAP e 27 cenários concorrentes aprovados são locais. Suítes atuais exigem auth.users vazio; não executá-las diretamente contra este projeto com dois usuários existentes. Preparar isolamento e limpeza restrita a usuários artificiais de QA, preservando preexistentes, antes dos testes Cloud. Não enviar platform-fixture.sql ao Cloud.

Prévia de aplicação concluída; aprovação de escrita pendente. Autenticação do frontend ainda não liberada.
