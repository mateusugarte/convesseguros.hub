# Imobiliarias

## Propósito
Gestão operacional de imobiliárias com shell premium: visão analítica, mapeamento de variações, fila de não mapeadas, cadastros e vínculos com seguradoras.

## Componentes usados
- `PageHeader`
- `MetricCard`
- `DataCard`
- `ImobiliariaSelector` (componente local inline)
- `ModalAgrupar` (componente local inline)

## Queries Supabase
- `lib/supabase.js` - CRUD direto em `imobiliarias`, `imobiliaria_aliases` e `imobiliaria_seguradoras`
- `lib/fichas.js` - `fetchNomesImobiliariasAll`

## Status
em andamento

## Usuários que utilizam
Admin e gestores
