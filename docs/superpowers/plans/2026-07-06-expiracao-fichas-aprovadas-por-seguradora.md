# Expiração de Fichas Aprovadas por Seguradora Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a regra de expiração automática de fichas **aprovadas** (hoje 45 dias fixos desde a criação) por um prazo ancorado na data de aprovação, variando por seguradora: 30 dias para Pottencial/Too/Tokio/Junto/Não informado, 45 dias para Porto. Fichas em outros status continuam com a regra antiga.

**Architecture:** Toda a lógica de expiração já vive em `src/lib/fichaOperational.js`, consumida por `Fichas.jsx`, `Relatorio.jsx` e `FichaStatusBadge.jsx` via `getFichaOperationalState`. A mudança é local a esse arquivo (mais o consumo em `fichas.js`, que hoje duplica um normalizador de seguradora). Persistência real do status via `pg_cron` é adicionada como migração SQL separada, criada mas **não executada** (aguardando aprovação do usuário para rodar no Supabase).

**Tech Stack:** React, JavaScript (ESM), `node:test` + `node:assert/strict` para testes, Supabase/Postgres (SQL puro, `pg_cron`).

## Global Constraints

- Escopo da nova regra: somente `status === 'aprovado'` e sem apólice emitida (`numero_apolice` ausente). Demais status mantêm a regra antiga (45 dias desde `created_at`).
- Âncora da data de aprovação: `finalizada_em`; se nulo, cai em `created_at`.
- Prazos: `Porto` = 45 dias; qualquer outro bucket (`Tokio`, `Too`, `Pottencial`, `Junto`, `Não informado`) = 30 dias.
- Não criar coluna nova no banco para "data de aprovação" — reaproveitar `finalizada_em`.
- Migração SQL (`pg_cron`) deve ser criada mas **não executada** contra o Supabase — fica pendente de aprovação explícita do usuário (mesmo tratamento dado à migração 48 existente).
- `npm test` e `npm run build` verdes ao final de cada task que altera código.

---

### Task 1: Mover normalizador de seguradora para `fichaOperational.js` (refactor puro, sem mudança de comportamento)

**Files:**
- Create: `src/lib/fichaOperational.test.mjs`
- Modify: `src/lib/fichaOperational.js`
- Modify: `src/lib/fichas.js` (linhas 1-4 e bloco 210-260, ver conteúdo abaixo)
- Modify: `package.json:11` (adicionar o novo arquivo de teste ao script `test`)

**Interfaces:**
- Produces: `normalizeSeguradoraBucket(seguradora: string | null | undefined): 'Porto' | 'Tokio' | 'Too' | 'Pottencial' | 'Junto' | 'Não informado'` exportado de `src/lib/fichaOperational.js` — usado por `fichas.js` e, na Task 2, pela própria expiração.

Contexto: `src/lib/fichas.js` hoje (linhas 210-232) tem uma cópia local desse normalizador, usada só por `fetchAprovacoesPorSeguradora` (relatório de taxa de aprovação por seguradora):

```js
const APROVACAO_SEGURADORAS = [
  'Porto',
  'Tokio',
  'Too',
  'Pottencial',
  'Junto',
  'Não informado',
]

function normalizeSeguradoraAprovacao(seguradora) {
  const raw = normalizeDisplayText(seguradora) || ''
  if (!raw) return 'Não informado'

  const text = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  if (text.includes('porto')) return 'Porto'
  if (text.includes('tokio')) return 'Tokio'
  if (text.includes('too')) return 'Too'
  if (text.includes('pottencial') || text.includes('potencial')) return 'Pottencial'
  if (text.includes('junto')) return 'Junto'

  return 'Não informado'
}
```

Esta task move `normalizeSeguradoraAprovacao` para `fichaOperational.js` (renomeado `normalizeSeguradoraBucket`, exportado) e faz `fichas.js` importar dali, sem mudar o resultado de `fetchAprovacoesPorSeguradora`.

- [ ] **Step 1: Escrever o teste que falha para `normalizeSeguradoraBucket`**

