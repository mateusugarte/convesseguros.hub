import { AlertTriangle, Check } from 'lucide-react'

// Algumas cotacoes trazem varias ofertas/produtos no mesmo PDF. A tela para e
// pergunta, em vez de seguir com um palpite: um premio errado no comparativo
// chega ao cliente sem nada indicando o erro.
//
// As opcoes vem de `cotacao.escolha_pendente` (ver `orcamentoComparativo.js`), e
// nao de uma lista fixa aqui: quem sabe quais ofertas existem e o PDF.

function moedaBr(valor) {
  if (valor == null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function AutoOrcamentoOfertas({ escolha, escolhida, onEscolher, disabled = false }) {
  if (!escolha?.opcoes?.length) return null
  const tipo = escolha.campo === 'produto' ? 'produtos' : 'ofertas'

  return (
    <section className="auto-comparison-ofertas" aria-label="Escolha da oferta">
      <header>
        <AlertTriangle />
        <span>
          <strong>{escolha.label}</strong>
          <small>Esta cotação apresenta {escolha.opcoes.length} {tipo}. Clique em uma opção para iniciar a coleta dos valores e preencher a revisão.</small>
        </span>
      </header>
      <ul>
        {escolha.opcoes.map(opcao => {
          const id = opcao.indice ?? opcao.id
          const ativa = escolhida === id
          return (
            <li key={id}>
              <button
                type="button"
                className={ativa ? 'is-selected' : ''}
                aria-pressed={ativa}
                disabled={disabled}
                onClick={() => onEscolher(id)}
              >
                <span className="auto-comparison-oferta-nome">
                  {ativa && <Check />}
                  {opcao.nome || opcao.label}
                </span>
                <strong>{moedaBr(opcao.premio_total)}</strong>
                <span className="auto-comparison-oferta-action">{ativa ? 'Selecionado' : 'Escolher e preencher'}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
