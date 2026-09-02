// Rascunho do orcamento comparativo.
//
// O workspace de `AutoQuoteComparison` vivia inteiro em `useState`: sair da
// rota destruia o componente e junto com ele o upload, a leitura do PDF e toda
// a revisao ja conferida. Este modulo transforma esse estado em um documento
// serializavel para poder ser gravado e restaurado.
//
// Sao dois destinos, com papeis diferentes:
//   - localStorage: gravacao a cada digito, instantanea, sobrevive a navegacao
//     e ao refresh no mesmo navegador. E a rede de seguranca imediata.
//   - `cotacoes_auto.orcamento_rascunho` (jsonb): gravacao com debounce, dura
//     entre dispositivos. Depende da migration 72; enquanto ela nao rodar, o
//     modulo continua funcionando so com o local (ver `ehColunaAusente`).
//
// O File do PDF NAO e serializavel e nao vai para nenhum dos dois. O que
// importa para a revisao ja foi extraido: `leitura.cotacao`. Ao restaurar, a
// tela mostra o nome do arquivo lido e a revisao preenchida — o operador so
// precisa reenviar o PDF se quiser trocar de arquivo.

export const RASCUNHO_VERSAO = 1

export const LADOS_ORCAMENTO = ['atual', 'concorrente']

const PREFIXO_LOCAL = 'conves:auto:orcamento-rascunho'

export function chaveRascunhoLocal(cotacaoId) {
  return `${PREFIXO_LOCAL}:${cotacaoId || 'avulso'}`
}

function textoLimpo(value) {
  return String(value ?? '').trim()
}

function papeisDoWorkspace({ roles, sides } = {}) {
  const informados = Array.isArray(roles) ? roles : Object.keys(sides || {})
  const validos = informados.filter(role => typeof role === 'string' && /^[a-z0-9_]+$/i.test(role))
  return [...new Set([...LADOS_ORCAMENTO, ...validos])]
}

/**
 * Guarda so o que a revisao e a geracao do comparativo consomem depois.
 * `ofertas` fica junto porque o seletor de produto/oferta continua visivel
 * depois da escolha — trocar de opcao e uma acao normal, nao um refazer.
 */
function serializarLeitura(leitura) {
  if (!leitura || typeof leitura !== 'object') return null
  return {
    suportado: leitura.suportado !== false,
    seguradora: leitura.seguradora || '',
    motivo: leitura.motivo || '',
    ofertas: Array.isArray(leitura.ofertas) ? leitura.ofertas : [],
    cotacao: leitura.cotacao || null,
  }
}

/**
 * Estado do workspace virado documento. Sempre devolve os dois lados.
 *
 * `orcamento` guarda o `auto_orcamentos` ja gravado para esta cotacao. Sem ele,
 * voltar a tela e salvar de novo queimaria um segundo numero CV-AAAA-NNNN para
 * o mesmo orcamento.
 */
export function serializarRascunho({ step, roles, sides, parsers, leituras, orcamento } = {}) {
  const papeis = papeisDoWorkspace({ roles, sides })
  return {
    versao: RASCUNHO_VERSAO,
    salvo_em: new Date().toISOString(),
    step: step === 'review' ? 'review' : 'upload',
    orcamento: orcamento?.id ? { id: orcamento.id, referencia: orcamento.referencia || '' } : null,
    ordem: papeis,
    lados: Object.fromEntries(papeis.map(role => [role, {
      seguradora: textoLimpo(sides?.[role]?.seguradora),
      arquivo_nome: textoLimpo(sides?.[role]?.arquivo_nome),
      parser_id: textoLimpo(parsers?.[role]),
      campos: { ...(sides?.[role]?.campos || {}) },
      leitura: serializarLeitura(leituras?.[role]),
    }])),
  }
}

/**
 * Um rascunho so vale gravacao quando existe trabalho humano dentro dele.
 *
 * Sem esta guarda, abrir a cotacao e sair sem tocar em nada ja gravaria um
 * rascunho semeado pelo cadastro — e uma volta futura restauraria esse "nada"
 * por cima de dados mais novos vindos da cotacao.
 */
export function rascunhoTemTrabalho(rascunho) {
  if (!rascunho?.lados) return false
  return papeisDoWorkspace({ roles: rascunho.ordem, sides: rascunho.lados }).some(role => {
    const lado = rascunho.lados[role]
    return Boolean(lado?.arquivo_nome || lado?.leitura?.cotacao || lado?.parser_id)
  })
}

