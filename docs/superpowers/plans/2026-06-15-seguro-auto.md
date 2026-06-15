# Seguro Auto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o módulo completo de Seguro Auto no Conves Hub — 5 tabelas Supabase com triggers automáticos + 5 páginas React (Dashboard, Renovações, Emissões, Cotações, Sinistros).

**Architecture:** Opção A — tabelas separadas por entidade. Cotação criada pelo n8n dispara trigger que cria card no kanban. Apólice emitida manualmente dispara trigger que agenda renovação. Cálculos de comissão e repasse no frontend antes do INSERT.

**Tech Stack:** React 18, TanStack Query v5, Supabase JS v2, dnd-kit (drag), Recharts (gráficos), Tailwind CSS, React Router v6.

**Spec:** `docs/superpowers/specs/2026-06-15-seguro-auto-design.md`

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `supabase/auto_tables.sql` | Criar | DDL das 5 tabelas |
| `supabase/auto_triggers.sql` | Criar | Triggers automáticos |
| `supabase/auto_rls.sql` | Criar | Políticas RLS |
| `src/lib/auto.js` | Criar | Todas as queries do módulo Auto |
| `src/pages/auto/AutoDashboard.jsx` | Criar | Dashboard com KPIs e gráficos |
| `src/pages/auto/AutoRenovacoes.jsx` | Criar | Lista de renovações com destaques visuais |
| `src/pages/auto/AutoEmissoes.jsx` | Criar | Kanban drag-and-drop |
| `src/pages/auto/AutoCotacoes.jsx` | Criar | Formulários de cotação novo e renovação |
| `src/pages/auto/AutoSinistros.jsx` | Criar | Placeholder "Em Breve" |
| `src/App.jsx` | Modificar | Registrar rotas `/auto/*` |
| `src/components/Layout.jsx` | Modificar | Adicionar Auto na sidebar |

---

## Task 1: Criar tabelas Supabase

**Files:**
- Create: `supabase/auto_tables.sql`

- [ ] **Step 1: Criar arquivo SQL com as 5 tabelas**

```sql
-- clientes_auto
CREATE TABLE clientes_auto (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo text NOT NULL,
  cpf text NOT NULL,
  telefone text,
  estado_civil text,
  profissao text,
  created_at timestamptz DEFAULT now()
);

-- cotacoes_auto
CREATE TABLE cotacoes_auto (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid REFERENCES clientes_auto(id),
  tipo text NOT NULL CHECK (tipo IN ('novo', 'renovacao')),
  origem_lead text,
  condutor_nome text,
  condutor_cpf text,
  cep_pernoite text,
  uso_veiculo text,
  garagem_residencia text,
  garagem_trabalho text,
  garagem_estudo text,
  jovens_18_26 text,
  modelo_veiculo text,
  placa text,
  veiculo_financiado text,
  possui_kit_gas text,
  possui_blindagem text,
  isento_imposto text,
  seguradora_preferencial jsonb,
  seguradora_mais_barata jsonb,
  status text DEFAULT 'aberta' CHECK (status IN ('aberta', 'convertida', 'perdida')),
  created_at timestamptz DEFAULT now()
);

-- emissoes_auto
CREATE TABLE emissoes_auto (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cotacao_id uuid REFERENCES cotacoes_auto(id),
  cliente_id uuid REFERENCES clientes_auto(id),
  tipo text NOT NULL CHECK (tipo IN ('novo', 'renovacao')),
  coluna text DEFAULT 'cotacao_feita' CHECK (coluna IN ('cotacao_feita', 'negociando', 'aguardando_vistoria', 'emitida')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- apolices_auto
CREATE TABLE apolices_auto (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  emissao_id uuid REFERENCES emissoes_auto(id),
  cliente_id uuid REFERENCES clientes_auto(id),
  seguradora text,
  numero_apolice text,
  vigencia_inicio date,
  vigencia_fim date NOT NULL,
  premio_liquido numeric,
  pct_comissao numeric,
  valor_comissao numeric,
  forma_pagamento text,
  parcelamento text,
  tipo_producao text CHECK (tipo_producao IN ('equipe', 'individual')),
  responsavel text,
  eh_renovacao boolean DEFAULT false,
  tem_repasse boolean DEFAULT false,
  pct_repasse numeric,
  nome_repasse text,
  valor_repasse numeric,
  created_at timestamptz DEFAULT now()
);

-- renovacoes_auto
CREATE TABLE renovacoes_auto (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  apolice_id uuid REFERENCES apolices_auto(id),
  cliente_id uuid REFERENCES clientes_auto(id),
  seguradora text,
  vigencia_fim date NOT NULL,
  status_cotacao text DEFAULT 'nao_cotada' CHECK (status_cotacao IN ('nao_cotada', 'cotada_nao_enviada', 'cotada_enviada')),
  status_renovacao text DEFAULT 'pendente' CHECK (status_renovacao IN ('pendente', 'renovada', 'nao_renovada')),
  created_at timestamptz DEFAULT now()
);
```

