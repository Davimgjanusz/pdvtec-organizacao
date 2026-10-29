Spec.md — Especificação Técnica de Implementação: Sistema Interno PDVTEC

1. Visão Geral do Produto e Escopo

O Sistema PDVTEC é uma aplicação web corporativa de uso interno para a equipe da PDVTEC. O sistema centraliza a gestão de clientes, o pipeline de propostas comerciais, a custódia segura de contratos, a esteira de tarefas e suporte via Kanban avançado, relatórios e conciliação financeira, substituindo fluxos manuais e planilhas descentralizadas.

Restrição de Negócio Mandatória: O sistema é uma ferramenta operacional e administrativa de uso interno. Não possui módulos de cobrança, checkout, pagamentos com cartão, Pix ou intermediação bancária.

Orçamento: Custo de infraestrutura inicial de R$ 0,00 (100% suportado por tecnologias de código aberto e camadas gratuitas de infraestrutura em nuvem).

2. Pilha Tecnológica e Bibliotecas (100% Open Source / Camadas Gratuitas)

Framework Core: Next.js (App Router, Server Actions, Route Handlers) com React e Node.js runtime.

Linguagem: TypeScript em modo estrito (strict: true), garantindo tipagem fim a fim sem o uso de any.

Estilização e Componentes de UI:

Tailwind CSS.

shadcn/ui (componentes baseados em Radix UI incorporados diretamente na base de código).

lucide-react para biblioteca de ícones padronizada.

Gerenciamento de Formulários e Validação:

react-hook-form para manipulação performática de estados de formulário.

zod para inferência de tipos e validação estrita de esquemas em tempo de execução.

react-number-format para manipulação de máscaras financeiras (R$ 0,00) e documentais (CNPJ/CPF, CEP e telefone).

Quadro de Tarefas (Kanban Avançado): @dnd-kit/core e @dnd-kit/sortable com suporte a full-card dragging e Optimistic UI.

Tabelas e Exportação de Relatórios:

@tanstack/react-table para paginação, ordenação e filtros dinâmicos de dados.

xlsx (SheetJS) para conversão e download de dados em .xlsx e .csv no navegador.

Geração de Documentos: @react-pdf/renderer para geração direta de PDFs de propostas comerciais.

Feedbacks e Notificações: sonner para disparos de avisos e toasts acessíveis.

Banco de Dados, Autenticação e Storage: Supabase (PostgreSQL, Supabase Auth via JWT, Row Level Security e Buckets Privados de Storage).

