import test from 'node:test'
import assert from 'node:assert/strict'
import {
  alignRenewalDateToMonth,
  isNamesOnlyRenewalPaste,
  isRenewalDateInMonth,
  parseRenewalPlanningMatrix,
  renewalDraftIssue,
} from './autoRenewalImport.js'

test('move a vigência da planilha anterior para o mês alvo', () => {
  assert.equal(alignRenewalDateToMonth('2025-08-17', '2026-08'), '2026-08-17')
})

test('interpreta a estrutura real da planilha de renovações', () => {
  const rows = parseRenewalPlanningMatrix([
    ['DATA', 'CIA', 'SEGURADO ', 'STATUS ', 'LIMITE', 'COMISSÃO ', 'COM PASSADA'],
    ['19/08/2026', 'MAPFRE', 'ROBERTA MATIAS --- FIORINO', 'NEGOCIANDO', '12/08/2026', '24%', '20%'],
  ], '2026-08')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].nome_cliente, 'ROBERTA MATIAS')
  assert.equal(rows[0].identificacao_veiculo, 'FIORINO')
  assert.equal(rows[0].status, 'negociando')
  assert.equal(rows[0].pct_comissao_atual, 24)
})

test('converte datas seriais e percentuais numéricos do Excel', () => {
  const [row] = parseRenewalPlanningMatrix([
    ['DATA', 'CIA', 'SEGURADO', 'STATUS', 'LIMITE', 'COMISSÃO', 'COM PASSADA'],
    [46249, 'PORTO', 'MARIA PROCOPIO ---', 'CANCELADO', 46241, 0.24, 0.2],
  ], '2026-08')
  assert.equal(row.vigencia_fim, '2026-08-15')
  assert.equal(row.data_limite_envio, '2026-08-07')
  assert.equal(row.pct_comissao_atual, 24)
  assert.equal(row.pct_comissao_anterior, 20)
  assert.equal(row.identificacao_veiculo, '')
})

test('ajusta o último dia quando o mês alvo é menor', () => {
  assert.equal(alignRenewalDateToMonth('2025-01-31', '2026-02'), '2026-02-28')
})

test('reconhece uma coluna de nomes colada sobre a primeira coluna da grade', () => {
  const column = { field: 'vigencia_fim' }
  assert.equal(isNamesOnlyRenewalPaste([
    { column, value: 'ANA SILVA' },
    { column, value: 'BRUNO LIMA' },
  ]), true)
  assert.equal(isNamesOnlyRenewalPaste([{ column, value: '2026-08-12' }]), false)
})

test('impede que uma renovação seja salva fora do mês selecionado', () => {
  assert.equal(isRenewalDateInMonth('2026-08-12', '2026-08'), true)
  assert.equal(renewalDraftIssue({ nome_cliente: 'Ana', vigencia_fim: '2025-08-12' }, '2026-08'), 'outside_month')
  assert.equal(renewalDraftIssue({ nome_cliente: 'Ana', vigencia_fim: 'Ana Silva' }, '2026-08'), 'invalid_date')
})
