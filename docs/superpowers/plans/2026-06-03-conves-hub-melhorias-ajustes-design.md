# Conves-Hub — Melhorias, Ajustes e Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar melhorias funcionais (M1-M4), corrigir bugs e ajustes de UX (A1-A9), e aplicar transformação visual global Solid Glass Effect (BLOCO 3).

**Architecture:** React SPA sem backend intermediário. Toda lógica de dados vai via Supabase JS client direto ao PostgreSQL. Novas tabelas precisam de SQL executado no Supabase SQL Editor (fora do código). Supabase Storage usado para M3 (PDFs) — bucket precisa ser criado manualmente no dashboard.

**Tech Stack:** React 18 + Vite · Tailwind CSS + CSS Variables (`index.css`) · Supabase JS SDK · @dnd-kit/core · @tanstack/react-query · date-fns · recharts · lucide-react

---

## ⚠️ Aviso de Escopo

Este plano cobre **17 tasks** em **7 fases**. Recomendo executar em fases separadas com commits entre cada uma. Fases 1-3 são seguras e rápidas; Fases 4-7 são mais complexas e têm risco médio.

**Dependências obrigatórias antes de começar:**
- M3 requer criar bucket `documentos` no Supabase Storage Dashboard
- M4 requer rodar SQL de migration para `imobiliaria_codigos`
- M1 já tem a coluna `emitido_por` na tabela `apolices` (da migration `create_apolices.sql`)

---

## Mapeamento de Arquivos

| Arquivo | Tarefas que tocam |
|---------|-------------------|
| `src/index.css` | BLOCO 3 (glass design) |
| `src/lib/fichas.js` | A1, A2, A3 |
| `src/lib/apolices.js` | M1, M2, A8 |
| `src/pages/Dashboard.jsx` | A1 |
| `src/pages/Fichas.jsx` | A2 |
| `src/pages/MinhasFichas.jsx` | A6, A7 |
| `src/pages/Relatorio.jsx` | A9 |
| `src/pages/ApolicesDashboard.jsx` | A8 |
| `src/pages/ApoicesGestao.jsx` | M1, M2 |
| `src/pages/ApoliceDetalhe.jsx` | M1, M3 |
| `src/pages/FichaDetalhePage.jsx` | M3 |
| `src/pages/Imobiliarias.jsx` | M4 |
| `src/pages/ImobiliariaDetalhe.jsx` | M4 |
| `src/components/KanbanFichas.jsx` | A3, A4, A5 |
| `src/components/Layout.jsx` | BLOCO 3 |
| `src/lib/documentos.js` | M3 (criar) |
| `supabase/10_documentos.sql` | M3 (criar) |
| `supabase/11_imob_codigos.sql` | M4 (criar) |

---

## FASE 1 — Quick Fixes (≈30 min, risco baixo)

### Task 1: A9 — Renomear sub-label da métrica no Relatório

**Contexto:** Em `Relatorio.jsx`, a métrica "Aprovadas" tem `sub: 'aprovado + emitido'` (jargão interno confuso). O usuário quer renomear para deixar claro que são fichas sem apólice formal ainda.

**Files:**
- Modify: `src/pages/Relatorio.jsx` (função `Metricas`)

- [ ] **Step 1: Localizar e alterar o sub-label**

Em `src/pages/Relatorio.jsx`, na função `Metricas`, alterar:
```jsx
// ANTES:
{ label: 'Aprovadas', val: totalAprovadas, color: '#10B981', sub: 'aprovado + emitido' },

// DEPOIS:
{ label: 'Aprovado - S/Apólice', val: totalAprovadas, color: '#10B981', sub: 'aprovado + emitido' },
```

- [ ] **Step 2: Commit**
```bash
git add src/pages/Relatorio.jsx
git commit -m "fix: renomear métrica 'Aprovadas' para 'Aprovado - S/Apólice' no relatório"
```

---

### Task 2: A7 — Bug: dados somem ao editar via "Fichas passadas por mim"

**Diagnóstico:** Em `MinhasFichas.jsx`, a query `fetchFichas({ tipo: 'passadas_por_mim', ... })` seleciona apenas:
`id, created_at, produto, imobiliaria, nome_interessado, cpf, status, assumida, orcamentista_id, assumida_em, seguradora, retorno_enviado, profiles!orcamentista_id(nome)`

Quando `ModalFicha` recebe esse objeto, campos como `nome_empresa`, `cnpj`, `celular`, `email`, `cep`, `valor_aluguel`, etc. são `undefined` → inicializados como `''` → aparecem em branco no formulário.

**Fix:** Antes de abrir `ModalFicha`, buscar a ficha completa com `fetchFichaDetalhe(id)`.

**Files:**
- Modify: `src/pages/MinhasFichas.jsx`

- [ ] **Step 1: Adicionar import de fetchFichaDetalhe**

Em `MinhasFichas.jsx`, linha 3, adicionar `fetchFichaDetalhe` ao import:
```jsx
import { fetchFichasDoOrcamentista, fetchFichas, deletarFicha, fetchFichaDetalhe, STATUS_LABELS, PRODUTO_LABELS } from '../lib/fichas'
```

- [ ] **Step 2: Adicionar estado de loading para edição**

Adicionar após os estados existentes (`const [editar, setEditar] = useState(null)`):
```jsx
const [editarLoading, setEditarLoading] = useState(false)
```

- [ ] **Step 3: Criar handler de edição com fetch completo**

Substituir onde `setEditar(ficha)` é chamado por um handler que busca a ficha completa. Encontre o padrão `onEdit` ou `setEditar` na lista de passadas e substitua:
```jsx
async function handleEditar(fichaId) {
  setEditarLoading(true)
  const ficha = await fetchFichaDetalhe(fichaId)
  setEditarLoading(false)
  if (ficha) setEditar(ficha)
}
```

- [ ] **Step 4: Atualizar chamadas de edição na lista**

Na tabela/lista de fichas passadas, substituir `onClick={() => setEditar(f)}` por `onClick={() => handleEditar(f.id)}`.

- [ ] **Step 5: Commit**
```bash
git add src/pages/MinhasFichas.jsx
git commit -m "fix: carregar ficha completa antes de abrir modal de edição em MinhasFichas"
```

---

## FASE 2 — Filtros de Período (≈2h, risco baixo)

### Task 3: A1 — Dashboard: filtro de período (padrão = mês atual)

**Contexto:** O Dashboard mostra KPIs históricos de todo o período. O usuário quer que por padrão exiba apenas o mês atual, com um filtro de mês/ano. Apenas 3 seções respondem ao filtro: KPIs, ranking de imobs com fichas, e gráfico de distribuição de status.

**Files:**
- Modify: `src/lib/fichas.js` (funções `fetchKPIs`, `fetchTopImobiliarias`, `fetchDistribuicaoStatus`)
- Modify: `src/pages/Dashboard.jsx`

- [ ] **Step 1: Atualizar fetchKPIs para aceitar intervalo opcional**

Em `src/lib/fichas.js`, localizar `export async function fetchKPIs()` e substituir por:
```javascript
export async function fetchKPIs(inicioFiltro, fimFiltro) {
  const hoje = new Date()
  const inicioHoje   = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString()
  const inicioSemana = (() => {
    const d = new Date(); const day = d.getDay()
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); d.setHours(0,0,0,0); return d.toISOString()
  })()
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  // Base query — com filtro de período quando fornecido
  const base = () => {
    let q = supabase.from('fichas').select('*', { count: 'exact', head: true })
    if (inicioFiltro) q = q.gte('created_at', inicioFiltro)
    if (fimFiltro)    q = q.lte('created_at', fimFiltro)
    return q
  }

  const [{ count: total }, { count: hoje_ }, { count: semana }, { count: mes }, { count: emAberto }] = await Promise.all([
    base(),
    base().gte('created_at', inicioHoje),
    base().gte('created_at', inicioSemana),
    base().gte('created_at', inicioMes),
    base().in('status', STATUS_EM_ABERTO),
  ])

  return { total, hoje: hoje_, semana, mes, emAberto }
}
```

