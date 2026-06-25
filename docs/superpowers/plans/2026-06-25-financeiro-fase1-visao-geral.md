# Financeiro — Fase 1 (Visão Geral) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a aba **Visão Geral** do módulo financeiro: Comissão Gerada no mês, Comissão Recebida Estimada (agenda mês a mês rateada por parcelas) e contagem de apólices, com a base de dados (tabela + trigger) que gera os recebimentos futuros automaticamente.

**Architecture:** Uma migração SQL cria `comissoes_recebimentos` (1 linha por parcela de cada apólice) mantida por trigger no `apolices`. A lógica pura de datas/agregação fica em `src/lib/financeiroCalc.js` (testável com `node --test`, sem importar Supabase). `src/lib/financeiro.js` faz as consultas. `/financeiro` vira um hub com sub-rotas aninhadas; a rota index renderiza `FinanceiroVisaoGeral`.

**Tech Stack:** React 18 + Vite, react-router-dom v6, Supabase (Postgres + RLS), Tailwind. Testes de unidade com o runner nativo do Node (`node --test`), sem novas dependências.

## Global Constraints

- RLS sempre ativa; tabelas financeiras restritas a `public.is_finance_admin()`.
- `service_role` somente no n8n; credenciais apenas em variáveis de ambiente.
- Queries com campos explícitos (nunca `select('*')` em listas).
- Migrações idempotentes (`IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP ... IF EXISTS`).
- Reaproveitar componentes de `src/components/ui` (`PageHeader`, `MetricCard`, `DataCard`, `EmptyState`, `Select`).
- Design system: brand-secondary para estado ativo; tokens `dark-*` existentes.
- Regras de cálculo (do spec `docs/superpowers/specs/2026-06-25-modulo-financeiro-redesign-design.md`):
  - Agenda: 1ª parcela cai no mês seguinte à emissão → `mes_referencia(n) = date_trunc('month', data_emissao) + n meses`.
  - Elegibilidade: `status_emissao IN ('emitida','enviada')` **E** `status_apolice IN ('ativa','renovada')` (null = tratar como 'ativa').
  - Rateio: `round(valor_comissao / parcelas, 2)`; a última parcela absorve o resíduo para fechar o total.

---

### Task 1: Migração — tabela `comissoes_recebimentos` + trigger + backfill + RLS

**Files:**
- Create: `supabase/42_financeiro_recebimentos.sql`

**Interfaces:**
- Produces (no banco): tabela `public.comissoes_recebimentos(id, apolice_id, numero_parcela, total_parcelas, mes_referencia, valor_previsto, seguradora, imobiliaria, created_at)`; coluna `apolices_comissoes.status_apolice`; trigger `tg_sync_apolice_recebimentos`.
- Consumes: `public.is_finance_admin()` e `public.to_numeric_safe(text)` (já existem, migração 28).

> **Nota de execução:** esta task exige acesso ao Supabase SQL Editor (não há aplicação automática de migração no repo). A verificação é feita rodando as queries de checagem no Supabase.

- [ ] **Step 1: Criar o arquivo de migração**

Create `supabase/42_financeiro_recebimentos.sql`:

