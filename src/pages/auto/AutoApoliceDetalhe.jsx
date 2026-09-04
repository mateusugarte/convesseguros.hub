import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Clock3, CreditCard, FileText, Save, ShieldCheck } from 'lucide-react'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import { DataCard, EmptyState, MetricCard, PageHeader } from '../../components/ui'
import { atualizarApoliceAutoSemEmissao, atualizarEmissaoAutoCompleta, calcularValorComissaoAuto, getApoliceAutoDetalhe } from '../../lib/auto'
import { formatDateBR, formatDateTimeBR, formatMoney } from './autoShared'
import { useVoltar } from '../../hooks/useVoltar.js'

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
    data_emissao: apolice?.data_emissao || '',
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

function Field({ label, value, onChange, type = 'text', inputMode, textarea = false }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={4} className="w-full rounded-2xl border border-dark-border bg-dark-surface/80 px-3 py-2 text-sm text-dark-text outline-none" />
      ) : (
        <input type={type} inputMode={inputMode} value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-2xl border border-dark-border bg-dark-surface/80 px-3 py-2 text-sm text-dark-text outline-none" />
      )}
    </div>
  )
}

function ReadItem({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">{label}</p>
      <p className="mt-1 text-sm text-dark-text">{value || '—'}</p>
    </div>
  )
}

