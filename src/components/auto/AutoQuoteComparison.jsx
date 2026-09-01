import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronDown, CloudOff, FileCheck2,
  Download, FileText, History, LoaderCircle, Maximize2, RefreshCw, ShieldCheck,
  Sparkles, Trash2, UploadCloud, X,
} from 'lucide-react'

import { extrairDiasCarroReserva, montarCategorias, TEM_VALOR_MONETARIO } from '../../lib/orcamentoComparativo'
import { aplicarRevisao, camposDaCotacao } from '../../lib/orcamentoLeitura'
import { derivarOpcoesFinanceirasComparativo } from '../../lib/autoQuoteFinancial'
import {
  gravarRascunhoLocal, lerRascunhoLocal, limparRascunhoLocal,
  rascunhoMaisRecente, rascunhoTemTrabalho, restaurarRascunho, serializarRascunho,
} from '../../lib/autoQuoteDraft'
import { limparRascunhoOrcamento, salvarRascunhoOrcamento } from '../../lib/auto'
import { getEntityImageUrl } from '../../lib/entityMedia'
import { supabase } from '../../lib/supabase'
import { DatePicker } from '../ui'
import SeguradoraBadge from '../SeguradoraBadge'
import AutoOrcamentoOfertas from './AutoOrcamentoOfertas'

const ROLES = [
  { key: 'atual', label: 'Seguradora atual', helper: 'Referência atual ou primeira opção' },
  { key: 'concorrente', label: 'Outra seguradora', helper: 'Opção concorrente para comparação' },
]

// As quatro marcas da familia Porto sao opcoes SEPARADAS. Elas compartilham o
// layout do PDF, mas nao a identidade: o orcamento entregue ao cliente leva o
// nome e a logo da seguradora escolhida aqui. Com a opcao agrupada
// ("Porto / Azul / Itaú / Mitsui"), a marca do documento final dependia de
// adivinhacao por texto — e um orcamento da Porto e um da Azul saiam os dois
// como Azul Seguros.
const SEGURADORAS_ORCAMENTO = [
  { id: 'allianz', label: 'Allianz' },
  { id: 'porto', label: 'Porto Seguro' },
  { id: 'azul', label: 'Azul Seguros' },
  { id: 'itau', label: 'Itaú Seguros' },
  { id: 'mitsui', label: 'Mitsui Sumitomo' },
  { id: 'bradesco', label: 'Bradesco' },
  { id: 'hdi', label: 'HDI' },
  { id: 'darwin', label: 'Darwin' },
  { id: 'pier', label: 'Pier' },
  { id: 'suhai', label: 'Suhai' },
  { id: 'yelum', label: 'Yelum' },
  { id: 'tokio', label: 'Tokio Marine' },
]

function parserInicial(nome = '') {
  const n = String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (n.includes('allianz')) return 'allianz'
  // Antes da separacao das marcas, qualquer uma das quatro caia em
  // 'porto_familia'. Agora cada nome aponta para a sua propria opcao.
  if (n.includes('azul')) return 'azul'
  if (n.includes('itau')) return 'itau'
  if (n.includes('mitsui')) return 'mitsui'
  if (n.includes('porto')) return 'porto'
  if (n.includes('bradesco')) return 'bradesco'
  if (n.includes('hdi')) return 'hdi'
  if (n.includes('darwin')) return 'darwin'
  if (n.includes('pier')) return 'pier'
  if (n.includes('suhai')) return 'suhai'
  if (n.includes('yelum')) return 'yelum'
  if (n.includes('tokio')) return 'tokio'
  return ''
}

// Espelhado por `camposDaCotacao` em `orcamentoLeitura.js`, com teste travando
// o par: renomear uma chave so aqui sumiria com o dado sem quebrar nada visivel.
//
// Premio liquido e IOF NAO estao nesta lista de proposito. Sao numeros de
// controle interno, conferidos na emissao; nao saem no orcamento do cliente, e
// pedir revisao humana deles gastava a atencao que deve ir para franquia e
// cobertura.
const REVIEW_FIELDS = [
  { key: 'segurado_nome', label: 'Segurado', required: true },
  { key: 'segurado_cpf', label: 'CPF/CNPJ do segurado' },
  { key: 'condutor_nome', label: 'Condutor principal' },
  { key: 'condutor_cpf', label: 'CPF do condutor' },
  { key: 'condutor_estado_civil', label: 'Estado civil do condutor' },
  { key: 'veiculo_modelo', label: 'Veículo', required: true },
  { key: 'veiculo_ano', label: 'Ano/modelo' },
  { key: 'veiculo_placa', label: 'Placa' },
  { key: 'veiculo_uso', label: 'Uso do veículo' },
  { key: 'veiculo_cep_pernoite', label: 'CEP de pernoite' },
  { key: 'numero', label: 'Número da cotação' },
  { key: 'validade', label: 'Validade', type: 'date' },
  { key: 'vigencia_inicio', label: 'Início da vigência', type: 'date' },
  { key: 'vigencia_fim', label: 'Fim da vigência', type: 'date' },
  { key: 'premio_total', label: 'Prêmio total', type: 'money', required: true },
  { key: 'premio_parcelado', label: 'Parcelamento', required: true },
  { key: 'franquia', label: 'Franquia', type: 'money', critical: true },
  { key: 'franquia_tipo', label: 'Tipo de franquia', critical: true },
  { key: 'indenizacao_integral', label: 'Indenização integral', critical: true },
  { key: 'assistencia', label: 'Assistência 24h', critical: true },
  { key: 'limite_reboque_km', label: 'Limite KM do reboque', type: 'number', critical: true },
  { key: 'carro_reserva', label: 'Carro reserva', critical: true },
  { key: 'vidros', label: 'Vidros', critical: true },
  { key: 'danos_terceiros', label: 'Danos a terceiros (valor)', critical: true },
  { key: 'nao_inclusos', label: 'Não incluso nesta cotação', multiline: true },
]

function campoPendente(field, value) {
  const texto = String(value ?? '').trim()
  if (!texto) return true
  if (field.key === 'danos_terceiros') {
    return !/^n[ãa]o\b/i.test(texto) && !TEM_VALOR_MONETARIO.test(texto)
  }
  if (field.key === 'carro_reserva') {
    return !/^n[ãa]o\b/i.test(texto) && !extrairDiasCarroReserva(texto)
  }
  return false
}

/**
 * Resolve quando toda imagem da janela terminou de carregar (ou falhou).
 *
 * `onerror` conta como resolvida de proposito: logo quebrada nao pode travar a
 * geracao do orcamento — o template ja cai para o nome da seguradora.
 */
