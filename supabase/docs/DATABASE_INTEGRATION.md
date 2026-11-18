# Guia de Integração Database — Editorial Control Hub (OP Growth Digital)

Documentação técnica da camada de persistência, configuração do ambiente local via Supabase CLI, execução de migrações, auditoria de segurança (`pgTAP`) e diretrizes de integração com o frontend React + TypeScript.

---

## 1. Arquitetura Supabase

O contrato documentado do **Editorial Control Hub** prevê PostgreSQL gerenciado pelo Supabase, Supabase Auth para identidade e Row Level Security (RLS) para autorização. A versão remota e as definições reais ainda não foram verificadas; confirmar `SHOW server_version` e alinhar o ambiente local antes de migrar.

* **Modelo Organizacional:** Single-tenant interno da equipe OP Growth Digital. Todos os colaboradores autenticados e ativos (`is_active = TRUE`) operam sobre a carteira compartilhada de clientes e publicações.
* **Segregação de Papéis:**
  * `role` (`VARCHAR`): Cargo funcional exibido na interface (`Head de Conteúdo`, `Social Media & Conteúdo`, `Redator / Copywriter`, `Designer / Diretor de Arte`, `Gestor de Contas`, `Head de Operações`).
  * `access_level` (`ENUM: 'admin' | 'member'`): Nível de autorização validado pelo banco de dados.
* **Zero Senhas no Schema Público:** Credenciais, hashes e tokens de recuperação residem exclusivamente no schema interno `auth` do Supabase.

### Relacionamentos Principais

```text
auth.users (1) ────< CASCADE >──── (1) public.profiles
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 │ (SET NULL)                                      │ (SET NULL)
                 ▼                                                 ▼
         public.clients (1) ────< RESTRICT >──── (N) public.editorial_contents
```

* `public.profiles.id` $\rightarrow$ `auth.users.id` (`ON DELETE CASCADE`): O trigger `on_auth_user_created` cria o perfil automaticamente no cadastro, forçando `access_level = 'member'` e `is_active = TRUE`.
* `public.editorial_contents.client_id` $\rightarrow$ `public.clients.id` (`ON DELETE RESTRICT`): Impede a exclusão acidental de um cliente que possua publicações vinculadas.
* `created_by` / `updated_by` $\rightarrow$ `public.profiles.id` (`ON DELETE SET NULL`): Preserva o histórico editorial caso um colaborador seja removido.

---

## 2. Configuração do Ambiente Local (VS Code + Supabase CLI)

**Estado atualizado em 18/11/2026:** baseline pública reconstruída de catálogos remotos READ ONLY. Migrações e testes executados em PostgreSQL portátil com Auth emulado. CLI 2.117.0 e Node 26.13.1 disponíveis; Docker continua indisponível. Ver [relatório atual](DATABASE_SECURITY_RESULTS.md) para resultados e limites; não há validação completa de GoTrue/PostgREST.

Seguir o [roteiro local](LOCAL_DATABASE_RUNBOOK.md) e ler o [diagnóstico](DATABASE_VALIDATION_DIAGNOSIS.md). Ele orienta exportação `pg_dump --schema-only`, leitura de catálogos e captura dos triggers customizados em `auth.users`, sem dados e sem atualizar histórico remoto.

Não usar `db pull` neste escopo: pode escrever no histórico remoto. O nome passado ao comando não define seu timestamp. Não iniciar `supabase start` antes da baseline revisada: a inicialização pode aplicar migrações. Docker Desktop para Windows e Node 20+ (para CLI via npm) são os pré-requisitos de execução.

---

## 3. Procedimento de Auditoria e Testes RLS (`pgTAP`)

