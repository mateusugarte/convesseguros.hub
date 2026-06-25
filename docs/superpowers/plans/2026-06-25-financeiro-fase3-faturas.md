# Financeiro — Fase 3 (Faturas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Aba **Faturas**: por mês, listar 1 fatura por imobiliária (valor da fatura = Σ parcelas devidas, % da Produção, valor a pagar = % × fatura, status pendente/pago) e um detalhe com as apólices da fatura, navegando para a apólice e voltando preservando o estado.

**Architecture:** Valores **sempre ao vivo** (calculados do ledger `apolices_comissoes`); apenas o pagamento é persistido (`faturas_imobiliaria`). O ciclo de parcelas (1ª no mês seguinte à emissão, durante `parcelamento` meses) é puro/testável em `financeiroFaturasCalc.js`. UI em sub-rotas sob `/financeiro`.

**Tech Stack:** React 18 + Vite, react-router-dom v6, Supabase (Postgres + RLS), Tailwind. Testes `node --test`.

## Global Constraints

- RLS admin-only em `faturas_imobiliaria` (`is_finance_admin()`); migração idempotente; sem secrets.
- Base por emissão/elegibilidade: ledger filtrado `status_emissao IN ('emitida','enviada')` E `status_apolice IN ('ativa','renovada')`/null.
- **Valor da fatura** = Σ `valor_parcela` das apólices com parcela devida no mês.
- **Valor a pagar** = `pct`/100 × valor da fatura, com `pct` de `producao_comissao_imobiliaria` (mês).
- Ciclo de parcelas: 1ª parcela no mês seguinte à emissão; durante `parcelamento` meses.
- Reusar `PageHeader`/`MetricCard`/`DataCard`/`EmptyState`/`Select` (`src/components/ui`), `ImobiliariaIdentity`, `SeguradoraBadge`; `formatMoneyBR` (`src/lib/apolices`); helpers de `src/lib/financeiroCalc`; data layer em `src/lib/financeiro.js`; resolver em `src/lib/imobiliariasLogos.js`.
- Import depth `../../`. Design system: brand-secondary `#2B5BA8` ativo; `dark-*`.

---

### Task 1: Migração — `faturas_imobiliaria`

**Files:**
- Create: `supabase/46_faturas_imobiliaria.sql`

**Interfaces:**
- Produces (no banco): tabela `public.faturas_imobiliaria(id, imobiliaria, mes_referencia, status, data_pagamento, pago_por, observacao, created_at, updated_at)` com `unique(imobiliaria, mes_referencia)` e RLS admin-only.
- Consumes: `public.is_finance_admin()`, `public.profiles(id)` (já existem).

> **Nota:** exige Supabase SQL Editor (sem acesso a banco pelo agente). Deliverable do agente = arquivo `.sql` correto + commit. Aplicação é manual (humano).

- [ ] **Step 1: Criar o arquivo de migração**

Create `supabase/46_faturas_imobiliaria.sql`:

```sql
-- ============================================================
-- CONVES SYSTEM — 46_faturas_imobiliaria.sql
-- Fase 3 do redesign financeiro: controle de pagamento das faturas
-- das imobiliárias. Os valores da fatura são calculados ao vivo;
-- esta tabela persiste apenas o status de pagamento (conferência).
-- Rodar no Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.faturas_imobiliaria (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria     TEXT NOT NULL,
  mes_referencia  DATE NOT NULL,            -- 1º dia do mês
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  data_pagamento  DATE,
  pago_por        UUID REFERENCES public.profiles(id),
  observacao      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (imobiliaria, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_faturas_imob_mes
  ON public.faturas_imobiliaria(mes_referencia);

ALTER TABLE public.faturas_imobiliaria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "faturas_imob_select_admin" ON public.faturas_imobiliaria;
CREATE POLICY "faturas_imob_select_admin"
ON public.faturas_imobiliaria FOR SELECT
TO authenticated
USING (public.is_finance_admin());

DROP POLICY IF EXISTS "faturas_imob_write_admin" ON public.faturas_imobiliaria;
CREATE POLICY "faturas_imob_write_admin"
ON public.faturas_imobiliaria FOR ALL
TO authenticated
USING (public.is_finance_admin())
WITH CHECK (public.is_finance_admin());

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/46_faturas_imobiliaria.sql
git commit -m "feat(financeiro): tabela faturas_imobiliaria (controle de pagamento, Fase 3)"
```

