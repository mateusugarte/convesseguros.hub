/**
 * Modelo de dominio do Orcamento Comparativo (setor AUTO).
 *
 * Este modulo e puro: nao importa Supabase, nao importa pdfjs, nao toca no DOM.
 * Roda em `node --test` sem shim, igual a `autoPdfMapeamento.js`. Toda a leitura
 * de PDF, o acesso ao catalogo de seguradoras e a geracao do PDF final ficam nas
 * camadas de fora, consumindo as estruturas daqui.
 *
 * Por que um modulo separado em vez de estender `autoPdfCampos.js`:
 * o parser de PDF existente extrai campos ESCALARES de uma cotacao (premio,
 * placa, vigencia) para preencher formulario de emissao. O comparativo precisa
 * de uma estrutura COMPARAVEL entre duas seguradoras — uma lista de coberturas
 * classificadas em categorias fixas, com o que cada uma inclui e o que nao
 * inclui. Sao dois problemas diferentes sobre o mesmo PDF; misturar os dois
 * transformaria `CAMPOS_COTACAO` numa lista impossivel de manter.
 *
 * REGRA CRITICA DE EXATIDAO (spec secao 9): nada aqui deduz cobertura. Se a
 * cotacao nao disser explicitamente que a indenizacao integral esta incluida, o
 * campo fica `null` e a tela de revisao obriga o corretor a responder. Um
 * comparativo que "chuta" cobertura a favor da seguradora e pior do que nao
 * existir — o cliente recebe promessa que a apolice nao cumpre.
 */

// ─── Categorias fixas de cobertura ─────────────────────────────────────
//
// Ordem, rotulo e icone sao FIXOS e iguais para todas as seguradoras. O que
// muda entre uma cotacao e outra e so o conteudo de cada categoria. Isso e o
// que permite ler os dois cards lado a lado sem comparar textos de marketing
// escritos de formas diferentes por cada cia.

export const CATEGORIAS_COBERTURA = [
  { key: 'colisao',       label: 'Colisão, incêndio, roubo e furto', icone: 'shield' },
  { key: 'terceiros',     label: 'Danos a terceiros (RCF-V)',        icone: 'users'  },
  { key: 'assistencia',   label: 'Assistência 24 horas',             icone: 'clock'  },
  { key: 'carro_reserva', label: 'Carro reserva',                    icone: 'car'    },
  { key: 'franquia',      label: 'Franquia',                         icone: 'percent'},
  { key: 'vidros',        label: 'Vidros',                           icone: 'grid'   },
  { key: 'adicional',     label: 'Benefícios adicionais',            icone: 'gift'   },
]

export const CATEGORIA_KEYS = CATEGORIAS_COBERTURA.map(c => c.key)

/** A categoria "adicional" so aparece quando tem conteudo (spec secao 9, item 7). */
export const CATEGORIA_OPCIONAL = 'adicional'

export function metaCategoria(key) {
  return CATEGORIAS_COBERTURA.find(c => c.key === key) || null
}

// ─── Normalizacao de texto ─────────────────────────────────────────────

/**
 * Minusculas, sem acento, espacos colapsados.
 *
 * O range dos combinantes esta escapado de proposito (`[̀-ͯ]`). A
 * versao com os caracteres literais ja se corrompeu uma vez neste projeto — no
 * Code Node do n8n, onde viraram `?` e o range passou a apagar todas as letras.
 * Mesma decisao de `fichasConciliacao.js`.
 */
export function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Siglas do ramo que precisam continuar em caixa alta quando o nome cru da
// seguradora, que vem em CAIXA ALTA, e convertido para o documento do cliente.
// Lista explicita em vez de regra por tamanho: "RCF-V" tem 4 letras e "DANOS"
// tem 5, entao qualquer limite de comprimento erra um dos dois — e errar
// produzia "Rcf-v Danos Corporais" impresso para o cliente.
const SIGLAS_RAMO = new Set(['RCF', 'RCF-V', 'RCFV', 'LMI', 'IOF', 'APP', 'DPVAT', 'RE', 'KM', 'CG', 'SUSEP', 'CR', 'HDI'])

const PALAVRAS_MINUSCULAS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'ao', 'aos',
  'em', 'ou', 'no', 'na', 'nos', 'nas', 'com', 'por', 'para',
])

/**
 * Nome de cobertura em caixa alta -> caixa mista legivel.
 *
 * Compartilhado pelos parsers porque toda seguradora imprime o nome da
 * cobertura em caixa alta e o comparativo vai para o cliente. Nome que ja vem
 * em caixa mista fica como esta: foi a seguradora que escolheu assim.
 */
export function humanizarCobertura(texto) {
  const t = String(texto || '').trim().replace(/\s+/g, ' ')
  if (!t || t !== t.toUpperCase()) return t

  return t.split(' ').map((palavra, i) => {
    const nu = palavra.replace(/[^A-Za-zÀ-Ü0-9-]/g, '')
    if (!nu) return palavra
    if (SIGLAS_RAMO.has(nu.toUpperCase())) return nu.toUpperCase()
    if (!/[A-Za-zÀ-Ü]/.test(nu)) return palavra
    const min = palavra.toLowerCase()
    if (i > 0 && PALAVRAS_MINUSCULAS.has(min)) return min
    return min[0].toUpperCase() + min.slice(1)
  }).join(' ')
}

// ─── Dicionario de equivalencia de coberturas ──────────────────────────
//
// Spec secao 4: seguradoras diferentes nomeiam a mesma cobertura de formas
// diferentes ("Assistencia 24h" x "SOS Automovel" x "Guincho"). Sem o
// dicionario, a comparacao por cobertura fica inconsistente.
//
// O casamento e por SUBSTRING do nome normalizado, na ordem em que os termos
// aparecem aqui — o primeiro termo que casar decide a categoria. Por isso a
// ordem importa: termos mais especificos vem antes dos genericos. Ex.: "vidros"
// precisa ser testado antes de "casco", senao "casco + vidros" cairia em
// colisao e a franquia por peca sumiria do card.
//
// Ao cadastrar uma seguradora nova, o esperado e SO acrescentar sinonimos aqui
// — nunca criar categoria nova nem alterar a ordem das 7 existentes.

