# Financeiro — Fase 2 (Produção) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Aba **Produção** do módulo financeiro: produção por imobiliária (com logo, prêmio, comissão gerada, recebida estimada, % de repasse editável salvo por mês e valor a repassar), página de detalhe por imobiliária com quebra por seguradora e gráfico de evolução.

**Architecture:** Sem novas regras de negócio no banco além de uma tabela de input (`producao_comissao_imobiliaria`, % por imobiliária/mês). As agregações vêm do ledger `apolices_comissoes` (já admin-only, já com `comissao_mensal`, `premio_total`, `status_apolice`). Lógica de agregação pura e testável em `financeiroProducaoCalc.js`. Páginas em sub-rotas aninhadas sob `/financeiro`.

**Tech Stack:** React 18 + Vite, react-router-dom v6, Supabase (Postgres + RLS), recharts, Tailwind. Testes com `node --test`.

## Global Constraints

- RLS sempre ativa; `producao_comissao_imobiliaria` restrita a `public.is_finance_admin()`.
- `service_role` somente no n8n; credenciais só em env.
- Queries com campos explícitos (nunca `select('*')`).
- Migração idempotente (`IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP ... IF EXISTS`).
- Base de tempo **por emissão**: filtrar `status_emissao IN ('emitida','enviada')` E `status_apolice IN ('ativa','renovada')` (null→ativa), `data_emissao` no período.
- **Comissão recebida estimada (produção)** = Σ `comissao_mensal` da imobiliária no período.
- **Valor a repassar** = `pct_comissao` (salvo do mês) × Σ `valor_comissao` (comissão gerada da imobiliária) / 100.
- **% de participação por seguradora** = comissão da seguradora ÷ comissão total da imobiliária × 100 (apenas exibição; ≠ % de repasse).
- Logos: seguradoras via componente existente `SeguradoraBadge` (auto-resolve por nome); imobiliárias via `ImobiliariaIdentity` + resolver novo `imobiliariasLogos.js`.
- Reusar `PageHeader`, `MetricCard`, `DataCard`, `EmptyState`, `Select` de `src/components/ui`; `formatMoneyBR` de `src/lib/apolices`; helpers `primeiroDiaMes`/`addMeses`/`formatMesAno` de `src/lib/financeiroCalc`.
- Design system: brand-secondary `#2B5BA8` para ativo/gráfico; tokens `dark-*`.

---

### Task 1: Migração — tabela `producao_comissao_imobiliaria`

**Files:**
- Create: `supabase/43_producao_comissao_imobiliaria.sql`

**Interfaces:**
- Produces (no banco): tabela `public.producao_comissao_imobiliaria(id, imobiliaria, mes_referencia, pct_comissao, atualizado_por, created_at, updated_at)` com `unique(imobiliaria, mes_referencia)` e RLS admin-only.
- Consumes: `public.is_finance_admin()` (já existe).

> **Nota:** exige Supabase SQL Editor (sem acesso a banco pelo agente). Deliverable do agente = arquivo `.sql` correto + commit. Aplicação/verificação são manuais (humano).

- [ ] **Step 1: Criar o arquivo de migração**

Create `supabase/43_producao_comissao_imobiliaria.sql`:

```sql
-- ============================================================
-- CONVES SYSTEM — 43_producao_comissao_imobiliaria.sql
-- Fase 2 do redesign financeiro: % de repasse por imobiliária/mês.
-- Definido manualmente pelo usuário, aplicado sobre a comissão
-- gerada da própria imobiliária no mês. Mesmo % usado na Fatura (Fase 3).
-- Rodar no Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.producao_comissao_imobiliaria (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobiliaria     TEXT NOT NULL,
  mes_referencia  DATE NOT NULL,            -- 1º dia do mês
  pct_comissao    NUMERIC,
  atualizado_por  UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (imobiliaria, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_prod_com_imob_mes
  ON public.producao_comissao_imobiliaria(mes_referencia);

ALTER TABLE public.producao_comissao_imobiliaria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prod_com_imob_select_admin" ON public.producao_comissao_imobiliaria;
CREATE POLICY "prod_com_imob_select_admin"
ON public.producao_comissao_imobiliaria FOR SELECT
TO authenticated
USING (public.is_finance_admin());

DROP POLICY IF EXISTS "prod_com_imob_write_admin" ON public.producao_comissao_imobiliaria;
CREATE POLICY "prod_com_imob_write_admin"
ON public.producao_comissao_imobiliaria FOR ALL
TO authenticated
USING (public.is_finance_admin())
WITH CHECK (public.is_finance_admin());

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/43_producao_comissao_imobiliaria.sql
git commit -m "feat(financeiro): tabela producao_comissao_imobiliaria (% repasse por mês, Fase 2)"
```