function imagensCarregadas(janela, limiteMs = 5000) {
  const imagens = Array.from(janela.document.images || [])
  const pendentes = imagens.filter(img => !img.complete)
  if (!pendentes.length) return Promise.resolve()
  return Promise.race([
    Promise.all(pendentes.map(img => new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true })
      img.addEventListener('error', resolve, { once: true })
    }))),
    new Promise(resolve => janela.setTimeout(resolve, limiteMs)),
  ])
}

function proximoFrame(janela) {
  return new Promise(resolve => janela.requestAnimationFrame(() => janela.requestAnimationFrame(resolve)))
}

/** Prepara o mesmo documento do preview para caber inteiro em uma folha A4. */
async function prepararImpressaoUmaPagina(janela) {
  const pagina = janela.document.querySelector('.pagina')
  const conteudo = janela.document.querySelector('.pagina-conteudo')
  if (!pagina || !conteudo) return () => {}

  pagina.classList.remove('is-pdf-compact')
  pagina.style.removeProperty('--pdf-scale')
  pagina.style.removeProperty('--pdf-layout-width')
  pagina.style.removeProperty('--pdf-layout-height')
  conteudo.style.removeProperty('width')
  delete pagina.dataset.pdfScale
  await proximoFrame(janela)

  // No preview a pagina pode crescer com o conteudo. A altura-alvo precisa vir
  // da proporcao fisica do A4, nao do clientHeight ja expandido.
  const alturaPagina = pagina.clientWidth * (297 / 210)
  if (conteudo.scrollHeight > alturaPagina) {
    pagina.classList.add('is-pdf-compact')
    await proximoFrame(janela)
  }

  const { calcularEscalaImpressao } = await import('../../lib/orcamentoComparativoHtml')
  const alturaUtil = alturaPagina - 6

  // O texto passa a quebrar menos quando a largura logica aumenta para
  // compensar o zoom. Uma divisao simples superestimava a reducao e deixava um
  // vazio grande no rodape. A busca abaixo encontra a MAIOR escala que ainda
  // cabe, mantendo fontes e logos tão grandes quanto o A4 permite.
  let menor = calcularEscalaImpressao(conteudo.scrollHeight, alturaPagina)
  let maior = 1
  const alturaFisica = async escala => {
    conteudo.style.width = `${(100 / escala).toFixed(5)}%`
    await proximoFrame(janela)
    return conteudo.scrollHeight * escala
  }

  while (menor > 0.02 && await alturaFisica(menor) > alturaUtil) menor *= 0.8
  for (let tentativa = 0; tentativa < 8; tentativa += 1) {
    const meio = (menor + maior) / 2
    if (await alturaFisica(meio) <= alturaUtil) menor = meio
    else maior = meio
  }

  // 0,5% de respiro evita que arredondamentos do diálogo de impressão cortem
  // a última linha em navegadores/níveis de zoom diferentes.
  const escala = Math.min(1, menor * 0.995)
  pagina.style.setProperty('--pdf-scale', escala.toFixed(5))
  pagina.style.setProperty('--pdf-layout-width', `${(100 / escala).toFixed(5)}%`)
  pagina.style.setProperty('--pdf-layout-height', `${(297 / escala).toFixed(5)}mm`)
  conteudo.style.width = `${(100 / escala).toFixed(5)}%`
  pagina.dataset.pdfScale = escala.toFixed(5)
  await proximoFrame(janela)

  return () => {
    pagina.classList.remove('is-pdf-compact')
    pagina.style.removeProperty('--pdf-scale')
    pagina.style.removeProperty('--pdf-layout-width')
    pagina.style.removeProperty('--pdf-layout-height')
    conteudo.style.removeProperty('width')
    delete pagina.dataset.pdfScale
  }
}

function formatSize(bytes) {
  if (!bytes) return ''
  return bytes > 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
    : `${Math.ceil(bytes / 1024)} KB`
}

/**
 * Estado inicial de um lado, semeado com o que a COTACAO do sistema ja sabe.
 *
 * Nem todo PDF traz tudo: o calculo da HDI nao imprime placa em lugar nenhum, e
 * a Pier nao imprime vigencia. Esses dados existem no cadastro da cotacao, que e
 * o que o corretor ja preencheu — busca-los ali e o oposto de inventar, e evita
 * exigir digitacao de algo que o sistema tem.
 */
function sideFromQuote(role, quote) {
  const option = role === 'atual' ? quote?.seguradora_preferencial : quote?.seguradora_mais_barata
  return {
    seguradora: option?.nome || '',
    arquivo_nome: '',
    campos: {
      segurado_nome: quote?.nome_cliente || '',
      segurado_cpf: quote?.cpf_cliente || '',
      condutor_nome: quote?.condutor_nome || '',
      condutor_cpf: quote?.condutor_cpf || '',
      condutor_estado_civil: quote?.estado_civil_condutor || '',
      veiculo_modelo: quote?.modelo_veiculo || '',
      veiculo_ano: '',
      veiculo_placa: quote?.placa || '',
      veiculo_uso: quote?.uso_veiculo || '',
      veiculo_cep_pernoite: quote?.cep_pernoite || '',
      numero: '', validade: '',
      vigencia_inicio: quote?.vigencia_inicio || '', vigencia_fim: quote?.vigencia_fim || '',
      premio_total: option?.premio_total ?? '',
      premio_parcelado: option?.parcelamentos || '', franquia: '', franquia_tipo: '', indenizacao_integral: '',
      assistencia: '', limite_reboque_km: '', carro_reserva: '', vidros: '', danos_terceiros: '', nao_inclusos: '',
    },
  }
}

