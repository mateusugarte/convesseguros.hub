import test from 'node:test'
import assert from 'node:assert/strict'

import { criarCotacaoOrcamento, montarComparativo } from './orcamentoComparativo.js'
import { montarHtmlOrcamento, escapeHtml } from './orcamentoComparativoHtml.js'

function cotacao(nome, patch = {}) {
  const c = criarCotacaoOrcamento()
  c.seguradora = { id: 'x', nome, logo_url: 'https://cdn/logo.png', cor_destaque: '' }
  c.cotacao = { numero: '123', tipo_operacao: 'renovacao', validade: '2026-08-29', data_emissao: '2026-08-24' }
  c.segurado = { nome: 'Priscila Cunha dos Santos', cpf_cnpj: '', data_nascimento: null }
  c.veiculo = { marca_modelo: 'Ford EcoSport', ano_modelo: '2018/2018', placa: 'GAO-1151', uso: 'Particular', cep_pernoite: '04849-015', condutor_18_25: null }
  c.condutor_principal = { nome: 'Aguinosvan A. dos Santos', cpf: '', estado_civil: null }
  c.valores = { premio_liquido: null, iof: null, premio_total: 4660.7, premio_parcelado: '', descontos_aplicados: [], franquia: 3373, franquia_tipo: 'Parcial' }
  c.indenizacao_integral = { incluida: false, percentual_fipe: null, observacao: '' }
  return Object.assign(c, patch)
}

function html(patchA = {}, patchB = {}, opts = {}) {
  const comp = montarComparativo({
    atual: Object.assign(cotacao('Tokio Marine'), patchA),
    outra: Object.assign(cotacao('Porto Seguro'), patchB),
    referencia: 'CV-2026-0817', emitidoEm: '2026-08-24',
  })
  return montarHtmlOrcamento(comp, opts)
}

test('escapeHtml neutraliza os caracteres perigosos', () => {
  assert.equal(escapeHtml('<script>alert("x")&</script>'),
    '&lt;script&gt;alert(&quot;x&quot;)&amp;&lt;/script&gt;')
  assert.equal(escapeHtml(null), '')
})

test('texto vindo do PDF nao consegue injetar tag no documento', () => {
  // Nome de cobertura e texto livre extraido de PDF de terceiro. Sem escape,
  // um "<" ja quebraria o documento — e no preview dentro do app seria injecao.
  const doc = html({ nao_incluso: [{ titulo: 'Carro reserva', detalhe: '<img src=x onerror=alert(1)> Bell & Ross' }] })
  assert.ok(!doc.includes('<img src=x onerror'))
  assert.ok(doc.includes('&lt;img src=x onerror=alert(1)&gt;'))
  assert.ok(doc.includes('Bell &amp; Ross'))
})

test('documento sai completo e com o cabecalho preenchido', () => {
  const doc = html()
  assert.ok(doc.startsWith('<!doctype html>'))
  assert.ok(doc.trimEnd().endsWith('</html>'))
  assert.ok(doc.includes('Orçamento Comparativo'))
  assert.ok(doc.includes('Convés Corretora de Seguros'))
  assert.ok(doc.includes('CV-2026-0817'))
  assert.ok(doc.includes('24/08/2026'))
  assert.ok(doc.includes('Válido por 5 dias'))
})

test('area de visualizacao oferece baixar PDF sem poluir a impressao', () => {
  const doc = html({}, {}, { comAcoes: true })
  assert.ok(doc.includes('Cotação pronta para conferência'))
  assert.ok(doc.includes('>Baixar PDF</button>'))
  assert.ok(doc.includes('onclick="window.print()"'))
  assert.ok(doc.includes('.acoes-doc{display:none!important}'))
})

test('a ficha do cliente traz segurado, condutor, veiculo, CEP e o selo do tipo', () => {
  const doc = html()
  assert.ok(doc.includes('Priscila Cunha dos Santos'))
  assert.ok(doc.includes('Aguinosvan A. dos Santos'))
  assert.ok(doc.includes('Placa GAO-1151'))
  assert.ok(doc.includes('04849-015'))
  assert.ok(doc.includes('>Renovação</span>'))
})

test('preview e impressao compartilham exatamente o mesmo modelo oficial', () => {
  const doc = html()
  assert.ok(doc.includes('class="hero-orcamento"'))
  assert.ok(doc.includes('class="cliente-modelo"'))
  assert.ok(doc.includes('background:#edf3fa'))
  assert.ok(doc.includes('.pagina{width:210mm;height:297mm;min-height:297mm'))
})

