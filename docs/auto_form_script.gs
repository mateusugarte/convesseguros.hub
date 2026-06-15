function enviarParaN8n(e) {
  var urlN8n = "https://aula-n8n.4ddtww.easypanel.host/webhook/8b5cd43d-6055-4f24-a2cb-7c7102b68ca3";

  var respostas = e.response.getItemResponses();
  var dados = {};
  for (var i = 0; i < respostas.length; i++) {
    dados[respostas[i].getItem().getTitle()] = respostas[i].getResponse();
  }
  dados["timestamp"] = new Date().toISOString();
  dados["formulario"] = "Seguro Auto";

  var payload = JSON.stringify(dados);
  var options = {
    method: "POST",
    contentType: "application/json",
    payload: payload,
    muteHttpExceptions: true
  };

  // Retry: até 3 tentativas com 2s de espera entre elas
  var maxTentativas = 3;
  var tentativa = 0;
  var sucesso = false;

  while (tentativa < maxTentativas && !sucesso) {
    try {
      var response = UrlFetchApp.fetch(urlN8n, options);
      var codigo = response.getResponseCode();
      if (codigo >= 200 && codigo < 300) {
        sucesso = true;
      } else {
        tentativa++;
        if (tentativa < maxTentativas) Utilities.sleep(2000);
      }
    } catch (erro) {
      tentativa++;
      if (tentativa < maxTentativas) Utilities.sleep(2000);
    }
  }
}
