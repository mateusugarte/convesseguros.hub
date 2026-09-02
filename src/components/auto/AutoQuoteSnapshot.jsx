import {
  CalendarDays,
  Car,
  CircleDollarSign,
  Contact,
  MapPinHouse,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { formatDateBR, formatMoney } from '../../pages/auto/autoShared'
import { valorFormularioAuto } from '../../lib/autoFormPayload'

function first(...values) {
  return values.find(value => value !== null && value !== undefined && value !== '') ?? ''
}

function yesNo(value) {
  if (value === null || value === undefined || value === '') return 'Não informado'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  const normalized = String(value).trim().toLowerCase()
  if (['sim', 's', 'true', '1'].includes(normalized)) return 'Sim'
  if (['nao', 'não', 'n', 'false', '0'].includes(normalized)) return 'Não'
  return String(value)
}

function date(value) {
  return value ? formatDateBR(value) : 'Não informado'
}

function SnapshotValue({ label, value, mono = false, highlight = false }) {
  return (
    <div className={`auto-snapshot-value ${highlight ? 'is-highlight' : ''}`}>
      <span>{label}</span>
      <strong className={mono ? 'is-mono' : ''}>{value === null || value === undefined || value === '' ? 'Não informado' : value}</strong>
    </div>
  )
}

function Section({ icon: Icon, title, subtitle, children, className = '' }) {
  return (
    <section className={`auto-snapshot-section ${className}`}>
      <header><span><Icon /></span><div><strong>{title}</strong><small>{subtitle}</small></div></header>
      <div className="auto-snapshot-grid">{children}</div>
    </section>
  )
}

export default function AutoQuoteSnapshot({ quote = {}, emission = {}, policy = {}, showFinancial = true }) {
  const current = quote.seguradora_preferencial || {}
  const alternative = quote.seguradora_mais_barata || {}
  const client = quote.clientes_auto || emission.clientes_auto || policy.clientes_auto || {}
  const commission = first(emission.valor_comissao, policy.valor_comissao)
  const premium = first(emission.premio_liquido, policy.premio_liquido, current.premio_liquido)
  const tipoResidencia = first(quote.tipo_residencia, valorFormularioAuto(quote, 'tipo_residencia'))
  const passagemLeilao = first(quote.passagem_leilao, valorFormularioAuto(quote, 'passagem_leilao'))

  return (
    <div className="auto-quote-snapshot">
      <Section icon={UserRound} title="Segurado e contato" subtitle="Identidade associada a esta cotação">
        <SnapshotValue label="Nome do segurado" value={first(client.nome_completo, quote.nome_cliente, emission.nome_cliente, policy.nome_cliente)} highlight />
        <SnapshotValue label="CPF / CNPJ" value={first(client.cpf, quote.cpf_cliente, emission.cpf_cliente, policy.cpf_cliente)} mono />
        <SnapshotValue label="Celular" value={first(client.celular, client.telefone, quote.celular_cliente, emission.celular_cliente, policy.celular_cliente)} />
        <SnapshotValue label="E-mail" value={first(client.email, quote.email_cliente)} />
        <SnapshotValue label="Estado civil" value={first(client.estado_civil, quote.estado_civil_cliente)} />
        <SnapshotValue label="Profissão" value={first(client.profissao, quote.profissao_cliente)} />
      </Section>

      <Section icon={Car} title="Veículo e utilização" subtitle="Risco específico deste momento">
        <SnapshotValue label="Marca / modelo" value={first(emission.modelo_veiculo, policy.modelo_veiculo, quote.modelo_veiculo)} highlight />
        <SnapshotValue label="Placa" value={first(emission.placa, policy.placa, quote.placa)} mono />
        <SnapshotValue label="Uso do veículo" value={quote.uso_veiculo} />
        <SnapshotValue label="Tipo de residência" value={tipoResidencia} />
        <SnapshotValue label="Passagem por leilão" value={yesNo(passagemLeilao)} />
        <SnapshotValue label="Financiado / alienado" value={yesNo(quote.veiculo_financiado)} />
        <SnapshotValue label="Kit gás" value={yesNo(quote.possui_kit_gas)} />
        <SnapshotValue label="Blindagem" value={yesNo(quote.possui_blindagem)} />
        <SnapshotValue label="Isenção de imposto" value={yesNo(quote.isento_imposto)} />
      </Section>

      <Section icon={Contact} title="Condutor principal" subtitle="Perfil considerado na análise">
        <SnapshotValue label="Nome" value={first(emission.condutor_nome, policy.condutor_nome, quote.condutor_nome, quote.nome_cliente)} highlight />
        <SnapshotValue label="CPF" value={first(emission.condutor_cpf, policy.condutor_cpf, quote.condutor_cpf)} mono />
        <SnapshotValue label="Estado civil" value={quote.estado_civil_condutor} />
        <SnapshotValue label="Condutor de 18 a 26 anos" value={yesNo(quote.jovens_18_26)} />
      </Section>

      <Section icon={MapPinHouse} title="Local e proteção" subtitle="Informações complementares do risco">
        <SnapshotValue label="CEP de pernoite" value={quote.cep_pernoite} mono />
        <SnapshotValue label="Garagem na residência" value={yesNo(quote.garagem_residencia)} />
        <SnapshotValue label="Garagem no trabalho" value={yesNo(quote.garagem_trabalho)} />
        <SnapshotValue label="Garagem no local de estudo" value={yesNo(quote.garagem_estudo)} />
      </Section>

      <Section icon={CalendarDays} title="Vigência e origem" subtitle="Datas e contexto da oportunidade">
        <SnapshotValue label="Início da vigência" value={date(first(emission.vigencia_inicio, policy.vigencia_inicio, quote.vigencia_inicio))} />
        <SnapshotValue label="Fim da vigência" value={date(first(emission.vigencia_fim, policy.vigencia_fim, quote.vigencia_fim))} />
        <SnapshotValue label="Origem do lead" value={quote.origem_lead} />
        <SnapshotValue label="Tipo de operação" value={quote.tipo === 'renovacao' ? 'Renovação' : quote.tipo === 'endosso' ? 'Endosso' : 'Seguro novo'} highlight />
      </Section>

      <Section icon={ShieldCheck} title="Opções cotadas" subtitle="Seguradoras registradas nesta oportunidade">
        <SnapshotValue label="Seguradora atual / preferencial" value={current.nome} highlight />
        <SnapshotValue label="Outra / mais econômica" value={alternative.nome} highlight />
        <SnapshotValue label="Total - atual" value={current.premio_total ? formatMoney(current.premio_total) : ''} />
        <SnapshotValue label="Total - outra" value={alternative.premio_total ? formatMoney(alternative.premio_total) : ''} />
      </Section>

      {showFinancial && (
        <Section icon={CircleDollarSign} title="Financeiro e emissão" subtitle="Valores disponíveis no estágio atual" className="is-financial">
          <SnapshotValue label="Prêmio líquido" value={premium ? formatMoney(premium) : ''} highlight />
          <SnapshotValue label="Comissão" value={commission ? formatMoney(commission) : ''} />
          <SnapshotValue label="Parcelamento" value={first(emission.parcelamento, policy.parcelamento, current.parcelamentos)} />
          <SnapshotValue label="Forma de pagamento" value={first(emission.forma_pagamento, policy.forma_pagamento, current.forma_pagamento)} />
          <SnapshotValue label="Seguradora emitida" value={first(emission.seguradora, policy.seguradora)} />
          <SnapshotValue label="Número da apólice" value={first(emission.numero_apolice, policy.numero_apolice)} mono />
        </Section>
      )}
    </div>
  )
}