---

### Task 2: Helpers de fatura (`financeiroFaturasCalc.js`) — TDD

**Files:**
- Create: `src/lib/financeiroFaturasCalc.js`
- Test: `src/lib/financeiroFaturasCalc.test.mjs`
- Modify: `package.json` (estender o script `test`)

**Interfaces:**
- Consumes: `primeiroDiaMes`, `addMeses` de `./financeiroCalc.js`.
- Produces:
  - `apoliceBilladaNoMes(row, mesRef) -> boolean`
  - `montarFaturasMes({ rows, mesRef, pctMap, statusMap }) -> Array<{ imobiliaria, qtd, valorFatura, pct, valorAPagar, status, dataPagamento }>` (desc por valorFatura)

- [ ] **Step 1: Escrever os testes (falham)**

Create `src/lib/financeiroFaturasCalc.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { apoliceBilladaNoMes, montarFaturasMes } from './financeiroFaturasCalc.js'

test('apoliceBilladaNoMes: 1ª parcela no mês seguinte, durante parcelamento meses', () => {
  const row = { data_emissao: '2026-01-15', parcelamento: 3 } // parcelas: Fev, Mar, Abr/2026
  assert.equal(apoliceBilladaNoMes(row, '2026-01-01'), false) // mês da emissão: não
  assert.equal(apoliceBilladaNoMes(row, '2026-02-01'), true)  // 1ª parcela
  assert.equal(apoliceBilladaNoMes(row, '2026-04-01'), true)  // última
  assert.equal(apoliceBilladaNoMes(row, '2026-05-01'), false) // depois do fim
})

test('apoliceBilladaNoMes: parcelamento ausente conta como 1', () => {
  const row = { data_emissao: '2026-06-10' }
  assert.equal(apoliceBilladaNoMes(row, '2026-07-01'), true)
  assert.equal(apoliceBilladaNoMes(row, '2026-08-01'), false)
})

test('montarFaturasMes agrupa por imobiliária, soma parcelas e aplica %', () => {
  const rows = [
    { imobiliaria: 'Alpha', valor_parcela: 200, parcelamento: 12, data_emissao: '2026-01-10' },
    { imobiliaria: 'Alpha', valor_parcela: 300, parcelamento: 12, data_emissao: '2026-01-20' },
    { imobiliaria: 'Beta',  valor_parcela: 100, parcelamento: 12, data_emissao: '2026-01-05' },
    { imobiliaria: 'Beta',  valor_parcela: 999, parcelamento: 1,  data_emissao: '2025-01-01' }, // fora do ciclo
  ]
  const out = montarFaturasMes({
    rows,
    mesRef: '2026-03-01',
    pctMap: { Alpha: 10, Beta: 20 },
    statusMap: { Alpha: { status: 'pago', data_pagamento: '2026-03-02' } },
  })
  assert.equal(out.length, 2)
  assert.equal(out[0].imobiliaria, 'Alpha')
  assert.equal(out[0].valorFatura, 500)
  assert.equal(out[0].valorAPagar, 50)
  assert.equal(out[0].status, 'pago')
  assert.equal(out[1].imobiliaria, 'Beta')
  assert.equal(out[1].valorFatura, 100)
  assert.equal(out[1].valorAPagar, 20)
  assert.equal(out[1].status, 'pendente')
})

test('montarFaturasMes: sem % → valorAPagar 0 e pct null', () => {
  const rows = [{ imobiliaria: 'Alpha', valor_parcela: 200, parcelamento: 12, data_emissao: '2026-01-10' }]
  const out = montarFaturasMes({ rows, mesRef: '2026-03-01', pctMap: {}, statusMap: {} })
  assert.equal(out[0].pct, null)
  assert.equal(out[0].valorAPagar, 0)
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test src/lib/financeiroFaturasCalc.test.mjs`
Expected: FAIL (módulo não encontrado).

