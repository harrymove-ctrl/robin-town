import * as THREE from 'three';
import { PLOT_LAYOUT } from '../board-layout';
import { SHOPS } from '../engine';
import {
  CELL_SIZE_2D,
  DISTRICT_THEMES_3D,
  EMPTY_CLUSTER_CONNECTIONS,
  PLAYER_STOOL_COLORS,
  boardRectToWorld,
  type CityAtmosphereMode,
  type ClusterConnectionMask,
  type PlotSlot3D,
  type PlotVisualState,
} from './types-3d';

const PLOT_TILE_SIZE = 48.5;
const PLOT_TILE_HEIGHT = 2.2;
const DEED_BADGE_BASE_Y = 14;

const SHOP_ENGLISH_SIGNS = [
  'COFFEE',
  'BAKERY',
  'NOODLES',
  'FLOWERS',
  'TAILOR',
  'GROCERY',
] as const;

type PlotSurfaceVariant =
  | 'vacant'
  | 'offered'
  | 'chosen'
  | 'owner-0'
  | 'owner-1'
  | 'owner-2'
  | 'owner-3';

interface PlotPaletteSpec {
  padHex: string;
  curbHex: string;
  borderHex: string;
  centerNumeralColor: string;
  badgeFillHex: string;
  badgeBorderHex: string;
  badgeTextHex: string;
  pipHex: string;
}

interface SlotPrivateRefs {
  topMat: THREE.MeshStandardMaterial;
  sideMat: THREE.MeshStandardMaterial;
  frameMat: THREE.LineBasicMaterial;
  ringMat: THREE.MeshBasicMaterial;
  innerRingMesh: THREE.Mesh;
  innerRingMat: THREE.MeshBasicMaterial;
  curbGroup: THREE.Group;
  curbMat: THREE.MeshStandardMaterial;
  parcelGardenGroup: THREE.Group;
  deedFrontMat: THREE.MeshStandardMaterial;
  deedBadgeNumber: number;
  chosenPreviewGroup: THREE.Group | null;
}

interface OccupantAnimRefs {
  steamPuffs: THREE.Mesh[];
  completeCrowns: THREE.Object3D[];
  crownGlowMats: THREE.MeshStandardMaterial[];
  hangingLanterns: THREE.Object3D[];
  festoonBulbMats: THREE.MeshStandardMaterial[];
  windowGlowMats: THREE.MeshStandardMaterial[];
}

const plotTextureCache = new Map<string, THREE.CanvasTexture>();
const signTextureCache = new Map<string, THREE.CanvasTexture>();
const deedTextureCache = new Map<number, THREE.CanvasTexture>();
const roofTileTextureCache = new Map<string, THREE.CanvasTexture>();
const sharedMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
const sharedGeometryCache = new Map<string, THREE.BufferGeometry>();

let crownEmblemTextureCache: THREE.CanvasTexture | null | undefined;

function markShared<T extends { userData: Record<string, unknown> }>(resource: T): T {
  resource.userData.shared = true;
  return resource;
}

function createCanvas2D(
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    return { canvas, ctx };
  } catch {
    return null;
  }
}

function getSharedStandardMaterial(
  hex: string,
  roughness = 0.68,
  metalness = 0.05,
  opacity = 1,
): THREE.MeshStandardMaterial {
  const key = `${hex}|${roughness.toFixed(2)}|${metalness.toFixed(2)}|${opacity.toFixed(2)}`;
  const existing = sharedMaterialCache.get(key);
  if (existing) {
    return existing;
  }
  const mat = new THREE.MeshStandardMaterial({
    color: hex,
    roughness,
    metalness,
    transparent: opacity < 1,
    opacity,
  });
  markShared(mat);
  sharedMaterialCache.set(key, mat);
  return mat;
}

function getSharedBox(w: number, h: number, d: number): THREE.BoxGeometry {
  const key = `box:${w.toFixed(2)}:${h.toFixed(2)}:${d.toFixed(2)}`;
  const existing = sharedGeometryCache.get(key);
  if (existing) {
    return existing as THREE.BoxGeometry;
  }
  const geo = markShared(new THREE.BoxGeometry(w, h, d));
  sharedGeometryCache.set(key, geo);
  return geo;
}

function getSharedCylinder(
  rt: number,
  rb: number,
  h: number,
  seg = 12,
): THREE.CylinderGeometry {
  const key = `cyl:${rt.toFixed(2)}:${rb.toFixed(2)}:${h.toFixed(2)}:${seg}`;
  const existing = sharedGeometryCache.get(key);
  if (existing) {
    return existing as THREE.CylinderGeometry;
  }
  const geo = markShared(new THREE.CylinderGeometry(rt, rb, h, seg));
  sharedGeometryCache.set(key, geo);
  return geo;
}

function getSharedSphere(r: number, wSeg = 10, hSeg = 8): THREE.SphereGeometry {
  const key = `sph:${r.toFixed(2)}:${wSeg}:${hSeg}`;
  const existing = sharedGeometryCache.get(key);
  if (existing) {
    return existing as THREE.SphereGeometry;
  }
  const geo = markShared(new THREE.SphereGeometry(r, wSeg, hSeg));
  sharedGeometryCache.set(key, geo);
  return geo;
}

function buildRoundedSquarePath(
  target: THREE.Shape | THREE.Path,
  halfSize: number,
  radius: number,
): void {
  const r = Math.min(radius, halfSize * 0.45);
  const s = halfSize;
  target.moveTo(-s + r, -s);
  target.lineTo(s - r, -s);
  target.quadraticCurveTo(s, -s, s, -s + r);
  target.lineTo(s, s - r);
  target.quadraticCurveTo(s, s, s - r, s);
  target.lineTo(-s + r, s);
  target.quadraticCurveTo(-s, s, -s, s - r);
  target.lineTo(-s, -s + r);
  target.quadraticCurveTo(-s, -s, -s + r, -s);
}

function getSharedSquareRingGeometry(outerHalf: number, innerHalf: number): THREE.BufferGeometry {
  const key = `sqring:${outerHalf.toFixed(2)}:${innerHalf.toFixed(2)}`;
  const existing = sharedGeometryCache.get(key);
  if (existing) {
    return existing;
  }
  const shape = new THREE.Shape();
  buildRoundedSquarePath(shape, outerHalf, 2.2);
  const hole = new THREE.Path();
  buildRoundedSquarePath(hole, innerHalf, 1.3);
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape, 8);
  geo.rotateX(-Math.PI / 2);
  markShared(geo);
  sharedGeometryCache.set(key, geo);
  return geo;
}

function getSharedShopPlinthGeometry(): THREE.BufferGeometry {
  const key = 'shop-notched-plinth';
  const existing = sharedGeometryCache.get(key);
  if (existing) {
    return existing;
  }
  // 45.6 x 45.6 shop patio with a clean front-right (+X, -Y in 2D shape before -90deg X rotation)
  // chamfered corner notch so the plot number on the stone tile stays completely unobstructed.
  const s = 22.8;
  const notchX = 10.2;
  const notchZ = 11.8;
  const shape = new THREE.Shape();
  // Note: rotateX(-PI/2) maps shape (x, y) -> world (x, 0, -y), so world +Z corresponds to shape y = -z.
  shape.moveTo(-s, s); // back-left (-X, -Z)
  shape.lineTo(s, s); // back-right (+X, -Z)
  shape.lineTo(s, -notchZ); // right edge down to notch (+X, +notchZ)
  shape.lineTo(notchX, -s); // diagonal chamfer exposing front-right plot number corner
  shape.lineTo(-s, -s); // front-left (-X, +Z)
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 1.0,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.14,
    bevelSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  markShared(geo);
  sharedGeometryCache.set(key, geo);
  return geo;
}

function getSharedHippedRoofGeometry(
  baseW: number,
  baseD: number,
  ridgeW: number,
  ridgeD: number,
  height: number,
): THREE.BufferGeometry {
  const key = `hiproof:${baseW.toFixed(1)}:${baseD.toFixed(1)}:${ridgeW.toFixed(1)}:${ridgeD.toFixed(1)}:${height.toFixed(1)}`;
  const existing = sharedGeometryCache.get(key);
  if (existing) {
    return existing;
  }

  const hw = baseW / 2;
  const hd = baseD / 2;
  const rw = ridgeW / 2;
  const rd = ridgeD / 2;

  const p0 = [-hw, 0, hd]; // front-left
  const p1 = [hw, 0, hd]; // front-right
  const p2 = [hw, 0, -hd]; // back-right
  const p3 = [-hw, 0, -hd]; // back-left
  const t0 = [-rw, height, rd]; // top front-left
  const t1 = [rw, height, rd]; // top front-right
  const t2 = [rw, height, -rd]; // top back-right
  const t3 = [-rw, height, -rd]; // top back-left

  const positions: number[] = [];
  const uvs: number[] = [];
  const pushQuad = (a: number[], b: number[], c: number[], d: number[], uScale = 4, vScale = 2) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    uvs.push(0, 0, uScale, 0, uScale, vScale, 0, 0, uScale, vScale, 0, vScale);
  };

  // Front slope (+Z)
  pushQuad(p0, p1, t1, t0, Math.max(2, Math.round(baseW / 6)), 3);
  // Right hip (+X)
  pushQuad(p1, p2, t2, t1, Math.max(2, Math.round(baseD / 6)), 3);
  // Back slope (-Z)
  pushQuad(p2, p3, t3, t2, Math.max(2, Math.round(baseW / 6)), 3);
  // Left hip (-X)
  pushQuad(p3, p0, t0, t3, Math.max(2, Math.round(baseD / 6)), 3);
  // Ridge cap top (+Y)
  pushQuad(t0, t1, t2, t3, 2, 1);
  // Underside (-Y)
  pushQuad(p3, p2, p1, p0, 1, 1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  markShared(geo);
  sharedGeometryCache.set(key, geo);
  return geo;
}

