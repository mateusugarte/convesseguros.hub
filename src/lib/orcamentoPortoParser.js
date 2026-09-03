// ─── Parser de cotacao — familia Porto Seguro ──────────────────────────
//
// COBRE QUATRO SEGURADORAS COM UM PARSER SO. Porto Seguro, Azul Seguros, Itau
// Seguros e Mitsui Sumitomo emitem o MESMO documento: mesmo CNPJ emissor
// (61.198.164/0001-60), mesmo numero raiz de orcamento variando so o sufixo
// (6065143265-0-2 Itau, -0-3 Mitsui, -0-4 Azul) e o mesmo cabecalho
// "Versao Condicoes Gerais: CGxxx / <MARCA> TRADICIONAL e PROTECAO COMBINADA".
// Azul e uma marca licenciada da Porto; o documento diz isso em letras miudas.
//
// A tabela de coberturas e lida por COORDENADA, nunca pelo texto plano — ver o
// cabecalho de `pdfLayout.js` para o caso medido em que o texto plano troca
// franquia por premio.
//
// O QUE ESTE MODULO NAO FAZ: nao inventa cobertura. Categoria que a cotacao nao
// menciona sai ausente, vira NAO_INFORMADO em `montarCategorias` e BLOQUEIA a
// geracao ate alguem confirmar. E o comportamento certo: as cotacoes desta
// familia so listam o que foi contratado, entao silencio aqui e mesmo silencio,
// nao ausencia de cobertura.

import { agruparLinhas, celulaEm, colunasPeloCabecalho, fatiar } from './pdfLayout.js'
import {
  criarCotacaoOrcamento, detectarTipoOperacao, extrairLimiteReboqueKm, humanizarCobertura,
} from './orcamentoComparativo.js'
import { valorAbaixoRotulo } from './orcamentoParserUtils.js'

export const CNPJ_EMISSOR_PORTO = '61.198.164/0001-60'

/**
 * Marcas que emitem por este layout.
 *
 * Os padroes abaixo NUNCA sao aplicados ao documento inteiro. Eles rodam apenas
 * sobre o valor de um campo rotulado (`Segmento`, cabecalho de Condicoes
 * Gerais), porque o documento inteiro cita as quatro marcas o tempo todo:
 * "APOLICE PORTO, ITAU OU AZUL CANCELADA" na origem do bonus, "Desconto
 * Correntista Itau" nos descontos, "Cartao Porto Bank" no parcelamento e o
 * rodape da Porto em todas as paginas. Foi essa varredura solta que fez uma
 * cotacao da Porto ser lida como Azul.
 */
// O fim da palavra usa `(?![\p{L}])` em vez de `\b`: `\b` e ASCII, e depois do
// "Ú" de ITAÚ nao existe fronteira ASCII nenhuma — `/\bITA[ÚU]\b/` nao casa com
// "ITAÚ TRADICIONAL". O inicio pode seguir com `\b` porque as quatro marcas
// comecam com letra ASCII.
export const MARCAS_PORTO = [
  { id: 'porto', nome: 'Porto Seguro', padrao: /\bPORTO(?![\p{L}])/iu },
  { id: 'azul', nome: 'Azul Seguros', padrao: /\bAZUL(?![\p{L}])/iu },
  { id: 'itau', nome: 'Itaú Seguros', padrao: /\bITA[ÚU](?![\p{L}])/iu },
  { id: 'mitsui', nome: 'Mitsui Sumitomo Seguros', padrao: /\bMITSUI(?![\p{L}])/iu },
]

const MARCAS = MARCAS_PORTO

export function marcaPortoPorId(id) {
  const alvo = String(id || '').trim().toLowerCase()
  return MARCAS_PORTO.find(marca => marca.id === alvo) || null
}

/**
 * Marca lida do valor de UM campo, e nao do documento.
 *
 * A ordem aqui e a mais especifica primeiro: o Segmento da Mitsui e "MITSUI
 * SUMITOMO SEGUROS" e o da Azul e "AZUL TRADICIONAL" — nenhum dos dois cita
 * outra marca, entao qualquer ordem serviria; manter a busca explicita evita
 * depender disso.
 */
function marcaEmCampo(valor) {
  const texto = String(valor || '')
  if (!texto.trim()) return null
  for (const marca of [...MARCAS_PORTO].reverse()) {
    if (marca.padrao.test(texto)) return marca
  }
  return null
}

// ─── Campos que identificam a marca ────────────────────────────────────
// Medidos nos PDFs reais de 25/08/2026 (fixtures `porto-familia.json`).
// Cada fonte le UM campo rotulado; nenhuma varre o documento.

/** "SEGURO Tipo de Operação SEGURO NOVO Segmento AZUL TRADICIONAL Sucursal" */
function marcaPeloSegmento(texto) {
  const campo = texto.match(/Segmento\s+(.{2,60}?)\s+Sucursal/i)
  return campo ? marcaEmCampo(campo[1]) : null
}

