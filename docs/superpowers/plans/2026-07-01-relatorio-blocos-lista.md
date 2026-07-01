# Relatório por Imobiliária: Kanban → Blocos de Lista — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o kanban drag-and-drop da tela de relatório por imobiliária (`/relatorio/:imobiliariaId`) por 5 blocos de lista empilhados, com toggles de "cobrança enviada" e "imobiliária retornou", e fotos de orçamentista/emissor em cada linha.

**Architecture:** Extrair a lógica de patch/estado (hoje misturada no componente) para um módulo puro testável `src/lib/relatorioCobranca.js`. Reescrever a branch `isDetail` de `src/pages/Relatorio.jsx`: trocar as queries Supabase para trazer os avatares (join `profiles`), trocar os componentes de card/coluna kanban por componentes de lista (`BlocoRelatorio` / `LinhaRelatorio`), e remover todo o uso de `@dnd-kit` desse arquivo.

**Tech Stack:** React 18 (JSX, sem TypeScript), Supabase JS client, Node `--test` para os testes de lógica pura (não há Vitest/RTL neste projeto — ver `package.json`).

## Global Constraints

- Design aprovado em `docs/superpowers/specs/2026-07-01-relatorio-blocos-lista-design.md` — qualquer dúvida de comportamento, essa é a fonte da verdade.
- Escopo é só `src/pages/Relatorio.jsx`, branch `isDetail` (visão por imobiliária). A visão geral (lista de imobiliárias, `isDetail === false`) não muda.
- `src/lib/kanbanDnd.js` continua existindo — é usado por `KanbanFichas.jsx`, `KanbanBoard.jsx`, `ApoicesGestao.jsx`, `comercial/Pipeline.jsx`. Não mexer nesse arquivo.
- Sem novas dependências. `Avatar` já existe em `src/components/ui` (`import { Avatar } from '../components/ui'`).
- Não há testes automatizados de componentes React neste repo (sem RTL/Vitest). Só a lógica pura ganha teste (`node --test`, mesmo padrão de `src/lib/financeiroProducaoCalc.test.mjs`). Verificação da UI é manual (build + smoke test no navegador).
- Rodar `npm run build` ao final — precisa terminar verde.

---

### Task 1: Módulo de lógica pura `relatorioCobranca.js`

**Files:**
- Create: `src/lib/relatorioCobranca.js`
- Create: `src/lib/relatorioCobranca.test.mjs`
- Modify: `package.json:11` (adicionar o novo arquivo de teste ao script `test`)

**Interfaces:**
- Produces (usado pelas Tasks 3 e 5):
  - `buildAprovadaPatch(ficha) -> { status, retorno_enviado, raw_data }`
  - `buildCobrancaPatch(ficha, sentAt = new Date().toISOString()) -> { status, retorno_enviado, raw_data }`
  - `buildImobiliariaRetornoPatch(ficha, retornou, at = new Date().toISOString()) -> { raw_data }`
  - `buildCobrancaHistoricoPatch(ficha, enviada, at = new Date().toISOString()) -> { raw_data }`
  - `isCobrancaEnviadaVisivel(colunaId) -> boolean`
  - `getCobrancaEnviadaDisplay(ficha, colunaId) -> boolean`
  - `getImobiliariaRetornouDisplay(ficha) -> boolean`

- [ ] **Step 1: Escrever o arquivo de teste (vai falhar — o módulo ainda não existe)**

