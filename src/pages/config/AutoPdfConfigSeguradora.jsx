import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  Ban,
  LoaderCircle,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { PageHeader, EmptyState } from '../../components/ui'
import SeguradoraBadge from '../../components/SeguradoraBadge'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import { fetchSeguradorasCatalog } from '../../lib/seguradoras'
import {
  baixarAmostra,
  enviarAmostra,
  fetchMapeamento,
  lerTextoPdf,
  limparMapeamento,
  salvarMapeamento,
  urlAmostra,
} from '../../lib/autoPdfConfig'
import { agruparCampos, camposDoTipo, TIPOS_MAPEAMENTO, TIPOS_VALOR } from '../../lib/autoPdfCampos'
import {
  aplicarMapeamento,
  mapeamentoInicial,
  resumirMapeamento,
  sugerirMapeamento,
} from '../../lib/autoPdfMapeamento'

function metaDoTipo(tipo) {
  return TIPOS_MAPEAMENTO.find(item => item.tipo === tipo) || TIPOS_MAPEAMENTO[0]
}

/** O valor guardado e normalizado (ISO, numero); na tela ele volta ao formato do usuario. */
function exibir(valor, tipo) {
  if (valor === null || valor === undefined || valor === '') return ''
  switch (tipo) {
    case 'data': {
      const partes = String(valor).split('-')
      return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(valor)
    }
    case 'moeda': {
      const numero = Number(valor)
      return Number.isNaN(numero)
        ? String(valor)
        : numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }
    case 'percentual': {
      const numero = Number(valor)
      return Number.isNaN(numero) ? String(valor) : `${numero.toLocaleString('pt-BR')}%`
    }
    case 'sim_nao':
      return valor === 'nao' ? 'Não' : 'Sim'
    case 'cep': {
      const digitos = String(valor).replace(/\D/g, '')
      return digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : String(valor)
    }
    default:
      return String(valor)
  }
}

function estadoDoCampo(config) {
  if (!config) return 'pendente'
  if (config.ausente) return 'ausente'
  if (config.confirmado && config.valor_exemplo) return 'confirmado'
  if (config.valor_exemplo) return 'sugerido'
  return 'pendente'
}

/**
 * Uma linha de campo na revisao.
 *
 * O usuario ve o que o sistema achou, de onde tirou (a ancora) e decide: correto,
 * incorreto (escolhe entre as alternativas ou digita a ancora) ou nao existe
 * neste PDF. Nada e gravado como certo sem esse clique — e justamente essa
 * confirmacao que transforma o palpite em configuracao confiavel.
 */
