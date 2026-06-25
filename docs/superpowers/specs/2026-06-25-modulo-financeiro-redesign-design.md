# Design — Reestruturação do Módulo Financeiro (Seguro Fiança)

> Data: 2026-06-25
> Responsável: Claude
> Status: aprovado para implementação (Fase 1)

## 1. Objetivo

Remodelar o módulo financeiro para refletir o funcionamento real do Seguro Fiança,
sem impactar outras áreas do sistema. O módulo deve controlar:

1. Comissão gerada no mês.
2. Comissão recebida estimada (rateada por parcelas, com agenda mês a mês).
3. Produção por imobiliária.
4. Produção por seguradora.
5. Faturas das imobiliárias.
6. Repasses de comissão (registro auditável).
7. Controle de pagamento.
8. Histórico mensal e comparativos.
9. Logos de imobiliárias e seguradoras para identificação visual.
10. Navegação integrada entre faturas e apólices (preservando estado).

## 2. Decisões de produto (confirmadas)

- **Entrega faseada.** Fase 1 (indicadores) → Fase 2 (produção) → Fase 3 (faturas).
  Cada fase aprovada e testada antes da próxima.
- **Comissão recebida estimada = agenda mês a mês** + projeção do valor total dos
  próximos meses, deixando explícito que o valor é dividido conforme as parcelas.
- **Faturas auto-geradas por mês** a partir das apólices ativas/emitidas.
- **Faturas e repasses como tabelas registradas e auditáveis** (conferência).
- **Navegação em sub-rotas aninhadas sob `/financeiro`** (mantém o `AdminRoute`).

### Defaults de cálculo confirmados

- **Agenda de recebimentos:** começa na `data_emissao`, mas a **1ª parcela cai no
  mês seguinte** (apólice emitida hoje → comissão entra no mês que vem).
  Parcela _n_ → `mes_referencia` = mês da emissão + _n_.
- **Competência da fatura:** apólice emitida **dia 1–30** entra na fatura do **mês
  seguinte**; emitida **dia 31** entra na fatura do **2º mês** (corte no dia 30).
- Produção e faturas contam apenas `status_emissao IN ('emitida','enviada')`
  **E** `status_apolice IN ('ativa','renovada')` (exclui cancelada, expirada,
  recusada/encerrada). **Renovadas entram no mesmo formato.**
- **Pagamento da fatura:** `valor_a_pagar` = `valor_real` × `pct_comissao`
  (% informado pelo usuário), sem conexão com os recebimentos. Pagamento registrado
  na própria fatura (registro auditável); sem tabela separada de repasses.
- Logos resolvidos por nome → `nome_canonico` + aliases das tabelas
  `imobiliarias` / `seguradoras`.

## 3. Estado atual (reaproveitado)

- **`apolices`** — fonte da verdade. Campos relevantes: `data_emissao`,
  `status_emissao` (recebida/proposta_transmitida/emitida/enviada),
  `status_apolice` (ativa/cancelada/expirada/renovada), `parcelamento`,
  `valor_parcela`, `valor_comissao`, `premio_total`, `valor_producao`,
  `pct_comissao`, `seguradora` (texto), `imobiliaria` (texto).
- **`apolices_comissoes`** — ledger 1:1 com a apólice, sincronizado por trigger
  `fn_sync_apolice_comissao`. Já contém `comissao_mensal = valor_comissao / parcelamento`.
  **Lacuna:** não carrega `status_apolice` → não permite excluir canceladas/expiradas.
- **`imobiliarias`** — `imagem_url` / `imagem_path` (logo), `pct_comissao`,
  `recebe_comissao`, aliases em `imobiliaria_aliases`.
- **`seguradoras`** — `logo_url` / `logo_path`, aliases em `seguradora_aliases`.
- **`Financeiro.jsx`** — página admin-only, hoje mostra comissão mensal + produção
  por seguradora. Será reescrita como hub.

## 4. Modelo de dados (novas estruturas)

Todas as tabelas novas: RLS ativa, acesso restrito via `is_finance_admin()`,
seguindo o padrão de `apolices_comissoes`.

### 4.1 Ajuste no ledger existente

`apolices_comissoes`:
- `ADD COLUMN status_apolice TEXT` — preenchido pelo trigger a partir de
  `apolices.status_apolice`, para permitir os filtros de produção/fatura.

### 4.2 `comissoes_recebimentos` (Fase 1)

