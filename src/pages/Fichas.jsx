import { useEffect, useState, useCallback } from 'react'
import {
  fetchFichas, fetchAnosDisponiveis, fetchMesesDisponiveis,
  fetchContagemProdutos, deletarFicha,
  PRODUTO_LABELS, STATUS_LABELS, STATUS_EM_ABERTO, STATUS_PASSADOS,
} from '../lib/fichas'
import { normalizeImobiliaria } from '../lib/normalizeImobiliaria'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import DetalhesFicha from '../components/DetalhesFicha'
import ModalAssumir from '../components/ModalAssumir'
import ModalFinalizar from '../components/ModalFinalizar'
import ModalFicha from '../components/ModalFicha'
import KanbanFichas from '../components/KanbanFichas'
import {
  Home, Briefcase, Building, LayoutGrid,
  ChevronRight, Search, Download, Plus,
  FileText, Clock, CheckCircle2, XCircle,
  AlignJustify, Pencil,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

const PRODUTOS = [
  { key: 'residencial_pf',  label: 'Residencial PF', Icon: Home,        accent: '#4A90D9', bg: 'rgba(74,144,217,0.08)',  border: 'rgba(74,144,217,0.25)' },
  { key: 'comercial_pf',    label: 'Comercial PF',   Icon: Briefcase,   accent: '#10B981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)' },
  { key: 'pessoa_juridica', label: 'Pessoa Jurídica', Icon: Building,   accent: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.25)' },
  { key: 'todos',           label: 'Todos',           Icon: LayoutGrid, accent: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)' },
]

const MESES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// ── Helpers ───────────────────────────────────────────────────────────────────

function stringColor(str) {
  const c = ['#4A90D9','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#2B5BA8']
  let h = 0; for (let i = 0; i < (str||'').length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return c[Math.abs(h) % c.length]
}
function initials(n) {
  return (n||'').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase() || '?'
}

function TimeBadge({ since }) {
  const h = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60))
  const [cls, label] = h < 4
    ? ['bg-status-success/15 text-status-success', h < 1 ? '<1h' : `${h}h`]
    : h < 24
    ? ['bg-status-warning/15 text-status-warning', `${h}h`]
    : ['bg-status-danger/15 text-status-danger', `${Math.floor(h/24)}d`]
  return <span className={`badge ${cls} font-mono`}>{label}</span>
}

function OrcBadge({ nome, isMe }) {
  const color = stringColor(nome || '')
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border ${
      isMe ? 'border-brand-gold/40 text-brand-gold bg-brand-gold/10' : 'border-dark-border text-dark-muted'
    }`}>
      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
            style={{ background: color }}>
        {initials(nome)}
      </span>
      {isMe ? `${nome} (Você)` : nome}
    </span>
  )
}

function exportCSV(fichas, filename) {
  const headers = ['Data','Imobiliária','Nome','CPF','Produto','Status','Orçamentista','Seguradora']
  const rows = fichas.map(f => [
    format(parseISO(f.created_at), 'dd/MM/yyyy'),
    normalizeImobiliaria(f.imobiliaria) || f.imobiliaria || '',
    f.nome_interessado || '',
    f.cpf || '',
    PRODUTO_LABELS[f.produto] || f.produto,
    STATUS_LABELS[f.status]?.label || f.status,
    f.profiles?.nome || '',
    f.seguradora || '',
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click(); URL.revokeObjectURL(url)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Crumb({ onClick, children, active }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm transition-colors ${active ? 'text-dark-text font-semibold' : 'text-dark-muted hover:text-dark-text'}`}
    >
      {children}
    </button>
  )
}

function Pagination({ page, total, pageSize, onPage }) {
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null
  const from = page * pageSize + 1, to = Math.min((page + 1) * pageSize, total)
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-dark-border text-xs text-dark-muted">
      <span>Mostrando {from}–{to} de {total}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 0}
                className="px-2.5 py-1 rounded-lg border border-dark-border hover:border-brand-accent/50 disabled:opacity-30 transition-colors">
          ← Anterior
        </button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          const p = page < 3 ? i : page - 2 + i
          if (p >= pages) return null
          return (
            <button key={p} onClick={() => onPage(p)}
                    className={`w-7 h-7 rounded-lg text-center transition-colors ${p === page ? 'bg-brand-secondary text-white' : 'hover:bg-dark-surface2'}`}>
              {p + 1}
            </button>
          )
        })}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages - 1}
                className="px-2.5 py-1 rounded-lg border border-dark-border hover:border-brand-accent/50 disabled:opacity-30 transition-colors">
          Próximo →
        </button>
      </div>
    </div>
  )
}

