import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import { User, Save, Check } from 'lucide-react'

const AVATAR_COLORS = [
  { id: 'blue',    hex: '#4A90D9', label: 'Azul' },
  { id: 'green',   hex: '#10B981', label: 'Verde' },
  { id: 'amber',   hex: '#F59E0B', label: 'Âmbar' },
  { id: 'violet',  hex: '#8B5CF6', label: 'Violeta' },
  { id: 'pink',    hex: '#EC4899', label: 'Rosa' },
  { id: 'cyan',    hex: '#06B6D4', label: 'Ciano' },
  { id: 'navy',    hex: '#2B5BA8', label: 'Marinho' },
  { id: 'red',     hex: '#EF4444', label: 'Vermelho' },
  { id: 'teal',    hex: '#14B8A6', label: 'Teal' },
  { id: 'orange',  hex: '#F97316', label: 'Laranja' },
]

function initials(nome) {
  return (nome || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'
}

export default function Configuracoes() {
  const { profile, user } = useAuth()
  const toast = useToast()

  const currentColor = AVATAR_COLORS.find(c => c.hex === profile?.avatar_url)
    || AVATAR_COLORS[0]

  const [nome,          setNome]          = useState(profile?.nome || '')
  const [orcLabel,      setOrcLabel]      = useState(profile?.orcamentista_label || '')
  const [selectedColor, setSelectedColor] = useState(currentColor)
  const [saving,        setSaving]        = useState(false)

  async function handleSave() {
    if (!nome.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        nome:              nome.trim(),
        orcamentista_label: orcLabel.trim() || null,
        avatar_url:        selectedColor.hex,
      })
      .eq('id', user.id)

    setSaving(false)
    if (error) {
      toast({ type: 'error', title: 'Erro ao salvar', message: error.message })
    } else {
      toast({ type: 'success', title: 'Perfil atualizado!' })
      // Recarregar profile no contexto via reload simples
      window.location.reload()
    }
  }

  return (
    <div className="page-content max-w-xl mx-auto space-y-6 py-6 px-4">

      {/* Header */}
      <div>
        <h1 className="title-page text-dark-text">Configurações</h1>
        <p className="text-sm text-dark-muted mt-1">Personalize o seu perfil e preferências</p>
      </div>

      {/* Avatar preview + color picker */}
      <div className="glass-panel p-6 space-y-5">
        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Seu avatar</p>

        {/* Preview */}
        <div className="flex items-center gap-5">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white select-none flex-shrink-0"
            style={{
              background: selectedColor.hex,
              boxShadow: `0 8px 32px ${selectedColor.hex}50`,
              transition: 'background 0.3s ease, box-shadow 0.3s ease',
            }}
          >
            {initials(nome || profile?.nome || '')}
          </div>
          <div>
            <p className="font-semibold text-dark-text text-lg leading-tight">
              {nome || profile?.nome || 'Seu Nome'}
            </p>
            <p className="text-sm text-dark-muted mt-0.5">{user?.email}</p>
            <p className="text-xs mt-2 px-2 py-0.5 rounded-full inline-block"
              style={{ background: selectedColor.hex + '22', color: selectedColor.hex }}>
              {selectedColor.label}
            </p>
          </div>
        </div>

        {/* Color grid */}
        <div>
          <p className="text-xs text-dark-muted mb-3">Escolha uma cor para o avatar</p>
          <div className="flex flex-wrap gap-2.5">
            {AVATAR_COLORS.map(color => (
              <button
                key={color.id}
                type="button"
                title={color.label}
                onClick={() => setSelectedColor(color)}
                className="relative w-9 h-9 rounded-xl transition-all duration-200"
                style={{
                  background: color.hex,
                  boxShadow: selectedColor.id === color.id
                    ? `0 0 0 2px var(--glass-bg), 0 0 0 4px ${color.hex}`
                    : 'none',
                  transform: selectedColor.id === color.id ? 'scale(1.15)' : 'scale(1)',
                }}
              >
                {selectedColor.id === color.id && (
                  <Check className="w-4 h-4 text-white absolute inset-0 m-auto" strokeWidth={2.5} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Profile fields */}
      <div className="glass-panel p-6 space-y-4">
        <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Informações do perfil</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
              Nome completo <span className="text-status-danger">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Seu nome"
                className="input pl-9"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
              Label de orçamentista
              <span className="ml-1 text-dark-muted font-normal normal-case tracking-normal">(opcional)</span>
            </label>
            <input
              value={orcLabel}
              onChange={e => setOrcLabel(e.target.value)}
              placeholder="Ex: Analista Sênior"
              className="input"
            />
            <p className="text-xs text-dark-muted mt-1">
              Aparece nas fichas atribuídas a você
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">
              Email
            </label>
            <input
              value={user?.email || ''}
              readOnly
              disabled
              className="input opacity-50"
            />
            <p className="text-xs text-dark-muted mt-1">
              O email não pode ser alterado aqui
            </p>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!nome.trim() || saving}
          className="btn-primary flex items-center gap-2 px-6"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  )
}
