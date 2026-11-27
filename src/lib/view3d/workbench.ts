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
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { attachJoysticks } from '@/lib/view3d/joysticks'
import { benchJobs, type BenchGroup, type BenchJob } from '@/lib/bench-plan'

export type Workbench = {
  /** Lays the boards out again with the earlier jobs done, and plays job `index` of `benchJobs(group)`. */
  play(index: number, onDone: () => void): void
  /** 1 is the normal pace; higher is faster. */
  setSpeed(speed: number): void
  dispose(): void
}

/** One timed piece of a film: `run` is called with 0 → 1 as it goes, and with 1 at the end. */
type Action = { seconds: number; run: (p: number) => void; focus?: Vector3 | (() => Vector3) }

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
  const toolBody = mat('#2f6e4a', 0.5)
  const toolGrip = mat('#25272a', 0.8)

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
    // Origin at the face of the head; the handle runs off to the right, away from the view.
    const head = box(28, 28, 110, darkSteel)
    head.position.y = 14
    const handle = box(300, 20, 26, wood)
    handle.position.set(165, 20, 0)
    hammer.add(head, handle)
  }
  const drill = new Group()
  {
    const bit = cyl(2.25, 2.25, 60, steel, 10)
    bit.position.y = 30
    const chuck = cyl(13, 13, 40, darkSteel)
    chuck.position.y = 60 + 20
    const body = box(64, 64, 170, toolBody)
    body.position.set(0, 60 + 40 + 32, -40)
    const grip = box(44, 130, 50, toolGrip)
    grip.position.set(0, 60 + 40 - 10, -110)
    drill.add(bit, chuck, body, grip)
  }
  const driver = new Group()
  {
    const bit = cyl(3, 3, 40, steel, 8)
    bit.position.y = 20
    const chuck = cyl(11, 11, 30, toolGrip)
    chuck.position.y = 40 + 15
    const body = box(56, 56, 150, toolBody)
    body.position.set(0, 40 + 30 + 28, -30)
    const grip = box(40, 120, 46, toolGrip)
    grip.position.set(0, 40 + 30 - 20, -90)
    const battery = box(70, 30, 90, toolGrip)
    battery.position.set(0, 40 + 30 - 85, -95)
    driver.add(bit, chuck, body, grip, battery)
  }
  const tools = [pencil, awl, hammer, drill, driver]
  for (const tool of tools) {
    tool.visible = false
    scene.add(tool)
  }

  const table = new Group()
  scene.add(table)

  // The boards side by side across the bench, their top edges (u = 0) in a row.
  const placed = boards.map((board, index) => {
    const z = boards.slice(0, index).reduce((sum, item) => sum + item.v + GAP_MM, 0)
    // The two sides: the first one turned round, so the front edges meet in the middle.
    const mirror = group.mirrorSecond && index === 0 && boards.length > 1
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

  const floor = new Mesh(new PlaneGeometry(1, 1), mat('#cbb48f', 0.85))
  bin.push(floor.geometry)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  floor.scale.set(totalU + 1600, totalV + 1600, 1)
  floor.position.set(totalU / 2, -0.5, totalV / 2)
  table.add(floor)

  const radius = Math.max(totalU, totalV, 600)
  /** Where the camera looks from when it shows all the boards. */
  const home = { target: new Vector3(totalU / 2, 0, totalV / 2), camera: new Vector3() }
  /** Far enough back that the whole length fits, on a narrow phone screen too. */
  const placeHome = () => {
    const look = new Vector3(0, 0.75, 0.72).normalize()
    const half = Math.tan(((camera.fov / 2) * Math.PI) / 180)
    const across = half * Math.max(0.3, camera.aspect)
    const distance = Math.max(radius * 1.04, (totalU / 2) * 1.12 / across + totalV / 2)
    home.camera.copy(home.target).addScaledVector(look, distance)
  }
  placeHome()
  const frame = () => {
    controls.target.copy(home.target)
    camera.position.copy(home.camera)
    camera.updateProjectionMatrix()
    controls.update()
    sun.position.set(totalU * 0.3, radius * 1.4, totalV + radius * 0.6)
    sun.target.position.set(totalU / 2, 0, totalV / 2)
    const cam = sun.shadow.camera
    cam.left = -radius
    cam.right = radius
    cam.top = radius
    cam.bottom = -radius
    cam.near = 10
    cam.far = radius * 5
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

    jobs.forEach((job, jobIndex) => {
      const actions = film[jobIndex]
      const face = job.face
      const onFace = placed.flatMap(({ board }, index) => (board.faces[face] ? [{ index, marks: board.faces[face] }] : []))

      if (job.phase === 'mark') {
        // The second face: each board that has work on it is lifted and turned over.
        if (face > 0) {
          const turning = onFace.map((item) => item.index)
          actions.push({
            focus: new Vector3(totalU / 2, 0, totalV / 2),
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
        const strokes: { x: number; z0: number; z1: number; parts: { index: number; a: Vector3; b: Vector3 }[] }[] = []
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
              strokes.push({ x: p0.x, z0: p0.z, z1: p1.z, parts: [{ index, a: p0, b: p1 }] })
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
            ...marks.crosses.map((item) => ({ ...item, half: 14 })),
            ...marks.points.map((item) => ({ ...item, half: 7 })),
          ]
          for (const spot of spots) {
            const c = at(index, face, spot.u, spot.v)
            const one = pencilTick(index, face, c, 'x', spot.half)
            const two = pencilTick(index, face, c, 'z', spot.half)
            actions.push({
              focus: c,
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
            focus: c,
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
            focus: c,
            seconds: 1.3 * slow(i),
            run: (p) => {
              drill.visible = p < 1
              const down = span(p, 0.15, 0.6) - span(p, 0.7, 1)
              drill.position.set(c.x, c.y + 40 - down * 52, c.z)
              drill.rotation.y = p * 40
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
                focus: spot,
                seconds: 1.2 * slow(screwCount++),
                run: (p) => {
                  screw.visible = true
                  driver.visible = p < 1
                  const sink = ease(span(p, 0.25, 0.85))
                  screw.position.copy(seat)
                  screw.position.y += up * (1 - sink) * 16
                  screw.rotation.y = sink * 30
                  driver.position.set(spot.x, spot.y + (1 - sink) * 16 + 2.6 + (1 - span(p, 0, 0.25)) * 60, spot.z)
                  driver.rotation.y = sink * 30
                },
              })
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
          offset.setLength(length + (FOLLOW_MM - length) * k)
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
    controls.update()
    renderer.render(scene, camera)
  }
  frameId = requestAnimationFrame(tick)

  return {
    play(index, onDone) {
      film = script()
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
    },
    setSpeed(next) {
      speed = next
    },
    dispose() {
      disposed = true
      stopSticks()
      cancelAnimationFrame(frameId)
      observer.disconnect()
      controls.dispose()
      for (const item of bin) item.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
    },
  }
}
