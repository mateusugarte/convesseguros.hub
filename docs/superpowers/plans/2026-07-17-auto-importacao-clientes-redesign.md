# Importação histórica Auto + redesign de Clientes Auto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar para `apolices_auto` as renovações confirmadas (linhas verdes) de `02 RENOVAÇÕES AUTO.xlsx` (2020–2026), com nomes limpos, marcadas como "emitida antes do sistema"; e corrigir/redesenhar a página de Clientes Auto (bug do perfil sem apólices, "cliente desde", etiquetas ativo/inativo/pré-sistema, listagem paginada com busca, filtro de letra e ordenação).

**Architecture:** Duas frentes que compartilham só a coluna nova `origem_pre_sistema`. (A) Importação: lógica pura de parsing/limpeza em `src/lib/autoHistoricoImport.js` (testável, sem I/O), lida com o arquivo no navegador em `AutoEmissoes.jsx` (API de `File`), grava no banco via nova função em `src/lib/auto.js` com inserção em lote e deduplicação. (B) Clientes: correção de busca por múltiplos identificadores em `getClienteAutoDetalhe`, helpers de status/data em `src/pages/auto/autoShared.js` (testáveis), UI de listagem redesenhada em `AutoClientes.jsx` e detalhe em `AutoClienteDetalhe.jsx`.

**Tech Stack:** React + Vite, TanStack Query, Supabase JS client, biblioteca `xlsx` (SheetJS, já é dependência do projeto), Node `--test` para testes unitários de lógica pura.

## Global Constraints

- Credenciais só em variáveis de ambiente; `service_role` nunca no app — toda escrita usa o client `supabase` normal (RLS ativa), igual ao resto do módulo Auto.
- Migrations SQL são criadas para revisão, mas **não são executadas automaticamente** — o usuário roda manualmente no SQL Editor do Supabase (convenção já usada em todas as migrations deste projeto).
- Queries com campos explícitos (sem `select('*')`) onde o padrão já existente do arquivo usa campos explícitos (`APOLICE_AUTO_COLUMNS` etc.).
- Sem alteração de rotas, RLS além da nova coluna, ou de `clientes_auto`/`cotacoes_auto`/`emissoes_auto`/`renovacoes_auto`.
- `npm test` roda uma lista explícita de arquivos em `package.json` (não é glob) — todo teste novo precisa ser adicionado a essa lista.
- Sem veículo/CPF nas apólices importadas (decisão do usuário).
- Especificação completa: `docs/superpowers/specs/2026-07-17-auto-importacao-clientes-redesign-design.md`.

---

## Task 1: Migration — coluna `origem_pre_sistema`

**Files:**
- Create: `supabase/54_apolices_auto_origem_pre_sistema.sql`

**Interfaces:**
- Produces: coluna `apolices_auto.origem_pre_sistema boolean NOT NULL DEFAULT false`, consumida pelas Tasks 4, 8, 9, 10.

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- 54_apolices_auto_origem_pre_sistema.sql
-- Marca apólices criadas pela importação histórica da planilha de renovações
-- (antes de existir o sistema), para exibir a etiqueta "Emitida antes do
-- sistema" na UI. Executar manualmente no SQL Editor do Supabase.

ALTER TABLE apolices_auto
  ADD COLUMN IF NOT EXISTS origem_pre_sistema boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Nenhuma execução automática**

Este arquivo é só criado nesta tarefa — **não é rodado no Supabase** por este
agente (sem credenciais/`.env` neste ambiente, e é regra do projeto que
mudança de banco precisa de aprovação/execução manual do usuário). Registrar
isso no resumo final (Task 11).

---

## Task 2: `APOLICE_AUTO_COLUMNS` inclui a coluna nova

**Files:**
- Modify: `src/lib/auto.js:98`

**Interfaces:**
- Consumes: nenhuma (só a string constante existente).
- Produces: `APOLICE_AUTO_COLUMNS` passa a incluir `origem_pre_sistema`, usada por `getClienteAutoDetalhe` (Task 8) e por qualquer outra query que já usa essa constante.

- [ ] **Step 1: Adicionar a coluna à lista explícita**

Em `src/lib/auto.js`, linha 98, trocar:

```js
const APOLICE_AUTO_COLUMNS = 'id, emissao_id, cliente_id, seguradora, numero_apolice, vigencia_inicio, vigencia_fim, premio_liquido, pct_comissao, valor_comissao, forma_pagamento, parcelamento, tipo_producao, responsavel, eh_renovacao, tem_repasse, pct_repasse, nome_repasse, valor_repasse, nome_cliente, cpf_cliente, celular_cliente, condutor_nome, condutor_cpf, modelo_veiculo, placa, renovacao_premio_liquido_ano_anterior, renovacao_comissao_ano_anterior, renovacao_premio_liquido_ano_atual, renovacao_comissao_ano_atual, renovacao_diferenca_premio_liquido, renovacao_diferenca_comissao, created_at, updated_at'
```

por:

```js
const APOLICE_AUTO_COLUMNS = 'id, emissao_id, cliente_id, seguradora, numero_apolice, vigencia_inicio, vigencia_fim, premio_liquido, pct_comissao, valor_comissao, forma_pagamento, parcelamento, tipo_producao, responsavel, eh_renovacao, tem_repasse, pct_repasse, nome_repasse, valor_repasse, nome_cliente, cpf_cliente, celular_cliente, condutor_nome, condutor_cpf, modelo_veiculo, placa, renovacao_premio_liquido_ano_anterior, renovacao_comissao_ano_anterior, renovacao_premio_liquido_ano_atual, renovacao_comissao_ano_atual, renovacao_diferenca_premio_liquido, renovacao_diferenca_comissao, origem_pre_sistema, created_at, updated_at'
```

- [ ] **Step 2: Conferir que não há outro ponto do arquivo com lista de colunas duplicada**

Rodar: `grep -n "APOLICE_AUTO_COLUMNS" "src/lib/auto.js"`
Esperado: só a declaração (linha 98) e os usos em `getClienteAutoDetalhe` — nenhuma outra string de colunas duplicada para atualizar.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auto.js
git commit -m "feat(auto): incluir origem_pre_sistema nas colunas explicitas de apolices_auto"
```

---

## Task 3: Módulo puro `autoHistoricoImport.js` (parsing + testes)

**Files:**
- Create: `src/lib/autoHistoricoImport.js`
- Create: `src/lib/autoHistoricoImport.test.mjs`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `limparNomeSegurado(value: string) => string`
  - `normalizeCompareText(value: string) => string`
  - `somarUmAno(dataISO: string) => string | null`
  - `isCelulaVerde(cellStyle: object | undefined) => boolean`
  - `extrairLinhasHistoricoDaAba(sheetName: string, worksheet: object, rows: any[][]) => Array<{ aba, linha, nome_cliente, seguradora, vigencia_inicio, pct_comissao, comissao_passada }>`
  - `parseAutoHistoricoPlanilha(workbook: XLSX.WorkBook) => Array<mesmo shape de extrairLinhasHistoricoDaAba>`
- Consumido por: Task 4 (`normalizeCompareText`, `somarUmAno` em `src/lib/auto.js`) e Task 5 (`limparNomeSegurado`, `parseAutoHistoricoPlanilha` em `AutoEmissoes.jsx`).

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `src/lib/autoHistoricoImport.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'

