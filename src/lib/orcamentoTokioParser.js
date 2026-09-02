// Parser fixo da cotacao Tokio Marine Auto. Este layout declara separadamente
// indenizacao parcial e integral; a segunda pode estar explicitamente ausente,
// e essa negativa nunca pode ser confundida com silencio do documento.

import { agruparLinhas } from './pdfLayout.js'
import {
  classificarCobertura, criarCotacaoOrcamento, extrairLimiteReboqueKm, humanizarCobertura,
} from './orcamentoComparativo.js'
import {
  formatarMoeda, moeda, paraIso, percentual, textoNaColuna, valorAbaixoRotulo,
} from './orcamentoParserUtils.js'

export const PROCESSO_SUSEP_TOKIO_AUTO = '15414.100335/2004-74'

export function ehLayoutTokio(texto) {
  const t = String(texto || '')
  return /Cota[çc][ãa]o Tokio Marine/i.test(t) && t.includes(PROCESSO_SUSEP_TOKIO_AUTO)
}

const COBERTURAS = [
  /Colis[aã]o, Inc[êe]ndio e Roubo\/Furto/i,
  /Despesa extraordin[áa]ria/i,
  /RCF-V - Danos Materiais/i,
  /RCF-V - Danos Corporais/i,
  /RCF-V - Danos Morais/i,
  /APP - Morte/i,
  /APP - Invalidez/i,
  /APP - DMHO/i,
  /Assist[êe]ncia 24 horas/i,
  /Km adicional de reboque/i,
  /^Kit G[áa]s$/i,
  /^Blindagem$/i,
  /Extens[aã]o para Garantia de 0Km/i,
]

export function extrairCoberturasTokio(linhas) {
  // A quantidade de dados do risco muda a quebra de pagina da Tokio. No PDF
  // anterior a tabela ficava entre y=405 e y=206; no PDF real de 02/09 ela
  // ficou entre y=469 e y=270. Os rotulos da secao sao estaveis, as coordenadas
  // absolutas nao. Delimitar pelo cabecalho e pelo total evita perder justamente
  // as primeiras linhas (casco e danos materiais).
  const cabecalho = linhas.find(l => /Descri[çc][ãa]o\s+Limite M[áa]ximo Indeniza[çc][ãa]o\s+Pr[êe]mio L[íi]quido/i.test(l.texto))
  const total = cabecalho && linhas.find(l => (
    l.pagina === cabecalho.pagina
    && /Pr[êe]mio L[íi]quido total/i.test(l.texto)
    && l.y < cabecalho.y
  ))
  const pagina = cabecalho
    ? linhas.filter(l => (
      l.pagina === cabecalho.pagina
      && l.y <= cabecalho.y + 2
      && (!total || l.y >= total.y + 2)
    ))
    : linhas.filter(l => COBERTURAS.some(p => p.test(l.texto)))
  const resultado = []
  for (const linha of pagina) {
    const nomeCelula = linha.celulas.find(c => c.x < 100 && COBERTURAS.some(p => p.test(c.texto)))
    if (!nomeCelula) continue
    const nome = nomeCelula.texto.trim()
    const vizinhas = pagina.filter(l => Math.abs(l.y - linha.y) <= 10)
    const celulas = vizinhas.flatMap(l => l.celulas)
    const lmiTexto = textoNaColuna({ celulas }, 370, 85)
    const premio = moeda(textoNaColuna({ celulas }, 512, 70))
    const incluida = !/n[ãa]o contratad/i.test(lmiTexto)
    const categoria = classificarCobertura(nome)
      || (/Km adicional de reboque/i.test(nome) ? 'assistencia' : null)
    const lmiPercentual = percentual(lmiTexto)

    resultado.push({
      nome_original_seguradora: nome,
      nome_padronizado: '',
      categoria,
      incluida,
      valor_lmi: lmiPercentual == null ? moeda(lmiTexto) : null,
      lmi_percentual: lmiPercentual,
      premio,
      observacoes: incluida ? observacao(nome, lmiTexto) : 'Não contratada nesta cotação.',
    })
  }
  return resultado
}