/** "Versão Condições Gerais: CG023 AZUL TRADICIONAL e PROTEÇÃO COMBINADA" */
function marcaPelasCondicoesGerais(texto) {
  const campo = texto.match(/Vers[ãa]o\s+Condi[çc][õo]es\s+Gerais:\s*CG\s*\d+\s+(.{2,60}?)\s+e\s+PROTE[ÇC][ÃA]O\s+COMBINADA/i)
  return campo ? marcaEmCampo(campo[1]) : null
}

// O codigo CG identifica o produto e, com ele, a marca. Medidos: CG023 Azul,
// CG024 Mitsui, CG071 Itau. O da Porto ainda nao foi capturado — por isso ele
// nao esta aqui, em vez de ser adivinhado.
const CODIGO_CG_POR_MARCA = { '023': 'azul', '024': 'mitsui', '071': 'itau' }

function marcaPeloCodigoCG(texto) {
  const campo = texto.match(/Vers[ãa]o\s+Condi[çc][õo]es\s+Gerais:\s*CG\s*(\d{2,4})/i)
  return campo ? marcaPortoPorId(CODIGO_CG_POR_MARCA[campo[1].padStart(3, '0')]) : null
}

// O numero do orcamento e o mesmo para as quatro marcas, mudando so o sufixo:
// a corretora pede um calculo e recebe as quatro variantes numeradas -0-1 a
// -0-4. Medidos: -0-2 Itau, -0-3 Mitsui, -0-4 Azul. O -0-1 e o unico membro da
// familia que sobra, mas segue como INFERENCIA ate um PDF da Porto confirmar —
// por isso esta fonte tem prioridade baixa e a escolha do operador vence.
const SUFIXO_ORCAMENTO_POR_MARCA = { 1: 'porto', 2: 'itau', 3: 'mitsui', 4: 'azul' }

function marcaPeloNumeroOrcamento(texto) {
  const campo = texto.match(/Or[çc]amento:\s*\d{4,}-\d+-(\d+)/i)
  return campo ? marcaPortoPorId(SUFIXO_ORCAMENTO_POR_MARCA[Number(campo[1])]) : null
}

/** "Azul Seguro Auto é uma marca licenciada para uso da Porto Seguro..." */
function marcaPelaMarcaLicenciada(texto) {
  const campo = texto.match(/([A-Za-zÀ-ú]{3,20})\s+Seguro\s+Auto\s+[ée]\s+uma\s+marca\s+licenciada/i)
  return campo ? marcaEmCampo(campo[1]) : null
}

/**
 * Titulo comercial impresso ao lado da logo no topo do orçamento.
 *
 * A Azul mostra as duas marcas ("Azul · operado pela Porto Seguro"), mas o
 * produto continua identificado como AZUL TRADICIONAL. A Porto mostra apenas
 * Porto Seguro e usa AUTO SENIOR. Esses nomes de produto são mais confiáveis
 * que o sufixo do número do orçamento, que já apareceu repetido entre marcas.
 */
function marcaPeloProdutoCabecalho(texto) {
  const t = String(texto || '')
  if (/\bAZUL\s+TRADICIONAL\s+e\s+PROTE[ÇC][ÃA]O\s+COMBINADA/i.test(t)) return marcaPortoPorId('azul')
  if (/\bAUTO\s+S[ÊE]NIOR\s+e\s+PROTE[ÇC][ÃA]O\s+COMBINADA/i.test(t)) return marcaPortoPorId('porto')
  return null
}

/**
 * Fontes em ordem de confianca. `Segmento` vem primeiro porque e o campo que a
 * propria Porto usa para dizer qual produto foi cotado.
 */
const FONTES_MARCA = [
  { id: 'produto_cabecalho', ler: marcaPeloProdutoCabecalho, confiavel: true },
  { id: 'segmento', ler: marcaPeloSegmento, confiavel: true },
  { id: 'condicoes_gerais', ler: marcaPelasCondicoesGerais, confiavel: true },
  { id: 'codigo_cg', ler: marcaPeloCodigoCG, confiavel: true },
  // O número e a frase de licenciamento ajudam em layouts antigos, mas não
  // podem contradizer o produto: Azul cita Porto como operadora e o sufixo do
  // número deixou de ser exclusivo por marca nos PDFs recebidos em 31/08/2026.
  { id: 'numero_orcamento', ler: marcaPeloNumeroOrcamento, confiavel: false },
  { id: 'marca_licenciada', ler: marcaPelaMarcaLicenciada, confiavel: false },
]

/**
 * Todas as evidencias de marca encontradas, por fonte.
 *
 * Existe separado de `detectarMarca` para que a divergencia entre campos vire
 * aviso na revisao em vez de escolha silenciosa: se o Segmento diz Porto e o
 * codigo CG diz Azul, alguem precisa olhar.
 */
export function evidenciasMarcaPorto(texto) {
  const t = String(texto || '')
  return FONTES_MARCA
    .map(fonte => ({ fonte: fonte.id, marca: fonte.ler(t), confiavel: fonte.confiavel }))
    .filter(item => item.marca)
}

