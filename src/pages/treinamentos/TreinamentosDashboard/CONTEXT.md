# TreinamentosDashboard

## Page

- Name: TreinamentosDashboard
- Route: `/treinamentos`
- Domain: Treinamentos (Fiança)

## Purpose

Página inicial da feature TREINAMENTOS: mostra o progresso geral do funcionário no
currículo de Fiança, o próximo passo recomendado (primeira lição desbloqueada e não
concluída), e um card por setor com barra de progresso, linkando para
`TreinamentosSetor`.

## Components Used

- `PageHeader`, `Card`, `MetricCard`, `EmptyState` (`components/ui`)
- `TrainingStatusBadge` (`components/treinamentos`)

## Queries / Data Access

- `fetchTrainingTree('seguro_fianca')` + `fetchTrainingProgress(funcionarioId)`
  (`lib/training.js`), via `useQuery` do TanStack Query com chave
  `trainingQueryKey('seguro_fianca', funcionarioId)` — compartilhada com as demais
  3 páginas de Treinamentos (evita refetch ao navegar entre elas).
- Lógica pura de progresso vem de `lib/trainingProgression.js`
  (`getChildrenByType`, `buildProgressMap`, `getSetorProgressPct`,
  `getNextRecommendedNode`).

## Status

in_progress

## Notes

- `training_nodes`/`training_progress` ainda não existem no banco real (migrations
  `supabase/51_treinamentos_schema.sql` e `supabase/52_treinamentos_seed_fianca.sql`
  criadas para revisão, aguardando aprovação explícita para rodar no SQL Editor do
  Supabase). Até lá, a página mostra o `EmptyState` de "currículo ainda não
  publicado" (nenhum nó `tipo='produto'` encontrado).
- Nós de quiz (módulo/setor) foram semeados com `conteudo.quiz = []` — nenhum
  módulo pode ser concluído ponta a ponta com dados reais até perguntas de
  avaliação serem escritas numa rodada de conteúdo separada. Isso é esperado
  nesta fase, não um bug.

## Users

- Todos os funcionários (rota sem `AdminRoute`).

## Handoff Checklist

- Read `docs/IA_ORCHESTRATOR.md`
- Read `docs/PROJECT_CONTEXT.md`
- Read `ROADMAP.md`
- Read `docs/CURRENT_TASK.md`
- Read this page's `CONTEXT.md`
- Update `docs/CURRENT_TASK.md` before and after the task
