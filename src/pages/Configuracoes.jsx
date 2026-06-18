import { useEffect, useRef, useState } from 'react'
import { PageHeader, DataCard } from '../components/ui'
import { Avatar } from '../components/ui/Avatar'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { replaceEntityImage } from '../lib/entityMedia'
import { supabase } from '../lib/supabase'
import { Moon, SunMedium, MonitorCog, Layers3, Upload, UserCircle2 } from 'lucide-react'

const options = [
  {
    key: 'light',
    title: 'Tema claro',
    description: 'Base visual branca do shell operacional.',
    icon: SunMedium,
  },
  {
    key: 'dark',
    title: 'Tema escuro',
    description: 'Preferencia manual para uso prolongado.',
    icon: Moon,
  },
]

export default function Configuracoes() {
  const { theme, setTheme } = useTheme()
  const { user, profile, refreshProfile } = useAuth()
  const toast = useToast()
  const fileRef = useRef(null)

  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url || '')

  useEffect(() => {
    setAvatarPreview(profile.avatar_url || '')
  }, [profile.avatar_url])

  async function handleAvatarUpload(event) {
    const file = event.target.files[0]
    if (!file || !user.id) return

    const localPreview = URL.createObjectURL(file)
    setAvatarPreview(localPreview)
    setUploadingAvatar(true)

    const uploaded = await replaceEntityImage({
      file,
      entityType: 'profile',
      entityId: user.id,
    })

    if (uploaded.error) {
      setAvatarPreview(profile.avatar_url || '')
      setUploadingAvatar(false)
      toast({ type: 'error', title: 'Erro ao enviar foto', message: uploaded.error.message })
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: uploaded.url })
      .eq('id', user.id)

    setUploadingAvatar(false)

    if (error) {
      setAvatarPreview(profile.avatar_url || '')
      toast({ type: 'error', title: 'Erro ao salvar foto', message: error.message })
      return
    }

    await refreshProfile()
    toast({ type: 'success', title: 'Foto de perfil atualizada' })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Configuracoes"
        description="Ajustes globais de experiencia, tema e perfil do usuario."
      />

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <DataCard
            title="Perfil"
            subtitle="Foto exibida no workspace e nos resumos do usuario"
          >
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                <Avatar
                  name={profile.nome || 'Usuario'}
                  src={avatarPreview || profile.avatar_url || ''}
                  size="lg"
                  className="ring-1 ring-dark-border/60"
                />
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-dark-text">{profile.nome || 'Usuario'}</p>
                  <p className="mt-1 text-sm text-dark-muted">
                    {profile.orcamentista_label || 'Sem rotulo definido'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current.click()}
                    disabled={uploadingAvatar}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    {uploadingAvatar ? 'Enviando...' : 'Enviar foto'}
                  </button>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={() => setAvatarPreview(profile.avatar_url || '')}
                      className="rounded-2xl border border-dark-border px-3 py-2 text-sm font-medium text-dark-muted transition-colors hover:text-dark-text"
                    >
                      Restaurar
                    </button>
                  )}
                </div>

                <p className="max-w-md text-xs text-dark-muted">
                  Use uma foto quadrada para melhor resultado. A imagem aparece no topo do workspace e nas áreas de identificação do usuário.
                </p>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </DataCard>

          <DataCard
            title="Aparencia"
            subtitle="Escolha o tema que sera usado no shell"
          >
            <div className="grid gap-4 md:grid-cols-2">
              {options.map(option => {
                const Icon = option.icon
                const active = theme === option.key
                return (
                  <button
                    key={option.key}
                    onClick={() => setTheme(option.key)}
                    className={`rounded-3xl border p-5 text-left transition-all ${
                      active
                        ? 'border-brand-accent bg-brand-accent/10 shadow-sm'
                        : 'border-dark-border hover:border-brand-accent/40 hover:bg-dark-surface2/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${active ? 'bg-brand-accent/15 text-brand-accent' : 'bg-dark-surface2 text-dark-muted'}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-dark-text">{option.title}</p>
                          <p className="mt-1 text-sm text-dark-muted">{option.description}</p>
                        </div>
                      </div>
                      {active && <span className="badge badge-success">Ativo</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </DataCard>
        </div>

        <DataCard
          title="Resumo"
          subtitle="Contexto atual do workspace"
        >
          <div className="space-y-3 text-sm text-dark-muted">
            <div className="rounded-2xl border border-dark-border/70 p-4">
              <div className="flex items-center gap-2 text-dark-text">
                <Layers3 className="h-4 w-4 text-brand-accent" />
                Shell operacional
              </div>
              <p className="mt-2 text-sm text-dark-muted">
                O sistema opera com design premium e separacao de workspaces.
              </p>
            </div>
            <div className="rounded-2xl border border-dark-border/70 p-4">
              <div className="flex items-center gap-2 text-dark-text">
                <MonitorCog className="h-4 w-4 text-brand-secondary" />
                Preferencia salva
              </div>
              <p className="mt-2 text-sm text-dark-muted">
                A escolha de tema fica registrada localmente para a sessao do usuario.
              </p>
            </div>
            <div className="rounded-2xl border border-dark-border/70 p-4">
              <div className="flex items-center gap-2 text-dark-text">
                <UserCircle2 className="h-4 w-4 text-status-success" />
                Perfil ativo
              </div>
              <p className="mt-2 text-sm text-dark-muted">
                A foto e o nome acima são atualizados no perfil logado e aparecem no topo do workspace.
              </p>
            </div>
          </div>
        </DataCard>
      </div>
    </div>
  )
}