function UploadSlot({ role, side, file, leitura, lendo, erro, aplicando, seguradoraParser, onParser, onFile, onEscolherOferta }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const meta = ROLES.find(item => item.key === role)
  const uploadBloqueado = !seguradoraParser
  return (
    <article className={`auto-comparison-upload is-${role} ${dragging ? 'is-dragging' : ''} ${file ? 'is-ready' : ''}`}>
      <header><span className="auto-comparison-role">{meta.label}</span><small>{meta.helper}</small></header>
      <div className="auto-comparison-insurer">
        <label htmlFor={`seguradora-orcamento-${role}`}>Seguradora do PDF</label>
        <div className="auto-comparison-insurer-preview">
          <span>
            {side.seguradora
              ? <SeguradoraBadge nome={side.seguradora} size="md" />
              : <><ShieldCheck /><strong>Selecione antes do upload</strong></>}
          </span>
          <select
            id={`seguradora-orcamento-${role}`}
            value={seguradoraParser}
            onChange={event => onParser(event.target.value)}
            aria-label={`Selecionar seguradora do PDF ${meta.label}`}
          >
            <option value="">Escolher seguradora…</option>
            {SEGURADORAS_ORCAMENTO.map(seguradora => <option key={seguradora.id} value={seguradora.id}>{seguradora.label}</option>)}
            {/* Rascunho gravado antes da separacao das marcas guardou o id
                antigo 'porto_familia'. Sem esta opcao o select abriria vazio e
                pareceria que a seguradora se perdeu. */}
            {seguradoraParser && !SEGURADORAS_ORCAMENTO.some(item => item.id === seguradoraParser) && (
              <option value={seguradoraParser}>Porto / Azul / Itaú / Mitsui (escolha a marca)</option>
            )}
          </select>
          <ChevronDown />
        </div>
      </div>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={event => onFile(event.target.files?.[0] || null)} />
      <button
        type="button"
        className="auto-comparison-dropzone"
        disabled={uploadBloqueado}
        onClick={() => inputRef.current?.click()}
        onDragEnter={event => { event.preventDefault(); setDragging(true) }}
        onDragOver={event => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); if (!uploadBloqueado) onFile(event.dataTransfer.files?.[0] || null) }}
      >
        {file
          ? <><FileCheck2 /><span><strong>{file.name}</strong><small>{file.restaurado ? 'restaurado do rascunho' : formatSize(file.size)} · {legendaArquivo(leitura, lendo, file.restaurado)}</small></span></>
          : <><UploadCloud /><span><strong>{uploadBloqueado ? 'Escolha a seguradora primeiro' : 'Solte ou selecione o PDF'}</strong><small>Leitura automática forçada pela seguradora selecionada, com escolha de produto quando necessário</small></span></>}
      </button>

      {lendo && <p className="auto-comparison-lendo"><LoaderCircle />Lendo o PDF…</p>}
      {erro && <p className="auto-comparison-error"><AlertTriangle />{erro}</p>}
      {!lendo && leitura && !leitura.suportado && <p className="auto-comparison-warnings"><span><AlertTriangle />{leitura.motivo}</span></p>}
      {!lendo && leitura?.cotacao?.avisos_extracao?.length > 0 && <ExtractionWarnings avisos={leitura.cotacao.avisos_extracao} />}

      {/* PDFs com varias ofertas/produtos param aqui ate alguem escolher. */}
      {!lendo && leitura?.cotacao?.escolha_pendente && (
        <AutoOrcamentoOfertas
          escolha={leitura.cotacao.escolha_pendente}
          escolhida={null}
          onEscolher={onEscolherOferta}
          disabled={aplicando}
        />
      )}
      {!lendo && leitura?.cotacao?.oferta && (
        <AutoOrcamentoOfertas
          escolha={{ label: 'Oferta escolhida para este cliente', opcoes: leitura.cotacao.ofertas || [] }}
          escolhida={leitura.cotacao.oferta.indice}
          onEscolher={onEscolherOferta}
          disabled={aplicando}
        />
      )}
      {!lendo && leitura?.cotacao?.produto_selecionado && (
        <AutoOrcamentoOfertas
          escolha={{ campo: 'produto', label: 'Produto escolhido para este cliente', opcoes: leitura.ofertas || [] }}
          escolhida={leitura.cotacao.produto_selecionado.id}
          onEscolher={onEscolherOferta}
          disabled={aplicando}
        />
      )}
    </article>
  )
}

function ExtractionWarnings({ avisos = [] }) {
  const visiveis = avisos.filter(aviso => aviso?.mensagem)
  if (!visiveis.length) return null
  return (
    <div className="auto-comparison-extraction-warnings">
      {visiveis.map((aviso, index) => (
        <span key={`${aviso.code || 'aviso'}-${index}`} className={aviso.bloqueia ? 'is-blocking' : ''}>
          <AlertTriangle />
          {aviso.mensagem}
        </span>
      ))}
    </div>
  )
}

function legendaArquivo(leitura, lendo, restaurado = false) {
  if (lendo) return 'lendo…'
  if (!leitura) return restaurado ? 'rascunho sem leitura — reenvie o PDF' : 'aguardando leitura'
  if (!leitura.suportado) return 'leitura automática indisponível'
  if (leitura.cotacao?.oferta) return `${leitura.seguradora} · oferta ${leitura.cotacao.oferta.nome}`
  if (leitura.cotacao?.produto_selecionado) return `${leitura.seguradora} · ${leitura.cotacao.produto_selecionado.label}`
  if (leitura.cotacao?.escolha_pendente) return `${leitura.seguradora} · escolha a opção abaixo`
  return `${leitura.seguradora} · leitura concluída`
}

function leituraDisponivelParaRevisao(leitura) {
  return leitura?.suportado && leitura?.cotacao
}

function camposFinanceirosAplicados(campos = {}) {
  return campos.premio_total !== '' && campos.premio_total != null
    && String(campos.premio_parcelado || '').trim()
    && campos.franquia !== '' && campos.franquia != null
}

function ReviewField({ field, value, issue, onChange }) {
  const props = { value: value ?? '', onChange: event => onChange(event.target.value), placeholder: issue ? 'Revisar / preencher' : 'Não informado' }
  return (
    <label className={`auto-comparison-review-field ${issue ? 'has-issue' : ''} ${field.critical ? 'is-critical' : ''}`}>
      <span>{field.label}{field.critical && <i>crítico</i>}</span>
      {field.multiline
        ? <textarea {...props} rows="3" />
        : field.type === 'date'
          ? <DatePicker value={value ?? ''} onChange={onChange} placeholder={issue ? 'Revisar data' : 'Selecionar data'} className="auto-comparison-date-picker" />
          : <input {...props} type="text" inputMode={field.type === 'money' || field.type === 'number' ? 'decimal' : undefined} />}
      {issue && <small><AlertTriangle />Campo previsto para conferência obrigatória</small>}
    </label>
  )
}

function ReviewColumn({ role, side, issues, leitura, aplicando, onEscolherOferta, onPatch }) {
  const escolha = leitura?.cotacao?.escolha_pendente
  return (
    <article className={`auto-comparison-review-column is-${role}`}>
      <header>
        <span>{role === 'atual' ? 'Atual' : 'Concorrente'}</span>
        <div className="auto-comparison-review-insurer">
          {side.seguradora && <SeguradoraBadge nome={side.seguradora} size="md" showName={false} />}
          <span><strong>{side.seguradora || 'Seguradora não definida'}</strong><small>{side.arquivo_nome || 'Preenchimento manual'}</small></span>
        </div>
        {issues.length === 0 ? <CheckCircle2 className="is-valid" /> : <span className="auto-comparison-issue-count">{issues.length}</span>}
      </header>
      {escolha && (
        <div className="auto-comparison-review-choice">
          <div className="auto-comparison-review-choice-warning">
            <AlertTriangle />
            <span>
              <strong>Escolha o produto antes de revisar os valores</strong>
              <small>Prêmio, parcelamento, franquia e coberturas mudam conforme o produto. Depois da escolha, a revisão é preenchida automaticamente.</small>
            </span>
          </div>
          <AutoOrcamentoOfertas
            escolha={escolha}
            escolhida={null}
            onEscolher={onEscolherOferta}
            disabled={aplicando}
          />
        </div>
      )}
      {!escolha && <>
        {leitura?.cotacao?.avisos_extracao?.length > 0 && <ExtractionWarnings avisos={leitura.cotacao.avisos_extracao} />}
        <div className="auto-comparison-review-fields">{REVIEW_FIELDS.map(field => <ReviewField key={field.key} field={field} value={side.campos[field.key]} issue={issues.includes(field.key)} onChange={value => onPatch(field.key, value)} />)}</div>
      </>}
    </article>
  )
}

