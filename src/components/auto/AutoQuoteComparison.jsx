import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronDown, FileCheck2,
  Eye, FileText, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, UploadCloud,
} from 'lucide-react'

import { extrairDiasCarroReserva, montarCategorias, TEM_VALOR_MONETARIO } from '../../lib/orcamentoComparativo'
import { aplicarRevisao, camposDaCotacao } from '../../lib/orcamentoLeitura'
import { DatePicker } from '../ui'
import AutoOrcamentoOfertas from './AutoOrcamentoOfertas'

const ROLES = [
  { key: 'atual', label: 'Seguradora atual', helper: 'Referência atual ou primeira opção' },
  { key: 'concorrente', label: 'Outra seguradora', helper: 'Opção concorrente para comparação' },
]

const SEGURADORAS_ORCAMENTO = [
  { id: 'allianz', label: 'Allianz' },
  { id: 'porto_familia', label: 'Porto / Azul / Itaú / Mitsui' },
  { id: 'bradesco', label: 'Bradesco' },
  { id: 'hdi', label: 'HDI' },
  { id: 'darwin', label: 'Darwin' },
  { id: 'pier', label: 'Pier' },
  { id: 'suhai', label: 'Suhai' },
  { id: 'yelum', label: 'Yelum' },
  { id: 'tokio', label: 'Tokio Marine' },
]

function parserInicial(nome = '') {
  const n = String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (n.includes('allianz')) return 'allianz'
  if (n.includes('porto') || n.includes('azul') || n.includes('itau') || n.includes('mitsui')) return 'porto_familia'
  if (n.includes('bradesco')) return 'bradesco'
  if (n.includes('hdi')) return 'hdi'
  if (n.includes('darwin')) return 'darwin'
  if (n.includes('pier')) return 'pier'
  if (n.includes('suhai')) return 'suhai'
  if (n.includes('yelum')) return 'yelum'
  if (n.includes('tokio')) return 'tokio'
  return ''
}

// Espelhado por `camposDaCotacao` em `orcamentoLeitura.js`, com teste travando
// o par: renomear uma chave so aqui sumiria com o dado sem quebrar nada visivel.
//
// Premio liquido e IOF NAO estao nesta lista de proposito. Sao numeros de
// controle interno, conferidos na emissao; nao saem no orcamento do cliente, e
// pedir revisao humana deles gastava a atencao que deve ir para franquia e
// cobertura.
const REVIEW_FIELDS = [
  { key: 'segurado_nome', label: 'Segurado', required: true },
  { key: 'segurado_cpf', label: 'CPF/CNPJ do segurado' },
  { key: 'condutor_nome', label: 'Condutor principal' },
  { key: 'condutor_cpf', label: 'CPF do condutor' },
  { key: 'condutor_estado_civil', label: 'Estado civil do condutor' },
  { key: 'veiculo_modelo', label: 'Veículo', required: true },
  { key: 'veiculo_ano', label: 'Ano/modelo' },
  { key: 'veiculo_placa', label: 'Placa' },
  { key: 'veiculo_uso', label: 'Uso do veículo' },
  { key: 'veiculo_cep_pernoite', label: 'CEP de pernoite' },
  { key: 'numero', label: 'Número da cotação' },
  { key: 'validade', label: 'Validade', type: 'date' },
  { key: 'vigencia_inicio', label: 'Início da vigência', type: 'date' },
  { key: 'vigencia_fim', label: 'Fim da vigência', type: 'date' },
  { key: 'premio_total', label: 'Prêmio total', type: 'money', required: true },
  { key: 'premio_parcelado', label: 'Parcelamento', required: true },
  { key: 'franquia', label: 'Franquia', type: 'money', critical: true },
  { key: 'franquia_tipo', label: 'Tipo de franquia', critical: true },
  { key: 'indenizacao_integral', label: 'Indenização integral', critical: true },
  { key: 'assistencia', label: 'Assistência 24h', critical: true },
  { key: 'limite_reboque_km', label: 'Limite KM do reboque', type: 'number', critical: true },
  { key: 'carro_reserva', label: 'Carro reserva', critical: true },
  { key: 'vidros', label: 'Vidros', critical: true },
  { key: 'danos_terceiros', label: 'Danos a terceiros (valor)', critical: true },
  { key: 'nao_inclusos', label: 'Não incluso nesta cotação', multiline: true },
]

