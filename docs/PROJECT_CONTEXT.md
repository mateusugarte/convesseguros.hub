# PROJECT CONTEXT

## Objetivo

Conves Hub e uma plataforma interna para operacao de seguros com gestao de fichas, apolices, imobiliarias, seguradoras e area comercial.

## Stack

- React + Vite
- Tailwind CSS
- React Router
- TanStack Query
- Supabase (PostgreSQL + Auth + RLS + Realtime)
- n8n self-hosted (automacoes)
- Vercel (deploy)

## Modulos

### Base

- Login [pronto]
- Dashboard [pronto]
- Configuracoes [pronto]

### Fichas (Fianca)

- Fichas [pronto]
- FichaDetalhePage [pronto]
- MinhasFichas [pronto]
- GestaoEmissoes [em andamento]
- Relatorio [pronto]

### Imobiliarias e seguradoras

- Imobiliarias [pronto]
- ImobiliariaDetalhe [pronto]
- Seguradoras [pronto]

### Apolices

- ApolicesDashboard [em andamento]
- ApoicesGestao [pronto]
- ApolicesLista [pronto]
- ApoliceDetalhe [pronto]

### Comercial

- ComercialDashboard [pronto]
- Pipeline [pronto]
- BaseLeads [pronto]
- LeadDetalhe [pronto]
- Vendas [pronto]
- Calendario [pronto]
- Jornadas [pronto]
- Campanhas [planejado]

### Auto (modulo ativo)

- AutoDashboard [pronto]
- AutoCotacoes [pronto]
- AutoCotacaoDetalhe [pronto]
- AutoCotacoesConsulta [pronto]
- AutoClientes [pronto]
- AutoEmissoes [pronto]
- AutoRenovacoes [pronto]
- AutoSinistros [pronto]

### Financeiro

- Financeiro [pronto]

## Convencoes

- Componentes funcionais.
- Escrita enxuta.
- Queries com campos explicitos e paginacao quando aplicavel.
- Credenciais apenas em variaveis de ambiente.
- `service_role` somente no n8n.
- RLS sempre ativa.

## UI

- Componentes pequenos e reutilizaveis.
- Layout consistente.
- Loading e erro visiveis.
- Responsividade como padrao.
- Preservar o design system existente.
- Design system: PRIMARY #1A3A6B, SECONDARY #2B5BA8, ACCENT #4A90D9, GOLD #C9A84C.
- Sidebar: Dark Workspace dual-column (rail de icones + painel expandido).

## Documentacao

- Cada pagina tem seu `CONTEXT.md` em `src/pages/**/CONTEXT.md`.
- Ler o `CONTEXT.md` da pagina antes de alterar a tela.
- Para novas paginas, usar `docs/CONTEXT_TEMPLATE.md`.
- Validar cobertura com `npm run check:page-contexts`.

## Ordem de leitura

1. `docs/IA_ORCHESTRATOR.md`
2. `docs/PROJECT_CONTEXT.md`
3. `ROADMAP.md`
4. `docs/CURRENT_TASK.md`
5. `src/pages/**/CONTEXT.md`
6. solicitacao do usuario

## Regras globais

- Nao alterar regras de negocio sem necessidade.
- Nao alterar banco, auth, rotas ou contratos sem aprovacao explicita.
- Registrar mudancas importantes em `artifacts/`.
- Manter o roadmap e o handoff atualizados.
- O processo vale para Claude Code e Codex.