const {
  limparNomeSegurado,
  normalizeCompareText,
  somarUmAno,
  isCelulaVerde,
  extrairLinhasHistoricoDaAba,
  parseAutoHistoricoPlanilha,
} = await import('./autoHistoricoImport.js')

test('limparNomeSegurado corta a partir do primeiro traço', () => {
  assert.equal(limparNomeSegurado('MARIA JOSE RODRIGUES - PATY'), 'MARIA JOSE RODRIGUES')
  assert.equal(limparNomeSegurado('TRANS CONEXAO - 24.250'), 'TRANS CONEXAO')
  assert.equal(limparNomeSegurado('REDONDO TELECOMUNICACOES LTDA ME- CAP'), 'REDONDO TELECOMUNICACOES LTDA ME')
  assert.equal(limparNomeSegurado('JAIME MOTA FERREIRA -'), 'JAIME MOTA FERREIRA')
})

test('limparNomeSegurado mantem nome sem traco, so normaliza espacos', () => {
  assert.equal(limparNomeSegurado('  NICASSIA   APARECIDA  ARAUJO '), 'NICASSIA APARECIDA ARAUJO')
})

test('normalizeCompareText remove acento e caixa para comparacao', () => {
  assert.equal(normalizeCompareText('José  DA Silva'), 'jose da silva')
})

test('somarUmAno soma um ano preservando mes/dia', () => {
  assert.equal(somarUmAno('2026-07-01'), '2027-07-01')
})

test('somarUmAno ajusta 29/fev para ano nao bissexto', () => {
  assert.equal(somarUmAno('2024-02-29'), '2025-02-28')
})

test('somarUmAno retorna null para data invalida ou vazia', () => {
  assert.equal(somarUmAno(''), null)
  assert.equal(somarUmAno(null), null)
  assert.equal(somarUmAno('lixo'), null)
})

test('isCelulaVerde reconhece as duas cores verdes usadas na planilha', () => {
  assert.equal(isCelulaVerde({ patternType: 'solid', fgColor: { rgb: '00B050' } }), true)
  assert.equal(isCelulaVerde({ patternType: 'solid', fgColor: { rgb: '92d050' } }), true)
})

test('isCelulaVerde rejeita outras cores e celulas sem estilo', () => {
  assert.equal(isCelulaVerde({ patternType: 'solid', fgColor: { rgb: 'FF0000' } }), false)
  assert.equal(isCelulaVerde(undefined), false)
  assert.equal(isCelulaVerde({}), false)
})

test('extrairLinhasHistoricoDaAba so inclui linhas com celula verde na coluna SEGURADO', () => {
  const rows = [
    ['DATA', 'CIA', 'SEGURADO', 'STATUS', 'LIMITE', 'COMISSAO', 'COM PASSADA'],
    [46204, 'PORTO', 'NICASSIA APARECIDA ARAUJO', 'RENOVADO', 46197, 0.2, 0.2],
    [46205, 'AZUL', 'CLIENTE PERDIDO - CAP', 'CANCELADO', 46198, 0.2, 0.15],
  ]
  const worksheet = {
    C2: { v: 'NICASSIA APARECIDA ARAUJO', s: { patternType: 'solid', fgColor: { rgb: '00B050' } } },
    C3: { v: 'CLIENTE PERDIDO - CAP', s: { patternType: 'solid', fgColor: { rgb: 'FF0000' } } },
  }
  const result = extrairLinhasHistoricoDaAba('JULHO 2026', worksheet, rows)
  assert.equal(result.length, 1)
  assert.equal(result[0].nome_cliente, 'NICASSIA APARECIDA ARAUJO')
  assert.equal(result[0].seguradora, 'PORTO')
  assert.equal(result[0].vigencia_inicio, '2026-07-01')
  assert.equal(result[0].pct_comissao, 0.2)
})

test('extrairLinhasHistoricoDaAba lida com dois blocos (quinzenas) na mesma aba', () => {
  const rows = [
    ['DATA', 'CIA', 'SEGURADO', 'COTACAO', 'PRAZO', null, 'DATA', 'CIA', 'SEGURADO', 'COTACAO', 'PRAZO'],
    [44835, 'PORTO', 'CLIENTE UM', '', '', null, 44850, 'AZUL', 'CLIENTE DOIS', '', ''],
  ]
  const worksheet = {
    C2: { v: 'CLIENTE UM', s: { patternType: 'solid', fgColor: { rgb: '00B050' } } },
    I2: { v: 'CLIENTE DOIS', s: { patternType: 'solid', fgColor: { rgb: '92D050' } } },
  }
  const result = extrairLinhasHistoricoDaAba('MAIO 2021', worksheet, rows)
  assert.equal(result.length, 2)
  assert.deepEqual(result.map(r => r.nome_cliente), ['CLIENTE UM', 'CLIENTE DOIS'])
})

