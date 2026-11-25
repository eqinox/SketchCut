import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFSoftShadowMap,
  PMREMGenerator,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
  Raycaster,
  Vector2,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { addDimensions } from '@/lib/view3d/dimensions'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { DecorSheet } from '@/lib/finish-photo'
import type { SceneSolid } from '@/lib/cabinets/scene-solids'
import { buildCabinet, type AnimatedDoor, type AnimatedDrawer } from '@/lib/view3d/assemble'
import type { Disposable } from '@/lib/view3d/materials'

type Angle = {
  now: number
  target: number
  kind: 'door' | 'drawer'
  /** Value when the current drawer move started. */
  from: number
  /** 0..1 progress of the drawer move. 1 means it is sitting on the stop. */
  glide: number
}

/** A drawer eases out onto the stop and then sits exactly there. */
const DRAWER_GLIDE_S = 0.7

export type StudioPick = {
  /** `board` is a piece that does not move: a side, the bottom, a shelf. */
  kind: 'door' | 'drawer' | 'board'
  /** The piece's id, the same one the colour list uses. Missing on parts that are not boards. */
  piece?: string
  /** Key the open angle is stored under. */
  animKey: string
  /** Key the handle choice is stored under. It does not move with the cabinet. */
  pullKey: string
  clientX: number
  clientY: number
  open: boolean
  /** Right mouse button: the person asked for the menu, not for the door to move. */
  menu: boolean
  /** Finger or pen: there is no right button, so the menu always opens. */
  touch: boolean
}

export type CabinetStudio = {
  setContent(solids: SceneSolid[], sheets: ReadonlyMap<string, DecorSheet>): void
  toggle(animKey: string): void
  dispose(): void
}

function movingKeyOf(object: Object3D | null): { kind: 'door' | 'drawer'; animKey: string; pullKey: string } | null {
  let current = object
  while (current) {
    const pullKey = typeof current.userData.pullKey === 'string' ? current.userData.pullKey : ''
    if (typeof current.userData.drawerKey === 'string') {
      return { kind: 'drawer', animKey: current.userData.drawerKey, pullKey: pullKey || current.userData.drawerKey }
    }
    if (typeof current.userData.doorKey === 'string') {
      return { kind: 'door', animKey: current.userData.doorKey, pullKey: pullKey || current.userData.doorKey }
    }
    current = current.parent
  }
  return null
}

function pieceOf(object: Object3D | null): string | null {
  let current = object
  while (current) {
    if (typeof current.userData.piece === 'string') return current.userData.piece
    current = current.parent
  }
  return null
}

/**
 * The 3D picture. Lighting, materials and hinges live here so later tools
 * (sections, measurements, exploded views) can reuse the same studio.
 */