export default function AutoApoliceDetalhe() {
  const voltar = useVoltar('/auto/emissoes')
  const { id } = useParams()
  const qc = useQueryClient()
  const { data: apolice, isLoading } = useQuery({ queryKey: ['auto-apolice-detalhe', id], queryFn: () => getApoliceAutoDetalhe(id), enabled: Boolean(id) })
  const [form, setForm] = useState(null)

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
      await qc.invalidateQueries({ queryKey: ['auto-apolice-detalhe', id] })
      await qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-clientes-carteira'] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
    },
  })

  const statusAtual = useMemo(() => {
    if (!apolice) return '—'
    const emissao = apolice.emissoes_auto || {}
    return emissao.coluna || 'apolice_emitida'
  }, [apolice])

  if (isLoading || !form) return <div className="py-16 text-center text-sm text-dark-muted">Carregando apólice...</div>
  if (!apolice) return <EmptyState title="Apólice não encontrada" description="O registro pode ter sido removido." />

  return (
    <div className="auto-page space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Seguro Auto"
        title={form.numero_apolice || 'Apólice Auto'}
        description="Área interna dedicada da apólice, seguindo o mesmo padrão de detalhamento, leitura e edição das áreas maduras do sistema."
        actions={(
          <div className="flex flex-wrap gap-2">
            <button onClick={voltar} className="btn-secondary inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</button>
            <button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="btn-primary inline-flex items-center gap-2"><Save className="h-4 w-4" /> {salvar.isPending ? 'Salvando...' : 'Salvar alterações'}</button>
          </div>
        )}
        stats={(
          <>
            <MetricCard label="Seguradora" value={form.seguradora || '—'} hint="companhia vinculada" tone="accent" icon={<ShieldCheck className="h-4 w-4" />} />
            <MetricCard label="Status" value={statusAtual} hint="situação operacional" tone="secondary" icon={<Clock3 className="h-4 w-4" />} />
            <MetricCard label="Prêmio líquido" value={formatMoney(form.premio_liquido || 0)} hint="valor da apólice" tone="success" icon={<CreditCard className="h-4 w-4" />} />
            <MetricCard label="Comissão" value={formatMoney(calcularValorComissaoAuto(form.premio_liquido, form.pct_comissao))} hint="estimada na emissão" tone="warning" icon={<FileText className="h-4 w-4" />} />
          </>
        )}
      />

      <DataCard bodyClassName="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-info">Resumo da seguradora</p>
            <div className="mt-2 flex items-center gap-4">
              <SeguradoraBadge nome={form.seguradora} size="xxl" showName={false} />
              <div>
                <p className="text-xl font-semibold text-dark-text">{form.seguradora || 'Seguradora não informada'}</p>
                <p className="text-sm text-dark-muted">Emissão: {formatDateTimeBR(apolice.emissoes_auto?.created_at || apolice.created_at)}</p>
              </div>
            </div>
          </div>
          <div className="rounded-[28px] border border-dark-border/70 bg-dark-surface/70 p-4 text-sm text-dark-muted">
            <p className="font-semibold text-dark-text">Vigência</p>
            <p className="mt-1">{formatDateBR(form.vigencia_inicio)} até {formatDateBR(form.vigencia_fim)}</p>
          </div>
        </div>
      </DataCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <DataCard title="Dados do cliente"><div className="grid gap-3 md:grid-cols-2"><Field label="Nome" value={form.nome_cliente} onChange={value => setForm(current => ({ ...current, nome_cliente: value }))} /><Field label="CPF" value={form.cpf_cliente} onChange={value => setForm(current => ({ ...current, cpf_cliente: value }))} /><Field label="Celular" value={form.celular_cliente} onChange={value => setForm(current => ({ ...current, celular_cliente: value }))} /><Field label="Email" value={form.email_cliente} onChange={value => setForm(current => ({ ...current, email_cliente: value }))} /></div></DataCard>
        <DataCard title="Dados do veículo"><div className="grid gap-3 md:grid-cols-2"><Field label="Condutor" value={form.condutor_nome} onChange={value => setForm(current => ({ ...current, condutor_nome: value }))} /><Field label="CPF do condutor" value={form.condutor_cpf} onChange={value => setForm(current => ({ ...current, condutor_cpf: value }))} /><Field label="Modelo" value={form.modelo_veiculo} onChange={value => setForm(current => ({ ...current, modelo_veiculo: value }))} /><Field label="Placa" value={form.placa} onChange={value => setForm(current => ({ ...current, placa: value }))} /></div></DataCard>
        <DataCard title="Dados da seguradora"><div className="grid gap-3 md:grid-cols-2"><Field label="Seguradora" value={form.seguradora} onChange={value => setForm(current => ({ ...current, seguradora: value }))} /><Field label="Número da apólice" value={form.numero_apolice} onChange={value => setForm(current => ({ ...current, numero_apolice: value }))} /><Field label="Responsável" value={form.responsavel} onChange={value => setForm(current => ({ ...current, responsavel: value }))} /><Field label="Tipo de produção" value={form.tipo_producao} onChange={value => setForm(current => ({ ...current, tipo_producao: value }))} /></div></DataCard>
        <DataCard title="Dados da emissão"><div className="grid gap-3 md:grid-cols-2"><ReadItem label="ID da emissão" value={apolice.emissoes_auto?.id} /><ReadItem label="Etapa" value={statusAtual} /><ReadItem label="Criada em" value={formatDateTimeBR(apolice.emissoes_auto?.created_at)} /><Field label="Data de emissão" type="date" value={form.data_emissao} onChange={value => setForm(current => ({ ...current, data_emissao: value }))} /><Field label="Origem do lead" value={form.origem_lead} onChange={value => setForm(current => ({ ...current, origem_lead: value }))} /></div></DataCard>
        <DataCard title="Dados financeiros"><div className="grid gap-3 md:grid-cols-2"><Field label="Prêmio líquido" value={String(form.premio_liquido ?? '')} onChange={value => setForm(current => ({ ...current, premio_liquido: value }))} inputMode="decimal" /><Field label="% comissão" value={String(form.pct_comissao ?? '')} onChange={value => setForm(current => ({ ...current, pct_comissao: value }))} inputMode="decimal" /><Field label="Forma de pagamento" value={form.forma_pagamento} onChange={value => setForm(current => ({ ...current, forma_pagamento: value }))} /><Field label="Parcelamento" value={String(form.parcelamento ?? '')} onChange={value => setForm(current => ({ ...current, parcelamento: value }))} /></div></DataCard>
        <DataCard title="Vigência"><div className="grid gap-3 md:grid-cols-2"><Field label="Início da vigência" value={form.vigencia_inicio} onChange={value => setForm(current => ({ ...current, vigencia_inicio: value }))} type="date" /><Field label="Final da vigência" value={form.vigencia_fim} onChange={value => setForm(current => ({ ...current, vigencia_fim: value }))} type="date" /><ReadItem label="Criada em" value={formatDateTimeBR(apolice.created_at)} /><ReadItem label="Atualizada em" value={formatDateTimeBR(apolice.updated_at)} /></div></DataCard>
        <DataCard title="Renovação"><div className="grid gap-3 md:grid-cols-2"><Field label="Prêmio ano anterior" value={String(form.renovacao_premio_liquido_ano_anterior ?? '')} onChange={value => setForm(current => ({ ...current, renovacao_premio_liquido_ano_anterior: value }))} inputMode="decimal" /><Field label="Comissão ano anterior" value={String(form.renovacao_comissao_ano_anterior ?? '')} onChange={value => setForm(current => ({ ...current, renovacao_comissao_ano_anterior: value }))} inputMode="decimal" /><Field label="Prêmio ano atual" value={String(form.renovacao_premio_liquido_ano_atual ?? '')} onChange={value => setForm(current => ({ ...current, renovacao_premio_liquido_ano_atual: value }))} inputMode="decimal" /><Field label="Comissão ano atual" value={String(form.renovacao_comissao_ano_atual ?? '')} onChange={value => setForm(current => ({ ...current, renovacao_comissao_ano_atual: value }))} inputMode="decimal" /></div></DataCard>
        <DataCard title="Histórico"><div className="space-y-3 text-sm text-dark-muted"><div className="rounded-2xl border border-dark-border/70 bg-dark-surface/60 p-3">Cotação vinculada: <span className="font-semibold text-dark-text">{apolice.emissoes_auto?.cotacoes_auto?.id || '—'}</span></div><div className="rounded-2xl border border-dark-border/70 bg-dark-surface/60 p-3">Emissão vinculada: <span className="font-semibold text-dark-text">{apolice.emissoes_auto?.id || '—'}</span></div><div className="rounded-2xl border border-dark-border/70 bg-dark-surface/60 p-3">Renovações relacionadas: <span className="font-semibold text-dark-text">{apolice.renovacoes_auto?.length || 0}</span></div></div></DataCard>
        <DataCard title="Observações"><div className="rounded-2xl border border-dark-border/70 bg-dark-surface/60 p-4 text-sm text-dark-muted">{form.origem_lead ? `Origem cadastrada: ${form.origem_lead}` : 'Sem observações livres cadastradas nesta emissão.'}</div></DataCard>
      </div>
    </div>
  )
}