function extrairTabelaPagamento(linhas, { cabecalho: padraoCabecalho, meio }) {
  const cabecalhos = linhas.filter(l => padraoCabecalho.test(l.texto))
  const planos = []
  for (const cabecalho of cabecalhos) {
    const fonte = linhas.filter(l => (
      l.pagina === cabecalho.pagina
      && l.y < cabecalho.y
      && cabecalho.y - l.y <= 80
    ))
    for (const linha of fonte) {
      for (const lado of [{ xN: 55, xParcela: 108, xJuros: 178, xTotal: 254 }, { xN: 331, xParcela: 387, xJuros: 458, xTotal: 530 }]) {
        const nTexto = textoNaColuna(linha, lado.xN, 22)
        if (!/^\d{1,2}$/.test(nTexto)) continue
        const parcela = moeda(textoNaColuna(linha, lado.xParcela, 35))
        const juros = textoNaColuna(linha, lado.xJuros, 38)
        const total = moeda(textoNaColuna(linha, lado.xTotal, 38))
        if (parcela == null || total == null) continue
        planos.push({ meio, n: Number(nTexto), valor_parcela: parcela, juros, total })
      }
    }
  }
  return planos
}

export function extrairPagamentoTokio(linhas) {
  return [
    ...extrairTabelaPagamento(linhas, { cabecalho: /D[ée]bito\/Pix Aut\..*Parcela/i, meio: 'Débito/Pix automático' }),
    ...extrairTabelaPagamento(linhas, { cabecalho: /^Ficha\s+Parcela/i, meio: 'Ficha' }),
    ...extrairTabelaPagamento(linhas, { cabecalho: /^Cart[ãa]o\s+Parcela/i, meio: 'Cartão de crédito' }),
  ]
}

export function extrairFranquiaTokio(linhas) {
  const linha = linhas.find(l => /Indeniza[çc][ãa]o Parcial do Ve[íi]culo/i.test(l.texto))
  if (!linha) return { valor: null, tipo: '' }
  const texto = linhas
    .filter(l => l.pagina === linha.pagina && Math.abs(l.y - linha.y) <= 3)
    .map(l => l.texto)
    .join(' ')
  const tipo = texto.match(/(\d+(?:[.,]\d+)?\s*%\s+da\s+[^|)]+)/i)?.[1]?.trim() || ''
  return { valor: moeda(texto), tipo }
}

export function extrairIndenizacaoIntegralTokio(linhas) {
  const linha = linhas.find(l => /Indeniza[çc][ãa]o Integral do Ve[íi]culo/i.test(l.texto))
  if (!linha) return { incluida: null, percentual_fipe: null, observacao: '' }
  const texto = linhas
    .filter(l => l.pagina === linha.pagina && Math.abs(l.y - linha.y) <= 3)
    .map(l => l.texto)
    .join(' ')
  if (/n[ãa]o\s+(?:possui|contratad|inclus)/i.test(texto)) {
    return { incluida: false, percentual_fipe: null, observacao: '' }
  }
  const percentualFipe = percentual(texto)
  if (/possui|contratad|inclus|\bFIPE\b|valor\s+(?:referenciado|de mercado)/i.test(texto)) {
    return { incluida: true, percentual_fipe: percentualFipe, observacao: percentualFipe == null ? texto.trim() : '' }
  }
  return { incluida: null, percentual_fipe: null, observacao: texto.trim() }
}

export function extrairCarroReservaTokio(linhas) {
  const cabecalho = linhas.find(l => l.celulas?.some(c => /^Carro reserva$/i.test(c.texto.trim())))
  const celula = cabecalho?.celulas?.find(c => /^Carro reserva$/i.test(c.texto.trim()))
  if (!cabecalho || !celula) return ''
  const abaixo = linhas
    .filter(l => l.pagina === cabecalho.pagina && l.y < cabecalho.y && cabecalho.y - l.y <= 24)
    .sort((a, b) => b.y - a.y)
    .map(l => textoNaColuna(l, celula.x, 95))
    .find(valor => /\d+\s*di[áa]rias?/i.test(valor))
  return abaixo || ''
}

