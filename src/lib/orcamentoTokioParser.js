// Parser fixo da cotacao Tokio Marine Auto. Este layout declara separadamente
// indenizacao parcial e integral; a segunda pode estar explicitamente ausente,
// e essa negativa nunca pode ser confundida com silencio do documento.

import { agruparLinhas } from './pdfLayout.js'
import {
  classificarCobertura, criarCotacaoOrcamento, humanizarCobertura,
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
  const pagina = linhas.filter(l => l.pagina === 2 && l.y <= 410 && l.y >= 215)
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

function extrairTabelaPagamento(linhas, { pagina, yMin, yMax, meio }) {
  const fonte = linhas.filter(l => l.pagina === pagina && l.y >= yMin && l.y <= yMax)
  const planos = []
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
  return planos
}

export function extrairPagamentoTokio(linhas) {
  return [
    ...extrairTabelaPagamento(linhas, { pagina: 3, yMin: 190, yMax: 250, meio: 'Débito/Pix automático' }),
    ...extrairTabelaPagamento(linhas, { pagina: 4, yMin: 660, yMax: 710, meio: 'Ficha' }),
    ...extrairTabelaPagamento(linhas, { pagina: 4, yMin: 550, yMax: 605, meio: 'Cartão de crédito' }),
  ]
}

export function parseCotacaoTokio({ itens = [], texto = '', seguradoraMeta = null } = {}) {
  const linhas = agruparLinhas(itens)
  const p1 = linhas.filter(l => l.pagina === 1)
  const p2 = linhas.filter(l => l.pagina === 2)
  const p3 = linhas.filter(l => l.pagina === 3)
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
  cot.veiculo = {
    marca_modelo: [valorAbaixoRotulo(p2, 'Fabricante'), valorAbaixoRotulo(p2, 'Veículo')].filter(Boolean).join(' '),
    ano_modelo: valorAbaixoRotulo(p2, 'Ano modelo'),
    placa: valorAbaixoRotulo(p2, 'Placa'),
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
  const padrao = pagamento.find(p => p.n === 1 && /sem juros/i.test(p.juros) && p.total > 4500)
  const liquidoLinha = p2.find(l => /Pr[êe]mio L[íi]quido total/i.test(l.texto))
  const premioLiquido = moeda(liquidoLinha?.texto)
  const premioTotal = padrao?.total ?? null
  const antecipado = pagamento.find(p => p.n === 1 && /antecipado/i.test(p.juros))

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
    franquia: moeda(p3.find(l => /Indeniza[çc][ãa]o Parcial do Ve[íi]culo/i.test(l.texto))?.texto),
    franquia_tipo: '50% da Básica',
  }

  const integralLinha = p3.find(l => /Indeniza[çc][ãa]o Integral do Ve[íi]culo/i.test(l.texto))
  const integralTexto = integralLinha ? p3.filter(l => Math.abs(l.y - integralLinha.y) <= 3).map(l => l.texto).join(' ') : ''
  cot.indenizacao_integral = /n[ãa]o possui/i.test(integralTexto)
    ? { incluida: false, percentual_fipe: null, observacao: '' }
    : { incluida: null, percentual_fipe: null, observacao: '' }

  cot.coberturas = coberturas.filter(c => c.incluida)
  cot.coberturas.push(
    { nome_original_seguradora: 'Carro reserva', categoria: 'carro_reserva', incluida: true, observacoes: '7 diárias, categoria Básico (Mecânico).' },
    { nome_original_seguradora: 'Vidros completo', categoria: 'vidros', incluida: true, observacoes: extrairVidrosTokio(p3) },
  )
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

function extrairVidrosTokio(pagina) {
  const pecas = []
  for (const linha of pagina.filter(l => l.y <= 500 && l.y >= 440)) {
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