function OrcamentoPreview({ html, fullscreen = false, salvando = false, salvo = null, onFullscreen, onCloseFullscreen, onDownload, onSave }) {
  const iframeRef = useRef(null)
  if (!html) return null

  const frame = (
    <section className={`auto-comparison-preview ${fullscreen ? 'is-fullscreen' : ''}`}>
      <header>
        <div>
          <span>Prévia da cotação</span>
          <strong>Orçamento completo dentro do sistema</strong>
          <small>Confira o visual final; para salvar, use “Baixar PDF”.</small>
        </div>
        <div className="auto-comparison-preview-actions">
          <button type="button" onClick={onSave} disabled={salvando}>
            {salvando ? <LoaderCircle className="is-spinning" /> : <FileCheck2 />}
            {salvo?.referencia ? `Salvo ${salvo.referencia}` : 'Salvar'}
          </button>
          {fullscreen
            ? <button type="button" onClick={onCloseFullscreen}><X />Fechar tela cheia</button>
            : <button type="button" onClick={onFullscreen}><Maximize2 />Tela cheia</button>}
          <button type="button" className="is-primary" onClick={() => onDownload(iframeRef)}><Download />Baixar PDF</button>
        </div>
      </header>
      <div className="auto-comparison-preview-stage">
        <iframe
          ref={iframeRef}
          title="Prévia do orçamento comparativo"
          srcDoc={html}
          sandbox="allow-same-origin allow-modals"
        />
      </div>
    </section>
  )

  if (!fullscreen) return frame

  return (
    <div className="auto-comparison-preview-shell" role="dialog" aria-modal="true" aria-label="Cotação em tela cheia">
      {frame}
    </div>
  )
}

/** Estado do zero, semeado apenas pelo cadastro da cotacao. */
function workspaceInicial(quote) {
  const sides = { atual: sideFromQuote('atual', quote), concorrente: sideFromQuote('concorrente', quote) }
  return {
    step: 'upload',
    sides,
    parsers: { atual: parserInicial(sides.atual.seguradora), concorrente: parserInicial(sides.concorrente.seguradora) },
    leituras: { atual: null, concorrente: null },
    orcamento: null,
    salvo_em: null,
    restaurado: false,
  }
}

/**
 * Abre o workspace ja com o trabalho anterior dentro.
 *
 * Duas fontes: o rascunho local (grava a cada alteracao, so neste navegador) e
 * `cotacoes_auto.orcamento_rascunho` (grava com debounce, vale em qualquer
 * maquina). Vence o mais recente — quem trabalhou por ultimo mandou.
 */
function hidratarWorkspace(quote) {
  const padrao = workspaceInicial(quote)
  const bruto = rascunhoMaisRecente(lerRascunhoLocal(quote?.id), quote?.orcamento_rascunho)
  if (!bruto || !rascunhoTemTrabalho(bruto)) return padrao
  const restaurado = restaurarRascunho(bruto, { baseSides: padrao.sides })
  return restaurado ? { ...restaurado, restaurado: true } : padrao
}

function horaCurta(iso) {
  if (!iso) return ''
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''
  const hoje = new Date().toDateString() === data.toDateString()
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return hoje ? hora : `${data.toLocaleDateString('pt-BR')} ${hora}`
}

function RascunhoStatus({ estado, onDescartar }) {
  if (estado.salvando) {
    return <span className="auto-comparison-draft is-saving"><LoaderCircle className="is-spinning" />Salvando trabalho…</span>
  }
  if (!estado.salvo_em) {
    return <span className="auto-comparison-draft is-idle"><History />O trabalho é salvo sozinho</span>
  }
  // Tres estados diferentes, porque a diferenca entre eles muda o que a pessoa
  // pode fazer: com o servidor ela troca de maquina; so com o local ela precisa
  // terminar aqui; sem nenhum dos dois ela nao pode fechar a aba.
  if (!estado.servidor && !estado.local) {
    return <span className="auto-comparison-draft is-failed"><AlertTriangle />Não foi possível salvar — não feche a aba</span>
  }
  return (
    <span className={`auto-comparison-draft ${estado.servidor ? 'is-saved' : 'is-local'}`}>
      {estado.servidor ? <CheckCircle2 /> : <CloudOff />}
      {estado.servidor ? `Salvo ${horaCurta(estado.salvo_em)}` : `Salvo neste navegador ${horaCurta(estado.salvo_em)}`}
      <button type="button" onClick={onDescartar} title="Descartar o rascunho e recomeçar"><Trash2 />Descartar</button>
    </span>
  )
}

