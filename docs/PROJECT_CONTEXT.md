# PROJECT CONTEXT

## Objetivo

Conves Hub e uma plataforma interna para operacao de seguros com gestao de fichas, apolices, imobiliarias, seguradoras e area comercial.

## Stack

- React
- Tailwind CSS
- React Router
- TanStack Query
- Supabase
- Vercel

## Modulos

### Base

- Login [pronto]
- Dashboard [pronto]
- Configuracoes [pronto]

### Fichas

- Fichas [pronto]
- FichaDetalhePage [pronto]
- MinhasFichas [pronto]
- GestaoEmissoes [planejado]
- Relatorio [pronto]

### Imobiliarias e seguradoras

- Imobiliarias [pronto]
- ImobiliariaDetalhe [pronto]
- Seguradoras [pronto]

### Apolices

- ApolicesDashboard [pronto]
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
