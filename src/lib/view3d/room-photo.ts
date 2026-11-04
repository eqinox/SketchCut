import {
  ACESFilmicToneMapping,
  Box3,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
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
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { DecorSheet } from '@/lib/finish-photo'
import type { SceneSolid } from '@/lib/cabinets/scene-solids'
import type { RoomPlan } from '@/lib/room'
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

export type RoomStudio = {
  setRoom(room: RoomPlan, placements: RoomPlacement[], sheets: ReadonlyMap<string, DecorSheet>): void
  /** Opens a shut door or drawer, and shuts an open one. */
  toggle(id: string): void
  fronts(): RoomFront[]
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
  host.appendChild(renderer.domElement)
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
  controls.minDistance = 500
  controls.maxDistance = 12000
  controls.maxPolarAngle = Math.PI * 0.58
  controls.minPolarAngle = 0.55
  controls.target.set(2000, 900, 2200)
  controls.addEventListener('start', () => {
    userMoved = true
  })

  scene.add(new HemisphereLight(0xfff4e4, 0xb7ab9a, 0.62))
  const sun = new DirectionalLight(0xfff3e2, 3.1)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.00025
  sun.shadow.normalBias = 6
  scene.add(sun)
  scene.add(sun.target)
  const fill = new DirectionalLight(0xd7e4f4, 0.55)
  scene.add(fill)

  const shell = new Group()
  scene.add(shell)
  const furniture = new Group()
  scene.add(furniture)

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
    const stand = new Group()
    stand.add(root)
    stand.scale.z = -1
    // Quarter turns clockwise from above. Scale Z is mirrored, so the
    // clockwise turn is a negative rotation about Y: front, left, back, right.
    stand.rotation.y = -piece.turn * (Math.PI / 2)
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

  return {
    setRoom(room, placements, sheets) {
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
      backWall.scale.set(width, height, 1)
      backWall.rotation.y = Math.PI
      backWall.position.set(width / 2, height / 2, depth)
      frontWall.scale.set(width, height, 1)
      frontWall.rotation.y = 0
      frontWall.position.set(width / 2, height / 2, 0)
      leftWall.scale.set(depth, height, 1)
      leftWall.rotation.y = Math.PI / 2
      leftWall.position.set(0, height / 2, depth / 2)
      rightWall.scale.set(depth, height, 1)
      rightWall.rotation.y = -Math.PI / 2
      rightWall.position.set(width, height / 2, depth / 2)

      const skirt = 78
      const skirtT = 16
      const trimBox = [
        { s: [width, skirt, skirtT], p: [width / 2, skirt / 2, skirtT / 2] },
        { s: [width, skirt, skirtT], p: [width / 2, skirt / 2, depth - skirtT / 2] },
        { s: [skirtT, skirt, depth], p: [skirtT / 2, skirt / 2, depth / 2] },
        { s: [skirtT, skirt, depth], p: [width - skirtT / 2, skirt / 2, depth / 2] },
      ]
      trims.forEach((mesh, index) => {
        const box = trimBox[index]!
        mesh.scale.set(box.s[0]!, box.s[1]!, box.s[2]!)
        mesh.position.set(box.p[0]!, box.p[1]!, box.p[2]!)
      })

      const winW = Math.min(1500, Math.max(700, depth * 0.42))
      const winH = Math.min(1300, Math.max(700, height * 0.42))
      const sill = Math.min(900, height - winH - 200)
      const winZ = depth * 0.55
      const winY = sill + winH / 2
      const bar = 55
      glass.scale.set(winW - 16, winH - 16, 1)
      glass.position.set(18, winY, winZ)
      const frameBox = [
        { s: [70, winH + bar, bar], p: [24, winY, winZ - winW / 2] },
        { s: [70, winH + bar, bar], p: [24, winY, winZ + winW / 2] },
        { s: [70, bar, winW], p: [24, winY + winH / 2, winZ] },
        { s: [70, bar, winW], p: [24, winY - winH / 2, winZ] },
      ]
      frames.forEach((mesh, index) => {
        const box = frameBox[index]!
        mesh.scale.set(box.s[0]!, box.s[1]!, box.s[2]!)
        mesh.position.set(box.p[0]!, box.p[1]!, box.p[2]!)
      })

      const span = Math.max(width, depth, height)
      sun.position.set(-span * 0.15, height * 1.35, winZ)
      sun.target.position.set(width * 0.62, 400, depth * 0.55)
      sun.target.updateMatrixWorld()
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
        const eye = new Vector3(width * 0.5, Math.min(1500, height - 200), Math.min(700, depth * 0.2))
        let atX = width * 0.5
        let atZ = depth * 0.62
        if (placements.length > 0) {
          const n = placements.length
          const frontZ = Math.min(...placements.map((piece) => piece.y))
          atX = placements.reduce((sum, piece) => sum + piece.x + piece.w / 2, 0) / n
          atZ = placements.reduce((sum, piece) => sum + piece.y + piece.d / 2, 0) / n
          eye.x = Math.min(width - 400, Math.max(400, atX + 420))
          eye.z = Math.max(180, frontZ - 2100)
          if (eye.z > frontZ - 900) {
            eye.z = Math.min(depth - 300, frontZ + 1200)
            eye.x = Math.min(width - 400, atX + 1900)
          }
        }
        camera.position.copy(eye)
        controls.target.set(atX, Math.min(720, height * 0.3), atZ)
        controls.update()
      }
      notify()
    },
    toggle,
    fronts() {
      return movers.map((mover) => ({ id: mover.id, kind: mover.kind, open: isOpen(mover.id) }))
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
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
    },
  }
}