export const DICIONARIO_COBERTURAS = [
  { categoria: 'vidros', termos: [
    'vidros', 'vidro', 'para-brisa', 'para brisa', 'parabrisa',
    'retrovisor', 'lanterna', 'farol', 'farois',
  ] },
  { categoria: 'carro_reserva', termos: [
    'carro reserva', 'veiculo reserva', 'carro substituto', 'veiculo substituto',
    'mobilidade', 'diarias de carro',
  ] },
  { categoria: 'assistencia', termos: [
    'assistencia 24', 'assistencia24', 'assistencia', 'sos automovel', 'sos auto',
    'guincho', 'reboque', 'socorro', 'pane seca', 'chaveiro', 'auxilio',
  ] },
  { categoria: 'franquia', termos: [
    'franquia', 'participacao obrigatoria',
  ] },
  { categoria: 'terceiros', termos: [
    'rcf-v', 'rcf v', 'rcfv', 'responsabilidade civil', 'danos a terceiros',
    'danos materiais', 'danos corporais', 'danos morais',
    // A familia Porto escreve "CUSTOS DE DEFESA AUTO"; o mockup trazia "custas
    // de defesa". Sem as duas grafias o item caia em "Beneficios adicionais",
    // como se defesa juridica fosse um mimo, e nao cobertura de terceiros.
    'custas de defesa', 'custos de defesa',
    'terceiros',
  ] },
  { categoria: 'colisao', termos: [
    'colisao', 'incendio', 'roubo', 'furto', 'casco', 'compreensiva',
    'compreensivo', 'valor referenciado', 'valor de mercado', 'fipe',
    'indenizacao integral', 'perda total', 'danos ao veiculo',
  ] },
  { categoria: 'adicional', termos: [
    'leva e traz', 'leva-e-traz', 'residencia', 'lampada', 'pneu',
    'desconto na franquia', 'clube', 'beneficio', 'servicos gratuitos',
    'rede propria', 'oficina',
    // Acidentes Pessoais de Passageiros. Nao tem categoria propria entre as 7,
    // e "adicional" e onde ela pertence — mas precisa estar AQUI, e nao cair no
    // balde por falta de classificacao: cobertura que cai por omissao dispara
    // o aviso de "nao classificada", e um aviso que sempre aparece deixa de
    // ser lido. Ver `validarCotacao`.
    'app morte', 'app invalidez', 'acidentes pessoais', 'app ',
  ] },
]

/**
 * Classifica um nome de cobertura numa das 7 categorias fixas.
 *
 * Devolve `null` quando nao reconhece — e `null` e uma resposta legitima, nao um
 * erro: a tela de revisao mostra o item como "nao classificado" para o corretor
 * decidir. Forcar tudo numa categoria seria exatamente o "inventar ou aproximar"
 * que a spec proibe.
 */
export function classificarCobertura(nome) {
  const alvo = normalizarTexto(nome)
  if (!alvo) return null
  for (const { categoria, termos } of DICIONARIO_COBERTURAS) {
    if (termos.some(termo => alvo.includes(termo))) return categoria
  }
  return null
}

// ─── Schema da cotacao (spec secao 5) ──────────────────────────────────

export function criarCoberturaVazia(patch = {}) {
  return {
    nome_padronizado: '',
    nome_original_seguradora: '',
    categoria: null,
    incluida: null,          // null = nao informado (obriga revisao humana)
    valor_lmi: null,
    observacoes: '',
    ...patch,
  }
}

export function criarCotacaoOrcamento(patch = {}) {
  return {
    seguradora: { id: null, nome: '', logo_url: '', cor_destaque: '' },
    cotacao: { numero: '', tipo_operacao: '', validade: '', data_emissao: '' },
    segurado: { nome: '', cpf_cnpj: '', data_nascimento: null },
    condutor_principal: { nome: '', cpf: '', estado_civil: null },
    veiculo: {
      marca_modelo: '', ano_modelo: '', placa: '', uso: '',
      cep_pernoite: '', condutor_18_25: null,
    },
    assistencia_24h: {
      limite_reboque_km: null,
    },
    vigencia: { inicio: '', fim: '' },
    valores: {
      premio_liquido: null, iof: null, premio_total: null,
      premio_parcelado: '', descontos_aplicados: [],
      franquia: null, franquia_tipo: '',
    },
    // Fato critico e explicito — nunca derivado do texto das coberturas.
    // `null` = o corretor ainda nao confirmou; a revisao trava nisso.
    indenizacao_integral: { incluida: null, percentual_fipe: null, observacao: '' },
    // Preenchido pelo parser quando o PDF cota MAIS DE UM produto e nao diz qual
    // vale — a cotacao Allianz traz seis ofertas, a HDI traz duas modalidades.
    // `{ campo, label, opcoes }`. Enquanto estiver setado, a geracao trava: o
    // premio e as coberturas mudam de opcao para opcao, e escolher por conta
    // propria poria numero errado num documento que vai para o cliente.
    escolha_pendente: null,
    coberturas: [],
    assistencias: [],
    servicos_adicionais: [],
    nao_incluso: [],
    condicoes_gerais: { referencia: '', anexada_em: '' },
    ...patch,
  }
}

export const TIPOS_OPERACAO = [
  { value: 'novo',      label: 'Seguro Novo' },
  { value: 'renovacao', label: 'Renovação'   },
  { value: 'endosso',   label: 'Endosso'     },
]

/**
 * Reconhece o tipo de operacao a partir do texto livre da cotacao.
 *
 * Os PDFs reais escrevem isso de formas bem diferentes: a Tokio manda
 * "Renovacao Congenere", a Porto manda "RENOVACAO DA CIA". Ambas sao renovacao.
 * Retorna `null` quando nao reconhece — a spec (secao 5) exige que o corretor
 * SEMPRE confirme esse campo na revisao, entao null nao trava nada, so deixa o
 * campo em branco em vez de chutar.
 */
export function detectarTipoOperacao(texto) {
  const alvo = normalizarTexto(texto)
  if (!alvo) return null
  if (alvo.includes('endosso')) return 'endosso'
  if (alvo.includes('renovacao') || alvo.includes('renovado')) return 'renovacao'
  if (alvo.includes('seguro novo') || alvo.includes('novo')) return 'novo'
  return null
}

export function rotuloTipoOperacao(valor) {
  return TIPOS_OPERACAO.find(t => t.value === valor)?.label || ''
}