```sql
-- ============================================================
-- CONVES SYSTEM — 42_financeiro_recebimentos.sql
-- Fase 1 do redesign financeiro: agenda mês a mês da comissão
-- recebida estimada + status_apolice no ledger.
-- Rodar no Supabase SQL Editor.
-- ============================================================

-- 1. status_apolice no ledger (permite excluir canceladas/expiradas)
ALTER TABLE public.apolices_comissoes
  ADD COLUMN IF NOT EXISTS status_apolice TEXT;

UPDATE public.apolices_comissoes ac
SET status_apolice = COALESCE(a.status_apolice, 'ativa')
FROM public.apolices a
WHERE a.id = ac.apolice_id;

-- 2. Tabela da agenda de recebimentos (1 linha por parcela)
CREATE TABLE IF NOT EXISTS public.comissoes_recebimentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apolice_id      UUID NOT NULL REFERENCES public.apolices(id) ON DELETE CASCADE,
  numero_parcela  INTEGER NOT NULL,
  total_parcelas  INTEGER NOT NULL,
  mes_referencia  DATE NOT NULL,
  valor_previsto  NUMERIC NOT NULL,
  seguradora      TEXT,
  imobiliaria     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (apolice_id, numero_parcela)
);

CREATE INDEX IF NOT EXISTS idx_com_receb_mes     ON public.comissoes_recebimentos(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_com_receb_apolice ON public.comissoes_recebimentos(apolice_id);
CREATE INDEX IF NOT EXISTS idx_com_receb_imob    ON public.comissoes_recebimentos(imobiliaria);
CREATE INDEX IF NOT EXISTS idx_com_receb_seg     ON public.comissoes_recebimentos(seguradora);

ALTER TABLE public.comissoes_recebimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "com_receb_select_admin" ON public.comissoes_recebimentos;
CREATE POLICY "com_receb_select_admin"
ON public.comissoes_recebimentos FOR SELECT
TO authenticated
USING (public.is_finance_admin());

DROP POLICY IF EXISTS "com_receb_write_admin" ON public.comissoes_recebimentos;
CREATE POLICY "com_receb_write_admin"
ON public.comissoes_recebimentos FOR ALL
TO authenticated
USING (public.is_finance_admin())
WITH CHECK (public.is_finance_admin());

-- 3. Função que (re)gera as parcelas de uma apólice e sincroniza status_apolice no ledger
CREATE OR REPLACE FUNCTION public.fn_sync_apolice_recebimentos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parcelas integer;
  v_comissao numeric;
  v_base date;
BEGIN
  -- Mantém status_apolice atualizado no ledger (linha criada pelo trigger tg_sync_apolice_comissao)
  UPDATE public.apolices_comissoes
     SET status_apolice = COALESCE(NEW.status_apolice, 'ativa'),
         updated_at = NOW()
   WHERE apolice_id = NEW.id;

  -- Sempre limpa as parcelas existentes da apólice antes de regenerar
  DELETE FROM public.comissoes_recebimentos WHERE apolice_id = NEW.id;

  v_parcelas := GREATEST(COALESCE(NULLIF(NEW.parcelamento::text, '')::integer, 1), 1);
  v_comissao := public.to_numeric_safe(NEW.valor_comissao::text);
  v_base := date_trunc('month', NEW.data_emissao)::date;

  IF NEW.status_emissao IN ('emitida', 'enviada')
     AND COALESCE(NEW.status_apolice, 'ativa') IN ('ativa', 'renovada')
     AND NEW.data_emissao IS NOT NULL
     AND v_comissao IS NOT NULL
     AND v_comissao > 0 THEN

    INSERT INTO public.comissoes_recebimentos (
      apolice_id, numero_parcela, total_parcelas, mes_referencia,
      valor_previsto, seguradora, imobiliaria
    )
    SELECT
      NEW.id,
      n,
      v_parcelas,
      (v_base + make_interval(months => n::int))::date,   -- 1ª parcela no mês seguinte
      CASE
        WHEN n < v_parcelas THEN round(v_comissao / v_parcelas, 2)
        ELSE v_comissao - round(v_comissao / v_parcelas, 2) * (v_parcelas - 1)
      END,
      NEW.seguradora,
      NEW.imobiliaria
    FROM generate_series(1, v_parcelas) AS n;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_sync_apolice_recebimentos ON public.apolices;
CREATE TRIGGER tg_sync_apolice_recebimentos
AFTER INSERT OR UPDATE ON public.apolices
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_apolice_recebimentos();

-- 4. Backfill das parcelas para apólices já existentes
INSERT INTO public.comissoes_recebimentos (
  apolice_id, numero_parcela, total_parcelas, mes_referencia,
  valor_previsto, seguradora, imobiliaria
)
SELECT
  a.id,
  n,
  GREATEST(COALESCE(NULLIF(a.parcelamento::text,'')::integer, 1), 1),
  (date_trunc('month', a.data_emissao)::date + make_interval(months => n::int))::date,
  CASE
    WHEN n < GREATEST(COALESCE(NULLIF(a.parcelamento::text,'')::integer, 1), 1)
      THEN round(public.to_numeric_safe(a.valor_comissao::text)
                 / GREATEST(COALESCE(NULLIF(a.parcelamento::text,'')::integer, 1), 1), 2)
    ELSE public.to_numeric_safe(a.valor_comissao::text)
       - round(public.to_numeric_safe(a.valor_comissao::text)
               / GREATEST(COALESCE(NULLIF(a.parcelamento::text,'')::integer, 1), 1), 2)
         * (GREATEST(COALESCE(NULLIF(a.parcelamento::text,'')::integer, 1), 1) - 1)
  END,
  a.seguradora,
  a.imobiliaria
FROM public.apolices a
CROSS JOIN LATERAL generate_series(
  1, GREATEST(COALESCE(NULLIF(a.parcelamento::text,'')::integer, 1), 1)
) AS n
WHERE a.status_emissao IN ('emitida','enviada')
  AND COALESCE(a.status_apolice, 'ativa') IN ('ativa','renovada')
  AND a.data_emissao IS NOT NULL
  AND public.to_numeric_safe(a.valor_comissao::text) IS NOT NULL
  AND public.to_numeric_safe(a.valor_comissao::text) > 0
ON CONFLICT (apolice_id, numero_parcela) DO NOTHING;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Aplicar a migração no Supabase**

Abra o Supabase SQL Editor do projeto, cole o conteúdo de `supabase/42_financeiro_recebimentos.sql` e execute.
Expected: execução sem erros (`Success. No rows returned`).

- [ ] **Step 3: Verificar — soma das parcelas fecha com a comissão total**

Run no SQL Editor:

```sql
SELECT a.id, a.valor_comissao, sum(r.valor_previsto) AS soma_parcelas, count(*) AS n
FROM public.apolices a
JOIN public.comissoes_recebimentos r ON r.apolice_id = a.id
GROUP BY a.id, a.valor_comissao
HAVING abs(sum(r.valor_previsto) - a.valor_comissao) > 0.01;
```
Expected: **0 linhas** (toda apólice fecha o total com tolerância de 1 centavo).

- [ ] **Step 4: Verificar — 1ª parcela cai no mês seguinte à emissão**

Run no SQL Editor:

```sql
SELECT a.data_emissao, min(r.mes_referencia) AS primeira_parcela, max(r.total_parcelas) AS parcelas
FROM public.apolices a
JOIN public.comissoes_recebimentos r ON r.apolice_id = a.id
GROUP BY a.id, a.data_emissao
ORDER BY a.data_emissao DESC
LIMIT 5;
```
Expected: `primeira_parcela` = dia 01 do mês **seguinte** ao mês de `data_emissao`.

- [ ] **Step 5: Commit**

```bash
git add supabase/42_financeiro_recebimentos.sql
git commit -m "feat(financeiro): tabela comissoes_recebimentos + trigger e backfill (Fase 1)"
```

---

### Task 2: Helpers puros de cálculo (`financeiroCalc.js`) — TDD

**Files:**
- Create: `src/lib/financeiroCalc.js`
- Test: `src/lib/financeiroCalc.test.mjs`
- Modify: `package.json` (adicionar script `test`)

**Interfaces:**
- Produces:
  - `parseYmd(value) -> Date|null`
  - `pad2(value) -> string`
  - `primeiroDiaMes(value) -> 'YYYY-MM-01'|null`
  - `addMeses(value, n) -> 'YYYY-MM-01'|null`
  - `formatMesAno(value) -> 'Jul/2026'|'—'`
  - `somarPorMes(recebimentos) -> Array<{ mes, total, parcelas, label }>` (ordenado asc)
  - `projetarProximosMeses(recebimentos, { mesesAFrente, referencia }) -> Array<{ mes, label, total, parcelas }>` (sempre `mesesAFrente` itens)
- Consumes: nada (módulo puro, sem imports).

- [ ] **Step 1: Escrever os testes que falham**

Create `src/lib/financeiroCalc.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  pad2, parseYmd, primeiroDiaMes, addMeses, formatMesAno,
  somarPorMes, projetarProximosMeses,
} from './financeiroCalc.js'

