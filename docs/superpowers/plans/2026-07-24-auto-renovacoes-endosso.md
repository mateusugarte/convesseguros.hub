# Renovações Auto — lembrete, puxar renovações, arrastar para gestão, XLS e endosso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 4 frentes do spec `docs/superpowers/specs/2026-07-24-auto-renovacoes-endosso-design.md` — lembrete de virada de mês, puxar renovações (banco + planilha), arrastar card para "Proposta Transmitida" com formulário reduzido e comissão corrigida, e cotação de endosso — no módulo Auto.

**Architecture:** Reaproveita ao máximo a infraestrutura existente (Kanban `emissoes_auto`/`cotacoes_auto`, trigger `fn_criar_renovacao_auto`, `renovacoes_auto`). Uma única migration adiciona colunas novas e uma tabela de estado do lembrete + tabela de endossos. Um parser novo (`autoComissaoImport.js`) espelha o padrão já existente de `autoHistoricoImport.js`. Toda lógica de negócio nova fica em `src/lib/auto.js` (funções puras de leitura/gravação Supabase) e `src/pages/auto/autoShared.js` (funções puras testáveis, sem I/O).

**Tech Stack:** React + Vite, TanStack Query, Supabase (Postgres), `xlsx` (SheetJS), `node --test` para testes de unidade em `src/lib/*.test.mjs` / `src/pages/auto/*.test.mjs`.

## Global Constraints

- Nenhuma mudança de RLS — tabelas de Auto continuam `FOR ALL TO authenticated USING (true)`.
- `pct_comissao` passa a ser sempre percentual inteiro (20 = 20%) em todo o módulo Auto — nunca fração (0,2).
- `valor_comissao = premio_liquido × (pct_comissao / 100) × 0.9` em todo lugar do módulo Auto que calcula comissão (novo, renovação, endosso).
- Migration nova fica em `supabase/56_auto_renovacoes_endosso.sql`; o usuário roda manualmente no SQL Editor do Supabase — nenhum código deve assumir que ela já rodou (seguir o padrão defensivo já usado com `isMissingColumnError`/`omitKeys` em `src/lib/auto.js`).
- Testes novos/alterados precisam ser adicionados à lista explícita do script `test` em `package.json` (o projeto usa `node --test <lista de arquivos>`, não descoberta automática).
- Rodar `npm test` e `npm run build` verdes ao final de cada task que altera `src/lib` ou `src/pages`.

---

## Fase A — Migration e correção global da fórmula de comissão

### Task 1: Migration `supabase/56_auto_renovacoes_endosso.sql`

**Files:**
- Create: `supabase/56_auto_renovacoes_endosso.sql`

**Interfaces:**
- Produces: tabelas/colunas consumidas por todas as tasks seguintes (`auto_renovacao_mes_status`, `renovacoes_auto.origem/data_limite_envio/motivo_cancelamento/nome_segurado_anterior/numero_apolice_anterior/premio_liquido_anterior/pct_comissao_anterior`, `cotacoes_auto.tipo`/`emissoes_auto.tipo` aceitando `'endosso'`, `apolices_auto.data_emissao`, tabela `endossos_auto`).

- [ ] **Step 1: Escrever o arquivo de migration completo**

```sql
-- 56_auto_renovacoes_endosso.sql
-- Lembrete de virada de mes, puxar renovacoes (banco + planilha), arrastar
-- para gestao com formulario reduzido, e cotacao de endosso.
-- Rodar manualmente no SQL Editor do Supabase (mesmo padrao das migrations anteriores).

-- 1. Estado do lembrete de virada de mes (um registro por mes-alvo, ex: '2026-08')
CREATE TABLE IF NOT EXISTS auto_renovacao_mes_status (
  mes_ref        text PRIMARY KEY,
  concluido_em   timestamptz,
  concluido_por  uuid REFERENCES profiles(id),
  created_at     timestamptz DEFAULT now()
);

-- 2. renovacoes_auto: novos campos usados pela area "Renovacoes do mes"
ALTER TABLE renovacoes_auto
  ADD COLUMN IF NOT EXISTS origem text DEFAULT 'sistema' CHECK (origem IN ('sistema','xls')),
  ADD COLUMN IF NOT EXISTS data_limite_envio date,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS nome_segurado_anterior text,
  ADD COLUMN IF NOT EXISTS numero_apolice_anterior text,
  ADD COLUMN IF NOT EXISTS premio_liquido_anterior numeric(14,2),
  ADD COLUMN IF NOT EXISTS pct_comissao_anterior numeric(6,2);

-- Evita duplicar renovacao para a mesma apolice (linhas de XLS sem apolice_id
-- ficam com NULL, que nao colide em indice unico parcial).
CREATE UNIQUE INDEX IF NOT EXISTS renovacoes_auto_apolice_id_uidx
  ON renovacoes_auto(apolice_id) WHERE apolice_id IS NOT NULL;

-- 3. Trigger existente (fn_criar_renovacao_auto) passa a preencher os campos
-- novos automaticamente, para toda apolice inserida (nao so as puxadas
-- manualmente) ja nascer com data limite e dados do ciclo atual.
CREATE OR REPLACE FUNCTION fn_criar_renovacao_auto()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO renovacoes_auto (
    apolice_id, cliente_id, seguradora, vigencia_fim, status_cotacao, status_renovacao,
    origem, data_limite_envio, nome_segurado_anterior, numero_apolice_anterior,
    premio_liquido_anterior, pct_comissao_anterior
  )
  VALUES (
    NEW.id, NEW.cliente_id, NEW.seguradora, NEW.vigencia_fim, 'nao_cotada', 'pendente',
    'sistema', NEW.vigencia_fim - 7, NEW.nome_cliente, NEW.numero_apolice,
    NEW.premio_liquido, NEW.pct_comissao
  )
  ON CONFLICT (apolice_id) WHERE apolice_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. cotacoes_auto / emissoes_auto: novo tipo 'endosso'
ALTER TABLE cotacoes_auto DROP CONSTRAINT IF EXISTS cotacoes_auto_tipo_check;
ALTER TABLE cotacoes_auto ADD CONSTRAINT cotacoes_auto_tipo_check
  CHECK (tipo IN ('novo','renovacao','endosso'));

ALTER TABLE emissoes_auto DROP CONSTRAINT IF EXISTS emissoes_auto_tipo_check;
ALTER TABLE emissoes_auto ADD CONSTRAINT emissoes_auto_tipo_check
  CHECK (tipo IN ('novo','renovacao','endosso'));

-- 5. apolices_auto: data de emissao (novo campo do formulario reduzido)
ALTER TABLE apolices_auto ADD COLUMN IF NOT EXISTS data_emissao date;

-- 6. Endosso
CREATE TABLE IF NOT EXISTS endossos_auto (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  apolice_id      uuid REFERENCES apolices_auto(id) NOT NULL,
  cotacao_id      uuid REFERENCES cotacoes_auto(id),
  motivo          text NOT NULL,
  campo_alterado  text,
  valor_anterior  text,
  valor_atual     text,
  valor_endosso   numeric(14,2),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE endossos_auto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS endossos_auto_all ON endossos_auto;
CREATE POLICY endossos_auto_all ON endossos_auto FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Não executar no Supabase ainda**

Esta migration é responsabilidade do usuário rodar manualmente no SQL Editor (mesmo padrão de todas as anteriores). Apenas commitar o arquivo.

- [ ] **Step 3: Commit**

```bash
git add supabase/56_auto_renovacoes_endosso.sql
git commit -m "feat(auto): migration para lembrete de renovacoes, puxar por planilha e endosso"
```

---

### Task 2: Corrigir fórmula de comissão em `src/lib/auto.js` (backend)

**Files:**
- Modify: `src/lib/auto.js:720-803` (`emitirApoliceAuto`), `src/lib/auto.js:805-903` (`criarEmissaoManualAuto`)
- Test: `src/lib/auto.test.mjs` (novo)

**Interfaces:**
- Consumes: nenhuma (função pura extraída para facilitar teste)
- Produces: `calcularValorComissaoAuto(premioLiquido, pctComissao)` — usada pelas duas funções acima e reutilizada pela Task 15/16.

Hoje `emitirApoliceAuto` (linha 722-724) e `criarEmissaoManualAuto` (linha 807-809) calculam `valorComissao = premioLiquido * pctComissao`, tratando `pct_comissao` como fração (0,2) e sem o fator de 10%. Isso diverge do valor real da planilha da corretora (`premio × %comissão × 0,9`, confirmado contra `01 COMISSÃO - AUTO.xlsx`).

- [ ] **Step 1: Escrever o teste da função pura (vai falhar, a função ainda não existe)**

Criar `src/lib/auto.test.mjs`:

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'

const { calcularValorComissaoAuto } = await import('./auto.js')

test('calcularValorComissaoAuto aplica percentual e retira 10% do resultado', () => {
  // premio 917.74, comissao 20% => 183.548, menos 10% => 165.1932 (bate com a planilha real)
  assert.equal(Math.round(calcularValorComissaoAuto(917.74, 20) * 10000) / 10000, 165.1932)
})

test('calcularValorComissaoAuto trata premio ou comissao ausentes como zero', () => {
  assert.equal(calcularValorComissaoAuto(null, 20), 0)
  assert.equal(calcularValorComissaoAuto(1000, null), 0)
  assert.equal(calcularValorComissaoAuto('', ''), 0)
})

test('calcularValorComissaoAuto bate com a linha NOVO da planilha real (JULHO 2026)', () => {
  // premio 2206.98, comissao 15% => 331.047, menos 10% => 297.9423
  assert.equal(Math.round(calcularValorComissaoAuto(2206.98, 15) * 10000) / 10000, 297.9423)
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node --test src/lib/auto.test.mjs`
Expected: FAIL — `auto.js` importa `./supabase` (que exige envs do Supabase) e `calcularValorComissaoAuto` não existe ainda.

> Nota: `src/lib/auto.js` importa `supabase` de `./supabase.js` no topo do arquivo. Antes de escrever o teste real, confirme que `src/lib/supabase.js` não lança erro só por ser importado sem envs configuradas (os outros libs testados, como `apolices.test.mjs`, já importam módulos de `src/lib`, então isso já funciona hoje — se `auto.test.mjs` falhar por causa disso, é um problema pré-existente do arquivo, não desta task).

- [ ] **Step 3: Implementar `calcularValorComissaoAuto` e usá-la nas duas funções**

Adicionar em `src/lib/auto.js`, próximo às outras funções puras de topo de arquivo (perto de `toFloatOrNull`, linha ~64):

```javascript
export function calcularValorComissaoAuto(premioLiquido, pctComissao) {
  const premio = parseFloat(premioLiquido) || 0
  const pct = parseFloat(pctComissao) || 0
  return premio * (pct / 100) * 0.9
}
```

Em `emitirApoliceAuto` (linha 722-724), trocar:

```javascript
  const premioLiquido = parseFloat(payload.premio_liquido) || 0
  const pctComissao = parseFloat(payload.pct_comissao) || 0
  const valorComissao = premioLiquido * pctComissao
```

por:

```javascript
  const premioLiquido = parseFloat(payload.premio_liquido) || 0
  const pctComissao = parseFloat(payload.pct_comissao) || 0
  const valorComissao = calcularValorComissaoAuto(premioLiquido, pctComissao)
```

Em `criarEmissaoManualAuto` (linha 807-809), fazer a mesma troca:

