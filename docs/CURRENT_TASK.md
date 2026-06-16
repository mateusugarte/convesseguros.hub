# CURRENT TASK

## Responsavel Atual

Codex

## Pagina

Tema global do sistema

## Objetivo

Atualizar a identidade visual global para um tema claro monocromatico usando `#000079`, `#dcffff` e `#c3f0f2`, ajustando se necessario as cores de apoio, e deixar o tema escuro apenas com tons escuros, sem alterar regras de negocio, rotas, queries ou integracoes.

## Status

Concluída

## Atualizacao de Execucao

- Levantados os tokens globais em `src/styles/tokens.css`, `src/index.css` e `tailwind.config.js`.
- Identificados os pontos com cores hardcoded que ainda escapam da camada de tokens.
- A nova paleta foi aplicada nos tokens globais, no CSS base e nos tokens de consumo.
- O segundo passe alcançou `Layout`, `Dashboard`, `Fichas`, `KanbanFichas`, `ApolicesDashboard`, `RelatorioMensal` e `Relatorio`.
- A validação do build ficou bloqueada pelo erro de resolução do Vite nesta sessão, fora do escopo visual.

## Arquivos em uso

- `docs/IA_ORCHESTRATOR.md`
- `docs/PROJECT_CONTEXT.md`
- `ROADMAP.md`
- `docs/CURRENT_TASK.md`
- `src/styles/tokens.css`
- `src/index.css`
- `src/design-system/tokens.js`
- `src/design-system/shadows.js`
- `tailwind.config.js`

## Proximo Responsavel

Codex

## Proxima Tarefa

Se for necessário, fazer um segundo passe para converter componentes com cores hardcoded restantes fora do núcleo do tema.

## Observacoes

Escopo visual global. Nao alterar auth, banco, rotas, contratos ou regras de negocio.
Build tentou rodar com `npm.cmd run build`, mas o Vite retornou erro de permissao ao resolver `vite.config.js` nesta sessao.