function getCachedRoofTileTexture(roofHex: string): THREE.CanvasTexture | null {
  const existing = roofTileTextureCache.get(roofHex);
  if (existing) return existing;

  const surface = createCanvas2D(128, 128);
  if (!surface) return null;
  const { canvas, ctx } = surface;

  const base = new THREE.Color(roofHex);
  const darkHex = `#${base.clone().multiplyScalar(0.76).getHexString()}`;
  const lightHex = `#${base.clone().lerp(new THREE.Color('#fff2dc'), 0.16).getHexString()}`;

  ctx.fillStyle = roofHex;
  ctx.fillRect(0, 0, 128, 128);

  // Scalloped vertical barrel-tile ribs + horizontal overlap shadow courses
  for (let col = 0; col < 8; col++) {
    const x = col * 16;
    ctx.fillStyle = lightHex;
    ctx.fillRect(x + 2, 0, 5, 128);
    ctx.fillStyle = darkHex;
    ctx.fillRect(x + 12, 0, 4, 128);
  }
  for (let row = 0; row < 4; row++) {
    const y = row * 32;
    ctx.fillStyle = 'rgba(34, 18, 10, 0.24)';
    ctx.fillRect(0, y + 28, 128, 4);
    ctx.fillStyle = 'rgba(255, 244, 224, 0.14)';
    ctx.fillRect(0, y, 128, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  markShared(tex);
  roofTileTextureCache.set(roofHex, tex);
  return tex;
}

function drawRoundedRect2D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function getPaletteForVariant(
  variant: PlotSurfaceVariant,
  districtIndex: number,
): PlotPaletteSpec {
  const district =
    DISTRICT_THEMES_3D[
      ((districtIndex % DISTRICT_THEMES_3D.length) + DISTRICT_THEMES_3D.length) %
        DISTRICT_THEMES_3D.length
    ];
  const districtPip = district ? district.accentHex : '#d88a88';

  if (variant === 'offered') {
    return {
      padHex: '#fbe39c',
      curbHex: '#f4cd68',
      borderHex: '#c9881c',
      centerNumeralColor: 'rgba(116, 72, 10, 0.28)',
      badgeFillHex: '#fff6d6',
      badgeBorderHex: '#b87614',
      badgeTextHex: '#3a2205',
      pipHex: '#e3a82b',
    };
  }

  if (variant === 'chosen') {
    return {
      padHex: '#b8f2d8',
      curbHex: '#8ce3bd',
      borderHex: '#258765',
      centerNumeralColor: 'rgba(20, 92, 66, 0.28)',
      badgeFillHex: '#ebfff6',
      badgeBorderHex: '#258765',
      badgeTextHex: '#103f2e',
      pipHex: '#39a883',
    };
  }

  if (variant.startsWith('owner-')) {
    const ownerIdx = Number(variant.slice(6)) || 0;
    const ownerHex = PLAYER_STOOL_COLORS[ownerIdx % PLAYER_STOOL_COLORS.length] ?? '#39a883';
    return {
      padHex: '#e4dcc2',
      curbHex: ownerHex,
      borderHex: ownerHex,
      centerNumeralColor: 'rgba(84, 76, 56, 0.20)',
      badgeFillHex: '#faf5e6',
      badgeBorderHex: ownerHex,
      badgeTextHex: '#231e15',
      pipHex: ownerHex,
    };
  }

  return {
    padHex: '#aebe8e',
    curbHex: '#d5cbb0',
    borderHex: '#9d9478',
    centerNumeralColor: 'rgba(78, 70, 50, 0.34)',
    badgeFillHex: '#f5efe0',
    badgeBorderHex: '#7d7358',
    badgeTextHex: '#262016',
    pipHex: districtPip,
  };
}

function getCachedPlotTopTexture(
  displayNumber: number,
  districtIndex: number,
  variant: PlotSurfaceVariant,
): THREE.CanvasTexture | null {
  const key = `${displayNumber}|${districtIndex}|${variant}`;
  const cached = plotTextureCache.get(key);
  if (cached) {
    return cached;
  }

  const surface = createCanvas2D(256, 256);
  if (!surface) {
    return null;
  }

  const { canvas, ctx } = surface;
  const spec = getPaletteForVariant(variant, districtIndex);
  const label = String(displayNumber);

  // Outer stone curb border
  ctx.fillStyle = spec.curbHex;
  ctx.fillRect(0, 0, 256, 256);

  // Segmented paver joints along outer curb matching 2D plot stone sprite
  ctx.strokeStyle = spec.borderHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 252);

  ctx.strokeStyle = 'rgba(70, 62, 46, 0.22)';
  ctx.lineWidth = 2;
  for (let step = 64; step < 256; step += 64) {
    ctx.beginPath();
    ctx.moveTo(step, 2);
    ctx.lineTo(step, 20);
    ctx.moveTo(step, 236);
    ctx.lineTo(step, 254);
    ctx.moveTo(2, step);
    ctx.lineTo(20, step);
    ctx.moveTo(236, step);
    ctx.lineTo(254, step);
    ctx.stroke();
  }

  // Sunlit top bevel highlight
  ctx.fillStyle = 'rgba(255, 252, 240, 0.34)';
  ctx.fillRect(6, 6, 244, 5);
  ctx.fillRect(6, 6, 5, 244);

  // Inner parcel pad: manicured sunlit meadow lawn for vacant lots, cobblestone pavers for owned lots
  const seedBase = displayNumber * 37 + districtIndex * 13;
  if (variant === 'vacant') {
    const lawnGrad = ctx.createLinearGradient(20, 20, 236, 236);
    lawnGrad.addColorStop(0, '#b9cb98');
    lawnGrad.addColorStop(1, '#9fb381');
    ctx.fillStyle = lawnGrad;
    ctx.fillRect(20, 20, 216, 216);

    // Subtle diagonal garden lawn mowing stripes
    ctx.fillStyle = 'rgba(255, 252, 232, 0.11)';
    for (let stripeY = 26; stripeY < 230; stripeY += 28) {
      ctx.fillRect(22, stripeY, 212, 12);
    }

    // Botanical clover tufts and warm wildflower dots
    for (let i = 0; i < 18; i++) {
      const sx = 28 + ((seedBase + i * 47) % 194);
      const sy = 28 + ((seedBase * 3 + i * 67) % 190);
      ctx.fillStyle = i % 5 === 0 ? 'rgba(249, 241, 208, 0.55)' : 'rgba(104, 126, 78, 0.28)';
      ctx.beginPath();
      ctx.arc(sx, sy, i % 5 === 0 ? 2.4 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Warm cream sandstone center plaque medallion behind plot numeral
    ctx.fillStyle = 'rgba(64, 76, 48, 0.18)';
    drawRoundedRect2D(ctx, 64, 65, 124, 118, 20);
    ctx.fill();

    ctx.fillStyle = '#e7dec3';
    drawRoundedRect2D(ctx, 62, 62, 124, 118, 20);
    ctx.fill();

    ctx.strokeStyle = '#b1a788';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = spec.padHex;
    ctx.fillRect(20, 20, 216, 216);

    if (variant.startsWith('owner-')) {
      // Staggered warm heritage cobblestone paver joints on claimed plots
      ctx.strokeStyle = 'rgba(112, 100, 76, 0.18)';
      ctx.lineWidth = 1.5;
      for (let py = 44; py < 234; py += 24) {
        ctx.beginPath();
        ctx.moveTo(21, py);
        ctx.lineTo(235, py);
        ctx.stroke();
      }
      for (let row = 0; row < 9; row++) {
        const y0 = 20 + row * 24;
        const y1 = Math.min(236, y0 + 24);
        const offset = (row % 2) * 18;
        for (let px = 42 + offset; px < 232; px += 36) {
          ctx.beginPath();
          ctx.moveTo(px, y0);
          ctx.lineTo(px, y1);
          ctx.stroke();
        }
      }
    }

    for (let i = 0; i < 14; i++) {
      const sx = 30 + ((seedBase + i * 53) % 192);
      const sy = 30 + ((seedBase * 3 + i * 71) % 186);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(130, 118, 92, 0.16)' : 'rgba(255, 251, 236, 0.28)';
      ctx.fillRect(sx, sy, 6 + (i % 4), 3);
    }
  }

  ctx.strokeStyle = spec.borderHex;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(20, 20, 216, 216);

  // District / owner corner accent pips in top-left and bottom-left corners
  ctx.fillStyle = spec.pipHex;
  drawRoundedRect2D(ctx, 27, 27, 15, 15, 3);
  ctx.fill();
  drawRoundedRect2D(ctx, 27, 214, 12, 12, 3);
  ctx.fill();

  // Subtle large center numeral for immediate overview readability on vacant plots
  ctx.save();
  ctx.fillStyle = spec.centerNumeralColor;
  ctx.font = '800 76px "Bungee", "Trebuchet MS", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 124, 122);
  ctx.restore();

  // Crisp high-contrast bottom-right corner badge (front-right stone corner in 3D)
  const badgeW = label.length >= 2 ? 68 : 56;
  const badgeH = 44;
  const badgeX = 244 - badgeW;
  const badgeY = 244 - badgeH;

  ctx.fillStyle = 'rgba(38, 32, 22, 0.18)';
  drawRoundedRect2D(ctx, badgeX + 2, badgeY + 3, badgeW, badgeH, 9);
  ctx.fill();

  ctx.fillStyle = spec.badgeFillHex;
  drawRoundedRect2D(ctx, badgeX, badgeY, badgeW, badgeH, 9);
  ctx.fill();

  ctx.lineWidth = 3.5;
  ctx.strokeStyle = spec.badgeBorderHex;
  ctx.stroke();

  ctx.fillStyle = spec.badgeTextHex;
  ctx.font = '900 28px "Trebuchet MS", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  markShared(texture);
  plotTextureCache.set(key, texture);
  return texture;
}

function getCachedSignTexture(
  text: string,
  bgHex: string,
  textHex: string,
  borderHex: string,
  accentHex: string,
): THREE.CanvasTexture | null {
  const key = `${text}|${bgHex}|${textHex}|${borderHex}|${accentHex}`;
  const cached = signTextureCache.get(key);
  if (cached) {
    return cached;
  }

  const surface = createCanvas2D(256, 88);
  if (!surface) {
    return null;
  }

  const { canvas, ctx } = surface;
  ctx.fillStyle = borderHex;
  ctx.fillRect(0, 0, 256, 88);

  ctx.fillStyle = bgHex;
  ctx.fillRect(6, 6, 244, 76);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3;
  ctx.strokeRect(11, 11, 234, 66);

  // Corner brass rivets
  ctx.fillStyle = accentHex;
  const rivets: Array<[number, number]> = [
    [18, 18],
    [238, 18],
    [18, 70],
    [238, 70],
  ];
  for (const [rx, ry] of rivets) {
    ctx.beginPath();
    ctx.arc(rx, ry, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle drop shadow + crisp block English lettering
  const fontSize = text.length >= 7 ? 34 : 38;
  ctx.font = `900 ${fontSize}px "Trebuchet MS", "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(18, 14, 10, 0.35)';
  ctx.fillText(text, 130, 47);

  ctx.fillStyle = textHex;
  ctx.fillText(text, 128, 45);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  markShared(texture);
  signTextureCache.set(key, texture);
  return texture;
}

function getCachedDeedTexture(displayNumber: number): THREE.CanvasTexture | null {
  const cached = deedTextureCache.get(displayNumber);
  if (cached) {
    return cached;
  }

  const surface = createCanvas2D(192, 128);
  if (!surface) {
    return null;
  }

  const { canvas, ctx } = surface;
  ctx.fillStyle = '#fff2c6';
  ctx.fillRect(0, 0, 192, 128);

  ctx.strokeStyle = '#c5851e';
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, 182, 118);

  ctx.strokeStyle = '#e5b54c';
  ctx.lineWidth = 2;
  ctx.strokeRect(13, 13, 166, 102);

  ctx.fillStyle = '#8b5710';
  ctx.font = '800 20px "Trebuchet MS", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LAND DEED', 96, 34);

  ctx.fillStyle = '#361f04';
  ctx.font = '900 46px "Trebuchet MS", "Arial Black", sans-serif';
  ctx.fillText(`#${displayNumber}`, 96, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  markShared(texture);
  deedTextureCache.set(displayNumber, texture);
  return texture;
}

function getCachedCrownEmblemTexture(): THREE.CanvasTexture | null {
  if (crownEmblemTextureCache !== undefined) {
    return crownEmblemTextureCache;
  }

  const surface = createCanvas2D(192, 96);
  if (!surface) {
    crownEmblemTextureCache = null;
    return null;
  }

  const { canvas, ctx } = surface;
  ctx.fillStyle = '#1d4636';
  ctx.fillRect(0, 0, 192, 96);

  ctx.strokeStyle = '#ffd663';
  ctx.lineWidth = 7;
  ctx.strokeRect(4, 4, 184, 88);

  ctx.strokeStyle = '#f2b632';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, 168, 72);

  ctx.fillStyle = '#ffe68a';
  ctx.font = '900 42px "Trebuchet MS", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$wif', 96, 50);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  markShared(tex);
  crownEmblemTextureCache = tex;
  return tex;
}

function tagLotIdRecursive(root: THREE.Object3D, lotId: number): void {
  root.traverse((node) => {
    node.userData = { ...node.userData, lotId };
  });
}

function disposeMaterialInstance(mat: THREE.Material): void {
  if (mat.userData?.shared) {
    return;
  }
  const std = mat as THREE.MeshStandardMaterial;
  const maps: Array<THREE.Texture | null | undefined> = [
    std.map,
    std.emissiveMap,
    std.alphaMap,
    std.roughnessMap,
    std.bumpMap,
  ];
  for (const tex of maps) {
    if (tex && !tex.userData?.shared) {
      tex.dispose();
    }
  }
  mat.dispose();
}

function disposeOwnedSubtree(root: THREE.Object3D): void {
  root.traverse((node) => {
    const renderable = node as THREE.Mesh | THREE.LineSegments;
    if (renderable.geometry && !renderable.geometry.userData?.shared) {
      renderable.geometry.dispose();
    }
    const mat = renderable.material;
    if (Array.isArray(mat)) {
      for (const item of mat) {
        if (item) {
          disposeMaterialInstance(item);
        }
      }
    } else if (mat) {
      disposeMaterialInstance(mat);
    }
  });
}

function clearGroupOwned(group: THREE.Group): void {
  while (group.children.length > 0) {
    const child = group.children[group.children.length - 1];
    if (!child) {
      break;
    }
    group.remove(child);
    disposeOwnedSubtree(child);
  }
}

function createDeedBadgeGroup(
  initialNumber: number,
): { group: THREE.Group; frontMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  group.name = 'deed-badge';
  group.position.set(0, DEED_BADGE_BASE_Y, 0);
  group.visible = false;

  const tex = getCachedDeedTexture(initialNumber);
  const frontMat = new THREE.MeshStandardMaterial({
    color: tex ? '#ffffff' : '#ffe8a3',
    map: tex,
    emissive: new THREE.Color('#d9981e'),
    emissiveIntensity: 0.25,
    roughness: 0.38,
    metalness: 0.08,
  });

  const goldWoodMat = getSharedStandardMaterial('#d89c2b', 0.35, 0.38);
  const brassCapMat = getSharedStandardMaterial('#ffe07d', 0.26, 0.55);
  const waxSealMat = getSharedStandardMaterial('#c94135', 0.42, 0.1);

  const scrollBody = new THREE.Mesh(getSharedBox(15.6, 10.4, 0.9), [
    goldWoodMat,
    goldWoodMat,
    goldWoodMat,
    goldWoodMat,
    frontMat,
    frontMat,
  ]);
  group.add(scrollBody);

  // Top and bottom golden scroll rollers
  const rollerGeo = getSharedCylinder(0.95, 0.95, 17.8, 12);
  const capGeo = getSharedCylinder(1.25, 1.25, 0.9, 10);

  for (const yOff of [5.5, -5.5]) {
    const roller = new THREE.Mesh(rollerGeo, goldWoodMat);
    roller.rotation.z = Math.PI / 2;
    roller.position.y = yOff;
    group.add(roller);

    for (const xOff of [-9.2, 9.2]) {
      const cap = new THREE.Mesh(capGeo, brassCapMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(xOff, yOff, 0);
      group.add(cap);
    }
  }

  // Crimson wax seal + downward golden pointer pin
  const seal = new THREE.Mesh(getSharedCylinder(1.6, 1.6, 1.3, 12), waxSealMat);
  seal.rotation.x = Math.PI / 2;
  seal.position.set(5.4, -4.4, 0.2);
  group.add(seal);

  const pin = new THREE.Mesh(getSharedCylinder(0.2, 2.2, 3.6, 4), brassCapMat);
  pin.rotation.x = Math.PI;
  pin.rotation.y = Math.PI / 4;
  pin.position.set(0, -8.2, 0);
  group.add(pin);

  return { group, frontMat };
}

function createOwnerCurbGroup(curbMat: THREE.MeshStandardMaterial): THREE.Group {
  const group = new THREE.Group();
  group.name = 'owner-curb-trim';
  group.position.y = PLOT_TILE_HEIGHT + 0.16;
  group.visible = false;

  const span = PLOT_TILE_SIZE - 0.6;
  const barThick = 1.45;
  const barHeight = 0.34;
  const offset = (PLOT_TILE_SIZE - barThick) / 2 - 0.15;

  const hGeo = getSharedBox(span, barHeight, barThick);
  const vGeo = getSharedBox(barThick, barHeight, span - barThick * 2);

  const north = new THREE.Mesh(hGeo, curbMat);
  north.position.z = -offset;
  const south = new THREE.Mesh(hGeo, curbMat);
  south.position.z = offset;
  const west = new THREE.Mesh(vGeo, curbMat);
  west.position.x = -offset;
  const east = new THREE.Mesh(vGeo, curbMat);
  east.position.x = offset;

  group.add(north, south, west, east);
  return group;
}

function createParcelCornerGarden3D(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'vacant-parcel-garden';
  group.position.y = PLOT_TILE_HEIGHT;

  const pegMat = getSharedStandardMaterial('#8d623b', 0.72, 0.04);
  const pegCapMat = getSharedStandardMaterial('#e2ba58', 0.36, 0.42);
  const shrubDarkMat = getSharedStandardMaterial('#58914f', 0.62, 0.03);
  const shrubLightMat = getSharedStandardMaterial('#73ad63', 0.58, 0.03);
  const stoneMat = getSharedStandardMaterial('#d8ceb2', 0.8, 0.02);

  // North-West and North-East manicured boxwood shrubs + boundary pegs (leaves SE number & center open)
  for (const [cx, cz, isLight] of [
    [-19.2, -19.2, false],
    [19.2, -19.2, true],
  ] as const) {
    const shrub = new THREE.Mesh(
      getSharedSphere(2.15, 8, 7),
      isLight ? shrubLightMat : shrubDarkMat,
    );
    shrub.scale.set(1.15, 0.72, 1.15);
    shrub.position.set(cx * 0.86, 1.15, cz * 0.86);
    group.add(shrub);

    const peg = new THREE.Mesh(getSharedBox(0.95, 2.2, 0.95), pegMat);
    peg.position.set(cx, 1.1, cz);
    const pegCap = new THREE.Mesh(getSharedBox(1.15, 0.36, 1.15), pegCapMat);
    pegCap.position.set(cx, 2.28, cz);
    group.add(peg, pegCap);
  }

  // South-West low cedar peg + garden stepping stone
  const swPeg = new THREE.Mesh(getSharedBox(0.95, 2.0, 0.95), pegMat);
  swPeg.position.set(-19.2, 1.0, 19.0);
  const stepStone = new THREE.Mesh(getSharedCylinder(2.1, 2.2, 0.28, 8), stoneMat);
  stepStone.position.set(-15.8, 0.14, 17.8);
  group.add(swPeg, stepStone);

  return group;
}

function buildMoldedStoolCore(
  primaryHex: string,
  opacity = 1,
  includeTeaCup = true,
): THREE.Group {
  const group = new THREE.Group();

  const mainColor = new THREE.Color(primaryHex);
  const shadeHex = `#${mainColor.clone().multiplyScalar(0.8).getHexString()}`;
  const highlightHex = `#${mainColor.clone().lerp(new THREE.Color('#ffffff'), 0.18).getHexString()}`;

  const bodyMat = getSharedStandardMaterial(primaryHex, 0.35, 0.05, opacity);
  const trimMat = getSharedStandardMaterial(shadeHex, 0.38, 0.05, opacity);
  const topHighlightMat = getSharedStandardMaterial(highlightHex, 0.32, 0.06, opacity);
  const slotHoleMat = getSharedStandardMaterial('#1c2421', 0.85, 0.02, opacity);

  // Soft dark contact shadow disc on the stone tile (y = 0.08)
  if (opacity >= 0.95) {
    const shadowMat = getSharedStandardMaterial('#201c15', 0.95, 0, 0.28);
    const shadowDisc = new THREE.Mesh(getSharedCylinder(10.2, 10.2, 0.08, 20), shadowMat);
    shadowDisc.position.set(-2, 0.08, -2);
    group.add(shadowDisc);
  }

  // Stool assembly centered slightly back-left (-2, 0, -2) at ~18 wide x 17 tall
  const stool = new THREE.Group();
  stool.position.set(-2, 0.22, -2);

  // Molded square rounded top seat + downturned reinforced rim
  const seatSkirt = new THREE.Mesh(getSharedBox(14.2, 2.2, 14.2), trimMat);
  seatSkirt.position.y = 15.2;
  stool.add(seatSkirt);

  const seatTop = new THREE.Mesh(getSharedBox(13.4, 1.1, 13.4), topHighlightMat);
  seatTop.position.y = 16.45;
  stool.add(seatTop);

  // Rounded corner bumpers on seat top
  const cornerPostGeo = getSharedCylinder(1.25, 1.35, 2.5, 10);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const corner = new THREE.Mesh(cornerPostGeo, bodyMat);
      corner.position.set(sx * 6.0, 15.45, sz * 6.0);
      stool.add(corner);
    }
  }

  // Subtle molded grip ribs flanking the center finger slot
  const ribGeo = getSharedBox(8.6, 0.22, 0.65);
  for (const rz of [-3.4, -1.9, 1.9, 3.4]) {
    const rib = new THREE.Mesh(ribGeo, bodyMat);
    rib.position.set(0, 17.05, rz);
    stool.add(rib);
  }

  // Dark center rectangular finger-carry slot
  const carrySlot = new THREE.Mesh(getSharedBox(4.2, 0.3, 1.45), slotHoleMat);
  carrySlot.position.set(0, 17.04, 0);
  stool.add(carrySlot);

  // 4 outward-flared tapered legs (+/-10 deg splay) reaching ~18 wide footprint at y = 0
  const splayRad = (10 * Math.PI) / 180;
  const legGeo = getSharedBox(2.05, 15.8, 2.05);
  const footGeo = getSharedBox(2.45, 0.65, 2.45);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const legPivot = new THREE.Group();
      legPivot.position.set(sx * 5.2, 15.4, sz * 5.2);
      legPivot.rotation.z = -sx * splayRad;
      legPivot.rotation.x = sz * splayRad;

      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.y = -7.7;
      legPivot.add(leg);

      const innerFlange = new THREE.Mesh(getSharedBox(1.1, 14.6, 1.1), trimMat);
      innerFlange.position.set(-sx * 0.45, -7.5, -sz * 0.45);
      legPivot.add(innerFlange);

      const foot = new THREE.Mesh(footGeo, trimMat);
      foot.position.y = -15.35;
      legPivot.add(foot);

      stool.add(legPivot);
    }
  }

  // 4 horizontal leg-stretcher rungs halfway up (y = 6.8)
  const rungHGeo = getSharedBox(12.6, 1.35, 1.15);
  const rungVGeo = getSharedBox(1.15, 1.35, 12.6);
  const rungOffset = 6.35;

  const frontRung = new THREE.Mesh(rungHGeo, trimMat);
  frontRung.position.set(0, 6.8, rungOffset);
  const backRung = new THREE.Mesh(rungHGeo, trimMat);
  backRung.position.set(0, 6.8, -rungOffset);
  const leftRung = new THREE.Mesh(rungVGeo, trimMat);
  leftRung.position.set(-rungOffset, 6.8, 0);
  const rightRung = new THREE.Mesh(rungVGeo, trimMat);
  rightRung.position.set(rungOffset, 6.8, 0);

  stool.add(frontRung, backRung, leftRung, rightRung);
  group.add(stool);

  // Tiny stainless street-tea coaster and iced tea cup beside the stool (left side, clear of plot number)
  if (includeTeaCup && opacity >= 0.95) {
    const coasterGroup = new THREE.Group();
    coasterGroup.position.set(-13.2, 0, 5.2);

    const steelMat = getSharedStandardMaterial('#c7d2d0', 0.26, 0.68);
    const teaMat = getSharedStandardMaterial('#c48f39', 0.25, 0.05, 0.88);
    const iceMat = getSharedStandardMaterial('#f2faf8', 0.2, 0.05);
    const strawMat = getSharedStandardMaterial('#39a883', 0.4, 0.05);

    const coaster = new THREE.Mesh(getSharedCylinder(2.3, 2.5, 0.35, 14), steelMat);
    coaster.position.y = 0.18;
    coasterGroup.add(coaster);

    const cup = new THREE.Mesh(getSharedCylinder(1.45, 1.1, 3.3, 12), teaMat);
    cup.position.y = 1.95;
    coasterGroup.add(cup);

    const foamRim = new THREE.Mesh(getSharedCylinder(1.48, 1.42, 0.55, 12), iceMat);
    foamRim.position.y = 3.55;
    coasterGroup.add(foamRim);

    const straw = new THREE.Mesh(getSharedCylinder(0.18, 0.18, 2.4, 8), strawMat);
    straw.position.set(0.45, 4.4, 0.15);
    straw.rotation.z = -0.24;
    coasterGroup.add(straw);

    group.add(coasterGroup);
  }

  return group;
}