Agenda mês a mês da comissão recebida estimada. Uma linha por parcela de cada apólice.

```
comissoes_recebimentos (
  id              uuid pk default gen_random_uuid(),
  apolice_id      uuid not null references apolices(id) on delete cascade,
  numero_parcela  int not null,            -- 1..parcelamento
  total_parcelas  int not null,
  mes_referencia  date not null,           -- 1º dia do mês = mês da emissão + numero_parcela
                                           -- (1ª parcela cai no mês seguinte à emissão)
  valor_previsto  numeric not null,        -- comissao_total / parcelamento (última absorve resto)
  seguradora      text,                    -- denormalizado p/ agrupamento
  imobiliaria     text,                    -- denormalizado p/ agrupamento
  created_at      timestamptz not null default now(),
  unique (apolice_id, numero_parcela)
)
índices: (mes_referencia), (apolice_id), (imobiliaria), (seguradora)
```

- Gerada/regenerada por trigger quando `valor_comissao`, `parcelamento`,
  `data_emissao` ou status mudam, somente para apólices emitidas/enviadas com
  `status_apolice IN ('ativa','renovada')`.
- 1ª parcela cai no mês seguinte à emissão: `mes_referencia(n) =
  date_trunc('month', data_emissao) + n meses`.
- Rateio: `valor_previsto = round(valor_comissao / parcelamento, 2)`; a última
  parcela recebe o resíduo para que a soma feche com `valor_comissao`.

### 4.3 `faturas_imobiliaria` (Fase 3) — registro de pagamento (sempre ao vivo)

Os valores da fatura são **calculados ao vivo** do ledger (não persistidos):
- **Valor da fatura** = Σ `valor_parcela` das apólices com parcela devida no mês.
- **Valor a pagar (repasse)** = `pct` × valor da fatura, com `pct` vindo de
  `producao_comissao_imobiliaria` (o % salvo por imobiliária/mês — Fase 2).

A tabela persiste **apenas o controle de pagamento** (para conferência/auditoria):

```
faturas_imobiliaria (
  id              uuid pk default gen_random_uuid(),
  imobiliaria     text not null,
  mes_referencia  date not null,           -- 1º dia do mês
  status          text not null default 'pendente' check (status in ('pendente','pago')),
  data_pagamento  date,                    -- preenchido ao marcar como pago
  pago_por        uuid references profiles(id),
  observacao      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (imobiliaria, mes_referencia)
)
```

- A linha é criada sob demanda ao **marcar como pago** (upsert por imobiliária/mês);
  sem linha = `pendente`.
- **Parcela devida no mês:** apólice contribui com `valor_parcela` nos meses do seu
  ciclo de parcelas — 1ª parcela no mês seguinte à emissão, durante `parcelamento` meses
  (mesmo cronograma da agenda). Inclui ativas e renovadas.
- O cálculo do ciclo é **puro/testável** (a partir de `data_emissao` + `parcelamento`),
  sem depender de tabela de cronograma.
- **% da imobiliária:** o `pct_comissao` da fatura vem de `producao_comissao_imobiliaria`
  (ver 4.4) — o mesmo % mensal definido na Produção (Fase 2), não digitado de novo.
  O repasse devido = `pct_comissao` × **comissão gerada da imobiliária no mês**
  (base unificada; `valor_real` permanece como informação da imobiliária, não como base do repasse).

### 4.4 `producao_comissao_imobiliaria` (Fase 2) — % de repasse por imobiliária/mês

Percentual definido manualmente pelo usuário, salvo por imobiliária e por mês.
Aplica-se sobre a **comissão gerada daquela imobiliária no mês**; o valor a repassar é
calculado (não precisa ser persistido, deriva do ledger), mas o `%` é histórico e auditável.

```
producao_comissao_imobiliaria (
  id              uuid pk default gen_random_uuid(),
  imobiliaria     text not null,
  mes_referencia  date not null,           -- 1º dia do mês
  pct_comissao    numeric,                 -- definido pelo usuário; default = imobiliarias.pct_comissao
  atualizado_por  uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (imobiliaria, mes_referencia)
)
```

- Valor a repassar (exibido) = `pct_comissao` × Σ `valor_comissao` das apólices da
  imobiliária emitidas no mês (base = comissão gerada da própria imobiliária).
- Default ao abrir um mês sem registro: `imobiliarias.pct_comissao` (valor único atual),
  até o usuário salvar o % daquele mês.