---

### Task 2: Helpers puros de produção (`financeiroProducaoCalc.js`) — TDD

**Files:**
- Create: `src/lib/financeiroProducaoCalc.js`
- Test: `src/lib/financeiroProducaoCalc.test.mjs`
- Modify: `package.json` (estender o script `test` para os dois arquivos de teste)

**Interfaces:**
- Consumes: `primeiroDiaMes`, `addMeses`, `formatMesAno` de `./financeiroCalc.js`.
- Produces:
  - `agruparPorImobiliaria(rows) -> Array<{ imobiliaria, qtd, premioTotal, comissaoGerada, comissaoRecebidaEstimada }>` (desc por comissaoGerada)
  - `agruparPorSeguradora(rows) -> Array<{ seguradora, qtd, premio, comissao, pctParticipacao }>` (desc por comissao)
  - `agruparEvolucaoPorMes(rows, { desde, meses }) -> Array<{ mes, label, premio, comissao }>` (sempre `meses` itens, preenche zeros)

- [ ] **Step 1: Escrever os testes que falham**

Create `src/lib/financeiroProducaoCalc.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  agruparPorImobiliaria, agruparPorSeguradora, agruparEvolucaoPorMes,
} from './financeiroProducaoCalc.js'

test('agruparPorImobiliaria soma e ordena por comissão gerada desc', () => {
  const rows = [
    { imobiliaria: 'Alpha', premio_total: 1000, valor_comissao: 200, comissao_mensal: 20 },
    { imobiliaria: 'Beta',  premio_total: 500,  valor_comissao: 300, comissao_mensal: 30 },
    { imobiliaria: 'Alpha', premio_total: '500', valor_comissao: '100', comissao_mensal: '10' },
  ]
  const out = agruparPorImobiliaria(rows)
  assert.equal(out.length, 2)
  assert.deepEqual(out[0], { imobiliaria: 'Beta', qtd: 1, premioTotal: 500, comissaoGerada: 300, comissaoRecebidaEstimada: 30 })
  assert.deepEqual(out[1], { imobiliaria: 'Alpha', qtd: 2, premioTotal: 1500, comissaoGerada: 300, comissaoRecebidaEstimada: 30 })
})

test('agruparPorSeguradora calcula % de participação sobre a comissão total', () => {
  const rows = [
    { seguradora: 'Porto', premio_total: 100, valor_comissao: 75 },
    { seguradora: 'Tokio', premio_total: 100, valor_comissao: 25 },
  ]
  const out = agruparPorSeguradora(rows)
  assert.equal(out.length, 2)
  assert.equal(out[0].seguradora, 'Porto')
  assert.equal(out[0].comissao, 75)
  assert.equal(out[0].pctParticipacao, 75)
  assert.equal(out[1].pctParticipacao, 25)
})

test('agruparPorSeguradora com comissão total zero não divide por zero', () => {
  const rows = [{ seguradora: 'Porto', premio_total: 100, valor_comissao: 0 }]
  const out = agruparPorSeguradora(rows)
  assert.equal(out[0].pctParticipacao, 0)
})

test('agruparEvolucaoPorMes preenche todos os meses da janela com zeros', () => {
  const rows = [
    { data_emissao: '2026-05-10', premio_total: 1000, valor_comissao: 200 },
    { data_emissao: '2026-05-20', premio_total: 500,  valor_comissao: 100 },
  ]
  const out = agruparEvolucaoPorMes(rows, { desde: '2026-04-01', meses: 3 })
  assert.equal(out.length, 3)
  assert.deepEqual(out.map(o => o.mes), ['2026-04-01', '2026-05-01', '2026-06-01'])
  assert.deepEqual(out.map(o => o.comissao), [0, 300, 0])
  assert.deepEqual(out.map(o => o.premio), [0, 1500, 0])
  assert.equal(out[1].label, 'Mai/2026')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test src/lib/financeiroProducaoCalc.test.mjs`
Expected: FAIL (módulo não encontrado).

- [ ] **Step 3: Implementar os helpers**

Create `src/lib/financeiroProducaoCalc.js`:

