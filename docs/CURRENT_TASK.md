# CURRENT TASK

## Responsavel Atual

Claude

## Pagina

`src/pages/Financeiro/` — modulo financeiro (redesign)

## Objetivo

Reestruturacao do modulo financeiro (Seguro Fianca) — **Fase 1: Visao Geral**.
Comissao Gerada no mes, Comissao Recebida Estimada (agenda mes a mes rateada por
parcelas) e contagem de apolices, com a base que gera os recebimentos futuros.

## Status

Concluido (codigo) — **pendente aplicacao da migracao no Supabase** e smoke test manual.

## Arquivos alterados

- `supabase/42_financeiro_recebimentos.sql` — criado (tabela `comissoes_recebimentos`,
  trigger `tg_sync_apolice_recebimentos`, backfill, RLS admin-only, `status_apolice` no ledger)
- `src/lib/financeiroCalc.js` — criado (helpers puros de data/agregacao) + `financeiroCalc.test.mjs` (node --test, 7/7)
- `src/lib/financeiro.js` — criado (camada de dados: comissao gerada, contagem, recebimentos)
- `src/pages/Financeiro/Financeiro.jsx` — criado (hub com sub-abas + Outlet)
- `src/pages/Financeiro/FinanceiroVisaoGeral.jsx` — criado (conteudo da aba)
- `src/pages/Financeiro/CONTEXT.md` — criado
- `src/pages/Financeiro.jsx` — removido (movido para a pasta)
- `src/App.jsx` — rota `/financeiro` aninhada (index → FinanceiroVisaoGeral)
- `package.json` — script `test` (node --test)
- Docs: `docs/superpowers/specs/2026-06-25-modulo-financeiro-redesign-design.md`,
  `docs/superpowers/plans/2026-06-25-financeiro-fase1-visao-geral.md`

## Proximo Passo

1. **Aplicar `supabase/42_financeiro_recebimentos.sql` no Supabase SQL Editor** e rodar as
   queries de verificacao do plano (soma das parcelas = comissao; 1a parcela no mes seguinte).
2. Smoke test: login admin → `/financeiro` → conferir cards e agenda.
3. Iniciar **Fase 2 (Producao por imobiliaria/seguradora + logos)** quando aprovado.
