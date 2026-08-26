// Parser fixo da cotacao Suhai. O mesmo PDF traz quatro produtos em colunas;
// premio, franquia e coberturas mudam em cada uma. A leitura final, portanto,
// so acontece depois de uma escolha explicita do usuario.

import { agruparLinhas } from './pdfLayout.js'
import { classificarCobertura, criarCotacaoOrcamento, humanizarCobertura } from './orcamentoComparativo.js'
import { exigirProduto, resultadoProdutos } from './orcamentoProdutos.js'
import {
  adicionarDias, formatarCep, formatarMoeda, moeda, paraIso, percentual, textoNaColuna, valorAbaixoRotulo,
} from './orcamentoParserUtils.js'

export const CNPJ_SUHAI = '16.825.255/0001-23'

export const PRODUTOS_SUHAI = [
  { id: 'roubo_furto', label: 'Roubo + Furto + RCF', indice: 0 },
  { id: 'roubo_furto_pt', label: 'Roubo + Furto + PT Colisão + RCF', indice: 1 },
  { id: 'compreensiva', label: 'Compreensiva', indice: 2 },
  { id: 'terceiros', label: 'Terceiros RCF', indice: 3 },
]

const COLUNAS = [
  { lmi: 134, premio: 208, total: 189 },
  { lmi: 234, premio: 315, total: 295 },
  { lmi: 339, premio: 422, total: 402 },
  { lmi: 447, premio: 523, total: 504 },
]

export function ehLayoutSuhai(texto) {
  const t = String(texto || '')
  return t.replace(/\D/g, '').includes(CNPJ_SUHAI.replace(/\D/g, ''))
    && /SUHAI SEGURADORA/i.test(t)
}

export function listarProdutosSuhai() {
  return resultadoProdutos('Suhai Seguradora', PRODUTOS_SUHAI.map(({ indice, ...p }) => p))
}

const LINHAS_COBERTURA = [
  /Compreensiva/i,
  /Ind\. Integral por Roubo\/Furto$/i,
  /Ind\. Int\. por Roubo\/Furto\/Colis[aã]o/i,
  /RCF - Danos Materiais/i,
  /RCF - Danos Corporais/i,
  /RCF - Danos Morais/i,
  /Assist[êe]ncia 24 horas/i,
]

export function extrairCoberturasSuhai(linhas, produtoId) {
  const produto = PRODUTOS_SUHAI.find(p => p.id === produtoId)
  if (!produto) return []
  const coluna = COLUNAS[produto.indice]
  const pagina = linhas.filter(l => l.pagina === 2 && l.y >= 600 && l.y <= 725)
  const coberturas = []

  for (const linha of pagina) {
    const nome = linha.celulas.find(c => c.x < 100 && LINHAS_COBERTURA.some(p => p.test(c.texto)))?.texto
    if (!nome) continue
    const vizinhas = pagina.filter(l => Math.abs(l.y - linha.y) <= 10)
    const celulas = vizinhas.flatMap(l => l.celulas)
    // As colunas ficam a apenas 24 px uma da outra em algumas linhas. Uma
    // tolerancia larga faria o prêmio do produto vizinho virar o LMI deste.
    const lmiTexto = textoNaColuna({ celulas }, coluna.lmi, 20)
    const premioTexto = textoNaColuna({ celulas }, coluna.premio, 20)
    const naoContratado = /n[ãa]o contratado/i.test(`${lmiTexto} ${premioTexto}`)
    if (!lmiTexto && !premioTexto) continue
    const categoria = classificarCobertura(nome)
    const pct = percentual(lmiTexto)

    coberturas.push({
      nome_original_seguradora: nome,
      nome_padronizado: '',
      categoria,
      incluida: !naoContratado,
      valor_lmi: pct == null ? moeda(lmiTexto) : null,
      lmi_percentual: pct,
      premio: moeda(premioTexto),
      observacoes: naoContratado ? 'Não contratada neste produto.' : observacaoCobertura(nome, lmiTexto),
    })
  }
  return coberturas
}

