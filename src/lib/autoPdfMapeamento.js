/**
 * Mapeamento assistido de PDFs por seguradora (setor AUTO).
 *
 * O parser generico (`autoPdfParser.js`) tenta acertar todo PDF com as mesmas
 * regras. Aqui a logica e outra: o usuario sobe UMA amostra do PDF daquela
 * seguradora, o sistema propoe de onde sai cada campo que o sistema pede hoje
 * (`autoPdfCampos.js`), o usuario confirma campo a campo e o resultado vira uma
 * configuracao salva. Nas leituras seguintes daquela seguradora a extracao usa a
 * ancora confirmada em vez de adivinhar.
 *
 * Tres decisoes que valem registro:
 *
 * 1. **A ancora e o rotulo do PDF, nao uma coordenada.** Coordenada quebra a
 *    cada reimpressao/versao do layout; o rotulo ("PREMIO LIQUIDO:") sobrevive.
 *    Quando o valor aparece sem rotulo nenhum, o mapeamento guarda o tipo do
 *    valor mais a ocorrencia (o 2o CPF do documento, por exemplo).
 *
 * 2. **A dobra de acentos preserva o comprimento da string.** `normalize('NFD')`
 *    mudaria os indices e desalinharia a busca da ancora com o texto original,
 *    de onde os valores sao lidos. Por isso a tabela de char-a-char abaixo.
 *
 * 3. **Modulo puro, sem Supabase e sem pdfjs.** Roda em `node --test` e e
 *    reaproveitado tanto pela tela de configuracao quanto pela extracao em
 *    producao. A persistencia fica em `autoPdfConfig.js`.
 */

// Extensao explicita: este modulo tambem roda em `node --test`, que nao resolve
// import sem extensao como o Vite faz.
import { camposDoTipo } from './autoPdfCampos.js'

// ─── Normalizacao ──────────────────────────────────────────────────────

const COM_ACENTO = 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ'
const SEM_ACENTO = 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'

/** Dobra acentos preservando o comprimento (indices continuam validos). */
export function dobrarAcentos(value) {
  let out = ''
  const str = String(value ?? '')
  for (let i = 0; i < str.length; i += 1) {
    const idx = COM_ACENTO.indexOf(str[i])
    out += idx >= 0 ? SEM_ACENTO[idx] : str[i]
  }
  return out
}

