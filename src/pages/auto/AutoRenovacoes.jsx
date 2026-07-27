import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { CalendarClock, CheckCircle2, Clock, ExternalLink, RefreshCw, Send, Upload, XCircle } from 'lucide-react'
import {
  cancelarRenovacao,
  getAutoRenovacaoMesStatus,
  getRenovacoesAuto,
  iniciarCotacaoRenovacao,
  marcarMesRenovacaoConcluido,
  puxarRenovacoesDePlanilha,
  puxarRenovacoesDoSistema,
} from '../../lib/auto'
import { parseAutoComissaoPlanilha } from '../../lib/autoComissaoImport'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { PageHeader, MetricCard, FilterBar, DataCard, EmptyState } from '../../components/ui'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import {
  RENOVACAO_STATUS,
  monthKey,
  diasParaVencer,
  formatDiasParaVencer,
  getRenovacaoUrgencia,
  RENOVACAO_URGENCIA_META,
  getRenewalQuoteStatus,
  RENEWAL_QUOTE_STATUS_META,
  getRenovacaoAreaStatus,
  RENOVACAO_AREA_STATUS_META,
  getComissaoAtualAnterior,
  toneClasses,
} from './autoShared'

const PERIODOS = [
  { value: 'mes_atual', label: 'Mês selecionado' },
  { value: 'proximo_mes', label: 'Mês seguinte' },
  { value: 'passadas', label: 'Vencidas' },
  { value: '', label: 'Todas' },
]

