# TreinamentosLicao

## Page

- Name: TreinamentosLicao
- Route: `/treinamentos/licoes/:licaoId`
- Domain: Treinamentos (Fiança)

## Purpose

Tela de conteúdo de uma lição (renderiza `conteudo_geral` + `variacoes_por_seguradora`
+ `notas`, com botão "Concluir lição"), OU tela de quiz quando o nó é
`eh_quiz_modulo`/`eh_quiz_final_setor` (formulário de múltipla escolha, corrige e
grava o resultado). Reserva o espaço para o botão de chat contextual com o
CONVES IA (`TrainingChatButton`, sem lógica ainda).

## Components Used

- `PageHeader`, `Card`, `Button`, `EmptyState` (`components/ui`)
- `TrainingStatusBadge`, `TrainingBreadcrumb`, `TrainingChatButton` (`components/treinamentos`)
- `RichText`/`renderInline` — helpers locais neste arquivo (não extraídos para
  `components/`) que renderizam `**negrito**` e listas `- item` do texto cru do
  markdown fonte, sem dependência de biblioteca de markdown.

## Queries / Data Access

- Mesma query/chave de `TreinamentosDashboard` (`trainingQueryKey`).
- `upsertLicaoProgress` — grava conclusão de lição normal.
- `submitQuizAttempt` (`lib/training.js`, usa `gradeQuiz` de `lib/trainingProgression.js`
  internamente) — corrige o quiz (nota de corte 70%, `QUIZ_PASSING_SCORE_PCT`) e grava
  `training_progress` (status, quiz_score, tentativas, concluido_em).
- Ambas as mutações invalidam `trainingQueryKey` no `onSuccess`, para as outras
  páginas (Setor/Módulo/Dashboard) refletirem o novo estado ao navegar de volta.

## Status

in_progress

## Notes

- Quiz com `conteudo.quiz` vazio (`[]`) renderiza `EmptyState` "Quiz ainda não
  disponível" — estado esperado até perguntas de avaliação serem escritas numa
  rodada de conteúdo separada (nenhuma pergunta foi inventada nesta migration).
- Lição trancada (acesso direto por URL, sem passar pela navegação sequencial)
  renderiza `EmptyState` "Lição trancada" em vez do conteúdo.
- Para o quiz final de setor (`eh_quiz_final_setor`), o desbloqueio já foi
  validado na tela `TreinamentosSetor` antes do link aparecer clicável — esta
  página não reconstrói a lista de módulos do setor para revalidar (evitaria
  duplicar a mesma árvore de decisão em dois lugares).

## Users

- Todos os funcionários (rota sem `AdminRoute`).

## Handoff Checklist

- Read `docs/IA_ORCHESTRATOR.md`
- Read `docs/PROJECT_CONTEXT.md`
- Read `ROADMAP.md`
- Read `docs/CURRENT_TASK.md`
- Read this page's `CONTEXT.md`
- Update `docs/CURRENT_TASK.md` before and after the task