export default function AutoQuoteComparison({ quote, onFinancialOptionsChange }) {
  const [inicial] = useState(() => hidratarWorkspace(quote))
  const [step, setStep] = useState(inicial.step)
  const [files, setFiles] = useState({ atual: null, concorrente: null })
  const [leituras, setLeituras] = useState(inicial.leituras)
  const [lendo, setLendo] = useState({ atual: false, concorrente: false })
  const [aplicando, setAplicando] = useState({ atual: false, concorrente: false })
  const [erros, setErros] = useState({ atual: '', concorrente: '' })
  const [sides, setSides] = useState(inicial.sides)
  const [parsers, setParsers] = useState(inicial.parsers)
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState(inicial.restaurado)
  const [estadoRascunho, setEstadoRascunho] = useState({
    salvando: false, salvo_em: inicial.salvo_em, servidor: false, local: false,
  })
  const [gerando, setGerando] = useState(false)
  const [erroGeracao, setErroGeracao] = useState('')
  const [seguradorasSemLogo, setSeguradorasSemLogo] = useState([])
  const [comparativoGerado, setComparativoGerado] = useState(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewFullscreen, setPreviewFullscreen] = useState(false)
  const [salvandoOrcamento, setSalvandoOrcamento] = useState(false)
  const [orcamentoSalvo, setOrcamentoSalvo] = useState(inicial.orcamento)
  const opcoesFinanceiras = useMemo(() => derivarOpcoesFinanceirasComparativo({
    atual: sides.atual,
    concorrente: sides.concorrente,
  }), [
    sides.atual.seguradora,
    sides.atual.campos.premio_total,
    sides.concorrente.seguradora,
    sides.concorrente.campos.premio_total,
  ])

  useEffect(() => {
    onFinancialOptionsChange?.(opcoesFinanceiras)
  }, [onFinancialOptionsChange, opcoesFinanceiras])

  // ─── Salvamento automatico do trabalho ────────────────────────────────
  // A queixa era direta: "ao sair fica tudo perdido". Cada alteracao vira um
  // rascunho; o local grava sempre, o servidor grava quando a migration 72 ja
  // rodou. Nada aqui exige clicar em salvar.
  const rascunhoAtual = useMemo(
    () => serializarRascunho({ step, sides, parsers, leituras, orcamento: orcamentoSalvo }),
    [step, sides, parsers, leituras, orcamentoSalvo],
  )
  const conteudoRascunho = useMemo(
    () => JSON.stringify({ step: rascunhoAtual.step, orcamento: rascunhoAtual.orcamento, lados: rascunhoAtual.lados }),
    [rascunhoAtual],
  )
  const ultimoGravado = useRef(null)
  // Reabrir a cotacao nao pode regravar sozinho um rascunho identico ao que
  // acabou de ser restaurado: sem esta semente, toda visita gerava um write.
  const semeouRestaurado = useRef(false)
  // O que ainda nao chegou ao disco. Fechar a aba ou trocar de rota no meio do
  // debounce perderia exatamente a ultima alteracao — a mais recente e a que
  // mais dói. Este ref existe para o flush de saida encontra-la.
  const rascunhoPendente = useRef(null)

  useEffect(() => {
    if (!semeouRestaurado.current) {
      semeouRestaurado.current = true
      if (inicial.restaurado) {
        ultimoGravado.current = conteudoRascunho
        return undefined
      }
    }
    if (!rascunhoTemTrabalho(rascunhoAtual)) {
      ultimoGravado.current = conteudoRascunho
      return undefined
    }
    if (ultimoGravado.current === conteudoRascunho) return undefined

    rascunhoPendente.current = rascunhoAtual
    setEstadoRascunho(atual => ({ ...atual, salvando: true }))

    const timer = window.setTimeout(async () => {
      ultimoGravado.current = conteudoRascunho
      rascunhoPendente.current = null
      const local = gravarRascunhoLocal(quote?.id, rascunhoAtual)
      let servidor = false
      try {
        servidor = (await salvarRascunhoOrcamento(quote?.id, rascunhoAtual)).persistido
      } catch {
        // Falha de rede ou RLS nao pode travar a digitacao: o rascunho local ja
        // guardou o trabalho e a proxima alteracao tenta o servidor de novo.
        servidor = false
      }
      setEstadoRascunho({ salvando: false, salvo_em: rascunhoAtual.salvo_em, servidor, local })
    }, 700)

    return () => window.clearTimeout(timer)
  }, [conteudoRascunho, rascunhoAtual, quote?.id, inicial.restaurado])

  // Saida da tela (navegacao ou fechar aba): grava o que estava no debounce.
  // O local e sincrono e sempre da tempo; o servidor e best-effort.
  useEffect(() => {
    const flush = () => {
      const pendente = rascunhoPendente.current
      if (!pendente) return
      rascunhoPendente.current = null
      gravarRascunhoLocal(quote?.id, pendente)
      salvarRascunhoOrcamento(quote?.id, pendente).catch(() => {})
    }
    window.addEventListener('beforeunload', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      flush()
    }
  }, [quote?.id])

  function descartarRascunho() {
    ultimoGravado.current = null
    rascunhoPendente.current = null
    limparRascunhoLocal(quote?.id)
    limparRascunhoOrcamento(quote?.id).catch(() => {})
    const limpo = workspaceInicial(quote)
    setStep(limpo.step)
    setSides(limpo.sides)
    setParsers(limpo.parsers)
    setLeituras(limpo.leituras)
    setFiles({ atual: null, concorrente: null })
    setErros({ atual: '', concorrente: '' })
    setOrcamentoSalvo(null)
    setRascunhoRestaurado(false)
    setEstadoRascunho({ salvando: false, salvo_em: null, servidor: false, local: false })
    invalidarPreview()
  }

  // Um lado esta "com arquivo" tanto com o File na mao quanto restaurado de um
  // rascunho: a leitura ja extraida vale igual, e exigir reenviar o PDF so para
  // reabrir a revisao seria refazer o trabalho que acabamos de salvar.
  const arquivos = useMemo(() => Object.fromEntries(ROLES.map(({ key }) => [
    key,
    files[key] || (sides[key].arquivo_nome
      ? { name: sides[key].arquivo_nome, size: 0, restaurado: true }
      : null),
  ])), [files, sides])

  const issues = useMemo(() => Object.fromEntries(ROLES.map(({ key }) => [
    key,
    REVIEW_FIELDS
      .filter(field => (field.required || field.critical) && campoPendente(field, sides[key].campos[field.key]))
      .map(field => field.key),
  ])), [sides])
  const issueCount = issues.atual.length + issues.concorrente.length
  const criticalCount = ROLES.reduce((total, { key }) => total + issues[key].filter(fieldKey => REVIEW_FIELDS.find(field => field.key === fieldKey)?.critical).length, 0)
  const faltamArquivos = ROLES.filter(({ key }) => !arquivos[key]).map(({ label }) => label)
  const escolhasPendentes = ROLES.filter(({ key }) => leituras[key]?.cotacao?.escolha_pendente).map(({ label }) => label)
  const leiturasPendentes = ROLES.filter(({ key }) => arquivos[key] && !lendo[key] && !leituraDisponivelParaRevisao(leituras[key])).map(({ label }) => label)
  const podeRevisar = faltamArquivos.length === 0 && escolhasPendentes.length === 0 && leiturasPendentes.length === 0 && !lendo.atual && !lendo.concorrente
  const resumoUpload = (() => {
    if (lendo.atual || lendo.concorrente) return 'Aguarde a leitura automática terminar.'
    if (faltamArquivos.length) return `Envie o PDF de: ${faltamArquivos.join(' e ')}.`
    if (escolhasPendentes.length) return `Escolha produto/oferta para coletar prêmio, parcelamento, franquia e coberturas de: ${escolhasPendentes.join(' e ')}.`
    if (leiturasPendentes.length) return `Revise o aviso de leitura de: ${leiturasPendentes.join(' e ')}.`
    return 'As duas leituras estão prontas para conferência.'
  })()
  const podeAbrirRevisao = faltamArquivos.length === 0 && escolhasPendentes.length === 0 && leiturasPendentes.length === 0 && !lendo.atual && !lendo.concorrente
  const tituloRodapeUpload = escolhasPendentes.length
    ? 'Escolha o produto antes da revisão'
    : podeRevisar
      ? 'Visual pronto para a conferência'
      : 'Revisão aguardando leitura'

  async function chooseFile(role, file) {
    invalidarPreview()
    if (file && !parsers[role]) {
      setErros(current => ({ ...current, [role]: 'Selecione a seguradora do PDF antes de enviar o arquivo.' }))
      return
    }
    setFiles(current => ({ ...current, [role]: file }))
    setSides(current => ({ ...current, [role]: { ...current[role], arquivo_nome: file?.name || '' } }))
    setErros(current => ({ ...current, [role]: '' }))
    setLeituras(current => ({ ...current, [role]: null }))
    if (!file) return

    setLendo(current => ({ ...current, [role]: true }))
    try {
      // Import dinamico: o pdfjs so entra no bundle de quem realmente envia PDF,
      // mesmo caminho ja usado por `autoPdfParser.js` e `ApoicesGestao.jsx`.
      const { lerOrcamento } = await import('../../lib/orcamentoLeitura')
      const leitura = await lerOrcamento(file, { parser_id: parsers[role] })
      setLeituras(current => ({ ...current, [role]: leitura }))
      // Preenche SEMPRE, inclusive com escolha pendente: segurado, condutor,
      // veiculo, numero e vigencia nao dependem do produto e ja foram lidos.
      // Antes a revisao ficava inteira em branco ate a escolha e parecia leitura
      // falhada — `camposDaCotacao` ja devolve vazio no que depende do produto.
      if (leitura?.cotacao) aplicarCotacao(role, leitura)
    } catch (erro) {
      setErros(current => ({ ...current, [role]: `Não foi possível ler o PDF: ${erro.message}` }))
    } finally {
      setLendo(current => ({ ...current, [role]: false }))
    }
  }

  function escolherParser(role, parserId) {
    const selecionada = SEGURADORAS_ORCAMENTO.find(item => item.id === parserId)
    invalidarPreview()
    setParsers(current => ({ ...current, [role]: parserId }))
    setFiles(current => ({ ...current, [role]: null }))
    setLeituras(current => ({ ...current, [role]: null }))
    setErros(current => ({ ...current, [role]: '' }))
    setSides(current => ({
      ...current,
      [role]: {
        ...current[role],
        seguradora: selecionada?.label || '',
        arquivo_nome: '',
      },
    }))
  }

  /** Reprocessa a cotacao com a oferta/produto escolhido e leva o resultado a revisao. */
  async function escolherOferta(role, indice) {
    const leitura = leituras[role]
    if (!leitura) return
    invalidarPreview()
    setAplicando(current => ({ ...current, [role]: true }))
    setErros(current => ({ ...current, [role]: '' }))
    try {
      const { aplicarEscolha } = await import('../../lib/orcamentoLeitura')
      // O seletor continua visivel depois da escolha: trocar de opcao e uma
      // acao normal, nao um refazer do zero.
      const atualizada = await aplicarEscolha(leitura, indice)
      const comOpcoes = { ...atualizada, ofertas: leitura.ofertas || leitura.cotacao?.ofertas || leitura.cotacao?.escolha_pendente?.opcoes || [] }
      const campos = camposDaCotacao(comOpcoes.cotacao, { montarCategorias })
      if (comOpcoes.cotacao?.escolha_pendente) {
        setLeituras(current => ({ ...current, [role]: comOpcoes }))
        aplicarCamposCotacao(role, comOpcoes, campos)
        return
      }
      if (!camposFinanceirosAplicados(campos)) {
        const nomeProduto = comOpcoes.cotacao?.produto_selecionado?.label || comOpcoes.cotacao?.oferta?.nome || indice
        setErros(current => ({
          ...current,
          [role]: `A opção "${nomeProduto}" foi selecionada, mas a leitura não devolveu prêmio, parcelamento e franquia completos. Reenvie o PDF ou me mande esse arquivo para mapear o layout.`,
        }))
      }
      setLeituras(current => ({ ...current, [role]: comOpcoes }))
      aplicarCamposCotacao(role, comOpcoes, campos)
    } catch (erro) {
      setErros(current => ({ ...current, [role]: `Não foi possível aplicar a opção: ${erro.message}` }))
    } finally {
      setAplicando(current => ({ ...current, [role]: false }))
    }
  }

  function aplicarCotacao(role, leitura) {
    const campos = camposDaCotacao(leitura.cotacao, { montarCategorias })
    aplicarCamposCotacao(role, leitura, campos)
  }

  function aplicarCamposCotacao(role, leitura, campos) {
    if (!campos) return
    // So o que o PDF realmente afirma sobrescreve. Espalhar `campos` inteiro
    // apagava com string vazia o que veio do cadastro da cotacao — era assim que
    // a placa da HDI e a vigencia da Pier sumiam depois da leitura, justamente os
    // dois casos em que o PDF nao tem o dado e o sistema tem.
    const lidos = Object.fromEntries(
      Object.entries(campos).filter(([, valor]) => valor !== '' && valor != null),
    )
    setSides(current => ({
      ...current,
      [role]: {
        ...current[role],
        seguradora: leitura.cotacao.seguradora?.nome || current[role].seguradora,
        campos: { ...current[role].campos, ...lidos },
      },
    }))
  }

  /**
   * Gera o orcamento comparativo a partir do que esta na revisao.
   *
   * A cotacao que vai para o documento e a EXTRAIDA com a revisao aplicada por
   * cima (`aplicarRevisao`) — o corretor corrige na tela e a correcao chega ao
   * PDF; sem isso a revisao seria decorativa.
   *
   * A validacao de `montarComparativo` manda: cobertura nao informada e
   * indenizacao integral em branco BLOQUEIAM, porque um comparativo com linha
   * faltando chega ao cliente parecendo completo.
   *
   * O documento abre numa area propria de visualizacao. O botao "Baixar PDF"
   * dessa area chama a impressao do navegador, mantendo texto e logos vetoriais.
   * Persistir em
   * `auto_orcamentos` e alocar o numero CV-AAAA-NNNN sao uma etapa separada de
   * persistencia; esta acao apenas monta e visualiza o documento conferido.
   */
  async function gerarOrcamento() {
    setGerando(true)
    setErroGeracao('')
    try {
      const [{ montarComparativo, casarSeguradoraDetalhado }, { montarHtmlOrcamento }, { fetchSeguradorasCatalog }] = await Promise.all([
        import('../../lib/orcamentoComparativo'),
        import('../../lib/orcamentoComparativoHtml'),
        import('../../lib/seguradoras'),
      ])

      // A logo do card vem do cadastro (`seguradoras.logo_url`), nunca recortada
      // do PDF da cotacao. O parser nao consulta o banco, entao ate aqui
      // `logo_url` estava vazio e todo card caia no nome em serifada — era o
      // "a logo das seguradoras nao vai no PDF".
      const catalogo = await fetchSeguradorasCatalog().catch(() => [])

      const semLogo = []
      const cotacaoDe = role => {
        const lida = leituras[role]?.cotacao
        if (!lida) return null
        const cot = aplicarRevisao(lida, sides[role].campos)
        const nome = sides[role].seguradora || cot.seguradora?.nome || ''
        const { seguradora: meta, precisao } = casarSeguradoraDetalhado(catalogo, nome)

        // O nome do cadastro so substitui o escolhido quando o casamento foi
        // EXATO ou por alias. Num casamento aproximado (por substring) o
        // `nome_canonico` pode ser de outra empresa do grupo — "Porto Seguro"
        // casa com "Porto Seguro Saude" — e trocar o nome ali entregaria ao
        // cliente um orcamento com a seguradora errada. A logo e a cor ainda
        // valem: sao do mesmo grupo.
        const nomeFinal = (precisao === 'exata' || precisao === 'alias')
          ? (meta?.nome_canonico || nome)
          : nome
        const logoUrl = getEntityImageUrl(meta?.logo_path, meta?.logo_url || cot.seguradora?.logo_url || null) || ''
        if (!logoUrl && nomeFinal) semLogo.push(nomeFinal)

        return {
          ...cot,
          seguradora: {
            ...cot.seguradora,
            nome: nomeFinal,
            id: meta?.id ?? cot.seguradora?.id ?? null,
            logo_url: logoUrl,
            cor_destaque: meta?.cor_destaque || cot.seguradora?.cor_destaque || '',
          },
        }
      }

      const atual = cotacaoDe('atual')
      const outra = cotacaoDe('concorrente')
      if (!atual || !outra) {
        setErroGeracao('Envie e leia os dois PDFs antes de gerar o comparativo.')
        return
      }

      const hoje = new Date().toISOString().slice(0, 10)
      const comparativo = montarComparativo({ atual, outra, emitidoEm: hoje })
      if (!comparativo.validacao.podeGerar) {
        const motivos = [...comparativo.validacao.atual.pendencias, ...comparativo.validacao.outra.pendencias]
          .filter(p => p.bloqueia !== false)
          .map(p => p.label || p.caminho)
        setErroGeracao(`Faltam dados obrigatórios: ${[...new Set(motivos)].join(' · ')}`)
        return
      }

      const html = montarHtmlOrcamento(comparativo)
      setComparativoGerado(comparativo)
      setPreviewHtml(html)
      // A logo vem do cadastro em Configuracoes, nunca do PDF da cotacao. Sem
      // cadastro o card cai para o nome em serifada — o documento sai, mas o
      // operador precisa saber por que a logo nao apareceu.
      setSeguradorasSemLogo([...new Set(semLogo)])
    } catch (erro) {
      setErroGeracao(`Não foi possível gerar o orçamento: ${erro.message}`)
    } finally {
      setGerando(false)
    }
  }

  function patchField(role, field, value) {
    invalidarPreview()
    setSides(current => ({ ...current, [role]: { ...current[role], campos: { ...current[role].campos, [field]: value } } }))
  }

  // A previa e descartavel; o orcamento JA GRAVADO nao. Zerar `orcamentoSalvo`
  // aqui fazia o proximo "Salvar" alocar um segundo CV-AAAA-NNNN para o mesmo
  // orcamento, so porque o operador corrigiu um campo e regerou a previa.
  function invalidarPreview() {
    setComparativoGerado(null)
    setPreviewHtml('')
    setPreviewFullscreen(false)
    setSeguradorasSemLogo([])
  }

  async function baixarPdf(iframeRef) {
    const janela = iframeRef?.current?.contentWindow
    if (!janela) {
      setErroGeracao('Não foi possível acessar a prévia da cotação para baixar o PDF.')
      return
    }
    await imagensCarregadas(janela)
    if (janela.document.fonts?.ready) await janela.document.fonts.ready
    const limparImpressao = await prepararImpressaoUmaPagina(janela)
    janela.addEventListener('afterprint', limparImpressao, { once: true })
    janela.focus()
    janela.print()
  }

  async function salvarOrcamento() {
    if (!comparativoGerado) {
      setErroGeracao('Gere a prévia antes de salvar o orçamento.')
      return
    }

    setSalvandoOrcamento(true)
    setErroGeracao('')
    try {
      // Regravar um orcamento ja numerado ATUALIZA a mesma linha. Alocar um
      // numero novo a cada correcao entregaria dois CV diferentes para o mesmo
      // cliente e quebraria a sequencia anual.
      const ano = new Date().getFullYear()
      let sequencial = orcamentoSalvo?.id ? null : undefined
      if (sequencial === undefined) {
        const { data: numero, error: numeroError } = await supabase.rpc('proximo_numero_orcamento_auto', { p_ano: ano })
        if (numeroError) throw numeroError
        sequencial = Array.isArray(numero) ? numero[0] : numero
        if (!sequencial?.referencia) throw new Error('A RPC proximo_numero_orcamento_auto não retornou uma referência.')
      }

      const { data: userData } = await supabase.auth.getUser()
      const payload = {
        ...(sequencial ? { referencia: sequencial.referencia, ano: sequencial.ano || ano, sequencial: sequencial.sequencial } : {}),
        cotacao_id: quote?.id || null,
        cliente_id: quote?.cliente_id || null,
        seguradora_atual_id: comparativoGerado.cards?.[0]?.seguradora?.id || null,
        seguradora_outra_id: comparativoGerado.cards?.[1]?.seguradora?.id || null,
        segurado_nome: comparativoGerado.cliente?.segurado || null,
        veiculo: comparativoGerado.cliente?.veiculo || null,
        placa: comparativoGerado.cliente?.placa || null,
        tipo_operacao: comparativoGerado.cliente?.tipo_operacao || quote?.tipo || 'novo',
        dados_atual: comparativoGerado.cards?.[0] || {},
        dados_outra: comparativoGerado.cards?.[1] || {},
        premio_total_atual: comparativoGerado.cards?.[0]?.valores?.total ?? null,
        premio_total_outra: comparativoGerado.cards?.[1]?.valores?.total ?? null,
        emitido_em: comparativoGerado.cabecalho?.emitido_em || new Date().toISOString().slice(0, 10),
        validade_dias: comparativoGerado.cabecalho?.validade_dias || 5,
        status: 'gerado',
        // Autoria e do primeiro gravador: uma correcao feita por outra pessoa
        // nao reescreve quem criou o orcamento.
        ...(sequencial ? { criado_por: userData?.user?.id || null } : {}),
      }

      const { data, error } = orcamentoSalvo?.id
        ? await supabase.from('auto_orcamentos').update(payload).eq('id', orcamentoSalvo.id).select('id, referencia').single()
        : await supabase.from('auto_orcamentos').insert(payload).select('id, referencia').single()
      if (error) throw error
      setOrcamentoSalvo(data)
      const atualizado = {
        ...comparativoGerado,
        cabecalho: { ...comparativoGerado.cabecalho, referencia: data.referencia },
      }
      const { montarHtmlOrcamento } = await import('../../lib/orcamentoComparativoHtml')
      setComparativoGerado(atualizado)
      setPreviewHtml(montarHtmlOrcamento(atualizado))
    } catch (erro) {
      const msg = String(erro?.message || erro)
      const migrationHint = /auto_orcamentos|proximo_numero_orcamento_auto|schema cache|function/i.test(msg)
        ? ' Verifique se a migration supabase/67_auto_orcamento_comparativo.sql já foi rodada.'
        : ''
      setErroGeracao(`Não foi possível salvar o orçamento: ${msg}.${migrationHint}`)
    } finally {
      setSalvandoOrcamento(false)
    }
  }

  return (
    <section className="auto-comparison-workspace">
      <div className="auto-comparison-design-notice">
        <Sparkles />
        <span><strong>Leitura automática ativa por seguradora</strong><small>Quando o PDF traz mais de um produto, a leitura aguarda sua escolha. O trabalho é salvo sozinho — sair da tela não perde nada.</small></span>
        <RascunhoStatus estado={estadoRascunho} onDescartar={descartarRascunho} />
      </div>
      {rascunhoRestaurado && (
        <div className="auto-comparison-restored" role="status">
          <History />
          <span>
            <strong>Trabalho anterior restaurado</strong>
            <small>Revisão, seguradoras e leitura dos PDFs voltaram como estavam. Reenvie um PDF apenas se quiser trocar o arquivo.</small>
          </span>
          <button type="button" onClick={() => setRascunhoRestaurado(false)} aria-label="Fechar aviso"><X /></button>
        </div>
      )}
      <header className="auto-comparison-heading">
        <div className="auto-comparison-heading-icon"><Sparkles /></div>
        <div><span>Orçamento comparativo</span><h2>Envie, revise e compare sem sair da cotação</h2><p>Prêmio, parcelamento, franquia e coberturas são conferidos antes de abrir a cotação final.</p></div>
        <div className="auto-comparison-progress" aria-label="Progresso demonstrativo do orçamento"><span className={step === 'upload' ? 'is-active' : 'is-done'}><i>{step === 'upload' ? 1 : <Check />}</i>Upload</span><b /><span className={step === 'review' ? 'is-active' : ''}><i>2</i>Revisão</span><b /><span><i>3</i>PDF final</span></div>
      </header>
      <div className="auto-comparison-operation"><label><span>Tipo da cotação</span><select value={quote?.tipo || 'novo'} disabled><option value="novo">Seguro novo</option><option value="renovacao">Renovação</option><option value="endosso">Endosso</option></select></label><div><ShieldCheck /><span><strong>Revisão obrigatória ativa</strong><small>Campos ausentes ou sem valor bloqueiam a cotação final.</small></span></div></div>
      {step === 'upload' ? <>
        <div className="auto-comparison-upload-grid">{ROLES.map(({ key }) => (
          <UploadSlot
            key={key}
            role={key}
            side={sides[key]}
            file={arquivos[key]}
            leitura={leituras[key]}
            lendo={lendo[key]}
            erro={erros[key]}
            aplicando={aplicando[key]}
            seguradoraParser={parsers[key]}
            onParser={parserId => escolherParser(key, parserId)}
            onFile={file => chooseFile(key, file)}
            onEscolherOferta={indice => escolherOferta(key, indice)}
          />
        ))}</div>
        <footer className="auto-comparison-footer"><div><FileText /><span><strong>{tituloRodapeUpload}</strong><small>{resumoUpload}</small></span></div><button type="button" onClick={() => setStep('review')} disabled={!podeAbrirRevisao}>Visualizar revisão <ArrowRight /></button></footer>
      </> : <>
        <div className="auto-comparison-review-summary"><div><span>Pendências previstas</span><strong>{issueCount}</strong><small>{criticalCount} campo(s) crítico(s)</small></div><p><AlertTriangle />Franquia, indenização integral e cobertura não informada bloqueiam a geração — um comparativo com linha faltando chega ao cliente parecendo completo.</p><button type="button" onClick={() => setStep('upload')}><RefreshCw />Voltar ao upload</button></div>
        <div className="auto-comparison-review-grid">{ROLES.map(({ key }) => (
          <ReviewColumn
            key={key}
            role={key}
            side={sides[key]}
            issues={issues[key]}
            leitura={leituras[key]}
            aplicando={aplicando[key]}
            onEscolherOferta={indice => escolherOferta(key, indice)}
            onPatch={(field, value) => patchField(key, field, value)}
          />
        ))}</div>
        {erroGeracao && <div className="auto-comparison-review-summary is-error"><p><AlertTriangle />{erroGeracao}</p></div>}
        {seguradorasSemLogo.length > 0 && (
          <div className="auto-comparison-review-summary is-warning" role="status">
            <p>
              <AlertTriangle />
              Sem logo cadastrada para {seguradorasSemLogo.join(' e ')}. O orçamento sai com o nome no lugar da logo — cadastre a imagem em Configurações &gt; Seguradoras e gere de novo.
            </p>
          </div>
        )}
        <footer className="auto-comparison-footer is-review">
          <div><CheckCircle2 /><span><strong>{comparativoGerado ? 'PDF do orçamento pronto' : 'Revisão pronta para gerar o PDF'}</strong><small>{comparativoGerado ? 'A prévia abaixo contém os botões para baixar ou salvar o PDF.' : 'Confira os campos dos dois lados e gere o documento final.'}</small></span></div>
          <button type="button" onClick={gerarOrcamento} disabled={gerando}>
            {gerando ? <><LoaderCircle className="is-spinning" />Gerando PDF…</> : <><FileCheck2 />Gerar PDF do orçamento</>}
          </button>
        </footer>
        <OrcamentoPreview
          html={previewHtml}
          salvando={salvandoOrcamento}
          salvo={orcamentoSalvo}
          onFullscreen={() => setPreviewFullscreen(true)}
          onDownload={baixarPdf}
          onSave={salvarOrcamento}
        />
        <OrcamentoPreview
          html={previewFullscreen ? previewHtml : ''}
          fullscreen
          salvando={salvandoOrcamento}
          salvo={orcamentoSalvo}
          onCloseFullscreen={() => setPreviewFullscreen(false)}
          onDownload={baixarPdf}
          onSave={salvarOrcamento}
        />
      </>}
    </section>
  )
}
