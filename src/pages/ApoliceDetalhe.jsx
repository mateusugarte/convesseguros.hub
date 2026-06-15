import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchApoliceDetalhe, atualizarApolice, excluirApolice, STATUS_EMISSAO_LABELS, FORMA_PAGAMENTO_LABELS } from '../lib/apolices'
import { PRODUTO_LABELS } from '../lib/fichas'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { useToast } from '../contexts/ToastContext'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, Save, Trash2, Clock3, Building2, ShieldCheck, CalendarDays } from 'lucide-react'
import SeguradoraSelect from '../components/SeguradoraSelect'
import SecaoDocumentos from '../components/SecaoDocumentos'
import { DatePicker } from '../components/ui/DatePicker'
import { Select } from '../components/ui/Select'
import { PageHeader, MetricCard, DataCard } from '../components/ui'

function fmtDt(v) {
  if (!v) return null
  try { return format(parseISO(v), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) } catch { return v }
}

function fmtData(v) {
  if (!v) return '—'
  try { return format(parseISO(String(v).slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) } catch { return v }
}

function calcularMeses(inicio, fim) {
  if (!inicio || !fim) return 0
  return Math.max(0, Math.round((new Date(fim) - new Date(inicio)) / (1000 * 60 * 60 * 24 * 30)))
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

function EditField({ label, value, onChange, type = 'text', placeholder, required }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-dark-muted">
        {label}{required && <span className="ml-0.5 text-status-danger">*</span>}
      </label>
      {type === 'date' ? (
        <DatePicker value={value || ''} onChange={onChange} />
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input text-sm"
        />
      )}
    </div>
  )
}

function SelectField({ label, value, onChange, options, required }) {
  const normalized = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-dark-muted">
        {label}{required && <span className="ml-0.5 text-status-danger">*</span>}
      </label>
      <Select value={value || ''} onChange={onChange} options={normalized} placeholder="Selecione..." />
    </div>
  )
}

