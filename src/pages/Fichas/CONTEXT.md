# Fichas

## Propósito
Hub central de fichas: visão lista/kanban com filtros por produto, status, imobiliária e mês. Ponto de entrada para assumir, finalizar e editar fichas.

## Componentes usados
- `KanbanFichas` — board kanban com drag-and-drop (@dnd-kit)
- `RelatorioMensal` — aba de relatório mensal
- `ModalAssumir` — assumir ficha pendente
- `ModalFinalizar` — finalizar ficha em cotação
- `ModalFicha` — criar/editar ficha
- `DetalhesFicha` — drawer lateral de detalhes
- `Select` (ui/) — filtros de produto/status
- Recharts: AreaChart, PieChart — mini-gráficos de tendência

## Queries Supabase
- `lib/fichas.js` — fetchFichas, fetchAnosDisponiveis, fetchMesesDisponiveis
- `lib/fichas.js` — fetchContagemProdutos, fetchContagemAbertaOrcamentista, deletarFicha
- `lib/fichas.js` — fetchKPIsVisaoGeral, fetchDistribuicaoStatus, fetchFichasPorDia
- `lib/supabase.js` — realtime subscription para atualizações ao vivo
- Hook: `useImobiliaria` para filtro de imobiliária

## Status
pronto

## Usuários que utilizam
Todos os orçamentistas (Davi, Dayana, Eduardo, Mateus, Laís, Marcos, Luciano)
