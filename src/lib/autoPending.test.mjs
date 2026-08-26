import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAutoPendingNotifications } from './autoPending.js'

const today = '2026-08-21'

test('cria uma pendência crítica para renovação atrasada ainda não enviada', () => {
  const result = buildAutoPendingNotifications({
    today,
    renovacoes: [{ id: 'r1', nome_cliente: 'Ana Lima', vigencia_fim: '2026-08-30', data_limite_envio: '2026-08-18', status_operacional: 'pendente' }],
  })
  assert.equal(result.length, 1)
  assert.equal(result[0].kind, 'cotacao_envio')
  assert.equal(result[0].priority, 'critical')
  assert.equal(result[0].dueLabel, 'Atrasada há 3 dias')
  assert.equal(result[0].href, '/auto/renovacoes/planilha?mes=2026-08')
})

test('não cobra envio de renovação já enviada, mas preserva follow-up vencido', () => {
  const result = buildAutoPendingNotifications({
    today,
    renovacoes: [{ id: 'r2', nome_cliente: 'Beto Reis', vigencia_fim: '2026-08-29', data_limite_envio: today, proximo_followup_em: today, status_operacional: 'enviado' }],
  })
  assert.deepEqual(result.map(item => item.kind), ['followup'])
  assert.equal(result[0].dueLabel, 'Para hoje')
})

test('cria emissão, coleta de apólice e vistoria conforme a etapa do pipeline', () => {
  const result = buildAutoPendingNotifications({
    today,
    emissoes: [
      { id: 'e1', nome_cliente: 'Caio', coluna: 'cotacao_feita', created_at: '2026-08-20T10:00:00Z' },
      { id: 'e2', nome_cliente: 'Dora', coluna: 'proposta_transmitida', seguradora: 'Allianz', updated_at: '2026-08-17T10:00:00Z', apolices_auto: [] },
      { id: 'e3', nome_cliente: 'Enzo', coluna: 'aguardando_vistoria', modelo_veiculo: 'HR-V', created_at: '2026-08-21T10:00:00Z' },
    ],
  })
  assert.deepEqual(new Set(result.map(item => item.kind)), new Set(['continuidade', 'coletar_apolice', 'vistoria']))
  assert.equal(result.find(item => item.kind === 'coletar_apolice').priority, 'critical')
  assert.equal(result.find(item => item.kind === 'vistoria').description.includes('HR-V'), true)
})

test('pergunta se cotação parada foi feita e direciona para o acompanhamento', () => {
  const result = buildAutoPendingNotifications({
    today,
    cotacoes: [{ id: 'c1', nome_cliente: 'Gabi', status: 'pendente', updated_at: '2026-08-18T10:00:00Z', emissoes_auto: [] }],
  })
  assert.equal(result[0].kind, 'cotacao_confirmacao')
  assert.equal(result[0].priority, 'critical')
  assert.match(result[0].title, /foi feita\?$/)
  assert.equal(result[0].href, '/auto/cotacoes/c1?tab=operacao')
})

test('lembrete aparece na véspera, no dia e quando atrasa', () => {
  const base = { id: 'l1', cotacao_id: 'c1', titulo: 'Ligar para Ana', avisar_antes_dias: 1 }
  assert.equal(buildAutoPendingNotifications({ today, lembretes: [{ ...base, data_lembrete: '2026-08-22' }] })[0].dueLabel, 'Amanhã')
  assert.equal(buildAutoPendingNotifications({ today, lembretes: [{ ...base, data_lembrete: today }] })[0].dueLabel, 'Para hoje')
  assert.match(buildAutoPendingNotifications({ today, lembretes: [{ ...base, data_lembrete: '2026-08-19' }] })[0].dueLabel, /Atrasada/)
  assert.equal(buildAutoPendingNotifications({ today, lembretes: [{ ...base, data_lembrete: '2026-08-23' }] }).length, 0)
})

test('próximo passo vencido vira follow-up e cotação com emissão não duplica pergunta inicial', () => {
  const result = buildAutoPendingNotifications({
    today,
    cotacoes: [{ id: 'c2', nome_cliente: 'Hugo', status: 'aberta', updated_at: '2026-08-18', proximo_passo: 'Cobrar documentos', proximo_passo_em: today, emissoes_auto: [{ coluna: 'cotacao_feita' }] }],
  })
  assert.deepEqual(result.map(item => item.kind), ['followup'])
  assert.equal(result[0].title, 'Cobrar documentos')
})

test('não pede coleta quando a proposta já possui apólice vinculada', () => {
  const result = buildAutoPendingNotifications({
    today,
    emissoes: [{ id: 'e4', nome_cliente: 'Fabi', coluna: 'proposta_transmitida', created_at: today, apolices_auto: [{ id: 'a1' }] }],
  })
  assert.equal(result.length, 0)
})

test('ordena críticas antes das tarefas normais', () => {
  const result = buildAutoPendingNotifications({
    today,
    emissoes: [
      { id: 'normal', nome_cliente: 'Hoje', coluna: 'aguardando_vistoria', created_at: `${today}T08:00:00Z` },
      { id: 'critical', nome_cliente: 'Atrasado', coluna: 'proposta_transmitida', created_at: '2026-08-10T08:00:00Z', apolices_auto: [] },
    ],
  })
  assert.equal(result[0].id, 'coletar_apolice:critical')
  assert.equal(result.at(-1).priority, 'normal')
})
