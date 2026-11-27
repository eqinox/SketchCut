import { Spherical, Vector3, type PerspectiveCamera } from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/** Size of a stick's pad and how far its knob can go from the middle, in CSS px. */
const PAD_PX = 104
const REACH_PX = 36
/** Full stick: turns this many radians a second, gets this much closer (×) a second. */
const TURN_PER_S = 1.2
const TILT_PER_S = 1.1
const ZOOM_PER_S = 1
/** Full stick sideways: moves this share of the distance to the target a second. */
const PAN_PER_S = 0.6

type Stick = { x: number; y: number; pointer: number | null; knob: HTMLDivElement }

/**
 * Two thumb sticks over a 3D picture, for phones and tablets, where one finger turns the view
 * and pinching is fiddly. Left stick: up and down go closer and further, sideways moves the view
 * left and right. Right stick: turns round the cabinet and tilts up and down. Nothing is added on
 * a computer with a mouse. Returns a function that takes them away again.
 */
export function attachJoysticks(
  host: HTMLElement,
  camera: PerspectiveCamera,
  controls: OrbitControls,
  onMove?: () => void,
): () => void {
  if (typeof window === 'undefined' || !window.matchMedia?.('(pointer: coarse)').matches) return () => {}
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative'

  const layer = document.createElement('div')
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5'
  host.appendChild(layer)

  const makeStick = (side: 'left' | 'right', label: string): Stick => {
    const pad = document.createElement('div')
    pad.setAttribute('role', 'group')
    pad.setAttribute('aria-label', label)
    pad.style.cssText = [
      'position:absolute',
      'bottom:12px',
      `${side}:12px`,
      `width:${PAD_PX}px`,
      `height:${PAD_PX}px`,
      'border-radius:50%',
      'background:rgba(20,20,20,0.18)',
      'border:2px solid rgba(255,255,255,0.55)',
      'box-shadow:0 1px 4px rgba(0,0,0,0.25)',
      'pointer-events:auto',
      'touch-action:none',
      'user-select:none',
      '-webkit-user-select:none',
    ].join(';')
    const knob = document.createElement('div')
    knob.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:50%',
      'width:44px',
      'height:44px',
      'margin:-22px 0 0 -22px',
      'border-radius:50%',
      'background:rgba(255,255,255,0.85)',
      'box-shadow:0 1px 3px rgba(0,0,0,0.35)',
    ].join(';')
    pad.appendChild(knob)
    layer.appendChild(pad)
    const stick: Stick = { x: 0, y: 0, pointer: null, knob }
    const follow = (event: PointerEvent) => {
      const box = pad.getBoundingClientRect()
      let dx = event.clientX - (box.left + box.width / 2)
      let dy = event.clientY - (box.top + box.height / 2)
      const length = Math.hypot(dx, dy)
      if (length > REACH_PX) {
        dx = (dx / length) * REACH_PX
        dy = (dy / length) * REACH_PX
      }
      stick.x = dx / REACH_PX
      stick.y = dy / REACH_PX
      knob.style.transform = `translate(${dx}px, ${dy}px)`
    }
    const release = (event: PointerEvent) => {
      if (event.pointerId !== stick.pointer) return
      stick.pointer = null
      stick.x = 0
      stick.y = 0
      knob.style.transform = ''
    }
    pad.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      stick.pointer = event.pointerId
      try {
        pad.setPointerCapture(event.pointerId)
      } catch {
        // Without capture the stick still works while the finger stays on the pad.
      }
      // The view is now the viewer's: a camera that follows the work stops following.
      controls.dispatchEvent({ type: 'start' } as never)
      follow(event)
      start()
    })
    pad.addEventListener('pointermove', (event) => {
      if (event.pointerId === stick.pointer) follow(event)
    })
    pad.addEventListener('pointerup', release)
    pad.addEventListener('pointercancel', release)
    return stick
  }
  const move = makeStick('left', 'Приближи, отдалечи и мести')
  const look = makeStick('right', 'Върти изгледа')

  const offset = new Vector3()
  const spherical = new Spherical()
  const right = new Vector3()
  let frame = 0
  let last = 0
  const step = (now: number) => {
    const active = move.pointer !== null || look.pointer !== null
    if (!active) {
      frame = 0
      return
    }
    frame = requestAnimationFrame(step)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    // A little dead zone in the middle, then a soft start.
    const shape = (value: number) => (Math.abs(value) < 0.12 ? 0 : Math.sign(value) * ((Math.abs(value) - 0.12) / 0.88) ** 1.5)
    const mx = shape(move.x)
    const my = shape(move.y)
    const lx = shape(look.x)
    const ly = shape(look.y)
    if (mx === 0 && my === 0 && lx === 0 && ly === 0) return

    offset.copy(camera.position).sub(controls.target)
    spherical.setFromVector3(offset)
    spherical.theta -= lx * TURN_PER_S * dt
    // Stick up: look up at the cabinet from lower down.
    spherical.phi += -ly * TILT_PER_S * dt
    spherical.phi = Math.max(Math.max(0.05, controls.minPolarAngle), Math.min(controls.maxPolarAngle, spherical.phi))
    // Stick up: closer.
    spherical.radius *= Math.exp(my * ZOOM_PER_S * dt)
    spherical.radius = Math.min(controls.maxDistance, Math.max(Math.max(controls.minDistance, 20), spherical.radius))
    if (mx !== 0) {
      right.setFromMatrixColumn(camera.matrixWorld, 0)
      right.y = 0
      if (right.lengthSq() > 0) {
        right.normalize().multiplyScalar(mx * spherical.radius * PAN_PER_S * dt)
        controls.target.add(right)
      }
    }
    offset.setFromSpherical(spherical)
    camera.position.copy(controls.target).add(offset)
    camera.lookAt(controls.target)
    controls.update()
    onMove?.()
  }
  const start = () => {
    if (frame) return
    last = performance.now()
    frame = requestAnimationFrame(step)
  }

  return () => {
    cancelAnimationFrame(frame)
    layer.remove()
  }
}
