# CONTEXT — Financeiro

## Objetivo
Hub financeiro (admin-only) do Seguro Fiança com sub-abas: Visão Geral, Produção, Faturas.

## Estrutura
- `Financeiro.jsx` — layout do hub: guarda de admin, navegação por abas (NavLink) e `<Outlet/>`.
- `FinanceiroVisaoGeral.jsx` — aba index: Comissão Gerada, Comissão Recebida Estimada e agenda mês a mês.

## Rotas
- `/financeiro` (hub) → index `FinanceiroVisaoGeral`.
- `/financeiro/producao` e `/financeiro/faturas` — Fases 2 e 3 (ainda não implementadas; abas marcadas "em breve").

## Dados
- `src/lib/financeiro.js` — consultas (apólices e `comissoes_recebimentos`).
- `src/lib/financeiroCalc.js` — helpers puros de data/agregação (com testes em `financeiroCalc.test.mjs`).

## Acesso
- Restrito a `profile.is_admin`; rota envolvida por `AdminRoute`.
- Tabela `comissoes_recebimentos` com RLS via `is_finance_admin()`.

## Regras
- Agenda: 1ª parcela cai no mês seguinte à emissão.
- Elegível: `status_emissao IN ('emitida','enviada')` e `status_apolice IN ('ativa','renovada')`.
