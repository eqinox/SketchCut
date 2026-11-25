import { Reflector } from 'three/addons/objects/Reflector.js'
import {
  BoxGeometry,
  PlaneGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import type { DecorSheet } from '@/lib/finish-photo'
import { STEEL, type SceneSolid } from '@/lib/cabinets/scene-solids'
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

function mirrorFace(bin: Disposable[]) {
  const mat = new MeshStandardMaterial({
    color: '#f7fcff',
    metalness: 0.94,
    roughness: 0.06,
    envMapIntensity: 1.4,
  })
  bin.push({ dispose: () => mat.dispose() })
  return mat
}

/**
 * A real mirror: a surface that shows what stands in front of it (the room, other cabinets,
 * the floor). It sits a hair in front of the glass board, facing `outward` (+1 or -1 along z).
 */
/**
 * Whether mirrors redraw their reflection on this frame. The render loop turns it off on most
 * frames while the camera is moving, so turning the view stays smooth; when it stops they catch up.
 */
export const mirrorRefresh = { live: true, moving: false }

/**
 * What a scene shows only inside mirrors (the far sides of its walls, a room around a lone
 * cabinet). `before` runs just before a mirror draws its reflection, `after` right after.
 */
const reflectionHooks = new WeakMap<object, { before(): void; after(): void }>()
export function setReflectionHooks(scene: object, hooks: { before(): void; after(): void }) {
  reflectionHooks.set(scene, hooks)
}

function addReflection(
  into: Group,
  width: number,
  height: number,
  at: Vector3,
  outward: 1 | -1,
  bin: Disposable[],
) {
  if (!(width > 1 && height > 1)) return
  const geo = new PlaneGeometry(width, height)
  // Sharp when the picture stands still (up to 2048 across), a third of that while it turns so
  // turning stays smooth. The size is switched on the fly.
  const scale = Math.min(1.8, 2048 / Math.max(width, height))
  const sharp = { w: Math.max(128, Math.round(width * scale)), h: Math.max(128, Math.round(height * scale)) }
  const rough = { w: Math.max(96, Math.round(sharp.w / 3)), h: Math.max(96, Math.round(sharp.h / 3)) }
  const mirror = new Reflector(geo, {
    textureWidth: sharp.w,
    textureHeight: sharp.h,
    // A touch of grey-blue: real mirror glass does not give back all the light.
    color: 0xc4ccd0,
    clipBias: 0.003,
  })
  mirror.position.copy(at)
  if (outward === -1) mirror.rotation.y = Math.PI
  const reflect = mirror.onBeforeRender.bind(mirror)
  const target = mirror.getRenderTarget()
  mirror.onBeforeRender = (...args) => {
    if (!mirrorRefresh.live) return
    const want = mirrorRefresh.moving ? rough : sharp
    if (target.width !== want.w || target.height !== want.h) target.setSize(want.w, want.h)
    const hooks = reflectionHooks.get(args[1])
    hooks?.before()
    reflect(...args)
    hooks?.after()
  }
  into.add(mirror)
  bin.push({ dispose: () => mirror.dispose() }, { dispose: () => geo.dispose() })
}

function mirrorFaces(bin: Disposable[]) {
  const face = mirrorFace(bin)
  const edge = new MeshStandardMaterial({ color: '#8ea0aa', metalness: 0.65, roughness: 0.28 })
  bin.push({ dispose: () => edge.dispose() })
  return [edge, edge, edge, edge, face, face]
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
    solid.mirrorGlass
      ? mirrorFaces(bin)
      : boardMaterials(solid.color, sheet, solid.w, solid.h, solid.d, anisotropy, bin, solid.rearColor),
  )
  mesh.position.set(solid.x + solid.w / 2, -(solid.y + solid.h / 2), -(solid.z + solid.d / 2))
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (solid.piece) mesh.userData.piece = solid.piece
  parent.add(mesh)
  bin.push({ dispose: () => geo.dispose() })
  // The front face (larger three.js z) of a mirror board shows the room.
  if (solid.mirrorGlass) addReflection(parent, solid.w, solid.h, mesh.position.clone().setZ(mesh.position.z + solid.d / 2 + 0.4), 1, bin)
  if (solid.pull && !solid.slide) addFrontHandle(parent, solid, bin)
}