- Este é o mesmo % que a Fatura (Fase 3) usa como repasse — fonte única da verdade.

## 5. Camada de dados (lib)

- `src/lib/financeiro.js` (novo) — consultas e mutations do módulo:
  - `fetchIndicadoresMes({ ano, mes })` → comissão gerada, recebida estimada, apólices.
  - `fetchAgendaRecebimentos({ inicio, fim })` → agrupado por `mes_referencia`.
  - `fetchProjecaoProximosMeses({ meses })` → soma por mês futuro.
  - `fetchProducaoImobiliarias({ inicio, fim })` → agregação por imobiliária (qtd, prêmio,
    comissão gerada, recebida estimada) + `pct_comissao` salvo do mês + valor a repassar.
  - `fetchProducaoPorSeguradora({ imobiliaria, inicio, fim })` → quebra por seguradora
    (qtd, prêmio, comissão, % de participação dentro da imobiliária).
  - `fetchEvolucaoProducao({ imobiliaria?, meses })` → série mensal (prêmio/comissão) p/ gráfico.
  - `salvarPctImobiliaria({ imobiliaria, mes, pct, userId })` → upsert em `producao_comissao_imobiliaria`.
  - `fetchFaturas({ mes })`, `gerarFaturasMes(mes)`, `fetchFaturaDetalhe(id)`.
  - `marcarFaturaPaga(id, { dataPagamento, pagoPor, observacao })` / `reabrirFatura(id)`.
- `src/lib/financeiroProducaoCalc.js` (novo, puro/testável) — `agruparPorImobiliaria`,
  `agruparPorSeguradora` (com % de participação), `agruparEvolucaoPorMes`.
- `src/lib/imobiliariasLogos.js` (novo) — resolver nome→logo de imobiliária via catálogo
  `imobiliarias` + aliases (cache). Seguradoras usam o `SeguradoraBadge` existente (auto-resolve).

## 6. Camada de UI

- `/financeiro` vira hub com sub-rotas aninhadas:
  - `Financeiro.jsx` (layout + abas) →
    - `FinanceiroVisaoGeral.jsx` (Fase 1)
    - `FinanceiroProducao.jsx` (Fase 2)
    - `FinanceiroFaturas.jsx` + `FinanceiroFaturaDetalhe.jsx` (Fase 3)
- Componentes reutilizados: `PageHeader`, `MetricCard`, `DataCard`, `Select`,
  `EmptyState` (já existentes em `components/ui`).
- Navegação fatura ↔ apólice: detalhe da fatura lista apólices com link para
  `/apolices/:id`; estado (filtros, página, scroll, ordenação) preservado via
  query params na URL + `sessionStorage` para restaurar o scroll ao voltar.

## 7. Faseamento e escopo de implementação

### Fase 1 — Visão Geral (esta entrega)
- Migração: `status_apolice` no ledger + tabela `comissoes_recebimentos` + trigger + backfill.
- `src/lib/financeiro.js` (indicadores + agenda + projeção).
- Reescrita do `Financeiro.jsx` como hub; aba **Visão Geral**:
  - Cards: Comissão Gerada (mês), Comissão Recebida Estimada (mês), Apólices.
  - Agenda mês a mês (lista/gráfico por `mes_referencia`).
  - Projeção dos próximos meses, deixando explícito o rateio por parcelas.
- Filtro de período (mês/ano + comparativo simples).

### Fase 2 — Produção
- Migração: tabela `producao_comissao_imobiliaria` (% por imobiliária/mês), RLS admin-only.
- `financeiroProducaoCalc.js` (puro/testável) + `imobiliariasLogos.js` (resolver de logo).
- Base de tempo **por emissão** (consistente com a Comissão Gerada da Fase 1).
- Aba **Produção** (`/financeiro/producao`): lista de imobiliárias com logo, nº apólices,
  prêmio total, comissão gerada, recebida estimada, **% editável salvo por mês** e
  **valor a repassar** (= % × comissão gerada da imobiliária). Gráfico de evolução
  (recharts) + comparativo vs. mês anterior.
- **Detalhe dedicado** (`/financeiro/producao/:imobiliaria`): cabeçalho com logo, cards do
  período, quebra por seguradora (qtd, prêmio, comissão, % de participação na imobiliária),
  e gráfico de evolução da imobiliária. Botão voltar.

