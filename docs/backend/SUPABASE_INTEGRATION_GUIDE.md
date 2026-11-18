# SUPABASE INTEGRATION GUIDE — EDITORIAL CONTROL HUB

## 1. CONFIGURAÇÃO DE AMBIENTE

### 1.1 Dependência Oficial
Instalar apenas o SDK oficial do Supabase (verificar se já consta no `package.json`):
```bash
npm install @supabase/supabase-js
```

### 1.2 Variáveis de Ambiente (`.env.local` e `.env.example`)
Criar `.env.example` versionado no repositório e `.env.local` (ignorado no `.gitignore`):

```env
# .env.example
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-public-key
# Alternativamente, use VITE_SUPABASE_PUBLISHABLE_KEY no lugar da anon key.
# Opcional no Vercel Preview: URL separada para homologação, sem alterar Production.
VITE_SUPABASE_HOMOLOGATION_URL=https://seu-projeto-homologacao.supabase.co
```

> **REGRA CRÍTICA:** Nunca utilize `SUPABASE_SERVICE_ROLE_KEY` no frontend. Qualquer variável prefixada com `VITE_` é embutida no bundle público gerado pelo Vite.

### 1.3 Cliente Singleton (`src/lib/supabase.ts`)
```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const isHomologation = import.meta.env.VITE_APP_ENV === 'homologation';
const supabaseUrl = isHomologation
  ? import.meta.env.VITE_SUPABASE_HOMOLOGATION_URL || import.meta.env.VITE_SUPABASE_URL
  : import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[Config Error] Configure VITE_SUPABASE_URL e uma chave pública Supabase.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
```

---

## 2. SINCRONIZAÇÃO DE TIPOS DO BANCO (APÓS AUDITORIA DO CODEX)

Assim que o Codex concluir a auditoria de schema e RLS no Supabase, gerar os tipos oficiais diretamente do projeto remoto:

```bash
npx supabase gen types typescript --project-id "<PROJECT_ID>" > src/types/database.types.ts
```

Isso elimina qualquer suposição sobre nomes de colunas, nulabilidade ou tipos `enum` do PostgreSQL.

---

## 3. CAMADA DE TRATAMENTO DE ERROS (`src/lib/errors.ts`)

Padroniza erros provenientes do `Supabase Auth` e do `PostgREST` (incluindo violações de RLS e constraints):

```typescript
import { AuthError, PostgrestError } from '@supabase/supabase-js';

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN_RLS'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status?: number;
  public readonly details?: string;

  constructor(message: string, code: ErrorCode, status?: number, details?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function normalizeSupabaseError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (isAuthError(error)) {
    if (error.status === 400 || error.status === 401) {
      return new AppError('Credenciais inválidas ou sessão expirada.', 'UNAUTHORIZED', error.status);
    }
    return new AppError(error.message || 'Erro de autenticação.', 'UNAUTHORIZED', error.status);
  }

  if (isPostgrestError(error)) {
    if (error.code === '42501') {
      return new AppError(
        'Você não tem permissão para realizar esta operação.',
        'FORBIDDEN_RLS',
        403,
        error.code
      );
    }
    if (error.code === 'PGRST116') {
      return new AppError('Registro não encontrado.', 'NOT_FOUND', 404, error.code);
    }
    if (error.code === '23505') {
      return new AppError('Já existe um registro com estes dados.', 'CONFLICT', 409, error.code);
    }
    if (error.code === '23503') {
      return new AppError(
        'Referência inválida ou registro vinculado existente.',
        'VALIDATION_ERROR',
        400,
        error.code
      );
    }
    return new AppError(
      'Erro ao processar operação no banco de dados.',
      'UNKNOWN_ERROR',
      400,
      error.code
    );
  }

  return new AppError('Falha inesperada de comunicação.', 'NETWORK_ERROR');
}

function isAuthError(err: unknown): err is AuthError {
  return typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'AuthApiError';
}

function isPostgrestError(err: unknown): err is PostgrestError {
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err && 'details' in err;
}
```

---

## 4. ESPECIFICAÇÃO DOS SERVIÇOS

### 4.1 Serviço de Autenticação (`src/services/auth.service.ts`)

```typescript
import { supabase } from '../lib/supabase';
import { normalizeSupabaseError, AppError } from '../lib/errors';
import { mapProfileRowToDomain } from '../mappers/profile.mapper';
import type { UserProfile } from '../types/domain.types';

export const authService = {
  async signIn(email: string, password: string) {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw new AppError('E-mail e senha são obrigatórios.', 'VALIDATION_ERROR');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw normalizeSupabaseError(error);
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw normalizeSupabaseError(error);
    return data.session;
  },

  async getCurrentProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw normalizeSupabaseError(error);
    return mapProfileRowToDomain(data);
  },
};
```

### 4.2 Serviço de Clientes (`src/services/clients.service.ts`)

