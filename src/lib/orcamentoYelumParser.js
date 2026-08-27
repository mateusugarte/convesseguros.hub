// Parser fixo da cotacao Yelum Auto Perfil (antiga Liberty). O documento traz
// premio, parcelamento, coberturas e franquias em uma grade textual completa.

import { agruparLinhas } from './pdfLayout.js'
import {
  classificarCobertura, criarCotacaoOrcamento, humanizarCobertura,
} from './orcamentoComparativo.js'
import {
  formatarMoeda, moeda, paraIso, percentual, textoNaColuna, valorAbaixoRotulo,
} from './orcamentoParserUtils.js'

export const CNPJ_YELUM = '61.550.141/0001-72'

export function ehLayoutYelum(texto) {
  const t = String(texto || '')
  return t.replace(/\D/g, '').includes(CNPJ_YELUM.replace(/\D/g, ''))
    && /YELUM AUTO PERFIL/i.test(t)
}

const COBERTURAS = [
  /BASICA\s*-\s*01-COMPREENSIVA/i,
  /DANOS MATERIAIS/i,
  /DANOS CORPORAIS/i,
  /DANOS MORAIS/i,
  /CARRO RESERVA/i,
  /ASSISTENCIA\s*-\s*INTERMEDIARIO/i,
  /VIDROS\s*-\s*VEI NAC/i,
]

export function extrairCoberturasYelum(linhas) {
  const pagina = linhas.filter(l => l.pagina === 1 && l.y <= 413 && l.y >= 300)
  const resultado = []
  for (const linha of pagina) {
    const nomeCelula = linha.celulas.find(c => c.x < 100 && COBERTURAS.some(p => p.test(c.texto)))
    if (!nomeCelula) continue
    const nome = nomeCelula.texto.replace(/\s+E$/i, ' E ESTÉTICOS').trim()
    const lmiTexto = textoNaColuna(linha, 352, 80)
    const premio = moeda(textoNaColuna(linha, 452, 70))
    const franquia = moeda(textoNaColuna(linha, 550, 80))
    const categoria = classificarCobertura(nome)
    resultado.push({
      nome_original_seguradora: nome,
      nome_padronizado: '',
      categoria,
      incluida: true,
      valor_lmi: moeda(lmiTexto),
      lmi_percentual: percentual(lmiTexto),
      premio,
      franquia,
      observacoes: observacao(nome, lmiTexto),
    })
  }
  return resultado
}

export function extrairPagamentoYelum(linhas) {
  const pagina = linhas.filter(l => l.pagina === 1 && l.y <= 620 && l.y >= 500)
  const meios = [
    { meio: 'Carnê', x: 170 },
    { meio: 'Débito em conta', x: 282 },
    { meio: 'Cartão de crédito', x: 394 },
    { meio: 'Pix', x: 506 },
  ]
  const resultado = Object.fromEntries(meios.map(m => [m.meio, []]))

  for (const linha of pagina) {
    const descricao = linha.celulas[0]?.texto || ''
    const vista = /^[ÀA] vista$/i.test(descricao)
    const parcelas = descricao.match(/^1\s*\+\s*(\d+)$/)
    if (!vista && !parcelas) continue
    const n = vista ? 1 : Number(parcelas[1]) + 1
    for (const meio of meios) {
      const valor = moeda(textoNaColuna(linha, meio.x, 45))
      if (valor != null) resultado[meio.meio].push({ n, valor_parcela: valor })
    }
  }
  return Object.entries(resultado).filter(([, planos]) => planos.length).map(([meio, planos]) => ({ meio, planos }))
}

