import { Lock, Star } from 'lucide-react'

const LOGO = 'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/file.jpeg'

const FEATURES = [
  'Listagem completa de apólices emitidas',
  'Controle de vigência e renovação',
  'Integração com seguradoras parceiras',
  'Relatórios de comissão e produtividade',
  'Histórico de emissões por produto',
]

export default function GestaoEmissoes() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center animate-fade-in">
      <div
        className="relative w-full max-w-xl rounded-2xl border border-dark-border p-10 text-center overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(27,58,107,0.15) 0%, rgba(17,24,39,0.8) 50%, rgba(43,91,168,0.12) 100%)',
        }}
      >
        {/* Background logo watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img src={LOGO} alt="" className="w-64 h-64 object-contain opacity-5" />
        </div>

        {/* Content */}
        <div className="relative z-10 space-y-6">
          {/* Lock icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-brand-secondary/20 border border-brand-accent/30 flex items-center justify-center animate-pulse-slow">
                <Lock className="w-9 h-9 text-brand-accent" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <h1 className="text-xl font-bold text-dark-text">Gestão de Emissões</h1>
              <span className="badge-soon">Em Breve</span>
            </div>
            <p className="text-sm text-dark-muted leading-relaxed max-w-sm mx-auto">
              Esta área está em desenvolvimento. Em breve você poderá gerenciar todas as
              apólices emitidas pela Conves em um só lugar.
            </p>
          </div>

          {/* Features list */}
          <div className="text-left space-y-2.5 bg-dark-surface2/50 rounded-xl p-5 border border-dark-border">
            <p className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-3">
              Funcionalidades planejadas
            </p>
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Star className="w-3.5 h-3.5 text-brand-gold flex-shrink-0 mt-0.5" />
                <span className="text-sm text-dark-muted">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
