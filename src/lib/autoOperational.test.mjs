import test from 'node:test'
import assert from 'node:assert/strict'
import './autoClientVerification.test.mjs'
import {
  AUTO_OTHER_PIPELINE_STAGES,
  AUTO_RENEWAL_PIPELINE_STAGES,
  classificarRenovacoesPipeline,
  countAutoEmissionTypes,
  filterAutoPipelineEmissions,
  isAutoRenewalEmission,
  isRenovacaoNoQuadro,
  isRenovacaoSemCalculo,
  parseRenovacoesPaste,
  renewalStatusFields,
  renewalStatusValue,
  renovacaoStageFields,
  resolveAutoEmissionStage,
  resolveRenovacaoStage,
  scoreCotacaoSuggestion,
  suggestRenewalClientByName,
} from './autoOperational.js'

test('separa as etapas da pipeline de renovacoes das demais operacoes', () => {
  assert.deepEqual(
    AUTO_RENEWAL_PIPELINE_STAGES.map(stage => stage.id),
    ['renovacoes', 'renovacoes_para_enviar', 'cotacao_feita', 'negociando', 'aguardando_vistoria', 'proposta_transmitida', 'apolice_emitida'],
  )
  assert.deepEqual(
    AUTO_OTHER_PIPELINE_STAGES.map(stage => stage.id),
    ['pendentes', 'cotacao_feita', 'negociando', 'aguardando_vistoria', 'proposta_transmitida', 'apolice_emitida'],
  )
})

test('cada emissao aparece em apenas uma das pipelines', () => {
  const items = [
    { id: 'novo', tipo: 'novo' },
    { id: 'endosso', cotacoes_auto: { tipo: 'endosso' } },
    { id: 'renovacao-cotacao', cotacoes_auto: { tipo: 'renovacao' } },
    { id: 'renovacao-emissao', tipo: 'novo', eh_renovacao: true },
  ]

  assert.equal(isAutoRenewalEmission(items[2]), true)
  assert.deepEqual(filterAutoPipelineEmissions(items, 'renovacoes').map(item => item.id), ['renovacao-cotacao', 'renovacao-emissao'])
  assert.deepEqual(filterAutoPipelineEmissions(items, 'outros').map(item => item.id), ['novo', 'endosso'])
})

test('contabiliza seguro novo, renovação e endosso separadamente', () => {
  assert.deepEqual(countAutoEmissionTypes([
    { tipo: 'novo' }, { tipo: 'renovacao' }, { tipo: 'endosso' }, { tipo: 'novo' }, {},
  ]), { novo: 3, renovacao: 1, endosso: 1 })
})

test('apólice vinculada sempre encerra a emissão como apólice emitida', () => {
  assert.equal(resolveAutoEmissionStage({ coluna: 'proposta_transmitida', apolices_auto: [{ id: 'ap-1' }] }), 'apolice_emitida')
  assert.equal(resolveAutoEmissionStage({ coluna: 'proposta_transmitida', apolices_auto: [] }), 'proposta_transmitida')
  assert.equal(resolveAutoEmissionStage({ coluna: 'apolice_emitida', resultado: null }), 'apolice_emitida')
})

test('separa renovacoes futuras das que ja precisam ser enviadas', () => {
  const result = classificarRenovacoesPipeline([
    { id: 1, data_limite_envio: '2026-08-21' },
    { id: 2, data_limite_envio: '2026-08-20' },
    { id: 3, data_limite_envio: '2026-08-18' },
  ], '2026-08-20')
  assert.deepEqual(result.futuras.map(item => item.id), [1])
  assert.deepEqual(result.paraEnviar.map(item => item.id), [2, 3])
})

test('pipeline inclui somente renovacoes sem calculo concluido', () => {
  assert.equal(isRenovacaoSemCalculo({ status_renovacao: 'pendente', status_operacional: 'pendente', status_cotacao: 'nao_cotada' }), true)
  assert.equal(isRenovacaoSemCalculo({ status_renovacao: 'pendente', status_operacional: 'cotando', status_cotacao: 'cotada_nao_enviada', cotacao_id: 'c1' }), true)
  assert.equal(isRenovacaoSemCalculo({ status_renovacao: 'pendente', status_operacional: 'cotado', cotada_em: '2026-08-20T10:00:00Z' }), false)
  assert.equal(isRenovacaoSemCalculo({ status_renovacao: 'pendente', status_operacional: 'enviado', status_cotacao: 'cotada_enviada' }), false)
  assert.equal(isRenovacaoSemCalculo({ status_renovacao: 'renovada', status_operacional: 'renovado' }), false)
})

