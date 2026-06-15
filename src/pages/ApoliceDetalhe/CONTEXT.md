# ApoliceDetalhe

## Propósito
Detalhe premium de uma apólice com edição operacional, linha do tempo, documentos e resumo da ficha de origem.

## Componentes usados
- `PageHeader`, `MetricCard`, `DataCard`
- `SeguradoraSelect`
- `SecaoDocumentos`
- `DatePicker` (ui/)
- `Select` (ui/)

## Queries Supabase
- `lib/apolices.js` — `fetchApoliceDetalhe`, `atualizarApolice`, `excluirApolice`
- `lib/fichas.js` — `PRODUTO_LABELS`
- Hook: `useImobiliaria`
- Rota: `/apolices/:id`

## Status
em andamento

## Usuários que utilizam
Gestores (Luciano, Mateus)