Criar `src/lib/fichaOperational.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSeguradoraBucket } from './fichaOperational.js'

test('normalizeSeguradoraBucket reconhece Porto, Tokio, Too, Pottencial e Junto', () => {
  assert.equal(normalizeSeguradoraBucket('Porto Seguro'), 'Porto')
  assert.equal(normalizeSeguradoraBucket('Tokio Marine'), 'Tokio')
  assert.equal(normalizeSeguradoraBucket('TOO Seguros'), 'Too')
  assert.equal(normalizeSeguradoraBucket('Pottencial Seguradora'), 'Pottencial')
  assert.equal(normalizeSeguradoraBucket('Potencial'), 'Pottencial')
  assert.equal(normalizeSeguradoraBucket('Junto Seguros'), 'Junto')
})

test('normalizeSeguradoraBucket cai em Não informado para vazio/nulo/desconhecido', () => {
  assert.equal(normalizeSeguradoraBucket(''), 'Não informado')
  assert.equal(normalizeSeguradoraBucket(null), 'Não informado')
  assert.equal(normalizeSeguradoraBucket(undefined), 'Não informado')
  assert.equal(normalizeSeguradoraBucket('Outra Seguradora XYZ'), 'Não informado')
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test src/lib/fichaOperational.test.mjs`
Expected: FAIL — `normalizeSeguradoraBucket is not a function` (ainda não existe em `fichaOperational.js`).

- [ ] **Step 3: Implementar `normalizeSeguradoraBucket` em `fichaOperational.js`**

`src/lib/fichaOperational.js` hoje começa assim:

```js
export const FICHA_EXPIRATION_DAYS = 45

const EXPIRABLE_BASE_STATUSES = new Set(['pendente', 'em_cotacao', 'em_analise', 'aprovado', 'emitido', 'expirada'])
const TERMINAL_NON_EXPIRABLE_STATUSES = new Set(['recusado', 'cancelado', 'cpf_invalido'])
```

Trocar por:

```js
import { normalizeDisplayText } from './text'

export const FICHA_EXPIRATION_DAYS = 45

const EXPIRABLE_BASE_STATUSES = new Set(['pendente', 'em_cotacao', 'em_analise', 'aprovado', 'emitido', 'expirada'])
const TERMINAL_NON_EXPIRABLE_STATUSES = new Set(['recusado', 'cancelado', 'cpf_invalido'])

export function normalizeSeguradoraBucket(seguradora) {
  const raw = normalizeDisplayText(seguradora) || ''
  if (!raw) return 'Não informado'

  const text = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  if (text.includes('porto')) return 'Porto'
  if (text.includes('tokio')) return 'Tokio'
  if (text.includes('too')) return 'Too'
  if (text.includes('pottencial') || text.includes('potencial')) return 'Pottencial'
  if (text.includes('junto')) return 'Junto'

  return 'Não informado'
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test src/lib/fichaOperational.test.mjs`
Expected: PASS (2 testes).

- [ ] **Step 5: Atualizar `fichas.js` para reusar `normalizeSeguradoraBucket`**

`src/lib/fichas.js` linhas 1-4 hoje:

```js
import { supabase } from './supabase'
import { normalizeImobiliaria } from './normalizeImobiliaria'
import { normalizeDisplayText } from './text'
import { getFichaDisplayStatus, getFichaOperationalState, isFichaApprovedOperational, mapFichasWithOperationalStatus, withFichaOperationalStatus } from './fichaOperational'
```

Trocar por:

```js
import { supabase } from './supabase'
import { normalizeImobiliaria } from './normalizeImobiliaria'
import { getFichaDisplayStatus, getFichaOperationalState, isFichaApprovedOperational, mapFichasWithOperationalStatus, withFichaOperationalStatus, normalizeSeguradoraBucket } from './fichaOperational'
```

(`normalizeDisplayText` deixa de ser usado diretamente em `fichas.js` depois do próximo passo, por isso sai do import.)

Depois, o bloco (hoje linhas ~210-232):

```js
const APROVACAO_SEGURADORAS = [
  'Porto',
  'Tokio',
  'Too',
  'Pottencial',
  'Junto',
  'Não informado',
]

function normalizeSeguradoraAprovacao(seguradora) {
  const raw = normalizeDisplayText(seguradora) || ''
  if (!raw) return 'Não informado'

  const text = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  if (text.includes('porto')) return 'Porto'
  if (text.includes('tokio')) return 'Tokio'
  if (text.includes('too')) return 'Too'
  if (text.includes('pottencial') || text.includes('potencial')) return 'Pottencial'
  if (text.includes('junto')) return 'Junto'

  return 'Não informado'
}
```

Vira só:

```js
const APROVACAO_SEGURADORAS = [
  'Porto',
  'Tokio',
  'Too',
  'Pottencial',
  'Junto',
  'Não informado',
]
```

E a chamada dentro de `fetchAprovacoesPorSeguradora` (hoje `const bucket = normalizeSeguradoraAprovacao(item.seguradora)`) vira:

```js
const bucket = normalizeSeguradoraBucket(item.seguradora)
```

- [ ] **Step 6: Adicionar o novo arquivo de teste ao script `test` do `package.json`**