```js
// Helpers puros de agregação da Produção (Fase 2).
// Sem imports de Supabase/Vite → testáveis com `node --test`.
import { primeiroDiaMes, addMeses, formatMesAno } from './financeiroCalc.js'

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// rows do ledger: [{ imobiliaria, premio_total, valor_comissao, comissao_mensal }]
export function agruparPorImobiliaria(rows) {
  const map = new Map()
  for (const r of rows || []) {
    const key = r.imobiliaria || 'Sem imobiliária'
    const cur = map.get(key) || {
      imobiliaria: key, qtd: 0, premioTotal: 0, comissaoGerada: 0, comissaoRecebidaEstimada: 0,
    }
    cur.qtd += 1
    cur.premioTotal += num(r.premio_total)
    cur.comissaoGerada += num(r.valor_comissao)
    cur.comissaoRecebidaEstimada += num(r.comissao_mensal)
    map.set(key, cur)
  }
  return [...map.values()].sort((a, b) => b.comissaoGerada - a.comissaoGerada)
}

// rows do ledger de UMA imobiliária: [{ seguradora, premio_total, valor_comissao }]
export function agruparPorSeguradora(rows) {
  const map = new Map()
  for (const r of rows || []) {
    const key = r.seguradora || 'Sem seguradora'
    const cur = map.get(key) || { seguradora: key, qtd: 0, premio: 0, comissao: 0 }
    cur.qtd += 1
    cur.premio += num(r.premio_total)
    cur.comissao += num(r.valor_comissao)
    map.set(key, cur)
  }
  const lista = [...map.values()]
  const totalComissao = lista.reduce((s, x) => s + x.comissao, 0)
  for (const item of lista) {
    item.pctParticipacao = totalComissao > 0
      ? Math.round((item.comissao / totalComissao) * 1000) / 10
      : 0
  }
  return lista.sort((a, b) => b.comissao - a.comissao)
}

// rows do ledger: [{ data_emissao, premio_total, valor_comissao }]
// Retorna sempre `meses` itens a partir de `desde` (1º dia do mês), preenchendo zeros.
export function agruparEvolucaoPorMes(rows, { desde, meses = 6 }) {
  const base = primeiroDiaMes(desde)
  const map = new Map()
  for (const r of rows || []) {
    const mes = primeiroDiaMes(r.data_emissao)
    if (!mes) continue
    const cur = map.get(mes) || { premio: 0, comissao: 0 }
    cur.premio += num(r.premio_total)
    cur.comissao += num(r.valor_comissao)
    map.set(mes, cur)
  }
  const out = []
  for (let i = 0; i < meses; i++) {
    const mes = addMeses(base, i)
    const found = map.get(mes)
    out.push({ mes, label: formatMesAno(mes), premio: found ? found.premio : 0, comissao: found ? found.comissao : 0 })
  }
  return out
}
```

- [ ] **Step 4: Estender o script de teste**

Modify `package.json` — substituir a linha do script `test`:

```json
    "test": "node --test src/lib/financeiroCalc.test.mjs"
```

por:

```json
    "test": "node --test src/lib/financeiroCalc.test.mjs src/lib/financeiroProducaoCalc.test.mjs"
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: PASS (todos os testes dos dois arquivos, `# fail 0`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/financeiroProducaoCalc.js src/lib/financeiroProducaoCalc.test.mjs package.json
git commit -m "feat(financeiro): helpers puros de agregação da produção + testes"
```

---

### Task 3: Resolver de logo/% default de imobiliária (`imobiliariasLogos.js`)

**Files:**
- Create: `src/lib/imobiliariasLogos.js`

**Interfaces:**
- Consumes: `supabase` (`./supabase`), `normalizeDisplayText` (`./text`), tabela `imobiliarias` + `imobiliaria_aliases`.
- Produces:
  - `fetchImobiliariasCatalogMap({ force }) -> Promise<Map<string, { nomeCanonico, imagemPath, imagemUrl, pctComissao }>>` (chaveado por nome normalizado: canônico + aliases)
  - `resolveImobiliaria(map, nome) -> meta | null`
  - `invalidarCacheImobiliarias() -> void`

- [ ] **Step 1: Criar o resolver**

Create `src/lib/imobiliariasLogos.js`:

```js
import { supabase } from './supabase'
import { normalizeDisplayText } from './text'

function norm(value) {
  return (normalizeDisplayText(value) || String(value || '')).toLowerCase().trim()
}

let cache = null

export async function fetchImobiliariasCatalogMap({ force = false } = {}) {
  if (cache && !force) return cache
  const { data, error } = await supabase
    .from('imobiliarias')
    .select('id, nome_canonico, pct_comissao, imagem_url, imagem_path, imobiliaria_aliases(alias)')
  if (error) throw error

  const map = new Map()
  for (const im of data || []) {
    const meta = {
      nomeCanonico: im.nome_canonico,
      imagemPath: im.imagem_path,
      imagemUrl: im.imagem_url,
      pctComissao: im.pct_comissao,
    }
    map.set(norm(im.nome_canonico), meta)
    for (const a of im.imobiliaria_aliases || []) {
      if (a?.alias) map.set(norm(a.alias), meta)
    }
  }
  cache = map
  return map
}