```javascript
  const premioLiquido = parseFloat(payload.premio_liquido) || 0
  const pctComissao = parseFloat(payload.pct_comissao) || 0
  const valorComissao = calcularValorComissaoAuto(premioLiquido, pctComissao)
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node --test src/lib/auto.test.mjs`
Expected: PASS (3 testes)

- [ ] **Step 5: Registrar o novo arquivo de teste no script `test`**

Em `package.json`, adicionar `src/lib/auto.test.mjs` à lista do script `test` (antes de `src/pages/auto/autoShared.test.mjs`, mantendo o padrão de um arquivo por linha lógica de import):

```json
"test": "node --test src/lib/financeiroCalc.test.mjs src/lib/financeiroProducaoCalc.test.mjs src/lib/financeiroFaturasCalc.test.mjs src/lib/relatorioCobranca.test.mjs src/lib/apoliceParser.test.mjs src/lib/apolices.test.mjs src/lib/fichaOperational.test.mjs src/lib/imobiliariasMapeamento.test.mjs src/lib/trainingProgression.test.mjs src/lib/autoHistoricoImport.test.mjs src/lib/auto.test.mjs src/pages/auto/autoShared.test.mjs"
```

- [ ] **Step 6: Rodar a suíte completa**

Run: `npm test`
Expected: todos os testes passam, incluindo os 3 novos.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auto.js src/lib/auto.test.mjs package.json
git commit -m "fix(auto): corrigir formula de valor_comissao (percentual inteiro + retirar 10%)"
```

---

### Task 3: Corrigir preview de comissão em `AutoEmissoes.jsx`

**Files:**
- Modify: `src/pages/auto/AutoEmissoes.jsx:1612-1614`

**Interfaces:**
- Consumes: `calcularValorComissaoAuto` de `../../lib/auto` (Task 2)

O preview ao vivo do modal de emissão (usado para mostrar "Comissão calculada" antes de salvar) calcula `valorComissao = premioLiquido * pctComissao`, mesma divergência da Task 2. Precisa usar a mesma função para o preview bater com o valor realmente salvo.

- [ ] **Step 1: Importar a função nova**

Em `src/pages/auto/AutoEmissoes.jsx`, linha 9 (import de `../../lib/auto`), adicionar `calcularValorComissaoAuto` à lista:

```javascript
import {
  atualizarEmissaoAutoCompleta, atualizarTagsEmissao, calcularValorComissaoAuto, criarEmissaoManualAuto, deletarCotacaoAuto, deletarEmissaoAuto,
  emitirApoliceAuto, getApolicesAuto, getAutoTags, getEmissaoAuto, getEmissaoColuna, getEmissoesAuto, importarApolicesAutoPlanilha, importarApolicesAutoHistorico, moverEmissaoColuna,
  salvarResultadoCotacao,
} from '../../lib/auto'
```

- [ ] **Step 2: Trocar o cálculo do preview**

Linha 1612-1614, trocar:

```javascript
  const premioLiquido = toNumber(form.premio_liquido) || 0
  const pctComissao = toNumber(form.pct_comissao) || 0
  const valorComissao = premioLiquido * pctComissao
```

por:

```javascript
  const premioLiquido = toNumber(form.premio_liquido) || 0
  const pctComissao = toNumber(form.pct_comissao) || 0
  const valorComissao = calcularValorComissaoAuto(premioLiquido, pctComissao)
```

- [ ] **Step 3: Rodar build para garantir que não quebrou nada**

Run: `npm run build`
Expected: build verde, sem erros de import.

- [ ] **Step 4: Commit**

```bash
git add src/pages/auto/AutoEmissoes.jsx
git commit -m "fix(auto): preview de comissao no modal de emissao usa a mesma formula do backend"
```

---

## Fase B — Helpers puros novos em `autoShared.js`

### Task 4: Constantes de prazo + `getMesAlvoRenovacao`

**Files:**
- Modify: `src/pages/auto/autoShared.js`
- Test: `src/pages/auto/autoShared.test.mjs`

**Interfaces:**
- Produces: `AVISO_VIRADA_DIAS`, `PRAZO_ENVIO_ORCAMENTO_DIAS`, `getMesAlvoRenovacao(hoje, statusPorMes)` — consumida pela Task 10 (`AutoDashboard.jsx`) e Task 8 (`lib/auto.js`, para calcular `data_limite_envio`, exportando `PRAZO_ENVIO_ORCAMENTO_DIAS` de novo em `auto.js` também é aceitável, mas para manter uma única fonte de verdade, `auto.js` importa a constante daqui).

> Verificar antes: `src/pages/auto/autoShared.test.mjs` já existe (está na lista do script `test`). Ler o arquivo primeiro para adicionar os testes no mesmo estilo, sem duplicar imports.

- [ ] **Step 1: Ler o arquivo de teste existente para seguir o padrão**

Run: abrir `src/pages/auto/autoShared.test.mjs` e conferir o formato de import (`await import('./autoShared.js')`) e o estilo dos `test(...)` já usados, para os novos testes ficarem consistentes.

- [ ] **Step 2: Escrever os testes (vão falhar, a função ainda não existe)**

Adicionar ao final de `src/pages/auto/autoShared.test.mjs`:

```javascript
test('getMesAlvoRenovacao retorna null quando nenhuma janela abriu ainda', () => {
  const hoje = new Date(2026, 6, 10) // 10/jul, mais de 15 dias antes de 01/ago
  assert.equal(getMesAlvoRenovacao(hoje, {}), null)
})

test('getMesAlvoRenovacao retorna o mes seguinte quando faltam <=15 dias para virar', () => {
  const hoje = new Date(2026, 6, 17) // 17/jul, 15 dias antes de 01/ago
  assert.equal(getMesAlvoRenovacao(hoje, {}), '2026-08')
})

test('getMesAlvoRenovacao ignora mes ja concluido e volta pro mes atual', () => {
  const hoje = new Date(2026, 6, 20)
  const status = { '2026-08': { concluido_em: '2026-07-18T00:00:00Z' } }
  // mes atual (2026-07) nunca foi concluido e sua janela ja abriu ha muito tempo
  assert.equal(getMesAlvoRenovacao(hoje, status), '2026-07')
})

test('getMesAlvoRenovacao retorna null quando tudo ate o mes seguinte esta concluido', () => {
  const hoje = new Date(2026, 6, 20)
  const status = {
    '2026-05': { concluido_em: '2026-05-01T00:00:00Z' },
    '2026-06': { concluido_em: '2026-06-01T00:00:00Z' },
    '2026-07': { concluido_em: '2026-07-01T00:00:00Z' },
    '2026-08': { concluido_em: '2026-07-18T00:00:00Z' },
  }
  assert.equal(getMesAlvoRenovacao(hoje, status), null)
})
```

Adicionar a `getMesAlvoRenovacao` ao import no topo do arquivo de teste (junto das demais funções já importadas de `./autoShared.js`).

- [ ] **Step 3: Rodar e confirmar falha**

Run: `node --test src/pages/auto/autoShared.test.mjs`
Expected: FAIL — `getMesAlvoRenovacao is not a function`

- [ ] **Step 4: Implementar em `src/pages/auto/autoShared.js`**

Adicionar ao final do arquivo:

```javascript
export const AVISO_VIRADA_DIAS = 15
export const PRAZO_ENVIO_ORCAMENTO_DIAS = 7