/** Colapsa espacos do texto extraido do PDF sem alterar a ordem do conteudo. */
export function normalizarTexto(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

/** Forma canonica de um rotulo: sem acento, sem pontuacao, caixa alta. */
export function normalizarRotulo(value) {
  return dobrarAcentos(String(value ?? ''))
    .toUpperCase()
    .replace(/[^A-Z0-9%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Tipos de valor ────────────────────────────────────────────────────

const PADROES = {
  cpf: /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/,
  cnpj: /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/,
  placa: /\b([A-Z]{3}[\s-]?\d[A-Z0-9]\d{2})\b/,
  chassi: /\b([A-HJ-NPR-Z0-9]{17})\b/,
  data: /\b(\d{2}\/\d{2}\/\d{2,4})\b/,
  moeda: /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d+\.\d{2})\b/,
  percentual: /(\d{1,3}(?:[.,]\d{1,2})?)\s*%/,
  email: /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i,
  telefone: /(\(?\d{2}\)?\s?9?\d{4}-?\d{4})\b/,
  cep: /\b(\d{5}-?\d{3})\b/,
  documento: /\b(\d[\d.\-/]{4,})\b/,
  ano: /\b(\d{4}\s*\/\s*\d{4}|(?:19|20)\d{2})\b/,
  sim_nao: /\b(SIM|NAO|N\/A)\b/i,
}

const MOEDA_LIMITE = 1_000_000_000

function parseMoeda(bruto) {
  const s = String(bruto).replace(/[^\d.,]/g, '')
  const limpo = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const val = Number.parseFloat(limpo)
  return Number.isNaN(val) || Math.abs(val) > MOEDA_LIMITE ? null : val
}

function parseDataBR(bruto) {
  const parts = String(bruto).trim().split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  const ano = y.length === 2 ? `20${y}` : y
  const dia = Number(d)
  const mes = Number(m)
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null
  if (Number(ano) < 1900 || Number(ano) > 2200) return null
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Converte o trecho bruto do PDF no formato que o formulario espera. */
export function normalizarValor(bruto, tipo) {
  const texto = normalizarTexto(bruto)
  if (!texto) return ''

  switch (tipo) {
    case 'data':
      return parseDataBR(texto) || ''
    case 'moeda': {
      const val = parseMoeda(texto)
      return val == null ? '' : String(val)
    }
    case 'percentual': {
      const val = parseMoeda(texto.replace('%', ''))
      return val == null ? '' : String(val)
    }
    case 'cpf': {
      const d = texto.replace(/\D/g, '')
      return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : texto
    }
    case 'cnpj': {
      const d = texto.replace(/\D/g, '')
      return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : texto
    }
    case 'placa':
      return texto.replace(/[\s-]/g, '').toUpperCase()
    case 'chassi':
      return texto.toUpperCase()
    case 'cep':
      return texto.replace(/\D/g, '')
    case 'sim_nao':
      return /^N/i.test(dobrarAcentos(texto)) ? 'nao' : 'sim'
    case 'ano':
      return texto.replace(/\s+/g, '')
    default:
      return texto.slice(0, 120)
  }
}

/**
 * Le o valor do tipo pedido no inicio de um trecho.
 *
 * Para tipos com formato proprio a regex resolve. Para `texto` o valor termina
 * onde comeca o proximo rotulo conhecido — por isso o vocabulario entra aqui.
 */
export function extrairValorTipado(trecho, tipo, vocabulario) {
  const texto = normalizarTexto(trecho)
  if (!texto) return null

  if (tipo && tipo !== 'texto' && PADROES[tipo]) {
    const match = texto.match(PADROES[tipo])
    if (!match) return null
    return { bruto: match[1], valor: normalizarValor(match[1], tipo), inicio: match.index }
  }

  const corte = cortarNoProximoRotulo(texto, vocabulario)
  const limpo = corte.replace(/^[\s:;.\-]+/, '').trim()
  if (!limpo) return null
  return { bruto: limpo, valor: normalizarValor(limpo, 'texto'), inicio: 0 }
}

// ─── Vocabulario de rotulos ────────────────────────────────────────────

/**
 * Conjunto de palavras que sinalizam "aqui comeca outro campo".
 *
 * Sai dos proprios sinonimos declarados em `autoPdfCampos.js`: um valor de texto
 * (nome do segurado, por exemplo) termina quando aparece o rotulo do vizinho.
 * Termos de uma letra ou puramente numericos ficam de fora para nao cortar o
 * valor no meio.
 */
export function construirVocabulario(campos) {
  const vocab = new Set()
  for (const campo of campos) {
    for (const sin of [campo.label, ...(campo.sinonimos || [])]) {
      const termo = normalizarRotulo(sin)
      if (termo.length >= 3 && !/^\d+$/.test(termo)) vocab.add(termo)
    }
  }
  // Rotulos frequentes que nao sao campo nosso mas delimitam valores.
  for (const extra of ['RG', 'DATA DE NASCIMENTO', 'NASCIMENTO', 'SEXO', 'ESTADO CIVIL', 'PROFISSAO', 'ENDERECO', 'BAIRRO', 'CIDADE', 'UF', 'CATEGORIA', 'COMBUSTIVEL', 'COR', 'FIPE', 'CODIGO', 'ZERO KM', 'CORRETOR', 'CORRETORA', 'SUSEP', 'ITEM', 'RAMO', 'APOLICE', 'PROPOSTA', 'ENDOSSO']) {
    vocab.add(extra)
  }
  return vocab
}

function cortarNoProximoRotulo(texto, vocabulario) {
  if (!vocabulario || !vocabulario.size) return texto.slice(0, 120)
  const folded = dobrarAcentos(texto).toUpperCase()
  let corte = Math.min(texto.length, 120)
  for (const termo of vocabulario) {
    const idx = folded.indexOf(termo)
    // idx > 0: um rotulo colado no inicio e o proprio rotulo do par, nao o proximo.
    if (idx > 0 && idx < corte) corte = idx
  }
  return texto.slice(0, corte)
}

// ─── Extracao de candidatos ────────────────────────────────────────────

const SEGMENTO_MAX_PALAVRAS = 8
const ROTULO_MAX_PALAVRAS = 5

/**
 * Variantes de rotulo de um par.
 *
 * O texto do PDF chega em fluxo unico ("... FIAT ARGO 1.3 Placa: EAJ0B74"), sem
 * quebra entre o valor do campo anterior e o rotulo do proximo. Em vez de tentar
 * adivinhar onde o rotulo comeca, geramos as ultimas 1..5 palavras como
 * candidatas e deixamos a pontuacao escolher — "PLACA" ganha de "ARGO 1 3 PLACA"
 * sozinha, sem heuristica fragil de pontuacao.
 */
export function variantesRotulo(segmento) {
  const palavras = normalizarTexto(segmento).split(' ').filter(Boolean)
  const variantes = []
  for (let tamanho = 1; tamanho <= Math.min(ROTULO_MAX_PALAVRAS, palavras.length); tamanho += 1) {
    const variante = normalizarRotulo(palavras.slice(palavras.length - tamanho).join(' '))
    if (variante && !variantes.includes(variante)) variantes.push(variante)
  }
  return variantes
}

/**
 * Quebra o texto do PDF em pares rotulo -> valor, usando os dois-pontos como
 * separador (o formato dominante nos portais das seguradoras).
 *
 * `segmento` e o trecho entre o dois-pontos anterior e este — nunca cruza o
 * limite do par anterior, para o rotulo do vizinho nao virar candidato aqui.
 */
export function extrairPares(texto, vocabulario) {
  const normalized = normalizarTexto(texto)
  const pares = []
  let anterior = 0

  for (let i = 0; i < normalized.length; i += 1) {
    if (normalized[i] !== ':') continue

    const palavras = normalized.slice(anterior, i).split(' ').filter(Boolean)
    anterior = i + 1
    if (!palavras.length) continue

    const segmento = palavras.slice(Math.max(0, palavras.length - SEGMENTO_MAX_PALAVRAS)).join(' ')
    const variantes = variantesRotulo(segmento)
    if (!variantes.length) continue

    const proximo = normalized.indexOf(':', i + 1)
    const fim = proximo === -1 ? normalized.length : proximo

    pares.push({
      segmento: normalizarRotulo(segmento),
      variantes,
      bruto: normalized.slice(i + 1, Math.min(fim, i + 1 + 200)),
      inicio: i + 1,
      vocabulario,
    })
  }

  return pares
}

/** Todas as ocorrencias de um tipo de valor no documento, com o contexto anterior. */
export function extrairCandidatosTipados(texto, tipo) {
  const normalized = normalizarTexto(texto)
  const padrao = PADROES[tipo]
  if (!padrao) return []

  const global = new RegExp(padrao.source, padrao.flags.includes('i') ? 'gi' : 'g')
  const saida = []
  let match = global.exec(normalized)
  let guarda = 0
  while (match && guarda < 500) {
    guarda += 1
    const bruto = match[1] ?? match[0]
    saida.push({
      bruto,
      valor: normalizarValor(bruto, tipo),
      inicio: match.index,
      contexto: normalized.slice(Math.max(0, match.index - 60), match.index).trim(),
      ocorrencia: saida.length,
    })
    match = global.exec(normalized)
  }
  return saida
}

// ─── Pontuacao ─────────────────────────────────────────────────────────

function tokens(value) {
  return normalizarRotulo(value).split(' ').filter(Boolean)
}

function sobreposicao(rotulo, sinonimo) {
  const a = new Set(tokens(rotulo))
  const b = tokens(sinonimo)
  if (!b.length) return 0
  const comuns = b.filter(token => a.has(token)).length
  return comuns / b.length
}

/**
 * Semelhanca entre um rotulo do PDF e o campo pedido, sem considerar proibidos.
 *
 * O bonus por especificidade e o que separa "CPF DO CONDUTOR" de "CPF" quando os
 * dois batem 100%: sem ele, o CPF do segurado (que aparece primeiro) venceria o
 * desempate por posicao e o condutor herdaria o documento errado.
 */
function pontuarVariante(rotuloPdf, campo) {
  const alvo = normalizarRotulo(rotuloPdf)
  if (!alvo) return 0

  let melhor = 0
  for (const sinonimo of [campo.label, ...(campo.sinonimos || [])]) {
    const termo = normalizarRotulo(sinonimo)
    if (!termo) continue
    const especificidade = Math.min(8, termo.split(' ').length * 2)

    let nota = 0
    if (alvo === termo) nota = 100
    else if (alvo.endsWith(termo) || alvo.startsWith(termo)) nota = 86
    else if (alvo.includes(termo)) nota = 74
    else {
      const razao = sobreposicao(alvo, termo)
      if (razao >= 0.5) nota = Math.round(62 * razao)
    }

    if (nota > 0) melhor = Math.max(melhor, nota + especificidade)
  }
  return melhor
}

function penalidadeProibidos(trecho, campo) {
  const alvo = normalizarRotulo(trecho)
  for (const proibido of campo.proibidos || []) {
    const termo = normalizarRotulo(proibido)
    if (termo && alvo.includes(termo)) return 70
  }
  return 0
}

/** 0-108: o quanto um rotulo do PDF se parece com o campo que o sistema pede. */
export function pontuarRotulo(rotuloPdf, campo) {
  return Math.max(0, pontuarVariante(rotuloPdf, campo) - penalidadeProibidos(rotuloPdf, campo))
}

/** Melhor variante de rotulo de um par para um campo, ja com a penalidade aplicada. */
export function melhorVariante(par, campo) {
  const penalidade = penalidadeProibidos(par.segmento, campo)
  let escolhida = null
  for (const variante of par.variantes) {
    const nota = pontuarVariante(variante, campo)
    if (nota > 0 && (!escolhida || nota > escolhida.nota)) escolhida = { rotulo: variante, nota }
  }
  if (!escolhida) return null
  return { rotulo: escolhida.rotulo, nota: Math.max(0, escolhida.nota - penalidade) }
}

function chaveCandidato(candidato) {
  return `${candidato.rotulo || ''}|${candidato.valor}`
}

/**
 * Qual ocorrencia da ancora corresponde a este par.
 *
 * Calculada com a mesma funcao usada na extracao em producao
 * (`encontrarOcorrenciasRotulo`), para o indice gravado no mapeamento apontar
 * exatamente para o trecho que o usuario confirmou na tela.
 */
function ocorrenciaDoRotulo(dobrado, rotulo, posicaoDoValor, cache) {
  if (!cache.has(rotulo)) cache.set(rotulo, encontrarOcorrenciasRotulo(dobrado, rotulo))
  const posicoes = cache.get(rotulo)
  let melhor = 0
  let distancia = Infinity
  posicoes.forEach((posicao, indice) => {
    const delta = Math.abs(posicao - posicaoDoValor)
    if (delta < distancia) {
      distancia = delta
      melhor = indice
    }
  })
  return melhor
}

function candidatosDoCampo(texto, dobrado, pares, campo, cacheOcorrencias) {
  const encontrados = []

  for (const par of pares) {
    const variante = melhorVariante(par, campo)
    if (!variante || variante.nota < 40) continue
    const valor = extrairValorTipado(par.bruto, campo.tipo, par.vocabulario)
    if (!valor) continue
    encontrados.push({
      valor: valor.valor,
      bruto: valor.bruto,
      rotulo: variante.rotulo,
      tipo: campo.tipo,
      ocorrencia: ocorrenciaDoRotulo(dobrado, variante.rotulo, par.inicio, cacheOcorrencias),
      origem: 'rotulo',
      contexto: par.segmento,
      confianca: Math.min(100, variante.nota),
      inicio: par.inicio,
    })
  }

  // Layouts em tabela nao usam dois-pontos: o rotulo fica na celula anterior.
  if (campo.tipo && campo.tipo !== 'texto') {
    for (const tipado of extrairCandidatosTipados(texto, campo.tipo)) {
      const nota = pontuarRotulo(tipado.contexto, campo)
      encontrados.push({
        valor: tipado.valor,
        bruto: tipado.bruto,
        rotulo: null,
        tipo: campo.tipo,
        ocorrencia: tipado.ocorrencia,
        origem: 'posicao',
        contexto: tipado.contexto,
        confianca: Math.max(10, nota - 18),
        inicio: tipado.inicio,
      })
    }
  }

  const unicos = new Map()
  for (const candidato of encontrados) {
    if (!candidato.valor) continue
    const chave = chaveCandidato(candidato)
    const atual = unicos.get(chave)
    if (!atual || candidato.confianca > atual.confianca) unicos.set(chave, candidato)
  }

  return [...unicos.values()]
    .sort((a, b) => b.confianca - a.confianca || a.inicio - b.inicio)
    .slice(0, 6)
}

/**
 * Percorre o texto da amostra e propoe, para cada campo do sistema, o valor
 * mais provavel e ate 6 alternativas para o usuario escolher.
 */
export function sugerirMapeamento(texto, campos) {
  const normalized = normalizarTexto(texto)
  const dobrado = dobrarAcentos(normalized).toUpperCase()
  const vocabulario = construirVocabulario(campos)
  const pares = extrairPares(normalized, vocabulario)
  const cacheOcorrencias = new Map()

  return campos.map(campo => {
    const candidatos = candidatosDoCampo(normalized, dobrado, pares, campo, cacheOcorrencias)
    return {
      key: campo.key,
      label: campo.label,
      grupo: campo.grupo,
      tipo: campo.tipo,
      obrigatorio: Boolean(campo.obrigatorio),
      candidatos,
      sugestao: candidatos[0] || null,
    }
  })
}

// ─── Aplicacao do mapeamento salvo ─────────────────────────────────────

function regexDoRotulo(rotulo) {
  const partes = normalizarRotulo(rotulo).split(' ').filter(Boolean).map(parte =>
    parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  )
  if (!partes.length) return null
  return new RegExp(`\\b${partes.join('[^A-Z0-9]{1,4}')}\\b`, 'g')
}

/** Indices de todas as ocorrencias da ancora no texto (ja dobrado em maiusculas). */
export function encontrarOcorrenciasRotulo(textoDobrado, rotulo) {
  const regex = regexDoRotulo(rotulo)
  if (!regex) return []
  const posicoes = []
  let match = regex.exec(textoDobrado)
  let guarda = 0
  while (match && guarda < 300) {
    guarda += 1
    posicoes.push(match.index + match[0].length)
    match = regex.exec(textoDobrado)
  }
  return posicoes
}

/**
 * Extrai os campos de um PDF novo usando o mapeamento confirmado da seguradora.
 *
 * Campos marcados como ausentes sao ignorados de proposito: se o layout daquela
 * seguradora nao traz a informacao, insistir so produziria valor errado.
 */
export function aplicarMapeamento(texto, mapeamento, campos) {
  const normalized = normalizarTexto(texto)
  const dobrado = dobrarAcentos(normalized).toUpperCase()
  const vocabulario = construirVocabulario(campos)
  const porChave = new Map(campos.map(campo => [campo.key, campo]))

  const valores = {}
  const encontrados = []
  const faltantes = []

  for (const [key, config] of Object.entries(mapeamento?.campos || {})) {
    if (!config || config.ausente) continue
    const campo = porChave.get(key)
    const tipo = config.tipo || campo?.tipo || 'texto'

    let valor = ''
    if (config.rotulo) {
      const posicoes = encontrarOcorrenciasRotulo(dobrado, config.rotulo)
      const pos = posicoes[config.ocorrencia ?? 0] ?? posicoes[0]
      if (pos != null) {
        const lido = extrairValorTipado(normalized.slice(pos, pos + 220), tipo, vocabulario)
        valor = lido?.valor || ''
      }
    } else {
      const candidatos = extrairCandidatosTipados(normalized, tipo)
      valor = candidatos[config.ocorrencia ?? 0]?.valor || ''
    }

    valores[key] = valor
    if (valor) encontrados.push(key)
    else faltantes.push(key)
  }

  return { campos: valores, encontrados, faltantes }
}

// ─── Estado do mapeamento ──────────────────────────────────────────────

/** Converte as sugestoes na estrutura que vai para o banco (tudo por confirmar). */
export function mapeamentoInicial(sugestoes, salvo = {}) {
  const campos = {}
  for (const item of sugestoes) {
    const anterior = salvo?.[item.key]
    if (anterior) {
      campos[item.key] = { ...anterior }
      continue
    }
    if (!item.sugestao) continue
    campos[item.key] = {
      rotulo: item.sugestao.rotulo,
      tipo: item.tipo,
      ocorrencia: item.sugestao.ocorrencia ?? 0,
      origem: item.sugestao.origem,
      confirmado: false,
      ausente: false,
      valor_exemplo: item.sugestao.valor,
      confianca: item.sugestao.confianca,
    }
  }
  return campos
}

/** Resumo usado pelo card da seguradora e pela barra de progresso da tela. */
export function resumirMapeamento(campos, definicoes) {
  const total = definicoes.length
  let confirmados = 0
  let ausentes = 0
  let pendentes = 0
  let obrigatoriosPendentes = 0

  for (const definicao of definicoes) {
    const config = campos?.[definicao.key]
    if (config?.ausente) {
      ausentes += 1
      continue
    }
    if (config?.confirmado && config?.valor_exemplo) {
      confirmados += 1
      continue
    }
    pendentes += 1
    if (definicao.obrigatorio) obrigatoriosPendentes += 1
  }

  return {
    total,
    confirmados,
    ausentes,
    pendentes,
    obrigatoriosPendentes,
    // Concluir exige que nenhum campo obrigatorio fique no ar; opcionais podem
    // ficar pendentes sem travar a configuracao.
    podeConcluir: obrigatoriosPendentes === 0 && confirmados > 0,
    percentual: total ? Math.round(((confirmados + ausentes) / total) * 100) : 0,
  }
}

export function resumirMapeamentoPorTipo(campos, tipo) {
  return resumirMapeamento(campos, camposDoTipo(tipo))
}