- [ ] **Step 2: Executar no SQL Editor do Supabase**

Acesse Supabase → SQL Editor → cole e execute o conteúdo de `supabase/auto_tables.sql`.

Verificar: em Table Editor, as 5 tabelas devem aparecer (`clientes_auto`, `cotacoes_auto`, `emissoes_auto`, `apolices_auto`, `renovacoes_auto`).

- [ ] **Step 3: Commit**

```bash
git add supabase/auto_tables.sql
git commit -m "feat(auto): criar tabelas Supabase do módulo Auto"
```

---

## Task 2: Criar triggers Supabase

**Files:**
- Create: `supabase/auto_triggers.sql`

- [ ] **Step 1: Criar arquivo SQL com os 2 triggers**

```sql
-- Trigger 1: ao inserir cotacao_auto → cria card em emissoes_auto
CREATE OR REPLACE FUNCTION fn_criar_emissao_auto()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO emissoes_auto (cotacao_id, cliente_id, tipo, coluna)
  VALUES (NEW.id, NEW.cliente_id, NEW.tipo, 'cotacao_feita');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tg_cotacao_to_emissao
AFTER INSERT ON cotacoes_auto
FOR EACH ROW EXECUTE FUNCTION fn_criar_emissao_auto();

-- Trigger 2: ao inserir apolice_auto → cria entrada em renovacoes_auto
CREATE OR REPLACE FUNCTION fn_criar_renovacao_auto()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO renovacoes_auto (apolice_id, cliente_id, seguradora, vigencia_fim, status_cotacao, status_renovacao)
  VALUES (NEW.id, NEW.cliente_id, NEW.seguradora, NEW.vigencia_fim, 'nao_cotada', 'pendente');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tg_apolice_to_renovacao
AFTER INSERT ON apolices_auto
FOR EACH ROW EXECUTE FUNCTION fn_criar_renovacao_auto();
```

- [ ] **Step 2: Executar no SQL Editor do Supabase**

Execute o conteúdo de `supabase/auto_triggers.sql`.

Verificar: em Database → Triggers, devem aparecer `tg_cotacao_to_emissao` e `tg_apolice_to_renovacao`.

- [ ] **Step 3: Testar triggers manualmente no SQL Editor**

```sql
-- Inserir cliente teste
INSERT INTO clientes_auto (nome_completo, cpf) VALUES ('Teste Trigger', '000.000.000-00') RETURNING id;

-- Inserir cotacao (use o id retornado acima)
INSERT INTO cotacoes_auto (cliente_id, tipo) VALUES ('<id_acima>', 'novo');

-- Verificar: deve existir um card em emissoes_auto com coluna = 'cotacao_feita'
SELECT * FROM emissoes_auto WHERE cliente_id = '<id_acima>';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/auto_triggers.sql
git commit -m "feat(auto): criar triggers automáticos cotacao→emissao e apolice→renovacao"
```

---

## Task 3: Configurar RLS

**Files:**
- Create: `supabase/auto_rls.sql`

- [ ] **Step 1: Criar arquivo SQL com políticas RLS**

```sql
-- Ativar RLS em todas as tabelas
ALTER TABLE clientes_auto ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotacoes_auto ENABLE ROW LEVEL SECURITY;
ALTER TABLE emissoes_auto ENABLE ROW LEVEL SECURITY;
ALTER TABLE apolices_auto ENABLE ROW LEVEL SECURITY;
ALTER TABLE renovacoes_auto ENABLE ROW LEVEL SECURITY;

-- Todos os usuários autenticados têm acesso total
CREATE POLICY "acesso_autenticado" ON clientes_auto
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "acesso_autenticado" ON cotacoes_auto
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "acesso_autenticado" ON emissoes_auto
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "acesso_autenticado" ON apolices_auto
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "acesso_autenticado" ON renovacoes_auto
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Executar no SQL Editor do Supabase**

Execute o conteúdo de `supabase/auto_rls.sql`.

Verificar: em Authentication → Policies, cada tabela deve ter a policy `acesso_autenticado`.

- [ ] **Step 3: Commit**

```bash
git add supabase/auto_rls.sql
git commit -m "feat(auto): configurar RLS nas tabelas Auto"
```

---

## Task 4: Criar lib de queries (src/lib/auto.js)

**Files:**
- Create: `src/lib/auto.js`

Antes de criar, verificar o caminho do cliente Supabase no projeto:
```bash
grep -r "createClient\|supabase" src/lib/ --include="*.js" -l
```

- [ ] **Step 1: Criar src/lib/auto.js**

```js
import { supabase } from './supabase'