test('as duas seguradoras entram com a cor de identidade, nao a do papel', () => {
  const doc = html()
  assert.ok(doc.includes('--cor:#956e26'), 'faixa da Tokio')
  assert.ok(doc.includes('--cor:#1b4782'), 'faixa da Porto')
})

test('inverter a ordem das seguradoras nao troca as cores', () => {
  const comp = montarComparativo({ atual: cotacao('Porto Seguro'), outra: cotacao('Tokio Marine') })
  const doc = montarHtmlOrcamento(comp)
  const posPorto = doc.indexOf('--cor:#1b4782')
  const posTokio = doc.indexOf('--cor:#956e26')
  assert.ok(posPorto >= 0 && posTokio >= 0)
  assert.ok(posPorto < posTokio, 'a Porto agora e a da esquerda e mantem o azul')
})

test('seguradora sem logo cadastrada cai para o nome, sem furo no card', () => {
  const semLogo = cotacao('Seguradora Nova')
  semLogo.seguradora.logo_url = ''
  const comp = montarComparativo({ atual: semLogo, outra: cotacao('Porto Seguro') })
  const doc = montarHtmlOrcamento(comp)
  assert.ok(doc.includes('<span class="fallback">Seguradora Nova</span>'))
})

test('cobertura conhecida nao inclusa aparece na propria linha da tabela', () => {
  assert.ok(!html().includes('Não contratado nesta cotação.'))
  const doc = html({ nao_incluso: [{ titulo: 'Carro reserva', detalhe: 'Não contratado nesta cotação.' }] })
  assert.ok(doc.includes('Carro reserva'))
  assert.ok(doc.includes('Não contratado nesta cotação.'))
})

test('danos a terceiros e franquia destacam os valores criticos', () => {
  const doc = html({
    coberturas: [{
      nome_padronizado: 'Danos a terceiros',
      categoria: 'terceiros',
      incluida: true,
      valor_lmi: null,
      observacoes: 'R$ 150.000,00 danos materiais + R$ 150.000,00 danos corporais + R$ 5.000,00 danos morais.',
    }],
    valores: { ...cotacao('x').valores, franquia: 6704.93, franquia_tipo: 'Reduzida' },
  })
  assert.ok(doc.includes('<mark>R$ 150.000,00</mark>'))
  assert.ok(doc.replace(/\u00a0/g, ' ').includes('<mark>R$ 6.704,93</mark>'))
})

test('parcelamento aceita array e string com quebras, uma linha cada', () => {
  const linhas = ['Em até 12x sem juros no cartão', '1x à vista com 5% de desconto']
  const doc = html({ valores: { ...cotacao('x').valores, premio_parcelado: linhas } })
  for (const l of linhas) assert.ok(doc.includes(escapeHtml(l)), l)

  const doc2 = html({ valores: { ...cotacao('x').valores, premio_parcelado: linhas.join('\n') } })
  for (const l of linhas) assert.ok(doc2.includes(escapeHtml(l)), l)
})

test('divergencia entre os dois PDFs vira aviso impresso no documento', () => {
  // Nao basta alertar na tela: se o corretor gerou assim, quem le precisa saber.
  const outra = cotacao('Porto Seguro')
  outra.veiculo.placa = 'XXX-0000'
  const comp = montarComparativo({ atual: cotacao('Tokio Marine'), outra })
  const doc = montarHtmlOrcamento(comp)
  assert.ok(doc.includes('<div class="aviso-divergencia">'))
  assert.ok(doc.includes('as duas cotações divergem em'))
  assert.ok(doc.includes('placa'))
})

test('sem divergencia nao imprime aviso nenhum', () => {
  assert.ok(!html().includes('<div class="aviso-divergencia">'))
})

test('rodape traz o disclaimer e o contato da corretora', () => {
  const doc = html()
  assert.ok(doc.includes('sujeitos à análise de risco'))
  assert.ok(doc.includes('Convés Corretora de Seguros LTDA'))
})

test('contato pode ser sobrescrito sem tocar no template', () => {
  const doc = html({}, {}, { contato: { razao: 'Outra Razão', email: 'a@b.c', telefone: '(11) 0000-0000' } })
  assert.ok(doc.includes('Outra Razão'))
  assert.ok(!doc.includes('Convés Corretora de Seguros LTDA'))
})

test('o documento e auto-contido: nenhum asset externo alem das logos', () => {
  // Precisa virar PDF offline (Chromium headless ou print do browser), entao nao
  // pode depender de folha de estilo, fonte ou script baixado.
  const doc = html()
  assert.ok(!doc.includes('<link'), 'sem stylesheet externa')
  assert.ok(!doc.includes('<script'), 'sem script')
  assert.ok(!/@import/.test(doc), 'sem @import de fonte')
})
