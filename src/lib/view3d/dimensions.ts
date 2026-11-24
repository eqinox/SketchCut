import { BufferGeometry, Group, Line, LineBasicMaterial, Vector3 } from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { SceneSolid } from '@/lib/cabinets/scene-solids'
import type { Disposable } from '@/lib/view3d/materials'

function drawPoint(x: number, y: number, z: number) {
  return new Vector3(x, -y, -z)
}

/** Sizes from the drawing. The number stays readable while the cabinet turns. */
export function addDimensions(parent: Group, solids: SceneSolid[], bin: Disposable[]) {
  const dims = solids.filter((solid): solid is Extract<SceneSolid, { kind: 'dim' }> => solid.kind === 'dim')
  if (dims.length === 0) return
  const mat = new LineBasicMaterial({ color: 0x1c1917 })
  bin.push({ dispose: () => mat.dispose() })
  for (const dim of dims) {
    const a = drawPoint(dim.x0, dim.y0, dim.z0)
    const b = drawPoint(dim.x1, dim.y1, dim.z1)
    if (a.distanceTo(b) > 1) {
      const geo = new BufferGeometry().setFromPoints([a, b])
      const line = new Line(geo, mat)
      line.raycast = () => {}
      parent.add(line)
      bin.push({ dispose: () => geo.dispose() })
    }
    const el = document.createElement('div')
    el.textContent = dim.label
    el.style.color = '#1c1917'
    el.style.fontWeight = '700'
    el.style.fontSize = '13px'
    el.style.lineHeight = '1.1'
    el.style.background = 'rgba(255,252,245,0.92)'
    el.style.padding = '1px 5px'
    el.style.borderRadius = '3px'
    el.style.whiteSpace = 'nowrap'
    el.style.pointerEvents = 'none'
    const tag = new CSS2DObject(el)
    tag.position.copy(a).add(b).multiplyScalar(0.5)
    parent.add(tag)
  }
}
