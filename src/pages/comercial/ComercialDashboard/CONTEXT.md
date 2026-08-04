# ComercialDashboard

## Propósito
Dashboard do módulo comercial: KPIs de leads (total, convertidos, perdidos), taxa de conversão por período e funil de vendas. Ponto de visão geral da equipe comercial.

## Componentes usados
- `DatePicker` (ui/) — filtro de período
- Recharts: AreaChart — tendência de leads ao longo do tempo

## Queries Supabase
- `lib/comercial.js` — useComercial (hook centralizado que carrega leads, jornadas, eventos)
- Filtra por período (semana/mês/trimestre/personalizado)
- Contexto: `useAuth`

## Status
pronto

## Usuários que utilizam
Equipe comercial e gestores (Patricia Dantas, Patricia Barbara, Luciano, Mateus)