export function createPlasticStool3D(ownerIndex: number): THREE.Group {
  const safeOwner =
    ((ownerIndex % PLAYER_STOOL_COLORS.length) + PLAYER_STOOL_COLORS.length) %
    PLAYER_STOOL_COLORS.length;
  const hex = PLAYER_STOOL_COLORS[safeOwner] ?? PLAYER_STOOL_COLORS[0];
  const group = buildMoldedStoolCore(hex, 1, true);
  group.name = `plastic-stool-owner-${safeOwner}`;
  return group;
}

function createSignboardMesh(
  label: string,
  width: number,
  height: number,
  bgHex: string,
  textHex: string,
  borderHex: string,
  accentHex: string,
): THREE.Group {
  const signGroup = new THREE.Group();
  const backingMat = getSharedStandardMaterial(borderHex, 0.6, 0.12);
  const backing = new THREE.Mesh(getSharedBox(width + 0.8, height + 0.8, 0.9), backingMat);
  signGroup.add(backing);

  const tex = getCachedSignTexture(label, bgHex, textHex, borderHex, accentHex);
  const faceMat = new THREE.MeshStandardMaterial({
    color: tex ? '#ffffff' : bgHex,
    map: tex,
    roughness: 0.44,
    metalness: 0.06,
  });

  const face = new THREE.Mesh(getSharedBox(width, height, 0.45), [
    backingMat,
    backingMat,
    backingMat,
    backingMat,
    faceMat,
    backingMat,
  ]);
  face.position.z = 0.35;
  signGroup.add(face);

  return signGroup;
}

function createHangingLantern(
  x: number,
  y: number,
  z: number,
  bodyHex = '#cc493c',
): THREE.Group {
  const lantern = new THREE.Group();
  lantern.position.set(x, y, z);

  const cordMat = getSharedStandardMaterial('#3d2b1f', 0.8, 0.1);
  const capMat = getSharedStandardMaterial('#eab84b', 0.32, 0.45);
  const lanternMat = getSharedStandardMaterial(bodyHex, 0.42, 0.06);

  const cord = new THREE.Mesh(getSharedCylinder(0.14, 0.14, 1.8, 6), cordMat);
  cord.position.y = -0.9;
  lantern.add(cord);

  const topCap = new THREE.Mesh(getSharedCylinder(0.85, 0.95, 0.45, 10), capMat);
  topCap.position.y = -1.85;
  lantern.add(topCap);

  const globe = new THREE.Mesh(getSharedSphere(1.65, 12, 10), lanternMat);
  globe.scale.set(1, 1.12, 1);
  globe.position.y = -3.35;
  lantern.add(globe);

  const bottomCap = new THREE.Mesh(getSharedCylinder(0.9, 0.7, 0.45, 10), capMat);
  bottomCap.position.y = -4.9;
  lantern.add(bottomCap);

  const tassel = new THREE.Mesh(getSharedCylinder(0.22, 0.06, 1.3, 6), capMat);
  tassel.position.y = -5.7;
  lantern.add(tassel);

  return lantern;
}

function createPottedPlant(x: number, y: number, z: number): THREE.Group {
  const plant = new THREE.Group();
  plant.position.set(x, y, z);

  const potMat = getSharedStandardMaterial('#c16947', 0.68, 0.04);
  const soilMat = getSharedStandardMaterial('#4b3526', 0.9, 0.02);
  const leafMat = getSharedStandardMaterial('#5c9e53', 0.55, 0.04);
  const leafLightMat = getSharedStandardMaterial('#74b864', 0.52, 0.04);

  const pot = new THREE.Mesh(getSharedCylinder(2.1, 1.55, 3.0, 10), potMat);
  pot.position.y = 1.5;
  plant.add(pot);

  const potRim = new THREE.Mesh(getSharedCylinder(2.35, 2.25, 0.55, 10), potMat);
  potRim.position.y = 2.95;
  plant.add(potRim);

  const soil = new THREE.Mesh(getSharedCylinder(2.0, 2.0, 0.25, 10), soilMat);
  soil.position.y = 3.15;
  plant.add(soil);

  const stem = new THREE.Mesh(getSharedCylinder(0.24, 0.3, 3.6, 6), leafMat);
  stem.position.y = 4.8;
  plant.add(stem);

  const leafOffsets: Array<[number, number, number, number, number]> = [
    [0, 6.9, 0, 0, 0],
    [-1.4, 5.6, 0.4, 0, 0.55],
    [1.4, 5.3, -0.3, 0, -0.55],
    [0.3, 5.9, 1.2, 0.5, 0],
  ];
  for (let i = 0; i < leafOffsets.length; i++) {
    const [lx, ly, lz, rx, rz] = leafOffsets[i]!;
    const paddle = new THREE.Mesh(
      getSharedBox(1.8, 2.2, 0.45),
      i % 2 === 0 ? leafLightMat : leafMat,
    );
    paddle.position.set(lx, ly, lz);
    paddle.rotation.set(rx, 0, rz);
    plant.add(paddle);
  }

  return plant;
}

function createMiniStreetStool(
  x: number,
  y: number,
  z: number,
  hex: string,
  scale = 0.26,
): THREE.Group {
  const mini = buildMoldedStoolCore(hex, 1, false);
  mini.scale.setScalar(scale);
  // Offset the internal (-2, 0, -2) center of buildMoldedStoolCore so it lands accurately at (x, y, z)
  mini.position.set(x + 2 * scale, y, z + 2 * scale);
  return mini;
}

function getSharedRoofTileMaterial(roofHex: string): THREE.MeshStandardMaterial {
  const key = `rooftile:${roofHex}`;
  const existing = sharedMaterialCache.get(key);
  if (existing) {
    return existing;
  }
  const tileTex = getCachedRoofTileTexture(roofHex);
  const mat = new THREE.MeshStandardMaterial({
    color: tileTex ? '#ffffff' : roofHex,
    map: tileTex,
    roughness: 0.62,
    metalness: 0.05,
  });
  markShared(mat);
  sharedMaterialCache.set(key, mat);
  return mat;
}

function createHippedRoofAssembly(
  baseW: number,
  baseD: number,
  height: number,
  roofHex: string,
  eaveHex: string,
  ridgeHex: string,
): THREE.Group {
  const roofGroup = new THREE.Group();
  const ridgeW = baseW * 0.64;
  const ridgeD = 2.0;

  const fasciaMat = getSharedStandardMaterial(eaveHex, 0.72, 0.04);
  const roofMat = getSharedRoofTileMaterial(roofHex);
  const battenHex = `#${new THREE.Color(roofHex).multiplyScalar(0.84).getHexString()}`;
  const battenMat = getSharedStandardMaterial(battenHex, 0.66, 0.05);
  const ridgeMat = getSharedStandardMaterial(ridgeHex, 0.55, 0.08);

  // Timber eaves cornice underneath
  const fascia = new THREE.Mesh(getSharedBox(baseW - 1.6, 1.3, baseD - 1.6), fasciaMat);
  fascia.position.y = 0.65;
  roofGroup.add(fascia);

  // Main hipped roof volume
  const mainRoof = new THREE.Mesh(
    getSharedHippedRoofGeometry(baseW, baseD, ridgeW, ridgeD, height),
    roofMat,
  );
  mainRoof.position.y = 1.2;
  roofGroup.add(mainRoof);

  // Horizontal tile course battens on front and back slopes for authentic Aseprite roof texture
  for (const frac of [0.28, 0.56, 0.82]) {
    const courseW = THREE.MathUtils.lerp(baseW - 1.4, ridgeW + 0.6, frac);
    const courseZ = THREE.MathUtils.lerp(baseD / 2 - 0.3, ridgeD / 2 + 0.2, frac);
    const courseY = 1.2 + height * frac;
    const barGeo = getSharedBox(courseW, 0.42, 0.55);

    const frontBar = new THREE.Mesh(barGeo, battenMat);
    frontBar.position.set(0, courseY, courseZ);
    const backBar = new THREE.Mesh(barGeo, battenMat);
    backBar.position.set(0, courseY, -courseZ);
    roofGroup.add(frontBar, backBar);
  }

  // Ridge beam + decorative end finials
  const ridgeBeam = new THREE.Mesh(getSharedBox(ridgeW + 1.4, 0.95, 1.6), ridgeMat);
  ridgeBeam.position.y = 1.2 + height + 0.32;
  roofGroup.add(ridgeBeam);

  for (const sx of [-1, 1]) {
    const finial = new THREE.Mesh(getSharedBox(1.1, 1.35, 1.8), ridgeMat);
    finial.position.set(sx * (ridgeW / 2 + 0.55), 1.2 + height + 0.55, 0);
    roofGroup.add(finial);
  }

  return roofGroup;
}

function createStripedAwning(
  width: number,
  projection: number,
  stripeCount: number,
  hexA: string,
  hexB: string,
  scallopedValance = false,
): THREE.Group {
  const awning = new THREE.Group();
  const stripeW = width / stripeCount;
  const matA = getSharedStandardMaterial(hexA, 0.58, 0.03);
  const matB = getSharedStandardMaterial(hexB, 0.58, 0.03);

  const slopeAngle = 0.44;
  const panelLen = projection / Math.cos(slopeAngle);
  const dropY = Math.sin(slopeAngle) * projection;

  for (let i = 0; i < stripeCount; i++) {
    const mat = i % 2 === 0 ? matA : matB;
    const cx = -width / 2 + stripeW * (i + 0.5);

    const slopePanel = new THREE.Mesh(getSharedBox(stripeW + 0.08, 0.5, panelLen), mat);
    slopePanel.rotation.x = slopeAngle;
    slopePanel.position.set(cx, -dropY / 2, projection / 2);
    awning.add(slopePanel);

    if (scallopedValance) {
      const scallop = new THREE.Mesh(
        getSharedCylinder(stripeW * 0.5, stripeW * 0.5, 0.55, 12),
        mat,
      );
      scallop.rotation.x = Math.PI / 2;
      scallop.position.set(cx, -dropY - 0.55, projection);
      awning.add(scallop);
    } else {
      const valance = new THREE.Mesh(getSharedBox(stripeW + 0.08, 1.45, 0.5), mat);
      valance.position.set(cx, -dropY - 0.65, projection);
      awning.add(valance);
    }
  }

  return awning;
}

function createClerestoryTier(
  extraTiles: number,
  wallW: number,
  wallD: number,
  wallHex: string,
  trimHex: string,
  baseY: number,
): { group: THREE.Group; height: number } {
  const height = extraTiles * 4;
  const group = new THREE.Group();
  group.position.y = baseY;

  const tierW = wallW - 2.6;
  const tierD = wallD - 2.6;
  const wallMat = getSharedStandardMaterial(wallHex, 0.68, 0.04);
  const trimMat = getSharedStandardMaterial(trimHex, 0.62, 0.06);
  const glowGlassMat = getSharedStandardMaterial('#ffe29a', 0.3, 0.08);
  const frameMat = getSharedStandardMaterial('#235559', 0.55, 0.08);

  const core = new THREE.Mesh(getSharedBox(tierW, height, tierD), wallMat);
  core.position.y = height / 2;
  group.add(core);

  for (let band = 0; band < extraTiles; band++) {
    const bandY = band * 4;
    const cornice = new THREE.Mesh(getSharedBox(tierW + 1.4, 0.7, tierD + 1.4), trimMat);
    cornice.position.y = bandY + 3.75;
    group.add(cornice);

    // Transom windows on front and back of each clerestory band
    for (const wx of [-7.2, 0, 7.2]) {
      const winFrame = new THREE.Mesh(getSharedBox(4.4, 2.1, 0.55), frameMat);
      winFrame.position.set(wx, bandY + 1.9, tierD / 2 + 0.15);
      group.add(winFrame);

      const pane = new THREE.Mesh(getSharedBox(3.5, 1.4, 0.62), glowGlassMat);
      pane.position.set(wx, bandY + 1.9, tierD / 2 + 0.18);
      group.add(pane);
    }
  }

  return { group, height };
}

function createCompleteCrown3D(
  roofTopY: number,
): { crownGroup: THREE.Group; glowMat: THREE.MeshStandardMaterial } {
  const crownGroup = new THREE.Group();
  crownGroup.name = 'complete-prosperity-crown';
  const baseY = roofTopY + 3.8;
  crownGroup.position.set(0, baseY, 0);
  crownGroup.userData = { completeCrown: true, baseY };

  const goldArchMat = getSharedStandardMaterial('#f2be42', 0.25, 0.62);
  const rubyLanternMat = getSharedStandardMaterial('#d84437', 0.35, 0.12);

  // Twin golden arch pillars rising from the roof ridge
  const pillarGeo = getSharedCylinder(0.65, 0.8, 6.2, 10);
  for (const sx of [-1, 1]) {
    const pillar = new THREE.Mesh(pillarGeo, goldArchMat);
    pillar.position.set(sx * 7.8, 0.6, 0);
    crownGroup.add(pillar);

    // Mini glowing ruby-gold lantern suspended under each arch wing
    const wingLantern = new THREE.Mesh(getSharedSphere(1.15, 10, 8), rubyLanternMat);
    wingLantern.position.set(sx * 10.2, 1.6, 0);
    crownGroup.add(wingLantern);

    const wingCap = new THREE.Mesh(getSharedCylinder(0.65, 0.65, 0.35, 8), goldArchMat);
    wingCap.position.set(sx * 10.2, 2.8, 0);
    crownGroup.add(wingCap);
  }

  // Golden prosperity crossbeam & stepped imperial top bar
  const lowerBeam = new THREE.Mesh(getSharedBox(22.4, 1.0, 1.3), goldArchMat);
  lowerBeam.position.y = 3.5;
  crownGroup.add(lowerBeam);

  const upperCrest = new THREE.Mesh(getSharedBox(16.2, 0.9, 1.5), goldArchMat);
  upperCrest.position.y = 6.9;
  crownGroup.add(upperCrest);

  // Center $wif golden prosperity medallion sign
  const emblemTex = getCachedCrownEmblemTexture();
  const glowMat = new THREE.MeshStandardMaterial({
    color: emblemTex ? '#ffffff' : '#ffe074',
    map: emblemTex,
    emissive: new THREE.Color('#e3a624'),
    emissiveIntensity: 0.42,
    roughness: 0.28,
    metalness: 0.25,
  });

  const signBoard = new THREE.Mesh(getSharedBox(12.8, 5.6, 1.1), [
    goldArchMat,
    goldArchMat,
    goldArchMat,
    goldArchMat,
    glowMat,
    glowMat,
  ]);
  signBoard.position.y = 4.9;
  crownGroup.add(signBoard);

  return { crownGroup, glowMat };
}

function addOwnerCornerMarker(
  shopGroup: THREE.Group,
  ownerIndex: number,
  plinthTopY: number,
  streetYaw = 0,
): void {
  const safeOwner =
    ((ownerIndex % PLAYER_STOOL_COLORS.length) + PLAYER_STOOL_COLORS.length) %
    PLAYER_STOOL_COLORS.length;
  const ownerHex = PLAYER_STOOL_COLORS[safeOwner] ?? PLAYER_STOOL_COLORS[0];

  const matGroup = new THREE.Group();
  matGroup.name = 'owner-sidewalk-marker';
  // Mirror to front-right (+X) when facing East (+PI/2) so world South-East plot number stays clear
  const placeOnRight = Math.abs(streetYaw - Math.PI / 2) < 0.2;
  matGroup.position.set(placeOnRight ? 15.2 : -15.8, plinthTopY, 16.2);

  const trimMat = getSharedStandardMaterial('#f3ead2', 0.72, 0.02);
  const wovenMat = getSharedStandardMaterial(ownerHex, 0.55, 0.04);

  const matBorder = new THREE.Mesh(getSharedBox(9.2, 0.24, 6.8), trimMat);
  matBorder.position.y = 0.12;
  matGroup.add(matBorder);

  const matCore = new THREE.Mesh(getSharedBox(7.8, 0.3, 5.4), wovenMat);
  matCore.position.y = 0.17;
  matGroup.add(matCore);

  // Owner-colored molded plastic stool perched cleanly on the sidewalk mat
  const ownerStool = buildMoldedStoolCore(ownerHex, 1, false);
  ownerStool.scale.setScalar(0.38);
  ownerStool.position.set(-0.4 + 2 * 0.38, 0.28, -0.2 + 2 * 0.38);
  matGroup.add(ownerStool);

  shopGroup.add(matGroup);
}

