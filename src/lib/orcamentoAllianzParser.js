// ─── Parser de cotacao — Allianz Seguros ───────────────────────────────
//
// A cotacao da Allianz tem uma particularidade que nenhuma das anteriores tem, e
// que muda o contrato do parser: ela nao cota UM seguro, cota SEIS.
//
//   Roubo e Furto * | Basico | Ampliado     (bloco 1)
//   Completo        | Master | Exclusivo    (bloco 2)
//
// Cada oferta tem LMI proprio, preco por cobertura proprio e total proprio.
// Neste documento (cotacao 493446723) os totais vao de R$ 2.453,03 a R$ 4.866,50
// — quase o dobro entre a primeira e a ultima. E as coberturas mudam junto: RCF
// Danos Materiais e R$ 100.000,00 na "Roubo e Furto" e R$ 1.000.000,00 na
// "Exclusivo".
//
// **NENHUMA DELAS VEM MARCADA COMO ESCOLHIDA.** O proprio PDF diz, na pagina 1,
// "o preco por cobertura da Oferta A SER CONTRATADA" — o documento e um cardapio,
// a escolha acontece depois, fora dele. Nao existe no arquivo nada que diga qual
// oferta o corretor vai levar ao cliente.
//
// Por isso este parser NAO escolhe uma por conta propria. Chamar sem `oferta`
// devolve tudo o que independe da oferta (segurado, veiculo, condutor, franquia,
// carro reserva, condicoes gerais) mais a lista das seis em `cot.ofertas`, e
// marca `cot.escolha_pendente` — que bloqueia a geracao na tela de revisao ate
// alguem escolher. Chutar a primeira, ou a mais barata, poria um premio errado
// num documento que vai para o cliente, sem nada indicando o erro. Este e
// exatamente o tipo de acerto silencioso que o modulo inteiro existe para evitar.
//
// POR QUE A TABELA DE COBERTURAS NAO USA `colunasPeloCabecalho`: porque ela nao
// tem cabecalho por coluna utilizavel. O nome da oferta fica numa linha propria,
// centralizado sobre o PAR de colunas (LMI + Preco) e desalinhado das duas —
// "Basico" sai em x=342, enquanto seus valores saem em x=305 e x=375. E as linhas
// de total tem 3 celulas onde as de cobertura tem 6, entao um unico conjunto de
// fronteiras em X erra as duas: o "Preco Liquido" da primeira oferta sai em
// x=210, que e justamente a fronteira entre a coluna de LMI e a de Preco. Aqui a
// leitura e por PAREAMENTO SEQUENCIAL dentro do bloco: 6 celulas a direita do
// rotulo sao (LMI, Preco) x3, na ordem em que aparecem na pagina.
//
// LICAO REPETIDA DO BRADESCO: preco "-" NAO significa cobertura ausente. O
// Guincho 500 Km vem com preco "-" nas seis ofertas porque esta embutido no
// pacote. Quem afirma a ausencia e o LMI: "Nao Contratado". E o que a Allianz faz
// no Carro Reserva — e isso e uma boa noticia, porque e a primeira das amostras
// que NEGA a cobertura de forma explicita em vez de silenciar (a familia Porto
// simplesmente nao menciona carro reserva, e por isso trava na revisao).

import { agruparLinhas, celulaEm, fatiar, valorAposRotulo } from './pdfLayout.js'
import { criarCotacaoOrcamento, classificarCobertura, humanizarCobertura } from './orcamentoComparativo.js'

export const CNPJ_ALLIANZ = '061573796000166'