// ─── Cores de destaque por seguradora ──────────────────────────────────
//
// A spec (secao 3 e 9) pede uma cor por seguradora, salva junto com o logo. A
// tabela `seguradoras` ainda nao tem essa coluna — a migration 67 acrescenta
// `cor_destaque`. Ate ela rodar (e para seguradora cadastrada sem cor), este
// mapa responde pelo nome canonico, e `CORES_FALLBACK` responde pelo papel.
//
// Os hex de Tokio e Porto foram amostrados do proprio mockup ja validado, nao
// escolhidos a olho: #956e26 e #1b4782.

export const CORES_SEGURADORA_PADRAO = {
  'tokio marine': '#956e26',
  'tokio marine seguradora': '#956e26',
  'porto seguro': '#1b4782',
  'azul seguros': '#0a58ca',
  'itau': '#ec7000',
  'itau seguros': '#ec7000',
  'allianz': '#003781',
  'bradesco': '#cc092f',
  'bradesco seguros': '#cc092f',
  'hdi': '#00723f',
  'hdi seguros': '#00723f',
  'liberty': '#ffd400',
  'mapfre': '#d3122a',
  'suhai': '#6b2fa0',
  'zurich': '#0d47a1',
  'sompo': '#c8102e',
  'aliro': '#12405f',
  'sulamerica': '#e30613',
  'sul america': '#e30613',
  'yelum': '#00a0af',
  'yelum seguros': '#00a0af',
  // Amostrada da logo embutida no proprio PDF de cotacao (25/08/2026): o azul
  // marinho aparece com o vermelho #e00010 como cor secundaria da marca.
  'mitsui': '#201060',
  'mitsui sumitomo': '#201060',
  'mitsui sumitomo seguros': '#201060',
  // PROVISORIAS. O usuario informou em 25/08 que as duas marcas sao rosa, mas a
  // logo de nenhuma das duas pode ser amostrada: no PDF de cotacao ela e
  // vetorial, e o cadastro nao e legivel fora do app. Os dois hex abaixo foram
  // escolhidos DENTRO do rosa e deliberadamente afastados um do outro, para que
  // um comparativo Darwin x Pier continue legivel enquanto a cor real nao chega.
  // Substituir por `seguradoras.cor_destaque` assim que o hex real for definido.
  'darwin': '#c2185b',
  'darwin seguros': '#c2185b',
  'pier': '#ff4d8d',
  'pier seguros': '#ff4d8d',
}

/** Papel no comparativo quando a seguradora nao tem cor propria cadastrada. */
export const CORES_FALLBACK = { atual: '#956e26', outra: '#1b4782' }

export const TINTA = '#101f33'

// Chaves ordenadas da mais longa para a mais curta: "mitsui sumitomo seguros"
// precisa ser testada antes de "mitsui", senao a chave curta vence e uma
// eventual divergencia de cor entre as duas passaria despercebida.
const CHAVES_COR_POR_TAMANHO = Object.keys(CORES_SEGURADORA_PADRAO)
  .sort((a, b) => b.length - a.length)

/**
 * Cor de destaque da seguradora.
 *
 * Precedencia: `cor_destaque` do cadastro > mapa por nome > fallback por papel.
 *
 * O casamento pelo mapa NAO e por igualdade exata de proposito. O nome vem de
 * `seguradoras.nome_canonico`, que carrega razao social ("Mitsui Sumitomo
 * Seguros S.A.", "Bradesco Auto/RE Companhia de Seguros"). Com igualdade exata
 * esses nomes nao casavam e a cor caia no fallback por PAPEL — ou seja,
 * inverter "atual" e "outra" trocava a cor da seguradora, exatamente o que a
 * regra do modulo proibe. E um erro silencioso: sai um PDF com cor plausivel,
 * so que errada. Por isso: exato primeiro, depois a chave mais longa contida
 * no nome.
 */
export function corDaSeguradora(seguradora, papel = 'atual') {
  const explicita = String(seguradora?.cor_destaque || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(explicita)) return explicita.toLowerCase()

  const nome = normalizarTexto(seguradora?.nome)
  if (!nome) return CORES_FALLBACK[papel] || CORES_FALLBACK.atual

  const exata = CORES_SEGURADORA_PADRAO[nome]
  if (exata) return exata

  const contida = CHAVES_COR_POR_TAMANHO.find(chave => nome.includes(chave))
  return (contida && CORES_SEGURADORA_PADRAO[contida])
    || CORES_FALLBACK[papel]
    || CORES_FALLBACK.atual
}

/**
 * Casa o nome que o parser leu do PDF com o cadastro de `seguradoras`.
 *
 * Existe porque a igualdade exata NAO serve, pelo mesmo motivo ja documentado em
 * `corDaSeguradora`: o cadastro guarda razao social ("HDI SEGUROS S.A.",
 * "Bradesco Auto/RE Companhia de Seguros") e o parser entrega o nome comercial
 * ("HDI Seguros"). Sem a tolerancia, nenhuma logo era encontrada e todo card
 * caia no nome em serifada — que era o "a logo nao vai no PDF".
 *
 * Ordem: igualdade exata, depois alias exato, depois o nome cadastrado mais
 * LONGO que esteja contido no outro (nos dois sentidos). O mais longo primeiro
 * evita que "Itau Seguros" case com um cadastro generico "Seguros".
 */
export function casarSeguradora(catalogo = [], nome) {
  const alvo = normalizarTexto(nome)
  if (!alvo) return null

  const lista = (catalogo || []).filter(Boolean)
  const exata = lista.find(seg => normalizarTexto(seg.nome_canonico) === alvo)
  if (exata) return exata

  const porAlias = lista.find(seg => (seg.aliases || []).some(a => normalizarTexto(a) === alvo))
  if (porAlias) return porAlias

  const candidatos = lista
    .map(seg => ({ seg, chave: normalizarTexto(seg.nome_canonico) }))
    .filter(({ chave }) => chave && (alvo.includes(chave) || chave.includes(alvo)))
    .sort((a, b) => b.chave.length - a.chave.length)

  return candidatos[0]?.seg || null
}

function hexParaRgb(hex) {
  const h = String(hex).replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
}

/**
 * Tom claro da cor da seguradora, usado no numerao dentro da caixa escura.
 *
 * No mockup o valor da Tokio sai #f0d59e e o da Porto #bcd3f2 — os dois sao a
 * cor da cia clareada contra o navy. Derivar em vez de cadastrar duas cores por
 * seguradora mantem o cadastro com um campo so.
 */
