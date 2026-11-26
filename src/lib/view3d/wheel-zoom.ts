import { Raycaster, Vector2, Vector3, type Material, type Mesh, type Object3D, type PerspectiveCamera } from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/**
 * The mouse wheel moves the camera the same distance for every notch, close in as far out.
 * (OrbitControls shrinks the distance by a share, so near a detail each notch moved a hair.)
 * In: toward the spot under the pointer, stopping 2 mm short of the first thing there, which then
 * becomes the point the view turns round. Out: straight back from that point.
 * Pinch on a phone is left to OrbitControls.
 */
export function constantWheelZoom(options: {
  host: HTMLElement
  canvas: HTMLCanvasElement
  camera: PerspectiveCamera
  controls: OrbitControls
  scene: Object3D
  /** Millimetres per wheel notch. */
  step: () => number
  maxDistance: () => number
  onChange: () => void
}): () => void {
  const { host, canvas, camera, controls, scene } = options
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const forward = new Vector3()
  const back = new Vector3()

  const solidHit = (event: WheelEvent) => {
    const rect = canvas.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    for (const hit of raycaster.intersectObject(scene, true)) {
      // Skip hidden helpers, glows and see-through glass: they are not a surface to stop at.
      let shown = true
      for (let item: Object3D | null = hit.object; item; item = item.parent) {
        if (!item.visible) shown = false
      }
      if (!shown) continue
      const material = (hit.object as Mesh).material as Material | Material[] | undefined
      const list = Array.isArray(material) ? material : material ? [material] : []
      if (list.length > 0 && list.every((item) => item.transparent && item.opacity < 0.6)) continue
      return hit
    }
    return null
  }

  const onWheel = (event: WheelEvent) => {
    if (!controls.enabled || !controls.enableZoom) return
    // Before OrbitControls on the canvas sees it.
    event.preventDefault()
    event.stopPropagation()
    const notches = Math.max(-3, Math.min(3, event.deltaY / (event.deltaMode === 1 ? 3 : 100)))
    if (notches === 0) return
    const amount = Math.abs(notches) * options.step()
    camera.getWorldDirection(forward)
    if (notches < 0) {
      const hit = solidHit(event)
      const direction = raycaster.ray.direction
      if (hit) {
        const move = Math.min(amount, hit.distance - 2)
        if (move <= 0) return
        camera.position.addScaledVector(direction, move)
        // Turn round the pointed detail, kept on the line of sight so the view does not jump.
        const depth = Math.max(2, hit.point.clone().sub(camera.position).dot(forward))
        controls.target.copy(camera.position).addScaledVector(forward, depth)
      } else {
        camera.position.addScaledVector(direction, amount)
        controls.target.addScaledVector(direction, amount)
      }
    } else {
      back.copy(camera.position).sub(controls.target)
      const distance = back.length()
      const next = Math.min(options.maxDistance(), distance + amount)
      if (distance > 0) camera.position.copy(controls.target).addScaledVector(back.normalize(), next)
    }
    controls.update()
    options.onChange()
  }
  host.addEventListener('wheel', onWheel, { capture: true, passive: false })
  return () => host.removeEventListener('wheel', onWheel, { capture: true })
}
