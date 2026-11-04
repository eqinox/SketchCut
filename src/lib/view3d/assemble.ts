import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  Vector3,
} from 'three'
import type { DecorSheet } from '@/lib/finish-photo'
import type { SceneSolid } from '@/lib/cabinets/scene-solids'
import { boardMaterials, metalMaterial, type Disposable } from '@/lib/view3d/materials'
import { doorKey, doorMatrix, type DoorSolid } from '@/lib/view3d/door-pose'
import { addEuropeanHinge, type HingeRig } from '@/lib/view3d/hinge'
import { addPull, fitPullLength } from '@/lib/view3d/pull'
import { taraPull } from '@/lib/cabinets/pulls'

export type AnimatedDoor = {
  key: string
  solid: DoorSolid
  group: Group
  hinges: HingeRig[]
  apply(openDeg: number): void
}

export type AnimatedDrawer = {
  key: string
  travel: number
  group: Group
  /** 0 is closed, 1 is fully out toward the viewer. */
  apply(open: number): void
}

function addBox(
  parent: Group,
  solid: Extract<SceneSolid, { kind: 'box' }>,
  sheet: DecorSheet | undefined,
  anisotropy: number,
  bin: Disposable[],
) {
  const geo = new BoxGeometry(solid.w, solid.h, solid.d)
  const mesh = new Mesh(
    geo,
    boardMaterials(solid.color, sheet, solid.w, solid.h, solid.d, anisotropy, bin, solid.rearColor),
  )
  mesh.position.set(solid.x + solid.w / 2, -(solid.y + solid.h / 2), -(solid.z + solid.d / 2))
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  bin.push({ dispose: () => geo.dispose() })
}

function addDoor(
  parent: Group,
  solid: DoorSolid,
  sheet: DecorSheet | undefined,
  anisotropy: number,
  bin: Disposable[],
): AnimatedDoor {
  const group = new Group()
  group.matrixAutoUpdate = false
  parent.add(group)

  const geo = new BoxGeometry(solid.width, solid.height, solid.thickness)
  const board = new Mesh(
    geo,
    boardMaterials(solid.color, sheet, solid.width, solid.height, solid.thickness, anisotropy, bin),
  )
  board.castShadow = true
  board.receiveShadow = true
  group.add(board)
  bin.push({ dispose: () => geo.dispose() })

  const hinges = (solid.hingeFromTop ?? []).map((fromTop) =>
    addEuropeanHinge(group, parent, solid, fromTop, bin),
  )

  if (solid.pull && solid.pull.sku !== 'none') {
    const stand = new Group()
    const arch = new Group()
    arch.rotation.x = Math.PI
    stand.rotation.z = Math.PI / 2
    stand.add(arch)
    const pull = addPull(arch, solid.pull.sku, bin)
    const length = solid.pull.sku === 'normal' ? 120 : (taraPull(solid.pull.sku)?.l ?? 158)
    if (pull) fitPullLength(pull, length, solid.height)
    const inset = Math.min(46, Math.max(22, solid.width * 0.16))
    stand.position.set(solid.width / 2 - inset, 0, -solid.thickness / 2)
    group.add(stand)
  }

  const key = doorKey(solid)
  group.userData.doorKey = key
  group.userData.pullKey = solid.pull?.key ?? key
  group.traverse((child) => {
    child.userData.doorKey = key
    child.userData.pullKey = solid.pull?.key ?? key
  })

  return {
    key,
    solid,
    group,
    hinges,
    apply(openDeg) {
      group.matrix.copy(doorMatrix(solid, openDeg))
      group.updateMatrixWorld(true)
      for (const hinge of hinges) hinge.update(group.matrix)
    },
  }
}

function addRail(
  parent: Group,
  solid: Extract<SceneSolid, { kind: 'rail' }>,
  bin: Disposable[],
) {
  const radius = Math.max(4, Math.min(solid.h, solid.d) / 2)
  const a = new Vector3(solid.x, -(solid.y + solid.h / 2), -(solid.z0 + solid.d / 2))
  const b = new Vector3(solid.x + solid.w, -(solid.y + solid.h / 2), -(solid.z1 + solid.d / 2))
  const dir = b.clone().sub(a)
  const length = dir.length()
  if (!(length > 1)) return
  const geo = new CylinderGeometry(radius, radius, length, 24)
  const mat = metalMaterial(solid.color, bin, 0.28)
  const mesh = new Mesh(geo, mat)
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.multiplyScalar(1 / length))
  mesh.position.copy(a.add(b).multiplyScalar(0.5))
  mesh.castShadow = true
  parent.add(mesh)
  bin.push({ dispose: () => geo.dispose() })
}

function addDrawer(
  parent: Group,
  id: string,
  travel: number,
  parts: Extract<SceneSolid, { kind: 'box' }>[],
  sheets: ReadonlyMap<string, DecorSheet>,
  anisotropy: number,
  bin: Disposable[],
): AnimatedDrawer {
  const group = new Group()
  parent.add(group)
  for (const part of parts) {
    addBox(group, part, sheets.get(part.color.toLowerCase()), anisotropy, bin)
  }
  const front = parts.find((part) => part.pull && part.d <= part.w && part.d <= part.h)
  if (front?.pull && front.pull.sku !== 'none') {
    const pull = addPull(group, front.pull.sku, bin)
    const length = front.pull.sku === 'normal' ? 120 : (taraPull(front.pull.sku)?.l ?? 158)
    if (pull) {
      fitPullLength(pull, length, front.w)
      pull.position.set(front.x + front.w / 2, -(front.y + front.h / 2), -front.z)
    }
  }
  const pullKey = front?.pull?.key ?? id.replace(/@-?\d+:-?\d+$/, '')
  group.userData.drawerKey = id
  group.userData.pullKey = pullKey
  group.traverse((child) => {
    child.userData.drawerKey = id
    child.userData.pullKey = pullKey
  })
  return {
    key: id,
    travel,
    group,
    apply(open) {
      const pull = open <= 0 ? 0 : open >= 1 ? travel : travel * open
      group.position.z = pull
    },
  }
}

export function buildCabinet(
  parent: Group,
  solids: SceneSolid[],
  sheets: ReadonlyMap<string, DecorSheet>,
  anisotropy: number,
  bin: Disposable[],
): { doors: AnimatedDoor[]; drawers: AnimatedDrawer[] } {
  const doors: AnimatedDoor[] = []
  const drawers: AnimatedDrawer[] = []
  const buckets = new Map<string, { travel: number; parts: Extract<SceneSolid, { kind: 'box' }>[] }>()
  for (const solid of solids) {
    const sheet = solid.kind === 'rail' ? undefined : sheets.get(solid.color.toLowerCase())
    if (solid.kind === 'box' && solid.slide) {
      const bucket = buckets.get(solid.slide.id) ?? { travel: solid.slide.travel, parts: [] }
      bucket.parts.push(solid)
      buckets.set(solid.slide.id, bucket)
    } else if (solid.kind === 'box') addBox(parent, solid, sheet, anisotropy, bin)
    else if (solid.kind === 'door') doors.push(addDoor(parent, solid, sheet, anisotropy, bin))
    else addRail(parent, solid, bin)
  }
  for (const [id, bucket] of buckets) {
    drawers.push(addDrawer(parent, id, bucket.travel, bucket.parts, sheets, anisotropy, bin))
  }
  return { doors, drawers }
}
