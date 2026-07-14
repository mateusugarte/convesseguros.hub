# TreinamentosAdminQuizDetalhe

## Page

- Name: TreinamentosAdminQuizDetalhe
- Route: `/treinamentos/admin/quiz/:nodeId`
- Domain: Treinamentos (Fiança) — admin

## Purpose

Tela de curadoria de um nó de quiz específico (módulo ou final de setor): lista todas
as perguntas do banco (`ativa` + `sugerida`), permite ativar/desativar cada uma, editar
enunciado/alternativas/resposta correta inline, remover pergunta, e salvar tudo de uma
vez. Só perguntas `ativa` aparecem depois para o funcionário em `TreinamentosLicao`
(`getActiveQuizQuestions`).

## Components Used

- `PageHeader`, `Card`, `Button`, `Badge`, `EmptyState`, `Input`, `Textarea` (`components/ui`)

## Queries / Data Access

- Mesma query/chave de `TreinamentosDashboard` (`trainingQueryKey`) para ler o nó.
- `updateQuizQuestions({ nodeId, quiz })` (`lib/training.js`) — substitui
  `conteudo.quiz` inteiro do nó em um único UPDATE; RLS já restringe escrita em
  `training_nodes` a `is_training_content_admin()`. Invalida `trainingQueryKey` no
  `onSuccess`.

## Status

in_progress

## Notes

- Edição é 100% local (estado React) até o clique em "Salvar alterações" — substitui o
  array inteiro, não faz merge incremental. Se o admin navegar para fora sem salvar,
  perde as alterações (aceitável para uma tela de curadoria interna; sem confirmação de
  saída implementada nesta rodada).
- O banco de perguntas nasce todo com `status: 'sugerida'` via
  `scripts/generate-treinamentos-quiz-seed.mjs` → `supabase/53_treinamentos_quiz_perguntas.sql`
  — esta tela é o único lugar que marca perguntas como `ativa`.

## Users

- Apenas admins (`profile.is_admin`).

## Handoff Checklist

- Read `docs/IA_ORCHESTRATOR.md`
- Read `docs/PROJECT_CONTEXT.md`
- Read `ROADMAP.md`
- Read `docs/CURRENT_TASK.md`
- Read this page's `CONTEXT.md`
- Update `docs/CURRENT_TASK.md` before and after the task