const SHOP_REAR_SIGN_PALETTES: ReadonlyArray<{
  backZ: number;
  bg: string;
  fg: string;
  border: string;
  accent: string;
}> = [
  { backZ: -16.45, bg: '#1e5b5f', fg: '#fff3d1', border: '#5c3b23', accent: '#eec353' },
  { backZ: -16.45, bg: '#a34835', fg: '#fff5da', border: '#6b4429', accent: '#f3cb68' },
  { backZ: -16.15, bg: '#b03e33', fg: '#fff4d4', border: '#593622', accent: '#f0c659' },
  { backZ: -16.3, bg: '#25665d', fg: '#fff6dc', border: '#68472b', accent: '#eec760' },
  { backZ: -16.25, bg: '#214d52', fg: '#ffe79e', border: '#664528', accent: '#f0c351' },
  { backZ: -16.85, bg: '#2c6b4d', fg: '#fff3cf', border: '#5e3b24', accent: '#efc458' },
];

function addRearShophouseFacade(
  buildingGroup: THREE.Group,
  safeShop: number,
  plinthTopY: number,
  windowGlowMat?: THREE.MeshStandardMaterial,
): void {
  const spec = SHOP_REAR_SIGN_PALETTES[safeShop] ?? SHOP_REAR_SIGN_PALETTES[0]!;
  const label = SHOP_ENGLISH_SIGNS[safeShop] ?? 'SHOP';
  const rearGroup = new THREE.Group();
  rearGroup.name = 'rear-shophouse-facade';

  const frameMat = getSharedStandardMaterial('#235559', 0.56, 0.06);
  const shutterMat = getSharedStandardMaterial('#367b78', 0.62, 0.05);
  const warmGlassMat = windowGlowMat ?? getSharedStandardMaterial('#ffe19c', 0.32, 0.08);
  const sillMat = getSharedStandardMaterial('#845739', 0.65, 0.04);

  for (const wx of [-7.6, 7.6]) {
    const winFrame = new THREE.Mesh(getSharedBox(5.6, 6.2, 0.55), frameMat);
    winFrame.position.set(wx, plinthTopY + 7.2, spec.backZ - 0.16);
    rearGroup.add(winFrame);

    const glass = new THREE.Mesh(getSharedBox(4.2, 4.8, 0.62), warmGlassMat);
    glass.position.set(wx, plinthTopY + 7.2, spec.backZ - 0.19);
    rearGroup.add(glass);

    for (const side of [-1, 1]) {
      const shutter = new THREE.Mesh(getSharedBox(1.3, 5.8, 0.45), shutterMat);
      shutter.position.set(wx + side * 3.3, plinthTopY + 7.2, spec.backZ - 0.22);
      rearGroup.add(shutter);
    }

    const sill = new THREE.Mesh(getSharedBox(6.8, 0.7, 1.1), sillMat);
    sill.position.set(wx, plinthTopY + 3.9, spec.backZ - 0.35);
    rearGroup.add(sill);
  }

  // Side gable transom windows + front warm doorway fanlight so night/sunset glow wraps 360 deg
  for (const sx of [-1, 1]) {
    const sideFrame = new THREE.Mesh(getSharedBox(0.55, 3.8, 5.2), frameMat);
    sideFrame.position.set(sx * 16.4, plinthTopY + 11.4, -3.5);
    const sidePane = new THREE.Mesh(getSharedBox(0.64, 2.8, 4.0), warmGlassMat);
    sidePane.position.set(sx * 16.45, plinthTopY + 11.4, -3.5);
    rearGroup.add(sideFrame, sidePane);
  }

  const frontTransom = new THREE.Mesh(getSharedBox(8.6, 1.7, 0.58), warmGlassMat);
  frontTransom.position.set(0, plinthTopY + 10.6, 9.6);
  rearGroup.add(frontTransom);

  const rearSign = createSignboardMesh(
    label,
    16.2,
    3.5,
    spec.bg,
    spec.fg,
    spec.border,
    spec.accent,
  );
  rearSign.rotation.y = Math.PI;
  rearSign.position.set(0, plinthTopY + 13.2, spec.backZ - 0.38);
  rearGroup.add(rearSign);

  buildingGroup.add(rearGroup);
}

function buildCoffeeShop(
  root: THREE.Group,
  plinthTopY: number,
  extraTiles: number,
  animRefs: OccupantAnimRefs,
): number {
  const wallW = 33.5;
  const wallD = 26.5;
  const wallH = 17.5;
  const wallCenterZ = -3.2;

  const creamWallMat = getSharedStandardMaterial('#ead9b5', 0.7, 0.03);
  const pilasterMat = getSharedStandardMaterial('#cfa972', 0.68, 0.04);
  const tealWoodMat = getSharedStandardMaterial('#245f63', 0.55, 0.06);
  const deepTealMat = getSharedStandardMaterial('#1a4649', 0.58, 0.06);
  const interiorMat = getSharedStandardMaterial('#223638', 0.85, 0.02);
  const woodCounterMat = getSharedStandardMaterial('#845739', 0.62, 0.05);
  const brassMat = getSharedStandardMaterial('#e5b94c', 0.32, 0.55);

  // Main warm cream plaster shophouse body
  const body = new THREE.Mesh(getSharedBox(wallW, wallH, wallD), creamWallMat);
  body.position.set(0, plinthTopY + wallH / 2, wallCenterZ);
  root.add(body);

  // Corner pilasters
  for (const sx of [-1, 1]) {
    const pilaster = new THREE.Mesh(getSharedBox(2.0, wallH, wallD + 0.5), pilasterMat);
    pilaster.position.set(sx * (wallW / 2 - 0.8), plinthTopY + wallH / 2, wallCenterZ);
    root.add(pilaster);
  }

  const frontZ = wallCenterZ + wallD / 2;

  // Right-side dark-teal paneled wooden door
  const doorFrame = new THREE.Mesh(getSharedBox(7.8, 10.8, 0.9), tealWoodMat);
  doorFrame.position.set(8.6, plinthTopY + 5.4, frontZ + 0.15);
  root.add(doorFrame);

  const doorPanel = new THREE.Mesh(getSharedBox(6.2, 9.4, 0.95), deepTealMat);
  doorPanel.position.set(8.6, plinthTopY + 5.2, frontZ + 0.22);
  root.add(doorPanel);

  const knob = new THREE.Mesh(getSharedSphere(0.45, 8, 8), brassMat);
  knob.position.set(10.8, plinthTopY + 5.1, frontZ + 0.8);
  root.add(knob);

  // Left-side louvered shuttered window & open espresso/filter bar nook
  const nook = new THREE.Mesh(getSharedBox(14.2, 7.6, 1.1), interiorMat);
  nook.position.set(-5.2, plinthTopY + 6.9, frontZ + 0.05);
  root.add(nook);

  // Louvered teal shutters flanking the window
  for (const sx of [-1, 1]) {
    const shutter = new THREE.Mesh(getSharedBox(2.5, 7.6, 0.7), tealWoodMat);
    shutter.position.set(-5.2 + sx * 6.9, plinthTopY + 6.9, frontZ + 0.45);
    root.add(shutter);

    for (let s = 0; s < 4; s++) {
      const slat = new THREE.Mesh(getSharedBox(2.2, 0.35, 0.85), deepTealMat);
      slat.position.set(-5.2 + sx * 6.9, plinthTopY + 4.2 + s * 1.7, frontZ + 0.52);
      root.add(slat);
    }
  }

  const windowSill = new THREE.Mesh(getSharedBox(15.6, 1.0, 2.2), woodCounterMat);
  windowSill.position.set(-5.2, plinthTopY + 3.0, frontZ + 0.75);
  root.add(windowSill);

  // Coffee drip brewer & cups on the window bar
  const porcelainMat = getSharedStandardMaterial('#f6efe0', 0.3, 0.05);
  const phinCup = new THREE.Mesh(getSharedCylinder(0.9, 0.75, 1.8, 10), porcelainMat);
  phinCup.position.set(-7.6, plinthTopY + 4.4, frontZ + 0.8);
  root.add(phinCup);

  const phinFilter = new THREE.Mesh(
    getSharedCylinder(0.95, 0.85, 0.9, 10),
    getSharedStandardMaterial('#b7c4c2', 0.28, 0.6),
  );
  phinFilter.position.set(-7.6, plinthTopY + 5.7, frontZ + 0.8);
  root.add(phinFilter);

  // Crisp English COFFEE signboard centered above window & door
  const sign = createSignboardMesh(
    SHOP_ENGLISH_SIGNS[0],
    20.4,
    5.0,
    '#286d70',
    '#f8edd2',
    '#163b3e',
    '#dfbe7d',
  );
  sign.position.set(0.4, plinthTopY + 14.0, frontZ + 0.4);
  root.add(sign);

  // Potted green plant on left patio
  root.add(createPottedPlant(-15.5, plinthTopY, 6.2));

  // Round sidewalk cafe table + iced milk coffee glass + 2 small blue street stools
  const cafeTableGroup = new THREE.Group();
  cafeTableGroup.position.set(0.6, plinthTopY, 12.2);

  const tablePedestal = new THREE.Mesh(getSharedCylinder(0.65, 0.85, 5.2, 10), woodCounterMat);
  tablePedestal.position.y = 2.6;
  cafeTableGroup.add(tablePedestal);

  const tableFoot = new THREE.Mesh(getSharedCylinder(2.6, 2.8, 0.45, 12), woodCounterMat);
  tableFoot.position.y = 0.22;
  cafeTableGroup.add(tableFoot);

  const tableTop = new THREE.Mesh(getSharedCylinder(4.3, 4.0, 0.7, 16), woodCounterMat);
  tableTop.position.y = 5.35;
  cafeTableGroup.add(tableTop);

  // Iced condensed-milk coffee glass (two-tone milk + dark roast)
  const milkLayer = new THREE.Mesh(getSharedCylinder(0.8, 0.68, 0.9, 10), porcelainMat);
  milkLayer.position.set(0, 6.15, 0);
  cafeTableGroup.add(milkLayer);

  const coffeeLayer = new THREE.Mesh(
    getSharedCylinder(0.92, 0.8, 1.5, 10),
    getSharedStandardMaterial('#3b2214', 0.28, 0.05),
  );
  coffeeLayer.position.set(0, 7.35, 0);
  cafeTableGroup.add(coffeeLayer);

  root.add(cafeTableGroup);

  // 2 small blue street stools flanking the cafe table
  root.add(createMiniStreetStool(-5.8, plinthTopY, 12.6, '#4a8ab8', 0.26));
  root.add(createMiniStreetStool(6.6, plinthTopY, 10.6, '#4a8ab8', 0.26));

  let roofBaseY = plinthTopY + wallH;
  if (extraTiles > 0) {
    const tier = createClerestoryTier(extraTiles, wallW, wallD, '#ead9b5', '#7a4930', roofBaseY);
    root.add(tier.group);
    roofBaseY += tier.height;
  }

  // Terracotta ridged hipped roof
  const roof = createHippedRoofAssembly(38.2, 31.2, 8.2, '#b86843', '#6e3b26', '#9b4f2f');
  roof.position.set(0, roofBaseY, wallCenterZ);
  root.add(roof);

  // 2 hanging red-and-gold lanterns flanking the facade under the eaves
  const leftLantern = createHangingLantern(-15.2, plinthTopY + wallH + 0.4, frontZ + 1.8);
  const rightLantern = createHangingLantern(15.2, plinthTopY + wallH + 0.4, frontZ + 1.8);
  root.add(leftLantern, rightLantern);
  animRefs.hangingLanterns.push(leftLantern, rightLantern);

  return roofBaseY + 9.8;
}

function buildBakeryShop(
  root: THREE.Group,
  plinthTopY: number,
  extraTiles: number,
): number {
  const wallW = 32.5;
  const wallD = 24.5;
  const wallH = 16.8;
  const wallCenterZ = -4.2;

  const wallMat = getSharedStandardMaterial('#e6d2a8', 0.7, 0.03);
  const woodTrimMat = getSharedStandardMaterial('#785334', 0.66, 0.05);
  const cartGoldMat = getSharedStandardMaterial('#eab965', 0.55, 0.05);
  const darkFrameMat = getSharedStandardMaterial('#234c4f', 0.52, 0.12);
  const glassMat = getSharedStandardMaterial('#7cc6c2', 0.18, 0.1, 0.45);
  const wheelMat = getSharedStandardMaterial('#2b383a', 0.6, 0.25);
  const wheelHubMat = getSharedStandardMaterial('#cfd8d6', 0.35, 0.55);

  const body = new THREE.Mesh(getSharedBox(wallW, wallH, wallD), wallMat);
  body.position.set(0, plinthTopY + wallH / 2, wallCenterZ);
  root.add(body);

  const frontZ = wallCenterZ + wallD / 2;

  // Prominent red-and-cream striped canvas awning with slim brass support poles
  const awning = createStripedAwning(33.6, 9.6, 9, '#c95c44', '#f5ebd1', false);
  awning.position.set(0, plinthTopY + 15.6, frontZ - 0.3);
  root.add(awning);

  const poleMat = getSharedStandardMaterial('#c49347', 0.42, 0.35);
  for (const px of [-15.2, 15.2]) {
    const pole = new THREE.Mesh(getSharedCylinder(0.38, 0.38, 11.4, 8), poleMat);
    pole.position.set(px, plinthTopY + 5.7, frontZ + 8.6);
    root.add(pole);
  }

  // Bakery cart base front with crisp English BAKERY sign
  const cartX = -1.4;
  const cartZ = frontZ + 4.8;
  const cartBase = new THREE.Mesh(getSharedBox(23.5, 5.4, 7.6), cartGoldMat);
  cartBase.position.set(cartX, plinthTopY + 3.9, cartZ);
  root.add(cartBase);

  const counterSlab = new THREE.Mesh(
    getSharedBox(24.6, 0.85, 8.4),
    getSharedStandardMaterial('#f7eed6', 0.45, 0.04),
  );
  counterSlab.position.set(cartX, plinthTopY + 6.95, cartZ);
  root.add(counterSlab);

  const sign = createSignboardMesh(
    SHOP_ENGLISH_SIGNS[1],
    21.2,
    4.3,
    '#eab965',
    '#2f2116',
    '#243a3d',
    '#f8e7be',
  );
  sign.position.set(cartX, plinthTopY + 3.95, cartZ + 3.6);
  root.add(sign);

  // Spoked bakery cart wheels at base
  for (const wx of [cartX - 7.8, cartX + 7.8]) {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, plinthTopY + 1.85, cartZ + 4.05);

    const tire = new THREE.Mesh(getSharedCylinder(1.85, 1.85, 0.7, 14), wheelMat);
    tire.rotation.x = Math.PI / 2;
    wheelGroup.add(tire);

    const hub = new THREE.Mesh(getSharedCylinder(0.7, 0.7, 0.85, 10), wheelHubMat);
    hub.rotation.x = Math.PI / 2;
    wheelGroup.add(hub);

    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(getSharedBox(3.1, 0.26, 0.78), wheelHubMat);
      spoke.rotation.z = (s * Math.PI) / 4;
      wheelGroup.add(spoke);
    }

    root.add(wheelGroup);
  }

  // Glass bakery display case filled with 4 golden-brown crusty baguettes
  const displayCase = new THREE.Mesh(getSharedBox(22.6, 5.2, 6.4), glassMat);
  displayCase.position.set(cartX, plinthTopY + 9.9, cartZ);
  root.add(displayCase);

  // Display case metal framing bars
  const topBar = new THREE.Mesh(getSharedBox(23.2, 0.55, 6.8), darkFrameMat);
  topBar.position.set(cartX, plinthTopY + 12.55, cartZ);
  const midDivider = new THREE.Mesh(getSharedBox(0.45, 5.2, 6.6), darkFrameMat);
  midDivider.position.set(cartX, plinthTopY + 9.9, cartZ);
  root.add(topBar, midDivider);

  const crustMat = getSharedStandardMaterial('#d88935', 0.52, 0.04);
  const slashMat = getSharedStandardMaterial('#f6cf8c', 0.48, 0.04);
  for (const bx of [-7.6, -2.6, 2.6, 7.6]) {
    const loaf = new THREE.Group();
    loaf.position.set(cartX + bx, plinthTopY + 8.8, cartZ + 0.3);
    loaf.rotation.set(0.28, 0.15, -0.45);

    const baguette = new THREE.Mesh(getSharedCylinder(0.95, 0.9, 4.4, 10), crustMat);
    loaf.add(baguette);

    const tipTop = new THREE.Mesh(getSharedSphere(0.9, 8, 8), crustMat);
    tipTop.position.y = 2.1;
    const tipBot = new THREE.Mesh(getSharedSphere(0.88, 8, 8), crustMat);
    tipBot.position.y = -2.1;
    loaf.add(tipTop, tipBot);

    for (const sy of [-0.9, 0, 0.9]) {
      const scoreMark = new THREE.Mesh(getSharedBox(1.3, 0.25, 1.1), slashMat);
      scoreMark.position.set(0, sy, 0.55);
      scoreMark.rotation.z = 0.35;
      loaf.add(scoreMark);
    }

    root.add(loaf);
  }

  // Condiment jars on left stand (chili & pickled radish jars)
  const standLeft = new THREE.Mesh(getSharedBox(4.0, 3.8, 4.0), darkFrameMat);
  standLeft.position.set(-16.2, plinthTopY + 1.9, cartZ + 0.5);
  root.add(standLeft);

  const jarGlassMat = getSharedStandardMaterial('#f5dfb0', 0.3, 0.06);
  const redCapMat = getSharedStandardMaterial('#c8493c', 0.45, 0.06);
  for (const [jx, capHex] of [
    [-17.0, '#c8493c'],
    [-15.3, '#e29a3b'],
  ] as const) {
    const jar = new THREE.Mesh(getSharedCylinder(0.7, 0.7, 2.0, 10), jarGlassMat);
    jar.position.set(jx, plinthTopY + 4.8, cartZ + 0.5);
    const lid = new THREE.Mesh(
      getSharedCylinder(0.76, 0.76, 0.45, 10),
      capHex === '#c8493c' ? redCapMat : getSharedStandardMaterial(capHex, 0.45, 0.06),
    );
    lid.position.set(jx, plinthTopY + 5.95, cartZ + 0.5);
    root.add(jar, lid);
  }

  // Slatted wooden green herb crate on the right (kept back of z = +11 so plot number stays open)
  const crateGroup = new THREE.Group();
  crateGroup.position.set(14.2, plinthTopY, 5.8);
  const crateBox = new THREE.Mesh(getSharedBox(5.6, 5.0, 5.2), woodTrimMat);
  crateBox.position.y = 2.5;
  crateGroup.add(crateBox);

  const herbDark = getSharedStandardMaterial('#4f9448', 0.58, 0.03);
  const herbLight = getSharedStandardMaterial('#7bc062', 0.55, 0.03);
  for (let h = 0; h < 5; h++) {
    const sprig = new THREE.Mesh(
      getSharedCylinder(0.75, 0.45, 2.8, 8),
      h % 2 === 0 ? herbLight : herbDark,
    );
    sprig.position.set(-1.5 + h * 0.75, 5.6 + (h % 2) * 0.4, (h % 3) * 0.6 - 0.6);
    sprig.rotation.z = (h - 2) * 0.12;
    crateGroup.add(sprig);
  }
  root.add(crateGroup);

  let roofBaseY = plinthTopY + wallH;
  if (extraTiles > 0) {
    const tier = createClerestoryTier(extraTiles, wallW, wallD, '#e6d2a8', '#785334', roofBaseY);
    root.add(tier.group);
    roofBaseY += tier.height;
  }

  // Golden-tan pitched hipped roof
  const roof = createHippedRoofAssembly(37.4, 29.8, 8.0, '#d6a85a', '#785334', '#b9893c');
  roof.position.set(0, roofBaseY, wallCenterZ);
  root.add(roof);

  return roofBaseY + 9.6;
}

