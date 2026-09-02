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

import { CATEGORIAS_COBERTURA, TINTA, formatarMoeda } from './orcamentoComparativo.js'

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
  --display:'Avenir Next','Avenir','SF Pro Display','Helvetica Neue',Arial,sans-serif;
  --sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  --mono:'SFMono-Regular',Menlo,Consolas,'Liberation Mono','Courier New',monospace;
}
@page{size:A4;margin:0}
html,body{background:#e9eef4}
body{
  font-family:var(--sans);color:var(--tinta);
  font-size:7.8pt;line-height:1.4;
  -webkit-font-smoothing:antialiased;
}
.pagina{width:210mm;min-height:297mm;padding:0 0 6mm;margin:7mm auto;position:relative;display:flex;flex-direction:column;background:linear-gradient(180deg,#fff 0%,#fbfcfe 62%,#fff 100%);box-shadow:0 18px 60px rgba(16,31,51,.18)}
.acoes-doc{position:sticky;z-index:20;top:0;display:flex;width:210mm;align-items:center;justify-content:space-between;gap:8mm;margin:0 auto;padding:3mm 5mm;background:rgba(16,31,51,.96);color:#fff;box-shadow:0 8px 24px rgba(16,31,51,.24);backdrop-filter:blur(12px)}
.acoes-doc strong{font-family:var(--serif);font-size:10pt}.acoes-doc span{display:block;color:#c8d2df;font-size:7pt;margin-top:.5mm}
.acoes-doc .botoes{display:flex;gap:2mm}.acoes-doc button{border:1px solid rgba(255,255,255,.22);border-radius:1.5mm;padding:2.2mm 4mm;background:transparent;color:#fff;font:700 7.5pt var(--sans);cursor:pointer}
.acoes-doc button.primario{border-color:#fff;background:#fff;color:var(--tinta)}
.barra-topo{height:5px;background:linear-gradient(90deg,#1c4a87 0%,#1c4a87 48%,#0ea5a4 72%,#9c7328 100%)}

/* ─── Cabecalho ─── */
.cabecalho{display:flex;align-items:center;gap:8mm;padding:5mm 12mm 3.5mm}
.marca{display:flex;align-items:center;justify-content:center;min-width:38mm;min-height:16mm;padding:2mm 3mm;border:1px solid #e6ebf1;border-radius:2mm;background:#fff;box-shadow:0 5px 18px rgba(16,31,51,.07)}
.marca img{max-height:11.5mm;max-width:34mm;width:auto;display:block}
.titulo-bloco{flex:1;text-align:right}
.titulo{font-family:var(--serif);font-size:16.4pt;font-weight:700;letter-spacing:-.35pt;line-height:1.08;white-space:nowrap}
.titulo .estrela{color:#9c7328;font-size:11pt;vertical-align:2pt;margin-right:2pt}
.meta{font-family:var(--mono);font-size:7.4pt;color:var(--rotulo);letter-spacing:.4pt;margin-top:2.5mm;text-transform:uppercase}
.meta span+span::before{content:'·';margin:0 2.2mm;color:var(--linha)}

/* ─── Barra do cliente ─── */
.cliente{display:flex;align-items:stretch;gap:0;margin:0 12mm;border:1px solid var(--linha);border-radius:2.5mm;padding:2.4mm 0;background:#fff;box-shadow:0 7px 22px rgba(16,31,51,.045)}
.cliente .campo{padding:0 6mm;flex:1}
.cliente .campo:first-child{padding-left:0}
.cliente .campo+.campo{border-left:1px solid var(--linha)}
.cliente .campo.tipo{flex:0 0 auto;padding-right:0;display:flex;flex-direction:column;align-items:flex-start;gap:2mm}
.rotulo{font-family:var(--mono);font-size:6.1pt;letter-spacing:.85pt;color:var(--rotulo);text-transform:uppercase;display:block;margin-bottom:1.2mm}
.cliente .valor{font-family:var(--serif);font-size:10pt;font-weight:600;line-height:1.25}
.cliente .valor small{display:block;font-size:8.4pt;font-weight:500}
.selo-tipo{background:var(--tinta);color:#fff;font-family:var(--mono);font-size:7pt;font-weight:600;letter-spacing:1.1pt;padding:2.1mm 4.2mm;text-transform:uppercase}

/* resumo executivo */
.resumo-precos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4mm;margin:3.4mm 12mm 0}
.resumo-preco{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:5mm;padding:3mm 3.6mm;border:1px solid var(--linha);border-radius:2.8mm;background:#fff;box-shadow:0 8px 24px rgba(16,31,51,.055)}
.resumo-preco::after{content:'';position:absolute;right:-12mm;top:-18mm;width:34mm;height:34mm;border-radius:50%;background:var(--cor);opacity:.08}
.resumo-preco span{font-family:var(--mono);font-size:6.4pt;letter-spacing:1pt;text-transform:uppercase;color:var(--rotulo)}
.resumo-preco strong{display:block;margin-top:.7mm;font-family:var(--serif);font-size:12pt;color:var(--tinta);line-height:1.1}
.resumo-preco b{position:relative;z-index:1;font-family:var(--serif);font-size:15pt;color:var(--cor);letter-spacing:-.3pt;white-space:nowrap}

/* ─── Corpo: dois cards ─── */
.corpo{display:flex;align-items:flex-start;gap:0;padding:3.4mm 12mm 0;flex:1}
.divisor{flex:0 0 8mm;align-self:stretch;position:relative;min-height:150mm}
.divisor::before{content:'';position:absolute;left:50%;top:2mm;bottom:2mm;width:1px;background:var(--linha)}
.divisor::after{content:'';position:absolute;left:50%;top:50%;width:3.2mm;height:3.2mm;background:var(--papel);border:1px solid #c2cad3;transform:translate(-50%,-50%) rotate(45deg)}
.card{flex:1;min-width:0;border:1px solid var(--linha);border-radius:3mm;overflow:hidden;background:var(--papel);box-shadow:0 1px 3px rgba(16,31,51,.07),0 10px 26px rgba(16,31,51,.07);display:flex;flex-direction:column}

/* faixa colorida + selo do logo */
.faixa{background:linear-gradient(120deg,var(--cor),color-mix(in srgb,var(--cor) 78%,#101f33));display:flex;align-items:center;gap:4mm;padding:3.3mm 3.8mm;min-height:17mm}
.faixa .papel-rotulo{font-family:var(--mono);font-size:6.6pt;letter-spacing:1.1pt;color:var(--cor-texto);opacity:.92;text-transform:uppercase;flex:1;line-height:1.3}
.selo-logo{background:#fff;border-radius:2mm;padding:2.3mm 3.6mm;display:flex;align-items:center;justify-content:center;min-width:39mm;min-height:15.5mm;box-shadow:0 3px 10px rgba(0,0,0,.18)}
.selo-logo img{max-height:10mm;max-width:37mm;width:auto;height:auto;display:block;object-fit:contain}
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
.valor-caixa{margin:2.8mm 4mm 0;background:linear-gradient(135deg,#101f33,#192d49);color:#fff;border-radius:2.2mm;padding:3mm 3.8mm;box-shadow:0 10px 24px rgba(16,31,51,.18)}
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
.modelo-secao{margin:17mm 12mm 0}.modelo-secao-title{display:flex;align-items:center;gap:3mm;margin-bottom:7mm;font-family:var(--serif);font-size:15pt;font-weight:800;letter-spacing:-.25pt}.modelo-secao-title i{display:grid;width:7.3mm;height:7.3mm;place-items:center;border-radius:50%;background:var(--tinta);color:#fff;font-family:var(--sans);font-size:9pt;font-style:normal;font-weight:800}
.tabela-comparativo{display:grid;grid-template-columns:50mm 1fr 1fr;overflow:hidden;border-radius:2.8mm;background:#e5edf7;box-shadow:0 16px 42px rgba(16,31,51,.09)}
.tabela-head{min-height:18mm;padding:3mm 4mm;background:#dfe9f5;color:#7f91a8;font-family:var(--mono);font-size:6.6pt;font-weight:800;letter-spacing:1.4pt;text-transform:uppercase}.tabela-head.seguradora{display:flex;align-items:center;gap:4mm;background:linear-gradient(120deg,var(--cor),color-mix(in srgb,var(--cor) 78%,#101f33));color:var(--cor-texto)}.tabela-head.seguradora strong{font-size:7.2pt;letter-spacing:1.25pt}.tabela-head .selo-logo{min-width:31mm;min-height:12mm;padding:1.6mm 2.6mm;border-radius:1.7mm;box-shadow:0 3px 9px rgba(0,0,0,.18)}.tabela-head .selo-logo img{max-height:8mm;max-width:29mm}.tabela-head .fallback{font-size:8.4pt}
.tabela-cobertura,.tabela-celula{min-height:18mm;padding:3.2mm 4mm;border-top:1px solid #d2deeb}.tabela-cobertura{display:flex;align-items:center;gap:3mm;background:#e7f0fa;font-weight:800}.tabela-cobertura .bolha{width:7.5mm;height:7.5mm;background:#fff;color:var(--tinta);box-shadow:0 3px 8px rgba(16,31,51,.1)}.tabela-cobertura .bolha .ic{width:3.8mm;height:3.8mm}.tabela-cobertura span{font-size:8.2pt;line-height:1.25}.tabela-celula{background:#eaf1f8;color:#46586f;font-size:8.5pt;line-height:1.42}.tabela-celula strong{color:#102033;font-weight:850}.tabela-celula.is-empty{color:#8090a3;font-style:italic}.tabela-celula.is-negative{color:#8d3c32;background:#f6e9e6}
.tabela-comparativo[data-options="3"] .tabela-head,.tabela-comparativo[data-options="3"] .tabela-cobertura,.tabela-comparativo[data-options="3"] .tabela-celula{padding-left:2.2mm;padding-right:2.2mm}.tabela-comparativo[data-options="3"] .tabela-celula{font-size:7.2pt;line-height:1.34}.tabela-comparativo[data-options="4"] .tabela-head,.tabela-comparativo[data-options="4"] .tabela-cobertura,.tabela-comparativo[data-options="4"] .tabela-celula{padding-left:1.5mm;padding-right:1.5mm}.tabela-comparativo[data-options="4"] .tabela-celula{font-size:6.2pt;line-height:1.26}.tabela-comparativo[data-options="4"] .tabela-cobertura span{font-size:7pt}
.valores-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6mm}.valor-card-modelo{position:relative;overflow:hidden;border-radius:3mm;background:#fff;box-shadow:0 14px 40px rgba(16,31,51,.11)}.valor-card-modelo::before{content:'';display:block;height:1.3mm;background:var(--cor)}.valor-card-modelo-inner{padding:6mm 7mm}.valor-card-modelo .marca-valor{display:flex;align-items:center;gap:4mm;margin-bottom:7mm}.valor-card-modelo .marca-valor .selo-logo{min-width:29mm;min-height:10mm;padding:1.2mm 2mm;box-shadow:none}.valor-card-modelo .marca-valor .selo-logo img{max-height:7mm;max-width:27mm}.valor-card-modelo .marca-valor span{font-family:var(--mono);font-size:7.8pt;font-weight:800;letter-spacing:1.8pt;color:#8ca0b7;text-transform:uppercase}.valor-card-modelo .valor-total-label{font-family:var(--mono);font-size:7pt;font-weight:800;letter-spacing:1.2pt;color:#8ca0b7;text-transform:uppercase}.valor-card-modelo .valor-total{margin:2.5mm 0 4mm;font-family:var(--mono);font-size:23pt;font-weight:800;letter-spacing:1.5pt;color:var(--tinta)}.valor-card-modelo .pagamentos{margin:0;padding:4mm 0 0;border-top:1px solid #d6e0eb;gap:2.1mm}.valor-card-modelo .pagamento{font-size:8pt;color:#445870}.valor-card-modelo .pagamento .ic{color:#7e91a8}.valor-card-modelo .rodape-card{padding:3.5mm 0 0;color:#718399;font-size:7.1pt}
.valores-grid[data-options="3"],.valores-grid[data-options="4"]{gap:3mm}.valores-grid[data-options="3"] .valor-card-modelo-inner,.valores-grid[data-options="4"] .valor-card-modelo-inner{padding:4mm}.valores-grid[data-options="3"] .valor-total{font-size:17pt}.valores-grid[data-options="4"] .valor-total{font-size:14pt}.valores-grid[data-options="3"] .pagamento,.valores-grid[data-options="4"] .pagamento{font-size:6.5pt}
.diferenca-total{display:flex;align-items:center;justify-content:space-between;gap:10mm;margin:7mm 12mm 0;padding:4.2mm 7mm;border-radius:2.8mm;background:#0d2036;color:#fff}.diferenca-total span{font-family:var(--mono);font-size:7.5pt;letter-spacing:2pt;text-transform:uppercase;color:#aab8c9}.diferenca-total strong{font-family:var(--mono);font-size:17pt;letter-spacing:1.5pt}
.rodape::before{content:'';display:block;width:86mm;height:1mm;margin:0 auto 3mm;background:linear-gradient(90deg,#9c7328 0 50%,#1c4a87 50% 100%)}
@media print{
  html,body{width:210mm;min-height:297mm;background:#fff}
  .acoes-doc{display:none!important}
  .pagina{margin:0!important;box-shadow:none!important}
}
`

/*
 * Camada visual do modelo oficial (orcamentoVIVIANWARZEELIMA).
 *
 * O template antigo continua acima apenas para preservar os estilos dos
 * pequenos componentes reutilizados. Estas regras definem a pagina final e
 * prevalecem tanto no preview quanto na impressao. Assim a visualizacao e o
 * PDF baixado passam pelo mesmo documento, sem uma segunda versao do layout.
 */
const CSS_MODELO_OFICIAL = `
html,body{
  width:100%;min-height:100%;margin:0;background:#dce5ef;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
body{font-size:7.45pt;line-height:1.36;color:#102033}
.pagina{
  --cur:#9c7328;--oth:#1c4a87;
  width:210mm;min-height:297mm;margin:7mm auto 18mm;padding:0;
  display:block;overflow:hidden;
  background:linear-gradient(180deg,#f7faff 0%,#edf3fa 44%,#f4f8fc 100%);
  box-shadow:0 22px 70px rgba(8,25,46,.24)
}
.pagina-conteudo{
  width:100%;min-height:297mm;display:flex;flex-direction:column;
  transform-origin:top left
}
.hero-orcamento,.cliente-modelo,.aviso-divergencia,.modelo-secao,.diferenca-total{flex-shrink:0}

/* faixa superior: a cor da direita acompanha a seguradora atual */
.hero-orcamento{
  position:relative;height:29mm;min-height:29mm;padding:6.3mm 13mm 5mm;
  display:flex;align-items:flex-start;justify-content:space-between;gap:10mm;
  color:#fff;background:
    linear-gradient(112deg,#0d3159 0%,#0a203a 58%,color-mix(in srgb,var(--cur) 58%,#08172a) 100%);
  overflow:hidden
}
.hero-orcamento::before{
  content:'';position:absolute;inset:auto 0 0;height:1.2mm;
  background:linear-gradient(90deg,var(--cur) 0 49.5%,rgba(255,255,255,.3) 49.5% 50.5%,var(--oth) 50.5% 100%)
}
.hero-orcamento::after{
  content:'';position:absolute;right:-14mm;top:-18mm;width:58mm;height:58mm;
  border:8mm solid rgba(255,255,255,.028);transform:rotate(18deg)
}
.hero-orcamento .marca{
  position:relative;z-index:1;display:flex;align-items:center;justify-content:center;
  width:21mm;height:15mm;min-width:21mm;min-height:15mm;padding:1.8mm 2.5mm;
  border:0;border-radius:2.3mm;background:#fff;box-shadow:0 7px 18px rgba(0,0,0,.16)
}
.hero-orcamento .marca img{max-width:16mm;max-height:11.4mm}
.hero-titulos{position:relative;z-index:1;flex:1;text-align:right;padding-top:.2mm}
.hero-kicker{
  display:block;margin-bottom:1.2mm;font-family:var(--mono);font-size:6.5pt;
  letter-spacing:2.2pt;text-transform:uppercase;color:rgba(255,255,255,.62)
}
.hero-orcamento .titulo{
  font-family:var(--display);font-size:18.8pt;font-weight:700;line-height:1;
  letter-spacing:-.7pt;color:#fff;white-space:nowrap
}
.hero-orcamento .meta{
  margin-top:2.3mm;font-family:var(--mono);font-size:6.5pt;letter-spacing:.65pt;
  text-transform:uppercase;color:rgba(255,255,255,.67)
}
.hero-orcamento .meta span+span::before{color:rgba(255,255,255,.35)}

/* ficha sobreposta: mesmas duas linhas e divisorias do modelo */
.cliente-modelo{
  position:relative;z-index:2;margin:-4.2mm 13mm 0;border-radius:2.7mm;
  border:1px solid rgba(160,178,199,.32);background:#fff;
  box-shadow:0 7px 20px rgba(16,31,51,.12);overflow:hidden
}
.cliente-linha{display:grid;align-items:stretch}
.cliente-linha.superior{grid-template-columns:1.18fr 1.18fr .75fr}
.cliente-linha.inferior{grid-template-columns:1.74fr 1fr;border-top:1px solid #d4deea}
.cliente-modelo .campo{min-width:0;padding:1.9mm 5.8mm 2mm}
.cliente-modelo .campo+.campo{border-left:1px solid #d4deea}
.cliente-modelo .rotulo{margin-bottom:.75mm;color:#7b8fa6;font-size:5.6pt;letter-spacing:1.05pt}
.cliente-modelo .valor{
  font-family:var(--display);font-size:9pt;font-weight:700;line-height:1.18;
  letter-spacing:-.08pt;color:#102033
}
.cliente-modelo .valor small{font-size:7.35pt;font-weight:500;color:#344a64}
.cliente-linha.superior .valor{font-size:8.55pt}
.cliente-linha.inferior .campo{padding-top:1.45mm;padding-bottom:1.55mm}
.cliente-linha.inferior .campo:first-child .valor{font-size:8.7pt;line-height:1.08}
.cliente-linha.inferior .campo:first-child .valor small{display:block;margin-top:.35mm;font-size:7pt;line-height:1.04}
.cliente-modelo .campo.tipo{display:flex;flex-direction:column;align-items:flex-start}
.cliente-modelo .selo-tipo{border-radius:1mm;padding:2mm 3.6mm;background:#0d2036;font-size:6.6pt}

.aviso-divergencia{
  margin:3.2mm 13mm 0;padding:2.4mm 3.6mm;border-left:2.2pt solid #b98318;
  background:rgba(255,248,230,.92);color:#77530d;font-size:7.1pt
}

/* secoes compactas para manter o modelo em uma pagina A4 */
.modelo-secao{margin:12.5mm 13mm 0}
.modelo-secao.valores-secao{margin-top:5.7mm}
.modelo-secao-title{
  position:relative;gap:2.5mm;margin-bottom:5mm;
  font-family:var(--display);font-size:12.8pt;font-weight:700;line-height:1;
  letter-spacing:-.35pt;color:#102033
}
.modelo-secao-title i{width:6.2mm;height:6.2mm;font-size:7.7pt;background:#0d2036}
.modelo-secao-title::after{
  content:'';height:1px;flex:1;margin-left:2mm;
  background:linear-gradient(90deg,#ccd8e6 0%,rgba(204,216,230,0) 100%)
}

.tabela-comparativo{
  grid-template-columns:44mm minmax(0,1fr) minmax(0,1fr);
  border:1px solid #d5e0ec;border-radius:2.7mm;background:#fff;
  box-shadow:0 12px 30px rgba(16,31,51,.085)
}
.tabela-head{
  min-height:11.8mm;padding:1.8mm 3.5mm;display:flex;align-items:center;
  background:#f2f6fb;color:#6e829a;font-size:5.9pt;letter-spacing:1.25pt
}
.tabela-head.seguradora{
  gap:3.2mm;padding:1.7mm 3.2mm;
  background:linear-gradient(110deg,var(--cor),color-mix(in srgb,var(--cor) 78%,#0c2037));
  color:var(--cor-texto)
}
.tabela-head.seguradora strong{font-size:6.2pt;letter-spacing:1.05pt;line-height:1.25}
.tabela-head .selo-logo{
  min-width:31mm;min-height:7.9mm;padding:.8mm 2.2mm;border-radius:1.6mm;
  box-shadow:0 3px 9px rgba(0,0,0,.2)
}
.tabela-head .selo-logo img{max-width:28mm;max-height:5.8mm}
.tabela-head .fallback{font-size:8pt}
.tabela-cobertura,.tabela-celula{
  min-height:11.5mm;padding:2.2mm 3.1mm;border-top:1px solid #d8e2ed
}
.tabela-cobertura{gap:2.5mm;background:#f2f6fb;font-weight:800}
.tabela-cobertura .bolha{
  width:6.3mm;height:6.3mm;border:1px solid #d7e2ee;background:#fff;color:#0d2036;
  box-shadow:0 2px 7px rgba(16,31,51,.09)
}
.tabela-cobertura .bolha .ic{width:3.25mm;height:3.25mm}
.tabela-cobertura span{font-size:7.15pt;line-height:1.2}
.tabela-celula{
  position:relative;background:#fff;color:#455b75;font-size:7.25pt;line-height:1.34
}
.tabela-celula:nth-child(6n+5),.tabela-celula:nth-child(6n+6){background:#f8fafc}
.tabela-celula.coluna-atual{border-left:1.1mm solid color-mix(in srgb,var(--accent) 35%,#e6edf5)}
.tabela-celula.coluna-outra{border-left:1.1mm solid color-mix(in srgb,var(--accent) 35%,#e6edf5)}
.tabela-celula strong{color:#102033}
.tabela-celula .valor-destaque{
  display:inline-block;margin:.05mm .18mm;padding:.08mm .75mm;border-radius:.8mm;
  border:1px solid color-mix(in srgb,var(--accent) 34%,transparent);
  background:color-mix(in srgb,var(--accent) 9%,#fff);
  color:color-mix(in srgb,var(--accent) 70%,#102033);font-weight:900;
  font-variant-numeric:tabular-nums;white-space:nowrap;
  box-shadow:0 1px 3px color-mix(in srgb,var(--accent) 11%,transparent)
}

.valores-grid{gap:4mm}
.valor-card-modelo{
  border:1px solid #d9e3ee;border-radius:2.6mm;
  background:linear-gradient(145deg,#fff 0%,color-mix(in srgb,var(--cor) 4%,#fff) 100%);
  box-shadow:0 9px 25px rgba(16,31,51,.1)
}
.valor-card-modelo::before{height:1.15mm}
.valor-card-modelo-inner{padding:3.7mm 5mm 3.4mm}
.valor-card-modelo .marca-valor{gap:3mm;margin-bottom:3.2mm}
.valor-card-modelo .marca-valor .selo-logo{min-width:26mm;min-height:8mm;padding:.8mm 1.4mm}
.valor-card-modelo .marca-valor .selo-logo img{max-width:24mm;max-height:5.8mm}
.valor-card-modelo .marca-valor span{font-size:6.3pt;letter-spacing:1.25pt}
.valor-card-modelo .valor-total-label{font-size:5.9pt;letter-spacing:1.05pt}
.valor-card-modelo .valor-total{
  margin:1.2mm 0 2.6mm;font-family:var(--display);font-size:18.8pt;
  font-weight:700;letter-spacing:-.35pt;
  color:color-mix(in srgb,var(--cor) 68%,#102033);font-variant-numeric:tabular-nums
}
.valor-card-modelo .pagamentos{padding-top:2.5mm;gap:1.25mm}
.valor-card-modelo .pagamento{font-size:6.8pt;line-height:1.28}
.valor-card-modelo .pagamento .ic{width:3.2mm;height:3.2mm;margin-top:.2mm}
.valor-card-modelo .rodape-card{padding-top:2mm;font-size:5.85pt;line-height:1.28}
.diferenca-total{
  position:relative;overflow:hidden;margin:4.8mm 13mm 0;padding:3mm 4.8mm;
  border:1px solid rgba(255,255,255,.08);border-radius:2.4mm;
  background:linear-gradient(105deg,#0d2036 0%,#132b47 100%);
  box-shadow:0 8px 22px rgba(13,32,54,.15)
}
.diferenca-total::before{
  content:'';position:absolute;inset:0 auto 0 0;width:1.3mm;
  background:linear-gradient(180deg,var(--cur),var(--oth))
}
.diferenca-total span{font-size:6.25pt;letter-spacing:1.4pt}
.diferenca-total strong{
  font-family:var(--display);font-size:14pt;font-weight:700;letter-spacing:-.15pt
}
.rodape{
  margin:auto 13mm 0;padding:5.5mm 0 2.8mm;border:0;
  color:#7d91a9;font-size:5.8pt;line-height:1.42
}
.rodape::before{width:64mm;height:.7mm;margin-bottom:2mm;background:linear-gradient(90deg,var(--cur) 0 50%,var(--oth) 50% 100%)}

/*
 * Cotacoes com descricoes extensas (principalmente Vidros/Assistencia) recebem
 * primeiro uma versao mais densa. Se ainda excederem o A4, o front calcula a
 * escala residual. A compactacao conserva a leitura muito melhor do que
 * reduzir a pagina inteira de uma vez.
 */
.pagina.is-pdf-compact .hero-orcamento{height:27mm;min-height:27mm;padding-top:5.4mm;padding-bottom:4mm}
.pagina.is-pdf-compact .hero-orcamento .titulo{font-size:17.8pt}
.pagina.is-pdf-compact .cliente-modelo .campo{padding-top:1.35mm;padding-bottom:1.4mm}
.pagina.is-pdf-compact .modelo-secao{margin-top:8mm}
.pagina.is-pdf-compact .modelo-secao.valores-secao{margin-top:3.5mm}
.pagina.is-pdf-compact .modelo-secao-title{margin-bottom:3.2mm;font-size:12pt}
.pagina.is-pdf-compact .tabela-head{min-height:9.8mm;padding-top:1.2mm;padding-bottom:1.2mm}
.pagina.is-pdf-compact .tabela-cobertura,
.pagina.is-pdf-compact .tabela-celula{min-height:9.2mm;padding:1.45mm 2.6mm}
.pagina.is-pdf-compact .tabela-cobertura span{font-size:6.7pt}
.pagina.is-pdf-compact .tabela-celula{font-size:6.65pt;line-height:1.25}
.pagina.is-pdf-compact .valor-card-modelo-inner{padding:2.8mm 4.2mm 2.6mm}
.pagina.is-pdf-compact .valor-card-modelo .marca-valor{margin-bottom:2.1mm}
.pagina.is-pdf-compact .valor-card-modelo .valor-total{margin:1mm 0 2mm;font-size:17.5pt}
.pagina.is-pdf-compact .valor-card-modelo .pagamentos{padding-top:1.8mm;gap:.9mm}
.pagina.is-pdf-compact .valor-card-modelo .pagamento{font-size:6.25pt}
.pagina.is-pdf-compact .diferenca-total{margin-top:3.3mm;padding-top:2.4mm;padding-bottom:2.4mm}
.pagina.is-pdf-compact .rodape{padding-top:3.2mm;padding-bottom:2mm;font-size:5.35pt}

@media print{
  html,body{width:210mm;height:297mm;min-height:297mm;background:#fff}
  .acoes-doc{display:none!important}
  .pagina{width:210mm;height:297mm;min-height:297mm;margin:0!important;box-shadow:none!important}
  .pagina-conteudo{
    width:var(--pdf-layout-width,100%);min-height:var(--pdf-layout-height,297mm);
    transform:scale(var(--pdf-scale,1));transform-origin:top left
  }
}
`

/*
 * Modelo comercial aprovado em 01/09/2026.
 *
 * Esta camada substitui somente a apresentacao. A estrutura de dados, a
 * validacao e a leitura dos PDFs continuam exatamente nas funcoes existentes.
 * Preview e download recebem o mesmo HTML para nunca divergirem.
 */
const CSS_MODELO_APROVADO = `
html,body{background:#e7edf2}
body{font-family:var(--sans);font-size:7.5pt;line-height:1.38;color:#142437}
.pagina{
  --navy:#102842;--navy-2:#173956;--soft:#f4f7f9;--line-soft:#d9e3eb;
  position:relative;width:210mm;min-height:297mm;margin:7mm auto 18mm;
  overflow:hidden;background:#fff;box-shadow:0 22px 70px rgba(8,25,46,.2)
}
.pagina::before{
  content:'';position:absolute;z-index:0;left:0;top:0;bottom:0;width:4mm;
  background:linear-gradient(180deg,var(--navy) 0 82%,var(--cur) 82% 91%,var(--oth) 91% 100%)
}
.pagina::after{
  content:'';position:absolute;z-index:0;right:-30mm;top:-35mm;width:84mm;height:84mm;
  border-radius:50%;border:15mm solid #f2f6f8
}
.pagina-conteudo{
  position:relative;z-index:1;width:100%;min-height:297mm;padding:9mm 12mm 6.5mm 15mm;
  display:flex;flex-direction:column;transform-origin:top left
}
.hero-orcamento{
  position:relative;height:auto;min-height:18mm;padding:0;display:grid;
  grid-template-columns:29mm 1fr auto;align-items:center;gap:7mm;
  overflow:visible;color:#142437;background:none
}
.hero-orcamento::before,.hero-orcamento::after{content:none}
.hero-orcamento .marca{
  display:flex;width:27mm;height:18mm;min-width:27mm;min-height:18mm;padding:2mm 3mm;
  align-items:center;justify-content:center;border:1px solid var(--line-soft);
  border-radius:3mm;background:#fff;box-shadow:0 5px 16px rgba(16,40,66,.08)
}
.hero-orcamento .marca img{max-width:20mm;max-height:13mm}
.hero-titulos{padding:0;text-align:left}
.hero-kicker{
  margin:0 0 1mm;font-family:var(--sans);font-size:5.8pt;font-weight:800;
  letter-spacing:2.1pt;text-transform:uppercase;color:#8292a3
}
.hero-orcamento .titulo{
  font-family:var(--display);font-size:19.5pt;font-weight:700;line-height:1;
  letter-spacing:-.7pt;color:var(--navy);white-space:nowrap
}
.documento-orcamento{text-align:right;color:#728295;font-size:6.5pt;line-height:1.65}
.documento-orcamento .doc-pill{
  display:inline-block;margin-bottom:1.2mm;padding:1mm 2.1mm;border:1px solid #dce5ec;
  border-radius:99px;background:#fff;font-size:5.3pt;font-weight:800;
  letter-spacing:1pt;text-transform:uppercase;color:#65778a
}
.documento-orcamento .meta{margin:0;font-family:var(--sans);font-size:6.5pt;letter-spacing:0;text-transform:none;color:#728295}
.documento-orcamento .meta span{display:block}.documento-orcamento .meta span:first-child{font-family:var(--display);font-size:8pt;font-weight:700;color:#142437}
.documento-orcamento .meta span+span::before{content:none}
.promessa-orcamento{
  display:flex;align-items:flex-end;justify-content:space-between;gap:10mm;
  margin-top:6mm;padding-bottom:3.8mm;border-bottom:1px solid var(--line-soft)
}
.promessa-orcamento h2{
  max-width:105mm;font-family:var(--display);font-size:14.6pt;line-height:1.12;
  font-weight:650;letter-spacing:-.35pt;color:var(--navy)
}
.promessa-orcamento p{max-width:59mm;text-align:right;color:#6d7f91;font-size:7pt}
.cliente-modelo{
  position:relative;z-index:2;margin:4mm 0 0;border:1px solid var(--line-soft);
  border-radius:3mm;background:#fff;box-shadow:0 6px 18px rgba(16,40,66,.055);overflow:hidden
}
.perfil-titulo{
  display:flex;align-items:center;justify-content:space-between;padding:1.8mm 4mm;
  background:linear-gradient(90deg,var(--navy),var(--navy-2));color:#fff
}
.perfil-titulo strong{font-size:5.7pt;letter-spacing:1.35pt;text-transform:uppercase}
.perfil-titulo span{font-size:5.5pt;color:#bdcbd7}
.cliente-linha.superior{grid-template-columns:1.05fr 1.25fr .55fr}
.cliente-linha.inferior{grid-template-columns:1.55fr .55fr .6fr;border-top:1px solid var(--line-soft);background:var(--soft)}
.cliente-modelo .campo{min-width:0;padding:2.1mm 4mm}
.cliente-modelo .campo+.campo{border-left:1px solid var(--line-soft)}
.cliente-modelo .rotulo{margin-bottom:.55mm;font-size:5.2pt;font-weight:850;letter-spacing:1.25pt;color:#8494a4}
.cliente-modelo .valor{font-family:var(--display);font-size:8pt;font-weight:700;line-height:1.18;letter-spacing:0;color:#142437}
.cliente-modelo .valor small{display:block;margin-top:.4mm;font-family:var(--sans);font-size:6.1pt;font-weight:400;color:#687b8e}
.cliente-modelo .campo.tipo{display:block}.cliente-modelo .selo-tipo{display:inline-flex;width:max-content;padding:1.45mm 2.5mm;border-radius:1.3mm;background:var(--navy);font-size:6pt;letter-spacing:1.1pt}
.aviso-divergencia{margin:3mm 0 0;padding:2.2mm 3.4mm;border-radius:1.5mm}
.modelo-secao{margin:5.5mm 0 0}.modelo-secao.valores-secao{margin-top:4.8mm}
.modelo-secao-title{gap:3mm;margin-bottom:2.8mm;font-size:11.4pt;letter-spacing:-.25pt;color:var(--navy)}
.modelo-secao-title i{width:6mm;height:6mm;font-size:6.7pt;background:var(--navy)}
.modelo-secao-title::after{margin-left:1mm;background:linear-gradient(90deg,#ced8e1,transparent)}
.valores-grid{gap:4.5mm}
.valor-card-modelo{
  position:relative;border:1px solid var(--line-soft);border-radius:3.3mm;
  background:linear-gradient(145deg,#fff 0%,color-mix(in srgb,var(--cor) 4%,#fff) 100%);
  box-shadow:0 10px 25px rgba(16,40,66,.08)
}
.valor-card-modelo::before{position:absolute;left:0;top:0;bottom:0;width:1.5mm;height:auto;background:var(--cor)}
.valor-card-modelo-inner{padding:3.6mm 5.5mm 3.5mm 7mm}
.valor-card-modelo .marca-valor{display:flex;align-items:center;justify-content:space-between;gap:4mm;margin:0}
.valor-card-modelo .marca-contexto{display:flex;min-width:0;flex-direction:column;align-items:flex-start;gap:.7mm}
.valor-card-modelo .marca-contexto>span{display:inline-flex;align-items:center;gap:1mm;font-size:5.4pt;font-weight:850;letter-spacing:1.25pt;color:#8090a1;text-transform:uppercase}
.valor-card-modelo .marca-contexto>span::before{content:'';width:1.6mm;height:1.6mm;border-radius:50%;background:var(--cor)}
.produto-suhai{display:inline-flex;max-width:58mm;align-items:center;gap:1.2mm;padding:.75mm 1.5mm;border:1px solid color-mix(in srgb,var(--cor) 24%,#dce5ec);border-radius:99px;background:color-mix(in srgb,var(--cor) 7%,#fff);font-family:var(--display);font-size:6.1pt;font-weight:750;line-height:1.15;color:color-mix(in srgb,var(--cor) 82%,#102842)}
.produto-suhai::before{content:'Produto';font-family:var(--sans);font-size:4.5pt;font-weight:850;letter-spacing:.7pt;text-transform:uppercase;color:#788a9b}
.valor-card-modelo .marca-valor .selo-logo{min-width:31mm;height:8.5mm;min-height:8.5mm;padding:1mm 2mm;border:1px solid color-mix(in srgb,var(--cor) 25%,#dfe6ec);border-radius:2mm;background:#fff;box-shadow:none}
.valor-card-modelo .marca-valor .selo-logo img{max-width:28mm;max-height:6mm}
.valor-card-modelo .marca-valor .fallback{font-family:var(--display);font-size:10pt;font-weight:750;color:var(--cor)}
.valor-card-modelo .valor-total-label{margin-top:2.7mm;font-size:5.3pt;letter-spacing:1.2pt;color:#8a98a7}
.valor-card-modelo .valor-total{margin:.65mm 0 2.7mm;font-size:20.5pt;line-height:1;letter-spacing:-.55pt;color:color-mix(in srgb,var(--cor) 80%,#102842)}
.valor-card-modelo .pagamentos{display:flex;flex-direction:row;flex-wrap:wrap;gap:1.4mm 4mm;padding-top:2.4mm;border-top:1px solid var(--line-soft)}
.valor-card-modelo .pagamento{flex:1 1 45%;min-width:0;font-size:6.35pt;line-height:1.28;color:#536578}
.valor-card-modelo .pagamento .ic{width:3mm;height:3mm;color:#6e8194}
.valor-card-modelo .rodape-card{padding-top:1.6mm;font-size:5.25pt;color:#7b8b9b}
.tabela-comparativo{grid-template-columns:42mm minmax(0,1fr) minmax(0,1fr);border:1px solid var(--line-soft);border-radius:3mm;background:#fff;box-shadow:none}
.tabela-head{min-height:auto;padding:1.9mm 3.2mm;background:var(--soft);font-size:5.25pt;letter-spacing:1.15pt;color:#7b8b9b}
.tabela-head.seguradora{gap:2mm;padding:1.3mm 3.2mm;background:var(--soft);color:var(--cor)}
.tabela-head.seguradora strong{font-size:5.25pt;letter-spacing:1.15pt;color:var(--cor)}
.tabela-head .cabecalho-seguradora{display:flex;min-width:0;flex-direction:column;align-items:flex-start;gap:.65mm}
.tabela-head .produto-suhai-mini{max-width:100%;overflow:hidden;text-overflow:ellipsis;font-family:var(--display);font-size:4.65pt;font-weight:800;letter-spacing:0;text-transform:none;white-space:nowrap;color:color-mix(in srgb,var(--cor) 82%,#102842)}
.tabela-head .selo-logo{min-width:19mm;min-height:5.5mm;padding:.4mm 1mm;border:0;background:transparent;box-shadow:none}
.tabela-head .selo-logo img{max-width:18mm;max-height:4.4mm}.tabela-head .fallback{font-size:6.5pt;color:var(--cor)}
.tabela-cobertura,.tabela-celula{min-height:10.5mm;padding:1.9mm 3.2mm;border-top:1px solid var(--line-soft)}
.tabela-cobertura{gap:2.6mm;background:#f8fafb}.tabela-cobertura .bolha{width:5.7mm;height:5.7mm;border:1px solid #d6e0e8;box-shadow:0 2px 6px rgba(16,40,66,.07)}
.tabela-cobertura .bolha .ic{width:3mm;height:3mm}.tabela-cobertura span{font-size:6.8pt}
.tabela-celula{background:#fff;font-size:6.6pt;line-height:1.3;color:#4e6277}
.tabela-celula:nth-child(6n+5),.tabela-celula:nth-child(6n+6){background:#fff}
.tabela-celula.coluna-atual,.tabela-celula.coluna-outra{border-left:.8mm solid color-mix(in srgb,var(--accent) 34%,#fff)}
.tabela-celula .valor-destaque{padding:.05mm .65mm;border:0;border-radius:.8mm;background:color-mix(in srgb,var(--accent) 10%,#fff);color:color-mix(in srgb,var(--accent) 80%,#102842);box-shadow:none}
.diferenca-total{display:grid;grid-template-columns:1.2fr .8fr;gap:0;margin:4mm 0 0;padding:0;border:0;border-radius:2.7mm;background:var(--navy);box-shadow:0 7px 18px rgba(16,40,66,.12)}
.diferenca-total::before{content:none}.diferenca-total>div{padding:3mm 4.5mm}.diferenca-total>div+div{border-left:1px solid rgba(255,255,255,.16)}
.diferenca-total span{display:block;font-family:var(--sans);font-size:5.3pt;font-weight:850;letter-spacing:1.2pt;color:#a9bacb}
.diferenca-total p{margin-top:.7mm;font-size:6.8pt;color:#d7e0e8}.diferenca-total strong{display:block;font-size:13.5pt;line-height:1;text-align:right;color:#fff}.diferenca-total small{display:block;margin-top:.6mm;text-align:right;color:#aebdcb}
.rodape{margin:auto 0 0;padding:3.7mm 0 0;border-top:1px solid var(--line-soft);font-size:5.45pt;line-height:1.4;color:#8493a2}.rodape::before{content:none}.rodape .contato{float:right;margin-top:0;text-align:right;color:#5e7082}
.pagina.is-pdf-compact .hero-orcamento{height:auto;min-height:16mm;padding:0}.pagina.is-pdf-compact .hero-orcamento .titulo{font-size:18.2pt}.pagina.is-pdf-compact .promessa-orcamento{margin-top:4mm}.pagina.is-pdf-compact .cliente-modelo .campo{padding:1.5mm 3.5mm}.pagina.is-pdf-compact .modelo-secao{margin-top:4mm}.pagina.is-pdf-compact .modelo-secao.valores-secao{margin-top:3.5mm}.pagina.is-pdf-compact .tabela-head{min-height:auto}.pagina.is-pdf-compact .tabela-cobertura,.pagina.is-pdf-compact .tabela-celula{min-height:9mm;padding:1.35mm 2.7mm}.pagina.is-pdf-compact .valor-card-modelo-inner{padding:2.8mm 4.5mm 2.7mm 6mm}.pagina.is-pdf-compact .valor-card-modelo .valor-total{font-size:18pt}
@media print{.pagina-conteudo{padding:9mm 12mm 6.5mm 15mm}}
`

// ─── Blocos ────────────────────────────────────────────────────────────

const ROTULO_PAPEL = { atual: 'Seguradora atual', outra: 'Outra seguradora', opcao_1: 'Opção 1', opcao_2: 'Opção 2', opcao_3: 'Opção 3', opcao_4: 'Opção 4' }

/**
 * Selo branco com a logo da seguradora.
 *
 * A logo vem do cadastro (`seguradoras.logo_url`), nunca recortada do PDF da
 * cotacao. Quando a seguradora nao tem logo cadastrada, cai para o nome em
 * serifada dentro do mesmo selo — o card continua legivel e a falta fica
 * visivel, em vez de abrir um buraco branco no documento.
 */
function selo(seguradora) {
  const logoEmbutida = logoEmbutidaDaSeguradora(seguradora.nome)
  const logo = logoEmbutida || seguradora.logo_url
  const conteudo = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(seguradora.nome)}">`
    : `<span class="fallback">${escapeHtml(seguradora.nome)}</span>`
  return `<div class="selo-logo">${conteudo}</div>`
}

const LOGO_PIER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 92" role="img" aria-label="Pier">
    <text x="150" y="68" text-anchor="middle" font-family="Arial Black,Arial,sans-serif"
      font-size="66" font-weight="900" letter-spacing="5" fill="#ff7599">PIER.</text>
  </svg>
`)}`

function logoEmbutidaDaSeguradora(nome) {
  const chave = String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (chave.includes('pier')) return LOGO_PIER
  return ''
}

function produtoSuhai(card) {
  const nome = String(card?.seguradora?.nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (!nome.includes('suhai')) return ''
  return String(card?.produto?.label || '').trim()
}

/**
 * Calcula o ultimo ajuste necessario para a impressao caber em uma pagina.
 * A pagina ja passou pelo modo compacto quando esta funcao e chamada.
 */
export function calcularEscalaImpressao(alturaConteudo, alturaPagina, folga = 6) {
  const conteudo = Number(alturaConteudo)
  const pagina = Number(alturaPagina)
  const respiro = Math.max(0, Number(folga) || 0)
  if (!(conteudo > 0) || !(pagina > 0)) return 1
  return Math.min(1, Math.max(0.01, (pagina - respiro) / conteudo))
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

function resumoPreco(card) {
  const s = card.seguradora
  const estilo = `--cor:${s.cor}`
  return `<div class="resumo-preco" style="${estilo}">
    <div>
      <span>${escapeHtml(ROTULO_PAPEL[card.papel] || 'Cotação')}</span>
      <strong>${escapeHtml(s.nome || 'Seguradora')}</strong>
    </div>
    <b>${escapeHtml(card.valores.total_formatado || '—')}</b>
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

function textoCategoriaTabela(card, categoria) {
  const item = card.categorias.find(cat => cat.key === categoria.key)
  if (!item) return { texto: 'Não oferecido nesta cotação', classe: ' is-empty' }
  if (item.estado === 'nao_incluida') return { texto: item.texto || 'Não incluso nesta cotação', classe: ' is-negative' }
  if (item.estado === 'nao_informado') return { texto: item.texto || 'Não informado', classe: ' is-empty' }
  return { texto: item.texto || 'Não oferecido nesta cotação', classe: item.texto ? '' : ' is-empty' }
}

function destacarValoresImportantes(texto, categoriaKey) {
  const seguro = escapeHtml(texto)
  if (!['terceiros', 'franquia'].includes(categoriaKey)) return seguro
  return seguro.replace(
    /(R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d{1,3}(?:\.\d{3})+)(%?)/g,
    '<span class="valor-destaque">$&</span>',
  )
}

function blocoTabelaCoberturas(cards) {
  const cabecalho = card => {
    const s = card.seguradora
    const estilo = `--cor:${s.cor};--cor-texto:${s.cor_texto}`
    const produto = produtoSuhai(card)
    return `<div class="tabela-head seguradora" style="${estilo}">
      <div class="cabecalho-seguradora">
        ${selo(s)}
        ${produto ? `<span class="produto-suhai-mini">Produto: ${escapeHtml(produto)}</span>` : ''}
      </div>
    </div>`
  }

  const linhas = CATEGORIAS_COBERTURA.map(categoria => {
    return `
      <div class="tabela-cobertura">
        <div class="bolha">${icone(categoria.icone)}</div>
        <span>${escapeHtml(categoria.label)}</span>
      </div>
      ${cards.map(card => {
        const celula = textoCategoriaTabela(card, categoria)
        return `<div class="tabela-celula${celula.classe}" style="--accent:${escapeHtml(card.seguradora.cor)}">${destacarValoresImportantes(celula.texto, categoria.key)}</div>`
      }).join('')}`
  }).join('')

  return `<section class="modelo-secao">
    <h2 class="modelo-secao-title"><i>1</i><span>Coberturas comparadas</span></h2>
    <div class="tabela-comparativo" data-options="${cards.length}" style="grid-template-columns:${cards.length > 2 ? '42mm' : '50mm'} repeat(${cards.length},minmax(0,1fr))">
      <div class="tabela-head">Cobertura</div>
      ${cards.map(cabecalho).join('')}
      ${linhas}
    </div>
  </section>`
}

function blocoPagamentoModelo(card) {
  const s = card.seguradora
  const estilo = `--cor:${s.cor}`
  const produto = produtoSuhai(card)
  const linhas = Array.isArray(card.valores.parcelamento)
    ? card.valores.parcelamento
    : String(card.valores.parcelamento || '').split('\n')

  const pagamentos = linhas
    .map(l => String(l).trim())
    .filter(Boolean)
    .map(l => `<div class="pagamento">${icone(iconePagamento(l))}<span>${escapeHtml(l)}</span></div>`)
    .join('')

  return `<article class="valor-card-modelo" style="${estilo}">
    <div class="valor-card-modelo-inner">
      <div class="marca-valor">
        <div class="marca-contexto">
          <span>${escapeHtml(ROTULO_PAPEL[card.papel] || 'Cotação')}</span>
          ${produto ? `<strong class="produto-suhai">${escapeHtml(produto)}</strong>` : ''}
        </div>
        ${selo(s)}
      </div>
      <div class="valor-total-label">Valor total (com IOF)</div>
      <div class="valor-total">${escapeHtml(card.valores.total_formatado || '—')}</div>
      ${pagamentos ? `<div class="pagamentos">${pagamentos}</div>` : ''}
      ${card.rodape ? `<div class="rodape-card"><b>Condições Gerais:</b> <i>${escapeHtml(card.rodape)}</i></div>` : ''}
    </div>
  </article>`
}

function blocoValoresCondicoes(cards) {
  return `<section class="modelo-secao valores-secao">
    <div class="valores-grid" data-options="${cards.length}" style="grid-template-columns:repeat(${cards.length},minmax(0,1fr))">
      ${cards.map(blocoPagamentoModelo).join('')}
    </div>
  </section>`
}

function blocoDiferenca(cards) {
  const valores = cards.map(card => Number(card.valores?.total)).filter(Number.isFinite)
  if (valores.length < 2) return ''
  return `<div class="diferenca-total">
    <div><span>Resumo financeiro</span><p>Os valores refletem as condições apresentadas em cada cotação e podem mudar até a emissão.</p></div>
    <div><span>${valores.length === 2 ? 'Diferença entre as propostas' : 'Diferença entre menor e maior'}</span><strong>${escapeHtml(formatarMoeda(Math.max(...valores) - Math.min(...valores)))}</strong><small>no prêmio total</small></div>
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
export function montarHtmlOrcamento(comparativo, { logoConves = '/conves-logo.png', contato = CONTATO_PADRAO, comAcoes = false } = {}) {
  const { cabecalho, cliente, cards, divergencias = [] } = comparativo

  const meta = [
    cabecalho.referencia ? `Nº ${cabecalho.referencia}` : '',
    cabecalho.emitido_em_formatado ? `Emitido ${cabecalho.emitido_em_formatado}` : '',
    cabecalho.validade_dias ? `Válido por ${cabecalho.validade_dias} dias` : '',
  ].filter(Boolean).map(t => `<span>${escapeHtml(t)}</span>`).join('')

  const veiculoLinha2 = [cliente.ano_modelo, cliente.placa ? `Placa ${cliente.placa}` : '']
    .filter(Boolean).join(' · ')

  const seguradoDetalhe = cliente.segurado_documento ? `CPF ${cliente.segurado_documento}` : ''
  const condutorDetalhe = [
    cliente.condutor_documento ? `CPF ${cliente.condutor_documento}` : '',
    cliente.condutor_nascimento ? `nasc. ${cliente.condutor_nascimento}` : '',
  ].filter(Boolean).join(' · ')
  const corAtual = cards?.[0]?.seguradora?.cor || '#9c7328'
  const corOutra = cards?.[1]?.seguradora?.cor || '#1c4a87'

  // Divergencia entre os PDFs vira aviso IMPRESSO, nao so alerta de tela:
  // se o corretor gerou assim mesmo, quem le o documento precisa saber.
  const aviso = divergencias.length
    ? `<div class="aviso-divergencia"><b>Atenção:</b> as cotações divergem em
       ${escapeHtml(divergencias.map(d => d.label.toLowerCase()).join(', '))}. Confira antes de enviar ao cliente.</div>`
    : ''

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Orçamento Comparativo${cabecalho.referencia ? ` ${escapeHtml(cabecalho.referencia)}` : ''}</title>
<style>${CSS}${CSS_MODELO_OFICIAL}${CSS_MODELO_APROVADO}</style>
</head>
<body>
${comAcoes ? `<nav class="acoes-doc" aria-label="Ações da cotação">
  <div><strong>Cotação pronta para conferência</strong><span>Revise o documento e baixe uma cópia em PDF.</span></div>
  <div class="botoes"><button type="button" onclick="window.close()">Fechar</button><button class="primario" type="button" onclick="window.print()">Baixar PDF</button></div>
</nav>` : ''}
<div class="pagina" style="--cur:${escapeHtml(corAtual)};--oth:${escapeHtml(corOutra)}">
 <div class="pagina-conteudo">
  <header class="hero-orcamento">
    <div class="marca"><img src="${escapeHtml(logoConves)}" alt="Convés Seguros"></div>
    <div class="hero-titulos">
      <span class="hero-kicker">Convés Corretora de Seguros</span>
      <h1 class="titulo">Comparativo Seguro Auto</h1>
    </div>
    <div class="documento-orcamento"><span class="doc-pill">Proposta personalizada</span><div class="meta">${meta}</div></div>
  </header>

  <section class="promessa-orcamento">
    <h2>${cards.length === 2 ? 'Duas opções' : `${cards.length} opções`} de proteção.<br>Uma escolha mais clara.</h2>
    <p>Comparamos preço, perfil do risco e coberturas para você decidir com segurança e tranquilidade.</p>
  </section>

  <section class="cliente-modelo">
    <div class="perfil-titulo"><strong>Perfil considerado nesta cotação</strong><span>Confira os dados antes de decidir</span></div>
    <div class="cliente-linha superior">
      <div class="campo">
        <span class="rotulo">Segurado</span>
        <div class="valor">${escapeHtml(cliente.segurado || '—')}${seguradoDetalhe ? ` <small>· ${escapeHtml(seguradoDetalhe)}</small>` : ''}</div>
      </div>
      <div class="campo">
        <span class="rotulo">Condutor principal</span>
        <div class="valor">${escapeHtml(cliente.condutor || cards?.[0]?.identificacao?.condutor || '—')}${condutorDetalhe ? ` <small>· ${escapeHtml(condutorDetalhe)}</small>` : ''}</div>
      </div>
      <div class="campo tipo">
        <span class="rotulo">Tipo de cotação</span>
        <span class="selo-tipo">${escapeHtml(cliente.tipo_operacao_label || '—')}</span>
      </div>
    </div>
    <div class="cliente-linha inferior">
      <div class="campo veiculo">
        <span class="rotulo">Veículo</span>
        <div class="valor">${escapeHtml(cliente.veiculo || '—')}${veiculoLinha2 ? `<small>${escapeHtml(veiculoLinha2)}</small>` : ''}</div>
      </div>
      <div class="campo">
        <span class="rotulo">Utilização</span>
        <div class="valor">${escapeHtml(cards?.[0]?.identificacao?.uso || cards?.[1]?.identificacao?.uso || '—')}</div>
      </div>
      <div class="campo">
        <span class="rotulo">CEP de pernoite</span>
        <div class="valor">${escapeHtml(cliente.cep_pernoite || cards?.[0]?.identificacao?.cep_pernoite || '—')}</div>
      </div>
    </div>
  </section>

  ${aviso}

  ${blocoValoresCondicoes(cards)}
  ${blocoTabelaCoberturas(cards)}
  ${blocoDiferenca(cards)}

  <footer class="rodape">
    Orçamento comparativo simplificado, elaborado pela Convés Seguros a partir das cotações oficiais
    e das Condições Gerais vigentes de cada seguradora — valores sujeitos à análise de risco e podem
    mudar até a emissão da apólice.
    <div class="contato">${escapeHtml(contato.razao)} · ${escapeHtml(contato.email)} · ${escapeHtml(contato.telefone)}</div>
  </footer>
 </div>
</div>
</body>
</html>`
}
