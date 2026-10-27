# PDVTEC — Sistema Interno de Automação Comercial

Sistema web interno para gestão de clientes, propostas comerciais, contratos, tarefas operacionais e relatórios.

## Stack

- **Next.js** (App Router) + **TypeScript** (`strict: true`)
- **Tailwind CSS** + **shadcn/ui** (Base UI)
- **Supabase** (PostgreSQL, Auth, Storage)
- **@react-pdf/renderer** — geração de PDFs de propostas
- **@dnd-kit** — Kanban drag-and-drop
- **@tanstack/react-table** — tabelas com ordenação, filtros e paginação
- **SheetJS (xlsx)** — exportação XLSX e CSV
- **BrasilAPI** — consulta de CNPJ
- **Zod** + **React Hook Form** — validação de formulários
- **sonner** — notificações toast

## Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com) (tier gratuito)

## Instalação

```bash
git clone <repo-url>
cd pdvtec-organizacao
npm install
cp .env.example .env.local
```

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. Copie a **URL** e a **Anon Key** de **Settings → API** para `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

3. Execute as migrations, **em ordem**, no **SQL Editor** do Supabase:
   - `supabase/migrations/00001_initial_schema.sql`
   - `supabase/migrations/00002_kanban_boards.sql` (múltiplos quadros e limites WIP)
   - `supabase/migrations/00003_kanban_evolution.sql` (vincula tarefas antigas a um quadro e prepara as métricas)

Isso criará todas as tabelas, índices, triggers, políticas RLS, bucket de storage e funções auxiliares.

## Criar o primeiro administrador

1. No Supabase Dashboard, vá em **Authentication → Users → Add User**
2. Crie o usuário com e-mail e senha
3. O trigger `on_auth_user_created` criará automaticamente o perfil com role `operacional`
4. No **Table Editor → profiles**, altere o `role` do usuário para `admin`
5. Os demais colaboradores podem ser cadastrados pelo próprio sistema em **Usuários** (`/admin/usuarios`), que exige `SUPABASE_SERVICE_ROLE_KEY` configurada no servidor

## Execução local

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000). Você será redirecionado para o login.

## Build de produção

```bash
npm run build
npm start
```

## Estrutura do projeto

```
src/
  app/
    login/              # Página de login
    (dashboard)/        # Layout autenticado
      dashboard/        # Dashboard com KPIs
      clientes/         # CRUD de clientes + consulta CNPJ
      propostas/        # Propostas comerciais + PDF
      contratos/        # Contratos + upload de documentos
      tarefas/          # Kanban de tarefas
      relatorios/       # Tabelas + exportação XLSX/CSV
      configuracoes/    # Gestão de usuários + auditoria
  components/
    ui/                 # Componentes shadcn/ui
    layout/             # Sidebar, header, theme toggle
    forms/              # Formulários (cliente, proposta, tarefa)
    kanban/             # Board, column, card
    pdf/                # Template PDF de proposta
  lib/
    supabase/           # Clients (browser, server, middleware)
    validations/        # Schemas Zod, validação CNPJ
    permissions/        # Controle de acesso por role
    audit/              # Helper de audit log
    exports/            # Exportação XLSX/CSV
  services/             # Server Actions (clientes, propostas, contratos, tarefas)
  hooks/                # useAuth
  types/                # Tipos TypeScript
supabase/
  migrations/           # SQL com tabelas, RLS, triggers
```

## Módulos

| Módulo | Descrição |
|--------|-----------|
| **Dashboard** | KPIs: clientes, propostas ativas, contratos, tarefas, receita mensal |
| **Clientes** | CRUD com consulta CNPJ via BrasilAPI, validação de dígitos verificadores |
| **Propostas** | Criação, edição, pipeline (Rascunho → Enviada → Aprovada/Recusada), PDF |
| **Contratos** | Registro a partir de proposta aprovada, upload de PDF, download com Signed URL (15 min) |
| **Tarefas** | Kanban com múltiplos quadros, raias (prioridade, responsável, cliente/contrato), limites WIP, métricas (Lead Time, Cycle Time, Throughput) e arrasto com UI otimista |
| **Relatórios** | Tabelas com busca, ordenação, paginação + exportação XLSX e CSV |
| **Usuários** | Cadastro de colaboradores (nome, e-mail, senha provisória, cargo) e alteração de cargo — somente admin |
| **Configurações** | Visualizador de audit logs (admin) |

## Papéis

| Papel | Permissões |
|-------|-----------|
| **admin** | Acesso total, gestão de usuários, auditoria, exclusões |
| **comercial** | Clientes (CRUD), propostas (CRUD + status), contratos (criar, editar, upload) |
| **operacional** | Consulta de clientes/contratos, tarefas (CRUD + movimentação) |

## Segurança

- RLS habilitado em todas as tabelas com políticas por papel
- Bucket de storage privado com políticas
- Signed URLs de 900s geradas no servidor após validação
- Validação de upload: 15 MB max, MIME `application/pdf`, assinatura `%PDF-`
- Audit logs append-only (UPDATE/DELETE bloqueados por política)
- Validação Zod em server actions
- Middleware protege todas as rotas privadas
- Tokens de sessão em cookies seguros (nunca localStorage)

## Tema

Suporte completo a modo claro e escuro com persistência no localStorage.

- Azul institucional: `#0284C7`
- Tokens CSS definidos em `globals.css`

## Deploy

Compatível com Vercel (tier gratuito) ou qualquer plataforma que suporte Next.js.

Configure as variáveis de ambiente no painel de deploy.

## Limites do tier gratuito do Supabase

- 500 MB de banco de dados
- 1 GB de storage
- 50.000 usuários ativos mensais
- 2 GB de transferência
- Pausado após 1 semana de inatividade

## Fora do escopo (MVP)

- Assinatura eletrônica
- WhatsApp / mensageria
- E-mail transacional pago
- Bureau de crédito
- Pagamentos / checkout / Pix
- Portal externo para clientes