test('cola uma coluna de nomes e usa o fim do mes selecionado', () => {
  const rows = parseRenovacoesPaste('Ana\nBruno', '2026-08')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].nome_cliente, 'Ana')
  assert.equal(rows[0].vigencia_fim, '2026-08-31')
})

test('cola uma grade com cabecalhos da planilha e veiculo', () => {
  const [row] = parseRenovacoesPaste('DATA\tCIA\tSEGURADO\tVEICULO\tSTATUS\tLIMITE\n21/08\tHDI\tAna\tCivic\tENVIADO\t14/08', '2026-08')
  assert.deepEqual(row, {
    nome_cliente: 'Ana', seguradora: 'HDI', vigencia_fim: '2026-08-21',
    data_limite_envio: '2026-08-14', identificacao_veiculo: 'Civic', outra_seguradora: '', status: 'enviada',
    pct_comissao_atual: null, pct_comissao_anterior: null,
  })
})

test('reconhece seguradora atual e outra seguradora opcionais', () => {
  const [row] = parseRenovacoesPaste('VENCIMENTO\tSEGURADORA ATUAL\tSEGURADO\tVEÍCULO\tOUTRA SEGURADORA\tCOMISSÃO PASSADA\n31/08/2026\tAllianz\tAna\tHR-V\tPorto\t18%', '2026-08')
  assert.equal(row.seguradora, 'Allianz')
  assert.equal(row.outra_seguradora, 'Porto')
  assert.equal(row.identificacao_veiculo, 'HR-V')
  assert.equal(row.pct_comissao_anterior, 18)
})

test('cola linha sem cabecalho na ordem exibida pela entrada de renovacoes', () => {
  const [row] = parseRenovacoesPaste('31/08/2026\tAllianz\tAna\tHR-V\tPorto\t18%', '2026-08')
  assert.equal(row.vigencia_fim, '2026-08-31')
  assert.equal(row.nome_cliente, 'Ana')
  assert.equal(row.identificacao_veiculo, 'HR-V')
  assert.equal(row.outra_seguradora, 'Porto')
  assert.equal(row.pct_comissao_anterior, 18)
})

test('preserva os status operacionais e comissoes usados em agosto de 2026', () => {
  const [row] = parseRenovacoesPaste('DATA\tCIA\tSEGURADO\tSTATUS\tLIMITE\tCOMISSÃO\tCOM PASSADA\n22/08\tPorto\tBeatriz\tOUTRA CORRETORA\t15/08\t20,5%\t18%', '2026-08')
  assert.equal(row.status, 'outra_corretora')
  assert.equal(row.pct_comissao_atual, 20.5)
  assert.equal(row.pct_comissao_anterior, 18)
})

test('mapeia status da planilha para os campos persistidos', () => {
  assert.deepEqual(renewalStatusFields('renovada'), { status_operacional: 'renovado', status_cotacao: 'cotada_enviada', status_renovacao: 'renovada' })
  assert.deepEqual(renewalStatusFields('cotada'), { status_operacional: 'cotado', status_cotacao: 'cotada_nao_enviada', status_renovacao: 'pendente' })
  assert.equal(renewalStatusValue({ status_operacional: 'cotado' }), 'cotada')
})

test('prioriza sugestao exata e proxima da data informada', () => {
  const exact = scoreCotacaoSuggestion({ nome_cliente: 'Ana Souza', created_at: '2026-08-19', cotacao_id: '1' }, 'Ana Souza', '2026-08-20')
  const partial = scoreCotacaoSuggestion({ nome_cliente: 'Ana Souza Lima', created_at: '2026-01-01', cotacao_id: '2' }, 'Ana Souza', '2026-08-20')
  assert.ok(exact > partial)
})

test('sugere cliente existente pelo nome apenas quando a correspondencia e unica', () => {
  const clientes = [{ id: '1', nome_completo: 'José da Silva' }, { id: '2', nome_completo: 'Maria Souza' }]
  assert.equal(suggestRenewalClientByName('Jose da Silva', clientes)?.id, '1')
  assert.equal(suggestRenewalClientByName('Maria', clientes)?.id, '2')
  assert.equal(suggestRenewalClientByName('Jo', clientes), null)
  assert.equal(suggestRenewalClientByName('Ana', [{ id: '3', nome_completo: 'Ana Lima' }, { id: '4', nome_completo: 'Ana Souza' }]), null)
})

