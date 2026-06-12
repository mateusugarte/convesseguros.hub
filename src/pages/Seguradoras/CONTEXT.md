# Seguradoras

## Propósito
Gestão do cadastro de seguradoras: criação, edição, agrupamento de variações de nome (aliases) e visualização de fichas por seguradora.

## Componentes usados
- `SeguradoraBadge` — exibe logo/nome da seguradora
- `ModalSeguradora` (componente local inline) — modal de criação/edição/agrupamento

## Queries Supabase
- `lib/supabase.js` — CRUD na tabela `seguradoras` (nome_canonico, aliases)
- Busca de variações não mapeadas para agrupamento

## Status
pronto

## Usuários que utilizam
Admin e gestores (Luciano, Mateus)
