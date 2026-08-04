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

## Refinamento visual (2026-08-04)
- O masthead tem regra explícita no workspace de Fiança para impedir que estilos legados do detalhe restaurem o fundo branco; usa gradiente azul/índigo com contraste garantido nos textos, métricas e ações.
- As ações do cabeçalho ganharam hierarquia (salvar como primária, finalizar como sucesso e excluir como destrutiva), os cabeçalhos dos cards têm marcador visual e o resumo financeiro recebeu resposta sutil ao hover.
- No mobile, salvar ocupa a primeira linha e as demais ações se distribuem sem comprometer o toque ou a leitura.

## Usuários que utilizam
Gestores (Luciano, Mateus)
