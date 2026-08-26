/**
 * Template do PDF do Orcamento Comparativo (setor AUTO).
 *
 * Funcao PURA: recebe a estrutura de `montarComparativo` e devolve uma string
 * HTML completa. Nao toca no DOM, nao importa React, nao le rede — roda em
 * `node --test` e tambem no browser.
 *
 * Por que HTML/CSS e nao um construtor de PDF (pdf-lib, jsPDF):
 * o mockup ja aprovado foi feito em HTML/CSS -> Chromium, e o layout depende de
 * coisas que so o motor de texto do browser resolve bem (quebra de linha dentro
 * do card, altura igual entre as duas colunas, letter-spacing dos rotulos). Com
 * jsPDF cada uma dessas viraria calculo manual de coordenada. Aqui o mesmo HTML
 * serve para o preview na tela e para o PDF, sem duas implementacoes de layout
 * que divergem com o tempo.
 *
 * A conversao para PDF fica FORA deste modulo (window.print no front, ou
 * Chromium headless no servidor) — este arquivo so produz o documento.
 *
 * Cuidado deliberado com `escapeHtml`: todo texto aqui vem de PDF de seguradora
 * e de digitacao do corretor na tela de revisao. Sem escapar, um "&" no nome de
 * uma cobertura ja quebra o documento, e um `<` abre porta para injecao no
 * preview renderizado dentro do app.
 */

import { CATEGORIAS_COBERTURA, TINTA } from './orcamentoComparativo.js'

export function escapeHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── Icones ────────────────────────────────────────────────────────────
//
// Conjunto de linha, monocromatico, mesma espessura de traco (1.6). Cada
// categoria tem um icone FIXO (spec secao 9) — a cor vem por `currentColor`,
// herdando a cor de destaque da seguradora, entao o mesmo SVG serve aos dois
// cards sem duplicacao.

const ICONES = {
  shield:  '<path d="M12 3l7 3v6c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6l7-3z"/>',
  users:   '<circle cx="9" cy="9" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 7.5a2.6 2.6 0 0 1 0 5"/><path d="M17.5 19a4.6 4.6 0 0 0-2-3.4"/>',
  clock:   '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.2 2"/>',
  car:     '<path d="M4.5 15.5h15M6 15.5V18M18 15.5V18"/><path d="M4.5 15.5l1.6-4.6A2 2 0 0 1 8 9.5h8a2 2 0 0 1 1.9 1.4l1.6 4.6z"/><circle cx="8" cy="13" r=".9"/><circle cx="16" cy="13" r=".9"/>',
  percent: '<circle cx="8" cy="8" r="2.4"/><circle cx="16" cy="16" r="2.4"/><path d="M17.5 6.5l-11 11"/>',
  grid:    '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>',
  gift:    '<rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M3.5 13h17M12 9v11"/><path d="M12 9S10.5 4.5 8 5.2c-1.8.5-1.6 3.3.6 3.8M12 9s1.5-4.5 4-3.8c1.8.5 1.6 3.3-.6 3.8"/>',
  alerta:  '<path d="M12 4.5l8 14H4l8-14z"/><path d="M12 10v4M12 16.6v.1"/>',
  x:       '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
  cartao:  '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
  banco:   '<path d="M4 10h16M5 10v7M19 10v7M9 10v7M15 10v7M3.5 20h17M12 3.5L20 8H4l8-4.5z"/>',
  nota:    '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M9 11h7M9 14.5h7M9 7.5h3"/>',
}

function icone(nome, tamanho = 20) {
  const corpo = ICONES[nome] || ICONES.shield
  return `<svg class="ic" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`
}

/** Escolhe o icone da linha de pagamento pelo texto — cartao, debito/pix ou generico. */
function iconePagamento(texto) {
  const t = String(texto || '').toLowerCase()
  if (t.includes('cart')) return 'cartao'
  if (t.includes('debito') || t.includes('débito') || t.includes('pix')) return 'banco'
  return 'nota'
}

