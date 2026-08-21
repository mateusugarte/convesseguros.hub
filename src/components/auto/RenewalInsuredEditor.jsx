import { useEffect, useState } from 'react'
import { Search, UserRound, X } from 'lucide-react'
import { buscarClientesAuto } from '../../lib/auto'

export default function RenewalInsuredEditor({ initialName = '', initialClientId = '', onClose, onSave }) {
  const [mode, setMode] = useState(initialClientId ? 'existing' : 'custom')
  const [customName, setCustomName] = useState(initialName)
  const [query, setQuery] = useState(initialName)
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(initialClientId ? { id: initialClientId, nome_completo: initialName } : null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (mode !== 'existing' || query.trim().length < 2) {
      setResults([])
      return undefined
    }
    const timeout = setTimeout(async () => {
      setLoading(true)
      try { setResults(await buscarClientesAuto(query)) } catch { setResults([]) } finally { setLoading(false) }
    }, 260)
    return () => clearTimeout(timeout)
  }, [mode, query])

  const canSave = mode === 'existing' ? Boolean(selected?.id) : Boolean(customName.trim())
  const submit = () => {
    if (!canSave) return
    onSave(mode === 'existing'
      ? { cliente_id: selected.id, nome_segurado_anterior: selected.nome_completo, cliente: selected }
      : { cliente_id: null, nome_segurado_anterior: customName.trim(), cliente: null })
  }

  return <div className="renewal-insured-overlay" role="dialog" aria-modal="true" aria-label="Editar segurado">
    <button className="renewal-insured-backdrop" onClick={onClose} aria-label="Fechar" />
    <div className="renewal-insured-modal">
      <header><span><UserRound /></span><div><small>Renovação</small><strong>Quem é o segurado?</strong></div><button onClick={onClose}><X /></button></header>
      <div className="renewal-insured-modes">
        <button className={mode === 'custom' ? 'is-active' : ''} onClick={() => setMode('custom')}><strong>Nome personalizado</strong><small>Use um nome livre apenas nesta renovação</small></button>
        <button className={mode === 'existing' ? 'is-active' : ''} onClick={() => setMode('existing')}><strong>Cliente existente</strong><small>Pesquise e vincule ao cadastro do cliente</small></button>
      </div>
      {mode === 'custom' ? <label className="renewal-insured-field"><span>Nome do segurado</span><input autoFocus value={customName} onChange={event => setCustomName(event.target.value)} placeholder="Digite o nome que aparecerá na renovação" /></label> : <div className="renewal-insured-search"><label><Search /><input autoFocus value={query} onChange={event => { setQuery(event.target.value); setSelected(null) }} placeholder="Pesquise por nome ou CPF" />{loading && <i />}</label><div className="renewal-insured-results">{selected && <div className="is-selected"><span><UserRound /></span><div><strong>{selected.nome_completo}</strong><small>{selected.cpf || 'Cliente selecionado'}</small></div><button onClick={() => setSelected(null)}>Trocar</button></div>}{!selected && results.map(client => <button key={client.id} onClick={() => setSelected(client)}><span><UserRound /></span><div><strong>{client.nome_completo}</strong><small>{client.cpf || 'Sem CPF'}{client.celular ? ` · ${client.celular}` : ''}</small></div></button>)}{!selected && query.trim().length >= 2 && !loading && results.length === 0 && <p>Nenhum cliente encontrado. Você pode usar o nome personalizado.</p>}</div></div>}
      <footer><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={!canSave} onClick={submit}>{mode === 'existing' ? 'Vincular cliente' : 'Usar nome personalizado'}</button></footer>
    </div>
  </div>
}
