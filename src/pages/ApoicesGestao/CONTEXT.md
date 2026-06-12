# ApoicesGestao

## Propósito
Kanban de gestão de apólices em emissão: colunas (recebida, proposta_transmitida, apólice_emitida, etc.). Permite criar apólice a partir de ficha aprovada e mover entre estágios.

## Componentes usados
- `SeguradoraBadge` — badge de seguradora no card
- `SeguradoraSelect` — seleção ao criar apólice
- `ImobiliariaSelect` — filtro por imobiliária
- `KanbanSkeleton` — loading state
- `Select` (ui/), `DatePicker` (ui/) — formulário de criação
- @dnd-kit: DndContext, DragOverlay — drag entre colunas

## Queries Supabase
- `lib/apolices.js` — fetchApolicesKanban, criarApolice, moverStatusApolice, buscarFichasParaEmissao
- `lib/fichas.js` — PRODUTO_LABELS
- Hook: `useImobiliaria`
- Colunas: recebida → proposta_transmitida → apólice_emitida → aguardando_pagamento → vigente → renovação → cancelada

## Status
pronto

## Usuários que utilizam
Gestores e responsáveis por emissão (Luciano, Mateus, Patricia Dantas)