function CampoLinha({ definicao, config, candidatos, aberto, onToggle, onConfirmar, onRejeitar, onEscolher, onAusente, onAncoraManual, previewAncora }) {
  const [ancora, setAncora] = useState(config?.rotulo || '')
  const [preview, setPreview] = useState(null)
  const estado = estadoDoCampo(config)

  useEffect(() => { setAncora(config?.rotulo || '') }, [config?.rotulo])

  const cores = {
    confirmado: 'border-status-success/40 bg-status-success/5',
    sugerido: 'border-status-warning/35 bg-status-warning/5',
    ausente: 'border-dark-border bg-dark-surface2/30',
    pendente: 'border-status-danger/30 bg-status-danger/5',
  }[estado]

  function testarAncora() {
    const valor = previewAncora(ancora, definicao.tipo)
    setPreview(valor || '')
  }

  return (
    <div className={`rounded-2xl border p-4 transition-colors ${cores}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-dark-text">{definicao.label}</p>
            {definicao.obrigatorio && <span className="badge badge-blue">Obrigatorio</span>}
            <span className="text-[11px] uppercase tracking-[0.12em] text-dark-muted">{TIPOS_VALOR[definicao.tipo] || definicao.tipo}</span>
          </div>

          {estado === 'ausente' ? (
            <p className="mt-2 text-sm text-dark-muted">Marcado como inexistente neste PDF.</p>
          ) : config?.valor_exemplo ? (
            <>
              <p className="mt-2 break-words text-base font-semibold text-dark-text">
                {exibir(config.valor_exemplo, definicao.tipo)}
              </p>
              <p className="mt-1 text-xs text-dark-muted">
                {config.rotulo
                  ? <>Encontrado em <span className="font-medium text-dark-text">{config.rotulo}</span>{config.ocorrencia ? ` (ocorrencia ${config.ocorrencia + 1})` : ''}</>
                  : <>Sem rotulo no PDF — usa a {(config.ocorrencia ?? 0) + 1}ª ocorrencia deste tipo de valor</>}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-dark-muted">Nada encontrado automaticamente. Informe a ancora abaixo ou marque como inexistente.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onConfirmar}
            disabled={!config?.valor_exemplo}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
              estado === 'confirmado'
                ? 'border-status-success bg-status-success/15 text-status-success'
                : 'border-dark-border text-dark-muted hover:border-status-success/50 hover:text-status-success'
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            Correto
          </button>
          <button
            type="button"
            onClick={onRejeitar}
            className="flex items-center gap-1.5 rounded-xl border border-dark-border px-3 py-1.5 text-xs font-semibold text-dark-muted transition-colors hover:border-status-danger/50 hover:text-status-danger"
          >
            <X className="h-3.5 w-3.5" />
            Incorreto
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-1.5 rounded-xl border border-dark-border px-2.5 py-1.5 text-xs text-dark-muted transition-colors hover:text-dark-text"
            aria-expanded={aberto}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {aberto && (
        <div className="mt-4 space-y-3 border-t border-dark-border/60 pt-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-muted">
              Outras ocorrencias encontradas no PDF
            </p>
            {candidatos.length ? (
              <div className="grid gap-2">
                {candidatos.map((candidato, indice) => {
                  const ativo = config?.rotulo === candidato.rotulo
                    && (config?.ocorrencia ?? 0) === (candidato.ocorrencia ?? 0)
                    && config?.valor_exemplo === candidato.valor
                  return (
                    <button
                      key={`${candidato.rotulo || 'sem-rotulo'}-${candidato.ocorrencia}-${indice}`}
                      type="button"
                      onClick={() => onEscolher(candidato)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                        ativo
                          ? 'border-status-info bg-status-info/10 text-status-info'
                          : 'border-dark-border hover:border-status-info/40 hover:bg-dark-surface2/40'
                      }`}
                    >
                      <span className="block font-medium text-dark-text">{exibir(candidato.valor, definicao.tipo)}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-dark-muted">
                        {candidato.rotulo ? `Rotulo: ${candidato.rotulo}` : `Contexto: ${candidato.contexto || 'sem rotulo'}`}
                        {' · '}confianca {candidato.confianca}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-dark-muted">Nenhuma alternativa deste tipo foi encontrada no documento.</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-muted">
              Ou informe o rotulo exato como aparece no PDF
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input flex-1 min-w-[200px]"
                value={ancora}
                onChange={event => setAncora(event.target.value)}
                placeholder="Ex.: Premio liquido"
              />
              <button type="button" className="btn-secondary text-xs" onClick={testarAncora}>Testar</button>
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={!ancora.trim()}
                onClick={() => { onAncoraManual(ancora.trim()); setPreview(null) }}
              >
                Usar este rotulo
              </button>
            </div>
            {preview !== null && (
              <p className="mt-2 text-xs text-dark-muted">
                {preview
                  ? <>Valor lido: <span className="font-semibold text-dark-text">{exibir(preview, definicao.tipo)}</span></>
                  : 'Nenhum valor deste tipo foi encontrado depois desse rotulo.'}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onAusente}
            className="flex items-center gap-2 text-xs font-semibold text-dark-muted transition-colors hover:text-dark-text"
          >
            <Ban className="h-3.5 w-3.5" />
            {estado === 'ausente'
              ? 'Voltar a mapear este campo'
              : 'Esta informacao nao existe no PDF desta seguradora'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function AutoPdfConfigSeguradora({ tipo }) {
  const { seguradoraId } = useParams()
  const toast = useToast()
  const { user } = useAuth()
  const meta = metaDoTipo(tipo)
  const definicoes = useMemo(() => camposDoTipo(tipo), [tipo])
  const grupos = useMemo(() => agruparCampos(definicoes), [definicoes])
  const inputRef = useRef(null)
  const urlLocalRef = useRef(null)

  const [seguradora, setSeguradora] = useState(null)
  const [linha, setLinha] = useState(null)
  const [campos, setCampos] = useState({})
  const [sugestoes, setSugestoes] = useState([])
  const [texto, setTexto] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [lendo, setLendo] = useState(false)
  const [mapeando, setMapeando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [aberto, setAberto] = useState(null)
  const [busca, setBusca] = useState('')
  const [mostrarTexto, setMostrarTexto] = useState(false)

  const resumo = useMemo(() => resumirMapeamento(campos, definicoes), [campos, definicoes])
  const candidatosPorCampo = useMemo(
    () => Object.fromEntries(sugestoes.map(item => [item.key, item.candidatos || []])),
    [sugestoes]
  )

  useEffect(() => () => {
    if (urlLocalRef.current) URL.revokeObjectURL(urlLocalRef.current)
  }, [])

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setCarregando(true)
      try {
        const [catalogo, salvo] = await Promise.all([
          fetchSeguradorasCatalog(),
          fetchMapeamento(seguradoraId, tipo),
        ])
        if (!ativo) return

        setSeguradora(catalogo.find(item => item.id === seguradoraId) || null)
        setLinha(salvo)
        setCampos(salvo?.campos || {})

        // O texto da amostra fica salvo junto: reabrir a tela nao exige subir o
        // PDF de novo para ver as alternativas de cada campo.
        if (salvo?.amostra_texto) {
          setTexto(salvo.amostra_texto)
          setSugestoes(sugerirMapeamento(salvo.amostra_texto, camposDoTipo(tipo)))
        }
        if (salvo?.amostra_path) {
          const url = await urlAmostra(salvo.amostra_path)
          if (ativo) setPdfUrl(url)
        }
      } catch (error) {
        if (ativo) toast({ type: 'error', title: 'Erro ao carregar a configuracao', message: error.message })
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    carregar()
    return () => { ativo = false }
  }, [seguradoraId, tipo])

  const previewAncora = useCallback((rotulo, tipoValor) => {
    if (!rotulo?.trim() || !texto) return ''
    const resultado = aplicarMapeamento(
      texto,
      { campos: { __preview: { rotulo: rotulo.trim(), tipo: tipoValor, ocorrencia: 0 } } },
      [{ key: '__preview', tipo: tipoValor }]
    )
    return resultado.campos.__preview || ''
  }, [texto])

  /**
   * `persistir = false` e o caminho de reprocessar a amostra que ja esta no
   * storage: o arquivo e o mesmo, entao subir de novo so criaria uma copia.
   */
  async function handleArquivo(file, { persistir = true } = {}) {
    if (!file) return
    const ehPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    if (!ehPdf) {
      toast({ type: 'error', title: 'Envie um PDF', message: 'O mapeamento le o texto do documento, entao precisa ser PDF.' })
      return
    }

    if (persistir) setArquivo(file)
    if (urlLocalRef.current) URL.revokeObjectURL(urlLocalRef.current)
    urlLocalRef.current = URL.createObjectURL(file)
    setPdfUrl(urlLocalRef.current)
    setLendo(true)

    try {
      const conteudo = await lerTextoPdf(file)
      setTexto(conteudo)
      setSugestoes([])
      if (!conteudo.trim()) {
        toast({
          type: 'error',
          title: 'PDF sem texto',
          message: 'Este arquivo parece ser digitalizado (imagem). Use o PDF original baixado do portal da seguradora.',
        })
      }
    } catch (error) {
      toast({ type: 'error', title: 'Nao foi possivel ler o PDF', message: error.message })
    } finally {
      setLendo(false)
    }
  }

  function handleMapear() {
    if (!texto.trim()) return
    setMapeando(true)
    try {
      const novasSugestoes = sugerirMapeamento(texto, definicoes)
      // Preserva so o que o usuario ja tinha decidido; o resto e reproposto.
      const decididos = Object.fromEntries(
        Object.entries(campos).filter(([, config]) => config?.confirmado || config?.ausente)
      )
      setSugestoes(novasSugestoes)
      setCampos(mapeamentoInicial(novasSugestoes, decididos))
      const achados = novasSugestoes.filter(item => item.sugestao).length
      toast({
        type: 'success',
        title: 'Mapeamento automatico concluido',
        message: `${achados} de ${novasSugestoes.length} campos localizados. Confirme cada um abaixo.`,
      })
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao mapear', message: error.message })
    } finally {
      setMapeando(false)
    }
  }

  function atualizarCampo(key, atualizacao) {
    setCampos(anterior => ({
      ...anterior,
      [key]: { ...(anterior[key] || {}), ...atualizacao },
    }))
  }

  function confirmarCampo(key) {
    atualizarCampo(key, { confirmado: true, ausente: false })
  }

  function rejeitarCampo(key) {
    atualizarCampo(key, { confirmado: false })
    setAberto(key)
  }

  function escolherCandidato(key, definicao, candidato) {
    atualizarCampo(key, {
      rotulo: candidato.rotulo,
      tipo: definicao.tipo,
      ocorrencia: candidato.ocorrencia ?? 0,
      origem: candidato.origem,
      valor_exemplo: candidato.valor,
      confianca: candidato.confianca,
      confirmado: true,
      ausente: false,
    })
  }

  function usarAncoraManual(key, definicao, rotulo) {
    const valor = previewAncora(rotulo, definicao.tipo)
    atualizarCampo(key, {
      rotulo,
      tipo: definicao.tipo,
      ocorrencia: 0,
      origem: 'manual',
      valor_exemplo: valor,
      confirmado: Boolean(valor),
      ausente: false,
    })
    if (!valor) {
      toast({ type: 'error', title: 'Rotulo sem valor', message: 'Nenhum valor desse tipo aparece depois desse rotulo no PDF.' })
    }
  }

  function alternarAusente(key) {
    setCampos(anterior => {
      const config = anterior[key] || {}
      if (config.ausente) {
        // Volta o campo para a fila: a sugestao original e reaplicada se existir.
        const sugestao = sugestoes.find(item => item.key === key)?.sugestao
        return {
          ...anterior,
          [key]: sugestao
            ? { ...config, ausente: false, confirmado: false, rotulo: sugestao.rotulo, ocorrencia: sugestao.ocorrencia ?? 0, valor_exemplo: sugestao.valor, confianca: sugestao.confianca, origem: sugestao.origem }
            : { ...config, ausente: false, confirmado: false },
        }
      }
      return { ...anterior, [key]: { ...config, ausente: true, confirmado: false, valor_exemplo: '' } }
    })
  }

  function confirmarTodosSugeridos() {
    setCampos(anterior => {
      const proximo = { ...anterior }
      for (const definicao of definicoes) {
        const config = proximo[definicao.key]
        if (config?.valor_exemplo && !config.ausente) proximo[definicao.key] = { ...config, confirmado: true }
      }
      return proximo
    })
  }

  async function salvar(status) {
    if (status === 'concluido' && !resumo.podeConcluir) {
      toast({
        type: 'error',
        title: 'Ainda faltam campos obrigatorios',
        message: `${resumo.obrigatoriosPendentes} campo(s) obrigatorio(s) sem confirmacao.`,
      })
      return
    }

    setSalvando(true)
    try {
      let amostraPath = linha?.amostra_path || null
      let amostraNome = linha?.amostra_nome || null

      if (arquivo) {
        amostraPath = await enviarAmostra({
          file: arquivo,
          seguradoraId,
          tipo,
          pathAnterior: linha?.amostra_path || null,
        })
        amostraNome = arquivo.name
      }

      const salvo = await salvarMapeamento({
        seguradoraId,
        tipo,
        campos,
        status,
        amostraPath,
        amostraNome,
        amostraTexto: texto || linha?.amostra_texto || null,
        userId: user?.id || null,
      })

      setLinha(salvo)
      setArquivo(null)
      toast({
        type: 'success',
        title: status === 'concluido' ? 'Configuracao concluida' : 'Rascunho salvo',
        message: status === 'concluido'
          ? `O sistema ja usa este mapeamento ao ler ${meta.titulo.toLowerCase()} desta seguradora.`
          : 'Voce pode voltar e continuar quando quiser.',
      })
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao salvar', message: error.message })
    } finally {
      setSalvando(false)
    }
  }

  async function reabrirAmostraSalva() {
    if (!linha?.amostra_path) return
    const blob = await baixarAmostra(linha.amostra_path)
    if (!blob) {
      toast({ type: 'error', title: 'Amostra indisponivel', message: 'Nao foi possivel baixar o PDF salvo.' })
      return
    }
    await handleArquivo(
      new File([blob], linha.amostra_nome || 'amostra.pdf', { type: 'application/pdf' }),
      { persistir: false }
    )
  }

  async function apagarConfiguracao() {
    setSalvando(true)
    try {
      await limparMapeamento(seguradoraId, tipo)
      setLinha(null)
      setCampos({})
      setSugestoes([])
      setTexto('')
      setPdfUrl(null)
      setArquivo(null)
      toast({ type: 'success', title: 'Configuracao removida' })
    } catch (error) {
      toast({ type: 'error', title: 'Erro ao remover', message: error.message })
    } finally {
      setSalvando(false)
    }
  }

  const gruposFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return grupos
    return grupos
      .map(grupo => ({ ...grupo, campos: grupo.campos.filter(campo => campo.label.toLowerCase().includes(termo)) }))
      .filter(grupo => grupo.campos.length)
  }, [grupos, busca])

  if (carregando) {
    return <div className="h-64 animate-pulse rounded-3xl border border-dark-border/60 bg-dark-surface2/40" />
  }

  if (!seguradora) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Seguradora nao encontrada"
        description="Ela pode ter sido removida do cadastro."
        actions={<Link to={meta.rota} className="btn-primary">Voltar para a lista</Link>}
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Configuracoes · ${meta.titulo}`}
        title={seguradora.nome_canonico}
        description={`Mapeie onde cada informacao aparece no PDF desta seguradora. O sistema usa este mapeamento para preencher ${tipo === 'cotacao' ? 'a cotacao' : 'a emissao e a apolice'} automaticamente.`}
        actions={(
          <>
            <Link to={meta.rota} className="btn-secondary flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
            <button
              type="button"
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
              onClick={() => salvar('rascunho')}
              disabled={salvando || !Object.keys(campos).length}
            >
              Salvar rascunho
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
              onClick={() => salvar('concluido')}
              disabled={salvando || !resumo.podeConcluir}
            >
              <CheckCircle2 className="h-4 w-4" />
              Marcar como concluida
            </button>
          </>
        )}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dark-border/70 px-4 py-3">
        <SeguradoraBadge
          nome={seguradora.nome_canonico}
          logoUrl={seguradora.logo_url}
          logoPath={seguradora.logo_path}
          size="lg"
          showName={false}
        />
        <span className={`badge ${linha?.status === 'concluido' ? 'badge-success' : linha ? 'badge-warning' : 'badge-danger'}`}>
          {linha?.status === 'concluido' ? 'Configurada' : linha ? 'Em configuracao' : 'Nao configurada'}
        </span>
        <div className="min-w-[180px] flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-dark-surface2">
            <div
              className={`h-full rounded-full transition-all ${resumo.podeConcluir ? 'bg-status-success' : 'bg-status-warning'}`}
              style={{ width: `${resumo.percentual}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-dark-muted">
          {resumo.confirmados} confirmados · {resumo.ausentes} inexistentes · {resumo.pendentes} pendentes
          {resumo.obrigatoriosPendentes > 0 && ` · ${resumo.obrigatoriosPendentes} obrigatorio(s) faltando`}
        </span>
        {linha && (
          <button
            type="button"
            onClick={apagarConfiguracao}
            disabled={salvando}
            className="flex items-center gap-1.5 text-xs font-semibold text-dark-muted transition-colors hover:text-status-danger disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Apagar configuracao
          </button>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Visualizador — o PDF fica aberto na propria tela durante a revisao. */}
        <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={event => handleArquivo(event.target.files?.[0] || null)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => { if (inputRef.current) inputRef.current.value = ''; inputRef.current?.click() }}>
              <UploadCloud className="h-4 w-4" />
              {pdfUrl ? 'Trocar PDF' : 'Subir PDF de exemplo'}
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
              onClick={handleMapear}
              disabled={!texto.trim() || lendo || mapeando}
            >
              {mapeando ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Mapear
            </button>
            {sugestoes.length > 0 && (
              <button type="button" className="btn-secondary text-xs" onClick={confirmarTodosSugeridos}>
                Confirmar todos os sugeridos
              </button>
            )}
            {linha?.amostra_path && !arquivo && (
              <button type="button" className="text-xs font-semibold text-dark-muted hover:text-dark-text" onClick={reabrirAmostraSalva}>
                Reprocessar amostra salva
              </button>
            )}
          </div>

          {lendo && (
            <div className="flex items-center gap-3 rounded-2xl border border-dark-border/70 px-4 py-3 text-sm text-dark-muted">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Lendo o texto do PDF…
            </div>
          )}

          {pdfUrl ? (
            <div className="overflow-hidden rounded-3xl border border-dark-border/70">
              <iframe
                src={pdfUrl}
                title={`PDF de exemplo — ${seguradora.nome_canonico}`}
                className="h-[70vh] w-full bg-white"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-[40vh] w-full flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-dark-border px-6 text-center transition-colors hover:border-status-info/50"
            >
              <UploadCloud className="h-8 w-8 text-status-info" />
              <span className="text-sm font-semibold text-dark-text">Suba o PDF de {tipo === 'cotacao' ? 'uma cotacao' : 'uma apolice'} desta seguradora</span>
              <span className="max-w-sm text-xs text-dark-muted">
                Use o arquivo original baixado do portal. PDFs digitalizados (imagem) nao tem texto para mapear.
              </span>
            </button>
          )}

          {texto && (
            <div className="rounded-2xl border border-dark-border/70">
              <button
                type="button"
                onClick={() => setMostrarTexto(valor => !valor)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-dark-text"
              >
                <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-status-info" />Texto extraido do PDF</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${mostrarTexto ? 'rotate-180' : ''}`} />
              </button>
              {mostrarTexto && (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-dark-border/60 px-4 py-3 text-[11px] leading-relaxed text-dark-muted">
                  {texto}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Revisao campo a campo */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-muted" />
            <input
              className="input pl-9"
              value={busca}
              onChange={event => setBusca(event.target.value)}
              placeholder="Buscar campo"
            />
          </div>

          {!sugestoes.length && !Object.keys(campos).length ? (
            <EmptyState
              icon={<Sparkles className="h-6 w-6" />}
              title="Nenhum mapeamento ainda"
              description="Suba o PDF de exemplo e clique em Mapear. O sistema localiza cada informacao que o formulario pede e voce confirma uma a uma."
            />
          ) : (
            gruposFiltrados.map(grupo => (
              <section key={grupo.grupo} className="space-y-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dark-muted">{grupo.grupo}</h2>
                {grupo.campos.map(definicao => (
                  <CampoLinha
                    key={definicao.key}
                    definicao={definicao}
                    config={campos[definicao.key]}
                    candidatos={candidatosPorCampo[definicao.key] || []}
                    aberto={aberto === definicao.key}
                    onToggle={() => setAberto(atual => (atual === definicao.key ? null : definicao.key))}
                    onConfirmar={() => confirmarCampo(definicao.key)}
                    onRejeitar={() => rejeitarCampo(definicao.key)}
                    onEscolher={candidato => escolherCandidato(definicao.key, definicao, candidato)}
                    onAncoraManual={rotulo => usarAncoraManual(definicao.key, definicao, rotulo)}
                    onAusente={() => alternarAusente(definicao.key)}
                    previewAncora={previewAncora}
                  />
                ))}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