// O mesmo rotulo aparece em secoes diferentes com valores diferentes — a mesma
// armadilha ja medida no Bradesco. Aqui sao duas:
//   "Nome:"                -> em SUAS INFORMACOES e o segurado;
//                             em INFORMACOES DO CONDUTOR PRINCIPAL e o condutor.
//   "Seguradora Anterior:" -> em INFORMACOES DO SEU SEGURO vale "6572 - HDI
//                             SEGUROS S/A"; em INFORMACOES DA RENOVACAO vale so
//                             "6572".
// Buscar no documento inteiro devolveria o primeiro, que nos dois casos e o
// errado para quem pergunta.
const SECOES = {
  segurado: { de: 'SUAS INFORMAÇÕES', ate: 'INFORMAÇÕES DO SEU SEGURO' },
  seguro: { de: 'INFORMAÇÕES DO SEU SEGURO', ate: 'INFORMAÇÕES DA RENOVAÇÃO' },
  condutor: { de: 'INFORMAÇÕES DO CONDUTOR PRINCIPAL', ate: 'DETALHES DAS OFERTAS' },
  ofertas: { de: 'DETALHES DAS OFERTAS', ate: 'INFORMAÇÕES DE PAGAMENTO' },
  pagamento: { de: 'INFORMAÇÕES DE PAGAMENTO', ate: 'CARRO RESERVA' },
  carroReserva: { de: 'CARRO RESERVA', ate: 'FRANQUIA - PARTICIPAÇÃO OBRIGATÓRIA' },
  franquia: { de: 'FRANQUIA - PARTICIPAÇÃO OBRIGATÓRIA', ate: 'ASSISTÊNCIA A VIDROS' },
  // Ancorado na frase, e nao no titulo "OUTRAS FORMAS DE PAGAMENTO": o titulo
  // tambem aparece no rodape da pagina 2 ("Veja outras formas de pagamentos
  // disponiveis na secao OUTRAS FORMAS DE PAGAMENTO"), e o corte comecaria la.
  formasPagamento: { de: 'Confira abaixo as formas de pagamento disponíveis', ate: 'SEU CORRETOR' },
}

// Rotulos das linhas de total da tabela de ofertas. Elas tem uma celula por
// oferta, contra duas das linhas de cobertura, e por isso sao lidas a parte.
const ROTULOS_TOTAL = {
  premio_liquido: /^Preço Líquido$/i,
  taxa_juros: /^Tx\.\s*Mensal Juros$/i,
  valor_juros: /^Valor Juros/i,
  iof: /^IOF$/i,
  premio_total: /^Preço Total$/i,
}

const X_ROTULO = 150 // a esquerda disso e rotulo de linha; a direita, valor

/** Linha "Parcelas | Juros | <ofertas...>" das tabelas de forma de pagamento. */
function ehCabecalhoParcelas(linha) {
  const celulas = linha?.celulas || []
  return celulas.some(c => /^Parcelas$/i.test(c.texto)) && celulas.some(c => /^Juros$/i.test(c.texto))
}

export function ehLayoutAllianz(texto) {
  const t = String(texto || '')
  return t.replace(/[^\d]/g, '').includes(CNPJ_ALLIANZ) || /Allianz Seguros S\.?A/i.test(t)
}

