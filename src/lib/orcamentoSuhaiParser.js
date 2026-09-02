// Parser fixo da cotacao Suhai. O PDF pode trazer quatro ou cinco produtos em colunas;
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

export const PRODUTOS_SUHAI_5_COLUNAS = [
  { id: 'roubo_furto', label: 'Roubo + Furto', indice: 0 },
  { id: 'roubo_furto_pt', label: 'Roubo + Furto + PT Colisão', indice: 1 },
  { id: 'roubo_furto_rcf', label: 'Roubo + Furto + RCF', indice: 2 },
  { id: 'roubo_furto_pt_rcf', label: 'Roubo + Furto + PT Colisão + RCF', indice: 3 },
  { id: 'terceiros', label: 'Terceiros RCF', indice: 4 },
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

export function produtosSuhaiDoTexto(texto = '') {
  // O layout novo separa as opções com e sem RCF e, por isso, possui cinco
  // colunas. O antigo usa a palavra "Compreensiva" e continua com quatro.
  // "Roubo + Furto + RCF" sozinho nao distingue os dois: ele tambem aparece
  // no titulo da proposta antiga, fora da grade de opcoes.
  const t = String(texto || '')
  if (/Compreensiva\s*\(?\s*Perda Parcial/i.test(t)) return PRODUTOS_SUHAI
  return /Roubo\s*\+\s*Furto\s*\+\s*PT\s*Col[^\n]{0,30}\+\s*RCF/i.test(t)
    && /Terceiros\s+RCF/i.test(t)
    ? PRODUTOS_SUHAI_5_COLUNAS
    : PRODUTOS_SUHAI
}

export function listarProdutosSuhai(texto = '') {
  return resultadoProdutos('Suhai Seguradora', produtosSuhaiDoTexto(texto).map(({ indice, ...p }) => p))
}

export function colunasSuhai(linhas, quantidade) {
  const cabecalho = linhas.find(l => (
    l.celulas.filter(c => /^LMI$/i.test(c.texto.trim())).length >= quantidade
    && l.celulas.filter(c => /^Pr[êe]mio$/i.test(c.texto.trim())).length >= quantidade
  ))
  const linhaTotal = linhas.find(l => /Pr[êe]mio total, com IOF/i.test(l.texto))
  const lmis = cabecalho?.celulas.filter(c => /^LMI$/i.test(c.texto.trim())).sort((a, b) => a.x - b.x) || []
  const premios = cabecalho?.celulas.filter(c => /^Pr[êe]mio$/i.test(c.texto.trim())).sort((a, b) => a.x - b.x) || []
  const totais = linhaTotal?.celulas.filter(c => c.x > 100 && moeda(c.texto) != null).sort((a, b) => a.x - b.x) || []
  if (lmis.length < quantidade || premios.length < quantidade || totais.length < quantidade) {
    return quantidade === COLUNAS.length ? COLUNAS : []
  }
  return Array.from({ length: quantidade }, (_, indice) => ({
    lmi: lmis[indice].x,
    premio: premios[indice].x,
    total: totais[indice].x,
  }))
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

export function extrairCoberturasSuhai(linhas, produtoId, produtos = PRODUTOS_SUHAI, colunas = COLUNAS) {
  const produto = produtos.find(p => p.id === produtoId)
  if (!produto) return []
  const coluna = colunas[produto.indice]
  if (!coluna) return []
  const paginaCoberturas = linhas.find(l => /Pr[êe]mio total, com IOF/i.test(l.texto))?.pagina || 2
  const pagina = linhas.filter(l => l.pagina === paginaCoberturas)
  const linhasCobertura = pagina.filter(l => LINHAS_COBERTURA.some(p => p.test(l.texto)))
  const coberturas = []

  for (const linha of linhasCobertura) {
    const nome = linha.celulas.find(c => c.x < 100 && LINHAS_COBERTURA.some(p => p.test(c.texto)))?.texto
    if (!nome) continue
    const vizinhas = pagina.filter(l => Math.abs(l.y - linha.y) <= 10)
    const celulas = vizinhas.flatMap(l => l.celulas)
    // As colunas ficam a apenas 24 px uma da outra em algumas linhas. Uma
    // tolerancia larga faria o prêmio do produto vizinho virar o LMI deste.
    const lmiTexto = textoNaColuna({ celulas }, coluna.lmi, 30)
    const premioTexto = textoNaColuna({ celulas }, coluna.premio, 22)
    const naoContratado = /n[ãa]o contratado/i.test(`${lmiTexto} ${premioTexto}`)
    const danosMateriais = /RCF - Danos Materiais/i.test(nome)
    // Na tabela Suhai, a célula vazia de Danos Materiais tem significado
    // operacional: aquele produto não possui RCF. Não é um campo pendente.
    if (!lmiTexto && !premioTexto && !danosMateriais) continue
    const categoria = classificarCobertura(nome)
    const pct = percentual(lmiTexto)
    const semTerceiros = danosMateriais && (!lmiTexto || naoContratado || moeda(lmiTexto) == null)

    coberturas.push({
      nome_original_seguradora: nome,
      nome_padronizado: '',
      categoria,
      incluida: !(naoContratado || semTerceiros),
      valor_lmi: pct == null ? moeda(lmiTexto) : null,
      lmi_percentual: pct,
      premio: moeda(premioTexto),
      observacoes: semTerceiros
        ? 'Cobertura para terceiros não contratada neste produto.'
        : naoContratado
          ? 'Não contratada neste produto.'
          : observacaoCobertura(nome, lmiTexto),
    })
  }
  return coberturas
}

function pagamentosPeloTotal(linhas, premioTotal) {
  if (premioTotal == null) return []
  const planos = []
  for (const linha of linhas || []) {
    const celulas = [...(linha.celulas || [])].sort((a, b) => a.x - b.x)
    for (let i = 0; i <= celulas.length - 4; i += 1) {
      if (!/^\d{1,2}$/.test(celulas[i].texto.trim())) continue
      const valorParcela = moeda(celulas[i + 1].texto)
      const total = moeda(celulas[i + 2].texto)
      const juros = Number(String(celulas[i + 3].texto).replace(',', '.'))
      if (valorParcela == null || total == null || Math.abs(total - premioTotal) > 0.01) continue
      planos.push({
        n: Number(celulas[i].texto),
        valor_parcela: valorParcela,
        total,
        juros: Number.isFinite(juros) ? juros : null,
      })
    }
  }
  return planos.filter((plano, indice, todos) => todos.findIndex(outro => (
    outro.n === plano.n && outro.valor_parcela === plano.valor_parcela && outro.total === plano.total
  )) === indice)
}

export function extrairPagamentoSuhai(linhas, produtoId, produtos = PRODUTOS_SUHAI, premioTotal = null) {
  // O posicionamento das tabelas de parcelamento muda entre os PDFs de quatro
  // e cinco opções. O total, porém, é repetido em TODAS as linhas da tabela e
  // identifica sem ambiguidade a opção escolhida. Isso evita devolver o plano
  // de uma coluna vizinha mesmo quando a Suhai reorganiza as páginas.
  const peloTotal = pagamentosPeloTotal(linhas, premioTotal)
  if (peloTotal.length) return peloTotal
  const produto = produtos.find(p => p.id === produtoId)
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
  const linhas = agruparLinhas(itens)
  // A contagem dos cabecalhos e a prova mais forte do layout. O texto e usado
  // por `listarProdutosSuhai`, antes da escolha, e fica como fallback quando o
  // PDF nao preserva as coordenadas.
  const quantidadeColunas = Math.max(0, ...linhas.map(l => l.celulas.filter(c => /^LMI$/i.test(c.texto.trim())).length))
  const produtos = quantidadeColunas >= 5 ? PRODUTOS_SUHAI_5_COLUNAS : produtosSuhaiDoTexto(texto)
  const opcoes = produtos.map(({ indice, ...p }) => p)
  const escolhido = exigirProduto({ seguradora: 'Suhai Seguradora', produtos: opcoes, selecionado: produto })
  const configuracao = produtos.find(p => p.id === escolhido.id)
  const p1 = linhas.filter(l => l.pagina === 1)
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

  const colunas = colunasSuhai(linhas, produtos.length)
  const coberturas = extrairCoberturasSuhai(linhas, escolhido.id, produtos, colunas)
  const coluna = colunas[configuracao.indice]
  if (!coluna) throw new Error('Não foi possível localizar a coluna do produto escolhido na tabela Suhai.')
  const linhaLiquido = linhas.find(l => /Pr[êe]mio l[íi]quido/i.test(l.texto))
  const linhaTotal = linhas.find(l => /Pr[êe]mio total, com IOF/i.test(l.texto))
  const linhaFranquia = linhas.find(l => /Franquia Perdas Parciais/i.test(l.texto))
  const premioLiquido = moeda(textoNaColuna(linhaLiquido, coluna.total, 34))
  const premioTotal = moeda(textoNaColuna(linhaTotal, coluna.total, 34))
  const franquiaAplicavel = escolhido.id === 'compreensiva'
  // A franquia aparece alinhada pela esquerda da subcoluna LMI, enquanto os
  // totais ficam alinhados a direita. Usar o X do total fazia a modalidade
  // compreensiva perder "Reduzida: R$ ..." no layout antigo.
  const franquiaTexto = franquiaAplicavel ? textoNaColuna(linhaFranquia, coluna.lmi, 40) : ''
  const pagamento = extrairPagamentoSuhai(linhas, escolhido.id, produtos, premioTotal)
  const semJuros = pagamento.filter(p => p.juros === 0).sort((a, b) => b.n - a.n)[0]

  cot.valores = {
    premio_liquido: premioLiquido,
    iof: premioLiquido != null && premioTotal != null ? Math.round((premioTotal - premioLiquido) * 100) / 100 : null,
    premio_total: premioTotal,
    premio_parcelado: semJuros
      ? [`Até ${semJuros.n}x de ${formatarMoeda(semJuros.valor_parcela)} sem juros`]
      : [],
    descontos_aplicados: [],
    franquia: franquiaAplicavel ? moeda(franquiaTexto) : null,
    franquia_tipo: franquiaAplicavel && /reduzida/i.test(franquiaTexto) ? 'Reduzida' : '',
    franquia_nao_aplicavel: !franquiaAplicavel,
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
  if (!franquiaAplicavel || /n[ãa]o se aplica/i.test(franquiaTexto)) {
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
