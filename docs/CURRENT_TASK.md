# CURRENT TASK

## Responsavel Atual

Codex

## Pagina

`src/pages/auto/AutoCotacoes.jsx`

## Objetivo

Separar a pagina de cotacoes de seguro auto em uma tela principal com apenas as cotações mais recentes e uma subpagina dedicada de consulta com filtros e pesquisas especificas.

## Status

Concluida

## Proxima Acao OBRIGATORIA

Nenhuma pendente.

## Alteracoes Realizadas

- A tela principal de `AutoCotacoes` ficou focada nas ultimas cotações e no fluxo de cadastro.
- A consulta completa foi movida para `AutoCotacoesConsulta` em `/auto/cotacoes/consulta`.
- O menu lateral e as rotas do app foram ajustados para expor os dois acessos.
- A area de consulta passou a concentrar busca, filtros de periodo, status e tipo, além do detalhamento expansivel.

## Observacoes

- A reorganizacao foi apenas de frontend e navegacao.
- A validacao automatica por bundle nao foi executada nesta sessao por limitacao do ambiente com `vite.config.js`.