export function tomClaro(hex, forca = 0.72) {
  const [r, g, b] = hexParaRgb(hex)
  const mix = c => Math.round(c + (255 - c) * forca)
  return `#${[mix(r), mix(g), mix(b)].map(c => c.toString(16).padStart(2, '0')).join('')}`
}

/** Preto ou branco conforme a luminancia — para texto sobre a faixa colorida. */
/**
 * Distancia perceptual entre duas cores (0 = identicas, ~765 = opostas).
 *
 * Usa a aproximacao "redmean", que pesa os canais conforme a sensibilidade do
 * olho — distancia euclidiana crua em RGB acha que #ff0000 e #00ff00 sao tao
 * diferentes quanto dois azuis vizinhos, e nao sao.
 */
export function distanciaCor(hexA, hexB) {
  const [r1, g1, b1] = hexParaRgb(hexA)
  const [r2, g2, b2] = hexParaRgb(hexB)
  const rm = (r1 + r2) / 2
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2
  return Math.sqrt(
    (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db,
  )
}

/**
 * Abaixo disso as duas faixas do comparativo ficam parecidas demais para o
 * cliente distinguir de relance qual card e de qual seguradora — que e a unica
 * funcao da cor no documento.
 *
 * Calibrado contra o par ja validado no mockup: Tokio x Porto da ~250. Duas
 * seguradoras da mesma familia de cor (Darwin e Pier, as duas rosa) e o caso
 * real que motivou o limite.
 */
export const DISTANCIA_COR_MINIMA = 120

export function contrasteSobre(hex) {
  const [r, g, b] = hexParaRgb(hex)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? TINTA : '#ffffff'
}

// ─── Formatadores ──────────────────────────────────────────────────────

export function formatarMoeda(valor) {
  if (valor == null || valor === '' || Number.isNaN(Number(valor))) return ''
  return Number(valor).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
  })
}

export function formatarDataBR(iso) {
  if (!iso) return ''
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-')
  if (!ano || !mes || !dia) return ''
  return `${dia}/${mes}/${ano}`
}

// ─── Montagem do card ──────────────────────────────────────────────────

/**
 * Texto da categoria "colisao" com a indenizacao integral SEMPRE nomeada.
 *
 * Este e o ponto que a spec marca como critico: a Tokio trata indenizacao
 * integral como adicional separado ("possui / nao possui") e a Porto ja embute
 * 100% da FIPE dentro da cobertura compreensiva. Ler os dois cards sem essa
 * frase explicita leva o cliente a achar que as duas cobrem igual.
 *
 * Por isso a frase e montada aqui, nao copiada do PDF: garante que os dois
 * cards falem sobre indenizacao integral com as mesmas palavras, mesmo quando
 * as cotacoes de origem nao falam.
 */
// Danos a terceiros e a linha que o cliente compara NUMERO com NUMERO: "R$
// 100.000,00" de um lado contra "R$ 150.000,00" do outro. Descrever o que a
// cobertura faz ("cobre os danos causados às vítimas") ocupa a linha sem
// responder a pergunta, e — pior — deixa o comparativo com valor de um lado e
// prosa do outro, como se as duas cotacoes informassem a mesma coisa.
//
// Por isso aqui so entra fragmento que carrega valor. Sem nenhum, o texto sai
// vazio de proposito: a categoria cai em NAO_INFORMADO, bloqueia a geracao e a
// revisao cobra o limite — que e a verdade, o PDF nao informou o valor.
// O usuario pediu explicitamente um LIMITE EM DINHEIRO nessa linha. Percentual
// (como 100% FIPE) pertence ao casco e nao pode dar terceiros por preenchido.
// Aceita tanto "R$ 150.000,00" quanto "150.000,00".
export const TEM_VALOR_MONETARIO = /(R\$\s*\d[\d.]*(?:,\d{2})?)|(?:^|\s)\d{1,3}(?:\.\d{3})+,\d{2}(?=\s|[.,;)]|$)/

export function textoTerceiros(itens = []) {
  return [...new Set(itens.map(item => {
    const descricao = item.observacoes || ''
    if (TEM_VALOR_MONETARIO.test(descricao)) return descricao

    // Alguns layouts entregam o LMI corretamente em `valor_lmi`, mas deixam a
    // observacao apenas com o nome. Descartar o campo estruturado fazia o valor
    // sumir entre o parser e a revisao. O contrato comum agora sempre formata o
    // LMI monetario, independentemente de como cada seguradora escreve a linha.
    if (item.valor_lmi != null && Number.isFinite(Number(item.valor_lmi))) {
      const nome = item.nome_padronizado || item.nome_original_seguradora || 'Limite contratado'
      return `${humanizarCobertura(nome)}: ${formatarMoeda(item.valor_lmi)}`
    }
    return ''
  }).filter(Boolean))].join(' ')
}

export function extrairDiasCarroReserva(...fontes) {
  const texto = fontes.flat(Infinity).filter(Boolean).join(' ')
  const padroes = [
    /(?:carro|ve[íi]culo)\s+reserva[^.\n;]{0,120}?(\d{1,2})\s*(?:dias?|di[áa]rias?)/i,
    /(\d{1,2})\s*(?:dias?|di[áa]rias?)[^.\n;]{0,120}?(?:carro|ve[íi]culo)\s+reserva/i,
    /\b(\d{1,2})\s*(?:dias?|di[áa]rias?)\b/i,
  ]
  for (const padrao of padroes) {
    const m = String(texto || '').match(padrao)
    if (!m) continue
    const dias = Number(m[1])
    if (Number.isFinite(dias) && dias > 0) return dias
  }
  return null
}

function textoCarroReserva(itens = []) {
  const textos = itens
    .map(i => i.observacoes || i.nome_padronizado || i.nome_original_seguradora)
    .filter(Boolean)
  const dias = extrairDiasCarroReserva(textos)
  if (!dias) return ''
  const base = textos.join(' ')
  return base || `${dias} diária(s) de carro reserva.`
}

function textoBrutoItens(itens = []) {
  return itens
    .map(i => i.observacoes || i.nome_padronizado || i.nome_original_seguradora)
    .filter(Boolean)
    .join(' ')
}