function addPorcelainNoodleBowl(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
): void {
  const bowlGroup = new THREE.Group();
  bowlGroup.position.set(x, y, z);

  const porcelainMat = getSharedStandardMaterial('#f8f2e4', 0.28, 0.05);
  const blueRimMat = getSharedStandardMaterial('#39738c', 0.35, 0.06);
  const brothMat = getSharedStandardMaterial('#e8bd6d', 0.32, 0.04);
  const chopstickMat = getSharedStandardMaterial('#8a522d', 0.6, 0.04);

  const bowl = new THREE.Mesh(getSharedCylinder(1.85, 1.05, 1.7, 12), porcelainMat);
  bowl.position.y = 0.85;
  bowlGroup.add(bowl);

  const stripe = new THREE.Mesh(getSharedCylinder(1.76, 1.65, 0.32, 12), blueRimMat);
  stripe.position.y = 1.28;
  bowlGroup.add(stripe);

  const broth = new THREE.Mesh(getSharedCylinder(1.65, 1.65, 0.2, 12), brothMat);
  broth.position.y = 1.62;
  bowlGroup.add(broth);

  // Pair of wooden chopsticks resting diagonally in the bowl
  for (const cz of [-0.22, 0.22]) {
    const stick = new THREE.Mesh(getSharedCylinder(0.1, 0.08, 3.6, 6), chopstickMat);
    stick.position.set(0.75, 2.35, cz);
    stick.rotation.z = -0.68;
    bowlGroup.add(stick);
  }

  parent.add(bowlGroup);
}

function buildNoodlesShop(
  root: THREE.Group,
  plinthTopY: number,
  extraTiles: number,
  animRefs: OccupantAnimRefs,
): number {
  const wallW = 33.5;
  const wallD = 25.5;
  const wallH = 17.5;
  const wallCenterZ = -3.4;

  const wallMat = getSharedStandardMaterial('#e8d5af', 0.7, 0.03);
  const counterWoodMat = getSharedStandardMaterial('#cfa56d', 0.64, 0.04);
  const kitchenTileMat = getSharedStandardMaterial('#1c5558', 0.55, 0.06);
  const stainlessMat = getSharedStandardMaterial('#9ab1ae', 0.26, 0.58);
  const stoveDarkMat = getSharedStandardMaterial('#2d3738', 0.72, 0.2);

  const body = new THREE.Mesh(getSharedBox(wallW, wallH, wallD), wallMat);
  body.position.set(0, plinthTopY + wallH / 2, wallCenterZ);
  root.add(body);

  const frontZ = wallCenterZ + wallD / 2;

  // Open kitchen recess with deep-teal tiled wall backdrop
  const kitchenBack = new THREE.Mesh(getSharedBox(24.6, 8.6, 1.2), kitchenTileMat);
  kitchenBack.position.set(-1.4, plinthTopY + 6.9, frontZ + 0.05);
  root.add(kitchenBack);

  const kitchenCounter = new THREE.Mesh(getSharedBox(25.8, 3.4, 3.6), counterWoodMat);
  kitchenCounter.position.set(-1.4, plinthTopY + 1.7, frontZ + 1.4);
  root.add(kitchenCounter);

  // Shiny silver simmering broth pot with side handles on left counter
  const stoveBase = new THREE.Mesh(getSharedCylinder(3.3, 3.4, 1.6, 14), stoveDarkMat);
  stoveBase.position.set(-7.6, plinthTopY + 4.1, frontZ + 1.5);
  root.add(stoveBase);

  const brothPot = new THREE.Mesh(getSharedCylinder(3.2, 3.0, 4.8, 16), stainlessMat);
  brothPot.position.set(-7.6, plinthTopY + 7.2, frontZ + 1.5);
  root.add(brothPot);

  const potRim = new THREE.Mesh(getSharedCylinder(3.45, 3.35, 0.5, 16), stainlessMat);
  potRim.position.set(-7.6, plinthTopY + 9.6, frontZ + 1.5);
  root.add(potRim);

  const hotBroth = new THREE.Mesh(
    getSharedCylinder(3.05, 3.05, 0.25, 14),
    getSharedStandardMaterial('#fff7e4', 0.25, 0.04),
  );
  hotBroth.position.set(-7.6, plinthTopY + 9.75, frontZ + 1.5);
  root.add(hotBroth);

  for (const hx of [-3.7, 3.7]) {
    const handle = new THREE.Mesh(getSharedBox(0.9, 0.45, 1.3), stainlessMat);
    handle.position.set(-7.6 + hx, plinthTopY + 8.4, frontZ + 1.5);
    root.add(handle);
  }

  // Porcelain noodle bowl + chili bottle on right side of kitchen counter
  addPorcelainNoodleBowl(root, 4.2, plinthTopY + 3.4, frontZ + 1.6);

  const chiliJar = new THREE.Mesh(
    getSharedCylinder(0.65, 0.65, 2.1, 10),
    getSharedStandardMaterial('#c84638', 0.42, 0.06),
  );
  chiliJar.position.set(8.2, plinthTopY + 4.45, frontZ + 1.8);
  root.add(chiliJar);

  // Bold crimson English NOODLES signboard
  const sign = createSignboardMesh(
    SHOP_ENGLISH_SIGNS[2],
    21.6,
    5.2,
    '#bd4c42',
    '#fff2d9',
    '#1d4649',
    '#eab965',
  );
  sign.position.set(-1.0, plinthTopY + 14.1, frontZ + 0.45);
  root.add(sign);

  // Hanging red lantern & potted plant on right side (clear of front-right corner)
  const rightLantern = createHangingLantern(14.8, plinthTopY + wallH + 0.3, frontZ + 1.5);
  root.add(rightLantern);
  animRefs.hangingLanterns.push(rightLantern);
  root.add(createPottedPlant(14.6, plinthTopY, 5.2));

  // Front noodle table + steaming bowl + 2 red street stools
  const tableWoodMat = getSharedStandardMaterial('#6f4930', 0.66, 0.05);
  const post = new THREE.Mesh(getSharedCylinder(0.6, 0.8, 4.8, 10), tableWoodMat);
  post.position.set(-5.2, plinthTopY + 2.4, 12.6);
  const top = new THREE.Mesh(getSharedCylinder(3.9, 3.6, 0.65, 14), tableWoodMat);
  top.position.set(-5.2, plinthTopY + 5.0, 12.6);
  root.add(post, top);
  addPorcelainNoodleBowl(root, -5.2, plinthTopY + 5.3, 12.6);

  root.add(createMiniStreetStool(-11.2, plinthTopY, 11.8, '#c95244', 0.27));
  root.add(createMiniStreetStool(2.4, plinthTopY, 13.0, '#c95244', 0.27));

  let roofBaseY = plinthTopY + wallH;
  if (extraTiles > 0) {
    const tier = createClerestoryTier(extraTiles, wallW, wallD, '#e8d5af', '#6f3826', roofBaseY);
    root.add(tier.group);
    roofBaseY += tier.height;
  }

  // Red-brown tiled pitched roof + right-slope chimney pipe + 3 animated steam puffs
  const roof = createHippedRoofAssembly(38.2, 30.6, 8.2, '#b3583c', '#683322', '#94432b');
  roof.position.set(0, roofBaseY, wallCenterZ);
  root.add(roof);

  const chimneyX = 9.4;
  const chimneyZ = wallCenterZ - 1.2;
  const chimneyBaseY = roofBaseY + 6.2;
  const flueMat = getSharedStandardMaterial('#7e9491', 0.42, 0.35);
  const flueDarkMat = getSharedStandardMaterial('#465a58', 0.55, 0.3);

  const chimneyPipe = new THREE.Mesh(getSharedCylinder(1.65, 1.8, 5.2, 12), flueMat);
  chimneyPipe.position.set(chimneyX, chimneyBaseY + 2.2, chimneyZ);
  root.add(chimneyPipe);

  const chimneyCollar = new THREE.Mesh(getSharedCylinder(2.15, 2.05, 0.75, 12), flueDarkMat);
  chimneyCollar.position.set(chimneyX, chimneyBaseY + 4.85, chimneyZ);
  root.add(chimneyCollar);

  // 3 translucent white steam puffs tagged with userData.steamIndex = 0..2
  const steamMouthY = chimneyBaseY + 5.8;
  const puffGeo = getSharedSphere(1.55, 10, 8);
  for (let i = 0; i < 3; i++) {
    const puffMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: new THREE.Color('#f4f8f7'),
      emissiveIntensity: 0.18,
      roughness: 0.75,
      metalness: 0,
      transparent: true,
      opacity: 0.62 - i * 0.15,
      depthWrite: false,
    });
    const puff = new THREE.Mesh(puffGeo, puffMat);
    const startY = steamMouthY + i * 2.4;
    puff.position.set(chimneyX + (i - 1) * 0.4, startY, chimneyZ);
    puff.userData = {
      steamIndex: i,
      baseX: chimneyX,
      baseY: steamMouthY,
      baseZ: chimneyZ,
    };
    root.add(puff);
    animRefs.steamPuffs.push(puff);
  }

  return roofBaseY + 9.8;
}

function addFlowerBucket(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  bucketHex: string,
  petalHexA: string,
  petalHexB: string,
  scale = 1,
): void {
  const bucketGroup = new THREE.Group();
  bucketGroup.position.set(x, y, z);
  bucketGroup.scale.setScalar(scale);

  const bucketMat = getSharedStandardMaterial(bucketHex, 0.52, 0.18);
  const foliageMat = getSharedStandardMaterial('#55994e', 0.58, 0.03);
  const petalAMat = getSharedStandardMaterial(petalHexA, 0.48, 0.03);
  const petalBMat = getSharedStandardMaterial(petalHexB, 0.48, 0.03);
  const centerMat = getSharedStandardMaterial('#ffe169', 0.45, 0.04);

  const bucket = new THREE.Mesh(getSharedCylinder(2.15, 1.55, 3.8, 12), bucketMat);
  bucket.position.y = 1.9;
  bucketGroup.add(bucket);

  const rim = new THREE.Mesh(getSharedCylinder(2.32, 2.25, 0.45, 12), bucketMat);
  rim.position.y = 3.8;
  bucketGroup.add(rim);

  const greenery = new THREE.Mesh(getSharedSphere(2.25, 10, 8), foliageMat);
  greenery.scale.set(1.1, 0.85, 1.1);
  greenery.position.y = 4.6;
  bucketGroup.add(greenery);

  const blossomOffsets: Array<[number, number, number]> = [
    [0, 6.6, 0.1],
    [-1.35, 5.7, 0.9],
    [1.35, 5.8, 0.8],
    [-0.9, 5.9, -1.0],
    [1.1, 5.6, -0.9],
  ];
  for (let i = 0; i < blossomOffsets.length; i++) {
    const [bx, by, bz] = blossomOffsets[i]!;
    const bloom = new THREE.Mesh(
      getSharedSphere(1.18, 9, 8),
      i % 2 === 0 ? petalAMat : petalBMat,
    );
    bloom.position.set(bx, by, bz);
    bucketGroup.add(bloom);

    const pistil = new THREE.Mesh(getSharedSphere(0.42, 6, 6), centerMat);
    pistil.position.set(bx, by + 0.85, bz + 0.35);
    bucketGroup.add(pistil);
  }

  parent.add(bucketGroup);
}

function buildFlowersShop(
  root: THREE.Group,
  plinthTopY: number,
  extraTiles: number,
): number {
  const wallW = 33.0;
  const wallD = 25.0;
  const wallH = 17.2;
  const wallCenterZ = -3.8;

  const wallMat = getSharedStandardMaterial('#ebd8b0', 0.7, 0.03);
  const tealFrameMat = getSharedStandardMaterial('#235a5d', 0.55, 0.06);
  const deepDoorMat = getSharedStandardMaterial('#1a4447', 0.58, 0.06);
  const rackWoodMat = getSharedStandardMaterial('#8c5d3c', 0.65, 0.04);

  const body = new THREE.Mesh(getSharedBox(wallW, wallH, wallD), wallMat);
  body.position.set(0, plinthTopY + wallH / 2, wallCenterZ);
  root.add(body);

  const frontZ = wallCenterZ + wallD / 2;

  // Central dark-teal studio door and side windows
  const door = new THREE.Mesh(getSharedBox(7.2, 10.4, 0.9), deepDoorMat);
  door.position.set(0, plinthTopY + 5.2, frontZ + 0.18);
  root.add(door);

  for (const wx of [-9.5, 9.5]) {
    const win = new THREE.Mesh(getSharedBox(6.2, 6.8, 0.85), tealFrameMat);
    win.position.set(wx, plinthTopY + 7.2, frontZ + 0.16);
    root.add(win);
  }

  // Cream-and-gold scalloped awning shading the bouquets
  const awning = createStripedAwning(31.2, 5.2, 8, '#f7edd2', '#dfb15b', true);
  awning.position.set(0, plinthTopY + 12.1, frontZ + 0.2);
  root.add(awning);

  // Crisp teal English FLOWERS signboard
  const sign = createSignboardMesh(
    SHOP_ENGLISH_SIGNS[3],
    20.8,
    4.8,
    '#2a7274',
    '#fbf0d5',
    '#193d40',
    '#e4bd74',
  );
  sign.position.set(0, plinthTopY + 14.6, frontZ + 0.45);
  root.add(sign);

  // Climbing green vine leaves up the right pilaster
  const vineMat = getSharedStandardMaterial('#5fa453', 0.55, 0.03);
  for (let v = 0; v < 5; v++) {
    const leaf = new THREE.Mesh(getSharedBox(2.4, 1.1, 1.2), vineMat);
    leaf.position.set(15.2 + (v % 2) * 0.6, plinthTopY + 7.5 + v * 2.1, frontZ - 0.2);
    root.add(leaf);
  }

  // Wooden stepped flower racks on left & right + overflowing flower buckets
  for (const [rx, rz] of [
    [-11.2, frontZ + 3.4],
    [10.8, frontZ + 2.6],
  ] as const) {
    const stepLow = new THREE.Mesh(getSharedBox(8.6, 1.6, 4.4), rackWoodMat);
    stepLow.position.set(rx, plinthTopY + 0.8, rz + 1.8);
    const stepHigh = new THREE.Mesh(getSharedBox(8.6, 3.2, 3.6), rackWoodMat);
    stepHigh.position.set(rx, plinthTopY + 1.6, rz - 1.2);
    root.add(stepLow, stepHigh);
  }

  // Lush colorful bouquets (coral, sunny yellow, rose pink, lavender violet, ivory)
  addFlowerBucket(root, -13.6, plinthTopY + 3.2, frontZ + 1.4, '#c26a48', '#e57a6e', '#f2a199', 0.95);
  addFlowerBucket(root, -8.8, plinthTopY + 1.6, frontZ + 5.2, '#688482', '#f4cb58', '#ffe388', 1.0);
  addFlowerBucket(root, 0.2, plinthTopY, frontZ + 4.8, '#c26a48', '#fbf2dc', '#eb939b', 0.86);
  addFlowerBucket(root, 8.2, plinthTopY + 1.6, frontZ + 4.4, '#688482', '#ef9ca4', '#f7bdc3', 0.98);
  addFlowerBucket(root, 13.2, plinthTopY + 3.2, frontZ + 1.0, '#688482', '#9b8cd4', '#b7aaf0', 0.95);

  // 2 hanging flower baskets under the front eaves
  const cordMat = getSharedStandardMaterial('#59402b', 0.8, 0.05);
  for (const [hx, petalHex] of [
    [-14.6, '#f09ba3'],
    [14.6, '#f4cc5b'],
  ] as const) {
    const basket = new THREE.Group();
    basket.position.set(hx, plinthTopY + wallH + 0.2, frontZ + 1.9);
    const hanger = new THREE.Mesh(getSharedCylinder(0.14, 0.14, 2.2, 6), cordMat);
    hanger.position.y = -1.1;
    basket.add(hanger);
    addFlowerBucket(basket, 0, -4.2, 0, '#c26a48', petalHex, '#fbf2dc', 0.58);
    root.add(basket);
  }

  let roofBaseY = plinthTopY + wallH;
  if (extraTiles > 0) {
    const tier = createClerestoryTier(extraTiles, wallW, wallD, '#ebd8b0', '#846038', roofBaseY);
    root.add(tier.group);
    roofBaseY += tier.height;
  }

  // Golden straw/thatch ridged roof
  const roof = createHippedRoofAssembly(38.0, 30.2, 8.2, '#d8b263', '#7c5b37', '#bc9242');
  roof.position.set(0, roofBaseY, wallCenterZ);
  root.add(roof);

  return roofBaseY + 9.8;
}