Criar `src/lib/relatorioCobranca.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAprovadaPatch,
  buildCobrancaPatch,
  buildImobiliariaRetornoPatch,
  buildCobrancaHistoricoPatch,
  isCobrancaEnviadaVisivel,
  getCobrancaEnviadaDisplay,
  getImobiliariaRetornouDisplay,
} from './relatorioCobranca.js'

test('buildAprovadaPatch limpa marcas de cobrança e recuperação', () => {
  const ficha = { raw_data: { cobranca_started_at: '2026-01-01', recovered_after_cobranca: true, foo: 'bar' } }
  const patch = buildAprovadaPatch(ficha)
  assert.equal(patch.status, 'aprovado')
  assert.equal(patch.retorno_enviado, false)
  assert.equal(patch.raw_data.recovered_after_cobranca, false)
  assert.equal(patch.raw_data.recovered_after_cobranca_em, null)
  assert.equal(patch.raw_data.retorno_enviado_em, null)
  assert.equal(patch.raw_data.cobranca_started_at, null)
  assert.equal(patch.raw_data.foo, 'bar')
})

test('buildCobrancaPatch marca envio com o timestamp informado', () => {
  const ficha = { raw_data: { foo: 'bar' } }
  const patch = buildCobrancaPatch(ficha, '2026-07-01T10:00:00.000Z')
  assert.equal(patch.status, 'aprovado')
  assert.equal(patch.retorno_enviado, true)
  assert.equal(patch.raw_data.retorno_enviado_em, '2026-07-01T10:00:00.000Z')
  assert.equal(patch.raw_data.cobranca_started_at, '2026-07-01T10:00:00.000Z')
  assert.equal(patch.raw_data.foo, 'bar')
})

test('buildImobiliariaRetornoPatch grava e limpa o retorno', () => {
  const ficha = { raw_data: {} }
  const ligado = buildImobiliariaRetornoPatch(ficha, true, '2026-07-01T12:00:00.000Z')
  assert.equal(ligado.raw_data.imobiliaria_retornou, true)
  assert.equal(ligado.raw_data.imobiliaria_retornou_em, '2026-07-01T12:00:00.000Z')

  const desligado = buildImobiliariaRetornoPatch(ficha, false)
  assert.equal(desligado.raw_data.imobiliaria_retornou, false)
  assert.equal(desligado.raw_data.imobiliaria_retornou_em, null)
})

test('buildCobrancaHistoricoPatch não mexe em retorno_enviado nem status', () => {
  const ficha = { raw_data: {} }
  const patch = buildCobrancaHistoricoPatch(ficha, true, '2026-07-01T09:00:00.000Z')
  assert.equal(patch.status, undefined)
  assert.equal(patch.retorno_enviado, undefined)
  assert.equal(patch.raw_data.cobranca_started_at, '2026-07-01T09:00:00.000Z')
  assert.equal(patch.raw_data.retorno_enviado_em, '2026-07-01T09:00:00.000Z')

  const off = buildCobrancaHistoricoPatch(ficha, false)
  assert.equal(off.raw_data.cobranca_started_at, null)
  assert.equal(off.raw_data.retorno_enviado_em, null)
})

test('isCobrancaEnviadaVisivel só é true para enviado_cobranca e recuperados', () => {
  assert.equal(isCobrancaEnviadaVisivel('enviado_cobranca'), true)
  assert.equal(isCobrancaEnviadaVisivel('recuperados'), true)
  assert.equal(isCobrancaEnviadaVisivel('aprovada'), false)
  assert.equal(isCobrancaEnviadaVisivel('emitida'), false)
  assert.equal(isCobrancaEnviadaVisivel('expirada'), false)
})

test('getCobrancaEnviadaDisplay usa retorno_enviado em Enviado Cobrança e histórico em Recuperados', () => {
  const emCobranca = { retorno_enviado: true, raw_data: {} }
  assert.equal(getCobrancaEnviadaDisplay(emCobranca, 'enviado_cobranca'), true)

  const recuperada = { retorno_enviado: false, raw_data: { cobranca_started_at: '2026-01-01' } }
  assert.equal(getCobrancaEnviadaDisplay(recuperada, 'recuperados'), true)

  const recuperadaSemHistorico = { retorno_enviado: false, raw_data: {} }
  assert.equal(getCobrancaEnviadaDisplay(recuperadaSemHistorico, 'recuperados'), false)
})

test('getImobiliariaRetornouDisplay reflete raw_data.imobiliaria_retornou', () => {
  assert.equal(getImobiliariaRetornouDisplay({ raw_data: { imobiliaria_retornou: true } }), true)
  assert.equal(getImobiliariaRetornouDisplay({ raw_data: {} }), false)
  assert.equal(getImobiliariaRetornouDisplay({}), false)
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha por módulo inexistente**

Run: `node --test src/lib/relatorioCobranca.test.mjs`
Expected: FAIL — `Cannot find module './relatorioCobranca.js'`

- [ ] **Step 3: Criar o módulo `src/lib/relatorioCobranca.js`**

```js
export function buildAprovadaPatch(ficha) {
  return {
    status: 'aprovado',
    retorno_enviado: false,
    raw_data: {
      ...(ficha?.raw_data || {}),
      recovered_after_cobranca: false,
      recovered_after_cobranca_em: null,
      retorno_enviado_em: null,
      cobranca_started_at: null,
    },
  }
}

export function buildCobrancaPatch(ficha, sentAt = new Date().toISOString()) {
  return {
    status: 'aprovado',
    retorno_enviado: true,
    raw_data: {
      ...(ficha?.raw_data || {}),
      recovered_after_cobranca: false,
      recovered_after_cobranca_em: null,
      retorno_enviado_em: sentAt,
      cobranca_started_at: sentAt,
    },
  }
}

export function buildImobiliariaRetornoPatch(ficha, retornou, at = new Date().toISOString()) {
  return {
    raw_data: {
      ...(ficha?.raw_data || {}),
      imobiliaria_retornou: retornou,
      imobiliaria_retornou_em: retornou ? at : null,
    },
  }
}

export function buildCobrancaHistoricoPatch(ficha, enviada, at = new Date().toISOString()) {
  return {
    raw_data: {
      ...(ficha?.raw_data || {}),
      cobranca_started_at: enviada ? at : null,
      retorno_enviado_em: enviada ? at : null,
    },
  }
}

export function isCobrancaEnviadaVisivel(colunaId) {
  return colunaId === 'enviado_cobranca' || colunaId === 'recuperados'
}

