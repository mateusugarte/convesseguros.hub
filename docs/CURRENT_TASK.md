# CURRENT TASK

## Responsavel Atual

Codex

## Pagina

`src/pages/Seguradoras.jsx`

## Objetivo

Corrigir o upload de logo/imagem das seguradoras e imobiliarias, liberando as policies de RLS corretas e ajustando a taxonomia de produtos da seguradora.

## Status

Em andamento.

## Proxima Acao OBRIGATORIA

Aplicar a migracao `supabase/21_entity_media_rls_and_products.sql` no Supabase e validar o salvamento de logo/imagem.

## Alteracoes Realizadas

- `src/lib/seguradoras.js` passou a tratar Fiança como familia com subtipos.
- `src/pages/Seguradoras.jsx` agora mostra os produtos de forma agrupada.
- `supabase/21_entity_media_rls_and_products.sql` foi adicionada para abrir RLS e corrigir a taxonomia.

## Observacoes

- O bucket `cadastros-media` precisa ter as policies aplicadas para permitir upload, leitura e exclusão.
- Os codigos antigos de produto foram mantidos com compatibilidade de leitura.
