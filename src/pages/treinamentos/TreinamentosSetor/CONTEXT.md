# TreinamentosSetor

## Page

- Name: TreinamentosSetor
- Route: `/treinamentos/setores/:setorId`
- Domain: Treinamentos (Fiança)

## Purpose

Lista os módulos de um setor (ex.: Seguros Novos) com estado visual
trancado/em andamento/concluído, e o card do quiz final do setor (destravado só
quando o último módulo, por ordem, está concluído).

## Components Used

- `PageHeader`, `Card`, `EmptyState` (`components/ui`)
- `TrainingStatusBadge`, `TrainingBreadcrumb` (`components/treinamentos`)

## Queries / Data Access

- Mesma query/chave de `TreinamentosDashboard` (`trainingQueryKey`), reaproveitada
  do cache do TanStack Query.
- `isModuloUnlocked`, `isModuloConcluded`, `getSetorQuizNode`,
  `isSetorQuizUnlocked` (`lib/trainingProgression.js`) resolvem o estado de cada
  módulo e do quiz final a partir de `training_progress`.

## Status

in_progress

## Notes

- Módulo trancado renderiza sem `<Link>` (não navegável) — só o card visual com
  ícone de cadeado.
- Regra de desbloqueio: módulo N depende do **quiz do módulo N-1** estar
  `concluido`, não de "todas as lições" do módulo anterior — ver
  `isModuloUnlocked` e os testes em `lib/trainingProgression.test.mjs`.

## Users

- Todos os funcionários (rota sem `AdminRoute`).

## Handoff Checklist

- Read `docs/IA_ORCHESTRATOR.md`
- Read `docs/PROJECT_CONTEXT.md`
- Read `ROADMAP.md`
- Read `docs/CURRENT_TASK.md`
- Read this page's `CONTEXT.md`
- Update `docs/CURRENT_TASK.md` before and after the task
