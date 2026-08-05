import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, DataCard } from '../components/ui'
import { Avatar } from '../components/ui/Avatar'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { replaceEntityImage } from '../lib/entityMedia'
import { PRODUTOS as COMERCIAL_PRODUTOS } from '../lib/comercial'
import { supabase } from '../lib/supabase'
import {
  Moon,
  SunMedium,
  MonitorCog,
  Layers3,
  Upload,
  UserCircle2,
  ShieldCheck,
  Users2,
  UserPlus,
  BadgeCheck,
  ChevronRight,
  FileSearch,
  FileSignature,
} from 'lucide-react'

// Cada atalho abre a grade de seguradoras daquele fluxo, onde o mapeamento do
// PDF e configurado seguradora a seguradora.
const AUTO_PDF_ATALHOS = [
  {
    to: '/configuracoes/auto/cotacoes',
    icon: FileSearch,
    title: 'Configurar cotacoes Auto',
    description: 'Leitura do orcamento da seguradora para montar o comparativo da cotacao.',
  },
  {
    to: '/configuracoes/auto/apolices',
    icon: FileSignature,
    title: 'Configurar apolices Auto',
    description: 'Leitura da proposta / apolice emitida para preencher a emissao e a apolice.',
  },
]

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

const ADMIN_EMAILS = new Set([
  'atendimento2@convesseguros.com',
  'atendimento@convesseguros.com',
])

const ROLE_OPTIONS = [
  { value: 'orcamentista', label: 'Orcamentista' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'auto', label: 'Seguro Auto' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'gestor', label: 'Gestor' },
]

function toggleItem(list, value) {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value]
}

function normalizeAreas(value) {
  return Array.isArray(value) ? [...new Set(value.filter(Boolean))] : []
}

function normalizeProducts(value) {
  return Array.isArray(value) ? [...new Set(value.filter(Boolean))] : []
}

function roleLabel(role) {
  return ROLE_OPTIONS.find(item => item.value === role)?.label || role
}

