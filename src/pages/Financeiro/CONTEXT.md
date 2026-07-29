# CONTEXT - Financeiro

## Objetivo
Hub financeiro admin-only do Seguro Fianca com sub-abas: Visao Geral, Producao e Faturas.

## Estrutura
- `Financeiro.jsx` - layout do hub, navegacao por abas e `<Outlet />`.
- `FinanceiroVisaoGeral.jsx` - dashboard com KPIs do mes, calendario anual, 2 graficos por seguradora (producao e comissao) e ranking de imobiliarias.
- `FinanceiroProducaoLista.jsx` - grid de imobiliarias com busca; clique abre a area detalhada.
- `FinanceiroProducao.jsx` - area detalhada da imobiliaria: filtro de periodo (mes/intervalo), metricas, rankings por seguradora, repasse, evolucao e botoes de apolices ativas/emitidas.
- `FinanceiroFaturasLista.jsx` - grid de imobiliarias + atalhos por seguradora + link para conferencia geral.
- `FinanceiroFaturaImobiliaria.jsx` - fatura por imobiliaria: mes, valor, estimativa do proximo mes, apolices que contam e conferencia.
- `FinanceiroFaturasSeguradora.jsx` - faturas e apolices ativas por imobiliaria, filtradas por seguradora.
- `FinanceiroFaturas.jsx` - conferencia geral (calendario anual + tabela de pagamento por imobiliaria).
- `FinanceiroFaturaDetalhe.jsx` - detalhe da fatura com apolices do mes e navegacao para a apolice preservando estado.
- `CalendarioAno.jsx` e `EvolucaoChart.jsx` - componentes visuais auxiliares.
- `src/components/financeiro/` - componentes compartilhados: `ImobiliariasGrid`, `PeriodoFilter`, `RankingSeguradoras`, `SeguradoraBarChart`, `ApolicesListPanel`.

## Rotas
- `/financeiro` - dashboard financeiro.
- `/financeiro/producao` - lista de imobiliarias (producao).
- `/financeiro/producao/:imobiliaria` - area detalhada de producao da imobiliaria.
- `/financeiro/faturas` - lista de imobiliarias (faturas).
- `/financeiro/faturas/conferencia` - conferencia geral anual.
- `/financeiro/faturas/seguradora/:seguradora` - faturas por seguradora.
- `/financeiro/faturas/:imobiliaria` - fatura da imobiliaria (mes, estimativa, apolices que contam).
- `/financeiro/faturas/:imobiliaria/:mes` - detalhe da fatura mensal.

## Dados
- `src/lib/financeiroApolices.js` - FONTE REAL: le de `apolices` e normaliza (premio_total, valor_comissao, comissao_mensal calculados).
- `src/lib/financeiro.js` - consultas/upserts de percentuais e faturas; delega leitura de apolices para financeiroApolices.
- `src/lib/financeiroCalc.js` - helpers puros de data + calculo por apolice (comissaoTotalApolice, comissaoMensalApolice, producaoApolice, pctNormalizado).
- `src/lib/financeiroProducaoCalc.js` - agregacoes, calendario, ranking e geracao das parcelas de comissao.
- `src/lib/financeiroFaturasCalc.js` - ciclo de parcelas e montagem das faturas mensais.
- `src/lib/imobiliariasLogos.js` / `src/lib/seguradoras.js` - identidade visual de imobiliarias e seguradoras.

## Banco
- `supabase/42_financeiro_recebimentos.sql` - agenda de recebimentos.
- `supabase/45_producao_comissao_imobiliaria.sql` - percentual por imobiliaria/mes.
- `supabase/46_faturas_imobiliaria.sql` - controle de pagamento das faturas.
- `supabase/47_faturas_imobiliaria_conferencia.sql` - valor real e snapshots de conferencia.

## Acesso
- Restrito a `profile.is_admin`; rota envolvida por `AdminRoute`.
- Tabelas financeiras com RLS via `is_finance_admin()`.

## Sistema visual (2026-07-29)
- `src/styles/report-finance-ui.css` centraliza a identidade do hub: navegacao executiva, herois, KPIs, filtros, calendario, rankings, tabelas, estados responsivos e tema escuro.
- As classes `financeiro-hub` e `financeiro-page` isolam o novo tema para nao interferir em outras areas do sistema.
- Componentes compartilhados em `src/components/financeiro/` usam classes semanticas `finance-*`; regras de calculo, consultas e navegacao permanecem nas fontes descritas acima.

## Regras
- Comissao gerada (total) = `% comissao` (pct_comissao) x `premio_liquido`; fallback para `valor_comissao`.
- Comissao mensal (recebida estimada) = comissao total / parcelamento; agenda comeca no mes seguinte a emissao.
- Producao do mes = soma do premio total das apolices emitidas no mes selecionado.
- Fatura: soma parcelas devidas no mes por imobiliaria (apolice billada no mes = emissao+1 ate emissao+parcelas).
- Estimativa do mes que vem = parcelas das apolices emitidas no mes selecionado (1a parcela cai no mes seguinte).
- Elegivel: `status_emissao IN ('emitida','enviada')`; produto fianca (`residencial_pf`/`comercial_pf`/`pessoa_juridica` ou nulo). Ativas = `status_apolice IN ('ativa','renovada')` ou nulo.
- Percentual de repasse e salvo por imobiliaria/mes em `producao_comissao_imobiliaria`.
- `valor_real_fatura` e informativo para conferencia; o valor calculado vem da fonte real (`apolices`).