test('parseAutoHistoricoPlanilha percorre todas as abas do workbook', () => {
  const wb = XLSX.utils.book_new()
  const data = [
    ['DATA', 'CIA', 'SEGURADO', 'STATUS', 'LIMITE', 'COMISSAO'],
    [46204, 'PORTO', 'CLIENTE VERDE', 'RENOVADO', 46197, 0.2],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws.C2.s = { patternType: 'solid', fgColor: { rgb: '00B050' } }
  XLSX.utils.book_append_sheet(wb, ws, 'JULHO 2026')
  const result = parseAutoHistoricoPlanilha(wb)
  assert.equal(result.length, 1)
  assert.equal(result[0].aba, 'JULHO 2026')
  assert.equal(result[0].nome_cliente, 'CLIENTE VERDE')
})
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `node --test src/lib/autoHistoricoImport.test.mjs`
Expected: FAIL — `Cannot find module './autoHistoricoImport.js'` (arquivo ainda não existe).

- [ ] **Step 3: Implementar `src/lib/autoHistoricoImport.js`**

```js
import * as XLSX from 'xlsx'

const GREEN_FILL_COLORS = new Set(['00B050', '92D050'])

export function limparNomeSegurado(value) {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim()
  const cutIndex = clean.indexOf('-')
  if (cutIndex === -1) return clean
  return clean.slice(0, cutIndex).trim()
}

export function normalizeCompareText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function somarUmAno(dataISO) {
  const match = String(dataISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const [, anoStr, mesStr, diaStr] = match
  const ano = Number(anoStr) + 1
  const mes = Number(mesStr)
  const diaMax = new Date(ano, mes, 0).getDate()
  const dia = Math.min(Number(diaStr), diaMax)
  return `${ano}-${mesStr}-${String(dia).padStart(2, '0')}`
}

export function isCelulaVerde(cellStyle) {
  const rgb = cellStyle?.fgColor?.rgb
  if (!rgb) return false
  return GREEN_FILL_COLORS.has(String(rgb).toUpperCase())
}

function normalizeHeaderCell(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function findColumn(headerRow, start, end, labels) {
  for (let col = start; col < end; col += 1) {
    const header = normalizeHeaderCell(headerRow[col])
    if (labels.some(label => header === label || header.includes(label))) return col
  }
  return -1
}

function excelValueToISO(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return ''
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  return ''
}

function percentValue(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value <= 1 ? value : value / 100
  const raw = String(value).replace('%', '').replace(',', '.').trim()
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null
  return parsed <= 1 ? parsed : parsed / 100
}

export function extrairLinhasHistoricoDaAba(sheetName, worksheet, rows) {
  const result = []
  rows.forEach((headerRow, headerIndex) => {
    const dataColumns = headerRow
      .map((cell, index) => (normalizeHeaderCell(cell) === 'data' ? index : -1))
      .filter(index => index >= 0)

    dataColumns.forEach((dataCol, blockIndex) => {
      const end = dataColumns[blockIndex + 1] ?? headerRow.length
      const ciaCol = findColumn(headerRow, dataCol, end, ['cia', 'seguradora'])
      const seguradoCol = findColumn(headerRow, dataCol, end, ['segurado', 'cliente'])
      const comissaoCol = findColumn(headerRow, dataCol, end, ['comissao'])
      const comissaoPassadaCol = findColumn(headerRow, dataCol, end, ['com passada', 'comissao passada'])
      if (seguradoCol < 0) return

      for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex]
        if (normalizeHeaderCell(row[dataCol]) === 'data') break

        const addr = XLSX.utils.encode_cell({ r: rowIndex, c: seguradoCol })
        const cell = worksheet[addr]
        if (!isCelulaVerde(cell?.s)) continue

        const nome = limparNomeSegurado(row[seguradoCol])
        const vigenciaInicio = excelValueToISO(row[dataCol])
        if (!nome || !vigenciaInicio) continue

        result.push({
          aba: sheetName,
          linha: rowIndex + 1,
          nome_cliente: nome,
          seguradora: String(ciaCol >= 0 ? row[ciaCol] : '').replace(/\s+/g, ' ').trim(),
          vigencia_inicio: vigenciaInicio,
          pct_comissao: percentValue(comissaoCol >= 0 ? row[comissaoCol] : null),
          comissao_passada: percentValue(comissaoPassadaCol >= 0 ? row[comissaoPassadaCol] : null),
        })
      }
    })
  })
  return result
}

export function parseAutoHistoricoPlanilha(workbook) {
  return workbook.SheetNames.flatMap(sheetName => {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
    return extrairLinhasHistoricoDaAba(sheetName, sheet, rows)
  })
}
```

- [ ] **Step 4: Adicionar o arquivo de teste ao script `test`**

Em `package.json`, no script `"test"`, adicionar
`src/lib/autoHistoricoImport.test.mjs` ao final da lista de arquivos (antes
das aspas de fechamento), separado por espaço, igual aos demais.

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm test`
Expected: todos os testes existentes continuam passando, mais os novos testes
de `autoHistoricoImport.test.mjs` (14 testes) passando.

- [ ] **Step 6: Commit**

```bash
git add src/lib/autoHistoricoImport.js src/lib/autoHistoricoImport.test.mjs package.json
git commit -m "feat(auto): parser puro e testado para importacao historica de renovacoes"
```

---

## Task 4: `importarApolicesAutoHistorico` em `src/lib/auto.js`

**Files:**
- Modify: `src/lib/auto.js`

**Interfaces:**
- Consumes: `normalizeCompareText`, `somarUmAno` de `./autoHistoricoImport.js` (Task 3); `isMissingColumnError`, `omitKeys`, `normalizeImportText` já existentes no arquivo.
- Produces: `export async function importarApolicesAutoHistorico(rows) => Promise<{ total, importadas, duplicadas, ignoradas, erros: Array<{aba, linha, motivo}> }>`, consumida pela Task 5 (`AutoEmissoes.jsx`). `rows` é o array retornado por `parseAutoHistoricoPlanilha` (Task 3): `{ aba, linha, nome_cliente, seguradora, vigencia_inicio, pct_comissao, comissao_passada }`.

- [ ] **Step 1: Adicionar o import no topo do arquivo**

Em `src/lib/auto.js`, linha 1, trocar:

```js
import { supabase } from './supabase'
```

por:

```js
import { supabase } from './supabase'
import { normalizeCompareText, somarUmAno } from './autoHistoricoImport.js'
```

- [ ] **Step 2: Adicionar a função de importação**

Logo depois de `importarApolicesAutoPlanilha` (após a linha que fecha essa
função, antes do comentário `// Usado quando a apolice nao tem emissao
vinculada`), adicionar:

```js
const HISTORICO_IMPORT_CHUNK_SIZE = 200
const APOLICE_AUTO_ORIGEM_FIELDS = ['origem_pre_sistema']

export async function importarApolicesAutoHistorico(rows = []) {
  const resultado = { total: rows.length, importadas: 0, duplicadas: 0, ignoradas: 0, erros: [] }

  const candidatos = []
  rows.forEach((row, index) => {
    const nomeCliente = normalizeImportText(row.nome_cliente)
    const vigenciaInicio = row.vigencia_inicio || null
    if (!nomeCliente || !vigenciaInicio) {
      resultado.ignoradas += 1
      resultado.erros.push({ aba: row.aba || null, linha: row.linha || index + 1, motivo: 'Nome ou data ausente.' })
      return
    }
    const vigenciaFim = somarUmAno(vigenciaInicio)
    if (!vigenciaFim) {
      resultado.ignoradas += 1
      resultado.erros.push({ aba: row.aba || null, linha: row.linha || index + 1, motivo: 'Data de inicio invalida.' })
      return
    }
    candidatos.push({
      nome_cliente: nomeCliente,
      seguradora: normalizeImportText(row.seguradora) || null,
      vigencia_inicio: vigenciaInicio,
      vigencia_fim: vigenciaFim,
      pct_comissao: row.pct_comissao ?? null,
      comissao_passada: row.comissao_passada ?? null,
    })
  })

  const { data: existentes, error: existentesError } = await supabase
    .from('apolices_auto')
    .select('nome_cliente, vigencia_fim, seguradora')
    .eq('origem_pre_sistema', true)
  if (existentesError) throw existentesError

  const chavesExistentes = new Set(
    (existentes ?? []).map(item => `${normalizeCompareText(item.nome_cliente)}|${item.vigencia_fim}|${normalizeCompareText(item.seguradora)}`)
  )

  const paraInserir = []
  candidatos.forEach(candidato => {
    const chave = `${normalizeCompareText(candidato.nome_cliente)}|${candidato.vigencia_fim}|${normalizeCompareText(candidato.seguradora)}`
    if (chavesExistentes.has(chave)) {
      resultado.duplicadas += 1
      return
    }
    chavesExistentes.add(chave)
    paraInserir.push({
      emissao_id: null,
      cliente_id: null,
      seguradora: candidato.seguradora,
      numero_apolice: null,
      vigencia_inicio: candidato.vigencia_inicio,
      vigencia_fim: candidato.vigencia_fim,
      premio_liquido: null,
      pct_comissao: candidato.pct_comissao,
      valor_comissao: null,
      forma_pagamento: null,
      parcelamento: null,
      tipo_producao: 'individual',
      responsavel: null,
      eh_renovacao: true,
      tem_repasse: false,
      pct_repasse: null,
      nome_repasse: null,
      valor_repasse: null,
      nome_cliente: candidato.nome_cliente,
      cpf_cliente: null,
      celular_cliente: null,
      condutor_nome: null,
      condutor_cpf: null,
      modelo_veiculo: null,
      placa: null,
      renovacao_comissao_ano_anterior: candidato.comissao_passada,
      origem_pre_sistema: true,
    })
  })

  for (let i = 0; i < paraInserir.length; i += HISTORICO_IMPORT_CHUNK_SIZE) {
    const chunk = paraInserir.slice(i, i + HISTORICO_IMPORT_CHUNK_SIZE)
    let { error } = await supabase.from('apolices_auto').insert(chunk)
    if (isMissingColumnError(error, 'apolices_auto', APOLICE_AUTO_ORIGEM_FIELDS)) {
      ;({ error } = await supabase
        .from('apolices_auto')
        .insert(chunk.map(item => omitKeys(item, APOLICE_AUTO_ORIGEM_FIELDS))))
    }
    if (error) {
      resultado.erros.push({ aba: null, linha: null, motivo: `Lote ${Math.floor(i / HISTORICO_IMPORT_CHUNK_SIZE) + 1}: ${error.message}` })
      continue
    }
    resultado.importadas += chunk.length
  }

  return resultado
}
```

- [ ] **Step 3: Verificar que o arquivo continua sintaticamente válido**

Run: `npm run build`
Expected: build verde (esta função ainda não é chamada por nenhuma UI —
Task 5 conecta o botão).

- [ ] **Step 4: Commit**

```bash
git add src/lib/auto.js
git commit -m "feat(auto): funcao de importacao em lote do historico de renovacoes com dedup"
```

---

## Task 5: Botão "Importar histórico" em `AutoEmissoes.jsx`

**Files:**
- Modify: `src/pages/auto/AutoEmissoes.jsx`

**Interfaces:**
- Consumes: `parseAutoHistoricoPlanilha` (Task 3, `../../lib/autoHistoricoImport.js`), `importarApolicesAutoHistorico` (Task 4, `../../lib/auto.js`).
- Produces: nenhuma interface nova para outras tasks — é o ponto de entrada da UI.

- [ ] **Step 1: Importar as novas funções**

Em `src/pages/auto/AutoEmissoes.jsx`, linha 9, trocar:

```js
  emitirApoliceAuto, getApolicesAuto, getEmissaoAuto, getEmissaoColuna, getEmissoesAuto, importarApolicesAutoPlanilha, moverEmissaoColuna,
```

por:

```js
  emitirApoliceAuto, getApolicesAuto, getEmissaoAuto, getEmissaoColuna, getEmissoesAuto, importarApolicesAutoPlanilha, importarApolicesAutoHistorico, moverEmissaoColuna,
```

E adicionar, depois da linha `import { toNumber } from '../../lib/apolices'` (linha 19):

```js
import { parseAutoHistoricoPlanilha } from '../../lib/autoHistoricoImport.js'
```

Adicionar `History` à lista de ícones importados de `lucide-react` (linha 5):
trocar `Upload, X, Plus }` por `Upload, X, Plus, History }`.

- [ ] **Step 2: Adicionar o leitor de arquivo histórico**

Logo depois da função `parseAutoPlanilhaFile` (linha ~348, antes de
`function buildRenovacaoComparativo`), adicionar:

```js
async function parseAutoHistoricoPlanilhaFile(file) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, cellStyles: true })
  return parseAutoHistoricoPlanilha(workbook)
}
```

- [ ] **Step 3: Novo estado, ref e mutation**

Depois da linha `const importFileRef = useRef(null)` (linha 1202), adicionar:

```js
  const importHistoricoFileRef = useRef(null)
