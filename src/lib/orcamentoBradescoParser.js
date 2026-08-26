// ─── Parser de cotacao — Bradesco Auto/RE ──────────────────────────────
//
// O "DEMONSTRATIVO DE CALCULO" do Bradesco nao tem tabela de coberturas com
// colunas, como a familia Porto. Ele tem QUATRO secoes de `rotulo: valor` em
// grade de tres colunas, e a cobertura contratada aparece numa quinta secao
// como lista de codigos:
//
//   CLÁUSULAS                 -> (001) Cobertura Compreensiva, (060) Auto Reserva 07 Dias, ...
//   LIMITES MÁXIMOS ... LMI   -> RCF D.M./D.C./D. Morais, % da FIPE, Blindagem
//   FRANQUIAS (R$)            -> Veiculo, Para-Brisa, Vidros Laterais, Farois, ...
//   PRÊMIOS (R$)              -> Auto, Vidros, RCF, LIQUIDO, IOF, TOTAL
//
// POR QUE O ESCOPO POR SECAO NAO E OPCIONAL: o rotulo "Veículo:" existe em duas
// secoes com sentidos diferentes — na LMI vale "Valor de Mercado Referenciado",
// nas FRANQUIAS vale "2.497,72 (Reduzida)". Uma busca no documento inteiro
// devolve o primeiro que aparece e imprimiria a franquia errada no card.
//
// A cobertura vem da lista de CLAUSULAS, nao de um valor de premio: no Bradesco
// um item pode estar contratado e ter premio 0,00 (servico incluso no pacote).
// Deduzir "nao tem" de premio zerado seria inventar ausencia.

import { agruparLinhas, celulaEm, fatiar, valorAposRotulo } from './pdfLayout.js'
import { criarCotacaoOrcamento, detectarTipoOperacao } from './orcamentoComparativo.js'

export const CNPJ_BRADESCO = '92.682.038/0001-00'

const SECOES = {
  // "Nº Cotação:" e "Cálculo válido até:" ficam na tarja do topo, repetida em
  // todas as paginas — o recorte para na primeira, que basta.
  cabecalho: { de: 'DEMONSTRATIVO DE CÁLCULO', ate: 'DADOS DO PROPONENTE' },
  // Proponente e "DADOS DO SEGURO" dividem as MESMAS linhas, em colunas
  // diferentes, entao um recorte so cobre os dois. O corte antes de "DADOS DO
  // CORRETOR" nao e detalhe: "Nome:" existe nas duas secoes, e sem o corte o
  // segurado do orcamento sairia como sendo a propria corretora.
  proponente: { de: 'DADOS DO PROPONENTE', ate: 'DADOS DO CORRETOR' },
  objeto: { de: 'OBJETO DO SEGURO', ate: 'CLÁUSULAS' },
  pagamento: { de: 'PAGAMENTO (R$)', ate: 'QUESTIONÁRIO DE AVALIAÇÃO' },
  condutor: { de: 'Características do principal condutor', ate: 'Questionário de Avaliação' },
  questionario: { de: 'Questionário de Avaliação', ate: 'Os dados coletados' },
  clausulas: { de: 'CLÁUSULAS', ate: 'Este cálculo não pressupõe' },
  lmi: { de: 'LIMITES MÁXIMOS DE INDENIZAÇÃO', ate: 'FRANQUIAS (R$)' },
  franquias: { de: 'FRANQUIAS (R$)', ate: 'PRÊMIOS (R$)' },
  premios: { de: 'PRÊMIOS (R$)', ate: 'Este cálculo não pressupõe' },
}

export function ehLayoutBradesco(texto) {
  const t = String(texto || '').replace(/[^\d]/g, '')
  return t.includes(CNPJ_BRADESCO.replace(/[^\d]/g, '')) && /DEMONSTRATIVO/i.test(String(texto || ''))
}

