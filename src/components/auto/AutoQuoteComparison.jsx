import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronDown, FileCheck2,
  FileText, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, UploadCloud,
} from 'lucide-react'

import { montarCategorias } from '../../lib/orcamentoComparativo'
import { aplicarRevisao, camposDaCotacao } from '../../lib/orcamentoLeitura'
import AutoOrcamentoOfertas from './AutoOrcamentoOfertas'

const ROLES = [
  { key: 'atual', label: 'Seguradora atual', helper: 'Referência atual ou primeira opção' },
  { key: 'concorrente', label: 'Outra seguradora', helper: 'Opção concorrente para comparação' },
]

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
  { key: 'assistencia', label: 'Assistência 24h' },
  { key: 'carro_reserva', label: 'Carro reserva' },
  { key: 'vidros', label: 'Vidros' },
  { key: 'danos_terceiros', label: 'Danos a terceiros' },
  { key: 'nao_inclusos', label: 'Não incluso nesta cotação', multiline: true },
]

function formatSize(bytes) {
  if (!bytes) return ''
  return bytes > 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
    : `${Math.ceil(bytes / 1024)} KB`
}

function sideFromQuote(role, quote) {
  const option = role === 'atual' ? quote?.seguradora_preferencial : quote?.seguradora_mais_barata
  return {
    seguradora: option?.nome || '',
    arquivo_nome: '',
    campos: {
      numero: '', validade: '', vigencia_inicio: quote?.vigencia_inicio || '', vigencia_fim: quote?.vigencia_fim || '',
      premio_liquido: option?.premio_liquido ?? '', iof: option?.iof ?? '', premio_total: option?.premio_total ?? '',
      premio_parcelado: option?.parcelamentos || '', franquia: '', franquia_tipo: '', indenizacao_integral: '',
      assistencia: '', carro_reserva: '', vidros: '', danos_terceiros: '', nao_inclusos: '',
    },
  }
}

function UploadSlot({ role, side, file, leitura, lendo, erro, aplicando, onFile, onEscolherOferta }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const meta = ROLES.find(item => item.key === role)
  return (
    <article className={`auto-comparison-upload is-${role} ${dragging ? 'is-dragging' : ''} ${file ? 'is-ready' : ''}`}>
      <header><span className="auto-comparison-role">{meta.label}</span><small>{meta.helper}</small></header>
      <div className="auto-comparison-insurer">
        <label>Seguradora</label>
        <button type="button" className="auto-comparison-insurer-preview" aria-label={`${meta.label}: ${side.seguradora || 'não definida'}`}>
          <span><ShieldCheck /><strong>{side.seguradora || 'Selecionar seguradora'}</strong></span><ChevronDown />
        </button>
      </div>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={event => onFile(event.target.files?.[0] || null)} />
      <button
        type="button"
        className="auto-comparison-dropzone"
        onClick={() => inputRef.current?.click()}
        onDragEnter={event => { event.preventDefault(); setDragging(true) }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); onFile(event.dataTransfer.files?.[0] || null) }}
      >
        {file
          ? <><FileCheck2 /><span><strong>{file.name}</strong><small>{formatSize(file.size)} · {legendaArquivo(leitura, lendo)}</small></span></>
          : <><UploadCloud /><span><strong>Solte ou selecione o PDF</strong><small>Leitura automática por seguradora, com escolha de produto quando necessário</small></span></>}
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

function ReviewField({ field, value, issue, onChange }) {
  const props = { value: value ?? '', onChange: event => onChange(event.target.value), placeholder: issue ? 'Revisar / preencher' : 'Não informado' }
  return (
    <label className={`auto-comparison-review-field ${issue ? 'has-issue' : ''} ${field.critical ? 'is-critical' : ''}`}>
      <span>{field.label}{field.critical && <i>crítico</i>}</span>
      {field.multiline ? <textarea {...props} rows="3" /> : <input {...props} type={field.type === 'date' ? 'date' : 'text'} inputMode={field.type === 'money' ? 'decimal' : undefined} />}
      {issue && <small><AlertTriangle />Campo previsto para conferência obrigatória</small>}
    </label>
  )
}

