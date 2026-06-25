# CURRENT TASK

## Responsavel Atual

Codex

## Pagina

`src/pages/Financeiro/` - modulo financeiro (redesign)

## Objetivo

Reestruturacao do modulo financeiro do Seguro Fianca para controlar comissoes,
producao por imobiliaria/seguradora, faturas mensais, repasses e pagamento.

## Status

Fases 1, 2 e 3 concluidas no codigo.

- Fase 1: dashboard, comissao gerada, recebida estimada e agenda.
- Fase 2: producao por imobiliaria, ranking, calendario, seguradoras e percentual de repasse salvo por mes.
- Fase 3: faturas por competencia, calendario anual de faturas, detalhe por imobiliaria, valor real informado, pagamento/reabertura e navegacao para apolice preservando estado.

Validacao local mais recente:

- `npm.cmd test` - 17 testes passando.
- `npm.cmd run build` - build verde.
- `npm.cmd run check:page-contexts` - falha apenas por pendencias pre-existentes fora de Financeiro: `src/pages/auto/*` e `src/pages/comercial/GestaoComercial.jsx`.

## Banco pendente

Aplicar no Supabase SQL Editor, em ordem:

1. `supabase/42_financeiro_recebimentos.sql`
2. `supabase/45_producao_comissao_imobiliaria.sql`
3. `supabase/46_faturas_imobiliaria.sql`
4. `supabase/47_faturas_imobiliaria_conferencia.sql`

## Smoke test pendente

Com usuario admin:

1. Abrir `/financeiro` e conferir KPIs, calendario anual e ranking.
2. Abrir `/financeiro/producao`, selecionar imobiliaria/mes e salvar percentual.
3. Abrir `/financeiro/faturas`, selecionar mes no calendario, informar valor real, marcar pago/reabrir.
4. Abrir detalhe da fatura, navegar para uma apolice e voltar preservando mes/estado.

## Observacao

O modulo tolera leitura de faturas mesmo antes da migracao 47; os campos novos de
conferencia so persistem apos a migracao ser aplicada.
