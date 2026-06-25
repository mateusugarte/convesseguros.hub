# Financeiro — Revisão (Dashboard / Calendário / Ranking / Produção por seleção)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Reformular a Visão Geral como um **Dashboard** (KPIs do mês + **calendário anual** + **ranking de imobiliárias com fotos**) e trocar a Produção de lista para **seleção** (escolher imobiliária + mês → produção do mês = Σ prêmio, quebra por seguradora, % repasse editável).

**Architecture:** Sem mudança de banco. Reaproveita o ledger `apolices_comissoes` e `comissoes_recebimentos`. Lógica nova vai em `financeiroProducaoCalc.js` (puro/testável). Componente de calendário em `CalendarioAno.jsx`. As páginas existentes `FinanceiroVisaoGeral.jsx` e `FinanceiroProducao.jsx` são reescritas; `FinanceiroProducaoDetalhe.jsx` é absorvido pela Produção (rota `:imobiliaria` pré-seleciona).

**Tech Stack:** React 18 + Vite, react-router-dom v6, recharts, Tailwind. Testes `node --test`.

## Global Constraints

- **Produção = Σ `premio_total`** das apólices emitidas (indicador-título).
- Base por emissão: ledger filtrado por `status_emissao IN ('emitida','enviada')` E `status_apolice IN ('ativa','renovada')`/null, por `data_emissao`.
- % repasse: editável e salvo por imobiliária/mês (`producao_comissao_imobiliaria`), valor a repassar = pct/100 × comissão gerada da imobiliária.
- Reusar `PageHeader`/`MetricCard`/`DataCard`/`EmptyState`/`Select` (`src/components/ui`), `ImobiliariaIdentity`, `SeguradoraBadge`, `EvolucaoChart`; `formatMoneyBR` (`src/lib/apolices`), `parseDecimalBR` (`src/lib/numberInput`); helpers de `src/lib/financeiroCalc` e `src/lib/financeiroProducaoCalc`; data layer em `src/lib/financeiro.js` e `src/lib/imobiliariasLogos.js`.
- Import depth `../../` a partir de `src/pages/Financeiro/`.
- Design system: brand-secondary `#2B5BA8` ativo; tokens `dark-*`.

---

### Task 1: Helpers — calendário anual + ranking (TDD)

**Files:**
- Modify: `src/lib/financeiroProducaoCalc.js` (adicionar funções; manter as existentes)
- Modify: `src/lib/financeiroProducaoCalc.test.mjs` (adicionar testes)

**Interfaces:**
- Consumes: `parseYmd` de `./financeiroCalc.js` (já exportado).
- Produces:
  - `montarCalendarioAno({ ano, ledgerRows, recebimentoRows }) -> Array<12x{ mes, mesNum, label, producao, comissaoGerada, recebidaEstimada, qtd }>`
  - `rankingImobiliarias(rows) -> Array<{ imobiliaria, qtd, premioTotal, comissaoGerada, comissaoRecebidaEstimada }>` (desc por premioTotal)

- [ ] **Step 1: Adicionar os testes (falham)**

Adicionar ao final de `src/lib/financeiroProducaoCalc.test.mjs`:

```js
import { montarCalendarioAno, rankingImobiliarias } from './financeiroProducaoCalc.js'

test('montarCalendarioAno distribui produção/comissão/recebimentos nos 12 meses do ano', () => {
  const ledgerRows = [
    { data_emissao: '2026-01-10', premio_total: 1000, valor_comissao: 200 },
    { data_emissao: '2026-01-20', premio_total: 500,  valor_comissao: 100 },
    { data_emissao: '2026-03-05', premio_total: 800,  valor_comissao: 160 },
    { data_emissao: '2025-12-31', premio_total: 999,  valor_comissao: 99 }, // ano diferente: ignorado
  ]
  const recebimentoRows = [
    { mes_referencia: '2026-02-01', valor_previsto: 50 },
    { mes_referencia: '2026-02-01', valor_previsto: 25 },
  ]
  const cells = montarCalendarioAno({ ano: 2026, ledgerRows, recebimentoRows })
  assert.equal(cells.length, 12)
  assert.equal(cells[0].label, 'Jan')
  assert.equal(cells[0].producao, 1500)
  assert.equal(cells[0].comissaoGerada, 300)
  assert.equal(cells[0].qtd, 2)
  assert.equal(cells[1].recebidaEstimada, 75)
  assert.equal(cells[2].producao, 800)
  assert.equal(cells[2].mesNum, 3)
  assert.equal(cells[11].producao, 0)
})

test('rankingImobiliarias ordena por prêmio (produção) desc', () => {
  const rows = [
    { imobiliaria: 'Alpha', premio_total: 100, valor_comissao: 90, comissao_mensal: 9 },
    { imobiliaria: 'Beta',  premio_total: 500, valor_comissao: 10, comissao_mensal: 1 },
  ]
  const out = rankingImobiliarias(rows)
  assert.equal(out[0].imobiliaria, 'Beta')
  assert.equal(out[0].premioTotal, 500)
  assert.equal(out[1].imobiliaria, 'Alpha')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test src/lib/financeiroProducaoCalc.test.mjs`