```

Depois da linha `const [importResumo, setImportResumo] = useState(null)`
(linha 1208), adicionar:

```js
  const [importHistoricoResumo, setImportHistoricoResumo] = useState(null)
```

Depois do bloco `const { mutateAsync: importarPlanilhaAsync, ... }` (termina
na linha 1284), adicionar:

```js
  const { mutateAsync: importarHistoricoAsync, isPending: isImportingHistorico } = useMutation({
    mutationFn: rows => importarApolicesAutoHistorico(rows),
    onSuccess: resumo => {
      qc.invalidateQueries({ queryKey: ['auto-clientes-carteira'] })
      qc.invalidateQueries({ queryKey: ['auto-apolices'] })
      qc.invalidateQueries({ queryKey: ['auto-dashboard-metrics'] })
      setImportHistoricoResumo(resumo)
      toast({
        type: 'success',
        title: 'Historico importado',
        message: `${resumo.importadas} apolices novas, ${resumo.duplicadas} ja existentes e ${resumo.ignoradas} ignoradas.`,
      })
    },
    onError: error => {
      toast({ type: 'error', title: 'Erro ao importar historico', message: error?.message || 'Revise o arquivo enviado.' })
    },
  })
```

- [ ] **Step 4: Handler do input de arquivo**

Depois da função `handleImportPlanilha` (termina na linha 1397, antes de
`function handlePeriodoChange`), adicionar:

```js
  async function handleImportHistorico(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const rows = await parseAutoHistoricoPlanilhaFile(file)
      if (!rows.length) {
        toast({
          type: 'error',
          title: 'Nenhuma linha verde encontrada',
          message: 'So linhas com preenchimento verde (renovacao confirmada) sao importadas.',
        })
        return
      }
      await importarHistoricoAsync(rows)
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao ler planilha', message: error?.message || 'Arquivo invalido ou fora do modelo esperado.' })
    }
  }
