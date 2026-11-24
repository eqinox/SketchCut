import {
  ACESFilmicToneMapping,
  Box3,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  MOUSE,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Path,
  Shape,
  ShapeGeometry,
  PCFSoftShadowMap,
  PMREMGenerator,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  CanvasTexture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { addDimensions } from '@/lib/view3d/dimensions'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { DecorSheet } from '@/lib/finish-photo'
import type { SceneSolid } from '@/lib/cabinets/scene-solids'
import type { RoomPlan } from '@/lib/room'
import {
  openingColor,
  openingsIn,
  wallLength,
  type RoomOpening,
  type RoomWall,
} from '@/lib/room-openings'
import { buildCabinet } from '@/lib/view3d/assemble'
import type { Disposable } from '@/lib/view3d/materials'

export type RoomPlacement = {
  id: string
  x: number
  y: number
  lift: number
  turn: 0 | 1 | 2 | 3
  /** Footprint on the floor, after the turn. */
  w: number
  d: number
  solids: SceneSolid[]
}

export type RoomFront = {
  id: string
  kind: 'door' | 'drawer'
  open: boolean
}

export type RoomHit =
  | { kind: 'opening'; id: string; wall: RoomWall; along: number; up: number }
  | { kind: 'wall'; wall: RoomWall; along: number; up: number }
  | { kind: 'busy' }

export type RoomStudio = {
  setRoom(
    room: RoomPlan,
    placements: RoomPlacement[],
    sheets: ReadonlyMap<string, DecorSheet>,
    focusId?: string,
  ): void
  /** Opens a shut door or drawer, and shuts an open one. */
  toggle(id: string): void
  fronts(): RoomFront[]
  /** What the cursor is on: an opening, a clear wall, or a cabinet in front of the wall. */
  hit(clientX: number, clientY: number): RoomHit | null
  /** The wall the cursor points at, including through a window hole. */
  aimWall(clientX: number, clientY: number): { wall: RoomWall; along: number; up: number } | null
  /** Where the cursor falls on one wall, so a new opening can be drawn from here to there. */
  aimOn(clientX: number, clientY: number, wall: RoomWall): { along: number; up: number } | null
  /** Draw a temporary opening list without rebuilding the furniture. */
  preview(openings: RoomOpening[]): void
  setSelected(id: string | null): void
  /** Left button orbits while navigating. A drawing tool takes that button. */
  setNavigate(on: boolean): void
  subscribe(listener: () => void): () => void
  dispose(): void
}

const plankTextures = new Map<string, CanvasTexture>()

/** One square of the texture is 1200 mm of floor: six boards, each 200 mm wide. */
function floorTexture(color: string): CanvasTexture {
  const cached = plankTextures.get(color)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 768
  const ctx = canvas.getContext('2d')
  const base = new Color(color)
  if (ctx) {
    ctx.fillStyle = `#${base.getHexString()}`
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const boards = 6
    const board = canvas.height / boards
    let seed = [...color].reduce((sum, ch) => sum + ch.charCodeAt(0), 1)
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return (seed & 0xffff) / 0xffff
    }
    for (let row = 0; row < boards; row++) {
      const tone = (rand() - 0.5) * 0.08
      const tint = base.clone().offsetHSL(0, 0, tone)
      ctx.fillStyle = `#${tint.getHexString()}`
      ctx.fillRect(0, row * board, canvas.width, board - 2)
      ctx.strokeStyle = 'rgba(60,40,20,0.18)'
      ctx.lineWidth = 2
      const joint = (0.28 + rand() * 0.44) * canvas.width
      const shift = row % 2 === 0 ? 0 : canvas.width * 0.37
      ctx.beginPath()
      ctx.moveTo((joint + shift) % canvas.width, row * board)
      ctx.lineTo((joint + shift) % canvas.width, (row + 1) * board)
      ctx.stroke()
      ctx.globalAlpha = 0.045
      ctx.strokeStyle = '#3a2a18'
      for (let line = 0; line < 5; line++) {
        const y = row * board + 8 + rand() * (board - 16)
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y + (rand() - 0.5) * 6)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.anisotropy = 8
  plankTextures.set(color, tex)
  return tex
}

function wallMaterial(color: string) {
  return new MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.22,
  })
}