export function detectarMarcaDetalhado(texto) {
  const evidencias = evidenciasMarcaPorto(texto)
  const confiaveis = evidencias.filter(item => item.confiavel)
  const consideradas = confiaveis.length ? confiaveis : evidencias
  const escolhida = consideradas[0] || null
  const divergentes = [...new Set(consideradas.map(item => item.marca.id))]

  return {
    marca: escolhida?.marca || null,
    fonte: escolhida?.fonte || null,
    evidencias,
    // Duas leituras confiaveis discordando e sinal de PDF fora do padrao —
    // ou de um campo que mudou de formato do lado da Porto.
    conflito: divergentes.length > 1 ? divergentes : null,
  }
}

const CABECALHO_TABELA = {
  lmi: 'LMI (indenização)',
  franquia: 'Franquia',
  variacao: 'Var. de Opcionais',
  depreciacao: 'Depreciação',
  premio: 'Valor do Prêmio',
}

/**
 * Reconhece se o documento e desta familia.
 *
 * Casa pelo CNPJ do emissor, nao pelo nome da marca: e o CNPJ que prova que o
 * PDF saiu do sistema da Porto. A marca sozinha enganaria — "Porto Seguro"
 * aparece dentro da cotacao da Azul, da Itau e da Mitsui.
 */
export function ehLayoutPorto(texto) {
  const t = String(texto || '')
  const cnpj = CNPJ_EMISSOR_PORTO.replace(/[^\d]/g, '')
  return t.replace(/[^\d]/g, '').includes(cnpj)
}

/**
 * Marca do documento.
 *
 * Quando nenhum campo aponta uma marca licenciada mas o layout e desta familia,
 * a resposta e Porto Seguro: a Porto e a dona do layout, e Azul, Itau e Mitsui
 * so aparecem aqui quando se anunciam em campo proprio. Antes desta versao a
 * funcao varria o documento inteiro, e como o rodape da Porto e as mencoes a
 * "AZUL"/"ITAU" existem em TODOS os PDFs da familia, uma cotacao da Porto podia
 * sair identificada como Azul.
 */
export function detectarMarca(texto) {
  const t = String(texto || '')
  const { marca } = detectarMarcaDetalhado(t)
  if (marca) return marca
  return ehLayoutPorto(t) ? marcaPortoPorId('porto') : null
}

// ─── Numeros ───────────────────────────────────────────────────────────