function mesRefDe(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// Mes-alvo do lembrete de virada de mes: comeca a valer 15 dias antes do
// mes seguinte comecar; se esse mes ja foi concluido mas um mes anterior
// (ate 2 meses atras) ainda estiver pendente, retorna o mais antigo pendente
// em vez de "esquecer" dele. Retorna null quando nao ha nada pendente.
export function getMesAlvoRenovacao(hoje = new Date(), statusPorMes = {}, avisoDias = AVISO_VIRADA_DIAS) {
  const candidatos = []
  for (let offset = -2; offset <= 1; offset += 1) {
    const refDate = new Date(hoje.getFullYear(), hoje.getMonth() + offset, 1)
    const abreEm = new Date(refDate.getFullYear(), refDate.getMonth(), 1 - avisoDias)
    if (hoje < abreEm) continue
    const mesRef = mesRefDe(refDate)
    if (statusPorMes[mesRef]?.concluido_em) continue
    candidatos.push(mesRef)
  }
  candidatos.sort()
  return candidatos[0] || null
}
```

- [ ] **Step 5: Rodar e confirmar sucesso**

Run: `node --test src/pages/auto/autoShared.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pages/auto/autoShared.js src/pages/auto/autoShared.test.mjs
git commit -m "feat(auto): getMesAlvoRenovacao calcula o mes-alvo do lembrete de virada"
```

---

### Task 5: `getRenovacaoAreaStatus` + `getComissaoAtualAnterior`

**Files:**
- Modify: `src/pages/auto/autoShared.js`
- Test: `src/pages/auto/autoShared.test.mjs`

**Interfaces:**
- Consumes: nenhuma (funções puras)
- Produces: `RENOVACAO_AREA_STATUS_META`, `getRenovacaoAreaStatus(renovacao, hojeISO)`, `getComissaoAtualAnterior(renovacao)` — consumidas pela Task 12 (`AutoRenovacoes.jsx`).

- [ ] **Step 1: Escrever os testes (vão falhar)**

Adicionar a `src/pages/auto/autoShared.test.mjs`:

```javascript
test('getRenovacaoAreaStatus retorna puxado quando nao ha cotacao vinculada e nao venceu', () => {
  const renovacao = { status_renovacao: 'pendente', vigencia_fim: '2099-01-01', cotacoes_auto: null }
  assert.equal(getRenovacaoAreaStatus(renovacao, '2026-07-24'), 'puxado')
})

test('getRenovacaoAreaStatus retorna vencido quando passou da vigencia sem cotacao', () => {
  const renovacao = { status_renovacao: 'pendente', vigencia_fim: '2026-01-01', cotacoes_auto: null }
  assert.equal(getRenovacaoAreaStatus(renovacao, '2026-07-24'), 'vencido')
})

test('getRenovacaoAreaStatus reflete a coluna real do kanban quando ha cotacao em andamento', () => {
  const renovacao = {
    status_renovacao: 'pendente',
    vigencia_fim: '2099-01-01',
    cotacoes_auto: { status: 'pendente', emissoes_auto: { coluna: 'negociando' } },
  }
  assert.equal(getRenovacaoAreaStatus(renovacao, '2026-07-24'), 'negociando')
})

test('getRenovacaoAreaStatus retorna renovado quando status_renovacao=renovada', () => {
  const renovacao = { status_renovacao: 'renovada', vigencia_fim: '2026-01-01' }
  assert.equal(getRenovacaoAreaStatus(renovacao, '2026-07-24'), 'renovado')
})

test('getRenovacaoAreaStatus retorna cancelado quando status_renovacao=nao_renovada', () => {
  const renovacao = { status_renovacao: 'nao_renovada', vigencia_fim: '2026-01-01' }
  assert.equal(getRenovacaoAreaStatus(renovacao, '2026-07-24'), 'cancelado')
})

test('getComissaoAtualAnterior usa a apolice vinculada quando existir', () => {
  const renovacao = {
    pct_comissao_anterior: 99,
    apolices_auto: {
      pct_comissao: 20,
      renovacao_premio_liquido_ano_anterior: 1000,
      renovacao_comissao_ano_anterior: 150,
    },
  }
  const resultado = getComissaoAtualAnterior(renovacao)
  assert.equal(resultado.atual, 20)
  assert.equal(resultado.anterior, 15)
})

test('getComissaoAtualAnterior cai para os dados da planilha quando nao ha apolice vinculada', () => {
  const renovacao = { pct_comissao_anterior: 18, apolices_auto: null }
  const resultado = getComissaoAtualAnterior(renovacao)
  assert.equal(resultado.atual, 18)
  assert.equal(resultado.anterior, null)
})
```

Adicionar `getRenovacaoAreaStatus, getComissaoAtualAnterior` ao import do topo do arquivo de teste.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test src/pages/auto/autoShared.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implementar em `src/pages/auto/autoShared.js`**

```javascript
export const RENOVACAO_AREA_STATUS_META = {
  puxado: { label: 'Puxado', tone: 'muted' },
  cotacao_feita: { label: 'Cotação feita', tone: 'secondary' },
  negociando: { label: 'Negociando', tone: 'accent' },
  aguardando_vistoria: { label: 'Aguardando vistoria', tone: 'warning' },
  proposta_transmitida: { label: 'Proposta Transmitida', tone: 'success' },
  renovado: { label: 'Renovado', tone: 'success' },
  cancelado: { label: 'Cancelado', tone: 'danger' },
  vencido: { label: 'Vencido', tone: 'danger' },
}

// Status da area "Renovacoes do mes": reaproveita a coluna real do Kanban de
// Gestao Auto (via renovacao.cotacoes_auto.emissoes_auto.coluna) em vez de
// inventar uma maquina de estados paralela.
export function getRenovacaoAreaStatus(renovacao, hojeISO = new Date().toISOString().slice(0, 10)) {
  if (renovacao?.status_renovacao === 'renovada') return 'renovado'
  if (renovacao?.status_renovacao === 'nao_renovada') return 'cancelado'

  const cotacao = renovacao?.cotacoes_auto
  const vencida = Boolean(renovacao?.vigencia_fim && renovacao.vigencia_fim < hojeISO)

  if (!cotacao) return vencida ? 'vencido' : 'puxado'

  const emissao = Array.isArray(cotacao.emissoes_auto) ? cotacao.emissoes_auto[0] : cotacao.emissoes_auto
  const coluna = emissao?.coluna || 'pendentes'
  if (coluna === 'pendentes') return vencida ? 'vencido' : 'puxado'
  if (coluna === 'apolice_emitida') return 'renovado'
  return coluna
}

// "Comissao atual" e a comissao da apolice vigente hoje (prestes a renovar);
// "comissao anterior" e a comissao do ciclo ANTES dessa apolice, recalculada
// a partir dos valores em dinheiro ja guardados em apolices_auto (nao existe
// coluna de percentual do ciclo anterior — evita duplicar dado). Quando a
// renovacao nao tem apolice vinculada (origem xls sem match), usa o unico
// dado disponivel (pct_comissao_anterior da propria linha) como "atual".
export function getComissaoAtualAnterior(renovacao) {
  const apolice = renovacao?.apolices_auto
  if (apolice) {
    const atual = typeof apolice.pct_comissao === 'number' ? apolice.pct_comissao : null
    const premioAnterior = Number(apolice.renovacao_premio_liquido_ano_anterior) || 0
    const comissaoAnterior = Number(apolice.renovacao_comissao_ano_anterior) || 0
    const anterior = premioAnterior > 0
      ? Math.round((comissaoAnterior / premioAnterior) * 100 * 100) / 100
      : null
    return { atual, anterior }
  }
  const atualSemApolice = typeof renovacao?.pct_comissao_anterior === 'number' ? renovacao.pct_comissao_anterior : null
  return { atual: atualSemApolice, anterior: null }
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `node --test src/pages/auto/autoShared.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/auto/autoShared.js src/pages/auto/autoShared.test.mjs
git commit -m "feat(auto): status da area de renovacoes e comparativo de comissao atual x anterior"
```

---

## Fase C — Puxar renovações do banco + estado do mês

### Task 6: `lib/auto.js` — estado do mês (`auto_renovacao_mes_status`)

**Files:**
- Modify: `src/lib/auto.js`
- Test: `src/lib/auto.test.mjs`

**Interfaces:**
- Consumes: nenhuma
- Produces: `getAutoRenovacaoMesStatus(mesRefs)`, `marcarMesRenovacaoConcluido(mesRef, userId)` — consumidas pela Task 10 (`AutoDashboard.jsx`) e Task 11 (`AutoRenovacoes.jsx`).

- [ ] **Step 1: Escrever os testes**

Estas duas funções fazem I/O direto no Supabase — seguindo o padrão já usado no projeto (ex.: `getRenovacoesAuto`), não são testadas por `node --test` (que não tem `.env`/Supabase disponível neste ambiente). Em vez de teste automatizado, documentar o contrato via JSDoc e cobrir com smoke test manual ao final da Fase C (Task 7).

- [ ] **Step 2: Implementar em `src/lib/auto.js`**, logo abaixo de `atualizarStatusRenovacao` (linha ~936):

```javascript
export async function getAutoRenovacaoMesStatus(mesRefs = []) {
  if (!mesRefs.length) return {}
  const { data, error } = await supabase
    .from('auto_renovacao_mes_status')
    .select('mes_ref, concluido_em, concluido_por')
    .in('mes_ref', mesRefs)
  if (error) throw error
  return Object.fromEntries((data ?? []).map(item => [item.mes_ref, item]))
}

export async function marcarMesRenovacaoConcluido(mesRef, userId) {
  const { error } = await supabase
    .from('auto_renovacao_mes_status')
    .upsert(
      { mes_ref: mesRef, concluido_em: new Date().toISOString(), concluido_por: userId || null },
      { onConflict: 'mes_ref' }
    )
  if (error) throw error
}
```

- [ ] **Step 3: Rodar build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auto.js
git commit -m "feat(auto): estado de conclusao do mes de renovacao (auto_renovacao_mes_status)"
```

---

### Task 7: `lib/auto.js` — `puxarRenovacoesDoSistema`

**Files:**
- Modify: `src/lib/auto.js`

**Interfaces:**
- Consumes: `parseMonthRef` (já existe, linha 4), `inicioFimMes` (já existe, linha 19)
- Produces: `puxarRenovacoesDoSistema(mesRef)` → `{ encontradas, criadas }` — consumida pela Task 11.

Como o trigger da Task 1 já preenche `renovacoes_auto` (com `data_limite_envio` e os campos `_anterior`) para toda apólice inserida, esta função funciona como rede de segurança: busca apólices cujo `vigencia_inicio` caiu no mês-alvo menos 1 ano e garante que cada uma tem uma linha em `renovacoes_auto` (cobre dados antigos importados antes desta migration, ou qualquer gap de trigger).

- [ ] **Step 1: Implementar**, logo abaixo de `getAutoRenovacaoMesStatus`/`marcarMesRenovacaoConcluido` (Task 6):

```javascript
const PRAZO_ENVIO_ORCAMENTO_DIAS = 7

function subtrairDias(dataISO, dias) {
  const match = String(dataISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const [, ano, mes, dia] = match
  const date = new Date(Number(ano), Number(mes) - 1, Number(dia))
  date.setDate(date.getDate() - dias)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export async function puxarRenovacoesDoSistema(mesRef) {
  const alvo = parseMonthRef(mesRef)
  if (!alvo) throw new Error('Mes invalido.')

  const anoAnterior = new Date(alvo.getFullYear() - 1, alvo.getMonth(), 1)
  const { inicio, fim } = inicioFimMes(0, anoAnterior)

  const { data: apolices, error: apolicesError } = await supabase
    .from('apolices_auto')
    .select('id, cliente_id, seguradora, vigencia_inicio, vigencia_fim, premio_liquido, pct_comissao, nome_cliente, numero_apolice')
    .gte('vigencia_inicio', inicio)
    .lte('vigencia_inicio', fim)
  if (apolicesError) throw apolicesError

  const apolicesElegiveis = apolices ?? []
  if (!apolicesElegiveis.length) return { encontradas: 0, criadas: 0 }

  const { data: existentes, error: existentesError } = await supabase
    .from('renovacoes_auto')
    .select('apolice_id')
    .in('apolice_id', apolicesElegiveis.map(item => item.id))
  if (existentesError) throw existentesError

  const apoliceIdsComRenovacao = new Set((existentes ?? []).map(item => item.apolice_id))
  const faltantes = apolicesElegiveis.filter(item => !apoliceIdsComRenovacao.has(item.id))
  if (!faltantes.length) return { encontradas: apolicesElegiveis.length, criadas: 0 }

  const payload = faltantes.map(apolice => ({
    apolice_id: apolice.id,
    cliente_id: apolice.cliente_id,
    seguradora: apolice.seguradora,
    vigencia_fim: apolice.vigencia_fim,
    data_limite_envio: subtrairDias(apolice.vigencia_fim, PRAZO_ENVIO_ORCAMENTO_DIAS),
    status_cotacao: 'nao_cotada',
    status_renovacao: 'pendente',
    origem: 'sistema',
    nome_segurado_anterior: apolice.nome_cliente,
    numero_apolice_anterior: apolice.numero_apolice,
    premio_liquido_anterior: apolice.premio_liquido,
    pct_comissao_anterior: apolice.pct_comissao,
  }))

  const { error: insertError } = await supabase.from('renovacoes_auto').insert(payload)
  if (insertError) throw insertError

  return { encontradas: apolicesElegiveis.length, criadas: faltantes.length }
}
```

- [ ] **Step 2: Rodar build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auto.js
git commit -m "feat(auto): puxarRenovacoesDoSistema busca apolices emitidas no mes-alvo do ano anterior"
```

---

## Fase D — Puxar renovações por planilha (`01 COMISSÃO - AUTO.xlsx`)

### Task 8: Parser `src/lib/autoComissaoImport.js`

**Files:**
- Create: `src/lib/autoComissaoImport.js`
- Test: `src/lib/autoComissaoImport.test.mjs`

**Interfaces:**
- Consumes: `limparNomeSegurado` de `./autoHistoricoImport.js` (já existe)
- Produces: `extrairLinhasComissaoDaAba(rows)`, `parseAutoComissaoPlanilha(workbook, sheetName)` — consumidas pela Task 9 e pela UI da Task 11.

- [ ] **Step 1: Escrever o teste (vai falhar, arquivo não existe)**

Criar `src/lib/autoComissaoImport.test.mjs`:

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'

const { extrairLinhasComissaoDaAba, parseAutoComissaoPlanilha } = await import('./autoComissaoImport.js')

const HEADER = ['TRANSMISSÃO ', 'VIGÊNCIA', 'SEGURADO', 'QNT. DE PARCELAS', 'SEGURADORA', 'PREMIO LIQUIDO', '% COMISSAO', 'VALOR DA COMISSÃO', 'REPASSE COMISSÃO', 'CORRETOR', 'O QUE É ']

test('extrairLinhasComissaoDaAba le linhas de renovacao e converte data/percentual', () => {
  const rows = [
    HEADER,
    [46203, 46569, 'NICASSIA APARECIDA DE ARAUJO ', '1X', 'PORTO', 917.74, 0.2, 165.1932, '', '', 'RENOVAÇÃO '],
  ]
  const linhas = extrairLinhasComissaoDaAba(rows)
  assert.equal(linhas.length, 1)
  assert.equal(linhas[0].nome_cliente, 'NICASSIA APARECIDA DE ARAUJO')
  assert.equal(linhas[0].seguradora, 'PORTO')
  assert.equal(linhas[0].vigencia_fim, '2027-07-01')
  assert.equal(linhas[0].premio_liquido, 917.74)
  assert.equal(linhas[0].pct_comissao, 20)
  assert.equal(linhas[0].tipo, 'renovacao')
})

test('extrairLinhasComissaoDaAba ignora linha de endosso (VIGENCIA nao e data)', () => {
  const rows = [
    HEADER,
    [46205, 'ENDOSSO ', 'BRUNO YUDI AGUENA ', '1X', 'AZUL', 111.77, 0.13, 13.07709, '', '', 'ENDOSSO '],
  ]
  assert.equal(extrairLinhasComissaoDaAba(rows).length, 0)
})

test('extrairLinhasComissaoDaAba ignora linha sem segurado', () => {
  const rows = [HEADER, ['', '', '', '', '', '', '', '', '', '', '']]
  assert.equal(extrairLinhasComissaoDaAba(rows).length, 0)
})

test('parseAutoComissaoPlanilha filtra so linhas tipo RENOVACAO da aba pedida', () => {
  const rows = [
    HEADER,
    [46203, 46569, 'NICASSIA APARECIDA DE ARAUJO ', '1X', 'PORTO', 917.74, 0.2, 165.1932, '', '', 'RENOVAÇÃO '],
    [46205, 46570, 'BIANCA BAPTISTA SANTOS', '12x', 'PIER ', 2206.98, 0.15, 297.9423, '', '', 'NOVO '],
  ]
  const workbook = { SheetNames: ['JULHO 2026'], Sheets: { 'JULHO 2026': { '!ref': 'A1:K3' } } }
  // sheet_to_json real precisa de celulas no worksheet; usamos o helper direto
  // para nao depender de montar um worksheet XLSX completo neste teste.
  const linhas = extrairLinhasComissaoDaAba(rows).filter(item => item.tipo === 'renovacao')
  assert.equal(linhas.length, 1)
  assert.equal(linhas[0].nome_cliente, 'NICASSIA APARECIDA DE ARAUJO')
})
```

> Nota: o 4º teste testa a função de filtro por tipo diretamente sobre `extrairLinhasComissaoDaAba` (que já retorna `tipo`), em vez de montar um workbook XLSX real via `XLSX.utils.aoa_to_sheet` — mais simples e igualmente cobre a regra de negócio. `parseAutoComissaoPlanilha` (que lê o workbook de verdade) é validada manualmente no smoke test da Task 11 com o arquivo `01 COMISSÃO - AUTO.xlsx` real.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test src/lib/autoComissaoImport.test.mjs`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `src/lib/autoComissaoImport.js`**

```javascript
import * as XLSXModule from 'xlsx'
import { limparNomeSegurado } from './autoHistoricoImport.js'

const XLSX = XLSXModule.default ?? XLSXModule

function normalizeHeaderCell(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function excelDateToISO(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return ''
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  return ''
}

// Planilha guarda percentual como fracao (0.2 = 20%); a convencao do modulo
// Auto (ver auto.js: calcularValorComissaoAuto) e sempre percentual inteiro.
function percentToWholeNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value <= 1 ? value * 100 : value
  const raw = String(value).replace('%', '').replace(',', '.').trim()
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null
  return parsed <= 1 ? parsed * 100 : parsed
}

function findColumn(headerRow, labels) {
  for (let col = 0; col < headerRow.length; col += 1) {
    const header = normalizeHeaderCell(headerRow[col])
    if (labels.some(label => header === label || header.includes(label))) return col
  }
  return -1
}

export function extrairLinhasComissaoDaAba(rows) {
  if (!rows.length) return []
  const headerRow = rows[0]
  const cols = {
    vigencia: findColumn(headerRow, ['vigencia']),
    segurado: findColumn(headerRow, ['segurado']),
    seguradora: findColumn(headerRow, ['seguradora', 'cia']),
    premio: findColumn(headerRow, ['premio liquido']),
    pctComissao: findColumn(headerRow, ['comissao']),
    tipo: findColumn(headerRow, ['o que e']),
  }
  if (cols.segurado < 0) return []

  const result = []
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    const nome = limparNomeSegurado(row[cols.segurado])
    if (!nome) continue

    // Linhas de endosso guardam o texto "ENDOSSO" na coluna VIGENCIA em vez
    // de uma data — nao entram no "puxar renovacoes" (fora de escopo aqui).
    const vigenciaFim = cols.vigencia >= 0 ? excelDateToISO(row[cols.vigencia]) : ''
    if (!vigenciaFim) continue

    result.push({
      linha: rowIndex + 1,
      nome_cliente: nome,
      seguradora: cols.seguradora >= 0 ? cleanText(row[cols.seguradora]) : '',
      vigencia_fim: vigenciaFim,
      premio_liquido: cols.premio >= 0 && row[cols.premio] !== '' ? Number(row[cols.premio]) : null,
      pct_comissao: cols.pctComissao >= 0 ? percentToWholeNumber(row[cols.pctComissao]) : null,
      tipo: normalizeHeaderCell(cols.tipo >= 0 ? row[cols.tipo] : ''),
    })
  }
  return result
}

export function parseAutoComissaoPlanilha(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`Aba "${sheetName}" nao encontrada na planilha.`)
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
  return extrairLinhasComissaoDaAba(rows).filter(item => item.tipo === 'renovacao')
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `node --test src/lib/autoComissaoImport.test.mjs`
Expected: PASS (4 testes)

- [ ] **Step 5: Registrar o arquivo no script `test`**

Em `package.json`, adicionar `src/lib/autoComissaoImport.test.mjs` à lista (depois de `src/lib/auto.test.mjs`).

- [ ] **Step 6: Rodar a suíte completa**

Run: `npm test`
Expected: tudo verde.

- [ ] **Step 7: Commit**

```bash
git add src/lib/autoComissaoImport.js src/lib/autoComissaoImport.test.mjs package.json
git commit -m "feat(auto): parser da planilha 01 COMISSAO - AUTO.xlsx para puxar renovacoes"
```

---

### Task 9: `lib/auto.js` — `puxarRenovacoesDePlanilha` com deduplicação

**Files:**
- Modify: `src/lib/auto.js`

**Interfaces:**
- Consumes: `limparNomeSegurado`, `normalizeCompareText` (já importado no topo do arquivo, linha 2 — adicionar `limparNomeSegurado` ao import), `getRangeFromMonthRef` (já existe, linha 29), `PRAZO_ENVIO_ORCAMENTO_DIAS`/`subtrairDias` (Task 7)
- Produces: `puxarRenovacoesDePlanilha(mesRef, rows)` → `{ lidas, importadas, duplicadas }` — consumida pela Task 11.

- [ ] **Step 1: Atualizar o import do topo do arquivo**

Linha 2, trocar:

```javascript
import { normalizeCompareText, somarUmAno } from './autoHistoricoImport.js'
```

por:

```javascript
import { limparNomeSegurado, normalizeCompareText, somarUmAno } from './autoHistoricoImport.js'
```

- [ ] **Step 2: Implementar**, logo abaixo de `puxarRenovacoesDoSistema` (Task 7):

```javascript
export async function puxarRenovacoesDePlanilha(mesRef, rows = []) {
  if (!Array.isArray(rows) || !rows.length) return { lidas: 0, importadas: 0, duplicadas: 0 }

  const { inicio, fim } = getRangeFromMonthRef(mesRef, 0)
  const { data: existentesDb, error: existentesError } = await supabase
    .from('renovacoes_auto')
    .select('nome_segurado_anterior, apolices_auto(nome_cliente)')
    .gte('vigencia_fim', inicio)
    .lte('vigencia_fim', fim)
  if (existentesError) throw existentesError

  const nomesExistentes = new Set(
    (existentesDb ?? [])
      .map(item => normalizeCompareText(limparNomeSegurado(item.apolices_auto?.nome_cliente || item.nome_segurado_anterior || '')))
      .filter(Boolean)
  )

  const novas = []
  let duplicadas = 0
  for (const row of rows) {
    const nomeChave = normalizeCompareText(limparNomeSegurado(row.nome_cliente))
    if (!nomeChave || nomesExistentes.has(nomeChave)) {
      if (nomeChave) duplicadas += 1
      continue
    }
    nomesExistentes.add(nomeChave)
    novas.push({
      apolice_id: null,
      cliente_id: null,
      seguradora: row.seguradora || null,
      vigencia_fim: row.vigencia_fim,
      data_limite_envio: subtrairDias(row.vigencia_fim, PRAZO_ENVIO_ORCAMENTO_DIAS),
      status_cotacao: 'nao_cotada',
      status_renovacao: 'pendente',
      origem: 'xls',
      nome_segurado_anterior: row.nome_cliente,
      premio_liquido_anterior: row.premio_liquido,
      pct_comissao_anterior: row.pct_comissao,
    })
  }

  if (novas.length) {
    const { error: insertError } = await supabase.from('renovacoes_auto').insert(novas)
    if (insertError) throw insertError
  }

  return { lidas: rows.length, importadas: novas.length, duplicadas }
}
```

- [ ] **Step 3: Rodar build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auto.js
git commit -m "feat(auto): puxarRenovacoesDePlanilha importa e dedupe por nome do segurado"
```

---

## Fase E — UI: banner de virada de mês + painel "Puxar renovações"

### Task 10: Banner no `AutoDashboard.jsx`

**Files:**
- Modify: `src/pages/auto/AutoDashboard.jsx`

**Interfaces:**
- Consumes: `getMesAlvoRenovacao` (Task 4), `getAutoRenovacaoMesStatus` (Task 6)

- [ ] **Step 1: Adicionar os imports novos**

No topo do arquivo, junto aos imports existentes de `../../lib/auto` (linha 12-16) e `./autoShared` (se ainda não houver import local desse arquivo em `AutoDashboard.jsx`, adicionar):

```javascript
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import {
  BarChart3, CalendarDays, Car, FileText, RefreshCw, ShieldCheck, TrendingUp,
  DollarSign, Percent, AlertCircle, ArrowRight, Megaphone,
} from 'lucide-react'
import {
  getDashboardAutoMetrics,
  getGraficoEmissoesMensais,
  getGraficoCotacoesStatus,
  getAutoRenovacaoMesStatus,
} from '../../lib/auto'
import { getMesAlvoRenovacao } from './autoShared'
import { PageHeader, MetricCard, DataCard, EmptyState } from '../../components/ui'
```

(mantém tudo que já existia, só acrescenta `Megaphone` ao import de ícones e as duas novas funções/import de `autoShared`).

- [ ] **Step 2: Buscar o mes-alvo e seu status**

Dentro do componente `AutoDashboard`, logo após a declaração de `mesRef`/`monthLabel` (linhas 39-40), adicionar:

```javascript
  const mesesParaChecarStatus = useMemo(() => {
    const hoje = new Date()
    return Array.from({ length: 4 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - 2 + i, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }, [])

  const { data: statusPorMes = {} } = useQuery({
    queryKey: ['auto-renovacao-mes-status', mesesParaChecarStatus],
    queryFn: () => getAutoRenovacaoMesStatus(mesesParaChecarStatus),
  })

  const mesAlvoRenovacao = useMemo(() => getMesAlvoRenovacao(new Date(), statusPorMes), [statusPorMes])
  const mesAlvoLabel = useMemo(() => formatMonthRef(mesAlvoRenovacao || ''), [mesAlvoRenovacao])
```

`useMemo` já precisa estar importado de `react` — checar a primeira linha do arquivo (`import { useMemo, useState } from 'react'`) e manter como está (já inclui `useMemo`).

- [ ] **Step 3: Renderizar o banner**

Logo depois do `<PageHeader ... />` (fecha na linha ~119) e antes do primeiro `<DataCard className="overflow-hidden border-brand-accent/15" ...>` (linha 121), inserir:

```javascript
      {mesAlvoRenovacao && (
        <div className="flex flex-col gap-4 rounded-[28px] border border-status-warning/30 bg-status-warning/8 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
            <div>
              <p className="text-sm font-semibold text-dark-text">
                Organizar e puxar renovações do mês de {mesAlvoLabel}
              </p>
              <p className="mt-1 text-xs text-dark-muted">
                Faltam poucos dias para virar o mês — organize a carteira de renovações antes que o prazo aperte.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/auto/renovacoes?mes=${mesAlvoRenovacao}&puxar=1`)}
            className="btn-primary inline-flex shrink-0 items-center gap-2"
          >
            Organizar e puxar renovações
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
```

- [ ] **Step 4: Rodar build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 5: Smoke test manual (sem `.env`/Supabase neste ambiente, registrar como pendente)**

Documentar como pendência: abrir `/auto` com a data do sistema a menos de 15 dias do próximo mês virar, e confirmar que o banner aparece com o mês certo; confirmar que ele some quando `auto_renovacao_mes_status` tiver `concluido_em` para aquele mês (Task 11 cria esse fluxo).

- [ ] **Step 6: Commit**

```bash
git add src/pages/auto/AutoDashboard.jsx
git commit -m "feat(auto): banner de lembrete de virada de mes no Dashboard Auto"
```

---

### Task 11: Painel "Puxar renovações" em `AutoRenovacoes.jsx`

**Files:**
- Modify: `src/pages/auto/AutoRenovacoes.jsx`

**Interfaces:**
- Consumes: `puxarRenovacoesDoSistema`, `puxarRenovacoesDePlanilha`, `getAutoRenovacaoMesStatus`, `marcarMesRenovacaoConcluido` (Fase C/D), `parseAutoComissaoPlanilha` (Task 8), `useAuth` (`../../contexts/AuthContext`, já usado em `AutoEmissoes.jsx`), `useToast` (`../../contexts/ToastContext`, já usado em `AutoEmissoes.jsx`)
- Produces: painel visível na página, usado pelo link `?mes=X&puxar=1` vindo do banner (Task 10).

- [ ] **Step 1: Atualizar os imports**

No topo do arquivo, trocar:

```javascript
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, Clock, ExternalLink, RefreshCw, Send, XCircle } from 'lucide-react'
import { getRenovacoesAuto, iniciarCotacaoRenovacao } from '../../lib/auto'
```

por:

```javascript
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { CalendarClock, CheckCircle2, Clock, ExternalLink, RefreshCw, Send, Upload, XCircle } from 'lucide-react'
import {
  getAutoRenovacaoMesStatus,
  getRenovacoesAuto,
  iniciarCotacaoRenovacao,
  marcarMesRenovacaoConcluido,
  puxarRenovacoesDePlanilha,
  puxarRenovacoesDoSistema,
} from '../../lib/auto'
import { parseAutoComissaoPlanilha } from '../../lib/autoComissaoImport'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
```

(mantém o import de `SeguradoraBadge` e o import de `./autoShared` já existentes nas linhas 7-18, sem mudança).

- [ ] **Step 2: Ler o mês/flag da URL e abrir o painel automaticamente**

Dentro do componente `AutoRenovacoes`, logo após `const navigate = useNavigate()` (linha 58), adicionar:

```javascript
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [painelPuxarAberto, setPainelPuxarAberto] = useState(() => searchParams.get('puxar') === '1')
  const [mesParaPuxar, setMesParaPuxar] = useState(() => searchParams.get('mes') || currentMonthRef())
  const [resumoPuxar, setResumoPuxar] = useState(null)
  const xlsInputRef = useRef(null)
```

- [ ] **Step 3: Query do status do mês + mutations de puxar/marcar concluído**

Logo após a query `todasRenovacoes` (linha 70-73), adicionar:

```javascript
  const { data: statusMesPuxar } = useQuery({
    queryKey: ['auto-renovacao-mes-status-unico', mesParaPuxar],
    queryFn: async () => (await getAutoRenovacaoMesStatus([mesParaPuxar]))[mesParaPuxar] || null,
    enabled: painelPuxarAberto,
  })

  const { mutateAsync: puxarDoSistema, isPending: puxandoSistema } = useMutation({
    mutationFn: () => puxarRenovacoesDoSistema(mesParaPuxar),
    onSuccess: async resultado => {
      setResumoPuxar({ tipo: 'sistema', ...resultado })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
      toast({ type: 'success', title: 'Renovações puxadas', message: `${resultado.criadas} nova(s) de ${resultado.encontradas} encontrada(s).` })
    },
    onError: err => toast({ type: 'error', title: 'Erro ao puxar renovações', message: err?.message || 'Tente novamente.' }),
  })

  const { mutateAsync: puxarPlanilha, isPending: puxandoPlanilha } = useMutation({
    mutationFn: rows => puxarRenovacoesDePlanilha(mesParaPuxar, rows),
    onSuccess: async resultado => {
      setResumoPuxar({ tipo: 'xls', ...resultado })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
      toast({ type: 'success', title: 'Planilha importada', message: `${resultado.importadas} nova(s), ${resultado.duplicadas} duplicada(s) ignorada(s).` })
    },
    onError: err => toast({ type: 'error', title: 'Erro ao importar planilha', message: err?.message || 'Arquivo inválido.' }),
  })

  const { mutateAsync: marcarConcluido, isPending: marcandoConcluido } = useMutation({
    mutationFn: () => marcarMesRenovacaoConcluido(mesParaPuxar, user?.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auto-renovacao-mes-status-unico', mesParaPuxar] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacao-mes-status'] })
      toast({ type: 'success', title: 'Mês marcado como concluído' })
    },
    onError: err => toast({ type: 'error', title: 'Erro ao marcar mês concluído', message: err?.message || 'Tente novamente.' }),
  })

  async function handleUploadPlanilhaRenovacao(event) {
    const file = event.target.files?.[0]
    if (xlsInputRef.current) xlsInputRef.current.value = ''
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
      const abaAlvo = workbook.SheetNames.find(nome => nome.trim().toLowerCase() === searchParams.get('aba')?.toLowerCase())
        || workbook.SheetNames[workbook.SheetNames.length - 1]
      const rows = parseAutoComissaoPlanilha(workbook, abaAlvo)
      await puxarPlanilha(rows)
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao ler planilha', message: error?.message || 'Arquivo inválido ou fora do modelo esperado.' })
    }
  }
