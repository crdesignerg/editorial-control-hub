# BACKEND ARCHITECTURE — EDITORIAL CONTROL HUB (OP GROWTH)

## 1. VISÃO GERAL E ESCOPO

Este documento define a arquitetura técnica de integração entre o frontend existente do **Editorial Control Hub** (React + TypeScript + Vite + Tailwind CSS) e o backend gerenciado via **Supabase** (PostgreSQL + Supabase Auth + PostgREST + Row Level Security).

### Premissas e Restrições Arquiteturais
- **Zero Backend Intermediário Desnecessário:** Não será criado um servidor Node.js/Express/NestJS separado. O cliente Supabase JS (`@supabase/supabase-js`) atua como camada de transporte segura diretamente contra o PostgREST e GoTrue (Supabase Auth).
- **Segurança Orientada a Dados (RLS-First):** Toda regra de autorização reside no PostgreSQL via Row Level Security (RLS). O frontend aplica guards apenas para UX e roteamento.
- **Preservação Integral do Frontend:** Nenhuma alteração visual, estrutural de UI ou de fluxo aprovado será realizada. A camada de serviços atuará como adaptador (*Adapter Pattern*) entre os contratos do banco e os componentes existentes.
- **Integridade do Schema:** Nenhuma tabela, coluna ou política será criada ou alterada neste estágio; colunas não confirmadas são explicitamente marcadas como `PENDENTE_VALIDACAO_SCHEMA`.

---

## 2. ESTADO ATUAL VS. ARQUITETURA PROPOSTA

| Camada / Domínio | Estado Atual (Implementado / Simulado) | Arquitetura Proposta (Target) |
| :--- | :--- | :--- |
| **Interface (UI)** | **Implementado:** React + Vite + Tailwind CSS com módulos *Dashboard, Calendário, Clientes, Produção e Pendências*. | **Preservado:** Nenhuma alteração de layout ou componentes visuais. |
| **Autenticação** | **Simulado:** Estado local mockado sem persistência de sessão real. | **Proposto:** `Supabase Auth` (Email/Password) com gerenciamento automático de JWT e refresh token em memória/storage seguro. |
| **Autorização** | **Simulado / Inexistente no Client:** Acesso livre às rotas mockadas. | **Proposto:** `Supabase RLS` no PostgreSQL + leitura do registro em `profiles` + `ProtectedRoute` no React Router. |
| **Persistência de Clientes** | **Simulado:** Arrays estáticos em memória/estado local. | **Proposto:** `clientsService` consumindo a tabela `public.clients` via PostgREST com tipagem estrita. |
| **Persistência Editorial** | **Simulado:** Dados fictícios nos módulos de Calendário, Produção e Pendências. | **Proposto:** `editorialService` consumindo `public.editorial_contents` com filtros, ordenação e mapeamento DTO. |
| **Tratamento de Erros** | **Básico / Console:** Sem padronização de falhas de rede ou permissão. | **Proposto:** `AppError` normalizado interceptando `PostgrestError` e `AuthError` com feedback não-destrutivo na UI. |

---

## 3. TOPOLOGIA E FLUXO DE DADOS

```text
+-------------------------------------------------------------------+
|                   FRONTEND (React + Vite + TS)                    |
|                                                                   |
|  [UI Modules: Dashboard | Calendário | Clientes | Produção | ...] |
|                                |                                  |
|                    (Hooks / React Query / Context)                |
|                                |                                  |
|  [Domain Services: authService | clientsService | editorialService]|
|                                |                                  |
|  [Mappers / Adapters: DB Row <-> Frontend ViewModel]              |
|                                |                                  |
|  [Infrastructure: supabaseClient | errorNormalizer]               |
+--------------------------------|----------------------------------+
                                 | HTTPS (TLS) + Anon Key + User JWT
                                 v
+-------------------------------------------------------------------+
|                        SUPABASE PLATFORM                          |
|                                                                   |
|  +------------------------+    +-------------------------------+  |
|  |   Supabase Auth        |    |   PostgREST API Gateway       |  |
|  |   (GoTrue / JWT)       |    |   (Auto-generated REST)       |  |
|  +------------------------+    +---------------|---------------+  |
|                                                |                  |
|                                                v                  |
|                                +-------------------------------+  |
|                                |   PostgreSQL Database         |  |
|                                |   - Enforcement via RLS       |  |
|                                |   - public.profiles           |  |
|                                |   - public.clients            |  |
|                                |   - public.editorial_contents |  |
|                                +-------------------------------+  |
+-------------------------------------------------------------------+
```

