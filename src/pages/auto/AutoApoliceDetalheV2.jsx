import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  CalendarDays,
  Car,
  Clock3,
  CreditCard,
  Copy,
  FileText,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import {
  AutoBadge,
  AutoInfoGrid,
  AutoInlineAlert,
  AutoListRow,
  AutoLoading,
  AutoMoneyDelta,
  AutoPageHeader,
  AutoPanel,
  AutoStatStrip,
  AutoStickyActions,
  AutoTabs,
  AutoTypeBadge,
} from '../../components/auto'
import { EmptyState } from '../../components/ui'
import {
  atualizarApoliceAutoSemEmissao,
  atualizarEmissaoAutoCompleta,
  calcularValorComissaoAuto,
  getApoliceAutoDetalhe,
  getEmissaoColuna,
} from '../../lib/auto'
import { formatDateBR, formatDateTimeBR, formatMoney } from './autoShared'

const TABS = [
  { value: 'resumo', label: 'Resumo', icon: ShieldCheck },
  { value: 'segurado', label: 'Segurado e veículo', icon: UserRound },
  { value: 'apolice', label: 'Apólice', icon: FileText },
  { value: 'financeiro', label: 'Financeiro', icon: WalletCards },
  { value: 'renovacao', label: 'Renovação', icon: CalendarDays },
  { value: 'historico', label: 'Histórico', icon: Activity },
]

function buildForm(apolice) {
  const emissao = apolice?.emissoes_auto || {}
  const cotacao = emissao?.cotacoes_auto || {}
  return {
    tipo: emissao.tipo || cotacao.tipo || '',
    seguradoras_cotadas: Array.isArray(emissao.seguradoras_cotadas) ? emissao.seguradoras_cotadas : [],
    nome_cliente: apolice?.nome_cliente || emissao.nome_cliente || cotacao.nome_cliente || '',
    cpf_cliente: apolice?.cpf_cliente || emissao.cpf_cliente || cotacao.cpf_cliente || '',
    celular_cliente: apolice?.celular_cliente || emissao.celular_cliente || cotacao.celular_cliente || '',
    email_cliente: cotacao.email_cliente || '',
    condutor_nome: apolice?.condutor_nome || emissao.condutor_nome || cotacao.condutor_nome || '',
    condutor_cpf: apolice?.condutor_cpf || emissao.condutor_cpf || cotacao.condutor_cpf || '',
    modelo_veiculo: apolice?.modelo_veiculo || emissao.modelo_veiculo || cotacao.modelo_veiculo || '',
    placa: apolice?.placa || emissao.placa || cotacao.placa || '',
    seguradora: apolice?.seguradora || emissao.seguradora || '',
    numero_apolice: apolice?.numero_apolice || emissao.numero_apolice || '',
    vigencia_inicio: apolice?.vigencia_inicio || emissao.vigencia_inicio || cotacao.vigencia_inicio || '',
    vigencia_fim: apolice?.vigencia_fim || emissao.vigencia_fim || cotacao.vigencia_fim || '',
    premio_liquido: apolice?.premio_liquido ?? emissao.premio_liquido ?? '',
    pct_comissao: apolice?.pct_comissao ?? emissao.pct_comissao ?? '',
    forma_pagamento: apolice?.forma_pagamento || emissao.forma_pagamento || '',
    parcelamento: apolice?.parcelamento || emissao.parcelamento || '',
    responsavel: apolice?.responsavel || '',
    tipo_producao: apolice?.tipo_producao || 'individual',
    origem_lead: cotacao.origem_lead || '',
    eh_renovacao: Boolean(apolice?.eh_renovacao || emissao?.eh_renovacao || cotacao?.tipo === 'renovacao'),
    tem_repasse: Boolean(apolice?.tem_repasse || emissao?.tem_repasse),
    pct_repasse: apolice?.pct_repasse ?? emissao?.pct_repasse ?? '',
    nome_repasse: apolice?.nome_repasse || emissao?.nome_repasse || '',
    renovacao_premio_liquido_ano_anterior: apolice?.renovacao_premio_liquido_ano_anterior ?? emissao?.renovacao_premio_liquido_ano_anterior ?? '',
    renovacao_comissao_ano_anterior: apolice?.renovacao_comissao_ano_anterior ?? emissao?.renovacao_comissao_ano_anterior ?? '',
    renovacao_premio_liquido_ano_atual: apolice?.renovacao_premio_liquido_ano_atual ?? emissao?.renovacao_premio_liquido_ano_atual ?? apolice?.premio_liquido ?? '',
    renovacao_comissao_ano_atual: apolice?.renovacao_comissao_ano_atual ?? emissao?.renovacao_comissao_ano_atual ?? apolice?.valor_comissao ?? '',
  }
}