```

- [ ] **Step 5: Botão e input na barra de ações**

No bloco `actions` do `PageHeader` (linha ~1644-1673), depois do botão
"Importar planilha" (fecha na linha 1666) e antes do botão "Nova emissao",
adicionar:

```jsx
            <input
              ref={importHistoricoFileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportHistorico}
              className="hidden"
            />
            <button
              onClick={() => importHistoricoFileRef.current?.click()}
              disabled={isImportingHistorico}
              className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {isImportingHistorico ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
              Importar historico (renovacoes)
            </button>
```

- [ ] **Step 6: Card de resumo da importação histórica**

Depois do bloco `{importResumo && ( ... )}` (fecha na linha 1700), adicionar:

```jsx
      {importHistoricoResumo && (
        <DataCard className="border-status-warning/25 bg-status-warning/5" bodyClassName="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-dark-text">Ultima importacao de historico Auto</p>
              <p className="mt-1 text-xs text-dark-muted">
                {importHistoricoResumo.total} linhas verdes lidas. {importHistoricoResumo.importadas} novas, {importHistoricoResumo.duplicadas} ja existentes e {importHistoricoResumo.ignoradas} ignoradas.
              </p>
            </div>
            {importHistoricoResumo.erros?.length > 0 && (
              <span className="rounded-2xl border border-status-warning/25 bg-status-warning/10 px-3 py-2 text-xs font-medium text-status-warning">
                {importHistoricoResumo.erros.length} linha(s) com aviso
              </span>
            )}
          </div>
        </DataCard>
      )}
```

- [ ] **Step 7: Verificar build**

Run: `npm run build`
Expected: build verde, sem erros de import/JSX.

- [ ] **Step 8: Commit**

```bash
git add src/pages/auto/AutoEmissoes.jsx
git commit -m "feat(auto): botao de importacao do historico de renovacoes em Emissoes"
```

---

## Task 6: Generalizar limpeza de nome no importador mensal existente

**Files:**
- Modify: `src/pages/auto/AutoEmissoes.jsx`

**Interfaces:**
- Consumes: `limparNomeSegurado` (Task 3, `../../lib/autoHistoricoImport.js`).
- Produces: nenhuma nova.

- [ ] **Step 1: Importar `limparNomeSegurado`**

Na linha adicionada na Task 5 (`import { parseAutoHistoricoPlanilha } from
'../../lib/autoHistoricoImport.js'`), trocar por:

```js
import { limparNomeSegurado, parseAutoHistoricoPlanilha } from '../../lib/autoHistoricoImport.js'
```

- [ ] **Step 2: Remover a função local antiga e usar a nova**

Remover a função `cleanNomeSegurado` (linhas 242-247):

```js
function cleanNomeSegurado(value) {
  return cleanPlanilhaText(value)
    .replace(/\s*-{2,}\s*.*$/i, '')
    .replace(/\s+-\s+(equipe|luciano|victor|vini)$/i, '')
    .trim()
}
```

Na função `rowsFromAutoSheet` (linha ~312), trocar:

```js
        const nome = cleanNomeSegurado(row[seguradoCol])
```

por:

```js
        const nome = limparNomeSegurado(row[seguradoCol])
```

- [ ] **Step 2: Conferir que não sobrou nenhuma outra referência**

Run: `grep -n "cleanNomeSegurado" "src/pages/auto/AutoEmissoes.jsx"`
Expected: nenhum resultado.

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 4: Commit**

```bash
git add src/pages/auto/AutoEmissoes.jsx
git commit -m "refactor(auto): reaproveitar limpeza de nome generalizada no importador mensal"
```

---

## Task 7: Helpers de status/data em `autoShared.js` (+ testes)

**Files:**
- Modify: `src/pages/auto/autoShared.js`
- Create: `src/pages/auto/autoShared.test.mjs`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `isApoliceAtiva(apolice: { vigencia_fim?: string }, hojeISO?: string) => boolean`
  - `getClienteStatusAuto(apolices: Array<{ vigencia_fim?: string }>, hojeISO?: string) => 'ativo' | 'inativo' | null`
  - `formatMonthYearBR(value: string | null) => string`
- Consumido por: Task 8/9 (`AutoClienteDetalhe.jsx`, `getClienteAutoDetalhe`) e Task 10 (`AutoClientes.jsx`).

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `src/pages/auto/autoShared.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

const { isApoliceAtiva, getClienteStatusAuto, formatMonthYearBR } = await import('./autoShared.js')

test('isApoliceAtiva true quando vigencia_fim e hoje ou no futuro', () => {
  assert.equal(isApoliceAtiva({ vigencia_fim: '2026-07-17' }, '2026-07-17'), true)
  assert.equal(isApoliceAtiva({ vigencia_fim: '2026-08-01' }, '2026-07-17'), true)
})

test('isApoliceAtiva false quando vigencia_fim ja passou ou esta ausente', () => {
  assert.equal(isApoliceAtiva({ vigencia_fim: '2026-07-01' }, '2026-07-17'), false)
  assert.equal(isApoliceAtiva({ vigencia_fim: null }, '2026-07-17'), false)
  assert.equal(isApoliceAtiva({}, '2026-07-17'), false)
})

test('getClienteStatusAuto ativo quando ao menos uma apolice esta vigente', () => {
  const apolices = [{ vigencia_fim: '2025-01-01' }, { vigencia_fim: '2027-01-01' }]
  assert.equal(getClienteStatusAuto(apolices, '2026-07-17'), 'ativo')
})

test('getClienteStatusAuto inativo quando todas as apolices ja venceram', () => {
  const apolices = [{ vigencia_fim: '2024-01-01' }, { vigencia_fim: '2025-01-01' }]
  assert.equal(getClienteStatusAuto(apolices, '2026-07-17'), 'inativo')
})

test('getClienteStatusAuto null sem apolices', () => {
  assert.equal(getClienteStatusAuto([], '2026-07-17'), null)
})

test('formatMonthYearBR formata mes e ano por extenso', () => {
  assert.equal(formatMonthYearBR('2020-10-15'), 'outubro de 2020')
})

test('formatMonthYearBR retorna traco para valor vazio ou invalido', () => {
  assert.equal(formatMonthYearBR(null), '—')
  assert.equal(formatMonthYearBR(''), '—')
  assert.equal(formatMonthYearBR('lixo'), '—')
})
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `node --test src/pages/auto/autoShared.test.mjs`
Expected: FAIL — `isApoliceAtiva`/`getClienteStatusAuto`/`formatMonthYearBR`
não são funções exportadas ainda.

- [ ] **Step 3: Implementar os helpers**

Em `src/pages/auto/autoShared.js`, adicionar ao final do arquivo:

```js
export function isApoliceAtiva(apolice, hojeISO = new Date().toISOString().slice(0, 10)) {
  return Boolean(apolice?.vigencia_fim && apolice.vigencia_fim >= hojeISO)
}

export function getClienteStatusAuto(apolices = [], hojeISO = new Date().toISOString().slice(0, 10)) {
  if (!apolices.length) return null
  return apolices.some(item => isApoliceAtiva(item, hojeISO)) ? 'ativo' : 'inativo'
}

export function formatMonthYearBR(value) {
  if (!value) return '—'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
```

- [ ] **Step 4: Adicionar o arquivo de teste ao script `test`**

Em `package.json`, no script `"test"`, adicionar
`src/pages/auto/autoShared.test.mjs` ao final da lista.

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm test`
Expected: todos os testes passando, incluindo os 7 novos de `autoShared.test.mjs`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/auto/autoShared.js src/pages/auto/autoShared.test.mjs package.json
git commit -m "feat(auto): helpers testados de status de cliente e formatacao mes/ano"
```

---

## Task 8: Corrigir `getClienteAutoDetalhe` (bug do perfil incompleto)

**Files:**
- Modify: `src/lib/auto.js`

**Interfaces:**
- Consumes: nenhuma nova.
- Produces: `getClienteAutoDetalhe` passa a retornar também `clienteDesde: string | null` no objeto de resposta, consumido pela Task 9.

- [ ] **Step 1: Trocar `scopeByRef` para combinar identificadores com OR**

Em `src/lib/auto.js`, dentro de `getClienteAutoDetalhe`, trocar (linhas
~1248-1254):

```js
  function scopeByRef(query, { allowNome = false } = {}) {
    if (clientId) return query.eq('cliente_id', clientId)
    if (cpf) return query.eq('cpf_cliente', cpf)
    if (refIsUuid) return query.eq('id', ref)
    if (allowNome && nomeRef) return query.eq('nome_cliente', nomeRef)
    return null
  }
```

por:

```js
  function orFilterValue(value) {
    return `"${String(value).replace(/"/g, '\\"')}"`
  }

  function scopeByRef(query, { allowNome = false } = {}) {
    const filters = []
    if (clientId) filters.push(`cliente_id.eq.${orFilterValue(clientId)}`)
    if (cpf) filters.push(`cpf_cliente.eq.${orFilterValue(cpf)}`)
    if (refIsUuid) filters.push(`id.eq.${orFilterValue(ref)}`)
    if (allowNome && nomeRef) filters.push(`nome_cliente.eq.${orFilterValue(nomeRef)}`)
    if (filters.length === 0) return null
    return query.or(filters.join(','))
  }
