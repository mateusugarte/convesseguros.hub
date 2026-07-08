# ImobiliariaDetalhe

## Propósito
Detalhe operacional de imobiliária em shell premium, com edição inline, status, variações de nome e cadastro de seguradoras de fiança (ativação + código + observações por seguradora).

## Componentes usados
- `PageHeader`
- `MetricCard`
- `DataCard`
- `ImobiliariaIdentity`
- `SeguradoraBadge`
- `EditableField` (componente local inline; suporta estado `disabled` para campos ainda sem coluna no banco)
- `SeguradoraCadastroCard` (componente local inline; card de ativação + código + observações por seguradora)

## Queries Supabase
- `lib/imobiliariasSchema.js` - `fetchImobiliariaById` (descobre dinamicamente quais colunas opcionais existem no banco, cacheando o resultado em memória para não repetir a descoberta a cada visita); `formatImobiliariaFieldLabel`, `isMissingImobiliariaColumnError`
- `lib/supabase.js` - atualização de imobiliária por id; toggle de `imobiliaria_seguradoras` (ativar/desativar seguradora de fiança)
- `lib/imobiliariasCodigos.js` - `fetchCodigos`, `upsertCodigo` (código/observações por seguradora; `observacoes` tem fallback silencioso caso a coluna ainda não exista no banco, ver risco em `docs/CURRENT_TASK.md`)
- `lib/seguradoras.js` - `fetchSeguradorasPorProduto('fianca')` para listar as seguradoras do produto
- `lib/entityMedia.js` - upload/leitura da imagem da imobiliária

## Risco conhecido
Campos comerciais (`recebe_comissao`, `pct_comissao`, `objetivo_comercial`, `observacoes_comerciais`) não têm migration criada ainda — `fetchImobiliariaById` os detecta como ausentes e a UI mostra "Campo indisponível no banco" para eles. Campos de contato (`email`, `cnpj`, `creci`, `telefone`, `responsavel`, `endereco`) têm migration em `supabase/50_imobiliarias_cadastro_basico.sql`, não confirmada como aplicada.

## Status
em andamento

## Usuários que utilizam
Admin e gestores
