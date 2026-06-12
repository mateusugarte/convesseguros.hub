# ImobiliariaDetalhe

## Propósito
Detalhe de uma imobiliária: edição inline de dados cadastrais e gestão dos códigos de seguradora (mapeamento imobiliária × seguradora × código).

## Componentes usados
- `Select` (ui/) — seleção de seguradora
- `CampoEditavel` (componente local inline) — edição inline de campos

## Queries Supabase
- `lib/supabase.js` — busca e atualização da imobiliária por id
- `lib/imobiliariasCodigos.js` — fetchCodigos, fetchSeguradoras, upsertCodigo, deletarCodigo
- Rota: `/imobiliarias/:id`

## Status
pronto

## Usuários que utilizam
Admin e gestores (Luciano, Mateus)