export function extrairLimiteReboqueKm(...fontes) {
  const texto = fontes.flat(Infinity).filter(Boolean).join(' ')
  if (/(?:guincho|reboque)[^.\n;]{0,120}?(?:sem limite de?\s*(?:km|quilometragem)|km ilimitado|ilimitad[oa])|(?:sem limite de?\s*(?:km|quilometragem)|km ilimitado|ilimitad[oa])[^.\n;]{0,120}?(?:guincho|reboque)/i.test(texto)) {
    return 'Sem limite de KM'
  }
  const pares = [
    /(?:guincho|reboque)[^.\n;]{0,120}?(\d{1,4})\s*(?:km|quil[oô]metros?)\b/i,
    /(\d{1,4})\s*(?:km|quil[oô]metros?)\b[^.\n;]{0,120}?(?:guincho|reboque|assist[êe]ncia)/i,
    /\b(\d{1,4})\s*km\b/i,
  ]
  for (const padrao of pares) {
    const m = String(texto || '').match(padrao)
    if (!m) continue
    const km = Number(m[1])
    if (Number.isFinite(km) && km > 0) return km
  }
  return null
}

export function limiteReboqueDaCotacao(cotacao) {
  const direto = cotacao?.assistencia_24h?.limite_reboque_km
  if (/sem limite|ilimitad/i.test(String(direto || ''))) return 'Sem limite de KM'
  const n = direto == null || direto === '' ? null : Number(String(direto).replace(/\D/g, ''))
  if (Number.isFinite(n) && n > 0) return n

  const textos = [
    cotacao?.textos_revisados?.assistencia,
    ...(cotacao?.assistencias || []).flatMap(a => [a?.tipo, a?.detalhes]),
    ...(cotacao?.coberturas || [])
      .filter(c => c?.categoria === 'assistencia' || classificarCobertura(c?.nome_padronizado || c?.nome_original_seguradora) === 'assistencia')
      .flatMap(c => [c?.observacoes, c?.nome_padronizado, c?.nome_original_seguradora]),
  ]
  return extrairLimiteReboqueKm(textos)
}

function textoAssistencia(cotacao, itens) {
  const base = itens
    .map(i => i.observacoes || i.nome_padronizado || i.nome_original_seguradora)
    .filter(Boolean)
    .join(' ')
  const km = limiteReboqueDaCotacao(cotacao)
  if (!km) return base
  const jaTemKm = extrairLimiteReboqueKm(base) === km
  const complemento = typeof km === 'string' ? `Reboque: ${km}.` : `Reboque: até ${km} km.`
  return jaTemKm ? base : [base, complemento].filter(Boolean).join(' ')
}

export function textoColisao(cotacao) {
  const base = (cotacao?.coberturas || [])
    .filter(c => c.categoria === 'colisao' && c.incluida !== false)
    .map(c => c.observacoes || c.nome_padronizado || c.nome_original_seguradora)
    .filter(Boolean)

  const integral = cotacao?.indenizacao_integral || {}
  let frase
  if (integral.incluida === true) {
    const pct = integral.percentual_fipe != null ? `${integral.percentual_fipe}% da tabela FIPE` : 'conforme a apólice'
    frase = `Indenização integral do veículo: inclusa a ${pct}.`
  } else if (integral.incluida === false) {
    frase = 'Indenização integral do veículo: não possui (somente parcial, com franquia).'
  } else {
    // null nunca vira texto — a validacao impede gerar o PDF nesse estado.
    frase = ''
  }

  // A frase padronizada acima e a fonte de verdade sobre indenizacao integral.
  // Se a observacao extraida ja falava do assunto (a Porto embute isso no proprio
  // texto da cobertura compreensiva), ela sai — senao o card diz a mesma coisa
  // duas vezes, com palavras diferentes, que e pior do que nao dizer.
  const observacao = normalizarTexto(integral.observacao).includes('indenizacao integral')
    ? ''
    : integral.observacao

  return [...base, observacao, frase].filter(Boolean).join(' ')
}

/**
 * Organiza uma cotacao nas 7 categorias fixas + lista de "nao incluso".
 *
 * Regras (spec secao 9):
 * - cobertura com `incluida === false` vai para "nao incluso", nunca some;
 * - cobertura inclusa sem categoria reconhecida cai em "adicional";
 * - categoria sem conteudo nao aparece no card (exceto as 6 fixas, que sempre
 *   aparecem, para os dois cards terem a mesma altura e a mesma ordem de leitura).
 */
// ─── Os tres estados de uma categoria de cobertura ─────────────────────
//
// Duas nao bastam. "Tem" e "nao tem" sao afirmacoes, e uma cotacao pode
// simplesmente NAO DIZER — a maioria dos layouts so lista o que contratou.
// Tratar esse silencio como "nao tem" e mentir na direcao oposta a de tratar
// como "tem". Por isso o terceiro estado existe e BLOQUEIA a geracao ate
// alguem confirmar, mesma mecanica que `indenizacao_integral: null` ja usava.
export const ESTADO_COBERTURA = {
  INCLUIDA: 'incluida',
  NAO_INCLUIDA: 'nao_incluida',
  NAO_INFORMADO: 'nao_informado',
}

const TEXTO_NAO_INCLUIDA = 'Não incluso nesta cotação.'
const TEXTO_NAO_INFORMADO = 'A cotação não informa.'

/**
 * Estado das 7 categorias + o que sobrou para o painel "nao incluso".
 *
 * Vive fora de `montarCard` porque `validarCotacao` precisa exatamente do mesmo
 * calculo: o que bloqueia a geracao e o estado das categorias, e as duas
 * funcoes tem que concordar sobre ele. Duplicar a regra aqui e la seria criar
 * o caso em que a revisao libera e o PDF sai com linha faltando.
 */
