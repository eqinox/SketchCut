import {
  ACESFilmicToneMapping,
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Material,
  Mesh,
  Object3D,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { attachJoysticks } from '@/lib/view3d/joysticks'
import { BENCH_TABLE, benchJobs, benchLayout, type BenchGroup, type BenchJob, type BenchLineKind } from '@/lib/bench-plan'
import { createToolTag } from '@/lib/view3d/tool-tag'

/** What one moment of the bench film is: the label beside the tool says what it costs. */
export type BenchOp =
  | `line:${BenchLineKind}`
  | 'cross'
  | 'point'
  | 'dent'
  | 'drill'
  | 'pin'
  | 'slide'
  | 'screw'
  | 'swap'

export type Workbench = {
  /** The text beside the tool for each kind of job (null: no label). */
  setDescribe(describe: ((op: BenchOp) => string | null) | null): void
  /** Lays the boards out again with the earlier jobs done, and plays job `index` of `benchJobs(group)`. */
  play(index: number, onDone: () => void): void
  /** 1 is the normal pace; higher is faster. */
  setSpeed(speed: number): void
  /** Jumps the job now playing to this point (0 → 1), back or forward, like a video. */
  seek(fraction: number): void
  /** How far the job has played, 0 → 1. */
  progress(): number
  dispose(): void
}

/** One timed piece of a film: `run` is called with 0 → 1 as it goes, and with 1 at the end. */
type Action = {
  seconds: number
  run: (p: number) => void
  focus?: Vector3 | (() => Vector3)
  /** How far the camera stays from the focus (default: close in on the tool). */
  distance?: number
  /** What is being done, for the label beside the tool. */
  op?: BenchOp
}

/** Boards lie side by side, this far apart. */
const GAP_MM = 6
const SCREW_HOLES = 3
/** The first few repeats of a job are shown slowly; the rest go quickly. */
const SLOW_REPEATS = 2
const FAST = 0.28

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)
const clamp01 = (p: number) => Math.min(1, Math.max(0, p))
/** Part of `p` between `a` and `b`, as 0 → 1. */
const span = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))

