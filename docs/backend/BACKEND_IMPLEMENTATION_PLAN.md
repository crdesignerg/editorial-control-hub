# BACKEND IMPLEMENTATION PLAN — CODEX EXECUTION PLAYBOOK

## 1. OBJETIVO DO PLANO

Este documento orienta a execução sequencial pelo **Codex no VS Code** imediatamente após a conclusão da auditoria de segurança e schema do Supabase. Cada fase possui pré-condições, arquivos alvo, ações específicas e critérios de aceite objetivos.

### Regras de Execução para o Codex
1. **Não alterar layout, classes Tailwind ou estrutura visual dos componentes existentes.**
2. **Não modificar o schema do banco de dados nem políticas RLS** a partir do frontend.
3. **Nunca inserir `service_role` key** em nenhum arquivo do repositório.
4. **Executar `npm run build` e `tsc --noEmit` ao final de cada fase** antes de avançar.

---

## 2. FASE 0 — PRÉ-CONDIÇÕES E VALIDAÇÃO DE SCHEMA (GATE DE ENTRADA)

**Status:** Aguardando conclusão da auditoria de banco.

### Checklist de Desbloqueio
- [ ] Auditoria de RLS nas tabelas `profiles`, `clients` e `editorial_contents` concluída e aprovada.
- [ ] DDL real das três tabelas inspecionado (nomes exatos das colunas, tipos, nulabilidade e FKs).
- [ ] Credenciais públicas do projeto (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`) disponíveis para `.env.local`.
- [ ] Usuário administrador de teste validado no Supabase Auth + registro correspondente em `public.profiles`.

---

## 3. FASE 1 — FUNDAÇÃO DE INFRAESTRUTURA E TIPAGEM

### Arquivos a Criar / Atualizar
- `.env.example` (criar)
- `.env.local` (criar localmente, verificar presença no `.gitignore`)
- `src/types/database.types.ts` (gerar via CLI ou alinhar com DDL real)
- `src/types/domain.types.ts` (criar conforme `BACKEND_TYPESCRIPT_CONTRACTS.md`)
- `src/types/api.types.ts` (criar conforme `BACKEND_TYPESCRIPT_CONTRACTS.md`)
- `src/lib/supabase.ts` (criar cliente singleton)
- `src/lib/errors.ts` (criar normalizador `AppError`)

### Instruções para o Codex
1. Verificar se `@supabase/supabase-js` está instalado no `package.json`; se ausente, instalar.
2. Inspecionar os tipos e mocks atuais do frontend para garantir que `domain.types.ts` preserve 100% das propriedades esperadas pelas telas existentes.
3. Gerar `src/types/database.types.ts` com os tipos reais do banco.
4. Implementar `src/lib/supabase.ts` e `src/lib/errors.ts`.

### Critérios de Aceite
- `npx tsc --noEmit` passa sem erros.
- Nenhuma chave secreta (`service_role`) presente no código ou `.env.example`.

---

## 4. FASE 2 — MAPPERS E CAMADA DE SERVIÇOS (DATA ACCESS)

### Arquivos a Criar
- `src/mappers/profile.mapper.ts`
- `src/mappers/client.mapper.ts`
- `src/mappers/editorial.mapper.ts`
- `src/services/auth.service.ts`
- `src/services/clients.service.ts`
- `src/services/editorial.service.ts`

### Instruções para o Codex
1. Mapear cada coluna real de `database.types.ts` para `domain.types.ts` nos respectivos mappers.
2. Implementar `auth.service.ts` (`signIn`, `signOut`, `getSession`, `getCurrentProfile`).
3. Implementar `clients.service.ts` (`list`, `getById`, `create`, `update`, `remove`).
4. Implementar `editorial.service.ts` (`list` com suporte a filtros de período/status/cliente, `getById`, `create`, `update`, `updateStatus`, `remove`).
5. Garantir que todos os services capturem erros do Supabase e lancem `AppError` via `normalizeSupabaseError`.

### Critérios de Aceite
- Nenhum componente UI importa `supabase` diretamente; todo acesso passa pelos services.
- Queries utilizam colunas explícitas ou relações tipadas sem `any`.

---

## 5. FASE 3 — AUTENTICAÇÃO REAL E PROTEÇÃO DE ROTAS

### Arquivos a Criar / Modificar
- `src/contexts/AuthContext.tsx` (criar)
- `src/hooks/useAuth.ts` (criar)
- `src/components/auth/ProtectedRoute.tsx` (criar)
- Tela de Login existente e Roteador principal (`App.tsx` ou `routes.tsx`) (integrar)

### Instruções para o Codex
1. Inspecionar como o login simulado atual funciona (contexto, estado local ou rota).
2. Substituir a lógica mockada de login pela chamada `authService.signIn(email, password)`, mantendo exatamente o mesmo formulário e feedback visual.
3. Envolver as rotas internas (*Dashboard, Calendário, Clientes, Produção, Pendências*) com `ProtectedRoute`.
4. Conectar o botão de logout existente ao `authService.signOut()`.

### Critérios de Aceite
- Login com credenciais do perfil administrador autentica via Supabase Auth e persiste sessão após `F5` (reload).
- Acesso direto a rotas internas sem sessão redireciona para login.
- Login com senha inválida exibe mensagem de erro tratada sem quebrar a UI.

---

## 6. FASE 4 — INTEGRAÇÃO DOS MÓDULOS DE NEGÓCIO (CLIENTES E EDITORIAL)

### Arquivos a Criar / Modificar
- `src/hooks/useClients.ts` (criar)
- `src/hooks/useEditorialContents.ts` (criar)
- Páginas/Componentes dos módulos:
  - **Clientes:** CRUD completo conectado ao `useClients`.
  - **Produção:** Listagem/Kanban/Tabela conectada ao `useEditorialContents` com criação, edição e mudança de status.
  - **Calendário:** Consulta filtrada por intervalo de datas (`dateFrom`, `dateTo`) via `useEditorialContents`.
  - **Pendências:** Consulta filtrada pelos status pendentes/revisão/atraso via `useEditorialContents`.
  - **Dashboard:** Indicadores e contadores calculados a partir dos dados reais retornados pelos hooks.

### Instruções para o Codex
1. Substituir um módulo por vez, preservando assinaturas de props e estados visuais de loading/empty/error.
2. Garantir atualização otimista ou revalidação imediata após `create`, `update` e `remove`.
3. Remover arquivos de mock obsoletos somente após validar todos os 5 módulos.

### Critérios de Aceite
- Criar, editar e excluir um cliente reflete imediatamente no PostgreSQL e persiste após reload.
- Criar, editar, reagendar ou alterar status de um conteúdo editorial reflete nos módulos *Produção*, *Calendário*, *Pendências* e *Dashboard*.
- Zero erros de runtime no console do navegador.

---

## 7. FASE 5 — VALIDAÇÃO FINAL E AUDITORIA DE QUALIDADE

### Checklist Final
- [ ] `npm run build` executado com sucesso (zero erros de TypeScript ou bundling).
- [ ] Nenhum dado simulado remanescente nos fluxos de produção.
- [ ] Teste de acesso não autenticado bloqueado tanto pelo `ProtectedRoute` quanto pelo RLS do Supabase.
- [ ] Teste de tratamento de falha de rede ou erro RLS exibindo feedback amigável ao usuário.
- [ ] Relatório final gerado pelo Codex listando arquivos criados, arquivos alterados e eventuais pendências.