export function moeda(texto) {
  const t = String(texto ?? '').trim()
  if (!t || t === '-') return null
  const m = t.match(/-?[\d.]*\d,\d{2}/)
  if (!m) return null
  const n = Number(m[0].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function chave(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\*/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Legenda dos asteriscos ────────────────────────────────────────────
//
// A tabela abrevia duas familias de cobertura e marca cada uma com asterisco:
// "RCF** - Danos Materiais", "APP*** - Morte". Sozinhas, as duas nao casam com
// o dicionario — "rcf** - gastos com defesa" nao contem "responsabilidade
// civil", e "app*** - morte" nao contem "app morte".
//
// Mas o rodape da propria pagina 2 traduz as duas, no vocabulario normal do ramo:
//
//   ** RCF: Responsabilidade Civil Facultativa | *** APP: Acidentes Pessoais de Passageiros
//
// Entao a sigla e trocada pelo que o documento diz que ela significa, e o
// dicionario compartilhado continua sem jargao de seguradora nenhuma — o mesmo
// caminho ja usado nas notas de rodape da HDI. De quebra o card do cliente passa
// a imprimir "Responsabilidade Civil Facultativa - Danos Materiais" em vez de
// "RCF** - Danos Materiais", que nao quer dizer nada para quem le.

export function legendaAsteriscos(texto) {
  const mapa = new Map()
  const re = /\*+\s*([A-Z]{2,5})\s*:\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]+?)(?=\s*\||\s*\*|$)/gm
  let m
  while ((m = re.exec(String(texto || '')))) {
    const sigla = m[1].trim()
    const significado = m[2].replace(/\s+/g, ' ').trim()
    if (sigla && significado && !mapa.has(sigla)) mapa.set(sigla, significado)
  }
  return mapa
}

/** "RCF** - Danos Materiais" -> "Responsabilidade Civil Facultativa - Danos Materiais" */
export function expandirSigla(nome, legenda) {
  const m = String(nome || '').match(/^([A-Z]{2,5})\*+\s*-?\s*(.*)$/)
  if (!m) return String(nome || '')
  const significado = legenda?.get?.(m[1])
  // Sem legenda no documento, ao menos os asteriscos saem: eles sao marca de
  // rodape, nunca parte do nome da cobertura.
  if (!significado) return m[2] ? `${m[1]} - ${m[2]}` : m[1]
  return m[2] ? `${significado} - ${m[2]}` : significado
}

// ─── As ofertas ────────────────────────────────────────────────────────

/**
 * Nomes das ofertas, na ordem, lidos do cabecalho da tabela de parcelamento.
 *
 * Essa tabela e a unica do documento em que as seis aparecem numa linha so
 * ("Parcelas | Juros | Roubo e Furto | Basico | ... | Exclusivo"), o que da a
 * ordem canonica sem depender de quantas cabem por bloco na tabela de
 * coberturas. A lista nao e fixa no codigo de proposito: a Allianz batiza pacote
 * por produto, e "Automoveis 1211" pode nao ter os mesmos seis do proximo.
 */
export function extrairNomesOfertas(linhas) {
  const secao = fatiar(linhas, SECOES.formasPagamento)
  // Casado por CELULA, nao pela linha inteira: a frase que abre a secao
  // ("...taxas de juros e valores de parcelas...") contem as duas palavras e
  // seria encontrada primeiro, devolvendo uma lista vazia sem erro nenhum.
  const cabecalho = secao.find(ehCabecalhoParcelas)
  if (!cabecalho) return []
  const juros = cabecalho.celulas.findIndex(c => /^Juros$/i.test(c.texto))
  if (juros < 0) return []
  return cabecalho.celulas.slice(juros + 1).map(c => c.texto.trim()).filter(Boolean)
}

/**
 * Blocos da tabela de coberturas: quais ofertas estao lado a lado em cada um.
 *
 * Uma linha e cabecalho de bloco quando todas as suas celulas sao nomes de
 * oferta. Deduzir "sao dois blocos de tres" a partir do total funcionaria neste
 * PDF e quebraria em silencio no primeiro que vier com outro arranjo.
 */
export function blocosDeOfertas(linhas, nomes) {
  const conhecidos = new Map(nomes.map((n, i) => [chave(n), i]))
  const secao = fatiar(linhas, SECOES.ofertas)
  const blocos = []

  for (const linha of secao) {
    if (linha.celulas.length < 2) continue
    const indices = linha.celulas.map(c => conhecidos.get(chave(c.texto)))
    if (indices.some(i => i == null)) continue
    blocos.push({ y: linha.y, pagina: linha.pagina, ofertas: indices })
  }

  return blocos
}

/**
 * Linhas da tabela de coberturas de um bloco, ja pareadas (LMI, Preco) por oferta.
 *
 * O rotulo pode quebrar em duas linhas fisicas com os valores NO MEIO delas — o
 * Casco sai como "Casco - Basica Compreensiva -" (y=699), valores (y=694),
 * "Colisao, Incendio, Roubo e Furto" (y=688). Por isso o rotulo e remontado a
 * partir de uma janela em Y ao redor da linha de valores, e nao da linha em si.
 * A janela e de 10pt: fragmentos do mesmo rotulo distam 5–6pt, e a proxima
 * cobertura dista 14pt, entao nao ha como uma invadir a outra.
 */
export function extrairBloco(linhas, bloco, proximoY) {
  const n = bloco.ofertas.length
  const secao = fatiar(linhas, SECOES.ofertas)
  const doBloco = secao.filter(l => l.pagina === bloco.pagina
    && l.y < bloco.y
    && (proximoY == null || l.y > proximoY))

  const rotuloDe = y => doBloco
    .filter(l => Math.abs(l.y - y) <= 10)
    .sort((a, b) => b.y - a.y)
    .flatMap(l => l.celulas.filter(c => c.x < X_ROTULO).map(c => c.texto))
    .join(' ')
    .trim()

  const coberturas = []
  const totais = {}

  for (const linha of doBloco) {
    const valores = linha.celulas.filter(c => c.x >= X_ROTULO)
    const rotuloNaLinha = linha.celulas.filter(c => c.x < X_ROTULO).map(c => c.texto).join(' ').trim()

    const total = Object.entries(ROTULOS_TOTAL).find(([, re]) => re.test(rotuloNaLinha))
    if (total && valores.length === n) {
      totais[total[0]] = valores.map(c => moeda(c.texto))
      continue
    }

    if (valores.length !== n * 2) continue

    const nome = rotuloDe(linha.y)
    if (!nome) continue

    coberturas.push({
      nome_original_seguradora: nome,
      // Pareamento sequencial: as celulas ja vem ordenadas por X, e cada oferta
      // ocupa duas colunas vizinhas.
      por_oferta: bloco.ofertas.map((indice, i) => ({
        indice,
        lmi_texto: valores[i * 2].texto,
        preco: moeda(valores[i * 2 + 1].texto),
      })),
    })
  }

  return { coberturas, totais }
}

/** Tabela de coberturas inteira, indexada por oferta. */
export function extrairOfertas(linhas) {
  const nomes = extrairNomesOfertas(linhas)
  if (!nomes.length) return []

  const blocos = blocosDeOfertas(linhas, nomes)
  const ofertas = nomes.map((nome, indice) => ({
    indice,
    nome,
    coberturas: [],
    premio_liquido: null,
    iof: null,
    premio_total: null,
  }))

  blocos.forEach((bloco, i) => {
    const proximo = blocos[i + 1]
    const proximoY = proximo && proximo.pagina === bloco.pagina ? proximo.y : null
    const { coberturas, totais } = extrairBloco(linhas, bloco, proximoY)

    bloco.ofertas.forEach((indice, coluna) => {
      const oferta = ofertas[indice]
      oferta.coberturas = coberturas.map(c => ({
        nome_original_seguradora: c.nome_original_seguradora,
        lmi_texto: c.por_oferta[coluna].lmi_texto,
        preco: c.por_oferta[coluna].preco,
        // "Nao Contratado" no LMI e a negacao explicita. Preco "-" nao e: o
        // Guincho vem sem preco proprio em todas as seis por estar no pacote.
        incluida: !/^n[ãa]o contratad/i.test(c.por_oferta[coluna].lmi_texto || ''),
      }))
      oferta.premio_liquido = totais.premio_liquido?.[coluna] ?? null
      oferta.iof = totais.iof?.[coluna] ?? null
      oferta.premio_total = totais.premio_total?.[coluna] ?? null
    })
  })

  return ofertas
}

// ─── Parcelamento ──────────────────────────────────────────────────────

/**
 * Um plano por meio de pagamento, para a oferta escolhida.
 *
 * Aqui a Allianz facilita: a coluna "Juros" diz "sem juros" com todas as letras,
 * entao o maximo sem juros nao precisa ser deduzido comparando totais como no
 * Bradesco. No boleto deste documento so a parcela unica e sem juros; no debito
 * em conta e no cartao o limite e 6x e 10x.
 */
export function extrairParcelamento(linhas, indiceOferta) {
  const secao = fatiar(linhas, SECOES.formasPagamento)
  const planos = []
  let atual = null

  for (const linha of secao) {
    const primeira = linha.celulas[0]

    if (/Oferta \(R\$\)/i.test(linha.texto) && primeira && !/^\d/.test(primeira.texto)) {
      atual = { meio: primeira.texto.trim(), colunas: null, linhas: [] }
      planos.push(atual)
      continue
    }
    if (!atual) continue

    if (ehCabecalhoParcelas(linha)) {
      const juros = linha.celulas.findIndex(c => /^Juros$/i.test(c.texto))
      atual.colunas = linha.celulas.slice(juros + 1).map(c => c.x)
      atual.xJuros = linha.celulas[juros]?.x
      continue
    }

    const n = primeira && primeira.texto.match(/^(\d{1,2})$/)
    if (!n || !atual.colunas) continue

    const x = atual.colunas[indiceOferta]
    if (x == null) continue

    atual.linhas.push({
      n: Number(n[1]),
      semJuros: /sem juros/i.test(celulaEm(linha, atual.xJuros, { antes: 20, depois: 30 })),
      parcela: moeda(celulaEm(linha, x, { antes: 20, depois: 30 })),
    })
  }

  return planos
    .filter(p => p.linhas.length)
    .map(p => {
      const semJuros = p.linhas.filter(l => l.semJuros && l.parcela != null)
      if (!semJuros.length) return null
      const melhor = semJuros.reduce((a, b) => (b.n > a.n ? b : a), semJuros[0])
      return { meio: p.meio, maximo_sem_juros: melhor.n, valor_parcela: melhor.parcela }
    })
    .filter(Boolean)
}

/** Uma linha legivel por meio de pagamento, no tom do modelo validado. */
export function textoParcelamento(planos) {
  return (planos || []).map(p => (p.maximo_sem_juros <= 1
    ? `${p.meio}: à vista ${formatar(p.valor_parcela)}`
    : `${p.meio}: até ${p.maximo_sem_juros}x de ${formatar(p.valor_parcela)} sem juros`))
}

// ─── Montagem ──────────────────────────────────────────────────────────

export function parseCotacaoAllianz({ itens = [], texto = '', seguradoraMeta = null, oferta = null } = {}) {
  const linhas = agruparLinhas(itens)
  const cot = criarCotacaoOrcamento()

  cot.seguradora = {
    id: seguradoraMeta?.id ?? null,
    nome: seguradoraMeta?.nome_canonico || 'Allianz Seguros',
    logo_url: seguradoraMeta?.logo_url || '',
    cor_destaque: seguradoraMeta?.cor_destaque || '',
  }

  const doSegurado = rotulo => valorAposRotulo(fatiar(linhas, SECOES.segurado), rotulo)
  const doSeguro = rotulo => valorAposRotulo(fatiar(linhas, SECOES.seguro), rotulo)
  const doCondutor = rotulo => valorAposRotulo(fatiar(linhas, SECOES.condutor), rotulo)

  const numero = texto.match(/N[ºo°]\s*Cota[çc][ãa]o:\s*(\d{6,})/i)
  const validade = texto.match(/Garantimos as condi[çc][õo]es desta cota[çc][ãa]o at[ée]\s*(\d{2}\/\d{2}\/\d{4})/i)
  const emissao = texto.match(/(\d{2})-(\d{2})-(\d{4})\s+\d{2}:\d{2}:\d{2}/)

  cot.cotacao = {
    numero: numero ? numero[1] : '',
    // "Renovacao de outra seguradora sem sinistro" — a Allianz e a unica das
    // amostras que ja escreve o tipo de operacao em portugues corrente.
    tipo_operacao: tipoOperacao(doSeguro('Tipo de Seguro')),
    validade: paraIso(validade?.[1]),
    data_emissao: emissao ? `${emissao[3]}-${emissao[2]}-${emissao[1]}` : '',
  }

  cot.segurado = {
    nome: doSegurado('Nome'),
    cpf_cnpj: doSegurado('CPF/CNPJ'),
    data_nascimento: null,
  }

  cot.condutor_principal = {
    nome: doCondutor('Nome'),
    cpf: doCondutor('CPF'),
    estado_civil: doCondutor('Estado Civil') || null,
  }

  cot.veiculo = {
    marca_modelo: doSeguro('Veículo'),
    ano_modelo: doSeguro('Ano/Modelo'),
    placa: doSeguro('Placa'),
    uso: doSeguro('Finalidade de Uso'),
    cep_pernoite: doSeguro('CEP Pernoite'),
    condutor_18_25: respostaJovem(texto),
  }

  const vig = doSeguro('Vigência').match(/(\d{2}\/\d{2}\/\d{4})[\s\S]*?(\d{2}\/\d{2}\/\d{4})/)
  cot.vigencia = { inicio: paraIso(vig?.[1]), fim: paraIso(vig?.[2]) }

  // "Condicoes Gerais: 07/2026" — mes/ano da versao, nao data completa.
  cot.condicoes_gerais = { referencia: doSeguro('Condições Gerais'), anexada_em: '' }

  const franquia = extrairFranquia(linhas)
  const ofertas = extrairOfertas(linhas)
  cot.ofertas = ofertas.map(o => ({ indice: o.indice, nome: o.nome, premio_total: o.premio_total }))

  const escolhida = escolherOferta(ofertas, oferta)

  if (!escolhida) {
    // Sem oferta escolhida nao ha premio nem cobertura: os dois mudam de oferta
    // para oferta. Em vez de deixar a revisao acusar sete categorias
    // "nao informadas" — que confundiria o corretor, porque o PDF INFORMA todas,
    // seis vezes — a pendencia dita e uma so, e e a verdadeira.
    cot.oferta = null
    cot.escolha_pendente = {
      campo: 'oferta',
      label: 'Esta cotação traz mais de uma oferta; escolha qual vai para o cliente',
      opcoes: cot.ofertas,
    }
    cot.valores.franquia = franquia.valor
    cot.valores.franquia_tipo = franquia.tipo
    return cot
  }

  cot.oferta = { indice: escolhida.indice, nome: escolhida.nome }

  cot.valores = {
    premio_liquido: escolhida.premio_liquido,
    iof: escolhida.iof,
    premio_total: escolhida.premio_total,
    premio_parcelado: textoParcelamento(extrairParcelamento(linhas, escolhida.indice)),
    descontos_aplicados: [],
    franquia: franquia.valor,
    franquia_tipo: franquia.tipo,
  }

  const legenda = legendaAsteriscos(texto)
  const escritas = escolhida.coberturas.map(c => ({ ...c, nome_original_seguradora: expandirSigla(c.nome_original_seguradora, legenda) }))

  const casco = escritas.find(c => /^Casco/i.test(c.nome_original_seguradora))
  const pct = String(casco?.lmi_texto || '').match(/([\d.,]+)\s*%\s*FIPE/i)
  if (pct) {
    cot.indenizacao_integral = {
      incluida: true,
      percentual_fipe: Number(pct[1].replace(/\./g, '').replace(',', '.')),
      observacao: '',
    }
  } else {
    cot.indenizacao_integral = { incluida: null, percentual_fipe: null, observacao: '' }
  }

  cot.coberturas = escritas.filter(c => c.incluida).map(c => ({
    nome_original_seguradora: c.nome_original_seguradora,
    nome_padronizado: '',
    categoria: classificarCobertura(c.nome_original_seguradora),
    incluida: true,
    observacoes: comporObservacao(c),
  }))

  cot.assistencias = []
  cot.servicos_adicionais = []
  cot.nao_incluso = escritas.filter(c => !c.incluida).map(c => ({
    titulo: humanizarCobertura(c.nome_original_seguradora),
    detalhe: 'Não contratado nesta cotação.',
  }))

  return cot
}

/** Oferta pedida, por indice ou por nome. Sem pedido explicito, nenhuma. */
function escolherOferta(ofertas, pedido) {
  if (pedido == null || pedido === '') return null
  if (typeof pedido === 'number') return ofertas.find(o => o.indice === pedido) || null
  const alvo = chave(pedido)
  return ofertas.find(o => chave(o.nome) === alvo) || null
}

/** "Franquia | Valor (R$)" / "50% da Normal | 3.161,89" */
export function extrairFranquia(linhas) {
  const secao = fatiar(linhas, SECOES.franquia)
  for (const linha of secao) {
    if (linha.celulas.length !== 2) continue
    const valor = moeda(linha.celulas[1].texto)
    if (valor == null) continue
    return { tipo: linha.celulas[0].texto.trim(), valor }
  }
  return { tipo: '', valor: null }
}

function comporObservacao(cobertura) {
  const nome = humanizarCobertura(cobertura.nome_original_seguradora)
  const lmi = String(cobertura.lmi_texto || '').trim()
  if (!lmi) return nome
  // Mesma armadilha ja pega na HDI: o LMI do casco e "100% FIPE", nao dinheiro.
  // Formatado como moeda viraria "Casco: R$ 100,00" no documento do cliente —
  // um valor de indenizacao falso, e milhares de vezes menor que o real.
  const soDinheiro = /^[\d.]*\d,\d{2}$/.test(lmi)
  return soDinheiro ? `${nome}: ${formatar(moeda(lmi))}` : `${nome}: ${lmi}`
}

/**
 * "Deseja ampliar a cobertura ... entre 18 a 25 anos: Nao. Estou ciente que ..."
 *
 * Lido do texto corrido de proposito: a resposta quebra em duas linhas fisicas
 * ("Nao. Estou" numa, "ciente que nao havera cobertura..." na outra), e
 * `valorAposRotulo` devolveria so o primeiro pedaco — "Nao. Estou", que nao e
 * frase nenhuma.
 */
function respostaJovem(texto) {
  const m = String(texto || '').match(/idade entre 18 a 25 anos:\s*([\s\S]{0,160}?)\s*(?:O principal condutor|DETALHES DAS OFERTAS|$)/i)
  if (!m) return null
  const resposta = m[1].replace(/\s+/g, ' ').trim()
  if (!resposta) return null
  return /^n[ãa]o\b/i.test(resposta) ? 'Sem cobertura' : resposta
}

function tipoOperacao(valor) {
  const v = chave(valor)
  if (!v) return ''
  if (v.includes('endosso')) return 'endosso'
  if (v.includes('renovacao')) return 'renovacao'
  if (v.includes('novo')) return 'novo'
  return ''
}

function formatar(valor) {
  if (valor == null) return ''
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function paraIso(br) {
  const m = String(br || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