export function getCobrancaEnviadaDisplay(ficha, colunaId) {
  if (colunaId === 'recuperados') {
    return Boolean(ficha?.raw_data?.cobranca_started_at || ficha?.raw_data?.retorno_enviado_em)
  }
  return Boolean(ficha?.retorno_enviado)
}

export function getImobiliariaRetornouDisplay(ficha) {
  return Boolean(ficha?.raw_data?.imobiliaria_retornou)
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test src/lib/relatorioCobranca.test.mjs`
Expected: PASS — 7 testes, 0 falhas.

- [ ] **Step 5: Adicionar o novo arquivo de teste ao script `test` do `package.json`**

Em `package.json:11`, trocar:
```json
"test": "node --test src/lib/financeiroCalc.test.mjs src/lib/financeiroProducaoCalc.test.mjs src/lib/financeiroFaturasCalc.test.mjs"
```
por:
```json
"test": "node --test src/lib/financeiroCalc.test.mjs src/lib/financeiroProducaoCalc.test.mjs src/lib/financeiroFaturasCalc.test.mjs src/lib/relatorioCobranca.test.mjs"
```

- [ ] **Step 6: Rodar a suíte completa e confirmar que tudo passa**

Run: `npm test`
Expected: PASS — todos os testes (financeiro + relatorioCobranca) verdes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/relatorioCobranca.js src/lib/relatorioCobranca.test.mjs package.json
git commit -m "feat: extrai lógica de cobrança/retorno do relatório para módulo puro testável"
```

---

### Task 2: Trocar as queries do relatório para trazer avatar do orçamentista e do emissor

**Files:**
- Modify: `src/pages/Relatorio.jsx` (imports, e as 4 queries dentro do `useEffect` de `loadRows`, por volta das linhas 1029-1134 no arquivo atual)

**Interfaces:**
- Consumes: nenhuma (mudança isolada de dados).
- Produces (usado pela Task 4): cada item de `rows`/`rowsWithHelpers` passa a ter `_orcamentistaNome`, `_orcamentistaAvatar`, `_emissorNome`, `_emissorAvatar`.

- [ ] **Step 1: Adicionar `Avatar` ao import de `../components/ui`**

Em `src/pages/Relatorio.jsx:38`, trocar:
```js
import { PageHeader, MetricCard, DataCard, Select } from '../components/ui'
```
por:
```js
import { PageHeader, MetricCard, DataCard, Select, Avatar } from '../components/ui'
```

- [ ] **Step 2: Incluir `orcamentista_id` + join de perfil nas duas queries de fichas**

No `createdRowsQuery` (dentro de `loadRows`), trocar o `.select(...)`:
```js
.select('id, created_at, finalizada_em, nome_interessado, nome_empresa, cpf, cnpj, cep, imobiliaria, status, produto, retorno_enviado, seguradora, orcamentista_forms, observacoes, raw_data, numero_apolice, data_emissao, valor_aluguel, assumida')
```
por:
```js
.select('id, created_at, finalizada_em, nome_interessado, nome_empresa, cpf, cnpj, cep, imobiliaria, status, produto, retorno_enviado, seguradora, orcamentista_forms, observacoes, raw_data, numero_apolice, data_emissao, valor_aluguel, assumida, orcamentista_id, profiles!orcamentista_id(nome, avatar_url)')
```

Fazer a mesma troca no `.select(...)` da query de `finalRows` (mesmo texto, um pouco mais abaixo no mesmo `useEffect`).

- [ ] **Step 3: Incluir `emitido_por` + join de perfil nas duas queries de apólices**

Em `apolicesRangeRowsQuery`, trocar:
```js
.select('id, ficha_id, numero_apolice, data_emissao, status_emissao, seguradora, imobiliaria')
```
por:
```js
.select('id, ficha_id, numero_apolice, data_emissao, status_emissao, seguradora, imobiliaria, emitido_por, profiles!emitido_por(nome, avatar_url)')
```

Fazer a mesma troca na query de `apolicesData` (busca por `ficha_id` in `fichaIds`, mesmo texto de select um pouco mais abaixo no mesmo `useEffect`).

- [ ] **Step 4: Anexar os dados de avatar no `setRows(...)`**

No fim do `loadRows`, dentro do `.map(ficha => { ... })` que monta o array passado para `setRows`, trocar:
```js
return {
  ...ficha,
  _apolice: apolice,
  _hasEmittedPolicy: hasPolicy,
  _effectiveNumeroApolice: apolice?.numero_apolice || ficha.numero_apolice || null,
  _effectiveDataEmissao: apolice?.data_emissao || ficha.data_emissao || null,
  _effectiveSeguradora: apolice?.seguradora || ficha.seguradora || null,
}
```
por:
```js
return {
  ...ficha,
  _apolice: apolice,
  _hasEmittedPolicy: hasPolicy,
  _effectiveNumeroApolice: apolice?.numero_apolice || ficha.numero_apolice || null,
  _effectiveDataEmissao: apolice?.data_emissao || ficha.data_emissao || null,
  _effectiveSeguradora: apolice?.seguradora || ficha.seguradora || null,
  _orcamentistaNome: ficha.profiles?.nome || null,
  _orcamentistaAvatar: ficha.profiles?.avatar_url || null,
  _emissorNome: apolice?.profiles?.nome || null,
  _emissorAvatar: apolice?.profiles?.avatar_url || null,
}
```

- [ ] **Step 5: Verificar manualmente que o build ainda passa**

Run: `npm run build`
Expected: build verde, sem erros de sintaxe/import.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Relatorio.jsx
git commit -m "feat: traz avatar do orçamentista e do emissor nas queries do relatório"
```

---

### Task 3: Handlers de toggle (cobrança enviada / imobiliária retornou) por linha

**Files:**
- Modify: `src/pages/Relatorio.jsx` (imports, remoção das definições locais de `buildAprovadaPatch`/`buildCobrancaPatch`, novas funções dentro do componente `Relatorio`)

**Interfaces:**
- Consumes: `buildAprovadaPatch`, `buildCobrancaPatch`, `buildImobiliariaRetornoPatch`, `buildCobrancaHistoricoPatch` de `../lib/relatorioCobranca.js` (Task 1); `editarFicha` (já importado de `../lib/fichas`); `user` (já vem de `useAuth()`); `rows`/`setRows` (já existem no componente).
- Produces (usado pela Task 4): `toggleCobrancaEnviadaLinha(ficha, colunaId, nextValue)` e `toggleImobiliariaRetornou(ficha, nextValue)`.

- [ ] **Step 1: Importar as funções do novo módulo e remover as definições locais duplicadas**

Em `src/pages/Relatorio.jsx`, no bloco de imports (perto da linha 33), trocar:
```js
import { registrarApoliceDaFicha, formatMoneyBR, toNumber } from '../lib/apolices'
```
por:
```js
import { registrarApoliceDaFicha, formatMoneyBR, toNumber } from '../lib/apolices'
import {
  buildAprovadaPatch,
  buildCobrancaPatch,
  buildImobiliariaRetornoPatch,
  buildCobrancaHistoricoPatch,
  isCobrancaEnviadaVisivel,
  getCobrancaEnviadaDisplay,
  getImobiliariaRetornouDisplay,
} from '../lib/relatorioCobranca'
```

Remover as definições locais de `buildAprovadaPatch` e `buildCobrancaPatch` (as duas funções declaradas por volta das linhas 165-191 do arquivo atual, logo abaixo de `getRecoveryStart`). Todos os usos existentes (`moveSelected`, `handleConfirmarCobranca`) continuam funcionando sem alteração — só passam a vir do import.

- [ ] **Step 2: Adicionar os dois handlers dentro do componente `Relatorio`**

Logo depois da função `handleConfirmarCobranca` (que já existe no componente), adicionar:

```js
async function toggleCobrancaEnviadaLinha(ficha, colunaId, nextValue) {
  const patch = colunaId === 'recuperados'
    ? buildCobrancaHistoricoPatch(ficha, nextValue)
    : buildAprovadaPatch(ficha)

  const previousRows = rows
  setRows(prev => prev.map(item => (
    item.id === ficha.id ? { ...item, ...patch, raw_data: patch.raw_data } : item
  )))

  const err = await editarFicha(ficha.id, patch, user?.id)
  if (err) {
    setRows(previousRows)
    toast({ type: 'error', title: 'Erro ao atualizar cobrança', message: err.message })
    return
  }
  toast({ type: 'success', title: nextValue ? 'Marcado como cobrança enviada' : 'Ficha retornou para Aprovadas' })
}

async function toggleImobiliariaRetornou(ficha, nextValue) {
  const patch = buildImobiliariaRetornoPatch(ficha, nextValue)

  const previousRows = rows
  setRows(prev => prev.map(item => (
    item.id === ficha.id ? { ...item, raw_data: patch.raw_data } : item
  )))

  const err = await editarFicha(ficha.id, patch, user?.id)
  if (err) {
    setRows(previousRows)
    toast({ type: 'error', title: 'Erro ao atualizar retorno da imobiliária', message: err.message })
    return
  }
  toast({ type: 'success', title: nextValue ? 'Imobiliária marcada como retornou' : 'Marcação de retorno removida' })
}
```

- [ ] **Step 3: Verificar manualmente que o build ainda passa**

Run: `npm run build`
Expected: build verde. (`toggleCobrancaEnviadaLinha`/`toggleImobiliariaRetornou` ainda não são chamados por nenhum componente — isso é normal até a Task 4/5; um linter de "unused function" não existe neste projeto, então não deve quebrar o build.)

- [ ] **Step 4: Commit**

```bash
git add src/pages/Relatorio.jsx
git commit -m "feat: adiciona handlers de toggle de cobrança enviada e retorno da imobiliária"
```

---

### Task 4: Componentes de lista `BlocoRelatorio` e `LinhaRelatorio`

**Files:**
- Modify: `src/pages/Relatorio.jsx` — remover `RelatorioCard`, `DraggableRelatorioCard`, `KanbanColuna`; adicionar `LinhaRelatorio` e `BlocoRelatorio` no lugar (mesma região do arquivo, por volta das linhas 407-630 do arquivo atual, entre `ChartCard` e `PeriodControl`).

**Interfaces:**
- Consumes: `getNomeFicha`, `getDocumento`, `getOperacionalStatus`, `getCanonicalImobiliariaNome`, `getEffectiveNumeroApolice`, `isEmitida` (helpers já existentes no topo do arquivo); `isCobrancaEnviadaVisivel`, `getCobrancaEnviadaDisplay`, `getImobiliariaRetornouDisplay` (Task 1); `Avatar` (Task 2).
- Produces (usado pela Task 5): `<BlocoRelatorio coluna fichas onOpen onOpenPolicy selectedIds onToggleSelect onCopy onSelectAll onConfirmCobranca canConfirmCobranca pendingCobrancaCount onToggleCobranca onToggleRetornou />`.

- [ ] **Step 1: Remover os componentes de card/coluna kanban**

Apagar as funções `RelatorioCard`, `DraggableRelatorioCard` e `KanbanColuna` inteiras (do `function RelatorioCard({ ficha, ... })` até o fechamento de `KanbanColuna`, por volta das linhas 407-630 do arquivo atual).

- [ ] **Step 2: Adicionar `LinhaRelatorio` no lugar**

```jsx
function LinhaRelatorio({ ficha, coluna, onOpen, onOpenPolicy, selected, onToggleSelect, onToggleCobranca, onToggleRetornou }) {
  const nome = getNomeFicha(ficha)
  const doc = getDocumento(ficha)
  const op = getOperacionalStatus(ficha)
  const isEmissaoCard = isEmitida(ficha)
  const prodColor = ficha.produto === 'pessoa_juridica' ? '#4b6cc2' : ficha.produto === 'comercial_pf' ? '#0f766e' : '#000079'
  const showCobrancaToggle = isCobrancaEnviadaVisivel(coluna.id)
  const showRetornouToggle = coluna.id === 'enviado_cobranca'
  const cobrancaEnviada = showCobrancaToggle ? getCobrancaEnviadaDisplay(ficha, coluna.id) : false
  const retornou = showRetornouToggle ? getImobiliariaRetornouDisplay(ficha) : false
  const rowClass = coluna.id === 'aprovada'
    ? 'border-red-300 bg-[linear-gradient(180deg,rgba(254,242,242,0.98),rgba(254,226,226,0.85))]'
    : 'border-dark-border/60 bg-dark-surface/70'

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${rowClass}`}>
      <button
        type="button"
        onClick={() => onToggleSelect(ficha.id)}
        className="rounded-lg p-1 hover:bg-dark-surface2"
        aria-label="Selecionar linha"
      >
        {selected ? <CheckSquare className="h-4 w-4 text-brand-primary" /> : <Square className="h-4 w-4 text-dark-muted" />}
      </button>

      <Avatar name={ficha._orcamentistaNome || 'Sem orçamentista'} src={ficha._orcamentistaAvatar} size="sm" />
      {isEmissaoCard && (
        <Avatar name={ficha._emissorNome || 'Sem emissor'} src={ficha._emissorAvatar} size="sm" />
      )}

      <button type="button" onClick={() => onOpen(ficha.id)} className="min-w-[200px] flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${prodColor}20`, color: prodColor }}>
            {normalizeDisplayText(ficha.produto) || ficha.produto || 'Fiança'}
          </span>
          <p className="text-sm font-semibold text-dark-text">{nome}</p>
        </div>
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-dark-muted">{getCanonicalImobiliariaNome(ficha)}</p>
      </button>

      <span className={`badge ${op?.color || 'badge-muted'}`}>{op?.label || '—'}</span>

      {doc && (
        <span className="rounded-full border border-dark-border/60 bg-dark-surface2/70 px-2 py-1 text-[10px] font-mono text-dark-muted">
          {doc}
        </span>
      )}

      {getEffectiveNumeroApolice(ficha) && (
        <span className="rounded-full px-2 py-1 text-[10px] font-mono" style={{ background: '#2247aa15', color: '#2247aa' }}>
          Apólice: {getEffectiveNumeroApolice(ficha)}
        </span>
      )}

      {showCobrancaToggle && (
        <button
          type="button"
          onClick={() => onToggleCobranca(ficha, coluna.id, !cobrancaEnviada)}
          className={cobrancaEnviada
            ? 'inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-800'
            : 'inline-flex items-center gap-2 rounded-full border border-dark-border/70 bg-dark-surface/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-muted hover:border-brand-accent/35 hover:text-dark-text'}
          aria-pressed={cobrancaEnviada}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${cobrancaEnviada ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          Cobrança enviada
        </button>
      )}

      {showRetornouToggle && (
        <button
          type="button"
          onClick={() => onToggleRetornou(ficha, !retornou)}
          className={retornou
            ? 'inline-flex items-center gap-2 rounded-full border border-blue-300 bg-blue-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-blue-800'
            : 'inline-flex items-center gap-2 rounded-full border border-dark-border/70 bg-dark-surface/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-muted hover:border-brand-accent/35 hover:text-dark-text'}
          aria-pressed={retornou}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${retornou ? 'bg-blue-500' : 'bg-slate-300'}`} />
          Imobiliária retornou
        </button>
      )}

      {isEmissaoCard && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(ficha.id)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dark-border/60 bg-dark-surface/85 px-2.5 py-2 text-[10px] font-semibold text-dark-text transition-colors hover:border-brand-accent/45 hover:text-status-info"
          >
            <FileText className="h-3.5 w-3.5" /> Abrir ficha
          </button>
          <button
            type="button"
            disabled={!ficha?._apolice?.id}
            onClick={() => { if (ficha?._apolice?.id) onOpenPolicy(ficha._apolice.id) }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-2.5 py-2 text-[10px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir apólice
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Adicionar `BlocoRelatorio` logo abaixo**

```jsx
function BlocoRelatorio({
  coluna,
  fichas,
  onOpen,
  onOpenPolicy,
  selectedIds,
  onToggleSelect,
  onCopy,
  onSelectAll,
  onConfirmCobranca,
  canConfirmCobranca,
  pendingCobrancaCount,
  onToggleCobranca,
  onToggleRetornou,
}) {
  return (
    <DataCard
      title={
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: coluna.color }} />
          {coluna.label}
        </span>
      }
      subtitle={`${fichas.length} ficha${fichas.length !== 1 ? 's' : ''}`}
      actions={
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectAll(coluna.id)}
            className="rounded-lg border border-dark-border/60 px-2 py-1 text-[10px] font-medium text-dark-muted transition-colors hover:border-brand-accent/40 hover:text-dark-text"
            title="Selecionar todos deste bloco"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => onCopy(coluna.id)}
            className="rounded-lg border border-dark-border/60 px-2 py-1 text-[10px] font-medium text-dark-muted transition-colors hover:border-brand-accent/40 hover:text-dark-text"
            title="Copiar informações dos selecionados deste bloco"
          >
            Copiar
          </button>
          {coluna.id === 'enviado_cobranca' && (
            <button
              type="button"
              onClick={onConfirmCobranca}
              disabled={!canConfirmCobranca}
              className="rounded-lg bg-brand-primary px-2.5 py-1 text-[10px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              title="Registrar envio de cobrança para as fichas selecionadas em Aprovadas"
            >
              Marcar envio{pendingCobrancaCount > 0 ? ` (${pendingCobrancaCount})` : ''}
            </button>
          )}
        </div>
      }
    >
      {fichas.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-dark-muted">
          <Square className="h-5 w-5 opacity-30" />
          <span className="text-xs">Vazia</span>
        </div>
      ) : (
        <div className="space-y-2">
          {fichas.map(ficha => (
            <LinhaRelatorio
              key={ficha.id}
              ficha={ficha}
              coluna={coluna}
              onOpen={onOpen}
              onOpenPolicy={onOpenPolicy}
              selected={selectedIds.has(ficha.id)}
              onToggleSelect={onToggleSelect}
              onToggleCobranca={onToggleCobranca}
              onToggleRetornou={onToggleRetornou}
            />
          ))}
        </div>
      )}
    </DataCard>
  )
}
```

- [ ] **Step 4: Verificar manualmente que o build ainda passa**

Run: `npm run build`
Expected: build verde. (`BlocoRelatorio`/`LinhaRelatorio` ainda não são usados no JSX principal — isso é normal até a Task 5.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/Relatorio.jsx
git commit -m "feat: adiciona componentes de lista BlocoRelatorio e LinhaRelatorio"
```