- [ ] **Step 3: Implementar**

Create `src/lib/financeiroFaturasCalc.js`:

```js
// Helpers puros das faturas (Fase 3). Sem imports de Supabase/Vite → `node --test`.
import { primeiroDiaMes, addMeses } from './financeiroCalc.js'

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// A apólice tem parcela devida no mês `mesRef` ('YYYY-MM-01')?
// 1ª parcela no mês seguinte à emissão; durante `parcelamento` meses.
export function apoliceBilladaNoMes(row, mesRef) {
  const emissao = primeiroDiaMes(row?.data_emissao)
  const alvo = primeiroDiaMes(mesRef)
  if (!emissao || !alvo) return false
  const parcelas = Math.max(Number(row?.parcelamento) || 1, 1)
  const inicio = addMeses(emissao, 1)
  const fim = addMeses(emissao, parcelas)
  return alvo >= inicio && alvo <= fim
}

// Monta as faturas do mês: 1 por imobiliária com parcela devida no mês.
// rows: ledger [{ imobiliaria, valor_parcela, parcelamento, data_emissao }]
// pctMap: { [imobiliaria]: pct }; statusMap: { [imobiliaria]: { status, data_pagamento } }
export function montarFaturasMes({ rows, mesRef, pctMap = {}, statusMap = {} }) {
  const map = new Map()
  for (const r of rows || []) {
    if (!apoliceBilladaNoMes(r, mesRef)) continue
    const key = r.imobiliaria || 'Sem imobiliária'
    const cur = map.get(key) || { imobiliaria: key, qtd: 0, valorFatura: 0 }
    cur.qtd += 1
    cur.valorFatura += num(r.valor_parcela)
    map.set(key, cur)
  }
  const lista = [...map.values()].map(item => {
    const rawPct = pctMap[item.imobiliaria]
    const pct = rawPct != null ? Number(rawPct) : null
    const st = statusMap[item.imobiliaria]
    return {
      ...item,
      pct,
      valorAPagar: pct != null ? (pct / 100) * item.valorFatura : 0,
      status: st?.status || 'pendente',
      dataPagamento: st?.data_pagamento || null,
    }
  })
  return lista.sort((a, b) => b.valorFatura - a.valorFatura || a.imobiliaria.localeCompare(b.imobiliaria))
}
```

- [ ] **Step 4: Estender o script de teste**

Modify `package.json` — substituir a linha do script `test`:

```json
    "test": "node --test src/lib/financeiroCalc.test.mjs src/lib/financeiroProducaoCalc.test.mjs"
```

por:

```json
    "test": "node --test src/lib/financeiroCalc.test.mjs src/lib/financeiroProducaoCalc.test.mjs src/lib/financeiroFaturasCalc.test.mjs"
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: PASS, `# fail 0` (todos os arquivos).

- [ ] **Step 6: Commit**

```bash
git add src/lib/financeiroFaturasCalc.js src/lib/financeiroFaturasCalc.test.mjs package.json
git commit -m "feat(financeiro): helpers puros das faturas (ciclo de parcelas) + testes"
```

---

### Task 3: Camada de dados das faturas (`financeiro.js`)

**Files:**
- Modify: `src/lib/financeiro.js` (adicionar funções; manter as existentes)