- [ ] **Step 2: Atualizar fetchTopImobiliarias para aceitar intervalo**

Em `src/lib/fichas.js`, localizar `export async function fetchTopImobiliarias(limite = 5)` e substituir por:
```javascript
export async function fetchTopImobiliarias(limite = 5, inicioFiltro, fimFiltro) {
  const data = await fetchAllRows(() => {
    let q = supabase.from('fichas').select('imobiliaria').eq('status', 'aprovado').not('imobiliaria', 'is', null)
    if (inicioFiltro) q = q.gte('created_at', inicioFiltro)
    if (fimFiltro)    q = q.lte('created_at', fimFiltro)
    return q
  })
  const contagem = {}
  data.forEach(f => {
    const nome = normalizeImobiliaria(f.imobiliaria) || f.imobiliaria
    contagem[nome] = (contagem[nome] || 0) + 1
  })
  return Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, limite).map(([name, total]) => ({ name, total }))
}
```

- [ ] **Step 3: Atualizar fetchDistribuicaoStatus para aceitar intervalo**

```javascript
export async function fetchDistribuicaoStatus(inicioFiltro, fimFiltro) {
  const statuses = Object.keys(STATUS_LABELS)
  const results = await Promise.all(
    statuses.map(s => {
      let q = supabase.from('fichas').select('*', { count: 'exact', head: true }).eq('status', s)
      if (inicioFiltro) q = q.gte('created_at', inicioFiltro)
      if (fimFiltro)    q = q.lte('created_at', fimFiltro)
      return q
    })
  )
  return statuses
    .map((s, i) => ({ status: s, label: STATUS_LABELS[s]?.label ?? s, value: results[i].count || 0 }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)
}
```

- [ ] **Step 4: Adicionar seletor de mês/ano no Dashboard**

Em `src/pages/Dashboard.jsx`, adicionar estado e seletor logo após o header:

Estado:
```jsx
const agora = new Date()
const [filtroAno, setFiltroAno] = useState(agora.getFullYear())
const [filtroMes, setFiltroMes] = useState(agora.getMonth() + 1)

const inicioFiltro = new Date(filtroAno, filtroMes - 1, 1).toISOString()
const fimFiltro    = new Date(filtroAno, filtroMes, 0, 23, 59, 59).toISOString()
```

Atualizar `queryKey` e `queryFn`:
```jsx
const { data, isLoading, refetch } = useQuery({
  queryKey: ['dashboard', user?.id, filtroAno, filtroMes],
  queryFn: async () => {
    const [k, em, g, ti, dist, pm, met, atv, mf] = await Promise.all([
      fetchKPIs(inicioFiltro, fimFiltro),
      fetchEmitidas(),
      fetchFichasPorDia(30),
      fetchTopImobiliarias(5, inicioFiltro, fimFiltro),
      fetchDistribuicaoStatus(inicioFiltro, fimFiltro),
      fetchFichasPorProdutoMes(),
      fetchMetricas(),
      fetchAtividadeRecente(10),
      user ? fetchFichasDoOrcamentista(user.id) : Promise.resolve([]),
    ])
    return { kpis: k, emitidas: em, grafico: g, topImob: ti, distribuicao: dist, prodMes: pm, metricas: met, atividade: atv, minhasFichas: mf }
  },
})
```

Adicionar seletor no header do Dashboard (após o `<h1>`):
```jsx
const MESES_ABBR_DASH = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
// JSX no render:
<div className="flex items-center gap-2 text-sm">
  <select
    value={filtroMes}
    onChange={e => setFiltroMes(Number(e.target.value))}
    className="select py-1 text-xs"
    style={{ minWidth: '80px' }}
  >
    {MESES_ABBR_DASH.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
  </select>
  <select
    value={filtroAno}
    onChange={e => setFiltroAno(Number(e.target.value))}
    className="select py-1 text-xs"
    style={{ minWidth: '70px' }}
  >
    {[agora.getFullYear(), agora.getFullYear()-1, agora.getFullYear()-2].map(y =>
      <option key={y} value={y}>{y}</option>
    )}
  </select>
</div>
```

- [ ] **Step 5: Commit**
```bash
git add src/lib/fichas.js src/pages/Dashboard.jsx
git commit -m "feat: filtro de período mês/ano no Dashboard (KPIs, ranking imob, distribuição status)"
```

---

### Task 4: A2 — Fichas: filtro de período (padrão = mês atual)

**Contexto:** A tela de Fichas mostra métricas globais sem filtro de data. O usuário quer que as métricas exibam apenas o mês atual por padrão, com filtro de mês/ano.

**Files:**
- Modify: `src/lib/fichas.js` (funções `fetchContagemProdutos`, `fetchKPIsVisaoGeral`)
- Modify: `src/pages/Fichas.jsx`

- [ ] **Step 1: Atualizar fetchContagemProdutos para aceitar intervalo**

```javascript
export async function fetchContagemProdutos(inicioFiltro, fimFiltro) {
  const produtos = ['residencial_pf', 'comercial_pf', 'pessoa_juridica']
  const queries = []
  for (const p of produtos) {
    const base = () => {
      let q = supabase.from('fichas').select('*', { count: 'exact', head: true }).eq('produto', p)
      if (inicioFiltro) q = q.gte('created_at', inicioFiltro)
      if (fimFiltro)    q = q.lte('created_at', fimFiltro)
      return q
    }
    queries.push(base(), base().in('status', STATUS_EM_ABERTO))
  }
  const allBase = () => {
    let q = supabase.from('fichas').select('*', { count: 'exact', head: true })
    if (inicioFiltro) q = q.gte('created_at', inicioFiltro)
    if (fimFiltro)    q = q.lte('created_at', fimFiltro)
    return q
  }
  queries.push(allBase(), allBase().in('status', STATUS_EM_ABERTO))
  const results = await Promise.all(queries)
  const result = {}
  produtos.forEach((p, i) => {
    result[p] = { total: results[i * 2].count || 0, emAberto: results[i * 2 + 1].count || 0 }
  })
  result.todos = { total: results[6].count || 0, emAberto: results[7].count || 0 }
  return result
}
```

- [ ] **Step 2: Atualizar fetchKPIsVisaoGeral para aceitar intervalo**

```javascript
export async function fetchKPIsVisaoGeral(inicioFiltro, fimFiltro) {
  const agora = new Date()
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString()
  const inicioSemana = (() => {
    const d = new Date(); const day = d.getDay()
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); d.setHours(0, 0, 0, 0); return d.toISOString()
  })()
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).toISOString()
  const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59).toISOString()

  const base = () => {
    let q = supabase.from('fichas').select('*', { count: 'exact', head: true })
    if (inicioFiltro) q = q.gte('created_at', inicioFiltro)
    if (fimFiltro)    q = q.lte('created_at', fimFiltro)
    return q
  }

  const results = await Promise.all([
    base(),
    base().gte('created_at', inicioMesAnterior).lte('created_at', fimMesAnterior),
    base().gte('created_at', inicioHoje),
    base().gte('created_at', inicioSemana),
    base().eq('status', 'pendente'),
    base().eq('status', 'em_cotacao'),
  ])

  const [totalMes, totalMesAnterior, hoje, semana, pendentes, emCotacao] = results.map(r => r.count || 0)
  const variacaoMes = totalMesAnterior
    ? Math.round(((totalMes - totalMesAnterior) / totalMesAnterior) * 100)
    : null

  return { totalMes, variacaoMes, hoje, semana, pendentes, emCotacao }
}
```

