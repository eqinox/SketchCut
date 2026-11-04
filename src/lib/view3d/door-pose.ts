import { Matrix4, Vector3 } from 'three'
import type { SceneSolid } from '@/lib/cabinets/scene-solids'

export type DoorSolid = Extract<SceneSolid, { kind: 'door' }>

/** Same door keeps its open angle when the picture is rebuilt. */
export function doorKey(door: Pick<DoorSolid, 'side' | 'hingeX' | 'y' | 'z' | 'width' | 'height'>): string {
  return [
    door.side,
    Math.round(door.hingeX),
    Math.round(door.y),
    Math.round(door.z),
    Math.round(door.width),
    Math.round(door.height),
  ].join(':')
}

/**
 * Door centre and axes at `openDeg`. Closed is 0. The hinge edge stays put
 * and the leaf swings toward the viewer.
 */
export function doorMatrix(door: DoorSolid, openDeg: number): Matrix4 {
  const rad = (openDeg * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const along = door.width / 2
  const thick = door.thickness / 2
  const boardX =
    door.side === 'left'
      ? door.hingeX + along * c + thick * s
      : door.hingeX - along * c - thick * s
  const boardY = door.y + door.height / 2
  const boardZ = door.z - along * s + thick * c
  const xAxis = new Vector3(door.side === 'left' ? c : -c, 0, s)
  const yAxis = new Vector3(0, 1, 0)
  const zAxis = new Vector3(door.side === 'left' ? s : -s, 0, -c)
  const matrix = new Matrix4().makeBasis(xAxis, yAxis, zAxis)
  matrix.setPosition(boardX, -boardY, -boardZ)
  return matrix
}
