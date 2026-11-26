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
import type { BenchBoard } from '@/lib/bench-plan'

/** The three jobs done on the bench, in order. */
export type BenchPhase = 'mark' | 'pins' | 'slides'
export const BENCH_PHASES: BenchPhase[] = ['mark', 'pins', 'slides']

export type Workbench = {
  /** Lays the boards out again with earlier phases done, and plays this one. */
  play(phase: BenchPhase, onDone: () => void): void
  /** 1 is the normal pace; higher is faster. */
  setSpeed(speed: number): void
  dispose(): void
}

/** One timed piece of a film: `run` is called with 0 → 1 as it goes, and with 1 at the end. */
type Action = { seconds: number; run: (p: number) => void; focus?: Vector3 | (() => Vector3) }

const GAP_MM = 160
const SCREW_HOLES = 3
/** The first few repeats of a job are shown slowly; the rest go quickly. */
const SLOW_REPEATS = 2
const FAST = 0.28

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)
const clamp01 = (p: number) => Math.min(1, Math.max(0, p))
/** Part of `p` between `a` and `b`, as 0 → 1. */
const span = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))

export function mountWorkbench(host: HTMLElement, boards: BenchBoard[], soft: boolean): Workbench {
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
  let built = new Group()
  table.add(built)

  // The boards side by side on the bench, marked face up.
  const placed = boards.map((board, index) => {
    const x = boards.slice(0, index).reduce((sum, item) => sum + item.u + GAP_MM, 0)
    return { board, x }
  })
  const totalU = placed.reduce((sum, item) => Math.max(sum, item.x + item.board.u), 0)
  const maxV = boards.reduce((sum, board) => Math.max(sum, board.v), 0)
  const at = (index: number, u: number, v: number, y = 0) => {
    const { board, x } = placed[index]
    return new Vector3(x + u, board.thickness + y, v)
  }

  const floor = new Mesh(new PlaneGeometry(1, 1), mat('#cbb48f', 0.85))
  bin.push(floor.geometry)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  floor.scale.set(totalU + 1200, maxV + 1200, 1)
  floor.position.set(totalU / 2, -0.5, maxV / 2)
  table.add(floor)

  const frame = () => {
    const radius = Math.max(totalU, maxV, 600)
    controls.target.set(totalU / 2, 0, maxV / 2)
    camera.position.set(totalU / 2, radius * 0.75, maxV / 2 + radius * 0.72)
    camera.updateProjectionMatrix()
    controls.update()
    sun.position.set(totalU * 0.3, radius * 1.4, maxV + radius * 0.6)
    sun.target.position.set(totalU / 2, 0, maxV / 2)
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

  /** A thin pencil line from a to b on the board face, drawn up to `p`. */
  const pencilLine = (a: Vector3, b: Vector3) => {
    const length = a.distanceTo(b)
    const direction = b.clone().sub(a).normalize()
    const alongV = Math.abs(direction.z) >= Math.abs(direction.x)
    const line = box(1, 0.3, 1, graphite)
    line.castShadow = false
    built.add(line)
    return (p: number) => {
      const drawn = Math.max(0.01, length * p)
      line.scale.set(alongV ? 1.8 : drawn, 1, alongV ? drawn : 1.8)
      const mid = a.clone().addScaledVector(direction, drawn / 2)
      line.position.set(mid.x, a.y + 0.15, mid.z)
    }
  }

  /** Builds the scene and the whole film; nothing is shown until the actions run. */
  const script = () => {
    built.removeFromParent()
    built = new Group()
    table.add(built)
    placed.forEach(({ board, x }) => {
      const slab = box(board.u, board.thickness, board.v, mat(board.color, 0.7))
      slab.position.set(x + board.u / 2, board.thickness / 2, board.v / 2)
      built.add(slab)
    })

    const phases: Record<BenchPhase, Action[]> = { mark: [], pins: [], slides: [] }
    const slow = (count: number) => (count < SLOW_REPEATS ? 1 : FAST)

    // Pencil: every line, then a small cross at every pin point.
    let count = 0
    placed.forEach(({ board }, index) => {
      for (const line of board.lines) {
        const a = at(index, line.u0, line.v0)
        const b = at(index, line.u1, line.v1)
        const draw = pencilLine(a, b)
        draw(0)
        phases.mark.push({
          // Follow the pencil along the line, at the board's face.
          focus: () => new Vector3(pencil.position.x, a.y, pencil.position.z),
          seconds: 1.4 * slow(count++),
          run: (p) => {
            const q = ease(span(p, 0.15, 0.9))
            draw(q)
            pencil.visible = p < 1
            pencil.position.copy(a.clone().lerp(b, q))
            pencil.position.y = a.y + (1 - span(p, 0, 0.15)) * 40
          },
        })
      }
      for (const point of board.points) {
        const c = at(index, point.u, point.v)
        const one = pencilLine(c.clone().add(new Vector3(-7, 0, 0)), c.clone().add(new Vector3(7, 0, 0)))
        const two = pencilLine(c.clone().add(new Vector3(0, 0, -7)), c.clone().add(new Vector3(0, 0, 7)))
        one(0)
        two(0)
        phases.mark.push({
          focus: c,
          seconds: 0.9 * slow(count++),
          run: (p) => {
            one(span(p, 0.1, 0.5))
            two(span(p, 0.55, 0.95))
            pencil.visible = p < 1
            pencil.position.copy(c)
            pencil.position.y = c.y + (1 - span(p, 0, 0.1)) * 30
          },
        })
      }
    })

    // Shelf pins: a dent with the awl and hammer at every point, then every hole drilled,
    // then every pin knocked in.
    const points = placed.flatMap(({ board }, index) => board.points.map((point) => at(index, point.u, point.v)))
    const dents = points.map((c) => {
      const dent = cyl(1.4, 1.4, 0.4, hole, 10)
      dent.position.set(c.x, c.y + 0.2, c.z)
      dent.visible = false
      built.add(dent)
      return dent
    })
    points.forEach((c, i) => {
      phases.pins.push({
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
    const holes = points.map((c) => {
      const dot = cyl(2.25, 2.25, 0.5, hole, 14)
      dot.position.set(c.x, c.y + 0.25, c.z)
      dot.visible = false
      built.add(dot)
      return dot
    })
    points.forEach((c, i) => {
      phases.pins.push({
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
    points.forEach((c, i) => {
      const pin = new Group()
      const peg = cyl(2.4, 2.4, 10, steel, 10)
      peg.position.y = -5
      const plate = box(12, 2, 9, steel)
      plate.position.set(0, 1, 2)
      pin.add(peg, plate)
      pin.visible = false
      built.add(pin)
      phases.pins.push({
        focus: c,
        seconds: 1.1 * slow(i),
        run: (p) => {
          pin.visible = true
          hammer.visible = p < 1
          const sink = span(p, 0.3, 0.9)
          pin.position.set(c.x, c.y + 10 - sink * 10 + (1 - span(p, 0, 0.25)) * 40, c.z)
          const blow = Math.sin(span(p, 0.3, 0.95) * Math.PI * 2) ** 2
          hammer.position.set(c.x, c.y + 3 + (1 - blow) * 70, c.z)
        },
      })
    })

    // Slides: each one laid on its line, then three screws — the first hole, the last, the middle.
    let screwCount = 0
    placed.forEach(({ board }, index) => {
      for (const slide of board.slides) {
        const group = new Group()
        const web = soft ? 38 : 28
        const plate = box(web, soft ? 14 : 1.4, slide.length, slideMat)
        plate.position.set(-web / 2, (soft ? 14 : 1.4) / 2, slide.length / 2)
        group.add(plate)
        if (soft) {
          const clip = box(22, 10, 34, red)
          clip.position.set(-web / 2, 19, 20)
          group.add(clip)
        } else {
          const flange = box(1.4, 12, slide.length, slideMat)
          flange.position.set(-0.7, 6, slide.length / 2)
          const wheel = cyl(11, 11, 8, wheelMat, 18)
          wheel.rotation.z = Math.PI / 2
          wheel.position.set(-web / 2, 11, slide.length - 14)
          group.add(flange, wheel)
        }
        // The slide's bottom edge runs on the pencil line (larger u is lower on the side).
        const base = at(index, slide.u, slide.v0)
        group.position.copy(base)
        group.visible = false
        built.add(group)
        const top = soft ? 14 : 1.4
        phases.slides.push({
          focus: base.clone().add(new Vector3(0, 0, slide.length / 2)),
          seconds: 0.9 * slow(screwCount),
          run: (p) => {
            group.visible = true
            group.position.y = base.y + (1 - ease(p)) * 120
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
          built.add(screw)
          const spot = base.clone().add(new Vector3(-web / 2, top + 1.3, v))
          phases.slides.push({
            focus: spot,
            seconds: 1.2 * slow(screwCount++),
            run: (p) => {
              screw.visible = true
              driver.visible = p < 1
              const sink = ease(span(p, 0.25, 0.85))
              screw.position.set(spot.x, spot.y + (1 - sink) * 16, spot.z)
              screw.rotation.y = sink * 30
              driver.position.set(spot.x, screw.position.y + 2.6 + (1 - span(p, 0, 0.25)) * 60, spot.z)
              driver.rotation.y = sink * 30
            },
          })
        }
      }
    })
    return phases
  }

  let phases = script()
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
        const finish = done
        done = null
        finish?.()
      }
    }
    controls.update()
    renderer.render(scene, camera)
  }
  frameId = requestAnimationFrame(tick)

  return {
    play(phase, onDone) {
      phases = script()
      for (const tool of tools) tool.visible = false
      // Earlier jobs are already done when this one starts.
      for (const earlier of BENCH_PHASES.slice(0, BENCH_PHASES.indexOf(phase))) {
        for (const action of phases[earlier]) action.run(1)
      }
      for (const tool of tools) tool.visible = false
      queue = phases[phase]
      follow = true
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
      cancelAnimationFrame(frameId)
      observer.disconnect()
      controls.dispose()
      for (const item of bin) item.dispose()
      renderer.dispose()
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement)
    },
  }
}

/** For the film's caption: how many of each thing the bench jobs make. */
export function benchCounts(boards: BenchBoard[]) {
  return {
    lines: boards.reduce((sum, board) => sum + board.lines.length, 0),
    points: boards.reduce((sum, board) => sum + board.points.length, 0),
    slides: boards.reduce((sum, board) => sum + board.slides.length, 0),
  }
}
