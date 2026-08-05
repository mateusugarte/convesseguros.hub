# Dashboard

## Propósito
Dashboard principal com KPIs de fichas, gráficos de produtividade e atividade recente dos orçamentistas.

## Componentes usados
- `ModalFinalizar` — finalizar ficha diretamente pelo dashboard
- `DashboardSkeleton` — loading state
- Recharts: AreaChart, BarChart, PieChart — gráficos de tendência e distribuição

## Queries Supabase
- `lib/fichas.js` — fetchKPIs, fetchEmitidas, fetchFichasPorDia, fetchTopImobiliarias
- `lib/fichas.js` — fetchDistribuicaoStatus, fetchFichasPorProdutoMes, fetchMetricas
- `lib/fichas.js` — fetchAtividadeRecente, fetchFichasDoOrcamentista
- Contexto: `useAuth` para filtrar fichas do usuário logado

## Status
pronto

## Experiência operacional (2026-08-04)

- O dashboard funciona também como launchpad entre as mesas de Fichas, carteira pessoal, Apólices, Pipeline Auto e Pipeline CRM.
- Os atalhos expõem contexto real quando disponível e mantêm comportamento responsivo em trilho horizontal no mobile.
- O launchpad não cria novas queries; reutiliza KPIs já carregados para não aumentar o custo da tela.

## Usuários que utilizam
Todos os orçamentistas (Davi, Dayana, Eduardo, Mateus, Laís, Marcos, Luciano)