function campoPendente(field, value) {
  const texto = String(value ?? '').trim()
  if (!texto) return true
  if (field.key === 'danos_terceiros') {
    return !/^n[ãa]o\b/i.test(texto) && !TEM_VALOR_MONETARIO.test(texto)
  }
  if (field.key === 'carro_reserva') {
    return !/^n[ãa]o\b/i.test(texto) && !extrairDiasCarroReserva(texto)
  }
  return false
}

/**
 * Resolve quando toda imagem da janela terminou de carregar (ou falhou).
 *
 * `onerror` conta como resolvida de proposito: logo quebrada nao pode travar a
 * geracao do orcamento — o template ja cai para o nome da seguradora.
 */
function imagensCarregadas(janela, limiteMs = 5000) {
  const imagens = Array.from(janela.document.images || [])
  const pendentes = imagens.filter(img => !img.complete)
  if (!pendentes.length) return Promise.resolve()
  return Promise.race([
    Promise.all(pendentes.map(img => new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true })
      img.addEventListener('error', resolve, { once: true })
    }))),
    new Promise(resolve => janela.setTimeout(resolve, limiteMs)),
  ])
}

function formatSize(bytes) {
  if (!bytes) return ''
  return bytes > 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
    : `${Math.ceil(bytes / 1024)} KB`
}

/**
 * Estado inicial de um lado, semeado com o que a COTACAO do sistema ja sabe.
 *
 * Nem todo PDF traz tudo: o calculo da HDI nao imprime placa em lugar nenhum, e
 * a Pier nao imprime vigencia. Esses dados existem no cadastro da cotacao, que e
 * o que o corretor ja preencheu — busca-los ali e o oposto de inventar, e evita
 * exigir digitacao de algo que o sistema tem.
 */
function sideFromQuote(role, quote) {
  const option = role === 'atual' ? quote?.seguradora_preferencial : quote?.seguradora_mais_barata
  return {
    seguradora: option?.nome || '',
    arquivo_nome: '',
    campos: {
      segurado_nome: quote?.nome_cliente || '',
      segurado_cpf: quote?.cpf_cliente || '',
      condutor_nome: quote?.condutor_nome || '',
      condutor_cpf: quote?.condutor_cpf || '',
      condutor_estado_civil: quote?.estado_civil_condutor || '',
      veiculo_modelo: quote?.modelo_veiculo || '',
      veiculo_ano: '',
      veiculo_placa: quote?.placa || '',
      veiculo_uso: quote?.uso_veiculo || '',
      veiculo_cep_pernoite: quote?.cep_pernoite || '',
      numero: '', validade: '',
      vigencia_inicio: quote?.vigencia_inicio || '', vigencia_fim: quote?.vigencia_fim || '',
      premio_total: option?.premio_total ?? '',
      premio_parcelado: option?.parcelamentos || '', franquia: '', franquia_tipo: '', indenizacao_integral: '',
      assistencia: '', limite_reboque_km: '', carro_reserva: '', vidros: '', danos_terceiros: '', nao_inclusos: '',
    },
  }
}