function ViewToggle({ view, onChange }) {
  return (
    <div className="flex items-center bg-dark-surface2 border border-dark-border rounded-lg p-0.5 flex-shrink-0">
      {[
        { key: 'kanban', label: 'Kanban', Icon: LayoutGrid },
        { key: 'lista',  label: 'Lista',  Icon: AlignJustify },
      ].map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            view === key
              ? 'bg-brand-secondary text-white shadow-sm'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Fichas() {
  const { user } = useAuth()
  const toast    = useToast()

  const [produto, setProduto] = useState(null)
  const [ano,     setAno]     = useState(null)
  const [mes,     setMes]     = useState(null)
  const [view,    setView]    = useState('kanban')

  const [contagem, setContagem] = useState({})
  const [anos,     setAnos]     = useState([])
  const [meses,    setMeses]    = useState([])

  const [tab,      setTab]      = useState('abertas')
  const [search,   setSearch]   = useState('')
  const [page,     setPage]     = useState(0)
  const [fichas,   setFichas]   = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)

  const PAGE_SIZE = 30

  const [detalhe,   setDetalhe]   = useState(null)
  const [assumir,   setAssumir]   = useState(null)
  const [finalizar, setFinalizar] = useState(null)
  const [criar,     setCriar]     = useState(false)
  const [editar,    setEditar]    = useState(null)

  useEffect(() => {
    fetchContagemProdutos().then(setContagem)
  }, [])

  useEffect(() => {
    if (produto) fetchAnosDisponiveis(produto).then(a => { setAnos(a); setAno(null); setMes(null) })
  }, [produto])

  useEffect(() => {
    if (produto && ano) fetchMesesDisponiveis(produto, ano).then(m => { setMeses(m); setMes(null) })
  }, [produto, ano])

  const loadFichas = useCallback(async () => {
    if (!mes && mes !== -1) return
    // Only load table data when in lista view
    if (view === 'kanban' && produto !== 'todos') return
    setLoading(true)
    const { data, count } = await fetchFichas({
      produto: produto === 'todos' ? undefined : produto,
      ano, mes: mes === -1 ? null : mes,
      tipo: tab,
      search,
      orcamentistaId: tab === 'passadas_por_mim' ? user?.id : undefined,
      page,
      pageSize: PAGE_SIZE,
    })
    setFichas(data)
    setTotal(count)
    setLoading(false)
  }, [produto, ano, mes, tab, search, page, user, view])

  useEffect(() => { loadFichas() }, [loadFichas])

  function changeTab(t) { setTab(t); setPage(0); setSearch('') }
  function changeProduto(p) {
    setProduto(p); setAno(null); setMes(null); setFichas([]); setTotal(0)
    setView(p === 'todos' ? 'lista' : 'kanban')
  }
  function changeAno(a) { setAno(a); setMes(null); setFichas([]); setTotal(0) }
  function refresh() { loadFichas() }
  function onFichaSuccess() { setCriar(false); setEditar(null); setDetalhe(null); refresh() }

  async function onDelete(id) {
    await deletarFicha(id)
    setDetalhe(null)
    toast({ type: 'success', title: 'Ficha excluída' })
    refresh()
  }

  const minhaMetrica = tab === 'passadas_por_mim' ? {
    aprovadas: fichas.filter(f => f.status === 'aprovado').length,
    recusadas: fichas.filter(f => f.status === 'recusado').length,
    emitidas:  fichas.filter(f => f.status === 'emitido').length,
    taxa: fichas.length > 0 ? Math.round((fichas.filter(f => f.status === 'aprovado').length / fichas.length) * 100) : 0,
  } : null

  // ── View: Products ──
  if (!produto) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-dark-text">Fichas</h1>
            <p className="text-xs text-dark-muted mt-0.5">Selecione um produto para continuar</p>
          </div>
          <button onClick={() => setCriar(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Ficha
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {PRODUTOS.map((p, i) => {
            const PIcon = p.Icon
            return (
              <button
                key={p.key}
                onClick={() => changeProduto(p.key)}
                className="animate-slide-up group text-left rounded-2xl p-6 border transition-all duration-200 hover:scale-[1.03] hover:shadow-lg active:scale-[0.97]"
                style={{
                  background: p.bg, borderColor: p.border,
                  animationDelay: `${i * 50}ms`, animationFillMode: 'both',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 20px ${p.accent}30`}
                onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
              >
                <PIcon className="w-8 h-8 mb-3" style={{ color: p.accent }} strokeWidth={1.5} />
                <p className="font-bold text-sm text-dark-text mb-3">{p.label}</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-dark-muted">Total</span>
                    <span className="font-mono font-semibold" style={{ color: p.accent }}>
                      {contagem[p.key]?.total ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-dark-muted">Em Aberto</span>
                    <span className="font-mono font-semibold text-status-warning">
                      {contagem[p.key]?.emAberto ?? '—'}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {criar && <ModalFicha ficha={null} onClose={() => setCriar(false)} onSuccess={onFichaSuccess} />}
      </div>
    )
  }

  const prodInfo = PRODUTOS.find(p => p.key === produto)

  // ── View: Anos ──
  if (!ano) {
    return (
      <PageShell prodInfo={prodInfo} ano={null} mes={null}
        onHome={() => setProduto(null)} onProduto={() => {}} onAno={null} onMes={null}
        onCreate={() => setCriar(true)}
      >
        <p className="text-sm font-semibold text-dark-text mb-4">Selecione o ano</p>
        {anos.length === 0 ? (
          <p className="text-sm text-dark-muted">Nenhum ano com fichas.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {anos.map((a, i) => (
              <button
                key={a}
                onClick={() => changeAno(a)}
                className="animate-slide-up card-hover px-8 py-5 text-2xl font-bold text-dark-text hover:text-brand-accent hover:scale-[1.05] active:scale-[0.97] transition-all"
                style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}
              >
                {a}
              </button>
            ))}
          </div>
        )}
        {criar && <ModalFicha ficha={null} onClose={() => setCriar(false)} onSuccess={onFichaSuccess} />}
      </PageShell>
    )
  }

  // ── View: Meses ──
  if (!mes) {
    return (
      <PageShell prodInfo={prodInfo} ano={ano} mes={null}
        onHome={() => setProduto(null)} onProduto={() => setAno(null)} onAno={() => {}} onMes={null}
        onCreate={() => setCriar(true)}
      >
        <p className="text-sm font-semibold text-dark-text mb-4">
          Selecione o mês de <span style={{ color: prodInfo.accent }}>{ano}</span>
          <span className="ml-2 text-xs text-dark-muted font-normal">(apenas meses com fichas)</span>
        </p>
        {meses.length === 0 ? (
          <p className="text-sm text-dark-muted">Nenhum mês encontrado.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setMes(-1)}
              className="animate-slide-up card-hover px-5 py-3 text-sm font-semibold text-dark-text hover:text-brand-accent hover:scale-[1.04] active:scale-[0.97] transition-all"
              style={{ animationFillMode: 'both' }}
            >
              Todos os meses
            </button>
            {meses.map((m, i) => (
              <button
                key={m}
                onClick={() => setMes(m)}
                className="animate-slide-up card-hover px-5 py-3 text-sm font-semibold text-dark-text hover:text-brand-accent hover:scale-[1.04] active:scale-[0.97] transition-all"
                style={{ animationDelay: `${(i + 1) * 40}ms`, animationFillMode: 'both' }}
              >
                {MESES_FULL[m - 1]}
              </button>
            ))}
          </div>
        )}
        {criar && <ModalFicha ficha={null} onClose={() => setCriar(false)} onSuccess={onFichaSuccess} />}
      </PageShell>
    )
  }

  // ── View: Kanban / Tabela ──
  const mesLabel = mes === -1 ? 'Todos' : MESES_FULL[mes - 1]

  return (
    <PageShell
      prodInfo={prodInfo} ano={ano} mes={mesLabel}
      onHome={() => setProduto(null)} onProduto={() => setAno(null)}
      onAno={() => setMes(null)} onMes={() => {}}
      onCreate={() => setCriar(true)}
      viewToggle={<ViewToggle view={view} onChange={setView} />}
    >
      {view === 'kanban' ? (
        <KanbanFichas produto={produto} />
      ) : (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-dark-border mb-5">
            {[
              ['abertas',         'Em Aberto',     <Clock className="w-3.5 h-3.5" />],
              ['passadas',        'Passadas',       <CheckCircle2 className="w-3.5 h-3.5" />],
              ['passadas_por_mim','Passadas por Mim', <XCircle className="w-3.5 h-3.5" />],
            ].map(([key, label, icon]) => (
              <button
                key={key}
                onClick={() => changeTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                  tab === key
                    ? 'border-brand-accent text-brand-accent'
                    : 'border-transparent text-dark-muted hover:text-dark-text'
                }`}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Metrics for passadas por mim */}
          {tab === 'passadas_por_mim' && fichas.length > 0 && (
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                ['Aprovadas', minhaMetrica.aprovadas, 'text-status-success'],
                ['Recusadas', minhaMetrica.recusadas, 'text-status-danger'],
                ['Emitidas',  minhaMetrica.emitidas,  'text-brand-accent'],
                [`Taxa Aprov.`, `${minhaMetrica.taxa}%`, 'text-status-success'],
              ].map(([l, v, cls]) => (
                <div key={l} className="card p-3 text-center">
                  <p className="text-xs text-dark-muted mb-1">{l}</p>
                  <p className={`text-xl font-bold font-mono ${cls}`}>{v}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm bg-dark-surface2 border border-dark-border rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-dark-muted flex-shrink-0" />
              <input
                type="text"
                placeholder="Nome, CPF ou imobiliária..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                className="text-sm flex-1 outline-none bg-transparent text-dark-text placeholder-dark-muted"
              />
            </div>
            <span className="text-xs text-dark-muted ml-auto">{total} ficha{total !== 1 ? 's' : ''}</span>
            <button
              onClick={() => exportCSV(fichas, `conves-fichas-${prodInfo.key}-${ano}-${mes}.csv`)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48 gap-2 text-dark-muted text-sm">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Carregando...
              </div>
            ) : fichas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-dark-muted">
                <FileText className="w-8 h-8 opacity-30" />
                <p className="text-sm">Nenhuma ficha encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {tab === 'abertas' ? (
                  <TabelaAberta fichas={fichas} user={user} onDetalhe={setDetalhe} onAssumir={setAssumir} onFinalizar={setFinalizar} onEditar={setEditar} />
                ) : (
                  <TabelaPassadas fichas={fichas} user={user} onDetalhe={setDetalhe} onEditar={setEditar} />
                )}
              </div>
            )}
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={p => { setPage(p); window.scrollTo(0,0) }} />
          </div>
        </>
      )}

      {/* Modals */}
      {detalhe && (
        <DetalhesFicha id={detalhe} onClose={() => setDetalhe(null)}
          onEdit={f => { setDetalhe(null); setEditar(f) }}
          onDelete={onDelete} />
      )}
      {assumir && <ModalAssumir id={assumir} onClose={() => setAssumir(null)} onSuccess={() => { setAssumir(null); refresh() }} />}
      {finalizar && <ModalFinalizar ficha={finalizar} onClose={() => setFinalizar(null)} onSuccess={() => { setFinalizar(null); refresh() }} />}
      {criar && <ModalFicha ficha={null} onClose={() => setCriar(false)} onSuccess={onFichaSuccess} />}
      {editar && <ModalFicha ficha={editar} onClose={() => setEditar(null)} onSuccess={onFichaSuccess} />}
    </PageShell>
  )
}

// ── Table: Em Aberto ──────────────────────────────────────────────────────────

function TabelaAberta({ fichas, user, onDetalhe, onAssumir, onFinalizar, onEditar }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-dark-surface2/80 border-b border-dark-border">
        <tr>
          {['Data','Imobiliária','Nome','CPF','Status','Orçamentista','Tempo',''].map(h => (
            <th key={h} className="th whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-dark-border">
        {fichas.map(f => {
          const si     = STATUS_LABELS[f.status] ?? { label: f.status, color: '' }
          const isMe   = f.orcamentista_id === user?.id
          const canAss = !f.assumida && f.status === 'pendente'
          const canFin = isMe && f.status === 'em_cotacao'
          return (
            <tr key={f.id} className="table-row" onClick={() => onDetalhe(f.id)}>
              <td className="td text-dark-muted text-xs whitespace-nowrap font-mono">
                {format(parseISO(f.created_at), 'dd/MM/yy', { locale: ptBR })}
              </td>
              <td className="td font-medium text-dark-text max-w-[150px] truncate">
                {normalizeImobiliaria(f.imobiliaria) || '—'}
              </td>
              <td className="td text-dark-text max-w-[150px] truncate">{f.nome_interessado || '—'}</td>
              <td className="td text-dark-muted text-xs font-mono">{f.cpf || '—'}</td>
              <td className="td"><span className={`badge ${si.color}`}>{si.label}</span></td>
              <td className="td">
                {f.profiles?.nome
                  ? <OrcBadge nome={f.profiles.nome} isMe={isMe} />
                  : <span className="text-xs text-status-warning font-medium">Livre</span>
                }
              </td>
              <td className="td"><TimeBadge since={f.created_at} /></td>
              <td className="td whitespace-nowrap" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  {canAss && (
                    <button onClick={() => onAssumir(f.id)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-brand-secondary/20 text-brand-accent border border-brand-accent/20 hover:bg-brand-secondary/40 transition-colors font-medium">
                      Assumir
                    </button>
                  )}
                  {canFin && (
                    <button onClick={() => onFinalizar(f)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-status-success/15 text-status-success border border-status-success/20 hover:bg-status-success/25 transition-colors font-medium">
                      Finalizar
                    </button>
                  )}
                  <button onClick={() => onEditar(f)}
                          className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Table: Passadas ───────────────────────────────────────────────────────────

function TabelaPassadas({ fichas, user, onDetalhe, onEditar }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-dark-surface2/80 border-b border-dark-border">
        <tr>
          {['Data','Imobiliária','Nome','CPF','Status','Orçamentista','Seguradora',''].map(h => (
            <th key={h} className="th whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-dark-border">
        {fichas.map(f => {
          const si   = STATUS_LABELS[f.status] ?? { label: f.status, color: '' }
          const isMe = f.orcamentista_id === user?.id
          return (
            <tr key={f.id} className="table-row" onClick={() => onDetalhe(f.id)}>
              <td className="td text-dark-muted text-xs whitespace-nowrap font-mono">
                {format(parseISO(f.created_at), 'dd/MM/yy', { locale: ptBR })}
              </td>
              <td className="td font-medium text-dark-text max-w-[130px] truncate">
                {normalizeImobiliaria(f.imobiliaria) || '—'}
              </td>
              <td className="td text-dark-text max-w-[130px] truncate">{f.nome_interessado || '—'}</td>
              <td className="td text-dark-muted text-xs font-mono">{f.cpf || '—'}</td>
              <td className="td"><span className={`badge ${si.color}`}>{si.label}</span></td>
              <td className="td">
                {f.profiles?.nome
                  ? <OrcBadge nome={f.profiles.nome} isMe={isMe} />
                  : <span className="text-xs text-dark-muted">—</span>
                }
              </td>
              <td className="td text-dark-muted text-xs">{f.seguradora || '—'}</td>
              <td className="td" onClick={e => e.stopPropagation()}>
                <button onClick={() => onEditar(f)}
                        className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Page wrapper with breadcrumb ──────────────────────────────────────────────

function PageShell({ prodInfo, ano, mes, onHome, onProduto, onAno, onMes, onCreate, viewToggle, children }) {
  const PIcon = prodInfo?.Icon
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm flex-wrap">
          <button onClick={onHome} className="text-dark-muted hover:text-dark-text transition-colors">
            <Home className="w-4 h-4" />
          </button>
          <ChevronRight className="w-3 h-3 text-dark-border" />
          <Crumb onClick={onProduto} active={!ano && !!prodInfo}>
            {PIcon && <PIcon className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" style={{ color: prodInfo?.accent }} strokeWidth={1.5} />}
            {prodInfo?.label}
          </Crumb>
          {ano && <>
            <ChevronRight className="w-3 h-3 text-dark-border" />
            <Crumb onClick={onAno} active={!mes}>{ano}</Crumb>
          </>}
          {mes && <>
            <ChevronRight className="w-3 h-3 text-dark-border" />
            <Crumb onClick={onMes} active>{mes}</Crumb>
          </>}
        </div>

        <div className="flex items-center gap-2">
          {viewToggle}
          <button onClick={onCreate} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Ficha
          </button>
        </div>
      </div>

      {children}
    </div>
  )
}
