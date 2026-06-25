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

### Defaults de cálculo assumidos

- Agenda de recebimentos **começa na `data_emissao`** (parcela 1 = mês da emissão).
- Produção e faturas contam apenas `status_emissao IN ('emitida','enviada')`
  **E** `status_apolice = 'ativa'` (exclui cancelada, expirada, recusada/encerrada).
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
  mes_referencia  date not null,           -- 1º dia do mês (data_emissao + (n-1) meses)
  valor_previsto  numeric not null,        -- comissao_total / parcelamento (última absorve resto)
  seguradora      text,                    -- denormalizado p/ agrupamento
  imobiliaria     text,                    -- denormalizado p/ agrupamento
  created_at      timestamptz not null default now(),
  unique (apolice_id, numero_parcela)
)
índices: (mes_referencia), (apolice_id), (imobiliaria), (seguradora)
```

- Gerada/regenerada por trigger quando `valor_comissao`, `parcelamento`,
  `data_emissao` ou status mudam, somente para apólices ativas/emitidas.
- Rateio: `valor_previsto = round(valor_comissao / parcelamento, 2)`; a última
  parcela recebe o resíduo para que a soma feche com `valor_comissao`.

### 4.3 `faturas_imobiliaria` (Fase 3)

```
faturas_imobiliaria (
  id              uuid pk default gen_random_uuid(),
  imobiliaria     text not null,
  mes_referencia  date not null,           -- 1º dia do mês
  qtd_apolices    int not null default 0,  -- auto (apólices ativas/emitidas no mês)
  valor_estimado  numeric not null default 0, -- auto: soma das parcelas mensais
  valor_real      numeric,                 -- manual: fiança + incêndio informado
  pct_comissao    numeric,                 -- default de imobiliarias.pct_comissao
  valor_a_pagar   numeric,                 -- valor_real * pct_comissao / 100
  status          text not null default 'pendente' check (status in ('pendente','pago')),
  observacao      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (imobiliaria, mes_referencia)
)
```

- `valor_a_pagar` recalculado quando `valor_real` ou `pct_comissao` mudam.
- `status` derivado: `pago` quando a soma dos repasses cobre `valor_a_pagar`.
- Geração automática mensal via função/RPC `fn_gerar_faturas_mes(mes)` que cria/atualiza
  1 fatura por imobiliária a partir das apólices ativas/emitidas (count + soma das parcelas).

### 4.4 `repasses_comissao` (Fase 3) — registro auditável

Cada pagamento/repasse é uma linha, preservando histórico para conferência.

```
repasses_comissao (
  id               uuid pk default gen_random_uuid(),
  fatura_id        uuid not null references faturas_imobiliaria(id) on delete cascade,
  valor_pago       numeric not null,
  data_pagamento   date not null,
  pago_por         uuid references profiles(id),  -- usuário responsável
  forma_pagamento  text,
  observacao       text,
  comprovante_path text,                            -- opcional (storage)
  created_at       timestamptz not null default now()
)
índices: (fatura_id), (data_pagamento)
```

- Ao inserir/remover repasse, recalcula o `status` da fatura
  (`pago` se Σ `valor_pago` ≥ `valor_a_pagar`).

## 5. Camada de dados (lib)

- `src/lib/financeiro.js` (novo) — consultas e mutations do módulo:
  - `fetchIndicadoresMes({ ano, mes })` → comissão gerada, recebida estimada, apólices.
  - `fetchAgendaRecebimentos({ inicio, fim })` → agrupado por `mes_referencia`.
  - `fetchProjecaoProximosMeses({ meses })` → soma por mês futuro.
  - `fetchProducaoImobiliarias({ inicio, fim })` / `fetchProducaoPorSeguradora(imobiliaria, ...)`.
  - `fetchFaturas({ mes })`, `gerarFaturasMes(mes)`, `fetchFaturaDetalhe(id)`.
  - `salvarFaturaValores(id, { valorReal, pctComissao })`.
  - `registrarRepasse(faturaId, dados)`, `fetchRepasses(faturaId)`.
- `src/lib/logosResolver.js` (novo) — mapeia nome de imobiliária/seguradora → logo,
  usando catálogos com `nome_canonico` + aliases (cache em memória).

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
- `logosResolver.js`; página Produção por imobiliária → drill-down seguradora,
  com logos, prêmio, comissão gerada, recebida estimada e % de participação;
  filtros de período / comparativo mensal / evolução histórica.

### Fase 3 — Faturas e Repasses
- Tabelas `faturas_imobiliaria` + `repasses_comissao` + RPC de geração mensal.
- Lista de faturas (com logos), detalhe com lista de apólices (nº, cliente,
  seguradora, imobiliária, parcela mensal, status, data de emissão).
- Campos manuais (valor real, % comissão) + cálculo automático de valor a pagar.
- Registro de repasses (auditável) + controle de pagamento (pendente/pago).
- Navegação fatura ↔ apólice preservando estado.

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