function buildTailorShop(
  root: THREE.Group,
  plinthTopY: number,
  extraTiles: number,
  animRefs: OccupantAnimRefs,
): number {
  const wallW = 32.5;
  const wallD = 25.5;
  const totalWallH = 26.8; // Taller 2-story heritage shophouse
  const wallCenterZ = -3.5;

  const ochreWallMat = getSharedStandardMaterial('#dfc48b', 0.68, 0.04);
  const pilasterMat = getSharedStandardMaterial('#c4a165', 0.66, 0.04);
  const tealTrimMat = getSharedStandardMaterial('#256266', 0.52, 0.08);
  const darkWindowMat = getSharedStandardMaterial('#1b3f42', 0.45, 0.12);
  const goldMullionMat = getSharedStandardMaterial('#e5bd6b', 0.45, 0.2);
  const ironRailMat = getSharedStandardMaterial('#235458', 0.48, 0.35);

  const body = new THREE.Mesh(getSharedBox(wallW, totalWallH, wallD), ochreWallMat);
  body.position.set(0, plinthTopY + totalWallH / 2, wallCenterZ);
  root.add(body);

  for (const sx of [-1, 1]) {
    const pilaster = new THREE.Mesh(getSharedBox(1.9, totalWallH, wallD + 0.5), pilasterMat);
    pilaster.position.set(sx * (wallW / 2 - 0.7), plinthTopY + totalWallH / 2, wallCenterZ);
    root.add(pilaster);
  }

  const frontZ = wallCenterZ + wallD / 2;

  // Ground-floor arched display window on left + paneled tailor door on right
  const archFrame = new THREE.Mesh(getSharedBox(10.6, 8.6, 0.9), tealTrimMat);
  archFrame.position.set(-6.8, plinthTopY + 5.1, frontZ + 0.18);
  const archCrown = new THREE.Mesh(getSharedCylinder(5.3, 5.3, 0.9, 14), tealTrimMat);
  archCrown.rotation.x = Math.PI / 2;
  archCrown.position.set(-6.8, plinthTopY + 9.2, frontZ + 0.18);
  root.add(archFrame, archCrown);

  const glassPane = new THREE.Mesh(getSharedBox(8.8, 7.2, 0.96), darkWindowMat);
  glassPane.position.set(-6.8, plinthTopY + 5.1, frontZ + 0.22);
  root.add(glassPane);

  const doorFrame = new THREE.Mesh(getSharedBox(9.8, 10.2, 0.9), tealTrimMat);
  doorFrame.position.set(6.4, plinthTopY + 5.1, frontZ + 0.18);
  root.add(doorFrame);

  // Horizontal heritage teal TAILOR signboard + vertical blade accent sign
  const mainSign = createSignboardMesh(
    SHOP_ENGLISH_SIGNS[4],
    26.8,
    4.9,
    '#2a7073',
    '#faf0d7',
    '#173c3f',
    '#e4be73',
  );
  mainSign.position.set(0, plinthTopY + 13.4, frontZ + 0.45);
  root.add(mainSign);

  // Upper floor balcony slab + wrought-iron balustrade railing + twin arched windows
  const balconyY = plinthTopY + 16.6;
  const balconySlab = new THREE.Mesh(getSharedBox(29.6, 1.0, 4.4), pilasterMat);
  balconySlab.position.set(0, balconyY, frontZ + 1.8);
  root.add(balconySlab);

  const topRail = new THREE.Mesh(getSharedBox(29.2, 0.55, 0.55), ironRailMat);
  topRail.position.set(0, balconyY + 3.1, frontZ + 3.6);
  root.add(topRail);

  for (let bx = -13.5; bx <= 13.5; bx += 2.7) {
    const baluster = new THREE.Mesh(getSharedBox(0.38, 2.8, 0.38), ironRailMat);
    baluster.position.set(bx, balconyY + 1.65, frontZ + 3.6);
    root.add(baluster);
  }

  for (const wx of [-7.4, 7.4]) {
    const uFrame = new THREE.Mesh(getSharedBox(8.4, 7.4, 0.9), tealTrimMat);
    uFrame.position.set(wx, balconyY + 4.5, frontZ + 0.18);
    const uArch = new THREE.Mesh(getSharedCylinder(4.2, 4.2, 0.9, 12), tealTrimMat);
    uArch.rotation.x = Math.PI / 2;
    uArch.position.set(wx, balconyY + 8.0, frontZ + 0.18);
    const uGlass = new THREE.Mesh(getSharedBox(6.8, 6.0, 0.98), darkWindowMat);
    uGlass.position.set(wx, balconyY + 4.5, frontZ + 0.22);
    const mullionV = new THREE.Mesh(getSharedBox(0.45, 6.2, 1.05), goldMullionMat);
    mullionV.position.set(wx, balconyY + 4.5, frontZ + 0.25);
    root.add(uFrame, uArch, uGlass, mullionV);
  }

  // Hanging red silk lantern on upper-left eave
  const lantern = createHangingLantern(-15.2, plinthTopY + 18.8, frontZ + 2.2);
  root.add(lantern);
  animRefs.hangingLanterns.push(lantern);

  // Dressmaker mannequin on front-left sidewalk
  const mannequin = new THREE.Group();
  mannequin.position.set(-14.4, plinthTopY, 8.8);
  const standWood = getSharedStandardMaterial('#6a452d', 0.65, 0.05);
  const linenMat = getSharedStandardMaterial('#f6ecd4', 0.6, 0.02);
  const ribbonMat = getSharedStandardMaterial('#c94d42', 0.45, 0.05);

  const standBase = new THREE.Mesh(getSharedCylinder(2.1, 2.3, 0.45, 10), standWood);
  standBase.position.y = 0.22;
  const standPole = new THREE.Mesh(getSharedCylinder(0.28, 0.32, 5.2, 8), standWood);
  standPole.position.y = 2.8;
  const skirtForm = new THREE.Mesh(getSharedCylinder(1.35, 1.95, 2.8, 12), linenMat);
  skirtForm.position.y = 5.6;
  const waistRibbon = new THREE.Mesh(getSharedCylinder(1.38, 1.38, 0.45, 12), ribbonMat);
  waistRibbon.position.y = 7.05;
  const bustForm = new THREE.Mesh(getSharedCylinder(1.85, 1.32, 3.0, 12), linenMat);
  bustForm.position.y = 8.6;
  const neckFinial = new THREE.Mesh(getSharedCylinder(0.55, 0.6, 1.1, 8), standWood);
  neckFinial.position.y = 10.5;
  mannequin.add(standBase, standPole, skirtForm, waistRibbon, bustForm, neckFinial);
  root.add(mannequin);

  // Colorful upright bolts of silk fabric (cobalt, crimson, gold, jade) standing outside
  const boltSpecs: Array<[number, number, string, number]> = [
    [1.6, 12.6, '#4a82b5', 7.2],
    [4.2, 13.0, '#c9493e', 6.4],
    [6.7, 12.1, '#eab949', 7.6],
    [9.1, 10.6, '#3ca27c', 6.8],
  ];
  const coreMat = getSharedStandardMaterial('#fbf3dd', 0.6, 0.02);
  for (const [bx, bz, hex, bh] of boltSpecs) {
    const bolt = new THREE.Mesh(
      getSharedCylinder(1.05, 1.05, bh, 12),
      getSharedStandardMaterial(hex, 0.36, 0.08),
    );
    bolt.position.set(bx, plinthTopY + bh / 2, bz);
    const core = new THREE.Mesh(getSharedCylinder(0.55, 0.55, bh + 0.4, 10), coreMat);
    core.position.set(bx, plinthTopY + bh / 2, bz);
    root.add(bolt, core);
  }

  // Tailored coral-rose silk tunic displayed on a brass rack on the right (kept back of z = +10)
  const garmentGroup = new THREE.Group();
  garmentGroup.position.set(14.5, plinthTopY, 5.4);
  const silkMat = getSharedStandardMaterial('#df837d', 0.42, 0.06);
  const rackPost = new THREE.Mesh(getSharedCylinder(0.26, 0.3, 12.2, 8), goldMullionMat);
  rackPost.position.y = 6.1;
  const hangerBar = new THREE.Mesh(getSharedBox(5.2, 0.35, 0.35), goldMullionMat);
  hangerBar.position.y = 11.8;
  const tunicBody = new THREE.Mesh(getSharedBox(3.6, 9.2, 1.2), silkMat);
  tunicBody.position.y = 6.6;
  const sleeveL = new THREE.Mesh(getSharedBox(1.4, 4.4, 1.0), silkMat);
  sleeveL.position.set(-2.2, 8.8, 0);
  sleeveL.rotation.z = 0.32;
  const sleeveR = new THREE.Mesh(getSharedBox(1.4, 4.4, 1.0), silkMat);
  sleeveR.position.set(2.2, 8.8, 0);
  sleeveR.rotation.z = -0.32;
  garmentGroup.add(rackPost, hangerBar, tunicBody, sleeveL, sleeveR);
  root.add(garmentGroup);

  let roofBaseY = plinthTopY + totalWallH;
  if (extraTiles > 0) {
    const tier = createClerestoryTier(extraTiles, wallW, wallD, '#dfc48b', '#7b5b36', roofBaseY);
    root.add(tier.group);
    roofBaseY += tier.height;
  }

  const roof = createHippedRoofAssembly(37.6, 30.2, 8.2, '#d8af5e', '#745332', '#b88b3a');
  roof.position.set(0, roofBaseY, wallCenterZ);
  root.add(roof);

  return roofBaseY + 9.8;
}

function addWovenMarketBasket(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  goodsHex: string,
  radius = 2.6,
): void {
  const basketGroup = new THREE.Group();
  basketGroup.position.set(x, y, z);

  const bambooMat = getSharedStandardMaterial('#d8b170', 0.72, 0.03);
  const rimMat = getSharedStandardMaterial('#9e723d', 0.7, 0.04);
  const goodsMat = getSharedStandardMaterial(goodsHex, 0.52, 0.03);

  const basket = new THREE.Mesh(
    getSharedCylinder(radius, radius * 0.78, 3.2, 12),
    bambooMat,
  );
  basket.position.y = 1.6;
  basketGroup.add(basket);

  const rim = new THREE.Mesh(
    getSharedCylinder(radius + 0.2, radius + 0.12, 0.45, 12),
    rimMat,
  );
  rim.position.y = 3.2;
  basketGroup.add(rim);

  const mound = new THREE.Mesh(getSharedSphere(radius * 0.88, 12, 8), goodsMat);
  mound.scale.set(1, 0.68, 1);
  mound.position.y = 3.45;
  basketGroup.add(mound);

  parent.add(basketGroup);
}

function buildGroceryShop(
  root: THREE.Group,
  plinthTopY: number,
  extraTiles: number,
): number {
  const wallW = 35.0;
  const wallD = 26.5;
  const wallH = 18.2;
  const wallCenterZ = -3.6;

  const wallMat = getSharedStandardMaterial('#ead7b0', 0.7, 0.03);
  const tealWoodMat = getSharedStandardMaterial('#23595d', 0.55, 0.06);
  const storeNookMat = getSharedStandardMaterial('#1d3b3e', 0.82, 0.03);
  const shelfWoodMat = getSharedStandardMaterial('#9b6b42', 0.65, 0.04);

  const body = new THREE.Mesh(getSharedBox(wallW, wallH, wallD), wallMat);
  body.position.set(0, plinthTopY + wallH / 2, wallCenterZ);
  root.add(body);

  const frontZ = wallCenterZ + wallD / 2;

  // Open-front general store shelf bay on left + dark-teal shop door on right
  const shelfBay = new THREE.Mesh(getSharedBox(15.6, 8.2, 1.2), storeNookMat);
  shelfBay.position.set(-5.8, plinthTopY + 5.8, frontZ + 0.05);
  root.add(shelfBay);

  const door = new THREE.Mesh(getSharedBox(8.2, 9.6, 0.9), tealWoodMat);
  door.position.set(8.4, plinthTopY + 4.8, frontZ + 0.18);
  root.add(door);

  // Stocked wooden shelves packed with colorful grocery tins and dry-goods boxes
  const goodsColors = ['#d25244', '#ebb94d', '#4986b8', '#f5ecd4', '#589e63'];
  for (const sy of [4.2, 7.0]) {
    const shelf = new THREE.Mesh(getSharedBox(14.6, 0.45, 1.5), shelfWoodMat);
    shelf.position.set(-5.8, plinthTopY + sy, frontZ + 0.65);
    root.add(shelf);

    for (let g = 0; g < goodsColors.length; g++) {
      const itemHex = goodsColors[(g + (sy > 5 ? 2 : 0)) % goodsColors.length]!;
      const box = new THREE.Mesh(
        getSharedBox(1.85, 1.85, 1.1),
        getSharedStandardMaterial(itemHex, 0.48, 0.05),
      );
      box.position.set(-11.2 + g * 2.7, plinthTopY + sy + 1.15, frontZ + 0.72);
      root.add(box);
    }
  }

  // Striped teal-and-sage canvas awning across the storefront
  const awning = createStripedAwning(35.8, 6.4, 9, '#2b7073', '#8abaa9', false);
  awning.position.set(0, plinthTopY + 12.2, frontZ + 0.1);
  root.add(awning);

  // Golden-amber signboard reading GROCERY above the awning
  const sign = createSignboardMesh(
    SHOP_ENGLISH_SIGNS[5],
    22.8,
    5.0,
    '#ecc06b',
    '#2c231a',
    '#234447',
    '#fff0c7',
  );
  sign.position.set(0, plinthTopY + 15.1, frontZ + 0.45);
  root.add(sign);

  // 3 woven bamboo baskets heaped with white rice, oranges, and fresh greens on the front step
  addWovenMarketBasket(root, -11.4, plinthTopY, frontZ + 4.6, '#fbf7ec', 2.75); // White rice
  addWovenMarketBasket(root, -4.4, plinthTopY, frontZ + 5.8, '#ef9339', 2.55); // Bright oranges
  addWovenMarketBasket(root, 2.8, plinthTopY, frontZ + 4.8, '#5ea054', 2.65); // Fresh greens

  // Classic red beverage crate on the right (kept cleanly behind the front-right number notch)
  const crateGroup = new THREE.Group();
  crateGroup.position.set(13.8, plinthTopY, 6.2);
  const redCrateMat = getSharedStandardMaterial('#c8463a', 0.46, 0.06);
  const bottleCapMat = getSharedStandardMaterial('#f4cf63', 0.35, 0.45);

  const crate = new THREE.Mesh(getSharedBox(5.8, 4.2, 4.8), redCrateMat);
  crate.position.y = 2.1;
  crateGroup.add(crate);

  for (const bx of [-1.6, 0, 1.6]) {
    for (const bz of [-1.1, 1.1]) {
      const bottle = new THREE.Mesh(getSharedCylinder(0.46, 0.48, 1.6, 8), bottleCapMat);
      bottle.position.set(bx, 4.5, bz);
      crateGroup.add(bottle);
    }
  }
  root.add(crateGroup);

  let roofBaseY = plinthTopY + wallH;
  if (extraTiles > 0) {
    const tier = createClerestoryTier(extraTiles, wallW, wallD, '#ead7b0', '#77432c', roofBaseY);
    root.add(tier.group);
    roofBaseY += tier.height;
  }

  // Wide warm terracotta hipped roof
  const roof = createHippedRoofAssembly(39.2, 31.4, 8.6, '#b96945', '#6f3c26', '#9a4f30');
  roof.position.set(0, roofBaseY, wallCenterZ);
  root.add(roof);

  return roofBaseY + 10.2;
}

