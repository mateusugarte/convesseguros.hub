import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { ArrowLeft, CalendarClock, ExternalLink, RefreshCw, Upload, XCircle } from 'lucide-react'
import {
  atualizarStatusRenovacao,
  buscarClientesAuto,
  criarRenovacaoManual,
  excluirRenovacao,
  getAutoRenovacaoMesStatus,
  getRenovacoesAuto,
  marcarMesRenovacaoConcluido,
  puxarRenovacoesDePlanilha,
  puxarRenovacoesDoSistema,
} from '../../lib/auto'
import SeguradoraSelect from '../../components/SeguradoraSelect'
import { parseAutoComissaoPlanilha } from '../../lib/autoComissaoImport'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { PageHeader, DataCard, EmptyState } from '../../components/ui'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import ModalEditarRenovacao from './ModalEditarRenovacao'
import { isValidIsoDate, subtrairDiasUteis } from './autoShared'

const PRAZO_ENVIO_ORCAMENTO_DIAS_UTEIS = 7

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

// Remove marcas diacriticas (acentos) apos normalizar em NFD, comparando o
// code point direto em vez de um literal de regex Unicode no arquivo fonte
// (evita risco de mojibake ao salvar/reabrir com encoding diferente).
function normalizarNomeAba(valor) {
  const semAcento = Array.from(String(valor ?? '').normalize('NFD'))
    .filter(ch => {
      const code = ch.codePointAt(0)
      return code < 0x300 || code > 0x36f
    })
    .join('')
  return semAcento
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

// Area dedicada a organizar as renovacoes de um mes: puxar do sistema, puxar
// por planilha ou criar uma a uma manualmente — com a lista do que ja foi
// organizado para o mes sempre visivel logo abaixo, atualizada a cada acao
// (nao precisa voltar para /auto/renovacoes so para confirmar que colou).
export default function AutoRenovacoesPuxar() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [mesParaPuxar, setMesParaPuxar] = useState(() => searchParams.get('mes') || currentMonthRef())
  const [resumoPuxar, setResumoPuxar] = useState(null)
  const xlsInputRef = useRef(null)
  const qc = useQueryClient()

  const { data: renovacoesDoMes = [], isLoading: loadingRenovacoesDoMes, isError: isErrorRenovacoesDoMes, error: errorRenovacoesDoMes } = useQuery({
    queryKey: ['auto-renovacoes', 'mes_atual', mesParaPuxar],
    queryFn: () => getRenovacoesAuto({ periodo: 'mes_atual', mes: mesParaPuxar }),
  })

  const { data: statusMesPuxar } = useQuery({
    queryKey: ['auto-renovacao-mes-status-unico', mesParaPuxar],
    queryFn: async () => (await getAutoRenovacaoMesStatus([mesParaPuxar]))[mesParaPuxar] || null,
  })

  async function refetchListaDoMes() {
    await qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
    await qc.invalidateQueries({ queryKey: ['auto-renovacoes-todas'] })
  }

  const { mutateAsync: puxarDoSistema, isPending: puxandoSistema } = useMutation({
    mutationFn: () => puxarRenovacoesDoSistema(mesParaPuxar),
    onSuccess: async resultado => {
      setResumoPuxar({ tipo: 'sistema', ...resultado })
      await refetchListaDoMes()
      toast({ type: 'success', title: 'Renovações puxadas', message: `${resultado.criadas} nova(s) de ${resultado.encontradas} encontrada(s).` })
    },
    onError: err => toast({ type: 'error', title: 'Erro ao puxar renovações', message: err?.message || 'Tente novamente.' }),
  })

  const { mutateAsync: puxarPlanilha, isPending: puxandoPlanilha } = useMutation({
    mutationFn: rows => puxarRenovacoesDePlanilha(mesParaPuxar, rows),
    onSuccess: async resultado => {
      setResumoPuxar({ tipo: 'xls', ...resultado })
      await refetchListaDoMes()
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

  const [editandoRenovacao, setEditandoRenovacao] = useState(null)

  const { mutateAsync: salvarEdicaoAsync, isPending: salvandoEdicao } = useMutation({
    mutationFn: ({ id, campos }) => atualizarStatusRenovacao(id, campos),
    onSuccess: async () => {
      await refetchListaDoMes()
      toast({ type: 'success', title: 'Renovação atualizada' })
      setEditandoRenovacao(null)
    },
    onError: err => toast({ type: 'error', title: 'Erro ao atualizar renovação', message: err?.message || 'Tente novamente.' }),
  })

  const { mutateAsync: excluirRenovacaoAsync, isPending: excluindo } = useMutation({
    mutationFn: id => excluirRenovacao(id),
    onSuccess: async () => {
      await refetchListaDoMes()
      toast({ type: 'success', title: 'Renovação excluída' })
    },
    onError: err => toast({ type: 'error', title: 'Erro ao excluir renovação', message: err?.message || 'Tente novamente.' }),
  })

  function handleExcluir(id) {
    if (!window.confirm('Excluir esta renovação definitivamente? Essa ação não pode ser desfeita.')) return
    excluirRenovacaoAsync(id)
  }

  const [manualBusca, setManualBusca] = useState('')
  const [manualClientes, setManualClientes] = useState([])
  const [buscandoManual, setBuscandoManual] = useState(false)
  const [manualClienteId, setManualClienteId] = useState('')
  const [manualNomeLivre, setManualNomeLivre] = useState('')
  const [manualSeguradora, setManualSeguradora] = useState('')
  const [manualVigenciaFim, setManualVigenciaFim] = useState('')
  const [manualDataLimite, setManualDataLimite] = useState('')
  const [manualPossuiDoisVeiculos, setManualPossuiDoisVeiculos] = useState(false)
  const [manualIdentificacaoVeiculo, setManualIdentificacaoVeiculo] = useState('')

  async function handleBuscarClienteManual() {
    const termo = manualBusca.trim()
    if (!termo) return
    setBuscandoManual(true)
    try {
      setManualClientes(await buscarClientesAuto(termo))
    } catch (err) {
      toast({ type: 'error', title: 'Erro ao buscar cliente', message: err?.message || 'Tente novamente.' })
    } finally {
      setBuscandoManual(false)
    }
  }

  // Sugere a data limite 7 dias uteis antes do vencimento na primeira vez que
  // o usuario preenche o vencimento; depois disso o campo fica livre para
  // edicao manual sem ser sobrescrito de novo. So calcula quando o valor for
  // uma data completa e valida — o input nativo de data dispara onChange a
  // cada digito, e um valor parcial/invalido nao deve gerar sugestao.
  function handleVigenciaFimManual(value) {
    setManualVigenciaFim(value)
    if (!manualDataLimite && isValidIsoDate(value)) {
      setManualDataLimite(subtrairDiasUteis(value, PRAZO_ENVIO_ORCAMENTO_DIAS_UTEIS))
    }
  }

  function limparFormularioManual() {
    setManualBusca('')
    setManualClientes([])
    setManualClienteId('')
    setManualNomeLivre('')
    setManualSeguradora('')
    setManualVigenciaFim('')
    setManualDataLimite('')
    setManualPossuiDoisVeiculos(false)
    setManualIdentificacaoVeiculo('')
  }

  const { mutateAsync: criarManualAsync, isPending: criandoManual } = useMutation({
    mutationFn: () => criarRenovacaoManual({
      cliente_id: manualClienteId || null,
      nomeManual: manualClienteId ? null : manualNomeLivre,
      seguradora: manualSeguradora,
      vigencia_fim: manualVigenciaFim,
      data_limite_envio: manualDataLimite || null,
      identificacaoVeiculo: manualPossuiDoisVeiculos ? manualIdentificacaoVeiculo.trim() || null : null,
    }),
    onSuccess: async () => {
      toast({ type: 'success', title: 'Renovação criada', message: 'Já aparece na lista abaixo.' })
      limparFormularioManual()
      await refetchListaDoMes()
    },
    onError: err => toast({ type: 'error', title: 'Erro ao criar renovação', message: err?.message || 'Tente novamente.' }),
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

  return (
    <div className="auto-page space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="Modulo auto"
        title="Puxar renovações"
        description={`Organize a carteira de renovações de ${formatarMes(mesParaPuxar)}: puxe do sistema, importe da planilha ou cadastre uma a uma.`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate('/auto/renovacoes')} className="btn-secondary inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar para lista de renovações
            </button>
          </div>
        )}
      />

      <DataCard title="Mês a organizar">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 rounded-2xl border border-dark-border bg-dark-surface/75 px-3 py-2 text-sm text-dark-text">
            <CalendarClock className="h-4 w-4 text-dark-muted" />
            <input
              type="month"
              value={mesParaPuxar}
              onChange={e => { setMesParaPuxar(e.target.value || currentMonthRef()); setResumoPuxar(null) }}
              className="bg-transparent outline-none"
            />
          </label>
          {statusMesPuxar?.concluido_em ? (
            <span className="badge badge-success">Mês já marcado como concluído em {formatarData(statusMesPuxar.concluido_em.slice(0, 10))}</span>
          ) : (
            <span className="badge badge-warning">Mês ainda não concluído</span>
          )}
        </div>
      </DataCard>

      <div className="grid gap-3 md:grid-cols-2">
        <DataCard title="Puxar do sistema" subtitle="Busca apólices emitidas no mesmo mês, um ano antes.">
          <button
            onClick={() => puxarDoSistema()}
            disabled={puxandoSistema}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
          >
            {puxandoSistema ? 'Puxando...' : 'Puxar renovações do sistema'}
          </button>
        </DataCard>
        <DataCard title="Puxar por planilha" subtitle={`Suba a aba do mês-alvo um ano antes (ex.: para ${formatarMes(mesParaPuxar)}, a aba de ${formatarMes(shiftMonth(mesParaPuxar, -12))}).`}>
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
            className={`btn-secondary inline-flex cursor-pointer items-center gap-2 ${puxandoPlanilha ? 'pointer-events-none opacity-60' : ''}`}
          >
            <Upload className="h-4 w-4" />
            {puxandoPlanilha ? 'Importando...' : 'Selecionar planilha (.xlsx)'}
          </label>
        </DataCard>
      </div>

      <DataCard title="Criar manualmente" subtitle="Cadastre uma renovação direto, sem depender do puxar automático nem de planilha.">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Segurado</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={manualBusca}
                onChange={e => { setManualBusca(e.target.value); setManualClienteId('') }}
                placeholder="Buscar cliente já cadastrado (nome ou CPF)"
                className="input flex-1"
              />
              <button type="button" onClick={handleBuscarClienteManual} disabled={buscandoManual} className="btn-secondary disabled:opacity-60">
                {buscandoManual ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            {manualClientes.length > 0 && (
              <select
                value={manualClienteId}
                onChange={e => setManualClienteId(e.target.value)}
                className="input mt-2 w-full"
              >
                <option value="">Cliente não cadastrado — digitar nome abaixo</option>
                {manualClientes.map(cliente => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome_completo} · {cliente.cpf || 'sem CPF'}
                  </option>
                ))}
              </select>
            )}

            {!manualClienteId && (
              <input
                value={manualNomeLivre}
                onChange={e => setManualNomeLivre(e.target.value)}
                placeholder="Nome do segurado (cliente ainda não cadastrado)"
                className="input mt-2 w-full"
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradora</label>
            <SeguradoraSelect value={manualSeguradora} onChange={setManualSeguradora} produto="auto" placeholder="Selecionar seguradora" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Data de vencimento</label>
            <input type="date" value={manualVigenciaFim} onChange={e => handleVigenciaFimManual(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Data limite da cotação</label>
            <input type="date" value={manualDataLimite} onChange={e => setManualDataLimite(e.target.value)} className="input w-full" />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-dark-text">
              <input
                type="checkbox"
                checked={manualPossuiDoisVeiculos}
                onChange={e => {
                  setManualPossuiDoisVeiculos(e.target.checked)
                  if (!e.target.checked) setManualIdentificacaoVeiculo('')
                }}
              />
              Possui 2 veículos?
            </label>
            {manualPossuiDoisVeiculos && (
              <input
                value={manualIdentificacaoVeiculo}
                onChange={e => setManualIdentificacaoVeiculo(e.target.value)}
                placeholder="Qual veículo é essa renovação? (ex.: Gol branco placa ABC1234)"
                className="input mt-2 w-full"
              />
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => criarManualAsync()}
          disabled={criandoManual || !manualVigenciaFim || (!manualClienteId && !manualNomeLivre.trim())}
          className="btn-primary mt-3 inline-flex items-center gap-2 disabled:opacity-60"
        >
          {criandoManual ? 'Criando...' : 'Criar renovação'}
        </button>

        {resumoPuxar && (
          <div className="mt-4 rounded-2xl border border-brand-accent/20 bg-brand-accent/5 px-4 py-3 text-sm text-dark-text">
            {resumoPuxar.tipo === 'sistema'
              ? `${resumoPuxar.encontradas} apólice(s) encontrada(s), ${resumoPuxar.criadas} nova(s) renovação(ões) criada(s).`
              : `${resumoPuxar.lidas} linha(s) lida(s), ${resumoPuxar.importadas} nova(s), ${resumoPuxar.duplicadas} duplicada(s) ignorada(s)${resumoPuxar.foraDoMes ? `, ${resumoPuxar.foraDoMes} fora do mes selecionado` : ''}.`}
          </div>
        )}

        <div className="mt-4 flex justify-end border-t border-dark-border/60 pt-4">
          <button
            onClick={() => marcarConcluido()}
            disabled={marcandoConcluido}
            className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
          >
            {marcandoConcluido ? 'Salvando...' : 'Marcar mês concluído'}
          </button>
        </div>
      </DataCard>

      <DataCard
        title={`Renovações de ${formatarMes(mesParaPuxar)}`}
        subtitle="Cada renovação puxada ou criada aqui aparece nesta lista assim que for salva."
      >
        {loadingRenovacoesDoMes ? (
          <div className="py-8 text-center text-sm text-dark-muted">Carregando...</div>
        ) : isErrorRenovacoesDoMes ? (
          <EmptyState icon={<XCircle className="w-6 h-6" />} title="Erro ao carregar renovações" description={errorRenovacoesDoMes?.message || 'Tente recarregar a página.'} />
        ) : renovacoesDoMes.length === 0 ? (
          <EmptyState icon={<RefreshCw className="w-6 h-6" />} title="Nenhuma renovação neste mês ainda" description="Puxe do sistema, importe a planilha ou crie manualmente acima." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-border/60 text-left">
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Cliente</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Seguradora</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Vencimento</th>
                  <th className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Origem</th>
                  <th className="pb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/40">
                {renovacoesDoMes.map(item => {
                  const apolice = item.apolices_auto || {}
                  const apoliceId = apolice.id || item.apolice_id
                  const nome = item.clientes_auto?.nome_completo || apolice.nome_cliente || item.nome_segurado_anterior || '-'
                  const seguradoraNome = item.seguradora || apolice.seguradora || null
                  const origemLabel = item.origem === 'manual' ? 'Manual' : item.origem === 'xls' ? 'Planilha' : 'Sistema'
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-brand-accent/5">
                      <td className="py-3 pr-4 font-medium text-dark-text">
                        {nome}
                        {item.identificacao_veiculo && (
                          <p className="mt-0.5 text-xs font-normal text-dark-muted">Veículo: {item.identificacao_veiculo}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-dark-muted">
                        {seguradoraNome ? <SeguradoraBadge nome={seguradoraNome} size="sm" /> : '-'}
                      </td>
                      <td className="py-3 pr-4 text-dark-muted">{formatarData(item.vigencia_fim)}</td>
                      <td className="py-3 pr-4"><span className="badge badge-muted">{origemLabel}</span></td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {item.cotacao_id ? (
                            <button onClick={() => navigate(`/auto/cotacoes/${item.cotacao_id}`)} className="rounded-2xl border border-brand-secondary/20 bg-brand-secondary/8 px-3 py-1.5 text-xs font-semibold text-status-info inline-flex items-center gap-1">
                              Ver cotação
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          ) : apoliceId ? (
                            <button onClick={() => navigate(`/auto/apolices/${apoliceId}`)} className="rounded-2xl border border-brand-secondary/20 bg-brand-secondary/8 px-3 py-1.5 text-xs font-semibold text-status-info">
                              Abrir apólice
                            </button>
                          ) : (
                            <span className="text-xs text-dark-muted">Ainda não cotada</span>
                          )}
                          <button onClick={() => setEditandoRenovacao(item)} className="rounded-2xl border border-dark-border px-3 py-1.5 text-xs font-semibold text-dark-muted hover:border-brand-accent/40 hover:text-dark-text">
                            Editar
                          </button>
                          <button onClick={() => handleExcluir(item.id)} disabled={excluindo} className="rounded-2xl border border-status-danger/30 bg-status-danger/5 px-3 py-1.5 text-xs font-semibold text-status-danger hover:bg-status-danger/10 disabled:opacity-60">
                            Excluir
                          </button>
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

      {editandoRenovacao && (
        <ModalEditarRenovacao
          renovacao={editandoRenovacao}
          onClose={() => setEditandoRenovacao(null)}
          isSaving={salvandoEdicao}
          onSave={campos => salvarEdicaoAsync({ id: editandoRenovacao.id, campos })}
        />
      )}
    </div>
  )
}
