# TreinamentosModulo

## Page

- Name: TreinamentosModulo
- Route: `/treinamentos/modulos/:moduloId`
- Domain: Treinamentos (Fiança)

## Purpose

Lista as lições de um módulo, em ordem sequencial de desbloqueio, incluindo a
lição sintética de quiz do módulo (`eh_quiz_modulo = true`) como último item da
lista — visualmente destacada com borda dourada.

## Components Used

- `PageHeader`, `Card`, `EmptyState` (`components/ui`)
- `TrainingStatusBadge`, `TrainingBreadcrumb` (`components/treinamentos`)

## Queries / Data Access

- Mesma query/chave de `TreinamentosDashboard` (`trainingQueryKey`), reaproveitada
  do cache do TanStack Query.
- `isLicaoUnlocked`, `getNodeProgressStatus` (`lib/trainingProgression.js`).

## Status

in_progress

## Notes

- Lição trancada renderiza sem `<Link>` (não navegável).
- O quiz do módulo é só mais um item da mesma lista ordenada de lições — a regra
  de desbloqueio sequencial (`isLicaoUnlocked`) não tem caso especial para ele.

## Users

- Todos os funcionários (rota sem `AdminRoute`).

## Handoff Checklist

- Read `docs/IA_ORCHESTRATOR.md`
- Read `docs/PROJECT_CONTEXT.md`
- Read `ROADMAP.md`
- Read `docs/CURRENT_TASK.md`
- Read this page's `CONTEXT.md`
- Update `docs/CURRENT_TASK.md` before and after the task