```

- [ ] **Step 4: Renderizar o painel**

Logo após o `<FilterBar>...</FilterBar>` (linha 188-204) e antes do `<DataCard title="Lista de renovações" ...>` (linha 206), inserir:

```javascript
      {painelPuxarAberto && (
        <DataCard
          title="Puxar renovações"
          subtitle="Traga para a lista as apólices que vencem no mês escolhido, a partir do sistema ou de uma planilha."
          actions={(
            <button onClick={() => setPainelPuxarAberto(false)} className="btn-secondary text-xs">Fechar</button>
          )}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 rounded-2xl border border-dark-border bg-dark-surface/75 px-3 py-2 text-sm text-dark-text">
                Mês a organizar
                <input
                  type="month"
                  value={mesParaPuxar}
                  onChange={e => { setMesParaPuxar(e.target.value); setResumoPuxar(null) }}
                  className="bg-transparent outline-none"
                />
              </label>
              {statusMesPuxar?.concluido_em ? (
                <span className="badge badge-success">Mês já marcado como concluído em {formatarData(statusMesPuxar.concluido_em.slice(0, 10))}</span>
              ) : (
                <span className="badge badge-warning">Mês ainda não concluído</span>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                <p className="text-sm font-semibold text-dark-text">Puxar do sistema</p>
                <p className="mt-1 text-xs text-dark-muted">Busca apólices emitidas no mesmo mês, um ano antes.</p>
                <button
                  onClick={() => puxarDoSistema()}
                  disabled={puxandoSistema}
                  className="btn-primary mt-3 inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {puxandoSistema ? 'Puxando...' : 'Puxar renovações do sistema'}
                </button>
              </div>
              <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                <p className="text-sm font-semibold text-dark-text">Puxar por planilha</p>
                <p className="mt-1 text-xs text-dark-muted">Suba a aba do mês-alvo um ano antes (ex.: para {formatarMes(mesParaPuxar)}, a aba de {formatarMes(shiftMonth(mesParaPuxar, -12))}).</p>
                <input
                  ref={xlsInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleUploadPlanilhaRenovacao}
                  className="hidden"
                  id="upload-planilha-renovacao"
                />
                <label
                  htmlFor="upload-planilha-renovacao"
                  className={`btn-secondary mt-3 inline-flex cursor-pointer items-center gap-2 ${puxandoPlanilha ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <Upload className="h-4 w-4" />
                  {puxandoPlanilha ? 'Importando...' : 'Selecionar planilha (.xlsx)'}
                </label>
              </div>
            </div>

            {resumoPuxar && (
              <div className="rounded-2xl border border-brand-accent/20 bg-brand-accent/5 px-4 py-3 text-sm text-dark-text">
                {resumoPuxar.tipo === 'sistema'
                  ? `${resumoPuxar.encontradas} apólice(s) encontrada(s), ${resumoPuxar.criadas} nova(s) renovação(ões) criada(s).`
                  : `${resumoPuxar.lidas} linha(s) lida(s), ${resumoPuxar.importadas} nova(s), ${resumoPuxar.duplicadas} duplicada(s) ignorada(s).`}
              </div>
            )}

            <div className="flex justify-end border-t border-dark-border/60 pt-4">
              <button
                onClick={() => marcarConcluido()}
                disabled={marcandoConcluido}
                className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
              >
                {marcandoConcluido ? 'Salvando...' : 'Marcar mês concluído'}
              </button>
            </div>
          </div>
        </DataCard>
      )}
```

- [ ] **Step 5: Botão para abrir/fechar o painel manualmente**

Nas `actions` do `<PageHeader>` (linha 129-134), adicionar um botão antes do botão "Abrir emissões":

```javascript
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value || currentMonthRef())} className="input" />
            <button onClick={() => setPainelPuxarAberto(v => !v)} className="btn-secondary">
              {painelPuxarAberto ? 'Ocultar puxar renovações' : 'Puxar renovações'}
            </button>
            <button onClick={() => navigate('/auto/emissoes')} className="btn-secondary">Abrir emissões</button>
          </div>
        )}
```

- [ ] **Step 6: Rodar build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 7: Smoke test manual (pendente, sem `.env`/Supabase neste ambiente)**

Depois de rodar a migration da Task 1: abrir `/auto/renovacoes?mes=2026-08&puxar=1`, clicar "Puxar renovações do sistema" e confirmar o resumo; subir a planilha real `01 COMISSÃO - AUTO.xlsx` (aba de um ano antes do mês escolhido) e confirmar que só as linhas novas entram (rodar de novo e confirmar que a segunda vez tudo aparece como duplicado); clicar "Marcar mês concluído" e confirmar que o banner do Dashboard (Task 10) some para aquele mês.

- [ ] **Step 8: Commit**

```bash
git add src/pages/auto/AutoRenovacoes.jsx
git commit -m "feat(auto): painel puxar renovacoes (sistema e planilha) + marcar mes concluido"
```

---

## Fase F — Lista de renovações do mês + Fazer Cotação + Cancelar

### Task 12: `lib/auto.js` — enriquecer `RENOVACAO_LISTA_SELECT`

**Files:**
- Modify: `src/lib/auto.js:906`

**Interfaces:**
- Produces: campos novos disponíveis em cada item retornado por `getRenovacoesAuto`/`getAutoRenovacoesResumo`, consumidos pela Task 13.

- [ ] **Step 1: Atualizar o select**

Linha 906, trocar:

```javascript
const RENOVACAO_LISTA_SELECT = '*, clientes_auto(nome_completo, telefone, celular, email), apolices_auto(id, emissao_id, numero_apolice, seguradora, vigencia_inicio, vigencia_fim, premio_liquido, valor_comissao, forma_pagamento, parcelamento, nome_cliente, modelo_veiculo, placa, created_at), cotacoes_auto:cotacao_id(id, status, tipo, created_at, emissoes_auto(coluna))'
```

por:

```javascript
const RENOVACAO_LISTA_SELECT = '*, clientes_auto(nome_completo, telefone, celular, email), apolices_auto(id, emissao_id, numero_apolice, seguradora, vigencia_inicio, vigencia_fim, premio_liquido, pct_comissao, valor_comissao, forma_pagamento, parcelamento, nome_cliente, modelo_veiculo, placa, created_at, renovacao_premio_liquido_ano_anterior, renovacao_comissao_ano_anterior), cotacoes_auto:cotacao_id(id, status, tipo, created_at, emissoes_auto(coluna))'
```

(acrescenta `pct_comissao, renovacao_premio_liquido_ano_anterior, renovacao_comissao_ano_anterior` ao sub-select de `apolices_auto` — usados por `getComissaoAtualAnterior`, Task 5).

- [ ] **Step 2: Rodar build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auto.js
git commit -m "feat(auto): getRenovacoesAuto traz pct_comissao e comparativo do ano anterior da apolice"
```

---

### Task 13: `lib/auto.js` — `cancelarRenovacao`

**Files:**
- Modify: `src/lib/auto.js`

**Interfaces:**
- Produces: `cancelarRenovacao(id, motivo)` — consumida pela Task 14.

- [ ] **Step 1: Implementar**, logo abaixo de `atualizarStatusRenovacao` (linha ~936):

```javascript
export async function cancelarRenovacao(id, motivo) {
  const { error } = await supabase
    .from('renovacoes_auto')
    .update({ status_renovacao: 'nao_renovada', motivo_cancelamento: motivo || null })
    .eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Rodar build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auto.js
git commit -m "feat(auto): cancelarRenovacao marca status_renovacao=nao_renovada com motivo"
```

---

### Task 14: `AutoRenovacoes.jsx` — lista atualizada, "Fazer Cotação" e "Cancelar"

**Files:**
- Modify: `src/pages/auto/AutoRenovacoes.jsx`

**Interfaces:**
- Consumes: `getRenovacaoAreaStatus`, `RENOVACAO_AREA_STATUS_META`, `getComissaoAtualAnterior` (Task 5), `cancelarRenovacao` (Task 13)

- [ ] **Step 1: Atualizar o import de `./autoShared`**

Trocar (linha 8-18):

```javascript
import {
  RENOVACAO_STATUS,
  monthKey,
  diasParaVencer,
  formatDiasParaVencer,
  getRenovacaoUrgencia,
  RENOVACAO_URGENCIA_META,
  getRenewalQuoteStatus,
  RENEWAL_QUOTE_STATUS_META,
  toneClasses,
} from './autoShared'
```

por:

```javascript
import {
  RENOVACAO_STATUS,
  monthKey,
  diasParaVencer,
  formatDiasParaVencer,
  getRenovacaoUrgencia,
  RENOVACAO_URGENCIA_META,
  getRenovacaoAreaStatus,
  RENOVACAO_AREA_STATUS_META,
  getComissaoAtualAnterior,
  toneClasses,
} from './autoShared'
```

(`getRenewalQuoteStatus`/`RENEWAL_QUOTE_STATUS_META` saem de uso nesta página — a Task 5 os substitui pela versão que reflete a coluna real do Kanban; eles continuam existindo em `autoShared.js` para não quebrar nenhum outro consumidor, mas não são mais importados aqui).

- [ ] **Step 2: Adicionar mutation de cancelar**

Junto das outras mutations (perto de `cotarRenovacao`, linha 77-86), adicionar:

```javascript
  const { mutateAsync: cancelarRenovacaoAsync, isPending: cancelando } = useMutation({
    mutationFn: ({ id, motivo }) => cancelarRenovacao(id, motivo),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
    },
  })

  function handleCancelar(id) {
    const motivo = window.prompt('Motivo do cancelamento (opcional):')
    if (motivo === null) return
    cancelarRenovacaoAsync({ id, motivo: motivo || null })
  }
```

Adicionar `cancelarRenovacao` ao import de `../../lib/auto` (linha 5):

```javascript
import { cancelarRenovacao, getRenovacoesAuto, iniciarCotacaoRenovacao } from '../../lib/auto'
```

- [ ] **Step 3: Trocar os badges de status na lista principal**

No card de cada item (dentro do `.map` que renderiza `renovacoes`, por volta da linha 213-300), trocar o trecho que hoje usa `getRenewalQuoteStatus`/`RENEWAL_QUOTE_STATUS_META`:

```javascript
              const quoteStatusKey = getRenewalQuoteStatus(item)
              const quoteStatus = RENEWAL_QUOTE_STATUS_META[quoteStatusKey]
```

por:

```javascript
              const areaStatusKey = getRenovacaoAreaStatus(item)
              const areaStatus = RENOVACAO_AREA_STATUS_META[areaStatusKey]
              const comissao = getComissaoAtualAnterior(item)
```

E o badge que usava `quoteStatus`:

```javascript
                        <span className={`badge ${toneClasses(quoteStatus.tone)}`}>{quoteStatus.label}</span>
```

por:

```javascript
                        <span className={`badge ${toneClasses(areaStatus.tone)}`}>{areaStatus.label}</span>
```

Adicionar, no grid de informações do card (mesmo padrão dos outros `<div className="rounded-2xl border border-white/60 bg-white/70 p-3">` já existentes), um bloco novo com data limite e comissões:

```javascript
                        <div className="rounded-2xl border border-white/60 bg-white/70 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Prazo e comissão</p>
                          <p className="mt-1 text-xs text-dark-muted">Limite p/ envio: {formatarData(item.data_limite_envio)}</p>
                          <p className="mt-1 text-xs text-dark-muted">
                            Comissão atual: {comissao.atual != null ? `${comissao.atual}%` : '—'} · anterior: {comissao.anterior != null ? `${comissao.anterior}%` : '—'}
                          </p>
                        </div>
```

- [ ] **Step 4: Trocar o botão "Cotar" por "Fazer Cotação" e adicionar "Cancelar"**

No bloco de ações do card (linha 274-298), trocar o texto do botão:

```javascript
                        <button
                          onClick={() => handleCotar(item.id)}
                          disabled={isCotando}
                          className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {isCotando ? 'Criando cotação...' : 'Cotar'}
                        </button>
```

por:

```javascript
                        <button
                          onClick={() => handleCotar(item.id)}
                          disabled={isCotando}
                          className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {isCotando ? 'Criando cotação...' : 'Fazer Cotação'}
                        </button>
```

E adicionar, logo abaixo do bloco `{apoliceId && (...)}` (linha 292-297), um botão de cancelar visível apenas quando a renovação ainda não foi concluída:

```javascript
                      {areaStatusKey !== 'renovado' && areaStatusKey !== 'cancelado' && (
                        <button
                          onClick={() => handleCancelar(item.id)}
                          disabled={cancelando}
                          className="rounded-2xl border border-status-danger/30 bg-status-danger/5 px-3 py-2 text-xs font-semibold text-status-danger transition-colors hover:bg-status-danger/10 disabled:opacity-60"
                        >
                          Cancelar renovação
                        </button>
                      )}
```

- [ ] **Step 5: Repetir a troca de badge na tabela "Acompanhar renovações"**

Na tabela (linha 384-396), trocar:

```javascript
                  const quoteStatusKey = getRenewalQuoteStatus(item)
                  const cotacaoInfo = RENEWAL_QUOTE_STATUS_META[quoteStatusKey]
```

por:

```javascript
                  const areaStatusKeyTabela = getRenovacaoAreaStatus(item)
                  const cotacaoInfo = RENOVACAO_AREA_STATUS_META[areaStatusKeyTabela]
```

- [ ] **Step 6: Rodar build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add src/pages/auto/AutoRenovacoes.jsx
git commit -m "feat(auto): lista de renovacoes com status real do kanban, prazo, comissao e cancelar"
```

---

## Fase G — Formulário reduzido ao arrastar para "Proposta Transmitida"

### Task 15: `AutoEmissoes.jsx` — data de emissão, fim de vigência automático e tipo somente-leitura

**Files:**
- Modify: `src/pages/auto/AutoEmissoes.jsx`

**Interfaces:**
- Consumes: `calcularValorComissaoAuto` (Task 2/3, já importado na Task 3)

- [ ] **Step 1: Adicionar `data_emissao` aos formulários vazios**

Em `FORM_EMISSAO_VAZIO` (linha 39-67), `FORM_MANUAL_VAZIO` (linha 69-96) e `FORM_EDICAO_VAZIO` (linha 107-156), adicionar o campo logo após `numero_apolice`:

```javascript
  numero_apolice: '',
  data_emissao: '',
```

- [ ] **Step 2: Preencher `data_emissao` com hoje ao abrir o modal**

Em `getFormEmissaoInicial` (linha 364-417), no objeto de retorno, adicionar:

```javascript
    numero_apolice: emissao?.numero_apolice || c.numero_orcamento || '',
    data_emissao: emissao?.data_emissao || new Date().toISOString().slice(0, 10),
```

(troca a linha 387 existente por essas duas — mantém o `numero_apolice` como já era, só acrescenta `data_emissao` com default hoje).

- [ ] **Step 3: Calcular `vigencia_fim` automaticamente a partir de `vigencia_inicio`**

Usar a função `somarUmAno` já existente em `src/lib/autoHistoricoImport.js` (linha 23-32). No topo do arquivo, adicionar ao import (linha 20):

```javascript
import { limparNomeSegurado, parseAutoHistoricoPlanilha, somarUmAno } from '../../lib/autoHistoricoImport.js'
```

No corpo do componente `AutoEmissoes`, logo após a declaração de `premioLiquido`/`pctComissao`/`valorComissao` (linha 1612-1614, já editada na Task 3), adicionar um `useEffect` que recalcula `vigencia_fim` sempre que `vigencia_inicio` mudar e o usuário não tiver digitado um valor diferente do calculado:

```javascript
  useEffect(() => {
    if (!form.vigencia_inicio) return
    const calculado = somarUmAno(form.vigencia_inicio)
    if (calculado && form.vigencia_fim !== calculado && !form._vigenciaFimEditadaManualmente) {
      setForm(current => ({ ...current, vigencia_fim: calculado }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vigencia_inicio])
```

E no `CampoTexto` de "Vigencia fim" (linha 2305), marcar que uma edição manual não deve mais ser sobrescrita — trocar:

```javascript
                    <CampoTexto label="Vigencia fim" campo="vigencia_fim" value={form.vigencia_fim} onChange={setField} type="date" />
```

por:

```javascript
                    <CampoTexto
                      label="Vigencia fim (automático, editável)"
                      campo="vigencia_fim"
                      value={form.vigencia_fim}
                      onChange={(campo, valor) => { setField(campo, valor); setField('_vigenciaFimEditadaManualmente', true) }}
                      type="date"
                    />
```

- [ ] **Step 4: Adicionar o campo "Data de emissão" e trocar "Parcelamento" por um número de parcelas**

No grid de campos (linha 2281-2310, já mexido na Task 3 do modal — usar como referência as mesmas linhas), adicionar `CampoTexto` de data de emissão logo no início do grid, e trocar o campo de parcelamento por um input numérico com sufixo "x":

```javascript
                  <div className="grid gap-4 md:grid-cols-2">
                    <CampoTexto label="Data de emissão" campo="data_emissao" value={form.data_emissao} onChange={setField} type="date" />
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradora</label>
                      {seguradorasAprovadas.length > 0 ? (
                        <select
                          value={form.seguradora}
                          onChange={e => setField('seguradora', e.target.value)}
                          className="w-full rounded-2xl border border-dark-border bg-dark-surface/90 px-3 py-2 text-sm text-dark-text outline-none"
                        >
                          <option value="">Selecionar seguradora aprovada</option>
                          {seguradorasAprovadas.map(seg => (
                            <option key={seg.nome} value={seg.nome}>
                              {seg.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="rounded-2xl border border-dark-border bg-dark-surface/70 px-3 py-2 text-sm text-dark-muted">
                          Nenhuma seguradora aprovada nesta ficha
                        </div>
                      )}
                    </div>
                    <CampoTexto label="Numero da apolice" campo="numero_apolice" value={form.numero_apolice} onChange={setField} />
                    <CampoTexto label="Vigencia inicio" campo="vigencia_inicio" value={form.vigencia_inicio} onChange={setField} type="date" />
                    <CampoTexto
                      label="Vigencia fim (automático, editável)"
                      campo="vigencia_fim"
                      value={form.vigencia_fim}
                      onChange={(campo, valor) => { setField(campo, valor); setField('_vigenciaFimEditadaManualmente', true) }}
                      type="date"
                    />
                    <CampoTexto label="Premio liquido" campo="premio_liquido" value={form.premio_liquido} onChange={setField} type="text" inputMode="decimal" />
                    <CampoTexto label="% Comissao" campo="pct_comissao" value={form.pct_comissao} onChange={setField} type="text" inputMode="decimal" />
                    <CampoTexto label="Forma de pagamento" campo="forma_pagamento" value={form.forma_pagamento} onChange={setField} />
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Quantidade de parcelas</label>
                      <input
                        type="number"
                        min="1"
                        value={String(form.parcelamento || '').replace(/x$/i, '')}
                        onChange={e => setField('parcelamento', e.target.value ? `${e.target.value}x` : '')}
                        className="w-full rounded-2xl border border-dark-border bg-dark-surface/90 px-3 py-2 text-sm text-dark-text outline-none"
                        placeholder="Ex.: 12"
                      />
                    </div>
                  </div>
```

(isto substitui o bloco original das linhas 2281-2310).

- [ ] **Step 5: Trocar o checkbox `eh_renovacao` por um badge somente-leitura derivado do tipo real**

Buscar no arquivo o trecho que renderiza o toggle de "É renovação" (checkbox ligado a `form.eh_renovacao` dentro do modal de emissão) e substituir sua exibição por um badge de leitura, calculado a partir de `modalEmissao?.cotacoes_auto?.tipo || modalEmissao?.tipo`:

```javascript
                  <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Tipo (automático)</p>
                    <span className="badge badge-info">
                      {(() => {
                        const tipoReal = modalEmissao?.cotacoes_auto?.tipo || modalEmissao?.tipo || 'novo'
                        if (tipoReal === 'renovacao') return 'Renovação'
                        if (tipoReal === 'endosso') return 'Endosso'
                        return 'Seguro novo'
                      })()}
                    </span>
                  </div>
```

> Este bloco substitui a seção de checkbox `eh_renovacao` do modal de emissão (não do editor JSON avançado, que continua com o campo editável para correções pontuais). `form.eh_renovacao` continua existindo no payload enviado a `emitirApoliceAuto` — a próxima task (16) troca seu valor para ser derivado automaticamente em vez de vir do checkbox.

- [ ] **Step 6: Rodar build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add src/pages/auto/AutoEmissoes.jsx
git commit -m "feat(auto): formulario de emissao com data de emissao, vigencia fim automatica e tipo somente leitura"
```

---

### Task 16: `auto.js` — `emitirApoliceAuto` grava `data_emissao` e deriva `eh_renovacao`/comparativo automaticamente

**Files:**
- Modify: `src/lib/auto.js:126-155` (`buildApoliceAutoPayload`), `src/lib/auto.js:720-803` (`emitirApoliceAuto`)
- Modify: `src/pages/auto/AutoEmissoes.jsx` (`handleEmitir`)

**Interfaces:**
- Consumes: nada novo
- Produces: `apolices_auto.data_emissao` gravado; `eh_renovacao` passa a ser derivado do `tipo` da cotação, não de um checkbox manual.

- [ ] **Step 1: Adicionar `data_emissao` ao payload da apólice**

Em `buildApoliceAutoPayload` (linha 126-155), adicionar o campo:

```javascript
    numero_apolice: payload.numero_apolice || null,
    data_emissao: payload.data_emissao || null,
    vigencia_inicio: payload.vigencia_inicio || null,
```

- [ ] **Step 2: Derivar `eh_renovacao` do tipo real em vez de aceitar o valor cru do payload**

Em `emitirApoliceAuto` (linha 720), logo após a declaração de `clienteId`/`premioLiquido`/`pctComissao`/`valorComissao`/`comparativoRenovacao` (linhas 721-725), adicionar:

```javascript
  const ehRenovacao = payload.tipo === 'renovacao' || Boolean(payload.eh_renovacao)
  const payloadComTipoDerivado = { ...payload, eh_renovacao: ehRenovacao }
```

E trocar as referências a `payload` usadas para montar `emissaoUpdate` (linha 752, `tem_repasse: !!payload.tem_repasse` já cobre o resto) e `buildApoliceAutoPayload`/`buildRenewalComparisonPayload` para usar `payloadComTipoDerivado` no lugar de `payload` nessas duas chamadas específicas:

```javascript
  const comparativoRenovacao = buildRenewalComparisonPayload(payloadComTipoDerivado, premioLiquido, valorComissao)
```

(mover esta linha para depois da declaração de `payloadComTipoDerivado`, substituindo a antiga linha 725) e:

```javascript
  const apolicePayload = buildApoliceAutoPayload(payloadComTipoDerivado, clienteId, premioLiquido, pctComissao, valorComissao, comparativoRenovacao, valorRepasse)
```

(substitui a linha 775 original).

- [ ] **Step 3: Passar `data_emissao` e `tipo` no `handleEmitir` de `AutoEmissoes.jsx`**

Em `handleEmitir` (`src/pages/auto/AutoEmissoes.jsx`, linha 1627-1661), adicionar ao objeto passado para `emitirAsync`:

```javascript
  function handleEmitir() {
    emitirAsync({
      emissao_id: modalEmissao.id,
      cliente_id: modalEmissao.cliente_id,
      tipo: modalEmissao.cotacoes_auto?.tipo || modalEmissao.tipo || 'novo',
      data_emissao: form.data_emissao || null,
      nome_cliente: modalEmissao.cotacoes_auto?.nome_cliente || modalEmissao.nome_cliente || null,
```

(acrescenta `tipo` e `data_emissao` logo após `cliente_id`, mantendo todo o resto do objeto como já estava).

- [ ] **Step 4: Rodar build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 5: Smoke test manual (pendente, sem `.env`/Supabase neste ambiente)**

Arrastar um card tipo Renovação para "Proposta Transmitida", confirmar que o badge de tipo mostra "Renovação" sem precisar marcar nada manualmente, preencher os campos mínimos e confirmar que a apólice criada tem `data_emissao` gravada e `eh_renovacao=true` sem o checkbox antigo.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auto.js src/pages/auto/AutoEmissoes.jsx
git commit -m "feat(auto): data_emissao gravada na apolice e eh_renovacao derivado do tipo real"
```

---

## Fase H — Cotação de Endosso

### Task 17: `lib/auto.js` — `criarCotacaoEndosso`

**Files:**
- Modify: `src/lib/auto.js`

**Interfaces:**
- Consumes: `criarCotacaoAuto` (já existe, linha 338), `getClienteAutoDetalhe` (já existe, linha 1370 — reaproveitada para listar apólices do cliente por vigência, já vem ordenada por `vigencia_inicio desc`)
- Produces: `criarCotacaoEndosso(payload)` — consumida pela Task 18.

- [ ] **Step 1: Implementar**, logo abaixo de `cancelarRenovacao` (Task 13):

```javascript
export async function criarCotacaoEndosso({
  cliente_id,
  apolice_id,
  motivo,
  campo_alterado,
  valor_anterior,
  valor_atual,
  valor_endosso,
}) {
  if (!apolice_id) throw new Error('Selecione a apólice a ser endossada.')
  if (!motivo || !motivo.trim()) throw new Error('Informe o motivo do endosso.')

  const { data: apolice, error: apoliceError } = await supabase
    .from('apolices_auto')
    .select('id, cliente_id, nome_cliente, cpf_cliente, celular_cliente, condutor_nome, condutor_cpf, modelo_veiculo, placa, seguradora, numero_apolice, vigencia_inicio, vigencia_fim')
    .eq('id', apolice_id)
    .single()
  if (apoliceError) throw apoliceError

  const cotacao = await criarCotacaoAuto({
    cliente_id: cliente_id || apolice.cliente_id,
    tipo: 'endosso',
    status: 'pendente',
    nome_cliente: apolice.nome_cliente,
    cpf_cliente: apolice.cpf_cliente,
    celular_cliente: apolice.celular_cliente,
    condutor_nome: apolice.condutor_nome,
    condutor_cpf: apolice.condutor_cpf,
    modelo_veiculo: apolice.modelo_veiculo,
    placa: apolice.placa,
    vigencia_inicio: apolice.vigencia_inicio,
    vigencia_fim: apolice.vigencia_fim,
  })

  const { data: endosso, error: endossoError } = await supabase
    .from('endossos_auto')
    .insert({
      apolice_id,
      cotacao_id: cotacao.id,
      motivo: motivo.trim(),
      campo_alterado: campo_alterado || null,
      valor_anterior: valor_anterior || null,
      valor_atual: valor_atual || null,
      valor_endosso: valor_endosso === '' || valor_endosso === undefined ? null : Number(valor_endosso),
    })
    .select()
    .single()
  if (endossoError) throw endossoError

  return { cotacao, endosso }
}
```

- [ ] **Step 2: Rodar build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auto.js
git commit -m "feat(auto): criarCotacaoEndosso cria cotacao tipo endosso + registro em endossos_auto"
```

---

### Task 18: UI — aba "Endosso" em `AutoCotacoes.jsx`

**Files:**
- Modify: `src/pages/auto/AutoCotacoes.jsx`

**Interfaces:**
- Consumes: `criarCotacaoEndosso` (Task 17), `getClienteAutoDetalhe` (já existe em `src/lib/auto.js`)

- [ ] **Step 1: Adicionar a aba "Endosso" e os imports**

Linha 26-30, trocar:

```javascript
const LISTA_TABS = [
  { value: 'lista', label: 'Lista' },
  { value: 'novo', label: 'Novo seguro' },
  { value: 'renovacao', label: 'Renovacao' },
]
```

por:

```javascript
const LISTA_TABS = [
  { value: 'lista', label: 'Lista' },
  { value: 'novo', label: 'Novo seguro' },
  { value: 'renovacao', label: 'Renovacao' },
  { value: 'endosso', label: 'Endosso' },
]
```

Linha 16-23, adicionar `criarCotacaoEndosso` e `buscarClientePorCpf` (já existe em `auto.js`, linha 300) ao import:

```javascript
import {
  buscarClientePorCpf,
  criarCotacaoAuto,
  criarCotacaoEndosso,
  getAutoCotacoesMensais,
  getAutoCotacoesResumo,
  getClienteAutoDetalhe,
  getCotacoesAuto,
  getRenovacoesDisponiveisParaCotacao,
  iniciarCotacaoRenovacao,
} from '../../lib/auto'
```

- [ ] **Step 2: Adicionar estado local para o fluxo de endosso**

Junto dos outros `useState` do componente (perto de `searchRenovacao`/`renovacaoSelecionadaId`), adicionar:

```javascript
  const [endossoBuscaCliente, setEndossoBuscaCliente] = useState('')
  const [endossoClienteRef, setEndossoClienteRef] = useState(null)
  const [endossoApoliceId, setEndossoApoliceId] = useState('')
  const [endossoForm, setEndossoForm] = useState({ motivo: '', campo_alterado: '', valor_anterior: '', valor_atual: '', valor_endosso: '' })
```

- [ ] **Step 3: Query do cliente + mutation de criar endosso**

Junto das outras queries/mutations (perto de `renovacoesDisponiveis`/`cotarRenovacaoSelecionada`), adicionar:

```javascript
  const { data: endossoCliente, isFetching: buscandoEndossoCliente } = useQuery({
    queryKey: ['auto-endosso-cliente', endossoClienteRef],
    queryFn: () => getClienteAutoDetalhe(endossoClienteRef),
    enabled: Boolean(endossoClienteRef),
  })

  const { mutateAsync: salvarEndosso, isPending: salvandoEndosso } = useMutation({
    mutationFn: () => criarCotacaoEndosso({
      cliente_id: endossoCliente?.cliente?.id,
      apolice_id: endossoApoliceId,
      motivo: endossoForm.motivo,
      campo_alterado: endossoForm.campo_alterado,
      valor_anterior: endossoForm.valor_anterior,
      valor_atual: endossoForm.valor_atual,
      valor_endosso: endossoForm.valor_endosso,
    }),
    onSuccess: async ({ cotacao }) => {
      setErro(null)
      setEndossoBuscaCliente('')
      setEndossoClienteRef(null)
      setEndossoApoliceId('')
      setEndossoForm({ motivo: '', campo_alterado: '', valor_anterior: '', valor_atual: '', valor_endosso: '' })
      await invalidar()
      navigate(`/auto/cotacoes/${cotacao.id}`)
    },
    onError: err => setErro(err?.message || 'Erro ao salvar endosso.'),
  })

  async function handleBuscarEndossoCliente() {
    const termo = endossoBuscaCliente.trim()
    if (!termo) return
    setEndossoApoliceId('')
    setEndossoClienteRef(termo)
  }
```

- [ ] **Step 4: Renderizar a aba**

No bloco condicional que renderiza cada `tab` (onde hoje existe `tab === 'renovacao' ? (...) : ...`), adicionar mais um ramo:

```javascript
          ) : tab === 'endosso' ? (
            <DataCard title="Nova cotação de endosso" subtitle="Busque o cliente, selecione a apólice pela vigência e descreva a alteração.">
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Buscar cliente (nome ou CPF)" value={endossoBuscaCliente} onChange={setEndossoBuscaCliente} placeholder="Nome ou CPF" />
                  <button onClick={handleBuscarEndossoCliente} disabled={buscandoEndossoCliente} className="btn-secondary disabled:opacity-60">
                    {buscandoEndossoCliente ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>

                {endossoCliente?.apolices?.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-dark-muted">Apólice (mais recente primeiro)</label>
                    <select
                      value={endossoApoliceId}
                      onChange={e => setEndossoApoliceId(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Selecionar apólice</option>
                      {endossoCliente.apolices.map(apolice => (
                        <option key={apolice.id} value={apolice.id}>
                          {apolice.numero_apolice || 'Sem número'} · {apolice.seguradora} · vigência {apolice.vigencia_inicio} a {apolice.vigencia_fim}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {endossoClienteRef && !buscandoEndossoCliente && !endossoCliente?.apolices?.length && (
                  <p className="text-sm text-dark-muted">Nenhuma apólice encontrada para este cliente.</p>
                )}

                {endossoApoliceId && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Motivo do endosso" value={endossoForm.motivo} onChange={v => setEndossoForm(f => ({ ...f, motivo: v }))} placeholder="Ex.: troca de veículo" />
                    <Field label="Campo alterado" value={endossoForm.campo_alterado} onChange={v => setEndossoForm(f => ({ ...f, campo_alterado: v }))} placeholder="Ex.: Placa" />
                    <Field label="Informação anterior" value={endossoForm.valor_anterior} onChange={v => setEndossoForm(f => ({ ...f, valor_anterior: v }))} />
                    <Field label="Informação atualizada" value={endossoForm.valor_atual} onChange={v => setEndossoForm(f => ({ ...f, valor_atual: v }))} />
                    <Field label="Valor do endosso" value={endossoForm.valor_endosso} onChange={v => setEndossoForm(f => ({ ...f, valor_endosso: v }))} type="text" inputMode="decimal" placeholder="0,00" />
                  </div>
                )}

                {endossoApoliceId && (
                  <button
                    onClick={() => salvarEndosso()}
                    disabled={salvandoEndosso || !endossoForm.motivo.trim()}
                    className="btn-primary disabled:opacity-60"
                  >
                    {salvandoEndosso ? 'Salvando...' : 'Criar cotação de endosso'}
                  </button>
                )}
              </div>
            </DataCard>
```

(inserir este ramo `else if` entre o bloco existente de `renovacao` e o fechamento do encadeamento ternário/condicional que já existe para `lista`/`novo`/`renovacao`).

- [ ] **Step 5: Rodar build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 6: Smoke test manual (pendente, sem `.env`/Supabase neste ambiente)**

Buscar um cliente com apólice ativa, selecionar a apólice, preencher motivo/campo/valores e confirmar que cria a cotação tipo Endosso e que ela aparece no Kanban de Gestão Auto com uma etiqueta própria.

- [ ] **Step 7: Commit**

```bash
git add src/pages/auto/AutoCotacoes.jsx
git commit -m "feat(auto): aba de cotacao de endosso (buscar cliente, selecionar apolice, motivo e comparacao)"
```

---

### Task 19: `AutoEmissoes.jsx` — endosso emitido atualiza a apólice existente em vez de criar uma nova

**Files:**
- Modify: `src/lib/auto.js:720-803` (`emitirApoliceAuto`)

**Interfaces:**
- Consumes: `endossos_auto` (Task 1)

Quando um card tipo `endosso` chega em "Apólice Emitida", não deve inserir uma nova linha em `apolices_auto` — deve atualizar a apólice já referenciada em `endossos_auto.apolice_id` com os dados informados no formulário reduzido (mesmo formulário da Task 15/16).

- [ ] **Step 1: Ramificar `emitirApoliceAuto` para o caso de endosso**

Em `emitirApoliceAuto` (linha 773-802, o trecho que roda quando `colunaDestino === 'apolice_emitida'`), antes do `insert` em `apolices_auto`, adicionar a checagem de endosso:

```javascript
  if (colunaDestino !== 'apolice_emitida') return { emissao: { id: payload.emissao_id }, apolice: null }

  if (payloadComTipoDerivado.tipo === 'endosso' && payload.cotacao_id) {
    const { data: endosso, error: endossoError } = await supabase
      .from('endossos_auto')
      .select('apolice_id')
      .eq('cotacao_id', payload.cotacao_id)
      .maybeSingle()
    if (endossoError) throw endossoError

    if (endosso?.apolice_id) {
      const apolicePayloadEndosso = buildApoliceAutoPayload(payloadComTipoDerivado, clienteId, premioLiquido, pctComissao, valorComissao, comparativoRenovacao, valorRepasse)
      const { data: apoliceAtualizada, error: updateError } = await supabase
        .from('apolices_auto')
        .update({ ...apolicePayloadEndosso, emissao_id: payload.emissao_id, data_emissao: payload.data_emissao || null })
        .eq('id', endosso.apolice_id)
        .select()
        .single()
      if (updateError) throw updateError
      await concluirCotacaoEVincularRenovacao(payload.cotacao_id)
      return apoliceAtualizada
    }
  }

  const apolicePayload = buildApoliceAutoPayload(payloadComTipoDerivado, clienteId, premioLiquido, pctComissao, valorComissao, comparativoRenovacao, valorRepasse)
```

(mantém o restante do bloco original — `insert` em `apolices_auto` — como fallback para novo/renovação e para endosso sem `apolice_id` vinculado).

- [ ] **Step 2: Rodar build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 3: Smoke test manual (pendente, sem `.env`/Supabase neste ambiente)**

Criar um endosso (Task 18), arrastar o card até "Apólice Emitida" preenchendo o formulário reduzido, e confirmar no banco que a apólice ORIGINAL foi atualizada (mesmo `id`), não uma nova linha criada.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auto.js
git commit -m "feat(auto): endosso emitido atualiza a apolice existente em vez de criar uma nova"
```

---

## Self-Review

**1. Cobertura do spec:**
- Frente 1 (lembrete + puxar do sistema): Tasks 1, 4, 6, 7, 10, 11. ✓
- Frente 2 (lista do mês, Fazer Cotação, formulário reduzido, fórmula de comissão, tipo automático): Tasks 2, 3, 5, 12, 13, 14, 15, 16. ✓
- Frente 3 (upload XLS com dedup): Tasks 1, 8, 9, 11. ✓
- Frente 4 (endosso): Tasks 1, 17, 18, 19. ✓
- "Seguro novo" mesma forma: já reaproveita o mesmo modal reduzido (Task 15/16) sem mudança de pipeline adicional — coberto por construção, sem task própria.

**2. Placeholders:** nenhum "TBD"/"implementar depois" — os únicos passos sem código são migrations aguardando execução manual do usuário (padrão já existente no projeto, documentado explicitamente) e smoke tests manuais (justificados: sem `.env`/Supabase neste ambiente, mesmo padrão de todas as sessões anteriores registradas em `docs/CURRENT_TASK.md`).

**3. Consistência de tipos/nomes:** `calcularValorComissaoAuto`, `getMesAlvoRenovacao`, `getRenovacaoAreaStatus`, `getComissaoAtualAnterior`, `puxarRenovacoesDoSistema`, `puxarRenovacoesDePlanilha`, `cancelarRenovacao`, `criarCotacaoEndosso` são usados com a mesma assinatura em todas as tasks que os consomem (conferido task a task ao escrever).

---

## Execução

Plan completo e salvo em `docs/superpowers/plans/2026-07-24-auto-renovacoes-endosso.md`. Duas opções de execução:

**1. Subagent-Driven (recomendado)** — dispara um subagente novo por task, com revisão entre elas, iteração mais rápida.

**2. Inline Execution** — executa as tasks nesta sessão via `executing-plans`, em lote com checkpoints.

Qual abordagem?
