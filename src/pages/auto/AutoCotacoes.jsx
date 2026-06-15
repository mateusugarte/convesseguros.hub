import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getCotacoesAuto,
  criarCotacaoAuto,
  criarClienteAuto,
  buscarClientePorCpf,
  atualizarStatusRenovacao,
} from '../../lib/auto'

// ── Formulário seguro novo ────────────────────────────────────
const NOVO_VAZIO = {
  nome_completo: '', cpf: '', telefone: '', estado_civil: '', profissao: '',
  condutor_nome: '', condutor_cpf: '',
  cep_pernoite: '', uso_veiculo: '',
  garagem_residencia: '', garagem_trabalho: '', garagem_estudo: '',
  jovens_18_26: '', modelo_veiculo: '', placa: '',
  veiculo_financiado: '', possui_kit_gas: '', possui_blindagem: '', isento_imposto: '',
  origem_lead: '',
}

// ── Formulário renovação ──────────────────────────────────────
const SEG_VAZIO = { nome: '', premio_total: '', premio_liquido: '', pct_comissao: '' }
const REN_VAZIO = { cpf: '', seguradora_preferencial: { ...SEG_VAZIO }, seguradora_mais_barata: { ...SEG_VAZIO } }

function calcComissao(seg) {
  const pl  = parseFloat(seg.premio_liquido) || 0
  const pct = parseFloat(seg.pct_comissao)   || 0
  return (pl * pct).toFixed(2)
}

function CampoTexto({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700"
      />
    </div>
  )
}