function normalizeLabel(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

export default function Configuracoes() {
  const { theme, setTheme } = useTheme()
  const { user, profile, refreshProfile } = useAuth()
  const toast = useToast()
  const fileRef = useRef(null)

  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || '')
  const [nome, setNome] = useState(profile?.nome || '')
  const [areasAtuacao, setAreasAtuacao] = useState([])
  const [comercialProdutos, setComercialProdutos] = useState([])
  const [savingPerfil, setSavingPerfil] = useState(false)

  const [profiles, setProfiles] = useState([])
  const [profileDrafts, setProfileDrafts] = useState({})
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [savingProfileId, setSavingProfileId] = useState(null)

  const [newUser, setNewUser] = useState({
    nome: '',
    email: '',
    password: '',
    roles: [],
    is_admin: false,
    comercial_produtos: [],
  })
  const [creatingUser, setCreatingUser] = useState(false)
  const [syncingUsers, setSyncingUsers] = useState(false)

  const isAdmin = Boolean(profile?.is_admin || ADMIN_EMAILS.has(String(user?.email || '').toLowerCase()))
  const adminSource = profile?.is_admin ? 'perfil' : ADMIN_EMAILS.has(String(user?.email || '').toLowerCase()) ? 'email' : null

  useEffect(() => {
    setAvatarPreview(profile?.avatar_url || '')
    setNome(profile?.nome || '')
    setAreasAtuacao(normalizeAreas(profile?.areas_atuacao))
    setComercialProdutos(normalizeProducts(profile?.comercial_produtos))
  }, [profile?.avatar_url, profile?.nome, profile?.comercial_produtos])

  useEffect(() => {
    if (!isAdmin) return
    loadProfiles()
  }, [isAdmin])

  async function loadProfiles() {
    setLoadingProfiles(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nome, orcamentista_label, avatar_url, is_admin, areas_atuacao, comercial_produtos, created_at')
      .order('nome')

    setLoadingProfiles(false)

    if (error) {
      toast({ type: 'error', title: 'Erro ao carregar usuarios', message: error.message })
      return
    }

    const nextProfiles = data || []
    setProfiles(nextProfiles)
    setProfileDrafts(prev => {
      const next = { ...prev }
      nextProfiles.forEach(item => {
        if (!next[item.id]) {
          next[item.id] = {
            nome: item.nome || '',
            is_admin: Boolean(item.is_admin),
            areas_atuacao: normalizeAreas(item.areas_atuacao),
            comercial_produtos: normalizeProducts(item.comercial_produtos),
          }
        }
      })
      return next
    })
  }

  async function handleSavePerfil() {
    if (!user?.id || !nome.trim()) return

    setSavingPerfil(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        nome: nome.trim(),
        orcamentista_label: normalizeLabel(nome),
        areas_atuacao: normalizeAreas(areasAtuacao),
        comercial_produtos: normalizeProducts(comercialProdutos),
      })
      .eq('id', user.id)

    setSavingPerfil(false)

    if (error) {
      toast({ type: 'error', title: 'Erro ao salvar perfil', message: error.message })
      return
    }

    await refreshProfile?.()
    await loadProfiles()
    toast({ type: 'success', title: 'Perfil atualizado' })
  }

  function updateDraft(profileId, updater) {
    setProfileDrafts(prev => {
      const current = prev[profileId] || { nome: '', is_admin: false, areas_atuacao: [], comercial_produtos: [] }
      return {
        ...prev,
        [profileId]: typeof updater === 'function' ? updater(current) : { ...current, ...updater },
      }
    })
  }

  async function handleSaveUserProfile(profileItem) {
    if (!profileItem?.id) return
    const draft = profileDrafts[profileItem.id] || {
      nome: profileItem.nome || '',
      is_admin: Boolean(profileItem.is_admin),
      areas_atuacao: normalizeAreas(profileItem.areas_atuacao),
      comercial_produtos: normalizeProducts(profileItem.comercial_produtos),
    }

    setSavingProfileId(profileItem.id)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData?.session?.access_token) {
        throw new Error('Nao foi possivel validar sua sessao de admin.')
      }

      const response = await fetch('/api/update-user-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          id: profileItem.id,
          nome: draft.nome || profileItem.nome || '',
          is_admin: draft.is_admin,
          areas_atuacao: draft.areas_atuacao,
          comercial_produtos: draft.comercial_produtos,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Nao foi possivel salvar o perfil.')
      }

      setProfiles(prev => prev.map(item => (
        item.id === profileItem.id ? { ...item, ...payload.profile } : item
      )))
      setProfileDrafts(prev => ({
        ...prev,
        [profileItem.id]: {
          nome: payload.profile?.nome || draft.nome || '',
          is_admin: Boolean(payload.profile?.is_admin ?? draft.is_admin),
          areas_atuacao: normalizeAreas(payload.profile?.areas_atuacao ?? draft.areas_atuacao),
          comercial_produtos: normalizeProducts(payload.profile?.comercial_produtos ?? draft.comercial_produtos),
        },
      }))
      toast({ type: 'success', title: 'Perfil do usuario atualizado' })
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao salvar usuario', message: error.message })
    } finally {
      setSavingProfileId(null)
    }
  }

  async function handleAvatarUpload(event) {
    const file = event.target.files?.[0]
    if (!file || !user?.id) return

    const localPreview = URL.createObjectURL(file)
    setAvatarPreview(localPreview)
    setUploadingAvatar(true)

    const uploaded = await replaceEntityImage({
      file,
      entityType: 'profile',
      entityId: user.id,
    })

    if (uploaded.error) {
      setAvatarPreview(profile?.avatar_url || '')
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
      setAvatarPreview(profile?.avatar_url || '')
      toast({ type: 'error', title: 'Erro ao salvar foto', message: error.message })
      return
    }

    await refreshProfile?.()
    toast({ type: 'success', title: 'Foto de perfil atualizada' })
  }

  async function handleCreateUser(event) {
    event.preventDefault()
    if (!newUser.nome.trim() || !newUser.email.trim() || !newUser.password.trim()) return

    setCreatingUser(true)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData?.session?.access_token) {
        throw new Error('Nao foi possivel validar sua sessao de admin.')
      }

      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      body: JSON.stringify({
        nome: newUser.nome.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        is_admin: newUser.is_admin,
        areas_atuacao: newUser.roles,
        comercial_produtos: newUser.comercial_produtos,
      }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Nao foi possivel criar o usuario.')
      }

      toast({ type: 'success', title: 'Usuario criado', message: payload?.profile?.nome || 'Cadastro realizado com sucesso.' })
      setNewUser({ nome: '', email: '', password: '', roles: [], is_admin: false, comercial_produtos: [] })
      await loadProfiles()
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao criar usuario', message: error.message })
    } finally {
      setCreatingUser(false)
    }
  }

  async function handleSyncUsers() {
    setSyncingUsers(true)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData?.session?.access_token) {
        throw new Error('Nao foi possivel validar sua sessao de admin.')
      }

      const response = await fetch('/api/sync-users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Nao foi possivel sincronizar os usuarios.')
      }

      toast({
        type: 'success',
        title: 'Usuarios sincronizados',
        message: `${payload?.synced || 0} de ${payload?.total || 0} perfis atualizados.`,
      })
      await loadProfiles()
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao sincronizar usuarios', message: error.message })
    } finally {
      setSyncingUsers(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Configuracoes"
        description="Ajustes globais de experiencia, tema e perfil do usuario."
      />

      {isAdmin && (
        <div className="rounded-[28px] border border-status-info/20 bg-gradient-to-r from-status-info/10 via-white to-brand-secondary/10 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-status-info/15 text-status-info">
                <Users2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-dark-text">Conta administrativa ativa</p>
                  <span className="badge badge-success">Admin</span>
                </div>
                <p className="mt-1 text-sm text-dark-muted">
                  Este perfil tem acesso ao painel de usuários, criação de contas e gerenciamento de funções.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="badge badge-blue">Usuarios</span>
              <span className="badge badge-info">Funcoes</span>
              <span className="badge badge-success">Permissoes elevadas</span>
            </div>
          </div>
        </div>
      )}

      <DataCard
        title="Automacoes de PDF do setor Auto"
        subtitle="Configure, por seguradora, de onde o sistema le cada informacao do PDF"
      >
        <div className="grid gap-3 md:grid-cols-2">
          {AUTO_PDF_ATALHOS.map(atalho => (
            <Link
              key={atalho.to}
              to={atalho.to}
              className="group flex items-start gap-3 rounded-2xl border border-dark-border p-4 transition-all hover:-translate-y-0.5 hover:border-status-info/50 hover:bg-status-info/5"
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-status-info/15 text-status-info">
                <atalho.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-dark-text">{atalho.title}</p>
                <p className="mt-1 text-sm text-dark-muted">{atalho.description}</p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 flex-shrink-0 text-dark-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </DataCard>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <DataCard
            title="Perfil"
            subtitle="Foto exibida no workspace e nos resumos do usuario"
          >
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                <Avatar
                  name={profile?.nome || 'Usuario'}
                  src={avatarPreview || profile?.avatar_url || ''}
                  size="lg"
                  className="ring-1 ring-dark-border/60"
                />
              </div>

                <div className="min-w-0 flex-1 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-dark-muted">Nome</label>
                    <input
                      type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    className="input"
                    placeholder="Seu nome"
                  />
                  <p className="mt-1 text-sm text-dark-muted">
                    {profile?.orcamentista_label || 'Sem rotulo definido'}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-dark-muted">
                    Funcoes do perfil
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ROLE_OPTIONS.map(role => {
                      const active = areasAtuacao.includes(role.value)
                      return (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => setAreasAtuacao(prev => toggleItem(prev, role.value))}
                          className={`rounded-2xl border px-3 py-2 text-left text-sm transition-all ${
                            active
                              ? 'border-status-info bg-status-info/10 text-status-info'
                              : 'border-dark-border hover:border-status-info/40 hover:bg-dark-surface2/40'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" />
                            {role.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {areasAtuacao.length ? (
                      areasAtuacao.map(role => (
                        <span key={role} className="badge badge-blue">{roleLabel(role)}</span>
                      ))
                    ) : (
                      <span className="text-sm text-dark-muted">Sem funcoes marcadas</span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-dark-muted">
                    Produtos comerciais liberados
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {COMERCIAL_PRODUTOS.map(product => {
                      const active = comercialProdutos.includes(product.id)
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => setComercialProdutos(prev => toggleItem(prev, product.id))}
                          className={`rounded-2xl border px-3 py-2 text-left text-sm transition-all ${
                            active
                              ? 'border-status-info bg-status-info/10 text-status-info'
                              : 'border-dark-border hover:border-status-info/40 hover:bg-dark-surface2/40'
                          }`}
                        >
                          {product.label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {comercialProdutos.length ? (
                      comercialProdutos.map(productId => (
                        <span key={productId} className="badge badge-info">
                          {COMERCIAL_PRODUTOS.find(product => product.id === productId)?.label || productId}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-dark-muted">Sem produtos liberados</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSavePerfil}
                    disabled={savingPerfil || !nome.trim()}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingPerfil ? 'Salvando...' : 'Salvar perfil'}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    {uploadingAvatar ? 'Enviando...' : 'Enviar foto'}
                  </button>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={() => setAvatarPreview(profile?.avatar_url || '')}
                      className="rounded-2xl border border-dark-border px-3 py-2 text-sm font-medium text-dark-muted transition-colors hover:text-dark-text"
                    >
                      Restaurar
                    </button>
                  )}
                </div>

                <p className="max-w-md text-xs text-dark-muted">
                  Use uma foto quadrada para melhor resultado. A imagem aparece no topo do workspace e nas areas de identificacao do usuario.
                </p>
                {isAdmin && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="badge badge-success">Admin ativo</span>
                    {adminSource && <span className="text-dark-muted">via {adminSource}</span>}
                  </div>
                )}
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
                        ? 'border-status-info bg-status-info/10 shadow-sm'
                        : 'border-dark-border hover:border-status-info/40 hover:bg-dark-surface2/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${active ? 'bg-status-info/15 text-status-info' : 'bg-dark-surface2 text-dark-muted'}`}>
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

        <div className="space-y-4">
          <DataCard
            title="Resumo"
            subtitle="Contexto atual do workspace"
          >
            <div className="space-y-3 text-sm text-dark-muted">
              <div className="rounded-2xl border border-dark-border/70 p-4">
                <div className="flex items-center gap-2 text-dark-text">
                  <Layers3 className="h-4 w-4 text-status-info" />
                  Shell operacional
                </div>
                <p className="mt-2 text-sm text-dark-muted">
                  O sistema opera com design premium e separacao de workspaces.
                </p>
              </div>
              <div className="rounded-2xl border border-dark-border/70 p-4">
                <div className="flex items-center gap-2 text-dark-text">
                  <MonitorCog className="h-4 w-4 text-status-info" />
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
                  O nome, a foto e as funcoes acima ficam salvos no perfil do usuario logado.
                </p>
              </div>
            </div>
          </DataCard>

          {isAdmin && (
            <DataCard
              title="Administracao de usuarios"
              subtitle="Criacao e consulta de contas com funcoes combinadas"
            >
              <div className="mb-4 rounded-2xl border border-status-info/15 bg-status-info/5 p-4">
                <p className="text-sm font-medium text-dark-text">Voce esta usando um perfil com permissao administrativa.</p>
                <p className="mt-1 text-sm text-dark-muted">
                  Aqui voce cria outros usuarios, atribui mais de uma funcao e identifica rapidamente quem tambem e admin.
                </p>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSyncUsers}
                  disabled={syncingUsers}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {syncingUsers ? 'Sincronizando...' : 'Sincronizar usuarios do Auth'}
                </button>
              </div>
              <form className="space-y-4" onSubmit={handleCreateUser}>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-dark-muted">Nome</label>
                    <input
                      className="input"
                      value={newUser.nome}
                      onChange={e => setNewUser(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Nome do usuario"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-dark-muted">Email</label>
                    <input
                      className="input"
                      type="email"
                      value={newUser.email}
                      onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="usuario@empresa.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-dark-muted">Senha inicial</label>
                  <input
                    className="input"
                    type="password"
                    value={newUser.password}
                    onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Senha temporaria"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dark-muted">Funcoes por setor</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ROLE_OPTIONS.map(role => {
                      const active = newUser.roles.includes(role.value)
                      return (
                        <button
                          key={role.value}
                          type="button"
                          onClick={() => setNewUser(prev => ({ ...prev, roles: toggleItem(prev.roles, role.value) }))}
                          className={`rounded-2xl border px-3 py-2 text-left text-sm transition-all ${
                            active
                              ? 'border-status-info bg-status-info/10 text-status-info'
                              : 'border-dark-border hover:border-status-info/40 hover:bg-dark-surface2/40'
                          }`}
                        >
                          {role.label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newUser.roles.map(role => (
                      <span key={role} className="badge badge-info">{roleLabel(role)}</span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dark-muted">Produtos comerciais liberados</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {COMERCIAL_PRODUTOS.map(product => {
                      const active = newUser.comercial_produtos.includes(product.id)
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => setNewUser(prev => ({ ...prev, comercial_produtos: toggleItem(prev.comercial_produtos, product.id) }))}
                          className={`rounded-2xl border px-3 py-2 text-left text-sm transition-all ${
                            active
                              ? 'border-status-info bg-status-info/10 text-status-info'
                              : 'border-dark-border hover:border-status-info/40 hover:bg-dark-surface2/40'
                          }`}
                        >
                          {product.label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newUser.comercial_produtos.map(productId => (
                      <span key={productId} className="badge badge-blue">
                        {COMERCIAL_PRODUTOS.find(product => product.id === productId)?.label || productId}
                      </span>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-dark-border px-4 py-3 text-sm text-dark-text">
                  <input
                    type="checkbox"
                    checked={newUser.is_admin}
                    onChange={e => setNewUser(prev => ({ ...prev, is_admin: e.target.checked }))}
                  />
                  <span className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-status-success" />
                    Tornar admin
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={creatingUser || !newUser.nome.trim() || !newUser.email.trim() || !newUser.password.trim()}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  {creatingUser ? 'Criando...' : 'Criar usuario'}
                </button>
              </form>
              <div className="mt-6 border-t border-dark-border/60 pt-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users2 className="h-4 w-4 text-status-info" />
                    <p className="text-sm font-semibold text-dark-text">Usuarios ativos</p>
                  </div>
                  <span className="badge badge-blue">{profiles.length} perfis</span>
                </div>
                {loadingProfiles ? (
                  <p className="text-sm text-dark-muted">Carregando usuarios...</p>
                ) : (
                  <div className="space-y-3">
                    {profiles.map(item => {
                      const draft = profileDrafts[item.id] || {
                        nome: item.nome || '',
                        is_admin: Boolean(item.is_admin),
                        areas_atuacao: normalizeAreas(item.areas_atuacao),
                        comercial_produtos: normalizeProducts(item.comercial_produtos),
                      }

                      return (
                        <div key={item.id} className="rounded-2xl border border-dark-border/70 p-4 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <Avatar
                                name={item.nome || 'Usuario'}
                                src={item.avatar_url || ''}
                                size="md"
                                className="ring-1 ring-dark-border/50"
                              />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-dark-text">{item.nome}</p>
                                  <span className="badge badge-success">Ativo</span>
                                  {draft.is_admin && <span className="badge badge-success">Admin</span>}
                                </div>
                                <p className="text-xs text-dark-muted">{item.orcamentista_label}</p>
                                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-dark-muted">
                                  {normalizeAreas(draft.areas_atuacao).length
                                    ? normalizeAreas(draft.areas_atuacao).map(roleLabel).join(' · ')
                                    : 'Sem funcoes definidas'}
                                </p>
                                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-dark-muted">
                                  {normalizeProducts(draft.comercial_produtos).length
                                    ? normalizeProducts(draft.comercial_produtos).map(productId => COMERCIAL_PRODUTOS.find(product => product.id === productId)?.label || productId).join(' · ')
                                    : 'Sem produtos liberados'}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveUserProfile(item)}
                              disabled={savingProfileId === item.id}
                              className="btn-secondary text-xs min-h-[38px] disabled:opacity-50"
                            >
                              {savingProfileId === item.id ? 'Salvando...' : 'Salvar'}
                            </button>
                          </div>
                          <div className="mt-4 space-y-3">
                            <div>
                              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Funcoes</p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {ROLE_OPTIONS.map(role => {
                                  const active = normalizeAreas(draft.areas_atuacao).includes(role.value)
                                  return (
                                    <button
                                      key={`${item.id}-${role.value}`}
                                      type="button"
                                      onClick={() => updateDraft(item.id, current => ({
                                        ...current,
                                        areas_atuacao: toggleItem(normalizeAreas(current.areas_atuacao), role.value),
                                      }))}
                                      className={`rounded-2xl border px-3 py-2 text-left text-sm transition-all ${
                                        active
                                          ? 'border-status-info bg-status-info/10 text-status-info'
                                          : 'border-dark-border hover:border-status-info/40 hover:bg-dark-surface2/40'
                                      }`}
                                    >
                                      {role.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            <div>
                              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Produtos comerciais</p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {COMERCIAL_PRODUTOS.map(product => {
                                  const active = normalizeProducts(draft.comercial_produtos).includes(product.id)
                                  return (
                                    <button
                                      key={`${item.id}-${product.id}`}
                                      type="button"
                                      onClick={() => updateDraft(item.id, current => ({
                                        ...current,
                                        comercial_produtos: toggleItem(normalizeProducts(current.comercial_produtos), product.id),
                                      }))}
                                      className={`rounded-2xl border px-3 py-2 text-left text-sm transition-all ${
                                        active
                                          ? 'border-status-info bg-status-info/10 text-status-info'
                                          : 'border-dark-border hover:border-status-info/40 hover:bg-dark-surface2/40'
                                      }`}
                                    >
                                      {product.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            <label className="flex items-center gap-3 rounded-2xl border border-dark-border px-4 py-3 text-sm text-dark-text">
                              <input
                                type="checkbox"
                                checked={Boolean(draft.is_admin)}
                                onChange={e => updateDraft(item.id, { is_admin: e.target.checked })}
                              />
                              <span className="flex items-center gap-2">
                                <BadgeCheck className="h-4 w-4 text-status-success" />
                                Admin
                              </span>
                            </label>
                          </div>
                        </div>
                      )
                    })}
                    {!profiles.length && (
                      <p className="text-sm text-dark-muted">Nenhum perfil encontrado.</p>
                    )}
                  </div>
                )}
              </div>
            </DataCard>
          )}
        </div>
      </div>
    </div>
  )
}