### Fase 3 — Faturas
- Migração `faturas_imobiliaria` (registro de pagamento) + RLS admin-only.
- `financeiroFaturasCalc.js` (puro/testável): ciclo de parcelas (`apoliceBilladaNoMes`)
  e `montarFaturasMes` (Σ `valor_parcela` por imobiliária + valor a pagar = % × fatura).
- Aba **Faturas** (`/financeiro/faturas`): **seletor de mês** + **lista** de faturas
  (uma por imobiliária, com logo): valor da fatura (Σ parcelas), % (da Produção),
  valor a pagar, status pendente/pago, ação **marcar pago** (registra data + usuário).
- **Detalhe da fatura** (`/financeiro/faturas/:imobiliaria/:mes`): lista das apólices
  com parcela devida no mês (nº, cliente, seguradora, parcela, status, data de emissão);
  clicar numa apólice abre `/apolices/:id` e o **voltar preserva o estado** (mês/scroll).
- Valores **sempre ao vivo**; só o pagamento é persistido.
- **Nota de consistência:** a base do repasse aqui é **% × valor da fatura (Σ parcelas)**,
  diferente do "a repassar" da Produção (% × comissão gerada). A unificar se desejado.

## 8. Segurança

- Novas tabelas com RLS ativa e leitura/escrita restritas a `is_finance_admin()`.
- Nenhuma credencial em código; `service_role` permanece apenas no n8n.
- Triggers `SECURITY DEFINER` seguindo o padrão de `fn_sync_apolice_comissao`.
- Migrações idempotentes (`IF NOT EXISTS` / `CREATE OR REPLACE`).

## 9. Riscos e mitigações

- **Dados financeiros sensíveis** → RLS admin-only desde a criação.
- **Apólices referenciam imobiliária/seguradora por texto** → resolver de logos
  tolerante a aliases; agrupamento por nome normalizado.
- **Reprocessamento da agenda** ao editar apólices antigas → trigger regenera
  parcelas de forma idempotente (delete+insert por apólice).
- **Arredondamento das parcelas** → última parcela absorve o resíduo para fechar o total.

## 10. Fora de escopo (YAGNI)

- Conciliação bancária real / integração com extrato.
- Exportação PDF/Excel das faturas (pode virar fase futura).
- Seguro incêndio como produto separado (entra apenas como componente do "valor real").

## 11. Revisão de design — Dashboard / Calendário / Ranking / Produção por seleção

Revisão das telas das Fases 1 e 2 (decidida em 2026-06-25). Substitui as listas por
um dashboard com calendário e ranking, e troca a Produção em lista por seleção.

### Definições

- **Produção = Σ `premio_total`** de todas as apólices emitidas (base por emissão).
  Este é o indicador-título; comissão gerada/recebida são secundários.
- Calendário aplica-se à **Visão Geral** (calendário anual) e às **Faturas** (Fase 3).

### Visão Geral (vira Dashboard)

- Seletor de **ano**.
- **KPIs do mês selecionado:** Produção (Σ prêmio), Comissão Gerada, Recebida Estimada, Apólices.
- **Calendário anual:** grade de 12 meses; cada célula mostra a Produção (Σ prêmio) e a
  comissão do mês; o mês selecionado fica destacado; clicar numa célula seleciona o mês
  (atualiza KPIs + ranking). Substitui a agenda em lista.
- **Ranking de imobiliárias** do mês selecionado, com **foto/logo**, ordenado por Produção
  (Σ prêmio). Clicar numa imobiliária abre a Produção dela (`/financeiro/producao/:imobiliaria`).

### Produção (vira seleção, não lista)

- Aba `/financeiro/producao`: **Select de imobiliária** + seletor de mês. Ao escolher a
  imobiliária, mostra a **produção do mês** (Σ prêmio total), a quebra por seguradora
  (logos + % de participação) e o **% de repasse editável salvo por mês** + valor a repassar.
- A rota `/financeiro/producao/:imobiliaria` renderiza a mesma página com a imobiliária
  pré-selecionada (usada pelo clique no ranking). A página de detalhe separada é absorvida.

### Pure/UI

- `financeiroProducaoCalc.js`: `montarCalendarioAno` (mescla ledger + recebimentos em 12 meses)
  e `rankingImobiliarias` (ordena por prêmio). `CalendarioAno.jsx` (componente de grade).
- `agruparPorImobiliaria` passa a ser ordenado/exibido por **prêmio** (produção).
