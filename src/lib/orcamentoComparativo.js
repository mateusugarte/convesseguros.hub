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
    'danos materiais', 'danos corporais', 'danos morais', 'custas de defesa',
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
    vigencia: { inicio: '', fim: '' },
    valores: {
      premio_liquido: null, iof: null, premio_total: null,
      premio_parcelado: '', descontos_aplicados: [],
      franquia: null, franquia_tipo: '',
    },
    // Fato critico e explicito — nunca derivado do texto das coberturas.
    // `null` = o corretor ainda nao confirmou; a revisao trava nisso.
    indenizacao_integral: { incluida: null, percentual_fipe: null, observacao: '' },
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
}

/** Papel no comparativo quando a seguradora nao tem cor propria cadastrada. */
export const CORES_FALLBACK = { atual: '#956e26', outra: '#1b4782' }

export const TINTA = '#101f33'

export function corDaSeguradora(seguradora, papel = 'atual') {
  const explicita = String(seguradora?.cor_destaque || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(explicita)) return explicita.toLowerCase()
  const padrao = CORES_SEGURADORA_PADRAO[normalizarTexto(seguradora?.nome)]
  return padrao || CORES_FALLBACK[papel] || CORES_FALLBACK.atual
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
export function montarCard(cotacao, { papel = 'atual' } = {}) {
  const cot = cotacao || criarCotacaoOrcamento()
  const cor = corDaSeguradora(cot.seguradora, papel)

  const porCategoria = new Map(CATEGORIA_KEYS.map(k => [k, []]))
  const naoIncluso = [...(cot.nao_incluso || [])]

  for (const cobertura of cot.coberturas || []) {
    const nome = cobertura.nome_padronizado || cobertura.nome_original_seguradora
    if (cobertura.incluida === false) {
      naoIncluso.push({ titulo: nome, detalhe: cobertura.observacoes || '' })
      continue
    }
    const categoria = cobertura.categoria || classificarCobertura(nome) || CATEGORIA_OPCIONAL
    porCategoria.get(categoria)?.push(cobertura)
  }

  for (const assistencia of cot.assistencias || []) {
    if (assistencia.incluida === false) {
      naoIncluso.push({ titulo: assistencia.tipo, detalhe: assistencia.detalhes || '' })
      continue
    }
    const categoria = classificarCobertura(assistencia.tipo) || 'assistencia'
    porCategoria.get(categoria)?.push({
      nome_padronizado: assistencia.tipo,
      observacoes: assistencia.detalhes || '',
      valor_lmi: null,
    })
  }

  for (const servico of cot.servicos_adicionais || []) {
    porCategoria.get(CATEGORIA_OPCIONAL).push({ nome_padronizado: servico, observacoes: '' })
  }

  const categorias = CATEGORIAS_COBERTURA.map(meta => {
    const itens = porCategoria.get(meta.key) || []
    let texto
    if (meta.key === 'colisao') texto = textoColisao(cot)
    else if (meta.key === 'franquia') texto = textoFranquia(cot, itens)
    else texto = itens.map(i => i.observacoes || i.nome_padronizado).filter(Boolean).join(' ')

    return { ...meta, itens, texto, vazia: !texto }
  }).filter(cat => cat.key !== CATEGORIA_OPCIONAL || !cat.vazia)

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
    nao_incluso: naoIncluso.filter(item => item.titulo),
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
  { caminho: 'cotacao.tipo_operacao',    label: 'Tipo de operação' },
]

const CAMPOS_ATENCAO = [
  { caminho: 'cotacao.numero',           label: 'Número da cotação' },
  { caminho: 'cotacao.validade',         label: 'Validade da cotação' },
  { caminho: 'veiculo.placa',            label: 'Placa' },
  { caminho: 'veiculo.cep_pernoite',     label: 'CEP de pernoite' },
  { caminho: 'condutor_principal.nome',  label: 'Condutor principal' },
  { caminho: 'valores.franquia',         label: 'Franquia' },
  { caminho: 'valores.premio_parcelado', label: 'Parcelamento' },
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

  for (const campo of CAMPOS_CRITICOS) {
    if (vazio(lerCaminho(cot, campo.caminho))) {
      pendencias.push({ ...campo, severidade: SEVERIDADE.CRITICO, bloqueia: true })
    }
  }

  // A indenizacao integral e o unico campo que bloqueia mesmo tendo sido
  // "extraido": `null` significa que ninguem confirmou, e o texto do card muda
  // completamente entre incluida e nao incluida. Ver `textoColisao`.
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
      severidade: SEVERIDADE.ATENCAO,
      bloqueia: false,
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
    cards: [montarCard(cotAtual, { papel: 'atual' }), montarCard(cotOutra, { papel: 'outra' })],
    divergencias,
    validacao: {
      atual: validacaoAtual,
      outra: validacaoOutra,
      podeGerar: validacaoAtual.podeGerar && validacaoOutra.podeGerar,
    },
  }
}