`package.json:11` hoje:

```json
"test": "node --test src/lib/financeiroCalc.test.mjs src/lib/financeiroProducaoCalc.test.mjs src/lib/financeiroFaturasCalc.test.mjs src/lib/relatorioCobranca.test.mjs src/lib/apoliceParser.test.mjs src/lib/apolices.test.mjs"
```

Trocar por:

```json
"test": "node --test src/lib/financeiroCalc.test.mjs src/lib/financeiroProducaoCalc.test.mjs src/lib/financeiroFaturasCalc.test.mjs src/lib/relatorioCobranca.test.mjs src/lib/apoliceParser.test.mjs src/lib/apolices.test.mjs src/lib/fichaOperational.test.mjs"
```

- [ ] **Step 7: Rodar a suíte completa e o build**

Run: `npm test`
Expected: todos os arquivos listados passam, incluindo os 2 novos testes de `fichaOperational.test.mjs`.

Run: `npm run build`
Expected: build verde, sem erros de import quebrado.

- [ ] **Step 8: Commit**

```bash
git add src/lib/fichaOperational.js src/lib/fichas.js src/lib/fichaOperational.test.mjs package.json
git commit -m "refactor: move normalizeSeguradoraBucket para fichaOperational.js"
```

---

### Task 2: Prazo de expiração por seguradora, ancorado em `finalizada_em`, só para fichas aprovadas

**Files:**
- Modify: `src/lib/fichaOperational.js`
- Modify: `src/lib/fichaOperational.test.mjs` (adicionar testes)

**Interfaces:**
- Consumes: `normalizeSeguradoraBucket` (Task 1, mesmo arquivo).
- Produces: comportamento novo de `isFichaExpiredOperational(ficha, options)` — assinatura inalterada (`ficha`, `options = { now }`), usada por `getFichaDisplayStatus` e `getFichaOperationalState` (também no mesmo arquivo) sem nenhuma mudança de chamada necessária nos consumidores (`Fichas.jsx`, `Relatorio.jsx`, `FichaStatusBadge.jsx`).

Estado atual de `isFichaExpiredOperational` e `getFichaAgeDays` em `fichaOperational.js` (após a Task 1):

```js
export function getFichaAgeDays(ficha = {}, now = new Date()) {
  if (!ficha?.created_at) return null
  const createdAt = new Date(ficha.created_at)
  if (Number.isNaN(createdAt.getTime())) return null
  return Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
}

export function isFichaExpiredOperational(ficha = {}, options = {}) {
  const status = String(ficha?.status || '').toLowerCase()
  if (!status || TERMINAL_NON_EXPIRABLE_STATUSES.has(status)) return false
  if (!EXPIRABLE_BASE_STATUSES.has(status)) return false
  if (hasFichaEmittedPolicy(ficha)) return false

  const ageDays = getFichaAgeDays(ficha, options.now)
  return ageDays != null && ageDays >= FICHA_EXPIRATION_DAYS
}
```

- [ ] **Step 1: Escrever os testes que falham para a nova regra de fichas aprovadas**

Adicionar ao final de `src/lib/fichaOperational.test.mjs`:

```js
import { isFichaExpiredOperational } from './fichaOperational.js'

test('ficha aprovada da Porto expira com 45 dias desde finalizada_em, não com 44', () => {
  const now = new Date('2026-07-06T00:00:00.000Z')

  const dia44 = { status: 'aprovado', seguradora: 'Porto Seguro', finalizada_em: '2026-05-23T00:00:00.000Z' }
  assert.equal(isFichaExpiredOperational(dia44, { now }), false)

  const dia45 = { status: 'aprovado', seguradora: 'Porto Seguro', finalizada_em: '2026-05-22T00:00:00.000Z' }
  assert.equal(isFichaExpiredOperational(dia45, { now }), true)
})

test('ficha aprovada da Pottencial/Too/Tokio/Junto expira com 30 dias, não com 29', () => {
  const now = new Date('2026-07-06T00:00:00.000Z')
  for (const seguradora of ['Pottencial', 'Too Seguros', 'Tokio Marine', 'Junto Seguros', '']) {
    const dia29 = { status: 'aprovado', seguradora, finalizada_em: '2026-06-07T00:00:00.000Z' }
    assert.equal(isFichaExpiredOperational(dia29, { now }), false, seguradora)

    const dia30 = { status: 'aprovado', seguradora, finalizada_em: '2026-06-06T00:00:00.000Z' }
    assert.equal(isFichaExpiredOperational(dia30, { now }), true, seguradora)
  }
})

test('ficha aprovada sem finalizada_em usa created_at como fallback', () => {
  const now = new Date('2026-07-06T00:00:00.000Z')
  const semFinalizadaEm = { status: 'aprovado', seguradora: 'Pottencial', created_at: '2026-06-06T00:00:00.000Z' }
  assert.equal(isFichaExpiredOperational(semFinalizadaEm, { now }), true)
})

test('ficha aprovada com apólice emitida nunca expira, mesmo passado o prazo', () => {
  const now = new Date('2026-07-06T00:00:00.000Z')
  const comApolice = { status: 'aprovado', seguradora: 'Pottencial', finalizada_em: '2026-01-01T00:00:00.000Z', numero_apolice: '12345' }
  assert.equal(isFichaExpiredOperational(comApolice, { now }), false)
})

test('status diferente de aprovado mantém a regra antiga de 45 dias desde created_at', () => {
  const now = new Date('2026-07-06T00:00:00.000Z')
  const pendenteDia44 = { status: 'pendente', seguradora: 'Pottencial', created_at: '2026-05-23T00:00:00.000Z' }
  assert.equal(isFichaExpiredOperational(pendenteDia44, { now }), false)

  const pendenteDia45 = { status: 'pendente', seguradora: 'Pottencial', created_at: '2026-05-22T00:00:00.000Z' }
  assert.equal(isFichaExpiredOperational(pendenteDia45, { now }), true)
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test src/lib/fichaOperational.test.mjs`
Expected: FAIL nos novos testes de fichas aprovadas com prazo por seguradora (a implementação atual ainda usa `created_at` + 45 dias fixos para todo mundo).

- [ ] **Step 3: Implementar a nova ramificação em `fichaOperational.js`**

Substituir o trecho:

```js
export function getFichaAgeDays(ficha = {}, now = new Date()) {
  if (!ficha?.created_at) return null
  const createdAt = new Date(ficha.created_at)
  if (Number.isNaN(createdAt.getTime())) return null
  return Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
}

export function isFichaExpiredOperational(ficha = {}, options = {}) {
  const status = String(ficha?.status || '').toLowerCase()
  if (!status || TERMINAL_NON_EXPIRABLE_STATUSES.has(status)) return false
  if (!EXPIRABLE_BASE_STATUSES.has(status)) return false
  if (hasFichaEmittedPolicy(ficha)) return false

  const ageDays = getFichaAgeDays(ficha, options.now)
  return ageDays != null && ageDays >= FICHA_EXPIRATION_DAYS
}
```

Por:

```js
const FICHA_EXPIRATION_DAYS_BY_SEGURADORA = {
  Porto: 45,
}
const DEFAULT_APROVADA_EXPIRATION_DAYS = 30

function getDaysSince(dateValue, now) {
  if (!dateValue) return null
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

function getFichaExpirationThresholdDays(seguradora) {
  const bucket = normalizeSeguradoraBucket(seguradora)
  return FICHA_EXPIRATION_DAYS_BY_SEGURADORA[bucket] ?? DEFAULT_APROVADA_EXPIRATION_DAYS
}

export function getFichaAgeDays(ficha = {}, now = new Date()) {
  return getDaysSince(ficha?.created_at, now)
}

export function isFichaExpiredOperational(ficha = {}, options = {}) {
  const status = String(ficha?.status || '').toLowerCase()
  if (!status || TERMINAL_NON_EXPIRABLE_STATUSES.has(status)) return false
  if (!EXPIRABLE_BASE_STATUSES.has(status)) return false
  if (hasFichaEmittedPolicy(ficha)) return false

  const now = options.now || new Date()

  if (status === 'aprovado') {
    const anchor = ficha?.finalizada_em || ficha?.created_at
    const ageDays = getDaysSince(anchor, now)
    const thresholdDays = getFichaExpirationThresholdDays(ficha?.seguradora)
    return ageDays != null && ageDays >= thresholdDays
  }

  const ageDays = getFichaAgeDays(ficha, now)
  return ageDays != null && ageDays >= FICHA_EXPIRATION_DAYS
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test src/lib/fichaOperational.test.mjs`
Expected: PASS em todos os testes (os da Task 1 e os novos da Task 2).

- [ ] **Step 5: Rodar a suíte completa e o build**

Run: `npm test`
Expected: verde.

