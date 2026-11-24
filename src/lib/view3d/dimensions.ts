import { BufferGeometry, Group, Line, LineBasicMaterial, Vector3 } from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { SceneSolid } from '@/lib/cabinets/scene-solids'
import type { Disposable } from '@/lib/view3d/materials'

function drawPoint(x: number, y: number, z: number) {
  return new Vector3(x, -y, -z)
}

function sizeTag(label: string, bin: Disposable[]) {
  const el = document.createElement('div')
  el.textContent = label
  el.style.color = '#1c1917'
  el.style.fontWeight = '700'
  el.style.fontSize = '13px'
  el.style.lineHeight = '1.1'
  el.style.background = 'rgba(255,252,245,0.92)'
  el.style.padding = '1px 5px'
  el.style.borderRadius = '3px'
  el.style.whiteSpace = 'nowrap'
  el.style.pointerEvents = 'none'
  bin.push({ dispose: () => el.remove() })
  return new CSS2DObject(el)
}

/**
 * Only the three outer sizes: width along the top front edge, depth along the top left edge,
 * height up the front left edge. `box` is the cabinet in the parent's space, front at max z.
 */
export function addOverallDimensions(
  parent: Group,
  box: { min: Vector3; max: Vector3 },
  size: { w: number; h: number; d: number },
  bin: Disposable[],
) {
  const mat = new LineBasicMaterial({ color: 0x1c1917 })
  bin.push({ dispose: () => mat.dispose() })
  const lift = 60
  const { min, max } = box
  const runs: [Vector3, Vector3, number][] = [
    [new Vector3(min.x, max.y + lift, max.z), new Vector3(max.x, max.y + lift, max.z), size.w],
    [new Vector3(min.x, max.y + lift, min.z), new Vector3(min.x, max.y + lift, max.z), size.d],
    [new Vector3(min.x - lift, min.y, max.z), new Vector3(min.x - lift, max.y, max.z), size.h],
  ]
  for (const [a, b, mm] of runs) {
    const geo = new BufferGeometry().setFromPoints([a, b])
    const line = new Line(geo, mat)
    line.raycast = () => {}
    parent.add(line)
    bin.push({ dispose: () => geo.dispose() })
    const tag = sizeTag(String(Math.round(mm)), bin)
    tag.position.copy(a).add(b).multiplyScalar(0.5)
    parent.add(tag)
  }
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
    // The label is a page element on top of the picture. Clearing the scene does not take it off
    // the page, so a removed cabinet would leave its sizes floating. Take it off with the rest.
    bin.push({ dispose: () => el.remove() })
  }
}
