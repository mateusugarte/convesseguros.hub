# ImobiliariaDetalhe

## Propósito
Detalhe operacional de imobiliária em shell premium, com edição inline, status, variações de nome e códigos por seguradora.

## Componentes usados
- `PageHeader`
- `MetricCard`
- `DataCard`
- `Select`
- `CampoEditavel` (componente local inline)
- `CampoEmBreve` (componente local inline)

## Queries Supabase
- `lib/supabase.js` - busca e atualização de imobiliária por id
- `lib/imobiliariasCodigos.js` - `fetchCodigos`, `fetchSeguradoras`, `upsertCodigo`, `deletarCodigo`

## Status
em andamento

## Usuários que utilizam
Admin e gestores