```

Isso corrige o bug: antes, uma apólice do mesmo cliente que só tivesse
`nome_cliente` preenchido (sem `cliente_id`) ficava invisível no perfil
sempre que o clique veio de outra apólice que tinha `cliente_id`. Agora a
busca combina todos os identificadores conhecidos com `OR`.

- [ ] **Step 2: Calcular e retornar `clienteDesde`**

Na mesma função, logo antes do `return { cliente: perfil, ... }` (linha
~1298), adicionar:

```js
  const clienteDesde = apolicesLista.reduce((min, item) => {
    if (!item.vigencia_inicio) return min
    return !min || item.vigencia_inicio < min ? item.vigencia_inicio : min
  }, null)
```

E no objeto retornado, adicionar o campo (depois de `cliente: perfil,`):

```js
    clienteDesde,
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auto.js
git commit -m "fix(auto): perfil do cliente busca apolices por todos os identificadores conhecidos"
```

---

## Task 9: "Cliente desde" + etiquetas no perfil (`AutoClienteDetalhe.jsx`)

**Files:**
- Modify: `src/pages/auto/AutoClienteDetalhe.jsx`

**Interfaces:**
- Consumes: `clienteDesde` (Task 8), `getClienteStatusAuto`, `formatMonthYearBR` (Task 7).
- Produces: nenhuma nova.

- [ ] **Step 1: Importar os novos helpers**

Trocar (linha 6):

```js
import { formatDateBR, formatDateTimeBR, formatMoney } from './autoShared'
```

por:

```js
import { formatDateBR, formatDateTimeBR, formatMoney, formatMonthYearBR, getClienteStatusAuto } from './autoShared'
```

- [ ] **Step 2: Extrair `clienteDesde` e calcular o status**

Trocar (linha 25):

```js
  const { cliente, apolices, cotacoes, emissoes, renovacoes, metricas, statusAtual, destaque } = data
```

por:

```js
  const { cliente, apolices, cotacoes, emissoes, renovacoes, metricas, statusAtual, destaque, clienteDesde } = data
  const clienteStatus = getClienteStatusAuto(apolices)
