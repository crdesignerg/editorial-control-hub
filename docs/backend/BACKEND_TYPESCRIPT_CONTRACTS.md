# BACKEND TYPESCRIPT CONTRACTS — EDITORIAL CONTROL HUB

## 1. CONVENÇÕES DE TIPAGEM E PREMISSAS

- **Separação Estrita de Camadas:**
  - `Database` (`database.types.ts`): Espelho exato do PostgreSQL (gerado via Supabase CLI).
  - `Domain` (`domain.types.ts`): Modelos limpos em camelCase consumidos pelos componentes React existentes.
  - `API / DTOs` (`api.types.ts`): Payloads de entrada (`Create*`, `Update*`), filtros de consulta e envelopes de resultado.
- **Colunas Pendentes de Confirmação:** Campos marcados com `// [SCHEMA_PENDING]` representam atributos esperados pelo domínio editorial que **devem ser conferidos** com o DDL real das tabelas `profiles`, `clients` e `editorial_contents` após a auditoria do Codex antes da compilação final.

---

## 2. CONTRATOS DE BANCO (`src/types/database.types.ts` — PLACEHOLDER ESTRUTURAL)

```typescript
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string; // UUID vinculado a auth.users.id
          email?: string | null; // [SCHEMA_PENDING]
          full_name?: string | null; // [SCHEMA_PENDING]
          role?: string | null; // [SCHEMA_PENDING]
          avatar_url?: string | null; // [SCHEMA_PENDING]
          created_at?: string;
          updated_at?: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      clients: {
        Row: {
          id: string;
          name: string; // [SCHEMA_PENDING]
          status?: string | null; // [SCHEMA_PENDING]
          segment?: string | null; // [SCHEMA_PENDING]
          contact_name?: string | null; // [SCHEMA_PENDING]
          contact_email?: string | null; // [SCHEMA_PENDING]
          notes?: string | null; // [SCHEMA_PENDING]
          created_at?: string;
          updated_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['clients']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['clients']['Insert']>;
      };
      editorial_contents: {
        Row: {
          id: string;
          client_id: string; // FK -> clients.id [SCHEMA_PENDING]
          title: string; // [SCHEMA_PENDING]
          description?: string | null; // [SCHEMA_PENDING]
          channel?: string | null; // [SCHEMA_PENDING]
          format?: string | null; // [SCHEMA_PENDING]
          status: string; // [SCHEMA_PENDING]
          scheduled_date?: string | null; // ISO Date / Timestamptz [SCHEMA_PENDING]
          assignee_id?: string | null; // FK -> profiles.id [SCHEMA_PENDING]
          created_by?: string | null; // FK -> profiles.id [SCHEMA_PENDING]
          created_at?: string;
          updated_at?: string;
        };
        Insert: Omit<
          Database['public']['Tables']['editorial_contents']['Row'],
          'id' | 'created_at' | 'updated_at'
        > & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['editorial_contents']['Insert']>;
      };
    };
  };
}
```

---

## 3. CONTRATOS DE DOMÍNIO (`src/types/domain.types.ts`)

```typescript
export type UserRole = 'admin' | 'editor' | 'member' | string;

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt?: string;
}

export interface Client {
  id: string;
  name: string;
  status: string;
  segment?: string;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EditorialClientSummary {
  id: string;
  name: string;
}

export interface EditorialContent {
  id: string;
  clientId: string;
  client?: EditorialClientSummary;
  title: string;
  description?: string;
  channel?: string;
  format?: string;
  status: string;
  scheduledDate?: string;
  assigneeId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

---

## 4. CONTRATOS DE API, FILTROS E DTOS (`src/types/api.types.ts`)

```typescript
import type { AppError } from '../lib/errors';

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  profile: import('./domain.types').UserProfile | null;
  error: AppError | null;
}

export interface ClientFilters {
  search?: string;
  status?: string;
}

export interface CreateClientInput {
  name: string;
  status?: string;
  segment?: string;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
}

export type UpdateClientInput = Partial<CreateClientInput>;

export interface EditorialFilters {
  clientId?: string;
  status?: string;
  statuses?: string[];
  dateFrom?: string;
  dateTo?: string;
  channel?: string;
}

export interface CreateEditorialInput {
  clientId: string;
  title: string;
  description?: string;
  channel?: string;
  format?: string;
  status: string;
  scheduledDate?: string;
  assigneeId?: string;
}

export type UpdateEditorialInput = Partial<CreateEditorialInput>;
```

---

## 5. CONTRATOS DOS MAPPERS (`src/mappers/*.ts`)

```typescript
// Exemplo: src/mappers/editorial.mapper.ts
import type { Database } from '../types/database.types';
import type { EditorialContent } from '../types/domain.types';
import type { CreateEditorialInput, UpdateEditorialInput } from '../types/api.types';

type EditorialRow = Database['public']['Tables']['editorial_contents']['Row'] & {
  clients?: { id: string; name: string } | null;
};
type EditorialInsert = Database['public']['Tables']['editorial_contents']['Insert'];
type EditorialUpdate = Database['public']['Tables']['editorial_contents']['Update'];

export function mapEditorialRowToDomain(row: EditorialRow): EditorialContent {
  return {
    id: row.id,
    clientId: row.client_id,
    client: row.clients ? { id: row.clients.id, name: row.clients.name } : undefined,
    title: row.title,
    description: row.description ?? undefined,
    channel: row.channel ?? undefined,
    format: row.format ?? undefined,
    status: row.status,
    scheduledDate: row.scheduled_date ?? undefined,
    assigneeId: row.assignee_id ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCreateEditorialToInsert(input: CreateEditorialInput): EditorialInsert {
  return {
    client_id: input.clientId,
    title: input.title.trim(),
    description: input.description ?? null,
    channel: input.channel ?? null,
    format: input.format ?? null,
    status: input.status,
    scheduled_date: input.scheduledDate ?? null,
    assignee_id: input.assigneeId ?? null,
  };
}

export function mapUpdateEditorialToPatch(input: UpdateEditorialInput): EditorialUpdate {
  const patch: EditorialUpdate = {};
  if (input.clientId !== undefined) patch.client_id = input.clientId;
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description;
  if (input.channel !== undefined) patch.channel = input.channel;
  if (input.format !== undefined) patch.format = input.format;
  if (input.status !== undefined) patch.status = input.status;
  if (input.scheduledDate !== undefined) patch.scheduled_date = input.scheduledDate;
  if (input.assigneeId !== undefined) patch.assignee_id = input.assigneeId;
  return patch;
}
```