// ─── Renovacao arrastavel na Pipeline ──────────────────────────────────────

test('renovacao sem status de trabalho fica nas colunas de renovacao, dividida pela data limite', () => {
  assert.equal(resolveRenovacaoStage({ data_limite_envio: '2026-08-21' }, '2026-08-20'), 'renovacoes')
  assert.equal(resolveRenovacaoStage({ data_limite_envio: '2026-08-20' }, '2026-08-20'), 'renovacoes_para_enviar')
  assert.equal(resolveRenovacaoStage({ status_operacional: 'pendente', vigencia_fim: '2026-08-18' }, '2026-08-20'), 'renovacoes_para_enviar')
})

test('abrir a cotacao (cotando) nao tira a renovacao da coluna de renovacao', () => {
  assert.equal(
    resolveRenovacaoStage({ status_operacional: 'cotando', cotacao_id: 'c1', data_limite_envio: '2026-08-21' }, '2026-08-20'),
    'renovacoes',
  )
})

test('cada etapa do funil devolve a renovacao na coluna onde ela foi solta', () => {
  const etapas = ['cotacao_feita', 'negociando', 'aguardando_vistoria', 'proposta_transmitida', 'apolice_emitida']
  for (const etapa of etapas) {
    const campos = renovacaoStageFields(etapa)
    assert.ok(campos, `${etapa} deveria ter campos`)
    assert.equal(resolveRenovacaoStage({ ...campos, data_limite_envio: '2026-08-18' }, '2026-08-20'), etapa)
  }
})

test('soltar em "Cotacoes pendentes" devolve a renovacao para o backlog pendente', () => {
  const campos = renovacaoStageFields('pendentes')
  assert.equal(campos.status_operacional, 'pendente')
  assert.equal(resolveRenovacaoStage({ ...campos, data_limite_envio: '2026-08-21' }, '2026-08-20'), 'renovacoes')
})

test('aguardando vistoria e negociando gravam status validos e nao se confundem', () => {
  const vistoria = renovacaoStageFields('aguardando_vistoria')
  const negociando = renovacaoStageFields('negociando')
  // Os dois usam o mesmo status_operacional; o que os separa e o status_cotacao.
  assert.equal(vistoria.status_operacional, 'negociando')
  assert.equal(negociando.status_operacional, 'negociando')
  assert.notEqual(vistoria.status_cotacao, negociando.status_cotacao)
  // Ambos precisam respeitar os CHECKs da tabela renovacoes_auto.
  const operacionaisValidos = ['pendente', 'cotando', 'cotado', 'enviado', 'negociando', 'outra_corretora', 'renovado', 'cancelado']
  const cotacaoValidos = ['nao_cotada', 'cotada_nao_enviada', 'cotada_enviada']
  for (const etapa of ['renovacoes', 'renovacoes_para_enviar', 'pendentes', 'cotacao_feita', 'negociando', 'aguardando_vistoria', 'proposta_transmitida', 'apolice_emitida']) {
    const campos = renovacaoStageFields(etapa)
    assert.ok(operacionaisValidos.includes(campos.status_operacional), `${etapa}: status_operacional invalido`)
    assert.ok(cotacaoValidos.includes(campos.status_cotacao), `${etapa}: status_cotacao invalido`)
  }
  // Para as outras telas o negocio continua legivel como "aguardando retorno".
  assert.equal(renewalStatusValue(vistoria), 'negociando')
})

test('coluna desconhecida nao grava nada', () => {
  assert.equal(renovacaoStageFields('coluna_que_nao_existe'), null)
})

test('renovacao posicionada no funil continua no quadro em vez de sumir', () => {
  // Era o bug: estes quatro estados fazem isRenovacaoSemCalculo devolver false,
  // entao a renovacao sumia logo depois de ser arrastada.
  for (const status_operacional of ['cotado', 'enviado', 'negociando', 'renovado']) {
    assert.equal(isRenovacaoSemCalculo({ status_operacional }), false)
    assert.equal(isRenovacaoNoQuadro({ status_operacional }), true)
  }
  // Saidas do funil continuam fora do quadro.
  assert.equal(isRenovacaoNoQuadro({ status_operacional: 'outra_corretora' }), false)
  assert.equal(isRenovacaoNoQuadro({ status_operacional: 'cancelado' }), false)
  // E quem nunca foi trabalhado segue entrando.
  assert.equal(isRenovacaoNoQuadro({ status_operacional: 'pendente', status_cotacao: 'nao_cotada' }), true)
})