function createWingCompletionFinial3D(
  roofTopY: number,
): { finialGroup: THREE.Group; glowMat: THREE.MeshStandardMaterial } {
  const finialGroup = new THREE.Group();
  finialGroup.name = 'wing-prosperity-finial';
  const baseY = roofTopY + 1.8;
  finialGroup.position.set(0, baseY, -3.4);
  finialGroup.userData = { completeCrown: true, baseY };

  const goldMat = getSharedStandardMaterial('#f2be42', 0.25, 0.62);
  const glowMat = new THREE.MeshStandardMaterial({
    color: '#ffe89c',
    emissive: new THREE.Color('#f0a928'),
    emissiveIntensity: 0.48,
    roughness: 0.25,
    metalness: 0.15,
  });

  const plinth = new THREE.Mesh(getSharedCylinder(1.6, 2.0, 1.2, 10), goldMat);
  plinth.position.y = 0.6;
  const globe = new THREE.Mesh(getSharedSphere(1.55, 10, 8), glowMat);
  globe.position.y = 2.25;
  const spire = new THREE.Mesh(getSharedCylinder(0.18, 0.95, 2.1, 8), goldMat);
  spire.position.y = 4.2;
  finialGroup.add(plinth, globe, spire);

  return { finialGroup, glowMat };
}

function addConnectedClusterBridges3D(
  shopGroup: THREE.Group,
  safeOwner: number,
  connectedMask: ClusterConnectionMask,
  animRefs: OccupantAnimRefs,
): void {
  if (
    !connectedMask.north &&
    !connectedMask.south &&
    !connectedMask.east &&
    !connectedMask.west
  ) {
    return;
  }

  const ownerHex = PLAYER_STOOL_COLORS[safeOwner] ?? PLAYER_STOOL_COLORS[0]!;
  const deckMat = getSharedStandardMaterial('#dfd0ab', 0.72, 0.03);
  const curbTrimMat = getSharedStandardMaterial(ownerHex, 0.48, 0.06);
  const cedarMat = getSharedStandardMaterial('#6f472b', 0.66, 0.05);
  const wireMat = getSharedStandardMaterial('#2c241d', 0.75, 0.15);
  const brassCapMat = getSharedStandardMaterial('#e8bd55', 0.32, 0.5);
  const tableMat = getSharedStandardMaterial('#845739', 0.62, 0.05);

  const festoonBulbMat = new THREE.MeshStandardMaterial({
    color: '#fff1bd',
    emissive: new THREE.Color('#ffba42'),
    emissiveIntensity: 0.42,
    roughness: 0.24,
    metalness: 0.06,
  });
  animRefs.festoonBulbMats.push(festoonBulbMat);

  // Bridge geometry spans r = 21.3..26.05 so adjacent plot bridges meet flush at +/-26.0
  // Offsets (-2.2 on Z, -3.0 on X) keep South-East [1..72] stone number badges 100% unobstructed.
  const bridgeSpecs: Array<{
    dir: keyof ClusterConnectionMask;
    active: boolean;
    alongX: boolean;
    sign: 1 | -1;
    lateralOffset: number;
    placeSeamTable: boolean;
  }> = [
    {
      dir: 'east',
      active: connectedMask.east,
      alongX: true,
      sign: 1,
      lateralOffset: -2.2,
      placeSeamTable: true,
    },
    {
      dir: 'west',
      active: connectedMask.west,
      alongX: true,
      sign: -1,
      lateralOffset: -2.2,
      placeSeamTable: false,
    },
    {
      dir: 'south',
      active: connectedMask.south,
      alongX: false,
      sign: 1,
      lateralOffset: -3.0,
      placeSeamTable: true,
    },
    {
      dir: 'north',
      active: connectedMask.north,
      alongX: false,
      sign: -1,
      lateralOffset: -3.0,
      placeSeamTable: false,
    },
  ];

  const bridgeLen = 4.85; // from r = 21.25 to r = 26.10
  const bridgeCenterR = 23.68;
  const bridgeWidth = 21.6;
  const plinthTopY = 1.24;

  for (const spec of bridgeSpecs) {
    if (!spec.active) continue;

    const bridge = new THREE.Group();
    bridge.name = `cluster-bridge-${spec.dir}`;

    if (spec.alongX) {
      // Extending East (+X) or West (-X)
      const cx = spec.sign * bridgeCenterR;
      const cz = spec.lateralOffset;

      const deck = new THREE.Mesh(getSharedBox(bridgeLen, 1.06, bridgeWidth), deckMat);
      deck.position.set(cx, 0.65, cz);
      bridge.add(deck);

      for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(getSharedBox(bridgeLen, 0.28, 1.05), curbTrimMat);
        edge.position.set(cx, plinthTopY + 0.08, cz + side * (bridgeWidth / 2 - 0.45));
        bridge.add(edge);

        const post = new THREE.Mesh(getSharedBox(1.15, 10.2, 1.15), cedarMat);
        post.position.set(spec.sign * 22.1, plinthTopY + 5.1, cz + side * 8.4);
        bridge.add(post);

        const rafter = new THREE.Mesh(getSharedBox(4.3, 0.65, 0.85), cedarMat);
        rafter.position.set(spec.sign * 23.95, plinthTopY + 10.35, cz + side * 8.4);
        bridge.add(rafter);
      }

      const portalBeam = new THREE.Mesh(getSharedBox(0.95, 0.9, 18.8), cedarMat);
      portalBeam.position.set(spec.sign * 22.1, plinthTopY + 10.25, cz);
      bridge.add(portalBeam);

      // Overhead catenary festoon wire & warm glowing lantern globes
      const wire = new THREE.Mesh(getSharedBox(4.2, 0.18, 0.18), wireMat);
      wire.position.set(spec.sign * 24.0, plinthTopY + 9.75, cz);
      bridge.add(wire);

      for (const lz of [-4.6, 4.6]) {
        const cap = new THREE.Mesh(getSharedCylinder(0.48, 0.55, 0.35, 8), brassCapMat);
        cap.position.set(spec.sign * 24.4, plinthTopY + 9.5, cz + lz);
        const bulb = new THREE.Mesh(getSharedSphere(0.92, 10, 8), festoonBulbMat);
        bulb.position.set(spec.sign * 24.4, plinthTopY + 8.65, cz + lz);
        bridge.add(cap, bulb);
      }

      if (spec.placeSeamTable) {
        const seamX = spec.sign * 25.95;
        const ped = new THREE.Mesh(getSharedCylinder(0.55, 0.75, 4.4, 10), tableMat);
        ped.position.set(seamX, plinthTopY + 2.2, cz);
        const top = new THREE.Mesh(getSharedCylinder(3.6, 3.3, 0.6, 14), tableMat);
        top.position.set(seamX, plinthTopY + 4.5, cz);
        bridge.add(ped, top);
        bridge.add(createMiniStreetStool(seamX, plinthTopY, cz - 5.2, ownerHex, 0.25));
        bridge.add(createMiniStreetStool(seamX, plinthTopY, cz + 5.2, ownerHex, 0.25));
      }
    } else {
      // Extending South (+Z) or North (-Z)
      const cx = spec.lateralOffset;
      const cz = spec.sign * bridgeCenterR;

      const deck = new THREE.Mesh(getSharedBox(bridgeWidth, 1.06, bridgeLen), deckMat);
      deck.position.set(cx, 0.65, cz);
      bridge.add(deck);

      for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(getSharedBox(1.05, 0.28, bridgeLen), curbTrimMat);
        edge.position.set(cx + side * (bridgeWidth / 2 - 0.45), plinthTopY + 0.08, cz);
        bridge.add(edge);

        const post = new THREE.Mesh(getSharedBox(1.15, 10.2, 1.15), cedarMat);
        post.position.set(cx + side * 8.4, plinthTopY + 5.1, spec.sign * 22.1);
        bridge.add(post);

        const rafter = new THREE.Mesh(getSharedBox(0.85, 0.65, 4.3), cedarMat);
        rafter.position.set(cx + side * 8.4, plinthTopY + 10.35, spec.sign * 23.95);
        bridge.add(rafter);
      }

      const portalBeam = new THREE.Mesh(getSharedBox(18.8, 0.9, 0.95), cedarMat);
      portalBeam.position.set(cx, plinthTopY + 10.25, spec.sign * 22.1);
      bridge.add(portalBeam);

      const wire = new THREE.Mesh(getSharedBox(0.18, 0.18, 4.2), wireMat);
      wire.position.set(cx, plinthTopY + 9.75, spec.sign * 24.0);
      bridge.add(wire);

      for (const lx of [-4.6, 4.6]) {
        const cap = new THREE.Mesh(getSharedCylinder(0.48, 0.55, 0.35, 8), brassCapMat);
        cap.position.set(cx + lx, plinthTopY + 9.5, spec.sign * 24.4);
        const bulb = new THREE.Mesh(getSharedSphere(0.92, 10, 8), festoonBulbMat);
        bulb.position.set(cx + lx, plinthTopY + 8.65, spec.sign * 24.4);
        bridge.add(cap, bulb);
      }

      if (spec.placeSeamTable) {
        const seamZ = spec.sign * 25.95;
        const ped = new THREE.Mesh(getSharedCylinder(0.55, 0.75, 4.4, 10), tableMat);
        ped.position.set(cx, plinthTopY + 2.2, seamZ);
        const top = new THREE.Mesh(getSharedCylinder(3.6, 3.3, 0.6, 14), tableMat);
        top.position.set(cx, plinthTopY + 4.5, seamZ);
        bridge.add(ped, top);
        bridge.add(createMiniStreetStool(cx - 5.2, plinthTopY, seamZ, ownerHex, 0.25));
        bridge.add(createMiniStreetStool(cx + 5.2, plinthTopY, seamZ, ownerHex, 0.25));
      }
    }

    shopGroup.add(bridge);
  }
}

function applyOccupantAtmosphereGlow(
  animRefs: OccupantAnimRefs | undefined,
  atmosphere: CityAtmosphereMode,
): void {
  if (!animRefs) return;
  const winGlow = atmosphere === 'night' ? 1.85 : atmosphere === 'sunset' ? 0.88 : 0.16;
  const bulbGlow = atmosphere === 'night' ? 2.35 : atmosphere === 'sunset' ? 1.25 : 0.38;

  for (const mat of animRefs.windowGlowMats) {
    mat.emissiveIntensity = winGlow;
  }
  for (const mat of animRefs.festoonBulbMats) {
    mat.emissiveIntensity = bulbGlow;
  }
}

export function createEnglishShop3D(
  shopIndex: number,
  ownerIndex: number,
  clusterSize: number,
  isComplete: boolean,
  streetYaw = 0,
  connectedMask: ClusterConnectionMask = EMPTY_CLUSTER_CONNECTIONS,
  isClusterFlagship = true,
): THREE.Group {
  const safeShop = ((shopIndex % SHOPS.length) + SHOPS.length) % SHOPS.length;
  const safeOwner =
    ((ownerIndex % PLAYER_STOOL_COLORS.length) + PLAYER_STOOL_COLORS.length) %
    PLAYER_STOOL_COLORS.length;
  const clampedCluster = Math.max(1, Math.min(6, Math.floor(clusterSize || 1)));
  const extraTiles = clampedCluster - 1;
  // Flagship lot rises to full cluster stories while connected wing lots step gracefully
  const effectiveExtraTiles = isClusterFlagship ? extraTiles : Math.min(1, extraTiles);
  const targetSize = SHOPS[safeShop]?.size ?? 3;
  const completeFlag = isComplete || clusterSize >= targetSize;

  const group = new THREE.Group();
  group.name = `english-shop-${safeShop}-owner-${safeOwner}`;

  const windowGlowMat = new THREE.MeshStandardMaterial({
    color: '#ffe39e',
    emissive: new THREE.Color('#ffbe55'),
    emissiveIntensity: 0.16,
    roughness: 0.28,
    metalness: 0.08,
  });

  const animRefs: OccupantAnimRefs = {
    steamPuffs: [],
    completeCrowns: [],
    crownGlowMats: [],
    hangingLanterns: [],
    festoonBulbMats: [],
    windowGlowMats: [windowGlowMat],
  };
  group.userData.animRefs = animRefs;

  // Unrotated warm sandstone shop patio base (45.6 x 45.6) kept as group.children[0] so SE plot number stays clear
  const plinthMat = getSharedStandardMaterial('#dbc9a0', 0.74, 0.03);
  const plinth = new THREE.Mesh(getSharedShopPlinthGeometry(), plinthMat);
  plinth.position.y = 0.12;
  plinth.receiveShadow = true;
  group.add(plinth);

  const plinthTopY = 1.24;

  // Street-oriented shophouse volume rotating toward the nearest real street
  const buildingGroup = new THREE.Group();
  buildingGroup.name = 'street-facing-building';
  buildingGroup.rotation.y = streetYaw;
  group.add(buildingGroup);

  // Connected courtyard bridges, timber pergolas, festoon lanterns, and shared seam bistro tables
  addConnectedClusterBridges3D(group, safeOwner, connectedMask, animRefs);

  // Owner-colored sidewalk mat + owner-colored plastic stool kept clear of South-East number badge
  addOwnerCornerMarker(buildingGroup, safeOwner, plinthTopY, streetYaw);

  let roofPeakY = 29;
  switch (safeShop) {
    case 0:
      roofPeakY = buildCoffeeShop(buildingGroup, plinthTopY, effectiveExtraTiles, animRefs);
      break;
    case 1:
      roofPeakY = buildBakeryShop(buildingGroup, plinthTopY, effectiveExtraTiles);
      break;
    case 2:
      roofPeakY = buildNoodlesShop(buildingGroup, plinthTopY, effectiveExtraTiles, animRefs);
      break;
    case 3:
      roofPeakY = buildFlowersShop(buildingGroup, plinthTopY, effectiveExtraTiles);
      break;
    case 4:
      roofPeakY = buildTailorShop(buildingGroup, plinthTopY, effectiveExtraTiles, animRefs);
      break;
    case 5:
    default:
      roofPeakY = buildGroceryShop(buildingGroup, plinthTopY, effectiveExtraTiles);
      break;
  }

  // Shuttered rear courtyard windows + side gable transoms + secondary English shop nameplate
  addRearShophouseFacade(buildingGroup, safeShop, plinthTopY, windowGlowMat);

  // Golden $wif Prosperity Rooftop Arch on Flagship lot, matching golden lantern finial on wing lots
  if (completeFlag) {
    if (isClusterFlagship) {
      const { crownGroup, glowMat } = createCompleteCrown3D(roofPeakY);
      buildingGroup.add(crownGroup);
      animRefs.completeCrowns.push(crownGroup);
      animRefs.crownGlowMats.push(glowMat);
    } else {
      const { finialGroup, glowMat } = createWingCompletionFinial3D(roofPeakY);
      buildingGroup.add(finialGroup);
      animRefs.completeCrowns.push(finialGroup);
      animRefs.crownGlowMats.push(glowMat);
    }
  }

  // Enable clean shadow casting/receiving on shophouse meshes
  group.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return group;
}

