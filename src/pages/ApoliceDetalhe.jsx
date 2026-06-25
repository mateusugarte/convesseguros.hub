import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchApoliceDetalhe, atualizarApolice, excluirApolice, STATUS_EMISSAO_LABELS, FORMA_PAGAMENTO_LABELS, calculatePremioTotal, calculateValorComissao, formatMoneyBR, toNumber } from '../lib/apolices'
import { editarFicha } from '../lib/fichas'
import { PRODUTO_LABELS, STATUS_LABELS } from '../lib/fichas'
import { uploadDocumento } from '../lib/documentos'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, Save, Trash2, Clock3, ShieldCheck, CalendarDays, Pencil, Check } from 'lucide-react'
import SeguradoraSelect from '../components/SeguradoraSelect'
import SeguradoraBadge from '../components/SeguradoraBadge'
import ImobiliariaIdentity from '../components/ImobiliariaIdentity'
import SecaoDocumentos from '../components/SecaoDocumentos'
import { DatePicker } from '../components/ui/DatePicker'
import { Select } from '../components/ui/Select'
import { PageHeader, MetricCard, DataCard, Avatar } from '../components/ui'
import { normalizeDisplayText, sanitizeProprietarioNome } from '../lib/text'
import { formatDecimalBRInput } from '../lib/numberInput'
import { parseApolice } from '../lib/apoliceParser'
import { Upload, RefreshCw, Sparkles, X } from 'lucide-react'

function fmtDt(v) {
  if (!v) return null
  try { return format(parseISO(v), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) } catch { return v }
}

function fmtData(v) {
  if (!v) return '—'
  try { return format(parseISO(String(v).slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) } catch { return v }
}

function resolveFichaValor(ficha, field) {
  return ficha?.[field] ?? ficha?.raw_data?.[field] ?? null
}

function calcularMeses(inicio, fim) {
  if (!inicio || !fim) return 0
  return Math.max(0, Math.round((new Date(fim) - new Date(inicio)) / (1000 * 60 * 60 * 24 * 30)))
}

function isLikelyPolicyNumber(value) {
  const text = String(value || '').trim()
  return text.length > 0 && /^[0-9./-]+$/.test(text)
}

function inferProdutoFiancaFromDocumento(documento, tipoImovel) {
  const digits = String(documento || '').replace(/\D/g, '')
  const tipo = String(tipoImovel || '').toLowerCase()
  if (digits.length > 11) return 'pessoa_juridica'
  if (tipo.includes('comercial')) return 'comercial_pf'
  return digits ? 'residencial_pf' : ''
}

function buildVigenciaLabel(inicio, fim) {
  const partes = [inicio, fim].filter(Boolean).map(fmtData).filter(Boolean)
  return partes.length ? partes.join(' até ') : ''
}

function ReadField({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted mb-1">{label}</p>
      <p className="text-sm text-dark-text">{String(value)}</p>
    </div>
  )
}

function FieldShell({ label, required, children }) {
  return (
    <div className="apolice-edit-field group relative rounded-3xl border border-transparent px-2 py-1.5 transition-all hover:border-brand-accent/20 hover:bg-dark-surface2/20">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-dark-muted">
        {label}{required && <span className="ml-0.5 text-status-danger">*</span>}
      </label>
      <div className="relative">
        {children}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-dark-border/70 bg-white px-2 py-1 text-[10px] font-semibold text-dark-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
          <span className="inline-flex items-center gap-1">
            <Pencil className="h-3 w-3" />
            Editar
          </span>
        </span>
      </div>
    </div>
  )
}

function EditField({ label, value, onChange, type = 'text', placeholder, required, inputMode }) {
  return (
    <FieldShell label={label} required={required}>
      {type === 'date' ? (
        <DatePicker value={value || ''} onChange={onChange} className="w-full" />
      ) : (
        <input
          type={type}
          inputMode={inputMode}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input text-sm pr-20"
        />
      )}
    </FieldShell>
  )
}

function SelectField({ label, value, onChange, options, required }) {
  const normalized = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <FieldShell label={label} required={required}>
      <Select value={value || ''} onChange={onChange} options={normalized} placeholder="Selecione..." className="w-full" />
    </FieldShell>
  )
}