---

### Task 5: Trocar o kanban pela lista de blocos e remover `@dnd-kit` do arquivo

**Files:**
- Modify: `src/pages/Relatorio.jsx` — imports, estado (`activeId`, `sensors`, `scrollRef`, `STORAGE_PREFIX`, `scrollKey`), `handleDragEnd`, `scrollKanban`, `openFicha`/`openApolice`, e o JSX da branch `isDetail` (o `DataCard` "Kanban mensal").

**Interfaces:**
- Consumes: `BlocoRelatorio` (Task 4), `toggleCobrancaEnviadaLinha`/`toggleImobiliariaRetornou` (Task 3), `COLUNAS`, `columnMap`, `selectedIds`, `toggleSelected`, `copyColumn`, `selectAllColumn`, `openConfirmarCobranca`, `canConfirmCobranca`, `pendingCobrancaCount` (todos já existentes no componente).
- Produces: branch `isDetail` sem `@dnd-kit`, com lista vertical de blocos.

- [ ] **Step 1: Remover os imports de `@dnd-kit` e de `kanbanDnd`**

Remover, do topo do arquivo:
```js
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
```
e:
```js
import { kanbanPointerCollision, KANBAN_DRAG_OVERLAY_MODIFIERS } from '../lib/kanbanDnd'
```