test('pad2 adiciona zero à esquerda', () => {
  assert.equal(pad2(3), '03')
  assert.equal(pad2(12), '12')
})

test('parseYmd interpreta YYYY-MM-DD como data local', () => {
  const d = parseYmd('2026-07-15')
  assert.equal(d.getFullYear(), 2026)
  assert.equal(d.getMonth(), 6) // julho = 6
  assert.equal(d.getDate(), 15)
  assert.equal(parseYmd(''), null)
  assert.equal(parseYmd('texto'), null)
})

test('primeiroDiaMes retorna o dia 01 do mês', () => {
  assert.equal(primeiroDiaMes('2026-07-15'), '2026-07-01')
  assert.equal(primeiroDiaMes('2026-12-31'), '2026-12-01')
})

test('addMeses soma meses com virada de ano', () => {
  assert.equal(addMeses('2026-07-01', 1), '2026-08-01')
  assert.equal(addMeses('2026-12-01', 1), '2027-01-01')
  assert.equal(addMeses('2026-07-15', 6), '2027-01-01')
})

test('formatMesAno formata abreviado', () => {
  assert.equal(formatMesAno('2026-07-01'), 'Jul/2026')
  assert.equal(formatMesAno('2026-01-10'), 'Jan/2026')
  assert.equal(formatMesAno(''), '—')
})

