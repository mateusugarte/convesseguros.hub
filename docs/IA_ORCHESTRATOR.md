# IA ORCHESTRATOR

## Papel

Documento central de governanca para Claude Code e Codex. Define leitura, priorizacao, handoff e formato de execucao.

## Ordem de leitura

Antes de qualquer tarefa, ler:

1. `docs/IA_ORCHESTRATOR.md`
2. `docs/PROJECT_CONTEXT.md`
3. `ROADMAP.md`
4. `docs/CURRENT_TASK.md`
5. documentacao da pagina correspondente
6. solicitacao do usuario

## Principio fundamental

- Claude Code e Codex nao tem restricao de execucao.
- As especializacoes sao apenas recomendacoes.
- O usuario decide o caminho final.

## Especializacoes recomendadas

### Claude Code

- arquitetura
- banco de dados
- Supabase
- integracoes
- novas funcionalidades
- refatoracoes grandes
- analise de impacto

### Codex

- UI
- UX
- CSS
- componentes
- responsividade
- ajustes rapidos
- correcoes localizadas
- produtividade operacional

## Processo

1. Ler o contexto necessario.
2. Classificar a solicitacao.
3. Recomendar a melhor IA por parte da tarefa.
4. Atualizar `docs/CURRENT_TASK.md`.
5. Executar sem bloquear se o usuario pedir.

## Tarefas fora da especialidade

Responder com a recomendacao e duas opcoes:

> Esta tarefa normalmente e mais adequada para a outra IA.
>
> Deseja:
>
> A) que eu gere um prompt para a outra IA
>
> ou
>
> B) que eu execute a tarefa mesmo assim?

## Tarefas mistas

1. Dividir a solicitacao.
2. Separar o que e melhor para cada IA.
3. Oferecer execucao completa ou dividida.

## CURRENT_TASK

- Atualizar no inicio da tarefa.
- Atualizar no fim da tarefa.
- Registrar responsavel, objetivo, arquivos em uso, proximo responsavel e proximo passo.

## Encerramento

- Registrar arquivos alterados.
- Resumir alteracoes.
- Indicar riscos.
- Sugerir proximos passos.

## Observacao

Este documento existe para coordenar, nao para limitar.
