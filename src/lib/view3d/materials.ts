import {
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  type Material,
} from 'three'
import type { DecorSheet } from '@/lib/finish-photo'

const METAL = new Set(['#c5cad3', '#94a3b8', '#8b919a', '#9aa3ad'])

const textureCache = new Map<string, Texture>()
const textureLoader = new TextureLoader()

export type Disposable = { dispose(): void }

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

/** Grain in the photo runs along its height. Map that onto the long axis of the face. */
function faceTexture(sheet: DecorSheet, faceW: number, faceH: number, anisotropy: number, bin: Disposable[]) {
  const tex = sharedTexture(sheet.url).clone()
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.anisotropy = anisotropy
  const across = Math.max(sheet.acrossMm, 1)
  const along = Math.max(sheet.alongMm, 1)
  if (faceH >= faceW) {
    tex.repeat.set(Math.max(faceW, 1) / across, Math.max(faceH, 1) / along)
  } else {
    tex.center.set(0.5, 0.5)
    tex.rotation = Math.PI / 2
    tex.repeat.set(Math.max(faceH, 1) / across, Math.max(faceW, 1) / along)
  }
  tex.needsUpdate = true
  bin.push({ dispose: () => tex.dispose() })
  return tex
}

function laminate(color: string, map: Texture | undefined, bin: Disposable[]) {
  const mat = new MeshPhysicalMaterial({
    color: map ? '#ffffff' : color,
    // Only with a photo: three.js warns on every board given `map: undefined`, thousands of times.
    ...(map ? { map } : {}),
    roughness: 0.38,
    metalness: 0.03,
    clearcoat: 0.2,
    clearcoatRoughness: 0.38,
    envMapIntensity: 0.72,
  })
  bin.push({ dispose: () => mat.dispose() })
  return mat
}

function matte(color: string, bin: Disposable[]) {
  const mat = new MeshStandardMaterial({
    color,
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: 0.25,
  })
  bin.push({ dispose: () => mat.dispose() })
  return mat
}

export function metalMaterial(color: string | number, bin: Disposable[], roughness = 0.24) {
  const mat = new MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.92,
    envMapIntensity: 1,
  })
  bin.push({ dispose: () => mat.dispose() })
  return mat
}

export function isMetalColor(color: string) {
  return METAL.has(color.toLowerCase())
}

/**
 * Six materials in BoxGeometry order: +x, -x, +y, -y, +z, -z.
 * The two broad faces carry the decor. The thin edges are the edge band.
 * A hardboard back keeps a matte inner face and the raw colour on the outside.
 */
export function boardMaterials(
  color: string,
  sheet: DecorSheet | undefined,
  w: number,
  h: number,
  d: number,
  anisotropy: number,
  bin: Disposable[],
  rearColor?: string,
): Material[] {
  if (isMetalColor(color)) {
    const metal = metalMaterial(color, bin, 0.32)
    return [metal, metal, metal, metal, metal, metal]
  }

  const faceSize: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ]
  const thin = w <= h && w <= d ? 0 : h <= w && h <= d ? 1 : 2
  const big = thin === 0 ? [0, 1] : thin === 1 ? [2, 3] : [4, 5]

  const band = rearColor ? matte(rearColor, bin) : laminate(color, undefined, bin)
  const broad = new Map<number, Material>()
  for (const index of big) {
    if (rearColor && index === 5) {
      broad.set(index, matte(rearColor, bin))
      continue
    }
    if (rearColor) {
      broad.set(index, matte(color, bin))
      continue
    }
    const [faceW, faceH] = faceSize[index]!
    const map = sheet ? faceTexture(sheet, faceW, faceH, anisotropy, bin) : undefined
    broad.set(index, laminate(color, map, bin))
  }

  return [0, 1, 2, 3, 4, 5].map((index) => broad.get(index) ?? band)
}