function ReviewColumn({ role, side, issues, onPatch }) {
  return (
    <article className={`auto-comparison-review-column is-${role}`}>
      <header><span>{role === 'atual' ? 'Atual' : 'Concorrente'}</span><div><strong>{side.seguradora || 'Seguradora não definida'}</strong><small>{side.arquivo_nome || 'Preenchimento manual'}</small></div>{issues.length === 0 ? <CheckCircle2 className="is-valid" /> : <span className="auto-comparison-issue-count">{issues.length}</span>}</header>
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
  const [gerando, setGerando] = useState(false)
  const [erroGeracao, setErroGeracao] = useState('')
  const [comparativoGerado, setComparativoGerado] = useState(null)
  const issues = useMemo(() => Object.fromEntries(ROLES.map(({ key }) => [key, REVIEW_FIELDS.filter(field => (field.required || field.critical) && !String(sides[key].campos[field.key] ?? '').trim()).map(field => field.key)])), [sides])
  const issueCount = issues.atual.length + issues.concorrente.length
  const criticalCount = ROLES.reduce((total, { key }) => total + issues[key].filter(fieldKey => REVIEW_FIELDS.find(field => field.key === fieldKey)?.critical).length, 0)

  async function chooseFile(role, file) {
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
      const leitura = await lerOrcamento(file)
      setLeituras(current => ({ ...current, [role]: leitura }))
      // Cotacao com uma oferta so ja preenche a revisao direto. Com mais de uma,
      // nada e preenchido ate a escolha — o premio e as coberturas dependem dela.
      if (leitura?.cotacao && !leitura.cotacao.escolha_pendente) aplicarCotacao(role, leitura)
    } catch (erro) {
      setErros(current => ({ ...current, [role]: `Não foi possível ler o PDF: ${erro.message}` }))
    } finally {
      setLendo(current => ({ ...current, [role]: false }))
    }
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
    setSides(current => ({
      ...current,
      [role]: {
        ...current[role],
        seguradora: leitura.cotacao.seguradora?.nome || current[role].seguradora,
        campos: { ...current[role].campos, ...campos },
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
   * O documento abre em janela para impressao/salvar em PDF. Persistir em
   * `auto_orcamentos` e alocar o numero CV-AAAA-NNNN dependem da migration 67,
   * ainda nao executada — por isso o cabecalho sai sem numero de referencia.
   */
  async function gerarOrcamento() {
    setGerando(true)
    setErroGeracao('')
    try {
      const [{ montarComparativo }, { montarHtmlOrcamento }] = await Promise.all([
        import('../../lib/orcamentoComparativo'),
        import('../../lib/orcamentoComparativoHtml'),
      ])

      const cotacaoDe = role => {
        const lida = leituras[role]?.cotacao
        if (!lida) return null
        const cot = aplicarRevisao(lida, sides[role].campos)
        const nome = sides[role].seguradora || cot.seguradora?.nome || ''
        return { ...cot, seguradora: { ...cot.seguradora, nome } }
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
      janela.document.write(montarHtmlOrcamento(comparativo))
      janela.document.close()
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
        <div><span>Orçamento comparativo</span><h2>Envie, revise e compare sem sair da cotação</h2><p>Estrutura visual preparada para dois documentos, conferência humana e geração futura do PDF final.</p></div>
        <div className="auto-comparison-progress" aria-label="Progresso demonstrativo do orçamento"><span className={step === 'upload' ? 'is-active' : 'is-done'}><i>{step === 'upload' ? 1 : <Check />}</i>Upload</span><b /><span className={step === 'review' ? 'is-active' : ''}><i>2</i>Revisão</span><b /><span><i>3</i>PDF final</span></div>
      </header>
      <div className="auto-comparison-operation"><label><span>Tipo da cotação</span><select value={quote?.tipo || 'novo'} disabled><option value="novo">Seguro novo</option><option value="renovacao">Renovação</option><option value="endosso">Endosso</option></select></label><div><ShieldCheck /><span><strong>Confirmação prevista</strong><small>Este controle será ativado com a automação.</small></span></div></div>
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
            onFile={file => chooseFile(key, file)}
            onEscolherOferta={indice => escolherOferta(key, indice)}
          />
        ))}</div>
        <footer className="auto-comparison-footer"><div><FileText /><span><strong>Visual pronto para a conferência</strong><small>Você pode navegar pela revisão para avaliar o design.</small></span></div><button type="button" onClick={() => setStep('review')}>Visualizar revisão <ArrowRight /></button></footer>
      </> : <>
        <div className="auto-comparison-review-summary"><div><span>Pendências previstas</span><strong>{issueCount}</strong><small>{criticalCount} campo(s) crítico(s)</small></div><p><AlertTriangle />Franquia, indenização integral e cobertura não informada bloqueiam a geração — um comparativo com linha faltando chega ao cliente parecendo completo.</p><button type="button" onClick={() => setStep('upload')}><RefreshCw />Voltar ao upload</button></div>
        <div className="auto-comparison-review-grid">{ROLES.map(({ key }) => <ReviewColumn key={key} role={key} side={sides[key]} issues={issues[key]} onPatch={(field, value) => patchField(key, field, value)} />)}</div>
        {erroGeracao && <div className="auto-comparison-review-summary is-error"><p><AlertTriangle />{erroGeracao}</p></div>}
        <footer className="auto-comparison-footer is-review">
          <div><CheckCircle2 /><span><strong>{comparativoGerado ? 'Orçamento gerado' : 'Geração do orçamento ativa'}</strong><small>{comparativoGerado ? 'Use Imprimir → Salvar como PDF na janela aberta.' : 'O documento abre em nova janela para salvar em PDF. O arquivo ainda não é guardado no sistema (migration 67 pendente).'}</small></span></div>
          <button type="button" onClick={gerarOrcamento} disabled={gerando}>
            {gerando ? <><LoaderCircle className="is-spinning" />Gerando…</> : <><FileCheck2 />Gerar orçamento comparativo</>}
          </button>
        </footer>
      </>}
    </section>
  )
}
