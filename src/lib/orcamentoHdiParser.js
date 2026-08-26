// ─── Parser de cotacao — HDI Seguros ───────────────────────────────────
//
// O "Calculo de Seguros On Line" da HDI tem uma particularidade que nenhuma das
// outras amostras tem: ele traz DUAS COTACOES ALTERNATIVAS no mesmo documento,
// lado a lado, cada uma com LMI, premio, totais e tabela de parcelamento
// proprios:
//
//   Garantias de Auto | VLR. MERCADO REFERENCIADO | Valor Determinado | Franquia
//   Cobertura         | L.M.I.  | Prêmio          | L.M.I.  | Prêmio  |
//   CASCO             | 100,00% FIPE | 507,38     | 26.625,60 | 681,03 | 2.465,76
//
// Sao produtos diferentes: "Mercado Referenciado" indeniza 100% da FIPE do dia
// do sinistro; "Valor Determinado" indeniza um valor fixo combinado hoje. O
// comparativo mostra UMA, escolhida explicitamente pelo usuario. Embora
// `mercado` seja mais comum, o parser nunca presume que foi a opcao escolhida.
// o total da outra modalidade fica registrado em `modalidade_alternativa` para
// o corretor nao precisar reabrir o PDF.
//
// CLASSIFICACAO PELA NOTA DE RODAPE: a HDI batiza cobertura em jargao interno —
// "07 DIAS CR MANUAL" e carro reserva, "ESPECIAL AUTO - 600KM" e assistencia
// 24h. Nenhum dos dois casa com o dicionario, e nao seria certo encher o
// dicionario compartilhado de jargao de uma seguradora so. Mas o proprio PDF
// explica os dois nas notas (*3) e (*4), com as palavras normais do ramo. Entao
// a classificacao roda sobre nome + nota, e o dicionario continua limpo.

import { agruparLinhas, celulaEm, fatiar, valorAposRotulo } from './pdfLayout.js'
import { criarCotacaoOrcamento, classificarCobertura, humanizarCobertura } from './orcamentoComparativo.js'
import { exigirProduto, resultadoProdutos } from './orcamentoProdutos.js'

export const CNPJ_HDI = '29980158008212'

const SECOES = {
  cliente: { de: 'Dados do Cliente', ate: 'Dados do Veículo' },
  veiculo: { de: 'Dados do Veículo', ate: 'Avaliação de Risco' },
  risco: { de: 'Avaliação de Risco', ate: 'Aviso:' },
  garantias: { de: 'Garantias de Auto', ate: 'IMPRESSÃO DOS TEXTOS EXPLICATIVOS' },
  notas: { de: 'IMPRESSÃO DOS TEXTOS EXPLICATIVOS', ate: 'Parcelamento' },
  parcelamento: { de: 'Parcelamento Vlr. Mercado Referenciado', ate: 'Assinatura do Proponente' },
}

export const MODALIDADES = {
  mercado: { indice: 0, rotulo: 'Valor de Mercado Referenciado' },
  determinado: { indice: 1, rotulo: 'Valor Determinado' },
}

export const PRODUTOS_HDI = Object.entries(MODALIDADES).map(([id, produto]) => ({
  id,
  label: produto.rotulo,
}))

export function listarProdutosHdi() {
  return resultadoProdutos('HDI Seguros', PRODUTOS_HDI)
}

export function ehLayoutHdi(texto) {
  const t = String(texto || '')
  return t.replace(/[^\d]/g, '').includes(CNPJ_HDI) || /HDI\s+SEGUROS\s+S\.?A/i.test(t)
}