- [ ] **Step 3: Adicionar estado de filtro e passar para queries em Fichas.jsx**

Em `Fichas.jsx`, localizar onde `fetchContagemProdutos` e `fetchKPIsVisaoGeral` são chamados. Adicionar estado:
```jsx
const agora = new Date()
const [filtroAno, setFiltroAno] = useState(agora.getFullYear())
const [filtroMes, setFiltroMes] = useState(agora.getMonth() + 1)
const inicioFiltro = new Date(filtroAno, filtroMes - 1, 1).toISOString()
const fimFiltro    = new Date(filtroAno, filtroMes, 0, 23, 59, 59).toISOString()
```

Atualizar as chamadas:
```jsx
// Onde fetchContagemProdutos() é chamado, passar os filtros:
fetchContagemProdutos(inicioFiltro, fimFiltro)
fetchKPIsVisaoGeral(inicioFiltro, fimFiltro)
```

Adicionar seletor de mês/ano no header de `Fichas.jsx` (junto com os filtros existentes).

- [ ] **Step 4: Commit**
```bash
git add src/lib/fichas.js src/pages/Fichas.jsx
git commit -m "feat: filtro de período nas métricas da tela de Fichas (padrão = mês atual)"
```

---

### Task 5: A6 — MinhasFichas: filtro por mês

**Contexto:** Em `MinhasFichas.jsx`, as fichas passadas carregam todas de vez sem filtro de data. O usuário quer filtrar por mês/ano.

**Files:**
- Modify: `src/pages/MinhasFichas.jsx`

- [ ] **Step 1: Adicionar estado de filtro e passar para fetchFichas**

Adicionar estados:
```jsx
const agora = new Date()
const [filtroAno, setFiltroAno] = useState(agora.getFullYear())
const [filtroMes, setFiltroMes] = useState(agora.getMonth() + 1)
```

Atualizar a query (dentro do `useQuery`):
```jsx
queryKey: ['minhas-fichas', user?.id, filtroAno, filtroMes],
queryFn: () => {
  const inicioFiltro = new Date(filtroAno, filtroMes - 1, 1).toISOString()
  const fimFiltro    = new Date(filtroAno, filtroMes, 0, 23, 59, 59).toISOString()
  return Promise.all([
    fetchFichasDoOrcamentista(user.id),
    fetchFichas({ tipo: 'passadas_por_mim', orcamentistaId: user.id, pageSize: 500, ano: filtroAno, mes: filtroMes }),
  ]).then(([ab, { data }]) => ({ abertas: ab, passadas: data }))
}
```

- [ ] **Step 2: Adicionar seletor de mês/ano na UI**

Adicionar antes da lista de fichas passadas:
```jsx
const MESES_MIN = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// JSX:
<div className="flex items-center gap-2 mb-4">
  <span className="text-xs text-dark-muted">Período:</span>
  <select value={filtroMes} onChange={e => setFiltroMes(Number(e.target.value))} className="select py-1 text-xs" style={{ minWidth: '80px' }}>
    {MESES_MIN.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
  </select>
  <select value={filtroAno} onChange={e => setFiltroAno(Number(e.target.value))} className="select py-1 text-xs" style={{ minWidth: '70px' }}>
    {[agora.getFullYear(), agora.getFullYear()-1].map(y => <option key={y} value={y}>{y}</option>)}
  </select>
</div>
```

- [ ] **Step 3: Commit**
```bash
git add src/pages/MinhasFichas.jsx
git commit -m "feat: filtro de mês/ano em MinhasFichas"
```

---

## FASE 3 — Kanban Enhancements (≈2-3h, risco médio)

### Task 6: A3 — Ordenação nas colunas Aprovado e Recusado

**Contexto:** No kanban de fichas, as colunas "Aprovadas" e "Recusadas" devem mostrar fichas com a mais recente no topo. O campo `finalizada_em` registra quando a ficha foi finalizada.

**Files:**
- Modify: `src/components/KanbanFichas.jsx` (função `groupFichas`)

- [ ] **Step 1: Atualizar groupFichas para ordenar Aprovado/Recusado**

Em `KanbanFichas.jsx`, localizar a função `groupFichas` e atualizar:
```javascript
function groupFichas(fichas, userId) {
  const cols = Object.fromEntries(COLUMNS.map(c => [c.id, []]))
  fichas.forEach(f => {
    const colId = getColumnId(f, userId)
    if (cols[colId] !== undefined) cols[colId].push(f)
  })
  // Ordenar "aprovado" e "recusado" pelo mais recente (finalizada_em > created_at)
  for (const colId of ['aprovado', 'recusado']) {
    cols[colId].sort((a, b) =>
      new Date(b.finalizada_em || b.created_at) - new Date(a.finalizada_em || a.created_at)
    )
  }
  return cols
}
```

- [ ] **Step 2: Garantir que finalizada_em é retornado pelo fetchFichasKanban**

Em `src/lib/fichas.js`, verificar que `fetchFichasKanban` inclui `finalizada_em` no select:
```javascript
.select('id,created_at,finalizada_em,produto,imobiliaria,nome_interessado,nome_empresa,cpf,cnpj,status,assumida,orcamentista_id,assumida_em,seguradora,retorno_enviado,profiles!orcamentista_id(nome)')
```

- [ ] **Step 3: Commit**
```bash
git add src/components/KanbanFichas.jsx src/lib/fichas.js
git commit -m "feat: ordenar fichas aprovadas/recusadas pelo mais recente no topo"
```

---

### Task 7: A4 — Modal obrigatório ao arrastar para "Recusado"

**Contexto:** Ao mover ficha para coluna "Recusado", abrir modal obrigatório perguntando "Retorno enviado ao cliente?" (Sim/Não). Não pode fechar sem responder. Ao confirmar, salvar `retorno_enviado` e mover status para `recusado` (finalizado).

**Files:**
- Modify: `src/components/KanbanFichas.jsx`

- [ ] **Step 1: Adicionar estado para modal de recusado**

Em `KanbanFichas.jsx`, adicionar estado junto aos outros:
```jsx
const [pendingRecusado, setPendingRecusado] = useState(null) // { fichaId, fichaOriginal }
```

- [ ] **Step 2: Criar componente ModalConfirmarRecusado**

