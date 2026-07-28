const LOGO = 'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/file.jpeg'

export function PageLoader() {
  return (
    <div
      className="system-page-loader fixed inset-0 flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="system-loader-ambient" aria-hidden="true" />
      <div className="system-loader-card">
        <div className="system-loader-orbit" aria-hidden="true">
          <div className="system-loader-logo">
            <img src={LOGO} alt="" width={56} height={56} loading="eager" />
          </div>
        </div>
        <span className="system-loader-kicker">Conves Workspace</span>
        <h1>Preparando sua operação</h1>
        <p>Conectando dados, preferências e ferramentas do seu setor.</p>
        <div className="system-loader-track" aria-hidden="true"><span /></div>
        <div className="system-loader-status"><i aria-hidden="true" />Ambiente seguro em carregamento</div>
      </div>
      <span className="sr-only">Carregando o sistema Conves</span>
    </div>
  )
}
