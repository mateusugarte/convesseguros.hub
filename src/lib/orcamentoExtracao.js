/**
 * Ponte entre o parser de PDF existente e o schema do Orcamento Comparativo.
 *
 * Modulo puro (sem Supabase, sem pdfjs): recebe o objeto que
 * `parseOrcamentoAutoText` devolve e produz uma cotacao no formato da secao 5
 * da spec, pronta para a tela de revisao.
 *
 * PRINCIPIO: esta camada TRADUZ, nunca ADIVINHA.
 *
 * O parser de hoje extrai identificacao, veiculo, vigencia e valores. Ele NAO
 * extrai cobertura nenhuma — nao ha franquia, LMI de terceiros, km de reboque,
 * diarias de carro reserva nem indenizacao integral em `CAMPOS_VALORES`. Esses
 * campos voltam VAZIOS de proposito, e `validarCotacao` bloqueia a geracao ate
 * o corretor preencher.
 *
 * A tentacao aqui seria inferir cobertura a partir de palavra solta no texto do
 * PDF ("achei 'carro reserva', logo tem carro reserva"). Isso e exatamente o que
 * a spec proibe: a lista de coberturas de uma cotacao inclui itens NAO
 * contratados, e um "achei a palavra" transformaria um item recusado em
 * cobertura prometida ao cliente. Coberturas so entram por leitura estruturada
 * (IA com schema fixo, secao 4 da spec) ou pela mao do corretor.
 */

import {
  criarCotacaoOrcamento,
  detectarTipoOperacao,
  normalizarTexto,
} from './orcamentoComparativo.js'

/** Campos que o parser generico sabe preencher hoje. */
export const CAMPOS_AUTOMATICOS = [
  'segurado.nome', 'segurado.cpf_cnpj',
  'condutor_principal.nome', 'condutor_principal.cpf',
  'veiculo.marca_modelo', 'veiculo.placa', 'veiculo.cep_pernoite',
  'vigencia.inicio', 'vigencia.fim',
  'valores.premio_liquido', 'valores.premio_total', 'valores.premio_parcelado',
  'seguradora.nome', 'cotacao.tipo_operacao',
]

/**
 * Campos que a spec exige no card e que NENHUM parser atual preenche.
 *
 * Existem listados para a tela de revisao poder dizer ao corretor, de cara, o
 * que ele vai ter que digitar — em vez de ele descobrir campo a campo.
 */
export const CAMPOS_MANUAIS = [
  { caminho: 'indenizacao_integral.incluida', label: 'Indenização integral (inclusa? a que % da FIPE?)', critico: true },
  { caminho: 'valores.franquia',              label: 'Valor da franquia',            critico: true },
  { caminho: 'valores.franquia_tipo',         label: 'Tipo de franquia',             critico: true },
  { caminho: 'coberturas.terceiros',          label: 'Danos a terceiros (LMI)',      critico: false },
  { caminho: 'coberturas.assistencia',        label: 'Assistência 24h (km/limites)', critico: false },
  { caminho: 'coberturas.carro_reserva',      label: 'Carro reserva (diárias)',      critico: false },
  { caminho: 'coberturas.vidros',             label: 'Vidros (franquia por peça)',   critico: false },
  { caminho: 'nao_incluso',                   label: 'O que NÃO está incluso',       critico: false },
]

function texto(valor) {
  const v = String(valor ?? '').trim()
  return v
}

function numero(valor) {
  if (valor == null || valor === '') return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  const bruto = String(valor).replace(/R\$\s*/gi, '').trim()
  const limpo = bruto.includes(',') ? bruto.replace(/\./g, '').replace(',', '.') : bruto
  const n = Number.parseFloat(limpo)
  return Number.isFinite(n) ? n : null
}

/**
 * Converte a saida do parser numa cotacao do schema do comparativo.
 *
 * @param resultado      saida de `parseOrcamentoAutoText`
 * @param seguradoraMeta linha do catalogo (`id`, `nome_canonico`, `logo_url`,
 *                       `cor_destaque`) — a logo e a cor SEMPRE vem do cadastro,
 *                       nunca do PDF.
 */
