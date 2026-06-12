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

## Usuários que utilizam
Todos os orçamentistas (Davi, Dayana, Eduardo, Mateus, Laís, Marcos, Luciano)