export function parseCotacaoTokio({ itens = [], texto = '', seguradoraMeta = null } = {}) {
  const linhas = agruparLinhas(itens)
  const p1 = linhas.filter(l => l.pagina === 1)
  const p2 = linhas.filter(l => l.pagina === 2)
  const p4 = linhas.filter(l => l.pagina === 4)
  const cot = criarCotacaoOrcamento()

  cot.seguradora = {
    id: seguradoraMeta?.id ?? null,
    nome: seguradoraMeta?.nome_canonico || 'Tokio Marine Seguradora',
    logo_url: seguradoraMeta?.logo_url || '',
    cor_destaque: seguradoraMeta?.cor_destaque || '',
  }

  const topo = p1.find(l => /N[ºo] Cota[çc][ãa]o/i.test(l.texto))?.texto || ''
  const numero = topo.match(/N[ºo]\s*Cota[çc][ãa]o:\s*(\d+)/i)
  const validade = topo.match(/Validade cota[çc][ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/i)
  const vigencia = topo.match(/Vig[êe]ncia:\s*(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/i)
  const impressao = texto.match(/Data impress[ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/i)

  cot.cotacao = {
    numero: numero?.[1] || '',
    tipo_operacao: /Renova[çc][ãa]o Cong[êe]nere/i.test(texto) ? 'renovacao' : 'novo',
    validade: paraIso(validade?.[1]),
    data_emissao: paraIso(impressao?.[1]),
  }
  cot.segurado = {
    nome: valorAbaixoRotulo(p1, 'Proponente'),
    cpf_cnpj: valorAbaixoRotulo(p1, 'CPF/CNPJ'),
    data_nascimento: null,
  }
  cot.condutor_principal = {
    nome: valorAbaixoRotulo(p1, 'Nome Principal condutor'),
    cpf: valorAbaixoRotulo(p1, 'CPF principal condutor'),
    estado_civil: valorAbaixoRotulo(p1, 'Estado Civil principal condutor') || null,
  }
  const placaLida = valorAbaixoRotulo(p2, 'Placa')
  cot.veiculo = {
    marca_modelo: [valorAbaixoRotulo(p2, 'Fabricante'), valorAbaixoRotulo(p2, 'Veículo')].filter(Boolean).join(' '),
    ano_modelo: valorAbaixoRotulo(p2, 'Ano modelo'),
    // Em veículo zero km sem placa, a próxima coluna é o chassi. O leitor por
    // rótulo pode alcançá-lo; só aceitar aqui um formato real de placa evita
    // exibir o chassi como se fosse placa no orçamento.
    placa: /^[A-Z]{3}-?\d[A-Z0-9]\d{2}$/i.test(placaLida) ? placaLida : '',
    uso: valorAbaixoRotulo(p2, 'Tipo de utilização'),
    cep_pernoite: valorAbaixoRotulo(p2, 'CEP de pernoite'),
    condutor_18_25: /^n[ãa]o/i.test(valorAbaixoRotulo(p1, 'Deseja contratar cobertura do seguro para condutores na faixa etária de 18 a 25 anos que residem com o Principal Condutor?', { maxY: 35, maxX: 560 }))
      ? 'Sem cobertura' : null,
  }
  cot.vigencia = { inicio: paraIso(vigencia?.[1]), fim: paraIso(vigencia?.[2]) }

  const coberturas = extrairCoberturasTokio(linhas)
  const pagamento = extrairPagamentoTokio(linhas)
  const cartaoSemJuros = pagamento
    .filter(p => p.meio === 'Cartão de crédito' && /sem juros/i.test(p.juros))
    .sort((a, b) => b.n - a.n)[0]
  const debitoSemJuros = pagamento
    .filter(p => p.meio === 'Débito/Pix automático' && /sem juros/i.test(p.juros))
    .sort((a, b) => b.n - a.n)[0]
  const fichaSemJuros = pagamento
    .filter(p => p.meio === 'Ficha' && /sem juros/i.test(p.juros))
    .sort((a, b) => b.n - a.n)[0]
  const padrao = pagamento.find(p => p.n === 1 && /sem juros/i.test(p.juros))
  const liquidoLinha = linhas.find(l => /Pr[êe]mio L[íi]quido total/i.test(l.texto))
  const premioLiquido = moeda(liquidoLinha?.texto)
  const premioTotal = padrao?.total ?? null
  const antecipado = pagamento.find(p => p.n === 1 && /antecipado/i.test(p.juros))

  const franquia = extrairFranquiaTokio(linhas)
  cot.valores = {
    premio_liquido: premioLiquido,
    iof: premioLiquido != null && premioTotal != null ? Math.round((premioTotal - premioLiquido) * 100) / 100 : null,
    premio_total: premioTotal,
    premio_parcelado: [
      debitoSemJuros && `Débito/Pix automático: até ${debitoSemJuros.n}x de ${formatarMoeda(debitoSemJuros.valor_parcela)} sem juros`,
      fichaSemJuros && `Ficha: até ${fichaSemJuros.n}x de ${formatarMoeda(fichaSemJuros.valor_parcela)} sem juros`,
      cartaoSemJuros && `Cartão de crédito: até ${cartaoSemJuros.n}x de ${formatarMoeda(cartaoSemJuros.valor_parcela)} sem juros`,
    ].filter(Boolean),
    descontos_aplicados: antecipado ? [`Transmissão antecipada à vista: ${formatarMoeda(antecipado.total)}`] : [],
    franquia: franquia.valor,
    franquia_tipo: franquia.tipo,
  }

  cot.indenizacao_integral = extrairIndenizacaoIntegralTokio(linhas)

  const carroReserva = extrairCarroReservaTokio(linhas)

  cot.coberturas = coberturas.filter(c => c.incluida)
  cot.coberturas.push(
    { nome_original_seguradora: 'Carro reserva', categoria: 'carro_reserva', incluida: Boolean(carroReserva), observacoes: carroReserva },
    { nome_original_seguradora: 'Vidros completo', categoria: 'vidros', incluida: true, observacoes: extrairVidrosTokio(linhas) },
  )
  cot.assistencia_24h = {
    limite_reboque_km: extrairLimiteReboqueKm(
      ...cot.coberturas.filter(c => c.categoria === 'assistencia').map(c => c.observacoes),
    ),
  }
  cot.nao_incluso = coberturas.filter(c => !c.incluida).map(c => ({
    titulo: humanizarCobertura(c.nome_original_seguradora), detalhe: 'Não contratada nesta cotação.',
  }))
  cot.assistencias = []
  cot.servicos_adicionais = ['Livre escolha de oficina', 'Peças novas originais']

  const versao = p4.find(l => /Data de vers[ãa]o/i.test(l.texto))
  const linhaVersao = versao && p4
    .filter(l => versao.y - l.y > 0 && versao.y - l.y <= 15)
    .sort((a, b) => Math.abs(a.y - versao.y) - Math.abs(b.y - versao.y))[0]
  cot.condicoes_gerais = {
    referencia: `Tokio Marine Auto - Processo SUSEP ${PROCESSO_SUSEP_TOKIO_AUTO}`,
    anexada_em: paraIso(linhaVersao ? textoNaColuna(linhaVersao, 500, 70) : ''),
  }
  return cot
}

function extrairVidrosTokio(linhas) {
  const pecas = []
  const padraoPeca = /Parabrisa|Vigia\/Traseiro|Lateral|Farol|Retrovisor|Lanterna|Teto Solar|M[áa]quina de Vidro/i
  for (const linha of linhas.filter(l => padraoPeca.test(l.texto))) {
    for (const par of [[34, 159], [218, 343], [401, 526]]) {
      const nome = textoNaColuna(linha, par[0], 28)
      const valor = moeda(textoNaColuna(linha, par[1], 35))
      if (nome && valor != null) pecas.push(`${nome} ${formatarMoeda(valor)}`)
    }
  }
  return `Vidros completo — franquias: ${pecas.join(', ')}.`
}

function observacao(nome, lmiTexto) {
  const legivel = humanizarCobertura(nome)
  if (percentual(lmiTexto) != null) return `${legivel}: ${lmiTexto}.`
  const valor = moeda(lmiTexto)
  if (valor != null) return `${legivel}: ${formatarMoeda(valor)}.`
  return lmiTexto ? `${legivel}: ${lmiTexto}.` : legivel
}
