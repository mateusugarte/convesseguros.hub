import { useEffect, useState } from 'react'
import { fetchFichasDoOrcamentista, fetchFichas, deletarFicha, STATUS_LABELS, PRODUTO_LABELS } from '../lib/fichas'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import ModalFinalizar from '../components/ModalFinalizar'
import ModalFicha from '../components/ModalFicha'
import DetalhesFicha from '../components/DetalhesFicha'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock, CheckCircle2, FileText, TrendingUp } from 'lucide-react'

function stringColor(str) {
  const c = ['#4A90D9','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#2B5BA8']
  let h = 0; for (let i = 0; i < (str||'').length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}
function initials(n) { return (n||'').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase() || '?' }

function TimeBadge({ since }) {
  const h = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60))
  const [cls, label] = h < 4
    ? ['bg-status-success/15 text-status-success', h < 1 ? '<1h' : `${h}h`]
    : h < 24
    ? ['bg-status-warning/15 text-status-warning', `${h}h`]
    : ['bg-status-danger/15 text-status-danger', `${Math.floor(h/24)}d`]
  return <span className={`badge ${cls} font-mono`}>{label}</span>
}

export default function MinhasFichas() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [abertas,   setAbertas]   = useState([])
  const [passadas,  setPassadas]  = useState([])
  const [tab,       setTab]       = useState('abertas')
  const [loading,   setLoading]   = useState(true)
  const [finalizar, setFinalizar] = useState(null)
  const [detalhe,   setDetalhe]   = useState(null)
  const [editar,    setEditar]    = useState(null)

  const avatarColor = stringColor(profile?.nome || '')

  useEffect(() => {
    if (!user) return
    setLoading(true)
    Promise.all([
      fetchFichasDoOrcamentista(user.id),
      fetchFichas({ tipo: 'passadas_por_mim', orcamentistaId: user.id, pageSize: 100 }),
    ]).then(([ab, { data }]) => {
      setAbertas(ab)
      setPassadas(data)
      setLoading(false)
    })
  }, [user])

  function refresh() {
    if (!user) return
    Promise.all([
      fetchFichasDoOrcamentista(user.id),
      fetchFichas({ tipo: 'passadas_por_mim', orcamentistaId: user.id, pageSize: 100 }),
    ]).then(([ab, { data }]) => { setAbertas(ab); setPassadas(data) })
  }

  const metricas = {
    aprovadas:      passadas.filter(f => f.status === 'aprovado').length,
    recusadas:      passadas.filter(f => f.status === 'recusado').length,
    emitidas:       passadas.filter(f => f.status === 'emitido').length,
    taxaAprovacao:  passadas.length ? Math.round((passadas.filter(f => f.status === 'aprovado').length / passadas.length) * 100) : 0,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
          style={{ background: avatarColor }}
        >
          {initials(profile?.nome)}
        </div>
        <div>
          <h1 className="text-lg font-bold text-dark-text">Minhas Fichas</h1>
          <p className="text-xs text-dark-muted">{profile?.nome}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-status-warning flex-shrink-0" />
          <div>
            <p className="text-xs text-dark-muted">Em Cotação</p>
            <p className="text-2xl font-bold text-dark-text font-mono">{abertas.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-status-success flex-shrink-0" />
          <div>
            <p className="text-xs text-dark-muted">Aprovadas</p>
            <p className="text-2xl font-bold text-status-success font-mono">{metricas.aprovadas}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <FileText className="w-5 h-5 text-brand-accent flex-shrink-0" />
          <div>
            <p className="text-xs text-dark-muted">Finalizadas</p>
            <p className="text-2xl font-bold text-dark-text font-mono">{passadas.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-status-success flex-shrink-0" />
          <div>
            <p className="text-xs text-dark-muted">Taxa Aprovação</p>
            <p className="text-2xl font-bold text-status-success font-mono">{metricas.taxaAprovacao}%</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="flex border-b border-dark-border">
          {[['abertas','Em Cotação'], ['passadas','Finalizadas']].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-5 py-3 text-sm font-medium transition-all border-b-2 -mb-px ${
                tab === k ? 'border-brand-accent text-brand-accent' : 'border-transparent text-dark-muted hover:text-dark-text'
              }`}
            >
              {l} {tab !== k && `(${k === 'abertas' ? abertas.length : passadas.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-dark-muted text-sm">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Carregando...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-dark-surface2/80 border-b border-dark-border">
                <tr>
                  {tab === 'abertas'
                    ? ['Data','Imobiliária','Nome','Produto','Tempo',''].map(h => <th key={h} className="th">{h}</th>)
                    : ['Data','Imobiliária','Nome','Produto','Status','Seguradora'].map(h => <th key={h} className="th">{h}</th>)
                  }
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {(tab === 'abertas' ? abertas : passadas).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="td text-center text-dark-muted py-10">
                      {tab === 'abertas' ? 'Nenhuma ficha em cotação' : 'Nenhuma ficha finalizada ainda'}
                    </td>
                  </tr>
                ) : (tab === 'abertas' ? abertas : passadas).map(f => {
                  const si = STATUS_LABELS[f.status] ?? { label: f.status, color: '' }
                  return (
                    <tr key={f.id} className="table-row" onClick={() => setDetalhe(f.id)}>
                      <td className="td text-dark-muted text-xs font-mono whitespace-nowrap">
                        {format(parseISO(f.created_at), 'dd/MM/yy', { locale: ptBR })}
                      </td>
                      <td className="td font-medium text-dark-text max-w-[140px] truncate">{f.imobiliaria || '—'}</td>
                      <td className="td text-dark-text max-w-[140px] truncate">{f.nome_interessado || '—'}</td>
                      <td className="td text-dark-muted text-xs">{PRODUTO_LABELS[f.produto]}</td>
                      {tab === 'abertas' ? (
                        <>
                          <td className="td"><TimeBadge since={f.assumida_em || f.created_at} /></td>
                          <td className="td text-right" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setFinalizar(f)}
                              className="text-xs px-2.5 py-1 rounded-lg bg-status-success/15 text-status-success border border-status-success/20 hover:bg-status-success/25 transition-colors font-medium"
                            >
                              Finalizar
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="td"><span className={`badge ${si.color}`}>{si.label}</span></td>
                          <td className="td text-dark-muted text-xs">{f.seguradora || '—'}</td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {finalizar && (
        <ModalFinalizar ficha={finalizar} onClose={() => setFinalizar(null)} onSuccess={() => { setFinalizar(null); refresh() }} />
      )}
      {detalhe && (
        <DetalhesFicha
          id={detalhe}
          onClose={() => setDetalhe(null)}
          onEdit={f => { setDetalhe(null); setEditar(f) }}
          onDelete={async id => {
            await deletarFicha(id)
            setDetalhe(null)
            toast({ type: 'success', title: 'Ficha excluída' })
            refresh()
          }}
        />
      )}
      {editar && (
        <ModalFicha
          ficha={editar}
          onClose={() => setEditar(null)}
          onSuccess={() => { setEditar(null); refresh() }}
        />
      )}
    </div>
  )
}
