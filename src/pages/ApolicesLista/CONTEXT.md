# ApolicesLista

## Propósito
Listagem tabular premium de apólices com filtros por período, imobiliária, seguradora, status e busca textual. Mantém exportação CSV e navegação para o detalhe.

## Componentes usados
- `PageHeader`, `MetricCard`, `DataCard`
- `ImobiliariaSelect`
- `Select` (ui/)
- `DatePicker` (ui/)

## Queries Supabase
- `lib/apolices.js` — `fetchApolicesLista`
- `lib/supabase.js` — lista de seguradoras
- Hook: `useImobiliaria`

## Status
em andamento

## Usuários que utilizam
Gestores e orçamentistas seniores