function UploadSlot({ role, side, file, leitura, lendo, erro, aplicando, seguradoraParser, onParser, onFile, onEscolherOferta }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const meta = ROLES.find(item => item.key === role)
  const uploadBloqueado = !seguradoraParser
  return (
    <article className={`auto-comparison-upload is-${role} ${dragging ? 'is-dragging' : ''} ${file ? 'is-ready' : ''}`}>
      <header><span className="auto-comparison-role">{meta.label}</span><small>{meta.helper}</small></header>
      <div className="auto-comparison-insurer">
        <label htmlFor={`seguradora-orcamento-${role}`}>Seguradora do PDF</label>
        <div className="auto-comparison-insurer-preview">
          <span><ShieldCheck /><strong>{side.seguradora || 'Selecione antes do upload'}</strong></span>
          <select
            id={`seguradora-orcamento-${role}`}
            value={seguradoraParser}
            onChange={event => onParser(event.target.value)}
            aria-label={`Selecionar seguradora do PDF ${meta.label}`}
          >
            <option value="">Escolher seguradora…</option>
            {SEGURADORAS_ORCAMENTO.map(seguradora => <option key={seguradora.id} value={seguradora.id}>{seguradora.label}</option>)}
          </select>
          <ChevronDown />
        </div>
      </div>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={event => onFile(event.target.files?.[0] || null)} />
      <button
        type="button"
        className="auto-comparison-dropzone"
        disabled={uploadBloqueado}
        onClick={() => inputRef.current?.click()}
        onDragEnter={event => { event.preventDefault(); setDragging(true) }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); if (!uploadBloqueado) onFile(event.dataTransfer.files?.[0] || null) }}
      >
        {file
          ? <><FileCheck2 /><span><strong>{file.name}</strong><small>{formatSize(file.size)} · {legendaArquivo(leitura, lendo)}</small></span></>
          : <><UploadCloud /><span><strong>{uploadBloqueado ? 'Escolha a seguradora primeiro' : 'Solte ou selecione o PDF'}</strong><small>Leitura automática forçada pela seguradora selecionada, com escolha de produto quando necessário</small></span></>}
      </button>

      {lendo && <p className="auto-comparison-lendo"><LoaderCircle />Lendo o PDF…</p>}
      {erro && <p className="auto-comparison-error"><AlertTriangle />{erro}</p>}
      {!lendo && leitura && !leitura.suportado && <p className="auto-comparison-warnings"><span><AlertTriangle />{leitura.motivo}</span></p>}

      {/* PDFs com varias ofertas/produtos param aqui ate alguem escolher. */}
      {!lendo && leitura?.cotacao?.escolha_pendente && (
        <AutoOrcamentoOfertas
          escolha={leitura.cotacao.escolha_pendente}
          escolhida={null}
          onEscolher={onEscolherOferta}
          disabled={aplicando}
        />
      )}
      {!lendo && leitura?.cotacao?.oferta && (
        <AutoOrcamentoOfertas
          escolha={{ label: 'Oferta escolhida para este cliente', opcoes: leitura.cotacao.ofertas || [] }}
          escolhida={leitura.cotacao.oferta.indice}
          onEscolher={onEscolherOferta}
          disabled={aplicando}
        />
      )}
      {!lendo && leitura?.cotacao?.produto_selecionado && (
        <AutoOrcamentoOfertas
          escolha={{ campo: 'produto', label: 'Produto escolhido para este cliente', opcoes: leitura.ofertas || [] }}
          escolhida={leitura.cotacao.produto_selecionado.id}
          onEscolher={onEscolherOferta}
          disabled={aplicando}
        />
      )}
    </article>
  )
}

function legendaArquivo(leitura, lendo) {
  if (lendo) return 'lendo…'
  if (!leitura) return 'aguardando leitura'
  if (!leitura.suportado) return 'leitura automática indisponível'
  if (leitura.cotacao?.oferta) return `${leitura.seguradora} · oferta ${leitura.cotacao.oferta.nome}`
  if (leitura.cotacao?.produto_selecionado) return `${leitura.seguradora} · ${leitura.cotacao.produto_selecionado.label}`
  if (leitura.cotacao?.escolha_pendente) return `${leitura.seguradora} · escolha a opção abaixo`
  return `${leitura.seguradora} · leitura concluída`
}

function leituraDisponivelParaRevisao(leitura) {
  return leitura?.suportado && leitura?.cotacao
}

function ReviewField({ field, value, issue, onChange }) {
  const props = { value: value ?? '', onChange: event => onChange(event.target.value), placeholder: issue ? 'Revisar / preencher' : 'Não informado' }
  return (
    <label className={`auto-comparison-review-field ${issue ? 'has-issue' : ''} ${field.critical ? 'is-critical' : ''}`}>
      <span>{field.label}{field.critical && <i>crítico</i>}</span>
      {field.multiline
        ? <textarea {...props} rows="3" />
        : field.type === 'date'
          ? <DatePicker value={value ?? ''} onChange={onChange} placeholder={issue ? 'Revisar data' : 'Selecionar data'} className="auto-comparison-date-picker" />
          : <input {...props} type="text" inputMode={field.type === 'money' || field.type === 'number' ? 'decimal' : undefined} />}
      {issue && <small><AlertTriangle />Campo previsto para conferência obrigatória</small>}
    </label>
  )
}

