# CURRENT TASK

## Responsavel Atual

Claude

## Pagina

`src/pages/Financeiro/` — modulo financeiro (redesign)

## Objetivo

Reestruturacao do modulo financeiro (Seguro Fianca) — **Fase 2: Producao**.
Producao por imobiliaria (logo, nº apolices, premio, comissao gerada, recebida
estimada, % de repasse editavel salvo por mes, valor a repassar) + pagina de
detalhe por imobiliaria (quebra por seguradora com % participacao + grafico).

## Status

Fase 1 (Visao Geral) e Fase 2 (Producao) concluidas (codigo).
**Pendente: aplicar as migracoes no Supabase** (42 e 45) + smoke test manual.

## Arquivos alterados (Fase 2)

- `supabase/45_producao_comissao_imobiliaria.sql` — criado (% por imobiliaria/mes, RLS admin-only)
- `src/lib/financeiroProducaoCalc.js` (+ `.test.mjs`, node --test) — agregacoes puras
- `src/lib/imobiliariasLogos.js` — resolver de logo/% default por nome/alias
- `src/lib/financeiro.js` — fetchProducaoLedger, fetchPctImobiliarias, salvarPctImobiliaria
- `src/pages/Financeiro/EvolucaoChart.jsx` — grafico de evolucao (recharts)
- `src/pages/Financeiro/FinanceiroProducao.jsx` — lista por imobiliaria (% editavel)
- `src/pages/Financeiro/FinanceiroProducaoDetalhe.jsx` — detalhe por seguradora
- `src/pages/Financeiro/Financeiro.jsx` — aba Producao habilitada
- `src/App.jsx` — rotas `producao` e `producao/:imobiliaria`
- Docs: spec atualizado (4.4 + Fase 2/3); plano `2026-06-25-financeiro-fase2-producao.md`

## Proximo Passo

1. **Aplicar no Supabase SQL Editor (em ordem):** `42_financeiro_recebimentos.sql` e
   `45_producao_comissao_imobiliaria.sql`. Rodar verificacoes do plano da Fase 1.
2. Smoke test: login admin → `/financeiro` (Visao Geral) e `/financeiro/producao`
   (editar %, abrir detalhe de imobiliaria).
3. **Fase 3 — Faturas** (geracao mensal por competencia, lista+detalhe, navegacao
   fatura↔apolice, pagamento). O % de repasse ja unificado vem da Fase 2.

## Observacao

Commits `t2`/`t3` ("setor financeiro") foram feitos em paralelo por outro autor na
`main`, em arquivos diferentes (apolices/fichas/layout/css) — sem conflito com a Fase 2.
