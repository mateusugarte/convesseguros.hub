import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Car, CheckCircle2, Mail, Phone, Search, ShieldAlert, UserCheck, Users, UserX } from 'lucide-react'
import { AutoBadge, AutoLoading, AutoPageHeader, AutoPanel, AutoStatStrip } from '../../components/auto'
import { EmptyState } from '../../components/ui'
import { useToast } from '../../contexts/ToastContext'
import { getAutoClientVerificationData, salvarAutoClientVerification } from '../../lib/auto'
import { buildClientVerificationPairs, normalizeClientVerificationName } from '../../lib/autoClientVerification'
import { formatDateBR } from './autoShared'

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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [filter, setFilter] = useState('pendentes')
  const [search, setSearch] = useState('')

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
    mutationFn: salvarAutoClientVerification,
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['auto-clientes-verificacao'] })
      toast({
        type: 'success',
        title: 'Verificação registrada',
        message: variables.decisao === 'mesmo_cliente'
          ? 'O par foi marcado como o mesmo cliente. Nenhum cadastro foi mesclado automaticamente.'
          : 'Os cadastros foram confirmados como clientes diferentes.',
      })
    },
    onError: mutationError => toast({ type: 'error', title: 'Não foi possível registrar', message: mutationError?.message || 'Tente novamente.' }),
  })

  const decide = (pair, decisao) => saveDecision.mutate({
    clienteAId: pair.clienteA.id,
    clienteBId: pair.clienteB.id,
    decisao,
  })

  return (
    <div className="auto-page auto-v2-page auto-client-verification-page">
      <AutoPageHeader
        context="Carteira Auto · Qualidade da base"
        title="Verificação de clientes"
        description="Compare cadastros com nomes iguais ou parecidos e registre se representam a mesma pessoa."
        actions={<button type="button" onClick={() => navigate('/auto/clientes')} className="btn-secondary inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Voltar para clientes</button>}
      />

      <AutoStatStrip className="auto-client-verification-stats" items={[
        { label: 'Pendentes', value: counts.pendentes, hint: 'aguardando decisão', icon: ShieldAlert, tone: 'warning' },
        { label: 'Mesmo cliente', value: counts.mesmo_cliente, hint: 'confirmados manualmente', icon: UserCheck, tone: 'success' },
        { label: 'Diferentes', value: counts.clientes_diferentes, hint: 'homônimos ou semelhantes', icon: UserX, tone: 'neutral' },
        { label: 'Candidatos', value: pairs.length, hint: 'pares encontrados', icon: Users, tone: 'info' },
      ]} />

      <div className="auto-client-verification-notice">
        <ShieldAlert />
        <div><strong>Verificação sem alteração automática</strong><span>Marcar “mesmo cliente” registra a decisão, mas não une cadastros, apólices ou cotações. Isso evita perda de dados.</span></div>
      </div>

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
    </div>
  )
}
