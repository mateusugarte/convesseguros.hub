# ImobiliariaDetalhe

## Propósito
Detalhe operacional de imobiliária em shell premium, com edição inline, status, variações de nome e cadastro de seguradoras de fiança (ativação + código + observações por seguradora).

## Componentes usados
- `PageHeader`
- `MetricCard`
- `DataCard`
- `ImobiliariaIdentity`
- `SeguradoraBadge`
- `CampoEditavel` (componente local inline)
- `CampoEmBreve` (componente local inline)

## Queries Supabase
- `lib/supabase.js` - busca e atualização de imobiliária por id; toggle de `imobiliaria_seguradoras` (ativar/desativar seguradora de fiança)
- `lib/imobiliariasCodigos.js` - `fetchCodigos`, `upsertCodigo` (código/observações por seguradora; `observacoes` tem fallback silencioso caso a coluna ainda não exista no banco, ver risco em `docs/CURRENT_TASK.md`)
- `lib/seguradoras.js` - `fetchSeguradorasPorProduto('fianca')` para listar as seguradoras do produto
- `lib/entityMedia.js` - upload/leitura da imagem da imobiliária

## Status
em andamento

## Usuários que utilizam
Admin e gestores