**Interfaces:**
- Produces:
  - `fetchFaturasLedger({ imobiliaria } = {}) -> Promise<Array<{ imobiliaria, valor_parcela, parcelamento, data_emissao, numero_apolice, nome_interessado, seguradora, apolice_id }>>` (paginado)
  - `fetchFaturasStatus({ mes }) -> Promise<Record<string, { status, data_pagamento, pago_por, observacao }>>`
  - `marcarFaturaPaga({ imobiliaria, mes, userId, observacao }) -> Promise<Error|null>`
  - `reabrirFatura({ imobiliaria, mes }) -> Promise<Error|null>`

- [ ] **Step 1: Adicionar as funções**

Adicionar ao final de `src/lib/financeiro.js`:

```js
// ── Faturas (Fase 3) ──────────────────────────────────────────────────────────

// Ledger paginado para o cálculo das faturas (sempre ao vivo).
export async function fetchFaturasLedger({ imobiliaria } = {}) {
  const pageSize = 1000
  let all = []
  let from = 0
  while (true) {
    let q = supabase
      .from('apolices_comissoes')
      .select('imobiliaria, valor_parcela, parcelamento, data_emissao, numero_apolice, nome_interessado, seguradora, apolice_id, status_emissao, status_apolice')
      .in('status_emissao', STATUS_EMISSAO_PROD)
      .or(FILTRO_STATUS_APOLICE_PROD)
      .range(from, from + pageSize - 1)
    if (imobiliaria) q = q.eq('imobiliaria', imobiliaria)
    const { data, error } = await q
    if (error) throw error
    all = all.concat(data || [])
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return all
}

// Status de pagamento das faturas de um mês (1º dia do mês).
export async function fetchFaturasStatus({ mes }) {
  const { data, error } = await supabase
    .from('faturas_imobiliaria')
    .select('imobiliaria, status, data_pagamento, pago_por, observacao')
    .eq('mes_referencia', mes)
  if (error) throw error
  const map = {}
  for (const r of data || []) map[r.imobiliaria] = r
  return map
}

export async function marcarFaturaPaga({ imobiliaria, mes, userId, observacao }) {
  const { error } = await supabase.from('faturas_imobiliaria').upsert(
    {
      imobiliaria,
      mes_referencia: mes,
      status: 'pago',
      data_pagamento: new Date().toISOString().slice(0, 10),
      pago_por: userId || null,
      observacao: observacao || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'imobiliaria,mes_referencia' },
  )
  return error
}

export async function reabrirFatura({ imobiliaria, mes }) {
  const { error } = await supabase.from('faturas_imobiliaria').upsert(
    {
      imobiliaria,
      mes_referencia: mes,
      status: 'pendente',
      data_pagamento: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'imobiliaria,mes_referencia' },
  )
  return error
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 3: Commit**

```bash
git add src/lib/financeiro.js
git commit -m "feat(financeiro): camada de dados das faturas (ledger, status, pagar/reabrir)"
```

---

### Task 4: Página de Faturas (lista por mês)

**Files:**
- Create: `src/pages/Financeiro/FinanceiroFaturas.jsx`
- Modify: `src/pages/Financeiro/Financeiro.jsx` (habilitar aba Faturas)
- Modify: `src/App.jsx` (lazy import + rota `faturas`)

**Interfaces:**
- Consumes: `fetchFaturasLedger`, `fetchPctImobiliarias`, `fetchFaturasStatus`, `marcarFaturaPaga`, `reabrirFatura` (financeiro.js); `montarFaturasMes` (financeiroFaturasCalc.js); `fetchImobiliariasCatalogMap`, `resolveImobiliaria` (imobiliariasLogos.js); `primeiroDiaMes` (financeiroCalc); `formatMoneyBR` (apolices); `ImobiliariaIdentity`, `useAuth`, `useNavigate`, `useSearchParams`.
- Produces: rota `/financeiro/faturas`.

- [ ] **Step 1: Criar a página de lista**

Create `src/pages/Financeiro/FinanceiroFaturas.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import { useAuth } from '../../contexts/AuthContext'
import {
  fetchFaturasLedger, fetchPctImobiliarias, fetchFaturasStatus, marcarFaturaPaga, reabrirFatura,
} from '../../lib/financeiro'
import { montarFaturasMes } from '../../lib/financeiroFaturasCalc'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { primeiroDiaMes } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { Coins, Percent, Receipt, Check, RotateCcw } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function pad2(v) { return String(v).padStart(2, '0') }

