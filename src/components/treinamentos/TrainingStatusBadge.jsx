// Mesmo padrão de src/components/FichaStatusBadge.jsx: delega a uma função pura
// que resolve {id,label,className}, usando as classes badge-* já existentes.
// "locked" é um conceito derivado da lógica de progressão (ver
// src/lib/trainingProgression.js), não um valor armazenado em training_progress.status
// — por isso entra como prop separada, não como parte do status salvo.

const STATUS_META = {
  trancado:     { id: 'trancado',     label: 'Trancado',      className: 'badge-muted' },
  nao_iniciado: { id: 'disponivel',   label: 'Disponível',    className: 'badge-blue' },
  em_andamento: { id: 'em_andamento', label: 'Em andamento',  className: 'badge-info' },
  concluido:    { id: 'concluido',    label: 'Concluído',     className: 'badge-success' },
}

export function getTrainingNodeStatusMeta({ status = 'nao_iniciado', locked = false } = {}) {
  if (locked) return STATUS_META.trancado
  return STATUS_META[status] || STATUS_META.nao_iniciado
}

export default function TrainingStatusBadge({ status, locked = false, className = '' }) {
  const meta = getTrainingNodeStatusMeta({ status, locked })
  return <span className={`badge ${meta.className} ${className}`.trim()}>{meta.label}</span>
}
