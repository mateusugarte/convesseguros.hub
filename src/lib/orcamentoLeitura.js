// ─── Ponte entre o PDF enviado na tela e os parsers de orcamento ───────
//
// Separado dos parsers de proposito: os parsers sao puros (recebem itens ja
// posicionados, rodam em `node --test` sem shim de pdfjs), e e este modulo que
// encosta no `pdfjs` e no objeto `File` do navegador. A parte que tem regra de
// verdade — `camposDaCotacao` — continua pura e testada.
//
// A Allianz continua em seu modulo independente. As demais seguradoras passam
// pelo roteador comum.

const NAO_SUPORTADA = 'Leitura automática ainda não disponível para esta seguradora — preencha a revisão manualmente.'

// O que NAO muda de um produto para outro dentro do mesmo PDF: e o mesmo
// segurado, o mesmo condutor, o mesmo carro e o mesmo numero de cotacao nas seis
// ofertas da Allianz ou nas duas modalidades da HDI. Por isso esses blocos podem
// ser mostrados ANTES da escolha. Premio, franquia e cobertura ficam de fora —
// esses sim mudam com o produto, e adiantar um deles poria numero errado na tela.
const DADOS_DO_DOCUMENTO = ['segurado', 'condutor_principal', 'veiculo', 'cotacao', 'vigencia']

/** Executa o parser certo com as escolhas ja feitas pelo usuario. */
async function parsear({ parser_id: parserId, itens, texto }, escolhas = {}) {
  if (parserId === 'allianz') {
    const { parseCotacaoAllianz } = await import('./orcamentoAllianzParser.js')
    return parseCotacaoAllianz({ itens, texto, oferta: escolhas.oferta })
  }
  const { parseCotacaoPorSeguradora } = await import('./orcamentoSeguradoraParser.js')
  return parseCotacaoPorSeguradora({ itens, texto, ...escolhas })
}

/**
 * Le o PDF e devolve o que der para ler, sem nunca escolher no lugar do usuario.
 *
 * `itens` e `texto` voltam junto para que `aplicarEscolha` possa reprocessar a
 * cotacao com o produto escolhido sem reabrir o arquivo.
 */
export async function lerOrcamento(file) {
  if (!file) return null

  const { extractPdfLayout } = await import('./apoliceParser.js')
  const { itens, texto } = await extractPdfLayout(file)

  const { ehLayoutAllianz } = await import('./orcamentoAllianzParser.js')
  if (ehLayoutAllianz(texto)) {
    const base = { arquivo: file.name, suportado: true, parser_id: 'allianz', seguradora: 'Allianz Seguros', itens, texto, escolhas: {} }
    // O parser da Allianz ja devolve sozinho o que independe da escolha mais a
    // lista de ofertas; nao precisa do preenchimento parcial abaixo.
    return { ...base, cotacao: await parsear(base) }
  }

  const { detectarParserOrcamento, listarProdutosOrcamento } = await import('./orcamentoSeguradoraParser.js')
  const parser = detectarParserOrcamento({ texto })
  if (!parser) {
    return { arquivo: file.name, suportado: false, motivo: NAO_SUPORTADA, itens, texto, cotacao: null }
  }

  const catalogo = listarProdutosOrcamento({ texto })
  const base = {
    arquivo: file.name, suportado: true, parser_id: parser.id,
    seguradora: catalogo.seguradora, itens, texto, escolhas: {},
  }

  if (!catalogo.requer_selecao) {
    return { ...base, cotacao: await parsear(base) }
  }

  const opcoes = catalogo.produtos.map((produto, ordem) => ({
    indice: produto.id,
    nome: produto.label,
    premio_total: produto.premio_total ?? null,
    ordem,
  }))
  return {
    ...base,
    ofertas: opcoes,
    cotacao: {
      ...(await dadosDoDocumento(base, catalogo)),
      escolha_pendente: {
        campo: 'produto',
        label: 'Esta cotação traz mais de um produto; escolha qual vai para o cliente',
        opcoes,
      },
    },
  }
}