```

- [ ] **Step 3: Mostrar "Cliente desde" nos dados cadastrais**

No `DataCard title="Dados cadastrais"` (linhas 47-54), depois do bloco
"Email" (linha 52), adicionar:

```jsx
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Cliente desde</p><p className="mt-1 text-dark-text">{formatMonthYearBR(clienteDesde)}</p></div>
```

- [ ] **Step 4: Badge de status ativo/inativo**

No `DataCard title="Status atual"` (linhas 56-62), como primeira linha do
`<div className="space-y-3 ...">` (antes do `<div>{statusAtual}</div>`),
adicionar:

```jsx
            {clienteStatus && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${clienteStatus === 'ativo' ? 'bg-status-success/15 text-status-success' : 'bg-dark-border/60 text-dark-muted'}`}>
                {clienteStatus === 'ativo' ? 'Cliente ativo' : 'Cliente inativo'}
              </span>
            )}
```

- [ ] **Step 5: Badge "Emitida antes do sistema" por apólice**

No `DataCard title="Apólices vinculadas"` (linha 75-77), trocar:

```jsx
          {apolices.length === 0 ? <EmptyState icon={<Car className="h-5 w-5" />} title="Sem apólices" description="Nenhuma apólice vinculada a este cliente." /> : <div className="space-y-3">{apolices.map(item => <RowLink key={item.id} label={`${item.numero_apolice || 'Sem número'} · ${item.seguradora || 'Sem seguradora'}`} value={`${formatDateBR(item.vigencia_inicio)} até ${formatDateBR(item.vigencia_fim)}`} onClick={() => navigate(`/auto/apolices/${item.id}`)} />)}</div>}
```

por:

```jsx
          {apolices.length === 0 ? <EmptyState icon={<Car className="h-5 w-5" />} title="Sem apólices" description="Nenhuma apólice vinculada a este cliente." /> : <div className="space-y-3">{apolices.map(item => (
            <RowLink
              key={item.id}
              label={(
                <span className="inline-flex flex-wrap items-center gap-2">
                  {`${item.numero_apolice || 'Sem número'} · ${item.seguradora || 'Sem seguradora'}`}
                  {item.origem_pre_sistema && <span className="badge badge-warning">Emitida antes do sistema</span>}
                </span>
              )}
              value={`${formatDateBR(item.vigencia_inicio)} até ${formatDateBR(item.vigencia_fim)}`}
              onClick={() => navigate(`/auto/apolices/${item.id}`)}
            />
          ))}</div>}
```

- [ ] **Step 6: Verificar build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 7: Commit**

```bash
git add src/pages/auto/AutoClienteDetalhe.jsx
git commit -m "feat(auto): cliente desde e etiquetas de status/pre-sistema no perfil"
```

---

## Task 10: Redesenho de `AutoClientes.jsx`

**Files:**
- Modify: `src/pages/auto/AutoClientes.jsx` (reescrita completa do arquivo)

**Interfaces:**
- Consumes: `getClienteStatusAuto`, `formatMonthYearBR` (Task 7).
- Produces: nenhuma nova (página folha).

- [ ] **Step 1: Substituir o conteúdo inteiro do arquivo**

Escrever `src/pages/auto/AutoClientes.jsx` com o conteúdo abaixo (mantém
`clientKey`/`clientName`/`clientCpf`/`emissionDate`/`ApoliceEditor` iguais ao
arquivo atual; adiciona badge de pré-sistema em `EmissionRow`; adiciona
`LetterFilterBar`/`Pagination`; reestrutura `AutoClientes` com letra, ordenação
e paginação de 50):

```jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BadgeDollarSign, Car, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Eye, Save, Search, Users } from 'lucide-react'
import { DataCard, EmptyState, FilterBar, MetricCard, PageHeader } from '../../components/ui'
import { atualizarApoliceAuto, getAutoCarteiraClientes } from '../../lib/auto'
import { formatDateBR, formatMonthYearBR, getClienteStatusAuto } from './autoShared'

const PAGE_SIZE = 50

function clientKey(item) {
  return item.cliente_id || item.cpf_cliente || item.nome_cliente || item.emissoes_auto?.cliente_id || item.id
}

function clientName(item) {
  const c = item.emissoes_auto?.cotacoes_auto || {}
  return item.nome_cliente || c.nome_cliente || c.nome_interessado || item.cpf_cliente || c.cpf_cliente || 'Cliente sem nome'
}

function clientCpf(item) {
  const c = item.emissoes_auto?.cotacoes_auto || {}
  return item.cpf_cliente || c.cpf_cliente || ''
}

function emissionDate(item) {
  return item.vigencia_inicio || item.created_at || null
}

function firstLetterOf(name) {
  const clean = String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
  const match = clean.match(/[A-Z]/)
  return match ? match[0] : '#'
}

function ApoliceEditor({ apolice, onSave, saving }) {
  const [draft, setDraft] = useState(apolice.numero_apolice || '')

  useEffect(() => {
    setDraft(apolice.numero_apolice || '')
  }, [apolice.id, apolice.numero_apolice])

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">
          Número da apólice
        </label>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Digite o número da apólice" className="input text-sm" />
      </div>
      <button type="button" onClick={() => onSave(draft)} disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-brand-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50">
        <Save className="h-3.5 w-3.5" />
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  )
}

function EmissionRow({ apolice, onSaveNumero, savingId, onOpenCotacao, onOpenApolice }) {
  const lead = apolice.emissoes_auto?.cotacoes_auto || {}
  const vigInicio = apolice.vigencia_inicio ? formatDateBR(apolice.vigencia_inicio) : 'Sem início'
  const vigFim = apolice.vigencia_fim ? formatDateBR(apolice.vigencia_fim) : 'Sem fim'
  const isSaving = savingId === apolice.id

  return (
    <div className="rounded-3xl border border-dark-border/70 bg-dark-surface/80 p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-dark-text">{lead.nome_cliente || apolice.nome_cliente || 'Cliente sem nome'}</p>
            <span className="badge badge-info">{apolice.seguradora || 'Sem seguradora'}</span>
            {apolice.numero_apolice ? <span className="badge badge-success">{apolice.numero_apolice}</span> : <span className="badge badge-warning">Sem número</span>}
            {apolice.origem_pre_sistema && <span className="badge badge-warning">Emitida antes do sistema</span>}
          </div>
          <div className="mt-2 grid gap-2 text-xs text-dark-muted sm:grid-cols-2 xl:grid-cols-4">
            <span><strong className="text-dark-text">Vigência:</strong> {vigInicio} - {vigFim}</span>
            <span><strong className="text-dark-text">CPF:</strong> {lead.cpf_cliente || apolice.cpf_cliente || '—'}</span>
            <span><strong className="text-dark-text">Veículo:</strong> {lead.modelo_veiculo || apolice.modelo_veiculo || '—'}</span>
            <span><strong className="text-dark-text">Placa:</strong> {lead.placa || apolice.placa || '—'}</span>
          </div>
          <div className="mt-2 text-xs text-dark-muted">
            {lead.origem_lead ? `Origem: ${lead.origem_lead}` : 'Origem não informada'}
            {lead.condutor_nome ? ` · Condutor: ${lead.condutor_nome}` : ''}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onOpenApolice(apolice.id)} className="inline-flex items-center gap-1.5 rounded-2xl border border-brand-secondary/20 bg-brand-secondary/8 px-3 py-2 text-xs font-semibold text-status-info">
            Abrir apólice
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          {apolice.emissoes_auto?.cotacao_id && (
            <button type="button" onClick={() => onOpenCotacao(apolice.emissoes_auto.cotacao_id)} className="inline-flex items-center gap-1.5 rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted transition-colors hover:border-brand-accent/40 hover:text-dark-text">
              Abrir cotação
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4">
        <ApoliceEditor apolice={apolice} onSave={numero => onSaveNumero(apolice.id, numero)} saving={isSaving} />
      </div>
    </div>
  )
}

function LetterFilterBar({ value, onChange, availableLetters }) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange('')}
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${value === '' ? 'bg-brand-secondary text-white' : 'bg-dark-surface/70 text-dark-muted hover:text-dark-text'}`}
      >
        Todos
      </button>
      {letters.map(letter => {
        const has = availableLetters.has(letter)
        return (
          <button
            key={letter}
            type="button"
            disabled={!has}
            onClick={() => onChange(letter)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              value === letter
                ? 'bg-brand-secondary text-white'
                : has
                  ? 'bg-dark-surface/70 text-dark-muted hover:text-dark-text'
                  : 'cursor-not-allowed bg-dark-surface/30 text-dark-muted/30'
            }`}
          >
            {letter}
          </button>
        )
      })}
    </div>
  )
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-40">
        <ChevronLeft className="h-4 w-4" /> Anterior
      </button>
      <span className="text-xs font-medium text-dark-muted">Página {page} de {totalPages}</span>
      <button type="button" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="btn-secondary inline-flex items-center gap-1 disabled:opacity-40">
        Próxima <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function AutoClientes() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [seguradora, setSeguradora] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [letraFiltro, setLetraFiltro] = useState('')
  const [sortBy, setSortBy] = useState('nome')
  const [page, setPage] = useState(1)

  const { data: apolices = [], isLoading } = useQuery({
    queryKey: ['auto-clientes-carteira', search, seguradora, inicio, fim],
    queryFn: () => getAutoCarteiraClientes({ search, seguradora: seguradora || undefined, inicio: inicio || undefined, fim: fim || undefined }),
  })

  const { mutateAsync: salvarNumero, isPending, variables } = useMutation({
    mutationFn: ({ id, numero }) => atualizarApoliceAuto(id, { numero_apolice: numero.trim() || null }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auto-clientes-carteira'] })
      await qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
    },
  })

  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const grouped = useMemo(() => {
    const map = new Map()
    apolices.forEach(item => {
      const key = clientKey(item)
      if (!map.has(key)) {
        map.set(key, { key, name: clientName(item), cpf: clientCpf(item), items: [] })
      }
      map.get(key).items.push(item)
    })

    return Array.from(map.values()).map(group => {
      const sortedItems = [...group.items].sort((a, b) => new Date(emissionDate(b) || 0).getTime() - new Date(emissionDate(a) || 0).getTime())
      const clienteDesde = sortedItems.reduce((min, item) => {
        if (!item.vigencia_inicio) return min
        return !min || item.vigencia_inicio < min ? item.vigencia_inicio : min
      }, null)
      const status = getClienteStatusAuto(sortedItems, hoje)
      return { ...group, items: sortedItems, latest: sortedItems[0], clienteDesde, status }
    })
  }, [apolices, hoje])

  const metrics = useMemo(() => {
    const totalClientes = grouped.length
    const totalApolices = apolices.length
    const comNumero = apolices.filter(item => Boolean(item.numero_apolice?.trim())).length
    const multiEmissao = grouped.filter(group => group.items.length > 1).length
    return { totalClientes, totalApolices, comNumero, multiEmissao }
  }, [apolices, grouped])

  const seguradorasDisponiveis = useMemo(() => {
    const set = new Set()
    apolices.forEach(item => { if (item.seguradora) set.add(item.seguradora) })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [apolices])

  const availableLetters = useMemo(() => {
    const set = new Set()
    grouped.forEach(group => set.add(firstLetterOf(group.name)))
    return set
  }, [grouped])

  const filteredByLetter = useMemo(() => {
    if (!letraFiltro) return grouped
    return grouped.filter(group => firstLetterOf(group.name) === letraFiltro)
  }, [grouped, letraFiltro])

  const sortedGrouped = useMemo(() => {
    const list = [...filteredByLetter]
    list.sort((a, b) => {
      if (sortBy === 'quantidade') return b.items.length - a.items.length
      if (sortBy === 'antigo') return (a.clienteDesde || '9999-99-99').localeCompare(b.clienteDesde || '9999-99-99')
      if (sortBy === 'recente') return (emissionDate(b.latest) || '').localeCompare(emissionDate(a.latest) || '')
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    })
    return list
  }, [filteredByLetter, sortBy])

  const totalPages = Math.max(1, Math.ceil(sortedGrouped.length / PAGE_SIZE))

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return sortedGrouped.slice(start, start + PAGE_SIZE)
  }, [sortedGrouped, page])

  useEffect(() => {
    setPage(1)
  }, [search, seguradora, inicio, fim, letraFiltro, sortBy])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const savingId = isPending ? variables?.id : null

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Seguro Auto"
        title="Clientes e carteira"
        description="Área consolidada da carteira Auto. Abra cada cliente como um perfil completo e navegue pelas apólices emitidas e histórico operacional."
        actions={(<button onClick={() => navigate('/auto/emissoes')} className="btn-secondary">Voltar às emissões</button>)}
        stats={(
          <>
            <MetricCard label="Clientes" value={metrics.totalClientes} hint="clientes distintos" tone="accent" icon={<Users className="h-4 w-4" />} />
            <MetricCard label="Apólices" value={metrics.totalApolices} hint="registros na carteira" tone="secondary" icon={<ClipboardList className="h-4 w-4" />} />
            <MetricCard label="Com número" value={metrics.comNumero} hint="apólices preenchidas" tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
            <MetricCard label="Recorrentes" value={metrics.multiEmissao} hint="mais de uma emissão" tone="warning" icon={<BadgeDollarSign className="h-4 w-4" />} />
          </>
        )}
      />

      <FilterBar>
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.5fr_0.5fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, veículo, placa, apólice..." className="input pl-10" />
          </div>
          <select value={seguradora} onChange={e => setSeguradora(e.target.value)} className="select">
            <option value="">Todas as seguradoras</option>
            {seguradorasDisponiveis.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="input" />
          <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="input" />
        </div>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <LetterFilterBar value={letraFiltro} onChange={setLetraFiltro} availableLetters={availableLetters} />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="select lg:w-64">
            <option value="nome">Ordem alfabética</option>
            <option value="recente">Mais recentes primeiro</option>
            <option value="quantidade">Mais apólices primeiro</option>
            <option value="antigo">Clientes mais antigos</option>
          </select>
        </div>
      </FilterBar>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-dark-muted">Carregando carteira...</div>
      ) : sortedGrouped.length === 0 ? (
        <EmptyState icon={<Car className="h-5 w-5" />} title="Nenhuma emissão encontrada" description="Tente outro período, seguradora, letra ou termo de busca." />
      ) : (
        <>
          <div className="space-y-4">
            {paginated.map(group => (
              <DataCard
                key={group.key}
                title={group.name}
                subtitle={`${group.items.length} apólice(s)${group.clienteDesde ? ` · cliente desde ${formatMonthYearBR(group.clienteDesde)}` : ''}`}
                actions={(
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {group.status && (
                      <span className={`badge ${group.status === 'ativo' ? 'badge-success' : 'badge-muted'}`}>
                        {group.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    )}
                    {group.cpf && <span className="badge badge-muted">{group.cpf}</span>}
                  </div>
                )}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/auto/clientes/${encodeURIComponent(group.key)}`)}
                  className="mb-4 flex w-full items-center justify-between rounded-[28px] border border-brand-secondary/15 bg-gradient-to-r from-brand-secondary/8 via-dark-surface/40 to-brand-accent/8 px-4 py-4 text-left transition-colors hover:border-brand-secondary/30"
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-info">Perfil do cliente</p>
                    <p className="mt-1 text-base font-semibold text-dark-text">Abrir área completa com histórico, renovações e vínculo com a corretora</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-2xl border border-brand-secondary/20 bg-dark-surface/80 px-3 py-2 text-xs font-semibold text-status-info">
                    <Eye className="h-4 w-4" />
                    Abrir perfil
                  </span>
                </button>

                <div className="space-y-3">
                  {group.items.map(item => (
                    <EmissionRow
                      key={item.id}
                      apolice={item}
                      onSaveNumero={async (id, numero) => { await salvarNumero({ id, numero }) }}
                      savingId={savingId}
                      onOpenCotacao={cotacaoId => navigate(`/auto/cotacoes/${cotacaoId}`)}
                      onOpenApolice={apoliceId => navigate(`/auto/apolices/${apoliceId}`)}
                    />
                  ))}
                </div>
              </DataCard>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 3: Rodar toda a suíte de testes**

Run: `npm test`
Expected: todos os testes passando (nada neste arquivo é testado
diretamente — é página, mesmo padrão das demais páginas do projeto — mas a
suíte inteira precisa continuar verde).

- [ ] **Step 4: Commit**

```bash
git add src/pages/auto/AutoClientes.jsx
git commit -m "feat(auto): redesenho da listagem de clientes com letra, ordenacao e paginacao"
```

---

## Task 11: Atualizar `docs/CURRENT_TASK.md`

**Files:**
- Modify: `docs/CURRENT_TASK.md`

**Interfaces:**
- Nenhuma (documentação).

- [ ] **Step 1: Prepender uma nova entrada no topo do arquivo**

Seguindo o padrão das entradas existentes (data, autor, causa raiz,
correção, arquivos alterados, testes rodados, smoke test pendente, riscos
remanescentes), adicionar no topo de `docs/CURRENT_TASK.md` um resumo desta
tarefa: importação histórica de renovações Auto (migration criada mas não
executada, botão novo em Emissões, regra de linha verde + limpeza de nome
generalizada) e redesenho de Clientes Auto (bug do perfil, cliente desde,
etiquetas ativo/inativo/pré-sistema, paginação/letra/ordenação). Citar
explicitamente que `54_apolices_auto_origem_pre_sistema.sql` precisa ser
rodado manualmente no Supabase antes da importação funcionar, e que a
importação em si (rodar o botão com o arquivo real) é smoke test pendente
neste ambiente (sem `.env`/Supabase).

- [ ] **Step 2: Commit**

```bash
git add docs/CURRENT_TASK.md
git commit -m "docs: registrar importacao historica Auto e redesenho de clientes em CURRENT_TASK"
```

---

## Self-Review (executado antes de entregar o plano)

**Cobertura da spec:**
- Migration `origem_pre_sistema` → Task 1.
- Parser com filtro de cor verde + limpeza de nome generalizada → Task 3.
- Mapeamento de campos (vigencia_inicio/fim sintético, eh_renovacao,
  origem_pre_sistema, sem veículo/CPF) → Task 4.
- Deduplicação → Task 4.
- Botão de importação em Emissões → Task 5.
- Reaproveitar limpeza de nome no importador mensal existente → Task 6.
- Bug do perfil (múltiplos identificadores) → Task 8.
- "Cliente desde" → Tasks 7, 8, 9.
- Etiquetas ativo/inativo/pré-sistema → Tasks 7, 9, 10.
- Redesenho da listagem (busca, letra, ordenação, paginação 50/página) →
  Task 10.
- Atualização de `docs/CURRENT_TASK.md` (regra do CLAUDE.md) → Task 11.

**Placeholders:** nenhum "TBD"/"implementar depois" — todo passo tem código
completo ou comando exato.

**Consistência de tipos/nomes:** `limparNomeSegurado`, `normalizeCompareText`,
`somarUmAno`, `isCelulaVerde`, `extrairLinhasHistoricoDaAba`,
`parseAutoHistoricoPlanilha` (Task 3) são usados com esses exatos nomes nas
Tasks 4, 5 e 6. `isApoliceAtiva`, `getClienteStatusAuto`, `formatMonthYearBR`
(Task 7) são usados com esses exatos nomes nas Tasks 8, 9 e 10.
`origem_pre_sistema` é o mesmo nome de coluna em todas as tasks (1, 2, 4, 8,
9, 10).
