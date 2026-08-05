import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, Download,
  HelpCircle, FileWarning, ExternalLink,
} from 'lucide-react'
import { Modal } from './ui/Modal'
import { EmptyState } from './ui/EmptyState'
import { verificarFichas, importarFichasFaltantes, descreverMotivo } from '../lib/fichasVerificacao'
import { useToast } from '../contexts/ToastContext'

const JANELAS = [
  { valor: 7, label: '7 dias' },
  { valor: 30, label: '30 dias' },
  { valor: 90, label: '90 dias' },
]

function formatarData(iso, local) {
  if (local) return local
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function chaveLinha(fonteId, linha) {
  return `${fonteId}::${linha}`
}

function Metrica({ icone, valor, label, tom }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${tom}`}>
      {icone}
      <div className="min-w-0">
        <div className="text-xl font-semibold leading-none">{valor}</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.12em] opacity-80">{label}</div>
      </div>
    </div>
  )
}

function LinhaResposta({ item, fonteId, selecionada, onToggle, selecionavel }) {
  const { campos } = item
  return (
    <label
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
        selecionada ? 'border-brand-accent/60 bg-brand-accent/5' : 'border-dark-border bg-dark-surface2/50'
      } ${selecionavel ? 'cursor-pointer hover:border-brand-accent/40' : ''}`}
    >
      {selecionavel && (
        <input
          type="checkbox"
          checked={selecionada}
          onChange={() => onToggle(chaveLinha(fonteId, item.linha))}
          className="mt-1 h-4 w-4 flex-shrink-0 accent-current"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="truncate text-sm font-semibold text-dark-text">
            {campos.nome || 'Sem nome na resposta'}
          </span>
          <span className="text-xs text-dark-muted">{campos.cpf || 'sem CPF'}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dark-muted">
          <span>{formatarData(item.timestamp, item.timestamp_local)}</span>
          {campos.imobiliaria && <span className="truncate">{campos.imobiliaria}</span>}
          {campos.celular && <span>{campos.celular}</span>}
          {campos.orcamentista && <span>Orçamentista: {campos.orcamentista}</span>}
          <span className="rounded-full border border-dark-border px-2 py-0.5">linha {item.linha}</span>
        </div>
        {item.motivo && (
          <p className="mt-1.5 text-xs text-dark-muted/80">{descreverMotivo(item.motivo)}</p>
        )}
        {Array.isArray(item.fichas) && item.fichas.length > 0 && (
          <ul className="mt-2 space-y-1">
            {item.fichas.map(f => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 text-xs text-dark-muted">
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                <a href={`/fichas/${f.id}`} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-dark-text">
                  {f.nome_interessado || f.id}
                </a>
                <span>· {f.status}</span>
                <span>· {formatarData(f.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  )
}

export default function ModalVerificarFichas({ onClose, onImportou }) {
  const toast = useToast()
  const [dias, setDias] = useState(30)
  const [carregando, setCarregando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState(null)
  const [selecionadas, setSelecionadas] = useState(() => new Set())

  const executar = useCallback(async (janela) => {
    setCarregando(true)
    setErro('')
    try {
      const dados = await verificarFichas(janela)
      setResultado(dados)
      setSelecionadas(new Set())
    } catch (err) {
      setErro(String(err.message || err))
      setResultado(null)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { executar(dias) }, [dias, executar])

  const faltantes = useMemo(() => {
    if (!resultado?.fontes) return []
    return resultado.fontes
      .filter(f => f.ok)
      .flatMap(f => (f.faltantes || []).map(item => ({ ...item, fonteId: f.fonte, fonteNome: f.nome, importavel: f.importavel })))
  }, [resultado])

  const incertas = useMemo(() => {
    if (!resultado?.fontes) return []
    return resultado.fontes
      .filter(f => f.ok)
      .flatMap(f => (f.incertas || []).map(item => ({ ...item, fonteId: f.fonte, fonteNome: f.nome })))
  }, [resultado])

  const comErro = useMemo(() => (resultado?.fontes || []).filter(f => !f.ok), [resultado])
  const importaveis = useMemo(() => faltantes.filter(f => f.importavel), [faltantes])

  const alternar = useCallback((chave) => {
    setSelecionadas(prev => {
      const proximo = new Set(prev)
      if (proximo.has(chave)) proximo.delete(chave)
      else proximo.add(chave)
      return proximo
    })
  }, [])

  const todasSelecionadas = importaveis.length > 0 && importaveis.every(f => selecionadas.has(chaveLinha(f.fonteId, f.linha)))

  function alternarTodas() {
    setSelecionadas(todasSelecionadas ? new Set() : new Set(importaveis.map(f => chaveLinha(f.fonteId, f.linha))))
  }

  async function importarSelecionadas() {
    const alvos = importaveis
      .filter(f => selecionadas.has(chaveLinha(f.fonteId, f.linha)))
      .map(f => ({ fonte: f.fonteId, linha: f.linha }))

    if (!alvos.length) return

    setImportando(true)
    try {
      const resposta = await importarFichasFaltantes(alvos, dias)
      const { importadas, falhas, resultados } = resposta

      if (importadas > 0) {
        toast({
          type: 'success',
          title: `${importadas} ficha${importadas > 1 ? 's' : ''} importada${importadas > 1 ? 's' : ''}`,
          message: falhas > 0 ? `${falhas} não puderam ser importadas.` : 'Entraram pelo fluxo normal do n8n.',
        })
        onImportou?.()
      }
      if (falhas > 0) {
        const primeira = resultados.find(r => !r.ok)
        toast({
          type: 'error',
          title: importadas > 0 ? 'Algumas linhas falharam' : 'Nenhuma ficha importada',
          message: primeira?.erro || 'Verifique a configuração do webhook.',
        })
      }
      await executar(dias)
    } catch (err) {
      toast({ type: 'error', title: 'Falha na importação', message: String(err.message || err) })
    } finally {
      setImportando(false)
    }
  }

  const totais = resultado?.totais
  const tudoCerto = resultado && totais && totais.faltantes === 0 && totais.incertas === 0 && comErro.length === 0

  return (
    <Modal
      isOpen
      onClose={onClose}
      maxWidth="lg"
      title="Verificar fichas"
      subtitle="Compara as respostas do Google Forms com as fichas registradas no sistema."
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-dark-muted">
            {selecionadas.size > 0
              ? `${selecionadas.size} selecionada${selecionadas.size > 1 ? 's' : ''} para importar`
              : resultado?.verificado_em
                ? `Verificado às ${new Date(resultado.verificado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : ''}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => executar(dias)}
              disabled={carregando || importando}
              className="flex items-center gap-1.5 rounded-2xl border border-dark-border px-3 py-2 text-xs text-dark-muted transition-colors hover:border-brand-accent/50 hover:text-dark-text disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
              Verificar de novo
            </button>
            <button
              onClick={importarSelecionadas}
              disabled={selecionadas.size === 0 || importando || carregando}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {importando ? 'Importando...' : `Importar ${selecionadas.size || ''}`.trim()}
            </button>
          </div>
        </div>
      )}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-muted">Período</span>
          {JANELAS.map(j => (
            <button
              key={j.valor}
              onClick={() => setDias(j.valor)}
              disabled={carregando || importando}
              className={`rounded-2xl border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                dias === j.valor
                  ? 'border-brand-accent/60 bg-brand-accent/10 text-dark-text'
                  : 'border-dark-border text-dark-muted hover:text-dark-text'
              }`}
            >
              {j.label}
            </button>
          ))}
        </div>

        {erro && (
          <div className="flex items-start gap-3 rounded-2xl border border-status-danger/40 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {carregando && !resultado && (
          <div className="flex items-center justify-center gap-3 py-12 text-sm text-dark-muted">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Lendo a planilha de respostas...
          </div>
        )}

        {totais && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metrica
              icone={<FileWarning className="h-5 w-5" />}
              valor={totais.faltantes}
              label="Faltando no sistema"
              tom={totais.faltantes > 0
                ? 'border-status-danger/40 bg-status-danger/10 text-status-danger'
                : 'border-dark-border bg-dark-surface2/50 text-dark-muted'}
            />
            <Metrica
              icone={<HelpCircle className="h-5 w-5" />}
              valor={totais.incertas}
              label="Precisam de revisão"
              tom={totais.incertas > 0
                ? 'border-status-warning/40 bg-status-warning/10 text-status-warning'
                : 'border-dark-border bg-dark-surface2/50 text-dark-muted'}
            />
            <Metrica
              icone={<CheckCircle2 className="h-5 w-5" />}
              valor={totais.encontradas}
              label="Conferidas"
              tom="border-status-success/40 bg-status-success/10 text-status-success"
            />
          </div>
        )}

        {comErro.map(f => (
          <div key={f.fonte} className="flex items-start gap-3 rounded-2xl border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <div className="font-semibold">{f.nome}</div>
              <div className="text-xs opacity-90">{f.erro}</div>
            </div>
          </div>
        ))}

        {tudoCerto && (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Nenhuma divergência"
            description={`Todas as ${totais.total} respostas dos últimos ${resultado.janela_dias} dias já estão no sistema.`}
          />
        )}

        {faltantes.length > 0 && (
          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-dark-text">
                Na planilha, mas não no sistema ({faltantes.length})
              </h3>
              {importaveis.length > 0 && (
                <button
                  onClick={alternarTodas}
                  className="text-xs text-dark-muted underline decoration-dotted hover:text-dark-text"
                >
                  {todasSelecionadas ? 'Limpar seleção' : 'Selecionar todas'}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {faltantes.map(item => (
                <LinhaResposta
                  key={chaveLinha(item.fonteId, item.linha)}
                  item={item}
                  fonteId={item.fonteId}
                  selecionavel={item.importavel}
                  selecionada={selecionadas.has(chaveLinha(item.fonteId, item.linha))}
                  onToggle={alternar}
                />
              ))}
            </div>
            {importaveis.length === 0 && (
              <p className="text-xs text-dark-muted">
                Importação indisponível: o webhook do n8n não está configurado para esta fonte.
                Cadastre a ficha manualmente em "Nova Ficha".
              </p>
            )}
          </section>
        )}

        {incertas.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-dark-text">
              Precisam de revisão ({incertas.length})
            </h3>
            <p className="text-xs text-dark-muted">
              Existe ficha com o mesmo CPF, mas em data distante da resposta. Pode ser a mesma
              ficha lançada depois, ou um contrato diferente do mesmo cliente — o sistema não
              importa sozinho para não duplicar.
            </p>
            <div className="space-y-2">
              {incertas.map(item => (
                <LinhaResposta
                  key={chaveLinha(item.fonteId, item.linha)}
                  item={item}
                  fonteId={item.fonteId}
                  selecionavel={false}
                  selecionada={false}
                  onToggle={alternar}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  )
}