/** Remove o volume: usado quando o localStorage estoura a cota. */
export function rascunhoSemLeituras(rascunho) {
  if (!rascunho?.lados) return rascunho
  const papeis = papeisDoWorkspace({ roles: rascunho.ordem, sides: rascunho.lados })
  return {
    ...rascunho,
    ordem: papeis,
    lados: Object.fromEntries(papeis.map(role => [role, {
      ...(rascunho.lados[role] || {}),
      leitura: null,
    }])),
  }
}

/**
 * Documento de volta para o formato do workspace.
 *
 * `baseSides` e o estado semeado pela cotacao do sistema. Os campos do rascunho
 * entram POR CIMA dele, e nao no lugar dele: assim uma chave nova em
 * `REVIEW_FIELDS` nao vem `undefined` de um rascunho antigo, e o que o cadastro
 * sabe continua valendo onde o rascunho nao tem nada.
 */
export function restaurarRascunho(bruto, { baseSides } = {}) {
  if (!bruto || typeof bruto !== 'object' || !bruto.lados) return null
  if (bruto.versao !== RASCUNHO_VERSAO) return null

  const sides = {}
  const parsers = {}
  const leituras = {}
  const roles = papeisDoWorkspace({ roles: bruto.ordem, sides: bruto.lados })

  for (const role of roles) {
    const lado = bruto.lados[role] || {}
    const base = baseSides?.[role] || { seguradora: '', arquivo_nome: '', campos: {} }
    const camposGravados = Object.fromEntries(
      Object.entries(lado.campos || {}).filter(([, valor]) => valor !== undefined),
    )
    sides[role] = {
      ...base,
      seguradora: lado.seguradora || base.seguradora || '',
      arquivo_nome: lado.arquivo_nome || '',
      campos: { ...base.campos, ...camposGravados },
    }
    parsers[role] = lado.parser_id || ''
    leituras[role] = lado.leitura?.cotacao ? lado.leitura : null
  }

  return {
    step: bruto.step === 'review' ? 'review' : 'upload',
    salvo_em: bruto.salvo_em || null,
    orcamento: bruto.orcamento?.id ? bruto.orcamento : null,
    roles,
    sides,
    parsers,
    leituras,
  }
}

// ─── localStorage ────────────────────────────────────────────────────────
// Todo acesso e defensivo: navegador em modo privado, storage desativado por
// politica ou cota cheia nao podem derrubar a tela de cotacao.

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function lerRascunhoLocal(cotacaoId) {
  const store = storage()
  if (!store) return null
  try {
    const bruto = store.getItem(chaveRascunhoLocal(cotacaoId))
    return bruto ? JSON.parse(bruto) : null
  } catch {
    return null
  }
}

export function gravarRascunhoLocal(cotacaoId, rascunho) {
  const store = storage()
  if (!store) return false
  const chave = chaveRascunhoLocal(cotacaoId)
  try {
    store.setItem(chave, JSON.stringify(rascunho))
    return true
  } catch {
    // Cota estourada: o texto extraido do PDF e o que pesa. A revisao ja
    // conferida vale mais do que ele e cabe sozinha.
    try {
      store.setItem(chave, JSON.stringify(rascunhoSemLeituras(rascunho)))
      return true
    } catch {
      return false
    }
  }
}

export function limparRascunhoLocal(cotacaoId) {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(chaveRascunhoLocal(cotacaoId))
  } catch {
    // Sem storage nao ha o que limpar.
  }
}

/** Entre local e servidor, vence o mais recente. */
export function rascunhoMaisRecente(...candidatos) {
  return candidatos
    .filter(item => item && typeof item === 'object' && item.lados)
    .reduce((melhor, item) => {
      if (!melhor) return item
      return String(item.salvo_em || '') > String(melhor.salvo_em || '') ? item : melhor
    }, null)
}

/**
 * A coluna `orcamento_rascunho` so existe depois da migration 72. Ate la o
 * PostgREST responde com "Could not find the 'orcamento_rascunho' column ... in
 * the schema cache" — erro esperado, nao falha de gravacao, e a tela segue com
 * o rascunho local sem assustar o operador.
 */
export function ehColunaAusente(error, coluna = 'orcamento_rascunho') {
  const mensagem = String(error?.message || error || '')
  if (!mensagem) return false
  return mensagem.includes(coluna)
    && /could not find|schema cache|does not exist|nao existe/i.test(mensagem)
}