```typescript
import { supabase } from '../lib/supabase';
import { normalizeSupabaseError } from '../lib/errors';
import {
  mapClientRowToDomain,
  mapCreateClientToInsert,
  mapUpdateClientToPatch,
} from '../mappers/client.mapper';
import type { Client } from '../types/domain.types';
import type { CreateClientInput, UpdateClientInput, ClientFilters } from '../types/api.types';

export const clientsService = {
  async list(filters?: ClientFilters): Promise<Client[]> {
    let query = supabase.from('clients').select('*');

    if (filters?.search) {
      query = query.ilike('name', `%${filters.search.trim()}%`);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw normalizeSupabaseError(error);
    return (data ?? []).map(mapClientRowToDomain);
  },

  async getById(id: string): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw normalizeSupabaseError(error);
    return mapClientRowToDomain(data);
  },

  async create(input: CreateClientInput): Promise<Client> {
    const payload = mapCreateClientToInsert(input);

    const { data, error } = await supabase
      .from('clients')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw normalizeSupabaseError(error);
    return mapClientRowToDomain(data);
  },

  async update(id: string, input: UpdateClientInput): Promise<Client> {
    const patch = mapUpdateClientToPatch(input);

    const { data, error } = await supabase
      .from('clients')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw normalizeSupabaseError(error);
    return mapClientRowToDomain(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) throw normalizeSupabaseError(error);
  },
};
```

### 4.3 Serviço de Conteúdos Editoriais (`src/services/editorial.service.ts`)

```typescript
import { supabase } from '../lib/supabase';
import { normalizeSupabaseError } from '../lib/errors';
import {
  mapEditorialRowToDomain,
  mapCreateEditorialToInsert,
  mapUpdateEditorialToPatch,
} from '../mappers/editorial.mapper';
import type { EditorialContent } from '../types/domain.types';
import type {
  CreateEditorialInput,
  UpdateEditorialInput,
  EditorialFilters,
} from '../types/api.types';

export const editorialService = {
  async list(filters?: EditorialFilters): Promise<EditorialContent[]> {
    let query = supabase
      .from('editorial_contents')
      .select('*, clients(id, name)');

    if (filters?.clientId) {
      query = query.eq('client_id', filters.clientId);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.statuses && filters.statuses.length > 0) {
      query = query.in('status', filters.statuses);
    }

    if (filters?.dateFrom) {
      query = query.gte('scheduled_date', filters.dateFrom);
    }

    if (filters?.dateTo) {
      query = query.lte('scheduled_date', filters.dateTo);
    }

    const { data, error } = await query.order('scheduled_date', { ascending: true });

    if (error) throw normalizeSupabaseError(error);
    return (data ?? []).map(mapEditorialRowToDomain);
  },

  async getById(id: string): Promise<EditorialContent> {
    const { data, error } = await supabase
      .from('editorial_contents')
      .select('*, clients(id, name)')
      .eq('id', id)
      .single();

    if (error) throw normalizeSupabaseError(error);
    return mapEditorialRowToDomain(data);
  },

  async create(input: CreateEditorialInput): Promise<EditorialContent> {
    const payload = mapCreateEditorialToInsert(input);

    const { data, error } = await supabase
      .from('editorial_contents')
      .insert(payload)
      .select('*, clients(id, name)')
      .single();

    if (error) throw normalizeSupabaseError(error);
    return mapEditorialRowToDomain(data);
  },

  async update(id: string, input: UpdateEditorialInput): Promise<EditorialContent> {
    const patch = mapUpdateEditorialToPatch(input);

    const { data, error } = await supabase
      .from('editorial_contents')
      .update(patch)
      .eq('id', id)
      .select('*, clients(id, name)')
      .single();

    if (error) throw normalizeSupabaseError(error);
    return mapEditorialRowToDomain(data);
  },

  async updateStatus(id: string, status: string): Promise<EditorialContent> {
    return this.update(id, { status });
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('editorial_contents')
      .delete()
      .eq('id', id);

    if (error) throw normalizeSupabaseError(error);
  },
};
```

---

## 5. ESTRATÉGIA DE SUBSTITUIÇÃO DOS DADOS SIMULADOS (STRANGLER FIG PATTERN)

1. **Mapeamento de Mocks Existentes:** Localizar todos os arquivos de dados fictícios (ex: `src/data/mockData.ts`, `src/mocks/*` ou estados locais nos componentes).
2. **Alinhamento de Contratos:** Garantir que as interfaces em `src/types/domain.types.ts` correspondam exatamente aos objetos que os componentes de *Dashboard, Calendário, Clientes, Produção e Pendências* já esperam receber.
3. **Migração por Módulo (Vertical Slices):**
   - **Slice 1 (Auth):** Substituir login mockado pelo `AuthContext` + `ProtectedRoute`. Manter dados editoriais simulados temporariamente enquanto valida o login real com o usuário administrador.
   - **Slice 2 (Clientes):** Conectar o módulo *Clientes* ao `useClients` -> `clientsService`. Validar listagem, criação, edição e exclusão.
   - **Slice 3 (Conteúdos Editoriais):** Conectar *Produção*, *Calendário*, *Pendências* e *Dashboard* ao `useEditorialContents` -> `editorialService`.
4. **Remoção dos Mocks:** Apenas após validação completa de cada módulo, remover os arquivos de mock não utilizados para evitar código morto.
