// ─── Ponte entre o PDF enviado na tela e os parsers de orcamento ───────
//
// Separado dos parsers de proposito: os parsers sao puros (recebem itens ja
// posicionados, rodam em `node --test` sem shim de pdfjs), e e este modulo que
// encosta no `pdfjs` e no objeto `File` do navegador. A parte que tem regra de
// verdade — `camposDaCotacao` — continua pura e testada.
//
// A Allianz continua em seu modulo independente. As demais seguradoras passam
// pelo roteador comum: produto unico segue direto; HDI, Pier e Suhai param para
// o usuario escolher o produto antes da leitura final.

const NAO_SUPORTADA = 'Leitura automática ainda não disponível para esta seguradora — preencha a revisão manualmente.'

/**
 * Le o PDF e devolve o que der para ler, sem nunca escolher no lugar do usuario.
 *
 * `itens` e `texto` voltam junto para que `aplicarEscolha` possa reprocessar a
 * cotacao com a oferta escolhida sem reabrir o arquivo.
 */
export async function lerOrcamento(file) {
  if (!file) return null

  const { extractPdfLayout } = await import('./apoliceParser.js')
  const { itens, texto } = await extractPdfLayout(file)

  const { ehLayoutAllianz, parseCotacaoAllianz } = await import('./orcamentoAllianzParser.js')
  if (ehLayoutAllianz(texto)) {
    return {
      arquivo: file.name,
      suportado: true,
      parser_id: 'allianz',
      seguradora: 'Allianz Seguros',
      itens,
      texto,
      cotacao: parseCotacaoAllianz({ itens, texto }),
    }
  }

  const {
    detectarParserOrcamento, listarProdutosOrcamento, parseCotacaoPorSeguradora,
  } = await import('./orcamentoSeguradoraParser.js')
  const parser = detectarParserOrcamento({ texto })
  if (!parser) {
    return { arquivo: file.name, suportado: false, motivo: NAO_SUPORTADA, itens, texto, cotacao: null }
  }

  const catalogo = listarProdutosOrcamento({ texto })
  if (!catalogo.requer_selecao) {
    return {
      arquivo: file.name, suportado: true, parser_id: parser.id,
      seguradora: catalogo.seguradora, itens, texto,
      cotacao: parseCotacaoPorSeguradora({ itens, texto }),
    }
  }

  const opcoes = catalogo.produtos.map((produto, ordem) => ({
    indice: produto.id,
    nome: produto.label,
    premio_total: produto.premio_total ?? null,
    ordem,
  }))
  return {
    arquivo: file.name, suportado: true, parser_id: parser.id,
    seguradora: catalogo.seguradora, itens, texto, ofertas: opcoes,
    cotacao: {
      seguradora: { nome: catalogo.seguradora },
      escolha_pendente: {
        campo: 'produto',
        label: 'Esta cotação traz mais de um produto; escolha qual vai para o cliente',
        opcoes,
      },
    },
  }
}

/** Reprocessa a cotacao com a oferta/produto que o usuario escolheu na tela. */
export async function aplicarEscolha(leitura, escolha) {
  if (!leitura?.suportado) return leitura
  if (leitura.parser_id === 'allianz') {
    const { parseCotacaoAllianz } = await import('./orcamentoAllianzParser.js')
    return {
      ...leitura,
      cotacao: parseCotacaoAllianz({ itens: leitura.itens, texto: leitura.texto, oferta: escolha }),
    }
  }

  const { parseCotacaoPorSeguradora } = await import('./orcamentoSeguradoraParser.js')
  return {
    ...leitura,
    cotacao: parseCotacaoPorSeguradora({ itens: leitura.itens, texto: leitura.texto, produto: escolha }),
  }
}

/**
 * Cotacao extraida -> campos da coluna de revisao.
 *
 * As chaves espelham `REVIEW_FIELDS` em `AutoQuoteComparison.jsx`. Campo que a
 * cotacao nao afirma volta como string vazia, nunca preenchido "no melhor
 * palpite": a revisao existe para o corretor completar o que falta, e um campo
 * chutado que parece preenchido nao e revisado por ninguem.
 */
export function camposDaCotacao(cotacao, { montarCategorias }) {
  if (!cotacao) return null

  // Enquanto a escolha da oferta esta pendente, as categorias NAO sao lidas.
  // `montarCategorias` devolveria "A cotação não informa." em todas elas — a
  // mesma frase falsa que ja foi tirada da validacao: a cotacao informa, uma vez
  // por oferta. Campo vazio diz "ainda nao sabemos"; aquela frase diria "a
  // seguradora nao cobre", que e outra coisa e chegaria ao cliente como tal.
  const pendente = Boolean(cotacao.escolha_pendente)
  const { categorias, naoIncluso } = pendente ? { categorias: [], naoIncluso: [] } : montarCategorias(cotacao)
  const texto = key => categorias.find(c => c.key === key)?.texto || ''

  return {
    numero: cotacao.cotacao?.numero || '',
    validade: cotacao.cotacao?.validade || '',
    vigencia_inicio: cotacao.vigencia?.inicio || '',
    vigencia_fim: cotacao.vigencia?.fim || '',
    premio_liquido: cotacao.valores?.premio_liquido ?? '',
    iof: cotacao.valores?.iof ?? '',
    premio_total: cotacao.valores?.premio_total ?? '',
    premio_parcelado: (cotacao.valores?.premio_parcelado || []).join(' · '),
    franquia: cotacao.valores?.franquia ?? '',
    franquia_tipo: cotacao.valores?.franquia_tipo || '',
    indenizacao_integral: pendente ? '' : textoIndenizacao(cotacao.indenizacao_integral),
    assistencia: texto('assistencia'),
    carro_reserva: texto('carro_reserva'),
    vidros: texto('vidros'),
    danos_terceiros: texto('terceiros'),
    nao_inclusos: (naoIncluso || []).map(i => i.titulo).filter(Boolean).join('\n'),
  }
}

function textoIndenizacao(integral) {
  if (!integral || integral.incluida == null) return ''
  if (integral.incluida === false) return 'Não inclusa'
  if (integral.percentual_fipe != null) return `Inclusa — ${String(integral.percentual_fipe).replace('.', ',')}% da FIPE`
  return integral.observacao || 'Inclusa'
}
