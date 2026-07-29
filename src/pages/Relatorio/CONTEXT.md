# Relatorio

## Propósito
Relatório mensal operacional em shell premium, com filtros por ano, mês e imobiliária, métricas de contexto e quadro Kanban arrastável.

## Regras de negócio das métricas (2026-07-15)
- **Fichas aprovadas** (visão geral e detalhe por imobiliária): total de fichas
  aprovadas no período, incluindo as que já têm apólice emitida. `summarizeRows`
  soma `aprovadas` (bucket aprovada+enviado_cobranca, sem apólice) +
  `aprovadasEmitidas` (bucket emitida+recuperados, com apólice, restrito ao
  período via `_withinPeriod`).
- **Apólices emitidas** (métrica do período): quantas das fichas aprovadas do
  período já têm apólice — `summary.aprovadasEmitidas`, não o total bruto de
  apólices emitidas no período (esse total ficou só interno em
  `summary.emitidas`, não exibido).
- **Emitidas sem ficha**: apólices emitidas no período sem `ficha_id` —
  inalterado.
- **Card por imobiliária (visão geral)**: "Aprovadas" = só bucket `aprovada`
  (sem apólice); "Emitidas" = todas as apólices da imobiliária no período
  (`groupByImobiliaria`, via `emittedPolicies`, casado por `apolice.imobiliaria`).
- **Detalhe por imobiliária — métrica nova**: "Aprovadas sem apólice" =
  `summary.aprovadasSemApolice` (mesma fórmula do antigo "Fichas aprovadas").
- **Painel de status "Emitidas"** (detalhe por imobiliária): mostra TODAS as
  apólices emitidas da imobiliária no período, inclusive sem ficha vinculada —
  `emitidaLedgerRows` mescla `columnMap.emitida` (fichas com apólice) com
  linhas sintéticas somente-leitura para apólices sem `ficha_id` (sem
  checkbox/seleção em massa, só "Abrir apólice"). As demais colunas de status
  continuam vindo só de `columnMap` (fichas).
- **Apólice sem ficha vinculada (2026-07-15)**: a linha sintética mostra o
  nome real do interessado (`apolice.nome_interessado`, buscado junto no
  `select` de `apolicesRangeRowsQuery`) com uma etiqueta laranja "Apólice sem
  ficha vinculada" abaixo — antes `getNomeFicha` usava esse texto como se
  fosse o próprio nome (a query nem buscava `nome_interessado`), então toda
  apólice sem ficha aparecia com o aviso no lugar do nome da pessoa. Mesmo
  padrão visual já usado em `ApolicesLista.jsx`.

## Componentes usados
- `PageHeader`
- `MetricCard`
- `DataCard`
- `ImobiliariaSelect`
- `Select`
- `DndContext`, `DragOverlay`, `useDraggable`, `useDroppable`

## Queries Supabase
- `lib/fichas.js` - `fetchAnosRelatorio`, `fetchMesesRelatorio`, `fetchFichasRelatorio`
- `lib/supabase.js` - atualização direta de status ao arrastar cards

## Status
em andamento

## Sistema visual (2026-07-29)
- `src/styles/report-finance-ui.css` aplica a identidade operacional do relatorio: cabeçalhos, indicadores, alertas prioritarios, filtros de periodo, blocos de status, linhas de ficha e barra de selecao em massa.
- O escopo `.relatorio-page` preserva as regras de metricas, drag-and-drop, cobranca e selecao em massa; a mudança e somente de apresentacao e hierarquia visual.
- O layout possui ajustes especificos para telas pequenas, tema escuro e preferencia por movimento reduzido.

## Usuários que utilizam
Gestores e orçamentistas seniores
