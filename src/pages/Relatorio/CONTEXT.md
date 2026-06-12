# Relatorio

## Propósito
Relatório mensal de fichas organizadas em colunas Kanban (aprovada, emitida, enviado_cobrança, recuperados, desistiu, expirada). Permite arrastar fichas entre status e atualizar banco.

## Componentes usados
- `ImobiliariaSelect` — filtro por imobiliária
- `Select` (ui/) — filtro de ano/mês
- @dnd-kit: DndContext, DragOverlay, useDraggable, useDroppable — drag entre colunas

## Queries Supabase
- `lib/fichas.js` — fetchAnosRelatorio, fetchMesesRelatorio, fetchFichasRelatorio
- `lib/supabase.js` — atualização direta de status ao arrastar card
- Hook: `useImobiliaria`
- Colunas mapeadas: aprovada → status:aprovado | emitida → status:emitido | enviado_cobranca → retorno_enviado:true | desistiu → status:cancelado | expirada → status:expirada

## Status
pronto

## Usuários que utilizam
Gestores e orçamentistas seniores (Luciano, Mateus)
