// Ponto de extensão reservado para o chat contextual com o CONVES IA
// (arquitetura em TREINAMENTOS_ARQUITETURA.md, seção "Integração Técnica" —
// backend Postgres separado, fora de escopo desta rodada).
//
// De propósito, este componente NÃO faz nenhuma chamada de rede: só reserva o
// lugar na tela e o contrato de props que a integração futura vai precisar
// (licaoId, produto, seguradora da variação sendo lida). Renderiza desabilitado.
import { MessageCircle } from 'lucide-react'

export default function TrainingChatButton({ licaoId, produto, seguradora }) {
  return (
    <button
      type="button"
      disabled
      title="Chat com IA — em breve"
      aria-label="Chat com IA — em breve"
      data-licao-id={licaoId || undefined}
      data-produto={produto || undefined}
      data-seguradora={seguradora || undefined}
      className="fixed bottom-6 right-6 z-[250] flex items-center gap-2 rounded-full border border-dark-border bg-dark-surface2/90 px-4 py-3 text-sm font-medium text-dark-muted opacity-70 shadow-lg backdrop-blur cursor-not-allowed"
    >
      <MessageCircle className="w-4 h-4" />
      <span className="hidden sm:inline">Chat com IA</span>
      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/25">
        Em breve
      </span>
    </button>
  )
}