Expected: FAIL (`montarCalendarioAno`/`rankingImobiliarias` não exportados).

- [ ] **Step 3: Implementar**

Em `src/lib/financeiroProducaoCalc.js`: (a) adicionar `parseYmd` ao import existente de `./financeiroCalc.js`; (b) adicionar a constante e as funções ao final.

Trocar a linha de import:

```js
import { primeiroDiaMes, addMeses, formatMesAno } from './financeiroCalc.js'
```

por:

```js
import { primeiroDiaMes, addMeses, formatMesAno, parseYmd } from './financeiroCalc.js'
```

Adicionar ao final do arquivo:

```js
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Monta 12 células (uma por mês do ano) mesclando produção/comissão (ledger, por emissão)
// e a comissão recebida estimada (recebimentos, por mes_referencia).
export function montarCalendarioAno({ ano, ledgerRows, recebimentoRows }) {
  const cells = []
  for (let m = 1; m <= 12; m++) {
    cells.push({
      mes: `${ano}-${String(m).padStart(2, '0')}-01`,
      mesNum: m,
      label: MESES_CURTOS[m - 1],
      producao: 0,
      comissaoGerada: 0,
      recebidaEstimada: 0,
      qtd: 0,
    })
  }
  for (const r of ledgerRows || []) {
    const d = parseYmd(r.data_emissao)
    if (!d || d.getFullYear() !== ano) continue
    const cell = cells[d.getMonth()]
    cell.producao += num(r.premio_total)
    cell.comissaoGerada += num(r.valor_comissao)
    cell.qtd += 1
  }
  for (const r of recebimentoRows || []) {
    const d = parseYmd(r.mes_referencia)
    if (!d || d.getFullYear() !== ano) continue
    cells[d.getMonth()].recebidaEstimada += num(r.valor_previsto)
  }
  return cells
}

// Ranking de imobiliárias por produção (prêmio total) desc.
export function rankingImobiliarias(rows) {
  return agruparPorImobiliaria(rows).sort((a, b) => b.premioTotal - a.premioTotal || a.qtd - b.qtd)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS, `# fail 0` (Fase 1 + Fase 2 + os 2 novos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/financeiroProducaoCalc.js src/lib/financeiroProducaoCalc.test.mjs
git commit -m "feat(financeiro): calendário anual e ranking por produção (helpers + testes)"
```

---

### Task 2: Componente `CalendarioAno.jsx`

**Files:**
- Create: `src/pages/Financeiro/CalendarioAno.jsx`

**Interfaces:**
- Consumes: `formatMoneyBR` (`../../lib/apolices`).
- Produces: componente `CalendarioAno({ cells, mesSelecionado, onSelectMes })`.

- [ ] **Step 1: Criar o componente**

Create `src/pages/Financeiro/CalendarioAno.jsx`:

```jsx
import { formatMoneyBR } from '../../lib/apolices'

