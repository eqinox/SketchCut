import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  Vector3,
} from 'three'
import type { Disposable } from '@/lib/view3d/materials'
import { metalMaterial } from '@/lib/view3d/materials'
import type { DoorSolid } from '@/lib/view3d/door-pose'

const NICKEL = '#d5d8de'
const SCREW = '#5c636c'
const DAMPER = '#3a3f46'

const CUP_FROM_EDGE = 22
const CUP_RADIUS = 17.5
const CUP_DEPTH = 11.5
const ARM_A = 36
const ARM_B = 32

const up = new Vector3(0, 1, 0)
const linkFrom = new Vector3()
const linkTo = new Vector3()
const axisX = new Vector3()
const axisY = new Vector3()
const axisZ = new Vector3()
const elbowPoint = new Vector3()
const localKnuckle = new Vector3()

export type HingeRig = {
  /** Knuckle in door-local millimetres. The arm is solved from here to the plate. */
  knuckle: Vector3
  /** Door matrix in the cabinet, the same space as the mounting plate. */
  update(doorLocal: Matrix4): void
}

function placeLink(mesh: Mesh, a: Vector3, b: Vector3) {
  linkFrom.copy(a)
  linkTo.copy(b)
  axisY.copy(linkTo).sub(linkFrom)
  const len = axisY.length()
  if (len < 0.4) {
    mesh.visible = false
    return
  }
  mesh.visible = true
  axisY.multiplyScalar(1 / len)
  const helper = Math.abs(axisY.y) > 0.85 ? axisX.set(1, 0, 0) : up
  axisX.copy(helper).cross(axisY).normalize()
  axisZ.copy(axisY).cross(axisX).normalize()
  const matrix = new Matrix4().makeBasis(axisX, axisY.multiplyScalar(len), axisZ)
  matrix.setPosition(linkFrom.add(linkTo).multiplyScalar(0.5))
  mesh.matrix.copy(matrix)
  mesh.matrixWorldNeedsUpdate = true
}

/** Two-bone arm in the horizontal plane. Lengths stay put; the elbow sits inside the cabinet. */
function elbow(from: Vector3, to: Vector3, l1: number, l2: number, out: Vector3) {
  const dx = to.x - from.x
  const dz = to.z - from.z
  let dist = Math.hypot(dx, dz) || 0.001
  const reach = l1 + l2 - 0.2
  const fold = Math.abs(l1 - l2) + 0.2
  let ux = dx / dist
  let uz = dz / dist
  if (dist > reach) dist = reach
  if (dist < fold) dist = fold
  const cosA = Math.min(1, Math.max(-1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)))
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA))
  const along = l1 * cosA
  const off = l1 * sinA
  const px = -uz
  const pz = ux
  const y = (from.y + to.y) / 2
  const z1 = from.z + uz * along + pz * off
  const z2 = from.z + uz * along - pz * off
  if (z1 <= z2) out.set(from.x + ux * along + px * off, y, z1)
  else out.set(from.x + ux * along - px * off, y, z2)
}

/**
 * A European concealed cup hinge: 35 mm cup in the door, clip plate on the side,
 * two-bar arm, and the soft-close damper. The cup rides on the door.
 */
