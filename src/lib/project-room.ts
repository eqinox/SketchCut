import { createContext } from 'react'
import type { BoardFinish } from '@/lib/board-finishes'
import type { RoomPlan } from '@/lib/room'
import type { CabinetInstance } from '@/types'

/** The project room, shown behind the cabinet that is open. */
export type ProjectRoom = {
  room: RoomPlan
  cabinets: CabinetInstance[]
  finishes: BoardFinish[]
  /** Saved pieces with these ids are drawn from the open cabinet, not from the plan. */
  replaceIds: string[]
  /** First saved place wins. A joined group is one piece, not one copy per member. */
  anchorIds: string[]
  group: boolean
  typeId: string
}

export const ProjectRoomContext = createContext<ProjectRoom | null>(null)
