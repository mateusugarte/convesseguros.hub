# Calendario (Comercial)

## Propósito
Calendário de eventos e follow-ups da equipe comercial. Visualização por mês e por semana. Permite criar, editar e excluir eventos vinculados a leads.

## Componentes usados
- `Select` (ui/) — filtro de tipo de evento
- Calendário implementado inline com date-fns (sem biblioteca externa de calendário)

## Queries Supabase
- `lib/comercial.js` — useComercial, eventAdd, eventUpdate, eventDelete
- Constantes: TIPOS_EVENTO, CORES_EVENTO

## Status
pronto

## Usuários que utilizam
Equipe comercial (Patricia Dantas, Patricia Barbara)