Remover `ChevronLeft` da lista de ícones importada de `lucide-react` (continua tendo `ChevronRight`, usado em outro lugar do arquivo).

Trocar o import de `react`:
```js
import { useEffect, useMemo, useRef, useState } from 'react'
```
por:
```js
import { useEffect, useMemo, useState } from 'react'
```

- [ ] **Step 2: Remover `STORAGE_PREFIX` e o estado/refs ligados ao scroll horizontal do kanban**

Remover a constante:
```js
const STORAGE_PREFIX = 'relatorio-fian-ca-scroll'
```

Dentro do componente `Relatorio`, remover:
```js
const [activeId, setActiveId] = useState(null)
```
e:
```js
const scrollRef = useRef(null)
```
e:
```js
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
```
e:
```js
const scrollKey = `${STORAGE_PREFIX}-${currentPath}`
```

Remover os dois `useEffect` que sincronizam `scrollRef.current.scrollLeft` com `sessionStorage` (o que restaura o scroll ao montar, lendo `location.state?.scrollLeft`/`sessionStorage.getItem(scrollKey)`, e o que salva com `el.addEventListener('scroll', ...)`). Manter o `useEffect` que restaura `location.state?.scrollTop` via `window.scrollTo` — esse continua valendo (scroll vertical da página).