export function montarCategorias(cotacao) {
  const cot = cotacao || criarCotacaoOrcamento()
  const itensPor = new Map(CATEGORIA_KEYS.map(k => [k, []]))
  const exclusoesPor = new Map(CATEGORIA_KEYS.map(k => [k, []]))
  const naoIncluso = []

  // Categoria "real" = a que o dicionario reconhece. `adicional` e o balde de
  // sobra: um item que so caiu la nao prova ausencia de cobertura nenhuma, e
  // por isso nao pode marcar categoria como NAO INCLUIDA.
  const categoriaReal = nome => {
    const key = classificarCobertura(nome)
    return key && key !== CATEGORIA_OPCIONAL ? key : null
  }

  const excluir = (titulo, detalhe) => {
    if (!titulo) return
    const key = categoriaReal(titulo)
    if (key) exclusoesPor.get(key).push({ titulo, detalhe: detalhe || '' })
    else naoIncluso.push({ titulo, detalhe: detalhe || '' })
  }

  for (const cobertura of cot.coberturas || []) {
    const nome = cobertura.nome_padronizado || cobertura.nome_original_seguradora
    if (cobertura.incluida === false) {
      excluir(nome, cobertura.observacoes)
      continue
    }
    const categoria = cobertura.categoria || classificarCobertura(nome) || CATEGORIA_OPCIONAL
    itensPor.get(categoria)?.push(cobertura)
  }

  for (const assistencia of cot.assistencias || []) {
    if (assistencia.incluida === false) {
      excluir(assistencia.tipo, assistencia.detalhes)
      continue
    }
    const categoria = classificarCobertura(assistencia.tipo) || 'assistencia'
    itensPor.get(categoria)?.push({
      nome_padronizado: assistencia.tipo,
      observacoes: assistencia.detalhes || '',
      valor_lmi: null,
    })
  }

  for (const servico of cot.servicos_adicionais || []) {
    itensPor.get(CATEGORIA_OPCIONAL).push({ nome_padronizado: servico, observacoes: '' })
  }

  // A lista livre `nao_incluso` do schema tambem decide estado de categoria:
  // "Carro reserva" listado ali e a cotacao dizendo que NAO tem carro reserva,
  // e isso pertence a LINHA de carro reserva. Deixar so no painel do rodape
  // manteria a linha em branco — exatamente o silencio que se quer eliminar.
  for (const item of cot.nao_incluso || []) excluir(item?.titulo, item?.detalhe)

  const categorias = CATEGORIAS_COBERTURA.map(meta => {
    const itens = itensPor.get(meta.key) || []
    const exclusoes = exclusoesPor.get(meta.key) || []

    let texto
    if (meta.key === 'colisao') texto = textoColisao(cot)
    else if (meta.key === 'franquia') texto = textoFranquia(cot, itens)
    else if (meta.key === 'terceiros') texto = textoTerceiros(itens)
    else if (meta.key === 'assistencia') texto = textoAssistencia(cot, itens)
    else if (meta.key === 'carro_reserva') texto = textoCarroReserva(itens)
    // `nome_original_seguradora` fecha a cadeia de propósito. Sem ele, uma
    // cobertura extraida sem observacao e sem nome padronizado — que e como o
    // parser da familia Porto entrega, com o nome cru da seguradora — produzia
    // texto vazio e a categoria caia em NAO_INFORMADO. Ou seja: a cobertura
    // tinha sido lida corretamente do PDF e mesmo assim o card dizia que a
    // cotacao nao informava, bloqueando a geracao sem motivo.
    else texto = itens
      .map(i => i.observacoes || i.nome_padronizado || i.nome_original_seguradora)
      .filter(Boolean)
      .join(' ')

    const textoExtraido = textoBrutoItens(itens)

    let estado = ESTADO_COBERTURA.INCLUIDA
    if (!texto && exclusoes.length) {
      estado = ESTADO_COBERTURA.NAO_INCLUIDA
      texto = exclusoes.map(e => e.detalhe).filter(Boolean).join(' ') || TEXTO_NAO_INCLUIDA
    } else if (!texto) {
      estado = ESTADO_COBERTURA.NAO_INFORMADO
      texto = TEXTO_NAO_INFORMADO
    }

    // Texto corrigido a mao na revisao vence o extraido. E o unico caminho para
    // o corretor consertar uma cobertura que o PDF descreve mal, e ele passa a
    // valer como INCLUIDA porque foi um humano quem afirmou — diferente do
    // NAO_INFORMADO, que existe justamente para dizer que ninguem afirmou nada.
    const revisado = cot.textos_revisados?.[meta.key]
    if (typeof revisado === 'string' && revisado.trim() && revisado !== texto) {
      texto = revisado.trim()
      // A revisao tambem pode confirmar uma ausencia. Tratar "Não incluso"
      // como INCLUIDA fazia o campo de terceiros exigir dinheiro logo depois
      // de o corretor confirmar que a cobertura nao existe.
      estado = /^n[ãa]o\b/i.test(texto)
        ? ESTADO_COBERTURA.NAO_INCLUIDA
        : ESTADO_COBERTURA.INCLUIDA
    }

    return { ...meta, itens, exclusoes, texto, texto_extraido: textoExtraido, estado, opcional: meta.key === CATEGORIA_OPCIONAL }
  })
    // "Beneficios adicionais" e a UNICA que pode sumir do card: nao ter
    // beneficio extra nao e lacuna de cobertura, e a spec (secao 9, item 7) ja
    // previa isso. As outras 6 sempre aparecem, nos dois cards, na mesma ordem
    // — e o que faz as linhas alinharem lado a lado.
    .filter(cat => !(cat.opcional && cat.estado !== ESTADO_COBERTURA.INCLUIDA))

  return { categorias, naoIncluso }
}

export function montarCard(cotacao, { papel = 'atual' } = {}) {
  const cot = cotacao || criarCotacaoOrcamento()
  const cor = corDaSeguradora(cot.seguradora, papel)
  const { categorias, naoIncluso } = montarCategorias(cot)

  return {
    papel,
    seguradora: {
      nome: cot.seguradora?.nome || '',
      logo_url: cot.seguradora?.logo_url || '',
      cor,
      cor_clara: tomClaro(cor),
      cor_texto: contrasteSobre(cor),
    },
    identificacao: {
      condutor: cot.condutor_principal?.nome || '',
      cep_pernoite: cot.veiculo?.cep_pernoite || '',
      uso: cot.veiculo?.uso || '',
      jovem_18_25: cot.veiculo?.condutor_18_25 || 'Não informado',
    },
    categorias,
    nao_incluso: naoIncluso,
    valores: {
      total: cot.valores?.premio_total ?? null,
      total_formatado: formatarMoeda(cot.valores?.premio_total),
      parcelamento: cot.valores?.premio_parcelado || '',
      descontos: cot.valores?.descontos_aplicados || [],
    },
    rodape: montarRodape(cot),
  }
}

function textoFranquia(cotacao, itens) {
  const valores = cotacao?.valores || {}
  const partes = []
  if (valores.franquia_tipo) partes.push(valores.franquia_tipo)
  if (valores.franquia != null) partes.push(formatarMoeda(valores.franquia))
  const extra = itens.map(i => i.observacoes || i.nome_padronizado).filter(Boolean)
  return [partes.join(' — '), ...extra].filter(Boolean).join(' ')
}

