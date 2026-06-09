import { useState, useMemo } from 'react'
import { useComercial, saleAdd, PRODUTOS } from '../../lib/comercial'
import { useToast } from '../../contexts/ToastContext'
import { Plus, X, TrendingUp, DollarSign, Award } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function ModalVenda({ onClose, onSave, leads }) {
  const [form, setForm] = useState({ leadId: '', produto: '', valor: '', comissao: '', dataEmissao: new Date().toISOString().slice(0,10), observacoes: '' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const valorNum    = parseFloat(form.valor)   || 0
  const comissaoNum = parseFloat(form.comissao) || 0
  const erros = {
    valor:    valorNum < 0 ? 'Valor não pode ser negativo' : '',
    comissao: comissaoNum < 0 ? 'Comissão não pode ser negativa' : comissaoNum > 100 ? 'Comissão máxima é 100%' : '',
  }
  const valido = form.produto && form.valor && form.comissao && form.dataEmissao && !erros.valor && !erros.comissao
  const calcComissao = form.valor && form.comissao ? (parseFloat(form.valor) * parseFloat(form.comissao) / 100).toFixed(2) : '0,00'
  const leadSelecionado = leads.find(l => l.id === form.leadId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-modal w-full max-w-lg relative z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <h2 className="font-bold text-dark-text">Registrar Venda</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-dark-muted" /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Lead (opcional)</label>
            <select value={form.leadId} onChange={e => set('leadId', e.target.value)} className="select w-full">
              <option value="">Sem lead vinculado</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Produto *</label>
            <select value={form.produto} onChange={e => set('produto', e.target.value)} className="select w-full">
              <option value="">Selecionar...</option>
              {PRODUTOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Valor (R$) *</label>
              <input type="number" min="0" step="0.01" value={form.valor} onChange={e => set('valor', e.target.value)} className={`input ${erros.valor ? 'border-status-danger' : ''}`} placeholder="0,00" />
              {erros.valor && <p className="text-xs text-status-danger mt-0.5">{erros.valor}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">% Comissão *</label>
              <input type="number" min="0" max="100" step="0.1" value={form.comissao} onChange={e => set('comissao', e.target.value)} className={`input ${erros.comissao ? 'border-status-danger' : ''}`} placeholder="%" />
              {erros.comissao && <p className="text-xs text-status-danger mt-0.5">{erros.comissao}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Data Emissão *</label>
              <input type="date" value={form.dataEmissao} onChange={e => set('dataEmissao', e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Comissão Calculada</label>
              <div className="input font-mono text-status-success">R$ {parseFloat(calcComissao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-dark-muted uppercase tracking-wider block mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} className="input resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => valido && onSave({ ...form, leadNome: leadSelecionado?.nome || 'Manual' })} disabled={!valido} className="btn-primary flex-1">Registrar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Vendas() {
  const state = useComercial()
  const toast = useToast()
  const [open,    setOpen]    = useState(false)
  const [periodo, setPeriodo] = useState('todos')

  const filteredSales = useMemo(() => {
    if (periodo === 'todos') return state.sales
    const inicio = periodo === '30dias'
      ? new Date(Date.now() - 30 * 86400000)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    return state.sales.filter(s => !s.dataEmissao || new Date(s.dataEmissao) >= inicio)
  }, [state.sales, periodo])

  const stats = useMemo(() => {
    const total = filteredSales.reduce((a, s) => a + (parseFloat(s.valor) || 0), 0)
    const comissao = filteredSales.reduce((a, s) => {
      const v = parseFloat(s.valor) || 0
      const c = parseFloat(s.comissao) || 0
      return a + v * c / 100
    }, 0)
    const prodMap = {}
    filteredSales.forEach(s => { prodMap[s.produto] = (prodMap[s.produto] || 0) + 1 })
    const topProd = Object.entries(prodMap).sort((a,b) => b[1]-a[1])[0]
    const topProdLabel = topProd ? (PRODUTOS.find(p => p.id === topProd[0])?.label || topProd[0]) : '—'
    return { total, comissao, count: filteredSales.length, topProd: topProdLabel }
  }, [filteredSales])

  async function handleSave(form) {
    try {
      await saleAdd(form)
      toast({ type: 'success', title: 'Venda registrada!' })
    } catch {
      toast({ type: 'error', title: 'Erro ao registrar venda' })
    }
    setOpen(false)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-dark-text">Área de Vendas</h1>
          <p className="text-xs text-dark-muted mt-0.5">{filteredSales.length} vendas{periodo !== 'todos' ? ' no período' : ' registradas'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-dark-surface2 rounded-xl p-0.5">
            {[['todos','Todas'],['30dias','30 dias'],['mes','Este mês']].map(([v, l]) => (
              <button key={v} onClick={() => setPeriodo(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${periodo === v ? 'bg-dark-glass text-dark-text shadow-sm' : 'text-dark-muted hover:text-dark-text'}`}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Venda
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: DollarSign, label: 'Receita Total',   value: `R$ ${stats.total.toLocaleString('pt-BR',{minimumFractionDigits:0})}`, color: '#10B981' },
          { icon: TrendingUp, label: 'Comissão Total',  value: `R$ ${stats.comissao.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: '#F59E0B' },
          { icon: Award,      label: 'Total de Vendas', value: String(stats.count), color: '#6366F1' },
          { icon: Award,      label: 'Top Produto',     value: stats.topProd, color: '#8B5CF6' },
        ].map(c => (
          <div key={c.label} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className="w-4 h-4" style={{ color: c.color }} />
              <p className="text-xs text-dark-muted font-medium">{c.label}</p>
            </div>
            <p className="text-xl font-black font-mono text-dark-text leading-tight truncate">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-border">
                {['Lead','Produto','Valor','Comissão','Data Emissão','Observações'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-dark-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-dark-muted py-12 text-sm">Nenhuma venda {periodo !== 'todos' ? 'no período' : 'registrada'}</td>
                </tr>
              ) : (
                [...filteredSales].reverse().map(s => {
                  const prod = PRODUTOS.find(p => p.id === s.produto)
                  const comVal = ((parseFloat(s.valor)||0) * (parseFloat(s.comissao)||0) / 100)
                  return (
                    <tr key={s.id} className="border-b border-dark-border/50 hover:bg-dark-surface2 transition-colors">
                      <td className="px-4 py-3 font-semibold text-dark-text">{s.leadNome || '—'}</td>
                      <td className="px-4 py-3">
                        {prod ? (
                          <span className="px-2 py-1 rounded text-xs font-semibold" style={{ background: prod.cor + '22', color: prod.cor }}>{prod.label}</span>
                        ) : <span className="text-dark-muted text-xs">{s.produto}</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-dark-text">R$ {parseFloat(s.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                      <td className="px-4 py-3 font-mono text-status-success">R$ {comVal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
                      <td className="px-4 py-3 text-dark-muted text-xs">{s.dataEmissao ? format(parseISO(s.dataEmissao), 'dd/MM/yyyy') : '—'}</td>
                      <td className="px-4 py-3 text-dark-muted text-xs max-w-[200px] truncate">{s.observacoes || '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && <ModalVenda onClose={() => setOpen(false)} onSave={handleSave} leads={state.leads} />}
    </div>
  )
}