Remover a variável derivada `activeFicha`:
```js
const activeFicha = activeId ? rowsWithHelpers.find(item => item.id === activeId) : null
```

- [ ] **Step 3: Simplificar `openFicha`/`openApolice` (sem mais `scrollLeft`)**

Trocar:
```js
function openFicha(id) {
  const scrollLeft = scrollRef.current?.scrollLeft || 0
  navigate(`/fichas/${id}`, {
    state: {
      backTo: currentPath,
      backState: { scrollLeft, scrollTop: window.scrollY },
    },
  })
}

function openApolice(id) {
  const scrollLeft = scrollRef.current?.scrollLeft || 0
  navigate(`/apolices/${id}`, {
    state: {
      backTo: currentPath,
      backState: { scrollLeft, scrollTop: window.scrollY },
    },
  })
}
```
por:
```js
function openFicha(id) {
  navigate(`/fichas/${id}`, {
    state: {
      backTo: currentPath,
      backState: { scrollTop: window.scrollY },
    },
  })
}

function openApolice(id) {
  navigate(`/apolices/${id}`, {
    state: {
      backTo: currentPath,
      backState: { scrollTop: window.scrollY },
    },
  })
}
```

- [ ] **Step 4: Remover `scrollKanban` e `handleDragEnd`**

