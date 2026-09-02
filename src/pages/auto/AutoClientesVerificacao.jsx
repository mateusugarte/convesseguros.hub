import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Car, CheckCircle2, Mail, Merge, Phone, Search, ShieldAlert, UserCheck, Users, UserX, X } from 'lucide-react'
import { AutoBadge, AutoLoading, AutoPageHeader, AutoPanel, AutoStatStrip } from '../../components/auto'
import { EmptyState } from '../../components/ui'
import { useToast } from '../../contexts/ToastContext'
import { getAutoClientVerificationData, mesclarClientesAuto, salvarAutoClientVerification } from '../../lib/auto'
import { buildClientVerificationPairs, normalizeClientVerificationName } from '../../lib/autoClientVerification'
import { formatDateBR } from './autoShared'
import { useVoltar } from '../../hooks/useVoltar.js'

const FILTERS = [
  { value: 'pendentes', label: 'Pendentes' },
  { value: 'mesmo_cliente', label: 'Mesmo cliente' },
  { value: 'clientes_diferentes', label: 'Diferentes' },
  { value: 'todos', label: 'Todos' },
]

function decisionFor(pair) {
  return pair.verificacao?.decisao || 'pendentes'
}

function maskedCpf(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 11) return value || 'CPF não informado'
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

function ClientComparisonCard({ client, label, onOpen }) {
  const vehicles = client.veiculos || []
  return (
    <article className="auto-client-compare-card">
      <header>
        <span>{label}</span>
        <button type="button" onClick={onOpen}>Abrir cadastro</button>
      </header>
      <h3>{client.nome_completo || 'Cliente sem nome'}</h3>
      <div className="auto-client-compare-facts">
        <p><ShieldAlert /><span><small>CPF</small><strong>{maskedCpf(client.cpf)}</strong></span></p>
        <p><Phone /><span><small>Contato</small><strong>{client.celular || client.telefone || 'Não informado'}</strong></span></p>
        <p><Mail /><span><small>E-mail</small><strong>{client.email || 'Não informado'}</strong></span></p>
        <p><Users /><span><small>Cadastro criado</small><strong>{formatDateBR(client.created_at)}</strong></span></p>
      </div>
      <div className="auto-client-compare-vehicles">
        <span><Car /> Veículos e apólices relacionados</span>
        {vehicles.length === 0 ? <small>Nenhum veículo vinculado.</small> : vehicles.slice(0, 3).map(vehicle => (
          <div key={vehicle.id}>
            <strong>{vehicle.modelo_veiculo || 'Modelo não informado'}</strong>
            <small>{vehicle.placa || 'Sem placa'} · vigência até {formatDateBR(vehicle.vigencia_fim)}</small>
          </div>
        ))}
        {vehicles.length > 3 && <small>+ {vehicles.length - 3} outro(s) registro(s)</small>}
      </div>
    </article>
  )
}

