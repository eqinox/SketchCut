import { createContext } from 'react'
import type { BoardFinish } from '@/lib/board-finishes'

/**
 * Lets the 3D picture give one piece its own board. A piece with its own board keeps it when the
 * carcass or the doors change colour, until it is set back to "like the rest".
 */
export type PieceColorChoice = {
  finishes: BoardFinish[]
  /** The piece's own board id, or '' when it follows the carcass or the doors. */
  current(piece: string): string
  /** '' puts the piece back with the rest. */
  choose(piece: string, finishId: string): void
  label(piece: string): string
}

export const PieceColorChoiceContext = createContext<PieceColorChoice | null>(null)