/**
 * Nota de rodape do card: versao das Condicoes Gerais + data do anexo + nº da cotacao.
 *
 * Spec secao 8: seguradora sem CG cadastrada NAO trava a geracao — o rodape
 * simplesmente sai sem essa parte.
 */
function montarRodape(cotacao) {
  const cg = cotacao?.condicoes_gerais || {}
  const partes = []
  if (cg.referencia) {
    const quando = formatarDataBR(cg.anexada_em)
    partes.push(quando ? `${cg.referencia}, anexada em ${quando}` : cg.referencia)
  }
  if (cotacao?.cotacao?.numero) partes.push(`Cotação nº ${cotacao.cotacao.numero}`)
  return partes.join(' · ')
}

// ─── Validacao da tela de revisao (spec secoes 6 e 9) ──────────────────
//
// A tela de revisao e OBRIGATORIA, nao opcional. Esta funcao e o que a torna
// obrigatoria de fato: enquanto houver pendencia `bloqueia: true`, o botao
// "Gerar orcamento" fica desabilitado. Sem isso a revisao vira uma tela que o
// usuario passa no Enter, e a extracao errada chega no cliente.
//
// Severidades:
// - `critico`  -> bloqueia a geracao. Campo que, errado, faz o cliente acreditar
//                 em cobertura que nao tem, ou em preco que nao e o preco.
// - `atencao`  -> nao bloqueia, mas fica destacado em amarelo na revisao.

export const SEVERIDADE = { CRITICO: 'critico', ATENCAO: 'atencao' }

const CAMPOS_CRITICOS = [
  { caminho: 'seguradora.nome',          label: 'Seguradora' },
  { caminho: 'segurado.nome',            label: 'Nome do segurado' },
  { caminho: 'veiculo.marca_modelo',     label: 'Veículo' },
  { caminho: 'valores.premio_total',     label: 'Prêmio total' },
  { caminho: 'valores.premio_parcelado', label: 'Parcelamento disponível' },
  { caminho: 'valores.franquia',         label: 'Valor da franquia' },
  { caminho: 'valores.franquia_tipo',    label: 'Tipo de franquia' },
  { caminho: 'cotacao.tipo_operacao',    label: 'Tipo de operação' },
]

// Campos que so existem depois de escolhida a opcao, quando ha mais de uma.
const DEPENDEM_DA_ESCOLHA = [
  'valores.premio_total', 'valores.premio_parcelado',
  'valores.franquia', 'valores.franquia_tipo',
]

const CAMPOS_ATENCAO = [
  { caminho: 'cotacao.numero',           label: 'Número da cotação' },
  { caminho: 'cotacao.validade',         label: 'Validade da cotação' },
  { caminho: 'veiculo.placa',            label: 'Placa' },
  { caminho: 'veiculo.cep_pernoite',     label: 'CEP de pernoite' },
  { caminho: 'condutor_principal.nome',  label: 'Condutor principal' },
]

function lerCaminho(objeto, caminho) {
  return caminho.split('.').reduce((acc, chave) => (acc == null ? acc : acc[chave]), objeto)
}

function vazio(valor) {
  return valor == null || valor === '' || (Array.isArray(valor) && valor.length === 0)
}

export function validarCotacao(cotacao) {
  const cot = cotacao || {}
  const pendencias = []

  // Escolha de produto pendente: o premio, as coberturas, a indenizacao integral
  // e o parcelamento dependem TODOS da opcao escolhida, e nenhum deles existe
  // ainda. Cobrar cada um separadamente daria oito pendencias para um problema
  // so — e as das categorias diriam "a cotacao nao informa", que seria mentira:
  // a cotacao informa, so que uma vez por opcao. Aqui a pendencia e uma, e e a
  // verdadeira. As checagens que NAO dependem da escolha continuam rodando, para
  // o corretor ver tudo o que falta de uma vez.
  const escolha = cot.escolha_pendente
  if (escolha) {
    pendencias.push({
      caminho: `escolha.${escolha.campo || 'opcao'}`,
      label: escolha.label || 'Esta cotação traz mais de uma opção; escolha qual vale',
      opcoes: escolha.opcoes || [],
      severidade: SEVERIDADE.CRITICO,
      bloqueia: true,
    })
  }

  for (const campo of CAMPOS_CRITICOS) {
    if (escolha && DEPENDEM_DA_ESCOLHA.includes(campo.caminho)) continue
    if (vazio(lerCaminho(cot, campo.caminho))) {
      pendencias.push({ ...campo, severidade: SEVERIDADE.CRITICO, bloqueia: true })
    }
  }

  // A indenizacao integral e o unico campo que bloqueia mesmo tendo sido
  // "extraido": `null` significa que ninguem confirmou, e o texto do card muda
  // completamente entre incluida e nao incluida. Ver `textoColisao`.
  if (escolha) {
    // Nada abaixo daqui e verificavel antes da escolha.
    return {
      pendencias,
      bloqueios: pendencias.filter(p => p.bloqueia),
      podeGerar: false,
    }
  }

  if (cot.indenizacao_integral?.incluida == null) {
    pendencias.push({
      caminho: 'indenizacao_integral.incluida',
      label: 'Indenização integral — confirme se está inclusa',
      severidade: SEVERIDADE.CRITICO,
      bloqueia: true,
    })
  } else if (cot.indenizacao_integral.incluida === true && cot.indenizacao_integral.percentual_fipe == null) {
    pendencias.push({
      caminho: 'indenizacao_integral.percentual_fipe',
      label: 'Percentual da FIPE da indenização integral',
      severidade: SEVERIDADE.CRITICO,
      bloqueia: true,
    })
  }

  for (const campo of CAMPOS_ATENCAO) {
    if (vazio(lerCaminho(cot, campo.caminho))) {
      pendencias.push({ ...campo, severidade: SEVERIDADE.ATENCAO, bloqueia: false })
    }
  }

  // Cobertura extraida que o dicionario nao reconheceu: nao bloqueia, mas
  // precisa aparecer, senao o item cai silenciosamente em "adicional" e o
  // corretor nunca fica sabendo que o dicionario tem um buraco.
  for (const cobertura of cot.coberturas || []) {
    const nome = cobertura.nome_padronizado || cobertura.nome_original_seguradora
    if (!nome) continue
    if (!cobertura.categoria && !classificarCobertura(nome)) {
      pendencias.push({
        caminho: `coberturas.${nome}`,
        label: `Cobertura não classificada: "${nome}"`,
        severidade: SEVERIDADE.ATENCAO,
        bloqueia: false,
      })
    }
  }

  // Categoria que a cotacao nao mencionou. Antes esta linha simplesmente sumia
  // do PDF, e o silencio chegava ao cliente como se fosse resposta — pior: o
  // card do lado, que tinha a linha, ficava desalinhado, e comparar lado a lado
  // e a unica funcao do documento. Agora bloqueia ate alguem dizer se tem ou
  // nao tem. "Beneficios adicionais" nao entra aqui: `montarCategorias` ja a
  // remove quando vazia, porque ausencia de beneficio extra nao e lacuna.
  for (const cat of montarCategorias(cot).categorias) {
    if (cat.estado !== ESTADO_COBERTURA.NAO_INFORMADO) continue
    pendencias.push({
      caminho: `coberturas.${cat.key}`,
      label: `${cat.label} — a cotação não informa; confirme se tem ou não tem`,
      severidade: SEVERIDADE.CRITICO,
      bloqueia: true,
    })
  }

  const terceiros = montarCategorias(cot).categorias.find(cat => cat.key === 'terceiros')
  if (terceiros?.estado === ESTADO_COBERTURA.INCLUIDA && !TEM_VALOR_MONETARIO.test(terceiros.texto)) {
    pendencias.push({
      caminho: 'coberturas.terceiros.valor_lmi',
      label: 'Danos a terceiros — informe o limite em valor (ex.: R$ 150.000,00)',
      severidade: SEVERIDADE.CRITICO,
      bloqueia: true,
    })
  }

  const assistencia = montarCategorias(cot).categorias.find(cat => cat.key === 'assistencia')
  if (assistencia?.estado === ESTADO_COBERTURA.INCLUIDA && !limiteReboqueDaCotacao(cot)) {
    pendencias.push({
      caminho: 'assistencia_24h.limite_reboque_km',
      label: 'Assistência 24h — informe o limite de KM do reboque',
      severidade: SEVERIDADE.CRITICO,
      bloqueia: true,
    })
  }

  return {
    pendencias,
    bloqueios: pendencias.filter(p => p.bloqueia),
    podeGerar: !pendencias.some(p => p.bloqueia),
  }
}