function Timeline({ apolice }) {
  const events = [
    { label: 'Solicitação recebida', ts: apolice.created_at, color: '#3B82F6' },
  ]
  if (apolice.data_transmissao) events.push({ label: 'Apólice emitida', ts: apolice.data_transmissao, color: '#8B5CF6' })
  if (apolice.status_emissao === 'enviada') events.push({ label: 'Apólice enviada ao cliente', ts: null, color: '#10B981' })

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
  const { resolverNome } = useImobiliaria()

  const [apolice, setApolice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [numeroApolice, setNumeroApolice] = useState('')
  const [numeroProposta, setNumeroProposta] = useState('')
  const [seguradora, setSeguradora] = useState('')
  const [statusEmissao, setStatusEmissao] = useState('')
  const [proprietarioNome, setProprietarioNome] = useState('')
  const [proprietarioCel, setProprietarioCel] = useState('')
  const [endereco, setEndereco] = useState('')
  const [inicioVigencia, setInicioVigencia] = useState('')
  const [fimVigencia, setFimVigencia] = useState('')
  const [valorParcela, setValorParcela] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchApoliceDetalhe(id)
    if (data) {
      setApolice(data)
      setNumeroApolice(data.numero_apolice || '')
      setNumeroProposta(data.numero_proposta || '')
      setSeguradora(data.seguradora || '')
      setStatusEmissao(data.status_emissao || '')
      setProprietarioNome(data.proprietario_nome || '')
      setProprietarioCel(data.proprietario_cel || '')
      setEndereco(data.endereco || '')
      setInicioVigencia(data.inicio_vigencia || '')
      setFimVigencia(data.fim_vigencia || '')
      setValorParcela(data.valor_parcela !== null && data.valor_parcela !== undefined ? String(data.valor_parcela) : '')
      setFormaPagamento(data.forma_pagamento || '')
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function salvar() {
    setSalvando(true)
    const meses = calcularMeses(inicioVigencia, fimVigencia)
    const err = await atualizarApolice(id, {
      numero_apolice: numeroApolice.trim() || null,
      numero_proposta: numeroProposta.trim() || null,
      seguradora: seguradora || null,
      status_emissao: statusEmissao,
      proprietario_nome: proprietarioNome.trim() || null,
      proprietario_cel: proprietarioCel.trim() || null,
      endereco: endereco.trim() || null,
      inicio_vigencia: inicioVigencia || null,
      fim_vigencia: fimVigencia || null,
      tempo_vigencia_meses: meses || null,
      valor_parcela: valorParcela ? parseFloat(valorParcela) : null,
      forma_pagamento: formaPagamento || null,
    })
    setSalvando(false)
    if (err) { toast({ type: 'error', title: 'Erro ao salvar' }); return }
    toast({ type: 'success', title: 'Alterações salvas!' })
    load()
  }

  async function handleDelete() {
    setDeleting(true)
    const err = await excluirApolice(id)
    if (err) { setDeleting(false); toast({ type: 'error', title: 'Erro ao excluir' }); return }
    toast({ type: 'success', title: 'Apólice excluída' })
    navigate('/apolices/lista')
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
  const siStatus = STATUS_EMISSAO_LABELS[apolice.status_emissao] || { label: apolice.status_emissao, color: '#6B7280' }
  const nomePrincipal = ficha?.nome_empresa || ficha?.nome_interessado || apolice.nome_interessado || 'Apólice'

  return (
    <div className="space-y-5 pb-8 animate-fade-in">
      <PageHeader
        eyebrow="Apólices"
        title={nomePrincipal}
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
              onClick={salvar}
              disabled={salvando}
              className="flex items-center gap-1.5 rounded-2xl bg-brand-secondary px-3 py-2 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> {salvando ? 'Salvando...' : 'Salvar'}
            </button>
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
            <MetricCard label="Seguradora" value={apolice.seguradora || '—'} hint="origem da emissão" tone="secondary" icon={<Building2 className="h-4 w-4" />} />
            <MetricCard label="Vigência" value={meses > 0 ? `${meses} meses` : '—'} hint="tempo contratado" tone="success" icon={<CalendarDays className="h-4 w-4" />} />
            <MetricCard label="Parcela" value={valorParcela ? `R$ ${Number(valorParcela).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'} hint="valor mensal" tone="warning" icon={<Clock3 className="h-4 w-4" />} />
          </>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
          {ficha && (
            <DataCard title="Dados da Ficha" subtitle="Base de origem da apólice." bodyClassName="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="col-span-2"><ReadField label="Nome" value={ficha.nome_empresa || ficha.nome_interessado} /></div>
              <ReadField label={ficha.cnpj ? 'CNPJ' : 'CPF'} value={ficha.cpf || ficha.cnpj} />
              <ReadField label="Celular" value={ficha.celular} />
              <ReadField label="Produto" value={PRODUTO_LABELS[ficha.produto] || ficha.produto} />
              <ReadField label="Tipo de Imóvel" value={ficha.tipo_imovel} />
              <ReadField label="CEP" value={ficha.cep} />
              <ReadField label="Valor do Aluguel" value={ficha.valor_aluguel ? `R$ ${Number(ficha.valor_aluguel).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
              <ReadField label="Imobiliária" value={resolverNome(apolice.imobiliaria)} />
              <ReadField label="Seguradora da Ficha" value={ficha.seguradora} />
              {apolice.profiles?.nome && <ReadField label="Emissor" value={apolice.profiles.nome} />}
            </DataCard>
          )}

          <DataCard title="Dados do Proprietário" subtitle="Campos que podem ser editados nesta tela." bodyClassName="grid grid-cols-2 gap-x-6 gap-y-4">
            <EditField label="Nome" value={proprietarioNome} onChange={setProprietarioNome} placeholder="Nome do proprietário" />
            <EditField label="Celular" value={proprietarioCel} onChange={setProprietarioCel} placeholder="(11) 99999-9999" />
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
              <SeguradoraSelect value={seguradora} onChange={setSeguradora} required />
            </div>
            <SelectField
              label="Status"
              value={statusEmissao}
              onChange={setStatusEmissao}
              options={Object.entries(STATUS_EMISSAO_LABELS).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </DataCard>

          <DataCard title="Vigência e Pagamento" bodyClassName="space-y-4">
            <EditField label="Início da Vigência" type="date" value={inicioVigencia} onChange={setInicioVigencia} required />
            <EditField label="Fim da Vigência" type="date" value={fimVigencia} onChange={setFimVigencia} required />
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-dark-muted">Tempo de Vigência</p>
              <p className="text-sm text-dark-text">{meses > 0 ? `${meses} meses` : '—'}</p>
            </div>
            <EditField label="Valor da Parcela (R$)" type="number" value={valorParcela} onChange={setValorParcela} placeholder="0,00" required />
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
            apoliceId={apolice.id}
            cpfCnpj={apolice.fichas?.cpf || apolice.fichas?.cnpj}
          />
        </div>
      </div>
    </div>
  )
}