Apagar a função inteira `scrollKanban(direction)` e a função inteira `handleDragEnd({ active, over })` (essa segunda já fica sem uso nenhum, pois não há mais `DndContext`).

- [ ] **Step 5: Trocar o JSX do "Kanban mensal" pela lista de blocos**

Trocar o bloco inteiro (do `<DataCard title="Kanban mensal" ...>` até o `</DataCard>` que o fecha, logo antes de `{pendingEmissao && (`):

```jsx
        <DataCard
          title="Kanban mensal"
          subtitle="Arraste fichas entre colunas para atualizar o status. Para cobran?a, selecione as aprovadas e confirme o envio."
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollKanban(-1)}
                className="rounded-xl border border-dark-border/60 p-2 text-dark-muted transition-colors hover:border-brand-accent/40 hover:text-dark-text"
                aria-label="Rolar kanban para a esquerda"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollKanban(1)}
                className="rounded-xl border border-dark-border/60 p-2 text-dark-muted transition-colors hover:border-brand-accent/40 hover:text-dark-text"
                aria-label="Rolar kanban para a direita"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          }
        >
          <DndContext
            sensors={sensors}
            collisionDetection={kanbanPointerCollision}
            onDragStart={({ active }) => setActiveId(active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div ref={scrollRef} className="kanban-scroll overflow-x-auto pb-4">
              <div className="flex min-w-max gap-3 px-1">
                {COLUNAS.map((coluna, index) => (
                  <KanbanColuna
                    key={coluna.id}
                    coluna={coluna}
                    fichas={columnMap[coluna.id] || []}
                    onOpen={openFicha}
                    onOpenPolicy={openApolice}
                    selectedIds={new Set(selectedIds)}
                    onToggleSelect={toggleSelected}
                    onCopy={copyColumn}
                    onSelectAll={selectAllColumn}
                    onConfirmCobranca={openConfirmarCobranca}
                    canConfirmCobranca={canConfirmCobranca}
                    pendingCobrancaCount={pendingCobrancaCount}
                    selectionMode={selectionMode}
                    colIndex={index}
                  />
                ))}
              </div>
            </div>

            <DragOverlay dropAnimation={null} modifiers={KANBAN_DRAG_OVERLAY_MODIFIERS}>
              {activeFicha && (
                <div style={{ width: 'var(--kanban-col-w, 286px)', pointerEvents: 'none' }}>
                  <RelatorioCard
                    ficha={activeFicha}
                    onOpen={() => {}}
                    onOpenPolicy={() => {}}
                    selected={false}
                    onToggleSelect={() => {}}
                    selectionMode={false}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </DataCard>
```