export default function CalendarioAno({ cells, mesSelecionado, onSelectMes }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {cells.map(c => {
        const ativo = c.mesNum === mesSelecionado
        return (
          <button
            key={c.mes}
            onClick={() => onSelectMes(c.mesNum)}
            className={`rounded-2xl border p-3 text-left transition-colors ${
              ativo
                ? 'border-brand-secondary bg-brand-secondary/10'
                : 'border-dark-border/70 bg-dark-surface2/40 hover:border-dark-border'
            }`}
          >
            <p className={`text-xs font-semibold ${ativo ? 'text-brand-accent' : 'text-dark-muted'}`}>{c.label}</p>
            <p className="mt-1 text-sm font-semibold text-dark-text">{formatMoneyBR(c.producao)}</p>
            <p className="text-[11px] text-dark-muted">{c.qtd} apólice{c.qtd !== 1 ? 's' : ''}</p>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Financeiro/CalendarioAno.jsx
git commit -m "feat(financeiro): componente CalendarioAno (grade de 12 meses)"
```

---

### Task 3: Visão Geral → Dashboard (KPIs + calendário + ranking)

**Files:**
- Modify: `src/pages/Financeiro/FinanceiroVisaoGeral.jsx` (reescrita completa)

**Interfaces:**
- Consumes: `fetchProducaoLedger`, `fetchRecebimentos` (financeiro.js); `montarCalendarioAno`, `rankingImobiliarias` (financeiroProducaoCalc.js); `fetchImobiliariasCatalogMap`, `resolveImobiliaria` (imobiliariasLogos.js); `formatMoneyBR` (apolices); `CalendarioAno`, `ImobiliariaIdentity`.

- [ ] **Step 1: Reescrever a página**

Substituir todo o conteúdo de `src/pages/Financeiro/FinanceiroVisaoGeral.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import CalendarioAno from './CalendarioAno'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import { fetchProducaoLedger, fetchRecebimentos } from '../../lib/financeiro'
import { montarCalendarioAno, rankingImobiliarias } from '../../lib/financeiroProducaoCalc'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { parseYmd } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { Coins, TrendingUp, FileText, Building2 } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function FinanceiroVisaoGeral() {
  const navigate = useNavigate()
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [ledger, setLedger] = useState([])
  const [recebimentos, setRecebimentos] = useState([])
  const [catalogo, setCatalogo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const inicio = `${ano}-01-01`
    const fim = `${ano}-12-31`
    Promise.all([
      fetchProducaoLedger({ inicio, fim }),
      fetchRecebimentos({ inicio, fim }),
      fetchImobiliariasCatalogMap(),
    ]).then(([led, rec, cat]) => {
      if (!mounted) return
      setLedger(led)
      setRecebimentos(rec)
      setCatalogo(cat)
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [ano])

  const cells = useMemo(
    () => montarCalendarioAno({ ano, ledgerRows: ledger, recebimentoRows: recebimentos }),
    [ano, ledger, recebimentos],
  )
  const cell = cells[mes - 1] || { producao: 0, comissaoGerada: 0, recebidaEstimada: 0, qtd: 0 }

  const ranking = useMemo(() => {
    const doMes = ledger.filter(r => {
      const d = parseYmd(r.data_emissao)
      return d && d.getFullYear() === ano && d.getMonth() + 1 === mes
    })
    return rankingImobiliarias(doMes)
  }, [ledger, ano, mes])

  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro · Dashboard"
        title="Visão geral do Seguro Fiança"
        description="Produção é a soma do prêmio total das apólices emitidas. Selecione o mês no calendário."
        stats={(
          <>
            <MetricCard label="Produção" value={formatMoneyBR(cell.producao)} hint={mesLabel} tone="accent" icon={<Coins className="h-4 w-4" />} />
            <MetricCard label="Comissão Gerada" value={formatMoneyBR(cell.comissaoGerada)} hint={mesLabel} tone="secondary" icon={<TrendingUp className="h-4 w-4" />} />
            <MetricCard label="Recebida Estimada" value={formatMoneyBR(cell.recebidaEstimada)} hint={`a receber em ${mesLabel}`} tone="warning" icon={<Coins className="h-4 w-4" />} />
            <MetricCard label="Apólices" value={cell.qtd} hint={mesLabel} tone="success" icon={<FileText className="h-4 w-4" />} />
          </>
        )}
      />

      <DataCard
        title="Calendário"
        subtitle="Produção por mês — clique para selecionar"
        actions={(
          <Select
            value={String(ano)}
            onChange={v => setAno(Number(v))}
            options={[agora.getFullYear() + 1, agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2].map(a => ({ value: String(a), label: String(a) }))}
            className="w-28"
          />
        )}
      >
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : (
          <CalendarioAno cells={cells} mesSelecionado={mes} onSelectMes={setMes} />
        )}
      </DataCard>

      <DataCard title={`Ranking de imobiliárias — ${mesLabel}`} subtitle="Por produção (prêmio total) no mês">
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : ranking.length === 0 ? (
          <EmptyState title="Sem produção no mês" description="Nenhuma apólice emitida no mês selecionado." icon={<Building2 className="h-6 w-6" />} />
        ) : (
          <div className="space-y-2">
            {ranking.map((item, i) => {
              const meta = resolveImobiliaria(catalogo, item.imobiliaria)
              return (
                <button
                  key={item.imobiliaria}
                  onClick={() => navigate(`/financeiro/producao/${encodeURIComponent(item.imobiliaria)}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-dark-border/70 bg-dark-surface2/40 px-4 py-3 text-left transition-colors hover:border-dark-border"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-6 text-center text-sm font-bold text-dark-muted">{i + 1}</span>
                    <ImobiliariaIdentity nome={item.imobiliaria} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="sm" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-dark-text">{formatMoneyBR(item.premioTotal)}</p>
                    <p className="text-[11px] text-dark-muted">{item.qtd} apólice{item.qtd !== 1 ? 's' : ''}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </DataCard>
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sucesso.

- [ ] **Step 3: Smoke test manual (humano)**

`/financeiro` → KPIs do mês, calendário clicável (muda KPIs/ranking), ranking com fotos; clicar numa imobiliária abre a Produção dela.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Financeiro/FinanceiroVisaoGeral.jsx
git commit -m "feat(financeiro): Visão Geral vira dashboard (KPIs + calendário + ranking)"
```

---

### Task 4: Produção por seleção (absorve o detalhe)

**Files:**
- Modify: `src/lib/financeiro.js` (adicionar `fetchImobiliariasDistintas`)
- Modify: `src/pages/Financeiro/FinanceiroProducao.jsx` (reescrita: seletor + conteúdo)
- Delete: `src/pages/Financeiro/FinanceiroProducaoDetalhe.jsx`
- Modify: `src/App.jsx` (rota `:imobiliaria` passa a renderizar `FinanceiroProducao`; remover import do detalhe)

**Interfaces:**
- Produces: `fetchImobiliariasDistintas() -> Promise<string[]>`.
- Consumes: `fetchProducaoLedger`, `fetchPctImobiliarias`, `salvarPctImobiliaria` (financeiro.js); `agruparPorSeguradora`, `agruparEvolucaoPorMes` (financeiroProducaoCalc.js); `fetchImobiliariasCatalogMap`, `resolveImobiliaria` (imobiliariasLogos.js); `primeiroDiaMes`, `addMeses` (financeiroCalc); `formatMoneyBR` (apolices); `parseDecimalBR` (numberInput); `ImobiliariaIdentity`, `SeguradoraBadge`, `EvolucaoChart`; `useAuth`, `useParams`, `useNavigate`.

- [ ] **Step 1: Adicionar `fetchImobiliariasDistintas` ao data layer**

Adicionar ao final de `src/lib/financeiro.js`:

```js
// Lista de imobiliárias distintas presentes no ledger (para o seletor da Produção).
export async function fetchImobiliariasDistintas() {
  const { data, error } = await supabase
    .from('apolices_comissoes')
    .select('imobiliaria')
    .not('imobiliaria', 'is', null)
  if (error) throw error
  return [...new Set((data || []).map(r => r.imobiliaria).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}
```

- [ ] **Step 2: Reescrever a página de Produção**

Substituir todo o conteúdo de `src/pages/Financeiro/FinanceiroProducao.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import ImobiliariaIdentity from '../../components/ImobiliariaIdentity'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import EvolucaoChart from './EvolucaoChart'
import { useAuth } from '../../contexts/AuthContext'
import {
  fetchProducaoLedger, fetchPctImobiliarias, salvarPctImobiliaria, fetchImobiliariasDistintas,
} from '../../lib/financeiro'
import { agruparPorSeguradora, agruparEvolucaoPorMes } from '../../lib/financeiroProducaoCalc'
import { fetchImobiliariasCatalogMap, resolveImobiliaria } from '../../lib/imobiliariasLogos'
import { primeiroDiaMes, addMeses } from '../../lib/financeiroCalc'
import { formatMoneyBR } from '../../lib/apolices'
import { parseDecimalBR } from '../../lib/numberInput'
import { Building2, Coins, TrendingUp, FileText, Percent, Shield } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const EVOLUCAO_MESES = 6

function pad2(v) { return String(v).padStart(2, '0') }
function ymd(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}` }
function rangeMes(ano, mes) {
  return [ymd(ano, mes, 1), ymd(ano, mes, new Date(ano, mes, 0).getDate())]
}

export default function FinanceiroProducao() {
  const navigate = useNavigate()
  const { imobiliaria: imobParam } = useParams()
  const selecionada = imobParam ? decodeURIComponent(imobParam) : ''
  const { user } = useAuth()
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [opcoes, setOpcoes] = useState([])
  const [rows, setRows] = useState([])
  const [evolucaoRows, setEvolucaoRows] = useState([])
  const [catalogo, setCatalogo] = useState(null)
  const [pct, setPct] = useState('')
  const [pctSalvo, setPctSalvo] = useState(null)
  const [loading, setLoading] = useState(false)

  const [inicio, fim] = useMemo(() => rangeMes(ano, mes), [ano, mes])
  const mesRef = useMemo(() => primeiroDiaMes(inicio), [inicio])

  // Opções do seletor + catálogo (uma vez)
  useEffect(() => {
    let mounted = true
    Promise.all([fetchImobiliariasDistintas(), fetchImobiliariasCatalogMap()])
      .then(([nomes, cat]) => {
        if (!mounted) return
        setOpcoes(nomes)
        setCatalogo(cat)
      }).catch(() => {})
    return () => { mounted = false }
  }, [])

  // Dados da imobiliária selecionada
  useEffect(() => {
    if (!selecionada) { setRows([]); setEvolucaoRows([]); return }
    let mounted = true
    setLoading(true)
    const desdeEvolucao = addMeses(mesRef, -(EVOLUCAO_MESES - 1))
    Promise.all([
      fetchProducaoLedger({ inicio, fim, imobiliaria: selecionada }),
      fetchProducaoLedger({ inicio: desdeEvolucao, fim, imobiliaria: selecionada }),
      fetchPctImobiliarias({ mes: mesRef }),
    ]).then(([prod, evol, pctMap]) => {
      if (!mounted) return
      setRows(prod)
      setEvolucaoRows(evol)
      const salvo = pctMap[selecionada]
      setPctSalvo(salvo ?? null)
      const meta = resolveImobiliaria(catalogo, selecionada)
      setPct(salvo != null ? String(salvo) : (meta?.pctComissao != null ? String(meta.pctComissao) : ''))
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [selecionada, inicio, fim, mesRef, catalogo])

  const seguradoras = useMemo(() => agruparPorSeguradora(rows), [rows])
  const evolucao = useMemo(
    () => agruparEvolucaoPorMes(evolucaoRows, { desde: addMeses(mesRef, -(EVOLUCAO_MESES - 1)), meses: EVOLUCAO_MESES }),
    [evolucaoRows, mesRef],
  )
  const producao = useMemo(() => seguradoras.reduce((s, x) => s + x.premio, 0), [seguradoras])
  const comissaoGerada = useMemo(() => seguradoras.reduce((s, x) => s + x.comissao, 0), [seguradoras])
  const valorRepassar = (() => {
    const p = parseDecimalBR(pct)
    return p != null ? (p / 100) * comissaoGerada : 0
  })()
  const meta = resolveImobiliaria(catalogo, selecionada)
  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`

  async function salvarPct() {
    const p = parseDecimalBR(pct)
    if (p === pctSalvo) return
    const err = await salvarPctImobiliaria({ imobiliaria: selecionada, mes: mesRef, pct: p, userId: user?.id })
    if (!err) setPctSalvo(p)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro · Produção"
        title="Produção por imobiliária"
        description="Selecione a imobiliária e o mês. Produção é a soma do prêmio total dos seguros emitidos."
        actions={selecionada ? (<ImobiliariaIdentity nome={selecionada} imagemPath={meta?.imagemPath} imagemUrl={meta?.imagemUrl} size="lg" />) : null}
      />

      <DataCard title="Seleção" subtitle="Imobiliária e mês">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={selecionada}
            onChange={v => navigate(v ? `/financeiro/producao/${encodeURIComponent(v)}` : '/financeiro/producao')}
            options={[{ value: '', label: 'Selecione a imobiliária...' }, ...opcoes.map(n => ({ value: n, label: n }))]}
            className="min-w-[260px]"
          />
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

      {!selecionada ? (
        <DataCard title="Produção">
          <EmptyState title="Selecione uma imobiliária" description="Escolha uma imobiliária no seletor acima para ver a produção do mês." icon={<Building2 className="h-6 w-6" />} />
        </DataCard>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Produção" value={formatMoneyBR(producao)} hint={mesLabel} tone="accent" icon={<Coins className="h-4 w-4" />} />
            <MetricCard label="Comissão gerada" value={formatMoneyBR(comissaoGerada)} hint={mesLabel} tone="secondary" icon={<TrendingUp className="h-4 w-4" />} />
            <MetricCard label="Apólices" value={rows.length} hint={mesLabel} tone="success" icon={<FileText className="h-4 w-4" />} />
            <MetricCard label="A repassar" value={formatMoneyBR(valorRepassar)} hint="% × comissão gerada" tone="warning" icon={<Percent className="h-4 w-4" />} />
          </div>

          <DataCard title="Repasse da imobiliária" subtitle="Percentual sobre a comissão gerada, salvo para o mês">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <input
                  value={pct}
                  onChange={e => setPct(e.target.value)}
                  onBlur={salvarPct}
                  inputMode="decimal"
                  className="w-20 rounded-lg border border-dark-border bg-dark-surface2 px-2 py-1.5 text-right text-sm text-dark-text focus:border-brand-secondary focus:outline-none"
                  placeholder="0"
                />
                <Percent className="h-4 w-4 text-dark-muted" />
              </div>
              <span className="text-sm text-dark-muted">→ a repassar</span>
              <span className="text-sm font-semibold text-emerald-400">{formatMoneyBR(valorRepassar)}</span>
            </div>
          </DataCard>

          <DataCard title="Evolução" subtitle={`Comissão gerada nos últimos ${EVOLUCAO_MESES} meses`}>
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
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Remover a página de detalhe e ajustar as rotas**

```bash
git rm src/pages/Financeiro/FinanceiroProducaoDetalhe.jsx
```

Modify `src/App.jsx`:
- Remover a linha do lazy import `FinanceiroProducaoDetalhe`.
- A rota `producao/:imobiliaria` passa a renderizar `FinanceiroProducao`. As rotas do financeiro ficam:

```jsx
          <Route path="financeiro" element={<AdminRoute><Financeiro /></AdminRoute>}>
            <Route index element={<FinanceiroVisaoGeral />} />
            <Route path="producao" element={<FinanceiroProducao />} />
            <Route path="producao/:imobiliaria" element={<FinanceiroProducao />} />
          </Route>
```

- [ ] **Step 4: Build + check de contextos**

Run: `npm run build`
Expected: sucesso (sem referência ao arquivo removido).

Run: `npm run check:page-contexts`
Expected: nenhuma falta nova em `Financeiro/`; faltas pré-existentes em `auto/` e `comercial/GestaoComercial` permanecem.

- [ ] **Step 5: Smoke test manual (humano)**

`/financeiro/producao` → selecionar imobiliária → ver produção (prêmio), % repasse editável (salva no blur), quebra por seguradora, gráfico. Pelo ranking do dashboard, clicar numa imobiliária deve abrir já selecionada.

- [ ] **Step 6: Commit**

```bash
git add src/lib/financeiro.js src/pages/Financeiro/FinanceiroProducao.jsx src/App.jsx
git commit -m "feat(financeiro): Produção por seleção de imobiliária (absorve o detalhe)"
```

---

## Self-Review

**Spec coverage (revisão, seção 11):**
- Produção = Σ prêmio total → Task 1 (montarCalendarioAno usa premio_total; rankingImobiliarias por premioTotal) + Tasks 3/4. ✓
- Calendário na Visão Geral → Tasks 1/2/3 (CalendarioAno + dashboard). ✓
- Ranking de imobiliárias com fotos → Task 3 (ImobiliariaIdentity + resolver). ✓
- KPIs do mês (Produção, Comissão Gerada, Recebida Estimada, Apólices) → Task 3. ✓
- Produção por seleção (imobiliária + mês) com prêmio + seguradora + % repasse → Task 4. ✓
- Ranking → Produção pré-selecionada via rota `:imobiliaria` → Tasks 3/4. ✓
- Detalhe absorvido (remoção de FinanceiroProducaoDetalhe) → Task 4. ✓
- Calendário das Faturas → Fase 3 (fora desta revisão). ✓ (anotado)

**Placeholder scan:** sem TBD/TODO; código completo em cada passo. ✓

**Type consistency:** `montarCalendarioAno`/`rankingImobiliarias`/`fetchImobiliariasDistintas` definidos (Task 1/4) e consumidos (Tasks 3/4). Campos de célula (`producao`, `comissaoGerada`, `recebidaEstimada`, `qtd`, `mesNum`, `mes`, `label`) consistentes entre calc, `CalendarioAno` e dashboard. `agruparPorSeguradora`/`agruparEvolucaoPorMes` reusados sem mudança de assinatura. ✓

**Nota:** `npm run check:page-contexts` segue vermelho por faltas PRÉ-EXISTENTES fora do escopo.