export function moeda(texto) {
  const t = String(texto ?? '').trim()
  if (!t || t === '-') return null
  const m = t.match(/-?[\d.]*\d,\d{2}/)
  if (!m) return null
  const n = Number(m[0].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// ─── Clausulas contratadas ─────────────────────────────────────────────

/**
 * Coberturas contratadas, da secao CLAUSULAS: "(060) Auto Reserva 07 Dias".
 *
 * O codigo entre parenteses e o identificador estavel da cobertura no Bradesco;
 * o nome ao lado e o que o cliente le. Guardamos os dois: o codigo sobrevive a
 * mudanca de redacao, o nome alimenta o dicionario de equivalencia.
 */
export function extrairClausulas(linhas) {
  const secao = fatiar(linhas, SECOES.clausulas)
  const clausulas = []
  for (const linha of secao) {
    for (const m of linha.texto.matchAll(/\((\d{3})\)\s*([^(]{3,60}?)(?=\s*\(\d{3}\)|$)/g)) {
      clausulas.push({ codigo: m[1], nome: m[2].trim() })
    }
  }
  return clausulas
}

// ─── Secoes de valores ─────────────────────────────────────────────────

/** Limites de RCF e o percentual da FIPE. */
export function extrairLmi(linhas) {
  const secao = fatiar(linhas, SECOES.lmi)
  const ler = rotulo => valorAposRotulo(secao, rotulo)
  return {
    referencia_veiculo: ler('Veículo'),
    percentual_fipe: Number(String(ler('Valor da indenização (% FIPE)')).replace(/[^\d]/g, '')) || null,
    danos_materiais: moeda(ler('D.M.')),
    danos_corporais: moeda(ler('D.C.')),
    danos_morais: moeda(ler('D. Morais.')),
    blindagem: ler('Blindagem'),
  }
}

/** Franquia do casco e as franquias por peca de vidro. */
export function extrairFranquias(linhas) {
  const secao = fatiar(linhas, SECOES.franquias)
  const ler = rotulo => valorAposRotulo(secao, rotulo)
  const veiculo = ler('Veículo')
  const tipo = veiculo.match(/\(([^)]+)\)/)
  return {
    veiculo: moeda(veiculo),
    tipo: tipo ? tipo[1] : '',
    para_brisa: moeda(ler('Para-Brisa')),
    vidros_laterais: moeda(ler('Vidros Laterais')),
    vidro_traseiro: moeda(ler('Vidro Traseiro')),
    retrovisores: moeda(ler('Retrovisores')),
    farois: moeda(ler('Faróis')),
    lanternas: moeda(ler('Lanternas')),
  }
}

/** Premios por bloco e os totais. */
export function extrairPremios(linhas) {
  const secao = fatiar(linhas, SECOES.premios)
  const ler = rotulo => valorAposRotulo(secao, rotulo)
  return {
    auto: moeda(ler('Auto')),
    vidros: moeda(ler('Vidros')),
    assistencia: moeda(ler('Assis. Dia Noite')),
    rcf: moeda(ler('RCF (B)')),
    liquido: moeda(ler('LÍQUIDO (A+B+C)')),
    iof: moeda(ler('IOF')),
    total: moeda(ler('TOTAL')),
  }
}

// ─── Formas de pagamento ───────────────────────────────────────────────

// Diferenca de arredondamento que ainda conta como "mesmo total". As parcelas
// do Bradesco fecham com centavos de sobra (1.929,86 x 1.929,96 para o mesmo
// plano), e tratar isso como juros faria o card anunciar menos parcelas sem
// juros do que a seguradora realmente oferece.
const TOLERANCIA_JUROS = 1

/**
 * Tabela "PAGAMENTO (R$)": 4 meios de pagamento lado a lado, cada um com
 * coluna de parcela e coluna de total.
 *
 * Mapeado por X, nunca pela ordem das celulas: a linha de 12x so existe para o
 * Cartao de Credito Bradesco, entao ela tem 2 celulas e as demais tem 8. Lida
 * por posicao na lista, a parcela de 12x do cartao seria atribuida ao debito
 * em conta — o card anunciaria 12x num meio de pagamento que so vai ate 11x.
 *
 * @returns [{ meio, maximo_sem_juros, valor_parcela, total }]
 */
export function extrairPagamento(linhas) {
  const secao = fatiar(linhas, SECOES.pagamento)
  const cabecalho = secao.find(l => /D[ée]bito em Conta/i.test(l.texto))
  const subcabecalho = secao.find(l => /N[ºo°]/.test(l.texto) && /Parcelas/i.test(l.texto))
  if (!cabecalho || !subcabecalho) return []

  const colunasParcela = subcabecalho.celulas.filter(c => /^Parcelas$/i.test(c.texto)).map(c => c.x)
  const colunasTotal = subcabecalho.celulas.filter(c => /^Total$/i.test(c.texto)).map(c => c.x)

  const meios = cabecalho.celulas.map((celula, i) => ({
    meio: celula.texto,
    xParcela: colunasParcela[i],
    xTotal: colunasTotal[i],
    linhas: [],
  })).filter(m => m.xParcela != null && m.xTotal != null)

  for (const linha of secao) {
    const primeira = linha.celulas[0]
    const n = primeira && primeira.texto.match(/^(\d{1,2})x$/i)
    if (!n) continue
    for (const m of meios) {
      const parcela = moeda(celulaEm(linha, m.xParcela, { antes: 12, depois: 12 }))
      const total = moeda(celulaEm(linha, m.xTotal, { antes: 12, depois: 12 }))
      if (parcela != null && total != null) m.linhas.push({ n: Number(n[1]), parcela, total })
    }
  }

  return meios.filter(m => m.linhas.length).map(m => {
    const base = Math.min(...m.linhas.map(l => l.total))
    const semJuros = m.linhas.filter(l => l.total <= base + TOLERANCIA_JUROS)
    const melhor = semJuros.reduce((a, b) => (b.n > a.n ? b : a), semJuros[0])
    return { meio: m.meio, maximo_sem_juros: melhor.n, valor_parcela: melhor.parcela, total: melhor.total }
  })
}

/** Uma linha legivel por meio de pagamento, no tom do modelo validado. */
export function textoPagamento(planos) {
  return (planos || []).map(p => (p.maximo_sem_juros <= 1
    ? `${p.meio}: à vista ${formatar(p.total)}`
    : `${p.meio}: até ${p.maximo_sem_juros}x de ${formatar(p.valor_parcela)} sem juros`))
}

// ─── Traducao para o schema do comparativo ─────────────────────────────

// Codigo -> categoria das 7. Ancorar no CODIGO, e nao no nome, e o ponto:
// o Bradesco reescreve o nome comercial entre versoes ("Auto Reserva 07 Dias"
// ja foi "Carro Reserva"), mas o codigo do produto nao muda.
const CATEGORIA_POR_CODIGO = {
  '001': 'colisao',        // Cobertura Compreensiva
  '038': 'colisao',        // Valor mercado referenciado
  '056': 'terceiros',      // Danos Morais
  '113': 'assistencia',    // Assist Auto Dia/Noite
  '024': 'vidros',         // Vidro Protegido Plus
  '060': 'carro_reserva',  // Auto Reserva
}

const formatar = valor => `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function parseCotacaoBradesco({ itens = [], texto = '', seguradoraMeta = null } = {}) {
  const linhas = agruparLinhas(itens)
  const cot = criarCotacaoOrcamento()

  cot.seguradora = {
    id: seguradoraMeta?.id ?? null,
    nome: seguradoraMeta?.nome_canonico || 'Bradesco Seguros',
    logo_url: seguradoraMeta?.logo_url || '',
    cor_destaque: seguradoraMeta?.cor_destaque || '',
  }

  // Campo escalar tambem sai por coordenada, nao por regex sobre o texto
  // plano. Motivo medido: no texto plano deste PDF "Nº Cotação:" e seguido de
  // "DEMONSTRATIVO DE CÁLCULO", nao do numero — os fragmentos vem na ordem de
  // desenho. Toda regex ancorada em "rotulo seguido do valor" volta vazia.
  const doCabecalho = rotulo => valorAposRotulo(fatiar(linhas, SECOES.cabecalho), rotulo)
  const doProponente = rotulo => valorAposRotulo(fatiar(linhas, SECOES.proponente), rotulo)
  const doObjeto = rotulo => valorAposRotulo(fatiar(linhas, SECOES.objeto), rotulo)

  cot.cotacao = {
    numero: doCabecalho('Nº Cotação'),
    // O Bradesco nao escreve "Seguro Novo" nem "Renovacao". "Cia Renovacao"
    // preenchida significa que existe apolice anterior de outra companhia — ou
    // seja, renovacao congenere. Vazia, cai no detector generico.
    tipo_operacao: /\d/.test(doProponente('Cia Renovação'))
      ? 'renovacao'
      : (detectarTipoOperacao(texto) || ''),
    validade: paraIso(doCabecalho('Cálculo válido até')),
    data_emissao: paraIso(doCabecalho('Data do 1º Cálculo')),
  }

  cot.segurado = {
    nome: doProponente('Nome'),
    cpf_cnpj: doProponente('CPF/CNPJ'),
    data_nascimento: paraIso(doProponente('Data Nasc.')) || null,
  }

  const anoFab = doObjeto('Ano Fab.')
  const anoMod = doObjeto('Ano Mod.')
  cot.veiculo = {
    marca_modelo: [doObjeto('Marca'), doObjeto('Tipo do Veículo')].filter(Boolean).join(' '),
    ano_modelo: anoFab && anoMod ? `${anoFab}/${anoMod}` : '',
    placa: doObjeto('Placa'),
    uso: doObjeto('Uso Veículo'),
    cep_pernoite: doProponente('CEP de Pernoite'),
    condutor_18_25: null,
  }

  // "das 24h de 27/08/2026 às 24h de 27/08/2027"
  const vig = doProponente('Vigência').match(/(\d{2}\/\d{2}\/\d{4})[\s\S]*?(\d{2}\/\d{2}\/\d{4})/)
  cot.vigencia = { inicio: paraIso(vig?.[1]), fim: paraIso(vig?.[2]) }

  const clausulas = extrairClausulas(linhas)
  const lmi = extrairLmi(linhas)
  const franquias = extrairFranquias(linhas)
  const premios = extrairPremios(linhas)

  const doCondutor = rotulo => valorAposRotulo(fatiar(linhas, SECOES.condutor), rotulo)
  cot.condutor_principal = {
    nome: doCondutor('Nome'),
    cpf: doCondutor('CPF/CNPJ'),
    estado_civil: doCondutor('Estado Civil') || null,
  }

  // "1) - ... DESEJA COBERTURA PARA OUTRO CONDUTOR ENTRE 18 E 25 ANOS?" / "R.: Não"
  const questionario = fatiar(linhas, SECOES.questionario)
  const i18 = questionario.findIndex(l => /18 E 25 ANOS/i.test(l.texto))
  const resposta = i18 >= 0 ? (questionario[i18 + 1]?.texto || '') : ''
  const r = resposta.match(/^R\.:\s*(.+)$/i)
  cot.veiculo.condutor_18_25 = r
    ? (/^n[ãa]o/i.test(r[1]) ? 'Sem cobertura' : r[1].trim())
    : null

  cot.valores = {
    premio_liquido: premios.liquido,
    iof: premios.iof,
    premio_total: premios.total,
    premio_parcelado: textoPagamento(extrairPagamento(linhas)),
    descontos_aplicados: [],
    franquia: franquias.veiculo,
    franquia_tipo: franquias.tipo,
  }

  // Indenizacao integral: so afirma quando o documento afirma. "Valor de
  // Mercado Referenciado" + "% FIPE" preenchido e a afirmacao; qualquer outra
  // coisa devolve `null`, que bloqueia a geracao.
  cot.indenizacao_integral = /referenciad/i.test(lmi.referencia_veiculo) && lmi.percentual_fipe
    ? { incluida: true, percentual_fipe: lmi.percentual_fipe, observacao: '' }
    : { incluida: null, percentual_fipe: null, observacao: '' }

  cot.coberturas = clausulas
    .filter(c => CATEGORIA_POR_CODIGO[c.codigo])
    .map(c => ({
      nome_original_seguradora: c.nome,
      nome_padronizado: '',
      codigo_seguradora: c.codigo,
      categoria: CATEGORIA_POR_CODIGO[c.codigo],
      incluida: true,
      observacoes: observacaoDaClausula(c, { lmi, franquias }),
    }))

  cot.assistencias = []
  cot.servicos_adicionais = clausulas
    .filter(c => !CATEGORIA_POR_CODIGO[c.codigo])
    .map(c => c.nome)

  // Unica exclusao que o documento declara com todas as letras.
  cot.nao_incluso = /n[ãa]o contratada/i.test(lmi.blindagem)
    ? [{ titulo: 'Blindagem', detalhe: 'Cobertura não contratada.' }]
    : []

  return cot
}

/** Texto impresso no card para cada clausula, com os numeros da secao certa. */
function observacaoDaClausula(clausula, { lmi, franquias }) {
  if (clausula.codigo === '056') {
    // Danos morais e so uma das tres coberturas de terceiros; o card precisa
    // das tres juntas para o cliente comparar com a outra seguradora.
    const partes = [
      lmi.danos_materiais != null && `${formatar(lmi.danos_materiais)} danos materiais`,
      lmi.danos_corporais != null && `${formatar(lmi.danos_corporais)} danos corporais`,
      lmi.danos_morais != null && `${formatar(lmi.danos_morais)} danos morais`,
    ].filter(Boolean)
    return partes.length ? `${partes.join(' + ')}.` : clausula.nome
  }

  if (clausula.codigo === '024') {
    const pecas = [
      franquias.para_brisa != null && `para-brisa ${formatar(franquias.para_brisa)}`,
      franquias.vidros_laterais != null && `lateral ${formatar(franquias.vidros_laterais)}`,
      franquias.retrovisores != null && `retrovisor ${formatar(franquias.retrovisores)}`,
    ].filter(Boolean)
    return pecas.length ? `${clausula.nome} — franquia por peça (${pecas.join(', ')}).` : clausula.nome
  }

  return clausula.nome
}

function paraIso(br) {
  const m = String(br || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