Adicionar antes do `export default function KanbanFichas`:
```jsx
function ModalConfirmarRecusado({ fichaId, onConfirmar, salvando }) {
  const [retorno, setRetorno] = useState(null)
  const nome = fichaId // substituído no uso — ver passo 3

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-dark-surface border border-dark-border rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-5 space-y-4">
          <p className="font-semibold text-dark-text text-sm">Confirmar recusa</p>
          <p className="text-xs text-dark-muted">O retorno foi enviado ao cliente?</p>
          <div className="flex gap-3">
            <button
              onClick={() => setRetorno(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                retorno === true
                  ? 'bg-status-success/20 border-status-success text-status-success'
                  : 'border-dark-border text-dark-muted hover:border-dark-text'
              }`}
            >
              Sim
            </button>
            <button
              onClick={() => setRetorno(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                retorno === false
                  ? 'bg-status-danger/20 border-status-danger text-status-danger'
                  : 'border-dark-border text-dark-muted hover:border-dark-text'
              }`}
            >
              Não
            </button>
          </div>
        </div>
        <div className="flex justify-end px-6 pb-5">
          <button
            onClick={() => retorno !== null && onConfirmar(retorno)}
            disabled={retorno === null || salvando}
            className="btn-primary text-sm"
          >
            {salvando ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Interceptar drag para 'recusado' em handleDragEnd**

Em `handleDragEnd`, antes do `moverFichaStatus`, adicionar:
```jsx
// Intercepta arrastar para recusado
if (targetCol === 'recusado') {
  // Otimista: mover visualmente
  setFichas(prev => prev.map(f => f.id !== fichaId ? f : { ...f, status: 'recusado' }))
  setPendingRecusado({ fichaId, fichaOriginal: ficha })
  return
}
```

- [ ] **Step 4: Adicionar handler de confirmação do modal**

```jsx
const [salvandoRecusado, setSalvandoRecusado] = useState(false)

async function handleConfirmarRecusado(retornoEnviado) {
  if (!pendingRecusado) return
  setSalvandoRecusado(true)
  const err = await moverFichaStatus(pendingRecusado.fichaId, 'recusado', { userId: user?.id })
  if (!err) {
    // Salvar retorno_enviado
    await supabase.from('fichas').update({ retorno_enviado: retornoEnviado, finalizada_em: new Date().toISOString() }).eq('id', pendingRecusado.fichaId)
    toast({ type: 'success', title: 'Ficha recusada' })
  } else {
    // Rollback
    setFichas(prev => prev.map(f => f.id === pendingRecusado.fichaId ? pendingRecusado.fichaOriginal : f))
    toast({ type: 'error', title: 'Erro ao recusar ficha' })
  }
  setSalvandoRecusado(false)
  setPendingRecusado(null)
}
```

- [ ] **Step 5: Renderizar o modal no return**

No return do componente, após os outros modais:
```jsx
{pendingRecusado && (
  <ModalConfirmarRecusado
    fichaId={pendingRecusado.fichaId}
    onConfirmar={handleConfirmarRecusado}
    salvando={salvandoRecusado}
  />
)}
```

- [ ] **Step 6: Commit**
```bash
git add src/components/KanbanFichas.jsx
git commit -m "feat: modal obrigatório ao mover ficha para coluna Recusado"
```

---

### Task 8: A5 — Modal obrigatório ao arrastar para "Aprovado"

**Contexto:** Ao mover ficha para "Aprovado", abrir modal obrigatório com campos: Seguradora (select), Valor da parcela, Número do orçamento, Retorno enviado (Sim/Não). Todos obrigatórios.

**Files:**
- Modify: `src/components/KanbanFichas.jsx`
- Read: `src/components/SeguradoraSelect.jsx` (para usar o componente existente)

- [ ] **Step 1: Adicionar estado para modal de aprovado**

```jsx
const [pendingAprovado, setPendingAprovado] = useState(null)
const [salvandoAprovado, setSalvandoAprovado] = useState(false)
```

- [ ] **Step 2: Adicionar import SeguradoraSelect**

No topo de `KanbanFichas.jsx`, adicionar:
```jsx
import SeguradoraSelect from './SeguradoraSelect'
```

- [ ] **Step 3: Criar componente ModalAprovarFicha**

```jsx
function ModalAprovarFicha({ onConfirmar, onCancelar, salvando }) {
  const [seguradora,       setSeguradora]       = useState('')
  const [valorParcela,     setValorParcela]     = useState('')
  const [numeroOrcamento,  setNumeroOrcamento]  = useState('')
  const [retornoEnviado,   setRetornoEnviado]   = useState(null)

  const valido = seguradora && valorParcela && numeroOrcamento.trim() && retornoEnviado !== null

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-dark-surface border border-dark-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-dark-border">
          <p className="font-semibold text-dark-text">Confirmar Aprovação</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1">
              Seguradora <span className="text-status-danger">*</span>
            </label>
            <SeguradoraSelect value={seguradora} onChange={setSeguradora} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1">
                Valor da Parcela (R$) <span className="text-status-danger">*</span>
              </label>
              <input
                type="number" step="0.01" min="0"
                value={valorParcela} onChange={e => setValorParcela(e.target.value)}
                placeholder="0,00" className="input text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1">
                N° do Orçamento <span className="text-status-danger">*</span>
              </label>
              <input
                value={numeroOrcamento} onChange={e => setNumeroOrcamento(e.target.value)}
                placeholder="Ex: 12345" className="input text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
              Retorno enviado ao cliente? <span className="text-status-danger">*</span>
            </label>
            <div className="flex gap-3">
              {[{ v: true, l: 'Sim' }, { v: false, l: 'Não' }].map(({ v, l }) => (
                <button key={l} onClick={() => setRetornoEnviado(v)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                    retornoEnviado === v
                      ? v ? 'bg-status-success/20 border-status-success text-status-success'
                          : 'bg-status-danger/20 border-status-danger text-status-danger'
                      : 'border-dark-border text-dark-muted hover:border-dark-text'
                  }`}
                >{l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onCancelar} className="btn-secondary text-sm">Cancelar</button>
          <button
            onClick={() => valido && onConfirmar({ seguradora, valorParcela: parseFloat(valorParcela), numeroOrcamento: numeroOrcamento.trim(), retornoEnviado })}
            disabled={!valido || salvando}
            className="btn-primary text-sm"
          >
            {salvando ? 'Salvando...' : 'Confirmar Aprovação'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Interceptar drag para 'aprovado' em handleDragEnd**

```jsx
if (targetCol === 'aprovado') {
  setFichas(prev => prev.map(f => f.id !== fichaId ? f : { ...f, status: 'aprovado' }))
  setPendingAprovado({ fichaId, fichaOriginal: ficha })
  return
}
```

- [ ] **Step 5: Handler de confirmação de aprovado**

```jsx
async function handleConfirmarAprovado({ seguradora, valorParcela, numeroOrcamento, retornoEnviado }) {
  if (!pendingAprovado) return
  setSalvandoAprovado(true)
  const err = await moverFichaStatus(pendingAprovado.fichaId, 'aprovado', { userId: user?.id })
  if (!err) {
    await supabase.from('fichas').update({
      seguradora,
      valor_parcela:  valorParcela,
      numero_orcamento: numeroOrcamento,
      retorno_enviado: retornoEnviado,
      finalizada_em:  new Date().toISOString(),
    }).eq('id', pendingAprovado.fichaId)
    toast({ type: 'success', title: 'Ficha aprovada!' })
    load()
  } else {
    setFichas(prev => prev.map(f => f.id === pendingAprovado.fichaId ? pendingAprovado.fichaOriginal : f))
    toast({ type: 'error', title: 'Erro ao aprovar ficha' })
  }
  setSalvandoAprovado(false)
  setPendingAprovado(null)
}

function handleCancelarAprovado() {
  if (!pendingAprovado) return
  setFichas(prev => prev.map(f => f.id === pendingAprovado.fichaId ? pendingAprovado.fichaOriginal : f))
  setPendingAprovado(null)
}
```

- [ ] **Step 6: Renderizar modal no return**

```jsx
{pendingAprovado && (
  <ModalAprovarFicha
    onConfirmar={handleConfirmarAprovado}
    onCancelar={handleCancelarAprovado}
    salvando={salvandoAprovado}
  />
)}
```

- [ ] **Step 7: Commit**
```bash
git add src/components/KanbanFichas.jsx
git commit -m "feat: modal obrigatório com dados ao mover ficha para coluna Aprovado"
```

---

## FASE 4 — SQL Migrations (≈30 min, risco baixo)

> ⚠️ **Estas migrations precisam ser executadas manualmente no Supabase SQL Editor antes de continuar com as tasks que dependem delas.**

### Task 9: M1 — Verificar campo emissor (emitido_por) nas Apólices

**Contexto:** A tabela `apolices` já tem a coluna `emitido_por UUID REFERENCES profiles(id)` da migration original. Só precisamos garantir que ela está sendo preenchida ao criar e exibida na UI.

**Nenhuma migration nova necessária.** Ir direto para Task 12.

---

### Task 10: M3 — Migration: tabela de documentos

**Files:**
- Create: `supabase/10_documentos.sql`

- [ ] **Step 1: Criar arquivo de migration**

```sql
-- ============================================================
-- 10_documentos.sql
-- Executar no Supabase SQL Editor
-- ANTES: criar bucket "documentos" no Supabase Storage Dashboard
--   Settings → Storage → New bucket → nome: "documentos" → private
-- ============================================================

CREATE TABLE IF NOT EXISTS public.documentos (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nome_arquivo   TEXT NOT NULL,
  url            TEXT NOT NULL,
  tamanho_bytes  INTEGER,
  tipo_mime      TEXT,
  -- Vínculo flexível (ao menos um deve ser preenchido)
  ficha_id       UUID REFERENCES public.fichas(id)  ON DELETE CASCADE,
  apolice_id     UUID REFERENCES public.apolices(id) ON DELETE CASCADE,
  -- Chave do cliente para agrupar documentos por CPF/CNPJ
  cpf_cnpj       TEXT,
  enviado_por    UUID REFERENCES public.profiles(id),
  CONSTRAINT documentos_vinculo_check CHECK (ficha_id IS NOT NULL OR apolice_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_documentos_ficha   ON public.documentos(ficha_id);
CREATE INDEX IF NOT EXISTS idx_documentos_apolice ON public.documentos(apolice_id);
CREATE INDEX IF NOT EXISTS idx_documentos_cpfcnpj ON public.documentos(cpf_cnpj);

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentos_all_authenticated"
  ON public.documentos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Executar no Supabase SQL Editor**

Abrir Supabase Dashboard → SQL Editor → colar o conteúdo acima → Run.

- [ ] **Step 3: Criar bucket no Supabase Storage**

No Supabase Dashboard → Storage → New bucket → nome: `documentos` → private: SIM.

- [ ] **Step 4: Commit**
```bash
git add supabase/10_documentos.sql
git commit -m "feat(sql): tabela documentos para anexos PDF por cliente"
```

---

### Task 11: M4 — Migration: tabela de códigos por imobiliária/seguradora

**Files:**
- Create: `supabase/11_imob_codigos.sql`

- [ ] **Step 1: Criar arquivo de migration**

```sql
-- ============================================================
-- 11_imob_codigos.sql
-- Executar no Supabase SQL Editor
-- ============================================================

-- Códigos de imobiliária por seguradora
CREATE TABLE IF NOT EXISTS public.imobiliaria_codigos (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imobiliaria_id UUID NOT NULL REFERENCES public.imobiliarias(id) ON DELETE CASCADE,
  seguradora_id  UUID NOT NULL REFERENCES public.seguradoras(id)  ON DELETE CASCADE,
  codigo         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (imobiliaria_id, seguradora_id)
);

CREATE INDEX IF NOT EXISTS idx_imobcod_imob ON public.imobiliaria_codigos(imobiliaria_id);
CREATE INDEX IF NOT EXISTS idx_imobcod_seg  ON public.imobiliaria_codigos(seguradora_id);

ALTER TABLE public.imobiliaria_codigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imobiliaria_codigos_all_authenticated"
  ON public.imobiliaria_codigos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Executar no Supabase SQL Editor**

- [ ] **Step 3: Commit**
```bash
git add supabase/11_imob_codigos.sql
git commit -m "feat(sql): tabela imobiliaria_codigos para código por seguradora"
```

---

## FASE 5 — Novas Features (≈3-4h, risco médio)

### Task 12: M1 — Emissor nas Apólices (UI)

**Contexto:** A coluna `emitido_por` já existe na tabela. Precisamos: (1) preenchê-la ao criar via `ModalIniciarEmissao`, (2) incluí-la nas queries de fetch, (3) exibir na listagem e no detalhe.

**Files:**
- Modify: `src/pages/ApoicesGestao.jsx` (ModalIniciarEmissao — passar emitido_por)
- Modify: `src/lib/apolices.js` (fetchApolicesKanban — incluir profiles!emitido_por)
- Modify: `src/pages/ApolicesLista.jsx` (exibir emissor)
- Modify: `src/pages/ApoliceDetalhe.jsx` (exibir emissor)

- [ ] **Step 1: Passar emitido_por ao criar apólice**

Em `ApoicesGestao.jsx`, dentro de `ModalIniciarEmissao`:
```jsx
// Importar useAuth no componente
const { user } = useAuth()
// ...na chamada criarApolice, adicionar:
emitido_por: user?.id || null,
```

- [ ] **Step 2: Incluir emissor no select de fetchApolicesKanban**

Em `apolices.js`, atualizar o select:
```javascript
.select(`
  id, status_emissao, created_at, data_transmissao,
  imobiliaria, numero_apolice, seguradora, valor_parcela,
  proprietario_nome, inicio_vigencia, fim_vigencia, produto,
  nome_interessado, emitido_por,
  fichas!ficha_id(nome_interessado, nome_empresa, cpf, cnpj, produto),
  profiles!emitido_por(nome)
`)
```

- [ ] **Step 3: Exibir emissor no ApoliceCard em ApoicesGestao.jsx**

No `ApoliceCard`, após o bloco do `dataTransm`, adicionar:
```jsx
{apolice.profiles?.nome && (
  <p className="text-[9px] text-dark-muted truncate">
    Emissor: {apolice.profiles.nome.split(' ')[0]}
  </p>
)}
```

- [ ] **Step 4: Exibir emissor na listagem e no detalhe**

Em `ApolicesLista.jsx` e `ApoliceDetalhe.jsx`, incluir `profiles!emitido_por(nome)` no select e exibir o nome do emissor.

- [ ] **Step 5: Commit**
```bash
git add src/pages/ApoicesGestao.jsx src/lib/apolices.js src/pages/ApolicesLista.jsx src/pages/ApoliceDetalhe.jsx
git commit -m "feat: campo emissor (emitido_por) nas apólices — preenchido automaticamente e exibido na UI"
```

---

### Task 13: M2 — Card de emissões com dados completos da ficha

**Contexto:** O card de apólice no kanban mostra informações básicas. O usuário quer ver também telefone do locatário e outros dados da ficha. Adicionar section colapsável.

**Files:**
- Modify: `src/lib/apolices.js` (incluir celular na query)
- Modify: `src/pages/ApoicesGestao.jsx` (ApoliceCard — seção expansível)

- [ ] **Step 1: Incluir celular no select de fetchApolicesKanban**

```javascript
fichas!ficha_id(nome_interessado, nome_empresa, cpf, cnpj, produto, celular, cep, tipo_imovel)
```

- [ ] **Step 2: Adicionar estado de expansão e seção no ApoliceCard**

```jsx
function ApoliceCard({ apolice, isDragOverlay = false, resolverNome }) {
  const [expandido, setExpandido] = useState(false)
  // ... código existente ...

  // Dentro do card, após o bloco principal, adicionar:
  {!isDragOverlay && (
    <button
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); setExpandido(v => !v) }}
      className="w-full text-[9px] text-dark-muted hover:text-dark-text transition-colors pt-1 border-t border-dark-border/50 flex items-center justify-center gap-1"
    >
      {expandido ? '▲ Ocultar' : '▼ Ver detalhes'}
    </button>
  )}
  {expandido && !isDragOverlay && (
    <div className="space-y-0.5 pt-1">
      {apolice.fichas?.celular && (
        <p className="text-[9px] text-dark-muted">Tel: {apolice.fichas.celular}</p>
      )}
      {apolice.fichas?.tipo_imovel && (
        <p className="text-[9px] text-dark-muted">Imóvel: {apolice.fichas.tipo_imovel}</p>
      )}
      {apolice.fichas?.cep && (
        <p className="text-[9px] text-dark-muted font-mono">CEP: {apolice.fichas.cep}</p>
      )}
      {apolice.valor_parcela && (
        <p className="text-[9px] text-dark-muted">Parcela: R$ {parseFloat(apolice.valor_parcela).toFixed(2)}</p>
      )}
    </div>
  )}
}
```

- [ ] **Step 3: Commit**
```bash
git add src/lib/apolices.js src/pages/ApoicesGestao.jsx
git commit -m "feat: card de emissão expansível com dados completos da ficha (telefone, CEP, tipo imóvel)"
```

---

### Task 14: M4 — Código Imob nas Imobiliárias

**Contexto:** Adicionar seção em `ImobiliariaDetalhe.jsx` (ou modal em `Imobiliarias.jsx`) para cadastrar código da imobiliária por seguradora. Exibir na listagem.

**Files:**
- Modify: `src/pages/ImobiliariaDetalhe.jsx` (seção de códigos)
- Create: `src/lib/imobiliariasCodigos.js` (helpers de CRUD)

- [ ] **Step 1: Criar lib de código imob**

Criar `src/lib/imobiliariasCodigos.js`:
```javascript
import { supabase } from './supabase'

export async function fetchCodigos(imobiliariaId) {
  const { data } = await supabase
    .from('imobiliaria_codigos')
    .select('id, codigo, seguradora_id, seguradoras!seguradora_id(nome_canonico)')
    .eq('imobiliaria_id', imobiliariaId)
    .order('created_at')
  return data || []
}

export async function fetchSeguradoras() {
  const { data } = await supabase.from('seguradoras').select('id, nome_canonico').eq('ativa', true).order('nome_canonico')
  return data || []
}

export async function upsertCodigo(imobiliariaId, seguradoraId, codigo) {
  const { error } = await supabase.from('imobiliaria_codigos')
    .upsert({ imobiliaria_id: imobiliariaId, seguradora_id: seguradoraId, codigo }, { onConflict: 'imobiliaria_id,seguradora_id' })
  return error
}

export async function deletarCodigo(id) {
  const { error } = await supabase.from('imobiliaria_codigos').delete().eq('id', id)
  return error
}
```

- [ ] **Step 2: Adicionar seção de códigos em ImobiliariaDetalhe.jsx**

```jsx
import { fetchCodigos, fetchSeguradoras, upsertCodigo, deletarCodigo } from '../lib/imobiliariasCodigos'

// Estado:
const [codigos,     setCodigos]     = useState([])
const [seguradoras, setSeguradoras] = useState([])
const [novoCodigo,  setNovoCodigo]  = useState({ seguradora_id: '', codigo: '' })
const [salvandoCod, setSalvandoCod] = useState(false)

// useEffect junto com a carga da imobiliária:
fetchCodigos(imobiliariaId).then(setCodigos)
fetchSeguradoras().then(setSeguradoras)

// JSX da seção:
<div className="card p-5 space-y-4">
  <p className="text-sm font-semibold text-dark-text">Código por Seguradora</p>
  <div className="space-y-2">
    {codigos.map(c => (
      <div key={c.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-dark-border/50">
        <span className="text-xs text-dark-text">{c.seguradoras?.nome_canonico}</span>
        <span className="text-xs font-mono text-dark-muted">{c.codigo}</span>
        <button onClick={async () => { await deletarCodigo(c.id); setCodigos(prev => prev.filter(x => x.id !== c.id)) }}
          className="text-status-danger hover:opacity-80 text-xs">
          Remover
        </button>
      </div>
    ))}
  </div>
  <div className="flex gap-2">
    <select value={novoCodigo.seguradora_id} onChange={e => setNovoCodigo(p => ({ ...p, seguradora_id: e.target.value }))}
      className="select text-sm flex-1">
      <option value="">Seguradora...</option>
      {seguradoras.map(s => <option key={s.id} value={s.id}>{s.nome_canonico}</option>)}
    </select>
    <input value={novoCodigo.codigo} onChange={e => setNovoCodigo(p => ({ ...p, codigo: e.target.value }))}
      placeholder="Código" className="input text-sm w-32" />
    <button
      onClick={async () => {
        if (!novoCodigo.seguradora_id || !novoCodigo.codigo.trim()) return
        setSalvandoCod(true)
        await upsertCodigo(imobiliariaId, novoCodigo.seguradora_id, novoCodigo.codigo.trim())
        await fetchCodigos(imobiliariaId).then(setCodigos)
        setNovoCodigo({ seguradora_id: '', codigo: '' })
        setSalvandoCod(false)
      }}
      disabled={!novoCodigo.seguradora_id || !novoCodigo.codigo.trim() || salvandoCod}
      className="btn-primary text-sm px-3"
    >
      {salvandoCod ? '...' : 'Adicionar'}
    </button>
  </div>
</div>
```

- [ ] **Step 3: Commit**
```bash
git add src/lib/imobiliariasCodigos.js src/pages/ImobiliariaDetalhe.jsx
git commit -m "feat: cadastro de código imob por seguradora em ImobiliariaDetalhe"
```

---

### Task 15: M3 — Anexo de Documentos PDF

> ⚠️ **Pré-requisito:** Migration `supabase/10_documentos.sql` executada E bucket `documentos` criado no Supabase Storage.

**Files:**
- Create: `src/lib/documentos.js`
- Create: `src/components/SecaoDocumentos.jsx`
- Modify: `src/pages/FichaDetalhePage.jsx` (adicionar seção)
- Modify: `src/pages/ApoliceDetalhe.jsx` (adicionar seção)

- [ ] **Step 1: Criar lib de documentos**

Criar `src/lib/documentos.js`:
```javascript
import { supabase } from './supabase'

export async function fetchDocumentos({ fichaId, apoliceId, cpfCnpj }) {
  let q = supabase.from('documentos')
    .select('id, created_at, nome_arquivo, url, tamanho_bytes, tipo_mime, enviado_por, profiles!enviado_por(nome)')
    .order('created_at', { ascending: false })
  if (fichaId)  q = q.eq('ficha_id', fichaId)
  if (apoliceId) q = q.eq('apolice_id', apoliceId)
  const { data } = await q
  return data || []
}

export async function uploadDocumento({ file, fichaId, apoliceId, cpfCnpj, userId }) {
  const ext       = file.name.split('.').pop()
  const nomeUnico = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const pasta     = fichaId ? `fichas/${fichaId}` : `apolices/${apoliceId}`
  const caminho   = `${pasta}/${nomeUnico}`

  const { error: uploadErr } = await supabase.storage.from('documentos').upload(caminho, file)
  if (uploadErr) return { error: uploadErr }

  const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(caminho)

  const { error: dbErr } = await supabase.from('documentos').insert({
    nome_arquivo:  file.name,
    url:           publicUrl,
    tamanho_bytes: file.size,
    tipo_mime:     file.type,
    ficha_id:      fichaId   || null,
    apolice_id:    apoliceId || null,
    cpf_cnpj:      cpfCnpj  || null,
    enviado_por:   userId,
  })
  return { error: dbErr }
}

export async function deletarDocumento(id, url) {
  // Extrair caminho do bucket a partir da URL
  const match = url.match(/\/documentos\/(.+)$/)
  if (match) {
    await supabase.storage.from('documentos').remove([match[1]])
  }
  const { error } = await supabase.from('documentos').delete().eq('id', id)
  return error
}
```

- [ ] **Step 2: Criar componente SecaoDocumentos**

Criar `src/components/SecaoDocumentos.jsx`:
```jsx
import { useState, useEffect, useRef } from 'react'
import { fetchDocumentos, uploadDocumento, deletarDocumento } from '../lib/documentos'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Paperclip, Trash2, ExternalLink, Upload } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function SecaoDocumentos({ fichaId, apoliceId, cpfCnpj }) {
  const { user }    = useAuth()
  const toast       = useToast()
  const inputRef    = useRef(null)
  const [docs,      setDocs]      = useState([])
  const [loading,   setLoading]   = useState(false)
  const [uploading, setUploading] = useState(false)

  async function carregar() {
    setLoading(true)
    const data = await fetchDocumentos({ fichaId, apoliceId })
    setDocs(data)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [fichaId, apoliceId])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast({ type: 'error', title: 'Apenas arquivos PDF são aceitos' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ type: 'error', title: 'Arquivo muito grande (máx. 10MB)' })
      return
    }
    setUploading(true)
    const { error } = await uploadDocumento({ file, fichaId, apoliceId, cpfCnpj, userId: user?.id })
    setUploading(false)
    if (error) { toast({ type: 'error', title: 'Erro ao enviar documento' }); return }
    toast({ type: 'success', title: 'Documento enviado!' })
    carregar()
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleDeletar(doc) {
    if (!confirm(`Excluir "${doc.nome_arquivo}"?`)) return
    const error = await deletarDocumento(doc.id, doc.url)
    if (error) { toast({ type: 'error', title: 'Erro ao excluir' }); return }
    toast({ type: 'success', title: 'Documento excluído' })
    carregar()
  }

  function formatBytes(b) {
    if (!b) return ''
    if (b < 1024) return `${b}B`
    if (b < 1024 * 1024) return `${(b/1024).toFixed(1)}KB`
    return `${(b/(1024*1024)).toFixed(1)}MB`
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-brand-accent" />
          <p className="text-sm font-semibold text-dark-text">Documentos</p>
          <span className="text-[10px] font-mono text-dark-muted">({docs.length})</span>
        </div>
        <label className="btn-secondary text-xs cursor-pointer flex items-center gap-1.5 px-3 py-1.5">
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Enviando...' : 'Enviar PDF'}
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {loading ? (
        <p className="text-xs text-dark-muted">Carregando...</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-dark-muted/50 text-center py-4">Nenhum documento anexado</p>
      ) : (
        <div className="space-y-2">
          {docs.map(d => (
            <div key={d.id} className="flex items-center gap-3 py-2 border-b border-dark-border/50 last:border-0">
              <div className="w-7 h-7 rounded-md bg-status-danger/10 flex items-center justify-center flex-shrink-0">
                <Paperclip className="w-3.5 h-3.5 text-status-danger" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-dark-text truncate">{d.nome_arquivo}</p>
                <p className="text-[10px] text-dark-muted">
                  {formatBytes(d.tamanho_bytes)}
                  {d.profiles?.nome && ` · ${d.profiles.nome.split(' ')[0]}`}
                  {' · '}{format(parseISO(d.created_at), "dd/MM/yy", { locale: ptBR })}
                </p>
              </div>
              <a href={d.url} target="_blank" rel="noreferrer" className="text-dark-muted hover:text-brand-accent transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button onClick={() => handleDeletar(d)} className="text-dark-muted hover:text-status-danger transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Adicionar SecaoDocumentos em FichaDetalhePage.jsx**

```jsx
import SecaoDocumentos from '../components/SecaoDocumentos'

// No JSX, após a seção de dados da ficha:
<SecaoDocumentos fichaId={ficha.id} cpfCnpj={ficha.cpf || ficha.cnpj} />
```

- [ ] **Step 4: Adicionar SecaoDocumentos em ApoliceDetalhe.jsx**

```jsx
import SecaoDocumentos from '../components/SecaoDocumentos'

// No JSX:
<SecaoDocumentos apoliceId={apolice.id} cpfCnpj={apolice.fichas?.cpf || apolice.fichas?.cnpj} />
```

- [ ] **Step 5: Commit**
```bash
git add src/lib/documentos.js src/components/SecaoDocumentos.jsx src/pages/FichaDetalhePage.jsx src/pages/ApoliceDetalhe.jsx
git commit -m "feat: anexo de documentos PDF em fichas e apólices (M3)"
```

---

## FASE 6 — Bug A8: Métricas Apólices por Seguradora (≈45 min)

### Task 16: A8 — Investigar e corrigir métricas por seguradora

**Contexto:** Em `ApolicesDashboard.jsx`, o gráfico/tabela de apólices por seguradora está com valores errados. A função `fetchPorSeguradora` agrupa por `apolice.seguradora`. Possíveis causas: (1) valores nulos tratados como "Outras", (2) filtro de data errado, (3) seguradora vazia string `''` não agrupada com nula.

**Files:**
- Modify: `src/lib/apolices.js` (função `fetchPorSeguradora`)
- Modify: `src/pages/ApolicesDashboard.jsx` (verificar filtro passado)

- [ ] **Step 1: Inspecionar a função fetchPorSeguradora**

Ler o código atual em `src/lib/apolices.js`, linha ~95:
```javascript
export async function fetchPorSeguradora(inicioMes, fimMes) {
  let q = supabase.from('apolices').select('seguradora')
  if (inicioMes) q = q.gte('data_emissao', inicioMes)
  if (fimMes)    q = q.lte('data_emissao', fimMes)
  const { data } = await q
  if (!data) return []
  const cnt = {}
  data.forEach(a => { const s = a.seguradora || 'Outras'; cnt[s] = (cnt[s] || 0) + 1 })
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([seguradora, value]) => ({ seguradora, value }))
}
```

**Problemas identificados:**
- `data_emissao` pode ser null (apólices criadas via kanban sem data_emissao). Elas não aparecem no filtro por data mas aparecem no total — inconsistência.
- `seguradora || 'Outras'` agrupa null E string vazia como "Outras" — pode mascarar dados reais.
- O filtro de `data_emissao` vs `created_at` é inconsistente com as outras queries.

- [ ] **Step 2: Corrigir fetchPorSeguradora**

```javascript
export async function fetchPorSeguradora(inicioMes, fimMes) {
  let q = supabase.from('apolices').select('seguradora')
    .not('seguradora', 'is', null)
    .neq('seguradora', '')
  if (inicioMes) q = q.gte('created_at', inicioMes)
  if (fimMes)    q = q.lte('created_at', fimMes)
  const { data } = await q
  if (!data) return []
  const cnt = {}
  data.forEach(a => { cnt[a.seguradora] = (cnt[a.seguradora] || 0) + 1 })
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([seguradora, value]) => ({ seguradora, value }))
}
```

- [ ] **Step 3: Verificar getRangeSeguradora em ApolicesDashboard.jsx**

Ler o código em `ApolicesDashboard.jsx` — verificar o método `getRangeSeguradora` e garantir que o filtro de data usa datas ISO strings corretas (não Date objects).

- [ ] **Step 4: Commit**
```bash
git add src/lib/apolices.js src/pages/ApolicesDashboard.jsx
git commit -m "fix: corrigir agrupamento por seguradora — excluir nulos/vazios, usar created_at"
```

---

## FASE 7 — Design: Solid Glass Effect (≈3-4h, risco médio)

### Task 17: BLOCO 3 — Solid Glass Effect global

**Contexto:** O sistema já tem um design dark/light com CSS variables bem definidos. Já existe uma classe `.glass` parcial. Precisamos expandir para um sistema completo de glass morphism no estilo macOS Ventura.

**Estratégia:**
- Manter `.card` e `.glass` existentes mas enriquecê-los
- Adicionar `.glass-card`, `.glass-panel`, `.glass-modal` como novas classes
- Adicionar novas CSS variables: `--glass-bg`, `--glass-border`, `--glass-shadow`, `--glass-blur`
- Atualizar fundo do sistema para gradiente profundo
- Atualizar sidebar/layout com glass pesado
- Gradiente interno nos botões primários
- Não quebrar nenhuma funcionalidade

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/Layout.jsx`

- [ ] **Step 1: Adicionar CSS variables para glass**

Em `src/index.css`, dentro de `:root` (tema light), adicionar:
```css
/* Glass */
--glass-bg:        rgba(255,255,255,0.72);
--glass-bg-heavy:  rgba(255,255,255,0.88);
--glass-border:    rgba(255,255,255,0.55);
--glass-shadow:    0 8px 32px rgba(26,58,107,0.10), 0 1px 3px rgba(26,58,107,0.06);
--glass-blur:      blur(18px);
--gradient-bg:     linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 50%, #f5f0ff 100%);
```

Dentro de `html.dark`, adicionar:
```css
/* Glass dark */
--glass-bg:        rgba(17,24,39,0.72);
--glass-bg-heavy:  rgba(17,24,39,0.88);
--glass-border:    rgba(255,255,255,0.09);
--glass-shadow:    0 8px 32px rgba(0,0,0,0.40), 0 1px 3px rgba(0,0,0,0.20);
--glass-blur:      blur(18px);
--gradient-bg:     linear-gradient(135deg, #0a0f1e 0%, #0d1729 50%, #100a1e 100%);
```

- [ ] **Step 2: Adicionar gradiente de fundo ao body**

```css
body {
  background: var(--gradient-bg);
  background-attachment: fixed;
  /* manter os estilos existentes */
}
```

- [ ] **Step 3: Criar classes .glass-card, .glass-panel, .glass-modal**

Em `@layer components`, adicionar:
```css
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  box-shadow: var(--glass-shadow);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.glass-card:hover {
  box-shadow: var(--glass-shadow), 0 0 0 1px rgba(74,144,217,0.15);
}
.glass-panel {
  background: var(--glass-bg-heavy);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  box-shadow: var(--glass-shadow);
}
.glass-modal {
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  box-shadow: 0 16px 64px rgba(0,0,0,0.35);
}
```

- [ ] **Step 4: Atualizar .card com glass effect**

```css
.card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  box-shadow: var(--glass-shadow);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.card:hover {
  box-shadow: var(--glass-shadow), 0 0 0 1px rgba(74,144,217,0.12);
}
```

- [ ] **Step 5: Atualizar .kanban-card com glass**

```css
.kanban-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  /* manter demais estilos existentes */
}
```

- [ ] **Step 6: Atualizar .btn-primary com gradiente interno**

```css
.btn-primary {
  background: linear-gradient(135deg, #2B5BA8 0%, #1A3A6B 100%);
  box-shadow: 0 2px 8px rgba(43,91,168,0.35), inset 0 1px 0 rgba(255,255,255,0.12);
  /* manter demais estilos */
}
.btn-primary:hover {
  background: linear-gradient(135deg, #3A6BC0 0%, #2B5BA8 100%);
  box-shadow: 0 4px 12px rgba(43,91,168,0.45), inset 0 1px 0 rgba(255,255,255,0.15);
}
```

- [ ] **Step 7: Atualizar Layout.jsx com glass na sidebar**

Em `src/components/Layout.jsx`, localizar o elemento da sidebar/nav e adicionar:
- Classe `glass-panel` ou estilo inline com `background: var(--glass-bg-heavy); backdrop-filter: var(--glass-blur);`
- Separadores mais sutis com `rgba(255,255,255,0.08)`

- [ ] **Step 8: Atualizar modais com glass-modal**

Nos modais existentes (`ModalFicha`, `ModalFinalizar`, `ModalAssumir`, etc.), substituir a classe `bg-dark-surface border border-dark-border` no elemento raiz do modal por `glass-modal`.

- [ ] **Step 9: Build e verificação visual**

```bash
npm run build
```
Verificar: sem erros. Checar visualmente que o sistema ainda funciona e o glass está legível.

- [ ] **Step 10: Commit**
```bash
git add src/index.css src/components/Layout.jsx
git commit -m "feat: Solid Glass Effect — glass morphism macOS-style global (cards, sidebar, modais, botões)"
```

---

## Ordem de Execução Recomendada

```
FASE 1 (30min)  → Task 1 (A9), Task 2 (A7)
FASE 2 (2h)     → Task 3 (A1), Task 4 (A2), Task 5 (A6)
FASE 3 (2-3h)   → Task 6 (A3), Task 7 (A4), Task 8 (A5)
FASE 4 (30min)  → Task 10 (M3-SQL), Task 11 (M4-SQL) — executar no Supabase
FASE 5 (3-4h)   → Task 12 (M1), Task 13 (M2), Task 14 (M4), Task 15 (M3)
FASE 6 (45min)  → Task 16 (A8)
FASE 7 (3-4h)   → Task 17 (BLOCO 3)
```

## Risco por Item

| Item | Risco | Motivo |
|------|-------|--------|
| A9   | Baixo | Mudança de texto |
| A7   | Baixo | Adicionar fetch antes de abrir modal |
| A1, A2, A6 | Baixo | Adicionar parâmetros opcionais a funções existentes |
| A3   | Baixo | Ordenação após agrupamento |
| A4, A5 | Médio | Interceptar drag end — testar rollback |
| A8   | Médio | Mudança de comportamento de query existente |
| M1   | Baixo | Campo já existe, só wiring de UI |
| M2   | Baixo | Expansão de card existente |
| M3   | Médio | Nova infra (storage bucket obrigatório) |
| M4   | Baixo | Nova tabela + UI nova |
| BLOCO 3 | Médio | CSS global — risco de regressão visual |

## Rollback

- Cada task tem seu próprio commit → `git revert <hash>` reverte qualquer task individualmente
- BLOCO 3 é o mais arriscado: se o glass quebrar legibilidade, reverta apenas `src/index.css`
- Tasks com SQL (M3, M4) não têm rollback automático — para reverter: `DROP TABLE IF EXISTS documentos CASCADE;` e `DROP TABLE IF EXISTS imobiliaria_codigos CASCADE;`
- Bucket Supabase Storage não tem rollback via código — deletar manualmente no dashboard

## Pontos de Atenção

1. **M3 Storage:** O bucket `documentos` deve ser `private` + políticas RLS aplicadas. URLs públicas via `getPublicUrl` só funcionam se o bucket for público — se for privado, usar `createSignedUrl` com TTL.
2. **A4/A5 Rollback de drag:** O otimismo visual (mover o card) deve ser revertido se o usuário cancelar o modal. O código nos tasks já inclui isso.
3. **BLOCO 3 e legibilidade:** No tema light, `--glass-bg: rgba(255,255,255,0.72)` pode fazer texto com `rgba` ser difícil de ler sobre fundos coloridos — ajustar opacity se necessário.
4. **M1 emitido_por:** A relação `profiles!emitido_por` só funciona se a foreign key tiver nome diferente de `emitido_por` na tabela. Verificar o nome exato da constraint FK — pode precisar de alias na query: `profiles!apolices_emitido_por_fkey(nome)`.
