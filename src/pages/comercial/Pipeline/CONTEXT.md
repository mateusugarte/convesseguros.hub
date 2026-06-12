# Pipeline (Comercial)

## Propósito
Kanban do pipeline de vendas: colunas por estágio do lead (prospecção, qualificação, proposta, negociação, fechado). Permite mover leads entre estágios, registrar recusa e fechar venda.

## Componentes usados
- `Select` (ui/), `DatePicker` (ui/) — formulário de novo lead
- `ScoreBadge` (componente local inline) — indicador de qualidade do lead
- @dnd-kit: DndContext, DragOverlay — drag de leads entre colunas

## Queries Supabase
- `lib/comercial.js` — useComercial, leadAdd, leadMover, leadUpdate, saleAdd, eventAdd
- `lib/comercial.js` — fetchFichasParaImport, fetchApolicesParaImport (importar lead de ficha existente)
- Constantes: PIPELINE_COLS, PRODUTOS, ORIGENS, MOTIVOS_RECUSA

## Status
pronto

## Usuários que utilizam
Equipe comercial (Patricia Dantas, Patricia Barbara)