export function extrairPagamentoSuhai(linhas, produtoId) {
  const produto = PRODUTOS_SUHAI.find(p => p.id === produtoId)
  if (!produto) return []
  const direita = produto.indice % 2 === 1
  const x = direita
    ? { n: 340, parcela: 376, total: 417, juros: 453 }
    : { n: 125, parcela: 176, total: 217, juros: 254 }
  const faixa = produto.indice < 2
    ? l => (l.pagina === 2 && l.y <= 35) || (l.pagina === 3 && l.y >= 585)
    : l => l.pagina === 3 && l.y >= 330 && l.y <= 535

  const planos = []
  for (const linha of linhas.filter(faixa)) {
    const nTexto = textoNaColuna(linha, x.n, 18)
    if (!/^\d{1,2}$/.test(nTexto)) continue
    const valorParcela = moeda(textoNaColuna(linha, x.parcela, 30))
    const total = moeda(textoNaColuna(linha, x.total, 30))
    const juros = Number(String(textoNaColuna(linha, x.juros, 28)).replace(',', '.'))
    if (valorParcela == null || total == null) continue
    planos.push({ n: Number(nTexto), valor_parcela: valorParcela, total, juros: Number.isFinite(juros) ? juros : null })
  }
  return planos
}

export function parseCotacaoSuhai({ itens = [], texto = '', seguradoraMeta = null, produto = null } = {}) {
  const opcoes = PRODUTOS_SUHAI.map(({ indice, ...p }) => p)
  const escolhido = exigirProduto({ seguradora: 'Suhai Seguradora', produtos: opcoes, selecionado: produto })
  const configuracao = PRODUTOS_SUHAI.find(p => p.id === escolhido.id)
  const linhas = agruparLinhas(itens)
  const p1 = linhas.filter(l => l.pagina === 1)
  const p2 = linhas.filter(l => l.pagina === 2)
  const cot = criarCotacaoOrcamento()

  cot.seguradora = {
    id: seguradoraMeta?.id ?? null,
    nome: seguradoraMeta?.nome_canonico || 'Suhai Seguradora',
    logo_url: seguradoraMeta?.logo_url || '',
    cor_destaque: seguradoraMeta?.cor_destaque || '',
  }

  const calculo = texto.match(/C[áa]lculo N[ºo]:\s*([\d/]+)/i)
  const data = texto.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})/i)
  const vigencia = texto.match(/Vig[êe]ncia Proposta:\s*das 24h de\s*(\d{2}\/\d{2}\/\d{4})\s*[àa]s 24h de\s*(\d{2}\/\d{2}\/\d{4})/i)
  cot.cotacao = {
    numero: calculo?.[1] || '',
    tipo_operacao: /Renova[çc][ãa]o/i.test(valorAbaixoRotulo(p1, 'Tipo de Seguro')) ? 'renovacao' : 'novo',
    validade: adicionarDias(data?.[1], 5),
    data_emissao: paraIso(data?.[1]),
  }
  cot.segurado = {
    nome: valorAbaixoRotulo(p1, 'Nome/Razão Social'),
    cpf_cnpj: valorAbaixoRotulo(p1, 'CPF/CNPJ'),
    data_nascimento: paraIso(valorAbaixoRotulo(p1, 'Nascimento')) || null,
  }
  cot.condutor_principal = {
    nome: valorAbaixoRotulo(p1, 'Nome Condutor'),
    cpf: valorAbaixoRotulo(p1, 'CPF Condutor'),
    estado_civil: valorAbaixoRotulo(p1, 'Est. Civil') || null,
  }
  cot.veiculo = {
    marca_modelo: [valorAbaixoRotulo(p1, 'Marca'), valorAbaixoRotulo(p1, 'Modelo do Veículo')].filter(Boolean).join(' '),
    ano_modelo: valorAbaixoRotulo(p1, 'Ano Fabr./Modelo'),
    placa: valorAbaixoRotulo(p1, 'Placa'),
    uso: valorAbaixoRotulo(p1, 'Utilização'),
    cep_pernoite: formatarCep((valorAbaixoRotulo(p1, 'Reg. Tarif./CEP Pernoite').split('/').at(-1) || '').trim()),
    condutor_18_25: null,
  }
  cot.vigencia = { inicio: paraIso(vigencia?.[1]), fim: paraIso(vigencia?.[2]) }

  const coberturas = extrairCoberturasSuhai(linhas, escolhido.id)
  const coluna = COLUNAS[configuracao.indice]
  const linhaLiquido = p2.find(l => /Pr[êe]mio l[íi]quido/i.test(l.texto))
  const linhaTotal = p2.find(l => /Pr[êe]mio total, com IOF/i.test(l.texto))
  const linhaFranquia = p2.find(l => /Franquia Perdas Parciais/i.test(l.texto))
  const premioLiquido = moeda(textoNaColuna(linhaLiquido, coluna.total, 34))
  const premioTotal = moeda(textoNaColuna(linhaTotal, coluna.total, 34))
  const franquiaTexto = textoNaColuna(linhaFranquia, coluna.total, 70)
  const pagamento = extrairPagamentoSuhai(linhas, escolhido.id)
  const semJuros = pagamento.filter(p => p.juros === 0).sort((a, b) => b.n - a.n)[0]

  cot.valores = {
    premio_liquido: premioLiquido,
    iof: premioLiquido != null && premioTotal != null ? Math.round((premioTotal - premioLiquido) * 100) / 100 : null,
    premio_total: premioTotal,
    premio_parcelado: semJuros
      ? [`Até ${semJuros.n}x de ${formatarMoeda(semJuros.valor_parcela)} sem juros`]
      : [],
    descontos_aplicados: [],
    franquia: moeda(franquiaTexto),
    franquia_tipo: /reduzida/i.test(franquiaTexto) ? 'Reduzida' : '',
  }

  const integral = coberturas.find(c => c.incluida && c.lmi_percentual != null && (
    /Ind\. (Integral|Int\.)/i.test(c.nome_original_seguradora) || /^Compreensiva/i.test(c.nome_original_seguradora)
  ))
  cot.indenizacao_integral = integral
    ? { incluida: true, percentual_fipe: integral.lmi_percentual, observacao: '' }
    : { incluida: false, percentual_fipe: null, observacao: 'O produto não contrata indenização integral do veículo.' }

  cot.coberturas = coberturas.filter(c => c.incluida)
  cot.nao_incluso = coberturas.filter(c => !c.incluida).map(c => ({
    titulo: humanizarCobertura(c.nome_original_seguradora), detalhe: c.observacoes,
  }))
  if (/n[ãa]o se aplica/i.test(franquiaTexto)) {
    cot.nao_incluso.push({ titulo: 'Franquia', detalhe: 'Não se aplica a este produto.' })
  }
  cot.assistencias = []
  cot.servicos_adicionais = []
  cot.produto_selecionado = escolhido
  cot.produtos_disponiveis = opcoes.map(p => ({ ...p }))
  cot.condicoes_gerais = { referencia: 'Suhai Auto', anexada_em: '' }
  return cot
}

function observacaoCobertura(nome, lmiTexto) {
  const legivel = humanizarCobertura(nome)
  if (/Plano 2/i.test(lmiTexto)) return 'Assistência 24 horas Plano 2 — guincho de 500 km.'
  if (percentual(lmiTexto) != null) return `${legivel}: ${lmiTexto}.`
  const valor = moeda(lmiTexto)
  if (valor != null) return `${legivel}: ${formatarMoeda(valor)}.`
  return lmiTexto ? `${legivel}: ${lmiTexto}.` : legivel
}
