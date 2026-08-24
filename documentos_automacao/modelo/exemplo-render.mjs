import { montarComparativo, criarCotacaoOrcamento } from '/Users/macm1/Documents/ConvesSystem/src/lib/orcamentoComparativo.js'
import { montarHtmlOrcamento } from '/Users/macm1/Documents/ConvesSystem/src/lib/orcamentoComparativoHtml.js'
import fs from 'node:fs'

const SP = '/private/tmp/claude-501/-Users-macm1-Documents-ConvesSystem/5123e897-cb86-40b1-a871-cf98e680a8a8/scratchpad'
const dataUri = p => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64')

// Tokio Marine — dados exatamente como no mockup validado
const tokio = criarCotacaoOrcamento()
tokio.seguradora = { id:'t', nome:'Tokio Marine', logo_url: dataUri(`${SP}/imgs/logo_473x175.png`), cor_destaque:'' }
tokio.cotacao = { numero:'1056418301', tipo_operacao:'renovacao', validade:'2026-08-29', data_emissao:'2026-08-24' }
tokio.segurado = { nome:'Priscila Cunha dos Santos', cpf_cnpj:'', data_nascimento:null }
tokio.condutor_principal = { nome:'Aguinosvan A. dos Santos', cpf:'', estado_civil:null }
tokio.veiculo = { marca_modelo:'Ford EcoSport SE 1.5 12V Flex Aut.', ano_modelo:'2018/2018', placa:'GAO-1151',
                  uso:'Particular, sem fim comercial', cep_pernoite:'04849-015', condutor_18_25:'Sem cobertura' }
tokio.valores = { premio_liquido:null, iof:null, premio_total:4660.70,
  premio_parcelado:['Em até 12x sem juros no cartão (R$ 388,29)','Em até 6x sem juros no débito / Pix automático','Antecipando até 31/08, à vista sai por R$ 4.427,72'],
  descontos_aplicados:[], franquia:3373.00, franquia_tipo:'Parcial reduzida a 50%' }
tokio.indenizacao_integral = { incluida:false, percentual_fipe:null, observacao:'' }
tokio.coberturas = [
  { nome_padronizado:'Colisão, incêndio, roubo e furto', categoria:'colisao', incluida:true, observacoes:'Indenização por Valor Referenciado — 100% da tabela FIPE.' },
  { nome_padronizado:'Danos a terceiros', categoria:'terceiros', incluida:true, observacoes:'R$ 150.000 danos materiais + R$ 150.000 danos corporais + R$ 5.000 danos morais.' },
  { nome_padronizado:'Assistência 24 horas', categoria:'assistencia', incluida:true, observacoes:'Completa, com guincho — reboque de até 500 km por acionamento (200 km padrão + 300 km adicionais).' },
  { nome_padronizado:'Carro reserva', categoria:'carro_reserva', incluida:true, observacoes:'7 diárias, categoria básica (mecânico).' },
  { nome_padronizado:'Vidros', categoria:'vidros', incluida:true, observacoes:'Cobertura completa — franquia por peça (para-brisa R$ 365, retrovisor R$ 380, lateral R$ 145, entre outras).' },
]
tokio.valores.franquia_tipo = 'Parcial reduzida a 50%'
tokio.nao_incluso = [
  { titulo:'Acidentes Pessoais de Passageiros', detalhe:'Morte, invalidez e despesas médicas não contratadas.' },
  { titulo:'Martelinho, lataria/pintura e roda/pneu/suspensão', detalhe:'Não possui.' },
  { titulo:'Kit gás, blindagem e extensão de garantia 0km', detalhe:'Não contratados.' },
]
tokio.condicoes_gerais = { referencia:'Tokio Marine Auto', anexada_em:'2026-08-18' }

// Porto Seguro
const porto = criarCotacaoOrcamento()
porto.seguradora = { id:'p', nome:'Porto Seguro', logo_url: dataUri(`${SP}/imgs/logo_750x210.png`), cor_destaque:'' }
porto.cotacao = { numero:'6049092707-0-4', tipo_operacao:'renovacao', validade:'2026-08-29', data_emissao:'2026-08-24' }
porto.segurado = { ...tokio.segurado }
porto.condutor_principal = { nome:'José Antônio dos Santos', cpf:'', estado_civil:null }
porto.veiculo = { ...tokio.veiculo, uso:'Particular', condutor_18_25:'Não informado' }
porto.valores = { premio_liquido:null, iof:null, premio_total:5970.31,
  premio_parcelado:['Em até 12x sem juros no cartão Porto Bank (ex.: 12x R$ 497,53)','1x à vista R$ 5.671,77 (5% de desconto, sem juros)'],
  descontos_aplicados:[], franquia:3235.00, franquia_tipo:'50% da obrigatória' }
porto.indenizacao_integral = { incluida:true, percentual_fipe:100, observacao:'' }
porto.coberturas = [
  { nome_padronizado:'Colisão, incêndio, roubo e furto', categoria:'colisao', incluida:true, observacoes:'Cobertura Compreensiva (Valor de Mercado Referenciado).' },
  { nome_padronizado:'Danos a terceiros', categoria:'terceiros', incluida:true, observacoes:'R$ 150.000 danos materiais + R$ 150.000 danos corporais + R$ 20.000 custas de defesa + R$ 5.000 danos morais.' },
  { nome_padronizado:'Assistência 24 horas', categoria:'assistencia', incluida:true, observacoes:'Km ilimitado + serviços à residência — guincho limitado a 5x no intervalo de 1 ano (Condições Gerais CG144).' },
  { nome_padronizado:'Carro reserva', categoria:'carro_reserva', incluida:true, observacoes:'7 diárias, porte básico.' },
  { nome_padronizado:'Vidros', categoria:'vidros', incluida:true, observacoes:'Vidros, retrovisores, lanternas e faróis — franquia por peça (para-brisa R$ 330, retrovisor R$ 585, lateral R$ 135, entre outras).' },
  { nome_padronizado:'Benefícios adicionais', categoria:'adicional', incluida:true, observacoes:'Leva-e-traz em sinistro, 20% de desconto na franquia casco, troca de lâmpadas e reparo de furo de pneu na rede própria, entre outros.' },
]
porto.nao_incluso = [
  { titulo:'Acidentes Pessoais de Passageiros', detalhe:'Não contratados nesta cotação.' },
  { titulo:'Blindagem', detalhe:'Não contratada.' },
]
porto.condicoes_gerais = { referencia:'Porto Seguro Auto Sênior CG144', anexada_em:'2026-08-17' }

const comp = montarComparativo({ atual:tokio, outra:porto, referencia:'CV-2026-0817', emitidoEm:'2026-08-24' })
console.log('podeGerar:', comp.validacao.podeGerar)
console.log('bloqueios:', JSON.stringify([...comp.validacao.atual.bloqueios, ...comp.validacao.outra.bloqueios]))
console.log('divergencias:', comp.divergencias.length)

const html = montarHtmlOrcamento(comp, { logoConves: dataUri('/Users/macm1/Documents/ConvesSystem/public/conves-logo.png') })
fs.writeFileSync(`${SP}/orcamento.html`, html)
console.log('html:', html.length, 'bytes')
