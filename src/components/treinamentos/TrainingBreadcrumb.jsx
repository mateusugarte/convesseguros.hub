// Breadcrumb burro: recebe os nós já resolvidos (setor/módulo/lição) como
// props e só navega — não faz nenhum tree-walking/busca de dados aqui.
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export default function TrainingBreadcrumb({ setor = null, modulo = null, licao = null }) {
  const crumbs = [{ label: 'Treinamentos', to: '/treinamentos' }]
  if (setor) crumbs.push({ label: setor.titulo, to: `/treinamentos/setores/${setor.id}` })
  if (modulo) crumbs.push({ label: modulo.titulo, to: `/treinamentos/modulos/${modulo.id}` })
  if (licao) crumbs.push({ label: licao.titulo, to: `/treinamentos/licoes/${licao.id}` })

  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-xs text-dark-muted mb-4" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1
        return (
          <span key={crumb.to} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />}
            {isLast ? (
              <span className="font-semibold text-dark-text truncate max-w-[220px]">{crumb.label}</span>
            ) : (
              <Link to={crumb.to} className="hover:text-dark-text transition-colors truncate max-w-[180px]">
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
