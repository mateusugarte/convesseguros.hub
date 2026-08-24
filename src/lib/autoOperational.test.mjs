import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classificarRenovacoesPipeline,
  parseRenovacoesPaste,
  renewalStatusFields,
  renewalStatusValue,
  scoreCotacaoSuggestion,
  suggestRenewalClientByName,
} from './autoOperational.js'

test('separa renovacoes futuras das que ja precisam ser enviadas', () => {
  const result = classificarRenovacoesPipeline([
    { id: 1, data_limite_envio: '2026-08-21' },
    { id: 2, data_limite_envio: '2026-08-20' },
    { id: 3, data_limite_envio: '2026-08-18' },
  ], '2026-08-20')
  assert.deepEqual(result.futuras.map(item => item.id), [1])
  assert.deepEqual(result.paraEnviar.map(item => item.id), [2, 3])
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
