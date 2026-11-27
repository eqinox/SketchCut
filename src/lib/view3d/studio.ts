import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  BackSide,
  CubeCamera,
  HalfFloatType,
  WebGLCubeRenderTarget,
  BoxGeometry,
  CylinderGeometry,
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
import { constantWheelZoom } from '@/lib/view3d/wheel-zoom'
import { addDimensions } from '@/lib/view3d/dimensions'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { DecorSheet } from '@/lib/finish-photo'
import type { SceneSolid } from '@/lib/cabinets/scene-solids'
import { buildCabinet, refreshMirrors, type AnimatedDoor, type AnimatedDrawer } from '@/lib/view3d/assemble'
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
  /** Makes mirror glass see-through, to show what is fixed behind it (the light's frame and strip). */
  setSeeThroughMirrors(on: boolean): void
  /**
   * One scene of the assembly film: `standing` is in place, then `motion` plays (the cabinet
   * turned, pieces arriving one batch after another, nails hammered in) and `onDone` is called.
   * The camera is framed once on `all`, so it stays put from scene to scene.
   */
  setAssembly(
    standing: SceneSolid[],
    motion: FilmMotion,
    all: SceneSolid[],
    sheets: ReadonlyMap<string, DecorSheet>,
    onDone?: () => void,
  ): void
  /** 1 is the normal pace of the film; higher is faster. */
  setSpeed(speed: number): void
  dispose(): void
}

/** A nail on a back or a drawer bottom, in drawing millimetres; its head faces `dir`. */
export type FilmNail = { x: number; y: number; z: number; dir: 'back' | 'up' }
/**
 * Pieces arriving together. `drop` (the default without `from`): from above. `from`: from that
 * offset (drawing mm), straight, or `via: 'front'` first up in front of the place, then pushed in.
 * `flip`: turned over in place, the way a drawer box is turned the right way up.
 */
export type FilmBatch = {
  solids: SceneSolid[]
  mode?: 'drop' | 'flip'
  from?: [number, number, number]
  via?: 'front'
}
/** `pose`: the whole cabinet turned about the x axis (0 standing, π upside down, π/2 on its front). */
export type FilmMotion = { batches: FilmBatch[]; pose?: number; fromPose?: number; nails?: FilmNail[] }
type FilmAction = { seconds: number; run: (p: number) => void }

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
/** In the assembly film, new pieces drop this far and take this long to land. */
const ARRIVE_LIFT_MM = 450
const X_AXIS = new Vector3(1, 0, 0)