function ReviewColumn({ role, side, issues, leitura, aplicando, onEscolherOferta, onPatch }) {
  const escolha = leitura?.cotacao?.escolha_pendente
  return (
    <article className={`auto-comparison-review-column is-${role}`}>
      <header><span>{role === 'atual' ? 'Atual' : 'Concorrente'}</span><div><strong>{side.seguradora || 'Seguradora não definida'}</strong><small>{side.arquivo_nome || 'Preenchimento manual'}</small></div>{issues.length === 0 ? <CheckCircle2 className="is-valid" /> : <span className="auto-comparison-issue-count">{issues.length}</span>}</header>
      {escolha && (
        <div className="auto-comparison-review-choice">
          <AutoOrcamentoOfertas
            escolha={escolha}
            escolhida={null}
            onEscolher={onEscolherOferta}
            disabled={aplicando}
          />
        </div>
      )}
      <div className="auto-comparison-review-fields">{REVIEW_FIELDS.map(field => <ReviewField key={field.key} field={field} value={side.campos[field.key]} issue={issues.includes(field.key)} onChange={value => onPatch(field.key, value)} />)}</div>
    </article>
  )
}

export default function AutoQuoteComparison({ quote }) {
  const [step, setStep] = useState('upload')
  const [files, setFiles] = useState({ atual: null, concorrente: null })
  const [leituras, setLeituras] = useState({ atual: null, concorrente: null })
  const [lendo, setLendo] = useState({ atual: false, concorrente: false })
  const [aplicando, setAplicando] = useState({ atual: false, concorrente: false })
  const [erros, setErros] = useState({ atual: '', concorrente: '' })
  const [sides, setSides] = useState(() => ({ atual: sideFromQuote('atual', quote), concorrente: sideFromQuote('concorrente', quote) }))
  const [parsers, setParsers] = useState(() => ({
    atual: parserInicial(sideFromQuote('atual', quote).seguradora),
    concorrente: parserInicial(sideFromQuote('concorrente', quote).seguradora),
  }))
  const [gerando, setGerando] = useState(false)
  const [erroGeracao, setErroGeracao] = useState('')
  const [comparativoGerado, setComparativoGerado] = useState(null)
  const issues = useMemo(() => Object.fromEntries(ROLES.map(({ key }) => [
    key,
    REVIEW_FIELDS
      .filter(field => (field.required || field.critical) && campoPendente(field, sides[key].campos[field.key]))
      .map(field => field.key),
  ])), [sides])
  const issueCount = issues.atual.length + issues.concorrente.length
  const criticalCount = ROLES.reduce((total, { key }) => total + issues[key].filter(fieldKey => REVIEW_FIELDS.find(field => field.key === fieldKey)?.critical).length, 0)
  const faltamArquivos = ROLES.filter(({ key }) => !files[key]).map(({ label }) => label)
  const escolhasPendentes = ROLES.filter(({ key }) => leituras[key]?.cotacao?.escolha_pendente).map(({ label }) => label)
  const leiturasPendentes = ROLES.filter(({ key }) => files[key] && !lendo[key] && !leituraDisponivelParaRevisao(leituras[key])).map(({ label }) => label)
  const podeRevisar = faltamArquivos.length === 0 && escolhasPendentes.length === 0 && leiturasPendentes.length === 0 && !lendo.atual && !lendo.concorrente
  const resumoUpload = (() => {
    if (lendo.atual || lendo.concorrente) return 'Aguarde a leitura automática terminar.'
    if (faltamArquivos.length) return `Envie o PDF de: ${faltamArquivos.join(' e ')}.`
    if (escolhasPendentes.length) return `Você pode revisar os dados já lidos; escolha produto/oferta para liberar preço e coberturas de: ${escolhasPendentes.join(' e ')}.`
    if (leiturasPendentes.length) return `Revise o aviso de leitura de: ${leiturasPendentes.join(' e ')}.`
    return 'As duas leituras estão prontas para conferência.'
  })()
  const podeAbrirRevisao = faltamArquivos.length === 0 && escolhasPendentes.length === 0 && leiturasPendentes.length === 0 && !lendo.atual && !lendo.concorrente
  const tituloRodapeUpload = escolhasPendentes.length
    ? 'Escolha o produto antes da revisão'
    : podeRevisar
      ? 'Visual pronto para a conferência'
      : 'Revisão aguardando leitura'

  async function chooseFile(role, file) {
    if (file && !parsers[role]) {
      setErros(current => ({ ...current, [role]: 'Selecione a seguradora do PDF antes de enviar o arquivo.' }))
      return
    }
    setFiles(current => ({ ...current, [role]: file }))
    setSides(current => ({ ...current, [role]: { ...current[role], arquivo_nome: file?.name || '' } }))
    setErros(current => ({ ...current, [role]: '' }))
    setLeituras(current => ({ ...current, [role]: null }))
    if (!file) return

    setLendo(current => ({ ...current, [role]: true }))
    try {
      // Import dinamico: o pdfjs so entra no bundle de quem realmente envia PDF,
      // mesmo caminho ja usado por `autoPdfParser.js` e `ApoicesGestao.jsx`.
      const { lerOrcamento } = await import('../../lib/orcamentoLeitura')
      const leitura = await lerOrcamento(file, { parser_id: parsers[role] })
      setLeituras(current => ({ ...current, [role]: leitura }))
      // Preenche SEMPRE, inclusive com escolha pendente: segurado, condutor,
      // veiculo, numero e vigencia nao dependem do produto e ja foram lidos.
      // Antes a revisao ficava inteira em branco ate a escolha e parecia leitura
      // falhada — `camposDaCotacao` ja devolve vazio no que depende do produto.
      if (leitura?.cotacao) aplicarCotacao(role, leitura)
    } catch (erro) {
      setErros(current => ({ ...current, [role]: `Não foi possível ler o PDF: ${erro.message}` }))
    } finally {
      setLendo(current => ({ ...current, [role]: false }))
    }
  }

  function escolherParser(role, parserId) {
    const selecionada = SEGURADORAS_ORCAMENTO.find(item => item.id === parserId)
    setParsers(current => ({ ...current, [role]: parserId }))
    setFiles(current => ({ ...current, [role]: null }))
    setLeituras(current => ({ ...current, [role]: null }))
    setErros(current => ({ ...current, [role]: '' }))
    setSides(current => ({
      ...current,
      [role]: {
        ...current[role],
        seguradora: selecionada?.label || '',
        arquivo_nome: '',
      },
    }))
  }

  /** Reprocessa a cotacao com a oferta/produto escolhido e leva o resultado a revisao. */
  async function escolherOferta(role, indice) {
    const leitura = leituras[role]
    if (!leitura) return
    setAplicando(current => ({ ...current, [role]: true }))
    try {
      const { aplicarEscolha } = await import('../../lib/orcamentoLeitura')
      // O seletor continua visivel depois da escolha: trocar de opcao e uma
      // acao normal, nao um refazer do zero.
      const atualizada = await aplicarEscolha(leitura, indice)
      const comOpcoes = { ...atualizada, ofertas: leitura.ofertas || leitura.cotacao?.ofertas || leitura.cotacao?.escolha_pendente?.opcoes || [] }
      setLeituras(current => ({ ...current, [role]: comOpcoes }))
      aplicarCotacao(role, comOpcoes)
    } catch (erro) {
      setErros(current => ({ ...current, [role]: `Não foi possível aplicar a opção: ${erro.message}` }))
    } finally {
      setAplicando(current => ({ ...current, [role]: false }))
    }
  }

  function aplicarCotacao(role, leitura) {
    const campos = camposDaCotacao(leitura.cotacao, { montarCategorias })
    if (!campos) return
    // So o que o PDF realmente afirma sobrescreve. Espalhar `campos` inteiro
    // apagava com string vazia o que veio do cadastro da cotacao — era assim que
    // a placa da HDI e a vigencia da Pier sumiam depois da leitura, justamente os
    // dois casos em que o PDF nao tem o dado e o sistema tem.
    const lidos = Object.fromEntries(
      Object.entries(campos).filter(([, valor]) => valor !== '' && valor != null),
    )
    setSides(current => ({
      ...current,
      [role]: {
        ...current[role],
        seguradora: leitura.cotacao.seguradora?.nome || current[role].seguradora,
        campos: { ...current[role].campos, ...lidos },
      },
    }))
  }

  /**
   * Gera o orcamento comparativo a partir do que esta na revisao.
   *
   * A cotacao que vai para o documento e a EXTRAIDA com a revisao aplicada por
   * cima (`aplicarRevisao`) — o corretor corrige na tela e a correcao chega ao
   * PDF; sem isso a revisao seria decorativa.
   *
   * A validacao de `montarComparativo` manda: cobertura nao informada e
   * indenizacao integral em branco BLOQUEIAM, porque um comparativo com linha
   * faltando chega ao cliente parecendo completo.
   *
   * O documento abre numa area propria de visualizacao. O botao "Baixar PDF"
   * dessa area chama a impressao do navegador, mantendo texto e logos vetoriais.
   * Persistir em
   * `auto_orcamentos` e alocar o numero CV-AAAA-NNNN sao uma etapa separada de
   * persistencia; esta acao apenas monta e visualiza o documento conferido.
   */
  async function gerarOrcamento() {
    setGerando(true)
    setErroGeracao('')
    try {
      const [{ montarComparativo, casarSeguradora }, { montarHtmlOrcamento }, { fetchSeguradorasCatalog }] = await Promise.all([
        import('../../lib/orcamentoComparativo'),
        import('../../lib/orcamentoComparativoHtml'),
        import('../../lib/seguradoras'),
      ])

      // A logo do card vem do cadastro (`seguradoras.logo_url`), nunca recortada
      // do PDF da cotacao. O parser nao consulta o banco, entao ate aqui
      // `logo_url` estava vazio e todo card caia no nome em serifada — era o
      // "a logo das seguradoras nao vai no PDF".
      const catalogo = await fetchSeguradorasCatalog().catch(() => [])

      const cotacaoDe = role => {
        const lida = leituras[role]?.cotacao
        if (!lida) return null
        const cot = aplicarRevisao(lida, sides[role].campos)
        const nome = sides[role].seguradora || cot.seguradora?.nome || ''
        const meta = casarSeguradora(catalogo, nome)
        return {
          ...cot,
          seguradora: {
            ...cot.seguradora,
            nome: meta?.nome_canonico || nome,
            id: meta?.id ?? cot.seguradora?.id ?? null,
            logo_url: meta?.logo_url || cot.seguradora?.logo_url || '',
            cor_destaque: meta?.cor_destaque || cot.seguradora?.cor_destaque || '',
          },
        }
      }

      const atual = cotacaoDe('atual')
      const outra = cotacaoDe('concorrente')
      if (!atual || !outra) {
        setErroGeracao('Envie e leia os dois PDFs antes de gerar o comparativo.')
        return
      }

      const hoje = new Date().toISOString().slice(0, 10)
      const comparativo = montarComparativo({ atual, outra, emitidoEm: hoje })
      if (!comparativo.validacao.podeGerar) {
        const motivos = [...comparativo.validacao.atual.pendencias, ...comparativo.validacao.outra.pendencias]
          .filter(p => p.bloqueia !== false)
          .map(p => p.label || p.caminho)
        setErroGeracao(`Faltam dados obrigatórios: ${[...new Set(motivos)].join(' · ')}`)
        return
      }

      const janela = window.open('', '_blank')
      if (!janela) {
        setErroGeracao('O navegador bloqueou a janela do orçamento. Libere o pop-up e tente de novo.')
        return
      }
      janela.document.write(montarHtmlOrcamento(comparativo, { comAcoes: true }))
      janela.document.close()

      // Esperar as logos ANTES de abrir o dialogo. Sem isso a impressao dispara
      // com as imagens ainda em voo e o PDF sai com os selos em branco —
      // exatamente o sintoma de logo faltando, so que agora por corrida.
      await imagensCarregadas(janela)
      janela.focus()
      setComparativoGerado(comparativo)
    } catch (erro) {
      setErroGeracao(`Não foi possível gerar o orçamento: ${erro.message}`)
    } finally {
      setGerando(false)
    }
  }

  function patchField(role, field, value) {
    setSides(current => ({ ...current, [role]: { ...current[role], campos: { ...current[role].campos, [field]: value } } }))
  }

  return (
    <section className="auto-comparison-workspace">
      <div className="auto-comparison-design-notice"><Sparkles /><span><strong>Leitura automática ativa por seguradora</strong><small>Quando o PDF traz mais de um produto, a leitura aguarda sua escolha. Nada é salvo nem gerado em PDF nesta etapa.</small></span></div>
      <header className="auto-comparison-heading">
        <div className="auto-comparison-heading-icon"><Sparkles /></div>
        <div><span>Orçamento comparativo</span><h2>Envie, revise e compare sem sair da cotação</h2><p>Prêmio, parcelamento, franquia e coberturas são conferidos antes de abrir a cotação final.</p></div>
        <div className="auto-comparison-progress" aria-label="Progresso demonstrativo do orçamento"><span className={step === 'upload' ? 'is-active' : 'is-done'}><i>{step === 'upload' ? 1 : <Check />}</i>Upload</span><b /><span className={step === 'review' ? 'is-active' : ''}><i>2</i>Revisão</span><b /><span><i>3</i>PDF final</span></div>
      </header>
      <div className="auto-comparison-operation"><label><span>Tipo da cotação</span><select value={quote?.tipo || 'novo'} disabled><option value="novo">Seguro novo</option><option value="renovacao">Renovação</option><option value="endosso">Endosso</option></select></label><div><ShieldCheck /><span><strong>Revisão obrigatória ativa</strong><small>Campos ausentes ou sem valor bloqueiam a cotação final.</small></span></div></div>
      {step === 'upload' ? <>
        <div className="auto-comparison-upload-grid">{ROLES.map(({ key }) => (
          <UploadSlot
            key={key}
            role={key}
            side={sides[key]}
            file={files[key]}
            leitura={leituras[key]}
            lendo={lendo[key]}
            erro={erros[key]}
            aplicando={aplicando[key]}
            seguradoraParser={parsers[key]}
            onParser={parserId => escolherParser(key, parserId)}
            onFile={file => chooseFile(key, file)}
            onEscolherOferta={indice => escolherOferta(key, indice)}
          />
        ))}</div>
        <footer className="auto-comparison-footer"><div><FileText /><span><strong>{tituloRodapeUpload}</strong><small>{resumoUpload}</small></span></div><button type="button" onClick={() => setStep('review')} disabled={!podeAbrirRevisao}>Visualizar revisão <ArrowRight /></button></footer>
      </> : <>
        <div className="auto-comparison-review-summary"><div><span>Pendências previstas</span><strong>{issueCount}</strong><small>{criticalCount} campo(s) crítico(s)</small></div><p><AlertTriangle />Franquia, indenização integral e cobertura não informada bloqueiam a geração — um comparativo com linha faltando chega ao cliente parecendo completo.</p><button type="button" onClick={() => setStep('upload')}><RefreshCw />Voltar ao upload</button></div>
        <div className="auto-comparison-review-grid">{ROLES.map(({ key }) => (
          <ReviewColumn
            key={key}
            role={key}
            side={sides[key]}
            issues={issues[key]}
            leitura={leituras[key]}
            aplicando={aplicando[key]}
            onEscolherOferta={indice => escolherOferta(key, indice)}
            onPatch={(field, value) => patchField(key, field, value)}
          />
        ))}</div>
        {erroGeracao && <div className="auto-comparison-review-summary is-error"><p><AlertTriangle />{erroGeracao}</p></div>}
        <footer className="auto-comparison-footer is-review">
          <div><CheckCircle2 /><span><strong>{comparativoGerado ? 'Cotação pronta para visualizar' : 'Revisão pronta para concluir'}</strong><small>{comparativoGerado ? 'A área da cotação contém o botão para baixar ou salvar o PDF.' : 'Confira os campos dos dois lados; a cotação abre em uma área própria.'}</small></span></div>
          <button type="button" onClick={gerarOrcamento} disabled={gerando}>
            {gerando ? <><LoaderCircle className="is-spinning" />Preparando…</> : <><Eye />Ver cotação</>}
          </button>
        </footer>
      </>}
    </section>
  )
}