/**
 * Segurado, condutor, veiculo e numero da cotacao ANTES da escolha do produto.
 *
 * Antes daqui a tela devolvia so `{ seguradora, escolha_pendente }` e a revisao
 * ficava inteira em branco ate o usuario escolher — parecia que a leitura tinha
 * falhado, quando na verdade o PDF ja tinha entregue tudo isso.
 *
 * O parser e chamado com o primeiro produto so para atravessar `exigirProduto`;
 * do resultado aproveita-se APENAS a lista fixa `DADOS_DO_DOCUMENTO`, nunca
 * premio, franquia ou cobertura, que sao do produto e ainda nao foram escolhidos.
 */
async function dadosDoDocumento(base, catalogo) {
  const minimo = { seguradora: { nome: catalogo.seguradora } }
  const primeiro = catalogo.produtos[0]?.id
  if (!primeiro) return minimo
  try {
    const parcial = await parsear(base, { produto: primeiro })
    const dados = { seguradora: parcial.seguradora || minimo.seguradora }
    for (const chave of DADOS_DO_DOCUMENTO) {
      if (parcial[chave] !== undefined) dados[chave] = parcial[chave]
    }
    return dados
  } catch {
    // Adiantar esses campos e conveniencia, nao requisito: se o parser tropecar
    // aqui, a escolha do produto continua sendo oferecida normalmente.
    return minimo
  }
}

/**
 * Reprocessa a cotacao com o que o usuario acabou de escolher na tela.
 *
 * As escolhas se ACUMULAM: a Pier pergunta o produto e, depois, o tipo de
 * franquia (que o PDF dela nao informa). Reprocessar so com a ultima resposta
 * perderia a primeira e voltaria a pedir o produto em looping.
 */
export async function aplicarEscolha(leitura, valor) {
  if (!leitura?.suportado) return leitura
  const campo = leitura.cotacao?.escolha_pendente?.campo
    || (leitura.parser_id === 'allianz' ? 'oferta' : 'produto')
  const escolhas = { ...(leitura.escolhas || {}), [campo]: valor }
  return { ...leitura, escolhas, cotacao: await parsear(leitura, escolhas) }
}

// Nao ha lista de "campos que dependem do produto": quem sabe o que depende da
// escolha e o parser, que devolve nulo no que ainda nao existe. A Allianz, por
// exemplo, entrega a franquia mesmo sem oferta escolhida, porque ali a franquia
// e a mesma nas seis. Listar campos aqui apagaria dado que o PDF ja afirmou.
//
// A excecao sao as CATEGORIAS: `montarCategorias` nao devolve vazio, devolve a
// frase "A cotação não informa." — que seria falsa, porque a cotacao informa,
// uma vez por produto.
const ESCOLHA_DE_PRODUTO = new Set(['produto', 'oferta'])

/**
 * Cotacao extraida -> campos da coluna de revisao.
 *
 * As chaves espelham `REVIEW_FIELDS` em `AutoQuoteComparison.jsx`. Campo que a
 * cotacao nao afirma volta como string vazia, nunca preenchido "no melhor
 * palpite": a revisao existe para o corretor completar o que falta, e um campo
 * chutado que parece preenchido nao e revisado por ninguem.
 *
 * Premio liquido e IOF NAO entram aqui de proposito. Sao numeros de controle
 * interno, usados na emissao; o orcamento que vai ao cliente mostra o total e o
 * parcelamento. Pedir conferencia humana de dado que nao sai no documento so
 * gasta a atencao que deveria ir para franquia e cobertura.
 */
