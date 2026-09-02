function texto(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function respostaSimNao(value) {
  const raw = texto(value)
  if (!raw) return ''
  if (/^(?:sim|s|true|1)\b/i.test(raw)) return 'Sim'
  if (/^(?:n[aã]o|n|false|0)\b/i.test(raw)) return 'Não'
  return raw
}

function booleanoDepois(text, labels) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}[\\s:;?–—-]{0,30}(sim|n[aã]o|true|false|1|0)\\b`, 'i'))
    if (match) return respostaSimNao(match[1])
  }
  return ''
}

function garagem(text, kind) {
  const patterns = {
    residencia: [
      /garagem\/?estacionamento fechado na resid[êe]ncia\?\s*(sim|n[aã]o|[^?]{0,45}?garagem na resid[êe]ncia)/i,
      /garagem na resid[êe]ncia[\s:–—-]{0,20}(sim|n[aã]o)/i,
    ],
    trabalho: [
      /garagem\/?estacionamento fechado quando utilizado para ir ao local de trabalho\?\s*(sim|n[aã]o|utiliza[^?]{0,70})/i,
      /garagem no trabalho[\s:–—-]{0,20}(sim|n[aã]o)/i,
    ],
    estudo: [
      /garagem\/?estacionamento fechado quando utilizado para ir (?:à|a) faculdade\/?col[ée]gio\?\s*(sim|n[aã]o|utiliza[^?]{0,70})/i,
      /garagem (?:no local de estudo|na faculdade|no col[ée]gio)[\s:–—-]{0,20}(sim|n[aã]o)/i,
    ],
  }
  for (const pattern of patterns[kind] || []) {
    const match = text.match(pattern)
    if (!match) continue
    const answer = texto(match[1])
    if (/n[aã]o guarda|sem garagem/i.test(answer)) return 'Não'
    if (/garagem na|guarda/i.test(answer)) return 'Sim'
    return respostaSimNao(answer)
  }
  return ''
}

function tipoResidencia(text) {
  const match = text.match(/tipo de resid[êe]ncia[\s:–—-]{0,20}(casa|apartamento|condom[íi]nio|sobrado|outro)/i)
  return match ? texto(match[1]) : ''
}

/**
 * Complementa os dados estruturados dos parsers com as respostas de risco que
 * aparecem como perguntas no PDF. Nunca inventa resposta: quando o documento
 * nao afirma Sim/Nao (ou um tipo de residencia), o campo continua vazio.
 */
export function extrairRiscoVeiculoDoTexto(rawText = '') {
  const text = texto(rawText)
  if (!text) return {}
  return Object.fromEntries(Object.entries({
    tipo_residencia: tipoResidencia(text),
    passagem_leilao: booleanoDepois(text, [
      've[íi]culo (?:tem|possui) passagem por leil[aã]o', 'passagem por leil[aã]o',
    ]),
    financiado: booleanoDepois(text, [
      've[íi]culo (?:é|e|est[aá]) (?:financiado|alienado)', 'financiado\/?alienado', 'aliena[çc][aã]o',
    ]),
    kit_gas: booleanoDepois(text, [
      've[íi]culo possui kit g[aá]s', 'possui kit g[aá]s', 'kit g[aá]s',
    ]),
    blindagem: booleanoDepois(text, [
      've[íi]culo (?:é|e|possui) blind(?:ado|agem)', 've[íi]culo blindado', 'blindagem',
    ]),
    isento_imposto: booleanoDepois(text, [
      'isen[çc][aã]o de imposto', 'isento de imposto', 'isen[çc][aã]o fiscal',
    ]),
    garagem_residencia: garagem(text, 'residencia'),
    garagem_trabalho: garagem(text, 'trabalho'),
    garagem_estudo: garagem(text, 'estudo'),
  }).filter(([, value]) => value !== ''))
}

export function aplicarRiscoVeiculoExtraido(cotacao, rawText = '') {
  if (!cotacao) return cotacao
  const extraido = extrairRiscoVeiculoDoTexto(rawText)
  cotacao.veiculo = { ...(cotacao.veiculo || {}) }
  Object.entries(extraido).forEach(([key, value]) => {
    if (cotacao.veiculo[key] === '' || cotacao.veiculo[key] == null) cotacao.veiculo[key] = value
  })
  return cotacao
}