export function addEuropeanHinge(
  doorGroup: Group,
  parent: Group,
  door: DoorSolid,
  fromTop: number,
  bin: Disposable[],
): HingeRig {
  const nickel = metalMaterial(NICKEL, bin, 0.22)
  const screwMat = metalMaterial(SCREW, bin, 0.4)
  const damperMat = metalMaterial(DAMPER, bin, 0.55)

  const cupX = -door.width / 2 + CUP_FROM_EDGE
  const cupY = door.height / 2 - fromTop
  const innerZ = door.thickness / 2

  const cupGeo = new CylinderGeometry(CUP_RADIUS, 16.2, CUP_DEPTH, 32)
  cupGeo.rotateX(Math.PI / 2)
  const cup = new Mesh(cupGeo, nickel)
  cup.position.set(cupX, cupY, innerZ - CUP_DEPTH / 2 + 0.6)
  cup.castShadow = true
  doorGroup.add(cup)
  bin.push({ dispose: () => cupGeo.dispose() })

  const rimGeo = new CylinderGeometry(20, 20, 2.4, 32)
  rimGeo.rotateX(Math.PI / 2)
  const rim = new Mesh(rimGeo, nickel)
  rim.position.set(cupX, cupY, innerZ + 1.2)
  rim.castShadow = true
  doorGroup.add(rim)
  bin.push({ dispose: () => rimGeo.dispose() })

  const boreGeo = new CylinderGeometry(12, 12, 1.2, 24)
  boreGeo.rotateX(Math.PI / 2)
  const bore = new Mesh(boreGeo, damperMat)
  bore.position.set(cupX, cupY, innerZ + 2.2)
  doorGroup.add(bore)
  bin.push({ dispose: () => boreGeo.dispose() })

  for (const screwY of [-22.5, 22.5]) {
    const screwGeo = new CylinderGeometry(3.4, 3.4, 1.8, 14)
    screwGeo.rotateX(Math.PI / 2)
    const screw = new Mesh(screwGeo, screwMat)
    screw.position.set(cupX - 1, cupY + screwY, innerZ + 2.2)
    doorGroup.add(screw)
    bin.push({ dispose: () => screwGeo.dispose() })
  }

  const knuckleGeo = new CylinderGeometry(4.2, 4.2, 18, 16)
  const knuckle = new Mesh(knuckleGeo, nickel)
  knuckle.position.set(-door.width / 2 + 6, cupY, innerZ + 5)
  knuckle.castShadow = true
  doorGroup.add(knuckle)
  bin.push({ dispose: () => knuckleGeo.dispose() })

  const inward = door.side === 'left' ? 1 : -1
  const mountX =
    door.side === 'left'
      ? door.inset
        ? door.hingeX - 3
        : door.hingeX + door.thickness
      : door.inset
        ? door.hingeX + 3
        : door.hingeX - door.thickness
  const plateX = mountX + inward * 1.8
  const plateY = -(door.y + fromTop)
  const plateZ = -(door.z + 46)

  const plate = new Group()
  plate.position.set(plateX, plateY, plateZ)
  parent.add(plate)

  const baseGeo = new BoxGeometry(2.6, 64, 18)
  const base = new Mesh(baseGeo, nickel)
  base.castShadow = true
  base.receiveShadow = true
  plate.add(base)
  bin.push({ dispose: () => baseGeo.dispose() })

  const bossGeo = new BoxGeometry(6, 30, 12)
  const boss = new Mesh(bossGeo, nickel)
  boss.position.set(inward * 3.2, 0, 4)
  boss.castShadow = true
  plate.add(boss)
  bin.push({ dispose: () => bossGeo.dispose() })

  for (const screwY of [-16, 16]) {
    const screwGeo = new CylinderGeometry(3.4, 3.4, 1.5, 12)
    screwGeo.rotateZ(Math.PI / 2)
    const screw = new Mesh(screwGeo, screwMat)
    screw.position.set(inward * 1.8, screwY, -2)
    plate.add(screw)
    const slotGeo = new BoxGeometry(0.5, 0.6, 3.2)
    const slot = new Mesh(slotGeo, damperMat)
    slot.position.set(inward * 2.4, screwY, -2)
    plate.add(slot)
    bin.push({ dispose: () => screwGeo.dispose() }, { dispose: () => slotGeo.dispose() })
  }

  const linkGeo = new BoxGeometry(13, 1, 3.2)
  const linkA = new Mesh(linkGeo, nickel)
  const linkB = new Mesh(linkGeo, nickel)
  linkA.castShadow = true
  linkB.castShadow = true
  linkA.matrixAutoUpdate = false
  linkB.matrixAutoUpdate = false
  parent.add(linkA, linkB)
  bin.push({ dispose: () => linkGeo.dispose() })

  const damperGeo = new CylinderGeometry(4.2, 4.2, 1, 12)
  const damper = new Mesh(damperGeo, damperMat)
  damper.castShadow = true
  damper.matrixAutoUpdate = false
  parent.add(damper)
  bin.push({ dispose: () => damperGeo.dispose() })

  const clip = new Vector3(plateX + inward * 6.2, plateY, -(door.z + 37))
  const knuckleLocal = new Vector3(-door.width / 2 + 6, cupY, innerZ + 5)

  return {
    knuckle: knuckleLocal.clone(),
    update(doorLocal) {
      const joint = localKnuckle.copy(knuckleLocal).applyMatrix4(doorLocal)
      elbow(joint, clip, ARM_A, ARM_B, elbowPoint)
      placeLink(linkA, joint, elbowPoint)
      placeLink(linkB, elbowPoint, clip)
      linkFrom.copy(elbowPoint).lerp(clip, 0.22)
      linkTo.copy(elbowPoint).lerp(clip, 0.62)
      placeLink(damper, linkFrom, linkTo)
    },
  }
}
