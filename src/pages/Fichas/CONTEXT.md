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

## Status de ficha — "Em Aberto" vs "Passadas"
- `STATUS_EM_ABERTO` (`lib/fichas.js`) = `['pendente', 'em_cotacao', 'em_analise']`. Inclui
  `em_analise` deliberadamente: é uma ficha já assumida por um orçamentista mas ainda sem
  decisão de aprovado/recusado — precisa continuar aparecendo como "em aberto" (aba Lista e
  contagens), não como "passada"/finalizada. `STATUS_PASSADOS` só tem status realmente
  terminais (`aprovado`, `recusado`, `emitido`, `cancelado`, `cpf_invalido`, `expirada`).
- `Relatorio.jsx` usa sua própria constante local (`INCLUDED_REPORT_STATUSES`), não estas —
  mudar `STATUS_EM_ABERTO`/`STATUS_PASSADOS` aqui não afeta o Relatório.

## Busca no Kanban
- Barra de busca simples acima do card "Recorte de trabalho" (filtro de período/mês),
  visível só na view Kanban (`PageShell` prop `topBar`). Filtra client-side (sem nova query)
  por nome/imobiliária/CPF/CNPJ/seguradora — passada como prop `search` para `KanbanFichas`,
  que filtra a lista já carregada antes de agrupar em colunas (`fichaMatchesSearch`), então
  cada coluna mostra só os cards que batem, sem esconder colunas com 0 resultado.
- Independente do campo de busca da view Lista (`search`/`debouncedSearch`, com debounce de
  400ms e query no servidor) — são dois estados separados por design.

## Status
pronto

## Usuários que utilizam
Todos os orçamentistas (Davi, Dayana, Eduardo, Mateus, Laís, Marcos, Luciano)
