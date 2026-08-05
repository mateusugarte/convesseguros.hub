/**
 * Conves Hub — endpoint de leitura das respostas do Google Forms.
 *
 * Serve a conciliacao "Verificar fichas": devolve em JSON as respostas dos
 * ultimos N dias para o sistema comparar com a tabela `fichas` do Supabase e
 * apontar o que nunca chegou (tipicamente porque o `onFormSubmit` falhou).
 *
 * ── Instalacao ───────────────────────────────────────────────────────────────
 * 1. Abra a PLANILHA DE RESPOSTAS do Forms > Extensoes > Apps Script.
 *    (Pode ser o mesmo projeto que ja tem o onFormSubmit, ou um novo.)
 * 2. Cole este arquivo.
 * 3. Configuracoes do projeto > Propriedades do script > adicione:
 *       CONVES_TOKEN = <uma senha longa e aleatoria, so sua>
 *    Opcional, se o script NAO estiver vinculado a planilha:
 *       PLANILHA_ID  = <id da planilha, o trecho entre /d/ e /edit da URL>
 *       ABA          = <nome da aba, se nao for a primeira>
 * 4. Rode a funcao `teste()` uma vez e autorize o acesso. Veja o log: precisa
 *    listar a planilha, a aba e a quantidade de linhas na janela.
 * 5. Implantar > Nova implantacao > tipo "App da Web":
 *       Executar como:        Eu
 *       Quem pode acessar:    Qualquer pessoa
 *    O acesso publico e obrigatorio para o servidor conseguir chamar sem login
 *    do Google; quem protege o endpoint e o CONVES_TOKEN, sem ele a resposta e
 *    401 e nenhum dado sai daqui.
 * 6. Copie a URL /exec e cadastre no sistema (variaveis FICHAS_SHEET_URL e
 *    FICHAS_SHEET_TOKEN na Vercel).
 *
 * IMPORTANTE: toda vez que alterar este arquivo, publique uma NOVA VERSAO da
 * implantacao. Editar o codigo sem reimplantar nao muda o que a URL responde.
 */

var DIAS_PADRAO = 30;
var DIAS_MAX = 180;
var LIMITE_LINHAS = 2000;

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var tokenEsperado = PropertiesService.getScriptProperties().getProperty('CONVES_TOKEN');

    if (!tokenEsperado) {
      return responder({ ok: false, erro: 'CONVES_TOKEN nao configurado nas propriedades do script.' });
    }
    if (String(params.token || '') !== String(tokenEsperado)) {
      return responder({ ok: false, erro: 'Token invalido.' });
    }

    var dias = parseInt(params.dias, 10);
    if (isNaN(dias) || dias <= 0) dias = DIAS_PADRAO;
    if (dias > DIAS_MAX) dias = DIAS_MAX;

    return responder(lerRespostas(dias));
  } catch (err) {
    return responder({ ok: false, erro: String((err && err.message) || err) });
  }
}

/**
 * Le a aba de respostas e devolve as linhas dentro da janela de `dias`.
 * Cada linha vira { linha, timestamp, dados } onde `dados` usa exatamente os
 * mesmos rotulos de pergunta do Forms — e o mesmo formato que o onFormSubmit
 * envia ao n8n, entao a reimportacao passa pelo caminho oficial sem traducao.
 */
function lerRespostas(dias) {
  var planilha = abrirPlanilha();
  var aba = abrirAba(planilha);
  var ultimaLinha = aba.getLastRow();
  var ultimaColuna = aba.getLastColumn();

  if (ultimaLinha < 2 || ultimaColuna < 1) {
    return {
      ok: true,
      planilha: planilha.getName(),
      aba: aba.getName(),
      janela_dias: dias,
      total_linhas: 0,
      linhas: [],
    };
  }

  var intervalo = aba.getRange(1, 1, ultimaLinha, ultimaColuna);
  // getValues preserva o tipo Date do carimbo; getDisplayValues preserva o
  // texto como o usuario ve (CPF com zero a esquerda, telefone formatado),
  // que e o que o Forms enviaria. Precisamos dos dois.
  var brutos = intervalo.getValues();
  var exibidos = intervalo.getDisplayValues();

  var cabecalho = exibidos[0].map(function (titulo) { return String(titulo || '').trim(); });
  var colunaData = descobrirColunaData(brutos);
  var corte = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  var fuso = planilha.getSpreadsheetTimeZone();

  var linhas = [];
  // De baixo para cima: as respostas recentes ficam no fim da planilha, entao
  // paramos assim que sair da janela em vez de varrer anos de historico.
  for (var i = brutos.length - 1; i >= 1; i--) {
    var carimbo = colunaData >= 0 ? brutos[i][colunaData] : null;
    var data = carimbo instanceof Date ? carimbo : null;

    if (data && data < corte) break;
    if (linhaVazia(exibidos[i])) continue;

    var dados = {};
    for (var c = 0; c < cabecalho.length; c++) {
      if (!cabecalho[c]) continue;
      var valor = exibidos[i][c];
      dados[cabecalho[c]] = valor === null || valor === undefined ? '' : String(valor);
    }

    linhas.push({
      linha: i + 1,
      timestamp: data ? data.toISOString() : null,
      timestamp_local: data ? Utilities.formatDate(data, fuso, 'dd/MM/yyyy HH:mm') : null,
      dados: dados,
    });

    if (linhas.length >= LIMITE_LINHAS) break;
  }

  linhas.reverse();

  return {
    ok: true,
    planilha: planilha.getName(),
    aba: aba.getName(),
    janela_dias: dias,
    coluna_data: colunaData >= 0 ? cabecalho[colunaData] : null,
    total_linhas: linhas.length,
    linhas: linhas,
  };
}

function abrirPlanilha() {
  var id = PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
  if (id) return SpreadsheetApp.openById(id);

  var ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (!ativa) {
    throw new Error('Script nao esta vinculado a uma planilha. Configure a propriedade PLANILHA_ID.');
  }
  return ativa;
}

function abrirAba(planilha) {
  var nome = PropertiesService.getScriptProperties().getProperty('ABA');
  if (nome) {
    var escolhida = planilha.getSheetByName(nome);
    if (!escolhida) throw new Error('Aba "' + nome + '" nao encontrada na planilha.');
    return escolhida;
  }
  return planilha.getSheets()[0];
}

/** Acha a coluna do carimbo de data/hora pelo tipo do valor, nao pelo rotulo. */
function descobrirColunaData(brutos) {
  for (var linha = 1; linha < brutos.length; linha++) {
    for (var col = 0; col < brutos[linha].length; col++) {
      if (brutos[linha][col] instanceof Date) return col;
    }
  }
  return -1;
}

function linhaVazia(valores) {
  for (var i = 0; i < valores.length; i++) {
    if (String(valores[i] || '').trim() !== '') return false;
  }
  return true;
}

function responder(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Rode manualmente no editor para validar acesso e leitura antes de implantar. */
function teste() {
  var r = lerRespostas(DIAS_PADRAO);
  Logger.log('Planilha: %s | Aba: %s', r.planilha, r.aba);
  Logger.log('Coluna de data: %s', r.coluna_data);
  Logger.log('Linhas nos ultimos %s dias: %s', r.janela_dias, r.total_linhas);
  if (r.linhas.length) {
    Logger.log('Rotulos lidos: %s', Object.keys(r.linhas[r.linhas.length - 1].dados).join(' | '));
    Logger.log('Ultima resposta: %s', JSON.stringify(r.linhas[r.linhas.length - 1]));
  }
}