export default function AutoClientesVerificacao() {
  const voltar = useVoltar('/auto/clientes')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [filter, setFilter] = useState('pendentes')
  const [search, setSearch] = useState('')
  const [mergePair, setMergePair] = useState(null)
  const [principalId, setPrincipalId] = useState('')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['auto-clientes-verificacao'],
    queryFn: getAutoClientVerificationData,
  })
  const pairs = useMemo(() => buildClientVerificationPairs(data?.clientes || [], data?.verificacoes || []), [data])
  const counts = useMemo(() => ({
    pendentes: pairs.filter(pair => !pair.verificacao).length,
    mesmo_cliente: pairs.filter(pair => pair.verificacao?.decisao === 'mesmo_cliente').length,
    clientes_diferentes: pairs.filter(pair => pair.verificacao?.decisao === 'clientes_diferentes').length,
  }), [pairs])
  const visiblePairs = useMemo(() => {
    const term = normalizeClientVerificationName(search)
    return pairs.filter(pair => {
      if (filter !== 'todos' && decisionFor(pair) !== filter) return false
      if (!term) return true
      return normalizeClientVerificationName(`${pair.clienteA.nome_completo} ${pair.clienteB.nome_completo}`).includes(term)
    })
  }, [filter, pairs, search])

  const saveDecision = useMutation({
    mutationFn: variables => variables.decisao === 'mesmo_cliente'
      ? mesclarClientesAuto({ principalId: variables.principalId, duplicadoId: variables.duplicadoId })
      : salvarAutoClientVerification(variables),
    onSuccess: async (saved, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['auto-clientes-verificacao'] })
      await queryClient.invalidateQueries({ queryKey: ['auto-clientes'] })
      await queryClient.invalidateQueries({ queryKey: ['auto-clientes-carteira'] })
      toast({
        type: 'success',
        title: variables.decisao === 'mesmo_cliente' ? 'Clientes unificados' : 'Verificação registrada',
        message: variables.decisao === 'mesmo_cliente'
          ? `As cotações, renovações e apólices agora pertencem a um único cliente${saved?.apolices_movidas ? ` · ${saved.apolices_movidas} apólice(s) movida(s)` : ''}.`
          : saved?.persistence === 'local'
          ? 'Decisão salva neste dispositivo. Aplique a atualização 71 para compartilhar a verificação com toda a equipe.'
          : 'Os cadastros foram confirmados como clientes diferentes.',
      })
      setMergePair(null)
    },
    onError: mutationError => toast({ type: 'error', title: 'Não foi possível registrar', message: mutationError?.message || 'Tente novamente.' }),
  })

  const decide = (pair, decisao) => {
    if (decisao === 'mesmo_cliente') {
      const oldest = [pair.clienteA, pair.clienteB]
        .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))[0]
      setPrincipalId(oldest?.id || pair.clienteA.id)
      setMergePair(pair)
      return
    }
    saveDecision.mutate({ clienteAId: pair.clienteA.id, clienteBId: pair.clienteB.id, decisao })
  }

  const confirmMerge = () => {
    if (!mergePair || !principalId) return
    const duplicadoId = mergePair.clienteA.id === principalId ? mergePair.clienteB.id : mergePair.clienteA.id
    saveDecision.mutate({ decisao: 'mesmo_cliente', principalId, duplicadoId })
  }

  return (
    <div className="auto-page auto-v2-page auto-client-verification-page">
      <AutoPageHeader
        context="Carteira Auto · Qualidade da base"
        title="Verificação de clientes"
        description="Compare cadastros com nomes iguais ou parecidos e una apólices, renovações e cotações quando representam a mesma pessoa."
        actions={<button type="button" onClick={voltar} className="btn-secondary inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Voltar</button>}
      />

      <AutoStatStrip className="auto-client-verification-stats" items={[
        { label: 'Pendentes', value: counts.pendentes, hint: 'aguardando decisão', icon: ShieldAlert, tone: 'warning' },
        { label: 'Mesmo cliente', value: counts.mesmo_cliente, hint: 'confirmados manualmente', icon: UserCheck, tone: 'success' },
        { label: 'Diferentes', value: counts.clientes_diferentes, hint: 'homônimos ou semelhantes', icon: UserX, tone: 'neutral' },
        { label: 'Candidatos', value: pairs.length, hint: 'pares encontrados', icon: Users, tone: 'info' },
      ]} />

      <div className="auto-client-verification-notice">
        <Merge />
        <div><strong>Unificação segura de carteira</strong><span>Ao confirmar o mesmo cliente, você escolhe o cadastro principal e todos os vínculos do outro cadastro são movidos antes da duplicata ser removida.</span></div>
      </div>

      {data?.persistence === 'local' && (
        <div className="auto-client-verification-notice is-local" role="status">
          <ShieldAlert />
          <div><strong>Modo local temporário</strong><span>Os clientes já podem ser comparados e classificados neste dispositivo. Para compartilhar as decisões com a equipe, aplique a atualização 71 no Supabase.</span></div>
        </div>
      )}

      <AutoPanel title="Fila de comparação" description={`${visiblePairs.length} par(es) exibido(s). Os pendentes mais semelhantes aparecem primeiro.`}>
        <div className="auto-client-verification-toolbar">
          <div>{FILTERS.map(item => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={filter === item.value ? 'is-active' : ''}>{item.label}{item.value !== 'todos' && <b>{counts[item.value] || 0}</b>}</button>)}</div>
          <label><Search /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar nome nos pares" /></label>
        </div>

        {isLoading ? <AutoLoading label="Analisando nomes da carteira..." /> : isError ? (
          <EmptyState icon={<ShieldAlert />} title="Verificação indisponível" description={error?.message || 'Não foi possível carregar os clientes.'} />
        ) : visiblePairs.length === 0 ? (
          <EmptyState icon={<CheckCircle2 />} title={filter === 'pendentes' ? 'Nenhuma verificação pendente' : 'Nenhum par neste filtro'} description="Os nomes encontrados já foram classificados ou não existem candidatos semelhantes neste momento." />
        ) : (
          <div className="auto-client-verification-list">
            {visiblePairs.map(pair => {
              const currentDecision = pair.verificacao?.decisao
              const saving = saveDecision.isPending
                && saveDecision.variables?.clienteAId === pair.clienteA.id
                && saveDecision.variables?.clienteBId === pair.clienteB.id
              return (
                <section key={pair.key} className="auto-client-verification-pair">
                  <header>
                    <div>
                      <AutoBadge tone={pair.tipoCorrespondencia === 'nome_igual' ? 'warning' : 'info'}>{pair.tipoCorrespondencia === 'nome_igual' ? 'Nome igual' : 'Nome parecido'}</AutoBadge>
                      {currentDecision && <AutoBadge tone={currentDecision === 'mesmo_cliente' ? 'success' : 'neutral'}>{currentDecision === 'mesmo_cliente' ? 'Mesmo cliente' : 'Clientes diferentes'}</AutoBadge>}
                    </div>
                    <span><strong>{Math.round(pair.score * 100)}%</strong> de semelhança</span>
                  </header>
                  <div className="auto-client-verification-comparison">
                    <ClientComparisonCard client={pair.clienteA} label="Cadastro A" onOpen={() => navigate(`/auto/clientes/${pair.clienteA.id}`)} />
                    <div className="auto-client-compare-versus">OU</div>
                    <ClientComparisonCard client={pair.clienteB} label="Cadastro B" onOpen={() => navigate(`/auto/clientes/${pair.clienteB.id}`)} />
                  </div>
                  <footer>
                    <span>Estes dois cadastros pertencem à mesma pessoa?</span>
                    <div>
                      <button type="button" disabled={saving} onClick={() => decide(pair, 'clientes_diferentes')} className={currentDecision === 'clientes_diferentes' ? 'is-selected is-different' : 'is-different'}><UserX />Não, são diferentes</button>
                      <button type="button" disabled={saving} onClick={() => decide(pair, 'mesmo_cliente')} className={currentDecision === 'mesmo_cliente' ? 'is-selected is-same' : 'is-same'}><UserCheck />Sim, é o mesmo cliente</button>
                    </div>
                  </footer>
                </section>
              )
            })}
          </div>
        )}
      </AutoPanel>

      {mergePair && <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
        <button className="modal-backdrop" onClick={() => setMergePair(null)} aria-label="Fechar" />
        <section className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[28px] border border-dark-border/70 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="merge-client-title">
          <header className="flex items-start gap-4 border-b border-dark-border/60 bg-gradient-to-br from-brand-accent/10 via-white to-status-success/5 p-6">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-accent/12 text-brand-accent"><Merge className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><small className="font-semibold uppercase tracking-[.14em] text-brand-accent">Unificar carteira</small><h2 id="merge-client-title" className="mt-1 text-xl font-semibold text-dark-text">Qual cadastro deve ser mantido?</h2><p className="mt-1 text-sm text-dark-muted">Todas as apólices e históricos serão reunidos nele. Esta ação remove somente o cadastro duplicado.</p></div>
            <button type="button" onClick={() => setMergePair(null)} className="rounded-full p-2 text-dark-muted hover:bg-dark-border/40"><X className="h-5 w-5" /></button>
          </header>
          <div className="grid gap-3 p-6 md:grid-cols-2">{[mergePair.clienteA, mergePair.clienteB].map(client => {
            const selected = principalId === client.id
            return <button key={client.id} type="button" onClick={() => setPrincipalId(client.id)} className={`rounded-2xl border p-4 text-left transition ${selected ? 'border-brand-accent bg-brand-accent/8 shadow-sm' : 'border-dark-border hover:border-brand-accent/40'}`}><span className="flex items-center justify-between gap-2"><strong className="text-dark-text">{client.nome_completo}</strong>{selected && <CheckCircle2 className="h-5 w-5 text-brand-accent" />}</span><small className="mt-2 block text-dark-muted">{maskedCpf(client.cpf)} · {client.veiculos?.length || 0} apólice(s)/veículo(s)</small><small className="mt-1 block text-dark-muted">Cadastro de {formatDateBR(client.created_at)}</small></button>
          })}</div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-dark-border/60 bg-dark-surface2/35 px-6 py-4"><span className="text-xs text-dark-muted">O cadastro mais antigo vem selecionado por padrão.</span><div className="flex gap-2"><button className="btn-secondary" onClick={() => setMergePair(null)}>Cancelar</button><button className="btn-primary" disabled={saveDecision.isPending} onClick={confirmMerge}>{saveDecision.isPending ? 'Unificando…' : 'Unificar clientes'}</button></div></footer>
        </section>
      </div>}
    </div>
  )
}