export function camposDaCotacao(cotacao, { montarCategorias }) {
  if (!cotacao) return null

  // Enquanto o PRODUTO esta pendente, as categorias NAO sao lidas.
  // `montarCategorias` devolveria "A cotação não informa." em todas elas — a
  // mesma frase falsa que ja foi tirada da validacao: a cotacao informa, uma vez
  // por produto. Campo vazio diz "ainda nao sabemos"; aquela frase diria "a
  // seguradora nao cobre", que e outra coisa e chegaria ao cliente como tal.
  const pendente = ESCOLHA_DE_PRODUTO.has(cotacao.escolha_pendente?.campo)
  const { categorias, naoIncluso } = pendente ? { categorias: [], naoIncluso: [] } : montarCategorias(cotacao)
  const texto = key => {
    const categoria = categorias.find(c => c.key === key)
    // "A cotação não informa" e estado de validacao, nao dado extraido. Levar
    // essa frase ao input fazia a tela parecer preenchida e escondia justamente
    // o campo que o corretor precisava completar.
    return categoria?.estado === 'nao_informado' ? '' : (categoria?.texto || '')
  }

  return {
    // Dados do risco: saem do PDF e vao para o orçamento final, entao passam
    // pela revisao como qualquer outro campo em vez de ficarem so no bastidor.
    segurado_nome: cotacao.segurado?.nome || '',
    segurado_cpf: cotacao.segurado?.cpf_cnpj || '',
    condutor_nome: cotacao.condutor_principal?.nome || '',
    condutor_cpf: cotacao.condutor_principal?.cpf || '',
    condutor_estado_civil: cotacao.condutor_principal?.estado_civil || '',
    veiculo_modelo: cotacao.veiculo?.marca_modelo || '',
    veiculo_ano: cotacao.veiculo?.ano_modelo || '',
    veiculo_placa: cotacao.veiculo?.placa || '',
    veiculo_uso: cotacao.veiculo?.uso || '',
    veiculo_cep_pernoite: cotacao.veiculo?.cep_pernoite || '',

    numero: cotacao.cotacao?.numero || '',
    validade: cotacao.cotacao?.validade || '',
    vigencia_inicio: cotacao.vigencia?.inicio || '',
    vigencia_fim: cotacao.vigencia?.fim || '',

    premio_total: cotacao.valores?.premio_total ?? '',
    premio_parcelado: Array.isArray(cotacao.valores?.premio_parcelado)
      ? cotacao.valores.premio_parcelado.join(' · ')
      : String(cotacao.valores?.premio_parcelado || ''),
    franquia: cotacao.valores?.franquia ?? '',
    franquia_tipo: cotacao.valores?.franquia_tipo || '',
    indenizacao_integral: pendente ? '' : textoIndenizacao(cotacao.indenizacao_integral),
    assistencia: texto('assistencia'),
    limite_reboque_km: pendente ? '' : limiteReboqueKm(cotacao, texto('assistencia')),
    carro_reserva: texto('carro_reserva'),
    vidros: texto('vidros'),
    danos_terceiros: texto('terceiros'),
    nao_inclusos: (naoIncluso || []).map(i => i.titulo).filter(Boolean).join('\n'),
  }
}

// A pergunta que este campo responde e "quanto indeniza": 100% da FIPE ou nao.
// Devolver a observacao da seguradora quando falta o percentual enchia a linha
// com um paragrafo que nao respondia nada e ainda dava a revisao por concluida.
// Sem o numero o campo fica vazio e a revisao cobra.
function textoIndenizacao(integral) {
  if (!integral || integral.incluida == null) return ''
  if (integral.incluida === false) return 'Não inclusa'
  if (integral.percentual_fipe != null) return `Inclusa — ${String(integral.percentual_fipe).replace('.', ',')}% da FIPE`
  return ''
}

// ─── Revisao editada -> cotacao ────────────────────────────────────────
//
// Caminho inverso de `camposDaCotacao`. Sem ele o PDF final sairia com o texto
// EXTRAIDO, ignorando tudo o que o corretor corrigiu na tela — a revisao seria
// decorativa e o erro corrigido chegaria ao cliente assim mesmo.
//
// Vale a mesma regra dos parsers: campo em branco na revisao NAO apaga o que foi
// extraido. Em branco quer dizer "nao mexi", nao "remova".

const CATEGORIA_POR_CAMPO = {
  assistencia: 'assistencia',
  carro_reserva: 'carro_reserva',
  vidros: 'vidros',
  danos_terceiros: 'terceiros',
}

const texto = valor => String(valor ?? '').trim()
const preferir = (novo, atual) => (texto(novo) ? texto(novo) : atual)

function numero(valor, atual) {
  if (valor === '' || valor == null) return atual
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : atual
}