const ACOMPANHAR_FILTROS = [
  { value: 'todas', label: 'Todas' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando_retorno', label: 'Aguardando retorno' },
  { value: 'nao_cotada', label: 'Não cotadas' },
  { value: 'concluida', label: 'Concluídas' },
]

function currentMonthRef() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(monthRef, offset) {
  const [year, month] = String(monthRef || '').split('-').map(Number)
  const date = new Date(year || new Date().getFullYear(), (month || 1) - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatarMes(monthRef) {
  const [year, month] = String(monthRef || '').split('-').map(Number)
  if (!year || !month) return 'mês atual'
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function formatarData(str) {
  if (!str) return '-'
  return new Date(`${str}T12:00:00`).toLocaleDateString('pt-BR')
}

function normalizarNomeAba(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// As abas da planilha real sao nomeadas pelo mes ("JULHO 2026"). Procuramos a
// aba do mes esperado (mes-alvo um ano antes), ignorando caixa e acentos.
function encontrarAbaDoMes(sheetNames = [], monthRef) {
  const [ano, mes] = String(monthRef || '').split('-').map(Number)
  if (!ano || !mes) return null
  const nomeMes = normalizarNomeAba(new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long' }))
  if (!nomeMes) return null
  const alvo = `${nomeMes} ${ano}`
  return sheetNames.find(nome => normalizarNomeAba(nome) === alvo)
    || sheetNames.find(nome => {
      const normalizado = normalizarNomeAba(nome)
      return normalizado.includes(nomeMes) && normalizado.includes(String(ano))
    })
    || null
}

export default function AutoRenovacoes() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [painelPuxarAberto, setPainelPuxarAberto] = useState(() => searchParams.get('puxar') === '1')
  const [mesParaPuxar, setMesParaPuxar] = useState(() => searchParams.get('mes') || currentMonthRef())
  const [resumoPuxar, setResumoPuxar] = useState(null)
  const xlsInputRef = useRef(null)
  const qc = useQueryClient()
  // O banner do Dashboard navega para /auto/renovacoes?mes=<mes>&puxar=1: a
  // lista precisa abrir no mesmo mes que o painel "puxar renovacoes".
  const [mesRef, setMesRef] = useState(() => searchParams.get('mes') || currentMonthRef())
  const [periodo, setPeriodo] = useState('mes_atual')
  const [acompanharFiltro, setAcompanharFiltro] = useState('todas')
  const mesSeguinteRef = useMemo(() => shiftMonth(mesRef, 1), [mesRef])

  // Mantem a URL em sincronia com o mes da lista e com o painel aberto, para
  // que recarregar ou compartilhar o link volte no mesmo recorte. O guard de
  // igualdade evita loop de navegacao. (mesParaPuxar continua sendo estado
  // local do painel — so o mes da lista viaja na URL.)
  useEffect(() => {
    const mesNaUrl = searchParams.get('mes')
    const puxarNaUrl = searchParams.get('puxar') === '1'
    if (mesNaUrl === mesRef && puxarNaUrl === painelPuxarAberto) return
    const next = new URLSearchParams(searchParams)
    next.set('mes', mesRef)
    if (painelPuxarAberto) next.set('puxar', '1')
    else next.delete('puxar')
    setSearchParams(next, { replace: true })
  }, [mesRef, painelPuxarAberto, searchParams, setSearchParams])

  const { data: renovacoes = [], isLoading } = useQuery({
    queryKey: ['auto-renovacoes', periodo, mesRef],
    queryFn: () => getRenovacoesAuto({ periodo, mes: mesRef }),
  })

  const { data: todasRenovacoes = [], isLoading: loadingTodas } = useQuery({
    queryKey: ['auto-renovacoes-todas'],
    queryFn: () => getRenovacoesAuto({ periodo: '' }),
  })

  const { data: statusMesPuxar } = useQuery({
    queryKey: ['auto-renovacao-mes-status-unico', mesParaPuxar],
    queryFn: async () => (await getAutoRenovacaoMesStatus([mesParaPuxar]))[mesParaPuxar] || null,
    enabled: painelPuxarAberto,
  })

  const { mutateAsync: puxarDoSistema, isPending: puxandoSistema } = useMutation({
    mutationFn: () => puxarRenovacoesDoSistema(mesParaPuxar),
    onSuccess: async resultado => {
      setResumoPuxar({ tipo: 'sistema', ...resultado })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
      toast({ type: 'success', title: 'Renovações puxadas', message: `${resultado.criadas} nova(s) de ${resultado.encontradas} encontrada(s).` })
    },
    onError: err => toast({ type: 'error', title: 'Erro ao puxar renovações', message: err?.message || 'Tente novamente.' }),
  })

  const { mutateAsync: puxarPlanilha, isPending: puxandoPlanilha } = useMutation({
    mutationFn: rows => puxarRenovacoesDePlanilha(mesParaPuxar, rows),
    onSuccess: async resultado => {
      setResumoPuxar({ tipo: 'xls', ...resultado })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
      toast({ type: 'success', title: 'Planilha importada', message: `${resultado.importadas} nova(s), ${resultado.duplicadas} duplicada(s) ignorada(s).` })
    },
    onError: err => toast({ type: 'error', title: 'Erro ao importar planilha', message: err?.message || 'Arquivo inválido.' }),
  })

  const { mutateAsync: marcarConcluido, isPending: marcandoConcluido } = useMutation({
    mutationFn: () => marcarMesRenovacaoConcluido(mesParaPuxar, user?.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auto-renovacao-mes-status-unico', mesParaPuxar] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacao-mes-status'] })
      toast({ type: 'success', title: 'Mês marcado como concluído' })
    },
    onError: err => toast({ type: 'error', title: 'Erro ao marcar mês concluído', message: err?.message || 'Tente novamente.' }),
  })

  async function handleUploadPlanilhaRenovacao(event) {
    const file = event.target.files?.[0]
    if (xlsInputRef.current) xlsInputRef.current.value = ''
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
      // A UI pede a aba do mes-alvo um ano antes; se ela nao existir na
      // planilha, caimos na ultima aba para nao travar o upload.
      const abaAlvo = encontrarAbaDoMes(workbook.SheetNames, shiftMonth(mesParaPuxar, -12))
        || workbook.SheetNames[workbook.SheetNames.length - 1]
      const rows = parseAutoComissaoPlanilha(workbook, abaAlvo)
      await puxarPlanilha(rows)
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao ler planilha', message: error?.message || 'Arquivo inválido ou fora do modelo esperado.' })
    }
  }

  const [cotandoId, setCotandoId] = useState(null)

  const { mutateAsync: cotarRenovacao } = useMutation({
    mutationFn: renovacaoId => iniciarCotacaoRenovacao(renovacaoId),
    onSuccess: async ({ cotacaoId }) => {
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
      await qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      navigate(`/auto/cotacoes/${cotacaoId}`)
    },
    onSettled: () => setCotandoId(null),
  })

  const handleCotar = async (renovacaoId) => {
    if (cotandoId) return
    setCotandoId(renovacaoId)
    try {
      await cotarRenovacao(renovacaoId)
    } catch (err) {
      window.alert(err?.message || 'Erro ao iniciar cotação de renovação.')
    }
  }

  const { mutateAsync: cancelarRenovacaoAsync, isPending: cancelando } = useMutation({
    mutationFn: ({ id, motivo }) => cancelarRenovacao(id, motivo),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      await qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
    },
  })

  function handleCancelar(id) {
    const motivo = window.prompt('Motivo do cancelamento (opcional):')
    if (motivo === null) return
    cancelarRenovacaoAsync({ id, motivo: motivo || null })
  }

  const metricas = useMemo(() => ({
    total: renovacoes.length,
    enviadas: renovacoes.filter(item => getRenewalQuoteStatus(item) === 'aguardando_retorno').length,
    pendentes: renovacoes.filter(item => getRenewalQuoteStatus(item) !== 'concluida').length,
    vencemNoMes: todasRenovacoes.filter(item => monthKey(item.vigencia_fim) === mesRef).length,
    vencemMesSeguinte: todasRenovacoes.filter(item => monthKey(item.vigencia_fim) === mesSeguinteRef).length,
  }), [renovacoes, todasRenovacoes, mesRef, mesSeguinteRef])

  const acompanharResumo = useMemo(() => {
    const status = todasRenovacoes.map(getRenewalQuoteStatus)
    return {
      total: todasRenovacoes.length,
      enviadas: status.filter(s => s === 'aguardando_retorno').length,
      cotadaNaoEnviada: status.filter(s => s === 'em_andamento').length,
      naoCotada: status.filter(s => s === 'nao_cotada').length,
      renovadas: todasRenovacoes.filter(item => item.status_renovacao === 'renovada').length,
      pendentes: todasRenovacoes.filter(item => item.status_renovacao === 'pendente').length,
    }
  }, [todasRenovacoes])

  const acompanharLista = useMemo(() => {
    if (acompanharFiltro === 'todas') return todasRenovacoes
    return todasRenovacoes.filter(item => getRenewalQuoteStatus(item) === acompanharFiltro)
  }, [todasRenovacoes, acompanharFiltro])

  return (
    <div className="auto-page space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Modulo auto"
        title="Renovações Auto"
        description={`Acompanhe vencimentos, situação da cotação e o que ainda precisa sair para proteger a carteira em ${formatarMes(mesRef)}.`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <input type="month" value={mesRef} onChange={e => setMesRef(e.target.value || currentMonthRef())} className="input" />
            <button onClick={() => setPainelPuxarAberto(v => !v)} className="btn-secondary">
              {painelPuxarAberto ? 'Ocultar puxar renovações' : 'Puxar renovações'}
            </button>
            <button onClick={() => navigate('/auto/emissoes')} className="btn-secondary">Abrir emissões</button>
          </div>
        )}
        stats={(
          <>
            <MetricCard label="Renovações" value={metricas.total} hint="itens no recorte ativo" icon={<RefreshCw className="w-5 h-5" />} />
            <MetricCard label="Vencem no mês" value={metricas.vencemNoMes} hint={formatarMes(mesRef)} tone="warning" icon={<CalendarClock className="w-5 h-5" />} />
            <MetricCard label="Vencem mês seguinte" value={metricas.vencemMesSeguinte} hint={formatarMes(mesSeguinteRef)} tone="warning" icon={<Clock className="w-5 h-5" />} />
            <MetricCard label="Aguardando retorno" value={metricas.enviadas} hint="em negociação/vistoria" tone="success" icon={<CheckCircle2 className="w-5 h-5" />} />
          </>
        )}
      />

      <DataCard className="overflow-hidden border-brand-accent/12" bodyClassName="p-0">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-accent/10 via-transparent to-brand-secondary/8 p-6 md:p-8">
            <div className="absolute -right-6 top-0 h-28 w-28 rounded-full bg-brand-accent/10 blur-3xl" />
            <div className="relative z-[1] max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-dark-surface/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-status-info">
                <Clock className="h-3.5 w-3.5" />
                Leitura da carteira
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-dark-text md:text-3xl">
                Renovações com foco em risco, prazo e envio.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-dark-muted">
                O módulo agora respeita o mês selecionado e destaca o que vence no período, o que vence no mês seguinte e o status operacional de cada apólice.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="badge badge-success">{metricas.enviadas} aguardando retorno</span>
                <span className="badge badge-warning">{metricas.pendentes} pendentes</span>
                <span className="badge badge-muted">{metricas.total} no recorte</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 bg-dark-surface2/45 p-6 md:p-8 sm:grid-cols-2 lg:grid-cols-1">
            {[
              { label: 'Aguardando retorno', value: acompanharResumo.enviadas, hint: 'em negociação/vistoria', tone: 'success' },
              { label: 'Cotação em andamento', value: acompanharResumo.cotadaNaoEnviada, hint: 'cotação criada, sem retorno ainda', tone: 'warning' },
              { label: 'Não cotadas', value: acompanharResumo.naoCotada, hint: 'sem cotação iniciada', tone: 'danger' },
              { label: 'Renovadas', value: acompanharResumo.renovadas, hint: `de ${acompanharResumo.total} no total`, tone: 'accent' },
            ].map(item => (
              <div key={item.label} className="rounded-3xl border border-dark-border/70 bg-dark-surface/75 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dark-muted">{item.label}</p>
                  <span className={`h-2.5 w-2.5 rounded-full ${item.tone === 'success' ? 'bg-status-success' : item.tone === 'warning' ? 'bg-status-warning' : item.tone === 'danger' ? 'bg-status-danger' : 'bg-brand-accent'}`} />
                </div>
                <p className="mt-2 text-2xl font-semibold text-dark-text">{item.value}</p>
                <p className="mt-2 text-xs text-dark-muted">{item.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </DataCard>

      <FilterBar>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODOS.map(item => (
            <button
              key={item.value}
              onClick={() => setPeriodo(item.value)}
              className={`rounded-2xl border px-4 py-2 text-sm font-medium transition-all ${
                periodo === item.value
                  ? 'border-brand-accent bg-brand-accent/10 text-status-info'
                  : 'border-dark-border text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </FilterBar>

      {painelPuxarAberto && (
        <DataCard
          title="Puxar renovações"
          subtitle="Traga para a lista as apólices que vencem no mês escolhido, a partir do sistema ou de uma planilha."
          actions={(
            <button onClick={() => setPainelPuxarAberto(false)} className="btn-secondary text-xs">Fechar</button>
          )}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 rounded-2xl border border-dark-border bg-dark-surface/75 px-3 py-2 text-sm text-dark-text">
                Mês a organizar
                <input
                  type="month"
                  value={mesParaPuxar}
                  onChange={e => { setMesParaPuxar(e.target.value); setResumoPuxar(null) }}
                  className="bg-transparent outline-none"
                />
              </label>
              {statusMesPuxar?.concluido_em ? (
                <span className="badge badge-success">Mês já marcado como concluído em {formatarData(statusMesPuxar.concluido_em.slice(0, 10))}</span>
              ) : (
                <span className="badge badge-warning">Mês ainda não concluído</span>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                <p className="text-sm font-semibold text-dark-text">Puxar do sistema</p>
                <p className="mt-1 text-xs text-dark-muted">Busca apólices emitidas no mesmo mês, um ano antes.</p>
                <button
                  onClick={() => puxarDoSistema()}
                  disabled={puxandoSistema}
                  className="btn-primary mt-3 inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {puxandoSistema ? 'Puxando...' : 'Puxar renovações do sistema'}
                </button>
              </div>
              <div className="rounded-3xl border border-dark-border/70 bg-dark-surface2/40 p-4">
                <p className="text-sm font-semibold text-dark-text">Puxar por planilha</p>
                <p className="mt-1 text-xs text-dark-muted">Suba a aba do mês-alvo um ano antes (ex.: para {formatarMes(mesParaPuxar)}, a aba de {formatarMes(shiftMonth(mesParaPuxar, -12))}).</p>
                <input
                  ref={xlsInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleUploadPlanilhaRenovacao}
                  className="hidden"
                  id="upload-planilha-renovacao"
                />
                <label
                  htmlFor="upload-planilha-renovacao"
                  className={`btn-secondary mt-3 inline-flex cursor-pointer items-center gap-2 ${puxandoPlanilha ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <Upload className="h-4 w-4" />
                  {puxandoPlanilha ? 'Importando...' : 'Selecionar planilha (.xlsx)'}
                </label>
              </div>
            </div>

            {resumoPuxar && (
              <div className="rounded-2xl border border-brand-accent/20 bg-brand-accent/5 px-4 py-3 text-sm text-dark-text">
                {resumoPuxar.tipo === 'sistema'
                  ? `${resumoPuxar.encontradas} apólice(s) encontrada(s), ${resumoPuxar.criadas} nova(s) renovação(ões) criada(s).`
                  : `${resumoPuxar.lidas} linha(s) lida(s), ${resumoPuxar.importadas} nova(s), ${resumoPuxar.duplicadas} duplicada(s) ignorada(s)${resumoPuxar.foraDoMes ? `, ${resumoPuxar.foraDoMes} fora do mes selecionado` : ''}.`}
              </div>
            )}

            <div className="flex justify-end border-t border-dark-border/60 pt-4">
              <button
                onClick={() => marcarConcluido()}
                disabled={marcandoConcluido}
                className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
              >
                {marcandoConcluido ? 'Salvando...' : 'Marcar mês concluído'}
              </button>
            </div>
          </div>
        </DataCard>
      )}

      <DataCard title="Lista de renovações" subtitle="Clique em uma renovação para abrir a área completa da apólice." className="overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando renovações...</div>
        ) : renovacoes.length === 0 ? (
          <EmptyState icon={<RefreshCw className="w-6 h-6" />} title="Nenhuma renovação no recorte" description="Quando houver itens no período selecionado, eles aparecerão aqui." />
        ) : (
          <div className="space-y-3">
            {renovacoes.map(item => {
              const apolice = item.apolices_auto || {}
              const renovacaoInfo = RENOVACAO_STATUS[item.status_renovacao || 'pendente'] || RENOVACAO_STATUS.pendente
              const dias = diasParaVencer(item.vigencia_fim)
              const concluida = item.status_renovacao === 'renovada'
              const proximoMes = monthKey(item.vigencia_fim) === mesSeguinteRef
              const urgenciaKey = getRenovacaoUrgencia({ dias, concluida, proximoMes })
              const urgencia = RENOVACAO_URGENCIA_META[urgenciaKey]
              const areaStatusKey = getRenovacaoAreaStatus(item)
              const areaStatus = RENOVACAO_AREA_STATUS_META[areaStatusKey]
              const comissao = getComissaoAtualAnterior(item)
              const apoliceId = apolice.id || item.apolice_id
              const seguradoraNome = item.seguradora || apolice.seguradora || null
              const isCotando = cotandoId === item.id
              return (
                <article
                  key={item.id}
                  onClick={() => apoliceId && navigate(`/auto/apolices/${apoliceId}`)}
                  className={`group relative overflow-hidden rounded-3xl border p-4 transition-all ${urgencia.rowClass} ${apoliceId ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
                >
                  <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-60" />
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-dark-text">{item.clientes_auto?.nome_completo || apolice.nome_cliente || item.nome_segurado_anterior || '-'}</h3>
                        <span className={`badge ${urgencia.badgeClass}`}>{urgencia.label}</span>
                        <span className={`badge ${toneClasses(areaStatus.tone)}`}>{areaStatus.label}</span>
                        <span className={`badge ${renovacaoInfo.cls}`}>{renovacaoInfo.label}</span>
                        {typeof dias === 'number' && (
                          <span className="badge badge-muted">{formatDiasParaVencer(dias)}</span>
                        )}
                        <span className="badge badge-muted">{proximoMes ? 'Próximo mês' : 'Mês atual'}</span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                        <div className="rounded-2xl border border-white/60 bg-white/70 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Apólice</p>
                          <p className="mt-1 font-semibold text-dark-text">{apolice.numero_apolice || 'Sem número'}</p>
                          <p className="mt-1 text-xs text-dark-muted">{formatarData(apolice.vigencia_inicio)} até {formatarData(item.vigencia_fim || apolice.vigencia_fim)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/60 bg-white/70 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Cliente vinculado</p>
                          <p className="mt-1 font-semibold text-dark-text">{item.clientes_auto?.nome_completo || apolice.nome_cliente || item.nome_segurado_anterior || '-'}</p>
                          <p className="mt-1 text-xs text-dark-muted">{item.clientes_auto?.celular || item.clientes_auto?.telefone || item.clientes_auto?.email || 'Sem contato principal'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/60 bg-white/70 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Seguradora</p>
                          {seguradoraNome ? (
                            <SeguradoraBadge nome={seguradoraNome} size="sm" className="mt-1" />
                          ) : (
                            <p className="mt-1 font-semibold text-dark-text">Não informada</p>
                          )}
                          <p className="mt-1 text-xs text-dark-muted">Veículo: {apolice.modelo_veiculo || '—'} · Placa: {apolice.placa || '—'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/60 bg-white/70 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Informações da emissão</p>
                          <p className="mt-1 font-semibold text-dark-text">Emissão #{apolice.emissao_id || '—'}</p>
                          <p className="mt-1 text-xs text-dark-muted">Pagamento: {apolice.forma_pagamento || '—'} · Parcelamento: {apolice.parcelamento || '—'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/60 bg-white/70 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Prazo e comissão</p>
                          <p className="mt-1 text-xs text-dark-muted">Limite p/ envio: {formatarData(item.data_limite_envio)}</p>
                          <p className="mt-1 text-xs text-dark-muted">
                            Comissão atual: {comissao.atual != null ? `${comissao.atual}%` : '—'} · anterior: {comissao.anterior != null ? `${comissao.anterior}%` : '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-[240px] flex-col gap-3" onClick={e => e.stopPropagation()}>
                      {item.cotacao_id ? (
                        <button
                          onClick={() => navigate(`/auto/cotacoes/${item.cotacao_id}`)}
                          className="btn-secondary inline-flex items-center justify-center gap-2"
                        >
                          Ver cotação
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCotar(item.id)}
                          disabled={isCotando}
                          className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {isCotando ? 'Criando cotação...' : 'Fazer Cotação'}
                        </button>
                      )}
                      {apoliceId && (
                        <button onClick={() => navigate(`/auto/apolices/${apoliceId}`)} className="btn-secondary inline-flex items-center justify-center gap-2">
                          Abrir apólice
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      )}
                      {areaStatusKey !== 'renovado' && areaStatusKey !== 'cancelado' && (
                        <button
                          onClick={() => handleCancelar(item.id)}
                          disabled={cancelando}
                          className="rounded-2xl border border-status-danger/30 bg-status-danger/5 px-3 py-2 text-xs font-semibold text-status-danger transition-colors hover:bg-status-danger/10 disabled:opacity-60"
                        >
                          Cancelar renovação
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </DataCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-status-success/20 bg-gradient-to-br from-status-success/8 to-white/70 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-status-success">
            <Send className="w-4 h-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Aguardando retorno</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-dark-text">{acompanharResumo.enviadas}</p>
          <p className="mt-1 text-xs text-dark-muted">prontas para fechamento</p>
        </div>

        <div className="rounded-[28px] border border-status-warning/20 bg-gradient-to-br from-status-warning/8 to-white/70 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-status-warning">
            <Clock className="w-4 h-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Cotação em andamento</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-dark-text">{acompanharResumo.cotadaNaoEnviada}</p>
          <p className="mt-1 text-xs text-dark-muted">aguardando envio ao cliente</p>
        </div>

        <div className="rounded-[28px] border border-status-danger/20 bg-gradient-to-br from-status-danger/8 to-white/70 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-status-danger">
            <XCircle className="w-4 h-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Não cotadas</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-dark-text">{acompanharResumo.naoCotada}</p>
          <p className="mt-1 text-xs text-dark-muted">sem cotação iniciada</p>
        </div>

        <div className="rounded-[28px] border border-brand-accent/20 bg-gradient-to-br from-brand-accent/10 to-white/70 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-status-info">
            <CheckCircle2 className="w-4 h-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em]">Renovadas</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-dark-text">{acompanharResumo.renovadas}</p>
          <p className="mt-1 text-xs text-dark-muted">de {acompanharResumo.total} no total</p>
        </div>
      </div>

      <DataCard
        title="Acompanhar renovações"
        subtitle="Visão completa do status de todas as renovações da carteira"
        actions={(
          <div className="flex flex-wrap gap-2">
            {ACOMPANHAR_FILTROS.map(f => (
              <button
                key={f.value}
                onClick={() => setAcompanharFiltro(f.value)}
                className={`rounded-2xl border px-3 py-1.5 text-xs font-medium transition-all ${
                  acompanharFiltro === f.value
                    ? 'border-brand-accent bg-brand-accent/10 text-status-info'
                    : 'border-dark-border text-dark-muted hover:border-brand-accent/40 hover:text-dark-text'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      >
        {loadingTodas ? (
          <div className="py-12 text-center text-sm text-dark-muted">Carregando...</div>
        ) : acompanharLista.length === 0 ? (
          <EmptyState icon={<RefreshCw className="w-6 h-6" />} title="Nenhuma renovação encontrada" description="Nenhuma renovação corresponde ao filtro selecionado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border/60 text-left">
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Cliente</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradora</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Vencimento</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Cotação</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Resultado</th>
                  <th className="pb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/40">
                {acompanharLista.map(item => {
                  const areaStatusKeyTabela = getRenovacaoAreaStatus(item)
                  const cotacaoInfo = RENOVACAO_AREA_STATUS_META[areaStatusKeyTabela]
                  const renovacaoInfo = RENOVACAO_STATUS[item.status_renovacao || 'pendente'] || RENOVACAO_STATUS.pendente
                  const apoliceId = item.apolices_auto?.id || item.apolice_id
                  const isCotando = cotandoId === item.id
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-brand-accent/5">
                      <td className="py-3 pr-4 font-medium text-dark-text">{item.clientes_auto?.nome_completo || item.apolices_auto?.nome_cliente || item.nome_segurado_anterior || '-'}</td>
                      <td className="py-3 pr-4 text-dark-muted">{item.seguradora || '-'}</td>
                      <td className="py-3 pr-4 text-dark-muted">{formatarData(item.vigencia_fim)}</td>
                      <td className="py-3 pr-4"><span className={`badge ${toneClasses(cotacaoInfo.tone)}`}>{cotacaoInfo.label}</span></td>
                      <td className="py-3 pr-4"><span className={`badge ${renovacaoInfo.cls}`}>{renovacaoInfo.label}</span></td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {item.cotacao_id ? (
                            <button onClick={() => navigate(`/auto/cotacoes/${item.cotacao_id}`)} className="rounded-2xl border border-brand-secondary/20 bg-brand-secondary/8 px-3 py-1.5 text-xs font-semibold text-status-info">
                              Ver cotação
                            </button>
                          ) : (
                            <button onClick={() => handleCotar(item.id)} disabled={isCotando} className="rounded-2xl border border-brand-accent/30 bg-brand-accent/10 px-3 py-1.5 text-xs font-semibold text-status-info disabled:opacity-60">
                              {isCotando ? 'Criando...' : 'Cotar'}
                            </button>
                          )}
                          {apoliceId && (
                            <button onClick={() => navigate(`/auto/apolices/${apoliceId}`)} className="rounded-2xl border border-brand-secondary/20 bg-brand-secondary/8 px-3 py-1.5 text-xs font-semibold text-status-info">
                              Abrir apólice
                            </button>
                          )}
                          {!item.cotacao_id && !apoliceId && '—'}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  )
}
