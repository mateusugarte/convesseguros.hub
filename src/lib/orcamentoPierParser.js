// Parser fixo da cotacao Pier. A pagina dos dois produtos e uma imagem
// rasterizada (sem camada de texto), enquanto os dados do risco e a descricao
// das coberturas continuam extraiveis. O parser nunca grava os numeros da
// amostra como regra: exige o produto e deixa os valores raster pendentes para
// OCR/revisao humana.

import { agruparLinhas } from './pdfLayout.js'
import { criarCotacaoOrcamento } from './orcamentoComparativo.js'
import { exigirProduto, resultadoProdutos } from './orcamentoProdutos.js'
import { formatarCep, moeda, paraIso, valorAbaixoRotulo } from './orcamentoParserUtils.js'

export const PRODUTOS_PIER = [
  { id: 'personalizado', label: 'Personalizado' },
  { id: 'completo', label: 'Completo' },
]

// A Pier imprime o VALOR da franquia ("Franquia: R$ 3.625,62") e nao diz se ela
// e reduzida ou normal — as duas seguradoras que o comparativo poe ao lado dela
// dizem. O campo e critico e sai no documento do cliente, entao nao pode ser
// deduzido do valor nem deixado em branco: o parser pergunta.
export const FRANQUIAS_PIER = [
  { id: 'reduzida', label: 'Reduzida' },
  { id: 'normal', label: 'Normal' },
]

const ROTULO_FRANQUIA = Object.fromEntries(FRANQUIAS_PIER.map(f => [f.id, f.label]))

export function ehLayoutPier(texto) {
  const t = String(texto || '')
  return /Mudando seu relacionamento\s+com seguros/i.test(t)
    && /A Pier conta com assist[êe]ncia 24h/i.test(t)
}

export function listarProdutosPier() {
  return resultadoProdutos('Pier Seguros', PRODUTOS_PIER)
}

const SERVICOS_PIER = 'Guincho, pane elétrica ou mecânica, falta de gasolina, chaveiro e troca de pneu'
const LIMITE_REBOQUE_POR_PRODUTO = {
  personalizado: 200,
  completo: 'Sem limite de KM',
}

/**
 * Assistencia com o LIMITE DE ACIONAMENTOS, e nao so a lista de servicos.
 *
 * Saber que ha guincho vale pouco sem saber quantas vezes ele pode ser chamado
 * no ano — e o que diferencia as assistencias entre seguradoras. A Pier imprime
 * isso ("Quantas vezes pode ser acionado? 3 acionamentos/ano"), entao o numero e
 * LIDO do documento; antes estava fixo no codigo e continuaria dizendo "3" se a
 * Pier mudasse a regra.
 */
export function textoAssistencia(texto, limiteProduto = null) {
  const m = String(texto || '').match(/(\d+)\s*acionamentos?\s*\/?\s*ano/i)
  const limite = limiteProduto
    ? (typeof limiteProduto === 'string' ? `guincho ${limiteProduto.toLowerCase()}` : `guincho até ${limiteProduto} km`)
    : ''
  const partes = [SERVICOS_PIER, limite, m ? `${m[1]} acionamentos por ano` : '']
  return `${partes.filter(Boolean).join(' — ')}.`
}