function MetricaCard({ valor, label }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
      <p className="text-2xl font-bold">{valor}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

export default function AutoCotacoes() {
  const [aba, setAba]         = useState('novo')
  const [formNovo, setFormNovo] = useState(NOVO_VAZIO)
  const [formRen, setFormRen]   = useState(REN_VAZIO)
  const qc = useQueryClient()

  const { data: cotacoes = [] } = useQuery({
    queryKey: ['auto-cotacoes', aba],
    queryFn: () => getCotacoesAuto({ tipo: aba }),
  })

  // ── Métricas do mês ──────────────────────────────────────────
  const hoje = new Date()
  const cotacoesMes = cotacoes.filter(c => {
    const d = new Date(c.created_at)
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()
  })
  const convertidas = cotacoesMes.filter(c => c.status === 'convertida').length
  const taxa = cotacoesMes.length ? Math.round((convertidas / cotacoesMes.length) * 100) : 0

  // ── Mutação: seguro novo ──────────────────────────────────────
  const { mutate: salvarNovo, isPending: salvandoNovo } = useMutation({
    mutationFn: async dados => {
      let cliente = await buscarClientePorCpf(dados.cpf)
      if (!cliente) {
        cliente = await criarClienteAuto({
          nome_completo: dados.nome_completo,
          cpf:           dados.cpf,
          telefone:      dados.telefone,
          estado_civil:  dados.estado_civil,
          profissao:     dados.profissao,
        })
      }
      const { nome_completo, cpf, telefone, estado_civil, profissao, ...resto } = dados
      return criarCotacaoAuto({ ...resto, cliente_id: cliente.id, tipo: 'novo' })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-cotacoes'] })
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      setFormNovo(NOVO_VAZIO)
    },
  })

  // ── Mutação: renovação ────────────────────────────────────────
  const { mutate: salvarRenovacao, isPending: salvandoRen } = useMutation({
    mutationFn: async dados => {
      const cliente = await buscarClientePorCpf(dados.cpf)
      const prefComissao = calcComissao(dados.seguradora_preferencial)
      const baratComissao = calcComissao(dados.seguradora_mais_barata)
      return criarCotacaoAuto({
        cliente_id: cliente?.id ?? null,
        tipo: 'renovacao',
        seguradora_preferencial: { ...dados.seguradora_preferencial, valor_comissao: prefComissao },
        seguradora_mais_barata:  { ...dados.seguradora_mais_barata,  valor_comissao: baratComissao },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auto-cotacoes'] })
      qc.invalidateQueries({ queryKey: ['auto-emissoes'] })
      qc.invalidateQueries({ queryKey: ['auto-renovacoes'] })
      setFormRen(REN_VAZIO)
    },
  })

  function setNovo(campo, valor) {
    setFormNovo(f => ({ ...f, [campo]: valor }))
  }

  function setSeg(qual, campo, valor) {
    setFormRen(f => ({ ...f, [qual]: { ...f[qual], [campo]: valor } }))
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Cotações Auto</h1>

      {/* Abas */}
      <div className="flex gap-2">
        {[
          { value: 'novo',      label: 'Seguro Novo' },
          { value: 'renovacao', label: 'Renovação' },
        ].map(t => (
          <button
            key={t.value}
            onClick={() => setAba(t.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              aba === t.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4">
        <MetricaCard valor={cotacoesMes.length} label={aba === 'novo' ? 'Cotações no mês' : 'Renovações cotadas'} />
        <MetricaCard valor={convertidas}         label={aba === 'novo' ? 'Convertidas'    : 'Convertidas'} />
        <MetricaCard valor={`${taxa}%`}          label="Taxa de conversão" />
      </div>

      {/* Formulário seguro novo */}
      {aba === 'novo' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Novo Orçamento</h2>

          <div className="grid grid-cols-2 gap-4">
            <CampoTexto label="Nome completo (segurado)"         value={formNovo.nome_completo}   onChange={v => setNovo('nome_completo', v)} />
            <CampoTexto label="CPF (segurado)"                   value={formNovo.cpf}             onChange={v => setNovo('cpf', v)} />
            <CampoTexto label="Telefone"                         value={formNovo.telefone}        onChange={v => setNovo('telefone', v)} />
            <CampoTexto label="Estado civil"                     value={formNovo.estado_civil}    onChange={v => setNovo('estado_civil', v)} />
            <CampoTexto label="Profissão"                        value={formNovo.profissao}       onChange={v => setNovo('profissao', v)} />
            <CampoTexto label="Nome do condutor principal"       value={formNovo.condutor_nome}   onChange={v => setNovo('condutor_nome', v)} />
            <CampoTexto label="CPF do condutor"                  value={formNovo.condutor_cpf}    onChange={v => setNovo('condutor_cpf', v)} />
            <CampoTexto label="CEP de pernoite"                  value={formNovo.cep_pernoite}    onChange={v => setNovo('cep_pernoite', v)} />
            <CampoTexto label="Uso do veículo"                   value={formNovo.uso_veiculo}     onChange={v => setNovo('uso_veiculo', v)} />
            <CampoTexto label="Modelo do veículo (marca/ano)"    value={formNovo.modelo_veiculo}  onChange={v => setNovo('modelo_veiculo', v)} />
            <CampoTexto label="Placa (deixe vazio se 0km)"       value={formNovo.placa}           onChange={v => setNovo('placa', v)} placeholder="Opcional" />
            <CampoTexto label="Garagem na residência"            value={formNovo.garagem_residencia} onChange={v => setNovo('garagem_residencia', v)} />
            <CampoTexto label="Garagem no trabalho"              value={formNovo.garagem_trabalho}   onChange={v => setNovo('garagem_trabalho', v)} />
            <CampoTexto label="Garagem no estudo"                value={formNovo.garagem_estudo}     onChange={v => setNovo('garagem_estudo', v)} />
            <CampoTexto label="Jovens 18-26 que usam o veículo"  value={formNovo.jovens_18_26}       onChange={v => setNovo('jovens_18_26', v)} />
            <CampoTexto label="Veículo financiado"               value={formNovo.veiculo_financiado} onChange={v => setNovo('veiculo_financiado', v)} />
            <CampoTexto label="Possui kit gás"                   value={formNovo.possui_kit_gas}     onChange={v => setNovo('possui_kit_gas', v)} />
            <CampoTexto label="Possui blindagem"                 value={formNovo.possui_blindagem}   onChange={v => setNovo('possui_blindagem', v)} />
            <CampoTexto label="É isento de imposto"              value={formNovo.isento_imposto}     onChange={v => setNovo('isento_imposto', v)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Origem do lead</label>
            <select
              value={formNovo.origem_lead}
              onChange={e => setNovo('origem_lead', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Selecionar</option>
              <option value="indicacao">Indicação</option>
              <option value="prospeccao">Prospecção</option>
              <option value="carteira">Carteira</option>
            </select>
          </div>

          <button
            onClick={() => salvarNovo(formNovo)}
            disabled={salvandoNovo || !formNovo.cpf}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
          >
            {salvandoNovo ? 'Salvando...' : 'Salvar cotação'}
          </button>
        </div>
      )}

      {/* Formulário renovação */}
      {aba === 'renovacao' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold">Cotação de Renovação</h2>

          <CampoTexto
            label="CPF do cliente"
            value={formRen.cpf}
            onChange={v => setFormRen(f => ({ ...f, cpf: v }))}
          />

          {[
            { key: 'seguradora_preferencial', titulo: 'Seguradora Preferencial' },
            { key: 'seguradora_mais_barata',  titulo: 'Seguradora Mais Barata' },
          ].map(({ key, titulo }) => (
            <div key={key} className="border border-gray-200 dark:border-gray-600 rounded-xl p-4 space-y-3">
              <h3 className="font-medium text-sm">{titulo}</h3>
              <div className="grid grid-cols-2 gap-3">
                <CampoTexto label="Nome"          value={formRen[key].nome}          onChange={v => setSeg(key, 'nome', v)} />
                <CampoTexto label="Prêmio total"  value={formRen[key].premio_total}  onChange={v => setSeg(key, 'premio_total', v)}  type="number" />
                <CampoTexto label="Prêmio líquido" value={formRen[key].premio_liquido} onChange={v => setSeg(key, 'premio_liquido', v)} type="number" />
                <CampoTexto label="% Comissão (0.15)" value={formRen[key].pct_comissao} onChange={v => setSeg(key, 'pct_comissao', v)} type="number" />
              </div>
              {formRen[key].premio_liquido && formRen[key].pct_comissao && (
                <p className="text-sm font-medium text-green-700 bg-green-50 rounded-lg px-3 py-2">
                  Comissão: R$ {calcComissao(formRen[key])}
                </p>
              )}
            </div>
          ))}

          <button
            onClick={() => salvarRenovacao(formRen)}
            disabled={salvandoRen || !formRen.cpf}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
          >
            {salvandoRen ? 'Salvando...' : 'Salvar cotação'}
          </button>
        </div>
      )}

      {/* Lista de cotações */}
      {cotacoes.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">Histórico</h2>
          {cotacoes.slice(0, 20).map(c => (
            <div key={c.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{c.clientes_auto?.nome_completo ?? '—'}</p>
                <p className="text-xs text-gray-500">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                c.status === 'convertida' ? 'bg-green-100 text-green-700'
                : c.status === 'perdida'  ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600'
              }`}>
                {c.status === 'convertida' ? 'Convertida' : c.status === 'perdida' ? 'Perdida' : 'Aberta'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