export default function FinanceiroFaturas() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const agora = new Date()
  const mesParam = searchParams.get('mes') // 'YYYY-MM-01'
  const inicialAno = mesParam ? Number(mesParam.slice(0, 4)) : agora.getFullYear()
  const inicialMes = mesParam ? Number(mesParam.slice(5, 7)) : agora.getMonth() + 1
  const [ano, setAno] = useState(inicialAno)
  const [mes, setMes] = useState(inicialMes)
  const [ledger, setLedger] = useState([])
  const [pctMap, setPctMap] = useState({})
  const [statusMap, setStatusMap] = useState({})
  const [catalogo, setCatalogo] = useState(null)
  const [loading, setLoading] = useState(true)

  const mesRef = `${ano}-${pad2(mes)}-01`

  useEffect(() => {
    setSearchParams({ mes: mesRef }, { replace: true })
  }, [mesRef, setSearchParams])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      fetchFaturasLedger(),
      fetchPctImobiliarias({ mes: mesRef }),
      fetchFaturasStatus({ mes: mesRef }),
      fetchImobiliariasCatalogMap(),
    ]).then(([led, pct, st, cat]) => {
      if (!mounted) return
      setLedger(led)
      setPctMap(pct)
      setStatusMap(st)
      setCatalogo(cat)
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [mesRef])

  const faturas = useMemo(
    () => montarFaturasMes({ rows: ledger, mesRef: primeiroDiaMes(mesRef), pctMap, statusMap }),
    [ledger, mesRef, pctMap, statusMap],
  )
  const totalFatura = useMemo(() => faturas.reduce((s, f) => s + f.valorFatura, 0), [faturas])
  const totalAPagar = useMemo(() => faturas.reduce((s, f) => s + f.valorAPagar, 0), [faturas])
  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`

  async function togglePago(f) {
    if (f.status === 'pago') {
      const err = await reabrirFatura({ imobiliaria: f.imobiliaria, mes: mesRef })
      if (!err) setStatusMap(prev => ({ ...prev, [f.imobiliaria]: { status: 'pendente', data_pagamento: null } }))
    } else {
      const err = await marcarFaturaPaga({ imobiliaria: f.imobiliaria, mes: mesRef, userId: user?.id })
      if (!err) setStatusMap(prev => ({ ...prev, [f.imobiliaria]: { status: 'pago', data_pagamento: new Date().toISOString().slice(0, 10) } }))
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro · Faturas"
        title="Faturas das imobiliárias"
        description="Por mês, a fatura é a soma das parcelas devidas; o valor a pagar é o % da Produção sobre a fatura."
        stats={(
          <>
            <MetricCard label="Total faturas" value={formatMoneyBR(totalFatura)} hint={mesLabel} tone="accent" icon={<Receipt className="h-4 w-4" />} />
            <MetricCard label="Total a pagar" value={formatMoneyBR(totalAPagar)} hint={mesLabel} tone="secondary" icon={<Percent className="h-4 w-4" />} />
            <MetricCard label="Imobiliárias" value={faturas.length} hint={mesLabel} tone="success" icon={<Coins className="h-4 w-4" />} />
          </>
        )}
      />

      <DataCard
        title="Mês"
        subtitle="Selecione o mês de competência"
        actions={(
          <Select
            value={String(ano)}
            onChange={v => setAno(Number(v))}
            options={[agora.getFullYear() + 1, agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2].map(a => ({ value: String(a), label: String(a) }))}
            className="w-28"
          />
        )}
      >
        <div className="flex flex-wrap items-center gap-1">
          {MESES_ABBR.map((label, i) => (
            <button
              key={label}
              onClick={() => setMes(i + 1)}
              className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${mes === i + 1 ? 'bg-brand-secondary text-white' : 'text-dark-muted hover:bg-dark-surface2 hover:text-dark-text'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </DataCard>

      <DataCard title={`Faturas — ${mesLabel}`} subtitle="Clique numa imobiliária para ver as apólices">
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : faturas.length === 0 ? (
          <EmptyState title="Sem faturas no mês" description="Nenhuma parcela devida no mês selecionado." icon={<Receipt className="h-6 w-6" />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-table text-sm">
              <thead className="table-thead">
                <tr>
                  {['Imobiliária', 'Apólices', 'Fatura', '%', 'A pagar', 'Status', ''].map(h => (
                    <th key={h} className="th whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {faturas.map(f => {
                  const meta = resolveImobiliaria(catalogo, f.imobiliaria)
                  return (
                    <tr key={f.imobiliaria} className="hover:bg-dark-surface2/40">
                      <td className="td">
                        <button onClick={() => navigate(`/financeiro/faturas/${encodeURIComponent(f.imobiliaria)}/${mesRef}`)} className="text-left">
                          <ImobiliariaIdentity nome={f.imobiliaria} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="sm" />
                        </button>
                      </td>
                      <td className="td font-mono text-xs">{f.qtd}</td>
                      <td className="td font-mono text-xs">{formatMoneyBR(f.valorFatura)}</td>
                      <td className="td font-mono text-xs">{f.pct != null ? `${f.pct}%` : '—'}</td>
                      <td className="td font-mono text-xs font-semibold text-emerald-400">{formatMoneyBR(f.valorAPagar)}</td>
                      <td className="td">
                        <span className={`rounded-lg px-2 py-0.5 text-[11px] font-medium ${f.status === 'pago' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                          {f.status === 'pago' ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                      <td className="td">
                        <button
                          onClick={() => togglePago(f)}
                          className="inline-flex items-center gap-1 rounded-lg border border-dark-border px-2 py-1 text-[11px] font-medium text-dark-muted hover:text-dark-text"
                        >
                          {f.status === 'pago' ? (<><RotateCcw className="h-3 w-3" /> Reabrir</>) : (<><Check className="h-3 w-3" /> Marcar pago</>)}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  )
}
```

- [ ] **Step 2: Habilitar a aba Faturas no hub**

Modify `src/pages/Financeiro/Financeiro.jsx` — substituir a constante `TABS`:

```jsx
const TABS = [
  { to: '/financeiro', label: 'Visão Geral', end: true },
  { to: '/financeiro/producao', label: 'Produção' },
  { label: 'Faturas', disabled: true },
]
```

por:

```jsx
const TABS = [
  { to: '/financeiro', label: 'Visão Geral', end: true },
  { to: '/financeiro/producao', label: 'Produção' },
  { to: '/financeiro/faturas', label: 'Faturas' },
]
```

- [ ] **Step 3: Registrar a rota no App.jsx**

Modify `src/App.jsx` — adicionar o lazy import (junto dos outros do financeiro):

```jsx
const FinanceiroFaturas   = lazy(() => import('./pages/Financeiro/FinanceiroFaturas'))
```

E adicionar a rota filha (após `producao/:imobiliaria`):

```jsx
            <Route path="faturas" element={<FinanceiroFaturas />} />
```

- [ ] **Step 4: Build + check de contextos**

Run: `npm run build`
Expected: sucesso.

Run: `npm run check:page-contexts`
Expected: nenhuma falta nova em `Financeiro/`; faltas pré-existentes em `auto/` e `comercial/GestaoComercial` permanecem.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Financeiro/FinanceiroFaturas.jsx src/pages/Financeiro/Financeiro.jsx src/App.jsx
git commit -m "feat(financeiro): aba Faturas (lista por mês, marcar pago)"
```

---

### Task 5: Detalhe da fatura + navegação para a apólice

**Files:**
- Create: `src/pages/Financeiro/FinanceiroFaturaDetalhe.jsx`
- Modify: `src/App.jsx` (lazy import + rota `faturas/:imobiliaria/:mes`)

**Interfaces:**
- Consumes: `fetchFaturasLedger` (Task 3); `apoliceBilladaNoMes`, `montarFaturasMes` (Task 2); `fetchImobiliariasCatalogMap`, `resolveImobiliaria` (imobiliariasLogos.js); `formatMoneyBR` (apolices); `ImobiliariaIdentity`, `SeguradoraBadge`, `useParams`, `useNavigate`.
- Produces: rota `/financeiro/faturas/:imobiliaria/:mes`.

- [ ] **Step 1: Criar a página de detalhe**

Create `src/pages/Financeiro/FinanceiroFaturaDetalhe.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import { fetchFaturasLedger } from '../../lib/financeiro'
import { apoliceBilladaNoMes } from '../../lib/financeiroFaturasCalc'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { formatMesAno, primeiroDiaMes } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { ArrowLeft, Receipt, FileText, Coins } from 'lucide-react'

const SCROLL_KEY = 'financeiro-fatura-detalhe-scroll'

export default function FinanceiroFaturaDetalhe() {
  const navigate = useNavigate()
  const { imobiliaria: imobParam, mes } = useParams()
  const imobiliaria = decodeURIComponent(imobParam || '')
  const mesRef = primeiroDiaMes(mes)
  const [rows, setRows] = useState([])
  const [catalogo, setCatalogo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      fetchFaturasLedger({ imobiliaria }),
      fetchImobiliariasCatalogMap(),
    ]).then(([led, cat]) => {
      if (!mounted) return
      setRows(led)
      setCatalogo(cat)
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [imobiliaria])

  // Restaura o scroll ao voltar da apólice
  useEffect(() => {
    if (loading) return
    const saved = sessionStorage.getItem(SCROLL_KEY)
    if (saved) {
      window.scrollTo(0, Number(saved) || 0)
      sessionStorage.removeItem(SCROLL_KEY)
    }
  }, [loading])

  const apolices = useMemo(
    () => rows.filter(r => apoliceBilladaNoMes(r, mesRef)),
    [rows, mesRef],
  )
  const valorFatura = useMemo(() => apolices.reduce((s, a) => s + (Number(a.valor_parcela) || 0), 0), [apolices])
  const meta = resolveImobiliaria(catalogo, imobiliaria)

  function abrirApolice(id) {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
    navigate(`/apolices/${id}`)
  }

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(`/financeiro/faturas?mes=${mesRef}`)} className="inline-flex items-center gap-1.5 text-xs font-medium text-dark-muted hover:text-dark-text">
        <ArrowLeft className="h-4 w-4" /> Voltar para Faturas
      </button>

      <PageHeader
        eyebrow={`Financeiro · Fatura · ${formatMesAno(mesRef)}`}
        title={meta?.nomeCanonico || imobiliaria}
        description="Apólices com parcela devida no mês."
        actions={(<ImobiliariaIdentity nome={imobiliaria} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="lg" />)}
        stats={(
          <>
            <MetricCard label="Apólices" value={apolices.length} hint={formatMesAno(mesRef)} tone="success" icon={<FileText className="h-4 w-4" />} />
            <MetricCard label="Valor da fatura" value={formatMoneyBR(valorFatura)} hint="soma das parcelas" tone="accent" icon={<Coins className="h-4 w-4" />} />
          </>
        )}
      />

      <DataCard title="Apólices da fatura" subtitle="Clique para abrir a apólice">
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : apolices.length === 0 ? (
          <EmptyState title="Sem apólices no mês" description="Nenhuma parcela devida no mês para esta imobiliária." icon={<Receipt className="h-6 w-6" />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-table text-sm">
              <thead className="table-thead">
                <tr>
                  {['Apólice', 'Cliente', 'Seguradora', 'Parcela', 'Emissão'].map(h => (
                    <th key={h} className="th whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {apolices.map(a => (
                  <tr key={a.apolice_id} className="cursor-pointer hover:bg-dark-surface2/40" onClick={() => abrirApolice(a.apolice_id)}>
                    <td className="td font-mono text-xs text-dark-muted">{a.numero_apolice || '—'}</td>
                    <td className="td max-w-[200px] truncate">{a.nome_interessado || '—'}</td>
                    <td className="td"><SeguradoraBadge nome={a.seguradora} size="sm" /></td>
                    <td className="td font-mono text-xs">{formatMoneyBR(a.valor_parcela)}</td>
                    <td className="td text-xs text-dark-muted whitespace-nowrap">{String(a.data_emissao).slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  )
}
```

- [ ] **Step 2: Registrar a rota no App.jsx**

Modify `src/App.jsx` — adicionar o lazy import:

```jsx
const FinanceiroFaturaDetalhe = lazy(() => import('./pages/Financeiro/FinanceiroFaturaDetalhe'))
```

E adicionar a rota filha (após `faturas`):

```jsx
            <Route path="faturas" element={<FinanceiroFaturas />} />
            <Route path="faturas/:imobiliaria/:mes" element={<FinanceiroFaturaDetalhe />} />
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 4: Smoke test manual (humano)**

`/financeiro/faturas` → escolher mês → lista de faturas; marcar pago/reabrir; clicar numa imobiliária → detalhe com apólices; clicar numa apólice → abre a apólice; voltar (browser) → detalhe no mesmo scroll; "Voltar para Faturas" → lista no mesmo mês.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Financeiro/FinanceiroFaturaDetalhe.jsx src/App.jsx
git commit -m "feat(financeiro): detalhe da fatura + navegação para a apólice (preserva estado)"
```

---

## Self-Review

**Spec coverage (Fase 3):**
- Tabela `faturas_imobiliaria` (pagamento) + RLS → Task 1. ✓
- Fatura = Σ parcelas devidas; ciclo de parcelas puro → Tasks 2 (apoliceBilladaNoMes/montarFaturasMes). ✓
- Valor a pagar = % × fatura (% da Produção) → Tasks 2/4. ✓
- Lista por mês com logos, status, marcar pago/reabrir → Tasks 3/4. ✓
- Detalhe com apólices (nº, cliente, seguradora, parcela, emissão) → Task 5. ✓
- Navegação fatura ↔ apólice preservando estado (mês via query, scroll via sessionStorage) → Task 5. ✓
- Sempre ao vivo (só pagamento persistido) → Tasks 1/3. ✓
- Seletor de mês + lista (sem calendário) → Task 4. ✓

**Placeholder scan:** sem TBD/TODO; código completo em cada passo. ✓

**Type consistency:** `fetchFaturasLedger`/`fetchFaturasStatus`/`marcarFaturaPaga`/`reabrirFatura` (Task 3) e `apoliceBilladaNoMes`/`montarFaturasMes` (Task 2) consumidos em Tasks 4/5. Campos do ledger (`valor_parcela`, `parcelamento`, `data_emissao`, `numero_apolice`, `nome_interessado`, `seguradora`, `apolice_id`) consistentes entre data layer, calc e páginas. `mesRef` no formato `YYYY-MM-01` em todas as chamadas. ✓

**Nota:** `STATUS_EMISSAO_PROD`/`FILTRO_STATUS_APOLICE_PROD` já existem em `financeiro.js` (Fase 2) e são reusados na Task 3. `check:page-contexts` segue vermelho por faltas pré-existentes fora do escopo.