test('somarPorMes agrupa por mês, soma e conta parcelas, ordenado asc', () => {
  const rows = [
    { mes_referencia: '2026-08-01', valor_previsto: 20 },
    { mes_referencia: '2026-07-01', valor_previsto: 20 },
    { mes_referencia: '2026-08-01', valor_previsto: '30' },
    { mes_referencia: 'invalido',  valor_previsto: 99 },
  ]
  const out = somarPorMes(rows)
  assert.equal(out.length, 2)
  assert.deepEqual(out[0], { mes: '2026-07-01', total: 20, parcelas: 1, label: 'Jul/2026' })
  assert.deepEqual(out[1], { mes: '2026-08-01', total: 50, parcelas: 2, label: 'Ago/2026' })
})

test('projetarProximosMeses sempre retorna N meses preenchendo zeros', () => {
  const rows = [{ mes_referencia: '2026-09-01', valor_previsto: 100 }]
  const out = projetarProximosMeses(rows, { mesesAFrente: 3, referencia: '2026-08-10' })
  assert.equal(out.length, 3)
  assert.deepEqual(out.map(o => o.mes), ['2026-08-01', '2026-09-01', '2026-10-01'])
  assert.deepEqual(out.map(o => o.total), [0, 100, 0])
  assert.equal(out[1].parcelas, 1)
})
```

- [ ] **Step 2: Rodar os testes e ver que falham**

Run: `node --test src/lib/financeiroCalc.test.mjs`
Expected: FAIL (`Cannot find module './financeiroCalc.js'` ou export ausente).

- [ ] **Step 3: Implementar os helpers**

Create `src/lib/financeiroCalc.js`:

```js
// Helpers puros do módulo financeiro.
// Sem imports de Supabase/Vite → unit-testáveis com `node --test`.

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function pad2(value) {
  return String(value).padStart(2, '0')
}

