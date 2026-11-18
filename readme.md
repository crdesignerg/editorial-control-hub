# Editorial Control Hub — OP Growth Digital

Central administrativa de gestão editorial para acompanhamento visual de planejamentos, produção, aprovações, agendamentos e entregas por cliente.

> **Status Atual:** Protótipo Frontend completo em estado local (sem backend ou persistência em banco de dados).

---

## 1. Stack Tecnológica

- **React 18** + **TypeScript**
- **Vite** (bundler e servidor de desenvolvimento)
- **Tailwind CSS v3** (`darkMode: 'class'`)
- **Lucide React** (ícones de interface)
- **Google Fonts (`Sora`)** + **Logo SVG Vetorial OP Growth** embutida

---

## 2. Instalação e Execução Local no VS Code

1. Crie a pasta do projeto `editorial-control-hub` e salve os arquivos conforme a estrutura:
   ```text
   editorial-control-hub/
   ├── index.html
   ├── package.json
   ├── postcss.config.js
   ├── tailwind.config.js
   ├── tsconfig.json
   ├── tsconfig.node.json
   ├── vite.config.ts
   ├── README.md
   └── src/
       ├── App.tsx
       ├── index.css
       ├── main.tsx
       └── vite-env.d.ts
   ```

2. Abra o terminal integrado no VS Code dentro da pasta raiz e instale as dependências:
   ```bash
   npm install
   ```

3. Inicie o servidor local de desenvolvimento:
   ```bash
   npm run dev
   ```

4. Para gerar e validar o build de produção localmente:
   ```bash
   npm run build
   ```

> **Nota:** A compilação via `npm run build` não foi executada no ambiente de exportação e deve ser validada localmente após o `npm install`.

---

## 3. Credenciais de Demonstração (Simuladas)

- **E-mail:** `camila@opgrowth.com.br`
- **Senha:** `OpGrowth@2026`

---

## 4. Mapeamento para Integração com Backend e Banco de Dados

Todos os dados e fluxos abaixo operam atualmente **100% em memória local (`useState`)** no arquivo `src/App.tsx` e devem ser conectados às APIs na próxima etapa:

1. **Autenticação e Sessão (`AuthPortal`):**
   - `mockUsers` armazena usuários apenas na memória da aba atual.
   - `handleLoginSubmit`, `handleRegisterSubmit`, `handleForgotSubmit` e `handleResetSubmit` usam `setTimeout` para simular latência de rede.
   - `currentUser` deve ser substituído por token JWT / sessão persistente (cookies HttpOnly ou provider de auth).

2. **Carteira de Clientes (`clients` / `ClientFormModal`):**
   - Inicializada por `createInitialClients()`.
   - `handleSaveClient` cria e edita clientes apenas no estado React (`POST /clients`, `PATCH /clients/:id`).

3. **Publicações Editoriais (`contents` / `NewContentModal` / Slide-over Drawer):**
   - Inicializada por `createInitialContents()` com datas dinâmicas relativas à segunda-feira da semana atual.
   - `handleCreateContent`, `handleUpdateContent` e `handleDeleteContent` devem ser conectados aos endpoints CRUD de conteúdos (`POST /contents`, `PATCH /contents/:id`, `DELETE /contents/:id`).

4. **Sugestão de Refatoração Modular Pós-Exportação:**
   - `src/types/editorial.ts` — Interfaces (`AuthUser`, `Client`, `EditorialContent`, `ContentStatus`, `ContentFormat`)
   - `src/services/authService.ts` e `src/services/editorialService.ts` — Camada HTTP / SDK do banco
   - `src/components/auth/AuthPortal.tsx` — Fluxo de login, cadastro e recuperação
   - `src/components/modals/ClientFormModal.tsx` e `NewContentModal.tsx` — Modais de cadastro