/** Vertical pull on the outer face of a door board. Drawers place their own. */
function addFrontHandle(
  parent: Group,
  solid: Extract<SceneSolid, { kind: 'box' }>,
  bin: Disposable[],
) {
  if (!solid.pull || solid.pull.sku === 'none') return
  const stand = new Group()
  stand.rotation.z = Math.PI / 2
  const pull = addPull(stand, solid.pull.sku, bin)
  const length = solid.pull.sku === 'normal' ? 128 : (taraPull(solid.pull.sku)?.l ?? 158)
  if (pull) fitPullLength(pull, length, solid.h)
  const inset = Math.min(46, Math.max(22, Math.min(solid.w * 0.16, solid.w / 2 - 8)))
  const at = solid.pull.at ?? 'right'
  const x =
    at === 'left' ? solid.x + inset : at === 'center' ? solid.x + solid.w / 2 : solid.x + solid.w - inset
  // Drawing z grows into the cabinet, so the outer face is the larger three.js z.
  stand.position.set(x, -(solid.y + solid.h / 2), -solid.z)
  parent.add(stand)
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

  if (solid.mirror && solid.mirror.width > 1 && solid.mirror.height > 1) {
    const glass = solid.mirror
    const depth = 4
    const glassGeo = new BoxGeometry(glass.width, glass.height, depth)
    const glassMat = mirrorFace(bin)
    const glassMesh = new Mesh(glassGeo, glassMat)
    const cx =
      solid.side === 'left'
        ? -solid.width / 2 + glass.x + glass.width / 2
        : solid.width / 2 - glass.x - glass.width / 2
    const cy = solid.height / 2 - glass.y - glass.height / 2
    glassMesh.position.set(cx, cy, -solid.thickness / 2 - depth / 2)
    glassMesh.castShadow = true
    group.add(glassMesh)
    bin.push({ dispose: () => glassGeo.dispose() })
    addReflection(group, glass.width, glass.height, new Vector3(cx, cy, -solid.thickness / 2 - depth - 0.4), -1, bin)
  }

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
    const length = solid.pull.sku === 'normal' ? 128 : (taraPull(solid.pull.sku)?.l ?? 158)
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
    if (solid.piece) child.userData.piece = solid.piece
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
    const length = front.pull.sku === 'normal' ? 128 : (taraPull(front.pull.sku)?.l ?? 158)
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

const X_AXIS = new Vector3(1, 0, 0)

const UP = new Vector3(0, 1, 0)

/** Drawing millimetres (y down, z into the cabinet) to the 3D picture's space. */
function scenePoint([x, y, z]: [number, number, number]) {
  return new Vector3(x, -y, -z)
}

/**
 * The slat frame of a bed. It behaves like a door that opens upward: one click lifts the foot
 * end, the next lowers it. The gas springs stretch with it.
 */
function addLift(
  parent: Group,
  solid: Extract<SceneSolid, { kind: 'lift' }>,
  bin: Disposable[],
): AnimatedDoor {
  const pivot = new Vector3(0, -solid.pivotY, -solid.pivotZ)
  const group = new Group()
  group.position.copy(pivot)
  parent.add(group)
  const steel = metalMaterial('#1c1c1e', bin, 0.5)
  const addPart = (into: Group, part: { x: number; y: number; z: number; w: number; h: number; d: number; color: string }, shift: Vector3) => {
    const geo = new BoxGeometry(part.w, part.h, part.d)
    const isSteel = part.color === STEEL
    const mat = isSteel ? steel : new MeshStandardMaterial({ color: part.color, roughness: 0.7, metalness: 0 })
    const mesh = new Mesh(geo, mat)
    mesh.position.set(part.x + part.w / 2, -(part.y + part.h / 2), -(part.z + part.d / 2)).sub(shift)
    mesh.castShadow = true
    mesh.receiveShadow = true
    into.add(mesh)
    bin.push({ dispose: () => geo.dispose() })
    if (!isSteel) bin.push({ dispose: () => (mat as MeshStandardMaterial).dispose() })
  }
  for (const part of solid.parts) addPart(group, part, pivot)
  // The base bar stays on the bed side; it is not part of what lifts.
  for (const part of solid.base ?? []) addPart(parent, part, new Vector3())
  // A gas spring: a thick black body from the bed, a thin shiny rod to the frame.
  const bodyGeo = new CylinderGeometry(11, 11, 1, 16)
  const rodGeo = new CylinderGeometry(4.5, 4.5, 1, 12)
  const bodyMat = metalMaterial('#1f2937', bin, 0.45)
  const rodMat = metalMaterial('#cbd5e1', bin, 0.2)
  bin.push({ dispose: () => bodyGeo.dispose() }, { dispose: () => rodGeo.dispose() })
  // Flat steel arms between a pin on the base bar and a pin on the frame's bar.
  const armGeo = new BoxGeometry(1, 1, 1)
  bin.push({ dispose: () => armGeo.dispose() })
  const arms = (solid.arms ?? []).map((arm) => {
    const mesh = new Mesh(armGeo, steel)
    mesh.castShadow = true
    parent.add(mesh)
    return { a: scenePoint(arm.a), b: scenePoint(arm.b).sub(pivot), mesh }
  })
  const struts = solid.struts.map((strut) => {
    const body = new Mesh(bodyGeo, bodyMat)
    const rod = new Mesh(rodGeo, rodMat)
    body.castShadow = true
    parent.add(body, rod)
    return { a: scenePoint(strut.a), b: scenePoint(strut.b).sub(pivot), body, rod }
  })
  const place = (mesh: Mesh, from: Vector3, to: Vector3) => {
    const dir = to.clone().sub(from)
    const length = Math.max(1, dir.length())
    mesh.scale.set(1, length, 1)
    mesh.quaternion.setFromUnitVectors(UP, dir.multiplyScalar(1 / length))
    mesh.position.copy(from).add(to).multiplyScalar(0.5)
  }
  const key = `lift:${solid.key}`
  group.userData.doorKey = key
  group.userData.pullKey = key
  group.traverse((child) => {
    child.userData.doorKey = key
    child.userData.pullKey = key
  })
  const apply = (openDeg: number) => {
    const angle = -(openDeg * Math.PI) / 180
    group.rotation.x = angle
    group.updateMatrixWorld(true)
    for (const arm of arms) {
      const end = arm.b.clone().applyAxisAngle(X_AXIS, angle).add(pivot)
      const dir = end.clone().sub(arm.a)
      const length = Math.max(1, dir.length())
      arm.mesh.quaternion.setFromUnitVectors(UP, dir.multiplyScalar(1 / length))
      // 5 mm steel, 24 mm wide, laid flat against the side.
      arm.mesh.scale.set(5, length + 24, 24)
      arm.mesh.position.copy(arm.a).add(end).multiplyScalar(0.5)
    }
    for (const strut of struts) {
      const end = strut.b.clone().applyAxisAngle(X_AXIS, angle).add(pivot)
      const span = end.distanceTo(strut.a)
      // The body keeps its length; the rod makes up the rest as the frame rises.
      const bodyLength = Math.min(span * 0.62, 260)
      const split = strut.a.clone().lerp(end, bodyLength / Math.max(1, span))
      place(strut.body, strut.a, split)
      place(strut.rod, split, end)
    }
  }
  apply(0)
  // The studio only needs the open angle from a door; the rest of the shape does not apply here.
  const asDoor = {
    kind: 'door',
    hingeX: 0,
    y: 0,
    z: 0,
    width: 0,
    height: 0,
    thickness: 0,
    side: 'left',
    openDeg: solid.openDeg,
    color: '',
  } as DoorSolid
  return { key, solid: asDoor, group, hinges: [], apply }
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
    if (solid.kind === 'dim') continue
    if (solid.kind === 'lift') {
      doors.push(addLift(parent, solid, bin))
      continue
    }
    const sheet = solid.kind === 'rail' ? undefined : sheets.get(solid.color.toLowerCase())
    if (solid.kind === 'box' && solid.slide) {
      const bucket = buckets.get(solid.slide.id) ?? { travel: solid.slide.travel, parts: [] }
      bucket.parts.push(solid)
      buckets.set(solid.slide.id, bucket)
    } else if (solid.kind === 'box') addBox(parent, solid, sheet, anisotropy, bin)
    else if (solid.kind === 'door') doors.push(addDoor(parent, solid, sheet, anisotropy, bin))
    else if (solid.kind === 'rail') addRail(parent, solid, bin)
  }
  for (const [id, bucket] of buckets) {
    drawers.push(addDrawer(parent, id, bucket.travel, bucket.parts, sheets, anisotropy, bin))
  }
  return { doors, drawers }
}