export function resolveImobiliaria(map, nome) {
  if (!map || !nome) return null
  return map.get(norm(nome)) || null
}

export function invalidarCacheImobiliarias() {
  cache = null
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build sem erros (imports resolvem).

- [ ] **Step 3: Commit**

```bash
git add src/lib/imobiliariasLogos.js
git commit -m "feat(financeiro): resolver de logo/% default de imobiliária por nome/alias"
```

---

### Task 4: Camada de dados da produção (`financeiro.js`)

**Files:**
- Modify: `src/lib/financeiro.js` (adicionar funções; manter as existentes)

**Interfaces:**
- Consumes: `supabase`, tabelas `apolices_comissoes` e `producao_comissao_imobiliaria`.
- Produces:
  - `fetchProducaoLedger({ inicio, fim, imobiliaria }) -> Promise<Array<{ imobiliaria, seguradora, premio_total, valor_comissao, comissao_mensal, data_emissao }>>`
  - `fetchPctImobiliarias({ mes }) -> Promise<Record<string, number>>` (imobiliaria → pct)
  - `salvarPctImobiliaria({ imobiliaria, mes, pct, userId }) -> Promise<Error|null>`

- [ ] **Step 1: Adicionar as funções**

Adicionar ao final de `src/lib/financeiro.js` (após as funções da Fase 1):

```js
// ── Produção (Fase 2) ─────────────────────────────────────────────────────────

const STATUS_EMISSAO_PROD = ['emitida', 'enviada']
const FILTRO_STATUS_APOLICE_PROD = 'status_apolice.in.(ativa,renovada),status_apolice.is.null'

// Linhas do ledger para agregação de produção (base = emissão).
export async function fetchProducaoLedger({ inicio, fim, imobiliaria } = {}) {
  let q = supabase
    .from('apolices_comissoes')
    .select('imobiliaria, seguradora, premio_total, valor_comissao, comissao_mensal, data_emissao')
    .in('status_emissao', STATUS_EMISSAO_PROD)
    .or(FILTRO_STATUS_APOLICE_PROD)
  if (inicio) q = q.gte('data_emissao', inicio)
  if (fim) q = q.lte('data_emissao', fim)
  if (imobiliaria) q = q.eq('imobiliaria', imobiliaria)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

// % de repasse salvo de cada imobiliária para um mês (1º dia do mês).
export async function fetchPctImobiliarias({ mes }) {
  const { data, error } = await supabase
    .from('producao_comissao_imobiliaria')
    .select('imobiliaria, pct_comissao')
    .eq('mes_referencia', mes)
  if (error) throw error
  const map = {}
  for (const r of data || []) map[r.imobiliaria] = r.pct_comissao
  return map
}

// Upsert do % de uma imobiliária para um mês.
export async function salvarPctImobiliaria({ imobiliaria, mes, pct, userId }) {
  const { error } = await supabase
    .from('producao_comissao_imobiliaria')
    .upsert(
      {
        imobiliaria,
        mes_referencia: mes,
        pct_comissao: pct,
        atualizado_por: userId || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'imobiliaria,mes_referencia' },
    )
  return error
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/financeiro.js
git commit -m "feat(financeiro): camada de dados da produção (ledger, % imobiliária, upsert)"
```

---

### Task 5: Componente de gráfico + página de lista da Produção

**Files:**
- Create: `src/pages/Financeiro/EvolucaoChart.jsx`
- Create: `src/pages/Financeiro/FinanceiroProducao.jsx`
- Modify: `src/pages/Financeiro/Financeiro.jsx` (habilitar aba Produção)
- Modify: `src/App.jsx` (lazy import + rota `producao`)

**Interfaces:**
- Consumes: `fetchProducaoLedger`, `fetchPctImobiliarias`, `salvarPctImobiliaria` (Task 4); `agruparPorImobiliaria`, `agruparEvolucaoPorMes` (Task 2); `fetchImobiliariasCatalogMap`, `resolveImobiliaria` (Task 3); `primeiroDiaMes`, `addMeses` (financeiroCalc); `formatMoneyBR` (apolices); `parseDecimalBR` (numberInput); `useAuth`; `ImobiliariaIdentity`.
- Produces: rota `/financeiro/producao`.

- [ ] **Step 1: Criar o componente de gráfico**

Create `src/pages/Financeiro/EvolucaoChart.jsx`:

```jsx
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatMoneyBR } from '../../lib/apolices'

const COR = '#2B5BA8'

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-dark-border bg-dark-surface2 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-dark-text">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} className="text-dark-muted">{p.name}: {formatMoneyBR(p.value)}</p>
      ))}
    </div>
  )
}

export default function EvolucaoChart({ data }) {
  if (!data?.length || data.every(d => d.comissao === 0 && d.premio === 0)) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-dark-muted">Sem dados no período</div>
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gradComissaoProd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COR} stopOpacity={0.4} />
            <stop offset="95%" stopColor={COR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={42}
          tickFormatter={v => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
        />
        <Tooltip content={<Tip />} />
        <Area
          type="monotone"
          dataKey="comissao"
          name="Comissão gerada"
          stroke={COR}
          fill="url(#gradComissaoProd)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Criar a página de lista**

Create `src/pages/Financeiro/FinanceiroProducao.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import EvolucaoChart from './EvolucaoChart'
import { useAuth } from '../../contexts/AuthContext'
import { fetchProducaoLedger, fetchPctImobiliarias, salvarPctImobiliaria } from '../../lib/financeiro'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { agruparPorImobiliaria, agruparEvolucaoPorMes } from '../../lib/financeiroProducaoCalc'
import { primeiroDiaMes, addMeses } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { parseDecimalBR } from '../../lib/numberInput'
import { Building2, Coins, TrendingUp, Percent } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const EVOLUCAO_MESES = 6

function pad2(v) { return String(v).padStart(2, '0') }
function ymd(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}` }
function rangeMes(ano, mes) {
  return [ymd(ano, mes, 1), ymd(ano, mes, new Date(ano, mes, 0).getDate())]
}

export default function FinanceiroProducao() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [rows, setRows] = useState([])
  const [evolucaoRows, setEvolucaoRows] = useState([])
  const [pctMap, setPctMap] = useState({})
  const [catalogo, setCatalogo] = useState(null)
  const [edits, setEdits] = useState({})
  const [loading, setLoading] = useState(true)

  const [inicio, fim] = useMemo(() => rangeMes(ano, mes), [ano, mes])
  const mesRef = useMemo(() => primeiroDiaMes(inicio), [inicio])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const desdeEvolucao = addMeses(mesRef, -(EVOLUCAO_MESES - 1))
    Promise.all([
      fetchProducaoLedger({ inicio, fim }),
      fetchProducaoLedger({ inicio: desdeEvolucao, fim }),
      fetchPctImobiliarias({ mes: mesRef }),
      fetchImobiliariasCatalogMap(),
    ]).then(([prod, evol, pct, cat]) => {
      if (!mounted) return
      setRows(prod)
      setEvolucaoRows(evol)
      setPctMap(pct)
      setCatalogo(cat)
      setEdits({})
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [inicio, fim, mesRef])

  const imobiliarias = useMemo(() => agruparPorImobiliaria(rows), [rows])
  const evolucao = useMemo(
    () => agruparEvolucaoPorMes(evolucaoRows, { desde: addMeses(mesRef, -(EVOLUCAO_MESES - 1)), meses: EVOLUCAO_MESES }),
    [evolucaoRows, mesRef],
  )
  const totalComissaoGerada = useMemo(() => imobiliarias.reduce((s, i) => s + i.comissaoGerada, 0), [imobiliarias])
  const totalPremio = useMemo(() => imobiliarias.reduce((s, i) => s + i.premioTotal, 0), [imobiliarias])

  function pctAtual(imob) {
    if (edits[imob] !== undefined) return edits[imob]
    if (pctMap[imob] !== undefined && pctMap[imob] !== null) return String(pctMap[imob])
    const meta = resolveImobiliaria(catalogo, imob)
    return meta?.pctComissao != null ? String(meta.pctComissao) : ''
  }

  function valorRepassar(imob, comissaoGerada) {
    const pct = parseDecimalBR(pctAtual(imob))
    return pct ? (pct / 100) * comissaoGerada : 0
  }

  async function salvarPct(imob) {
    const raw = edits[imob]
    if (raw === undefined) return
    const pct = parseDecimalBR(raw)
    const err = await salvarPctImobiliaria({ imobiliaria: imob, mes: mesRef, pct, userId: user?.id })
    if (!err) setPctMap(prev => ({ ...prev, [imob]: pct }))
  }

  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro · Produção"
        title="Produção por imobiliária"
        description="Produção emitida no mês por imobiliária, com o percentual de repasse aplicado sobre a comissão gerada."
        stats={(
          <>
            <MetricCard label="Comissão Gerada" value={formatMoneyBR(totalComissaoGerada)} hint={mesLabel} tone="secondary" icon={<TrendingUp className="h-4 w-4" />} />
            <MetricCard label="Prêmio Total" value={formatMoneyBR(totalPremio)} hint={mesLabel} tone="accent" icon={<Coins className="h-4 w-4" />} />
            <MetricCard label="Imobiliárias" value={imobiliarias.length} hint="com produção no mês" tone="success" icon={<Building2 className="h-4 w-4" />} />
          </>
        )}
      />

      <DataCard title="Período" subtitle="Selecione o mês">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={String(ano)}
            onChange={v => setAno(Number(v))}
            options={[agora.getFullYear() + 1, agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2].map(a => ({ value: String(a), label: String(a) }))}
            className="w-28"
          />
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
        </div>
      </DataCard>

      <DataCard title="Evolução" subtitle={`Comissão gerada nos últimos ${EVOLUCAO_MESES} meses`}>
        <EvolucaoChart data={evolucao} />
      </DataCard>

      <DataCard title="Imobiliárias" subtitle="Clique para ver o detalhe por seguradora">
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : imobiliarias.length === 0 ? (
          <EmptyState title="Sem produção no mês" description="Nenhuma apólice emitida no período selecionado." icon={<Building2 className="h-6 w-6" />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-table text-sm">
              <thead className="table-thead">
                <tr>
                  {['Imobiliária', 'Apólices', 'Prêmio', 'Comissão gerada', 'Recebida estimada', '% repasse', 'A repassar'].map(h => (
                    <th key={h} className="th whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {imobiliarias.map(item => {
                  const meta = resolveImobiliaria(catalogo, item.imobiliaria)
                  return (
                    <tr key={item.imobiliaria} className="hover:bg-dark-surface2/40">
                      <td className="td">
                        <button onClick={() => navigate(`/financeiro/producao/${encodeURIComponent(item.imobiliaria)}`)} className="text-left">
                          <ImobiliariaIdentity nome={item.imobiliaria} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="sm" />
                        </button>
                      </td>
                      <td className="td font-mono text-xs">{item.qtd}</td>
                      <td className="td font-mono text-xs">{formatMoneyBR(item.premioTotal)}</td>
                      <td className="td font-mono text-xs">{formatMoneyBR(item.comissaoGerada)}</td>
                      <td className="td font-mono text-xs">{formatMoneyBR(item.comissaoRecebidaEstimada)}</td>
                      <td className="td">
                        <div className="flex items-center gap-1">
                          <input
                            value={pctAtual(item.imobiliaria)}
                            onChange={e => setEdits(prev => ({ ...prev, [item.imobiliaria]: e.target.value }))}
                            onBlur={() => salvarPct(item.imobiliaria)}
                            inputMode="decimal"
                            className="w-16 rounded-lg border border-dark-border bg-dark-surface2 px-2 py-1 text-right text-xs text-dark-text focus:border-brand-secondary focus:outline-none"
                            placeholder="0"
                          />
                          <Percent className="h-3 w-3 text-dark-muted" />
                        </div>
                      </td>
                      <td className="td font-mono text-xs font-semibold text-emerald-400">{formatMoneyBR(valorRepassar(item.imobiliaria, item.comissaoGerada))}</td>
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

- [ ] **Step 3: Habilitar a aba Produção no hub**

Modify `src/pages/Financeiro/Financeiro.jsx` — substituir a constante `TABS`:

```jsx
const TABS = [
  { to: '/financeiro', label: 'Visão Geral', end: true },
  { label: 'Produção', disabled: true },
  { label: 'Faturas', disabled: true },
]
```

por:

```jsx
const TABS = [
  { to: '/financeiro', label: 'Visão Geral', end: true },
  { to: '/financeiro/producao', label: 'Produção' },
  { label: 'Faturas', disabled: true },
]
```

- [ ] **Step 4: Registrar a rota no App.jsx**

Modify `src/App.jsx` — adicionar o lazy import (junto dos outros do financeiro):

```jsx
const FinanceiroProducao  = lazy(() => import('./pages/Financeiro/FinanceiroProducao'))
```

E dentro da rota `financeiro` (após `<Route index ... />`):

```jsx
          <Route path="financeiro" element={<AdminRoute><Financeiro /></AdminRoute>}>
            <Route index element={<FinanceiroVisaoGeral />} />
            <Route path="producao" element={<FinanceiroProducao />} />
          </Route>
```

- [ ] **Step 5: Build + check de contextos**

Run: `npm run build`
Expected: sucesso.

Run: `npm run check:page-contexts`
Expected: nenhuma nova falta em `src/pages/Financeiro/` (o `CONTEXT.md` da pasta já cobre os novos `.jsx`). Faltas pré-existentes em `auto/` e `comercial/GestaoComercial` permanecem e não são deste escopo.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Financeiro/EvolucaoChart.jsx src/pages/Financeiro/FinanceiroProducao.jsx src/pages/Financeiro/Financeiro.jsx src/App.jsx
git commit -m "feat(financeiro): aba Produção (lista por imobiliária, % editável, evolução)"
```

---

### Task 6: Página de detalhe da imobiliária

**Files:**
- Create: `src/pages/Financeiro/FinanceiroProducaoDetalhe.jsx`
- Modify: `src/App.jsx` (lazy import + rota `producao/:imobiliaria`)

**Interfaces:**
- Consumes: `fetchProducaoLedger` (Task 4); `agruparPorSeguradora`, `agruparEvolucaoPorMes` (Task 2); `fetchImobiliariasCatalogMap`, `resolveImobiliaria` (Task 3); `primeiroDiaMes`, `addMeses` (financeiroCalc); `formatMoneyBR` (apolices); `ImobiliariaIdentity`, `SeguradoraBadge`, `EvolucaoChart`.
- Produces: rota `/financeiro/producao/:imobiliaria`.

- [ ] **Step 1: Criar a página de detalhe**

Create `src/pages/Financeiro/FinanceiroProducaoDetalhe.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import EvolucaoChart from './EvolucaoChart'
import { fetchProducaoLedger } from '../../lib/financeiro'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { agruparPorSeguradora, agruparEvolucaoPorMes } from '../../lib/financeiroProducaoCalc'
import { primeiroDiaMes, addMeses } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { ArrowLeft, Coins, TrendingUp, FileText, Shield } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const EVOLUCAO_MESES = 6

function pad2(v) { return String(v).padStart(2, '0') }
function ymd(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}` }
function rangeMes(ano, mes) {
  return [ymd(ano, mes, 1), ymd(ano, mes, new Date(ano, mes, 0).getDate())]
}