/** "R$ 3.600,00" -> 3600. Devolve null para "-", "" e qualquer coisa sem digito. */
export function moeda(texto) {
  const t = String(texto ?? '').trim()
  if (!t || t === '-' || t === '*') return null
  const m = t.match(/-?[\d.]+,\d{2}/)
  if (!m) return null
  const n = Number(m[0].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** "100.00%" -> 100. Aceita virgula tambem. */
export function percentual(texto) {
  const t = String(texto ?? '').trim()
  const m = t.match(/(-?[\d.,]+)\s*%/)
  if (!m) return null
  const n = Number(m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// ─── Tabela de coberturas ──────────────────────────────────────────────

// Linhas que aparecem na regiao da tabela mas nao sao cobertura de auto.
// "COBERTURAS RE" e o seguro residencial vendido junto — nao pertence ao
// comparativo de auto e entrar aqui poluiria o card com incendio de imovel.
const FIM_DA_TABELA_AUTO = 'COBERTURAS RE'

const RUIDO = [
  /^COBERTURAS/i, /^Descri[çc][ãa]o$/i, /^LMI/i, /^Franquia:/i, /^\*Franquias/i, /^CPF\/CNPJ/i,
  /^Impresso/i, /^Uso Interno/i, /^Orçamento/i, /^Processo SUSEP/i,
  /^Foram oferecidas/i, /^Em caso de indenização/i, /^Caso esta tabela/i,
  /^\d+ evento/i, /^Os serviços/i, /^Pag\./i, /^Versão Condições/i,
]

const ehRuido = texto => !texto || RUIDO.some(r => r.test(texto))

/**
 * Coberturas de AUTO com LMI, franquia e premio, lidas por coluna.
 *
 * @param linhas saida de `agruparLinhas`
 * @returns [{ nome_original_seguradora, valor_lmi, lmi_percentual, franquia, premio, incluida }]
 */
// Distancia maxima em Y para considerar que a linha de baixo e continuacao do
// nome da cobertura acima. Medido: as continuacoes reais caem a 12-13pt, e o
// paragrafo seguinte (nota de franquia) a 31pt. 16 separa os dois com folga.
const CONTINUACAO_MAX_Y = 16

export function extrairCoberturas(linhas) {
  // O gerador novo da Porto retirou as colunas "Var. de Opcionais" e
  // "Depreciação". LMI, franquia e prêmio continuam iguais; exigir as cinco
  // colunas fazia a tabela inteira desaparecer da revisão.
  const colunas = colunasPeloCabecalho(linhas, CABECALHO_TABELA)
    || colunasPeloCabecalho(linhas, {
      lmi: CABECALHO_TABELA.lmi,
      franquia: CABECALHO_TABELA.franquia,
      premio: CABECALHO_TABELA.premio,
    })
  if (!colunas) return []

  // So a parte de AUTO: da primeira linha "COBERTURAS" ate "COBERTURAS RE".
  const regiaoAntiga = fatiar(linhas, { de: 'COBERTURAS AUTO', ate: FIM_DA_TABELA_AUTO })
  const regiaoNova = fatiar(linhas, {
    de: 'Coberturas e serviços automóvel',
    ate: 'Coberturas e serviços residencial',
  })
  const regiao = regiaoAntiga.length ? regiaoAntiga : regiaoNova
  const fonte = regiao.length ? regiao : linhas

  // Uma cobertura ocupa TRES linhas no PDF desta familia:
  //
  //   Vidros                                              <- rotulo do grupo
  //   DANOS AOS VIDROS E RETROVISORES E  | ... | R$ 66,30  <- linha de dados
  //   FARÓIS E LANTERNAS - REFERENCIADA                    <- resto do nome
  //
  // Ler so a linha de dados devolvia o nome cortado no meio ("DANOS AOS VIDROS
  // E RETROVISORES E"), que e o texto que iria impresso no card do cliente.
  const coberturas = []
  let rotuloGrupo = ''
  let ultima = null
  let yUltima = 0

  for (const linha of fonte) {
    const primeira = linha.celulas[0]
    if (!primeira || primeira.x > colunas.lmi - 60) continue   // nome fica a esquerda

    const texto = primeira.texto
    const premio = moeda(celulaEm(linha, colunas.premio))

    if (premio == null) {
      // Linha sem valor: ou e o resto do nome da cobertura anterior, ou e o
      // rotulo do grupo da proxima. Quem decide e a distancia vertical.
      if (ehRuido(texto)) { ultima = null; continue }
      if (ultima && yUltima - linha.y <= CONTINUACAO_MAX_Y) {
        ultima.nome_original_seguradora += ` ${texto}`
        yUltima = linha.y
      } else {
        rotuloGrupo = texto
        ultima = null
      }
      continue
    }

    if (ehRuido(texto)) { ultima = null; continue }

    const lmiTexto = celulaEm(linha, colunas.lmi)
    ultima = {
      nome_original_seguradora: texto,
      nome_padronizado: '',
      grupo: rotuloGrupo,
      valor_lmi: moeda(lmiTexto),
      lmi_percentual: percentual(lmiTexto),
      franquia: moeda(celulaEm(linha, colunas.franquia)),
      franquia_tipo: celulaEm(linha, colunas.franquia).match(/\(([^)]+)\)/)?.[1]?.trim() || '',
      premio,
      incluida: true,
      observacoes: '',
    }
    yUltima = linha.y
    rotuloGrupo = ''
    coberturas.push(ultima)
  }

  // `observacoes` e o que vai IMPRESSO no card, e so pode ser montada AGORA:
  // o nome so esta completo depois que as linhas de continuacao foram juntadas
  // acima. Compor dentro do laco truncava o texto do cliente em "Danos aos
  // Vidros e Retrovisores e".
  for (const cobertura of coberturas) cobertura.observacoes = comporObservacao(cobertura)

  return coberturas
}

// ─── Campos fora da tabela ─────────────────────────────────────────────

/**
 * Indenizacao integral.
 *
 * O texto da familia Porto e sempre "Em caso de indenizacao integral, a mesma,
 * sera de 100.00% do valor do veiculo referencia da tabela FIPE". Quando a
 * frase nao aparece, devolve `incluida: null` — que BLOQUEIA a geracao. Nunca
 * assume `false`: a spec proibe deduzir cobertura, nos dois sentidos.
 */
export function extrairIndenizacaoIntegral(texto) {
  const t = String(texto || '')
  const m = t.match(/indeniza[çc][ãa]o\s+integral[^.]{0,80}?([\d.,]+)\s*%\s*do valor do ve[íi]culo/i)
  if (m) {
    return { incluida: true, percentual_fipe: percentual(`${m[1]}%`), observacao: '' }
  }
  return { incluida: null, percentual_fipe: null, observacao: '' }
}

/** "Franquia: 50% da Obrigatória" -> tipo textual da franquia do casco. */
export function extrairTipoFranquia(texto) {
  const t = String(texto || '')
  const rotulada = t.match(/Franquia:\s*([^\n]{1,60}?)(?:\s{2,}|\s+Vidros|\s+LMI|$)/i)
  if (rotulada) return rotulada[1].trim()
  // Layout atual põe o tipo entre parênteses junto do valor, sem repetir o
  // rótulo "Franquia" dentro da linha da cobertura compreensiva.
  return t.match(/R\$\s*[\d.]+,\d{2}\s*\(([^)]*(?:Obrigat[óo]ria|B[áa]sica|Reduzida)[^)]*)\)/i)?.[1]?.trim() || ''
}

/** Bloco "Prêmio Total Líquido: IOF: Prêmio Total: R$ a + R$ b R$ c". */
export function extrairValores(texto, linhas = []) {
  const t = String(texto || '')
  const m = t.match(/Pr[êe]mio Total L[íi]quido:\s*IOF:\s*Pr[êe]mio Total:\s*(R\$[\d.,\s]+)\+\s*(R\$[\d.,\s]+?)\s+(R\$[\d.,\s]+)/i)
  if (m) return { premio_liquido: moeda(m[1]), iof: moeda(m[2]), premio_total: moeda(m[3]) }

  // Layout JasperReports atual: cada rótulo e seu valor ficam na mesma linha.
  // O texto plano pode reordenar rótulos e números, então a coordenada é a
  // fonte principal e o regex abaixo fica apenas como contingência.
  const valorDaLinha = padrao => {
    const linha = linhas.find(item => padrao.test(item.texto))
    const celula = linha?.celulas.find(item => moeda(item.texto) != null)
    return moeda(celula?.texto)
  }
  const porLayout = {
    premio_liquido: valorDaLinha(/^Valor l[íi]quido\b/i),
    iof: valorDaLinha(/^IOF\b/i),
    premio_total: valorDaLinha(/^Valor total\b/i),
  }
  if (Object.values(porLayout).some(valor => valor != null)) return porLayout

  const novo = t.match(/Valor l[íi]quido\s+IOF\s+Valor total\s+(R\$\s*[\d.]+,\d{2})\s*\+\s*(R\$\s*[\d.]+,\d{2})\s+(R\$\s*[\d.]+,\d{2})/i)
  return novo
    ? { premio_liquido: moeda(novo[1]), iof: moeda(novo[2]), premio_total: moeda(novo[3]) }
    : { premio_liquido: null, iof: null, premio_total: null }
}

export function extrairDescontos(texto) {
  const t = String(texto || '')
  const i = t.search(/DESCONTOS APLICADOS NO OR[ÇC]AMENTO/i)
  if (i < 0) return []
  const trecho = t.slice(i, i + 700)
  return [...trecho.matchAll(/(Desconto[^:]{1,70}):\s*([\d.,]+)\s*%/gi)]
    .map(m => `${m[1].trim()}: ${m[2]}%`)
}

/**
 * Resume as formas de pagamento da familia Porto (Azul, Itau e Mitsui).
 *
 * Esses PDFs trazem tabelas extensas, com 12 colunas e varias bandeiras. O
 * comparativo precisa do que o cliente usa para decidir: maior parcelamento
 * sem juros no cartao comum e valor a vista no boleto. Antes o parser deixava
 * `premio_parcelado` vazio mesmo com as tabelas presentes no documento.
 */
export function extrairPagamento(texto, layout = []) {
  const t = String(texto || '').replace(/\s+/g, ' ')
  const resultado = []

  // No layout atual os cabeçalhos 1x..12x e os valores ficam em linhas
  // posicionadas. Usar essas coordenadas evita depender da ordem interna do
  // JasperReports, que intercala todas as parcelas antes dos valores.
  const cabecalhoCartao = layout.find(l => /CART[ÃA]O DE CR[ÉE]DITO\s*-\s*DEMAIS BANDEIRAS/i.test(l.texto))
  if (cabecalhoCartao) {
    const ateProximaTabela = layout.filter(l => (
      l.pagina === cabecalhoCartao.pagina
      && l.y < cabecalhoCartao.y
      && cabecalhoCartao.y - l.y <= 70
    ))
    const quantidades = ateProximaTabela.find(l => l.celulas.filter(c => /^\d{1,2}x$/i.test(c.texto.trim())).length >= 2)
    const valores = ateProximaTabela.find(l => l.celulas.filter(c => moeda(c.texto) != null).length >= 2)
    const disponiveis = (quantidades?.celulas || []).map(celula => {
      const n = Number(celula.texto.replace(/\D/g, ''))
      const valor = (valores?.celulas || [])
        .filter(item => moeda(item.texto) != null)
        .sort((a, b) => Math.abs(a.x - celula.x) - Math.abs(b.x - celula.x))[0]
      return { n, valor: moeda(valor?.texto), distancia: valor ? Math.abs(valor.x - celula.x) : Infinity }
    }).filter(item => item.valor != null && item.distancia <= 22)
    const ultima = disponiveis.sort((a, b) => b.n - a.n)[0]
    if (ultima) resultado.push(`Cartão de crédito: até ${ultima.n}x de ${moedaBR(ultima.valor)} sem juros`)
  }

  const cabecalhoBoleto = layout.find(l => /^BOLETO$/i.test(l.texto.trim()))
  if (cabecalhoBoleto) {
    const linha = layout.find(l => (
      l.pagina === cabecalhoBoleto.pagina
      && l.y < cabecalhoBoleto.y
      && cabecalhoBoleto.y - l.y <= 35
      && /[ÀA]\s*vista/i.test(l.texto)
    ))
    const valor = linha?.celulas.find(c => moeda(c.texto) != null)
    if (valor) resultado.push(`Boleto: à vista ${moedaBR(moeda(valor.texto))}`)
  }

  if (resultado.length) return resultado

  const inicioCartao = t.search(/CART[ÃA]O DE CR[ÉE]DITO\s*-\s*DEMAIS BANDEIRAS/i)
  if (inicioCartao >= 0) {
    const trecho = t.slice(inicioCartao, inicioCartao + 1800)
    const fim = trecho.search(/TODAS\s+D[ÉE]BITO|D[ÉE]BITO C\. CORRENTE/i)
    const tabela = trecho.slice(0, fim > 0 ? fim : trecho.length)
    const semJuros = [...tabela.matchAll(/R\$\s*([\d.]+,\d{2})\s*\(s\/juros[^)]*\)/gi)]
    if (semJuros.length) {
      const ultima = semJuros.at(-1)
      resultado.push(`Cartão de crédito: até ${semJuros.length}x de ${moedaBR(moeda(ultima[1]))} sem juros`)
    }
  }

  const boleto = t.match(/Boleto\s+[ÀA]\s*vista\s*(R\$\s*[\d.]+,\d{2})\s*\(s\/juros\)/i)
  if (boleto) resultado.push(`Boleto: à vista ${moedaBR(moeda(boleto[1]))}`)

  return resultado
}

