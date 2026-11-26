import { constantWheelZoom } from '@/lib/view3d/wheel-zoom'
import {
  ACESFilmicToneMapping,
  CubeCamera,
  HalfFloatType,
  WebGLCubeRenderTarget,
  Box3,
  Box3Helper,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  MOUSE,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Plane,
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
import { addDimensions, addOverallDimensions } from '@/lib/view3d/dimensions'
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
import { buildCabinet, refreshMirrors } from '@/lib/view3d/assemble'
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
  /** The cabinet's own outer size (legs in the height), before the turn. Written on the picture. */
  size?: { w: number; h: number; d: number }
  /**
   * Which sizes to write. `outer` (default): only width, height and depth.
   * `detail`: every size from the drawing, for the cabinet being edited. `none`: nothing.
   */
  dims?: 'outer' | 'detail' | 'none'
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

/** A rectangle on the floor, in room mm: x from the left wall, y from the front wall. */
export type FloorRect = { x: number; y: number; w: number; d: number }

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
  /** Outlines one placed cabinet (a room piece id), or none. */
  setPicked(id: string | null): void
  /** Called when a click lands on a cabinet (its piece id) or on empty room (null). */
  onPick(listener: (id: string | null) => void): () => void
  /**
   * When on, the left button drags a rectangle on the floor instead of turning the camera.
   * The finished rectangle goes to `onSketch`, in room mm (x from the left wall, y from the front wall).
   */
  setDrawing(on: boolean): void
  onSketch(listener: (rect: FloorRect) => void): () => void
  /** Shows a drawn rectangle on the floor, or hides it. */
  showSketch(rect: FloorRect | null): void
  /** When on, the picked cabinet can be dragged over the floor with the left button. */
  setMovable(on: boolean): void
  /** A dragged cabinet was dropped: its piece id and new spot, in room mm. */
  onMoved(listener: (id: string, x: number, y: number) => void): () => void
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
  // 1.5 is sharp enough on any screen and much lighter than 2 or 3.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  // Shadows do not change when only the camera turns, so they are worked out again only when
  // something in the scene changes (see the render loop).
  renderer.shadowMap.autoUpdate = false
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
  // Zoom right up to any detail: the wheel goes toward the spot under the pointer, with no stop
  // close in. The near plane follows the distance, so nothing close gets cut away.
  controls.minDistance = 2
  controls.maxDistance = 12000
  controls.zoomToCursor = true
  controls.addEventListener('change', () => {
    // OrbitControls pans slower the closer the camera is. Speed it back up so a drag with the
    // right button moves the room as fast close in as it does from a normal view of it.
    const distance = camera.position.distanceTo(controls.target)
    controls.panSpeed = 4 * Math.max(1, 2500 / Math.max(1, distance))
    const want = Math.min(30, Math.max(0.5, camera.position.distanceTo(controls.target) / 60))
    if (Math.abs(camera.near - want) < 0.01) return
    camera.near = want
    camera.updateProjectionMatrix()
  })
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
  // Mirrors show a picture of the room taken all round from its middle (see refreshMirrors).
  // From inside the room every wall and the ceiling face the camera, so the picture is whole.
  const mirrorShot = new WebGLCubeRenderTarget(512, { type: HalfFloatType })
  const mirrorCamera = new CubeCamera(20, 40000, mirrorShot)
  scene.add(mirrorCamera)
  let mirrorsDirty = true
  let mirrorsAgainAt = 0
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

  // Keep drawing for a short while after anything happens (a click, a drag, new content).
  let drawUntil = 0
  let wasBusy = false
  let lastDraw = 0
  // Until when shadows are worked out again: after new content or a moved cabinet.
  let shadowUntil = performance.now() + 2000
  const invalidate = (ms = 600) => {
    drawUntil = Math.max(drawUntil, performance.now() + ms)
  }
  const wake = () => invalidate()
  // Not on every mouse move: only hovering changes nothing in the picture.
  for (const type of ['pointerdown', 'pointerup', 'wheel', 'keydown'] as const) {
    host.addEventListener(type, wake, { passive: true })
  }
  window.addEventListener('pointerup', wake, { passive: true })
  const stopWheelZoom = constantWheelZoom({
    host,
    canvas: renderer.domElement,
    camera,
    controls,
    scene,
    step: () => 125,
    maxDistance: () => controls.maxDistance,
    onChange: () => {
      invalidate()
    },
  })
  const resize = () => {
    invalidate()
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
    // Draw only when something changed: the camera turned, a door is moving, or the picture was
    // touched or updated a moment ago. A still picture costs nothing, which matters with mirrors.
    const turned = controls.update()
    const busy = moving || turned
    if (wasBusy && !busy) invalidate(250)
    wasBusy = busy
    if (moving || turned || now < drawUntil || now - lastDraw > 1000) {
      if (moving || now < shadowUntil) renderer.shadowMap.needsUpdate = true
      // Mirrors follow the camera on every drawn frame, so the reflection is right from any angle;
      // lighter while the view moves, full sharpness on the frame after it stops.
      if (mirrorsDirty || (mirrorsAgainAt && now > mirrorsAgainAt)) {
        // Stand in the middle of the room at about eye height, then photograph all round.
        const middle = view.localToWorld(new Vector3(roomSize.width / 2, 1300, roomSize.depth / 2))
        mirrorCamera.position.copy(middle)
        refreshMirrors(scene, renderer, mirrorCamera)
        // Once more a moment later, when the board photos have loaded.
        mirrorsAgainAt = mirrorsDirty ? now + 1500 : 0
        mirrorsDirty = false
      }
      renderer.render(scene, camera)
      labels.render(scene, camera)
      lastDraw = now
    }
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
  const hitPiece = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects([...Object.values(wallOf), furniture], true)
    const first = hits.find((hit) => !(hit.object instanceof Box3Helper))
    let current: Object3D | null = first?.object ?? null
    while (current) {
      if (typeof current.userData.roomPiece === 'string') return current.userData.roomPiece as string
      current = current.parent
    }
    return null
  }

  // The selected cabinet gets an orange box around it. It is rebuilt with the furniture.
  let pickedId: string | null = null
  let pickedAtWall = false
  let pickedBox: Box3Helper | null = null
  const pickListeners = new Set<(id: string | null) => void>()
  const outlinePicked = () => {
    if (pickedBox) {
      pickedBox.removeFromParent()
      pickedBox.geometry.dispose()
      ;(pickedBox.material as { dispose(): void }).dispose()
      pickedBox = null
    }
    if (!pickedId) return
    const stand = furniture.children.find((child) => child.userData.roomPiece === pickedId)
    if (!stand) return
    furniture.updateMatrixWorld(true)
    const box = new Box3().setFromObject(stand)
    if (box.isEmpty()) return
    // Box3Helper draws in world space, so undo the furniture's own transform.
    const inverse = furniture.matrixWorld.clone().invert()
    box.applyMatrix4(inverse)
    box.expandByScalar(12)
    // Green while the back stands against a wall, orange otherwise.
    pickedBox = new Box3Helper(box, new Color(pickedAtWall ? '#16a34a' : '#ea580c'))
    pickedBox.renderOrder = 10
    ;(pickedBox.material as { depthTest: boolean }).depthTest = false
    furniture.add(pickedBox)
  }

  // ── Floor tools: drawing a cabinet and dragging one ─────────────────────────
  // The furniture lives in `view`, whose local x is mm from the left wall and z is mm from the front wall.
  const floorPlane = new Plane(new Vector3(0, 1, 0), 0)
  const floorAt = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const rect = renderer.domElement.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    view.updateMatrixWorld(true)
    const ray = raycaster.ray.clone().applyMatrix4(view.matrixWorld.clone().invert())
    const point = ray.intersectPlane(floorPlane, new Vector3())
    return point ? { x: point.x, y: point.z } : null
  }
  const snap10 = (value: number) => Math.round(value / 10) * 10

  const sketchMat = new MeshBasicMaterial({ color: '#f97316', transparent: true, opacity: 0.45, depthWrite: false })
  const sketchMesh = new Mesh(new BoxGeometry(1, 1, 1), sketchMat)
  sketchMesh.visible = false
  sketchMesh.renderOrder = 5
  view.add(sketchMesh)
  const showSketchRect = (rect: FloorRect | null) => {
    if (!rect || rect.w < 1 || rect.d < 1) {
      sketchMesh.visible = false
      return
    }
    sketchMesh.visible = true
    sketchMesh.scale.set(rect.w, 6, rect.d)
    sketchMesh.position.set(rect.x + rect.w / 2, 4, rect.y + rect.d / 2)
  }

  let drawingOn = false
  let movableOn = false
  const sketchListeners = new Set<(rect: FloorRect) => void>()
  const movedListeners = new Set<(id: string, x: number, y: number) => void>()
  type FloorDrag =
    | { kind: 'sketch'; pointerId: number; start: { x: number; y: number }; rect: FloorRect }
    | {
        kind: 'move'
        pointerId: number
        id: string
        stand: Object3D
        startPos: Vector3
        grab: { x: number; y: number }
        moved: number
        at: { x: number; y: number }
        from: { x: number; y: number }
      }
  let floorDrag: FloorDrag | null = null
  let roomSize = { width: 0, depth: 0 }

  // ── Against the wall ────────────────────────────────────────────────────────
  // Near a wall the cabinet is pulled onto it, and a green strip on the wall shows the back touches.
  const WALL_PULL_MM = 80
  type Foot = { w: number; d: number; h: number }
  const footOf = (stand: Object3D): Foot | null => {
    const foot = stand.userData.roomFoot as Foot | undefined
    return foot && foot.w > 0 && foot.d > 0 ? foot : null
  }
  /** How deep a niche lets the cabinet go past this wall where it stands (0 when there is none). */
  const nicheRoom = (wall: 'front' | 'back' | 'left' | 'right', from: number, to: number) => {
    let deepest = 0
    for (const opening of paintedList) {
      if (opening.kind !== 'niche' || opening.wall !== wall) continue
      const shared = Math.min(to, opening.along + opening.span) - Math.max(from, opening.along)
      if (shared > 40) deepest = Math.max(deepest, opening.depth)
    }
    return deepest
  }
  /**
   * Pulls a spot onto the walls it is close to, and keeps the cabinet inside the room. In front
   * of a niche it may go on into it; on drop the plan decides how far the cabinet really fits
   * (only the parts low enough for the niche go in, as with a combined cabinet).
   */
  const pullToWalls = (spot: { x: number; y: number }, foot: Foot) => {
    const maxX = Math.max(0, roomSize.width - foot.w)
    const maxY = Math.max(0, roomSize.depth - foot.d)
    const intoLeft = nicheRoom('left', spot.y, spot.y + foot.d)
    const intoRight = nicheRoom('right', spot.y, spot.y + foot.d)
    const intoFront = nicheRoom('front', spot.x, spot.x + foot.w)
    const intoBack = nicheRoom('back', spot.x, spot.x + foot.w)
    let x = Math.max(-intoLeft, Math.min(maxX + intoRight, spot.x))
    let y = Math.max(-intoFront, Math.min(maxY + intoBack, spot.y))
    const near = (a: number, b: number) => Math.abs(a - b) <= WALL_PULL_MM
    if (near(x, 0)) x = 0
    else if (near(x, maxX)) x = maxX
    else if (intoLeft && near(x, -intoLeft)) x = -intoLeft
    else if (intoRight && near(x, maxX + intoRight)) x = maxX + intoRight
    if (near(y, 0)) y = 0
    else if (near(y, maxY)) y = maxY
    else if (intoFront && near(y, -intoFront)) y = -intoFront
    else if (intoBack && near(y, maxY + intoBack)) y = maxY + intoBack
    return { x: Math.round(x), y: Math.round(y) }
  }
  /** Which wall the back of the cabinet is against, if any. Turn 0 has its back to the back wall. */
  const wallBehind = (spot: { x: number; y: number }, foot: Foot, turn: number): 'back' | 'right' | 'front' | 'left' | null => {
    const near = (a: number, b: number) => Math.abs(a - b) < 1.5
    if (turn === 0 && near(spot.y + foot.d, roomSize.depth)) return 'back'
    if (turn === 1 && near(spot.x + foot.w, roomSize.width)) return 'right'
    if (turn === 2 && near(spot.y, 0)) return 'front'
    if (turn === 3 && near(spot.x, 0)) return 'left'
    return null
  }
  const wallMat = new MeshBasicMaterial({ color: '#16a34a', transparent: true, opacity: 0.35, depthWrite: false })
  const wallMark = new Mesh(new BoxGeometry(1, 1, 1), wallMat)
  wallMark.visible = false
  wallMark.renderOrder = 6
  view.add(wallMark)
  /** Shows (or hides) the green strip behind a cabinet whose back touches a wall. */
  const markWall = (stand: Object3D | undefined, spot: { x: number; y: number } | undefined) => {
    const foot = stand ? footOf(stand) : null
    const turn = Number(stand?.userData.roomTurn ?? 0)
    const wall = foot && spot ? wallBehind(spot, foot, turn) : null
    pickedAtWall = wall != null
    if (!wall || !foot || !spot) {
      wallMark.visible = false
      return
    }
    const lift = Number(stand?.userData.roomLift ?? 0)
    const tall = foot.h + 40
    const y = lift + tall / 2 - 20
    const skin = 8
    wallMark.visible = true
    if (wall === 'back' || wall === 'front') {
      wallMark.scale.set(foot.w, tall, skin)
      wallMark.position.set(spot.x + foot.w / 2, y, wall === 'back' ? roomSize.depth - skin / 2 : skin / 2)
    } else {
      wallMark.scale.set(skin, tall, foot.d)
      wallMark.position.set(wall === 'right' ? roomSize.width - skin / 2 : skin / 2, y, spot.y + foot.d / 2)
    }
  }
  const markPickedWall = () => {
    const stand = pickedId ? furniture.children.find((child) => child.userData.roomPiece === pickedId) : undefined
    markWall(stand, stand?.userData.roomSpot as { x: number; y: number } | undefined)
  }
  const clampRoom = (p: { x: number; y: number }) => ({
    x: Math.max(0, Math.min(roomSize.width, snap10(p.x))),
    y: Math.max(0, Math.min(roomSize.depth, snap10(p.y))),
  })

  // Capture phase on the host, so the camera controls on the canvas never see a drag that is ours.
  const onHostDown = (event: PointerEvent) => {
    if (event.button !== 0 || floorDrag) return
    if (drawingOn) {
      const at = floorAt(event.clientX, event.clientY)
      if (!at) return
      event.stopPropagation()
      event.preventDefault()
      const start = clampRoom(at)
      floorDrag = { kind: 'sketch', pointerId: event.pointerId, start, rect: { ...start, w: 0, d: 0 } }
      showSketchRect(null)
      return
    }
    if (!movableOn || !pickedId) return
    if (hitPiece(event) !== pickedId) return
    const stand = furniture.children.find((child) => child.userData.roomPiece === pickedId)
    const at = floorAt(event.clientX, event.clientY)
    const from = stand?.userData.roomSpot as { x: number; y: number } | undefined
    if (!stand || !at || !from) return
    event.stopPropagation()
    event.preventDefault()
    floorDrag = {
      kind: 'move',
      pointerId: event.pointerId,
      id: pickedId,
      stand,
      startPos: stand.position.clone(),
      grab: { x: at.x - from.x, y: at.y - from.y },
      moved: 0,
      at: { ...from },
      from: { ...from },
    }
    renderer.domElement.style.cursor = 'grabbing'
  }
  const onFloorMove = (event: PointerEvent) => {
    const held = floorDrag
    if (!held || event.pointerId !== held.pointerId) return
    invalidate(400)
    const at = floorAt(event.clientX, event.clientY)
    if (!at) return
    if (held.kind === 'sketch') {
      const end = clampRoom(at)
      held.rect = {
        x: Math.min(held.start.x, end.x),
        y: Math.min(held.start.y, end.y),
        w: Math.abs(end.x - held.start.x),
        d: Math.abs(end.y - held.start.y),
      }
      showSketchRect(held.rect)
      return
    }
    const foot = footOf(held.stand)
    const loose = { x: snap10(at.x - held.grab.x), y: snap10(at.y - held.grab.y) }
    const { x, y } = foot ? pullToWalls(loose, foot) : loose
    markWall(held.stand, { x, y })
    held.moved = Math.max(held.moved, Math.abs(x - held.from.x), Math.abs(y - held.from.y))
    held.at = { x, y }
    held.stand.position.set(held.startPos.x + (x - held.from.x), held.startPos.y, held.startPos.z + (y - held.from.y))
    // The cabinet moved, so its shadow moves with it.
    shadowUntil = performance.now() + 400
    outlinePicked()
  }
  const onFloorUp = (event: PointerEvent) => {
    const held = floorDrag
    if (!held || event.pointerId !== held.pointerId) return
    floorDrag = null
    renderer.domElement.style.cursor = ''
    if (held.kind === 'sketch') {
      for (const listener of sketchListeners) listener(held.rect)
      return
    }
    // Put it back: the room is rebuilt at the new spot only if the plan accepts the move.
    held.stand.position.copy(held.startPos)
    markPickedWall()
    outlinePicked()
    if (held.moved >= 10) {
      for (const listener of movedListeners) listener(held.id, held.at.x, held.at.y)
      return
    }
    // Pressed and let go without moving: a click, not a drag. On a door, a drawer or a bed's
    // lifting frame of this cabinet it opens or closes it, as it does when nothing can be dragged.
    const moving = hitMoving(event)
    if (moving && moving.startsWith(`${held.id}:`)) toggle(moving)
  }
  host.addEventListener('pointerdown', onHostDown, true)
  window.addEventListener('pointermove', onFloorMove)
  window.addEventListener('pointerup', onFloorUp)
  window.addEventListener('pointercancel', onFloorUp)

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
    const pieceId = hitPiece(event)
    const moving = hitMoving(event)
    // First click picks the cabinet. A door or drawer of the picked cabinet opens on the next click.
    // With nobody listening for picks (the shared link), a door opens on the first click.
    if (moving && (pickListeners.size === 0 || (pieceId === pickedId && moving.startsWith(`${pieceId}:`)))) {
      toggle(moving)
      return
    }
    for (const listener of pickListeners) listener(pieceId)
  }
  const onMove = (event: PointerEvent) => {
    if (floorDrag) return
    if (drawingOn) {
      renderer.domElement.style.cursor = 'crosshair'
      return
    }
    const over = hitPiece(event)
    renderer.domElement.style.cursor = over && movableOn && over === pickedId ? 'grab' : over ? 'pointer' : ''
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
    const stand = new Group()
    stand.userData.roomPiece = piece.id
    stand.userData.roomSpot = { x: piece.x, y: piece.y }
    stand.userData.roomTurn = piece.turn
    stand.userData.roomLift = piece.lift
    stand.add(root)
    root.updateMatrixWorld(true)
    const outer = new Box3().setFromObject(root)
    stand.scale.z = -1
    // Scale Z turns the door face toward the front wall. A positive quarter
    // turn then matches the plan: front, left, back, right.
    stand.rotation.y = piece.turn * (Math.PI / 2)
    stand.updateMatrixWorld(true)
    // Measured before the size lines are added: they stand off the cabinet and would push it
    // away from the wall it is meant to touch.
    const bounds = new Box3().setFromObject(stand)
    // The plan's footprint is the carcass with its doors. Handles stick out in front of it, so the
    // cabinet is lined up by its back: when the plan says the back is at the wall, so does the picture.
    const turn = piece.turn
    const span = piece.size
      ? turn % 2 === 1
        ? { w: piece.size.d, d: piece.size.w }
        : { w: piece.size.w, d: piece.size.d }
      : { w: bounds.max.x - bounds.min.x, d: bounds.max.z - bounds.min.z }
    stand.userData.roomFoot = { w: span.w, d: span.d, h: bounds.max.y - bounds.min.y }
    let px = piece.x - bounds.min.x
    let pz = piece.y - bounds.min.z
    if (piece.size && turn === 0) pz = piece.y + span.d - bounds.max.z
    if (piece.size && turn === 1) px = piece.x + span.w - bounds.max.x
    stand.position.set(px, piece.lift + 1 - bounds.min.y, pz)
    const dims = piece.dims ?? 'outer'
    if (dims === 'detail') {
      addDimensions(root, solids, bin)
    } else if (dims === 'outer') {
      // In the room only the outer width, height and depth are written, not every inner size.
      const span = outer.getSize(new Vector3())
      addOverallDimensions(stand, outer, piece.size ?? { w: span.x, h: span.y, d: span.z }, bin)
    }
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

  const wakeOnCall = <T extends object>(api: T): T => {
    for (const key of Object.keys(api) as (keyof T)[]) {
      const value = api[key]
      if (typeof value === 'function') {
        api[key] = ((...args: unknown[]) => {
          invalidate(1200)
          shadowUntil = performance.now() + 1200
          mirrorsDirty = true
          return (value as (...a: unknown[]) => unknown)(...args)
        }) as T[keyof T]
      }
    }
    return api
  }
  return wakeOnCall({
    setRoom(room, placements, sheets, focusId) {
      const { width, depth, height } = room
      roomSize = { width, depth }
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
      markPickedWall()
      outlinePicked()

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
    setPicked(id) {
      if (id === pickedId) return
      pickedId = id
      markPickedWall()
      outlinePicked()
    },
    onPick(listener) {
      pickListeners.add(listener)
      return () => pickListeners.delete(listener)
    },
    setDrawing(on) {
      drawingOn = on
      if (!on && floorDrag?.kind === 'sketch') floorDrag = null
      renderer.domElement.style.cursor = on ? 'crosshair' : ''
    },
    onSketch(listener) {
      sketchListeners.add(listener)
      return () => sketchListeners.delete(listener)
    },
    showSketch(rect) {
      showSketchRect(rect)
    },
    setMovable(on) {
      movableOn = on
    },
    onMoved(listener) {
      movedListeners.add(listener)
      return () => movedListeners.delete(listener)
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
      pickListeners.clear()
      sketchListeners.clear()
      movedListeners.clear()
      host.removeEventListener('pointerdown', onHostDown, true)
      window.removeEventListener('pointermove', onFloorMove)
      window.removeEventListener('pointerup', onFloorUp)
      window.removeEventListener('pointercancel', onFloorUp)
      sketchMesh.geometry.dispose()
      sketchMat.dispose()
      wallMark.geometry.dispose()
      wallMat.dispose()
      pickedId = null
      outlinePicked()
      controls.dispose()
      mirrorShot.dispose()
      window.removeEventListener('pointerup', wake)
      stopWheelZoom()
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
  })
}
