import { closestCorners, pointerWithin, defaultDropAnimationSideEffects } from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'

export function kanbanPointerCollision(args) {
  const pointerHits = pointerWithin(args)
  if (pointerHits.length > 0) return pointerHits
  return closestCorners(args)
}

export const KANBAN_DRAG_OVERLAY_MODIFIERS = [snapCenterToCursor]

// Anima o card "pousando" na coluna de destino em vez de sumir instantaneamente
// (dropAnimation={null} desligava qualquer animação de soltura).
export const KANBAN_DROP_ANIMATION = {
  duration: 240,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.4' } },
  }),
}