### Princípio de Separação de Responsabilidades
1. **UI Components:** Consomem apenas estados (`data`, `isLoading`, `error`) e disparam ações de domínio. Nunca importam `supabase` diretamente.
2. **Hooks / State Layer:** Gerenciam ciclo de vida assíncrono, cache, invalidação e estados de carregamento/erro.
3. **Services Layer:** Encapsulam chamadas ao SDK do Supabase, validações de pré-condição e chamadas aos *Mappers*.
4. **Mappers (Anti-Corruption Layer):** Isolam o frontend de nomes de colunas do PostgreSQL. Caso uma coluna do banco mude após a auditoria do Codex, apenas o Mapper é ajustado.
5. **Supabase Client (`lib/supabase.ts`):** Instância singleton configurada com `VITE_SUPABASE_URL` e uma chave pública: `VITE_SUPABASE_ANON_KEY` ou `VITE_SUPABASE_PUBLISHABLE_KEY`.

---

## 4. ESTRUTURA RECOMENDADA DE DIRETÓRIOS E ARQUIVOS

```text
src/
├── lib/
│   ├── supabase.ts                 # Instância singleton do createClient<Database>
│   └── errors.ts                   # Normalizador de PostgrestError e AuthError
├── types/
│   ├── database.types.ts           # Tipos gerados via Supabase CLI (supabase gen types)
│   ├── domain.types.ts             # Entidades normalizadas usadas pelo Frontend
│   └── api.types.ts                # DTOs de criação/atualização, filtros e Result<T>
├── mappers/
│   ├── profile.mapper.ts           # Conversão profiles Row <-> UserProfile
│   ├── client.mapper.ts            # Conversão clients Row <-> Client
│   └── editorial.mapper.ts         # Conversão editorial_contents Row <-> EditorialContent
├── services/
│   ├── auth.service.ts             # login, logout, getSession, getProfile, onAuthStateChange
│   ├── clients.service.ts          # CRUD completo de clientes
│   └── editorial.service.ts        # CRUD, listagem por período (Calendário) e status (Pendências)
├── contexts/
│   └── AuthContext.tsx             # Provedor global de sessão, usuário autenticado e profile
├── hooks/
│   ├── useAuth.ts                  # Acesso tipado ao AuthContext
│   ├── useClients.ts               # Estado, mutações e cache de clientes
│   └── useEditorialContents.ts     # Estado, filtros e mutações de conteúdos editoriais
└── components/
    └── auth/
        └── ProtectedRoute.tsx      # Guard de rota autenticada (preservando layout atual)
```

---

## 5. ESTRATÉGIA DE AUTENTICAÇÃO E SESSÃO

### 5.1 Fluxo de Autenticação (`Supabase Auth`)
- **Método:** `supabase.auth.signInWithPassword({ email, password })`.
- **Armazenamento de Token:** Gerenciado nativamente pelo `@supabase/supabase-js` (`persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`). Nenhuma manipulação manual de `localStorage` ou decodificação manual de JWT deve ser escrita.
- **Carga de Perfil (`profiles`):** Imediatamente após obter uma `Session` válida, o `AuthContext` consulta `public.profiles` filtrando pelo `id` do usuário autenticado (`auth.uid()`).

### 5.2 Ciclo de Vida da Sessão
1. **Inicialização (`App Mount`):** `AuthContext` inicia com `isLoading: true`, executa `supabase.auth.getSession()` e registra o listener `supabase.auth.onAuthStateChange()`.
2. **Eventos Monitorados:**
   - `INITIAL_SESSION` / `SIGNED_IN`: Carrega `profile` correspondente e libera a árvore de rotas protegidas.
   - `TOKEN_REFRESHED`: Mantém estado atual sem provocar flicker ou desmontagem de tela.
   - `SIGNED_OUT`: Limpa estado de usuário/perfil e redireciona para a tela de login existente.
3. **Proteção de Rotas (`ProtectedRoute`):**
   - Se `isLoading === true`: Exibe o indicador de carregamento já padronizado no design system (sem quebrar layout).
   - Se `!session`: Redireciona para `/login` preservando `location.state.from`.
   - Se `session` presente, mas `profile` ausente (erro de integridade): Encerra sessão com mensagem controlada.

---

## 6. SEGURANÇA E GOVERNANÇA DE DADOS

1. **Proibição Absoluta de Chaves Privilegiadas:** `service_role` key jamais deve constar em arquivos `.env` do frontend, código-fonte ou build Vite. Apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` são permitidas.
2. **Confiança Zero no Client (Zero-Trust UI):** Ocultar botões ou rotas no React não substitui RLS. Todas as tabelas (`profiles`, `clients`, `editorial_contents`) operam sob políticas RLS no PostgreSQL.
3. **Prevenção de Over-fetching:** Todas as queries nos services devem declarar explicitamente as colunas necessárias em `.select(...)` em vez de `.select('*')`, reduzindo payload e exposição acidental de metadados.
4. **Sanitização e Validação:** Entradas de formulários são validadas nos services (tipos, strings vazias, formatos de data ISO) antes do envio ao PostgREST.
5. **Logs Seguros:** Erros enviados ao console ou observabilidade jamais devem imprimir tokens, senhas ou payloads sensíveis completos.
