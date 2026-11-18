# Referência Técnica do Schema — Editorial Control Hub

Dicionário de dados completo, tipos enumerados, funções, triggers, políticas RLS e contratos esperados entre PostgreSQL (Supabase) e o frontend React/TypeScript.

> Tabelas, colunas, enums, constraints, índices, funções, triggers e policies consultados no remoto em READ ONLY em 18/11/2026. Baseline pública reconstruída em `20261118170000_initial_remote_schema.sql`. O estado remoto e o estado corrigido local diferem: ver [resultados](DATABASE_SECURITY_RESULTS.md).

---

## 1. Tipos Enumerados (`public`)

| Enum | Valores Permitidos | Utilização |
| :--- | :--- | :--- |
| `public.user_access_level` | `'admin'`, `'member'` | Controle de privilégios administrativos no RLS |
| `public.content_format_enum` | `'Estático'`, `'Carrossel'`, `'Reels'`, `'Stories'`, `'Vídeo'` | Formato da peça editorial (`ContentFormat`) |
| `public.content_status_enum` | `'Planejado'`, `'Em produção'`, `'Em revisão'`, `'Aguardando aprovação'`, `'Aprovado'`, `'Agendado'`, `'Publicado'`, `'Pendente'` | Estágio no fluxo operacional (`ContentStatus`) |

---

## 2. Dicionário de Tabelas

### 2.1 `public.profiles`
Armazena os perfis dos colaboradores internos da OP Growth Digital, sincronizados 1:1 com `auth.users`.

| Coluna | Tipo | Nulo | Default | Restrições / Índices |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | Não | — | `PRIMARY KEY`, `REFERENCES auth.users(id) ON DELETE CASCADE` |
| `name` | `VARCHAR(120)` | Não | — | `CHECK (char_length(trim(name)) >= 2)` |
| `email` | `VARCHAR(255)` | Não | — | `UNIQUE` |
| `role` | `VARCHAR(80)` | Não | `'Social Media & Conteúdo'` | Cargo funcional na agência |
| `access_level` | `user_access_level` | Não | `'member'` | Protegido por trigger contra auto-promoção; Índice composto `(access_level, is_active)` |
| `is_active` | `BOOLEAN` | Não | `TRUE` | Controle de bloqueio de ex-colaboradores; Índice composto `(access_level, is_active)` |
| `created_at` | `TIMESTAMPTZ` | Não | `NOW()` | Auditoria |
| `updated_at` | `TIMESTAMPTZ` | Não | `NOW()` | Atualizado via trigger `trg_profiles_updated_at` |

---

### 2.2 `public.clients`
Armazena as contas/clientes atendidos e suas metas mensais de publicação.

| Coluna | Tipo | Nulo | Default | Restrições / Índices |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | Não | `gen_random_uuid()` | `PRIMARY KEY` |
| `name` | `VARCHAR(150)` | Não | — | `CHECK (char_length(trim(name)) >= 1)`, Índice `idx_clients_name` |
| `segment` | `VARCHAR(120)` | Não | `'Marketing Digital'` | Segmento de mercado |
| `accent_color` | `VARCHAR(32)` | Não | `'rgb(37, 99, 235)'` | Cor de identificação visual (`rgb(...)` ou `#hex`) |
| `monthly_goal` | `INTEGER` | Não | `16` | `CHECK (monthly_goal >= 1 AND monthly_goal <= 500)` |
| `manager` | `VARCHAR(120)` | Não | `'Camila Rocha'` | Nome do gestor responsável |
| `created_by` | `UUID` | Sim | `NULL` | `REFERENCES public.profiles(id) ON DELETE SET NULL` |
| `created_at` | `TIMESTAMPTZ` | Não | `NOW()` | Auditoria |
| `updated_at` | `TIMESTAMPTZ` | Não | `NOW()` | Atualizado via trigger `trg_clients_updated_at` |

---

### 2.3 `public.editorial_contents`
Armazena todas as publicações, pautas, briefings, textos de arte, legendas e agendamentos.

| Coluna | Tipo | Nulo | Default | Restrições / Índices |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | Não | `gen_random_uuid()` | `PRIMARY KEY` |
| `client_id` | `UUID` | Não | — | `REFERENCES public.clients(id) ON DELETE RESTRICT`, Índice `(client_id, date)` |
| `title` | `VARCHAR(255)` | Não | — | `CHECK (char_length(trim(title)) >= 1)` |
| `date` | `DATE` | Não | — | Data programada (`YYYY-MM-DD`); Índices `(date, time)`, `(client_id, date)`, `(status, date)` |
| `time` | `VARCHAR(5)` | Não | `'12:00'` | `CHECK (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')` (`HH:mm`) |
| `format` | `content_format_enum` | Não | `'Carrossel'` | Formato da peça |
| `status` | `content_status_enum` | Não | `'Planejado'` | Status editorial; Índice `(status, date)` |
| `copy` | `TEXT` | Não | `''` | Legenda / Copy da publicação |
| `art_text` | `TEXT` | Não | `''` | Texto da arte / Roteiro de slides |
| `briefing` | `TEXT` | Não | `''` | Direcionamento criativo |
| `created_by` | `UUID` | Sim | `NULL` | `REFERENCES public.profiles(id) ON DELETE SET NULL` |
| `updated_by` | `UUID` | Sim | `NULL` | `REFERENCES public.profiles(id) ON DELETE SET NULL` |
| `created_at` | `TIMESTAMPTZ` | Não | `NOW()` | Auditoria |
| `updated_at` | `TIMESTAMPTZ` | Não | `NOW()` | Atualizado via trigger `trg_editorial_contents_updated_at` |