Run: `npm run build`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fichaOperational.js src/lib/fichaOperational.test.mjs
git commit -m "feat: expiracao de fichas aprovadas por prazo de seguradora (30/45 dias desde finalizada_em)"
```

---

### Task 3: Migração SQL de persistência (pg_cron) — criada, não executada — e atualização de `CURRENT_TASK.md`

**Files:**
- Create: `supabase/49_fichas_expiracao_por_seguradora.sql`
- Modify: `docs/CURRENT_TASK.md`

**Interfaces:**
- Consumes: nenhuma (SQL standalone). Reflete a mesma regra de negócio das Tasks 1-2 (Porto 45 dias, demais 30 dias, ancorado em `finalizada_em` com fallback `created_at`, só para `status = 'aprovado'` sem `numero_apolice`).

- [ ] **Step 1: Criar a migração SQL**

Criar `supabase/49_fichas_expiracao_por_seguradora.sql`:

```sql
-- Expira automaticamente fichas aprovadas sem apólice emitida, com prazo por
-- seguradora: Porto 45 dias, demais (Tokio/Too/Pottencial/Junto/Não informado)
-- 30 dias, contados de finalizada_em (fallback created_at).
--
-- ATENÇÃO: este arquivo cria uma extensão (pg_cron), uma função
-- SECURITY DEFINER e um job agendado. NÃO deve ser executado sem revisão e
-- aprovação explícita do usuário (ver docs/CURRENT_TASK.md e CLAUDE.md,
-- seção "Seguranca"). Rodar manualmente no SQL Editor do Supabase quando
-- aprovado.

-- 1. Extensão (algumas contas Supabase exigem habilitar pg_cron pelo
--    Dashboard > Database > Extensions antes deste CREATE funcionar)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 2. Função SECURITY DEFINER — roda com privilégios do dono, contorna RLS
--    sem expor service_role em lugar nenhum (nenhuma chave client-side envolvida)
CREATE OR REPLACE FUNCTION public.expirar_fichas_aprovadas()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.fichas f
  SET status = 'expirada'
  WHERE f.status = 'aprovado'
    AND f.numero_apolice IS NULL
    AND COALESCE(f.finalizada_em, f.created_at) <= NOW() - (
      CASE
        WHEN f.seguradora ILIKE '%porto%' THEN 45
        ELSE 30
      END || ' days'
    )::interval;
$$;

-- 3. Agendamento diário (06:00 UTC ~ 03:00 BRT — ajustável)
SELECT cron.schedule(
  'expirar-fichas-aprovadas-diario',
  '0 6 * * *',
  $$SELECT public.expirar_fichas_aprovadas();$$
);
```

- [ ] **Step 2: Atualizar `docs/CURRENT_TASK.md`**

Adicionar uma nova entrada no topo da seção de frente ativa (mesmo padrão das entradas anteriores do arquivo), registrando: responsável, objetivo, arquivos alterados (`src/lib/fichaOperational.js`, `src/lib/fichas.js`, `src/lib/fichaOperational.test.mjs`, `package.json`, `supabase/49_fichas_expiracao_por_seguradora.sql`), e o risco pendente — migração 49 criada mas **não executada**, aguardando aprovação do usuário para rodar no Supabase SQL Editor (mesmo tratamento já dado à migração 48 existente no arquivo).

- [ ] **Step 3: Commit**

```bash
git add supabase/49_fichas_expiracao_por_seguradora.sql docs/CURRENT_TASK.md
git commit -m "docs: migracao pendente de expiracao automatica de fichas aprovadas (nao executada)"
```

- [ ] **Step 4: Comunicar ao usuário o pendente de execução**

Ao final da task, avisar explicitamente: a migração `supabase/49_fichas_expiracao_por_seguradora.sql` foi criada mas **não** foi rodada no Supabase — pede aprovação explícita antes de executar (extensão nova, função `SECURITY DEFINER`, job agendado que grava dado).

---

## Self-Review

**Spec coverage:**
- Regra de negócio (escopo aprovado, âncora `finalizada_em`, prazos por seguradora) → Task 2.
- Cálculo ao vivo / eliminar duplicação do normalizador → Task 1.
- Persistência via SQL/pg_cron, criada mas não executada → Task 3.
- Riscos e testes (Porto 44/45/46, demais 29/30/31, fallback `created_at`, não-regressão de outros status) → cobertos nos testes da Task 2.
- Atualização de `docs/CURRENT_TASK.md` no início/fim da tarefa (regra do CLAUDE.md) → Task 3, Step 2.

**Placeholder scan:** nenhum "TBD"/"implementar depois" — todos os steps têm código completo.

**Type consistency:** `normalizeSeguradoraBucket` definido na Task 1 é consumido com o mesmo nome na Task 2 (`getFichaExpirationThresholdDays`) e não é redefinido em nenhum outro lugar. `isFichaExpiredOperational(ficha, options)` mantém a mesma assinatura entre as tasks.