APIs Públicas Gratuitas: BrasilAPI (https://brasilapi.com.br/api/cnpj/v1/{cnpj}) para busca e autopreenchimento de cadastros de empresas.

3. Identidade Visual, Tipografia e Conforto Ergonômico

3.1 Tipografia Corporativa Padrão

A família de fontes da aplicação deve ser padronizada para Arial, Helvetica, sans-serif (ou font-sans limpa) para garantir legibilidade impecável em tabelas, formulários, relatórios e dados financeiros.

3.2 Modo Claro Confortável (Anti-Ofuscamento)

O fundo do body no modo claro utiliza obrigatoriamente um tom Off-White profissional (#F4F6F8 ou #F1F5F9), eliminando o cansaço visual por ofuscamento de branco puro.

Cartões, tabelas, raias e modais utilizam branco puro (#FFFFFF) com bordas suaves (#E2E8F0) e sombras delicadas (shadow-sm).

O modo escuro mantém a paleta em #0B1120 (background) e #151E32 (superfícies).

3.3 Logotipo Fiel e Correção de Preenchimento ("Pontos sem cor")

O componente LogoPDVTEC (src/components/layout/logo-pdvtec.tsx) e o ícone do navegador (app/icon.svg / app/apple-icon.png) devem renderizar perfeitamente a tipografia Cooper Black, com o globo esférico azul volumétrico, feixe de luz central em ciano/azul-celeste e sem falhas em áreas brancas (preenchimento sólido em #FFFFFF).

4. Arquitetura de Segurança, Permissões e LGPD

4.1 Controle de Acesso Baseado em Papéis (RBAC)

admin: Acesso total ao sistema, painel de conciliação financeira, gestão de usuários, auditoria e exclusão controlada.

comercial: Gestão de clientes, propostas comerciais e contratos.

operacional: Consulta de clientes/contratos e controle ativo do quadro Kanban (com restrição de escopo opcional por responsável).

4.2 Políticas de Row Level Security (RLS) no PostgreSQL

Todas as tabelas do banco contam com ALTER TABLE <nome> ENABLE ROW LEVEL SECURITY;.

Acesso anônimo terminantemente proibido.

4.3 Custódia Segura de Arquivos no Storage

Bucket pdvtec-documents estritamente privado.

Acesso a minutas e contratos via URLs assinadas temporárias (Signed URLs) com validade de 15 minutos (900 segundos) geradas via servidor.

5. Modelagem de Dados Relacional (PostgreSQL Schema)

Execute o script a seguir no SQL Editor do Supabase para atualizar a base de dados:

-- Extensões necessárias
create extension if not exists "uuid-ossp";

-- 1. Perfis de Usuários
create table if not exists profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text not null,
    role text not null check (role in ('admin', 'comercial', 'operacional')),
    avatar_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Clientes Corporativos
create table if not exists clients (
    id uuid primary key default uuid_generate_v4(),
    corporate_name text not null,
    trade_name text,
    cnpj text unique not null,
    contact_name text not null,
    contact_email text not null,
    contact_phone text not null,
    zip_code text,
    street text,
    neighborhood text,
    city text,
    state text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Quadros Kanban (Multi-Boards)
create table if not exists kanban_boards (
    id uuid primary key default uuid_generate_v4(),
    title text not null,
    description text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Colunas Kanban com Limites de WIP
create table if not exists kanban_columns (
    id uuid primary key default uuid_generate_v4(),
    board_id uuid not null references kanban_boards(id) on delete cascade,
    title text not null,
    slug text not null,
    position integer default 0,
    wip_limit integer default null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Propostas Comerciais
create table if not exists proposals (
    id uuid primary key default uuid_generate_v4(),
    client_id uuid not null references clients(id) on delete cascade,
    user_id uuid not null references profiles(id),
    title text not null,
    billing_type text not null check (billing_type in ('one_off', 'recurring', 'hybrid')),
    setup_value numeric(12, 2) default 0.00,
    recurring_value numeric(12, 2) default 0.00,
    status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'rejected')),
    valid_until date not null,
    scope_description text not null,
    notes text,
    document_path text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Contratos Concluídos
create table if not exists contracts (
    id uuid primary key default uuid_generate_v4(),
    proposal_id uuid unique references proposals(id) on delete set null,
    client_id uuid not null references clients(id) on delete cascade,
    contract_number text unique not null,
    status text not null default 'active' check (status in ('active', 'pending_renewal', 'expired', 'cancelled')),
    start_date date not null,
    end_date date not null,
    monthly_amount numeric(12, 2) default 0.00,
    file_storage_path text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Tarefas Operacionais (Kanban Avançado)
create table if not exists tasks (
    id uuid primary key default uuid_generate_v4(),
    board_id uuid references kanban_boards(id) on delete cascade,
    column_id uuid references kanban_columns(id) on delete cascade,
    contract_id uuid references contracts(id) on delete set null,
    assigned_to uuid references profiles(id) on delete set null,
    title text not null,
    description text,
    column_status text not null default 'todo',
    priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
    color_tag text default 'default',
    due_date date,
    position integer default 0,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Conciliação Financeira (Importação de Planilhas)
create table if not exists financial_reconciliations (
    id uuid primary key default uuid_generate_v4(),
    partner_name text not null,
    reference_month text not null,
    client_name_external text not null,
    contract_id uuid references contracts(id) on delete set null,
    expected_amount numeric(12, 2) not null default 0.00,
    imported_amount numeric(12, 2) not null default 0.00,
    status text not null default 'pending' check (status in ('matched', 'divergent', 'missing_in_system', 'missing_in_spreadsheet')),
    imported_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Trilha de Auditoria
create table if not exists audit_logs (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id),
    action text not null,
    table_name text not null,
    record_id uuid not null,
    details jsonb,
    ip_address text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS
alter table profiles enable row level security;
alter table clients enable row level security;
alter table kanban_boards enable row level security;
alter table kanban_columns enable row level security;
alter table proposals enable row level security;
alter table contracts enable row level security;
alter table tasks enable row level security;
alter table financial_reconciliations enable row level security;
alter table audit_logs enable row level security;


6. Módulos Funcionais e Requisitos Técnicos

6.1 Gestão de Usuários (Painel Admin)

Rota restrita /admin/usuarios para administradores criarem colaboradores preenchendo Nome, E-mail, Senha Provisória e Cargo (admin, comercial, operacional).

Server Action utilizando o cliente Supabase Admin (SUPABASE_SERVICE_ROLE_KEY) com supabase.auth.admin.createUser.

6.2 Kanban Avançado (Multi-Boards, Raias, WIP Limits, Métricas e UI Otimista)

Full-Card Dragging: Atributos e ouvintes do @dnd-kit no contêiner raiz do cartão, permitindo arraste em todo o corpo (cursor-grab / active:cursor-grabbing).

Optimistic UI: Atualização instantânea na tela (0ms) ao soltar o card, com persistência assíncrona em segundo plano e rollback silencioso em caso de falha.

Múltiplos Quadros e Raias (Swimlanes): Suporte a troca de quadros e agrupamento horizontal opcional por Prioridade, Responsável ou Cliente.

Limites de WIP: Alerta visual de estouro de limite configurado no cabeçalho da coluna.

Painel de Métricas: Cálculo automático de Lead Time, Cycle Time e Throughput.

6.3 Módulo de Conciliação Financeira

Rota exclusiva para Administradores (/dashboard/financeiro/conciliacao) com upload de arquivos .xlsx, .xls e .csv.

Leitura via SheetJS (xlsx) e auditoria comparativa automática com os contratos internos cadastrados.