// ─── Comparativo completo ──────────────────────────────────────────────

/**
 * Numero de referencia interno do orcamento (CV-AAAA-NNNN no mockup).
 *
 * Sequencial por ano vem do banco; aqui so formata, para o mesmo formato valer
 * no preview do front e no registro persistido.
 */
export function formatarReferencia(ano, sequencial) {
  return `CV-${ano}-${String(sequencial).padStart(4, '0')}`
}

export const VALIDADE_PADRAO_DIAS = 5

export function montarComparativo({ atual, outra, referencia = '', emitidoEm = '', validadeDias = VALIDADE_PADRAO_DIAS } = {}) {
  const cotAtual = atual || criarCotacaoOrcamento()
  const cotOutra = outra || criarCotacaoOrcamento()

  const validacaoAtual = validarCotacao(cotAtual)
  const validacaoOutra = validarCotacao(cotOutra)

  // A barra do cliente e unica para os dois cards: e o MESMO segurado e o MESMO
  // veiculo nas duas cotacoes. Quando as duas cotacoes discordam, a da esquerda
  // (seguradora atual) manda, mas a divergencia e reportada — cotacao de veiculo
  // diferente no mesmo comparativo e erro de upload, nao detalhe estetico.
  const divergencias = []
  const conferir = (caminho, label) => {
    const a = normalizarTexto(lerCaminho(cotAtual, caminho))
    const b = normalizarTexto(lerCaminho(cotOutra, caminho))
    if (a && b && a !== b) divergencias.push({ caminho, label, atual: lerCaminho(cotAtual, caminho), outra: lerCaminho(cotOutra, caminho) })
  }
  conferir('segurado.nome', 'Nome do segurado')
  conferir('veiculo.placa', 'Placa')
  conferir('veiculo.marca_modelo', 'Veículo')

  const cards = [montarCard(cotAtual, { papel: 'atual' }), montarCard(cotOutra, { papel: 'outra' })]

  // Duas seguradoras da mesma familia de cor deixam o comparativo ilegivel: a
  // faixa colorida e o unico sinal que diz de relance qual card e de quem. Nao
  // bloqueia a geracao — e problema de cadastro, nao de extracao, e o corretor
  // pode ter motivo para seguir assim. Mas precisa aparecer na revisao, senao o
  // PDF sai assim e ninguem percebe ate o cliente reclamar.
  const distancia = distanciaCor(cards[0].seguradora.cor, cards[1].seguradora.cor)
  const coresProximas = distancia < DISTANCIA_COR_MINIMA
    ? {
        distancia: Math.round(distancia),
        minima: DISTANCIA_COR_MINIMA,
        mensagem: `${cards[0].seguradora.nome || 'Seguradora atual'} e `
          + `${cards[1].seguradora.nome || 'a outra seguradora'} têm cores de destaque `
          + 'parecidas demais — os dois cards vão ficar difíceis de diferenciar. '
          + 'Ajuste a cor de uma delas no cadastro.',
      }
    : null

  return {
    cabecalho: {
      referencia,
      emitido_em: emitidoEm,
      emitido_em_formatado: formatarDataBR(emitidoEm),
      validade_dias: validadeDias,
    },
    cliente: {
      segurado: cotAtual.segurado?.nome || cotOutra.segurado?.nome || '',
      veiculo: cotAtual.veiculo?.marca_modelo || cotOutra.veiculo?.marca_modelo || '',
      ano_modelo: cotAtual.veiculo?.ano_modelo || cotOutra.veiculo?.ano_modelo || '',
      placa: cotAtual.veiculo?.placa || cotOutra.veiculo?.placa || '',
      tipo_operacao: cotAtual.cotacao?.tipo_operacao || cotOutra.cotacao?.tipo_operacao || '',
      tipo_operacao_label: rotuloTipoOperacao(cotAtual.cotacao?.tipo_operacao || cotOutra.cotacao?.tipo_operacao),
    },
    cards,
    divergencias,
    cores_proximas: coresProximas,
    validacao: {
      atual: validacaoAtual,
      outra: validacaoOutra,
      podeGerar: validacaoAtual.podeGerar && validacaoOutra.podeGerar,
    },
  }
}
