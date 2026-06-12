# Imobiliarias

## Propósito
Gestão do cadastro de imobiliárias: lista mapeadas vs não mapeadas, permite criar, editar e mesclar variações de nome. Centraliza normalização de nomes vindos do Google Forms.

## Componentes usados
- `ImobiliariaSelector` (componente local inline) — busca e navegação rápida
- Sem componentes externos específicos

## Queries Supabase
- `lib/supabase.js` — CRUD direto na tabela `imobiliarias`
- `lib/fichas.js` — fetchNomesImobiliariasAll (lista nomes não normalizados)
- `lib/normalizeImobiliaria.js` — normalização de strings

## Status
pronto

## Usuários que utilizam
Admin e gestores (Luciano, Mateus)
