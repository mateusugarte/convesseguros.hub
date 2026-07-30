import test from 'node:test'
import assert from 'node:assert/strict'

const { planejarExclusaoGrupoAuto } = await import('./autoExclusao.js')

function indiceDoPasso(plano, tabela, coluna) {
  return plano.passos.findIndex(passo => passo.tabela === tabela && passo.coluna === coluna)
}

test('a renovacao vinculada sai no plano ANTES da cotacao', () => {
  // Regressao do bug relatado: renovacoes_auto.cotacao_id tem FK
  // ON DELETE SET NULL. Se a cotacao for apagada primeiro, o banco apenas
  // desvincula a renovacao (cotacao_id -> null) e ela reaparece na coluna
  // "Renovacoes" do Kanban / em /auto/renovacoes — parecendo nao excluida.
  const plano = planejarExclusaoGrupoAuto({
    cotacaoIds: ['cot-1'],
    emissoes: [{ id: 'emi-1', cotacao_id: 'cot-1' }],
    renovacoes: [{ id: 'ren-1', cotacao_id: 'cot-1', apolice_id: null }],
  })

  const iRenovacao = indiceDoPasso(plano, 'renovacoes_auto', 'cotacao_id')
  const iCotacao = indiceDoPasso(plano, 'cotacoes_auto', 'id')
  assert.ok(iRenovacao >= 0, 'a renovacao vinculada precisa estar no plano')
  assert.ok(iCotacao >= 0, 'a cotacao precisa estar no plano')
  assert.ok(iRenovacao < iCotacao, 'a renovacao precisa ser apagada antes da cotacao')
})

test('excluir uma renovacao arrasta a cotacao e a emissao geradas por ela', () => {
  // Regressao do bug relatado: excluirRenovacao apagava so a linha de
  // renovacoes_auto e deixava a cotacao/emissao orfas, visiveis em
  // /auto/cotacoes e no Kanban de emissoes.
  const plano = planejarExclusaoGrupoAuto({
    renovacaoIds: ['ren-1'],
    cotacaoIds: ['cot-1'],
    emissoes: [{ id: 'emi-1', cotacao_id: 'cot-1' }],
    renovacoes: [{ id: 'ren-1', cotacao_id: 'cot-1', apolice_id: null }],
  })

  assert.ok(indiceDoPasso(plano, 'emissoes_auto', 'id') >= 0, 'a emissao precisa entrar no plano')
  assert.ok(indiceDoPasso(plano, 'cotacoes_auto', 'id') >= 0, 'a cotacao precisa entrar no plano')
  assert.deepEqual(plano.passos.find(p => p.tabela === 'emissoes_auto').ids, ['emi-1'])
})

test('a ordem respeita as FKs: dependentes da apolice, apolice, emissao, cotacao', () => {
  const plano = planejarExclusaoGrupoAuto({
    cotacaoIds: ['cot-1'],
    emissoes: [{ id: 'emi-1', cotacao_id: 'cot-1' }],
    apolices: [{ id: 'apo-1', emissao_id: 'emi-1' }],
    renovacoes: [{ id: 'ren-1', cotacao_id: null, apolice_id: 'apo-1' }],
    endossos: [{ id: 'end-1', apolice_id: 'apo-1', cotacao_id: null }],
  })

  const iRenovacaoApolice = indiceDoPasso(plano, 'renovacoes_auto', 'apolice_id')
  const iEndosso = indiceDoPasso(plano, 'endossos_auto', 'apolice_id')
  const iApolice = indiceDoPasso(plano, 'apolices_auto', 'id')
  const iEmissao = indiceDoPasso(plano, 'emissoes_auto', 'id')
  const iCotacao = indiceDoPasso(plano, 'cotacoes_auto', 'id')

  assert.ok(iRenovacaoApolice < iApolice, 'renovacao da apolice antes da apolice')
  assert.ok(iEndosso < iApolice, 'endosso antes da apolice')
  assert.ok(iApolice < iEmissao, 'apolice antes da emissao')
  assert.ok(iEmissao < iCotacao, 'emissao antes da cotacao')
})

test('sinistro vinculado bloqueia a exclusao em vez de gerar um erro cru de FK', () => {
  const plano = planejarExclusaoGrupoAuto({
    cotacaoIds: ['cot-1'],
    emissoes: [{ id: 'emi-1', cotacao_id: 'cot-1' }],
    apolices: [{ id: 'apo-1', emissao_id: 'emi-1' }],
    sinistros: [{ id: 'sin-1', apolice_id: 'apo-1' }],
  })

  assert.ok(plano.bloqueio, 'precisa devolver um motivo de bloqueio legivel')
  assert.equal(plano.passos.length, 0, 'nada pode ser apagado quando ha bloqueio')
})

test('renovacao avulsa (sem cotacao) remove apenas a propria linha', () => {
  const plano = planejarExclusaoGrupoAuto({
    renovacaoIds: ['ren-1'],
    renovacoes: [{ id: 'ren-1', cotacao_id: null, apolice_id: null }],
  })

  assert.equal(plano.bloqueio, null)
  assert.deepEqual(plano.passos, [{ tabela: 'renovacoes_auto', coluna: 'id', ids: ['ren-1'] }])
})

test('a apolice de uma renovacao nao e apagada quando se exclui so a renovacao', () => {
  // A renovacao vinda da carteira (origem sistema) so aponta para a apolice
  // real; apagar a renovacao nao pode arrastar a apolice emitida junto.
  const plano = planejarExclusaoGrupoAuto({
    renovacaoIds: ['ren-1'],
    renovacoes: [{ id: 'ren-1', cotacao_id: null, apolice_id: 'apo-1' }],
  })

  assert.equal(indiceDoPasso(plano, 'apolices_auto', 'id'), -1, 'a apolice nao entra no plano')
  assert.deepEqual(plano.passos, [{ tabela: 'renovacoes_auto', coluna: 'id', ids: ['ren-1'] }])
})

test('emissao manual (sem cotacao) leva junto a apolice e a renovacao do trigger', () => {
  // O trigger tg_apolice_to_renovacao cria uma renovacao para toda apolice
  // inserida. Sem apagar essa renovacao antes, o delete da apolice batia na
  // FK renovacoes_auto_apolice_id_fkey e o card continuava no Kanban.
  const plano = planejarExclusaoGrupoAuto({
    emissoes: [{ id: 'emi-1', cotacao_id: null }],
    apolices: [{ id: 'apo-1', emissao_id: 'emi-1' }],
    renovacoes: [{ id: 'ren-1', cotacao_id: null, apolice_id: 'apo-1' }],
  })

  const iRenovacao = indiceDoPasso(plano, 'renovacoes_auto', 'apolice_id')
  const iApolice = indiceDoPasso(plano, 'apolices_auto', 'id')
  const iEmissao = indiceDoPasso(plano, 'emissoes_auto', 'id')
  assert.ok(iRenovacao >= 0 && iRenovacao < iApolice, 'renovacao do trigger sai antes da apolice')
  assert.ok(iApolice < iEmissao, 'apolice antes da emissao')
  assert.equal(indiceDoPasso(plano, 'cotacoes_auto', 'id'), -1, 'nao ha cotacao nesse fluxo')
})

test('nao gera passos vazios', () => {
  const plano = planejarExclusaoGrupoAuto({ cotacaoIds: ['cot-1'] })
  assert.ok(plano.passos.every(passo => passo.ids.length > 0))
})