export function mountWorkbench(host: HTMLElement, group: BenchGroup, soft: boolean): Workbench {
  const boards = group.boards
  const jobs: BenchJob[] = benchJobs(group)
  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  renderer.setClearColor(0xe9e6e0)
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'
  host.appendChild(renderer.domElement)
  // Beside the tool: what the job is, its time and its price.
  const tag = createToolTag(host, 76)
  let describe: ((op: BenchOp) => string | null) | null = null
  const tagAt = new Vector3()

  const scene = new Scene()
  scene.add(new HemisphereLight(0xffffff, 0xb9b2a6, 1.1))
  const sun = new DirectionalLight(0xffffff, 1.6)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0004
  scene.add(sun)
  scene.add(sun.target)

  const camera = new PerspectiveCamera(36, 1, 5, 40000)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI * 0.48
  // Thumb sticks for the camera on a phone or tablet.
  const stopSticks = attachJoysticks(host, camera, controls)

  const bin: (BufferGeometry | Material)[] = []
  const mat = (color: string, roughness = 0.6, metalness = 0) => {
    const m = new MeshStandardMaterial({ color, roughness, metalness })
    bin.push(m)
    return m
  }
  const box = (w: number, h: number, d: number, material: Material) => {
    const g = new BoxGeometry(w, h, d)
    bin.push(g)
    const mesh = new Mesh(g, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }
  const cyl = (r0: number, r1: number, h: number, material: Material, segments = 16) => {
    const g = new CylinderGeometry(r0, r1, h, segments)
    bin.push(g)
    const mesh = new Mesh(g, material)
    mesh.castShadow = true
    return mesh
  }
  const cone = (r: number, h: number, material: Material, segments = 12) => {
    const g = new ConeGeometry(r, h, segments)
    bin.push(g)
    return new Mesh(g, material)
  }

  // Materials shared by the tools and marks.
  const graphite = mat('#2d2d2f', 0.9)
  const steel = mat('#b9bec4', 0.3, 0.8)
  const darkSteel = mat('#4b4f55', 0.4, 0.7)
  const wood = mat('#b07a43', 0.7)
  const yellow = mat('#f0c232', 0.5)
  const hole = mat('#141414', 1)
  const slideMat = soft ? mat('#a9aeb3', 0.35, 0.7) : mat('#f3f2ee', 0.45)
  const wheelMat = mat('#e6d9bb', 0.6)
  const red = mat('#d62a2a', 0.5)

  // Tools: each group's origin is the working tip, pointing down.
  const pencil = new Group()
  {
    const tip = cone(3.6, 18, mat('#e8cfa2', 0.8), 6)
    tip.rotation.x = Math.PI
    tip.position.y = 9
    const lead = cone(1.2, 5, graphite, 6)
    lead.rotation.x = Math.PI
    lead.position.y = 2.5
    const body = cyl(3.6, 3.6, 150, yellow, 6)
    body.position.y = 18 + 75
    pencil.add(tip, lead, body)
    pencil.rotation.z = -0.45
  }
  const awl = new Group()
  {
    const spike = cyl(1.6, 0.3, 60, steel)
    spike.position.y = 30
    const handle = cyl(11, 9, 90, wood)
    handle.position.y = 60 + 45
    awl.add(spike, handle)
  }
  const hammer = new Group()
  {
    // Origin at the striking face: the square face points down, the tapered peen up,
    // and the handle runs off to the right through the middle of the head.
    const face = box(30, 10, 30, darkSteel)
    face.position.y = 5
    const neck = box(24, 60, 24, darkSteel)
    neck.position.y = 10 + 30
    // Square frustum: tapers from the body to a narrow peen.
    const peen = cyl(3, 24 / Math.SQRT2, 38, darkSteel, 4)
    peen.rotation.y = Math.PI / 4
    peen.position.y = 70 + 19
    const handle = box(300, 22, 28, wood)
    handle.position.set(12 + 150, 52, 0)
    hammer.add(face, neck, peen, handle)
  }

  // Cordless drill-driver, standing chuck down: a black ribbed chuck in front of the clutch
  // ring, the motor housing above, the grip and battery off to the right.
  // Only `spin` (the bit and the chuck) turns.
  const toolShell = mat('#e07a1f', 0.55)
  const rubber = mat('#232427', 0.85)
  const makeDriver = (bitRadius: number, bitLength: number) => {
    const tool = new Group()
    const spin = new Group()
    const shank = bitLength * 0.55
    const tip = cyl(bitRadius, bitRadius * 0.35, bitLength - shank, steel, 10)
    tip.position.y = (bitLength - shank) / 2
    const hex = cyl(3.2, 3.2, shank, steel, 6)
    hex.position.y = bitLength - shank / 2
    const nose = cyl(8, 9, 8, steel, 20)
    nose.position.y = bitLength + 4
    const chuck = cyl(17, 13, 42, rubber, 24)
    chuck.position.y = bitLength + 8 + 21
    spin.add(tip, hex, nose, chuck)
    // Ribs on the chuck show it turning.
    for (let i = 0; i < 8; i++) {
      const rib = box(3, 36, 5, rubber)
      const angle = (i / 8) * Math.PI * 2
      rib.position.set(Math.cos(angle) * 16, bitLength + 8 + 21, Math.sin(angle) * 16)
      rib.rotation.y = -angle
      spin.add(rib)
    }
    const base = bitLength + 50
    const clutch = cyl(21, 21, 16, rubber, 24)
    clutch.position.y = base + 8
    for (let i = 0; i < 5; i++) {
      const tick = box(2, 5, 1, toolShell)
      const angle = Math.PI * 0.15 + i * 0.28
      tick.position.set(Math.cos(angle) * 21.3, base + 8, Math.sin(angle) * 21.3)
      tick.rotation.y = -angle
      tool.add(tick)
    }
    const gear = cyl(26, 24, 26, rubber, 24)
    gear.position.y = base + 16 + 13
    const housing = cyl(31, 29, 104, toolShell, 24)
    housing.scale.z = 0.85
    housing.position.y = base + 42 + 52
    const cap = cyl(24, 31, 14, rubber, 24)
    cap.scale.z = 0.85
    cap.position.y = base + 146 + 7
    for (let i = 0; i < 3; i++) {
      const vent = box(1, 18, 22, rubber)
      vent.position.set(-31.5, base + 118 + i * 9, 0)
      tool.add(vent)
    }
    // Grip: leaves the housing to the right, leaning back toward the rear cap.
    const lean = 0.28
    const gripLength = 150
    const grip = box(gripLength, 46, 40, rubber)
    grip.rotation.z = lean
    const root = new Vector3(18, base + 92, 0)
    grip.position.set(root.x + (Math.cos(lean) * gripLength) / 2, root.y + (Math.sin(lean) * gripLength) / 2, 0)
    const trigger = box(22, 16, 14, rubber)
    trigger.rotation.z = lean
    trigger.position.set(root.x + 22, root.y - 26, 0)
    const end = new Vector3(root.x + Math.cos(lean) * gripLength, root.y + Math.sin(lean) * gripLength, 0)
    const pack = box(34, 120, 82, toolShell)
    pack.position.set(end.x + 6, end.y - 10, 0)
    const packBase = box(26, 124, 84, rubber)
    packBase.position.set(end.x + 6 + 30, end.y - 10, 0)
    tool.add(spin, clutch, gear, housing, cap, grip, trigger, pack, packBase)
    return { tool, spin }
  }
  const { tool: drill, spin: drillSpin } = makeDriver(2.25, 60)
  const { tool: driver, spin: driverSpin } = makeDriver(3, 30)
  const tools = [pencil, awl, hammer, drill, driver]
  for (const tool of tools) {
    tool.visible = false
    scene.add(tool)
  }

  const table = new Group()
  scene.add(table)

  const layout = benchLayout(group)
  const oneByOne = layout === 'one-by-one'
  // The boards side by side across the bench, their top edges (u = 0) in a row. One by one,
  // every board takes the same spot in turn.
  const placed = boards.map((board, index) => {
    const z = oneByOne ? 0 : boards.slice(0, index).reduce((sum, item) => sum + item.v + GAP_MM, 0)
    // The two sides: the first one turned round, so the front edges meet in the middle.
    const mirror = !oneByOne && group.mirrorSecond && index === 0 && boards.length > 1
    return { board, z, mirror, center: new Vector3(board.u / 2, board.thickness / 2, z + board.v / 2) }
  })
  const totalU = boards.reduce((most, board) => Math.max(most, board.u), 0)
  const totalV = placed.reduce((most, item) => Math.max(most, item.z + item.board.v), 0)
  /** Where a mark of face `face` lands on the bench while that face is up. */
  const at = (index: number, face: number, u: number, v: number, y = 0) => {
    const { board, z, mirror } = placed[index]
    const flipped = face % 2 === 1
    const across = mirror !== flipped ? board.v - v : v
    return new Vector3(u, board.thickness + y, z + across)
  }
  /** World point (with that face up) to the board's own space. */
  const toLocal = (index: number, face: number, point: Vector3) => {
    const c = placed[index].center
    const local = point.clone().sub(c)
    if (face % 2 === 1) {
      local.y = -local.y
      local.z = -local.z
    }
    return local
  }

  // The workshop bench: 2 m long, 90 cm deep, its top level with the boards' underside (y = 0).
  // Lengthwise the boards run along it; across, the bench is turned and you stand at their bottom edge.
  const TABLE_H = BENCH_TABLE.heightMm
  const floorY = -TABLE_H
  const tableX = layout === 'across' ? BENCH_TABLE.depthMm : BENCH_TABLE.widthMm
  const tableZ = layout === 'across' ? BENCH_TABLE.widthMm : BENCH_TABLE.depthMm
  const tableCenter = new Vector3(totalU / 2, 0, totalV / 2)
  {
    const benchWood = mat('#8a6a45', 0.75)
    const top = box(tableX, 40, tableZ, benchWood)
    top.position.set(tableCenter.x, -20, tableCenter.z)
    table.add(top)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = box(60, TABLE_H - 40, 60, benchWood)
        leg.position.set(tableCenter.x + sx * (tableX / 2 - 60), floorY + (TABLE_H - 40) / 2, tableCenter.z + sz * (tableZ / 2 - 60))
        table.add(leg)
      }
    }
  }
  // One by one: the board not being worked on leans on the wall past the right end of the bench.
  const wallX = tableCenter.x + tableX / 2 + 900
  const LEAN = (84 * Math.PI) / 180
  const leanTurn = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), LEAN)
  const wallSpot = (index: number) => {
    const { board } = placed[index]
    const step = boards.reduce((most, item) => Math.max(most, item.v), 0) + 200
    const z = tableCenter.z + (index - (boards.length - 1) / 2) * step
    const x = wallX - (board.u / 2) * Math.cos(LEAN) - (board.thickness / 2) * Math.sin(LEAN) - 4
    const y = floorY + (board.u / 2) * Math.sin(LEAN) + (board.thickness / 2) * Math.cos(LEAN)
    return new Vector3(x, y, z)
  }
  if (oneByOne) {
    const wall = box(40, 2600, Math.max(3000, boards.length * 900), mat('#e4e0d8', 0.9))
    wall.position.set(wallX + 20, floorY + 1300, tableCenter.z)
    table.add(wall)
  }

  // Someone at the bench: on the far side facing you, or, across, at the boards' bottom edge.
  const person = new Group()
  const upper = new Group()
  const arms: Group[] = []
  {
    const skin = mat('#d8a585', 0.8)
    const shirt = mat('#46658c', 0.85)
    const trousers = mat('#33373e', 0.85)
    const shoes = mat('#1c1c1c', 0.7)
    for (const side of [-1, 1]) {
      const leg = cyl(62, 50, 800, trousers, 12)
      leg.position.set(side * 95, 400 + 40, 0)
      const shoe = box(110, 50, 260, shoes)
      shoe.position.set(side * 95, 25, 50)
      person.add(leg, shoe)
    }
    // The upper body bends at the hips toward the work.
    upper.position.y = 840
    const hips = box(330, 140, 200, trousers)
    hips.position.y = 30
    const torso = box(380, 520, 220, shirt)
    torso.position.y = 100 + 260
    const neck = cyl(45, 45, 70, skin, 10)
    neck.position.y = 620 + 35
    const headGeo = new SphereGeometry(105, 18, 14)
    bin.push(headGeo)
    const head = new Mesh(headGeo, skin)
    head.castShadow = true
    head.scale.y = 1.15
    head.position.y = 690 + 110
    upper.add(hips, torso, neck, head)
    for (const side of [-1, 1]) {
      // Each arm points along its +z from the shoulder, so it can be aimed with lookAt.
      const arm = new Group()
      arm.position.set(side * 225, 580, 0)
      const sleeve = cyl(48, 42, 300, shirt, 10)
      sleeve.rotation.x = Math.PI / 2
      sleeve.position.z = 150
      const forearm = cyl(38, 32, 300, skin, 10)
      forearm.rotation.x = Math.PI / 2
      forearm.position.z = 450
      const hand = box(70, 40, 90, skin)
      hand.position.z = 640
      arm.add(sleeve, forearm, hand)
      upper.add(arm)
      arms.push(arm)
    }
    person.add(upper)
    scene.add(person)
  }
  const ARM_MM = 660
  /** Where the person stands while following the work, and which way they face. */
  const standAt = (work: Vector3) =>
    layout === 'across'
      ? { spot: new Vector3(tableCenter.x + tableX / 2 + 260, floorY, work.z), facing: -Math.PI / 2 }
      : { spot: new Vector3(work.x, floorY, tableCenter.z - tableZ / 2 - 260), facing: 0 }
  /** Where the hand holds each tool, in the tool's own space. */
  const gripOf = new Map<Object3D, Vector3>([
    [pencil, new Vector3(0, 80, 0)],
    [awl, new Vector3(0, 105, 0)],
    [hammer, new Vector3(250, 52, 0)],
    [drill, new Vector3(95, 225, 0)],
    [driver, new Vector3(95, 195, 0)],
  ])
  /** Set by the job that moves a board: the person carries it instead of following the tools. */
  let carrying: { spot: Vector3; facing: number; hands: [Vector3, Vector3] } | null = null
  const personAt = new Vector3()
  const shoulder = new Vector3()
  const aim = new Vector3()
  const reach = (hands: [Vector3, Vector3]) => {
    // Bend at the hips toward the hands, then point each arm at its hand.
    const mid = hands[0].clone().add(hands[1]).multiplyScalar(0.5)
    const local = person.worldToLocal(mid.clone())
    const flat = Math.hypot(local.x, local.z)
    upper.rotation.x = Math.min(0.75, Math.max(0, (flat - 380) / 900)) * Math.sign(local.z || 1)
    upper.updateMatrixWorld(true)
    arms.forEach((arm, i) => {
      arm.getWorldPosition(shoulder)
      aim.copy(hands[i]).sub(shoulder)
      if (aim.length() > ARM_MM) aim.setLength(ARM_MM)
      arm.lookAt(shoulder.clone().add(aim))
    })
  }
  const restHands = (): [Vector3, Vector3] => {
    const front = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), person.rotation.y)
    const side = new Vector3(1, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), person.rotation.y)
    const base = person.position.clone().add(new Vector3(0, 900, 0)).addScaledVector(front, 120)
    return [base.clone().addScaledVector(side, -260), base.clone().addScaledVector(side, 260)]
  }
  const placePerson = (delta: number) => {
    const tool = tools.find((item) => item.visible)
    let hands: [Vector3, Vector3]
    if (carrying) {
      person.position.copy(carrying.spot)
      person.rotation.y = carrying.facing
      person.updateMatrixWorld(true)
      hands = carrying.hands
    } else {
      const work = tool ? tool.position : personAt.lengthSq() > 0 ? personAt : tableCenter
      const { spot, facing } = standAt(work)
      const k = 1 - Math.exp(-delta * 5)
      if (person.position.lengthSq() === 0) person.position.copy(spot)
      person.position.lerp(spot, k)
      person.rotation.y = facing
      person.updateMatrixWorld(true)
      if (tool) {
        personAt.copy(tool.position)
        // One hand on the tool, the other on the board beside it.
        tool.updateMatrixWorld(true)
        const grip = tool.localToWorld(gripOf.get(tool)?.clone() ?? new Vector3(0, 150, 0))
        const other = tool.position.clone().add(layout === 'across' ? new Vector3(0, 10, 180) : new Vector3(-200, 10, 0))
        hands = [other, grip]
      } else {
        hands = restHands()
      }
    }
    reach(hands)
  }

  // Everything in view: the bench, the boards, the person and the wall.
  const minX = Math.min(0, tableCenter.x - tableX / 2, layout === 'across' ? tableCenter.x : 0)
  const maxX = Math.max(totalU, tableCenter.x + tableX / 2 + (layout === 'across' ? 600 : 0), oneByOne ? wallX : 0)
  const minZ = Math.min(0, tableCenter.z - tableZ / 2 - 500)
  const maxZ = Math.max(totalV, tableCenter.z + tableZ / 2)
  const spanX = maxX - minX
  const spanZ = maxZ - minZ

  const floor = new Mesh(new PlaneGeometry(1, 1), mat('#cbb48f', 0.85))
  bin.push(floor.geometry)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  floor.scale.set(spanX + 3000, spanZ + 3000, 1)
  floor.position.set((minX + maxX) / 2, floorY - 0.5, (minZ + maxZ) / 2)
  table.add(floor)

  // The standing person reaches well above the bench: leave room for them too.
  const radius = Math.max(spanX, spanZ, 600) + 700
  /** Where the camera looks from when it shows all the boards. */
  const home = { target: new Vector3((minX + maxX) / 2, -150, (minZ + maxZ) / 2), camera: new Vector3() }
  /** Far enough back that the whole length fits, on a narrow phone screen too. */
  const placeHome = () => {
    const look = new Vector3(0, 0.75, 0.72).normalize()
    const half = Math.tan(((camera.fov / 2) * Math.PI) / 180)
    const across = half * Math.max(0.3, camera.aspect)
    const distance = Math.max(radius * 1.04, ((spanX / 2) * 1.12) / across + spanZ / 2 + 900)
    home.camera.copy(home.target).addScaledVector(look, distance)
  }
  placeHome()
  const frame = () => {
    controls.target.copy(home.target)
    camera.position.copy(home.camera)
    camera.updateProjectionMatrix()
    controls.update()
    sun.position.set(minX + spanX * 0.3, radius * 1.4, maxZ + radius * 0.6)
    sun.target.position.set((minX + maxX) / 2, floorY, (minZ + maxZ) / 2)
    const cam = sun.shadow.camera
    cam.left = -radius
    cam.right = radius
    cam.top = radius
    cam.bottom = -radius
    cam.near = 10
    cam.far = radius * 6
    cam.updateProjectionMatrix()
  }
  frame()

  let built = new Group()
  table.add(built)
  let slabs: Group[] = []

  /** Puts a mark or a fitting on board `index`, given where it is on the bench while `face` is up. */
  const put = (object: Object3D, index: number, face: number, point: Vector3) => {
    object.position.copy(toLocal(index, face, point))
    if (face % 2 === 1) object.rotation.x += Math.PI
    slabs[index].add(object)
  }

  /** A thin pencil line on one board, drawn along z from a to b: `draw(q)` shows it up to q. */
  const pencilLine = (index: number, face: number, a: Vector3, b: Vector3) => {
    const line = box(1, 0.3, 1, graphite)
    line.castShadow = false
    put(line, index, face, a)
    line.visible = false
    return (q: number) => {
      const drawn = Math.abs(b.z - a.z) * q
      line.visible = drawn > 0.5
      line.scale.set(1.8, 1, Math.max(0.01, drawn))
      const mid = a.clone().add(new Vector3(0, 0.15, Math.sign(b.z - a.z) * (drawn / 2)))
      line.position.copy(toLocal(index, face, mid))
    }
  }
  /** A short pencil stroke along x (for crosses). */
  const pencilTick = (index: number, face: number, c: Vector3, along: 'x' | 'z', half: number) => {
    const line = box(along === 'x' ? half * 2 : 1.8, 0.3, along === 'x' ? 1.8 : half * 2, graphite)
    line.castShadow = false
    put(line, index, face, c.clone().add(new Vector3(0, 0.15, 0)))
    line.visible = false
    return (q: number) => {
      line.visible = q > 0.05
      if (along === 'x') line.scale.x = Math.max(0.01, q)
      else line.scale.z = Math.max(0.01, q)
    }
  }

  /** Builds the boards and the whole film; nothing is shown until the actions run. */
  const script = () => {
    built.removeFromParent()
    built = new Group()
    table.add(built)
    slabs = placed.map(({ board, center }) => {
      const holder = new Group()
      holder.position.copy(center)
      const slab = box(board.u, board.thickness, board.v, mat(board.color, 0.7))
      holder.add(slab)
      built.add(holder)
      return holder
    })

    const film: Action[][] = jobs.map(() => [])
    const slow = (count: number) => (count < SLOW_REPEATS ? 1 : FAST)
    let count = 0

    // One by one: the first board on the bench, the others leaning on the wall.
    let onTable = 0
    const turnedTo = placed.map(() => 0)
    const flipOf = (index: number) => new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), turnedTo[index] * Math.PI)
    const leanPose = (flip: Quaternion) => leanTurn.clone().multiply(flip)
    if (oneByOne) {
      for (let index = 1; index < placed.length; index++) {
        slabs[index].position.copy(wallSpot(index))
        slabs[index].quaternion.copy(leanPose(flipOf(index)))
      }
    }
    /** Carries the board on the bench to the wall, then brings `next` from the wall to the bench. */
    const swap = (next: number): Action => {
      const away = onTable
      const awayFlip = flipOf(away)
      const nextFlip = flipOf(next)
      const benchSpot = (index: number) => placed[index].center.clone()
      const moveBoard = (index: number, flip: Quaternion, from: 'bench' | 'wall', t: number) => {
        const q = from === 'bench' ? t : 1 - t
        const a = benchSpot(index)
        const b = wallSpot(index)
        const pos = a.clone().lerp(b, ease(q))
        pos.y += Math.sin(Math.PI * t) * 380
        slabs[index].position.copy(pos)
        slabs[index].quaternion.copy(new Quaternion().slerp(leanTurn, ease(span(q, 0.35, 1))).multiply(flip))
        return pos
      }
      const holding = (pos: Vector3, index: number) => {
        // Hands on the board's far long edge (on the bench) or its ends (going up against the wall).
        const half = placed[index].board.u / 4
        return {
          // Never inside the wall: at the wall they stand beside the board.
          spot: new Vector3(Math.min(pos.x, wallX - 420), floorY, pos.z - placed[index].board.v / 2 - 240),
          facing: 0,
          hands: [pos.clone().add(new Vector3(-half, 30, -placed[index].board.v / 2)), pos.clone().add(new Vector3(half, 30, -placed[index].board.v / 2))] as [Vector3, Vector3],
        }
      }
      let watch = benchSpot(away)
      onTable = next
      return {
        seconds: 5,
        op: 'swap',
        distance: Math.max(2600, radius * 1.1),
        focus: () => watch,
        run: (p) => {
          const t1 = span(p, 0.04, 0.46)
          const t2 = span(p, 0.54, 0.96)
          const awayPos = moveBoard(away, awayFlip, 'bench', t1)
          const nextPos = moveBoard(next, nextFlip, 'wall', t2)
          if (p >= 1) {
            carrying = null
            watch = benchSpot(next)
            return
          }
          if (p < 0.5) {
            watch = awayPos
            carrying = holding(awayPos, away)
          } else {
            watch = nextPos
            carrying = holding(nextPos, next)
          }
        },
      }
    }

    jobs.forEach((job, jobIndex) => {
      const actions = film[jobIndex]
      const face = job.face
      const all = placed.flatMap(({ board }, index) => (board.faces[face] ? [{ index, marks: board.faces[face] }] : []))
      // One by one: the board on the bench first, then each of the others brought over in turn.
      const batches = oneByOne
        ? [...all].sort((a, b) => (a.index === onTable ? -1 : b.index === onTable ? 1 : a.index - b.index)).map((item) => [item])
        : [all]
      for (const onFace of batches) {
        if (oneByOne && onFace[0] && onFace[0].index !== onTable) actions.push(swap(onFace[0].index))

      if (job.phase === 'mark') {
        // The second face: each board that has work on it is lifted and turned over.
        if (face > 0) {
          const turning = onFace.map((item) => item.index)
          for (const index of turning) turnedTo[index] = face
          actions.push({
            focus: placed[turning[0] ?? 0].center.clone(),
            seconds: 1.8,
            run: (p) => {
              const q = ease(p)
              for (const index of turning) {
                const { board, center } = placed[index]
                slabs[index].rotation.x = (face - 1 + q) * Math.PI
                slabs[index].position.y = center.y + Math.sin(Math.PI * q) * (board.v / 2 + 60)
              }
            },
          })
        }
        // Pencil lines: a line at the same place on boards lying side by side is one stroke.
        const strokes: { x: number; z0: number; z1: number; kind: BenchLineKind; parts: { index: number; a: Vector3; b: Vector3 }[] }[] = []
        for (const { index, marks } of onFace) {
          for (const line of marks.lines) {
            const a = at(index, face, line.u0, line.v0)
            const b = at(index, face, line.u1, line.v1)
            const [p0, p1] = a.z <= b.z ? [a, b] : [b, a]
            const joined = strokes.find(
              (item) => Math.abs(item.x - p0.x) < 1 && p0.z - item.z1 <= GAP_MM + 2 && item.z0 - p1.z <= GAP_MM + 2,
            )
            if (joined) {
              joined.z0 = Math.min(joined.z0, p0.z)
              joined.z1 = Math.max(joined.z1, p1.z)
              joined.parts.push({ index, a: p0, b: p1 })
            } else {
              strokes.push({ x: p0.x, z0: p0.z, z1: p1.z, kind: line.kind ?? 'bottom', parts: [{ index, a: p0, b: p1 }] })
            }
          }
        }
        strokes.sort((a, b) => a.x - b.x)
        for (const stroke of strokes) {
          const draws = stroke.parts.map((part) => ({ part, draw: pencilLine(part.index, face, part.a, part.b) }))
          const y = stroke.parts[0].a.y
          const length = stroke.z1 - stroke.z0
          actions.push({
            focus: () => new Vector3(pencil.position.x, y, pencil.position.z),
            op: `line:${stroke.kind}`,
            seconds: (1.2 + length / 900) * slow(count++),
            run: (p) => {
              const q = ease(span(p, 0.15, 0.9))
              const z = stroke.z0 + length * q
              for (const { part, draw } of draws) draw(span(z, part.a.z, part.b.z))
              pencil.visible = p < 1
              pencil.position.set(stroke.x, y + (1 - span(p, 0, 0.15)) * 40, z)
            },
          })
        }
        // A cross where the clothes rail's holder goes, then a small one at every shelf-pin point.
        for (const { index, marks } of onFace) {
          const spots = [
            ...marks.crosses.map((item) => ({ ...item, half: 14, op: 'cross' as const })),
            ...marks.points.map((item) => ({ ...item, half: 7, op: 'point' as const })),
          ]
          for (const spot of spots) {
            const c = at(index, face, spot.u, spot.v)
            const one = pencilTick(index, face, c, 'x', spot.half)
            const two = pencilTick(index, face, c, 'z', spot.half)
            actions.push({
              focus: c,
              op: spot.op,
              seconds: 0.9 * slow(count++),
              run: (p) => {
                one(span(p, 0.1, 0.5))
                two(span(p, 0.55, 0.95))
                pencil.visible = p < 1
                pencil.position.set(c.x, c.y + (1 - span(p, 0, 0.1)) * 30, c.z)
              },
            })
          }
        }
      }

      if (job.phase === 'pins') {
        // A dent with the awl and hammer at every point, then every hole drilled, then every pin knocked in.
        const points = onFace.flatMap(({ index, marks }) =>
          marks.points.map((point) => ({ index, c: at(index, face, point.u, point.v) })),
        )
        const dents = points.map(({ index, c }) => {
          const dent = cyl(1.4, 1.4, 0.4, hole, 10)
          put(dent, index, face, c.clone().add(new Vector3(0, 0.2, 0)))
          dent.visible = false
          return dent
        })
        points.forEach(({ c }, i) => {
          actions.push({
            focus: c.clone().add(new Vector3(0, 90, 0)),
            op: 'dent',
            seconds: 1.3 * slow(i),
            run: (p) => {
              awl.visible = p < 1
              hammer.visible = p < 1
              awl.position.set(c.x, c.y + (1 - span(p, 0, 0.2)) * 50, c.z)
              // Two blows: the head drops on the awl's handle and lifts again.
              const blow = Math.sin(span(p, 0.25, 0.95) * Math.PI * 2) ** 2
              hammer.position.set(c.x, c.y + 150 + 2 + (1 - blow) * 90, c.z)
              if (p >= 0.5) dents[i].visible = true
            },
          })
        })
        const holes = points.map(({ index, c }) => {
          const dot = cyl(2.25, 2.25, 0.5, hole, 14)
          put(dot, index, face, c.clone().add(new Vector3(0, 0.25, 0)))
          dot.visible = false
          return dot
        })
        points.forEach(({ c }, i) => {
          actions.push({
            focus: c.clone().add(new Vector3(0, 90, 0)),
            op: 'drill',
            seconds: 1.3 * slow(i),
            run: (p) => {
              drill.visible = p < 1
              const down = span(p, 0.15, 0.6) - span(p, 0.7, 1)
              drill.position.set(c.x, c.y + 40 - down * 52, c.z)
              drillSpin.rotation.y = p * 60
              if (p >= 0.55) {
                holes[i].visible = true
                dents[i].visible = false
              }
            },
          })
        })
        points.forEach(({ index, c }, i) => {
          const pin = new Group()
          const peg = cyl(2.4, 2.4, 10, steel, 10)
          peg.position.y = -5
          const plate = box(12, 2, 9, steel)
          plate.position.set(0, 1, 2)
          pin.add(peg, plate)
          pin.visible = false
          put(pin, index, face, c)
          const rest = pin.position.clone()
          const up = face % 2 === 1 ? -1 : 1
          actions.push({
            focus: c,
            op: 'pin',
            seconds: 1.1 * slow(i),
            run: (p) => {
              pin.visible = true
              hammer.visible = p < 1
              const sink = span(p, 0.3, 0.9)
              pin.position.copy(rest)
              pin.position.y += up * (10 - sink * 10 + (1 - span(p, 0, 0.25)) * 40)
              const blow = Math.sin(span(p, 0.3, 0.95) * Math.PI * 2) ** 2
              hammer.position.set(c.x, c.y + 3 + (1 - blow) * 70, c.z)
            },
          })
        })
      }

      if (job.phase === 'slides') {
        // Each slide laid on its line, then three screws: the first hole, the last, the middle.
        let screwCount = 0
        for (const { index, marks } of onFace) {
          for (const slide of marks.slides) {
            const holder = new Group()
            const web = soft ? 38 : 28
            const plate = box(web, soft ? 14 : 1.4, slide.length, slideMat)
            plate.position.set(-web / 2, (soft ? 14 : 1.4) / 2, slide.length / 2)
            holder.add(plate)
            if (soft) {
              const clip = box(22, 10, 34, red)
              clip.position.set(-web / 2, 19, 20)
              holder.add(clip)
            } else {
              const flange = box(1.4, 12, slide.length, slideMat)
              flange.position.set(-0.7, 6, slide.length / 2)
              const wheel = cyl(11, 11, 8, wheelMat, 18)
              wheel.rotation.z = Math.PI / 2
              wheel.position.set(-web / 2, 11, slide.length - 14)
              holder.add(flange, wheel)
            }
            // The slide's bottom edge runs on the pencil line, its front at the board's front edge.
            const front = at(index, face, slide.u, slide.v0)
            const back = at(index, face, slide.u, slide.v0 + slide.length)
            const toBack = Math.sign(back.z - front.z) || 1
            const inner = new Group()
            inner.add(holder)
            // Laid the other way round on the bench: the slide runs toward -z.
            if (toBack < 0) holder.scale.z = -1
            put(inner, index, face, front)
            const rest = inner.position.clone()
            const up = face % 2 === 1 ? -1 : 1
            inner.visible = false
            const top = soft ? 14 : 1.4
            actions.push({
              focus: front.clone().add(new Vector3(0, 0, (toBack * slide.length) / 2)),
              op: 'slide',
              seconds: 0.9 * slow(screwCount),
              run: (p) => {
                inner.visible = true
                inner.position.copy(rest)
                inner.position.y += up * (1 - ease(p)) * 120
              },
            })
            const spots = [10, slide.length - 10, slide.length / 2].slice(0, SCREW_HOLES)
            for (const v of spots) {
              const screw = new Group()
              const head = cyl(4, 3.2, 2.6, steel, 14)
              const slotA = box(6.5, 0.6, 1, hole)
              slotA.position.y = 1.4
              const slotB = box(1, 0.6, 6.5, hole)
              slotB.position.y = 1.4
              screw.add(head, slotA, slotB)
              screw.visible = false
              const spot = front.clone().add(new Vector3(-web / 2, top + 1.3, toBack * v))
              put(screw, index, face, spot)
              const seat = screw.position.clone()
              actions.push({
                focus: spot.clone().add(new Vector3(0, 90, 0)),
                op: 'screw',
                seconds: 1.2 * slow(screwCount++),
                run: (p) => {
                  screw.visible = true
                  driver.visible = p < 1
                  const sink = ease(span(p, 0.25, 0.85))
                  screw.position.copy(seat)
                  screw.position.y += up * (1 - sink) * 16
                  screw.rotation.y = sink * 30
                  driver.position.set(spot.x, spot.y + (1 - sink) * 16 + 2.6 + (1 - span(p, 0, 0.25)) * 60, spot.z)
                  driverSpin.rotation.y = sink * 30
                },
              })
            }
          }
        }
      }
      }
    })
    return film
  }

  let film = script()
  let queue: Action[] = []
  let current = 0
  let elapsed = 0
  let speed = 1
  let done: (() => void) | null = null
  let disposed = false
  let frameId = 0
  let last = performance.now()
  // The camera follows the tool at work, close in, until the viewer turns it by hand.
  let follow = true
  let backOut = -1
  const FOLLOW_MM = 700
  controls.addEventListener('start', () => {
    follow = false
  })
  const offset = new Vector3()

  const resize = () => {
    const width = host.clientWidth || 640
    const height = host.clientHeight || 440
    renderer.setSize(width, height, false)
    camera.aspect = width / Math.max(1, height)
    camera.updateProjectionMatrix()
    const wasHome = camera.position.distanceTo(home.camera) < 1
    placeHome()
    if (wasHome) camera.position.copy(home.camera)
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  const tick = (now: number) => {
    if (disposed) return
    frameId = requestAnimationFrame(tick)
    const delta = Math.min(0.05, (now - last) / 1000) * speed
    last = now
    if (current < queue.length) {
      elapsed += delta
      while (current < queue.length && elapsed >= queue[current].seconds) {
        queue[current].run(1)
        elapsed -= queue[current].seconds
        current += 1
      }
      if (current < queue.length) {
        const action = queue[current]
        action.run(elapsed / action.seconds)
        if (follow && action.focus) {
          const k = 1 - Math.exp((-delta / Math.max(0.2, speed)) * 7)
          offset.copy(camera.position).sub(controls.target)
          controls.target.lerp(typeof action.focus === 'function' ? action.focus() : action.focus, k)
          const length = offset.length()
          offset.setLength(length + ((action.distance ?? FOLLOW_MM) - length) * k)
          camera.position.copy(controls.target).add(offset)
        }
      }
      else {
        for (const tool of tools) tool.visible = false
        // The job is done: back out to see all the boards.
        if (follow) backOut = 0
        const finish = done
        done = null
        finish?.()
      }
    }
    if (backOut >= 0 && current >= queue.length) {
      backOut = Math.min(1, backOut + delta / 1.4)
      const k = 1 - Math.exp(-delta * 4)
      controls.target.lerp(home.target, k)
      camera.position.lerp(home.camera, k)
      if (backOut >= 1) backOut = -1
    }
    placePerson(delta)
    controls.update()
    const working = current < queue.length ? queue[current] : null
    const anchor = working?.focus ? (typeof working.focus === 'function' ? working.focus() : working.focus) : null
    tag.place(
      working?.op && describe ? describe(working.op) : null,
      anchor ? tagAt.copy(anchor).add(new Vector3(0, 40, 0)) : null,
      camera,
    )
    renderer.render(scene, camera)
  }
  frameId = requestAnimationFrame(tick)

  let lastJob = -1
  let lastDone: (() => void) | null = null
  const start = (index: number, onDone: () => void) => {
    lastJob = index
    lastDone = onDone
    film = script()
    carrying = null
    for (const tool of tools) tool.visible = false
    // Earlier jobs are already done when this one starts.
    for (const earlier of film.slice(0, index)) {
      for (const action of earlier) action.run(1)
    }
    for (const tool of tools) tool.visible = false
    queue = film[index] ?? []
    follow = true
    backOut = -1
    current = 0
    elapsed = 0
    done = onDone
    if (queue.length === 0) {
      done = null
      onDone()
    }
  }

  return {
    play: start,
    seek(fraction) {
      if (lastJob < 0 || !lastDone) return
      // Laid out again from the start of the job, then run on to that point.
      start(lastJob, lastDone)
      const total = queue.reduce((sum, action) => sum + action.seconds, 0)
      elapsed = Math.max(0, Math.min(1, fraction)) * total
    },
    progress() {
      const total = queue.reduce((sum, action) => sum + action.seconds, 0)
      if (total <= 0) return 1
      let doneSeconds = 0
      for (let i = 0; i < current && i < queue.length; i++) doneSeconds += queue[i].seconds
      if (current < queue.length) doneSeconds += elapsed
      return Math.min(1, doneSeconds / total)
    },
    setDescribe(next) {
      describe = next
    },
    setSpeed(next) {
      speed = next
    },
    dispose() {
      disposed = true
      stopSticks()
      tag.dispose()
      cancelAnimationFrame(frameId)
      observer.disconnect()
      controls.dispose()
      for (const item of bin) item.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
    },
  }
}