export function aplicarRevisao(cotacao, campos = {}) {
  if (!cotacao) return null
  const c = campos || {}
  const cot = {
    ...cotacao,
    segurado: {
      ...cotacao.segurado,
      nome: preferir(c.segurado_nome, cotacao.segurado?.nome || ''),
      cpf_cnpj: preferir(c.segurado_cpf, cotacao.segurado?.cpf_cnpj || ''),
    },
    condutor_principal: {
      ...cotacao.condutor_principal,
      nome: preferir(c.condutor_nome, cotacao.condutor_principal?.nome || ''),
      cpf: preferir(c.condutor_cpf, cotacao.condutor_principal?.cpf || ''),
      estado_civil: preferir(c.condutor_estado_civil, cotacao.condutor_principal?.estado_civil || ''),
    },
    veiculo: {
      ...cotacao.veiculo,
      marca_modelo: preferir(c.veiculo_modelo, cotacao.veiculo?.marca_modelo || ''),
      ano_modelo: preferir(c.veiculo_ano, cotacao.veiculo?.ano_modelo || ''),
      placa: preferir(c.veiculo_placa, cotacao.veiculo?.placa || ''),
      uso: preferir(c.veiculo_uso, cotacao.veiculo?.uso || ''),
      cep_pernoite: preferir(c.veiculo_cep_pernoite, cotacao.veiculo?.cep_pernoite || ''),
    },
    cotacao: {
      ...cotacao.cotacao,
      numero: preferir(c.numero, cotacao.cotacao?.numero || ''),
      validade: preferir(c.validade, cotacao.cotacao?.validade || ''),
    },
    vigencia: {
      inicio: preferir(c.vigencia_inicio, cotacao.vigencia?.inicio || ''),
      fim: preferir(c.vigencia_fim, cotacao.vigencia?.fim || ''),
    },
    valores: {
      ...cotacao.valores,
      premio_total: numero(c.premio_total, cotacao.valores?.premio_total ?? null),
      franquia: numero(c.franquia, cotacao.valores?.franquia ?? null),
      franquia_tipo: preferir(c.franquia_tipo, cotacao.valores?.franquia_tipo || ''),
      premio_parcelado: texto(c.premio_parcelado)
        ? texto(c.premio_parcelado).split('·').map(t => t.trim()).filter(Boolean)
        : (cotacao.valores?.premio_parcelado || []),
    },
    assistencia_24h: {
      ...cotacao.assistencia_24h,
      limite_reboque_km: limiteReboque(c.limite_reboque_km, cotacao.assistencia_24h?.limite_reboque_km ?? null),
    },
    textos_revisados: Object.fromEntries(
      Object.entries(CATEGORIA_POR_CAMPO)
        .map(([campo, categoria]) => [categoria, texto(c[campo])])
        .filter(([, valor]) => valor),
    ),
  }

  // A indenizacao integral e critica e bloqueia a geracao. O texto da revisao e
  // afirmacao humana, entao vale sobre o extraido.
  const integral = texto(c.indenizacao_integral)
  if (integral) {
    const percentual = integral.match(/(\d+(?:[.,]\d+)?)\s*%/)
    cot.indenizacao_integral = {
      ...cotacao.indenizacao_integral,
      incluida: !/^n[ãa]o\b/i.test(integral),
      percentual_fipe: percentual
        ? Number(percentual[1].replace(',', '.'))
        : (/^n[ãa]o\b/i.test(integral) ? null : cotacao.indenizacao_integral?.percentual_fipe ?? null),
      observacao: integral,
    }
  }

  const naoInclusos = texto(c.nao_inclusos)
  if (naoInclusos) {
    cot.nao_incluso = naoInclusos.split('\n').map(t => t.trim()).filter(Boolean).map(titulo => ({ titulo, detalhe: '' }))
  }

  return cot
}

function limiteReboqueKm(cotacao, textoAssistencia) {
  const direto = cotacao?.assistencia_24h?.limite_reboque_km
  if (direto != null && direto !== '') return direto
  if (/sem limite|ilimitad/i.test(String(textoAssistencia || ''))) return 'Sem limite de KM'
  const m = String(textoAssistencia || '').match(/(\d{1,4})\s*(?:km|quil[oô]metros?)\b/i)
  return m ? Number(m[1]) : ''
}

function limiteReboque(valor, atual) {
  if (valor === '' || valor == null) return atual
  if (/sem limite|ilimitad/i.test(String(valor))) return 'Sem limite de KM'
  return numero(valor, atual)
}