export function mountCabinetStudio(
  host: HTMLElement,
  options?: { onPick?: (pick: StudioPick) => void; onGestureStart?: () => void },
): CabinetStudio {
  const renderer = new WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
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
  renderer.setSize(host.clientWidth || 640, host.clientHeight || 520, false)
  renderer.setClearColor(0xe6dfd4)

  const scene = new Scene()

  const pmrem = new PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const env = pmrem.fromScene(room, 0.04).texture
  scene.environment = env
  scene.environmentIntensity = 0.65
  room.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    mats.forEach((mat) => mat.dispose())
  })
  pmrem.dispose()

  const camera = new PerspectiveCamera(32, 1, 10, 30000)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.panSpeed = 4
  controls.maxPolarAngle = Math.PI * 0.92
  controls.minDistance = 180
  controls.maxDistance = 14000

  const root = new Group()
  scene.add(root)

  scene.add(new HemisphereLight(0xfff6ea, 0xb7b0a4, 0.35))
  const sun = new DirectionalLight(0xfff4e5, 2.4)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0002
  sun.shadow.normalBias = 4
  const shadowCam = sun.shadow.camera
  shadowCam.near = 20
  shadowCam.far = 9000
  scene.add(sun)
  scene.add(sun.target)
  const fill = new DirectionalLight(0xd5e4f5, 0.45)
  scene.add(fill)

  const floorGeo = new PlaneGeometry(1, 1)
  const floorMat = new MeshStandardMaterial({ color: 0xd8d0c4, roughness: 0.92, metalness: 0 })
  const floor = new Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const wallMat = new MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.96, metalness: 0 })
  const wallGeo = new PlaneGeometry(1, 1)
  const backWall = new Mesh(wallGeo, wallMat)
  backWall.receiveShadow = true
  scene.add(backWall)
  const sideWall = new Mesh(wallGeo, wallMat)
  sideWall.receiveShadow = true
  sideWall.rotation.y = Math.PI / 2
  scene.add(sideWall)

  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const angles = new Map<string, Angle>()
  let doors: AnimatedDoor[] = []
  let drawers: AnimatedDrawer[] = []
  let bin: Disposable[] = []
  let userMoved = false
  let frame = 0
  let disposed = false

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())

  const resize = () => {
    const width = host.clientWidth || 640
    const height = host.clientHeight || 520
    renderer.setSize(width, height, false)
    labels.setSize(width, height)
    camera.aspect = width / Math.max(1, height)
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  const frameCabinet = () => {
    const bounds = new Box3().setFromObject(root)
    if (bounds.isEmpty()) return
    const center = bounds.getCenter(new Vector3())
    const size = bounds.getSize(new Vector3())
    const radius = Math.max(size.x, size.y, size.z, 200)
    const span = Math.max(radius * 4, 2400)
    floor.scale.set(span, span, 1)
    floor.position.set(center.x, bounds.min.y - 1, center.z)
    backWall.scale.set(span, span * 0.7, 1)
    backWall.position.set(center.x, bounds.min.y + span * 0.28, bounds.min.z - radius * 0.35)
    sideWall.scale.set(span, span * 0.7, 1)
    sideWall.position.set(bounds.min.x - radius * 0.45, bounds.min.y + span * 0.28, center.z)
    sun.position.set(center.x + radius * 0.55, bounds.max.y + radius * 1.3, center.z + radius * 1.1)
    sun.target.position.copy(center)
    sun.target.updateMatrixWorld()
    fill.position.set(center.x - radius, bounds.max.y + radius * 0.4, center.z + radius * 0.2)
    const shadowReach = radius * 1.6
    shadowCam.left = -shadowReach
    shadowCam.right = shadowReach
    shadowCam.top = shadowReach
    shadowCam.bottom = -shadowReach
    shadowCam.updateProjectionMatrix()
    if (userMoved) return
    const dist = radius * 1.75
    camera.position.set(center.x + dist * 0.78, center.y + dist * 0.38, center.z + dist)
    camera.near = Math.max(8, radius / 80)
    camera.far = radius * 40
    camera.updateProjectionMatrix()
    controls.target.copy(center)
    controls.update()
  }

  const applyMotion = () => {
    for (const door of doors) {
      const angle = angles.get(door.key)
      door.apply(angle ? angle.now : 0)
    }
    for (const drawer of drawers) {
      const angle = angles.get(drawer.key)
      drawer.apply(angle ? angle.now : 0)
    }
  }

  const hitMoving = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(root.children, true)
    for (const hit of hits) {
      const key = movingKeyOf(hit.object)
      if (key) return key
    }
    return null
  }
  /** The nearest board under the pointer and, when it is a door or drawer, how it moves. */
  const hitBoard = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    for (const hit of raycaster.intersectObjects(root.children, true)) {
      const moving = movingKeyOf(hit.object)
      const piece = pieceOf(hit.object)
      if (moving || piece) return { moving, piece }
    }
    return null
  }

  let downX = 0
  let downY = 0
  let pressed = false
  const isOpen = (animKey: string) => {
    const angle = angles.get(animKey)
    if (!angle) return false
    return angle.kind === 'drawer' ? angle.target > 0.5 : angle.target > 1
  }
  const toggle = (animKey: string) => {
    const hit = doors.find((item) => item.key === animKey)
    const angle = angles.get(animKey)
    if (!angle) return
    if (angle.kind === 'drawer') {
      angle.from = angle.now
      angle.glide = 0
      angle.target = angle.target > 0.5 ? 0 : 1
      return
    }
    if (!hit) return
    angle.target = angle.target > 1 ? 0 : hit.solid.openDeg
  }
  const onDown = (event: PointerEvent) => {
    pressed = true
    downX = event.clientX
    downY = event.clientY
    options?.onGestureStart?.()
  }
  const onUp = (event: PointerEvent) => {
    if (!pressed) return
    pressed = false
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 5) return
    const found = hitBoard(event)
    if (!found) return
    const hit = found.moving
    // A plain board (side, bottom, shelf) only answers the menu: there is nothing to open.
    if (!hit && event.button !== 2 && event.pointerType === 'mouse') return
    options?.onPick?.({
      kind: hit ? hit.kind : 'board',
      animKey: hit?.animKey ?? '',
      pullKey: hit?.pullKey ?? '',
      ...(found.piece ? { piece: found.piece } : {}),
      clientX: event.clientX,
      clientY: event.clientY,
      open: hit ? isOpen(hit.animKey) : false,
      menu: event.button === 2,
      touch: event.pointerType !== 'mouse',
    })
  }
  const onMove = (event: PointerEvent) => {
    renderer.domElement.style.cursor = hitMoving(event) ? 'pointer' : ''
  }
  const onOrbitStart = () => {
    userMoved = true
  }

  renderer.domElement.addEventListener('pointerdown', onDown)
  renderer.domElement.addEventListener('pointerup', onUp)
  renderer.domElement.addEventListener('pointermove', onMove)
  controls.addEventListener('start', onOrbitStart)

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
        if (angle.glide >= 1) {
          angle.now = angle.target
        } else {
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

  return {
    toggle,
    setContent(solids, sheets) {
      for (const item of bin) item.dispose()
      bin = []
      root.clear()
      const built = buildCabinet(root, solids, sheets, anisotropy, bin)
      addDimensions(root, solids, bin)
      doors = built.doors
      drawers = built.drawers
      for (const door of doors) {
        const existing = angles.get(door.key)
        if (!existing || existing.kind !== 'door') angles.set(door.key, { now: 0, target: 0, kind: 'door', from: 0, glide: 1 })
      }
      for (const drawer of drawers) {
        const existing = angles.get(drawer.key)
        if (!existing || existing.kind !== 'drawer') {
          angles.set(drawer.key, { now: 0, target: 0, kind: 'drawer', from: 0, glide: 1 })
        }
      }
      applyMotion()
      frameCabinet()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointermove', onMove)
      controls.removeEventListener('start', onOrbitStart)
      controls.dispose()
      for (const item of bin) item.dispose()
      floorGeo.dispose()
      floorMat.dispose()
      wallGeo.dispose()
      wallMat.dispose()
      env.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
      if (labels.domElement.parentElement === host) host.removeChild(labels.domElement)
    },
  }
}
