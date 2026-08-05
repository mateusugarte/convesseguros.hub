# Verificar fichas — conciliação Forms x sistema

Compara as respostas da planilha do Google Forms com a tabela `fichas` e aponta o que nunca
chegou ao sistema. Existe porque o caminho de entrada tem um ponto cego:

```
Google Forms → Apps Script (onFormSubmit) → webhook n8n → INSERT fichas
                     ↑
          falhou aqui = resposta fica só na planilha, sem nenhum alarme
```

## Peças

| Peça | Arquivo | Papel |
|---|---|---|
| Endpoint da planilha | `apps-script/verificar-fichas.gs` | Web App que devolve as respostas dos últimos N dias em JSON |
| Regra de comparação | `src/lib/fichasConciliacao.js` | Pura, sem I/O. Testada em `fichasConciliacao.test.mjs` |
| Ponte servidor | `api/verificar-fichas.js` | Autentica, lê planilha + fichas, concilia, reimporta |
| Cliente | `src/lib/fichasVerificacao.js` | Chama a rota com o JWT da sessão |
| Tela | `src/components/ModalVerificarFichas.jsx` | Botão em `/fichas` e no header de produto |

## Instalação (uma vez por formulário)

### 1. Apps Script

1. Planilha de respostas do Forms → **Extensões → Apps Script**.
2. Cole `apps-script/verificar-fichas.gs`.
3. **Configurações do projeto → Propriedades do script**:
   - `CONVES_TOKEN` = senha longa e aleatória (é o que protege o endpoint).
   - `PLANILHA_ID` e `ABA`: só se o script não estiver vinculado à planilha.
4. Rode `teste()` no editor, autorize, confira o log (planilha, aba, nº de linhas, rótulos).
5. **Implantar → Nova implantação → App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**

   O acesso público é necessário para o servidor chamar sem login do Google. Sem o
   `CONVES_TOKEN` correto o endpoint não devolve nada.
6. Guarde a URL `/exec`.

> Ao editar o `.gs` depois, **publique uma nova versão da implantação**. Só salvar o código
> não muda o que a URL responde.

### 2. Variáveis de ambiente (Vercel)

Um formulário:

```
FICHAS_SHEET_URL    = https://script.google.com/macros/s/.../exec
FICHAS_SHEET_TOKEN  = <mesmo valor do CONVES_TOKEN>
FICHAS_WEBHOOK_URL  = https://<n8n>/webhook/e8ed448d-ac27-4b52-91d0-b846d5628d15
FICHAS_SHEET_NOME   = Residencial PF        (opcional, rótulo na tela)
```

Vários formulários (residencial, comercial PF, PJ) — substitui as de cima:

```
FICHAS_SHEETS = [{"id":"residencial","nome":"Residencial PF","url":"...","token":"...","webhook":"..."},
                 {"id":"pj","nome":"Pessoa Jurídica","url":"...","token":"...","webhook":"..."}]
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem para as outras rotas `api/`.

Sem configuração, a rota responde **503 com instrução** — a tela abre e explica, não quebra.

## Como a comparação decide

- **Chave primária:** CPF só dígitos (`123.456.789-09` casa com `12345678909`).
- **Fallback** quando a resposta não tem CPF: nome normalizado + 8 últimos dígitos do celular.
- **Janela de proximidade:** 2 dias entre o carimbo da planilha e o `created_at` da ficha.
- **Claim:** cada ficha satisfaz no máximo uma linha. Duas respostas do mesmo CPF no mês com
  só uma ficha no sistema **não** passam como "tudo certo".
- **Busca de fichas** recua 15 dias além da janela pedida, para uma resposta lançada
  manualmente dias depois não aparecer como faltante e ser importada de novo.

Três resultados por linha:

| Resultado | Significado | Ação |
|---|---|---|
| Conferida | achou a ficha correspondente | nenhuma |
| Faltando no sistema | nenhuma ficha equivalente | importa com 1 clique |
| Precisa de revisão | existe ficha do mesmo CPF, mas em data distante | decisão humana, não importa sozinho |

## Importação

A tela manda apenas `{fonte, linha}`. O servidor relê a planilha, reconfere que a linha ainda
é faltante e só então reenvia o payload **pelo webhook do n8n** — o mesmo caminho de um envio
real do Forms. Consequências:

- a normalização de imobiliária continua sendo a do Code Node, sem segunda implementação;
- o conteúdo importado é obrigatoriamente o que está na planilha;
- a reconferência antes de gravar evita duplicar se outra pessoa importou no meio do caminho.

## Limitações conhecidas

- É diagnóstico sob demanda, não alarme. Ninguém é avisado sem alguém clicar no botão.
- Não resolve a causa do `INTERNAL` no `onFormSubmit` — reduz o dano. Retry com backoff no
  próprio `onFormSubmit` continua sendo o conserto de raiz.
- Rótulos de pergunta renomeados no Forms: a tela continua listando (casa por acento/caixa/
  pontuação e por aliases), mas o Code Node do n8n mapeia por rótulo cru — renomear pergunta
  exige atualizar o n8n, senão a ficha entra com campos nulos.