function Field({ label, value, onChange, type = 'text', inputMode, placeholder }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-dark-muted">{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="input"
      />
    </div>
  )
}

function FormGrid({ children }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>
}

export default function AutoApoliceDetalheV2() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState('resumo')
  const [form, setForm] = useState(null)
  const [saveError, setSaveError] = useState('')
  const [copied, setCopied] = useState('')

  const { data: apolice, isLoading } = useQuery({
    queryKey: ['auto-apolice-detalhe', id],
    queryFn: () => getApoliceAutoDetalhe(id),
    enabled: Boolean(id),
  })

  useEffect(() => {
    if (apolice) setForm(buildForm(apolice))
  }, [apolice])

  const salvar = useMutation({
    mutationFn: async () => {
      if (!apolice || !form) return null
      const emissao = apolice.emissoes_auto || null
      if (emissao?.id) {
        return atualizarEmissaoAutoCompleta({
          ...form,
          id: emissao.id,
          apolice_id: apolice.id,
          cotacao_id: emissao.cotacao_id || emissao.cotacoes_auto?.id || null,
          coluna: emissao.coluna || 'apolice_emitida',
          criar_apolice: true,
        })
      }
      return atualizarApoliceAutoSemEmissao(apolice.id, form)
    },
    onSuccess: async () => {
      setSaveError('')
      await qc.invalidateQueries({ queryKey: ['auto-apolice-detalhe', id] })
      await qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-clientes-carteira'] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
    },
    onError: error => setSaveError(error?.message || 'Não foi possível salvar as alterações.'),
  })

  const statusAtual = useMemo(() => {
    if (!apolice) return '—'
    const emissao = apolice.emissoes_auto || {}
    const coluna = getEmissaoColuna({ ...emissao, apolices_auto: [apolice] })
    if (coluna === 'apolice_emitida') return 'Apólice emitida'
    const labels = {
      pendentes: 'Pendente',
      cotacao_feita: 'Cotação feita',
      negociando: 'Em negociação',
      aguardando_vistoria: 'Aguardando vistoria',
      proposta_transmitida: 'Proposta transmitida',
      apolice_emitida: 'Apólice emitida',
    }
    return labels[coluna] || 'Apólice emitida'
  }, [apolice])

  const dirty = useMemo(() => (
    Boolean(apolice && form && JSON.stringify(form) !== JSON.stringify(buildForm(apolice)))
  ), [apolice, form])

  const valorComissao = useMemo(() => (
    calcularValorComissaoAuto(form?.premio_liquido, form?.pct_comissao)
  ), [form?.premio_liquido, form?.pct_comissao])

  useEffect(() => {
    if (!dirty) return undefined
    const beforeUnload = event => {
      event.preventDefault()
      event.returnValue = ''
    }
    const saveShortcut = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (!salvar.isPending) salvar.mutate()
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('keydown', saveShortcut)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('keydown', saveShortcut)
    }
  }, [dirty, salvar])

  const copyValue = async (label, value) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(String(value))
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1800)
    } catch {
      setSaveError('Não foi possível copiar o dado automaticamente.')
    }
  }

  if (isLoading || !form) {
    return (
      <div className="auto-page auto-v2-page">
        <AutoLoading label="Carregando apólice..." />
      </div>
    )
  }

  if (!apolice) {
    return <EmptyState title="Apólice não encontrada" description="O registro pode ter sido removido." />
  }

  const setField = campo => value => setForm(current => ({ ...current, [campo]: value }))
  const tipoReal = form.tipo || (form.eh_renovacao ? 'renovacao' : 'novo')

  return (
    <div className="auto-page auto-v2-page">
      <AutoPageHeader
        context="Apólice Auto"
        title={form.numero_apolice || 'Apólice sem número'}
        description={`${form.nome_cliente || 'Cliente não informado'} · ${form.modelo_veiculo || 'Veículo não informado'}`}
        onBack={() => navigate('/auto/emissoes')}
        backLabel="Apólices e emissões"
        meta={(
          <>
            <AutoTypeBadge type={tipoReal} />
            <AutoBadge tone={statusAtual === 'Recusada' ? 'danger' : 'success'}>{statusAtual}</AutoBadge>
            {dirty && <AutoBadge tone="warning">Alterações pendentes</AutoBadge>}
            {copied && <AutoBadge tone="success">{copied} copiado</AutoBadge>}
          </>
        )}
      />

      <AutoStatStrip
        items={[
          {
            label: 'Seguradora',
            value: form.seguradora || '—',
            hint: 'companhia vinculada',
            icon: ShieldCheck,
            tone: 'new',
          },
          {
            label: 'Vigência final',
            value: formatDateBR(form.vigencia_fim),
            hint: `início ${formatDateBR(form.vigencia_inicio)}`,
            icon: Clock3,
            tone: 'warning',
          },
          {
            label: 'Prêmio líquido',
            value: formatMoney(form.premio_liquido || 0),
            hint: 'valor da apólice',
            icon: CreditCard,
            tone: 'success',
          },
          {
            label: 'Comissão',
            value: formatMoney(valorComissao),
            hint: `${Number(form.pct_comissao) || 0}% menos retenção`,
            icon: FileText,
            tone: 'renewal',
          },
        ]}
      />

      <AutoTabs items={TABS} value={tab} onChange={setTab} ariaLabel="Áreas da apólice" />

      {saveError && (
        <AutoInlineAlert
          tone="danger"
          title="Não foi possível concluir a ação"
          description={saveError}
        />
      )}

      {tab === 'resumo' && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <AutoPanel title="Resumo da apólice">
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <SeguradoraBadge nome={form.seguradora} size="xxl" showName={false} />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-dark-text">{form.seguradora || 'Seguradora não informada'}</p>
                <p className="mt-1 text-sm text-dark-muted">{form.numero_apolice || 'Número da apólice pendente'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <AutoTypeBadge type={tipoReal} />
                  {apolice.origem_pre_sistema && <AutoBadge tone="warning">Anterior ao sistema</AutoBadge>}
                </div>
              </div>
            </div>
          </AutoPanel>

          <AutoPanel title="Vigência">
            <AutoInfoGrid
              items={[
                { label: 'Início', value: formatDateBR(form.vigencia_inicio) },
                { label: 'Fim', value: formatDateBR(form.vigencia_fim) },
                { label: 'Emissão', value: formatDateBR(apolice.data_emissao) },
                { label: 'Responsável', value: form.responsavel },
              ]}
            />
          </AutoPanel>

          <AutoPanel className="xl:col-span-2" title="Visão consolidada">
            <AutoInfoGrid
              items={[
                { label: 'Segurado', value: form.nome_cliente },
                { label: 'CPF', value: form.cpf_cliente },
                { label: 'Veículo', value: form.modelo_veiculo },
                { label: 'Placa', value: form.placa },
                { label: 'Forma de pagamento', value: form.forma_pagamento },
                { label: 'Parcelamento', value: form.parcelamento },
              ]}
            />
          </AutoPanel>

          <AutoPanel className="xl:col-span-2" title="Ações rápidas" description="Contato e dados essenciais sem interromper a consulta.">
            <div className="auto-quote-quick-actions auto-policy-quick-actions">
              <a
                href={form.celular_cliente ? `tel:${String(form.celular_cliente).replace(/\D/g, '')}` : undefined}
                aria-disabled={!form.celular_cliente}
                className={!form.celular_cliente ? 'is-disabled' : ''}
              >
                <Phone aria-hidden="true" />
                <span><strong>Ligar para o segurado</strong><small>{form.celular_cliente || 'Celular pendente'}</small></span>
              </a>
              <a
                href={form.email_cliente ? `mailto:${form.email_cliente}` : undefined}
                aria-disabled={!form.email_cliente}
                className={!form.email_cliente ? 'is-disabled' : ''}
              >
                <Mail aria-hidden="true" />
                <span><strong>Enviar e-mail</strong><small>{form.email_cliente || 'E-mail pendente'}</small></span>
              </a>
              <button type="button" onClick={() => copyValue('Apólice', form.numero_apolice)} disabled={!form.numero_apolice}>
                <Copy aria-hidden="true" />
                <span><strong>Copiar nº da apólice</strong><small>{form.numero_apolice || 'Número pendente'}</small></span>
              </button>
              <button type="button" onClick={() => copyValue('Placa', form.placa)} disabled={!form.placa}>
                <Copy aria-hidden="true" />
                <span><strong>Copiar placa</strong><small>{form.placa || 'Placa pendente'}</small></span>
              </button>
            </div>
          </AutoPanel>
        </div>
      )}

      {tab === 'segurado' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <AutoPanel title="Dados do segurado">
            <FormGrid>
              <Field label="Nome" value={form.nome_cliente} onChange={setField('nome_cliente')} />
              <Field label="CPF" value={form.cpf_cliente} onChange={setField('cpf_cliente')} />
              <Field label="Celular" value={form.celular_cliente} onChange={setField('celular_cliente')} />
              <Field label="Email" value={form.email_cliente} onChange={setField('email_cliente')} />
            </FormGrid>
          </AutoPanel>

          <AutoPanel title="Condutor e veículo">
            <FormGrid>
              <Field label="Condutor" value={form.condutor_nome} onChange={setField('condutor_nome')} />
              <Field label="CPF do condutor" value={form.condutor_cpf} onChange={setField('condutor_cpf')} />
              <Field label="Modelo" value={form.modelo_veiculo} onChange={setField('modelo_veiculo')} />
              <Field label="Placa" value={form.placa} onChange={setField('placa')} />
            </FormGrid>
          </AutoPanel>
        </div>
      )}

      {tab === 'apolice' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <AutoPanel title="Identificação">
            <FormGrid>
              <Field label="Seguradora" value={form.seguradora} onChange={setField('seguradora')} />
              <Field label="Número da apólice" value={form.numero_apolice} onChange={setField('numero_apolice')} />
              <Field label="Responsável" value={form.responsavel} onChange={setField('responsavel')} />
              <Field label="Tipo de produção" value={form.tipo_producao} onChange={setField('tipo_producao')} />
            </FormGrid>
          </AutoPanel>

          <AutoPanel title="Vigência e origem">
            <FormGrid>
              <Field label="Início da vigência" type="date" value={form.vigencia_inicio} onChange={setField('vigencia_inicio')} />
              <Field label="Final da vigência" type="date" value={form.vigencia_fim} onChange={setField('vigencia_fim')} />
              <Field label="Origem do lead" value={form.origem_lead} onChange={setField('origem_lead')} />
            </FormGrid>
          </AutoPanel>
        </div>
      )}

      {tab === 'financeiro' && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <AutoPanel title="Dados financeiros">
            <FormGrid>
              <Field label="Prêmio líquido" value={String(form.premio_liquido ?? '')} onChange={setField('premio_liquido')} inputMode="decimal" />
              <Field label="% comissão" value={String(form.pct_comissao ?? '')} onChange={setField('pct_comissao')} inputMode="decimal" />
              <Field label="Forma de pagamento" value={form.forma_pagamento} onChange={setField('forma_pagamento')} />
              <Field label="Parcelamento" value={String(form.parcelamento ?? '')} onChange={setField('parcelamento')} />
            </FormGrid>
          </AutoPanel>

          <AutoPanel title="Comissão calculada">
            <AutoMoneyDelta
              current={valorComissao}
              previous={form.renovacao_comissao_ano_anterior}
              format={formatMoney}
            />
          </AutoPanel>
        </div>
      )}

      {tab === 'renovacao' && (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <AutoPanel title="Comparativo anual" description="Valores registrados para apoiar a próxima negociação.">
            <FormGrid>
              <Field label="Prêmio ano anterior" value={String(form.renovacao_premio_liquido_ano_anterior ?? '')} onChange={setField('renovacao_premio_liquido_ano_anterior')} inputMode="decimal" />
              <Field label="Prêmio ano atual" value={String(form.renovacao_premio_liquido_ano_atual ?? '')} onChange={setField('renovacao_premio_liquido_ano_atual')} inputMode="decimal" />
              <Field label="Comissão ano anterior" value={String(form.renovacao_comissao_ano_anterior ?? '')} onChange={setField('renovacao_comissao_ano_anterior')} inputMode="decimal" />
              <Field label="Comissão ano atual" value={String(form.renovacao_comissao_ano_atual ?? '')} onChange={setField('renovacao_comissao_ano_atual')} inputMode="decimal" />
            </FormGrid>
          </AutoPanel>

          <AutoPanel title="Variação de comissão">
            <AutoMoneyDelta
              current={form.renovacao_comissao_ano_atual}
              previous={form.renovacao_comissao_ano_anterior}
              format={formatMoney}
            />
          </AutoPanel>
        </div>
      )}

      {tab === 'historico' && (
        <AutoPanel title="Histórico operacional">
          <div className="auto-v2-stagger space-y-2">
            <AutoListRow
              title="Apólice criada"
              subtitle={formatDateTimeBR(apolice.created_at)}
              meta={`ID ${apolice.id}`}
              leading={<ShieldCheck />}
            />
            <AutoListRow
              title="Emissão vinculada"
              subtitle={formatDateTimeBR(apolice.emissoes_auto?.created_at)}
              meta={apolice.emissoes_auto?.id || 'Sem vínculo'}
              leading={<FileText />}
            />
            <AutoListRow
              title="Cotação vinculada"
              subtitle={apolice.emissoes_auto?.cotacoes_auto?.status || 'Sem status'}
              meta={apolice.emissoes_auto?.cotacoes_auto?.id || 'Sem vínculo'}
              leading={<FileText />}
              onClick={apolice.emissoes_auto?.cotacoes_auto?.id
                ? () => navigate(`/auto/cotacoes/${apolice.emissoes_auto.cotacoes_auto.id}`)
                : undefined}
            />
            <AutoListRow
              title="Renovações relacionadas"
              subtitle={`${apolice.renovacoes_auto?.length || 0} registro(s)`}
              meta={formatDateTimeBR(apolice.updated_at)}
              leading={<CalendarDays />}
            />
          </div>
        </AutoPanel>
      )}

      <AutoStickyActions>
        {salvar.isSuccess && !dirty && <AutoBadge tone="success">Alterações salvas</AutoBadge>}
        <button
          type="button"
          onClick={() => setForm(buildForm(apolice))}
          disabled={!dirty || salvar.isPending}
          className="btn-secondary disabled:opacity-40"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={() => salvar.mutate()}
          disabled={!dirty || salvar.isPending}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {salvar.isPending ? 'Salvando...' : dirty ? 'Salvar alterações' : 'Tudo salvo'}
        </button>
      </AutoStickyActions>
    </div>
  )
}
