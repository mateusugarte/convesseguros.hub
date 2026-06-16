# CURRENT TASK

## Responsavel Atual

Codex

## Pagina

Gestao de Apolices / seletor de imobiliaria

## Objetivo

Corrigir o dropdown de imobiliarias que esta abrindo desalinhado em `ApoicesGestao` e telas relacionadas, mantendo o design system e sem alterar regras de negocio, rotas, queries ou integracoes.

## Status

Concluida

## Atualizacao de Execucao

- Lido o contexto obrigatorio e a documentacao da pagina `ApoicesGestao`.
- Identificado que `ImobiliariaSelect` usa `WorkspacesSelect`, que calcula posicao fixa dentro do fluxo normal do DOM.
- Encontrado o mesmo padrao em `src/components/ui/Select.jsx`, usado por outros filtros do fluxo de emissao.
- Aplicado `createPortal(..., document.body)` em `WorkspacesSelect` e `Select`, preservando o calculo de posicao e o fechamento por clique fora.
- A tentativa de `npm.cmd run build` continuou bloqueada por erro de acesso/resolucao do `vite.config.js` nesta sessao.

## Arquivos em uso

- `docs/IA_ORCHESTRATOR.md`
- `docs/PROJECT_CONTEXT.md`
- `ROADMAP.md`
- `docs/CURRENT_TASK.md`
- `src/pages/ApoicesGestao/CONTEXT.md`
- `src/pages/ApoicesGestao.jsx`
- `src/components/ImobiliariaSelect.jsx`
- `src/components/ui/WorkspacesSelect.jsx`
- `src/components/ui/Select.jsx`

## Proximo Responsavel

Codex

## Proxima Tarefa

Validar em runtime as telas de emissao e filtros de apolices para confirmar o alinhamento do dropdown em desktop e mobile.

## Observacoes

Escopo de UI localizado. Nao alterar auth, banco, rotas, contratos ou regras de negocio.