// 'YYYY-MM-DD' ou Date → Date local à meia-noite; null se inválido.
export function parseYmd(value) {
  if (!value) return null
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// Primeiro dia do mês → 'YYYY-MM-01'
export function primeiroDiaMes(value) {
  const d = parseYmd(value)
  if (!d) return null
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`
}

// Soma n meses a um ymd → 'YYYY-MM-01'
export function addMeses(value, n) {
  const d = parseYmd(value)
  if (!d) return null
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1)
  return `${r.getFullYear()}-${pad2(r.getMonth() + 1)}-01`
}

// 'YYYY-MM-DD' ou Date → 'Jul/2026'
export function formatMesAno(value) {
  const d = parseYmd(value)
  if (!d) return '—'
  return `${MESES_ABBR[d.getMonth()]}/${d.getFullYear()}`
}

// Agrupa recebimentos por mes_referencia (ordenado asc).
// rows: [{ mes_referencia, valor_previsto }]
export function somarPorMes(recebimentos) {
  const map = new Map()
  for (const r of recebimentos || []) {
    const mes = primeiroDiaMes(r.mes_referencia)
    if (!mes) continue
    const valor = Number(r.valor_previsto) || 0
    const cur = map.get(mes) || { mes, total: 0, parcelas: 0, label: formatMesAno(mes) }
    cur.total += valor
    cur.parcelas += 1
    map.set(mes, cur)
  }
  return [...map.values()].sort((a, b) => a.mes.localeCompare(b.mes))
}

// Projeção de N meses a partir de `referencia` (inclusive), preenchendo meses vazios com 0.
export function projetarProximosMeses(recebimentos, { mesesAFrente = 6, referencia }) {
  const base = primeiroDiaMes(referencia)
  const porMes = new Map(somarPorMes(recebimentos).map(x => [x.mes, x]))
  const out = []
  for (let i = 0; i < mesesAFrente; i++) {
    const mes = addMeses(base, i)
    const found = porMes.get(mes)
    out.push({
      mes,
      label: formatMesAno(mes),
      total: found ? found.total : 0,
      parcelas: found ? found.parcelas : 0,
    })
  }
  return out
}
```

- [ ] **Step 4: Adicionar o script de teste no package.json**

Modify `package.json` — adicionar em `"scripts"` (após a linha `"check:page-contexts"`):

```json
    "check:page-contexts": "node scripts/validate-page-contexts.mjs",
    "test": "node --test src/lib/financeiroCalc.test.mjs"
```

- [ ] **Step 5: Rodar os testes e ver que passam**

Run: `npm test`
Expected: PASS (`# pass 7`, `# fail 0`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/financeiroCalc.js src/lib/financeiroCalc.test.mjs package.json
git commit -m "feat(financeiro): helpers puros de agenda/projeção com testes (node --test)"
```

---

### Task 3: Camada de dados (`financeiro.js`)

**Files:**
- Create: `src/lib/financeiro.js`

**Interfaces:**
- Produces:
  - `fetchComissaoGerada({ inicio, fim }) -> Promise<number>`
  - `fetchApolicesEmitidasCount({ inicio, fim }) -> Promise<number>`
  - `fetchRecebimentos({ inicio, fim }) -> Promise<Array<{ mes_referencia, valor_previsto, numero_parcela, total_parcelas, seguradora, imobiliaria, apolice_id }>>`
- Consumes: `supabase` (`./supabase`), `toNumber` (`./apolices`), tabela `comissoes_recebimentos` (Task 1).

- [ ] **Step 1: Criar o módulo de dados**

Create `src/lib/financeiro.js`:

```js
import { supabase } from './supabase'
import { toNumber } from './apolices'

const STATUS_EMISSAO = ['emitida', 'enviada']
// Inclui status_apolice nulo (legado) tratado como 'ativa'
const FILTRO_STATUS_APOLICE = 'status_apolice.in.(ativa,renovada),status_apolice.is.null'

// Comissão Gerada no mês: soma de valor_comissao das apólices emitidas no período.
export async function fetchComissaoGerada({ inicio, fim }) {
  let q = supabase
    .from('apolices')
    .select('valor_comissao')
    .in('status_emissao', STATUS_EMISSAO)
    .or(FILTRO_STATUS_APOLICE)
  if (inicio) q = q.gte('data_emissao', inicio)
  if (fim) q = q.lte('data_emissao', fim)
  const { data, error } = await q
  if (error) throw error
  return (data || []).reduce((sum, r) => sum + (toNumber(r.valor_comissao) || 0), 0)
}

// Quantidade de apólices emitidas no período.
export async function fetchApolicesEmitidasCount({ inicio, fim }) {
  let q = supabase
    .from('apolices')
    .select('id', { count: 'exact', head: true })
    .in('status_emissao', STATUS_EMISSAO)
    .or(FILTRO_STATUS_APOLICE)
  if (inicio) q = q.gte('data_emissao', inicio)
  if (fim) q = q.lte('data_emissao', fim)
  const { count, error } = await q
  if (error) throw error
  return count || 0
}

// Parcelas de comissão (agenda) cujo mes_referencia cai no intervalo.
export async function fetchRecebimentos({ inicio, fim }) {
  let q = supabase
    .from('comissoes_recebimentos')
    .select('mes_referencia, valor_previsto, numero_parcela, total_parcelas, seguradora, imobiliaria, apolice_id')
    .order('mes_referencia', { ascending: true })
  if (inicio) q = q.gte('mes_referencia', inicio)
  if (fim) q = q.lte('mes_referencia', fim)
  const { data, error } = await q
  if (error) throw error
  return data || []
}
```

- [ ] **Step 2: Verificar que o build resolve os imports**

Run: `npm run build`
Expected: build conclui sem erros (sem "failed to resolve import" para `./financeiro`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/financeiro.js
git commit -m "feat(financeiro): camada de dados (comissão gerada, contagem, recebimentos)"
```

---

### Task 4: Hub `/financeiro` com sub-rotas + CONTEXT.md

**Files:**
- Create: `src/pages/Financeiro/Financeiro.jsx` (hub com abas + `<Outlet/>`)
- Create: `src/pages/Financeiro/FinanceiroVisaoGeral.jsx` (placeholder; conteúdo na Task 5)
- Create: `src/pages/Financeiro/CONTEXT.md`
- Delete: `src/pages/Financeiro.jsx` (substituído pelo hub na pasta)
- Modify: `src/App.jsx` (imports lazy + rota aninhada)

**Interfaces:**
- Consumes: `useAuth` (`../../contexts/AuthContext`), `DataCard`/`EmptyState` (`../../components/ui`), react-router `NavLink`/`Outlet`.
- Produces: rota `/financeiro` (hub) com index → `FinanceiroVisaoGeral`.

- [ ] **Step 1: Criar o hub**

Create `src/pages/Financeiro/Financeiro.jsx`:

```jsx
import { NavLink, Outlet } from 'react-router-dom'
import { DataCard, EmptyState } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { ShieldCheck } from 'lucide-react'

const TABS = [
  { to: '/financeiro', label: 'Visão Geral', end: true },
  { label: 'Produção', disabled: true },
  { label: 'Faturas', disabled: true },
]

export default function Financeiro() {
  const { profile } = useAuth()

  if (!profile?.is_admin) {
    return (
      <DataCard title="Acesso restrito">
        <EmptyState
          title="Área financeira restrita"
          description="Somente perfis marcados como admin conseguem visualizar comissões e produção."
          icon={<ShieldCheck className="h-6 w-6" />}
        />
      </DataCard>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center gap-1 border-b border-dark-border pb-2">
        {TABS.map(tab => tab.disabled ? (
          <span
            key={tab.label}
            title="Em breve"
            className="cursor-not-allowed rounded-xl px-3 py-1.5 text-xs font-medium text-dark-muted/50"
          >
            {tab.label} · em breve
          </span>
        ) : (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive ? 'bg-brand-secondary text-white' : 'text-dark-muted hover:bg-dark-surface2 hover:text-dark-text'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  )
}
```

- [ ] **Step 2: Criar o placeholder da Visão Geral**

Create `src/pages/Financeiro/FinanceiroVisaoGeral.jsx`:

```jsx
export default function FinanceiroVisaoGeral() {
  return <div className="py-12 text-center text-sm text-dark-muted">Carregando visão geral...</div>
}
```

- [ ] **Step 3: Criar o CONTEXT.md da página**

Create `src/pages/Financeiro/CONTEXT.md`:

```markdown
# CONTEXT — Financeiro

## Objetivo
Hub financeiro (admin-only) do Seguro Fiança com sub-abas: Visão Geral, Produção, Faturas.

## Estrutura
- `Financeiro.jsx` — layout do hub: guarda de admin, navegação por abas (NavLink) e `<Outlet/>`.
- `FinanceiroVisaoGeral.jsx` — aba index: Comissão Gerada, Comissão Recebida Estimada e agenda mês a mês.

## Rotas
- `/financeiro` (hub) → index `FinanceiroVisaoGeral`.
- `/financeiro/producao` e `/financeiro/faturas` — Fases 2 e 3 (ainda não implementadas; abas marcadas "em breve").

## Dados
- `src/lib/financeiro.js` — consultas (apólices e `comissoes_recebimentos`).
- `src/lib/financeiroCalc.js` — helpers puros de data/agregação (com testes em `financeiroCalc.test.mjs`).

## Acesso
- Restrito a `profile.is_admin`; rota envolvida por `AdminRoute`.
- Tabela `comissoes_recebimentos` com RLS via `is_finance_admin()`.

## Regras
- Agenda: 1ª parcela cai no mês seguinte à emissão.
- Elegível: `status_emissao IN ('emitida','enviada')` e `status_apolice IN ('ativa','renovada')`.
```

- [ ] **Step 4: Remover o arquivo antigo**

```bash
git rm src/pages/Financeiro.jsx
```

- [ ] **Step 5: Atualizar o App.jsx (import lazy)**

Modify `src/App.jsx:34` — substituir a linha:

```jsx
const Financeiro         = lazy(() => import('./pages/Financeiro'))
```

por:

```jsx
const Financeiro          = lazy(() => import('./pages/Financeiro/Financeiro'))
const FinanceiroVisaoGeral = lazy(() => import('./pages/Financeiro/FinanceiroVisaoGeral'))
```

- [ ] **Step 6: Atualizar o App.jsx (rota aninhada)**

Modify `src/App.jsx:90` — substituir a linha:

```jsx
          <Route path="financeiro" element={<AdminRoute><Financeiro /></AdminRoute>} />
```

por:

```jsx
          <Route path="financeiro" element={<AdminRoute><Financeiro /></AdminRoute>}>
            <Route index element={<FinanceiroVisaoGeral />} />
          </Route>
```

- [ ] **Step 7: Validar contextos de página e build**

Run: `npm run check:page-contexts`
Expected: `OK - N page files have CONTEXT.md coverage.` (sem itens faltando para `src/pages/Financeiro/...`).

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Financeiro/ src/App.jsx
git commit -m "feat(financeiro): hub com sub-rotas aninhadas e CONTEXT.md"
```

---

### Task 5: Conteúdo da aba Visão Geral

**Files:**
- Modify: `src/pages/Financeiro/FinanceiroVisaoGeral.jsx` (substitui o placeholder)

**Interfaces:**
- Consumes: `fetchComissaoGerada`, `fetchApolicesEmitidasCount`, `fetchRecebimentos` (Task 3); `primeiroDiaMes`, `addMeses`, `projetarProximosMeses` (Task 2); `formatMoneyBR` (`../../lib/apolices`); componentes de `../../components/ui`.

- [ ] **Step 1: Implementar a página**

Replace o conteúdo de `src/pages/Financeiro/FinanceiroVisaoGeral.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
import { Select } from '../../components/ui/Select'
import { fetchComissaoGerada, fetchApolicesEmitidasCount, fetchRecebimentos } from '../../lib/financeiro'
import { formatMoneyBR } from '../../lib/apolices'
import { primeiroDiaMes, addMeses, projetarProximosMeses } from '../../lib/financeiroCalc'
import { Coins, TrendingUp, FileText, CalendarClock } from 'lucide-react'

const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const PROJECAO_MESES = 12

function pad2(v) { return String(v).padStart(2, '0') }
function ymd(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}` }
function rangeMes(ano, mes) {
  return [ymd(ano, mes, 1), ymd(ano, mes, new Date(ano, mes, 0).getDate())]
}

export default function FinanceiroVisaoGeral() {
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [comissaoGerada, setComissaoGerada] = useState(0)
  const [comissaoGeradaAnt, setComissaoGeradaAnt] = useState(0)
  const [qtdApolices, setQtdApolices] = useState(0)
  const [recebimentos, setRecebimentos] = useState([])
  const [loading, setLoading] = useState(true)

  const [inicio, fim] = useMemo(() => rangeMes(ano, mes), [ano, mes])
  const mesRef = useMemo(() => primeiroDiaMes(inicio), [inicio])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const mesAntDate = new Date(ano, mes - 2, 1)
    const [inicioAnt, fimAnt] = rangeMes(mesAntDate.getFullYear(), mesAntDate.getMonth() + 1)
    const fimProjecao = addMeses(mesRef, PROJECAO_MESES)

    Promise.all([
      fetchComissaoGerada({ inicio, fim }),
      fetchComissaoGerada({ inicio: inicioAnt, fim: fimAnt }),
      fetchApolicesEmitidasCount({ inicio, fim }),
      fetchRecebimentos({ inicio: mesRef, fim: fimProjecao }),
    ]).then(([cg, cgAnt, qa, rec]) => {
      if (!mounted) return
      setComissaoGerada(cg)
      setComissaoGeradaAnt(cgAnt)
      setQtdApolices(qa)
      setRecebimentos(rec)
      setLoading(false)
    }).catch(() => { if (mounted) setLoading(false) })

    return () => { mounted = false }
  }, [inicio, fim, mesRef, ano, mes])

  const projecao = useMemo(
    () => projetarProximosMeses(recebimentos, { mesesAFrente: PROJECAO_MESES, referencia: mesRef }),
    [recebimentos, mesRef],
  )
  const recebidaMes = projecao.length ? projecao[0].total : 0
  const totalProjetado = useMemo(() => projecao.reduce((s, p) => s + p.total, 0), [projecao])
  const variacao = comissaoGeradaAnt > 0
    ? Math.round(((comissaoGerada - comissaoGeradaAnt) / comissaoGeradaAnt) * 100)
    : null
  const mesLabel = `${MESES_ABBR[mes - 1]} ${ano}`

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Financeiro · Visão Geral"
        title="Comissão do Seguro Fiança"
        description="Comissão gerada no mês e a estimativa de recebimento, rateada pela quantidade de parcelas de cada apólice."
        stats={(
          <>
            <MetricCard
              label="Comissão Gerada"
              value={formatMoneyBR(comissaoGerada)}
              hint={variacao != null ? `${mesLabel} · ${variacao >= 0 ? '+' : ''}${variacao}% vs mês ant.` : `emitidas em ${mesLabel}`}
              tone="secondary"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              label="Recebida Estimada"
              value={formatMoneyBR(recebidaMes)}
              hint={`a receber em ${mesLabel}`}
              tone="accent"
              icon={<Coins className="h-4 w-4" />}
            />
            <MetricCard
              label="Apólices"
              value={qtdApolices}
              hint="emitidas no período"
              tone="success"
              icon={<FileText className="h-4 w-4" />}
            />
          </>
        )}
      />

      <DataCard title="Período" subtitle="Selecione o mês de referência">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={String(ano)}
            onChange={v => setAno(Number(v))}
            options={[agora.getFullYear() + 1, agora.getFullYear(), agora.getFullYear() - 1, agora.getFullYear() - 2]
              .map(a => ({ value: String(a), label: String(a) }))}
            className="w-28"
          />
          <div className="flex flex-wrap items-center gap-1">
            {MESES_ABBR.map((label, i) => (
              <button
                key={label}
                onClick={() => setMes(i + 1)}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  mes === i + 1 ? 'bg-brand-secondary text-white' : 'text-dark-muted hover:bg-dark-surface2 hover:text-dark-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </DataCard>

      <DataCard
        title="Agenda de recebimentos"
        subtitle={`Projeção dos próximos ${PROJECAO_MESES} meses · total ${formatMoneyBR(totalProjetado)}. Cada comissão é dividida conforme as parcelas da apólice.`}
      >
        {loading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : projecao.every(p => p.total === 0) ? (
          <EmptyState
            title="Sem recebimentos projetados"
            description="Nenhuma parcela de comissão cai nos próximos meses a partir do período selecionado."
            icon={<CalendarClock className="h-6 w-6" />}
          />
        ) : (
          <div className="space-y-2">
            {projecao.map(p => (
              <div key={p.mes} className="flex items-center justify-between gap-3 rounded-2xl border border-dark-border/70 bg-dark-surface2/40 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-dark-text">{p.label}</p>
                  <p className="text-xs text-dark-muted">{p.parcelas} parcela{p.parcelas !== 1 ? 's' : ''}</p>
                </div>
                <p className="text-sm font-semibold text-dark-text">{formatMoneyBR(p.total)}</p>
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  )
}
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 3: Smoke test manual**

Run: `npm run dev`, faça login com um perfil admin e acesse `/financeiro`.
Expected: aba "Visão Geral" ativa; cards Comissão Gerada / Recebida Estimada / Apólices preenchidos; lista "Agenda de recebimentos" mostrando os próximos 12 meses; abas "Produção · em breve" e "Faturas · em breve" desabilitadas. Trocar o mês recarrega os valores.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Financeiro/FinanceiroVisaoGeral.jsx
git commit -m "feat(financeiro): aba Visão Geral (comissão gerada, recebida estimada, agenda)"
```

---

## Self-Review

**Spec coverage (Fase 1):**
- Comissão Gerada no mês → Task 3 `fetchComissaoGerada` + Task 5 card. ✓
- Comissão Recebida Estimada (rateio por parcelas, agenda mês a mês) → Task 1 (geração) + Task 2 (`projetarProximosMeses`) + Task 5 (lista + card). ✓
- Regra de cálculo `valorMensalComissao = comissaoTotal / parcelas`, recebimentos futuros automáticos → Task 1 trigger + backfill. ✓
- 1ª parcela no mês seguinte → Task 1 (`+ make_interval(months => n)`) verificado no Step 4. ✓
- Excluir cancelada/expirada, incluir renovada → Task 1 e Task 3 filtros. ✓
- Filtro de período + comparativo simples → Task 5 (seletor mês/ano + variação vs mês anterior). ✓
- Navegação em sub-abas sob `/financeiro` → Task 4. ✓
- Segurança (RLS admin-only, idempotência) → Task 1. ✓
- Produção/Faturas (logos, drill-down, repasses) → **fora do escopo da Fase 1** (Fases 2 e 3), abas marcadas "em breve". ✓

**Placeholder scan:** sem TBD/TODO; todo passo de código traz o código completo. ✓

**Type consistency:** nomes batem entre tasks — `fetchComissaoGerada`, `fetchApolicesEmitidasCount`, `fetchRecebimentos`, `primeiroDiaMes`, `addMeses`, `projetarProximosMeses`, `somarPorMes`, `formatMesAno`. Campos de `comissoes_recebimentos` (`mes_referencia`, `valor_previsto`, `total_parcelas`) idênticos em SQL (Task 1), data layer (Task 3) e helpers/testes (Task 2). ✓
