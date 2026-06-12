# ApolicesDashboard

## Propósito
Dashboard de apólices emitidas: KPIs (total emitidas, em vigor, expiradas), gráficos de emissões por dia, top imobiliárias e distribuição por seguradora.

## Componentes usados
- `Select` (ui/) — filtros de período
- Recharts: AreaChart, BarChart, PieChart — gráficos analíticos

## Queries Supabase
- `lib/apolices.js` — fetchKPIsApolices, fetchApolicesPorDia, fetchTopImobiliariasApolices, fetchPorSeguradora
- Hook: `useImobiliaria` para filtro por workspace

## Status
pronto

## Usuários que utilizam
Gestores (Luciano, Mateus)
