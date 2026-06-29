ï»¿import { useState, useEffect, useCallback } from 'react'
import { fetchRelatorioMensal, PRODUTO_LABELS } from '../lib/fichas'
import { normalizeImobiliaria } from '../lib/normalizeImobiliaria'
import { normalizeDisplayText } from '../lib/text'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { AVATAR_COLORS, BRAND, PRODUTO_COLORS, STATUS_CHART_COLORS } from '../design-system/tokens'
import { ChevronLeft, ChevronRight, Download, X, FileText, CheckCircle2, XCircle, MinusCircle, AlertTriangle, Clock } from 'lucide-react'

// ââ Helpers âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function maskCpf(cpf) {
  if (!cpf) return 'â'
  const d = cpf.replace(/\D/g, '')
  if (d.length === 11) return `***.${d.slice(3, 6)}-**`
  return cpf
}

function maskCnpj(cnpj) {
  if (!cnpj) return 'â'
  const d = cnpj.replace(/\D/g, '')
  if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****-**`
  return cnpj
}

function docMask(ficha) {
  if (ficha.produto === 'pessoa_juridica') return maskCnpj(ficha.cnpj)
  return maskCpf(ficha.cpf)
}

function nomePrincipal(ficha) {
  if (ficha.produto === 'pessoa_juridica') return normalizeDisplayText(ficha.nome_empresa || ficha.nome_interessado) || 'â'
  return normalizeDisplayText(ficha.nome_interessado) || 'â'
}

const MESES_FULL = [
  'Janeiro','Fevereiro','MarÃ§o','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

const PRODUTOS_FILTRO = [
  { key: 'todos',          label: 'Todos' },
  { key: 'residencial_pf', label: 'Res. PF' },
  { key: 'comercial_pf',   label: 'Com. PF' },
  { key: 'pessoa_juridica',label: 'PJ' },
]

// ââ Badge de produto ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const PRODUTO_COLOR = {
  residencial_pf:  { bg: PRODUTO_COLORS.residencial_pf.bg,  color: PRODUTO_COLORS.residencial_pf.color },
  comercial_pf:    { bg: PRODUTO_COLORS.comercial_pf.bg,  color: PRODUTO_COLORS.comercial_pf.color },
  pessoa_juridica: { bg: PRODUTO_COLORS.pessoa_juridica.bg, color: PRODUTO_COLORS.pessoa_juridica.color },
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

// ââ Indicadores booleanos ââââââââââââââââââââââââââââââââââââââââââââââââââââ

function Sim() { return <span className="inline-flex items-center gap-1 text-status-success font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Sim</span> }
function Nao() { return <span className="inline-flex items-center gap-1 text-status-danger font-medium"><XCircle className="w-3.5 h-3.5" /> NÃ£o</span> }
function Dash() { return <span className="text-dark-muted">â</span> }

function ResultadoFinal({ status }) {
  if (status === 'emitido')      return <span className="inline-flex items-center gap-1 text-brand-accent font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Emitida</span>
  if (status === 'expirada')     return <span className="inline-flex items-center gap-1 text-dark-muted font-medium"><Clock className="w-3.5 h-3.5" /> Expirada</span>
  if (status === 'recusado')     return <span className="inline-flex items-center gap-1 text-status-danger font-medium"><XCircle className="w-3.5 h-3.5" /> Recusada</span>
  if (status === 'aprovado')     return <span className="inline-flex items-center gap-1 text-status-success font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Aprovada</span>
  if (status === 'cancelado')    return <span className="inline-flex items-center gap-1 text-dark-muted font-medium"><MinusCircle className="w-3.5 h-3.5" /> Cancelada</span>
  if (status === 'cpf_invalido') return <span className="inline-flex items-center gap-1 text-status-warning font-medium"><AlertTriangle className="w-3.5 h-3.5" /> CPF Inv.</span>
  return <Dash />
}

// ââ ExportaÃ§Ã£o CSV ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function exportarCSV(fichas, mes, ano, resolverNome) {
  const headers = ['ImobiliÃ¡ria','Nome','Doc','Produto','Status','Enviada','Resultado','Desistiu','OrÃ§amentista','Data']
  const rows = fichas.map(f => [
    (resolverNome ? resolverNome(f.imobiliaria) : null) || f.imobiliaria || '',
    nomePrincipal(f),
    f.produto === 'pessoa_juridica' ? (f.cnpj || '') : (f.cpf || ''),
    PRODUTO_LABELS[f.produto] || f.produto,
    f.status,
    f.retorno_enviado ? 'Sim' : 'NÃ£o',
    f.status === 'emitido'  ? 'Emitida'  :
    f.status === 'expirada' ? 'Expirada' :
    f.status === 'recusado' ? 'Recusada' :
    f.status === 'aprovado' ? 'Aprovada' : 'Pendente',
    f.status === 'cancelado' ? 'Sim' : 'NÃ£o',
    f.orcamentista_forms || '',
    new Date(f.created_at).toLocaleDateString('pt-BR'),
  ])
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['Ã¯Â»Â¿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `conves-relatorio-${String(mes).padStart(2,'0')}-${ano}.csv`,
  })
  a.click()
  URL.revokeObjectURL(url)
}

// ââ Totalizador por imobiliÃ¡ria âââââââââââââââââââââââââââââââââââââââââââââââ

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
      <span>DesistÃªncias: <strong className="text-dark-text">{desistiu}</strong></span>
    </div>
  )
}

// ââ Tabela por imobiliÃ¡ria ââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
      <div className="table-shell mt-3">
        <div className="overflow-x-auto">
          <table className="table-table text-xs">
            <thead className="table-thead border-b border-dark-border">
              <tr>
                {['Nome','Doc','Produto','Enviada','Resultado','Desistiu','OrÃ§amentista'].map(h => (
                  <th key={h} className="th whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {fichas.map(f => (
                <tr key={f.id} className="table-row hover:bg-dark-surface2/40 transition-colors">
                  <td className="td text-dark-text font-medium max-w-[150px] truncate">{nomePrincipal(f)}</td>
                  <td className="td font-mono text-dark-muted">{docMask(f)}</td>
                  <td className="td"><ProdutoBadge produto={f.produto} /></td>
                  <td className="td">{f.retorno_enviado ? <Sim /> : <Nao />}</td>
                  <td className="td"><ResultadoFinal status={f.status} /></td>
                  <td className="td">{f.status === 'cancelado' ? <Sim /> : <Dash />}</td>
                  <td className="td text-dark-muted max-w-[120px] truncate">{f.orcamentista_forms || 'â'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ââ RodapÃ© geral âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
      <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-4">Total do MÃªs</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total de fichas', val: total,    color: BRAND.primary, pct: null },
          { label: 'Enviadas',        val: enviadas,  color: PRODUTO_COLORS.comercial_pf.color, pct: pct(enviadas) },
          { label: 'Emitidas',        val: emitidas,  color: PRODUTO_COLORS.residencial_pf.color, pct: pct(emitidas) },
          { label: 'Expiradas',       val: expiras,   color: '#6B7280', pct: pct(expiras) },
          { label: 'DesistÃªncias',    val: desist,    color: BRAND.gold, pct: pct(desist) },
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

// ââ Main ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

  // Agrupar por imobiliÃ¡ria
  const porImobiliaria = fichas.reduce((acc, f) => {
    const imob = resolverNome(f.imobiliaria) || 'Sem ImobiliÃ¡ria'
    if (!acc[imob]) acc[imob] = []
    acc[imob].push(f)
    return acc
  }, {})

  const imobiliarias = Object.keys(porImobiliaria).sort()

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="glass-modal border border-dark-border w-full max-w-5xl my-4 relative z-10">

        {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-accent/15 flex items-center justify-center">
              <FileText className="w-5 h-5 text-brand-accent" />
            </div>
            <h2 className="font-bold text-dark-text">RelatÃ³rio Mensal de Fichas</h2>
          </div>
          <button onClick={onClose} className="text-dark-muted hover:text-dark-text transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controles */}
        <div className="px-6 py-4 border-b border-dark-border flex flex-wrap items-center gap-4">
          {/* Seletor de mÃªs */}
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