export function mountCabinetStudio(
  host: HTMLElement,
  options?: { onPick?: (pick: StudioPick) => void; onGestureStart?: () => void },
): CabinetStudio {
  const renderer = new WebGLRenderer({ antialias: true, alpha: false })
  // 1.5 is sharp enough on any screen and much lighter than 2 or 3.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
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
  // Zoom right up to any detail: the wheel goes toward the spot under the pointer, with no stop
  // close in. The near plane follows the distance, so nothing close gets cut away.
  controls.minDistance = 2
  controls.maxDistance = 14000
  controls.zoomToCursor = true
  let baseNear = 10
  // OrbitControls pans slower the closer the camera is. Speed it back up so a drag with the
  // right button moves the view as fast close in as it does from the first, whole-cabinet view.
  let panRef = 3000
  const fitNear = () => {
    const distance = camera.position.distanceTo(controls.target)
    controls.panSpeed = 4 * Math.max(1, panRef / Math.max(1, distance))
    const want = Math.min(baseNear, Math.max(0.5, camera.position.distanceTo(controls.target) / 60))
    if (Math.abs(camera.near - want) < 0.01) return
    camera.near = want
    camera.updateProjectionMatrix()
  }
  controls.addEventListener('change', fitNear)

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
  // Here the cabinet stands with just a floor and two walls. A mirror would then show empty
  // space behind the viewer, so the picture mirrors use is taken inside a whole room.
  const mirrorRoomMat = new MeshStandardMaterial({ color: 0xece7de, roughness: 0.96, metalness: 0, side: BackSide })
  const mirrorRoom = new Mesh(new BoxGeometry(1, 1, 1), mirrorRoomMat)
  mirrorRoom.visible = false
  scene.add(mirrorRoom)
  const mirrorShot = new WebGLCubeRenderTarget(512, { type: HalfFloatType })
  const mirrorCamera = new CubeCamera(20, 40000, mirrorShot)
  scene.add(mirrorCamera)
  let mirrorsDirty = true
  let mirrorsAgainAt = 0

  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const angles = new Map<string, Angle>()
  let doors: AnimatedDoor[] = []
  let drawers: AnimatedDrawer[] = []
  let bin: Disposable[] = []
  let userMoved = false
  // The assembly film: the scene's timed actions, where it is, and what to call at the end.
  let filmActions: FilmAction[] = []
  let filmAt = 0
  let filmElapsed = 0
  let filmSpeed = 1
  let filmDone: (() => void) | null = null
  let floorLevel = 0
  const hammer = new Group()
  {
    const headGeo = new BoxGeometry(28, 28, 110)
    const handleGeo = new BoxGeometry(26, 300, 20)
    const head = new Mesh(headGeo, new MeshStandardMaterial({ color: 0x4b4f55, roughness: 0.4, metalness: 0.7 }))
    head.position.y = 14
    const handle = new Mesh(handleGeo, new MeshStandardMaterial({ color: 0xb07a43, roughness: 0.7 }))
    handle.position.set(0, 14, 0)
    handle.rotation.z = Math.PI / 2
    handle.position.x = 165
    head.castShadow = true
    handle.castShadow = true
    hammer.add(head, handle)
    hammer.visible = false
    scene.add(hammer)
  }
  let assemblyFramed = false
  let assemblyShape = ''
  let frame = 0
  let disposed = false

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())

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
    step: () => panRef * 0.05,
    maxDistance: () => controls.maxDistance,
    onChange: () => {
      invalidate()
    fitNear()
    },
  })
  const resize = () => {
    invalidate()
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
    floorLevel = bounds.min.y
    backWall.scale.set(span, span * 0.7, 1)
    backWall.position.set(center.x, bounds.min.y + span * 0.28, bounds.min.z - radius * 0.35)
    mirrorRoom.scale.set(span, span * 0.7, span)
    mirrorRoom.position.set(center.x, bounds.min.y - 1 + span * 0.35, center.z)
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
    panRef = dist
    camera.position.set(center.x + dist * 0.78, center.y + dist * 0.38, center.z + dist)
    baseNear = Math.max(8, radius / 80)
    camera.near = baseNear
    camera.far = radius * 40
    camera.updateProjectionMatrix()
    controls.target.copy(center)
    controls.update()
    fitNear()
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
    if (filmAt < filmActions.length) {
      filmElapsed += delta * filmSpeed
      while (filmAt < filmActions.length && filmElapsed >= filmActions[filmAt].seconds) {
        filmActions[filmAt].run(1)
        filmElapsed -= filmActions[filmAt].seconds
        filmAt += 1
      }
      if (filmAt < filmActions.length) filmActions[filmAt].run(filmElapsed / filmActions[filmAt].seconds)
      else {
        hammer.visible = false
        const finish = filmDone
        filmDone = null
        finish?.()
      }
      moving = true
      shadowUntil = now + 300
    }
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
        // Photograph the room all round from a spot in front of the cabinet, at its middle height.
        const box = new Box3().setFromObject(root)
        if (!box.isEmpty()) {
          const middle = box.getCenter(new Vector3())
          const size = box.getSize(new Vector3())
          mirrorCamera.position.set(middle.x, middle.y, box.max.z + Math.max(500, size.z))
          refreshMirrors(scene, renderer, mirrorCamera, [mirrorRoom])
        }
        mirrorsAgainAt = mirrorsDirty ? now + 1500 : 0
        mirrorsDirty = false
      }
      renderer.render(scene, camera)
      labels.render(scene, camera)
      lastDraw = now
    }
  }
  frame = requestAnimationFrame(tick)

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
  let seeThrough = false
  const applySeeThrough = () => {
    root.traverse((object) => {
      const material = (object as Mesh).material
      const list = Array.isArray(material) ? material : material ? [material] : []
      for (const item of list) {
        if (item.userData.mirror !== true && item.userData.mirrorEdge !== true) continue
        item.transparent = seeThrough
        item.opacity = seeThrough ? 0.15 : 1
        item.depthWrite = !seeThrough
        item.needsUpdate = true
      }
    })
  }
  return wakeOnCall({
    toggle,
    setSeeThroughMirrors(on) {
      seeThrough = on
      applySeeThrough()
    },
    setSpeed(speed) {
      filmSpeed = speed
    },
    setAssembly(standing, motion, all, sheets, onDone) {
      const build = (list: SceneSolid[], parent: Group) =>
        buildCabinet(parent, list.filter((solid) => solid.kind !== 'dim'), sheets, anisotropy, bin)
      for (const item of bin) item.dispose()
      bin = []
      root.clear()
      // A different cabinet (or new sizes): frame again.
      const shape = all
        .map((solid) => (solid.kind === 'box' ? `${Math.round(solid.x)},${Math.round(solid.y)},${Math.round(solid.w)},${Math.round(solid.h)},${Math.round(solid.d)}` : solid.kind))
        .join('|')
      if (shape !== assemblyShape) {
        assemblyShape = shape
        assemblyFramed = false
        userMoved = false
      }
      if (!assemblyFramed) {
        // Frame on the whole cabinet once, so the view does not jump as pieces arrive.
        build(all, root)
        frameCabinet()
        for (const item of bin) item.dispose()
        bin = []
        root.clear()
        assemblyFramed = true
      }
      root.updateMatrixWorld(true)

      // Everything turns together when the cabinet is laid down or turned over.
      const pose = new Group()
      root.add(pose)
      const builds = [build(standing, pose)]
      const batchGroups = motion.batches.map((batch) => {
        const group = new Group()
        pose.add(group)
        builds.push(build(batch.solids, group))
        return group
      })
      const nailGeo = new CylinderGeometry(3.2, 3.2, 1.6, 12)
      const nailMat = new MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.8 })
      bin.push(nailGeo, nailMat)
      const nails = (motion.nails ?? []).map((nail) => {
        const mesh = new Mesh(nailGeo, nailMat)
        if (nail.dir === 'back') {
          mesh.rotation.x = Math.PI / 2
          mesh.position.set(nail.x, -nail.y, -nail.z - 0.8)
        } else {
          mesh.position.set(nail.x, -nail.y + 0.8, -nail.z)
        }
        mesh.visible = false
        pose.add(mesh)
        return mesh
      })
      doors = builds.flatMap((item) => item.doors)
      drawers = builds.flatMap((item) => item.drawers)
      for (const door of doors) angles.set(door.key, { now: 0, target: 0, kind: 'door', from: 0, glide: 1 })
      for (const drawer of drawers) angles.set(drawer.key, { now: 0, target: 0, kind: 'drawer', from: 0, glide: 1 })
      applyMotion()

      // The size of what is there by the end of the scene, standing: the turn is about its middle,
      // and it is lifted so it rests on the floor whichever way it lies.
      pose.updateMatrixWorld(true)
      const content = new Box3().setFromObject(pose)
      const middle = content.isEmpty() ? new Vector3() : content.getCenter(new Vector3())
      const half = content.isEmpty() ? new Vector3() : content.getSize(new Vector3()).multiplyScalar(0.5)
      const restAt = (angle: number, lift = 0) => {
        pose.rotation.x = angle
        if (angle === 0 && lift === 0) {
          pose.position.set(0, 0, 0)
          return
        }
        // Turned about `middle`, then set down on the floor.
        const turned = middle.clone().applyAxisAngle(X_AXIS, angle)
        const lowest = middle.y - (Math.abs(Math.cos(angle)) * half.y + Math.abs(Math.sin(angle)) * half.z)
        pose.position.set(0, middle.y - turned.y, middle.z - turned.z)
        pose.position.y += floorLevel - lowest + lift
      }
      const endPose = motion.pose ?? 0
      restAt(motion.fromPose ?? endPose)
      pose.updateMatrixWorld(true)

      const actions: FilmAction[] = []
      const flips = motion.batches.map((batch, index) => {
        if (batch.mode !== 'flip') return null
        const box = new Box3().setFromObject(batchGroups[index])
        return {
          center: box.getCenter(new Vector3()).applyMatrix4(pose.matrixWorld.clone().invert()),
          size: box.getSize(new Vector3()),
        }
      })
      for (const group of batchGroups) group.visible = false
      if (motion.fromPose !== undefined && motion.fromPose !== endPose) {
        const from = motion.fromPose
        actions.push({
          seconds: 2,
          run: (p) => {
            const q = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
            restAt(from + (endPose - from) * q, Math.sin(Math.PI * q) * 160)
            if (p >= 1) restAt(endPose)
          },
        })
      }
      const out = (p: number) => 1 - (1 - p) ** 3
      motion.batches.forEach((batch, index) => {
        const group = batchGroups[index]
        const quick = index >= 4
        if (batch.mode === 'flip') {
          // Turned over about its own middle, lifted clear of the floor while it turns.
          const { center, size } = flips[index]!
          const clear = Math.max(size.y, size.z) / 2 + 20
          actions.push({
            seconds: quick ? 0.6 : 1.3,
            run: (p) => {
              const q = out(p)
              const angle = Math.PI * (1 - q)
              group.visible = true
              group.rotation.x = angle
              const turned = center.clone().applyAxisAngle(X_AXIS, angle)
              group.position.set(0, center.y - turned.y + Math.sin(Math.PI * q) * clear, center.z - turned.z)
              if (p >= 1) {
                group.rotation.x = 0
                group.position.set(0, 0, 0)
              }
            },
          })
          return
        }
        const from = batch.from ? new Vector3(batch.from[0], -batch.from[1], -batch.from[2]) : null
        actions.push({
          seconds: quick ? 0.45 : 1.1,
          run: (p) => {
            group.visible = true
            const q = out(p)
            if (!from) {
              // From above, whichever way the cabinet lies: "up" in the cabinet's own turned space.
              const up = new Vector3(0, 1, 0).applyAxisAngle(X_AXIS, -pose.rotation.x)
              group.position.copy(up.multiplyScalar(ARRIVE_LIFT_MM * (1 - q)))
            } else if (batch.via === 'front') {
              // Up and across in front of its place, then pushed straight in.
              const a = Math.min(1, p / 0.55)
              const b = Math.max(0, (p - 0.55) / 0.45)
              const lift = 1 - out(a)
              group.position.set(from.x * lift, from.y * lift, from.z * (1 - out(b)))
            } else {
              group.position.copy(from).multiplyScalar(1 - q)
            }
            if (p >= 1) group.position.set(0, 0, 0)
          },
        })
      })
      nails.forEach((nail, index) => {
        const slow = index < 3
        actions.push({
          seconds: slow ? 0.7 : 0.09,
          run: (p) => {
            if (p >= 0.5) nail.visible = true
            const spot = nail.getWorldPosition(new Vector3())
            hammer.visible = p < 1
            const blow = slow ? Math.sin(Math.min(1, p / 0.95) * Math.PI * 2) ** 2 : Math.sin(p * Math.PI) ** 2
            hammer.position.set(spot.x, spot.y + 2 + (1 - blow) * (slow ? 110 : 45), spot.z)
          },
        })
      })
      filmActions = actions
      filmAt = 0
      filmElapsed = 0
      filmDone = onDone ?? null
      hammer.visible = false
      shadowUntil = performance.now() + 1500
      if (actions.length === 0) {
        filmDone = null
        onDone?.()
      }
    },
    setContent(solids, sheets) {
      assemblyFramed = false
      filmActions = []
      filmDone = null
      hammer.visible = false
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
      if (seeThrough) applySeeThrough()
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
      mirrorRoom.geometry.dispose()
      mirrorShot.dispose()
      mirrorRoomMat.dispose()
      window.removeEventListener('pointerup', wake)
      stopWheelZoom()
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
  })
}