export function createPlotSlot3D(lotId: number, districtIndex: number): PlotSlot3D {
  const plot = PLOT_LAYOUT[lotId] ?? {
    id: lotId,
    block: districtIndex,
    col: 0,
    row: 0,
    x: 0,
    y: 0,
  };
  const displayNumber = lotId + 1;

  const root = new THREE.Group();
  root.name = `plot-slot-${lotId}`;
  const [wx, wy, wz] = boardRectToWorld(plot.x, plot.y, CELL_SIZE_2D, CELL_SIZE_2D, 0.9);
  root.position.set(wx, wy, wz);

  const initialTopTex = getCachedPlotTopTexture(displayNumber, districtIndex, 'vacant');
  const topMat = new THREE.MeshStandardMaterial({
    color: initialTopTex ? '#ffffff' : '#ded6b8',
    map: initialTopTex,
    roughness: 0.78,
    metalness: 0.04,
  });
  const sideMat = new THREE.MeshStandardMaterial({
    color: '#c9c0a2',
    roughness: 0.82,
    metalness: 0.03,
  });

  const tileGeo = getSharedBox(PLOT_TILE_SIZE, PLOT_TILE_HEIGHT, PLOT_TILE_SIZE);
  const tileMesh = new THREE.Mesh(tileGeo, [
    sideMat,
    sideMat,
    topMat,
    sideMat,
    sideMat,
    sideMat,
  ]);
  tileMesh.name = `plot-tile-${lotId}`;
  tileMesh.position.y = PLOT_TILE_HEIGHT / 2;
  tileMesh.receiveShadow = true;
  tileMesh.userData = { lotId };
  root.add(tileMesh);

  let frameGeo = sharedGeometryCache.get('plot-frame-edges');
  if (!frameGeo) {
    frameGeo = markShared(
      new THREE.EdgesGeometry(
        new THREE.BoxGeometry(PLOT_TILE_SIZE + 0.24, PLOT_TILE_HEIGHT + 0.06, PLOT_TILE_SIZE + 0.24),
      ),
    );
    sharedGeometryCache.set('plot-frame-edges', frameGeo);
  }

  const frameMat = new THREE.LineBasicMaterial({
    color: '#9d9478',
    transparent: true,
    opacity: 0.78,
  });
  const frameMesh = new THREE.LineSegments(frameGeo, frameMat);
  frameMesh.name = `plot-frame-${lotId}`;
  frameMesh.position.y = PLOT_TILE_HEIGHT / 2 + 0.02;
  root.add(frameMesh);

  // Elevated selection / offer / build highlight ring at y = 2.4
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#f7e6b2',
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ringMesh = new THREE.Mesh(getSharedSquareRingGeometry(24.8, 22.1), ringMat);
  ringMesh.name = `plot-ring-${lotId}`;
  ringMesh.position.y = 2.4;
  ringMesh.visible = false;

  // Inner white-gold double ring child for chosen / drop-target emphasis
  const innerRingMat = new THREE.MeshBasicMaterial({
    color: '#fff9df',
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const innerRingMesh = new THREE.Mesh(getSharedSquareRingGeometry(21.4, 20.1), innerRingMat);
  innerRingMesh.position.y = 0.04;
  innerRingMesh.visible = false;
  ringMesh.add(innerRingMesh);
  root.add(ringMesh);

  // Raised perimeter curb trim tinted in PLAYER_STOOL_COLORS when owned
  const curbMat = new THREE.MeshStandardMaterial({
    color: PLAYER_STOOL_COLORS[0],
    roughness: 0.48,
    metalness: 0.06,
  });
  const curbGroup = createOwnerCurbGroup(curbMat);
  root.add(curbGroup);

  // Manicured garden shrubs & cedar corner boundary pegs on vacant lots
  const parcelGardenGroup = createParcelCornerGarden3D();
  root.add(parcelGardenGroup);

  // Floating 3D golden land-deed scroll badge at y = 14 for Receive phase offers
  const { group: deedBadgeGroup, frontMat: deedFrontMat } = createDeedBadgeGroup(displayNumber);
  root.add(deedBadgeGroup);

  // Occupant container sitting flush on top of the 2.2-tall limestone tile
  const occupantGroup = new THREE.Group();
  occupantGroup.name = `plot-occupant-${lotId}`;
  occupantGroup.position.y = PLOT_TILE_HEIGHT;
  root.add(occupantGroup);

  const refs: SlotPrivateRefs = {
    topMat,
    sideMat,
    frameMat,
    ringMat,
    innerRingMesh,
    innerRingMat,
    curbGroup,
    curbMat,
    parcelGardenGroup,
    deedFrontMat,
    deedBadgeNumber: displayNumber,
    chosenPreviewGroup: null,
  };
  root.userData.slotRefs = refs;

  tagLotIdRecursive(root, lotId);

  return {
    lotId,
    root,
    tileMesh,
    frameMesh,
    ringMesh,
    deedBadgeGroup,
    occupantGroup,
    occupantKey: '',
    visualKey: '',
  };
}

export function updatePlotSlot3D(slot: PlotSlot3D, state: PlotVisualState): void {
  const refs = slot.root.userData.slotRefs as SlotPrivateRefs | undefined;
  const streetYaw = Number.isFinite(state.streetYaw) ? state.streetYaw : 0;
  const connectedMask = state.connectedMask ?? EMPTY_CLUSTER_CONNECTIONS;
  const isClusterFlagship = state.isClusterFlagship ?? true;
  const atmosphere: CityAtmosphereMode = state.atmosphere ?? 'day';
  const maskKey = `${connectedMask.north ? 1 : 0}${connectedMask.south ? 1 : 0}${connectedMask.east ? 1 : 0}${connectedMask.west ? 1 : 0}:${isClusterFlagship ? 1 : 0}`;
  const nextOccupantKey = `${state.owner}:${state.shop}:${state.clusterSize}:${state.isComplete}:${streetYaw.toFixed(3)}:${maskKey}`;

  // 1. Rebuild occupantGroup ONLY when occupantKey changes
  if (slot.occupantKey !== nextOccupantKey) {
    clearGroupOwned(slot.occupantGroup);
    slot.occupantKey = nextOccupantKey;

    if (state.shop !== null) {
      const ownerIdx = state.owner ?? 0;
      const shopModel = createEnglishShop3D(
        state.shop,
        ownerIdx,
        Math.max(1, state.clusterSize),
        state.isComplete,
        streetYaw,
        connectedMask,
        isClusterFlagship,
      );
      slot.occupantGroup.add(shopModel);
      slot.occupantGroup.userData.animRefs = shopModel.userData.animRefs;
      applyOccupantAtmosphereGlow(
        shopModel.userData.animRefs as OccupantAnimRefs | undefined,
        atmosphere,
      );
    } else if (state.owner !== null) {
      const stoolModel = createPlasticStool3D(state.owner);
      stoolModel.rotation.y = streetYaw;
      slot.occupantGroup.add(stoolModel);
      slot.occupantGroup.userData.animRefs = undefined;
    } else {
      slot.occupantGroup.userData.animRefs = undefined;
    }

    tagLotIdRecursive(slot.occupantGroup, slot.lotId);
  }

  // 2. Update surface, curb, ring, chosen preview, deed badge, and atmosphere glow when visualKey changes
  const nextVisualKey = [
    state.displayNumber,
    state.districtIndex,
    state.owner ?? 'n',
    state.shop ?? 'n',
    state.isOffered ? 1 : 0,
    state.isChosen ? 1 : 0,
    state.isSelected ? 1 : 0,
    state.isHovered ? 1 : 0,
    state.isDropTarget ? 1 : 0,
    state.isBuildable ? 1 : 0,
    atmosphere,
  ].join('|');

  if (slot.visualKey === nextVisualKey || !refs) {
    return;
  }
  slot.visualKey = nextVisualKey;

  applyOccupantAtmosphereGlow(
    slot.occupantGroup.userData.animRefs as OccupantAnimRefs | undefined,
    atmosphere,
  );

  // Vacant manicured garden corners hide as soon as lot is offered, chosen, claimed, or built
  refs.parcelGardenGroup.visible =
    state.owner === null && state.shop === null && !state.isOffered && !state.isChosen;

  let surfaceVariant: PlotSurfaceVariant = 'vacant';
  let fallbackTopHex = '#ded6b8';
  let sideHex = '#c9c0a2';

  if (state.isChosen) {
    surfaceVariant = 'chosen';
    fallbackTopHex = '#b8f2d8';
    sideHex = '#39a883';
  } else if (state.isOffered) {
    surfaceVariant = 'offered';
    fallbackTopHex = '#fbe39c';
    sideHex = '#dfaa38';
  } else if (state.owner !== null) {
    const safeOwner = ((state.owner % 4) + 4) % 4;
    surfaceVariant = `owner-${safeOwner}` as PlotSurfaceVariant;
    fallbackTopHex = '#e4dcc2';
    sideHex = '#cec4a6';
  }

  const topTex = getCachedPlotTopTexture(state.displayNumber, state.districtIndex, surfaceVariant);
  if (refs.topMat.map !== topTex) {
    refs.topMat.map = topTex;
    refs.topMat.needsUpdate = true;
  }
  refs.topMat.color.set(topTex ? '#ffffff' : fallbackTopHex);

  if (state.isOffered && !state.isChosen) {
    refs.topMat.emissive.set('#e3a82b');
    refs.topMat.emissiveIntensity = 0.26;
  } else if (state.isChosen) {
    refs.topMat.emissive.set('#39a883');
    refs.topMat.emissiveIntensity = 0.22;
  } else if (state.isDropTarget || (state.isBuildable && state.isHovered)) {
    refs.topMat.emissive.set('#44d492');
    refs.topMat.emissiveIntensity = 0.2;
  } else {
    refs.topMat.emissive.set('#000000');
    refs.topMat.emissiveIntensity = 0;
  }

  refs.sideMat.color.set(sideHex);

  // Curb trim for owned plots
  if (state.owner !== null) {
    const ownerHex =
      PLAYER_STOOL_COLORS[((state.owner % PLAYER_STOOL_COLORS.length) + PLAYER_STOOL_COLORS.length) % PLAYER_STOOL_COLORS.length] ??
      PLAYER_STOOL_COLORS[0];
    refs.curbMat.color.set(ownerHex);
    refs.curbGroup.visible = true;
  } else {
    refs.curbGroup.visible = false;
  }

  // Frame outline & elevated highlight ring states
  const activeBuildHover = state.isDropTarget || (state.isBuildable && state.isHovered);
  if (state.isChosen) {
    refs.frameMat.color.set('#39a883');
    refs.frameMat.opacity = 1;
    slot.ringMesh.visible = true;
    slot.ringMesh.scale.setScalar(1.02);
    refs.ringMat.color.set('#39a883');
    refs.ringMat.opacity = 0.96;
    refs.innerRingMesh.visible = true;
    refs.innerRingMat.color.set('#fff6d6');
  } else if (activeBuildHover) {
    refs.frameMat.color.set('#44d492');
    refs.frameMat.opacity = 1;
    slot.ringMesh.visible = true;
    slot.ringMesh.scale.setScalar(1.04);
    refs.ringMat.color.set('#44d492');
    refs.ringMat.opacity = 0.98;
    refs.innerRingMesh.visible = true;
    refs.innerRingMat.color.set('#ffe79a');
  } else if (state.isOffered) {
    refs.frameMat.color.set('#e3a82b');
    refs.frameMat.opacity = 1;
    slot.ringMesh.visible = true;
    slot.ringMesh.scale.setScalar(1.01);
    refs.ringMat.color.set('#f5be3b');
    refs.ringMat.opacity = 0.94;
    refs.innerRingMesh.visible = state.isSelected || state.isHovered;
    refs.innerRingMat.color.set('#fff8dc');
  } else if (state.isSelected || state.isHovered) {
    refs.frameMat.color.set('#f7e6b2');
    refs.frameMat.opacity = 1;
    slot.ringMesh.visible = true;
    slot.ringMesh.scale.setScalar(state.isSelected ? 1.02 : 1.0);
    refs.ringMat.color.set(state.isSelected ? '#f6d97a' : '#fbf1d2');
    refs.ringMat.opacity = state.isSelected ? 0.95 : 0.82;
    refs.innerRingMesh.visible = state.isSelected;
    refs.innerRingMat.color.set('#ffffff');
  } else if (state.isBuildable) {
    refs.frameMat.color.set('#44d492');
    refs.frameMat.opacity = 0.92;
    slot.ringMesh.visible = true;
    slot.ringMesh.scale.setScalar(1.0);
    refs.ringMat.color.set('#44d492');
    refs.ringMat.opacity = 0.62;
    refs.innerRingMesh.visible = false;
  } else if (state.owner !== null) {
    const ownerHex =
      PLAYER_STOOL_COLORS[((state.owner % PLAYER_STOOL_COLORS.length) + PLAYER_STOOL_COLORS.length) % PLAYER_STOOL_COLORS.length] ??
      PLAYER_STOOL_COLORS[0];
    refs.frameMat.color.set(ownerHex);
    refs.frameMat.opacity = 0.92;
    slot.ringMesh.visible = false;
    slot.ringMesh.scale.setScalar(1.0);
    refs.innerRingMesh.visible = false;
  } else {
    refs.frameMat.color.set('#9d9478');
    refs.frameMat.opacity = 0.76;
    slot.ringMesh.visible = false;
    slot.ringMesh.scale.setScalar(1.0);
    refs.innerRingMesh.visible = false;
  }

  // Floating golden land-deed scroll badge on unpicked Receive offers (hides cleanly once chosen)
  const showDeedBadge = state.isOffered && !state.isChosen;
  slot.deedBadgeGroup.visible = showDeedBadge;
  if (showDeedBadge && refs.deedBadgeNumber !== state.displayNumber) {
    const updatedTex = getCachedDeedTexture(state.displayNumber);
    refs.deedFrontMat.map = updatedTex;
    refs.deedFrontMat.color.set(updatedTex ? '#ffffff' : '#ffe8a3');
    refs.deedFrontMat.needsUpdate = true;
    refs.deedBadgeNumber = state.displayNumber;
  }

  // Crisp preview of Player 0's green plastic stool when chosen in Receive phase
  const showChosenStool = state.isChosen && state.owner === null && state.shop === null;
  if (showChosenStool) {
    if (!refs.chosenPreviewGroup) {
      const preview = buildMoldedStoolCore(PLAYER_STOOL_COLORS[0], 0.92, false);
      preview.name = 'chosen-stool-preview';
      preview.position.y = PLOT_TILE_HEIGHT;
      tagLotIdRecursive(preview, slot.lotId);
      slot.root.add(preview);
      refs.chosenPreviewGroup = preview;
    }
    refs.chosenPreviewGroup.rotation.y = streetYaw;
    refs.chosenPreviewGroup.visible = true;
  } else if (refs.chosenPreviewGroup) {
    refs.chosenPreviewGroup.visible = false;
  }
}

export function animatePlotSlot3D(
  slot: PlotSlot3D,
  state: PlotVisualState,
  timeSec: number,
): void {
  const refs = slot.root.userData.slotRefs as SlotPrivateRefs | undefined;
  const phaseOffset = slot.lotId * 0.47;

  // 1. Floating golden land-deed scroll bob & emissive pulse on offered plots
  if (state.isOffered && slot.deedBadgeGroup.visible) {
    slot.deedBadgeGroup.position.y =
      DEED_BADGE_BASE_Y + Math.sin(timeSec * 3.1 + phaseOffset) * 1.45;
    slot.deedBadgeGroup.rotation.y = Math.sin(timeSec * 1.55 + phaseOffset) * 0.22;
    if (refs && !state.isChosen) {
      refs.topMat.emissiveIntensity =
        0.2 + 0.16 * (0.5 + 0.5 * Math.sin(timeSec * 3.6 + phaseOffset));
    }
  }

  // 2. Chosen preview stool gentle hover & buildable / drop-target ring pulse
  if (refs) {
    if (refs.chosenPreviewGroup?.visible) {
      refs.chosenPreviewGroup.position.y =
        PLOT_TILE_HEIGHT + 0.35 + Math.sin(timeSec * 2.8 + phaseOffset) * 0.35;
    }

    const activeBuildHover = state.isDropTarget || (state.isBuildable && state.isHovered);
    if (activeBuildHover && slot.ringMesh.visible) {
      slot.ringMesh.scale.setScalar(1.04 + Math.sin(timeSec * 5.2) * 0.016);
    } else if (state.isBuildable && !state.isHovered && !state.isSelected && slot.ringMesh.visible) {
      refs.ringMat.opacity = 0.46 + 0.28 * (0.5 + 0.5 * Math.sin(timeSec * 2.7 + phaseOffset));
    }
  }

  // 3. Occupant animations: rising Noodles steam puffs, hanging lanterns, and $wif complete crown
  const animRefs = slot.occupantGroup.userData.animRefs as OccupantAnimRefs | undefined;
  if (!animRefs) {
    return;
  }

  for (const puff of animRefs.steamPuffs) {
    const idx = Number(puff.userData.steamIndex ?? 0);
    const baseX = Number(puff.userData.baseX ?? puff.position.x);
    const baseY = Number(puff.userData.baseY ?? puff.position.y);
    const baseZ = Number(puff.userData.baseZ ?? puff.position.z);
    const cycle = (timeSec * 0.52 + idx / 3 + (slot.lotId % 7) * 0.13) % 1;

    puff.position.y = baseY + cycle * 7.6;
    puff.position.x = baseX + Math.sin(timeSec * 2.1 + idx * 2.0) * (0.35 + cycle * 1.15);
    puff.position.z = baseZ + Math.cos(timeSec * 1.7 + idx * 1.6) * (0.2 + cycle * 0.65);

    const scale = 0.62 + cycle * 0.88;
    puff.scale.setScalar(scale);

    const mat = puff.material as THREE.MeshStandardMaterial;
    mat.opacity = Math.sin(cycle * Math.PI) * 0.68;
  }

  for (const crown of animRefs.completeCrowns) {
    const baseY = Number(crown.userData.baseY ?? crown.position.y);
    crown.position.y = baseY + Math.sin(timeSec * 2.4 + phaseOffset) * 0.72;
    crown.rotation.y = Math.sin(timeSec * 1.25 + phaseOffset) * 0.14;
  }

  for (const glowMat of animRefs.crownGlowMats) {
    glowMat.emissiveIntensity =
      0.34 + 0.26 * (0.5 + 0.5 * Math.sin(timeSec * 3.3 + phaseOffset));
  }

  for (let i = 0; i < animRefs.hangingLanterns.length; i++) {
    const lantern = animRefs.hangingLanterns[i]!;
    lantern.rotation.z = Math.sin(timeSec * 1.9 + phaseOffset + i) * 0.06;
  }
}

export function disposePlotSlot3D(slot: PlotSlot3D): void {
  clearGroupOwned(slot.occupantGroup);
  disposeOwnedSubtree(slot.root);
  while (slot.root.children.length > 0) {
    const child = slot.root.children[slot.root.children.length - 1];
    if (!child) {
      break;
    }
    slot.root.remove(child);
  }
  slot.root.parent?.remove(slot.root);
  slot.occupantKey = '';
  slot.visualKey = '';
}
