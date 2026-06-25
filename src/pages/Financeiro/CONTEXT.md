# CONTEXT - Financeiro

## Objetivo
Hub financeiro admin-only do Seguro Fianca com sub-abas: Visao Geral, Producao e Faturas.

## Estrutura
- `Financeiro.jsx` - layout do hub, navegacao por abas e `<Outlet />`.
- `FinanceiroVisaoGeral.jsx` - dashboard com KPIs do mes, calendario anual e ranking de imobiliarias.
- `FinanceiroProducao.jsx` - producao por imobiliaria, seletor de mes, quebra por seguradora, grafico e percentual de repasse salvo por mes.
- `FinanceiroFaturas.jsx` - calendario anual de faturas, conferencia mensal por imobiliaria, valor real informado, status pago/pendente.
- `FinanceiroFaturaDetalhe.jsx` - detalhe da fatura com apolices do mes e navegacao para a apolice preservando estado.
- `CalendarioAno.jsx` e `EvolucaoChart.jsx` - componentes visuais auxiliares.

## Rotas
- `/financeiro` - dashboard financeiro.
- `/financeiro/producao` - producao por imobiliaria.
- `/financeiro/producao/:imobiliaria` - producao com imobiliaria pre-selecionada.
- `/financeiro/faturas` - calendario e conferencia de faturas.
- `/financeiro/faturas/:imobiliaria/:mes` - detalhe da fatura mensal.

## Dados
- `src/lib/financeiro.js` - consultas e upserts de comissoes, producao, percentuais e faturas.
- `src/lib/financeiroCalc.js` - helpers puros de data/agregacao base.
- `src/lib/financeiroProducaoCalc.js` - agregacoes de producao, calendario e ranking.
- `src/lib/financeiroFaturasCalc.js` - ciclo de parcelas e montagem das faturas mensais.
- `src/lib/imobiliariasLogos.js` - resolucao de identidade visual das imobiliarias.

## Banco
- `supabase/42_financeiro_recebimentos.sql` - agenda de recebimentos.
- `supabase/45_producao_comissao_imobiliaria.sql` - percentual por imobiliaria/mes.
- `supabase/46_faturas_imobiliaria.sql` - controle de pagamento das faturas.
- `supabase/47_faturas_imobiliaria_conferencia.sql` - valor real e snapshots de conferencia.

## Acesso
- Restrito a `profile.is_admin`; rota envolvida por `AdminRoute`.
- Tabelas financeiras com RLS via `is_finance_admin()`.

## Regras
- Agenda de comissao: primeira parcela no mes seguinte a emissao.
- Fatura: soma parcelas devidas no mes por imobiliaria.
- Elegivel: `status_emissao IN ('emitida','enviada')` e `status_apolice IN ('ativa','renovada')` ou nulo.
- Percentual de repasse e salvo por imobiliaria/mes em `producao_comissao_imobiliaria`.
- `valor_real_fatura` e informativo para conferencia; o valor calculado continua vindo do ledger.
