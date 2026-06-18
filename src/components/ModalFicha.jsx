import { useState, useEffect } from 'react'
import {
  criarFicha, editarFicha, fetchProfiles,
  STATUS_LABELS, PRODUTO_LABELS,
} from '../lib/fichas'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Plus, Save } from 'lucide-react'
import SeguradoraSelect from './SeguradoraSelect'
import ImobiliariaSelect from './ImobiliariaSelect'
import { Select } from './ui/Select'


const STATUS_OPTIONS  = ['pendente','em_cotacao','em_analise','aprovado','recusado','emitido','cancelado','cpf_invalido','expirada']
const PRODUTO_OPTIONS = ['residencial_pf','comercial_pf','pessoa_juridica']

// ── Masks ─────────────────────────────────────────────────────────────────────

function maskCPF(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

function maskCNPJ(v) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

function maskPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

// ── Validation ────────────────────────────────────────────────────────────────

function validarFicha(form) {
  const isPJ = form.produto === 'pessoa_juridica'
  if (isPJ) {
    if (!form.nome_empresa?.trim()) return 'Nome da empresa é obrigatório'
    if (form.cnpj && !/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(form.cnpj))
      return 'CNPJ inválido — formato: 00.000.000/0001-00'
  } else {
    if (!form.nome_interessado?.trim()) return 'Nome do interessado é obrigatório'
    if (form.cpf && !/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(form.cpf))
      return 'CPF inválido — formato esperado: 000.000.000-00'
  }
  if (!form.produto) return 'Produto é obrigatório'
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    return 'E-mail inválido'
  if (form.pct_comissao === '' || form.pct_comissao === null || form.pct_comissao === undefined)
    return 'Percentual de comissão é obrigatório'
  if (form.pct_desconto === '' || form.pct_desconto === null || form.pct_desconto === undefined)
    return 'Percentual de desconto é obrigatório'
  if (!String(form.parcelamento || '').trim())
    return 'Parcelamento é obrigatório'
  return null
}

// ── Field wrappers ────────────────────────────────────────────────────────────

function Field({ label, children, span2 = false, required = false }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <label className="eyebrow text-dark-muted block mb-1.5">
        {label}{required && <span className="text-status-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function Sec({ title, children }) {
  return (
    <div>
      <p className="eyebrow text-dark-muted mb-3 pb-2 border-b border-dark-border/30">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ModalFicha({ ficha, onClose, onSuccess }) {
  const { user } = useAuth()
  const isEdit   = !!ficha

  const [form, setForm] = useState({
    produto:            ficha?.produto            ?? 'residencial_pf',
    nome_interessado:   ficha?.nome_interessado   ?? '',
    nome_empresa:       ficha?.nome_empresa       ?? '',
    cpf:                ficha?.cpf                ?? '',
    cnpj:               ficha?.cnpj               ?? '',
    cpf_socios:         ficha?.cpf_socios         ?? '',
    celular:            ficha?.celular            ?? '',
    email:              ficha?.email              ?? '',
    cep:                ficha?.cep                ?? '',
    imobiliaria:        ficha?.imobiliaria        ?? '',
    tipo_imovel:        ficha?.tipo_imovel        ?? '',
    valor_aluguel:      ficha?.valor_aluguel      ?? '',
    valor_iptu:         ficha?.valor_iptu         ?? '',
    valor_condominio:   ficha?.valor_condominio   ?? '',
    observacoes:        ficha?.observacoes        ?? '',
    atividade:          ficha?.atividade          ?? '',
    opcao_tributaria:   ficha?.opcao_tributaria   ?? '',
    total_rendimentos:  ficha?.total_rendimentos  ?? '',
    capital_social:     ficha?.capital_social     ?? '',
    motivo_locacao:     ficha?.motivo_locacao     ?? '',
    vigencia:           ficha?.vigencia           ?? '',
    pct_comissao:       ficha?.pct_comissao       ?? '',
    pct_desconto:       ficha?.pct_desconto       ?? '',
    parcelamento:       ficha?.parcelamento       ?? '',
    status:             ficha?.status             ?? 'pendente',
    seguradora:         ficha?.seguradora         ?? '',
    orcamentista_forms: ficha?.orcamentista_forms ?? '',
    retorno_enviado:    ficha?.retorno_enviado     ?? false,
  })

  const [saving,   setSaving] = useState(false)
  const [error,    setError]  = useState(null)
  const [profiles, setProfiles] = useState([])

  // Resetar form quando a ficha muda (abre ficha diferente sem desmontar o modal)
  useEffect(() => {
    setForm({
      produto:            ficha?.produto            ?? 'residencial_pf',
      nome_interessado:   ficha?.nome_interessado   ?? '',
      nome_empresa:       ficha?.nome_empresa       ?? '',
      cpf:                ficha?.cpf                ?? '',
      cnpj:               ficha?.cnpj               ?? '',
      cpf_socios:         ficha?.cpf_socios         ?? '',
      celular:            ficha?.celular            ?? '',
      email:              ficha?.email              ?? '',
      cep:                ficha?.cep                ?? '',
      imobiliaria:        ficha?.imobiliaria        ?? '',
      tipo_imovel:        ficha?.tipo_imovel        ?? '',
      valor_aluguel:      ficha?.valor_aluguel      ?? '',
      valor_iptu:         ficha?.valor_iptu         ?? '',
      valor_condominio:   ficha?.valor_condominio   ?? '',
      observacoes:        ficha?.observacoes        ?? '',
      atividade:          ficha?.atividade          ?? '',
      opcao_tributaria:   ficha?.opcao_tributaria   ?? '',
      total_rendimentos:  ficha?.total_rendimentos  ?? '',
      capital_social:     ficha?.capital_social     ?? '',
      motivo_locacao:     ficha?.motivo_locacao     ?? '',
      vigencia:           ficha?.vigencia           ?? '',
      pct_comissao:       ficha?.pct_comissao       ?? '',
      pct_desconto:       ficha?.pct_desconto       ?? '',
      parcelamento:       ficha?.parcelamento       ?? '',
      status:             ficha?.status             ?? 'pendente',
      seguradora:         ficha?.seguradora         ?? '',
      orcamentista_forms: ficha?.orcamentista_forms ?? '',
      retorno_enviado:    ficha?.retorno_enviado     ?? false,
    })
    setError(null)
  }, [ficha?.id])

  useEffect(() => {
    fetchProfiles().then(setProfiles)
  }, [])

  const set    = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const isPJ   = form.produto === 'pessoa_juridica'
  const isPlus = form.produto === 'comercial_pf' || isPJ

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const erroValidacao = validarFicha(form)
    if (erroValidacao) { setError(erroValidacao); return }

    setSaving(true)

    const dados = {
      ...form,
      valor_aluguel:     form.valor_aluguel     || null,
      valor_iptu:        form.valor_iptu        || null,
      valor_condominio:  form.valor_condominio  || null,
      total_rendimentos: form.total_rendimentos || null,
      capital_social:    form.capital_social    || null,
      // Limpar campo não usado por produto
      cpf:  isPJ ? null : form.cpf || null,
      cnpj: isPJ ? form.cnpj || null : null,
      nome_interessado: isPJ ? null : form.nome_interessado || null,
      nome_empresa:     isPJ ? form.nome_empresa || null : null,
      cpf_socios:       isPJ ? form.cpf_socios || null : null,
      pct_comissao:     form.pct_comissao === '' ? null : form.pct_comissao,
      pct_desconto:     form.pct_desconto === '' ? null : form.pct_desconto,
      parcelamento:     form.parcelamento === '' ? null : Number(form.parcelamento),
    }

    const editResult   = isEdit  ? await editarFicha(ficha.id, dados, user?.id) : null
    const createResult = !isEdit ? await criarFicha({ ...dados, orcamentista_id: user?.id || null }) : null
    const err = editResult ?? createResult?.error ?? null

    setSaving(false)
    if (err) { setError(typeof err === 'string' ? err : err.message); return }
    onSuccess()
  }

  return (
    <div className="animate-fade-in">
      <div className="glass-modal rounded-[24px] overflow-hidden">
        {/* Header */}
        <div className="modal-shell-header flex items-center gap-3 px-6 py-4 border-b border-dark-border/60">
          <button onClick={onClose} className="p-1.5 rounded-xl text-dark-muted hover:text-dark-text hover:bg-dark-surface2 transition-all flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-2xl bg-brand-secondary/20 flex items-center justify-center flex-shrink-0">
            {isEdit ? <Save className="w-4 h-4 text-brand-accent" /> : <Plus className="w-4 h-4 text-brand-accent" />}
          </div>
          <h2 className="font-bold text-dark-text">
            {isEdit ? `Editar — ${ficha.nome_empresa || ficha.nome_interessado || ''}` : 'Nova Ficha'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="modal-shell-body px-6 py-5 space-y-6">

          {/* ── Identificação ── */}
          <Sec title="Identificação">
            <Field label="Produto">
              <Select
                value={form.produto}
                onChange={v => set('produto', v)}
                options={PRODUTO_OPTIONS.map(p => ({ value: p, label: PRODUTO_LABELS[p] }))}
              />
            </Field>
            <Field label="Imobiliária">
              <ImobiliariaSelect
                value={form.imobiliaria}
                onChange={v => set('imobiliaria', v)}
                placeholder="Selecione ou digite..."
                showAll={false}
              />
            </Field>

            {/* Nome: empresa para PJ, interessado para PF */}
            {isPJ ? (
              <Field label="Nome da Empresa" span2 required>
                <input type="text" value={form.nome_empresa} onChange={e => set('nome_empresa', e.target.value)} className="input" placeholder="Razão social" />
              </Field>
            ) : (
              <Field label="Nome do Interessado" span2 required>
                <input type="text" value={form.nome_interessado} onChange={e => set('nome_interessado', e.target.value)} className="input" placeholder="Nome completo" />
              </Field>
            )}

            {/* CPF para PF, CNPJ + CPF Sócios para PJ */}
            {isPJ ? (
              <>
                <Field label="CNPJ">
                  <input
                    type="text"
                    value={form.cnpj}
                    onChange={e => set('cnpj', maskCNPJ(e.target.value))}
                    placeholder="00.000.000/0001-00"
                    className="input font-mono"
                  />
                </Field>
                <Field label="CPF dos Sócios">
                  <input
                    type="text"
                    value={form.cpf_socios}
                    onChange={e => set('cpf_socios', e.target.value)}
                    placeholder="000.000.000-00, ..."
                    className="input"
                  />
                </Field>
              </>
            ) : (
              <Field label="CPF">
                <input
                  type="text"
                  value={form.cpf}
                  onChange={e => set('cpf', maskCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  className="input font-mono"
                />
              </Field>
            )}
          </Sec>

          {/* ── Contato ── */}
          <Sec title="Contato">
            <Field label="Celular">
              <input
                type="text"
                value={form.celular}
                onChange={e => set('celular', maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                className="input font-mono"
              />
            </Field>
            <Field label="E-mail">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input" />
            </Field>
          </Sec>

          {/* ── Imóvel ── */}
          <Sec title="Dados do Imóvel">
            <Field label="Tipo do Imóvel">
              <input type="text" value={form.tipo_imovel} onChange={e => set('tipo_imovel', e.target.value)} className="input" />
            </Field>
            <Field label="CEP">
              <input type="text" value={form.cep} onChange={e => set('cep', e.target.value)} className="input" />
            </Field>
            <Field label="Aluguel">
              <input type="text" value={form.valor_aluguel} onChange={e => set('valor_aluguel', e.target.value)} className="input" placeholder="Ex: 1500,00" />
            </Field>
            <Field label="IPTU">
              <input type="text" value={form.valor_iptu} onChange={e => set('valor_iptu', e.target.value)} className="input" placeholder="Ex: 200,00" />
            </Field>
            <Field label="Condomínio">
              <input type="text" value={form.valor_condominio} onChange={e => set('valor_condominio', e.target.value)} className="input" placeholder="Ex: 300,00" />
            </Field>
            <Field label="Orçamentista">
              <Select
                value={form.orcamentista_forms}
                onChange={v => set('orcamentista_forms', v)}
                placeholder="Selecionar orçamentista..."
                options={profiles.map(p => ({ value: p.nome, label: p.nome }))}
              />
            </Field>
            <Field label="Observações" span2>
              <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} className="input resize-none" />
            </Field>
          </Sec>

          {/* ── Campos extras — Comercial PF e PJ ── */}
          {isPlus && (
            <Sec title={isPJ ? 'Dados da Empresa' : 'Dados Complementares'}>
              <Field label="Atividade">
                <input type="text" value={form.atividade} onChange={e => set('atividade', e.target.value)} className="input" placeholder="Atividade no imóvel" />
              </Field>
              <Field label="Total de Rendimentos">
                <input type="text" value={form.total_rendimentos} onChange={e => set('total_rendimentos', e.target.value)} className="input" placeholder="Ex: 5000,00" />
              </Field>
              <Field label="Capital Social">
                <input type="text" value={form.capital_social} onChange={e => set('capital_social', e.target.value)} className="input" placeholder="Ex: 10000,00" />
              </Field>
              <Field label="Motivo da Locação">
                <input type="text" value={form.motivo_locacao} onChange={e => set('motivo_locacao', e.target.value)} className="input" />
              </Field>
              <Field label="Vigência">
                <input type="text" value={form.vigencia} onChange={e => set('vigencia', e.target.value)} className="input" placeholder="Ex: 12 meses" />
              </Field>
              {isPJ && (
                <Field label="Opção Tributária">
                  <Select
                    value={form.opcao_tributaria}
                    onChange={v => set('opcao_tributaria', v)}
                    placeholder="Selecionar..."
                    options={['Simples Nacional','Lucro Presumido','Lucro Real','MEI']}
                  />
                </Field>
              )}
            </Sec>
          )}

          <Sec title="Financeiro da Ficha">
            <Field label="% Comissão" required>
              <input
                type="number"
                step="0.01"
                value={form.pct_comissao}
                onChange={e => set('pct_comissao', e.target.value)}
                className="input"
                placeholder="Ex: 10"
              />
            </Field>
            <Field label="% Desconto" required>
              <input
                type="number"
                step="0.01"
                value={form.pct_desconto}
                onChange={e => set('pct_desconto', e.target.value)}
                className="input"
                placeholder="Ex: 5"
              />
            </Field>
            <Field label="Parcelamento" required>
              <input
                type="number"
                step="1"
                min="1"
                value={form.parcelamento}
                onChange={e => set('parcelamento', e.target.value)}
                className="input"
                placeholder="Ex: 12"
              />
            </Field>
          </Sec>

          {/* ── Controle Interno ── */}
          <Sec title="Controle Interno">
            <Field label="Status">
              <Select
                value={form.status}
                onChange={v => set('status', v)}
                options={STATUS_OPTIONS.map(s => ({ value: s, label: STATUS_LABELS[s]?.label ?? s }))}
              />
            </Field>
            <Field label="Seguradora">
              <SeguradoraSelect
                value={form.seguradora || ''}
                onChange={v => set('seguradora', v)}
                produto={form.produto}
              />
            </Field>
            <div className="col-span-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-dark-border bg-dark-surface2 cursor-pointer hover:border-brand-accent/40 transition-colors">
                <input type="checkbox" checked={form.retorno_enviado} onChange={e => set('retorno_enviado', e.target.checked)}
                       className="w-4 h-4 rounded accent-brand-accent" />
                <span className="text-sm text-dark-text">Retorno enviado ao cliente</span>
              </label>
            </div>
          </Sec>

          {error && (
            <p className="text-sm text-status-danger bg-status-danger/10 border border-status-danger/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="modal-shell-footer flex justify-end gap-3 pt-4 border-t border-dark-border/60">
            <button type="button" onClick={onClose} className="btn-secondary min-h-[44px] sm:min-h-0">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 min-h-[44px] sm:min-h-0">
              {isEdit ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Criar Ficha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