// Cada seguradora da familia batiza a assistencia 24h de um jeito e nenhuma
// delas usa sempre a palavra "assistencia":
//
//   Azul   -> "ASSISTÊNCIA GRATUITA - 200 KM"
//   Itaú   -> "ITAÚ ESSENCIAL 600 KM"
//   Mitsui -> "34 - REDE REFERENCIADA - 400KM"
//
// O que os tres tem em comum e a quilometragem de reboque, que e exatamente o
// que a assistencia 24h e nesta familia. Itens sem KM ("EXTENSÃO DE PERÍMETRO
// BÁSICO", "COLETA DE DOCUMENTOS") sao beneficio, nao assistencia — e caem em
// `servicos`, onde aparecem na linha "Beneficios adicionais" do card.
const PADRAO_ASSISTENCIA = /ASSIST[ÊE]NCIA|\d+\s*KM\b/i

/** Assistencia e beneficios do bloco "COBERTURAS ADICIONAIS, SERVICOS E BENEFICIOS". */
export function extrairAdicionais(texto) {
  const t = String(texto || '')
  const cabecalho = t.match(/COBERTURAS ADICIONAIS, SERVI[ÇC]OS E BENEF[ÍI]CIOS/i)
  if (!cabecalho) {
    const atual = t.match(/Assist[êe]ncias\s+Descri[çc][ãa]o\s+Valor do Pr[êe]mio\s+(.{5,180}?)(?:\s+Gratuita|\s+Servi[çc]os adicionais)/i)
    if (!atual) return { assistencias: [], servicos: [] }
    const nome = atual[1].replace(/\s+/g, ' ').trim()
    return {
      assistencias: nome ? [{ tipo: nome, incluida: true, detalhes: nome }] : [],
      servicos: [],
    }
  }

  // Recorta DEPOIS do cabecalho e ANTES do bloco de descontos. Sem os dois
  // limites o proprio titulo da secao entrava na lista como se fosse item.
  const inicio = cabecalho.index + cabecalho[0].length
  const fim = t.slice(inicio).search(/DESCONTOS APLICADOS|FORMAS DE PAGAMENTO|CL[ÁA]USULAS/i)
  const trecho = t.slice(inicio, fim >= 0 ? inicio + fim : inicio + 600)

  const assistencias = []
  const servicos = []
  // Os itens vem como "<NOME> Gratuita". Cortar em toda ocorrencia da palavra
  // nao serve: a Azul chama a assistencia de "ASSISTÊNCIA GRATUITA - 200 KM",
  // e o corte ingenuo partia o item em "ASSISTÊNCIA" + "- 200 KM". O marcador
  // so vale quando esta no FIM do item — ou seja, seguido do inicio do proximo
  // (letra ou digito) ou do fim do trecho.
  const ITEM = /(.+?)\s+(?:Gratuita|Contratada|Inclusa)(?=\s+[A-ZÀ-Ü0-9]|\s*$)/gi
  for (const m of trecho.matchAll(ITEM)) {
    const nome = m[1].replace(/\s+/g, ' ').trim()
    if (!nome || nome.length < 4) continue
    if (PADRAO_ASSISTENCIA.test(nome)) assistencias.push({ tipo: nome, incluida: true, detalhes: nome })
    else servicos.push(nome)
  }
  return { assistencias, servicos }
}

