import { useState, useEffect, useCallback } from 'react'
import { fetchRelatorioMensal, PRODUTO_LABELS } from '../lib/fichas'
import { normalizeImobiliaria } from '../lib/normalizeImobiliaria'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { ChevronLeft, ChevronRight, Download, X, FileText } from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskCpf(cpf) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length === 11) return `***.${d.slice(3, 6)}-**`
  return cpf
}

function maskCnpj(cnpj) {
  if (!cnpj) return '—'
  const d = cnpj.replace(/\D/g, '')
  if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****-**`
  return cnpj
}

function docMask(ficha) {
  if (ficha.produto === 'pessoa_juridica') return maskCnpj(ficha.cnpj)
  return maskCpf(ficha.cpf)
}

function nomePrincipal(ficha) {
  if (ficha.produto === 'pessoa_juridica') return ficha.nome_empresa || ficha.nome_interessado || '—'
  return ficha.nome_interessado || '—'
}

const MESES_FULL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

const PRODUTOS_FILTRO = [
  { key: 'todos',          label: 'Todos' },
  { key: 'residencial_pf', label: 'Res. PF' },
  { key: 'comercial_pf',   label: 'Com. PF' },
  { key: 'pessoa_juridica',label: 'PJ' },
]

// ── Badge de produto ──────────────────────────────────────────────────────────

const PRODUTO_COLOR = {
  residencial_pf:  { bg: 'rgba(74,144,217,0.15)',  color: '#4A90D9' },
  comercial_pf:    { bg: 'rgba(16,185,129,0.15)',  color: '#10B981' },
  pessoa_juridica: { bg: 'rgba(139,92,246,0.15)', color: '#8B5CF6' },
}

function ProdutoBadge({ produto }) {
  const s = PRODUTO_COLOR[produto] || { bg: 'rgba(107,114,128,0.15)', color: '#6B7280' }
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: s.bg, color: s.color }}>
      {PRODUTO_LABELS[produto] || produto}
    </span>
  )
}

// ── Indicadores booleanos ────────────────────────────────────────────────────

function Sim() { return <span className="text-status-success font-medium">✅ Sim</span> }
function Nao() { return <span className="text-status-danger font-medium">❌ Não</span> }
function Dash() { return <span className="text-dark-muted">—</span> }

function ResultadoFinal({ status }) {
  if (status === 'emitido')    return <span className="text-brand-accent font-medium">✅ Emitida</span>
  if (status === 'expirada')   return <span className="text-dark-muted font-medium">⏰ Expirada</span>
  if (status === 'recusado')   return <span className="text-status-danger font-medium">❌ Recusada</span>
  if (status === 'aprovado')   return <span className="text-status-success font-medium">✅ Aprovada</span>
  if (status === 'cancelado')  return <span className="text-dark-muted font-medium">🚫 Cancelada</span>
  if (status === 'cpf_invalido') return <span className="text-status-warning font-medium">⚠️ CPF Inv.</span>
  return <Dash />
}

// ── Exportação CSV ────────────────────────────────────────────────────────────

function exportarCSV(fichas, mes, ano, resolverNome) {
  const headers = ['Imobiliária','Nome','Doc','Produto','Status','Enviada','Resultado','Desistiu','Orçamentista','Data']
  const rows = fichas.map(f => [
    (resolverNome ? resolverNome(f.imobiliaria) : null) || f.imobiliaria || '',
    nomePrincipal(f),
    f.produto === 'pessoa_juridica' ? (f.cnpj || '') : (f.cpf || ''),
    PRODUTO_LABELS[f.produto] || f.produto,
    f.status,
    f.retorno_enviado ? 'Sim' : 'Não',
    f.status === 'emitido'  ? 'Emitida'  :
    f.status === 'expirada' ? 'Expirada' :
    f.status === 'recusado' ? 'Recusada' :
    f.status === 'aprovado' ? 'Aprovada' : 'Pendente',
    f.status === 'cancelado' ? 'Sim' : 'Não',
    f.orcamentista_forms || '',
    new Date(f.created_at).toLocaleDateString('pt-BR'),
  ])
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `conves-relatorio-${String(mes).padStart(2,'0')}-${ano}.csv`,
  })
  a.click()
  URL.revokeObjectURL(url)
}

// ── Totalizador por imobiliária ───────────────────────────────────────────────

function TotalizadorImob({ fichas }) {
  const enviadas   = fichas.filter(f => f.retorno_enviado).length
  const emitidas   = fichas.filter(f => f.status === 'emitido').length
  const expiradas  = fichas.filter(f => f.status === 'expirada').length
  const desistiu   = fichas.filter(f => f.status === 'cancelado').length
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-dark-muted mt-1">
      <span>Enviadas: <strong className="text-dark-text">{enviadas}</strong></span>
      <span>Emitidas: <strong className="text-status-success">{emitidas}</strong></span>
      <span>Expiradas: <strong className="text-dark-muted">{expiradas}</strong></span>
      <span>Desistências: <strong className="text-dark-text">{desistiu}</strong></span>
    </div>
  )
}

// ── Tabela por imobiliária ────────────────────────────────────────────────────

function TabelaImob({ nome, fichas }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-bold text-dark-text text-sm">{nome}</span>
          <span className="text-xs text-dark-muted ml-2">({fichas.length} ficha{fichas.length !== 1 ? 's' : ''})</span>
        </div>
      </div>
      <TotalizadorImob fichas={fichas} />
      <div className="mt-3 overflow-x-auto rounded-xl border border-dark-border">
        <table className="w-full text-xs">
          <thead className="bg-dark-surface2/80 border-b border-dark-border">
            <tr>
              {['Nome','Doc','Produto','Enviada','Resultado','Desistiu','Orçamentista'].map(h => (
                <th key={h} className="th whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {fichas.map(f => (
              <tr key={f.id} className="hover:bg-dark-surface2/40 transition-colors">
                <td className="td text-dark-text font-medium max-w-[150px] truncate">{nomePrincipal(f)}</td>
                <td className="td font-mono text-dark-muted">{docMask(f)}</td>
                <td className="td"><ProdutoBadge produto={f.produto} /></td>
                <td className="td">{f.retorno_enviado ? <Sim /> : <Nao />}</td>
                <td className="td"><ResultadoFinal status={f.status} /></td>
                <td className="td">{f.status === 'cancelado' ? <Sim /> : <Dash />}</td>
                <td className="td text-dark-muted max-w-[120px] truncate">{f.orcamentista_forms || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Rodapé geral ─────────────────────────────────────────────────────────────

function Rodape({ fichas }) {
  const total    = fichas.length
  const enviadas = fichas.filter(f => f.retorno_enviado).length
  const emitidas = fichas.filter(f => f.status === 'emitido').length
  const expiras  = fichas.filter(f => f.status === 'expirada').length
  const desist   = fichas.filter(f => f.status === 'cancelado').length
  const recusadas = fichas.filter(f => f.status === 'recusado').length

  const pct = (n) => total ? `${Math.round((n / total) * 100)}%` : '0%'

  return (
    <div className="card p-5 mt-6">
      <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4">Total do Mês</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total de fichas', val: total,    color: '#4A90D9', pct: null },
          { label: 'Enviadas',        val: enviadas,  color: '#10B981', pct: pct(enviadas) },
          { label: 'Emitidas',        val: emitidas,  color: '#2B5BA8', pct: pct(emitidas) },
          { label: 'Expiradas',       val: expiras,   color: '#6B7280', pct: pct(expiras) },
          { label: 'Desistências',    val: desist,    color: '#8899BB', pct: pct(desist) },
          { label: 'Recusadas',       val: recusadas, color: '#EF4444', pct: pct(recusadas) },
        ].map(({ label, val, color, pct: p }) => (
          <div key={label} className="text-center">
            <p className="text-[10px] text-dark-muted mb-1">{label}</p>
            <p className="text-xl font-bold font-mono" style={{ color }}>{val}</p>
            {p && <p className="text-[10px] text-dark-muted mt-0.5">{p}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function RelatorioMensal({ onClose }) {
  const agora = new Date()
  const { resolverNome } = useImobiliaria()
  const [mes,     setMes]     = useState(agora.getMonth() + 1)
  const [ano,     setAno]     = useState(agora.getFullYear())
  const [produto, setProduto] = useState('todos')
  const [fichas,  setFichas]  = useState([])
  const [loading, setLoading] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const data = await fetchRelatorioMensal({ ano, mes, produto })
    setFichas(data)
    setLoading(false)
  }, [ano, mes, produto])

  useEffect(() => { carregar() }, [carregar])

  function mudarMes(delta) {
    let nm = mes + delta
    let na = ano
    if (nm > 12) { nm = 1;  na++ }
    if (nm < 1)  { nm = 12; na-- }
    setMes(nm)
    setAno(na)
  }

  // Agrupar por imobiliária
  const porImobiliaria = fichas.reduce((acc, f) => {
    const imob = resolverNome(f.imobiliaria) || 'Sem Imobiliária'
    if (!acc[imob]) acc[imob] = []
    acc[imob].push(f)
    return acc
  }, {})

  const imobiliarias = Object.keys(porImobiliaria).sort()

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-dark-surface border border-dark-border rounded-2xl shadow-2xl w-full max-w-5xl my-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-accent/15 flex items-center justify-center">
              <FileText className="w-5 h-5 text-brand-accent" />
            </div>
            <h2 className="font-bold text-dark-text">Relatório Mensal de Fichas</h2>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controles */}
        <div className="px-6 py-4 border-b border-dark-border flex flex-wrap items-center gap-4">
          {/* Seletor de mês */}
          <div className="flex items-center gap-2">
            <button onClick={() => mudarMes(-1)}
                    className="p-1.5 rounded-lg border border-dark-border hover:border-brand-accent/50 text-dark-muted hover:text-dark-text transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-dark-text text-sm min-w-[130px] text-center capitalize">
              {MESES_FULL[mes - 1]} {ano}
            </span>
            <button onClick={() => mudarMes(+1)}
                    className="p-1.5 rounded-lg border border-dark-border hover:border-brand-accent/50 text-dark-muted hover:text-dark-text transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Filtro de produto */}
          <div className="flex items-center gap-1">
            {PRODUTOS_FILTRO.map(p => (
              <button key={p.key} onClick={() => setProduto(p.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        produto === p.key
                          ? 'bg-brand-secondary text-white'
                          : 'border border-dark-border text-dark-muted hover:text-dark-text hover:border-brand-accent/40'
                      }`}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Exportar */}
          <button
            onClick={() => exportarCSV(fichas, mes, ano, resolverNome)}
            disabled={fichas.length === 0}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text hover:border-brand-accent/50 transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </button>
        </div>

        {/* Corpo */}
        <div className="px-6 py-5">
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
              <p className="text-sm">Nenhuma ficha em {MESES_FULL[mes - 1]} {ano}</p>
            </div>
          ) : (
            <>
              {imobiliarias.map(imob => (
                <TabelaImob key={imob} nome={imob} fichas={porImobiliaria[imob]} />
              ))}
              <Rodape fichas={fichas} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
