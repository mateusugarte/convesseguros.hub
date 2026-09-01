// Regras do quadro da Pipeline AUTO que nao dependem de React.
//
// Duas dores concretas do dia a dia em notebook motivaram este modulo:
//
//   1. Arrastar um card entre colunas de um quadro que rola na horizontal e
//      penoso com trackpad. `etapaVizinha` da o mesmo resultado com um clique.
//   2. O quadro reabria sempre igual — densidade, colunas recolhidas e mes
//      voltavam ao padrao a cada visita. `lerPreferenciasPipeline` devolve o
//      quadro do jeito que a pessoa deixou.

// Ordem real do funil de emissoes. As duas colunas virtuais de renovacao
// (`renovacoes`, `renovacoes_para_enviar`) ficam de fora de proposito: mover um
// card para la nao existe — "avancar" uma renovacao significa iniciar a cotacao.
export const AUTO_EMISSION_STAGES = [
  'pendentes',
  'cotacao_feita',
  'negociando',
  'aguardando_vistoria',
  'proposta_transmitida',
  'apolice_emitida',
]

// As duas etapas abaixo representam uma proposta que ja foi transmitida.
// "Aguardando vistoria" e uma condicao operacional posterior ao envio, nao
// uma cotacao ainda em negociacao; por isso ela precisa coletar e preservar os
// mesmos dados financeiros e de vigencia da coluna Proposta transmitida.
export const AUTO_PROPOSAL_TRANSMISSION_STAGES = [
  'aguardando_vistoria',
  'proposta_transmitida',
]

export function isProposalTransmissionStage(stageId) {
  return AUTO_PROPOSAL_TRANSMISSION_STAGES.includes(stageId)
}

// Qualquer entrada nestas etapas precisa passar pelo formulario de registro;
// nenhuma tela deve conseguir apenas trocar a coluna e deixar a transmissao
// ou a apolice sem os dados operacionais correspondentes.
export function requiresAutoEmissionRegistration(stageId) {
  return isProposalTransmissionStage(stageId) || stageId === 'apolice_emitida'
}

/** Etapa imediatamente antes (-1) ou depois (+1). `null` nas pontas. */
export function etapaVizinha(stageId, direcao) {
  const indice = AUTO_EMISSION_STAGES.indexOf(stageId)
  if (indice < 0) return null
  const alvo = indice + (direcao >= 0 ? 1 : -1)
  return AUTO_EMISSION_STAGES[alvo] ?? null
}

// Ordem do funil para uma RENOVACAO. Aqui a coluna de renovacao e uma etapa de
// verdade — o comeco do funil dela — e nao uma coluna virtual como e para a
// emissao. `renovacoes_para_enviar` fica de fora porque nao e um estado que se
// escolhe: as duas colunas gravam "pendente" e a data limite decide em qual das
// duas o card aparece.
export const AUTO_RENEWAL_STAGES = [
  'renovacoes',
  'cotacao_feita',
  'negociando',
  'aguardando_vistoria',
  'proposta_transmitida',
  'apolice_emitida',
]

export function etapaVizinhaRenovacao(stageId, direcao) {
  const atual = stageId === 'renovacoes_para_enviar' ? 'renovacoes' : stageId
  const indice = AUTO_RENEWAL_STAGES.indexOf(atual)
  if (indice < 0) return null
  const alvo = indice + (direcao >= 0 ? 1 : -1)
  return AUTO_RENEWAL_STAGES[alvo] ?? null
}

/**
 * Somatorio financeiro de uma coluna.
 *
 * O contador de itens sozinho nao responde a pergunta que a operacao faz o dia
 * inteiro ("quanto tem parado em negociacao?"). Valor invalido conta como zero
 * em vez de contaminar o total com NaN.
 */
export function resumoFinanceiroEtapa(cards = [], obterValores = () => ({})) {
  return cards.reduce((resumo, card) => {
    const { premio, comissao } = obterValores(card) || {}
    const premioNum = Number(premio)
    const comissaoNum = Number(comissao)
    return {
      total: resumo.total + 1,
      premio: resumo.premio + (Number.isFinite(premioNum) ? premioNum : 0),
      comissao: resumo.comissao + (Number.isFinite(comissaoNum) ? comissaoNum : 0),
    }
  }, { total: 0, premio: 0, comissao: 0 })
}

// ─── Preferencias do quadro ──────────────────────────────────────────────

const CHAVE_PREFERENCIAS = 'conves:auto:pipeline-preferencias'

export const PREFERENCIAS_PIPELINE_PADRAO = {
  densidade: 'comfortable',
  recolhidas: [],
}

function normalizarPreferencias(bruto) {
  const densidade = bruto?.densidade === 'compact' ? 'compact' : 'comfortable'
  const recolhidas = Array.isArray(bruto?.recolhidas)
    ? [...new Set(bruto.recolhidas.filter(id => typeof id === 'string' && id))]
    : []
  return { densidade, recolhidas }
}

export function lerPreferenciasPipeline() {
  try {
    const bruto = window.localStorage.getItem(CHAVE_PREFERENCIAS)
    return normalizarPreferencias(bruto ? JSON.parse(bruto) : null)
  } catch {
    return { ...PREFERENCIAS_PIPELINE_PADRAO }
  }
}

export function gravarPreferenciasPipeline(preferencias) {
  try {
    window.localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(normalizarPreferencias(preferencias)))
    return true
  } catch {
    return false
  }
}

/**
 * Recolher/expandir uma coluna.
 *
 * A ultima coluna visivel nunca pode ser recolhida: um quadro sem nenhuma
 * coluna aberta e uma tela vazia sem saida obvia para o usuario.
 */
export function alternarColunaRecolhida(recolhidas = [], id, totalColunas = AUTO_EMISSION_STAGES.length) {
  const atual = new Set(recolhidas)
  if (atual.has(id)) {
    atual.delete(id)
  } else {
    if (atual.size + 1 >= totalColunas) return [...atual]
    atual.add(id)
  }
  return [...atual]
}
