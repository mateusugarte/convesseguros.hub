# CLAUDE.md - Conves Hub

## Objetivo

Conves Hub e uma plataforma de gestao de fichas, apolices, imobiliarias, seguradoras e area comercial.

## Leitura obrigatoria

Antes de qualquer tarefa, ler nesta ordem:

1. `docs/IA_ORCHESTRATOR.md`
2. `docs/PROJECT_CONTEXT.md`
3. `ROADMAP.md`
4. `docs/CURRENT_TASK.md`
5. documentacao da pagina correspondente
6. solicitacao do usuario

## ATENCAO: tarefa pausada em andamento (retomar antes de qualquer coisa)

Existe uma tarefa multi-etapas pausada a pedido do usuario em 2026-07-17
(importacao historica de apolices Auto + redesenho da pagina de Clientes
Auto), executada via `superpowers:subagent-driven-development`, direto na
branch `main`. Antes de comecar qualquer nova solicitacao do usuario, ler
o bloco "TAREFA EM ANDAMENTO" no topo de `docs/CURRENT_TASK.md` — ele tem
o status exato de cada task, os arquivos de plano/ledger e o proximo passo
exato para retomar (gerar review package da Task 3 e seguir dali). So
remover este aviso quando a tarefa inteira (todas as 11 tasks + revisao
final) estiver concluida e `docs/CURRENT_TASK.md` atualizado de volta ao
normal.

## Como agir

- Atualizar `docs/CURRENT_TASK.md` no inicio e no fim da tarefa.
- Ler o `CONTEXT.md` da pagina antes de alterar qualquer tela.
- Usar `docs/CONTEXT_TEMPLATE.md` para novas paginas.
- Rodar `npm run check:page-contexts` quando a tarefa tocar em documentacao de pagina.

## Quando Codex e mais recomendado

- UI
- UX
- CSS
- responsividade
- componentes
- ajustes visuais
- correcoes localizadas
- pequenos refactors

## Quando Claude e mais recomendado

- banco de dados
- Supabase
- autenticacao
- integracoes complexas
- regras de negocio
- mudancas estruturais grandes

## Regra fundamental

- Nenhuma IA tem restricao de execucao.
- As recomendacoes de especialidade nao bloqueiam a tarefa.
- O usuario decide o caminho final.

## Formato de entrega

Ao concluir, informar:

- arquivos alterados
- resumo das alteracoes
- riscos remanescentes
- proximos passos sugeridos

## Regras de codigo

- Credenciais apenas em variaveis de ambiente.
- `service_role` somente no n8n.
- RLS sempre ativa.
- Queries com campos explicitos e paginacao quando aplicavel.
- Evitar reescrever arquivos inteiros sem necessidade.

## Seguranca

Banco, auth, RLS ou dados pessoais -> parar, apresentar plano e aguardar aprovacao do agente de seguranca.
