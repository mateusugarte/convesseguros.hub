import { useRef } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileSearch,
  FileText,
  LoaderCircle,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react'

const LABELS = {
  nome_cliente: 'Segurado',
  cpf_cliente: 'CPF',
  celular_cliente: 'Celular',
  email_cliente: 'E-mail',
  cep_pernoite: 'CEP pernoite',
  modelo_veiculo: 'Veículo',
  placa: 'Placa',
  condutor_nome: 'Condutor',
  condutor_cpf: 'CPF condutor',
  seguradora: 'Seguradora',
  numero_apolice: 'Nº apólice',
  numero_proposta: 'Nº proposta',
  data_emissao: 'Emissão',
  vigencia_inicio: 'Início vigência',
  vigencia_fim: 'Fim vigência',
  premio_liquido: 'Prêmio líquido',
  valor_total: 'Prêmio total',
  pct_comissao: 'Comissão',
  parcelamento: 'Parcelamento',
  parcelamentos: 'Parcelamento',
  forma_pagamento: 'Pagamento',
  nome: 'Seguradora',
}

function humanFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

function resultFields(result) {
  if (!result) return []
  const base = Object.entries(result.campos || {})
  const insurer = Object.entries(result.seguradora_cotada || {})
  return [...base, ...insurer]
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({ key, label: LABELS[key] || key.replaceAll('_', ' '), value }))
}

export default function AutoPdfAutomation({
  mode = 'proposta',
  file,
  status = 'idle',
  result,
  error,
  applied = false,
  onFile,
  onApply,
  onClear,
  inputRef,
  accept = 'application/pdf,.pdf,.png,.jpg,.jpeg',
  compact = false,
}) {
  const ownInputRef = useRef(null)
  const activeInputRef = inputRef || ownInputRef
  const fields = resultFields(result)
  const isQuote = mode === 'orcamento'
  const isReading = status === 'reading'
  const isImageOnly = file && status === 'attached'

  function chooseFile() {
    if (activeInputRef.current) activeInputRef.current.value = ''
    activeInputRef.current?.click()
  }

  return (
    <section className={`auto-pdf-automation ${compact ? 'is-compact' : ''} ${result ? 'has-result' : ''}`}>
      <input
        ref={activeInputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={event => onFile?.(event.target.files?.[0] || null)}
      />

      <header className="auto-pdf-head">
        <span className="auto-pdf-brand"><Sparkles aria-hidden="true" /></span>
        <div>
          <span>Auto PDF Intelligence</span>
          <h3>{isQuote ? 'Ler orçamento e montar o comparativo' : 'Ler proposta ou apólice e preencher a emissão'}</h3>
          <p>{isQuote
            ? 'A seguradora, os valores e os dados do risco são reconhecidos no documento.'
            : 'O sistema encontra segurado, veículo, vigência, prêmio e número do documento.'}</p>
        </div>
        {file && (
          <button type="button" className="auto-pdf-close" onClick={onClear} aria-label="Remover arquivo">
            <X aria-hidden="true" />
          </button>
        )}
      </header>

      <div className="auto-pdf-steps" aria-label="Etapas da automação">
        <span className={file ? 'is-done' : 'is-active'}><i>{file ? <Check /> : 1}</i>Enviar PDF</span>
        <span className={isReading ? 'is-active' : result || isImageOnly ? 'is-done' : ''}><i>{result || isImageOnly ? <Check /> : 2}</i>Extrair</span>
        <span className={applied ? 'is-done' : result ? 'is-active' : ''}><i>{applied ? <Check /> : 3}</i>Revisar</span>
      </div>

      {!file && (
        <button type="button" className="auto-pdf-dropzone" onClick={chooseFile}>
          <span><UploadCloud aria-hidden="true" /></span>
          <strong>Selecionar documento</strong>
          <small>PDF para preenchimento inteligente · PNG/JPG apenas como anexo</small>
        </button>
      )}

      {file && (
        <div className="auto-pdf-file">
          <span><FileText aria-hidden="true" /></span>
          <div><strong>{file.name}</strong><small>{humanFileSize(file.size) || 'Documento selecionado'}</small></div>
          <button type="button" onClick={chooseFile}>Trocar</button>
        </div>
      )}

      {isReading && (
        <div className="auto-pdf-processing">
          <LoaderCircle aria-hidden="true" />
          <div><strong>Lendo o documento…</strong><small>Identificando layout e normalizando os campos.</small></div>
        </div>
      )}

      {isImageOnly && (
        <div className="auto-pdf-notice">
          <FileSearch aria-hidden="true" />
          <div><strong>Imagem anexada</strong><small>A extração automática está disponível para documentos PDF.</small></div>
        </div>
      )}

      {error && (
        <div className="auto-pdf-alert is-error">
          <AlertTriangle aria-hidden="true" />
          <div><strong>Não foi possível ler este PDF</strong><small>{error}</small></div>
        </div>
      )}

      {result && (
        <div className="auto-pdf-result">
          <div className="auto-pdf-result-head">
            <div>
              <span><CheckCircle2 aria-hidden="true" />Leitura concluída</span>
              <strong>{fields.length} campos encontrados{result.seguradora ? ` · ${result.seguradora}` : ''}</strong>
            </div>
            <button type="button" onClick={onApply} disabled={applied}>
              {applied ? <><Check aria-hidden="true" />Dados aplicados</> : <><Sparkles aria-hidden="true" />Aplicar ao formulário</>}
            </button>
          </div>

          <div className="auto-pdf-field-grid">
            {fields.slice(0, compact ? 6 : 12).map(field => (
              <div key={`${field.key}-${field.value}`}>
                <span>{field.label}</span>
                <strong>{String(field.value)}</strong>
              </div>
            ))}
            {fields.length > (compact ? 6 : 12) && (
              <div className="is-more"><strong>+{fields.length - (compact ? 6 : 12)}</strong><span>outros campos</span></div>
            )}
          </div>

          {result.avisos?.length > 0 && (
            <div className="auto-pdf-warnings">
              {result.avisos.map(warning => <span key={warning}><AlertTriangle aria-hidden="true" />{warning}</span>)}
            </div>
          )}

          <p className="auto-pdf-footnote">Confira os dados destacados antes de concluir. Todos os campos continuam editáveis.</p>
        </div>
      )}
    </section>
  )
}
