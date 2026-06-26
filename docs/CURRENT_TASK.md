# CURRENT TASK

## Responsavel Atual

Codex

## Pagina

`src/pages/Financeiro/` - modulo financeiro (redesign)

## Objetivo

Reestruturacao do modulo financeiro do Seguro Fianca para controlar comissoes,
producao por imobiliaria/seguradora, faturas mensais, repasses e pagamento.

## Status

Correcao e evolucao da area financeira concluidas no codigo.

- Base de calculo migrada para a FONTE REAL `apolices` (corrige bug que lia `status_apolice` do ledger `apolices_comissoes`). Calculo via `% comissao x premio liquido / parcelas`.
- Visao Geral: KPIs corrigidos (comissao gerada, recebida estimada, producao) + 2 graficos por seguradora.
- Producao: lista de imobiliarias com busca -> area detalhada com filtro de periodo (mes/intervalo), metricas, rankings por seguradora e botoes de apolices ativas/emitidas.
- Faturas: lista de imobiliarias -> fatura por imobiliaria (mes, valor, estimativa do proximo mes, apolices que contam, conferencia). Conferencia geral preservada em `/financeiro/faturas/conferencia`.
- Faturas por seguradora: `/financeiro/faturas/seguradora/:seguradora` com fatura por imobiliaria e metrica de apolices ativas.

Validacao local mais recente:

- `npm.cmd test` - 27 testes passando (17 + 10 novos de calculo/parcelas).
- `npm.cmd run build` - build verde.
- `npm.cmd run check:page-contexts` - revisar (pendencias pre-existentes fora de Financeiro: `src/pages/auto/*` e `src/pages/comercial/GestaoComercial.jsx`).

## Banco

Migracoes 42, 45, 46, 47 ja aplicadas no Supabase (confirmado pelo usuario). O calculo
nao depende mais do ledger `apolices_comissoes`; le direto de `apolices`.

## Smoke test pendente

Com usuario admin:

1. `/financeiro`: conferir Producao, Comissao Gerada e Recebida Estimada do mes != 0 e coerentes; ver os 2 graficos por seguradora.
2. `/financeiro/producao`: buscar imobiliaria, abrir detalhe, trocar periodo (mes e intervalo), conferir metricas e rankings; abrir "Apolices Ativas" e "Emitidas" e filtrar por seguradora; salvar percentual.
3. `/financeiro/faturas`: buscar imobiliaria, abrir fatura do mes, conferir valor, "Estimativa do mes que vem" e "Apolices que contam"; informar valor real e marcar pago/reabrir.
4. `/financeiro/faturas/seguradora/:seguradora`: conferir fatura por imobiliaria e a metrica de apolices ativas.
5. Validar com uma apolice real: `comissao total = pct x premio liquido` e `mensal = total / parcelas`.

## Risco a conferir no smoke test

- `pct_comissao` pode estar gravado como inteiro (5) ou fracao (0.05); `pctNormalizado` trata ambos, mas conferir numa amostra real.
- "Estimativa do mes que vem" segue a definicao literal (apolices emitidas no mes selecionado).