por:

```jsx
        <div className="space-y-4">
          {COLUNAS.map(coluna => (
            <BlocoRelatorio
              key={coluna.id}
              coluna={coluna}
              fichas={columnMap[coluna.id] || []}
              onOpen={openFicha}
              onOpenPolicy={openApolice}
              selectedIds={new Set(selectedIds)}
              onToggleSelect={toggleSelected}
              onCopy={copyColumn}
              onSelectAll={selectAllColumn}
              onConfirmCobranca={openConfirmarCobranca}
              canConfirmCobranca={canConfirmCobranca}
              pendingCobrancaCount={pendingCobrancaCount}
              onToggleCobranca={toggleCobrancaEnviadaLinha}
              onToggleRetornou={toggleImobiliariaRetornou}
            />
          ))}
        </div>
```

- [ ] **Step 6: Ajustar a descrição do `PageHeader` da view de detalhe**

Trocar (no mesmo `isDetail` return, no `PageHeader`):
```jsx
description={`Kanban analítico da imobiliária em ${periodoLabel}.`}
```
por:
```jsx
description={`Painel analítico da imobiliária em ${periodoLabel}, organizado por blocos.`}
```

- [ ] **Step 7: Checar se `selectionMode` ainda é usado em algum lugar do arquivo**

Run: `grep -n "selectionMode" "src/pages/Relatorio.jsx"`
Expected: só a declaração `const selectionMode = selectedIds.length > 0` (linha ~1222) sobra sem uso — os componentes novos (`LinhaRelatorio`/`BlocoRelatorio`) não recebem mais essa prop porque a seleção agora é sempre por clique no checkbox (não tem mais o modo "arrastar vs. selecionar" do kanban). Remover a declaração de `selectionMode`.

- [ ] **Step 8: Build e checagem manual do arquivo**

Run: `npm run build`
Expected: build verde, sem símbolos não resolvidos (`DndContext`, `KanbanColuna`, `RelatorioCard`, `DraggableRelatorioCard`, `scrollRef`, `activeId`, `activeFicha`, `sensors`, `scrollKanban`, `handleDragEnd`, `STORAGE_PREFIX`, `scrollKey`, `selectionMode` não podem mais aparecer no arquivo).

Run: `grep -n "DndContext\|KanbanColuna\|DraggableRelatorioCard\|RelatorioCard\|scrollRef\|activeFicha\|scrollKanban\|handleDragEnd" "src/pages/Relatorio.jsx"`
Expected: nenhuma ocorrência.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Relatorio.jsx
git commit -m "feat: substitui kanban drag-and-drop por blocos de lista no relatório por imobiliária"
```

---

### Task 6: Verificação final (build + smoke test manual)

**Files:** nenhum (só verificação).

- [ ] **Step 1: Rodar a suíte de testes de lógica**

Run: `npm test`
Expected: PASS.

- [ ] **Step 2: Rodar o build de produção**

Run: `npm run build`
Expected: PASS, sem warnings de import quebrado.

- [ ] **Step 3: Rodar `npm run dev` e abrir `/relatorio/:imobiliariaId` de uma imobiliária com fichas em pelo menos 2 blocos diferentes**

Conferir manualmente (usando o navegador):
- Os 5 blocos aparecem empilhados na vertical, na ordem Aprovadas, Emitidas, Enviado Cobrança, Recuperados, Expiradas.
- Toda linha do bloco Aprovadas está com destaque vermelho.
- Linhas do bloco Enviado Cobrança mostram os dois toggles ("Cobrança enviada" ligado, "Imobiliária retornou" desligado por padrão) e desligar "Cobrança enviada" move a ficha para Aprovadas.
- Linhas do bloco Recuperados mostram só o toggle "Cobrança enviada" (sem "Imobiliária retornou").
- Linhas do bloco Emitidas mostram avatar do orçamentista e do emissor, e os botões "Abrir ficha"/"Abrir apólice" funcionam.
- Selecionar várias linhas (checkbox) e usar "Copiar" e o `SelectedToolbar` (selecionar todos, inverter, copiar selecionados, mover para Aprovadas) continuam funcionando.
- Não há mais scroll lateral nem é possível arrastar uma linha para outro bloco.

- [ ] **Step 4: Reportar ao usuário**

Resumo do que foi entregue, arquivos alterados, riscos remanescentes (ex.: campo novo `imobiliaria_retornou` não tem coluna dedicada, vive dentro de `raw_data` — igual aos demais campos de controle da ficha) e próximos passos sugeridos, conforme o formato de entrega do `CLAUDE.md`.