function enriquecerVidrosPorto(coberturas, linhas) {
  const vidros = coberturas.find(c => /vidros/i.test(c.nome_original_seguradora))
  if (!vidros) return
  const inicio = linhas.find(l => l.celulas.some(c => /^Franquias:$/i.test(c.texto.trim())))
  if (!inicio) return
  const detalhes = linhas
    .filter(l => l.pagina === inicio.pagina && l.y <= inicio.y && inicio.y - l.y <= 30)
    .flatMap(l => l.celulas.map(c => c.texto))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (detalhes) vidros.observacoes = `${humanizar(vidros.nome_original_seguradora)} — ${detalhes}`
}

// ─── Montagem ──────────────────────────────────────────────────────────

/**
 * Cotacao no schema da secao 5, a partir do layout posicionado + texto plano.
 *
 * O texto plano ainda serve para campo solto (frase corrida, bloco de valores);
 * o que exige coluna vem do layout. Os dois vem do MESMO PDF, entao nao ha
 * risco de misturar documentos.
 *
 * `seguradoraMeta` vem do cadastro: logo e cor SEMPRE do cadastro, nunca do PDF.
 */
export function parseCotacaoPorto({ itens = [], texto = '', marca_id: marcaId = '', seguradoraMeta = null } = {}) {
  const linhas = agruparLinhas(itens)
  const p1 = linhas.filter(l => l.pagina === 1)
  const daGrade = (rotulo, ocorrencia = 0) => valorAbaixoRotulo(p1, rotulo, {
    ocorrencia, maxY: 45, maxX: 130,
  })
  // A marca escolhida pelo operador VENCE a deteccao, mesma regra que ja vale
  // para `parser_id` contra a deteccao de layout: quem esta com o PDF na tela
  // sabe de qual das quatro empresas ele e. A deteccao continua rodando para
  // apontar divergencia na revisao.
  const escolhida = marcaPortoPorId(marcaId)
  const detectada = detectarMarcaDetalhado(texto)
  const marca = escolhida || detectada.marca || (ehLayoutPorto(texto) ? marcaPortoPorId('porto') : null)
  const cot = criarCotacaoOrcamento()

  cot.seguradora = {
    id: seguradoraMeta?.id ?? null,
    nome: seguradoraMeta?.nome_canonico || marca?.nome || '',
    logo_url: seguradoraMeta?.logo_url || '',
    cor_destaque: seguradoraMeta?.cor_destaque || '',
  }
  cot.marca_detectada = detectada.marca?.id || null
  cot.avisos_extracao = avisosDaMarca({ escolhida, detectada })

  const numero = texto.match(/Or[çc]amento:\s*([\d-]+)/i)
  const validade = texto.match(/Or[çc]amento v[áa]lido[\s\S]{0,60}?(\d{2}\/\d{2}\/\d{4})/i)
  const emissao = texto.match(/Realizado em\s*(\d{2}\/\d{2}\/\d{4})/i)
  const operacao = texto.match(/Tipo de Opera[çc][ãa]o\s+([A-ZÀ-Ü\s]{3,40}?)\s+Segmento/i)
  const operacaoGrade = daGrade('Tipo de Operação')

  cot.cotacao = {
    numero: numero?.[1] || daGrade('Orçamento'),
    tipo_operacao: detectarTipoOperacao(operacao?.[1] || operacaoGrade || texto) || '',
    validade: paraIso(validade?.[1] || daGrade('Validade')),
    data_emissao: paraIso(emissao?.[1] || daGrade('Realizado')),
  }

  const cg = texto.match(/Vers[ãa]o Condi[çc][õo]es Gerais:\s*([A-Z0-9]+)/i)
  if (cg) cot.condicoes_gerais = { referencia: `${cot.seguradora.nome} ${cg[1]}`.trim(), anexada_em: '' }

  const condutor = texto.match(/Nome do principal Condutor:\s*([^:]{3,60}?)\s+CPF:/i)
  const cpfCondutor = texto.match(/Nome do principal Condutor:[\s\S]{0,80}?CPF:\s*([\d.\-]{11,18})/i)
  cot.condutor_principal = {
    nome: condutor?.[1]?.trim() || daGrade('Condutor'),
    cpf: cpfCondutor?.[1] || daGrade('CPF', 1),
    estado_civil: null,
  }

  const segurado = texto.match(/PROPONENTE\s+([A-ZÀ-Ü][A-ZÀ-Ü\s]{5,60}?)\s+\d{2}\/\d{2}\/\d{4}/)
  const cpfSegurado = texto.match(/PROPONENTE[\s\S]{0,90}?(\d{3}\.\d{3}\.\d{3}-\d{2})/)
  cot.segurado = {
    nome: segurado?.[1]?.trim() || daGrade('Segurado(a)'),
    cpf_cnpj: cpfSegurado?.[1] || daGrade('CPF'),
    data_nascimento: paraIso(daGrade('Nascimento')) || null,
  }

  const placa = texto.match(/Placa\s+Chassi\s+([A-Z0-9]{7})/i)
  const cep = texto.match(/CEP PERNOITE:\s*([\d-]{8,10})/i)
  const uso = texto.match(/Tipo do Uso:\s*([A-ZÀ-Ü\s]{3,30}?)\s+(?:Possui|Seguro)/i)
  const veiculo = texto.match(/Ano Fabrica[çc][ãa]o \/ Modelo[\s\S]{0,40}?-\s*-\s*([A-Z0-9][^\n]{4,50}?)\s+(\d{4})\s*\/\s*(\d{4})/i)
  const veiculoGrade = daGrade('Veículo', 1).replace(/^\d+\s*-\s*-\s*/, '').trim()
  const anoGrade = daGrade('Ano Fabricação / Modelo')

  cot.veiculo = {
    marca_modelo: veiculo?.[1]?.trim() || veiculoGrade,
    ano_modelo: veiculo ? `${veiculo[2]}/${veiculo[3]}` : anoGrade,
    placa: placa?.[1] || daGrade('Placa'),
    uso: capitalizar(uso?.[1]?.trim() || daGrade('Tipo de uso')),
    cep_pernoite: cep?.[1] || daGrade('CEP de pernoite'),
    condutor_18_25: null,
  }

  const vig = texto.match(/Vig[êe]ncia\s*(\d{2}\/\d{2}\/\d{4})\s*at[ée]\s*(\d{2}\/\d{2}\/\d{4})/i)
  cot.vigencia = { inicio: paraIso(vig?.[1]), fim: paraIso(vig?.[2]) }

  const coberturas = extrairCoberturas(linhas)
  enriquecerVidrosPorto(coberturas, linhas)
  const casco = coberturas.find(c => /casco|compreensiva/i.test(c.nome_original_seguradora))

  cot.valores = {
    ...extrairValores(texto, linhas),
    premio_parcelado: extrairPagamento(texto, linhas),
    descontos_aplicados: extrairDescontos(texto),
    franquia: casco?.franquia ?? null,
    franquia_tipo: extrairTipoFranquia(texto) || casco?.franquia_tipo || '',
  }

  const indenizacaoTexto = extrairIndenizacaoIntegral(texto)
  cot.indenizacao_integral = indenizacaoTexto.incluida != null
    ? indenizacaoTexto
    : casco?.lmi_percentual != null
      ? { incluida: true, percentual_fipe: casco.lmi_percentual, observacao: '' }
      : indenizacaoTexto
  cot.coberturas = coberturas

  const adicionais = extrairAdicionais(texto)
  cot.assistencias = adicionais.assistencias
  cot.servicos_adicionais = adicionais.servicos
  cot.assistencia_24h = {
    limite_reboque_km: extrairLimiteReboqueKm(
      ...adicionais.assistencias.flatMap(item => [item.tipo, item.detalhes]),
    ),
  }

  return cot
}

