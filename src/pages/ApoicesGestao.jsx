import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import {
  Briefcase,
  Building,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Home,
  LayoutGrid,
  Plus,
  RefreshCw,
  Search,
  Upload,
  X,
} from 'lucide-react'
import {
  criarApolice,
  fetchApolicesKanban,
  formatMoneyBR,
  moverStatusApolice,
  STATUS_EMISSAO_LABELS,
} from '../lib/apolices'
import { fetchFichasAprovadasEmissao } from '../lib/fichas'
import { extractPdfText } from '../lib/apoliceParser'
import { uploadDocumento } from '../lib/documentos'
import { normalizeDisplayText } from '../lib/text'
import { useImobiliaria } from '../hooks/useImobiliaria'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { KanbanSkeleton } from '../components/Skeleton'
import SeguradoraBadge from '../components/SeguradoraBadge'
import { Avatar } from '../components/ui'

const COLUNAS = [
  { id: 'recebida', label: 'Recebida', color: '#3B82F6' },
  { id: 'proposta_transmitida', label: 'Proposta Transmitida', color: '#F59E0B' },
  { id: 'emitida', label: 'Apólice Emitida', color: '#8B5CF6' },
  { id: 'enviada', label: 'Apólice Enviada', color: '#059669' },
]

const PRODUTO_ICON = { residencial_pf: Home, comercial_pf: Briefcase, pessoa_juridica: Building }
const PRODUTO_COLOR = { residencial_pf: '#4A90D9', comercial_pf: '#059669', pessoa_juridica: '#8B5CF6' }
const PRODUTO_ABBR = { residencial_pf: 'RES. PF', comercial_pf: 'COM. PF', pessoa_juridica: 'PJ' }
const SEGURADORAS_UPLOAD_DIRETO = ['Porto Seguro', 'Pottential Seguros', 'TOO Seguros']

function getPeriodDates(filtro) {
  const now = new Date()
  if (filtro === 'total') {
    return [null, null]
  }
  if (filtro === 'hoje') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return [start.toISOString(), now.toISOString()]
  }
  if (filtro === 'semana') {
    const start = new Date(now)
    start.setDate(start.getDate() - 7)
    start.setHours(0, 0, 0, 0)
    return [start.toISOString(), now.toISOString()]
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return [start.toISOString(), now.toISOString()]
}

function timeSince(dateStr) {
  if (!dateStr) return 'agora'
  const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60))
  if (hours < 1) return '<1h'
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function timeBadgeClass(dateStr) {
  if (!dateStr) return 'badge-info'
  const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60))
  if (hours < 4) return 'badge-success'
  if (hours < 24) return 'badge-warning'
  return 'badge-danger'
}

function nomeApolice(apolice) {
  return normalizeDisplayText(
    apolice?.fichas?.nome_empresa
      || apolice?.fichas?.nome_interessado
      || apolice?.nome_interessado
  ) || 'Sem nome'
}

function produtoApolice(apolice) {
  return apolice?.fichas?.produto || apolice?.produto || apolice?.raw_data?.produto
}

function documentoApolice(apolice) {
  return apolice?.fichas?.cnpj || apolice?.fichas?.cpf || apolice?.raw_data?.cnpj || apolice?.raw_data?.cpf || '—'
}

function isApoliceSemFicha(apolice) {
  return !apolice?.fichas && Boolean(apolice?.raw_data?.origem_upload_direto)
}

function statusBadgeClass(status) {
  switch (status) {
    case 'emitida':
    case 'enviada':
      return 'badge-success'
    case 'proposta_transmitida':
      return 'badge-warning'
    default:
      return 'badge-info'
  }
}

function resumoFicha(ficha) {
  const raw = ficha?.raw_data || {}
  const nome = normalizeDisplayText(
    ficha?.nome_empresa
      || ficha?.nome_interessado
      || raw?.nome_empresa
      || raw?.nome_interessado
      || raw?.nome
  ) || 'Sem nome'

  return {
    nome,
    imobiliaria: normalizeDisplayText(ficha?.imobiliaria || raw?.imobiliaria) || 'Imobiliária não informada',
    avatarUrl: ficha?.profiles?.avatar_url || raw?.avatar_url || '',
    emissorNome: ficha?.profiles?.nome || '',
    numeroOrcamento: String(raw?.numero_orcamento || '').trim(),
  }
}

