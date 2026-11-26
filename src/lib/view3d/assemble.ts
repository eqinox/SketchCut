import {
  BoxGeometry,
  AdditiveBlending,
  CanvasTexture,
  CubeCamera,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Object3D,
  Scene,
  WebGLRenderer,
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
    color: '#eef3f5',
    metalness: 1,
    roughness: 0.02,
    envMapIntensity: 1,
  })
  // The studio puts the room picture on every material marked like this.
  mat.userData.mirror = true
  bin.push({ dispose: () => mat.dispose() })
  return mat
}

/**
 * A real mirror: a surface that shows what stands in front of it (the room, other cabinets,
 * the floor). It sits a hair in front of the glass board, facing `outward` (+1 or -1 along z).
 */
/**
 * Mirrors show a picture of the room taken all round (a cube map). The studio takes it again
 * whenever the room changes and hands it over here; between changes nothing extra is drawn, so a
 * mirror costs nothing while the view turns, and it reflects from any angle.
 */
export function refreshMirrors(
  scene: Object3D,
  renderer: WebGLRenderer,
  cube: CubeCamera,
  showDuring: Object3D[] = [],
): boolean {
  const mirrors: MeshStandardMaterial[] = []
  const hidden: Object3D[] = []
  scene.traverse((object) => {
    const material = (object as Mesh).material
    const list = Array.isArray(material) ? material : material ? [material] : []
    const glass = list.filter((item): item is MeshStandardMaterial => item.userData.mirror === true)
    if (glass.length === 0) return
    for (const item of glass) if (!mirrors.includes(item)) mirrors.push(item)
    // A mirror must not be in its own picture.
    if (object.visible) {
      object.visible = false
      hidden.push(object)
    }
  })
  if (mirrors.length === 0) return false
  for (const object of showDuring) object.visible = true
  cube.update(renderer, scene as Scene)
  for (const object of showDuring) object.visible = false
  for (const object of hidden) object.visible = true
  for (const material of mirrors) {
    if (material.envMap !== cube.renderTarget.texture) {
      material.envMap = cube.renderTarget.texture
      material.needsUpdate = true
    }
  }
  return true
}

function mirrorFaces(bin: Disposable[]) {
  const face = mirrorFace(bin)
  const edge = new MeshStandardMaterial({ color: '#8ea0aa', metalness: 0.65, roughness: 0.28 })
  edge.userData.mirrorEdge = true
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

/** How far the glow spreads on the board past the glass edge. */
const GLOW_SPREAD_MM = 150

/**
 * The halo of an LED strip behind a mirror: a soft light on the board around the glass. It is
 * switched like a door opens: lit when "closed" (the usual state), dark when "open".
 */
function addGlow(parent: Group, solid: Extract<SceneSolid, { kind: 'glow' }>, bin: Disposable[]): AnimatedDoor {
  const w = solid.w + 2 * GLOW_SPREAD_MM
  const h = solid.h + 2 * GLOW_SPREAD_MM
  const scale = 512 / Math.max(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(16, Math.round(w * scale))
  canvas.height = Math.max(16, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const s = GLOW_SPREAD_MM * scale
    // The strip is a little in from the glass edge; its light blurs outward onto the board.
    ctx.shadowColor = 'rgba(255,255,255,1)'
    ctx.shadowBlur = s * 0.9
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    const inset = 30 * scale
    ctx.fillRect(s + inset, s + inset, canvas.width - 2 * (s + inset), canvas.height - 2 * (s + inset))
    ctx.shadowBlur = s * 0.35
    ctx.fillRect(s + inset, s + inset, canvas.width - 2 * (s + inset), canvas.height - 2 * (s + inset))
  }
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  const mat = new MeshBasicMaterial({
    map,
    color: solid.color,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const geo = new PlaneGeometry(w, h)
  const glow = new Mesh(geo, mat)
  // Just in front of the board face, facing the room (+z in three.js is toward the viewer).
  glow.position.set(solid.x + solid.w / 2, -(solid.y + solid.h / 2), -solid.z + 0.6)
  glow.renderOrder = 3
  parent.add(glow)
  bin.push({ dispose: () => geo.dispose() }, { dispose: () => mat.dispose() }, { dispose: () => map.dispose() })
  const key = `light:${solid.key}`
  glow.userData.doorKey = key
  glow.userData.pullKey = key
  const openDeg = 90
  const apply = (deg: number) => {
    const on = 1 - Math.min(1, Math.max(0, deg / openDeg))
    // Stays in the scene when dark, so a click can switch it on again.
    mat.opacity = on
  }
  apply(0)
  const asDoor = { kind: 'door', hingeX: 0, y: 0, z: 0, width: 0, height: 0, thickness: 0, side: 'left', openDeg, color: '' } as DoorSolid
  return { key, solid: asDoor, group: glow as unknown as Group, hinges: [], apply }
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
    if (solid.kind === 'glow') {
      doors.push(addGlow(parent, solid, bin))
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