/** "RCF-V DANOS CORPORAIS" + LMI 100000 -> "RCF-V Danos Corporais: R$ 100.000,00". */
export function comporObservacao(cobertura) {
  const nome = humanizar(cobertura?.nome_original_seguradora)
  const lmi = cobertura?.valor_lmi
  if (lmi != null) return `${nome}: ${moedaBR(lmi)}`
  return nome
}

// Reexportado para nao quebrar quem ja importa daqui; a implementacao vive
// em `orcamentoComparativo.js` porque os parsers de HDI e Porto usam a mesma.
export const humanizar = humanizarCobertura

function moedaBR(valor) {
  return `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Avisos sobre a identificacao da marca.
 *
 * Nenhum deles bloqueia a geracao: a marca escolhida pelo operador manda, e o
 * aviso existe para ele CONFERIR, nao para travar. O caso que interessa e o
 * silencioso — escolher Porto e o PDF anunciar Azul em campo proprio significa
 * que o arquivo errado foi anexado naquele lado.
 */
function avisosDaMarca({ escolhida, detectada }) {
  const avisos = []

  if (escolhida && detectada.marca && detectada.marca.id !== escolhida.id) {
    avisos.push({
      code: 'MARCA_DIVERGENTE',
      mensagem: `Você selecionou ${escolhida.nome}, mas o PDF se identifica como ${detectada.marca.nome} (campo ${detectada.fonte}). Confirme se o arquivo anexado é o certo.`,
      bloqueia: false,
    })
  }

  if (detectada.conflito) {
    const nomes = detectada.conflito.map(id => marcaPortoPorId(id)?.nome || id).join(' e ')
    avisos.push({
      code: 'MARCA_AMBIGUA',
      mensagem: `Os campos deste PDF apontam marcas diferentes (${nomes}). Confirme a seguradora antes de gerar o orçamento.`,
      bloqueia: false,
    })
  }

  if (!escolhida && !detectada.marca) {
    avisos.push({
      code: 'MARCA_NAO_IDENTIFICADA',
      mensagem: 'Nenhum campo deste PDF identifica a marca. Selecione a seguradora certa (Porto, Azul, Itaú ou Mitsui) antes de gerar o orçamento.',
      bloqueia: false,
    })
  }

  return avisos
}

function paraIso(br) {
  const m = String(br || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

function capitalizar(texto) {
  const t = String(texto || '').toLowerCase().trim()
  return t ? t[0].toUpperCase() + t.slice(1) : ''
}
