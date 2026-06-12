# ApoliceDetalhe

## Propósito
Detalhe completo de uma apólice: campos editáveis, datas de vigência, forma de pagamento, seguradora e documentos anexados.

## Componentes usados
- `SeguradoraSelect` — troca de seguradora
- `SecaoDocumentos` — upload e listagem de documentos
- `DatePicker` (ui/) — vigência início/fim
- `Select` (ui/) — forma de pagamento, produto

## Queries Supabase
- `lib/apolices.js` — fetchApoliceDetalhe, atualizarApolice, excluirApolice
- `lib/fichas.js` — PRODUTO_LABELS (para exibição)
- Hook: `useImobiliaria`
- Rota: `/apolices/:id`

## Status
pronto

## Usuários que utilizam
Gestores (Luciano, Mateus)