---

## 3. Funções e Triggers de Banco

| Objeto | Tipo | Tabela / Evento | Finalidade |
| :--- | :--- | :--- | :--- |
| `handle_updated_at()` | Função Trigger | `BEFORE UPDATE` (`profiles`, `clients`, `editorial_contents`) | Atualiza `updated_at = NOW()` automaticamente |
| `handle_new_auth_user()` | Função `SECURITY DEFINER` | `AFTER INSERT ON auth.users` (`on_auth_user_created`) | Cria linha em `public.profiles` sempre com `access_level = 'member'` e `is_active = TRUE` |
| `protect_profile_privileges()` | Função `SECURITY DEFINER` | `BEFORE UPDATE ON public.profiles` (`trg_protect_profile_privileges`) | No estado corrigido local, valida identidade e autorização dos campos; invariante do último admin usa contador privado transacional |
| `protect_last_admin_delete()` | Função `SECURITY DEFINER` | `BEFORE DELETE ON public.profiles` (`trg_protect_last_admin_delete`) | No estado corrigido local, valida autorização; contador AFTER e trigger em auth.users impedem perda do último admin |
| `is_active_team_member()` | Função `SQL STABLE SECURITY DEFINER` | Avaliada nas policies RLS | Retorna `TRUE` se `auth.uid()` pertence a perfil com `is_active = TRUE` |
| `is_active_admin()` | Função `SQL STABLE SECURITY DEFINER` | Avaliada nas policies RLS | Retorna `TRUE` se `auth.uid()` pertence a perfil com `access_level = 'admin'` e `is_active = TRUE` |

---

## 4. Matriz de Políticas Row Level Security (RLS)

Todas as tabelas possuem `ROW LEVEL SECURITY` habilitado. Usuários `anon` e usuários com `is_active = FALSE` possuem **acesso zero** em todas as operações.

Essa é a autorização pretendida. O remoto tinha policies com esses nomes, mas ACLs sem CRUD e com TRUNCATE para roles API. As migrações novas corrigem ACLs e proteção administrativa apenas no ambiente local testado. A implementação final usa contador privado transacional e bloqueio antes das operações de perfis, sem dispensar a invariante para manutenção; também protege DELETE em auth.users e TRUNCATE. As funções SECURITY DEFINER têm `search_path=pg_catalog,pg_temp`; helpers RLS são executáveis por authenticated e funções de trigger não são RPCs públicas. O hardening original com advisory lock permanece como histórico, substituído pelas versões novas. Ver limites de Auth emulado e teste de concorrência no relatório.

| Tabela | Operação | Política | Regra Efetiva |
| :--- | :--- | :--- | :--- |
| `public.profiles` | `SELECT` | `profiles_select_active_team` | Qualquer colaborador autenticado com `is_active = TRUE` |
| `public.profiles` | `INSERT` | *(Nenhuma policy)* | Bloqueado via API; inserções ocorrem apenas via trigger `on_auth_user_created` |
| `public.profiles` | `UPDATE` | `profiles_update_own_or_admin` | Próprio usuário ativo (`access_level = 'member'`) ou `admin` ativo (protegido por trigger) |
| `public.profiles` | `DELETE` | `profiles_delete_admin_only` | Apenas `admin` ativo (bloqueado se for o último admin ativo) |
| `public.clients` | `SELECT` | `clients_select_active_team` | Qualquer colaborador autenticado com `is_active = TRUE` |
| `public.clients` | `INSERT` | `clients_insert_active_team` | Qualquer colaborador autenticado com `is_active = TRUE` |
| `public.clients` | `UPDATE` | `clients_update_active_team` | Qualquer colaborador autenticado com `is_active = TRUE` |
| `public.clients` | `DELETE` | `clients_delete_admin_only` | Apenas `admin` ativo (sujeito a `ON DELETE RESTRICT` em `editorial_contents`) |
| `public.editorial_contents` | `SELECT` | `contents_select_active_team` | Qualquer colaborador autenticado com `is_active = TRUE` |
| `public.editorial_contents` | `INSERT` | `contents_insert_active_team` | Qualquer colaborador autenticado com `is_active = TRUE` |
| `public.editorial_contents` | `UPDATE` | `contents_update_active_team` | Qualquer colaborador autenticado com `is_active = TRUE` |
| `public.editorial_contents` | `DELETE` | `contents_delete_active_team` | Qualquer colaborador autenticado com `is_active = TRUE` |

---

## 5. Contratos de Dados Esperados pelo Frontend (atualmente em `src/app.tsx`)

`src/types/editorial.ts` não existe atualmente. `UserAccessLevel` e `accessLevel` abaixo são propostas para integração futura; não fazem parte do `AuthUser` atual. Demais campos e valores dos enums conferem com os tipos existentes. Nenhuma alteração no frontend foi feita.

```typescript
export type UserAccessLevel = 'admin' | 'member';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  accessLevel?: UserAccessLevel;
}

export type ContentFormat = 'Estático' | 'Carrossel' | 'Reels' | 'Stories' | 'Vídeo';

export type ContentStatus =
  | 'Planejado'
  | 'Em produção'
  | 'Em revisão'
  | 'Aguardando aprovação'
  | 'Aprovado'
  | 'Agendado'
  | 'Publicado'
  | 'Pendente';

export interface Client {
  id: string;
  name: string;
  segment: string;
  accentColor: string;
  monthlyGoal: number;
  manager: string;
}

export interface EditorialContent {
  id: string;
  clientId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  format: ContentFormat;
  status: ContentStatus;
  copy: string;
  artText: string;
  briefing: string;
}
```