A suíte `supabase/tests/rls_security_audit.test.sql` contém **26 asserções** que validam:
1. Habilitação de RLS nas 3 tabelas (`profiles`, `clients`, `editorial_contents`).
2. SELECT nas três tabelas e INSERT em clients para visitantes (`anon`).
3. SELECT nas três tabelas e INSERT em editorial_contents para colaboradores desativados.
4. Bloqueio de escalonamento de privilégios (`member` tentando alterar `access_level` para `admin` ou injetar `admin` no signup).
5. Isolamento de edição de perfil (colaborador edita apenas os próprios dados).
6. Proteção sequencial do último administrador ativo contra auto-rebaixamento, desativação ou exclusão. Concorrência não está testada.
7. Integridade referencial (`ON DELETE RESTRICT`) na exclusão de clientes com pautas.

### Execução
Somente após baseline revisada/aplicada e ambiente local descartável sem dados preexistentes:

```powershell
$env:DO_NOT_TRACK = '1'
supabase.cmd test db --local supabase/tests/rls_security_audit.test.sql
```

A suíte original permanece com 26 asserções e foi executada no PostgreSQL portátil. `admin_security_extended.test.sql` amplia os cenários de permissões/manutenção e `qa/concurrency.mjs` usa conexões concorrentes reais. O relatório JSON registra os resultados da última execução. A verificação inicial recusa dados preexistentes e o pgTAP usa extensions no search_path. Não executar testes no remoto, mesmo com ROLLBACK.

### Interpretação dos Resultados
* **Sucesso:** Saída `1..26` com todas as linhas iniciadas por `ok 1` até `ok 26` e `All tests successful.` (exit code `0`). A transação termina em `ROLLBACK`, mantendo o banco limpo.
* **Falha:** Qualquer linha `not ok N - Teste XX` indica falha na regra descrita no título do teste correspondente.

---

## 4. Recomendações para Integração com React e TypeScript

### Variáveis de Ambiente (`.env.local`)
Configure apenas chaves públicas no frontend (nunca exponha `SERVICE_ROLE_KEY`):
```env
VITE_SUPABASE_URL=https://<SEU_PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<SUA_ANON_KEY_PUBLICA>
```

### Mapeamento de Nomenclatura (`snake_case` $\leftrightarrow$ `camelCase`)
O PostgreSQL utiliza `snake_case` e o frontend (`src/app.tsx`) utiliza `camelCase`. Crie mappers explícitos na camada `src/services/`:

| Tabela / Coluna PostgreSQL | Interface / Propriedade TypeScript | Observação de Serialização |
| :--- | :--- | :--- |
| `profiles.id` | `AuthUser.id` | UUID v4 |
| `profiles.name` | `AuthUser.name` | String |
| `profiles.email` | `AuthUser.email` | String |
| `profiles.role` | `AuthUser.role` | Cargo funcional |
| `clients.accent_color` | `Client.accentColor` | Aceita `rgb(...)` ou `#hex` |
| `clients.monthly_goal` | `Client.monthlyGoal` | `number` inteiro |
| `editorial_contents.client_id` | `EditorialContent.clientId` | UUID FK |
| `editorial_contents.date` | `EditorialContent.date` | PostgREST retorna `'YYYY-MM-DD'` |
| `editorial_contents.time` | `EditorialContent.time` | Armazenado como `VARCHAR(5)` (`'HH:mm'`) |
| `editorial_contents.art_text` | `EditorialContent.artText` | String |

### Boas Práticas de Performance e UX na Integração
1. **Debounce no Drawer Editorial:** O painel lateral de edição atualiza o estado React a cada tecla digitada (`onChange`). Ao integrar com `supabase.from('editorial_contents').update(...)`, aplique **debounce de 500ms** por campo ou salvamento explícito ao fechar/concluir para evitar rajadas de requisições `PATCH`.
2. **Prevenção de Loop no Signup:** Caso o projeto Supabase exija confirmação de e-mail (`Confirm email` habilitado), `supabase.auth.signUp()` retornará `user` sem `session` ativa. Trate esse estado exibindo aviso de confirmação de e-mail antes de redirecionar ao workspace.
3. **Tratamento de Erro `23503` (FK Restrict):** Se futuramente for adicionada exclusão de cliente na UI para administradores, capture o código PostgreSQL `23503` e informe que é necessário remover ou reatribuir as publicações vinculadas antes de excluir o cliente.