// ─── Estilo ────────────────────────────────────────────────────────────
//
// Tudo inline no documento, sem folha externa: o HTML precisa ser
// auto-contido para virar PDF tanto pelo print do browser quanto por Chromium
// headless, sem depender de servidor de assets.
//
// Paleta amostrada do mockup ja validado, nao escolhida a olho:
//   tinta #101f33 · painel de alerta #f6e9e6 sobre acento #9a3a2b
//   rotulos #6b7787 · cor da seguradora entra por variavel (--cor).
//
// Tipografia: par deliberado (spec secao 9) — serifada nos titulos e nos
// numeros grandes, sans no corpo, mono nos rotulos em caixa alta. Todas as
// pilhas terminam em fonte de sistema porque o PDF pode ser gerado offline;
// nenhuma depende de download.

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --tinta:${TINTA};
  --papel:#ffffff;
  --rotulo:#6b7787;
  --linha:#dde2e8;
  --alerta-bg:#f6e9e6;
  --alerta:#9a3a2b;
  --serif:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,'Times New Roman',serif;
  --sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  --mono:'SFMono-Regular',Menlo,Consolas,'Liberation Mono','Courier New',monospace;
}
@page{size:A4;margin:0}
html,body{background:var(--papel)}
body{
  font-family:var(--sans);color:var(--tinta);
  font-size:7.7pt;line-height:1.38;
  -webkit-font-smoothing:antialiased;
}
.pagina{width:210mm;min-height:297mm;padding:0 0 6mm;margin:0 auto;position:relative;display:flex;flex-direction:column}
.barra-topo{height:4px;background:linear-gradient(90deg,#1c4a87 0%,#1c4a87 55%,#9c7328 100%)}

/* ─── Cabecalho ─── */
.cabecalho{display:flex;align-items:center;gap:8mm;padding:3.5mm 12mm 3mm}
.marca img{height:11.5mm;width:auto;display:block}
.titulo-bloco{flex:1;text-align:right}
.titulo{font-family:var(--serif);font-size:15.5pt;font-weight:700;letter-spacing:-.2pt;line-height:1.1;white-space:nowrap}
.titulo .estrela{color:#9c7328;font-size:11pt;vertical-align:2pt;margin-right:2pt}
.meta{font-family:var(--mono);font-size:7.4pt;color:var(--rotulo);letter-spacing:.4pt;margin-top:2.5mm;text-transform:uppercase}
.meta span+span::before{content:'·';margin:0 2.2mm;color:var(--linha)}

/* ─── Barra do cliente ─── */
.cliente{display:flex;align-items:stretch;gap:0;margin:0 12mm;border-top:1px solid var(--linha);border-bottom:1px solid var(--linha);padding:2.4mm 0}
.cliente .campo{padding:0 6mm;flex:1}
.cliente .campo:first-child{padding-left:0}
.cliente .campo+.campo{border-left:1px solid var(--linha)}
.cliente .campo.tipo{flex:0 0 auto;padding-right:0;display:flex;flex-direction:column;align-items:flex-start;gap:2mm}
.rotulo{font-family:var(--mono);font-size:6.1pt;letter-spacing:.85pt;color:var(--rotulo);text-transform:uppercase;display:block;margin-bottom:1.2mm}
.cliente .valor{font-family:var(--serif);font-size:10pt;font-weight:600;line-height:1.25}
.cliente .valor small{display:block;font-size:8.4pt;font-weight:500}
.selo-tipo{background:var(--tinta);color:#fff;font-family:var(--mono);font-size:7pt;font-weight:600;letter-spacing:1.1pt;padding:2.1mm 4.2mm;text-transform:uppercase}

/* ─── Corpo: dois cards ─── */
.corpo{display:flex;align-items:flex-start;gap:0;padding:3.2mm 12mm 0;flex:1}
.divisor{flex:0 0 8mm;align-self:stretch;position:relative;min-height:150mm}
.divisor::before{content:'';position:absolute;left:50%;top:2mm;bottom:2mm;width:1px;background:var(--linha)}
.divisor::after{content:'';position:absolute;left:50%;top:50%;width:3.2mm;height:3.2mm;background:var(--papel);border:1px solid #c2cad3;transform:translate(-50%,-50%) rotate(45deg)}
.card{flex:1;min-width:0;border:1px solid var(--linha);border-radius:2.2mm;overflow:hidden;background:var(--papel);box-shadow:0 1px 3px rgba(16,31,51,.07),0 6px 16px rgba(16,31,51,.05);display:flex;flex-direction:column}

/* faixa colorida + selo do logo */
.faixa{background:var(--cor);display:flex;align-items:center;gap:4mm;padding:2.8mm 3.6mm;min-height:14mm}
.faixa .papel-rotulo{font-family:var(--mono);font-size:6.6pt;letter-spacing:1.1pt;color:var(--cor-texto);opacity:.92;text-transform:uppercase;flex:1;line-height:1.3}
.selo-logo{background:#fff;border-radius:1.4mm;padding:2mm 3.2mm;display:flex;align-items:center;justify-content:center;min-width:34mm;min-height:14mm;box-shadow:0 1px 4px rgba(0,0,0,.14)}
.selo-logo img{max-height:8mm;max-width:33mm;width:auto;height:auto;display:block}
.selo-logo .fallback{font-family:var(--serif);font-size:11pt;font-weight:700;color:var(--cor);text-align:center;line-height:1.15}

/* faixa de identificacao */
.identificacao{display:flex;background:#f4f6f8;border-bottom:1px solid var(--linha)}
.identificacao div{flex:1;padding:1.5mm 1.7mm;min-width:0}
.identificacao div+div{border-left:1px solid #e5e9ee}
.identificacao .dado{font-weight:600;font-size:6.8pt;line-height:1.28;overflow-wrap:normal;hyphens:none}

/* coberturas */
.secao{padding:2.2mm 4mm 0}
.secao-titulo{font-family:var(--mono);font-size:6.9pt;letter-spacing:1.2pt;color:var(--rotulo);text-transform:uppercase;padding-bottom:2mm;border-bottom:1px solid var(--linha)}
.cobertura{display:flex;gap:2.4mm;padding:1.3mm 0;border-bottom:1px solid #eef1f4}
.cobertura:last-child{border-bottom:0}
.bolha{flex:0 0 auto;width:6.6mm;height:6.6mm;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--cor);background:var(--cor-bolha)}
.bolha .ic{width:3.7mm;height:3.7mm}
.cobertura h4{font-family:var(--serif);font-size:8.2pt;font-weight:700;line-height:1.18;margin-bottom:.7mm}
.cobertura p{font-size:7pt;line-height:1.3;color:#33445c}
/* cobertura que a cotacao NEGA: mesma linha, mesmo lugar, marca invertida */
.cobertura.sem .bolha{background:#fff;border:1px solid rgba(154,58,43,.3);color:var(--alerta)}
.cobertura.sem h4{color:var(--alerta)}
.cobertura.sem p{color:#7d4034}
/* cobertura que a cotacao NAO INFORMA: so aparece se alguem burlar o bloqueio */
.cobertura.vago .bolha{background:#fff6e5;border:1px solid rgba(180,113,0,.32);color:#b47100}
.cobertura.vago h4{color:#7a4f00}
.cobertura.vago p{color:#7a4f00;font-style:italic}

/* nao incluso */
.nao-incluso{margin:2.8mm 4mm 0;background:var(--alerta-bg);border-left:2.4pt solid var(--alerta);padding:2.6mm 3.4mm}
.nao-incluso .cabeca{display:flex;align-items:center;gap:2.2mm;color:var(--alerta);font-family:var(--mono);font-size:6.9pt;letter-spacing:1.1pt;text-transform:uppercase;margin-bottom:2.4mm}
.nao-incluso .cabeca .ic{width:3.9mm;height:3.9mm}
.item-fora{display:flex;gap:2.4mm;padding:1.3mm 0}
.item-fora+.item-fora{border-top:1px solid rgba(154,58,43,.16)}
.item-fora .marca-x{flex:0 0 auto;width:5.8mm;height:5.8mm;border-radius:50%;background:#fff;border:1px solid rgba(154,58,43,.3);display:flex;align-items:center;justify-content:center;color:var(--alerta)}
.item-fora .marca-x .ic{width:3.2mm;height:3.2mm}
.item-fora h5{font-family:var(--serif);font-size:8pt;font-weight:700;color:var(--alerta);line-height:1.2}
.item-fora p{font-size:6.6pt;color:#7d4034;line-height:1.35;margin-top:.4mm}

/* caixa de valor */
.valor-caixa{margin:2.4mm 4mm 0;background:var(--tinta);color:#fff;border-radius:1.6mm;padding:2.6mm 3.6mm}
.valor-caixa .rotulo{color:#b9c2cc;margin-bottom:1.6mm}
.valor-caixa .numero{font-family:var(--serif);font-size:15.5pt;font-weight:700;color:var(--cor-clara);letter-spacing:-.3pt;line-height:1.05}
.pagamentos{margin-top:2.4mm;border-top:1px solid rgba(255,255,255,.16);padding-top:2.1mm;display:flex;flex-direction:column;gap:1.5mm}
.pagamento{display:flex;gap:2.2mm;align-items:flex-start;font-size:6.6pt;line-height:1.3;color:#e8edf3}
.pagamento .ic{width:4mm;height:4mm;flex:0 0 auto;color:#9fb0c4;margin-top:.3mm}

.rodape-card{padding:1.8mm 4mm 2.4mm;font-size:6.5pt;color:var(--rotulo);line-height:1.4}
.rodape-card b{color:#48566a;font-weight:600}
.rodape-card i{font-style:italic}

/* rodape geral */
.rodape{margin:3mm 12mm 0;border-top:1px solid var(--linha);padding-top:2.4mm;text-align:center;font-size:6.6pt;color:var(--rotulo);line-height:1.5}
.rodape .contato{margin-top:1.4mm;color:#48566a}
.aviso-divergencia{margin:4mm 12mm 0;background:#fff6e5;border-left:2.6pt solid #b47100;padding:3mm 4mm;font-size:8pt;color:#7a4f00}
`

// ─── Blocos ────────────────────────────────────────────────────────────

const ROTULO_PAPEL = { atual: 'Seguradora atual', outra: 'Outra seguradora' }

/**
 * Selo branco com a logo da seguradora.
 *
 * A logo vem do cadastro (`seguradoras.logo_url`), nunca recortada do PDF da
 * cotacao. Quando a seguradora nao tem logo cadastrada, cai para o nome em
 * serifada dentro do mesmo selo — o card continua legivel e a falta fica
 * visivel, em vez de abrir um buraco branco no documento.
 */
function selo(seguradora) {
  const conteudo = seguradora.logo_url
    ? `<img src="${escapeHtml(seguradora.logo_url)}" alt="${escapeHtml(seguradora.nome)}">`
    : `<span class="fallback">${escapeHtml(seguradora.nome)}</span>`
  return `<div class="selo-logo">${conteudo}</div>`
}

/**
 * Uma linha por categoria, SEMPRE — nao ha filtro por conteudo aqui.
 *
 * Filtrar categoria sem dado era o bug: a linha sumia do card e o cliente lia
 * o silencio como "nao tem", enquanto o card do lado, que tinha a linha,
 * deixava de alinhar. Quem decide o que sai do documento e `montarCategorias`,
 * que so remove "Beneficios adicionais" quando vazia. Cada estado ganha marca
 * propria: o check da categoria, um X para o que a cotacao nega, e um alerta
 * para o que ela nao informou — este ultimo, na pratica, nao chega ao PDF,
 * porque `validarCotacao` bloqueia a geracao antes.
 */
const MARCA_ESTADO = { nao_incluida: 'x', nao_informado: 'alerta' }
const CLASSE_ESTADO = { nao_incluida: ' sem', nao_informado: ' vago' }

function blocoCoberturas(card) {
  const linhas = card.categorias
    .map(cat => `
      <div class="cobertura${CLASSE_ESTADO[cat.estado] || ''}">
        <div class="bolha">${icone(MARCA_ESTADO[cat.estado] || cat.icone)}</div>
        <div>
          <h4>${escapeHtml(cat.label)}</h4>
          <p>${escapeHtml(cat.texto)}</p>
        </div>
      </div>`)
    .join('')

  return `<div class="secao">
    <div class="secao-titulo">Coberturas</div>
    ${linhas}
  </div>`
}

/**
 * Painel do que NAO esta incluso.
 *
 * Some inteiro quando nao ha nada — um painel de alerta vazio sugeriria que o
 * corretor esqueceu de preencher. Quando ha, pesa visualmente de proposito
 * (spec secao 9): e a informacao que o cliente mais precisa notar rapido.
 */
function blocoNaoIncluso(card) {
  if (!card.nao_incluso.length) return ''
  const itens = card.nao_incluso.map(item => `
    <div class="item-fora">
      <div class="marca-x">${icone('x')}</div>
      <div>
        <h5>${escapeHtml(item.titulo)}</h5>
        ${item.detalhe ? `<p>${escapeHtml(item.detalhe)}</p>` : ''}
      </div>
    </div>`).join('')

  return `<div class="nao-incluso">
    <div class="cabeca">${icone('alerta')}<span>Não incluso nesta cotação</span></div>
    ${itens}
  </div>`
}

/**
 * Caixa de valor + parcelamento.
 *
 * O parcelamento e uma lista de linhas vindas da cotacao (spec secao 7: e dado
 * POR COTACAO, nunca texto fixo da seguradora — depende do premio calculado e
 * dos descontos). Aceita string com quebras ou array.
 */
function blocoValor(card) {
  const linhas = Array.isArray(card.valores.parcelamento)
    ? card.valores.parcelamento
    : String(card.valores.parcelamento || '').split('\n')

  const pagamentos = linhas
    .map(l => String(l).trim())
    .filter(Boolean)
    .map(l => `<div class="pagamento">${icone(iconePagamento(l))}<span>${escapeHtml(l)}</span></div>`)
    .join('')

  const rotulo = card.papel === 'atual' ? 'Valor total à vista' : 'Valor total (com IOF)'

  return `<div class="valor-caixa">
    <span class="rotulo">${escapeHtml(rotulo)}</span>
    <div class="numero">${escapeHtml(card.valores.total_formatado || '—')}</div>
    ${pagamentos ? `<div class="pagamentos">${pagamentos}</div>` : ''}
  </div>`
}

function blocoCard(card) {
  const s = card.seguradora
  const estilo = `--cor:${s.cor};--cor-clara:${s.cor_clara};--cor-texto:${s.cor_texto};--cor-bolha:${s.cor}1f`
  const ident = card.identificacao

  return `<div class="card" style="${estilo}">
    <div class="faixa">
      <div class="papel-rotulo">${escapeHtml(ROTULO_PAPEL[card.papel] || '')}</div>
      ${selo(s)}
    </div>
    <div class="identificacao">
      <div><span class="rotulo">Condutor</span><div class="dado">${escapeHtml(ident.condutor || '—')}</div></div>
      <div><span class="rotulo">CEP pernoite</span><div class="dado">${escapeHtml(ident.cep_pernoite || '—')}</div></div>
      <div><span class="rotulo">Uso</span><div class="dado">${escapeHtml(ident.uso || '—')}</div></div>
      <div><span class="rotulo">Jovem 18–25 anos</span><div class="dado">${escapeHtml(ident.jovem_18_25 || '—')}</div></div>
    </div>
    ${blocoCoberturas(card)}
    ${blocoNaoIncluso(card)}
    ${blocoValor(card)}
    ${card.rodape ? `<div class="rodape-card"><b>Condições Gerais:</b> <i>${escapeHtml(card.rodape)}</i></div>` : ''}
  </div>`
}

// ─── Documento ─────────────────────────────────────────────────────────

export const CONTATO_PADRAO = {
  razao: 'Convés Corretora de Seguros LTDA',
  email: 'mateusugarte@convesseguros.com',
  telefone: '(11) 2229-8624',
}

/**
 * Monta o HTML completo do orcamento.
 *
 * @param comparativo estrutura de `montarComparativo`
 * @param logoConves  URL ou data URI da logo da corretora
 * @param contato     sobrescreve `CONTATO_PADRAO`
 */
export function montarHtmlOrcamento(comparativo, { logoConves = '/conves-logo.png', contato = CONTATO_PADRAO } = {}) {
  const { cabecalho, cliente, cards, divergencias = [] } = comparativo

  const meta = [
    cabecalho.referencia ? `Nº ${cabecalho.referencia}` : '',
    cabecalho.emitido_em_formatado ? `Emitido ${cabecalho.emitido_em_formatado}` : '',
    cabecalho.validade_dias ? `Válido por ${cabecalho.validade_dias} dias` : '',
  ].filter(Boolean).map(t => `<span>${escapeHtml(t)}</span>`).join('')

  const veiculoLinha2 = [cliente.ano_modelo, cliente.placa ? `Placa ${cliente.placa}` : '']
    .filter(Boolean).join(' · ')

  // Divergencia entre os dois PDFs vira aviso IMPRESSO, nao so alerta de tela:
  // se o corretor gerou assim mesmo, quem le o documento precisa saber.
  const aviso = divergencias.length
    ? `<div class="aviso-divergencia"><b>Atenção:</b> as duas cotações divergem em
       ${escapeHtml(divergencias.map(d => d.label.toLowerCase()).join(', '))}. Confira antes de enviar ao cliente.</div>`
    : ''

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Orçamento Comparativo${cabecalho.referencia ? ` ${escapeHtml(cabecalho.referencia)}` : ''}</title>
<style>${CSS}</style>
</head>
<body>
<div class="pagina">
  <div class="barra-topo"></div>

  <header class="cabecalho">
    <div class="marca"><img src="${escapeHtml(logoConves)}" alt="Convés Seguros"></div>
    <div class="titulo-bloco">
      <h1 class="titulo"><span class="estrela">★</span>Orçamento Comparativo de Seguro Auto</h1>
      <div class="meta">${meta}</div>
    </div>
  </header>

  <section class="cliente">
    <div class="campo">
      <span class="rotulo">Segurado</span>
      <div class="valor">${escapeHtml(cliente.segurado || '—')}</div>
    </div>
    <div class="campo">
      <span class="rotulo">Veículo</span>
      <div class="valor">${escapeHtml(cliente.veiculo || '—')}${veiculoLinha2 ? `<small>${escapeHtml(veiculoLinha2)}</small>` : ''}</div>
    </div>
    <div class="campo tipo">
      <span class="rotulo">Tipo de cotação</span>
      <span class="selo-tipo">${escapeHtml(cliente.tipo_operacao_label || '—')}</span>
    </div>
  </section>

  ${aviso}

  <main class="corpo">
    ${blocoCard(cards[0])}
    <div class="divisor"></div>
    ${blocoCard(cards[1])}
  </main>

  <footer class="rodape">
    Orçamento comparativo simplificado, elaborado pela Convés Seguros a partir das cotações oficiais
    e das Condições Gerais vigentes de cada seguradora — valores sujeitos à análise de risco e podem
    mudar até a emissão da apólice.
    <div class="contato">${escapeHtml(contato.razao)} · ${escapeHtml(contato.email)} · ${escapeHtml(contato.telefone)}</div>
  </footer>
</div>
</body>
</html>`
}