function parseDateBR(str) {
  if (!str) return ''
  const parts = String(str).trim().split('/')
  if (parts.length !== 3) return ''
  const [d, m, y] = parts
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseMoneyBR(str) {
  if (!str) return null
  const clean = String(str).trim().replace(/\./g, '').replace(',', '.')
  const value = Number.parseFloat(clean)
  return Number.isFinite(value) ? value : null
}

function inferProdutoFianca({ documento, tipoImovel }) {
  const digits = String(documento || '').replace(/\D/g, '')
  const tipo = String(tipoImovel || '').toLowerCase()
  if (digits.length > 11) return 'pessoa_juridica'
  if (tipo.includes('comercial')) return 'comercial_pf'
  return 'residencial_pf'
}

function extrairDadosPortoUpload(texto) {
  const text = String(texto || '').replace(/\s+/g, ' ')
  const result = {}

  const numeroApolice = text.match(/59\s*\.?\s*0746\s*\.?\s*0000000\s*([0-9. ]{6,})/i)
  if (numeroApolice) {
    result.numero_apolice = numeroApolice[1].trim().replace(/\s+/g, '').replace(/^\.+|\.+$/g, '').split('.')[0]
  }

  const proposta = text.match(/PROPOSTA N[ÂºÂ°]\s+([\w.-]+)/i)
  if (proposta) result.numero_proposta = proposta[1].trim()

  const vigencia = text.match(/a partir das 24 horas do dia (\d{2}\/\d{2}\/\d{4}) at[eé] as 24 horas do dia (\d{2}\/\d{2}\/\d{4})/i)
  if (vigencia) {
    result.inicio_vigencia = parseDateBR(vigencia[1])
    result.fim_vigencia = parseDateBR(vigencia[2])
  }

  const segurado = text.match(/DADOS DO SEGURADO\s+NOME\/RAZ[ÃƒA]O SOCIAL\s+(.+?)\s+NOME SOCIAL\s+CPF\/CNPJ\s+([\d./-]+)/i)
  if (segurado) {
    result.nome_proprietario = segurado[1].trim()
    result.proprietario_documento = segurado[2].trim()
  }

  const localRisco = text.match(/LOCAL DE RISCO\s+(.+?)(?=\s+PRIMEIRO LOCAT[ÃA]RIO|\s+ESTIPULANTE)/i)
  if (localRisco) {
    result.endereco = localRisco[1].trim()
    const partes = result.endereco.split(',').map(item => item.trim()).filter(Boolean)
    result.endereco_linha = partes[0] || ''
    result.cep = partes[1] ? partes[1].replace(/\D/g, '') : ''
    if (partes[2]) {
      const bairroCidadeEstado = partes[2].match(/(.+?)\s*-\s*([^,]+),\s*([A-Z]{2})$/i)
      if (bairroCidadeEstado) {
        result.bairro = bairroCidadeEstado[1].trim()
        result.cidade = bairroCidadeEstado[2].trim()
        result.estado = bairroCidadeEstado[3].trim().toUpperCase()
      }
    }
  }

  const locatario = text.match(/PRIMEIRO LOCAT[ÃA]RIO CPF\/CNPJ\s+([\d./-]+)\s+NOME\/RAZ[ÃƒA]O SOCIAL\s+(.+?)(?=\s+NOME SOCIAL|\s+PROFISS[ÃƒA]O|\s+ESTIPULANTE)/i)
  if (locatario) {
    result.documento_locatario = locatario[1].trim()
    result.nome_locatario = locatario[2].trim()
  }

  const tipoLocacao = text.match(/TIPO DE LOCA[ÇC][ÃA]O\s+\d+\s*[–\-]\s*(\w+)/i)
  if (tipoLocacao) result.tipo_imovel = tipoLocacao[1].trim()

  const aluguel = text.match(/Aluguel\s+R\$\s*([\d.,]+)\s+\d+x/i)
  if (aluguel) result.valor_aluguel = parseMoneyBR(aluguel[1])

  const premioLiquido = text.match(/Pr[êe]mio L[íi]quido\s+R\$\s*([\d.,]+)/i)
  if (premioLiquido) result.premio_liquido = parseMoneyBR(premioLiquido[1])

  const valorParcela = text.match(/Valor da Parcela\s+R\$\s*([\d.,]+)/i)
  if (valorParcela) result.valor_parcela = parseMoneyBR(valorParcela[1])

  const parcelamento = text.match(/Fatura sem entrada\s+(\d+)X/i)
  if (parcelamento) result.parcelamento = Number.parseInt(parcelamento[1], 10)

  const premioTotal = text.match(/Pre[çc]o Total do Seguro\s+R\$\s*([\d.,]+)/i)
  if (premioTotal) result.premio_total = parseMoneyBR(premioTotal[1])

  result.forma_pagamento = 'fatura_sem_entrada'
  return result
}

function extrairDadosPottencialUpload(texto) {
  const text = String(texto || '').replace(/\s+/g, ' ')
  const result = {}

  const numeroApolice = text.match(/N[ÂºÂ°]\s*DA AP[Ã“O]LICE\s+(\d{10,})/i)
  if (numeroApolice) result.numero_apolice = numeroApolice[1].trim()

  const proposta = text.match(/N[ÂºÂ°]\s*DA PROPOSTA\s+(\d+)/i)
  if (proposta) result.numero_proposta = proposta[1].trim()

  const vigencia = text.match(/Das 0h do dia\s+(\d{2}\/\d{2}\/\d{4})\s+às 0h do dia\s+(\d{2}\/\d{2}\/\d{4})/i)
  if (vigencia) {
    result.inicio_vigencia = parseDateBR(vigencia[1])
    result.fim_vigencia = parseDateBR(vigencia[2])
  }

  const locatario = text.match(/LOCAT[ÃA]RIOS?\s+\(Garantidos\)\s+Nome:\s+(.+?)\s+CPF:\s+([\d./-]+)/i)
  if (locatario) {
    result.nome_locatario = locatario[1].trim()
    result.documento_locatario = locatario[2].trim()
  }

  const locador = text.match(/LOCADOR\s+\(Segurado\)\s+Nome:\s+(.+?)\s+CPF:\s+([\d./-]+)/i)
  if (locador) {
    result.nome_proprietario = locador[1].trim()
    result.proprietario_documento = locador[2].trim()
  }

  const tipoLocacao = text.match(/Tipo de loca[çc][ãa]o:\s+(Residencial|Comercial)/i)
  if (tipoLocacao) result.tipo_imovel = tipoLocacao[1].trim()

  const localRisco = text.match(/Local do Risco:\s+(.+?)(?=\s+Vig[êe]ncia do contrato de loca[çc][ãa]o:|\s+LOCAT[ÃA]RIOS?\s+\(Garantidos\))/i)
  if (localRisco) {
    result.endereco = localRisco[1].trim()
    const enderecoMatch = result.endereco.match(/(.+?)\s+(\d{8})\s+([A-ZÀ-Ü\s]+?)\s+([A-ZÀ-Ü\s]+)\s+([A-Z]{2})$/i)
    if (enderecoMatch) {
      result.endereco_linha = enderecoMatch[1].trim()
      result.cep = enderecoMatch[2].trim()
      result.bairro = enderecoMatch[3].trim()
      result.cidade = enderecoMatch[4].trim()
      result.estado = enderecoMatch[5].trim().toUpperCase()
    } else {
      const cepMatch = result.endereco.match(/\b(\d{8})\b/)
      if (cepMatch) result.cep = cepMatch[1]
    }
  }

  const aluguel = text.match(/Aluguel\s+R\$\s*([\d.,]+)\s+R\$\s*[\d.,]+\s+R\$\s*[\d.,]+/i)
  if (aluguel) result.valor_aluguel = parseMoneyBR(aluguel[1])

  const premioLiquido = text.match(/Pr[êe]mio L[íi]quido\s+R\$\s*([\d.,]+)/i)
  if (premioLiquido) result.premio_liquido = parseMoneyBR(premioLiquido[1])

  const premioTotal = text.match(/Pr[êe]mio Total:\s+R\$\s*([\d.,]+)/i)
  if (premioTotal) result.premio_total = parseMoneyBR(premioTotal[1])

  const pagamento = text.match(/Fatura mensal em\s+(\d+)\s*x sem juros:\s+R\$\s*([\d.,]+)/i)
  if (pagamento) {
    result.parcelamento = Number.parseInt(pagamento[1], 10)
    result.valor_parcela = parseMoneyBR(pagamento[2])
  }

  result.forma_pagamento = 'fatura_sem_entrada'
  return result
}


function extrairDadosTooUpload(texto) {
  const text = String(texto || '').replace(/\s+/g, ' ')
  const result = {}

  const numeroApolice = text.match(/AP[ÓO]LICE N[º°]\s+(\d+)/i)
  if (numeroApolice) result.numero_apolice = numeroApolice[1].trim()

  const proposta = text.match(/PROPOSTA N[º°]\s+(\d+)/i)
  if (proposta) result.numero_proposta = proposta[1].trim()

  const inicioVigencia = text.match(/IN[IÍ]CIO DE VIG[ÊE]NCIA DAS 24H\s+(\d{2}\/\d{2}\/\d{4})/i)
  const fimVigencia = text.match(/T[ÉE]RMINO DE VIG[ÊE]NCIA DAS 24H\s+(\d{2}\/\d{2}\/\d{4})/i)
  if (inicioVigencia) result.inicio_vigencia = parseDateBR(inicioVigencia[1])
  if (fimVigencia) result.fim_vigencia = parseDateBR(fimVigencia[1])

  const segurado = text.match(/DADOS DO SEGURADO[\s\S]{0,250}?\bSegurado:\s*(.+?)(?=\s+CPF\/CNPJ|\s+CPF|\s+CNPJ)/i)
    || text.match(/\bSEGURADO\b\s*:?	*(.+?)(?=\s*(?:CPF|CNPJ|CELULAR|TELEFONE|FONE|E-?MAIL|Local do Risco|CEP|Tipo de loca))/i)
  if (segurado) {
    result.nome_proprietario = segurado[1].trim()
  }

  const seguradoDoc = text.match(/DADOS DO SEGURADO[\s\S]{0,250}?\bCPF\/CNPJ:\s*([\d./-]+)/i)
    || text.match(/\bSEGURADO\b[\s\S]{0,120}?\bCPF\/CNPJ:\s*([\d./-]+)/i)
  if (seguradoDoc) result.proprietario_documento = seguradoDoc[1].trim()

  const localRisco = text.match(/Local do Risco:\s*(.+?)(?=\s+Bairro:|\s+Tipo de LOCA|$)/i)
  if (localRisco) result.endereco_linha = localRisco[1].trim()

  const bairro = text.match(/Bairro:\s*(.+?)(?=\s+Cidade:|\s+UF:|\s+CEP:)/i)
  const cidade = text.match(/Cidade:\s*(.+?)(?=\s+UF:|\s+CEP:)/i)
  const estado = text.match(/UF:\s*([A-Z]{2})/i)
  const cep = text.match(/CEP:\s*([\d.-]+)/i)
  if (bairro) result.bairro = bairro[1].trim()
  if (cidade) result.cidade = cidade[1].trim()
  if (estado) result.estado = estado[1].trim().toUpperCase()
  if (cep) result.cep = cep[1].replace(/\D/g, '')

  result.endereco = [
    result.endereco_linha,
    result.bairro,
    result.cidade,
    result.estado,
  ].filter(Boolean).join(', ')

  const tipoLocacao = text.match(/TIPO DE LOCA[ÇC][ÃA]O[\s\S]{0,80}?\bIm[óo]vel\s*-\s*(Residencial|Comercial)/i)
    || text.match(/Im[óo]vel\s*-\s*(Residencial|Comercial)/i)
  if (tipoLocacao) result.tipo_imovel = tipoLocacao[1].trim()

  const aluguel = text.match(/Aluguel\s+([\d.,]+)\s+[\d.,]+\s+[\d.,]+/i)
  if (aluguel) result.valor_aluguel = parseMoneyBR(aluguel[1])

  const premioLiquido = text.match(/PR[ÊE]MIO L[ÍI]QUIDO:\s*([\d.,]+)/i)
  if (premioLiquido) result.premio_liquido = parseMoneyBR(premioLiquido[1])

  const premioTotal = [...text.matchAll(/PR[ÊE]MIO TOTAL:\s*([\d.,]+)/gi)]
  if (premioTotal.length > 0) result.premio_total = parseMoneyBR(premioTotal[premioTotal.length - 1][1])

  const valorParcela = text.match(/\b1\s+[\d.,]+\s+0,00\s+0,00\s+[\d.,]+\s+([\d.,]+)\s+\d{2}\/\d{2}\/\d{4}/i)
  if (valorParcela) result.valor_parcela = parseMoneyBR(valorParcela[1])

  const parcelas = [...text.matchAll(/\b(\d+)\s+[\d.,]+\s+0,00\s+0,00\s+[\d.,]+\s+[\d.,]+\s+\d{2}\/\d{2}\/\d{4}/gi)]
  if (parcelas.length > 0) {
    result.parcelamento = Number.parseInt(parcelas[parcelas.length - 1][1], 10)
  }

  result.forma_pagamento = 'fatura_sem_entrada'
  return result
}
function InfoPill({ label, value, mono = false }) {
  return (
    <div className="rounded-xl border border-dark-border/60 bg-white/80 px-2 py-1.5">
      <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">{label}</p>
      <p className={`mt-0.5 text-[10px] text-dark-text truncate${mono ? ' font-mono' : ''}`}>{value || '—'}</p>
    </div>
  )
}

function KanbanCard({ apolice, resolverNome, onOpen, isDragOverlay = false, dragListeners, dragAttributes }) {
  const [expandido, setExpandido] = useState(false)
  const produto = produtoApolice(apolice)
  const ProdutoIcon = PRODUTO_ICON[produto] || LayoutGrid
  const produtoColor = PRODUTO_COLOR[produto] || '#6B7280'
  const emissorNome = apolice?.profiles?.nome || ''
  const statusLabel = STATUS_EMISSAO_LABELS[apolice?.status_emissao]?.label || apolice?.status_emissao || 'Recebida'
  const documento = documentoApolice(apolice)
  const celular = apolice?.fichas?.celular || apolice?.raw_data?.celular || '—'
  const tipoImovel = normalizeDisplayText(apolice?.fichas?.tipo_imovel || apolice?.raw_data?.tipo_imovel) || '—'
  const vigencia = [apolice?.inicio_vigencia, apolice?.fim_vigencia].filter(Boolean).join(' até ') || '—'
  const parcela = apolice?.valor_parcela ? formatMoneyBR(apolice.valor_parcela) : '—'
  const parcelamento = apolice?.parcelamento ? `${apolice.parcelamento}x` : '—'

  return (
    <div className={`kanban-card${isDragOverlay ? ' kanban-card-dragging' : ''}`} style={{ '--kanban-accent': produtoColor }}>
      {!isDragOverlay && (
        <button
          {...dragListeners}
          {...dragAttributes}
          className="kanban-grip"
          onClick={event => event.stopPropagation()}
          tabIndex={-1}
          aria-label="Arrastar"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="kanban-card-body cursor-pointer" onClick={() => !isDragOverlay && onOpen?.(apolice.id)}>
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-[3px] rounded-full uppercase tracking-wide select-none"
            style={{ background: `${produtoColor}20`, color: produtoColor }}
          >
            <ProdutoIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
            {PRODUTO_ABBR[produto] || 'AUTO'}
          </span>
          <span className={`badge text-[9px] font-mono select-none ${statusBadgeClass(apolice?.status_emissao)}`}>
            {statusLabel}
          </span>
          <span className={`badge text-[9px] font-mono select-none ${timeBadgeClass(apolice?.created_at)}`}>
            {timeSince(apolice?.created_at)}
          </span>
        </div>

        <p className="text-[12.5px] font-semibold text-dark-text leading-snug truncate mb-0.5">
          {nomeApolice(apolice)}
        </p>
        {isApoliceSemFicha(apolice) && (
          <div className="mb-1">
            <span className="inline-flex items-center rounded-full bg-status-warning/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-status-warning">
              Apólice sem ficha vinculada
            </span>
          </div>
        )}
        <p className="text-[10px] text-dark-muted truncate leading-none mb-1.5">
          {resolverNome ? resolverNome(apolice?.imobiliaria) : (apolice?.imobiliaria || '—')}
        </p>

        {apolice?.numero_apolice && (
          <p className="text-[10px] font-mono mb-1.5" style={{ color: '#2B5BA8' }}>
            {apolice.numero_apolice}
          </p>
        )}

        {apolice?.seguradora && (
          <div className="mb-1.5">
            <SeguradoraBadge nome={apolice.seguradora} size="xs" />
          </div>
        )}

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <InfoPill label="Documento" value={documento} mono />
          <InfoPill label="Celular" value={celular} />
          <InfoPill label="Imóvel" value={tipoImovel} />
          <InfoPill label="Parcelas" value={parcelamento} />
        </div>

        <div className="mt-1.5 rounded-xl border border-dark-border/60 bg-dark-surface2/25 px-2 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">Vigência</p>
              <p className="mt-0.5 text-[10px] text-dark-text truncate">{vigencia}</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] uppercase tracking-[0.14em] text-dark-muted">Parcela</p>
              <p className="mt-0.5 text-[10px] font-semibold" style={{ color: '#047857' }}>{parcela}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-dark-border/40 mt-auto">
          {emissorNome ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar name={emissorNome} src={apolice?.profiles?.avatar_url || ''} size="sm" />
              <span className="text-[10px] text-dark-muted font-medium truncate max-w-[96px]">
                {emissorNome.split(' ')[0]}
              </span>
            </div>
          ) : (
            <span className="text-[9px] text-status-warning font-semibold tracking-wide uppercase">Livre</span>
          )}

          {!isDragOverlay && (
            <button
              type="button"
              onPointerDown={event => event.stopPropagation()}
              onClick={event => {
                event.stopPropagation()
                setExpandido(value => !value)
              }}
              className="text-[9px] text-dark-muted hover:text-dark-text transition-colors px-1.5 py-0.5 rounded-md hover:bg-dark-surface2"
            >
              {expandido ? '▲' : '▼ Detalhes'}
            </button>
          )}
        </div>

        {expandido && !isDragOverlay && (
          <div className="space-y-0.5 pt-1.5 mt-1.5 border-t border-dark-border/40 animate-fade-in">
            <p className="text-[9px] text-dark-muted truncate">
              Imobiliária: {resolverNome ? resolverNome(apolice?.imobiliaria) : (apolice?.imobiliaria || '—')}
            </p>
            {(apolice?.fichas?.cep || apolice?.raw_data?.cep) && <p className="text-[9px] text-dark-muted font-mono">CEP: {apolice?.fichas?.cep || apolice?.raw_data?.cep}</p>}
            {apolice?.seguradora && <p className="text-[9px] text-dark-muted">Seguradora: {apolice.seguradora}</p>}
            {apolice?.valor_parcela && <p className="text-[9px] text-dark-muted">Parcela: {parcela}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function DraggableCard({ apolice, resolverNome, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: apolice.id,
    data: { type: 'card' },
  })

  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.25 : 1, transition: isDragging ? 'none' : 'opacity 0.2s ease' }}>
      <KanbanCard
        apolice={apolice}
        resolverNome={resolverNome}
        onOpen={onOpen}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  )
}

function DroppableColumn({ col, apolices, resolverNome, onOpen }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  return (
    <div className="kanban-col flex flex-col flex-shrink-0">
      <div className="kanban-col-header" style={{ background: `${col.color}14`, borderColor: `${col.color}45` }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
          <span className="text-[12px] font-semibold" style={{ color: col.color }}>{col.label}</span>
        </div>
        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${col.color}24`, color: col.color }}>
          {apolices.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="kanban-col-body flex-1 space-y-2 p-2 rounded-b-xl border overflow-y-auto transition-colors duration-150"
        style={{
          borderColor: isOver ? `${col.color}66` : 'rgb(var(--color-border))',
          backgroundColor: isOver ? `${col.color}08` : 'rgb(var(--color-surface2) / 0.35)',
          boxShadow: isOver ? `inset 0 0 0 1px ${col.color}55` : 'none',
        }}
      >
        {apolices.length === 0 ? (
          <div className="flex items-center justify-center h-20 rounded-xl border border-dashed border-dark-border/50 text-[11px] text-dark-muted">
            Vazia
          </div>
        ) : apolices.map(apolice => (
          <DraggableCard
            key={apolice.id}
            apolice={apolice}
            resolverNome={resolverNome}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  )
}

function IniciarEmissaoWorkspace({ onBack, onCriado, toast, grupos, getAliases, user }) {
  const [imobFiltro, setImobFiltro] = useState('')
  const [busca, setBusca] = useState('')
  const [fichas, setFichas] = useState([])
  const [loading, setLoading] = useState(true)
  const [criando, setCriando] = useState(false)
  const [fichaSelecionada, setFichaSelecionada] = useState(null)
  const [numeroOrcamento, setNumeroOrcamento] = useState('')

  const loadFichas = useCallback(async () => {
    setLoading(true)
    try {
      let imobiliarias
      if (imobFiltro) {
        const aliases = await getAliases(imobFiltro)
        imobiliarias = aliases.length ? aliases : [imobFiltro]
      }
      const data = await fetchFichasAprovadasEmissao({
        search: busca.trim(),
        imobiliarias,
      })
      setFichas(data || [])
    } catch {
      setFichas([])
      toast({ type: 'error', title: 'Erro ao carregar fichas aprovadas' })
    } finally {
      setLoading(false)
    }
  }, [busca, getAliases, imobFiltro, toast])

  useEffect(() => {
    const timeout = setTimeout(() => loadFichas(), 250)
    return () => clearTimeout(timeout)
  }, [loadFichas])

  function selecionarFicha(ficha) {
    const resumo = resumoFicha(ficha)
    setFichaSelecionada(ficha)
    setNumeroOrcamento(resumo.numeroOrcamento)
  }

  async function criarSolicitacao() {
    if (!fichaSelecionada) return
    setCriando(true)
    const resumo = resumoFicha(fichaSelecionada)
    const payload = {
      ficha_id: fichaSelecionada.id,
      imobiliaria: fichaSelecionada.imobiliaria || null,
      produto: fichaSelecionada.raw_data?.produto || null,
      status_emissao: 'recebida',
      nome_interessado: resumo.nome,
      numero_proposta: numeroOrcamento.trim() || null,
      emitido_por: user?.id || null,
      numero_apolice: '',
      seguradora: 'Outras',
      data_emissao: new Date().toISOString().slice(0, 10),
    }

    const { error } = await criarApolice(payload)
    setCriando(false)

    if (error) {
      toast({ type: 'error', title: 'Erro ao criar solicitação', message: error.message })
      return
    }

    toast({ type: 'success', title: 'Solicitação criada' })
    onCriado?.()
    onBack?.()
  }

  return (
    <section className="glass-panel rounded-3xl overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between gap-4 px-7 py-5 border-b border-dark-border">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/20 bg-brand-accent/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
            <Plus className="w-3.5 h-3.5" />
            Area dedicada
          </div>
          <h2 className="mt-3 text-xl font-bold text-dark-text">Iniciar Emissão</h2>
          <p className="text-sm text-dark-muted mt-0.5">Selecione uma ficha aprovada para criar a solicitação.</p>
        </div>
        <button onClick={onBack} className="btn-secondary text-sm">
          Voltar para gestão
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="px-7 py-6 space-y-5">
          <div>
            <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4">
              <div>
                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Imobiliária</label>
                <select value={imobFiltro} onChange={event => setImobFiltro(event.target.value)} className="select text-sm">
                  <option value="">Todas as imobiliárias</option>
                  {grupos.map(grupo => (
                    <option key={grupo.id} value={grupo.nome_canonico}>{grupo.nome_canonico}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Pesquisar fichas aprovadas</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
                  <input
                    value={busca}
                    onChange={event => setBusca(event.target.value)}
                    placeholder="Nome do cliente ou imobiliária"
                    className="input pl-10"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-dark-border bg-white/70 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
              <div>
                <h3 className="text-lg font-semibold text-dark-text">Fichas aprovadas</h3>
                <p className="text-sm text-dark-muted">Mostrando nome completo, foto e imobiliária.</p>
              </div>
              <span className="text-sm text-dark-muted">{fichas.length} fichas</span>
            </div>

            <div className="max-h-[420px] overflow-y-auto p-4">
              {loading ? (
                <div className="text-sm text-dark-muted text-center py-16">Carregando fichas aprovadas...</div>
              ) : fichas.length === 0 ? (
                <div className="text-sm text-dark-muted text-center py-16">Nenhuma ficha aprovada encontrada.</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {fichas.map(ficha => {
                    const resumo = resumoFicha(ficha)
                    const selecionada = fichaSelecionada?.id === ficha.id
                    return (
                      <button
                        key={ficha.id}
                        type="button"
                        onClick={() => selecionarFicha(ficha)}
                        className={`rounded-2xl border p-4 text-left transition-all ${
                          selecionada
                            ? 'border-brand-accent bg-brand-accent/5 shadow-sm'
                            : 'border-dark-border hover:border-brand-accent/40 hover:bg-dark-surface2/20'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar name={resumo.nome} src={resumo.avatarUrl} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[15px] font-semibold text-dark-text truncate">{resumo.nome}</p>
                              <span className="badge badge-success text-[10px]">Aprovada</span>
                            </div>
                            <p className="mt-1 text-sm text-dark-muted truncate">{resumo.imobiliaria}</p>
                            {resumo.emissorNome && (
                              <p className="mt-2 text-[11px] text-dark-muted truncate">Orcamentista: {resumo.emissorNome}</p>
                            )}
                            <p className="mt-2 text-[11px] font-mono text-dark-muted">
                              Nº orçamento: {resumo.numeroOrcamento || 'Não informado'}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="border-t xl:border-t-0 xl:border-l border-dark-border bg-dark-surface2/20 px-7 py-6">
          <div className="rounded-3xl border border-dark-border bg-white/80 p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-dark-muted">Dados da emissão</h3>
                <p className="text-sm text-dark-muted mt-1">
                  Ao selecionar a ficha, o número do orçamento é preenchido automaticamente quando existir.
                </p>
              </div>
              {fichaSelecionada && (
                <button
                  type="button"
                  className="text-sm text-dark-muted hover:text-dark-text transition-colors"
                  onClick={() => {
                    setFichaSelecionada(null)
                    setNumeroOrcamento('')
                  }}
                >
                  Limpar seleção
                </button>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Nº do orçamento</label>
                <input
                  value={numeroOrcamento}
                  onChange={event => setNumeroOrcamento(event.target.value)}
                  placeholder="Ex: 12345"
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Ficha selecionada</label>
                <div className="input min-h-[44px] bg-white/70 flex items-center text-sm">
                  {fichaSelecionada ? resumoFicha(fichaSelecionada).nome : 'Nenhuma ficha selecionada'}
                </div>
              </div>
              {fichaSelecionada && (
                <>
                  <div className="rounded-2xl border border-dark-border/60 bg-dark-surface2/20 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Imobiliária</p>
                    <p className="mt-2 text-sm font-semibold text-dark-text">{resumoFicha(fichaSelecionada).imobiliaria}</p>
                  </div>
                  <div className="rounded-2xl border border-dark-border/60 bg-dark-surface2/20 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Resumo</p>
                    <p className="mt-2 text-sm text-dark-text">Cliente: {resumoFicha(fichaSelecionada).nome}</p>
                    <p className="mt-1 text-xs text-dark-muted">Orçamento: {numeroOrcamento || 'Não informado'}</p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button onClick={onBack} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={criarSolicitacao} disabled={!fichaSelecionada || criando} className="btn-primary text-sm">
                {criando ? 'Criando...' : 'Criar Solicitação'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

function ModalUploadDireto({ onClose, onCriado, toast, grupos, user }) {
  const [seguradora, setSeguradora] = useState('Porto Seguro')
  const [imobiliaria, setImobiliaria] = useState('')
  const [celular, setCelular] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [extraindo, setExtraindo] = useState(false)
  const [criando, setCriando] = useState(false)
  const [dadosExtraidos, setDadosExtraidos] = useState(null)
  const [erro, setErro] = useState('')
  const fileInputRef = useRef(null)

  async function handleArquivo(file) {
    setPdfFile(file)
    setDadosExtraidos(null)
    setErro('')
    if (!file) return
    setExtraindo(true)
    try {
      const texto = await extractPdfText(file)
      const parsed = seguradora === 'Pottential Seguros'
        ? extrairDadosPottentialUpload(texto)
        : seguradora === 'TOO Seguros'
          ? extrairDadosTooUpload(texto)
          : extrairDadosPortoUpload(texto)
      if (!parsed.numero_apolice || !parsed.nome_locatario || !parsed.documento_locatario) {
        throw new Error(`Nao foi possivel identificar os dados principais da apolice ${seguradora}.`)
      }
      setDadosExtraidos(parsed)
    } catch (error) {
      setErro(error?.message || 'Erro ao ler o PDF da apolice.')
    } finally {
      setExtraindo(false)
    }
  }

  async function criarUploadDireto() {
    if (!pdfFile || !dadosExtraidos || !imobiliaria || !celular.trim()) return
    setCriando(true)
    const documento = dadosExtraidos.documento_locatario || ''
    const digits = documento.replace(/\D/g, '')
    const cpf = digits.length <= 11 ? documento : null
    const cnpj = digits.length > 11 ? documento : null
    const produto = inferProdutoFianca({ documento, tipoImovel: dadosExtraidos.tipo_imovel })
    const payload = {
      ficha_id: null,
      imobiliaria,
      produto,
      nome_interessado: dadosExtraidos.nome_locatario,
      numero_apolice: dadosExtraidos.numero_apolice || null,
      numero_proposta: dadosExtraidos.numero_proposta || null,
      seguradora,
      status_emissao: 'emitida',
      data_emissao: new Date().toISOString().slice(0, 10),
      emitido_por: user?.id || null,
      proprietario_nome: dadosExtraidos.nome_proprietario || null,
      endereco: dadosExtraidos.endereco || null,
      inicio_vigencia: dadosExtraidos.inicio_vigencia || null,
      fim_vigencia: dadosExtraidos.fim_vigencia || null,
      parcelamento: dadosExtraidos.parcelamento || null,
      valor_parcela: dadosExtraidos.valor_parcela || null,
      premio_liquido: dadosExtraidos.premio_liquido || null,
      premio_total: dadosExtraidos.premio_total || null,
      valor_producao: dadosExtraidos.premio_total || null,
      forma_pagamento: dadosExtraidos.forma_pagamento || null,
      raw_data: {
        origem_upload_direto: true,
        seguradora_upload: seguradora,
        nome_interessado: dadosExtraidos.nome_locatario || null,
        cpf,
        cnpj,
        celular: celular.trim(),
        cep: dadosExtraidos.cep || null,
        bairro: dadosExtraidos.bairro || null,
        cidade: dadosExtraidos.cidade || null,
        estado: dadosExtraidos.estado || null,
        endereco_linha: dadosExtraidos.endereco_linha || null,
        tipo_imovel: dadosExtraidos.tipo_imovel || null,
        valor_aluguel: dadosExtraidos.valor_aluguel ?? null,
        proprietario_documento: dadosExtraidos.proprietario_documento || null,
        produto,
      },
    }

    const { data, error } = await criarApolice(payload)
    if (error) {
      setCriando(false)
      toast({ type: 'error', title: 'Erro ao criar apolice', message: error.message })
      return
    }

    const { error: uploadError } = await uploadDocumento({
      file: pdfFile,
      apoliceId: data?.id,
      cpfCnpj: cpf || cnpj,
      userId: user?.id,
    })

    setCriando(false)

    if (uploadError) {
      toast({ type: 'error', title: 'Apolice criada, mas o PDF nao foi anexado', message: uploadError.message })
    } else {
      toast({ type: 'success', title: 'Apolice criada a partir do PDF' })
    }

    onCriado?.(data)
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="glass-panel rounded-3xl w-full max-w-4xl overflow-hidden">
        <div className="flex items-center justify-between px-7 py-5 border-b border-dark-border">
          <div>
            <h2 className="text-xl font-bold text-dark-text">Upload Direto da Apolice</h2>
            <p className="text-sm text-dark-muted mt-0.5">Cria a apolice ja emitida a partir do PDF, sem selecionar ficha.</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-xl" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-7 py-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Seguradora</label>
              <select value={seguradora} onChange={event => setSeguradora(event.target.value)} className="select text-sm">
                {SEGURADORAS_UPLOAD_DIRETO.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Imobiliaria</label>
              <select value={imobiliaria} onChange={event => setImobiliaria(event.target.value)} className="select text-sm">
                <option value="">Selecione a imobiliaria</option>
                {grupos.map(grupo => (
                  <option key={grupo.id} value={grupo.nome_canonico}>{grupo.nome_canonico}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-dark-muted uppercase tracking-wider block mb-1.5">Celular do locatario</label>
              <input value={celular} onChange={event => setCelular(event.target.value)} placeholder="Preenchimento manual" className="input text-sm" />
            </div>
          </div>

          <div className="rounded-3xl border border-dark-border bg-dark-surface2/20 p-5 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={event => handleArquivo(event.target.files?.[0] || null)}
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-2xl border border-dark-border bg-white/80 px-3 py-2 text-xs font-medium text-dark-text hover:border-brand-accent/40 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                {pdfFile ? pdfFile.name : 'Selecionar PDF da apolice'}
              </button>
              {extraindo && <span className="text-xs font-medium text-dark-muted">Lendo PDF...</span>}
            </div>

            {erro && <p className="text-xs font-medium text-status-danger">{erro}</p>}

            {dadosExtraidos && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-dark-border/60 bg-white/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Locatario</p>
                  <p className="mt-2 text-sm font-semibold text-dark-text">{dadosExtraidos.nome_locatario || '-'}</p>
                  <p className="mt-1 text-xs text-dark-muted">{dadosExtraidos.documento_locatario || '-'}</p>
                </div>
                <div className="rounded-2xl border border-dark-border/60 bg-white/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Imovel</p>
                  <p className="mt-2 text-sm text-dark-text">{dadosExtraidos.endereco_linha || dadosExtraidos.endereco || '-'}</p>
                  <p className="mt-1 text-xs text-dark-muted">{[dadosExtraidos.bairro, dadosExtraidos.cidade, dadosExtraidos.estado].filter(Boolean).join(' Â· ') || '-'}</p>
                  <p className="mt-1 text-xs font-mono text-dark-muted">{dadosExtraidos.cep || '-'}</p>
                </div>
                <div className="rounded-2xl border border-dark-border/60 bg-white/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Apolice</p>
                  <p className="mt-2 text-sm text-dark-text">Numero: {dadosExtraidos.numero_apolice || '-'}</p>
                  <p className="mt-1 text-xs text-dark-muted">Proposta: {dadosExtraidos.numero_proposta || '-'}</p>
                  <p className="mt-1 text-xs text-dark-muted">Vigencia: {[dadosExtraidos.inicio_vigencia, dadosExtraidos.fim_vigencia].filter(Boolean).join(' ate ') || '-'}</p>
                </div>
                <div className="rounded-2xl border border-dark-border/60 bg-white/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dark-muted">Financeiro</p>
                  <p className="mt-2 text-sm text-dark-text">Parcela: {dadosExtraidos.valor_parcela ? formatMoneyBR(dadosExtraidos.valor_parcela) : '-'}</p>
                  <p className="mt-1 text-xs text-dark-muted">Parcelamento: {dadosExtraidos.parcelamento ? `${dadosExtraidos.parcelamento}x` : '-'}</p>
                  <p className="mt-1 text-xs text-dark-muted">Premio liquido: {dadosExtraidos.premio_liquido ? formatMoneyBR(dadosExtraidos.premio_liquido) : '-'}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-7 py-5 border-t border-dark-border">
          <button onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={criarUploadDireto} disabled={!pdfFile || !dadosExtraidos || !imobiliaria || !celular.trim() || extraindo || criando} className="btn-primary text-sm">
            {criando ? 'Criando...' : 'Criar Apolice'}
          </button>

        </div>
      </div>
    </div>
  )
}

export default function ApoicesGestao() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const { grupos, resolverNome, getAliases } = useImobiliaria()

  const [apolices, setApolices] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('total')
  const [imobFiltro, setImobFiltro] = useState('')
  const [workspace, setWorkspace] = useState('kanban')
  const [modalUploadDireto, setModalUploadDireto] = useState(false)
  const [activeId, setActiveId] = useState(null)

  const scrollRef = useRef(null)
  const [canScrollL, setCanScrollL] = useState(false)
  const [canScrollR, setCanScrollR] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dateFrom, dateTo] = getPeriodDates(filtro)
      let imobiliarias
      if (imobFiltro) {
        const aliases = await getAliases(imobFiltro)
        imobiliarias = aliases.length ? aliases : [imobFiltro]
      }
      const data = await fetchApolicesKanban({ dateFrom, dateTo, imobiliarias })
      setApolices(data || [])
    } catch {
      setApolices([])
      toast({ type: 'error', title: 'Erro ao carregar apólices' })
    } finally {
      setLoading(false)
    }
  }, [filtro, getAliases, imobFiltro, toast])

  useEffect(() => {
    load()
  }, [load])

  const groups = useMemo(() => {
    const initial = Object.fromEntries(COLUNAS.map(col => [col.id, []]))
    for (const apolice of apolices) {
      if (initial[apolice.status_emissao]) initial[apolice.status_emissao].push(apolice)
    }
    return initial
  }, [apolices])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const updateScrollState = () => {
      setCanScrollL(el.scrollLeft > 5)
      setCanScrollR(el.scrollLeft < el.scrollWidth - el.clientWidth - 5)
    }

    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const resizeObserver = new ResizeObserver(updateScrollState)
    resizeObserver.observe(el)

    return () => {
      el.removeEventListener('scroll', updateScrollState)
      resizeObserver.disconnect()
    }
  }, [loading, apolices.length])

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return

    const id = active.id
    const novoStatus = over.id
    const apolice = apolices.find(item => item.id === id)

    if (!apolice || !COLUNAS.some(col => col.id === novoStatus) || apolice.status_emissao === novoStatus) {
      return
    }

    setApolices(prev => prev.map(item => (
      item.id === id ? { ...item, status_emissao: novoStatus } : item
    )))

    const error = await moverStatusApolice(id, novoStatus)
    if (error) {
      toast({ type: 'error', title: 'Erro ao mover apólice' })
      load()
    }
  }

  function handleCriado(novaApolice) {
    if (!novaApolice?.id) {
      load()
      return
    }

    setApolices(prev => {
      const semDuplicata = prev.filter(item => item.id !== novaApolice.id)
      return [{ ...novaApolice, status_emissao: novaApolice.status_emissao || 'recebida' }, ...semDuplicata]
    })
  }

  const activeCard = activeId ? apolices.find(item => item.id === activeId) : null

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="title-page text-dark-text">Gestão de Apólices</h1>
          <p className="text-xs text-dark-muted mt-0.5">Arraste as apólices entre as colunas para atualizar o status</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-dark-surface2 border border-dark-border rounded-lg p-0.5">
          {['total', 'hoje', 'semana', 'mes'].map(item => (
            <button
              key={item}
              onClick={() => setFiltro(item)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filtro === item ? 'bg-brand-secondary text-white shadow-sm' : 'text-dark-muted hover:text-dark-text'
              }`}
            >
              {item === 'total' ? 'Todos' : item === 'hoje' ? 'Hoje' : item === 'semana' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={imobFiltro}
            onChange={event => setImobFiltro(event.target.value)}
            className="select text-sm py-1.5"
            style={{ minWidth: '220px' }}
          >
            <option value="">Todas as imobiliárias</option>
            {grupos.map(grupo => (
              <option key={grupo.id} value={grupo.nome_canonico}>{grupo.nome_canonico}</option>
            ))}
          </select>

          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dark-border text-xs text-dark-muted hover:text-dark-text transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>

          <button
            onClick={() => setWorkspace(prev => (prev === 'iniciar' ? 'kanban' : 'iniciar'))}
            className={`flex items-center gap-2 text-sm ${workspace === 'iniciar' ? 'btn-secondary' : 'btn-primary'}`}
          >
            <Plus className="w-4 h-4" />
            {workspace === 'iniciar' ? 'Fechar emissão' : 'Iniciar Emissão'}
          </button>
          <button
            onClick={() => setModalUploadDireto(prev => !prev)}
            className={`flex items-center gap-2 text-sm ${modalUploadDireto ? 'btn-secondary' : 'btn-primary'}`}
          >
            <Upload className="w-4 h-4" />
            {modalUploadDireto ? 'Fechar upload direto' : 'Upload direto da apolice'}
          </button>
        </div>
      </div>

      {workspace === 'iniciar' && (
        <IniciarEmissaoWorkspace
          onBack={() => setWorkspace('kanban')}
          onCriado={handleCriado}
          toast={toast}
          grupos={grupos}
          getAliases={getAliases}
          user={user}
        />
      )}

      {modalUploadDireto && (
        <ModalUploadDireto
          onClose={() => setModalUploadDireto(false)}
          onCriado={handleCriado}
          toast={toast}
          grupos={grupos}
          user={user}
        />
      )}

      {workspace === 'iniciar' ? null : loading ? (
        <KanbanSkeleton />
      ) : (
        <div className="relative">
          {canScrollL && (
            <>
              <div className="absolute left-0 top-0 bottom-4 w-16 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, rgb(var(--color-bg)), transparent)' }} />
              <button
                onClick={() => scrollRef.current?.scrollBy({ left: -280, behavior: 'smooth' })}
                className="absolute left-0.5 top-[60px] z-20 w-7 h-7 rounded-full bg-dark-surface border border-dark-border shadow-md flex items-center justify-center text-dark-muted hover:text-dark-text transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}

          {canScrollR && (
            <>
              <div className="absolute right-0 top-0 bottom-4 w-16 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, rgb(var(--color-bg)), transparent)' }} />
              <button
                onClick={() => scrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' })}
                className="absolute right-0.5 top-[60px] z-20 w-7 h-7 rounded-full bg-dark-surface border border-dark-border shadow-md flex items-center justify-center text-dark-muted hover:text-dark-text transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          <div ref={scrollRef} className="kanban-scroll overflow-x-auto pb-4">
            <DndContext
              sensors={sensors}
              onDragStart={({ active }) => setActiveId(active.id)}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <div className="flex gap-3 min-w-max px-1">
                {COLUNAS.map(col => (
                  <DroppableColumn
                    key={col.id}
                    col={col}
                    apolices={groups[col.id] || []}
                    resolverNome={resolverNome}
                    onOpen={id => navigate(`/apolices/${id}`)}
                  />
                ))}
              </div>

              <DragOverlay dropAnimation={null}>
                {activeCard ? (
                  <div style={{ width: 'var(--kanban-col-w, 286px)', pointerEvents: 'none' }}>
                    <KanbanCard apolice={activeCard} resolverNome={resolverNome} isDragOverlay />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      )}
    </div>
  )
}