export default function FinanceiroProducaoDetalhe() {
  const navigate = useNavigate()
  const { imobiliaria: imobParam } = useParams()
  const imobiliaria = decodeURIComponent(imobParam || '')
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [rows, setRows] = useState([])
  const [evolucaoRows, setEvolucaoRows] = useState([])
  const [catalogo, setCatalogo] = useState(null)
  const [loading, setLoading] = useState(true)

  const [inicio, fim] = useMemo(() => rangeMes(ano, mes), [ano, mes])
  const mesRef = useMemo(() => primeiroDiaMes(inicio), [inicio])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const desdeEvolucao = addMeses(mesRef, -(EVOLUCAO_MESES - 1))
    Promise.all([
      fetchProducaoLedger({ inicio, fim, imobiliaria }),
      fetchProducaoLedger({ inicio: desdeEvolucao, fim, imobiliaria }),
      fetchImobiliariasCatalogMap(),
    ]).then(([prod, evol, cat]) => {
      if (!mounted) return
      setRows(prod)
      setEvolucaoRows(evol)
      setCatalogo(cat)
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [inicio, fim, mesRef, imobiliaria])

  const seguradoras = useMemo(() => agruparPorSeguradora(rows), [rows])
  const evolucao = useMemo(
    () => agruparEvolucaoPorMes(evolucaoRows, { desde: addMeses(mesRef, -(EVOLUCAO_MESES - 1)), meses: EVOLUCAO_MESES }),
    [evolucaoRows, mesRef],
  )
  const meta = resolveImobiliaria(catalogo, imobiliaria)
  const qtd = rows.length
  const premio = useMemo(() => seguradoras.reduce((s, x) => s + x.premio, 0), [seguradoras])
  const comissao = useMemo(() => seguradoras.reduce((s, x) => s + x.comissao, 0), [seguradoras])
  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/financeiro/producao')} className="inline-flex items-center gap-1.5 text-xs font-medium text-dark-muted hover:text-dark-text">
        <ArrowLeft className="h-4 w-4" /> Voltar para Produção
      </button>

      <PageHeader
        eyebrow="Financeiro · Produção"
        title={meta?.nomeCanonico || imobiliaria}
        description={`Produção emitida em ${mesLabel}, detalhada por seguradora.`}
        actions={(<ImobiliariaIdentity nome={imobiliaria} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="lg" />)}
        stats={(
          <>
            <MetricCard label="Apólices" value={qtd} hint={mesLabel} tone="success" icon={<FileText className="h-4 w-4" />} />
            <MetricCard label="Prêmio" value={formatMoneyBR(premio)} hint={mesLabel} tone="accent" icon={<Coins className="h-4 w-4" />} />
            <MetricCard label="Comissão gerada" value={formatMoneyBR(comissao)} hint={mesLabel} tone="secondary" icon={<TrendingUp className="h-4 w-4" />} />
          </>
        )}
      />

      <DataCard title="Período" subtitle="Selecione o mês">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={String(ano)}
            onChange={v => setAno(Number(v))}
            options={[agora.getFullYear() + 1, agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2].map(a => ({ value: String(a), label: String(a) }))}
            className="w-28"
          />
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
        </div>
      </DataCard>

      <DataCard title="Evolução" subtitle={`Comissão gerada da imobiliária nos últimos ${EVOLUCAO_MESES} meses`}>
        <EvolucaoChart data={evolucao} />
      </DataCard>

      <DataCard title="Por seguradora" subtitle="Quebra da produção do mês por seguradora">
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : seguradoras.length === 0 ? (
          <EmptyState title="Sem produção no mês" description="Nenhuma apólice emitida no período para esta imobiliária." icon={<Shield className="h-6 w-6" />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-table text-sm">
              <thead className="table-thead">
                <tr>
                  {['Seguradora', 'Apólices', 'Prêmio', 'Comissão', 'Participação'].map(h => (
                    <th key={h} className="th whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {seguradoras.map(item => (
                  <tr key={item.seguradora}>
                    <td className="td"><SeguradoraBadge nome={item.seguradora} size="md" /></td>
                    <td className="td font-mono text-xs">{item.qtd}</td>
                    <td className="td font-mono text-xs">{formatMoneyBR(item.premio)}</td>
                    <td className="td font-mono text-xs">{formatMoneyBR(item.comissao)}</td>
                    <td className="td font-mono text-xs">{item.pctParticipacao}%</td>
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
const FinanceiroProducaoDetalhe = lazy(() => import('./pages/Financeiro/FinanceiroProducaoDetalhe'))
```

E adicionar a rota filha (após a rota `producao`):

```jsx
            <Route path="producao" element={<FinanceiroProducao />} />
            <Route path="producao/:imobiliaria" element={<FinanceiroProducaoDetalhe />} />
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 4: Smoke test manual (humano)**

`npm run dev`, login admin → `/financeiro/producao` → ver lista, editar um %, ver "A repassar" atualizar; clicar numa imobiliária → detalhe com seguradoras (logos) + gráfico; voltar.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Financeiro/FinanceiroProducaoDetalhe.jsx src/App.jsx
git commit -m "feat(financeiro): detalhe da imobiliária por seguradora + evolução"
```

---

## Self-Review

**Spec coverage (Fase 2):**
- Tabela `producao_comissao_imobiliaria` + RLS → Task 1. ✓
- Produção por imobiliária (logo, nº apólices, prêmio, comissão gerada, recebida estimada) → Tasks 2/4/5. ✓
- % editável salvo por mês + valor a repassar (= % × comissão gerada) → Tasks 1/4/5. ✓
- Detalhe por seguradora (qtd, prêmio, comissão, % participação) + logos → Tasks 2/6. ✓
- Base por emissão; filtros de status → Global Constraints + Task 4. ✓
- Comparativo/evolução histórica (gráfico recharts) → Tasks 2/5/6 (EvolucaoChart). ✓
- Logos imobiliária (resolver) + seguradora (SeguradoraBadge) → Tasks 3/5/6. ✓
- Navegação lista ↔ detalhe dedicado → Tasks 5/6 (rota `producao/:imobiliaria`). ✓
- Unificação com Fatura (Fase 3) → o % salvo em `producao_comissao_imobiliaria` é a fonte única; consumido na Fase 3. ✓

**Placeholder scan:** sem TBD/TODO; todo passo de código traz o código completo. ✓

**Type consistency:** nomes batem entre tasks — `fetchProducaoLedger`, `fetchPctImobiliarias`, `salvarPctImobiliaria`, `agruparPorImobiliaria`, `agruparPorSeguradora`, `agruparEvolucaoPorMes`, `fetchImobiliariasCatalogMap`, `resolveImobiliaria`. Campos do ledger (`premio_total`, `valor_comissao`, `comissao_mensal`, `data_emissao`, `seguradora`, `imobiliaria`) idênticos em SQL/data layer/calc. Tabela `producao_comissao_imobiliaria(imobiliaria, mes_referencia, pct_comissao)` consistente entre migração (Task 1) e data layer (Task 4). ✓

**Note (carry to final review):** `npm run check:page-contexts` continua vermelho por faltas PRÉ-EXISTENTES (`auto/`, `comercial/GestaoComercial`), não introduzidas aqui.
