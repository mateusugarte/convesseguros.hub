const LOGO = 'https://uqkzxtelctaaqvrihnfg.supabase.co/storage/v1/object/public/conves/file.jpeg'

export function PageLoader() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: 'rgb(var(--color-bg))' }}
    >
      <img
        src={LOGO}
        alt="Conves"
        width={56}
        height={56}
        className="rounded-2xl object-cover animate-pulse-slow"
        style={{ boxShadow: '0 4px 20px rgba(43,91,168,0.25)' }}
      />
      <p
        className="mt-4 text-sm"
        style={{ color: 'rgb(var(--color-muted))' }}
      >
        Carregando...
      </p>
    </div>
  )
}
