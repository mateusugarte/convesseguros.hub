# ADR - Governanca entre Claude Code e Codex

## Status

Aprovado para uso interno do projeto.

## Contexto

O projeto precisa de um fluxo unico de leitura, classificacao de tarefa e handoff entre as duas IAs que operam no repositório.

## Decisao

- Criar `docs/IA_ORCHESTRATOR.md` como fonte principal de governanca.
- Criar `docs/PROJECT_CONTEXT.md` para contexto permanente.
- Criar `docs/CURRENT_TASK.md` para handoff operacional.
- Criar `docs/CONTEXT_TEMPLATE.md` para novas paginas.
- Criar `scripts/validate-page-contexts.mjs` para validar cobertura de documentacao.
- Manter `ROADMAP.md` como inventario consolidado do projeto.
- Atualizar `CLAUDE.md` para obedecer a mesma ordem de leitura.
- Usar o mesmo processo de leitura e handoff para Claude Code e Codex.

## Consequencias

- As duas IAs passam a seguir o mesmo contexto.
- A recomendacao de especialidade nao bloqueia execucao.
- O status da tarefa fica visivel e atualizavel.
- A documentacao da pagina continua sendo a fonte de contexto local antes de qualquer alteracao.
- Novas paginas passam a ter um padrao unico de documentacao.
- A cobertura de documentacao pode ser verificada automaticamente.
