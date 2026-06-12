# LeadDetalhe (Comercial)

## Propósito
Detalhe completo de um lead: histórico de interações, jornada de automação, eventos agendados, score de qualidade e movimentação no pipeline.

## Componentes usados
- `Select` (ui/), `DatePicker` (ui/) — edição de campos
- ReactFlow — visualização do fluxo da jornada atribuída ao lead
- `ScoreBadge` (componente local inline)

## Queries Supabase
- `lib/comercial.js` — useComercial, leadUpdate, leadMover, eventAdd, eventUpdate, eventDelete
- `lib/comercial.js` — fetchFichasParaImport (vinculação com ficha)
- Rota: `/comercial/leads/:id`

## Status
pronto

## Usuários que utilizam
Equipe comercial (Patricia Dantas, Patricia Barbara)
