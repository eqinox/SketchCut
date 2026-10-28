import { useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
  type Material,
  type Texture,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { DecorSheet } from '@/lib/finish-photo'
import { DecorSheetContext } from '@/lib/cabinets/draw-3d'
import {
  SceneCaptureContext,
  createCaptureStore,
  type CaptureStore,
  type SceneSolid,
} from '@/lib/cabinets/scene-solids'

const METAL = new Set(['#c5cad3', '#94a3b8', '#8b919a', '#9aa3ad'])

function isMetal(color: string) {
  return METAL.has(color.toLowerCase())
}

const textureCache = new Map<string, Texture>()
const textureLoader = new TextureLoader()

function sharedTexture(url: string) {
  let tex = textureCache.get(url)
  if (!tex) {
    tex = textureLoader.load(url)
    tex.colorSpace = SRGBColorSpace
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    textureCache.set(url, tex)
  }
  return tex
}

function faceRepeat(faceW: number, faceH: number, sheet: DecorSheet) {
  if (faceH >= faceW) return [faceW / sheet.acrossMm, faceH / sheet.alongMm] as const
  return [faceW / sheet.alongMm, faceH / sheet.acrossMm] as const
}

function makeMaterial(
  color: string,
  sheet: DecorSheet | undefined,
  faceW: number,
  faceH: number,
  metal: boolean,
  bin: { dispose(): void }[],
) {
  const mat = new MeshStandardMaterial({
    color: sheet ? '#ffffff' : color,
    roughness: metal ? 0.34 : 0.78,
    metalness: metal ? 0.72 : 0.02,
  })
  if (sheet) {
    const tex = sharedTexture(sheet.url).clone()
    const [ru, rv] = faceRepeat(Math.max(faceW, 1), Math.max(faceH, 1), sheet)
    tex.repeat.set(ru, rv)
    tex.needsUpdate = true
    mat.map = tex
    bin.push({ dispose: () => tex.dispose() })
  }
  bin.push({ dispose: () => mat.dispose() })
  return mat
}

function boxMaterials(
  color: string,
  sheet: DecorSheet | undefined,
  w: number,
  h: number,
  d: number,
  bin: { dispose(): void }[],
): Material[] {
  const metal = isMetal(color)
  return [
    makeMaterial(color, sheet, d, h, metal, bin),
    makeMaterial(color, sheet, d, h, metal, bin),
    makeMaterial(color, sheet, w, d, metal, bin),
    makeMaterial(color, sheet, w, d, metal, bin),
    makeMaterial(color, sheet, w, h, metal, bin),
    makeMaterial(color, sheet, w, h, metal, bin),
  ]
}

function addBox(
  parent: Group,
  solid: Extract<SceneSolid, { kind: 'box' }>,
  sheet: DecorSheet | undefined,
  bin: { dispose(): void }[],
) {
  const geo = new BoxGeometry(solid.w, solid.h, solid.d)
  const mesh = new Mesh(geo, boxMaterials(solid.color, sheet, solid.w, solid.h, solid.d, bin))
  mesh.position.set(solid.x + solid.w / 2, -(solid.y + solid.h / 2), -(solid.z + solid.d / 2))
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  bin.push({ dispose: () => geo.dispose() })
}

function addDoor(
  parent: Group,
  solid: Extract<SceneSolid, { kind: 'door' }>,
  sheet: DecorSheet | undefined,
  bin: { dispose(): void }[],
) {
  const rad = (solid.openDeg * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const along = solid.width / 2
  const thick = solid.thickness / 2
  const boardX =
    solid.side === 'left'
      ? solid.hingeX + along * c + thick * s
      : solid.hingeX - along * c - thick * s
  const boardY = solid.y + solid.height / 2
  const boardZ = solid.z - along * s + thick * c
  const xAxis = new Vector3(solid.side === 'left' ? c : -c, 0, s)
  const yAxis = new Vector3(0, 1, 0)
  const zAxis = new Vector3(solid.side === 'left' ? s : -s, 0, -c)
  const geo = new BoxGeometry(solid.width, solid.height, solid.thickness)
  const mesh = new Mesh(
    geo,
    boxMaterials(solid.color, sheet, solid.width, solid.height, solid.thickness, bin),
  )
  mesh.matrixAutoUpdate = false
  const matrix = new Matrix4().makeBasis(xAxis, yAxis, zAxis)
  matrix.setPosition(boardX, -boardY, -boardZ)
  mesh.matrix.copy(matrix)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  bin.push({ dispose: () => geo.dispose() })
}

function addRail(
  parent: Group,
  solid: Extract<SceneSolid, { kind: 'rail' }>,
  bin: { dispose(): void }[],
) {
  const radius = Math.max(4, Math.min(solid.h, solid.d) / 2)
  const a = new Vector3(solid.x, -(solid.y + solid.h / 2), -(solid.z0 + solid.d / 2))
  const b = new Vector3(solid.x + solid.w, -(solid.y + solid.h / 2), -(solid.z1 + solid.d / 2))
  const dir = b.clone().sub(a)
  const length = dir.length()
  if (!(length > 1)) return
  const geo = new CylinderGeometry(radius, radius, length, 20)
  const mat = new MeshStandardMaterial({ color: solid.color, roughness: 0.32, metalness: 0.74 })
  const mesh = new Mesh(geo, mat)
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.multiplyScalar(1 / length))
  mesh.position.copy(a.add(b).multiplyScalar(0.5))
  mesh.castShadow = true
  parent.add(mesh)
  bin.push({ dispose: () => geo.dispose() }, { dispose: () => mat.dispose() })
}

function fillGroup(
  parent: Group,
  solids: SceneSolid[],
  sheets: ReadonlyMap<string, DecorSheet>,
  bin: { dispose(): void }[],
) {
  for (const solid of solids) {
    const sheet =
      solid.kind === 'rail' ? undefined : sheets.get(solid.color.toLowerCase())
    if (solid.kind === 'box') addBox(parent, solid, sheet, bin)
    else if (solid.kind === 'door') addDoor(parent, solid, sheet, bin)
    else addRail(parent, solid, bin)
  }
}

export function CabinetModel({ store }: { store: CaptureStore }) {
  const solids = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const sheets = useContext(DecorSheetContext)
  const solidsRef = useRef(solids)
  const sheetsRef = useRef(sheets)
  solidsRef.current = solids
  sheetsRef.current = sheets
  const hostRef = useRef<HTMLDivElement>(null)
  const rebuildRef = useRef<(() => void) | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: true })
    } catch {
      setFailed(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0xf4f1eb)
    renderer.shadowMap.enabled = true
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    host.appendChild(renderer.domElement)

    const scene = new Scene()
    const camera = new PerspectiveCamera(32, 1, 10, 30000)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI * 0.92
    controls.minDistance = 180
    controls.maxDistance = 14000

    const root = new Group()
    scene.add(root)
    scene.add(new AmbientLight(0xffffff, 0.62))
    scene.add(new HemisphereLight(0xfff8ef, 0xb9b3a8, 0.5))
    const sun = new DirectionalLight(0xffffff, 1.2)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    const shadowCam = sun.shadow.camera
    shadowCam.near = 20
    shadowCam.far = 9000
    shadowCam.left = -2500
    shadowCam.right = 2500
    shadowCam.top = 2500
    shadowCam.bottom = -2500
    scene.add(sun)
    scene.add(sun.target)

    const floorGeo = new PlaneGeometry(9000, 9000)
    const floorMat = new MeshStandardMaterial({ color: 0xe7e1d6, roughness: 1 })
    const floor = new Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    let userMoved = false
    const onStart = () => {
      userMoved = true
    }
    controls.addEventListener('start', onStart)

    const bin: { dispose(): void }[] = []
    const rebuild = () => {
      for (const item of bin) item.dispose()
      bin.length = 0
      root.clear()
      fillGroup(root, solidsRef.current, sheetsRef.current, bin)
      const bounds = new Box3().setFromObject(root)
      if (bounds.isEmpty()) return
      const center = bounds.getCenter(new Vector3())
      const size = bounds.getSize(new Vector3())
      const radius = Math.max(size.x, size.y, size.z, 200)
      floor.position.set(center.x, bounds.min.y - 1, center.z)
      sun.position.set(center.x + radius * 0.8, bounds.max.y + radius, center.z + radius)
      sun.target.position.copy(center)
      sun.target.updateMatrixWorld()
      if (userMoved) return
      const dist = radius * 1.7
      camera.position.set(center.x + dist * 0.72, center.y + dist * 0.42, center.z + dist)
      camera.near = Math.max(8, radius / 100)
      camera.far = radius * 50
      camera.updateProjectionMatrix()
      controls.target.copy(center)
      controls.update()
    }
    rebuildRef.current = rebuild

    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      controls.update()
      renderer.render(scene, camera)
    }
    const resize = () => {
      const width = host.clientWidth || 640
      const height = host.clientHeight || 520
      renderer.setSize(width, height, false)
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
    rebuild()
    tick()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.removeEventListener('start', onStart)
      controls.dispose()
      for (const item of bin) item.dispose()
      floorGeo.dispose()
      floorMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
      rebuildRef.current = null
    }
  }, [])

  useEffect(() => {
    rebuildRef.current?.()
  }, [solids, sheets])

  if (failed) {
    return <p className="py-8 text-center text-sm text-neutral-600">Браузърът не пуска 3D картината.</p>
  }

  return <div ref={hostRef} className="h-[520px] w-full" />
}

export function CapturedModel({ children }: { children: ReactNode }) {
  const storeRef = useRef<CaptureStore | null>(null)
  if (!storeRef.current) storeRef.current = createCaptureStore()
  const store = storeRef.current
  return (
    <SceneCaptureContext.Provider value={store}>
      <div className="relative w-full">
        <div className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0" aria-hidden>
          {children}
        </div>
        <CabinetModel store={store} />
        <p className="mt-1 text-center text-[11px] text-neutral-500">
          Завърти с мишката · колелцето приближава
        </p>
      </div>
    </SceneCaptureContext.Provider>
  )
}