export function parseCotacaoYelum({ itens = [], texto = '', seguradoraMeta = null } = {}) {
  const linhas = agruparLinhas(itens)
  const p1 = linhas.filter(l => l.pagina === 1)
  const cot = criarCotacaoOrcamento()

  cot.seguradora = {
    id: seguradoraMeta?.id ?? null,
    nome: seguradoraMeta?.nome_canonico || 'Yelum Seguros',
    logo_url: seguradoraMeta?.logo_url || '',
    cor_destaque: seguradoraMeta?.cor_destaque || '',
  }

  const vigenciaTexto = valorAbaixoRotulo(p1, 'Vigência')
  const vigencia = vigenciaTexto.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i)
  const validade = texto.match(/validade at[ée] o dia\s+(\d{2}\/\d{2}\/\d{4})/i)
  const emissao = texto.match(/Criado por:[^\n]*?(\d{1,2}\/\d{1,2}\/\d{4})/i)
  const renovacao = /Renova Ap[óo]lice/i.test(texto)

  cot.cotacao = {
    numero: valorAbaixoRotulo(p1, 'Cotação Nº'),
    tipo_operacao: renovacao ? 'renovacao' : 'novo',
    validade: paraIso(validade?.[1]),
    data_emissao: paraIso(emissao?.[1]),
  }
  cot.segurado = {
    nome: valorAbaixoRotulo(p1, 'Nome do Segurado(a)'),
    cpf_cnpj: valorAbaixoRotulo(p1, 'CPF/CNPJ'),
    data_nascimento: paraIso(valorAbaixoRotulo(p1, 'Dt Nascimento')) || null,
  }
  cot.condutor_principal = {
    nome: valorAbaixoRotulo(p1, 'Nome do Principal Condutor'),
    cpf: valorAbaixoRotulo(p1, 'CPF Condutor'),
    estado_civil: valorAbaixoRotulo(p1, 'Estado Civil') || null,
  }
  cot.veiculo = {
    marca_modelo: valorAbaixoRotulo(p1, 'Marca/Tipo do Veículo'),
    ano_modelo: valorAbaixoRotulo(p1, 'Ano Fabricação/Modelo'),
    placa: valorAbaixoRotulo(p1, 'Placa'),
    uso: valorAbaixoRotulo(p1, 'Utilização'),
    cep_pernoite: valorAbaixoRotulo(p1, 'CEP de Pernoite'),
    condutor_18_25: /^n[ãa]o$/i.test(valorAbaixoRotulo(p1, 'Residente 18/24 anos'))
      ? 'Sem cobertura' : valorAbaixoRotulo(p1, 'Residente 18/24 anos') || null,
  }
  cot.vigencia = { inicio: paraIso(vigencia?.[1]), fim: paraIso(vigencia?.[2]) }

  const demonstrativo = p1.find(l => l.y < 660 && l.y > 645 && moeda(l.celulas[0]?.texto) != null)
  const coberturas = extrairCoberturasYelum(linhas)
  const casco = coberturas.find(c => c.categoria === 'colisao')
  const pagamentos = extrairPagamentoYelum(linhas)
  const cartao = pagamentos.find(p => p.meio === 'Cartão de crédito')?.planos || []
  const melhorCartao = cartao.reduce((acc, plano) => (!acc || plano.n > acc.n ? plano : acc), null)

  cot.valores = {
    premio_liquido: moeda(textoNaColuna(demonstrativo, 18, 40)),
    iof: moeda(textoNaColuna(demonstrativo, 367, 45)),
    premio_total: moeda(textoNaColuna(demonstrativo, 425, 55)),
    premio_parcelado: melhorCartao
      ? [`À vista ${formatarMoeda(moeda(textoNaColuna(demonstrativo, 425, 55)))}`, `Cartão de crédito: até ${melhorCartao.n}x de ${formatarMoeda(melhorCartao.valor_parcela)}`]
      : '',
    descontos_aplicados: [],
    franquia: casco?.franquia ?? null,
    franquia_tipo: valorAbaixoRotulo(p1, 'Tipo de Franquia').replace(/^\S+\s*-\s*/, ''),
  }

  cot.indenizacao_integral = casco?.lmi_percentual === 100
    ? { incluida: true, percentual_fipe: 100, observacao: '' }
    : { incluida: null, percentual_fipe: null, observacao: '' }
  cot.coberturas = coberturas
  cot.assistencias = []
  cot.servicos_adicionais = [
    'Livre escolha de oficinas',
    '10% de desconto na franquia, limitado a R$ 450,00, em oficina indicada pela Yelum',
  ]
  cot.nao_incluso = []

  const informacoes = linhas.filter(l => l.pagina === 1 && l.y <= 250 && l.y >= 200).map(l => l.texto).join(' ')
  const vidro = cot.coberturas.find(c => c.categoria === 'vidros')
  if (vidro && /Franquia Para-brisa/i.test(informacoes)) vidro.observacoes = informacoes.replace(/^.*?(VIDROS INTERMEDIARIO)/i, '$1')

  const assistencia = cot.coberturas.find(c => c.categoria === 'assistencia')
  if (assistencia && /INTERMEDIARIO/i.test(assistencia.nome_original_seguradora)) {
    assistencia.observacoes = 'Assistência intermediária — guincho/reboque até 500 km, conforme tabela de limites das Condições Gerais Yelum.'
    cot.assistencia_24h = { limite_reboque_km: 500 }
  }

  cot.condicoes_gerais = { referencia: 'Processos SUSEP 15414.100331/2004-96 e 15414.901089/2015-23', anexada_em: '' }
  return cot
}

function observacao(nome, lmiTexto) {
  const legivel = humanizarCobertura(nome)
  const valor = moeda(lmiTexto)
  if (valor != null) return `${legivel}: ${formatarMoeda(valor)}.`
  if (percentual(lmiTexto) != null) return `${legivel}: ${lmiTexto}.`
  return legivel
}
