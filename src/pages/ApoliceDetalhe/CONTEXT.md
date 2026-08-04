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
pronto

## Sistema visual e navegação (2026-07-30)
- O detalhe usa a mesma linguagem do workspace de Fiança e da ficha individual: masthead azul/índigo, cards operacionais, controles compactos e estados responsivos/escuros centralizados em `styles/fianca-ui.css`.
- O resumo financeiro reúne prêmio líquido, prêmio total, comissão prevista e forma de pagamento antes dos formulários; os valores continuam derivados pelos helpers de `lib/apolices.js`.
- A rota aceita `location.state.returnTo`, `returnState` e `returnLabel`, permitindo voltar para a fatura ou lista de produção sem perder o contexto. Sem state, mantém o histórico do navegador e usa `/apolices/lista` como fallback.

## Usuários que utilizam
Gestores (Luciano, Mateus)