export function moeda(texto) {
  const t = String(texto ?? '').trim()
  if (!t || t === '-') return null
  const m = t.match(/-?[\d.]*\d,\d{2}/)
  if (!m) return null
  const n = Number(m[0].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// ─── Notas de rodape ───────────────────────────────────────────────────

/**
 * Notas "(*1) ... (*4)" que explicam as coberturas de jargao.
 *
 * Uma nota ocupa varias linhas no PDF; a continuacao vem sem marcador, entao
 * tudo que vier antes do proximo "(*N)" pertence a nota corrente.
 */
export function extrairNotas(linhas) {
  const secao = fatiar(linhas, SECOES.notas)
  const notas = {}
  let atual = null
  for (const linha of secao) {
    const m = linha.texto.match(/^\(\*(\d+)\)\s*(.*)$/)
    if (m) {
      atual = m[1]
      notas[atual] = m[2].trim()
    } else if (atual && !/IMPRESS[ÃA]O DOS TEXTOS/i.test(linha.texto)) {
      notas[atual] = `${notas[atual]} ${linha.texto}`.trim()
    }
  }
  return notas
}

// ─── Tabela de garantias ───────────────────────────────────────────────

const RUIDO_GARANTIA = /^(Cobertura|Garantias de Auto|PR[ÊE]MIO|CUSTO DO DOCUMENTO|I\.O\.F\.|TOTAL)/i

/**
 * Colunas das duas modalidades, lidas dos dois cabecalhos empilhados.
 *
 * Linha de cima: VLR. MERCADO REFERENCIADO | Valor Determinado | Franquia
 * Linha de baixo: Cobertura | L.M.I. | Prêmio | L.M.I. | Prêmio
 *
 * O primeiro par L.M.I./Premio pertence a modalidade da esquerda, o segundo a
 * da direita — e por isso os pares sao lidos na ordem em que aparecem, e nao
 * por X fixo, que muda quando a HDI mexe na largura da tabela.
 */
export function colunasGarantias(linhas) {
  const secao = fatiar(linhas, SECOES.garantias)
  const topo = secao.find(l => /VLR\.?\s*MERCADO REFERENCIADO/i.test(l.texto))
  const sub = secao.find(l => (l.texto.match(/L\.M\.I\./g) || []).length >= 2)
  if (!topo || !sub) return null

  const lmis = sub.celulas.filter(c => /^L\.M\.I\.$/i.test(c.texto)).map(c => c.x)
  const premios = sub.celulas.filter(c => /^Pr[êe]mio$/i.test(c.texto)).map(c => c.x)
  const franquia = topo.celulas.find(c => /^Franquia$/i.test(c.texto))
  if (lmis.length < 2 || premios.length < 2) return null

  return {
    pares: [
      { lmi: lmis[0], premio: premios[0] },
      { lmi: lmis[1], premio: premios[1] },
    ],
    franquia: franquia ? franquia.x : null,
  }
}

/**
 * Coberturas da modalidade escolhida.
 *
 * @returns [{ nome_original_seguradora, valor_lmi, lmi_texto, franquia, premio, incluida, nota }]
 */
export function extrairGarantias(linhas, { modalidade = 'mercado' } = {}) {
  const colunas = colunasGarantias(linhas)
  if (!colunas) return []
  const par = colunas.pares[MODALIDADES[modalidade]?.indice ?? 0]
  const notas = extrairNotas(linhas)
  const secao = fatiar(linhas, SECOES.garantias)

  const garantias = []
  for (const linha of secao) {
    const primeira = linha.celulas[0]
    if (!primeira || primeira.x > 60) continue
    const nome = primeira.texto
    if (RUIDO_GARANTIA.test(nome)) continue

    const lmiTexto = celulaEm(linha, par.lmi)
    const premio = moeda(celulaEm(linha, par.premio))
    if (premio == null && !lmiTexto) continue

    // A HDI marca a cobertura recusada com todas as letras. E uma AFIRMACAO de
    // ausencia, diferente de silencio, e vai para o painel "nao incluso".
    const naoContratado = /n[ãa]o contratado/i.test(lmiTexto)

    // "(*3)" fica em celula separada, logo apos o nome.
    const marca = linha.celulas.map(c => c.texto).join(' ').match(/\(\*(\d+)\s*\)/)
    const nota = marca ? (notas[marca[1]] || '') : ''

    garantias.push({
      nome_original_seguradora: nome,
      nome_padronizado: '',
      valor_lmi: moeda(lmiTexto),
      lmi_texto: lmiTexto,
      franquia: colunas.franquia != null ? moeda(celulaEm(linha, colunas.franquia)) : null,
      premio,
      incluida: !naoContratado,
      nota,
      observacoes: '',
    })
  }
  return garantias
}

/** Totais da modalidade: as duas colunas ficam nas MESMAS linhas de rodape. */
export function extrairTotais(linhas, { modalidade = 'mercado' } = {}) {
  const colunas = colunasGarantias(linhas)
  const secao = fatiar(linhas, SECOES.garantias)
  const indice = MODALIDADES[modalidade]?.indice ?? 0
  // Os totais nao usam as colunas de L.M.I., so as de premio de cada lado.
  const x = colunas ? colunas.pares[indice].premio : null

  const ler = padrao => {
    const linha = secao.find(l => padrao.test(l.celulas[0]?.texto || ''))
    if (!linha || x == null) return null
    return moeda(celulaEm(linha, x, { antes: 40, depois: 40 }))
  }

  return {
    premio_liquido: ler(/^PR[ÊE]MIO TOTAL L[ÍI]QUIDO/i) ?? ler(/^PR[ÊE]MIO L[ÍI]QUIDO/i),
    iof: ler(/^I\.O\.F\./i),
    total: ler(/^TOTAL [ÀA] VISTA/i),
  }
}

// ─── Parcelamento ──────────────────────────────────────────────────────

// A HDI so imprime o valor da parcela, nunca o total do plano. "Sem juros" e
// entao n x parcela ~= total a vista. A folga absorve o centavo de
// arredondamento que sempre sobra (12 x 123,18 = 1.478,16 contra 1.478,24).
const FOLGA_JUROS = 1.5

/**
 * Tabela de parcelamento da modalidade escolhida.
 *
 * O documento tem DUAS tabelas lado a lado ("Parcelamento Vlr. Mercado
 * Referenciado" e "Parcelamento Valor Determinado"), cada uma com tres meios de
 * pagamento. Sao seis pares Plano/Valor na mesma linha: pegar os tres primeiros
 * ou os tres ultimos e o que separa as modalidades.
 */
export function extrairParcelamento(linhas, { modalidade = 'mercado', total = null } = {}) {
  const secao = fatiar(linhas, SECOES.parcelamento)
  const meiosLinha = secao.find(l => /Cart[ãa]o de Cr[ée]dito/i.test(l.texto))
  const sub = secao.find(l => (l.texto.match(/Plano/g) || []).length >= 2)
  if (!meiosLinha || !sub) return []

  const planos = sub.celulas.filter(c => /^Plano$/i.test(c.texto)).map(c => c.x)
  const valores = sub.celulas.filter(c => /^Valor/i.test(c.texto)).map(c => c.x)
  const meios = meiosLinha.celulas.map(c => c.texto)

  // Metade esquerda = mercado referenciado, metade direita = valor determinado.
  const metade = Math.floor(meios.length / 2)
  const inicio = (MODALIDADES[modalidade]?.indice ?? 0) === 0 ? 0 : metade
  const fim = inicio + metade

  const resultado = []
  for (let i = inicio; i < fim && i < planos.length; i += 1) {
    const linhasPlano = []
    for (const linha of secao) {
      const plano = celulaEm(linha, planos[i], { antes: 10, depois: 14 })
      const n = plano && plano.match(/^(\d{1,2})\s*x$/i)
      if (!n) continue
      const valor = moeda(celulaEm(linha, valores[i], { antes: 14, depois: 20 }))
      if (valor != null) linhasPlano.push({ n: Number(n[1]), valor })
    }
    if (!linhasPlano.length) continue

    const base = total ?? Math.max(...linhasPlano.map(l => l.valor))
    const semJuros = linhasPlano.filter(l => l.n * l.valor <= base + FOLGA_JUROS)
    const melhor = semJuros.length
      ? semJuros.reduce((a, b) => (b.n > a.n ? b : a), semJuros[0])
      : linhasPlano[0]

    resultado.push({
      meio: meios[i],
      maximo_sem_juros: melhor.n,
      valor_parcela: melhor.valor,
    })
  }
  return resultado
}

const formatar = valor => `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function textoParcelamento(planos) {
  return (planos || []).map(p => (p.maximo_sem_juros <= 1
    ? `${p.meio}: à vista ${formatar(p.valor_parcela)}`
    : `${p.meio}: até ${p.maximo_sem_juros}x de ${formatar(p.valor_parcela)} sem juros`))
}

// ─── Montagem ──────────────────────────────────────────────────────────

export function parseCotacaoHdi({ itens = [], texto = '', seguradoraMeta = null, modalidade = null, produto = null } = {}) {
  const escolhido = exigirProduto({
    seguradora: 'HDI Seguros', produtos: PRODUTOS_HDI, selecionado: produto || modalidade,
  })
  modalidade = escolhido.id
  const linhas = agruparLinhas(itens)
  const cot = criarCotacaoOrcamento()

  cot.seguradora = {
    id: seguradoraMeta?.id ?? null,
    nome: seguradoraMeta?.nome_canonico || 'HDI Seguros',
    logo_url: seguradoraMeta?.logo_url || '',
    cor_destaque: seguradoraMeta?.cor_destaque || '',
  }

  const doCliente = rotulo => valorAposRotulo(fatiar(linhas, SECOES.cliente), rotulo)
  const doVeiculo = rotulo => valorAposRotulo(fatiar(linhas, SECOES.veiculo), rotulo)
  const doRisco = rotulo => valorAposRotulo(fatiar(linhas, SECOES.risco), rotulo)

  const numero = texto.match(/C[áa]lculo\s*-\s*(\d{6,})/i)
  const validade = texto.match(/COTA[ÇC][ÃA]O V[ÁA]LIDA AT[ÉE]\s*(\d{2}\/\d{2}\/\d{4})/i)
  const emissao = texto.match(/(\d{2}\/\d{2}\/\d{4}),\s*\d{2}:\d{2}/)

  // A HDI carimba "Novo Negócio" porque o cliente e novo PARA ELA. Mas o
  // documento tambem traz "Companhia Anterior" preenchida, e para a corretora
  // isso e renovacao congenere — o mesmo criterio ja usado no Bradesco com
  // "Cia Renovacao". Sem isso, uma renovacao entraria no funil como negocio novo.
  const companhiaAnterior = doVeiculo('Companhia Anterior')

  cot.cotacao = {
    numero: numero ? numero[1] : '',
    tipo_operacao: companhiaAnterior ? 'renovacao' : 'novo',
    validade: paraIso(validade?.[1]),
    data_emissao: paraIso(emissao?.[1]),
  }

  cot.segurado = {
    nome: doCliente('Proponente'),
    cpf_cnpj: doCliente('CPF'),
    data_nascimento: null,
  }

  cot.condutor_principal = {
    nome: doRisco('Nome do Condutor'),
    cpf: doRisco('CPF'),
    estado_civil: doRisco('Estado Civil') || null,
  }

  const veiculo = doVeiculo('Veículo')
  const anoModelo = doVeiculo('Ano/Modelo')
  cot.veiculo = {
    // "0014271 - CHEVROLET - CORSA - HATCH MAXX 1.4 ECONOFLEX 8V 5P (FIPE" —
    // fora o codigo interno e o parentese aberto da referencia FIPE.
    marca_modelo: veiculo.replace(/^\d+\s*-\s*/, '').replace(/\s*\(FIPE.*$/i, '').trim(),
    ano_modelo: anoModelo,
    placa: doVeiculo('Placa'),
    uso: doRisco('Utilizacao do Veiculo'),
    cep_pernoite: formatarCep(doVeiculo('CEP Pernoite')),
    condutor_18_25: respostaJovem(doRisco('Cob Demais Condutores Resid entre 18 Até 25 Anos')),
  }

  const vig = doCliente('Vigência').match(/(\d{2}\/\d{2}\/\d{4})[\s\S]*?(\d{2}\/\d{2}\/\d{4})/)
  cot.vigencia = { inicio: paraIso(vig?.[1]), fim: paraIso(vig?.[2]) }

  const garantias = extrairGarantias(linhas, { modalidade })
  const totais = extrairTotais(linhas, { modalidade })
  const casco = garantias.find(g => /^CASCO/i.test(g.nome_original_seguradora))

  cot.valores = {
    premio_liquido: totais.premio_liquido,
    iof: totais.iof,
    premio_total: totais.total,
    premio_parcelado: textoParcelamento(extrairParcelamento(linhas, { modalidade, total: totais.total })),
    descontos_aplicados: [],
    franquia: casco?.franquia ?? null,
    franquia_tipo: doVeiculo('Franquia'),
  }

  // "100,00% FIPE" no L.M.I. do casco e a afirmacao de indenizacao integral.
  // Na modalidade "Valor Determinado" nao ha percentual — ha um valor fixo, e o
  // card precisa dizer isso com essas palavras, nao fingir um percentual.
  const pct = String(casco?.lmi_texto || '').match(/([\d.,]+)\s*%\s*FIPE/i)
  if (pct) {
    cot.indenizacao_integral = {
      incluida: true,
      percentual_fipe: Number(pct[1].replace(/\./g, '').replace(',', '.')),
      observacao: '',
    }
  } else if (casco?.valor_lmi != null) {
    cot.indenizacao_integral = {
      incluida: true,
      percentual_fipe: null,
      observacao: `Indenização por valor determinado de ${formatar(casco.valor_lmi)}.`,
    }
  } else {
    cot.indenizacao_integral = { incluida: null, percentual_fipe: null, observacao: '' }
  }

  cot.coberturas = garantias.filter(g => g.incluida).map(g => ({
    nome_original_seguradora: g.nome_original_seguradora,
    nome_padronizado: '',
    // Classifica com a nota junto: e ela que traduz "07 DIAS CR MANUAL" em
    // "Carro Reserva" e "ESPECIAL AUTO - 600KM" em "Assistencia 24h".
    categoria: classificarCobertura(`${g.nome_original_seguradora} ${g.nota}`),
    incluida: true,
    observacoes: comporObservacao(g),
  }))

  cot.assistencias = []
  cot.servicos_adicionais = []
  cot.nao_incluso = garantias.filter(g => !g.incluida).map(g => ({
    titulo: humanizarCobertura(g.nome_original_seguradora),
    detalhe: 'Não contratado nesta cotação.',
  }))

  cot.modalidade = modalidade
  cot.produto_selecionado = escolhido
  cot.produtos_disponiveis = PRODUTOS_HDI.map(p => ({ ...p }))
  cot.modalidade_alternativa = alternativa(linhas, modalidade)

  return cot
}

/** Total da OUTRA modalidade, para o corretor nao ter de reabrir o PDF. */
function alternativa(linhas, modalidade) {
  const outra = modalidade === 'mercado' ? 'determinado' : 'mercado'
  const totais = extrairTotais(linhas, { modalidade: outra })
  if (totais.total == null) return null
  return { modalidade: outra, rotulo: MODALIDADES[outra].rotulo, premio_total: totais.total }
}

function comporObservacao(garantia) {
  const nome = humanizarCobertura(garantia.nome_original_seguradora)
  // A nota de rodape e mais util ao cliente do que o nome interno: ela diz o
  // que a cobertura faz ("7 dias de Carro Reserva", "Guincho 600 KM").
  if (garantia.nota) return `${nome} — ${garantia.nota}`

  // O L.M.I. do casco NAO e dinheiro: e "100,00% FIPE". Formatar como moeda
  // imprimia "Casco: R$ 100,00" no documento do cliente — um valor de
  // indenizacao falso, e mil vezes menor que o real. So vira moeda quando o
  // texto da celula e mesmo um valor monetario.
  const soDinheiro = /^[\d.]*\d,\d{2}$/.test(String(garantia.lmi_texto || '').trim())
  if (soDinheiro && garantia.valor_lmi != null) return `${nome}: ${formatar(garantia.valor_lmi)}`
  if (garantia.lmi_texto) return `${nome}: ${garantia.lmi_texto}`
  return nome
}

function respostaJovem(valor) {
  const v = String(valor || '').trim()
  if (!v) return null
  return /^n[ãa]o$/i.test(v) ? 'Sem cobertura' : v
}

function formatarCep(valor) {
  const d = String(valor || '').replace(/\D/g, '')
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (valor || '')
}

function paraIso(br) {
  const m = String(br || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
