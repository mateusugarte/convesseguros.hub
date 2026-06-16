import { closestCorners, pointerWithin } from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'

export function kanbanPointerCollision(args) {
  const pointerHits = pointerWithin(args)
  if (pointerHits.length > 0) return pointerHits
  return closestCorners(args)
}

export const KANBAN_DRAG_OVERLAY_MODIFIERS = [snapCenterToCursor]