export function cotacaoDeExtracao(resultado, { seguradoraMeta = null } = {}) {
  const r = resultado || {}
  const campos = r.campos || {}
  const cotada = r.seguradora_cotada || {}
  const cot = criarCotacaoOrcamento()

  cot.seguradora = {
    id: seguradoraMeta?.id ?? null,
    // Nome do cadastro vence o detectado: e ele que casa com logo e cor.
    nome: texto(seguradoraMeta?.nome_canonico || seguradoraMeta?.nome || cotada.nome || r.seguradora),
    logo_url: texto(seguradoraMeta?.logo_url),
    cor_destaque: texto(seguradoraMeta?.cor_destaque),
  }

  cot.segurado.nome = texto(campos.nome_cliente)
  cot.segurado.cpf_cnpj = texto(campos.cpf_cliente)

  cot.condutor_principal.nome = texto(campos.condutor_nome)
  cot.condutor_principal.cpf = texto(campos.condutor_cpf)

  cot.veiculo.marca_modelo = texto(campos.modelo_veiculo)
  cot.veiculo.placa = texto(campos.placa)
  cot.veiculo.cep_pernoite = texto(campos.cep_pernoite)

  cot.vigencia.inicio = texto(campos.vigencia_inicio)
  cot.vigencia.fim = texto(campos.vigencia_fim)

  cot.valores.premio_liquido = numero(cotada.premio_liquido)
  cot.valores.premio_total = numero(cotada.valor_total ?? cotada.premio_total)
  cot.valores.premio_parcelado = texto(cotada.parcelamentos || cotada.parcelamento)

  cot.cotacao.numero = texto(campos.numero_cotacao || campos.numero_orcamento || campos.numero_proposta)
  // O tipo de operacao sai do texto bruto porque cada cia escreve do seu jeito
  // ("Renovacao Congenere", "RENOVACAO DA CIA"). `null` quando nao reconhece — a
  // spec exige confirmacao humana desse campo de qualquer forma.
  cot.cotacao.tipo_operacao = detectarTipoOperacao(r._text) || ''

  return cot
}

/**
 * O que a extracao conseguiu e o que sobrou para a mao do corretor.
 *
 * Alimenta a sinalizacao visual da tela de revisao (spec secao 6: campo nao
 * preenchido tem que aparecer destacado, para o usuario saber onde olhar).
 */
export function resumoExtracao(cotacao, resultado = {}) {
  const cot = cotacao || criarCotacaoOrcamento()
  const ler = caminho => caminho.split('.').reduce((a, k) => (a == null ? a : a[k]), cot)

  const preenchidos = CAMPOS_AUTOMATICOS.filter(c => {
    const v = ler(c)
    return v != null && v !== ''
  })
  const faltando = CAMPOS_AUTOMATICOS.filter(c => !preenchidos.includes(c))

  return {
    seguradora_detectada: texto(resultado.seguradora) || null,
    layout: resultado.layout ?? null,
    preenchidos,
    faltando,
    manuais: CAMPOS_MANUAIS,
    avisos: [
      ...(Array.isArray(resultado.avisos) ? resultado.avisos : []),
      // Aviso fixo e deliberado: o corretor precisa saber que as coberturas NAO
      // vieram do PDF, senao ele assume que o card ja esta completo e so confere
      // o preco — que e como um "nao incluso" vira promessa de cobertura.
      'As coberturas não são extraídas do PDF. Preencha e confira cada categoria antes de gerar.',
    ],
    cobertura: 100 - Math.round((faltando.length / CAMPOS_AUTOMATICOS.length) * 100),
  }
}

/**
 * Confere se os dois PDFs sao da mesma seguradora.
 *
 * Comparar Porto com Porto nao e comparativo — quase sempre e o mesmo arquivo
 * subido duas vezes por engano. Nao bloqueia (pode ser proposital: duas opcoes
 * de franquia da mesma cia), mas precisa avisar.
 */
export function mesmaSeguradora(cotacaoA, cotacaoB) {
  const a = normalizarTexto(cotacaoA?.seguradora?.nome)
  const b = normalizarTexto(cotacaoB?.seguradora?.nome)
  return Boolean(a && b && a === b)
}