/**
 * A photograph of the whole room. The camera stands inside, about eye height,
 * with daylight from a window on the left wall.
 */
export function mountRoomStudio(host: HTMLElement): RoomStudio {
  const renderer = new WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.touchAction = 'none'
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
  host.appendChild(renderer.domElement)
  const labels = new CSS2DRenderer()
  labels.domElement.style.position = 'absolute'
  labels.domElement.style.inset = '0'
  labels.domElement.style.pointerEvents = 'none'
  host.appendChild(labels.domElement)
  renderer.setSize(host.clientWidth || 960, host.clientHeight || 640, false)
  renderer.setClearColor(0xc5d4e0)

  const scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  const envRoom = new RoomEnvironment()
  const env = pmrem.fromScene(envRoom, 0.04).texture
  scene.environment = env
  scene.environmentIntensity = 0.42
  envRoom.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    mats.forEach((mat) => mat.dispose())
  })
  pmrem.dispose()

  const camera = new PerspectiveCamera(38, 1, 30, 80000)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.panSpeed = 4
  controls.minDistance = 500
  controls.maxDistance = 12000
  controls.maxPolarAngle = Math.PI * 0.58
  controls.minPolarAngle = 0.55
  controls.target.set(-2000, 900, 2200)
  controls.addEventListener('start', () => {
    userMoved = true
  })

  scene.add(new HemisphereLight(0xfff4e4, 0xb7ab9a, 0.62))
  const sun = new DirectionalLight(0xfff3e2, 3.1)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.00025
  sun.shadow.normalBias = 6
  const fill = new DirectionalLight(0xd7e4f4, 0.55)
  // Mirror in X so the right wall stays on the right of the picture, the same
  // way as the plan. A negative scale keeps the wall faces one-sided: from
  // outside a wall you still see into the room, not the back of the wall.
  const view = new Group()
  view.scale.x = -1
  scene.add(view)
  view.add(sun)
  view.add(sun.target)
  view.add(fill)

  const shell = new Group()
  view.add(shell)
  const furniture = new Group()
  view.add(furniture)

  const floorMat = new MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.14,
    clearcoatRoughness: 0.38,
    envMapIntensity: 0.28,
  })
  const floor = new Mesh(new PlaneGeometry(1, 1), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  shell.add(floor)

  const walls = wallMaterial('#f3efe6')
  const ceilingMat = new MeshStandardMaterial({ color: '#f6f4f0', roughness: 0.94, metalness: 0, envMapIntensity: 0.15 })
  const trimMat = new MeshStandardMaterial({ color: '#f7f4ef', roughness: 0.72, metalness: 0 })
  const frameMat = new MeshStandardMaterial({ color: '#f4f1eb', roughness: 0.55, metalness: 0 })
  const glassMat = new MeshStandardMaterial({
    color: '#d5e6f5',
    emissive: '#f4f8fc',
    emissiveIntensity: 0.85,
    roughness: 0.08,
    metalness: 0,
    envMapIntensity: 0.4,
  })

  const makePlane = (material: MeshStandardMaterial | MeshPhysicalMaterial) => {
    const mesh = new Mesh(new PlaneGeometry(1, 1), material)
    mesh.receiveShadow = true
    shell.add(mesh)
    return mesh
  }
  const ceiling = makePlane(ceilingMat)
  const backWall = makePlane(walls)
  const frontWall = makePlane(walls)
  const leftWall = makePlane(walls)
  const rightWall = makePlane(walls)
  ceiling.receiveShadow = false

  const trimGeo = new BoxGeometry(1, 1, 1)
  const trims = [0, 1, 2, 3].map(() => {
    const mesh = new Mesh(trimGeo, trimMat)
    mesh.receiveShadow = true
    shell.add(mesh)
    return mesh
  })

  const frameGeo = new BoxGeometry(1, 1, 1)
  const frames = [0, 1, 2, 3].map(() => {
    const mesh = new Mesh(frameGeo, frameMat)
    mesh.castShadow = true
    shell.add(mesh)
    return mesh
  })
  const glass = new Mesh(new PlaneGeometry(1, 1), glassMat)
  glass.rotation.y = Math.PI / 2
  shell.add(glass)
  glass.visible = false
  for (const mesh of frames) mesh.visible = false
  for (const mesh of trims) mesh.visible = false

  const wallOf: Record<RoomWall, Mesh> = {
    front: frontWall,
    back: backWall,
    left: leftWall,
    right: rightWall,
  }
  for (const name of Object.keys(wallOf) as RoomWall[]) wallOf[name].userData.roomWall = name
  const features = new Group()
  shell.add(features)
  let featureBin: Disposable[] = []
  let selectedOpening: string | null = null
  let paintedRoom: RoomPlan | null = null
  let paintedList: RoomOpening[] = []

  let bin: Disposable[] = []
  let userMoved = false
  let disposed = false
  let frame = 0

  type Angle = {
    now: number
    target: number
    kind: 'door' | 'drawer'
    from: number
    glide: number
  }
  const DRAWER_GLIDE_S = 0.7
  const angles = new Map<string, Angle>()
  type Mover = {
    id: string
    kind: 'door' | 'drawer'
    openDeg: number
    apply: (value: number) => void
  }
  let movers: Mover[] = []
  const raycaster = new Raycaster()
  const pointer = new Vector2()

  const freshAngle = (kind: 'door' | 'drawer'): Angle => ({ now: 0, target: 0, kind, from: 0, glide: 1 })
  const keepAngle = (id: string, kind: 'door' | 'drawer') => {
    const existing = angles.get(id)
    if (!existing || existing.kind !== kind) angles.set(id, freshAngle(kind))
  }
  const tagAnim = (object: Object3D, id: string) => {
    object.traverse((child) => {
      child.userData.roomAnim = id
    })
  }
  const applyMotion = () => {
    for (const mover of movers) mover.apply(angles.get(mover.id)?.now ?? 0)
  }
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) listener()
  }
  const isOpen = (id: string) => {
    const angle = angles.get(id)
    if (!angle) return false
    return angle.kind === 'drawer' ? angle.target > 0.5 : angle.target > 1
  }

  const resize = () => {
    const width = host.clientWidth || 960
    const height = host.clientHeight || 640
    renderer.setSize(width, height, false)
    labels.setSize(width, height)
    camera.aspect = width / Math.max(1, height)
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  let last = performance.now()
  const tick = (now: number) => {
    if (disposed) return
    frame = requestAnimationFrame(tick)
    const delta = Math.min(0.05, (now - last) / 1000)
    last = now
    let moving = false
    for (const angle of angles.values()) {
      if (angle.kind === 'drawer') {
        if (angle.glide >= 1 && angle.now === angle.target) continue
        angle.glide = Math.min(1, angle.glide + delta / DRAWER_GLIDE_S)
        if (angle.glide >= 1) angle.now = angle.target
        else {
          const eased = 1 - (1 - angle.glide) ** 3
          angle.now = angle.from + (angle.target - angle.from) * eased
        }
        moving = true
        continue
      }
      const gap = angle.target - angle.now
      if (Math.abs(gap) < 0.05) {
        if (angle.now !== angle.target) {
          angle.now = angle.target
          moving = true
        }
        continue
      }
      moving = true
      angle.now += gap * (1 - Math.exp(-delta * 7))
    }
    if (moving) applyMotion()
    controls.update()
    renderer.render(scene, camera)
    labels.render(scene, camera)
  }
  frame = requestAnimationFrame(tick)

  const hitMoving = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(furniture.children, true)
    for (const hit of hits) {
      let current: Object3D | null = hit.object
      while (current) {
        if (typeof current.userData.roomAnim === 'string') return current.userData.roomAnim
        current = current.parent
      }
    }
    return null
  }
  const toggle = (id: string) => {
    const mover = movers.find((item) => item.id === id)
    const angle = angles.get(id)
    if (!mover || !angle) return
    if (angle.kind === 'drawer') {
      angle.from = angle.now
      angle.glide = 0
      angle.target = angle.target > 0.5 ? 0 : 1
      notify()
      return
    }
    angle.target = angle.target > 1 ? 0 : mover.openDeg
    notify()
  }
  let downX = 0
  let downY = 0
  let pressed = false
  const onDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    pressed = true
    downX = event.clientX
    downY = event.clientY
  }
  const onUp = (event: PointerEvent) => {
    if (!pressed) return
    pressed = false
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 10) return
    const id = hitMoving(event)
    if (id) toggle(id)
  }
  const onMove = (event: PointerEvent) => {
    renderer.domElement.style.cursor = hitMoving(event) ? 'pointer' : ''
  }
  const pointerDoc = renderer.domElement.ownerDocument
  renderer.domElement.addEventListener('pointerdown', onDown)
  pointerDoc.addEventListener('pointerup', onUp)
  renderer.domElement.addEventListener('pointermove', onMove)

  const placeCabinet = (solids: SceneSolid[], piece: RoomPlacement, sheets: ReadonlyMap<string, DecorSheet>) => {
    const root = new Group()
    const built = buildCabinet(root, solids, sheets, 8, bin)
    for (const door of built.doors) door.apply(0)
    for (const drawer of built.drawers) drawer.apply(0)
    root.updateMatrixWorld(true)
    const local = new Box3().setFromObject(root)
    if (local.isEmpty()) return
    root.position.set(-local.min.x, -local.min.y, -local.max.z)
    addDimensions(root, solids, bin)
    const stand = new Group()
    stand.add(root)
    stand.scale.z = -1
    // Scale Z turns the door face toward the front wall. A positive quarter
    // turn then matches the plan: front, left, back, right.
    stand.rotation.y = piece.turn * (Math.PI / 2)
    stand.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(stand)
    stand.position.set(piece.x - bounds.min.x, piece.lift + 1 - bounds.min.y, piece.y - bounds.min.z)
    for (const door of built.doors) {
      const id = `${piece.id}:${door.key}`
      keepAngle(id, 'door')
      tagAnim(door.group, id)
      movers.push({ id, kind: 'door', openDeg: door.solid.openDeg, apply: (value) => door.apply(value) })
    }
    for (const drawer of built.drawers) {
      const id = `${piece.id}:${drawer.key}`
      keepAngle(id, 'drawer')
      tagAnim(drawer.group, id)
      movers.push({ id, kind: 'drawer', openDeg: 0, apply: (value) => drawer.apply(value) })
    }
    furniture.add(stand)
  }

  function addSolid(
    size: [number, number, number],
    at: [number, number, number],
    material: MeshStandardMaterial,
    openingId?: string,
  ) {
    const geo = new BoxGeometry(size[0], size[1], size[2])
    const mesh = new Mesh(geo, material)
    mesh.position.set(at[0], at[1], at[2])
    mesh.castShadow = true
    mesh.receiveShadow = true
    if (openingId) mesh.userData.openingId = openingId
    features.add(mesh)
    featureBin.push(geo)
  }

  function paintOpenings(room: RoomPlan, openings = openingsIn(room)) {
    paintedRoom = room
    paintedList = openings
    for (const item of featureBin) item.dispose()
    featureBin = []
    features.clear()
    const { width, depth, height } = room

    const faceMaterial = (opening: RoomOpening) => {
      const color = openingColor(opening)
      const mat =
        opening.kind === 'window'
          ? new MeshStandardMaterial({
              color,
              emissive: color,
              emissiveIntensity: 0.45,
              roughness: 0.12,
              metalness: 0,
              envMapIntensity: 0.35,
            })
          : new MeshStandardMaterial({
              color,
              roughness: opening.kind === 'niche' ? 0.94 : 0.58,
              metalness: 0,
            })
      featureBin.push(mat)
      return mat
    }

    const laid = {
      front: { at: new Vector3(0, 0, 0), rot: 0, localX: (along: number) => along, out: new Vector3(0, 0, -1) },
      back: {
        at: new Vector3(width, 0, depth),
        rot: Math.PI,
        localX: (along: number, span: number) => width - along - span,
        out: new Vector3(0, 0, 1),
      },
      left: {
        at: new Vector3(0, 0, depth),
        rot: Math.PI / 2,
        localX: (along: number, span: number) => depth - along - span,
        out: new Vector3(-1, 0, 0),
      },
      right: {
        at: new Vector3(width, 0, 0),
        rot: -Math.PI / 2,
        localX: (along: number) => along,
        out: new Vector3(1, 0, 0),
      },
    } satisfies Record<RoomWall, { at: Vector3; rot: number; localX: (along: number, span: number) => number; out: Vector3 }>

    for (const name of Object.keys(laid) as RoomWall[]) {
      const lay = laid[name]
      const length = wallLength(room, name)
      const shape = new Shape()
      shape.moveTo(0, 0)
      shape.lineTo(length, 0)
      shape.lineTo(length, height)
      shape.lineTo(0, height)
      for (const opening of openings) {
        if (opening.wall !== name) continue
        const x = lay.localX(opening.along, opening.span)
        const hole = new Path()
        hole.moveTo(x, opening.sill)
        hole.lineTo(x, opening.sill + opening.height)
        hole.lineTo(x + opening.span, opening.sill + opening.height)
        hole.lineTo(x + opening.span, opening.sill)
        shape.holes.push(hole)
      }
      const geo = new ShapeGeometry(shape)
      const mesh = wallOf[name]
      mesh.geometry.dispose()
      mesh.geometry = geo
      mesh.scale.set(1, 1, 1)
      mesh.position.copy(lay.at)
      mesh.rotation.set(0, lay.rot, 0)
    }

    const skirt = 78
    const skirtT = 16
    for (const name of Object.keys(laid) as RoomWall[]) {
      const length = wallLength(room, name)
      const cuts = openings
        .filter((opening) => opening.wall === name && opening.sill < skirt)
        .map((opening) => [opening.along, opening.along + opening.span] as [number, number])
        .sort((a, b) => a[0] - b[0])
      let cursor = 0
      const spans: [number, number][] = []
      for (const [start, end] of cuts) {
        const a = Math.max(0, start)
        const b = Math.min(length, end)
        if (a > cursor + 30) spans.push([cursor, a])
        cursor = Math.max(cursor, b)
      }
      if (length > cursor + 30) spans.push([cursor, length])
      for (const [a, b] of spans) {
        const mid = (a + b) / 2
        const len = b - a
        if (name === 'front') addSolid([len, skirt, skirtT], [mid, skirt / 2, skirtT / 2], trimMat)
        else if (name === 'back') addSolid([len, skirt, skirtT], [mid, skirt / 2, depth - skirtT / 2], trimMat)
        else if (name === 'left') addSolid([skirtT, skirt, len], [skirtT / 2, skirt / 2, mid], trimMat)
        else addSolid([skirtT, skirt, len], [width - skirtT / 2, skirt / 2, mid], trimMat)
      }
    }

    const tone = (base: MeshStandardMaterial, id: string) => {
      if (id !== selectedOpening) return base
      const mat = base.clone()
      mat.emissive.set('#1d4ed8')
      mat.emissiveIntensity = 0.4
      featureBin.push(mat)
      return mat
    }

    const side = (wall: RoomWall) => wall === 'left' || wall === 'right'
    const place = (opening: RoomOpening, along: number, y: number, alongSize: number, upSize: number, outSize: number, outDist: number, material: MeshStandardMaterial) => {
      const out = laid[opening.wall].out
      const onWall = side(opening.wall)
        ? new Vector3(opening.wall === 'left' ? 0 : width, y, along)
        : new Vector3(along, y, opening.wall === 'front' ? 0 : depth)
      onWall.addScaledVector(out, outDist)
      const size: [number, number, number] = onWall && side(opening.wall) ? [outSize, upSize, alongSize] : [alongSize, upSize, outSize]
      addSolid(size, [onWall.x, onWall.y, onWall.z], material, opening.id)
    }

    for (const opening of openings) {
      const frame = tone(frameMat, opening.id)
      const midA = opening.along + opening.span / 2
      const midY = opening.sill + opening.height / 2
      if (opening.kind === 'niche') {
        const face = tone(faceMaterial(opening), opening.id)
        const depthOut = opening.depth
        place(opening, midA, midY, opening.span, opening.height, 18, depthOut, face)
        place(opening, opening.along, midY, 18, opening.height, depthOut, depthOut / 2 + 2, face)
        place(opening, opening.along + opening.span, midY, 18, opening.height, depthOut, depthOut / 2 + 2, face)
        place(opening, midA, opening.sill + opening.height, opening.span, 18, depthOut, depthOut / 2 + 2, face)
        place(opening, midA, opening.sill, opening.span, 18, depthOut, depthOut / 2 + 2, face)
        continue
      }
      const bar = 55
      const deep = 70
      place(opening, opening.along, midY, bar, opening.height + bar, deep, 0, frame)
      place(opening, opening.along + opening.span, midY, bar, opening.height + bar, deep, 0, frame)
      place(opening, midA, opening.sill, opening.span, bar, deep, 0, frame)
      place(opening, midA, opening.sill + opening.height, opening.span, bar, deep, 0, frame)
      if (opening.kind === 'door') {
        place(opening, midA, opening.height / 2, opening.span - 36, opening.height - 24, 40, 0, tone(faceMaterial(opening), opening.id))
        continue
      }
      const pane = new Mesh(new PlaneGeometry(Math.max(20, opening.span - 20), Math.max(20, opening.height - 20)), tone(faceMaterial(opening), opening.id))
      const inset = laid[opening.wall].out.clone().multiplyScalar(-12)
      const at = side(opening.wall)
        ? new Vector3(opening.wall === 'left' ? 0 : width, midY, midA)
        : new Vector3(midA, midY, opening.wall === 'front' ? 0 : depth)
      at.add(inset)
      pane.position.copy(at)
      pane.rotation.y = opening.wall === 'left' ? Math.PI / 2 : opening.wall === 'right' ? -Math.PI / 2 : opening.wall === 'back' ? Math.PI : 0
      pane.userData.openingId = opening.id
      features.add(pane)
      featureBin.push(pane.geometry)
    }

    const win = openings.find((opening) => opening.kind === 'window')
    if (win) {
      const out = laid[win.wall].out
      const at = side(win.wall)
        ? new Vector3(win.wall === 'left' ? 0 : width, win.sill + win.height / 2, win.along + win.span / 2)
        : new Vector3(win.along + win.span / 2, win.sill + win.height / 2, win.wall === 'front' ? 0 : depth)
      sun.position.set(at.x + out.x * 1600, Math.max(at.y + 400, height * 0.75), at.z + out.z * 1600)
    } else {
      sun.position.set(-width * 0.15, height * 1.35, depth * 0.55)
    }
    sun.target.position.set(width * 0.55, 400, depth * 0.5)
    sun.target.updateMatrixWorld()
  }

  function aimFrom(clientX: number, clientY: number): boolean {
    if (!paintedRoom) return false
    const rect = renderer.domElement.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return false
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    return true
  }

  /** Nearest wall plane in front of the camera. Holes in the mesh do not hide the wall. */
  /** The picture is mirrored in X. Rays for the walls are turned back into room coordinates. */
  function roomRay(): { origin: Vector3; dir: Vector3 } {
    const origin = raycaster.ray.origin.clone()
    const dir = raycaster.ray.direction.clone()
    origin.x = -origin.x
    dir.x = -dir.x
    return { origin, dir }
  }

  function aimedWall(): { wall: RoomWall; along: number; up: number } | null {
    if (!paintedRoom) return null
    const { width, depth, height } = paintedRoom
    const { origin, dir } = roomRay()
    const found: { wall: RoomWall; t: number; along: number; up: number }[] = []
    const keep = (wall: RoomWall, t: number, along: number, up: number, onWall: boolean) => {
      if (t < 1 || !onWall || up < -20 || up > height + 20) return
      found.push({ wall, t, along, up })
    }
    if (Math.abs(dir.z) > 1e-8) {
      const frontT = (0 - origin.z) / dir.z
      const front = origin.clone().addScaledVector(dir, frontT)
      keep('front', frontT, front.x, front.y, front.x >= -20 && front.x <= width + 20)
      const backT = (depth - origin.z) / dir.z
      const back = origin.clone().addScaledVector(dir, backT)
      keep('back', backT, back.x, back.y, back.x >= -20 && back.x <= width + 20)
    }
    if (Math.abs(dir.x) > 1e-8) {
      const leftT = (0 - origin.x) / dir.x
      const left = origin.clone().addScaledVector(dir, leftT)
      keep('left', leftT, left.z, left.y, left.z >= -20 && left.z <= depth + 20)
      const rightT = (width - origin.x) / dir.x
      const right = origin.clone().addScaledVector(dir, rightT)
      keep('right', rightT, right.z, right.y, right.z >= -20 && right.z <= depth + 20)
    }
    found.sort((a, b) => a.t - b.t)
    const best = found[0]
    return best ? { wall: best.wall, along: best.along, up: best.up } : null
  }

  function pointOnWall(wall: RoomWall): { along: number; up: number } | null {
    if (!paintedRoom) return null
    const { width, depth, height } = paintedRoom
    const { origin, dir } = roomRay()
    let t = Number.NaN
    if (wall === 'front') t = Math.abs(dir.z) > 1e-8 ? (0 - origin.z) / dir.z : Number.NaN
    else if (wall === 'back') t = Math.abs(dir.z) > 1e-8 ? (depth - origin.z) / dir.z : Number.NaN
    else if (wall === 'left') t = Math.abs(dir.x) > 1e-8 ? (0 - origin.x) / dir.x : Number.NaN
    else t = Math.abs(dir.x) > 1e-8 ? (width - origin.x) / dir.x : Number.NaN
    if (!Number.isFinite(t) || t < 1) return null
    const point = origin.clone().addScaledVector(dir, t)
    if (point.y < -400 || point.y > height + 400) return null
    const along = wall === 'front' || wall === 'back' ? point.x : point.z
    return { along, up: point.y }
  }

  function hitPoint(clientX: number, clientY: number): RoomHit | null {
    if (!aimFrom(clientX, clientY)) return null
    const hits = raycaster.intersectObjects([features, furniture, ...Object.values(wallOf)], true)
    for (const found of hits) {
      let openingId = ''
      let wall = ''
      let blocked = false
      let current: Object3D | null = found.object
      while (current) {
        if (typeof current.userData.openingId === 'string') openingId = current.userData.openingId
        if (typeof current.userData.roomWall === 'string') wall = current.userData.roomWall
        if (current === furniture) blocked = true
        current = current.parent
      }
      const alongOf = (name: RoomWall) => (name === 'front' || name === 'back' ? -found.point.x : found.point.z)
      if (openingId) {
        const opening = paintedList.find((item) => item.id === openingId)
        if (!opening) continue
        return { kind: 'opening', id: openingId, wall: opening.wall, along: alongOf(opening.wall), up: found.point.y }
      }
      if (blocked) return { kind: 'busy' }
      if (wall === 'front' || wall === 'back' || wall === 'left' || wall === 'right') {
        return { kind: 'wall', wall, along: alongOf(wall), up: found.point.y }
      }
    }
    return null
  }

  return {
    setRoom(room, placements, sheets, focusId) {
      const { width, depth, height } = room
      const tex = floorTexture(room.floorColor)
      floorMat.map = tex
      floorMat.needsUpdate = true
      tex.repeat.set(width / 1200, depth / 1200)
      walls.color.set(room.wallColor)

      floor.scale.set(width, depth, 1)
      floor.position.set(width / 2, 0, depth / 2)
      ceiling.scale.set(width, depth, 1)
      ceiling.rotation.x = Math.PI / 2
      ceiling.position.set(width / 2, height, depth / 2)
      paintOpenings(room)

      const span = Math.max(width, depth, height)
      const shadow = sun.shadow.camera
      shadow.left = -span
      shadow.right = span
      shadow.top = span
      shadow.bottom = -span
      shadow.near = 50
      shadow.far = span * 4
      shadow.updateProjectionMatrix()
      fill.position.set(width + span * 0.2, height * 0.8, depth * 0.2)

      for (const item of bin) item.dispose()
      bin = []
      furniture.clear()
      movers = []
      for (const piece of placements) {
        if (piece.solids.length === 0) continue
        placeCabinet(piece.solids, piece, sheets)
      }
      for (const id of [...angles.keys()]) {
        if (!movers.some((mover) => mover.id === id)) angles.delete(id)
      }
      applyMotion()

      controls.maxDistance = span * 1.4
      if (!userMoved) {
        const focus = focusId ? placements.find((piece) => piece.id === focusId) : undefined
        const eye = new Vector3(width * 0.5, Math.min(1500, height - 200), Math.min(700, depth * 0.2))
        let atX = width * 0.5
        let atZ = depth * 0.62
        let atY = Math.min(720, height * 0.3)
        if (focus) {
          atX = focus.x + focus.w / 2
          atZ = focus.y + focus.d / 2
          atY = Math.min(height - 200, focus.lift + 420)
          // Stand near the front of the room so the walls, the floor and this cabinet are all in view.
          eye.x = width * 0.5
          eye.y = Math.min(1500, height - 200)
          eye.z = Math.min(900, depth * 0.22)
        } else if (placements.length > 0) {
          const n = placements.length
          const frontZ = Math.min(...placements.map((piece) => piece.y))
          atX = placements.reduce((sum, piece) => sum + piece.x + piece.w / 2, 0) / n
          atZ = placements.reduce((sum, piece) => sum + piece.y + piece.d / 2, 0) / n
          eye.x = Math.min(width - 400, Math.max(400, atX + 420))
          // Stay in front of the doors. Outside the front wall is fine: that
          // wall is open from the outside, so the back of the cabinet stays hidden.
          eye.z = frontZ - 1800
        }
        camera.position.set(-eye.x, eye.y, eye.z)
        controls.target.set(-atX, atY, atZ)
        controls.update()
      }
      notify()
    },
    toggle,
    fronts() {
      return movers.map((mover) => ({ id: mover.id, kind: mover.kind, open: isOpen(mover.id) }))
    },
    hit(clientX, clientY) {
      return hitPoint(clientX, clientY)
    },
    aimWall(clientX, clientY) {
      if (!aimFrom(clientX, clientY)) return null
      return aimedWall()
    },
    aimOn(clientX, clientY, wall) {
      if (!aimFrom(clientX, clientY)) return null
      return pointOnWall(wall)
    },
    preview(openings) {
      if (!paintedRoom) return
      paintOpenings(paintedRoom, openings)
    },
    setSelected(id) {
      selectedOpening = id
      if (paintedRoom) paintOpenings(paintedRoom, paintedList)
    },
    setNavigate(on) {
      ;(controls.mouseButtons as { LEFT: number }).LEFT = on ? MOUSE.ROTATE : -1
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      pointerDoc.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointermove', onMove)
      listeners.clear()
      controls.dispose()
      for (const item of bin) item.dispose()
      floor.geometry.dispose()
      floorMat.dispose()
      walls.dispose()
      ceilingMat.dispose()
      trimMat.dispose()
      frameMat.dispose()
      glassMat.dispose()
      for (const item of featureBin) item.dispose()
      trimGeo.dispose()
      frameGeo.dispose()
      glass.geometry.dispose()
      ceiling.geometry.dispose()
      backWall.geometry.dispose()
      frontWall.geometry.dispose()
      leftWall.geometry.dispose()
      rightWall.geometry.dispose()
      env.dispose()
      renderer.dispose()
      if (labels.domElement.parentElement === host) host.removeChild(labels.domElement)
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
    },
  }
}
