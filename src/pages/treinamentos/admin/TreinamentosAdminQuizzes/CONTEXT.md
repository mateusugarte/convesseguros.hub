# TreinamentosAdminQuizzes

## Page

- Name: TreinamentosAdminQuizzes
- Route: `/treinamentos/admin`
- Domain: Treinamentos (Fiança) — admin

## Purpose

Lista os 15 nós de quiz do currículo (9 de módulo + 6 finais de setor), agrupados por
setor, com a contagem de perguntas `ativa` vs `sugerida` em cada um. Ponto de entrada
para a curadoria — cada card leva para `TreinamentosAdminQuizDetalhe`.

## Components Used

- `PageHeader`, `Card`, `Badge`, `EmptyState` (`components/ui`)

## Queries / Data Access

- Mesma query/chave de `TreinamentosDashboard` (`trainingQueryKey`) — reaproveita o
  cache já carregado pelas páginas de funcionário, sem endpoint próprio.
- Não faz nenhuma mutação; só leitura + navegação.

## Status

in_progress

## Notes

- Rota protegida por `AdminRoute` em `App.jsx` — só `profile.is_admin` acessa.
- Os quiz nodes são encontrados varrendo `nodes` por `eh_quiz_modulo`/`eh_quiz_final_setor`
  (mesma lógica de `getModuloQuizNode`/`getSetorQuizNode` de `trainingProgression.js`,
  repetida aqui de forma simples porque é preciso listar todos os módulos de um setor de
  uma vez, não buscar um único nó).

## Users

- Apenas admins (`profile.is_admin`).

## Handoff Checklist

- Read `docs/IA_ORCHESTRATOR.md`
- Read `docs/PROJECT_CONTEXT.md`
- Read `ROADMAP.md`
- Read `docs/CURRENT_TASK.md`
- Read this page's `CONTEXT.md`
- Update `docs/CURRENT_TASK.md` before and after the task