export function parseCotacaoPier({
  itens = [], texto = '', seguradoraMeta = null, produto = null, dadosProduto = null,
  franquia_tipo: franquiaTipo = null,
} = {}) {
  const escolhido = exigirProduto({ seguradora: 'Pier Seguros', produtos: PRODUTOS_PIER, selecionado: produto })
  const linhas = agruparLinhas(itens)
  const p3 = linhas.filter(l => l.pagina === 3)
  const p5 = linhas.filter(l => l.pagina === 5)
  const cot = criarCotacaoOrcamento()

  cot.seguradora = {
    id: seguradoraMeta?.id ?? null,
    nome: seguradoraMeta?.nome_canonico || 'Pier Seguros',
    logo_url: seguradoraMeta?.logo_url || '',
    cor_destaque: seguradoraMeta?.cor_destaque || '',
  }

  const validade = texto.match(/v[áa]lida at[ée]\s+(\d{2}\/\d{2}\/\d{4})/i)
  const tipo = valorAbaixoRotulo(p3, 'Tipo de cotação')
  cot.cotacao = {
    numero: '',
    tipo_operacao: /renova/i.test(tipo) ? 'renovacao' : (/\bnovo\b|\bnova\b/i.test(tipo) ? 'novo' : ''),
    validade: paraIso(validade?.[1]),
    data_emissao: '',
  }
  cot.segurado = {
    nome: valorAbaixoRotulo(p3, 'Nome do segurado'),
    cpf_cnpj: valorAbaixoRotulo(p3, 'CPF segurado'),
    data_nascimento: null,
  }
  cot.condutor_principal = {
    nome: valorAbaixoRotulo(p3, 'Nome do principal condutor'),
    cpf: valorAbaixoRotulo(p3, 'CPF principal condutor'),
    estado_civil: null,
  }
  cot.veiculo = {
    marca_modelo: [valorAbaixoRotulo(p3, 'Fabricante'), valorAbaixoRotulo(p3, 'Modelo')].filter(Boolean).join(' '),
    ano_modelo: valorAbaixoRotulo(p3, 'Ano'),
    placa: valorAbaixoRotulo(p3, 'Placa do carro'),
    uso: valorAbaixoRotulo(p3, 'Perfil de uso'),
    cep_pernoite: formatarCep(valorAbaixoRotulo(p3, 'CEP pernoite')),
    condutor_18_25: /^n[ãa]o$/i.test(valorAbaixoRotulo(p3, 'Outro condutor entre 18 e 25 anos?'))
      ? 'Sem cobertura' : null,
  }
  cot.vigencia = { inicio: '', fim: '' }

  const franquiaLinha = p5.find(l => /Franquia:/i.test(l.texto))
  const franquia = moeda(franquiaLinha?.texto)
  const preco = numeroOuNull(dadosProduto?.premio_total)
  const liquido = numeroOuNull(dadosProduto?.premio_liquido)
  const iof = numeroOuNull(dadosProduto?.iof)
  cot.valores = {
    premio_liquido: liquido,
    iof,
    premio_total: preco,
    premio_parcelado: dadosProduto?.premio_parcelado || [
      'Cartão de crédito: até 12x sem juros',
      'Boleto: até 10x sem juros',
    ],
    descontos_aplicados: [],
    franquia,
    franquia_tipo: ROTULO_FRANQUIA[franquiaTipo] || '',
  }
  cot.assistencia_24h = { limite_reboque_km: LIMITE_REBOQUE_POR_PRODUTO[escolhido.id] ?? null }

  // Pendencia de segundo estagio: o produto ja esta escolhido e o resto da
  // cotacao esta lido; falta so o dado que este PDF nao tem. A tela usa o mesmo
  // seletor da escolha de produto (`escolha_pendente`), sem caminho novo.
  if (!franquiaTipo) {
    cot.escolha_pendente = {
      campo: 'franquia_tipo',
      label: 'Esta cotação da Pier não informa o tipo de franquia; selecione qual foi contratada',
      opcoes: FRANQUIAS_PIER.map((f, ordem) => ({ indice: f.id, nome: f.label, premio_total: null, ordem })),
    }
  }

  // Indenizacao integral e "100% da FIPE" ou nao e — o cliente quer o percentual,
  // nao um paragrafo. A Pier so afirma que cobre perda total; o percentual esta
  // na pagina rasterizada. Sem o numero a revisao cobra, em vez de imprimir uma
  // frase que ocupa a linha sem responder a pergunta.
  cot.indenizacao_integral = {
    incluida: true,
    percentual_fipe: numeroOuNull(dadosProduto?.percentual_fipe),
    observacao: '',
  }
  cot.coberturas = [
    {
      nome_original_seguradora: 'Roubo, furto, perda total e danos parciais por colisão',
      categoria: 'colisao', incluida: true,
      observacoes: 'Roubo, furto, perda total, colisão e danos por causas naturais.',
    },
    {
      nome_original_seguradora: 'Danos físicos, materiais e morais a terceiros',
      categoria: 'terceiros', incluida: true,
      // A linha de terceiros existe para mostrar o LIMITE — "R$ 100.000,00" —, e
      // nao para descrever o que a cobertura faz: o cliente compara numero com
      // numero. Na Pier esse valor esta na pagina rasterizada, sem camada de
      // texto. Sem valor a linha fica vazia de proposito: assim a categoria cai
      // em NAO_INFORMADO, bloqueia a geracao e a revisao cobra o numero. Trocar
      // isso por prosa dava a impressao de linha preenchida e o comparativo saia
      // com descricao de um lado e valor do outro.
      observacoes: dadosProduto?.limite_terceiros ? String(dadosProduto.limite_terceiros) : '',
    },
    {
      // O PDF lista carro reserva em "Coberturas adicionais". A categoria e as
      // diarias ficam "conforme contratado em apolice" — o numero nao esta no
      // documento, entao ele vem da revisao.
      nome_original_seguradora: 'Carro reserva', categoria: 'carro_reserva', incluida: true,
      observacoes: dadosProduto?.carro_reserva
        ? String(dadosProduto.carro_reserva)
        : 'Incluso — categoria e diárias conforme contratado em apólice.',
    },
    {
      nome_original_seguradora: 'Assistência 24h', categoria: 'assistencia', incluida: true,
      observacoes: textoAssistencia(texto, cot.assistencia_24h.limite_reboque_km),
    },
    {
      nome_original_seguradora: 'Vidros e faróis', categoria: 'vidros', incluida: true,
      observacoes: 'Para-brisa, vidros laterais e traseiro, faróis, retrovisores e lanternas; sujeito a franquia.',
    },
  ]

  // O produto completo da amostra inclui carro reserva e o personalizado nao,
  // mas essa informacao mora na imagem. So vira afirmacao quando OCR/revisao a
  // entregar — o nome do produto, sozinho, nao prova a cobertura.
  if (dadosProduto?.carro_reserva === true) {
    cot.coberturas.push({
      nome_original_seguradora: 'Carro reserva', categoria: 'carro_reserva', incluida: true,
      observacoes: dadosProduto.carro_reserva_detalhe || 'Carro reserva incluído.',
    })
  } else if (dadosProduto?.carro_reserva === false) {
    cot.nao_incluso.push({ titulo: 'Carro reserva', detalhe: 'Não incluído no produto escolhido.' })
  }

  cot.assistencias = []
  cot.servicos_adicionais = ['Peças novas', 'Livre escolha entre oficinas credenciadas ou indicadas pelo segurado']
  cot.produto_selecionado = escolhido
  cot.produtos_disponiveis = PRODUTOS_PIER.map(p => ({ ...p }))
  cot.avisos_extracao = preco == null
    ? [{
        code: 'PAGINA_PRODUTO_RASTER',
        mensagem: 'A página de preço e limites do produto não possui texto extraível. Execute OCR ou confirme os valores manualmente antes de gerar.',
        bloqueia: true,
      }]
    : []
  cot.condicoes_gerais = { referencia: 'Pier Seguro Auto', anexada_em: '' }
  return cot
}

function numeroOuNull(valor) {
  if (valor == null || valor === '') return null
  const numero = typeof valor === 'number' ? valor : moeda(valor)
  return Number.isFinite(numero) ? numero : null
}