// ── Helpers de data ──────────────────────────────────────────
function inicioFimMes(offset = 0) {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth() + offset
  return {
    inicio: new Date(ano, mes, 1).toISOString().split('T')[0],
    fim: new Date(ano, mes + 1, 0).toISOString().split('T')[0],
  }
}

// ── Clientes ─────────────────────────────────────────────────
export async function buscarClientePorCpf(cpf) {
  const { data } = await supabase
    .from('clientes_auto')
    .select('*')
    .eq('cpf', cpf)
    .maybeSingle()
  return data
}

// ── Cotações ─────────────────────────────────────────────────
export async function getCotacoesAuto({ tipo, status, seguradora, inicio, fim } = {}) {
  let q = supabase
    .from('cotacoes_auto')
    .select('*, clientes_auto(nome_completo, cpf, telefone)')
    .order('created_at', { ascending: false })
  if (tipo) q = q.eq('tipo', tipo)
  if (status) q = q.eq('status', status)
  if (seguradora) q = q.ilike('seguradora_preferencial->>nome', `%${seguradora}%`)
  if (inicio) q = q.gte('created_at', inicio)
  if (fim) q = q.lte('created_at', fim)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function criarCotacaoAuto(payload) {
  const { data, error } = await supabase
    .from('cotacoes_auto')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarStatusCotacao(id, status) {
  const { error } = await supabase
    .from('cotacoes_auto')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

// ── Emissões (Kanban) ─────────────────────────────────────────
export async function getEmissoesAuto() {
  const { data, error } = await supabase
    .from('emissoes_auto')
    .select('*, clientes_auto(nome_completo, telefone), cotacoes_auto(tipo, modelo_veiculo, placa)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function moverEmissaoColuna(id, coluna) {
  const { error } = await supabase
    .from('emissoes_auto')
    .update({ coluna, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ── Apólices ─────────────────────────────────────────────────
export async function emitirApoliceAuto(payload) {
  const premioLiquido = parseFloat(payload.premio_liquido) || 0
  const pctComissao = parseFloat(payload.pct_comissao) || 0
  const valorComissao = premioLiquido * pctComissao

  let valorRepasse = null
  if (payload.tem_repasse && payload.pct_repasse) {
    valorRepasse = valorComissao * parseFloat(payload.pct_repasse)
  }

  const { data, error } = await supabase
    .from('apolices_auto')
    .insert({ ...payload, valor_comissao: valorComissao, valor_repasse: valorRepasse })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Renovações ────────────────────────────────────────────────
export async function getRenovacoesAuto({ periodo } = {}) {
  let q = supabase
    .from('renovacoes_auto')
    .select('*, clientes_auto(nome_completo, telefone), apolices_auto(numero_apolice, seguradora)')
    .order('vigencia_fim', { ascending: true })

  const hoje = new Date()

  if (periodo === 'proximo_mes') {
    const { inicio, fim } = inicioFimMes(1)
    q = q.gte('vigencia_fim', inicio).lte('vigencia_fim', fim)
  } else if (periodo === 'mes_atual') {
    const { inicio, fim } = inicioFimMes(0)
    q = q.gte('vigencia_fim', inicio).lte('vigencia_fim', fim)
  } else if (periodo === 'passadas') {
    q = q.lt('vigencia_fim', hoje.toISOString().split('T')[0])
  }

  const { data, error } = await q
  if (error) throw error
  return data
}

export async function atualizarStatusRenovacao(id, campos) {
  const { error } = await supabase
    .from('renovacoes_auto')
    .update(campos)
    .eq('id', id)
  if (error) throw error
}

// ── Dashboard ─────────────────────────────────────────────────
export async function getDashboardAutoMetrics() {
  const { inicio, fim } = inicioFimMes(0)
  const proximoMes = inicioFimMes(1)

  const [emissoes, cotacoes, renovadasMes, vencendoProximoMes] = await Promise.all([
    supabase
      .from('apolices_auto')
      .select('id, eh_renovacao')
      .gte('created_at', inicio)
      .lte('created_at', fim),
    supabase
      .from('cotacoes_auto')
      .select('id')
      .gte('created_at', inicio)
      .lte('created_at', fim),
    supabase
      .from('renovacoes_auto')
      .select('id')
      .eq('status_renovacao', 'renovada')
      .gte('created_at', inicio)
      .lte('created_at', fim),
    supabase
      .from('renovacoes_auto')
      .select('id')
      .gte('vigencia_fim', proximoMes.inicio)
      .lte('vigencia_fim', proximoMes.fim),
  ])

  return {
    novosNoMes: emissoes.data?.filter(e => !e.eh_renovacao).length ?? 0,
    renovacoesNoMes: emissoes.data?.filter(e => e.eh_renovacao).length ?? 0,
    cotacoesNoMes: cotacoes.data?.length ?? 0,
    renovacoesConcluidas: renovadasMes.data?.length ?? 0,
    vencendoProximoMes: vencendoProximoMes.data?.length ?? 0,
  }
}

export async function getGraficoEmissoesMensais(meses = 6) {
  const resultado = []
  for (let i = meses - 1; i >= 0; i--) {
    const { inicio, fim } = inicioFimMes(-i)
    const { data } = await supabase
      .from('apolices_auto')
      .select('id, eh_renovacao')
      .gte('created_at', inicio)
      .lte('created_at', fim)
    const label = new Date(inicio).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    resultado.push({
      mes: label,
      novos: data?.filter(e => !e.eh_renovacao).length ?? 0,
      renovacoes: data?.filter(e => e.eh_renovacao).length ?? 0,
    })
  }
  return resultado
}
```

- [ ] **Step 2: Verificar import do supabase**

Confirme que o caminho `'./supabase'` está correto comparando com outros arquivos em `src/lib/`. Ajuste se necessário.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auto.js
git commit -m "feat(auto): criar lib de queries do módulo Auto"
```

---

## Task 5: AutoDashboard

**Files:**
- Create: `src/pages/auto/AutoDashboard.jsx`

- [ ] **Step 1: Criar src/pages/auto/AutoDashboard.jsx**

```jsx
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getDashboardAutoMetrics, getGraficoEmissoesMensais } from '../../lib/auto'

export default function AutoDashboard() {
  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['auto-dashboard-metrics'],
    queryFn: getDashboardAutoMetrics,
  })

  const { data: grafico, isLoading: loadingGrafico } = useQuery({
    queryKey: ['auto-grafico-emissoes'],
    queryFn: () => getGraficoEmissoesMensais(6),
  })

  if (loadingMetrics || loadingGrafico) return <div className="p-6 text-gray-400">Carregando...</div>

  const kpis = [
    { label: 'Novos no mês', valor: metrics?.novosNoMes ?? 0 },
    { label: 'Renovações no mês', valor: metrics?.renovacoesNoMes ?? 0 },
    { label: 'Cotações no mês', valor: metrics?.cotacoesNoMes ?? 0 },
    { label: 'Renovações concluídas', valor: metrics?.renovacoesConcluidas ?? 0 },
    { label: 'Vencendo próximo mês', valor: metrics?.vencendoProximoMes ?? 0 },
  ]

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Seguro Auto — Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-lg border p-4 text-center">
            <p className="text-3xl font-bold">{k.valor}</p>
            <p className="text-sm text-gray-500 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border p-4">
        <h2 className="text-base font-semibold mb-4">Emissões mensais</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={grafico}>
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="novos" name="Novos" fill="#3b82f6" />
            <Bar dataKey="renovacoes" name="Renovações" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/auto/AutoDashboard.jsx
git commit -m "feat(auto): criar página AutoDashboard"
```

---

## Task 6: AutoRenovacoes

**Files:**
- Create: `src/pages/auto/AutoRenovacoes.jsx`

- [ ] **Step 1: Criar src/pages/auto/AutoRenovacoes.jsx**

```jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRenovacoesAuto, atualizarStatusRenovacao } from '../../lib/auto'

const PERIODOS = [
  { value: 'proximo_mes', label: 'Próximo mês' },
  { value: 'mes_atual', label: 'Mês atual' },
  { value: 'passadas', label: 'Passadas' },
  { value: '', label: 'Todas' },
]

const STATUS_COTACAO_COR = {
  nao_cotada: 'bg-red-100 border-red-400 text-red-700',
  cotada_nao_enviada: 'bg-yellow-100 border-yellow-400 text-yellow-700',
  cotada_enviada: 'bg-green-100 border-green-400 text-green-700',
}

const STATUS_COTACAO_LABEL = {
  nao_cotada: 'Não cotada',
  cotada_nao_enviada: 'Cotada — não enviada',
  cotada_enviada: 'Cotada e enviada',
}

export default function AutoRenovacoes() {
  const [periodo, setPeriodo] = useState('proximo_mes')
  const qc = useQueryClient()

  const { data: renovacoes = [], isLoading } = useQuery({
    queryKey: ['auto-renovacoes', periodo],
    queryFn: () => getRenovacoesAuto({ periodo }),
  })

  const { mutate: atualizarStatus } = useMutation({
    mutationFn: ({ id, status_cotacao }) => atualizarStatusRenovacao(id, { status_cotacao }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-renovacoes'] }),
  })

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Renovações Auto</h1>

      <div className="flex gap-2">
        {PERIODOS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriodo(p.value)}
            className={`px-3 py-1 rounded text-sm border ${periodo === p.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-gray-400">Carregando...</p>}

      {!isLoading && renovacoes.length === 0 && (
        <p className="text-gray-400">Nenhuma renovação no período selecionado.</p>
      )}

      <div className="space-y-2">
        {renovacoes.map(r => (
          <div
            key={r.id}
            className={`rounded-lg border p-4 flex items-center justify-between ${STATUS_COTACAO_COR[r.status_cotacao]}`}
          >
            <div>
              <p className="font-semibold">{r.clientes_auto?.nome_completo}</p>
              <p className="text-sm">{r.seguradora} — Vence: {new Date(r.vigencia_fim).toLocaleDateString('pt-BR')}</p>
              <p className="text-xs mt-1">{STATUS_COTACAO_LABEL[r.status_cotacao]}</p>
            </div>
            <select
              value={r.status_cotacao}
              onChange={e => atualizarStatus({ id: r.id, status_cotacao: e.target.value })}
              className="text-sm border rounded px-2 py-1 bg-white text-gray-800"
            >
              <option value="nao_cotada">Não cotada</option>
              <option value="cotada_nao_enviada">Cotada — não enviada</option>
              <option value="cotada_enviada">Cotada e enviada</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/auto/AutoRenovacoes.jsx
git commit -m "feat(auto): criar página AutoRenovacoes com destaques visuais"
```

---

## Task 7: AutoEmissoes (Kanban)

**Files:**
- Create: `src/pages/auto/AutoEmissoes.jsx`

O projeto já tem `@dnd-kit/core` instalado. Seguir mesmo padrão do KanbanFichas existente.

- [ ] **Step 1: Criar src/pages/auto/AutoEmissoes.jsx**

```jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getEmissoesAuto, moverEmissaoColuna, emitirApoliceAuto } from '../../lib/auto'

const COLUNAS = [
  { id: 'cotacao_feita', label: 'Cotação Feita' },
  { id: 'negociando', label: 'Negociando' },
  { id: 'aguardando_vistoria', label: 'Aguardando Vistoria' },
  { id: 'emitida', label: 'Emitida' },
]

function CardEmissao({ emissao }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: emissao.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const cor = emissao.tipo === 'renovacao' ? 'border-l-4 border-green-500' : 'border-l-4 border-blue-500'
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className={`bg-white rounded-lg border p-3 cursor-grab shadow-sm ${cor}`}>
      <p className="font-medium text-sm">{emissao.clientes_auto?.nome_completo}</p>
      <p className="text-xs text-gray-500">{emissao.cotacoes_auto?.modelo_veiculo}</p>
      <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${emissao.tipo === 'renovacao' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
        {emissao.tipo === 'renovacao' ? 'Renovação' : 'Novo'}
      </span>
    </div>
  )
}

const FORM_INICIAL = {
  seguradora: '', numero_apolice: '', vigencia_inicio: '', vigencia_fim: '',
  premio_liquido: '', pct_comissao: '', forma_pagamento: '', parcelamento: '',
  tipo_producao: 'equipe', responsavel: '', eh_renovacao: false,
  tem_repasse: false, pct_repasse: '', nome_repasse: '',
}

export default function AutoEmissoes() {
  const qc = useQueryClient()
  const [modalEmissao, setModalEmissao] = useState(null)
  const [form, setForm] = useState(FORM_INICIAL)

  const { data: emissoes = [] } = useQuery({
    queryKey: ['auto-emissoes'],
    queryFn: getEmissoesAuto,
  })

  const { mutate: mover } = useMutation({
    mutationFn: ({ id, coluna }) => moverEmissaoColuna(id, coluna),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-emissoes'] }),
  })

  const { mutate: emitir, isPending } = useMutation({
    mutationFn: (payload) => emitirApoliceAuto(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      setModalEmissao(null)
      setForm(FORM_INICIAL)
    },
  })

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const colunaDestino = COLUNAS.find(c => c.id === over.id)?.id || over.id
    if (colunaDestino === 'emitida') {
      const emissao = emissoes.find(e => e.id === active.id)
      setModalEmissao(emissao)
    } else {
      mover({ id: active.id, coluna: colunaDestino })
    }
  }

  const premioLiquido = parseFloat(form.premio_liquido) || 0
  const pctComissao = parseFloat(form.pct_comissao) || 0
  const valorComissao = premioLiquido * pctComissao
  const valorRepasse = form.tem_repasse ? valorComissao * (parseFloat(form.pct_repasse) || 0) : 0

  function handleEmitir() {
    emitir({
      emissao_id: modalEmissao.id,
      cliente_id: modalEmissao.cliente_id,
      ...form,
      premio_liquido: premioLiquido,
      pct_comissao: pctComissao,
      valor_comissao: valorComissao,
      pct_repasse: form.tem_repasse ? parseFloat(form.pct_repasse) : null,
      valor_repasse: form.tem_repasse ? valorRepasse : null,
    })
    mover({ id: modalEmissao.id, coluna: 'emitida' })
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Gestão de Emissões Auto</h1>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-4 gap-4">
          {COLUNAS.map(col => {
            const cards = emissoes.filter(e => e.coluna === col.id)
            return (
              <div key={col.id} className="bg-gray-50 rounded-lg p-3">
                <h2 className="text-sm font-semibold text-gray-600 mb-3">
                  {col.label} <span className="text-gray-400">({cards.length})</span>
                </h2>
                <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 min-h-[200px]" id={col.id}>
                    {cards.map(e => <CardEmissao key={e.id} emissao={e} />)}
                  </div>
                </SortableContext>
              </div>
            )
          })}
        </div>
      </DndContext>

      {modalEmissao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4">
            <h2 className="text-lg font-bold">Emitir Apólice</h2>
            <p className="text-sm text-gray-500">{modalEmissao.clientes_auto?.nome_completo}</p>

            {[
              ['Seguradora', 'seguradora'], ['Número da apólice', 'numero_apolice'],
              ['Vigência início', 'vigencia_inicio', 'date'], ['Vigência fim', 'vigencia_fim', 'date'],
              ['Prêmio líquido (R$)', 'premio_liquido', 'number'], ['% Comissão (ex: 0.15)', 'pct_comissao', 'number'],
              ['Forma de pagamento', 'forma_pagamento'], ['Parcelamento', 'parcelamento'],
            ].map(([label, key, type = 'text']) => (
              <div key={key}>
                <label className="text-sm font-medium">{label}</label>
                <input type={type} value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm mt-1" />
              </div>
            ))}

            {(premioLiquido > 0 && pctComissao > 0) && (
              <p className="text-sm text-green-700 font-medium">
                Comissão: R$ {valorComissao.toFixed(2)}
              </p>
            )}

            <div>
              <label className="text-sm font-medium">Tipo de produção</label>
              <select value={form.tipo_producao}
                onChange={e => setForm(f => ({ ...f, tipo_producao: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm mt-1">
                <option value="equipe">Equipe</option>
                <option value="individual">Individual</option>
              </select>
            </div>

            {form.tipo_producao === 'individual' && (
              <div>
                <label className="text-sm font-medium">Responsável</label>
                <input value={form.responsavel}
                  onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm mt-1" />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.eh_renovacao}
                onChange={e => setForm(f => ({ ...f, eh_renovacao: e.target.checked }))} />
              É renovação da carteira?
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.tem_repasse}
                onChange={e => setForm(f => ({ ...f, tem_repasse: e.target.checked }))} />
              Existe repasse?
            </label>

            {form.tem_repasse && (
              <>
                <div>
                  <label className="text-sm font-medium">% Repasse (ex: 0.10)</label>
                  <input type="number" value={form.pct_repasse}
                    onChange={e => setForm(f => ({ ...f, pct_repasse: e.target.value }))}
                    className="w-full border rounded px-3 py-2 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Nome do repasse</label>
                  <input value={form.nome_repasse}
                    onChange={e => setForm(f => ({ ...f, nome_repasse: e.target.value }))}
                    className="w-full border rounded px-3 py-2 text-sm mt-1" />
                </div>
                {valorRepasse > 0 && (
                  <p className="text-sm text-blue-700 font-medium">
                    Repasse: R$ {valorRepasse.toFixed(2)}
                  </p>
                )}
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setModalEmissao(null); setForm(FORM_INICIAL) }}
                className="flex-1 border rounded py-2 text-sm text-gray-600">
                Cancelar
              </button>
              <button onClick={handleEmitir} disabled={isPending}
                className="flex-1 bg-blue-600 text-white rounded py-2 text-sm font-medium disabled:opacity-50">
                {isPending ? 'Emitindo...' : 'Confirmar emissão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/auto/AutoEmissoes.jsx
git commit -m "feat(auto): criar kanban de gestão de emissões Auto"
```

---

## Task 8: AutoCotacoes

**Files:**
- Create: `src/pages/auto/AutoCotacoes.jsx`

- [ ] **Step 1: Criar src/pages/auto/AutoCotacoes.jsx**

```jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCotacoesAuto, criarCotacaoAuto, buscarClientePorCpf } from '../../lib/auto'

const FORM_NOVO_INICIAL = {
  nome_completo: '', cpf: '', telefone: '', estado_civil: '', profissao: '',
  condutor_nome: '', condutor_cpf: '',
  cep_pernoite: '', uso_veiculo: '', garagem_residencia: '', garagem_trabalho: '',
  garagem_estudo: '', jovens_18_26: '', modelo_veiculo: '', placa: '',
  veiculo_financiado: '', possui_kit_gas: '', possui_blindagem: '', isento_imposto: '',
  origem_lead: '',
}

const FORM_RENOVACAO_INICIAL = {
  cpf: '',
  seguradora_preferencial: { nome: '', premio_total: '', premio_liquido: '', pct_comissao: '', valor_comissao: '' },
  seguradora_mais_barata: { nome: '', premio_total: '', premio_liquido: '', pct_comissao: '', valor_comissao: '' },
}

function calcComissao(seg) {
  const pl = parseFloat(seg.premio_liquido) || 0
  const pct = parseFloat(seg.pct_comissao) || 0
  return (pl * pct).toFixed(2)
}

export default function AutoCotacoes() {
  const [aba, setAba] = useState('novo')
  const [formNovo, setFormNovo] = useState(FORM_NOVO_INICIAL)
  const [formRen, setFormRen] = useState(FORM_RENOVACAO_INICIAL)
  const qc = useQueryClient()

  const { data: cotacoes = [] } = useQuery({
    queryKey: ['auto-cotacoes', aba],
    queryFn: () => getCotacoesAuto({ tipo: aba }),
  })

  const { mutate: criarNovo, isPending: criandoNovo } = useMutation({
    mutationFn: async (dados) => {
      let clienteExistente = await buscarClientePorCpf(dados.cpf)
      let cliente_id = clienteExistente?.id

      if (!clienteExistente) {
        const { data: novoCliente } = await import('../../lib/auto').then(m =>
          m.supabase?.from('clientes_auto').insert({
            nome_completo: dados.nome_completo, cpf: dados.cpf,
            telefone: dados.telefone, estado_civil: dados.estado_civil, profissao: dados.profissao,
          }).select().single()
        )
        cliente_id = novoCliente?.id
      }

      return criarCotacaoAuto({ ...dados, cliente_id, tipo: 'novo' })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auto-cotacoes'] }); setFormNovo(FORM_NOVO_INICIAL) },
  })

  const { mutate: criarRenovacao, isPending: criandoRen } = useMutation({
    mutationFn: async (dados) => {
      const cliente = await buscarClientePorCpf(dados.cpf)
      return criarCotacaoAuto({
        cliente_id: cliente?.id,
        tipo: 'renovacao',
        seguradora_preferencial: {
          ...dados.seguradora_preferencial,
          valor_comissao: calcComissao(dados.seguradora_preferencial),
        },
        seguradora_mais_barata: {
          ...dados.seguradora_mais_barata,
          valor_comissao: calcComissao(dados.seguradora_mais_barata),
        },
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auto-cotacoes'] }); setFormRen(FORM_RENOVACAO_INICIAL) },
  })

  function setSeguradora(qual, campo, valor) {
    setFormRen(f => ({
      ...f,
      [qual]: { ...f[qual], [campo]: valor }
    }))
  }

  const cotacoesMes = cotacoes.filter(c => {
    const d = new Date(c.created_at)
    const hoje = new Date()
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()
  })
  const convertidas = cotacoesMes.filter(c => c.status === 'convertida').length
  const taxa = cotacoesMes.length ? ((convertidas / cotacoesMes.length) * 100).toFixed(0) : 0

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Cotações Auto</h1>

      <div className="flex gap-2">
        {['novo', 'renovacao'].map(t => (
          <button key={t} onClick={() => setAba(t)}
            className={`px-4 py-2 rounded text-sm font-medium ${aba === t ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'}`}>
            {t === 'novo' ? 'Seguro Novo' : 'Renovação'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{cotacoesMes.length}</p>
          <p className="text-sm text-gray-500">Cotações no mês</p>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{convertidas}</p>
          <p className="text-sm text-gray-500">Convertidas</p>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{taxa}%</p>
          <p className="text-sm text-gray-500">Taxa de conversão</p>
        </div>
      </div>

      {aba === 'novo' && (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">Novo Orçamento</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Nome completo', 'nome_completo'], ['CPF', 'cpf'], ['Telefone', 'telefone'],
              ['Estado civil', 'estado_civil'], ['Profissão', 'profissao'],
              ['Nome do condutor principal', 'condutor_nome'], ['CPF do condutor', 'condutor_cpf'],
              ['CEP de pernoite', 'cep_pernoite'], ['Uso do veículo', 'uso_veiculo'],
              ['Modelo do veículo', 'modelo_veiculo'], ['Placa (opcional)', 'placa'],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="text-sm font-medium">{label}</label>
                <input value={formNovo[key]}
                  onChange={e => setFormNovo(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm mt-1" />
              </div>
            ))}
          </div>

          <div>
            <label className="text-sm font-medium">Origem do lead</label>
            <select value={formNovo.origem_lead}
              onChange={e => setFormNovo(f => ({ ...f, origem_lead: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm mt-1">
              <option value="">Selecionar</option>
              <option value="indicacao">Indicação</option>
              <option value="prospeccao">Prospecção</option>
              <option value="carteira">Carteira</option>
            </select>
          </div>

          <button onClick={() => criarNovo(formNovo)} disabled={criandoNovo}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium disabled:opacity-50">
            {criandoNovo ? 'Salvando...' : 'Salvar cotação'}
          </button>
        </div>
      )}

      {aba === 'renovacao' && (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">Cotação de Renovação</h2>

          <div>
            <label className="text-sm font-medium">CPF do cliente</label>
            <input value={formRen.cpf}
              onChange={e => setFormRen(f => ({ ...f, cpf: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm mt-1" />
          </div>

          {['seguradora_preferencial', 'seguradora_mais_barata'].map(qual => (
            <div key={qual} className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-sm">{qual === 'seguradora_preferencial' ? 'Seguradora Preferencial' : 'Seguradora Mais Barata'}</h3>
              <div className="grid grid-cols-2 gap-3">
                {[['Nome', 'nome'], ['Prêmio total', 'premio_total'], ['Prêmio líquido', 'premio_liquido'], ['% Comissão', 'pct_comissao']].map(([label, campo]) => (
                  <div key={campo}>
                    <label className="text-xs font-medium text-gray-600">{label}</label>
                    <input type={campo.includes('premio') || campo.includes('pct') ? 'number' : 'text'}
                      value={formRen[qual][campo]}
                      onChange={e => setSeguradora(qual, campo, e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm mt-1" />
                  </div>
                ))}
              </div>
              {formRen[qual].premio_liquido && formRen[qual].pct_comissao && (
                <p className="text-sm text-green-700">Comissão: R$ {calcComissao(formRen[qual])}</p>
              )}
            </div>
          ))}

          <button onClick={() => criarRenovacao(formRen)} disabled={criandoRen}
            className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium disabled:opacity-50">
            {criandoRen ? 'Salvando...' : 'Salvar cotação'}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/auto/AutoCotacoes.jsx
git commit -m "feat(auto): criar página AutoCotacoes (novo + renovação)"
```

---

## Task 9: AutoSinistros + Rotas + Sidebar

**Files:**
- Create: `src/pages/auto/AutoSinistros.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/Layout.jsx`

- [ ] **Step 1: Criar src/pages/auto/AutoSinistros.jsx**

```jsx
export default function AutoSinistros() {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
      <p className="text-4xl mb-4">🚗</p>
      <h2 className="text-xl font-semibold text-gray-700">Sinistros</h2>
      <p className="text-gray-400 mt-2">Em breve</p>
    </div>
  )
}
```

- [ ] **Step 2: Registrar rotas em App.jsx**

Localizar onde as rotas de `/comercial` são registradas em `src/App.jsx` e adicionar logo após:

```jsx
import AutoDashboard from './pages/auto/AutoDashboard'
import AutoRenovacoes from './pages/auto/AutoRenovacoes'
import AutoEmissoes from './pages/auto/AutoEmissoes'
import AutoCotacoes from './pages/auto/AutoCotacoes'
import AutoSinistros from './pages/auto/AutoSinistros'

// Dentro do bloco de rotas protegidas:
<Route path="/auto" element={<AutoDashboard />} />
<Route path="/auto/renovacoes" element={<AutoRenovacoes />} />
<Route path="/auto/emissoes" element={<AutoEmissoes />} />
<Route path="/auto/cotacoes" element={<AutoCotacoes />} />
<Route path="/auto/sinistros" element={<AutoSinistros />} />
```

- [ ] **Step 3: Adicionar Auto na sidebar (Layout.jsx)**

Localizar o bloco de navegação do comercial em `src/components/Layout.jsx` e adicionar um grupo Auto com os 5 links:

```jsx
// Grupo Auto — adicionar após o grupo Comercial
{
  label: 'Auto',
  icon: <Car size={16} />,  // importar Car de lucide-react
  children: [
    { label: 'Dashboard', path: '/auto' },
    { label: 'Renovações', path: '/auto/renovacoes' },
    { label: 'Emissões', path: '/auto/emissoes' },
    { label: 'Cotações', path: '/auto/cotacoes' },
    { label: 'Sinistros', path: '/auto/sinistros' },
  ]
}
```

> Seguir exatamente o padrão de agrupamento já usado pelo grupo Comercial na sidebar.

- [ ] **Step 4: Verificar build**

```bash
npm run build
```

Esperado: sem erros. Se houver erro de import, corrigir o caminho do supabase client ou de ícones lucide.

- [ ] **Step 5: Commit final**

```bash
git add src/pages/auto/AutoSinistros.jsx src/App.jsx src/components/Layout.jsx
git commit -m "feat(auto): wiring de rotas e sidebar — módulo Auto completo"
```

---

## Verificação End-to-End

1. Acesse `/auto` — dashboard deve exibir KPIs zerados e gráfico vazio
2. Execute o trigger de teste do Task 2 no SQL Editor — verifique que o card aparece em `/auto/emissoes` na coluna "Cotação Feita"
3. Em `/auto/emissoes`, arraste um card para "Emitida" — modal deve abrir
4. Preencha e confirme — verifique em `/auto/renovacoes` que a renovação foi criada
5. Em `/auto/renovacoes`, mude o filtro para "Próximo mês" e verifique os destaques visuais
6. Em `/auto/cotacoes`, crie uma cotação de seguro novo — verifique que card aparece em emissões
