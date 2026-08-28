import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlarmClock, BellPlus, CalendarClock, Check, CheckCircle2, Clock3,
  MessageSquarePlus, NotebookPen, Plus, Tags, X,
} from 'lucide-react'
import {
  atualizarAcompanhamentoCotacao, concluirAutoLembrete, criarAutoLembrete,
  getAutoCotacaoWorkflow, getAutoTags, registrarAutoInteracao,
} from '../../lib/auto'
import { DatePicker } from '../ui'

const INTERACTION_TYPES = [
  { value: 'followup', label: 'Follow-up' },
  { value: 'contato', label: 'Contato' },
  { value: 'nota', label: 'Observação' },
]

const fmt = value => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''

export default function AutoWorkflowPanel({ cotacao }) {
  const qc = useQueryClient()
  const [organization, setOrganization] = useState({ proximoPasso: '', proximoPassoEm: '', observacoes: '' })
  const [interaction, setInteraction] = useState({ tipo: 'followup', observacao: '', proximoPasso: '', proximoPassoEm: '' })
  const [reminder, setReminder] = useState({ titulo: '', dataLembrete: '', avisarAntesDias: 1 })
  const [error, setError] = useState('')
  const workflowKey = ['auto-workflow', cotacao.id]
  const { data, isLoading, isError } = useQuery({ queryKey: workflowKey, queryFn: () => getAutoCotacaoWorkflow(cotacao.id) })
  const { data: tags = [] } = useQuery({ queryKey: ['auto-tags'], queryFn: getAutoTags })

  useEffect(() => {
    if (!data?.cotacao) return
    setOrganization({
      proximoPasso: data.cotacao.proximo_passo || '',
      proximoPassoEm: data.cotacao.proximo_passo_em || '',
      observacoes: data.cotacao.observacoes_operacionais || '',
    })
  }, [data?.cotacao?.proximo_passo, data?.cotacao?.proximo_passo_em, data?.cotacao?.observacoes_operacionais])

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: workflowKey }),
      qc.invalidateQueries({ queryKey: ['auto-cotacao', cotacao.id] }),
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] }),
      qc.invalidateQueries({ queryKey: ['auto-pendencias'] }),
    ])
  }

  const interactionMutation = useMutation({
    mutationFn: payload => registrarAutoInteracao({
      cotacaoId: cotacao.id,
      emissaoId: data?.emissao?.id || null,
      clienteId: cotacao.cliente_id || null,
      ...payload,
    }),
    onSuccess: async () => { setError(''); await invalidate() },
    onError: err => setError(err?.message || 'Não foi possível registrar a atividade.'),
  })
  const workflowMutation = useMutation({
    mutationFn: changes => atualizarAcompanhamentoCotacao(cotacao.id, changes),
    onSuccess: invalidate,
    onError: err => setError(err?.message || 'Não foi possível salvar o acompanhamento.'),
  })
  const reminderMutation = useMutation({
    mutationFn: payload => criarAutoLembrete({
      cotacaoId: cotacao.id, emissaoId: data?.emissao?.id || null,
      clienteId: cotacao.cliente_id || null, ...payload,
    }),
    onSuccess: async () => { setReminder({ titulo: '', dataLembrete: '', avisarAntesDias: 1 }); await invalidate() },
    onError: err => setError(err?.message || 'Não foi possível criar o lembrete.'),
  })
  const completeMutation = useMutation({ mutationFn: id => concluirAutoLembrete(id), onSuccess: invalidate })

  const selectedTags = data?.cotacao?.tags || []
  const stage = data?.emissao?.coluna || ''
  const prompt = useMemo(() => {
    if (!stage && ['pendente', 'aberta'].includes(data?.cotacao?.status || cotacao.status)) {
      return {
        eyebrow: 'Confirmação necessária',
        title: 'Esta cotação já foi feita?',
        description: 'Confirme o andamento para manter a fila operacional correta.',
        actions: [
          { label: 'Sim, cotação feita', statusNovo: 'cotacao_feita', primary: true },
          { label: 'Ainda está pendente', statusNovo: null },
        ],
      }
    }
    if (stage === 'cotacao_feita') {
      return {
        eyebrow: 'Próximo passo',
        title: 'Foi dado continuidade ou segue em andamento?',
        description: 'Registre a decisão para o sistema voltar a avisar somente quando necessário.',
        actions: [
          { label: 'Entrou em negociação', statusNovo: 'negociando', primary: true },
          { label: 'Segue em andamento', statusNovo: null },
        ],
      }
    }
    return null
  }, [cotacao.status, data?.cotacao?.status, stage])

  const submitInteraction = event => {
    event.preventDefault()
    if (!interaction.observacao.trim()) return setError('Escreva o que aconteceu neste contato.')
    interactionMutation.mutate({
      tipo: interaction.tipo,
      observacao: interaction.observacao,
      ...(interaction.proximoPasso.trim() ? { proximoPasso: interaction.proximoPasso } : {}),
      ...(interaction.proximoPassoEm ? { proximoPassoEm: interaction.proximoPassoEm } : {}),
    }, { onSuccess: () => setInteraction({ tipo: 'followup', observacao: '', proximoPasso: '', proximoPassoEm: '' }) })
  }

  const submitReminder = event => {
    event.preventDefault()
    if (!reminder.titulo.trim() || !reminder.dataLembrete) return setError('Informe o título e a data do lembrete.')
    reminderMutation.mutate(reminder)
  }

  if (isLoading) return <div className="auto-workflow-loading"><span />Carregando acompanhamento…</div>
  if (isError) return <div className="auto-workflow-error">Execute a migration 68 para ativar acompanhamento, follow-ups e lembretes.</div>

  return (
    <section className="auto-workflow" aria-label="Acompanhamento operacional">
      {error && <div className="auto-workflow-error"><X />{error}</div>}

      {prompt && (
        <article className="auto-workflow-prompt">
          <div><span>{prompt.eyebrow}</span><strong>{prompt.title}</strong><small>{prompt.description}</small></div>
          <div>{prompt.actions.map(action => (
            <button
              key={action.label}
              type="button"
              className={action.primary ? 'is-primary' : ''}
              disabled={interactionMutation.isPending}
              onClick={() => interactionMutation.mutate({
                tipo: 'confirmacao',
                observacao: action.label,
                statusAnterior: stage || 'pendente',
                statusNovo: action.statusNovo,
              })}
            >{action.primary && <Check />}{action.label}</button>
          ))}</div>
        </article>
      )}

      <div className="auto-workflow-grid">
        <article className="auto-workflow-card is-next">
          <header><CalendarClock /><div><span>Organização</span><strong>Próximo passo</strong></div></header>
          <label><span>O que precisa acontecer?</span><input value={organization.proximoPasso} onChange={event => setOrganization(current => ({ ...current, proximoPasso: event.target.value }))} placeholder="Ex.: cobrar retorno da seguradora" /></label>
          <label><span>Quando?</span><DatePicker value={organization.proximoPassoEm} onChange={value => setOrganization(current => ({ ...current, proximoPassoEm: value }))} className="auto-workflow-date-picker" /></label>
          <label><span>Observações do cliente</span><textarea value={organization.observacoes} onChange={event => setOrganization(current => ({ ...current, observacoes: event.target.value }))} rows="3" placeholder="Preferências, contexto e pontos importantes…" /></label>
          <button type="button" onClick={() => workflowMutation.mutate({
            proximo_passo: organization.proximoPasso || null,
            proximo_passo_em: organization.proximoPassoEm || null,
            observacoes_operacionais: organization.observacoes || null,
          })}><Check />Salvar organização</button>
        </article>

        <article className="auto-workflow-card">
          <header><MessageSquarePlus /><div><span>Relacionamento</span><strong>Registrar atividade</strong></div><b>{data?.cotacao?.followups_realizados || 0} contatos</b></header>
          <form onSubmit={submitInteraction}>
            <div className="auto-workflow-type">{INTERACTION_TYPES.map(type => <button key={type.value} type="button" className={interaction.tipo === type.value ? 'is-active' : ''} onClick={() => setInteraction(current => ({ ...current, tipo: type.value }))}>{type.label}</button>)}</div>
            <textarea value={interaction.observacao} onChange={event => setInteraction(current => ({ ...current, observacao: event.target.value }))} rows="3" placeholder="O que foi conversado ou decidido?" />
            <div className="auto-workflow-inline"><input value={interaction.proximoPasso} onChange={event => setInteraction(current => ({ ...current, proximoPasso: event.target.value }))} placeholder="Próximo passo (opcional)" /><DatePicker value={interaction.proximoPassoEm} onChange={value => setInteraction(current => ({ ...current, proximoPassoEm: value }))} className="auto-workflow-date-picker" /></div>
            <button type="submit" disabled={interactionMutation.isPending}><Plus />Registrar no histórico</button>
          </form>
        </article>

        <article className="auto-workflow-card">
          <header><Tags /><div><span>Contexto visual</span><strong>Etiquetas</strong></div></header>
          <div className="auto-workflow-tags">{tags.filter(tag => tag.ativa).map(tag => {
            const active = selectedTags.includes(tag.id)
            return <button key={tag.id} type="button" className={active ? 'is-active' : ''} style={{ '--tag-color': tag.cor }} onClick={() => workflowMutation.mutate({ tags: active ? selectedTags.filter(id => id !== tag.id) : [...selectedTags, tag.id] })}><i />{tag.nome}{active && <Check />}</button>
          })}{!tags.length && <small>Crie etiquetas em Configurar etiquetas para usá-las aqui.</small>}</div>
        </article>

        <article className="auto-workflow-card">
          <header><BellPlus /><div><span>Alertas pessoais</span><strong>Novo lembrete</strong></div></header>
          <form onSubmit={submitReminder}>
            <input value={reminder.titulo} onChange={event => setReminder(current => ({ ...current, titulo: event.target.value }))} placeholder="Ex.: cobrar proposta assinada" />
            <div className="auto-workflow-inline"><DatePicker value={reminder.dataLembrete} onChange={value => setReminder(current => ({ ...current, dataLembrete: value }))} className="auto-workflow-date-picker" /><select value={reminder.avisarAntesDias} onChange={event => setReminder(current => ({ ...current, avisarAntesDias: Number(event.target.value) }))}><option value="0">Avisar no dia</option><option value="1">1 dia antes + no dia</option><option value="2">2 dias antes</option><option value="7">7 dias antes</option></select></div>
            <button type="submit" disabled={reminderMutation.isPending}><AlarmClock />Criar lembrete</button>
          </form>
          <div className="auto-workflow-reminders">{data?.lembretes?.map(item => <div key={item.id} className={item.concluido_em ? 'is-done' : ''}><Clock3 /><span><strong>{item.titulo}</strong><small>{item.data_lembrete}{item.avisar_antes_dias === 1 ? ' · avisa na véspera' : ''}</small></span>{!item.concluido_em && <button type="button" title="Concluir" onClick={() => completeMutation.mutate(item.id)}><CheckCircle2 /></button>}</div>)}</div>
        </article>
      </div>

      <article className="auto-workflow-history">
        <header><NotebookPen /><div><span>Memória do atendimento</span><strong>Histórico de contatos e decisões</strong></div></header>
        <div>{data?.interacoes?.length ? data.interacoes.map(item => <div key={item.id}><i /><span><strong>{INTERACTION_TYPES.find(type => type.value === item.tipo)?.label || 'Atualização'}</strong><small>{fmt(item.created_at)}</small><p>{item.observacao || item.proximo_passo || 'Andamento confirmado.'}</p>{item.proximo_passo && <em>Próximo: {item.proximo_passo}{item.proximo_passo_em ? ` · ${item.proximo_passo_em}` : ''}</em>}</span></div>) : <small>Nenhuma atividade registrada ainda.</small>}</div>
      </article>
    </section>
  )
}
