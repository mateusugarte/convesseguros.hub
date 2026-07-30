// Planejamento puro da exclusao em cascata do modulo Auto.
// Sem imports de Supabase/Vite -> unit-testavel com `node --test`.
//
// Contexto: renovacao, cotacao, emissao e apolice formam um unico grupo
// logico. As FKs entre elas nao tem CASCADE (e renovacoes_auto.cotacao_id
// ainda e ON DELETE SET NULL), entao apagar so uma das pontas deixava a outra
// viva no sistema:
//   - apagar a cotacao zerava renovacoes_auto.cotacao_id e o registro voltava
//     para a coluna "Renovacoes" do Kanban e para /auto/renovacoes;
//   - apagar a renovacao deixava a cotacao e o card de emissao orfaos.
// Este planejador monta a ordem correta de DELETEs para o grupo inteiro.

function unicos(valores) {
  return [...new Set(valores.filter(Boolean))]
}

function passo(tabela, coluna, ids) {
  return ids.length ? [{ tabela, coluna, ids }] : []
}

/**
 * Monta a lista ordenada de DELETEs para excluir de vez um grupo do Auto.
 *
 * @param {object} entrada
 * @param {string[]} [entrada.cotacaoIds]   cotacoes que o usuario mandou excluir
 * @param {string[]} [entrada.renovacaoIds] renovacoes que o usuario mandou excluir
 * @param {object[]} [entrada.emissoes]     emissoes_auto {id, cotacao_id} do grupo
 * @param {object[]} [entrada.apolices]     apolices_auto {id, emissao_id} do grupo
 * @param {object[]} [entrada.renovacoes]   renovacoes_auto {id, cotacao_id, apolice_id} do grupo
 * @param {object[]} [entrada.endossos]     endossos_auto {id, apolice_id, cotacao_id} do grupo
 * @param {object[]} [entrada.sinistros]    sinistros_auto {id, apolice_id} das apolices do grupo
 * @returns {{ bloqueio: string|null, passos: {tabela: string, coluna: string, ids: string[]}[] }}
 */
export function planejarExclusaoGrupoAuto({
  cotacaoIds = [],
  renovacaoIds = [],
  emissoes = [],
  apolices = [],
  renovacoes = [],
  endossos = [],
  sinistros = [],
} = {}) {
  const cotacoes = unicos(cotacaoIds)
  const emissaoIds = unicos(emissoes.map(item => item.id))
  const apoliceIds = unicos(apolices.map(item => item.id))

  // Sinistro e registro de historico do cliente: preferimos barrar a exclusao
  // com uma mensagem legivel a deixar o Postgres devolver um erro cru de FK
  // (ou, pior, apagar o sinistro por tabela).
  if (apoliceIds.length && sinistros.some(item => apoliceIds.includes(item.apolice_id))) {
    return {
      bloqueio: 'Existe sinistro registrado para a apolice deste grupo. Exclua o sinistro antes.',
      passos: [],
    }
  }

  const temRenovacaoDaCotacao = renovacoes.some(item => cotacoes.includes(item.cotacao_id))
  const temEndossoDaCotacao = endossos.some(item => cotacoes.includes(item.cotacao_id))

  // Renovacoes que o usuario pediu para excluir e que nao pertencem a nenhuma
  // cotacao do grupo (renovacao avulsa: manual, de planilha ou da carteira).
  // Aqui a apolice referenciada NAO entra no plano — ela e um registro real da
  // carteira; a renovacao apenas aponta para ela.
  const idsPorCotacao = new Set(
    renovacoes.filter(item => cotacoes.includes(item.cotacao_id)).map(item => item.id)
  )
  const renovacoesAvulsas = unicos(renovacaoIds).filter(id => !idsPorCotacao.has(id))

  const passos = [
    // 1. Dependentes da apolice (FKs sem cascade apontando para apolices_auto).
    //    A renovacao criada pelo trigger tg_apolice_to_renovacao entra aqui:
    //    sem isso, apagar uma cotacao ja emitida falha com erro 23503.
    ...passo('renovacoes_auto', 'apolice_id', apoliceIds),
    ...passo('endossos_auto', 'apolice_id', apoliceIds),
    // 2. Apolice, depois emissao (apolices_auto.emissao_id -> emissoes_auto).
    ...passo('apolices_auto', 'id', apoliceIds),
    ...passo('emissoes_auto', 'id', emissaoIds),
    // 3. Dependentes da cotacao. A renovacao PRECISA sair antes da cotacao: a
    //    FK e ON DELETE SET NULL, entao apagar a cotacao primeiro apenas
    //    desvincularia a renovacao e ela reapareceria como "nao cotada".
    ...passo('endossos_auto', 'cotacao_id', temEndossoDaCotacao ? cotacoes : []),
    ...passo('renovacoes_auto', 'cotacao_id', temRenovacaoDaCotacao ? cotacoes : []),
    // 4. Renovacoes avulsas pedidas diretamente pelo usuario.
    ...passo('renovacoes_auto', 'id', renovacoesAvulsas),
    // 5. Por fim a propria cotacao.
    ...passo('cotacoes_auto', 'id', cotacoes),
  ]

  return { bloqueio: null, passos }
}
