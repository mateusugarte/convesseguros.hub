# ApolicesLista

## Propósito
Listagem tabular de apólices com filtros por período (hoje/semana/mês/personalizado), imobiliária e status. Permite exportação e navegação para detalhe.

## Componentes usados
- `ImobiliariaSelect` — filtro por imobiliária
- `Select` (ui/) — filtro de status
- `DatePicker` (ui/) — período personalizado

## Queries Supabase
- `lib/apolices.js` — fetchApolicesLista (com range de datas e filtros)
- `lib/supabase.js` — acesso direto para exportação
- Hook: `useImobiliaria`

## Status
pronto

## Usuários que utilizam
Gestores e orçamentistas seniores
