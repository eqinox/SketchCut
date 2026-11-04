import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  QuadraticBezierCurve3,
  TubeGeometry,
  Vector3,
} from 'three'
import { taraPull, type PullSku } from '@/lib/cabinets/pulls'
import { metalMaterial, type Disposable } from '@/lib/view3d/materials'

/**
 * Bow pull in its own frame: length along +X, grip width along Y, the bow
 * rising toward +Z. The feet sit on z = 0, which the caller puts on the front.
 */
export function addPull(parent: Group, sku: PullSku, bin: Disposable[]): Group | null {
  if (sku === 'none') return null
  const root = new Group()
  parent.add(root)
  if (sku === 'normal') addPlainBar(root, bin)
  else addTara(root, sku, bin)
  return root
}

function addPlainBar(parent: Group, bin: Disposable[]) {
  const mat = metalMaterial('#c5c8ce', bin, 0.4)
  const length = 120
  const rise = 20
  const radius = 4.5
  const span = 96
  const postGeo = new CylinderGeometry(radius * 0.7, radius * 0.7, rise, 12)
  const barGeo = new CylinderGeometry(radius, radius, length, 16)
  bin.push({ dispose: () => postGeo.dispose() }, { dispose: () => barGeo.dispose() })
  for (const sign of [-1, 1]) {
    const post = new Mesh(postGeo, mat)
    post.rotation.x = Math.PI / 2
    post.position.set((sign * span) / 2, 0, rise / 2)
    post.castShadow = true
    parent.add(post)
  }
  const bar = new Mesh(barGeo, mat)
  bar.rotation.z = Math.PI / 2
  bar.position.set(0, 0, rise)
  bar.castShadow = true
  parent.add(bar)
}

function addTara(parent: Group, sku: 'tara-96' | 'tara-160', bin: Disposable[]) {
  const spec = taraPull(sku)
  if (!spec) return
  const mat = metalMaterial('#e6e9ee', bin, 0.32)
  const footLen = Math.min(38, Math.max(24, (spec.l - spec.c) * 0.72))
  const footH = 5
  const footW = spec.w + 2
  const barR = Math.max(3.1, spec.w * 0.22)
  const peak = Math.max(footH + 4, spec.h - barR)
  const footGeo = new BoxGeometry(footLen, footW, footH)
  bin.push({ dispose: () => footGeo.dispose() })
  for (const sign of [-1, 1]) {
    const foot = new Mesh(footGeo, mat)
    foot.position.set(sign * (spec.l / 2 - footLen / 2), 0, footH / 2)
    foot.castShadow = true
    foot.receiveShadow = true
    parent.add(foot)
  }
  const x0 = -spec.l / 2 + footLen * 0.55
  const x1 = -x0
  const curve = new QuadraticBezierCurve3(
    new Vector3(x0, 0, footH * 0.65),
    new Vector3(0, 0, peak),
    new Vector3(x1, 0, footH * 0.65),
  )
  const tube = new TubeGeometry(curve, 48, barR, 12, false)
  bin.push({ dispose: () => tube.dispose() })
  const bar = new Mesh(tube, mat)
  bar.scale.set(1, spec.w / (barR * 2), 1)
  bar.castShadow = true
  bar.receiveShadow = true
  parent.add(bar)
}

/** Shrink a pull along its length so it stays on the front. */
export function fitPullLength(pull: Group, length: number, span: number) {
  const room = span - 16
  if (length > 8 && room > 8 && length > room) pull.scale.x = room / length
}