function Timeline({ apolice }) {
  const events = [
    { label: 'Solicitação recebida', ts: apolice.created_at, color: '#3B82F6' },
  ]
  if (apolice.data_transmissao) events.push({ label: 'Apólice emitida', ts: apolice.data_transmissao, color: '#8B5CF6' })
  if (apolice.status_emissao === 'enviada') events.push({ label: 'Apólice enviada ao cliente', ts: null, color: '#000079' })

  return (
    <div className="space-y-3">
      {events.map((ev, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="mt-1.5 h-2.5 w-2.5 rounded-full" style={{ background: ev.color }} />
            {i < events.length - 1 && <div className="mt-1.5 w-px flex-1 bg-dark-border" />}
          </div>
          <div className="min-w-0 pb-3">
            <p className="text-sm font-medium text-dark-text">{ev.label}</p>
            {ev.ts && <p className="mt-0.5 font-mono text-[10px] text-dark-muted/60">{fmtDt(ev.ts)}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ApoliceDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const { resolverNome, resolverImobiliariaInfo } = useImobiliaria()

  const [apolice, setApolice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [numeroApolice, setNumeroApolice] = useState('')
  const [numeroProposta, setNumeroProposta] = useState('')
  const [seguradora, setSeguradora] = useState('')
  const [statusEmissao, setStatusEmissao] = useState('')
  const [proprietarioNome, setProprietarioNome] = useState('')
  const [proprietarioCel, setProprietarioCel] = useState('')
  const [proprietarioEmail, setProprietarioEmail] = useState('')
  const [endereco, setEndereco] = useState('')
  const [inicioVigencia, setInicioVigencia] = useState('')
  const [fimVigencia, setFimVigencia] = useState('')
  const [valorParcela, setValorParcela] = useState('')
  const [parcelamento, setParcelamento] = useState('')
  const [premioLiquido, setPremioLiquido] = useState('')
  const [pctComissao, setPctComissao] = useState('')
  const [pctDesconto, setPctDesconto] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [fichaNome, setFichaNome] = useState('')
  const [fichaCpf, setFichaCpf] = useState('')
  const [fichaCnpj, setFichaCnpj] = useState('')
  const [fichaCelular, setFichaCelular] = useState('')
  const [fichaProduto, setFichaProduto] = useState('')
  const [fichaTipoImovel, setFichaTipoImovel] = useState('')
  const [fichaCep, setFichaCep] = useState('')
  const [fichaValorAluguel, setFichaValorAluguel] = useState('')
  const [fichaImobiliaria, setFichaImobiliaria] = useState('')
  const [fichaStatus, setFichaStatus] = useState('')
  const [fichaVigencia, setFichaVigencia] = useState('')
  const [fichaObservacoes, setFichaObservacoes] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('')
  const [extraindo, setExtraindo] = useState(false)
  const [anexandoDoc, setAnexandoDoc] = useState(false)
  const [extracaoExtras, setExtracaoExtras] = useState(null)
  const [extracaoErro, setExtracaoErro] = useState('')
  const [extracaoResumo, setExtracaoResumo] = useState(null)
  const [docsRefreshKey, setDocsRefreshKey] = useState(0)
  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await fetchApoliceDetalhe(id)
      if (data) {
        setApolice(data)
        setNumeroApolice(data.numero_apolice || '')
        setNumeroProposta(data.numero_proposta || '')
        setSeguradora(data.seguradora || '')
        setStatusEmissao(data.status_emissao || '')
        setProprietarioNome(sanitizeProprietarioNome(data.proprietario_nome || ''))
        setProprietarioCel(data.proprietario_cel || '')
        setProprietarioEmail(data.raw_data?.email_proprietario || '')
        setEndereco(data.endereco || '')
        setInicioVigencia(data.inicio_vigencia || '')
        setFimVigencia(data.fim_vigencia || '')
        setValorParcela(data.valor_parcela !== null && data.valor_parcela !== undefined ? formatDecimalBRInput(data.valor_parcela) : '')
        setParcelamento(data.parcelamento !== null && data.parcelamento !== undefined ? String(data.parcelamento) : '')
        setPremioLiquido(data.premio_liquido !== null && data.premio_liquido !== undefined ? formatDecimalBRInput(data.premio_liquido) : '')
        setPctComissao(data.pct_comissao !== null && data.pct_comissao !== undefined ? formatDecimalBRInput(data.pct_comissao) : '')
        setPctDesconto(data.pct_desconto !== null && data.pct_desconto !== undefined ? formatDecimalBRInput(data.pct_desconto) : '')
        setFormaPagamento(data.forma_pagamento || '')

        const fichaBase = data.fichas || null
        const fichaOrigem = fichaBase || data || {}
        setFichaNome(normalizeDisplayText(fichaOrigem.nome_empresa || fichaOrigem.nome_interessado || '') || '')
        setFichaCpf(fichaOrigem.cpf || '')
        setFichaCnpj(fichaOrigem.cnpj || '')
        setFichaCelular(fichaOrigem.celular || '')
        setFichaProduto(fichaOrigem.produto || data.produto || '')
        setFichaTipoImovel(resolveFichaValor(fichaOrigem, 'tipo_imovel') || '')
        setFichaCep(resolveFichaValor(fichaOrigem, 'cep') || '')
        setFichaValorAluguel(formatDecimalBRInput(resolveFichaValor(fichaOrigem, 'valor_aluguel')))
        setFichaImobiliaria(fichaOrigem.imobiliaria || data.imobiliaria || '')
        setFichaStatus(fichaOrigem.status || '')
        setFichaVigencia(resolveFichaValor(fichaOrigem, 'vigencia') || '')
        setFichaObservacoes(resolveFichaValor(fichaOrigem, 'observacoes') || '')
      } else {
        setLoadError('Apólice não encontrada.')
      }
    } catch (error) {
      setApolice(null)
      setLoadError('Não foi possível carregar esta apólice. Tente atualizar a página.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!pdfFile) {
      setPdfPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(pdfFile)
    setPdfPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pdfFile])

  async function salvar(statusOverride = null) {
    const statusOverrideFinal = typeof statusOverride === 'string' ? statusOverride : null
    setSalvando(true)
    const meses = calcularMeses(inicioVigencia, fimVigencia)
    const parcelaNum = toNumber(valorParcela)
    const parcelasNum = toNumber(parcelamento)
    const premioLiquidoNum = toNumber(premioLiquido)
    const premioTotal = calculatePremioTotal(parcelaNum, parcelasNum)
    const valorComissao = calculateValorComissao(premioLiquidoNum, pctComissao)
    const statusFinal = statusOverrideFinal || statusEmissao
    const dataEmissao = ['emitida', 'enviada'].includes(statusFinal) ? (apolice?.data_emissao || new Date().toISOString().slice(0, 10)) : null
    const numeroApoliceFinal = numeroApolice.trim() || apolice?.numero_apolice || null
    const fichaBase = apolice?.fichas || null
    const fichaId = fichaBase?.id
    const fichaValorAluguelNum = fichaValorAluguel === '' ? null : toNumber(fichaValorAluguel)
    const fichaPayload = fichaId ? {
      nome_interessado: fichaProduto === 'pessoa_juridica' ? null : fichaNome.trim() || null,
      nome_empresa: fichaProduto === 'pessoa_juridica' ? fichaNome.trim() || null : null,
      cpf: fichaProduto === 'pessoa_juridica' ? null : fichaCpf.trim() || null,
      cnpj: fichaProduto === 'pessoa_juridica' ? fichaCnpj.trim() || null : null,
      celular: fichaCelular.trim() || null,
      produto: fichaProduto || null,
      tipo_imovel: fichaTipoImovel.trim() || null,
      cep: fichaCep.trim() || null,
      valor_aluguel: fichaValorAluguelNum,
      imobiliaria: fichaImobiliaria.trim() || null,
      status: fichaStatus || null,
      vigencia: fichaVigencia.trim() || null,
      observacoes: fichaObservacoes.trim() || null,
      raw_data: {
        nome_interessado: fichaProduto === 'pessoa_juridica' ? null : fichaNome.trim() || null,
        nome_empresa: fichaProduto === 'pessoa_juridica' ? fichaNome.trim() || null : null,
        cpf: fichaProduto === 'pessoa_juridica' ? null : fichaCpf.trim() || null,
        cnpj: fichaProduto === 'pessoa_juridica' ? fichaCnpj.trim() || null : null,
        celular: fichaCelular.trim() || null,
        produto: fichaProduto || null,
        tipo_imovel: fichaTipoImovel.trim() || null,
        cep: fichaCep.trim() || null,
        valor_aluguel: fichaValorAluguelNum,
        imobiliaria: fichaImobiliaria.trim() || null,
        status: fichaStatus || null,
        vigencia: fichaVigencia.trim() || null,
        observacoes: fichaObservacoes.trim() || null,
      },
    } : null
    const apolicePayload = {
      numero_apolice: numeroApoliceFinal,
      numero_proposta: numeroProposta.trim() || null,
      seguradora: seguradora || null,
      status_emissao: statusFinal,
      proprietario_nome: proprietarioNome.trim() || null,
      proprietario_cel: proprietarioCel.trim() || null,
      endereco: endereco.trim() || null,
      inicio_vigencia: inicioVigencia || null,
      fim_vigencia: fimVigencia || null,
      tempo_vigencia_meses: meses || null,
      parcelamento: parcelasNum || null,
      valor_parcela: parcelaNum || null,
      forma_pagamento: formaPagamento || null,
      premio_liquido: premioLiquidoNum || null,
      pct_comissao: pctComissao === '' ? null : toNumber(pctComissao),
      pct_desconto: pctDesconto === '' ? null : toNumber(pctDesconto),
      premio_total: premioTotal,
      valor_producao: premioTotal,
      valor_comissao: valorComissao,
      data_emissao: dataEmissao,
      raw_data: {
        ...(apolice?.raw_data || {}),
        email_proprietario: proprietarioEmail.trim() || null,
      },
    }

    if (!fichaId) {
      apolicePayload.imobiliaria  = fichaImobiliaria.trim() || null
      apolicePayload.produto      = fichaProduto || null
      apolicePayload.nome_interessado = fichaProduto === 'pessoa_juridica'
        ? null
        : (fichaNome.trim() || apolice?.nome_interessado || null)
      apolicePayload.nome_empresa = fichaProduto === 'pessoa_juridica' ? fichaNome.trim() || null : null
      apolicePayload.cpf          = fichaProduto === 'pessoa_juridica' ? null : fichaCpf.trim() || null
      apolicePayload.cnpj         = fichaProduto === 'pessoa_juridica' ? fichaCnpj.trim() || null : null
      apolicePayload.celular      = fichaCelular.trim() || null
      apolicePayload.tipo_imovel  = fichaTipoImovel.trim() || null
      apolicePayload.cep          = fichaCep.trim() || null
      apolicePayload.valor_aluguel = fichaValorAluguelNum
      apolicePayload.vigencia     = fichaVigencia.trim() || null
      apolicePayload.observacoes  = fichaObservacoes.trim() || null
    }

    const [errApolice, errFicha] = await Promise.all([
      atualizarApolice(id, apolicePayload),
      fichaId ? editarFicha(fichaId, fichaPayload, user?.id) : Promise.resolve(null),
    ])
    setSalvando(false)
    const err = errApolice || errFicha
    if (err) { toast({ type: 'error', title: 'Erro ao salvar apólice', message: err.message || 'Falha na atualização.' }); load(); return }
    toast({ type: 'success', title: 'Alterações salvas!' })
    load()
  }

  async function finalizarEmissao() {
    await salvar('emitida')
  }

  async function handleDelete() {
    setDeleting(true)
    const err = await excluirApolice(id)
    if (err) { setDeleting(false); toast({ type: 'error', title: 'Erro ao excluir' }); return }
    toast({ type: 'success', title: 'Apólice excluída' })
    navigate('/apolices/lista')
  }

  async function anexarPdfComoDocumento(file) {
    if (!file) return
    setAnexandoDoc(true)
    const { error } = await uploadDocumento({
      file,
      apoliceId: apolice?.id,
      fichaId: ficha?.id,
      cpfCnpj: ficha?.cpf || ficha?.cnpj || apolice?.raw_data?.cpf || apolice?.raw_data?.cnpj,
      userId: user?.id,
    })
    setAnexandoDoc(false)
    if (error) {
      toast({ type: 'error', title: 'Erro ao anexar documento', message: error.message })
      return
    }
    setDocsRefreshKey(k => k + 1)
    toast({ type: 'success', title: 'PDF anexado em Documentos' })
  }

  function getSeguradoraAutomacao() {
    return seguradora || apolice?.seguradora || ficha?.seguradora || ''
  }

  async function handlePreencherInfo(fileOverride = null) {
    const seguradoraAtual = getSeguradoraAutomacao()
    const fileAtual = fileOverride || pdfFile
    if (!fileAtual || !seguradoraAtual) return
    setExtraindo(true)
    setExtracaoErro('')
    setExtracaoExtras(null)
    setExtracaoResumo(null)
    try {
      const { campos, extras, semParser } = await parseApolice(seguradoraAtual, fileAtual)
      if (semParser) {
        setExtracaoErro(`Seguradora "${seguradoraAtual}" ainda não possui parser configurado.`)
        return
      }
      let camposApolice = 0
      let camposFicha = 0

      if (campos.nome_proprietario) {
        setProprietarioNome(sanitizeProprietarioNome(campos.nome_proprietario))
        camposApolice += 1
      }
      if (campos.proprietario_cel) {
        setProprietarioCel(campos.proprietario_cel)
        camposApolice += 1
      }
      if (campos.email_proprietario) {
        setProprietarioEmail(campos.email_proprietario)
        camposApolice += 1
      }
      if (campos.numero_apolice) {
        setNumeroApolice(campos.numero_apolice)
        camposApolice += 1
      }
      if (isLikelyPolicyNumber(campos.numero_proposta)) {
        setNumeroProposta(campos.numero_proposta)
        camposApolice += 1
      }
      if (campos.endereco) {
        setEndereco(campos.endereco)
        camposApolice += 1
      }
      if (campos.inicio_vigencia) {
        setInicioVigencia(campos.inicio_vigencia)
        camposApolice += 1
      }
      if (campos.fim_vigencia) {
        setFimVigencia(campos.fim_vigencia)
        camposApolice += 1
      }
      if (campos.parcelamento) {
        setParcelamento(campos.parcelamento)
        camposApolice += 1
      }
      if (campos.valor_parcela) {
        setValorParcela(campos.valor_parcela)
        camposApolice += 1
      }
      if (campos.premio_liquido) {
        setPremioLiquido(campos.premio_liquido)
        camposApolice += 1
      }
      if (campos.forma_pagamento) {
        setFormaPagamento(campos.forma_pagamento)
        camposApolice += 1
      }

      if (campos.nome_locatario) {
        setFichaNome(normalizeDisplayText(campos.nome_locatario) || campos.nome_locatario)
        camposFicha += 1
      }
      if (campos.documento_locatario) {
        const digits = String(campos.documento_locatario).replace(/\D/g, '')
        if (digits.length > 11) {
          setFichaCpf('')
          setFichaCnpj(campos.documento_locatario)
        } else {
          setFichaCpf(campos.documento_locatario)
          setFichaCnpj('')
        }
        const produtoInferido = inferProdutoFiancaFromDocumento(campos.documento_locatario, extras.tipo_imovel)
        if (produtoInferido) setFichaProduto(produtoInferido)
        camposFicha += 2
      } else if (extras.tipo_imovel) {
        const produtoInferido = inferProdutoFiancaFromDocumento('', extras.tipo_imovel)
        if (produtoInferido && !fichaProduto) {
          setFichaProduto(produtoInferido)
          camposFicha += 1
        }
      }
      if ((campos.celular_locatario || campos.proprietario_cel) && !fichaCelular) {
        setFichaCelular(campos.celular_locatario || campos.proprietario_cel)
        camposFicha += 1
      }
      if (extras.tipo_imovel) {
        setFichaTipoImovel(extras.tipo_imovel)
        camposFicha += 1
      }
      if (extras.cep) {
        setFichaCep(extras.cep)
        camposFicha += 1
      }
      if (extras.valor_aluguel != null) {
        setFichaValorAluguel(formatDecimalBRInput(extras.valor_aluguel))
        camposFicha += 1
      }
      const vigenciaFicha = buildVigenciaLabel(campos.inicio_vigencia, campos.fim_vigencia)
      if (vigenciaFicha) {
        setFichaVigencia(vigenciaFicha)
        camposFicha += 1
      }
      if (campos.nome_locatario || extras.cep || extras.tipo_imovel || extras.valor_aluguel != null) {
        setExtracaoExtras({
          ...extras,
          nome_locatario: campos.nome_locatario || null,
          documento_locatario: campos.documento_locatario || null,
          vigencia: vigenciaFicha || null,
        })
      }
      setExtracaoResumo({
        arquivo: fileAtual.name,
        apolice: camposApolice,
        ficha: camposFicha,
      })
    } catch (err) {
      setExtracaoErro('Erro ao ler o PDF. Verifique se o arquivo é válido.')
    } finally {
      setExtraindo(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-dark-muted">
        <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Carregando apólice...
      </div>
    )
  }

  if (loadError) {
    return (
      <DataCard title="Apólice" subtitle="Erro ao carregar o registro.">
        <div className="rounded-3xl border border-status-danger/20 bg-status-danger/5 px-4 py-5 text-sm text-dark-text">
          <p className="font-semibold text-status-danger">{loadError}</p>
          <button onClick={() => navigate('/apolices/lista')} className="btn-secondary mt-4">← Voltar para a lista</button>
        </div>
      </DataCard>
    )
  }

  if (!apolice) {
    return (
      <div className="py-20 text-center">
        <p className="text-dark-muted">Apólice não encontrada</p>
        <button onClick={() => navigate('/apolices/lista')} className="btn-secondary mt-4">← Voltar</button>
      </div>
    )
  }

  const ficha = apolice.fichas
  const meses = calcularMeses(inicioVigencia, fimVigencia)
  const qtdParcelas = toNumber(parcelamento) || 0
  const valorParcelaNum = toNumber(valorParcela) || 0
  const premioLiquidoNum = toNumber(premioLiquido) || 0
  const premioTotal = calculatePremioTotal(valorParcelaNum, qtdParcelas)
  const valorComissao = calculateValorComissao(premioLiquidoNum, pctComissao)
  const siStatus = STATUS_EMISSAO_LABELS[apolice.status_emissao] || { label: apolice.status_emissao, color: '#6B7280' }
  const nomePrincipal = normalizeDisplayText(ficha?.nome_empresa || ficha?.nome_interessado || apolice.nome_interessado) || 'Apólice'
  const valorAluguelFicha = extracaoExtras?.valor_aluguel ?? apolice.valor_aluguel ?? ficha?.valor_aluguel
  const imobInfo = resolverImobiliariaInfo(fichaImobiliaria || apolice.imobiliaria)

  return (
    <div className="apolice-detail-page space-y-5 pb-8 animate-fade-in">
      <PageHeader
        eyebrow="Apólices"
        title={nomePrincipal}
        className="apolice-hero"
        description="Detalhe completo da apólice com edição de dados operacionais, vigência, pagamento, documentos e histórico."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/apolices/lista')}
              className="flex items-center gap-1.5 rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted transition-colors hover:border-brand-accent/50 hover:text-dark-text"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </button>
            <button
              onClick={() => salvar()}
              disabled={salvando}
              className="flex items-center gap-1.5 rounded-2xl bg-brand-secondary px-3 py-2 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            {apolice.status_emissao !== 'emitida' && apolice.status_emissao !== 'enviada' && (
              <button
                onClick={finalizarEmissao}
                disabled={salvando}
                className="flex items-center gap-1.5 rounded-2xl border border-brand-primary/30 px-3 py-2 text-xs text-brand-primary transition-colors hover:bg-brand-primary/10 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> {salvando ? 'Finalizando...' : 'Finalizar emissão de apólice'}
              </button>
            )}
            {!confirm ? (
              <button
                onClick={() => setConfirm(true)}
                className="flex items-center gap-1.5 rounded-2xl border border-status-danger/30 px-3 py-2 text-xs text-status-danger transition-colors hover:bg-status-danger/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </button>
            ) : (
              <div className="flex items-center gap-1.5 rounded-2xl border border-status-danger/30 bg-status-danger/5 px-3 py-2">
                <span className="text-xs font-medium text-status-danger">Confirmar?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-xl bg-status-danger px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {deleting ? '...' : 'Sim'}
                </button>
                <button
                  onClick={() => setConfirm(false)}
                  className="rounded-xl border border-dark-border px-2.5 py-1.5 text-xs text-dark-muted"
                >
                  Não
                </button>
              </div>
            )}
          </div>
        )}
        stats={(
          <>
            <MetricCard label="Status" value={siStatus.label} hint="situação atual" tone="accent" icon={<ShieldCheck className="h-4 w-4" />} />
            <MetricCard label="Seguradora" value={apolice.seguradora || '—'} hint="origem da emissão" tone="secondary" icon={<SeguradoraBadge nome={apolice.seguradora} size="lg" showName={false} />} />
            <MetricCard label="Vigência" value={meses > 0 ? `${meses} meses` : '—'} hint="tempo contratado" tone="success" icon={<CalendarDays className="h-4 w-4" />} />
            <MetricCard label="Prêmio total" value={premioTotal != null ? formatMoneyBR(premioTotal) : '—'} hint="parcelas x valor da parcela" tone="warning" icon={<Clock3 className="h-4 w-4" />} />
          </>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
          <DataCard title="Contexto da Apólice" subtitle="Marcas e vínculo operacional desta emissão." bodyClassName="grid gap-4 lg:grid-cols-2">
            <div className="apolice-brand-tile">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradora vinculada</p>
              <div className="mt-4 flex items-center justify-between gap-4">
                <SeguradoraBadge nome={seguradora || apolice.seguradora || 'Não definida'} size="xxl" className="min-w-0" />
                <span className="rounded-full border border-dark-border/70 bg-dark-surface2/30 px-2.5 py-1 text-[10px] font-semibold text-dark-muted">
                  {siStatus.label}
                </span>
              </div>
            </div>
            <div className="apolice-brand-tile">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Imobiliária vinculada</p>
              <div className="mt-4">
                <ImobiliariaIdentity
                  nome={resolverNome(fichaImobiliaria || apolice.imobiliaria)}
                  imagemUrl={imobInfo?.imagem_url}
                  imagemPath={imobInfo?.imagem_path}
                  size="xxl"
                />
              </div>
            </div>
          </DataCard>
          <DataCard title="Dados da Ficha" subtitle={ficha ? 'Base de origem da apólice.' : 'Dados preservados diretamente na apólice.'} bodyClassName="grid grid-cols-2 gap-x-6 gap-y-4">
              {!ficha && (
                <div className="col-span-2">
                  <span className="inline-flex items-center rounded-full bg-status-warning/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-status-warning">
                    Apólice sem ficha vinculada
                  </span>
                </div>
              )}
              <div className="col-span-2">
                <EditField
                  label="Nome"
                  value={fichaNome}
                  onChange={setFichaNome}
                  placeholder={fichaProduto === 'pessoa_juridica' ? 'Nome da empresa' : 'Nome do interessado'}
                />
              </div>
              <EditField
                label={fichaProduto === 'pessoa_juridica' ? 'CNPJ' : 'CPF'}
                value={fichaProduto === 'pessoa_juridica' ? fichaCnpj : fichaCpf}
                onChange={fichaProduto === 'pessoa_juridica' ? setFichaCnpj : setFichaCpf}
                placeholder={fichaProduto === 'pessoa_juridica' ? '00.000.000/0000-00' : '000.000.000-00'}
              />
              <EditField label="Celular" value={fichaCelular} onChange={setFichaCelular} placeholder="(11) 99999-9999" />
              <SelectField
                label="Produto"
                value={fichaProduto}
                onChange={setFichaProduto}
                options={Object.entries(PRODUTO_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <EditField label="Tipo de Imóvel" value={fichaTipoImovel} onChange={setFichaTipoImovel} />
              <EditField label="CEP" value={fichaCep} onChange={setFichaCep} />
              <EditField label="Valor do Aluguel" type="text" inputMode="decimal" value={fichaValorAluguel} onChange={setFichaValorAluguel} placeholder="0,00" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted mb-1">Imobiliária</p>
                {fichaImobiliaria && (() => {
                  const imobInfo = resolverImobiliariaInfo(fichaImobiliaria)
                  return (
                    <div className="flex items-center gap-2 mb-1.5">
                      {imobInfo?.imagem_url
                        ? <img src={imobInfo.imagem_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                        : <Avatar name={fichaImobiliaria} size="sm" />
                      }
                      <span className="text-sm font-medium text-dark-text truncate">
                        {resolverNome(fichaImobiliaria)}
                      </span>
                    </div>
                  )
                })()}
                <EditField value={fichaImobiliaria} onChange={setFichaImobiliaria} placeholder="Nome da imobiliária" />
              </div>
              <SelectField
                label="Status"
                value={fichaStatus}
                onChange={setFichaStatus}
                options={['pendente', 'em_cotacao', 'em_analise', 'aprovado', 'recusado', 'emitido', 'cancelado', 'cpf_invalido', 'expirada']
                  .map(value => ({ value, label: STATUS_LABELS[value]?.label || value }))}
              />
              <div className="col-span-2">
                <EditField label="Observações" value={fichaObservacoes} onChange={setFichaObservacoes} />
              </div>
              {apolice.profiles?.nome && (
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted mb-1">Emissor</p>
                  <div className="flex items-center gap-2">
                    <Avatar name={apolice.profiles.nome} src={apolice.profiles.avatar_url || ''} size="sm" />
                    <span className="text-sm text-dark-text">{normalizeDisplayText(apolice.profiles.nome) || apolice.profiles.nome}</span>
                  </div>
                </div>
              )}
            </DataCard>

          <DataCard title="Dados do Proprietário" subtitle="Campos que podem ser editados nesta tela." bodyClassName="grid grid-cols-2 gap-x-6 gap-y-4">
            <EditField label="Nome" value={proprietarioNome} onChange={setProprietarioNome} placeholder="Nome do proprietário" />
            <EditField label="Celular" value={proprietarioCel} onChange={setProprietarioCel} placeholder="(11) 99999-9999" />
            <EditField label="Email" type="email" value={proprietarioEmail} onChange={setProprietarioEmail} placeholder="proprietario@email.com" />
            <div className="col-span-2">
              <EditField label="Endereço" value={endereco} onChange={setEndereco} placeholder="Rua, número, bairro, cidade" />
            </div>
          </DataCard>
        </div>

        <div className="space-y-5">
          <DataCard title="Dados da Apólice" bodyClassName="space-y-4">
            <EditField label="Número da Apólice" value={numeroApolice} onChange={setNumeroApolice} placeholder="000000000" required />
            <EditField label="Número da Proposta" value={numeroProposta} onChange={setNumeroProposta} placeholder="Opcional" />
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-dark-muted">Seguradora<span className="ml-0.5 text-status-danger">*</span></label>
              <SeguradoraSelect value={seguradora} onChange={setSeguradora} produto={apolice.produto || ficha?.produto} required />
            </div>
            <SelectField
              label="Status"
              value={statusEmissao}
              onChange={setStatusEmissao}
              options={Object.entries(STATUS_EMISSAO_LABELS).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </DataCard>

          <DataCard title="Fazer upload da apólice" subtitle="Use o PDF para acionar a automação desta emissão." bodyClassName="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-xs text-dark-muted">
                Envie a apólice em PDF e preencha os dados usando a seguradora selecionada.
              </p>
              <span className="rounded-full border border-dark-border bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-dark-muted">
                Seguradora: {getSeguradoraAutomacao() || 'não selecionada'}
              </span>
            </div>

            <div className="rounded-3xl border border-dark-border/70 bg-gradient-to-br from-brand-secondary/5 via-white to-brand-accent/5 p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-dark-text">Automação de preenchimento</p>
                <p className="text-xs text-dark-muted">
                  O PDF alimenta os dados da apólice e também os campos aproveitáveis da ficha, reduzindo retrabalho.
                </p>
              </div>
              {extracaoResumo && (
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-dark-border/60 bg-white/80 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Arquivo</p>
                    <p className="mt-1 truncate text-xs font-medium text-dark-text">{extracaoResumo.arquivo}</p>
                  </div>
                  <div className="rounded-2xl border border-dark-border/60 bg-white/80 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Campos da apólice</p>
                    <p className="mt-1 text-xs font-semibold text-dark-text">{extracaoResumo.apolice} preenchidos</p>
                  </div>
                  <div className="rounded-2xl border border-dark-border/60 bg-white/80 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Campos da ficha</p>
                    <p className="mt-1 text-xs font-semibold text-dark-text">{extracaoResumo.ficha} preenchidos</p>
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0] || null
                setPdfFile(file)
                setExtracaoExtras(null)
                setExtracaoErro('')
                setExtracaoResumo(null)
                if (file) {
                  await anexarPdfComoDocumento(file)
                  if (getSeguradoraAutomacao()) {
                    await handlePreencherInfo(file)
                  }
                }
              }}
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-2xl border border-dark-border bg-white/80 px-3 py-2 text-xs font-medium text-dark-text hover:border-brand-accent/40 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                {pdfFile ? pdfFile.name : 'Upload da apólice em PDF'}
              </button>

              <button
                type="button"
                onClick={handlePreencherInfo}
                disabled={extraindo || anexandoDoc || !pdfFile || !getSeguradoraAutomacao()}
                title={!pdfFile ? 'Envie o PDF da apólice primeiro' : !getSeguradoraAutomacao() ? 'Selecione a seguradora primeiro' : 'Ler PDF e preencher dados'}
                className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: '#000079' }}
              >
                {extraindo
                  ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Lendo apólice...</>
                  : <><Sparkles className="h-3.5 w-3.5" />Reprocessar preenchimento</>}
              </button>

              {pdfFile && (
                <button
                  type="button"
                  onClick={() => { setPdfFile(null); setExtracaoExtras(null); setExtracaoErro(''); setExtracaoResumo(null) }}
                  className="rounded-full p-1.5 text-dark-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {pdfPreviewUrl && (
              <div className="overflow-hidden rounded-3xl border border-dark-border/70 bg-dark-surface2/10">
                <div className="flex items-center justify-between border-b border-dark-border/60 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Pré-visualização do PDF</p>
                  {anexandoDoc && <span className="text-[10px] font-semibold text-brand-primary">Anexando...</span>}
                </div>
                <iframe
                  title="Pré-visualização da apólice"
                  src={pdfPreviewUrl}
                  className="h-80 w-full bg-white"
                />
              </div>
            )}

            {!getSeguradoraAutomacao() && (
              <p className="text-xs font-medium text-status-warning">
                Selecione a seguradora para liberar a automação.
              </p>
            )}

            {extracaoErro && (
              <p className="text-xs font-medium text-red-500">{extracaoErro}</p>
            )}

            {extracaoExtras && (
              <div className="rounded-3xl border border-dark-border/60 bg-white/80 p-4 space-y-2">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">
                  Informações extraídas da apólice
                </p>
                {extracaoExtras.nome_locatario && (
                  <div className="flex items-center justify-between text-xs gap-3">
                    <span className="text-dark-muted">Locatário</span>
                    <span className="font-medium text-dark-text text-right">{extracaoExtras.nome_locatario}</span>
                  </div>
                )}
                {proprietarioEmail && (
                  <div className="flex items-center justify-between text-xs gap-3">
                    <span className="text-dark-muted">Email do proprietário</span>
                    <span className="font-medium text-dark-text text-right break-all">{proprietarioEmail}</span>
                  </div>
                )}
                {extracaoExtras.documento_locatario && (
                  <div className="flex items-center justify-between text-xs gap-3">
                    <span className="text-dark-muted">Documento</span>
                    <span className="font-mono font-medium text-dark-text text-right">{extracaoExtras.documento_locatario}</span>
                  </div>
                )}
                {extracaoExtras.tipo_imovel && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-dark-muted">Tipo de imóvel</span>
                    <span className="font-medium text-dark-text">{extracaoExtras.tipo_imovel}</span>
                  </div>
                )}
                {extracaoExtras.cep && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-dark-muted">CEP</span>
                    <span className="font-mono font-medium text-dark-text">
                      {extracaoExtras.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}
                    </span>
                  </div>
                )}
                {extracaoExtras.valor_aluguel != null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-dark-muted">Aluguel declarado</span>
                    <span className="font-medium text-brand-primary">
                      {formatMoneyBR(extracaoExtras.valor_aluguel)}
                    </span>
                  </div>
                )}
                {extracaoExtras.vigencia && (
                  <div className="flex items-center justify-between text-xs gap-3">
                    <span className="text-dark-muted">Vigência</span>
                    <span className="font-medium text-dark-text text-right">{extracaoExtras.vigencia}</span>
                  </div>
                )}
              </div>
            )}
          </DataCard>

          <DataCard title="Vigência e Pagamento" bodyClassName="space-y-4">
            <EditField label="Início da Vigência" type="date" value={inicioVigencia} onChange={setInicioVigencia} required />
            <EditField label="Fim da Vigência" type="date" value={fimVigencia} onChange={setFimVigencia} required />
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-dark-muted">Tempo de Vigência</p>
              <p className="text-sm text-dark-text">{meses > 0 ? `${meses} meses` : '—'}</p>
            </div>
            <EditField label="Parcelamento (vezes)" type="number" value={parcelamento} onChange={setParcelamento} placeholder="Ex: 12" required />
            <EditField label="Valor da Parcela (R$)" type="text" inputMode="decimal" value={valorParcela} onChange={setValorParcela} placeholder="0,00" required />
            <EditField label="Prêmio Líquido (R$)" type="text" inputMode="decimal" value={premioLiquido} onChange={setPremioLiquido} placeholder="0,00" required />
            <EditField label="% Comissão" type="text" inputMode="decimal" value={pctComissao} onChange={setPctComissao} placeholder="Ex: 10,00" required />
            <EditField label="% Desconto" type="text" inputMode="decimal" value={pctDesconto} onChange={setPctDesconto} placeholder="Ex: 5,00" required />
            <div className="apolice-total-box text-sm text-dark-text">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted">Valor total do seguro</p>
              <p className="mt-1 font-semibold">{premioTotal != null ? formatMoneyBR(premioTotal) : '—'}</p>
            </div>
            <div className="apolice-total-box text-sm text-dark-text">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-muted">Comissão calculada</p>
              <p className="mt-1 font-semibold">{valorComissao != null ? formatMoneyBR(valorComissao) : '—'}</p>
            </div>
            <SelectField
              label="Forma de Pagamento"
              value={formaPagamento}
              onChange={setFormaPagamento}
              options={Object.entries(FORMA_PAGAMENTO_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              required
            />
          </DataCard>

          <DataCard title="Histórico">
            <Timeline apolice={apolice} />
          </DataCard>

          <SecaoDocumentos
            key={docsRefreshKey}
            apoliceId={apolice.id}
            cpfCnpj={apolice.fichas?.cpf || apolice.fichas?.cnpj || apolice.raw_data?.cpf || apolice.raw_data?.cnpj}
          />
        </div>
      </div>
    </div>
  )
}

