# Relatorio

## Propósito
Relatório mensal operacional em shell premium, com filtros por ano, mês e imobiliária, métricas de contexto e quadro Kanban arrastável.

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

## Usuários que utilizam
Gestores e orçamentistas seniores
