import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronDown, FileCheck2,
  FileText, RefreshCw, ShieldCheck, Sparkles, UploadCloud,
} from 'lucide-react'

const ROLES = [
  { key: 'atual', label: 'Seguradora atual', helper: 'Referência atual ou primeira opção' },
  { key: 'concorrente', label: 'Outra seguradora', helper: 'Opção concorrente para comparação' },
]

const REVIEW_FIELDS = [
  { key: 'numero', label: 'Número da cotação' },
  { key: 'validade', label: 'Validade', type: 'date' },
  { key: 'vigencia_inicio', label: 'Início da vigência', type: 'date' },
  { key: 'vigencia_fim', label: 'Fim da vigência', type: 'date' },
  { key: 'premio_liquido', label: 'Prêmio líquido', type: 'money' },
  { key: 'iof', label: 'IOF', type: 'money' },
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

function UploadSlot({ role, side, file, onFile }) {
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
          ? <><FileCheck2 /><span><strong>{file.name}</strong><small>{formatSize(file.size)} · arquivo apenas demonstrativo</small></span></>
          : <><UploadCloud /><span><strong>Solte ou selecione o PDF</strong><small>A leitura será conectada na etapa de automação</small></span></>}
      </button>
    </article>
  )
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
  const [sides, setSides] = useState(() => ({ atual: sideFromQuote('atual', quote), concorrente: sideFromQuote('concorrente', quote) }))
  const issues = useMemo(() => Object.fromEntries(ROLES.map(({ key }) => [key, REVIEW_FIELDS.filter(field => (field.required || field.critical) && !String(sides[key].campos[field.key] ?? '').trim()).map(field => field.key)])), [sides])
  const issueCount = issues.atual.length + issues.concorrente.length
  const criticalCount = ROLES.reduce((total, { key }) => total + issues[key].filter(fieldKey => REVIEW_FIELDS.find(field => field.key === fieldKey)?.critical).length, 0)

  function chooseFile(role, file) {
    setFiles(current => ({ ...current, [role]: file }))
    setSides(current => ({ ...current, [role]: { ...current[role], arquivo_nome: file?.name || '' } }))
  }

  function patchField(role, field, value) {
    setSides(current => ({ ...current, [role]: { ...current[role], campos: { ...current[role].campos, [field]: value } } }))
  }

  return (
    <section className="auto-comparison-workspace">
      <div className="auto-comparison-design-notice"><Sparkles /><span><strong>Protótipo visual da próxima automação</strong><small>Nenhum PDF é lido e nenhuma informação é salva nesta etapa.</small></span></div>
      <header className="auto-comparison-heading">
        <div className="auto-comparison-heading-icon"><Sparkles /></div>
        <div><span>Orçamento comparativo</span><h2>Envie, revise e compare sem sair da cotação</h2><p>Estrutura visual preparada para dois documentos, conferência humana e geração futura do PDF final.</p></div>
        <div className="auto-comparison-progress" aria-label="Progresso demonstrativo do orçamento"><span className={step === 'upload' ? 'is-active' : 'is-done'}><i>{step === 'upload' ? 1 : <Check />}</i>Upload</span><b /><span className={step === 'review' ? 'is-active' : ''}><i>2</i>Revisão</span><b /><span><i>3</i>PDF final</span></div>
      </header>
      <div className="auto-comparison-operation"><label><span>Tipo da cotação</span><select value={quote?.tipo || 'novo'} disabled><option value="novo">Seguro novo</option><option value="renovacao">Renovação</option><option value="endosso">Endosso</option></select></label><div><ShieldCheck /><span><strong>Confirmação prevista</strong><small>Este controle será ativado com a automação.</small></span></div></div>
      {step === 'upload' ? <>
        <div className="auto-comparison-upload-grid">{ROLES.map(({ key }) => <UploadSlot key={key} role={key} side={sides[key]} file={files[key]} onFile={file => chooseFile(key, file)} />)}</div>
        <footer className="auto-comparison-footer"><div><FileText /><span><strong>Visual pronto para a conferência</strong><small>Você pode navegar pela revisão para avaliar o design.</small></span></div><button type="button" onClick={() => setStep('review')}>Visualizar revisão <ArrowRight /></button></footer>
      </> : <>
        <div className="auto-comparison-review-summary"><div><span>Pendências previstas</span><strong>{issueCount}</strong><small>{criticalCount} campo(s) crítico(s)</small></div><p><AlertTriangle />Franquia, indenização integral e itens não incluídos terão conferência obrigatória quando a automação for implementada.</p><button type="button" onClick={() => setStep('upload')}><RefreshCw />Voltar ao upload</button></div>
        <div className="auto-comparison-review-grid">{ROLES.map(({ key }) => <ReviewColumn key={key} role={key} side={sides[key]} issues={issues[key]} onPatch={(field, value) => patchField(key, field, value)} />)}</div>
        <footer className="auto-comparison-footer is-review"><div><CheckCircle2 /><span><strong>Etapa final apenas demonstrativa</strong><small>Persistência e geração de PDF não estão conectadas.</small></span></div><button type="button" disabled><Check />Automação ainda não conectada</button></footer>
      </>}
    </section>
  )
}
