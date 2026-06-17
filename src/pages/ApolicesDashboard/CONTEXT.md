# ApolicesDashboard

## Propósito
Dashboard analítico do módulo de apólices emitidas. Consolida KPIs, gráficos de emissões por dia, top imobiliárias e distribuição por seguradora dentro do shell premium.

## Componentes usados
- `PageHeader`, `MetricCard`, `DataCard`
- `Select` (ui/) — filtros de período
- Recharts: `AreaChart`, `BarChart`, `PieChart` — gráficos analíticos

## Queries Supabase
- `lib/apolices.js` — fetchKPIsApolices, fetchApolicesPorDia, fetchTopImobiliariasApolices, fetchProducaoPorSeguradora
- Hook: `useImobiliaria` para filtro por workspace

## Status
em andamento

## Usuários que utilizam
Gestores (Luciano, Mateus)
