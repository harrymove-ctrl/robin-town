/**
 * src/ui/board-3d.ts
 *
 * Three.js 3D board scene, spatial coordinate mapping, district slabs,
 * procedural shop buildings, pixel art texturing, golden completion auras,
 * dual-camera controller (isometric orthographic and perspective orbit),
 * tile raycasting with drag filtering, and headless Node.js safety.
 */

import * as THREE from 'three';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CELL_SIZE,
  DISTRICT_BLOCKS,
  type DistrictConfig,
  LOT_DEFINITIONS,
  TOTAL_LOTS,
  findAllClusters,
  type ShopCluster,
} from '../engine/board-layout';
import { plotNeighbors } from '../engine/board-layout';
import type { GameState } from '../engine/types';
import {
  addStorefrontDetail,
  buildBaseSlab,
  buildDistrictCurb,
  buildDistrictPlinth,
  createContactShadow,
  isContactShadow,
} from './diorama-detail';
import { PALETTE_SIZE } from './diorama-palette';
import { PixelPost } from './diorama-post';
import { createLabelTexture } from './diorama-label';

// Board spatial constants
export const BOARD_ORIGIN_X = 550;
export const BOARD_ORIGIN_Z = 365;

// Vertical elevation coordinates (Y-axis)
export const ELEVATION_GROUND = 0.0;
export const ELEVATION_FOUNDATION = 0.75;
export const ELEVATION_DISTRICT = 2.5;
export const ELEVATION_PARCEL_BASE = 4.5;
export const ELEVATION_PARCEL_HOVER = 5.5;
export const ELEVATION_PARCEL_SELECTED = 6.5;
export const ELEVATION_BUILDING_BASE = 5.5;
export const ELEVATION_GOLDEN_LIGHT = 18.0;
export const ELEVATION_GOLDEN_CROWN = 22.0;

// Player palette
export const PLAYER_HEX_COLORS: readonly string[] = Object.freeze([
  '#00C805', // Player 0: Robin Emerald
  '#EEC353', // Player 1: Bullion Gold
  '#29B6F6', // Player 2: Ocean Cyan
  '#FF7043', // Player 3: Sunset Coral
]);

/** Valid build target: palette violet, distinct from every PLAYER_HEX_COLORS entry. */
export const BUILDABLE_HIGHLIGHT_HEX = 0xa855f7;

/** Vertical field of view of the perspective (orbit) camera, per the diorama spec. */
export const PERSPECTIVE_FOV = 20.5;
const PERSPECTIVE_ELEVATION = (35 * Math.PI) / 180;

/** The orthographic camera sits at a fixed distance; only its zoom changes. */
const ORTHO_DISTANCE = 600;
const PAN_LIMIT_X = 600;
const PAN_LIMIT_Z = 420;
const ORTHO_ZOOM_MIN = 0.6;
const ORTHO_ZOOM_MAX = 4;

// Tween timings, all measured on the deterministic animation clock (ms).
const BUILD_RISE_MS = 420;
const SINK_MS = 320;

// Ambient life
const MOTE_COUNT = 90;
const MOTE_CEILING = 160;
const WALK_HALF_W = 126;
const WALK_HALF_D = 132;
const WALK_LOOP = 2 * (2 * WALK_HALF_W + 2 * WALK_HALF_D);
const DAY_SUN_HEX = 0xfff2d6;
const DUSK_SUN = new THREE.Color(0x8fa8ff);

// Owner flag pieces are shared by all 72 parcels.
const FLAG_POLE_GEOM = new THREE.CylinderGeometry(0.6, 0.6, 18, 6);
const FLAG_CLOTH_GEOM = new THREE.BoxGeometry(9, 6, 0.8);
const FLAG_POLE_MAT = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.5, metalness: 0.4 });

/** CSS pixels per label texel; labels keep this size on screen at any zoom. */
const LABEL_CSS_PX_PER_TEXEL = 2;

/** Ease-out-back: overshoots slightly before settling at 1. */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = Math.min(Math.max(t, 0), 1);
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/**
 * Point on the street loop around a district (half-extents 126 x 132) at
 * distance `d` along its perimeter.
 */
export function perimeterPoint(d: number): [number, number] {
  const w = 2 * WALK_HALF_W;
  const h = 2 * WALK_HALF_D;
  let t = ((d % WALK_LOOP) + WALK_LOOP) % WALK_LOOP;
  if (t < w) return [-WALK_HALF_W + t, -WALK_HALF_D];
  t -= w;
  if (t < h) return [WALK_HALF_W, -WALK_HALF_D + t];
  t -= h;
  if (t < w) return [WALK_HALF_W - t, WALK_HALF_D];
  t -= w;
  return [-WALK_HALF_W, WALK_HALF_D - t];
}

/** Small deterministic PRNG so ambient layouts repeat exactly between runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shop category definitions for 3D procedural construction
export interface ShopVisualCategory {
  id: number;
  name: string;
  code: string;
  targetSize: number;
  colorHex: string;
  texturePath: string;
}

export const SHOP_VISUAL_CATEGORIES: readonly ShopVisualCategory[] = Object.freeze([
  {
    id: 0,
    name: 'DEX Swap',
    code: 'DX',
    targetSize: 3,
    colorHex: '#39A883',
    texturePath: '/assets/shops/shop_0_hd.png',
  },
  {
    id: 1,
    name: 'Memecoin Lounge',
    code: 'ML',
    targetSize: 3,
    colorHex: '#EEC353',
    texturePath: '/assets/shops/shop_1_hd.png',
  },
  {
    id: 2,
    name: 'Staking Vault',
    code: 'SV',
    targetSize: 4,
    colorHex: '#B85539',
    texturePath: '/assets/shops/shop_2_hd.png',
  },
  {
    id: 3,
    name: 'Lending Protocol',
    code: 'LP',
    targetSize: 4,
    colorHex: '#A16586',
    texturePath: '/assets/shops/shop_3_hd.png',
  },
  {
    id: 4,
    name: 'Derivatives Exchange',
    code: 'DE',
    targetSize: 5,
    colorHex: '#587C9A',
    texturePath: '/assets/shops/shop_4_hd.png',
  },
  {
    id: 5,
    name: 'Validator Citadel',
    code: 'VC',
    targetSize: 6,
    colorHex: '#648454',
    texturePath: '/assets/shops/shop_5_hd.png',
  },
]);

/**
 * Height of the orthographic view volume that fits the whole base slab, with a
 * small margin, at the locked 45 deg / 33 deg diorama angle. Wide windows are
 * limited by the slab's height on screen, narrow ones by its width.
 */
export function orthoFrustumHeight(aspect: number): number {
  const margin = 36;
  const slabWidth = BOARD_WIDTH + 2 * margin;
  const slabDepth = BOARD_HEIGHT + 2 * margin;
  const az = Math.PI / 4;
  const el = (33 * Math.PI) / 180;
  // Projected extents of the slab footprint at the given azimuth / elevation.
  const horizontal = slabWidth * Math.abs(Math.cos(az)) + slabDepth * Math.abs(Math.sin(az));
  const vertical =
    (slabWidth * Math.abs(Math.sin(az)) + slabDepth * Math.abs(Math.cos(az))) * Math.sin(el) + 60;
  const fit = 1.06;
  return Math.max(vertical * fit, (horizontal * fit) / Math.max(aspect, 0.1));
}

/**
 * Distance at which the narrow-lens perspective camera frames the same view
 * height as the orthographic diorama view. The extra factor covers the near
 * edge of the slab, which perspective draws slightly larger.
 */
export function perspectiveFitDistance(aspect: number, fovDeg = PERSPECTIVE_FOV): number {
  const halfHeight = orthoFrustumHeight(aspect) / 2;
  const halfFov = (fovDeg * Math.PI) / 360;
  return (halfHeight / Math.tan(halfFov)) * 1.12;
}

/**
 * Coordinate transform: 2D canvas coordinates to centered 3D world coordinates.
 */
export function canvasToWorld(
  cx: number,
  cy: number,
  elevation = ELEVATION_PARCEL_BASE
): [number, number, number] {
  return [cx - BOARD_ORIGIN_X, elevation, cy - BOARD_ORIGIN_Z];
}

/**
 * Coordinate transform: 3D world coordinates to 2D canvas coordinates.
 */
export function worldToCanvas(wx: number, wz: number): [number, number] {
  return [wx + BOARD_ORIGIN_X, wz + BOARD_ORIGIN_Z];
}

/**
 * Calculate the 3D center position of parcel given its 2D coordinates.
 */
export function getParcelWorldPosition(
  lotX: number,
  lotY: number,
  elevation = ELEVATION_PARCEL_BASE
): [number, number, number] {
  return canvasToWorld(lotX + CELL_SIZE / 2, lotY + CELL_SIZE / 2, elevation);
}

/**
 * Recursively traverse and dispose all child geometries, materials, and textures
 * to prevent GPU memory leaks upon mesh replacement, demolition, or scene unmount.
 */
export function disposeHierarchy(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
      if (obj.geometry) {
        geometries.add(obj.geometry);
      }
      if (Array.isArray(obj.material)) {
        for (const mat of obj.material) {
          if (mat) materials.add(mat);
        }
      } else if (obj.material) {
        materials.add(obj.material);
      }
    }
  });

  for (const mat of materials) {
    const m = mat as unknown as Record<string, unknown>;
    for (const key of Object.keys(m)) {
      if (m[key] instanceof THREE.Texture) {
        textures.add(m[key] as THREE.Texture);
      }
    }
    mat.dispose();
  }

  for (const geom of geometries) {
    geom.dispose();
  }

  for (const tex of textures) {
    tex.dispose();
  }
}


/**
 * Apply nearest-neighbor filtering and color space to preserve retro pixel crispness.
 */
export function configurePixelArtTexture(texture: THREE.Texture): THREE.Texture {
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Check if WebGL rendering is available in the current runtime environment.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

/** Roof point (x, y, z) per shop category where the blinking beacon mast stands. */
const ROOFTOP_BEACON_SPOTS: readonly [number, number, number][] = [
  [16, 18, -16], // DEX Swap: mezzanine corner
  [16, 16, -16], // Memecoin Lounge: parapet corner
  [11, 24, -11], // Staking Vault: lock cap corner
  [0, 27, 0], // Lending Protocol: pediment apex
  [7, 36, -7], // Derivatives Exchange: top tier corner
  [17, 24, -17], // Validator Citadel: turret top
];

/**
 * Procedural building factory for the 6 protocol shop categories.
 */
export function createShopBuilding(
  shopType: number,
  clusterSize = 1,
  isComplete = false
): THREE.Group {
  const group = new THREE.Group();
  group.name = `Building_Shop_${shopType}`;

  const category = SHOP_VISUAL_CATEGORIES[shopType] || SHOP_VISUAL_CATEGORIES[0];
  const color = new THREE.Color(category.colorHex);
  const darkColor = color.clone().multiplyScalar(0.45);

  const mainMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.45,
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: darkColor,
    roughness: 0.6,
    metalness: 0.2,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: isComplete ? 0xffd700 : color,
    emissive: isComplete ? 0xffd700 : color,
    emissiveIntensity: isComplete ? 0.6 : 0.25,
    roughness: 0.2,
    metalness: 0.8,
  });

  let totalHeight = 12.0;

  switch (shopType) {
    case 0: {
      // Category 0: DEX Swap (fintech kiosk, glass lobby, mezzanine, parabolic dish)
      totalHeight = 14.0;
      const lobbyGeom = new THREE.BoxGeometry(36, 12, 36);
      const lobby = new THREE.Mesh(lobbyGeom, mainMat);
      lobby.position.y = 6;
      group.add(lobby);

      const mezzGeom = new THREE.BoxGeometry(40, 6, 40);
      const mezz = new THREE.Mesh(mezzGeom, darkMat);
      mezz.position.y = 15;
      group.add(mezz);

      const pedestalGeom = new THREE.CylinderGeometry(4, 5, 3, 8);
      const pedestal = new THREE.Mesh(pedestalGeom, trimMat);
      pedestal.position.y = 19.5;
      group.add(pedestal);

      // The parabolic satellite dish itself sits on its struts in the detail pass.
      const antennaGeom = new THREE.CylinderGeometry(0.4, 0.4, 8, 4);
      const antenna = new THREE.Mesh(antennaGeom, trimMat);
      antenna.position.set(6, 22, -6);
      group.add(antenna);
      break;
    }
    case 1: {
      // Category 1: Memecoin Lounge (clubhouse, rooftop pergola, festive neon badge)
      totalHeight = 15.0;
      const clubGeom = new THREE.BoxGeometry(36, 14, 36);
      const clubhouse = new THREE.Mesh(clubGeom, mainMat);
      clubhouse.position.y = 7;
      group.add(clubhouse);

      const parapetGeom = new THREE.BoxGeometry(38, 2, 38);
      const parapet = new THREE.Mesh(parapetGeom, darkMat);
      parapet.position.y = 15;
      group.add(parapet);

      const beamGeom = new THREE.BoxGeometry(34, 1.5, 3);
      for (let i = -12; i <= 12; i += 8) {
        const beam = new THREE.Mesh(beamGeom, trimMat);
        beam.position.set(0, 17.5, i);
        group.add(beam);
      }

      const signGeom = new THREE.BoxGeometry(16, 6, 3);
      const sign = new THREE.Mesh(signGeom, trimMat);
      sign.position.set(0, 20.5, 12);
      group.add(sign);
      break;
    }
    case 2: {
      // Category 2: Staking Vault (brutalist fortress monolith, circular vault door relief, heavy lock cap)
      totalHeight = 17.0;
      const monolithGeom = new THREE.BoxGeometry(38, 18, 38);
      const monolith = new THREE.Mesh(monolithGeom, mainMat);
      monolith.position.y = 9;
      group.add(monolith);

      const doorGeom = new THREE.CylinderGeometry(7, 7, 2, 16);
      doorGeom.rotateX(Math.PI / 2);
      const door = new THREE.Mesh(doorGeom, trimMat);
      door.position.set(0, 9, 19.5);
      group.add(door);

      const capGeom = new THREE.BoxGeometry(26, 6, 26);
      const cap = new THREE.Mesh(capGeom, darkMat);
      cap.position.y = 21;
      group.add(cap);

      const lockGeom = new THREE.CylinderGeometry(4, 4, 5, 8);
      const lock1 = new THREE.Mesh(lockGeom, trimMat);
      lock1.position.set(-6, 26.5, 0);
      const lock2 = new THREE.Mesh(lockGeom, trimMat);
      lock2.position.set(6, 26.5, 0);
      group.add(lock1, lock2);
      break;
    }
    case 3: {
      // Category 3: Lending Protocol (stepped plinth, 4 fluted columns, classical pediment gable)
      totalHeight = 18.0;
      const plinthGeom = new THREE.BoxGeometry(38, 3, 38);
      const plinth = new THREE.Mesh(plinthGeom, darkMat);
      plinth.position.y = 1.5;
      group.add(plinth);

      const bodyGeom = new THREE.BoxGeometry(30, 16, 30);
      const body = new THREE.Mesh(bodyGeom, mainMat);
      body.position.y = 11;
      group.add(body);

      const colGeom = new THREE.CylinderGeometry(1.6, 1.6, 16, 8);
      const colX = [-14, -5, 5, 14];
      for (const cx of colX) {
        const col = new THREE.Mesh(colGeom, trimMat);
        col.position.set(cx, 11, 16);
        group.add(col);
      }

      const pedimentGeom = new THREE.ConeGeometry(20, 8, 4);
      pedimentGeom.rotateY(Math.PI / 4);
      const pediment = new THREE.Mesh(pedimentGeom, darkMat);
      pediment.position.set(0, 23, 0);
      group.add(pediment);
      break;
    }
    case 4: {
      // Category 4: Derivatives Exchange (3-tier skyscraper, comms mast, microwave dishes)
      totalHeight = 24.0;
      const tier1Geom = new THREE.BoxGeometry(38, 12, 38);
      const tier1 = new THREE.Mesh(tier1Geom, mainMat);
      tier1.position.y = 6;
      group.add(tier1);

      const tier2Geom = new THREE.BoxGeometry(28, 14, 28);
      const tier2 = new THREE.Mesh(tier2Geom, darkMat);
      tier2.position.y = 19;
      group.add(tier2);

      const tier3Geom = new THREE.BoxGeometry(18, 10, 18);
      const tier3 = new THREE.Mesh(tier3Geom, mainMat);
      tier3.position.y = 31;
      group.add(tier3);

      const mastGeom = new THREE.CylinderGeometry(0.6, 1.2, 14, 6);
      const mast = new THREE.Mesh(mastGeom, trimMat);
      mast.position.y = 43;
      group.add(mast);

      const dishGeom = new THREE.CylinderGeometry(3, 3, 1, 8);
      const dish = new THREE.Mesh(dishGeom, trimMat);
      dish.position.set(0, 42, 3);
      dish.rotation.x = Math.PI / 4;
      group.add(dish);
      break;
    }
    case 5: {
      // Category 5: Validator Citadel (bastion fortress, 4 corner turrets, crenellations, central spire)
      totalHeight = 26.0;
      const fortressGeom = new THREE.BoxGeometry(38, 18, 38);
      const fortress = new THREE.Mesh(fortressGeom, mainMat);
      fortress.position.y = 9;
      group.add(fortress);

      const turretGeom = new THREE.CylinderGeometry(4.5, 4.5, 24, 8);
      const turretCoords = [
        [-17, -17],
        [17, -17],
        [-17, 17],
        [17, 17],
      ];
      for (const [tx, tz] of turretCoords) {
        const turret = new THREE.Mesh(turretGeom, darkMat);
        turret.position.set(tx, 12, tz);
        group.add(turret);
      }

      const spireGeom = new THREE.CylinderGeometry(5, 7, 20, 8);
      const spire = new THREE.Mesh(spireGeom, trimMat);
      spire.position.y = 28;
      group.add(spire);

      const beaconGeom = new THREE.OctahedronGeometry(2.5);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
      const beacon = new THREE.Mesh(beaconGeom, beaconMat);
      beacon.position.y = 40;
      group.add(beacon);
      break;
    }
  }

  // Passes 2 and 3 of the Detail Bar: construction assemblies, then story details.
  addStorefrontDetail(group, shopType, { main: mainMat, dark: darkMat, trim: trimMat }, isComplete);

  // Blinking rooftop beacon on a short mast at a roof corner (blink driven by the renderer clock).
  const beaconSpot = ROOFTOP_BEACON_SPOTS[shopType] ?? ROOFTOP_BEACON_SPOTS[0];
  const beaconMast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 4), darkMat);
  beaconMast.name = 'RooftopBeaconMast';
  beaconMast.position.set(beaconSpot[0], beaconSpot[1] + 1.5, beaconSpot[2]);
  const beacon = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.4),
    new THREE.MeshBasicMaterial({ color: 0xff3b5c })
  );
  beacon.name = 'RooftopBeacon';
  beacon.position.set(beaconSpot[0], beaconSpot[1] + 4, beaconSpot[2]);
  group.add(beaconMast, beacon);

  // Contact shadow anchors the building to its parcel.
  const buildingShadow = createContactShadow(60, 0.62, 'ContactShadow');
  buildingShadow.position.set(0, -0.85, 0);
  group.add(buildingShadow);

  // Facade Decal on front surface (+Z side)
  const facadeGeom = new THREE.PlaneGeometry(24, 24);
  const facadeMat = new THREE.MeshBasicMaterial({
    color: category.colorHex,
    transparent: true,
    opacity: 0.95,
  });
  const facadeDecal = new THREE.Mesh(facadeGeom, facadeMat);
  facadeDecal.name = 'FacadeDecal';
  facadeDecal.position.set(0, 10, 19.3);
  group.add(facadeDecal);

  // Dynamic cluster height scaling
  const scaleY = 1.0 + 0.12 * Math.min(Math.max(clusterSize - 1, 0), category.targetSize);
  group.scale.set(1.0, scaleY, 1.0);

  // Golden Completion Aura Mesh
  if (isComplete) {
    const haloGeom = new THREE.TorusGeometry(22, 1.5, 8, 32);
    haloGeom.rotateX(Math.PI / 2);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.85,
    });
    const haloMesh = new THREE.Mesh(haloGeom, haloMat);
    haloMesh.name = 'GoldenAuraHalo';
    haloMesh.position.y = totalHeight * scaleY + 4.0;
    group.add(haloMesh);
  }

  return group;
}

/**
 * Board3D initialization options interface.
 */
export interface Board3DOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  onSelectLot?: (lotId: number) => void;
  onHoverLot?: (lotId: number | null) => void;
  /** Fired when a cluster becomes complete (not on the initial sync). */
  onClusterComplete?: () => void;
  /**
   * Apply the diorama post pass (64-colour palette, ordered dither, inked
   * contours). Defaults to true; `?post=off` in the page URL turns it off.
   */
  diorama?: boolean;
}

/** Serializable snapshot returned by `window.__diorama.getState()`. */
export interface DioramaState {
  frozen: boolean;
  time: number;
  cameraMode: 'isometric' | 'perspective';
  postProcessing: boolean;
  paletteSize: number;
  pixelSize: number;
  viewport: { width: number; height: number };
  target: { width: number; height: number } | null;
  parcels: number;
  buildings: number;
  completeClusters: number;
  bridges: number;
  contactShadows: number;
  selectedLot: number | null;
  hoveredLot: number | null;
  ownerFlags: number;
  labels: number;
  zoom: number;
  cameraTarget: { x: number; z: number };
}

/** Short-lived expanding ring burst (build dust, cluster-complete shockwave). */
interface RingEffect {
  mesh: THREE.Mesh;
  start: number;
  duration: number;
  maxScale: number;
}

/** Demolished building sinking before removal. */
interface SinkingBuilding {
  group: THREE.Group;
  start: number;
}

interface Walker {
  group: THREE.Group;
  district: number;
  offset: number;
  speed: number;
}

/**
 * Optional per-frame highlight overlay supplied by the app (draft candidates,
 * claimed draft picks, valid build targets).
 */
export interface Board3DOverlay {
  pendingLots?: readonly number[];
  draftLots?: readonly number[];
  validBuildLots?: readonly number[];
}

/**
 * Public Board3DRenderer interface contract as defined in SCOPE.md.
 */
export interface Board3DRenderer {
  mount(): void;
  unmount(): void;
  render(state: GameState, selectedLotId: number | null, overlay?: Board3DOverlay): void;
  focusLot(lotId: number): void;
  resetCamera(): void;
  resize(width: number, height: number): void;
}

/**
 * ThreeBoardRenderer implements 3D board rendering, interactive raycasting,
 * procedural shop extrusions, district foundations, golden auras, and dual cameras.
 */
export class ThreeBoardRenderer implements Board3DRenderer {
  private options: Board3DOptions;
  private width: number;
  private height: number;

  // Three.js Core
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer | null = null;
  private animFrameId: number | null = null;

  // Dual Cameras
  private orthoCamera: THREE.OrthographicCamera;
  private perspCamera: THREE.PerspectiveCamera;
  private activeCamera: THREE.Camera;
  private cameraMode: 'isometric' | 'perspective' = 'isometric';

  // Camera animation and target state
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private targetCameraTarget = new THREE.Vector3(0, 0, 0);
  private cameraDistance = 600;
  private targetCameraDistance = 600;
  private cameraAzimuth = Math.PI / 4; // 45 deg
  private cameraElevation = (33 * Math.PI) / 180; // 33 deg
  private isTransitioning = false;
  private transitionStartTime = 0;
  private transitionDuration = 750; // ms

  // Scene Hierarchy Groups
  private boardGroup: THREE.Group;
  private districtGroup: THREE.Group;
  private parcelGroup: THREE.Group;
  private buildingGroup: THREE.Group;
  private goldenAuraGroup: THREE.Group;
  private lightingGroup: THREE.Group;
  private baseGroup: THREE.Group;
  private shadowGroup: THREE.Group;
  private clusterGroup: THREE.Group;
  private lotShadows: THREE.Mesh[] = [];

  // Diorama post pass and deterministic QA clock
  private post: PixelPost | null = null;
  private useDiorama: boolean;
  private frozenTime: number | null = null;
  private lastTime = 0;
  private completeClusterCount = 0;
  private bridgeCount = 0;

  // Parcel and Raycast Target Registry
  private parcelHitMeshes: THREE.Mesh[] = [];
  private parcelMaterials: THREE.MeshStandardMaterial[] = [];
  private buildingMeshes = new Map<number, THREE.Group>();

  // Tweened parcel heights, pulsing highlights, flags and labels
  private lotCurrentY: number[] = [];
  private lotTargetY: number[] = [];
  private lotPulseBase: number[] = [];
  private lotPulseAmp: number[] = [];
  private ownerFlags: THREE.Group[] = [];
  private ownerFlagCloths: THREE.Mesh[] = [];
  private labelScene = new THREE.Scene();
  private labelSprites = new Map<number, THREE.Sprite>();
  private effects: RingEffect[] = [];
  private sinking: SinkingBuilding[] = [];
  private completeSignature: string | null = null;
  private clusterSignature: string | null = null;
  private goldenRebuilds = 0;
  private highlightLotId: number | null = null;
  private lastRender: { state: GameState; selected: number | null; overlay: Board3DOverlay } | null =
    null;

  // Ambient backdrop and life
  private ambientGroup: THREE.Group;
  private motes: THREE.Points | null = null;
  private moteSeeds: { x: number; y: number; z: number; speed: number }[] = [];
  private walkers: Walker[] = [];
  private sunLight: THREE.DirectionalLight | null = null;
  private ambientLight: THREE.AmbientLight | null = null;
  private districtLights: THREE.PointLight[] = [];
  private targetDusk = 0;
  private dusk = 0;

  // Interactive Selection and Hover State
  private selectedLotId: number | null = null;
  private hoveredLotId: number | null = null;
  private raycaster = new THREE.Raycaster();

  // Pointer event tracking for drag versus click differentiation
  private pointerDownPos = { x: 0, y: 0, time: 0 };
  private isPointerDown = false;
  private isDragging = false;
  private isPanning = false;
  private readonly DRAG_THRESHOLD_PX = 5;
  private readonly CLICK_TIME_LIMIT_MS = 600;

  // DOM Event listener references for clean disposal
  private onPointerDownBound: (e: PointerEvent) => void;
  private onPointerMoveBound: (e: PointerEvent) => void;
  private onPointerUpBound: (e: PointerEvent) => void;
  private onWheelBound: (e: WheelEvent) => void;
  private onContextMenuBound: (e: Event) => void;
  private onResizeBound: () => void;

  constructor(options: Board3DOptions) {
    this.options = options;
    this.width = options.width || BOARD_WIDTH;
    this.height = options.height || BOARD_HEIGHT;

    // Initialize core Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = null; // Transparent to allow exposure-grid shader beneath

    // Build hierarchy groups
    this.boardGroup = new THREE.Group();
    this.boardGroup.name = 'BoardGroup';
    this.districtGroup = new THREE.Group();
    this.districtGroup.name = 'DistrictsGroup';
    this.parcelGroup = new THREE.Group();
    this.parcelGroup.name = 'ParcelsGroup';
    this.buildingGroup = new THREE.Group();
    this.buildingGroup.name = 'BuildingsGroup';
    this.goldenAuraGroup = new THREE.Group();
    this.goldenAuraGroup.name = 'GoldenAuraGroup';
    this.lightingGroup = new THREE.Group();
    this.lightingGroup.name = 'LightingGroup';
    this.baseGroup = new THREE.Group();
    this.baseGroup.name = 'BaseGroup';
    this.shadowGroup = new THREE.Group();
    this.shadowGroup.name = 'ShadowGroup';
    this.clusterGroup = new THREE.Group();
    this.clusterGroup.name = 'ClusterGroup';
    this.useDiorama = options.diorama !== false;

    this.boardGroup.add(
      this.baseGroup,
      this.districtGroup,
      this.shadowGroup,
      this.parcelGroup,
      this.clusterGroup,
      this.buildingGroup,
      this.goldenAuraGroup
    );
    this.ambientGroup = new THREE.Group();
    this.ambientGroup.name = 'AmbientGroup';
    this.scene.add(this.boardGroup, this.lightingGroup, this.ambientGroup);

    // Initialize dual cameras
    const aspect = this.width / this.height;
    const frustumSize = orthoFrustumHeight(aspect);
    this.orthoCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      2000
    );

    // Narrow lens, pulled back far enough to frame the whole slab.
    this.perspCamera = new THREE.PerspectiveCamera(PERSPECTIVE_FOV, aspect, 20, 9000);
    this.activeCamera = this.orthoCamera;
    this.updateCameraPositions();

    // Setup scene lighting
    this.setupLighting();

    // Setup 6 district slabs
    this.setupDistrictSlabs();

    // Single cut-out base slab, district curbs and the harbor channel
    this.setupBaseSlab();

    // Setup 72 parcel meshes
    this.setupParcelMeshes();
    this.setupLotShadows();
    this.applyShadowFlags(this.baseGroup, false, true);
    this.applyShadowFlags(this.districtGroup, false, true);

    // Ground glow, drifting motes and street walkers around the slab
    this.setupAmbient();

    // Bind event handlers
    this.onPointerDownBound = this.handlePointerDown.bind(this);
    this.onPointerMoveBound = this.handlePointerMove.bind(this);
    this.onPointerUpBound = this.handlePointerUp.bind(this);
    this.onWheelBound = this.handleWheel.bind(this);
    this.onContextMenuBound = (e: Event) => e.preventDefault();
    this.onResizeBound = () => {
      if (this.options.container) {
        const rect = this.options.container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          this.resize(rect.width, rect.height);
        }
      }
    };
  }

  /**
   * Set up ambient, directional, and localized district point lights.
   */
  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0x1e293b, 0.7);
    ambientLight.name = 'AmbientLight';

    const sunLight = new THREE.DirectionalLight(0xfff2d6, 1.2);
    sunLight.name = 'SunLight';
    sunLight.position.set(300, 600, 400);
    // Real cast shadows from the sun; the soft contact shadows stay as anchors.
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -700;
    sunLight.shadow.camera.right = 700;
    sunLight.shadow.camera.top = 560;
    sunLight.shadow.camera.bottom = -560;
    sunLight.shadow.camera.near = 100;
    sunLight.shadow.camera.far = 1600;
    sunLight.shadow.bias = -0.0006;
    sunLight.shadow.normalBias = 0.6;

    const fillLight = new THREE.DirectionalLight(0x7aa2f7, 0.5);
    fillLight.name = 'FillLight';
    fillLight.position.set(-300, 300, -200);

    this.sunLight = sunLight;
    this.ambientLight = ambientLight;
    this.lightingGroup.add(ambientLight, sunLight, fillLight);

    // Add subtle colored point lights above each of the 6 districts
    for (const district of DISTRICT_BLOCKS) {
      const slabCenter = this.getDistrictCenter3D(district);
      const districtLight = new THREE.PointLight(district.accentHex, 0.55, 180);
      districtLight.name = `DistrictLight_${district.id}`;
      districtLight.position.set(slabCenter[0], 35.0, slabCenter[2]);
      this.districtLights.push(districtLight);
      this.lightingGroup.add(districtLight);
    }
  }

  /** Set cast / receive shadow flags on every solid mesh under `root`. */
  private applyShadowFlags(root: THREE.Object3D, cast: boolean, receive: boolean): void {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || isContactShadow(mesh)) return;
      const mat = mesh.material as THREE.Material;
      if (mat && mat.transparent) return;
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
    });
  }

  /**
   * Backdrop around the slab: stepped ground glow (flat palette rings, so the
   * pixel pass bands it cleanly), drifting light motes, and
   * tiny pedestrians strolling the street loop around each district. Everything
   * is seeded, and animated as a pure function of the clock.
   */
  private setupAmbient(): void {
    const groundY = ELEVATION_DISTRICT - 15.5;
    // One soft step only: every extra ring edge adds staircase speckle under the dither.
    const rings: [number, number][] = [[900, 0x111827]];
    rings.forEach(([radius, hex], i) => {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 48),
        new THREE.MeshBasicMaterial({ color: hex, depthWrite: false })
      );
      disc.rotation.x = -Math.PI / 2;
      disc.scale.set(1, 0.72, 1); // elliptical, follows the wide board
      disc.position.y = groundY + i * 0.15;
      disc.renderOrder = -10 + i;
      disc.name = `GroundGlow_${i}`;
      this.ambientGroup.add(disc);
    });

    // No table grid: at the 45 deg diorama azimuth its 1-px diagonal lines
    // break into single-pixel islands under the pixel pass (flat-area contract).

    // Motes rise and wrap, like pixels of data drifting off the city.
    const rand = mulberry32(0x5eed);
    this.moteSeeds = [];
    const positions = new Float32Array(MOTE_COUNT * 3);
    for (let i = 0; i < MOTE_COUNT; i++) {
      const seed = {
        x: (rand() - 0.5) * 1200,
        y: rand() * MOTE_CEILING,
        z: (rand() - 0.5) * 820,
        speed: 6 + rand() * 8,
      };
      this.moteSeeds.push(seed);
      positions[i * 3] = seed.x;
      positions[i * 3 + 1] = seed.y;
      positions[i * 3 + 2] = seed.z;
    }
    const moteGeom = new THREE.BufferGeometry();
    moteGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.motes = new THREE.Points(
      moteGeom,
      new THREE.PointsMaterial({
        color: 0x7ad2f9,
        size: 2,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      })
    );
    this.motes.name = 'DriftMotes';
    this.ambientGroup.add(this.motes);

    // Pedestrians: chunky enough to survive the pixel pass as 2x3 sprites.
    const bodyGeom = new THREE.BoxGeometry(3.2, 5, 3.2);
    const headGeom = new THREE.BoxGeometry(2.6, 2.6, 2.6);
    const coats = [0xf3f4f6, 0xeec353, 0x29b6f6, 0xff7043, 0x00c805, 0xab47bc];
    const skin = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8 });
    const streetY = ELEVATION_DISTRICT - 0.4;
    for (const district of DISTRICT_BLOCKS) {
      for (let n = 0; n < 3; n++) {
        const walker = new THREE.Group();
        walker.name = `Walker_${district.id}_${n}`;
        const body = new THREE.Mesh(
          bodyGeom,
          new THREE.MeshStandardMaterial({ color: coats[(district.id + n) % coats.length], roughness: 0.7 })
        );
        body.position.y = 2.5;
        body.castShadow = true;
        const head = new THREE.Mesh(headGeom, skin);
        head.position.y = 6.3;
        walker.add(body, head);
        walker.position.y = streetY;
        this.ambientGroup.add(walker);
        this.walkers.push({
          group: walker,
          district: district.id,
          offset: (n / 3) * WALK_LOOP + district.id * 40,
          speed: (n % 2 === 0 ? 1 : -1) * (10 + n * 3),
        });
      }
    }
    this.updateAmbientLife(0, 0);
  }

  /** Motes, walkers and rooftop beacons at clock time `timeSec` (seconds). */
  private updateAmbientLife(timeSec: number, _dt: number): void {
    if (this.motes) {
      const attr = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < this.moteSeeds.length; i++) {
        const s = this.moteSeeds[i];
        const y = (s.y + s.speed * timeSec) % MOTE_CEILING;
        attr.setXYZ(i, s.x + Math.sin(timeSec * 0.5 + i) * 6, y, s.z);
      }
      attr.needsUpdate = true;
    }

    const streetY = ELEVATION_DISTRICT - 0.4;
    for (const w of this.walkers) {
      const d = w.offset + w.speed * timeSec;
      const center = this.getDistrictCenter3D(DISTRICT_BLOCKS[w.district]);
      const [px, pz] = perimeterPoint(d);
      const [ax, az] = perimeterPoint(d + Math.sign(w.speed));
      w.group.position.set(center[0] + px, streetY + Math.abs(Math.sin(timeSec * 8 + w.offset)) * 0.6, center[2] + pz);
      w.group.rotation.y = Math.atan2(ax - px, az - pz);
    }

    for (const [lotId, building] of this.buildingMeshes) {
      const beacon = building.getObjectByName('RooftopBeacon');
      if (beacon) beacon.visible = Math.sin(timeSec * 3 + lotId * 1.7) > -0.3;
    }
  }

  /**
   * Compute 3D world center coordinates for a district block.
   */
  public getDistrictCenter3D(district: DistrictConfig): [number, number, number] {
    return canvasToWorld(district.x + 103, district.y + 103, ELEVATION_DISTRICT);
  }

  /**
   * Create the 6 extruded district foundation slabs with neon accent outlines.
   */
  private setupDistrictSlabs(): void {
    const slabWidth = 224;
    const slabDepth = 236;
    const slabThickness = 2.0;

    for (const district of DISTRICT_BLOCKS) {
      const center = this.getDistrictCenter3D(district);
      const districtGroup = new THREE.Group();
      districtGroup.name = `DistrictSlabGroup_${district.id}`;

      // Base slab box geometry
      const slabGeom = new THREE.BoxGeometry(slabWidth, slabThickness, slabDepth);
      const slabMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.45,
        metalness: 0.55,
      });
      const slabMesh = new THREE.Mesh(slabGeom, slabMat);
      slabMesh.position.set(center[0], center[1], center[2]);
      slabMesh.name = `DistrictSlabMesh_${district.id}`;

      // Neon accent perimeter wireframe lines
      const edgesGeom = new THREE.EdgesGeometry(slabGeom);
      const edgesMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(district.accentHex),
        linewidth: 1.5,
      });
      const neonEdges = new THREE.LineSegments(edgesGeom, edgesMat);
      neonEdges.position.copy(slabMesh.position);
      neonEdges.name = `DistrictNeonEdges_${district.id}`;

      districtGroup.add(slabMesh, neonEdges);
      this.districtGroup.add(districtGroup);
    }
  }

  /**
   * Diorama slab: one stone base under the whole city with a recessed harbor
   * channel on the east edge, plus a bevelled curb around every district.
   */
  private setupBaseSlab(): void {
    const margin = 36;
    const channelWidth = 60;
    const west = -BOARD_ORIGIN_X - margin;
    const east = BOARD_WIDTH - BOARD_ORIGIN_X + margin;
    const north = -BOARD_ORIGIN_Z - margin;
    const south = BOARD_HEIGHT - BOARD_ORIGIN_Z + margin;
    const base = buildBaseSlab({
      west,
      east,
      north,
      south,
      channelWest: east - channelWidth - 6,
      channelEast: east,
      landTop: ELEVATION_DISTRICT - 1.0,
      waterY: ELEVATION_DISTRICT - 2.4,
      bottom: ELEVATION_DISTRICT - 15,
    });
    this.baseGroup.add(base);

    // A bevelled stone plinth per district block, standing on the base slab
    // under the district slab and its parcels.
    const plinths = new THREE.Group();
    plinths.name = 'DistrictPlinths';
    for (const district of DISTRICT_BLOCKS) {
      const center = this.getDistrictCenter3D(district);
      const plinth = buildDistrictPlinth(center, 224, 236, ELEVATION_DISTRICT - 1.0 + 0.6, center[1] + 0.9);
      plinth.name = `DistrictPlinth_${district.id}`;
      plinths.add(plinth);
    }
    this.baseGroup.add(plinths);

    for (const district of DISTRICT_BLOCKS) {
      const center = this.getDistrictCenter3D(district);
      this.baseGroup.add(
        buildDistrictCurb(center, 224, 236, district.accentHex, center[1] + 1.0)
      );
    }
  }

  /**
   * One soft contact shadow per parcel so tokens, deed signs and buildings sit
   * on the slab. Lift (hover, selection) is reflected in the shadow size.
   */
  private setupLotShadows(): void {
    this.lotShadows = [];
    for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
      const def = LOT_DEFINITIONS[lotId];
      const pos = getParcelWorldPosition(def.x, def.y, ELEVATION_DISTRICT + 1.05);
      const shadow = createContactShadow(CELL_SIZE + 14, 0.5, `LotShadow_${lotId}`);
      shadow.position.set(pos[0], pos[1], pos[2]);
      this.lotShadows[lotId] = shadow;
      this.shadowGroup.add(shadow);
    }
  }

  /**
   * Create the 72 parcel meshes mapped to centered 3D coordinates.
   */
  private setupParcelMeshes(): void {
    const parcelWidth = 48;
    const parcelDepth = 48;
    const parcelHeight = 2.0;
    const sharedGeom = new THREE.BoxGeometry(parcelWidth, parcelHeight, parcelDepth);

    this.parcelHitMeshes = [];
    this.parcelMaterials = [];

    for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
      const def = LOT_DEFINITIONS[lotId];
      const pos = getParcelWorldPosition(def.x, def.y, ELEVATION_PARCEL_BASE);

      // Distinct standard material per parcel allowing individual state updates
      const mat = new THREE.MeshStandardMaterial({
        color: 0x161d2b,
        roughness: 0.55,
        metalness: 0.25,
      });
      this.parcelMaterials[lotId] = mat;

      const mesh = new THREE.Mesh(sharedGeom, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.lotCurrentY[lotId] = ELEVATION_PARCEL_BASE;
      this.lotTargetY[lotId] = ELEVATION_PARCEL_BASE;
      this.lotPulseBase[lotId] = 0;
      this.lotPulseAmp[lotId] = 0;

      // Owner flag on the parcel's west-front corner, outside the building
      // footprint, so ownership stays readable once a shop covers the lot.
      const flag = new THREE.Group();
      flag.name = `OwnerFlag_${lotId}`;
      const pole = new THREE.Mesh(FLAG_POLE_GEOM, FLAG_POLE_MAT);
      pole.position.y = 9;
      pole.castShadow = true;
      const cloth = new THREE.Mesh(FLAG_CLOTH_GEOM, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      cloth.name = 'OwnerFlagCloth';
      cloth.position.set(4.8, 15, 0);
      cloth.castShadow = true;
      flag.add(pole, cloth);
      flag.position.set(-21.5, parcelHeight / 2, 21.5);
      flag.visible = false;
      mesh.add(flag);
      this.ownerFlags[lotId] = flag;
      this.ownerFlagCloths[lotId] = cloth;

      mesh.name = `ParcelMesh_${lotId}`;
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.userData = { lotId, blockId: def.block };

      this.parcelHitMeshes[lotId] = mesh;
      this.parcelGroup.add(mesh);
    }
  }

  /**
   * Calculate camera positions based on azimuth, elevation, and target.
   */
  private updateCameraPositions(): void {
    const cosElev = Math.cos(this.cameraElevation);
    const sinElev = Math.sin(this.cameraElevation);
    const sinAzim = Math.sin(this.cameraAzimuth);
    const cosAzim = Math.cos(this.cameraAzimuth);

    const dir = new THREE.Vector3(cosElev * sinAzim, sinElev, cosElev * cosAzim);

    // The ortho camera keeps a fixed distance (its framing comes from zoom);
    // the perspective camera dollies.
    this.orthoCamera.position.copy(this.cameraTarget).addScaledVector(dir, ORTHO_DISTANCE);
    this.orthoCamera.lookAt(this.cameraTarget);

    this.perspCamera.position.copy(this.cameraTarget).addScaledVector(dir, this.cameraDistance);
    this.perspCamera.lookAt(this.cameraTarget);
  }

  /** Perspective distance that frames the slab at the current aspect. */
  private perspectiveDistance(): number {
    return perspectiveFitDistance(this.width / this.height, this.perspCamera.fov);
  }

  /**
   * Mount renderer to DOM container and begin render loop (browser mode).
   */
  public mount(): void {
    if (!isWebGLAvailable()) {
      return;
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const wantPost = this.useDiorama && params.get('post') !== 'off';
      this.renderer = new THREE.WebGLRenderer({
        // The post pass renders through its own non-multisampled target; MSAA on
        // the screen buffer would only blend the label sprites' edges off-palette.
        antialias: !wantPost,
        alpha: true,
        powerPreference: 'high-performance',
      });
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      // ACES applies on the direct path; the diorama post pass applies the
      // same curve itself, because three.js skips tone mapping off-screen.
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      // ACES has a strong toe; lift exposure so the dark slab keeps its tones.
      this.renderer.toneMappingExposure = 1.6;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.setSize(this.width, this.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      if (params.get('tone') === 'off') this.renderer.toneMapping = THREE.NoToneMapping;
      const exposureParam = Number(params.get('exposure'));
      if (exposureParam > 0) this.renderer.toneMappingExposure = exposureParam;
      const exposure =
        this.renderer.toneMapping === THREE.ACESFilmicToneMapping ? this.renderer.toneMappingExposure : 0;
      if (wantPost) {
        this.post = new PixelPost(this.renderer, { pixelSize: 2, exposure });
        this.post.setSize(this.width, this.height);
      } else {
        this.useDiorama = false;
      }

      const domElement = this.renderer.domElement;
      domElement.style.display = 'block';
      domElement.style.width = '100%';
      domElement.style.height = '100%';
      domElement.style.touchAction = 'none';
      if (this.post) {
        // Nearest-neighbour upscale of the low-resolution pixel-art target.
        domElement.style.imageRendering = 'pixelated';
      }

      if (this.options.container && typeof this.options.container.appendChild === 'function') {
        this.options.container.appendChild(domElement);
      }

      // Attach interaction listeners
      domElement.addEventListener('pointerdown', this.onPointerDownBound);
      domElement.addEventListener('pointermove', this.onPointerMoveBound);
      domElement.addEventListener('pointerup', this.onPointerUpBound);
      domElement.addEventListener('wheel', this.onWheelBound, { passive: false });
      domElement.addEventListener('contextmenu', this.onContextMenuBound);
      window.addEventListener('resize', this.onResizeBound);

      // Start animation loop
      this.startAnimationLoop();
    } catch {
      this.renderer = null;
    }
  }

  /**
   * Animation render loop updating halos, lerps, and rendering scene.
   */
  private startAnimationLoop(): void {
    const animate = (timestamp: number) => {
      const time = this.frozenTime ?? timestamp;
      this.updateAnimations(time);
      this.drawFrame();
      this.animFrameId = requestAnimationFrame(animate);
    };

    this.animFrameId = requestAnimationFrame(animate);
  }

  /**
   * Update continuous animations: parcel height tweens, building rise / sink,
   * pulsing highlights, ring bursts, golden auras, ambient life, day-to-night
   * drift and camera lerps. Everything reads the animation clock `timestamp`;
   * while the clock is frozen, tweens snap to their end state so a frozen
   * frame depends only on `t`.
   */
  private updateAnimations(timestamp: number): void {
    const frozen = this.frozenTime !== null;
    const prev = this.lastTime;
    this.lastTime = timestamp;
    const dt = frozen ? 0 : Math.min(Math.max((timestamp - prev) / 1000, 0), 0.1);
    const follow = frozen ? 1 : 1 - Math.exp(-dt * 14);
    const timeSec = timestamp * 0.001;

    for (const child of this.goldenAuraGroup.children) {
      if (child.name.startsWith('GoldenCrown_')) {
        child.rotation.y = timeSec * 1.2;
        child.position.y = ELEVATION_GOLDEN_CROWN + Math.sin(timeSec * 2.5) * 1.2;
      }
    }
    for (const child of this.clusterGroup.children) {
      if (child.name.startsWith('ClusterBorder_')) {
        // Palette-aware pulse: a bob plus a flip between two palette golds, so
        // the animation survives the 64-colour snap.
        const wave = Math.sin(timeSec * 3.0);
        child.position.y = wave * 2.0;
        child.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (mesh.isMesh) {
            (mesh.material as THREE.MeshBasicMaterial).color.setHex(wave >= 0 ? 0xffd700 : 0xfff0a0);
          }
        });
      }
    }

    // Parcels ease toward their target height; buildings, shadows and labels ride along.
    for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
      const mesh = this.parcelHitMeshes[lotId];
      const target = this.lotTargetY[lotId];
      const current = this.lotCurrentY[lotId];
      this.lotCurrentY[lotId] =
        Math.abs(target - current) > 0.001 ? current + (target - current) * follow : target;
      mesh.position.y = this.lotCurrentY[lotId];
      this.updateLotShadow(lotId);

      const amp = this.lotPulseAmp[lotId];
      if (amp > 0) {
        this.parcelMaterials[lotId].emissiveIntensity =
          this.lotPulseBase[lotId] + amp * Math.sin(timeSec * 4 + lotId);
      }

      const building = this.buildingMeshes.get(lotId);
      if (building) {
        building.position.y = this.lotCurrentY[lotId] + 1.0;
        const birth = building.userData.birth as number | undefined;
        if (birth !== undefined) {
          const baseScaleY = building.userData.baseScaleY as number;
          const t = (timestamp - birth) / BUILD_RISE_MS;
          if (frozen || t >= 1 || t < 0) {
            building.scale.y = baseScaleY;
            delete building.userData.birth;
          } else {
            building.scale.y = Math.max(0.001, baseScaleY * easeOutBack(t));
          }
        }
      }
    }

    // Demolished buildings sink, then are removed.
    this.sinking = this.sinking.filter((entry) => {
      const t = (timestamp - entry.start) / SINK_MS;
      if (frozen || t >= 1 || t < 0) {
        this.buildingGroup.remove(entry.group);
        disposeHierarchy(entry.group);
        return false;
      }
      entry.group.scale.y = Math.max(0.001, (entry.group.userData.baseScaleY as number) * (1 - t * t));
      return true;
    });

    // Expanding ring bursts.
    this.effects = this.effects.filter((fx) => {
      const t = (timestamp - fx.start) / fx.duration;
      if (frozen || t >= 1 || t < 0) {
        this.boardGroup.remove(fx.mesh);
        disposeHierarchy(fx.mesh);
        return false;
      }
      const scale = 1 + (fx.maxScale - 1) * (1 - Math.pow(1 - t, 3));
      fx.mesh.scale.set(scale, 1, scale);
      (fx.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
      return true;
    });

    // Day to night drift across the six epochs.
    this.dusk = frozen ? this.targetDusk : this.dusk + (this.targetDusk - this.dusk) * (1 - Math.exp(-dt * 1.5));
    this.applyDusk();

    this.updateAmbientLife(timeSec, dt);

    if (frozen) {
      // Frozen frames snap the camera instead of easing, so repeats are identical.
      this.isTransitioning = false;
      this.cameraTarget.copy(this.targetCameraTarget);
      this.cameraDistance = this.targetCameraDistance;
      this.activeCamera = this.cameraMode === 'isometric' ? this.orthoCamera : this.perspCamera;
      this.updateCameraPositions();
      this.updateLabelTransforms();
      return;
    }

    // Camera mode transition lerp
    if (this.isTransitioning) {
      const elapsed = performance.now() - this.transitionStartTime;
      const progress = Math.min(elapsed / this.transitionDuration, 1.0);

      // Smooth cubic easing
      const eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.cameraTarget.lerpVectors(this.cameraTarget, this.targetCameraTarget, eased * 0.1);
      this.cameraDistance += (this.targetCameraDistance - this.cameraDistance) * 0.1;

      if (progress >= 0.5 && this.activeCamera !== (this.cameraMode === 'isometric' ? this.orthoCamera : this.perspCamera)) {
        this.activeCamera =
          this.cameraMode === 'isometric' ? this.orthoCamera : this.perspCamera;
      }

      if (progress >= 1.0) {
        this.isTransitioning = false;
        this.cameraTarget.copy(this.targetCameraTarget);
        this.cameraDistance = this.targetCameraDistance;
      }
    } else {
      // Smooth camera target tracking
      this.cameraTarget.lerp(this.targetCameraTarget, 0.08);
      this.cameraDistance += (this.targetCameraDistance - this.cameraDistance) * 0.08;
    }

    this.updateCameraPositions();
    this.updateLabelTransforms();
  }

  /** Sun, ambient and district lights for the current dusk amount (0 day .. 1 night). */
  private applyDusk(): void {
    if (this.sunLight && this.ambientLight) {
      this.sunLight.intensity = 1.2 - 0.45 * this.dusk;
      this.sunLight.color.setHex(DAY_SUN_HEX).lerp(DUSK_SUN, this.dusk);
      this.ambientLight.intensity = 0.7 - 0.12 * this.dusk;
    }
    for (const light of this.districtLights) {
      light.intensity = 0.55 + 0.45 * this.dusk;
    }
  }

  /** Contact shadow under a parcel grows and softens as the parcel lifts. */
  private updateLotShadow(lotId: number): void {
    const shadow = this.lotShadows[lotId];
    if (!shadow) return;
    const lift = Math.max(0, this.lotCurrentY[lotId] - ELEVATION_PARCEL_BASE);
    shadow.scale.setScalar(1 + lift * 0.12);
    (shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.28, 0.5 - lift * 0.08);
  }

  /**
   * Spawn a flat expanding ring on the parcels at a world position. Skipped
   * when the clock is not running live (headless, frozen QA frames).
   */
  private spawnRing(x: number, z: number, color: number, radius: number, maxScale: number, duration: number): void {
    if (!this.isAnimating()) return;
    const geom = new THREE.RingGeometry(radius * 0.8, radius, 40);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, ELEVATION_PARCEL_BASE + 2.2, z);
    mesh.name = 'RingEffect';
    this.boardGroup.add(mesh);
    this.effects.push({ mesh, start: this.lastTime, duration, maxScale });
  }

  /** True while the live render loop runs; otherwise state changes snap instead of tweening. */
  private isAnimating(): boolean {
    return this.animFrameId !== null && this.frozenTime === null;
  }

  /** Draw the scene once, through the diorama post pass when enabled, then the labels. */
  private drawFrame(): void {
    if (!this.renderer) return;
    if (this.post) {
      this.post.render(this.scene, this.activeCamera);
    } else {
      this.renderer.render(this.scene, this.activeCamera);
    }
    if (this.labelScene.children.some((c) => c.visible)) {
      // Labels skip the palette / ink pass so their pixel font stays crisp.
      const autoClear = this.renderer.autoClear;
      this.renderer.autoClear = false;
      this.renderer.render(this.labelScene, this.activeCamera);
      this.renderer.autoClear = autoClear;
    }
  }

  /**
   * Stop the animation clock at `t` (ms) and draw that frame synchronously.
   * This is the `freeze(t)` hook the diorama QA scripts expect.
   */
  public freeze(t: number): void {
    this.frozenTime = Number.isFinite(t) ? t : 0;
    this.updateAnimations(this.frozenTime);
    this.drawFrame();
  }

  /** Resume the live clock after `freeze`. */
  public unfreeze(): void {
    this.frozenTime = null;
  }

  /**
   * Draw one frame at time `t` (ms) without changing whether the clock is
   * frozen. Used by `window.__diorama.renderAt(t)`.
   */
  public renderAt(t: number): void {
    const wasFrozen = this.frozenTime;
    this.frozenTime = Number.isFinite(t) ? t : 0;
    this.updateAnimations(this.frozenTime);
    this.drawFrame();
    this.frozenTime = wasFrozen;
  }

  /** Serializable summary of the diorama for QA scripts. */
  public getDioramaState(): DioramaState {
    return {
      frozen: this.frozenTime !== null,
      time: this.frozenTime ?? this.lastTime,
      cameraMode: this.cameraMode,
      postProcessing: this.post !== null,
      paletteSize: PALETTE_SIZE,
      pixelSize: this.post ? Math.round(this.width / this.post.size.x) : 1,
      viewport: { width: this.width, height: this.height },
      target: this.post ? { width: this.post.size.x, height: this.post.size.y } : null,
      parcels: this.parcelHitMeshes.length,
      buildings: this.buildingMeshes.size,
      completeClusters: this.completeClusterCount,
      bridges: this.bridgeCount,
      contactShadows: this.lotShadows.length + this.buildingMeshes.size,
      selectedLot: this.selectedLotId,
      hoveredLot: this.hoveredLotId,
      ownerFlags: this.ownerFlags.filter((f) => f.visible).length,
      labels: [...this.labelSprites.values()].filter((l) => l.visible).length,
      zoom: this.orthoCamera.zoom,
      cameraTarget: { x: this.targetCameraTarget.x, z: this.targetCameraTarget.z },
    };
  }

  /** Normalised device coordinates of a parcel's top-face centre (for hit-test QA). */
  public projectLotToNdc(lotId: number): { x: number; y: number } | null {
    if (!Number.isInteger(lotId) || lotId < 0 || lotId >= TOTAL_LOTS) return null;
    const mesh = this.parcelHitMeshes[lotId];
    this.activeCamera.updateMatrixWorld(true);
    this.scene.updateMatrixWorld(true);
    const point = mesh.position.clone();
    point.y += 1.0; // top face of the 2-unit parcel box
    point.project(this.activeCamera);
    return { x: point.x, y: point.y };
  }

  /**
   * Unmount renderer, cancel animations, detach DOM listeners, and dispose resources.
   */
  public unmount(): void {
    if (this.animFrameId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.renderer && this.renderer.domElement) {
      const el = this.renderer.domElement;
      el.removeEventListener('pointerdown', this.onPointerDownBound);
      el.removeEventListener('pointermove', this.onPointerMoveBound);
      el.removeEventListener('pointerup', this.onPointerUpBound);
      el.removeEventListener('wheel', this.onWheelBound);
      el.removeEventListener('contextmenu', this.onContextMenuBound);
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', this.onResizeBound);
      }

      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
      this.post?.dispose();
      this.post = null;
      this.renderer.dispose();
      this.renderer = null;
    }

    // Systematic geometry and material disposal
    disposeHierarchy(this.scene);
    for (const building of this.buildingMeshes.values()) {
      disposeHierarchy(building);
    }
    this.buildingMeshes.clear();
    for (const sprite of this.labelSprites.values()) {
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
    this.labelSprites.clear();
    this.labelScene.clear();
    this.effects = [];
    this.sinking = [];
  }

  /**
   * Synchronize 3D board scene with incoming GameState and selected lot ID.
   */
  public render(
    state: GameState,
    selectedLotId: number | null,
    overlay: Board3DOverlay = {}
  ): void {
    this.lastRender = { state, selected: selectedLotId, overlay };
    this.selectedLotId = selectedLotId;
    this.targetDusk = Math.min(Math.max(((state.year ?? 1) - 1) / 5, 0), 1);
    if (!this.isAnimating()) {
      this.dusk = this.targetDusk;
      this.applyDusk();
    }
    const pending = new Set(overlay.pendingLots ?? []);
    const drafted = new Set(overlay.draftLots ?? []);
    const buildable = new Set(overlay.validBuildLots ?? []);

    // Detect completed clusters
    const allClusters = findAllClusters(state.lots);
    const clusterMap = new Map<number, ShopCluster>();
    for (const cluster of allClusters) {
      for (const lotId of cluster.lots) {
        clusterMap.set(lotId, cluster);
      }
    }

    // Gold lights / crowns and cluster bridges are rebuilt only when their
    // inputs change, not on every hover or selection.
    this.syncGoldenAuras(allClusters);
    const clusterSignature = allClusters
      .map((c) => `${c.shopType}:${c.isComplete ? 1 : 0}:${c.lots.join('.')}`)
      .join('|');
    if (clusterSignature !== this.clusterSignature) {
      this.clusterSignature = clusterSignature;
      this.rebuildClusterVisuals(allClusters);
    }
    this.completeClusterCount = allClusters.filter((c) => c.isComplete).length;

    // Update 72 parcels and procedural buildings
    for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
      const lot = state.lots[lotId];
      const mat = this.parcelMaterials[lotId];
      const def = LOT_DEFINITIONS[lotId];
      const basePos = getParcelWorldPosition(def.x, def.y, ELEVATION_PARCEL_BASE);

      const isSelected = this.selectedLotId === lotId;
      const isHovered = this.hoveredLotId === lotId || this.highlightLotId === lotId;

      // Vertical lift is eased toward this target by the animation loop.
      this.lotTargetY[lotId] = this.getTargetElevation(lotId);
      if (!this.isAnimating()) {
        this.lotCurrentY[lotId] = this.lotTargetY[lotId];
        this.parcelHitMeshes[lotId].position.y = this.lotCurrentY[lotId];
        this.updateLotShadow(lotId);
      }
      const elevationY = this.lotCurrentY[lotId];

      // Contact shadow shows under anything standing or lifted on the slab.
      const shadow = this.lotShadows[lotId];
      if (shadow) {
        const lifted = this.lotTargetY[lotId] > ELEVATION_PARCEL_BASE;
        shadow.visible = lot.owner !== null || pending.has(lotId) || lot.shop !== null || lifted;
      }

      // Dynamic material colors; candidate and buildable lots pulse.
      let pulse = 0;
      let label = false;
      if (isSelected) {
        mat.color.setHex(0x00c805); // Robin emerald
        mat.emissive.setHex(0x00c805);
        mat.emissiveIntensity = 0.85;
        label = true;
      } else if (isHovered) {
        mat.color.setHex(0x00f0ff); // Cyber cyan
        mat.emissive.setHex(0x00f0ff);
        mat.emissiveIntensity = 0.6;
        label = true;
      } else if (drafted.has(lotId)) {
        mat.color.setHex(0x00c805); // Picked deed
        mat.emissive.setHex(0x00c805);
        mat.emissiveIntensity = 0.7;
        label = true;
      } else if (pending.has(lotId)) {
        mat.color.setHex(0xeec353); // Candidate deed
        mat.emissive.setHex(0xeec353);
        mat.emissiveIntensity = 0.55;
        pulse = 0.25;
        label = true;
      } else if (buildable.has(lotId)) {
        mat.color.setHex(BUILDABLE_HIGHLIGHT_HEX); // Valid build target
        mat.emissive.setHex(BUILDABLE_HIGHLIGHT_HEX);
        mat.emissiveIntensity = 0.6;
        pulse = 0.25;
      } else if (lot.owner !== null) {
        // Owned parcel, built or not: the rim around a shop keeps the owner colour.
        const ownerHex = PLAYER_HEX_COLORS[lot.owner] || PLAYER_HEX_COLORS[0];
        mat.color.set(ownerHex);
        mat.emissive.set(ownerHex);
        mat.emissiveIntensity = lot.shop !== null ? 0.18 : 0.3;
      } else {
        // Unowned lot
        mat.color.setHex(0x161d2b);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
      }
      this.lotPulseBase[lotId] = mat.emissiveIntensity;
      this.lotPulseAmp[lotId] = pulse;

      // Owner flag
      const flag = this.ownerFlags[lotId];
      if (lot.owner !== null) {
        (this.ownerFlagCloths[lotId].material as THREE.MeshBasicMaterial).color.set(
          PLAYER_HEX_COLORS[lot.owner] || PLAYER_HEX_COLORS[0]
        );
        flag.visible = true;
      } else {
        flag.visible = false;
      }

      this.updateLabel(lotId, label ? this.labelText(lotId, lot.shop) : null);

      // Procedural shop building synchronization
      const existingBuilding = this.buildingMeshes.get(lotId);
      if (lot.shop !== null) {
        const cluster = clusterMap.get(lotId);
        const clusterSize = cluster ? cluster.size : 1;
        const isComplete = cluster ? cluster.isComplete : false;

        // Recreate building if shop state changed or not yet created
        if (
          !existingBuilding ||
          existingBuilding.userData.shopType !== lot.shop ||
          existingBuilding.userData.clusterSize !== clusterSize ||
          existingBuilding.userData.isComplete !== isComplete
        ) {
          const isNewBuild = !existingBuilding || existingBuilding.userData.shopType !== lot.shop;
          const inheritedBirth = existingBuilding?.userData.birth as number | undefined;
          if (existingBuilding) {
            disposeHierarchy(existingBuilding);
            this.buildingGroup.remove(existingBuilding);
          }
          const newBuilding = createShopBuilding(lot.shop, clusterSize, isComplete);
          this.applyShadowFlags(newBuilding, true, true);
          newBuilding.userData = {
            shopType: lot.shop,
            clusterSize,
            isComplete,
            baseScaleY: newBuilding.scale.y,
          };
          if (isNewBuild && this.isAnimating()) {
            // Rise out of the lot with an ease-out-back, plus a dust ring.
            newBuilding.userData.birth = this.lastTime;
            newBuilding.scale.y = 0.001;
            this.spawnRing(basePos[0], basePos[2], 0xd1d5db, 18, 2.2, 520);
          } else if (inheritedBirth !== undefined && this.isAnimating()) {
            newBuilding.userData.birth = inheritedBirth;
            newBuilding.scale.y = 0.001;
          }
          newBuilding.position.set(basePos[0], elevationY + 1.0, basePos[2]);
          this.buildingMeshes.set(lotId, newBuilding);
          this.buildingGroup.add(newBuilding);
        } else {
          existingBuilding.position.set(basePos[0], elevationY + 1.0, basePos[2]);
        }
      } else if (existingBuilding) {
        this.buildingMeshes.delete(lotId);
        if (this.isAnimating()) {
          // Sink into the lot before removal.
          existingBuilding.userData.baseScaleY = existingBuilding.scale.y;
          this.sinking.push({ group: existingBuilding, start: this.lastTime });
        } else {
          disposeHierarchy(existingBuilding);
          this.buildingGroup.remove(existingBuilding);
        }
      }
    }
    this.updateLabelTransforms();
  }

  /**
   * Rebuild golden crowns / lights only when the set of complete clusters
   * changes. A newly completed cluster (after the first sync) gets a gold
   * shockwave, a camera move and the `onClusterComplete` callback.
   */
  private syncGoldenAuras(allClusters: readonly ShopCluster[]): void {
    const complete = allClusters.filter((c) => c.isComplete && c.lots.length > 0);
    const signature = complete
      .map((c) => `${c.districtId}_${c.shopType}:${c.lots.join('.')}`)
      .join('|');
    if (signature === this.completeSignature) return;

    const previous = this.completeSignature;
    this.completeSignature = signature;
    this.goldenRebuilds++;

    while (this.goldenAuraGroup.children.length > 0) {
      const child = this.goldenAuraGroup.children[0];
      this.goldenAuraGroup.remove(child);
      disposeHierarchy(child);
    }

    const prevKeys = new Set((previous ?? '').split('|').filter(Boolean));
    let newlyComplete: { x: number; z: number } | null = null;

    for (const cluster of complete) {
      // Find cluster 3D centroid
      let sumX = 0;
      let sumZ = 0;
      for (const lotId of cluster.lots) {
        const def = LOT_DEFINITIONS[lotId];
        const pos = getParcelWorldPosition(def.x, def.y);
        sumX += pos[0];
        sumZ += pos[2];
      }
      const centroidX = sumX / cluster.lots.length;
      const centroidZ = sumZ / cluster.lots.length;

      // Radiant golden point light above cluster
      const goldenLight = new THREE.PointLight(0xffd700, 1.2, 120);
      goldenLight.name = `GoldenLight_${cluster.districtId}_${cluster.shopType}`;
      goldenLight.position.set(centroidX, ELEVATION_GOLDEN_LIGHT, centroidZ);
      this.goldenAuraGroup.add(goldenLight);

      // Floating 3D golden crown / hexagon above the lowest ID lot in cluster
      const rootDef = LOT_DEFINITIONS[cluster.lots[0]];
      const rootPos = getParcelWorldPosition(rootDef.x, rootDef.y);

      const crownGeom = new THREE.OctahedronGeometry(6.0);
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.85,
      });
      const crownMesh = new THREE.Mesh(crownGeom, crownMat);
      crownMesh.name = `GoldenCrown_${cluster.districtId}_${cluster.shopType}`;
      crownMesh.position.set(rootPos[0], ELEVATION_GOLDEN_CROWN, rootPos[2]);
      crownMesh.castShadow = true;
      this.goldenAuraGroup.add(crownMesh);

      const key = `${cluster.districtId}_${cluster.shopType}:${cluster.lots.join('.')}`;
      if (previous !== null && !prevKeys.has(key)) {
        newlyComplete = { x: centroidX, z: centroidZ };
      }
    }

    if (newlyComplete) {
      this.spawnRing(newlyComplete.x, newlyComplete.z, 0xffd700, 30, 5, 900);
      this.spawnRing(newlyComplete.x, newlyComplete.z, 0xfff0a0, 20, 3.5, 650);
      if (this.isAnimating()) {
        this.targetCameraTarget.set(newlyComplete.x, 0, newlyComplete.z);
      }
      this.options.onClusterComplete?.();
    }
  }

  private getTargetElevation(lotId: number): number {
    if (this.selectedLotId === lotId) return ELEVATION_PARCEL_SELECTED;
    if (this.hoveredLotId === lotId || this.highlightLotId === lotId) return ELEVATION_PARCEL_HOVER;
    return ELEVATION_PARCEL_BASE;
  }

  private labelText(lotId: number, shop: number | null): string {
    // The 3x5 font has no room for a readable '#', so the label is the bare lot number.
    const num = `${LOT_DEFINITIONS[lotId].lotNumber ?? lotId + 1}`;
    const code = shop !== null ? (SHOP_VISUAL_CATEGORIES[shop] || SHOP_VISUAL_CATEGORIES[0]).code : '';
    return code ? `${num} ${code}` : num;
  }

  /**
   * Show (or hide, when `text` is null) the pixel-font lot label floating
   * above a parcel. Labels live in their own scene, drawn after the post pass.
   */
  private updateLabel(lotId: number, text: string | null): void {
    let sprite = this.labelSprites.get(lotId);
    if (text === null) {
      if (sprite) sprite.visible = false;
      return;
    }
    if (!sprite) {
      const mat = new THREE.SpriteMaterial({
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        transparent: false,
      });
      sprite = new THREE.Sprite(mat);
      sprite.name = `LotLabel_${lotId}`;
      sprite.center.set(0.5, 0);
      sprite.renderOrder = 10;
      sprite.userData.text = '';
      this.labelSprites.set(lotId, sprite);
      this.labelScene.add(sprite);
    }
    sprite.visible = true;
    if (sprite.userData.text !== text) {
      sprite.userData.text = text;
      sprite.material.map?.dispose();
      const tex = createLabelTexture(text);
      sprite.material.map = tex;
      sprite.material.needsUpdate = true;
      sprite.userData.texSize = [tex.image.width, tex.image.height];
    }
  }

  /** Keep labels above their (lifting) parcels at a constant on-screen size. */
  private updateLabelTransforms(): void {
    if (this.labelSprites.size === 0) return;
    const cssWidth = this.width;
    const cssHeight = this.height;
    const camera = this.activeCamera;
    for (const [lotId, sprite] of this.labelSprites) {
      if (!sprite.visible) continue;
      const mesh = this.parcelHitMeshes[lotId];
      sprite.position.set(mesh.position.x, mesh.position.y + 30, mesh.position.z);
      let unitsPerCssPx: number;
      if (camera === this.orthoCamera) {
        unitsPerCssPx = (this.orthoCamera.right - this.orthoCamera.left) / this.orthoCamera.zoom / cssWidth;
      } else {
        const dist = this.perspCamera.position.distanceTo(sprite.position);
        const viewHeight = 2 * dist * Math.tan((this.perspCamera.fov * Math.PI) / 360);
        unitsPerCssPx = viewHeight / cssHeight;
      }
      const [w, h] = sprite.userData.texSize as [number, number];
      const k = unitsPerCssPx * LABEL_CSS_PX_PER_TEXEL;
      sprite.scale.set(w * k, h * k, 1);
    }
  }

  /**
   * Externally highlight a lot, e.g. while its deed card in the HUD tray is hovered.
   */
  public setHighlightLot(lotId: number | null): void {
    const next = lotId !== null && Number.isInteger(lotId) && lotId >= 0 && lotId < TOTAL_LOTS ? lotId : null;
    if (this.highlightLotId === next) return;
    this.highlightLotId = next;
    if (this.lastRender) {
      this.render(this.lastRender.state, this.lastRender.selected, this.lastRender.overlay);
    }
  }

  /**
   * Visually merge connected shops of one type: a low bridge between every pair
   * of orthogonally adjacent lots, plus a pulsing golden border around each
   * completed cluster.
   */
  private rebuildClusterVisuals(clusters: readonly ShopCluster[]): void {
    while (this.clusterGroup.children.length > 0) {
      const child = this.clusterGroup.children[0];
      this.clusterGroup.remove(child);
      disposeHierarchy(child);
    }
    this.bridgeCount = 0;

    for (const cluster of clusters) {
      if (cluster.lots.length < 2 && !cluster.isComplete) continue;
      const category = SHOP_VISUAL_CATEGORIES[cluster.shopType] || SHOP_VISUAL_CATEGORIES[0];
      const members = new Set(cluster.lots);
      const bridgeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(category.colorHex),
        emissive: new THREE.Color(category.colorHex),
        emissiveIntensity: 0.35,
        roughness: 0.5,
      });

      for (const lotId of cluster.lots) {
        for (const neighbourId of plotNeighbors(lotId)) {
          if (neighbourId <= lotId || !members.has(neighbourId)) continue;
          const a = LOT_DEFINITIONS[lotId];
          const b = LOT_DEFINITIONS[neighbourId];
          const pa = getParcelWorldPosition(a.x, a.y, ELEVATION_PARCEL_BASE);
          const pb = getParcelWorldPosition(b.x, b.y, ELEVATION_PARCEL_BASE);
          const horizontal = Math.abs(pa[0] - pb[0]) > Math.abs(pa[2] - pb[2]);
          const gap = CELL_SIZE + 4;
          const bridge = new THREE.Mesh(
            new THREE.BoxGeometry(horizontal ? gap : 18, 3.0, horizontal ? 18 : gap),
            bridgeMat
          );
          bridge.position.set((pa[0] + pb[0]) / 2, ELEVATION_PARCEL_BASE + 1.5, (pa[2] + pb[2]) / 2);
          bridge.name = `ClusterBridge_${lotId}_${neighbourId}`;
          this.clusterGroup.add(bridge);
          this.bridgeCount++;
        }
      }

      if (cluster.isComplete) {
        const border = new THREE.Group();
        border.name = `ClusterBorder_${cluster.districtId}_${cluster.shopType}_${cluster.lots[0]}`;
        const frameMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 1 });
        for (const lotId of cluster.lots) {
          const def = LOT_DEFINITIONS[lotId];
          const pos = getParcelWorldPosition(def.x, def.y, ELEVATION_PARCEL_BASE + 1.1);
          const half = CELL_SIZE / 2 + 1;
          const sides: [number, number, number, number][] = [
            [0, -half, CELL_SIZE + 4, 2.6],
            [0, half, CELL_SIZE + 4, 2.6],
            [-half, 0, 2.6, CELL_SIZE + 4],
            [half, 0, 2.6, CELL_SIZE + 4],
          ];
          for (const [ox, oz, w, d] of sides) {
            const edge = new THREE.Mesh(new THREE.BoxGeometry(w, 1.0, d), frameMat);
            edge.position.set(pos[0] + ox, pos[1], pos[2] + oz);
            border.add(edge);
          }
        }
        this.clusterGroup.add(border);
      }
    }
  }

  /**
   * Smoothly center and focus camera target on specified parcel.
   */
  public focusLot(lotId: number): void {
    if (typeof lotId !== 'number' || !Number.isInteger(lotId) || lotId < 0 || lotId >= TOTAL_LOTS) {
      return;
    }
    const def = LOT_DEFINITIONS[lotId];
    const pos = getParcelWorldPosition(def.x, def.y);
    this.targetCameraTarget.set(pos[0], 0, pos[2]);
  }

  /**
   * Reset camera target to board center and reset zoom (the `R` key).
   */
  public resetCamera(): void {
    this.targetCameraTarget.set(0, 0, 0);
    this.orthoCamera.zoom = 1.0;
    this.orthoCamera.updateProjectionMatrix();
    if (this.cameraMode === 'perspective') {
      this.cameraAzimuth = Math.PI / 4;
      this.cameraElevation = PERSPECTIVE_ELEVATION;
      this.targetCameraDistance = this.perspectiveDistance();
    } else {
      this.targetCameraDistance = ORTHO_DISTANCE;
    }
  }

  /**
   * Toggle between isometric orthographic and perspective orbit camera modes (the `C` key).
   */
  public toggleCameraMode(): void {
    this.setCameraMode(this.cameraMode === 'isometric' ? 'perspective' : 'isometric');
  }

  /**
   * Set active camera mode with smooth transition lerp.
   */
  public setCameraMode(mode: 'isometric' | 'perspective'): void {
    if (this.cameraMode === mode && !this.isTransitioning) {
      return;
    }
    this.cameraMode = mode;
    this.isTransitioning = true;
    this.transitionStartTime = performance.now();

    if (mode === 'isometric') {
      this.cameraAzimuth = Math.PI / 4;
      this.cameraElevation = (33 * Math.PI) / 180;
      this.targetCameraDistance = ORTHO_DISTANCE;
    } else {
      // Narrow-lens orbit, pulled back to frame the same slab as the iso view.
      this.cameraAzimuth = Math.PI / 4;
      this.cameraElevation = PERSPECTIVE_ELEVATION;
      this.targetCameraDistance = this.perspectiveDistance();
      this.cameraDistance = Math.max(this.cameraDistance, this.targetCameraDistance * 0.6);
    }
  }

  /**
   * Update viewport dimensions, renderer resolution, and camera projection matrices.
   */
  public resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    const oldFit = this.perspectiveDistance();
    this.width = width;
    this.height = height;

    if (this.post) {
      this.post.setSize(width, height);
    } else if (this.renderer) {
      this.renderer.setSize(width, height);
    }

    const aspect = width / height;
    const frustumSize = orthoFrustumHeight(aspect);

    this.orthoCamera.left = (-frustumSize * aspect) / 2;
    this.orthoCamera.right = (frustumSize * aspect) / 2;
    this.orthoCamera.top = frustumSize / 2;
    this.orthoCamera.bottom = -frustumSize / 2;
    this.orthoCamera.updateProjectionMatrix();

    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();
    if (this.cameraMode === 'perspective') {
      // Keep the user's dolly ratio while refitting to the new aspect.
      const ratio = this.targetCameraDistance / oldFit;
      this.targetCameraDistance = this.perspectiveDistance() * ratio;
    }
  }

  /**
   * Programmatic NDC raycast method for testing and external coordinates.
   */
  public raycastAt(ndc: { x: number; y: number }): number | null {
    if (!ndc || !Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) {
      return null;
    }
    this.activeCamera.updateMatrixWorld(true);
    this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.activeCamera);
    const intersects = this.raycaster.intersectObjects(this.parcelHitMeshes, false);
    if (intersects.length > 0 && Number.isFinite(intersects[0].distance)) {
      return (intersects[0].object.userData.lotId as number) ?? null;
    }
    return null;
  }

  // Pointer Interaction Handlers with 5px Drag Filtering

  private handlePointerDown(e: PointerEvent): void {
    this.isPointerDown = true;
    this.pointerDownPos = { x: e.clientX, y: e.clientY, time: performance.now() };
    this.isDragging = false;
    // Right / middle / Shift+left drag pans the isometric view.
    this.isPanning =
      this.cameraMode === 'isometric' &&
      (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey === true));
    try {
      this.renderer?.domElement.setPointerCapture?.(e.pointerId);
    } catch {
      // Synthetic pointer ids cannot be captured.
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (e.buttons !== undefined && e.buttons === 0) {
      this.isDragging = false;
      this.isPointerDown = false;
      this.isPanning = false;
    }

    if (this.isPointerDown) {
      const dx = e.clientX - this.pointerDownPos.x;
      const dy = e.clientY - this.pointerDownPos.y;
      const dist = Math.hypot(dx, dy);

      if (dist > this.DRAG_THRESHOLD_PX || this.isDragging) {
        this.isDragging = true;
        if (this.isPanning) {
          this.panByPixels(dx, dy);
          this.pointerDownPos = { x: e.clientX, y: e.clientY, time: this.pointerDownPos.time };
        } else if (e.buttons === 1 && this.cameraMode === 'perspective') {
          // Orbit camera with primary-button drag in perspective mode
          this.cameraAzimuth -= dx * 0.005;
          this.cameraElevation = Math.max(
            (15 * Math.PI) / 180,
            Math.min((82 * Math.PI) / 180, this.cameraElevation + dy * 0.005)
          );
          this.pointerDownPos = { x: e.clientX, y: e.clientY, time: this.pointerDownPos.time };
        }
        return;
      }
    }

    // Raycast hover detection when not dragging
    if (this.renderer && this.renderer.domElement) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const hitLotId = this.raycastAt({ x: ndcX, y: ndcY });

        if (hitLotId !== this.hoveredLotId) {
          const prevHovered = this.hoveredLotId;
          this.hoveredLotId = hitLotId;
          this.renderer.domElement.style.cursor = hitLotId !== null ? 'pointer' : 'default';
          this.updateParcelElevation(prevHovered);
          this.updateParcelElevation(hitLotId);
          this.options.onHoverLot?.(hitLotId);
        }
      }
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    const elapsed = performance.now() - this.pointerDownPos.time;
    if (
      this.isPointerDown &&
      !this.isDragging &&
      !this.isPanning &&
      (e.button ?? 0) === 0 &&
      elapsed < this.CLICK_TIME_LIMIT_MS
    ) {
      if (this.renderer && this.renderer.domElement) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          const hitLotId = this.raycastAt({ x: ndcX, y: ndcY });

          if (hitLotId !== null) {
            this.options.onSelectLot?.(hitLotId);
          }
        }
      }
    }
    this.isDragging = false;
    this.isPointerDown = false;
    this.isPanning = false;
    try {
      this.renderer?.domElement.releasePointerCapture?.(e.pointerId);
    } catch {
      // Nothing captured.
    }
  }

  /**
   * Pan the isometric view so the ground follows the pointer by (dx, dy) CSS pixels.
   */
  public panByPixels(dx: number, dy: number): void {
    const rect = this.renderer?.domElement.getBoundingClientRect();
    const pxWidth = rect && rect.width > 0 ? rect.width : this.width;
    const unitsPerPx = (this.orthoCamera.right - this.orthoCamera.left) / this.orthoCamera.zoom / pxWidth;
    const sinAz = Math.sin(this.cameraAzimuth);
    const cosAz = Math.cos(this.cameraAzimuth);
    const sinElev = Math.sin(this.cameraElevation);
    // Screen-right on the ground is (cosAz, 0, -sinAz); screen-up is (-sinAz, 0, -cosAz) / sinElev.
    const moveX = -cosAz * dx * unitsPerPx + (-sinAz * dy * unitsPerPx) / sinElev;
    const moveZ = sinAz * dx * unitsPerPx + (-cosAz * dy * unitsPerPx) / sinElev;
    this.shiftCameraTarget(moveX, moveZ);
  }

  /** Move both the live and goal camera targets, clamped to the board area. */
  private shiftCameraTarget(dx: number, dz: number): void {
    this.cameraTarget.x = Math.max(-PAN_LIMIT_X, Math.min(PAN_LIMIT_X, this.cameraTarget.x + dx));
    this.cameraTarget.z = Math.max(-PAN_LIMIT_Z, Math.min(PAN_LIMIT_Z, this.cameraTarget.z + dz));
    this.targetCameraTarget.x = this.cameraTarget.x;
    this.targetCameraTarget.z = this.cameraTarget.z;
    this.updateCameraPositions();
  }

  private updateParcelElevation(lotId: number | null): void {
    if (lotId === null || lotId < 0 || lotId >= TOTAL_LOTS) return;
    if (!this.parcelHitMeshes[lotId]) return;
    this.lotTargetY[lotId] = this.getTargetElevation(lotId);
    if (!this.isAnimating()) {
      this.lotCurrentY[lotId] = this.lotTargetY[lotId];
      this.parcelHitMeshes[lotId].position.y = this.lotCurrentY[lotId];
      this.updateLotShadow(lotId);
      const building = this.buildingMeshes.get(lotId);
      if (building) building.position.y = this.lotCurrentY[lotId] + 1.0;
    }
  }

  /** Point on the parcel plane under the given NDC in the ortho view. */
  private groundPointAt(ndcX: number, ndcY: number): THREE.Vector3 | null {
    this.orthoCamera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.orthoCamera);
    return this.raycaster.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -ELEVATION_PARCEL_BASE),
      new THREE.Vector3()
    );
  }

  /**
   * Zoom by `factor` keeping the ground point under the given NDC fixed
   * (isometric), or dolly the perspective camera.
   */
  public zoomAt(factor: number, ndcX = 0, ndcY = 0): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    if (this.cameraMode === 'isometric') {
      const before = this.groundPointAt(ndcX, ndcY);
      this.orthoCamera.zoom = Math.max(ORTHO_ZOOM_MIN, Math.min(ORTHO_ZOOM_MAX, this.orthoCamera.zoom * factor));
      this.orthoCamera.updateProjectionMatrix();
      const after = this.groundPointAt(ndcX, ndcY);
      if (before && after) {
        this.shiftCameraTarget(before.x - after.x, before.z - after.z);
      }
    } else {
      const fit = this.perspectiveDistance();
      this.targetCameraDistance = Math.max(
        fit * 0.3,
        Math.min(fit * 1.3, this.targetCameraDistance / factor)
      );
    }
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.renderer?.domElement.getBoundingClientRect();
    const ndcX = rect && rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0;
    const ndcY = rect && rect.height > 0 ? -((e.clientY - rect.top) / rect.height) * 2 + 1 : 0;
    this.zoomAt(Math.exp(-e.deltaY * 0.0015), ndcX, ndcY);
  }

  // Accessors for Verification and Testing

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getOrthoCamera(): THREE.OrthographicCamera {
    return this.orthoCamera;
  }

  public getPerspCamera(): THREE.PerspectiveCamera {
    return this.perspCamera;
  }

  public getActiveCamera(): THREE.Camera {
    return this.activeCamera;
  }

  public getCameraMode(): 'isometric' | 'perspective' {
    return this.cameraMode;
  }

  public getCameraTarget(): THREE.Vector3 {
    return this.cameraTarget.clone();
  }

  public getDistrictGroup(): THREE.Group {
    return this.districtGroup;
  }

  public getParcelGroup(): THREE.Group {
    return this.parcelGroup;
  }

  public getBuildingGroup(): THREE.Group {
    return this.buildingGroup;
  }

  public getGoldenAuraGroup(): THREE.Group {
    return this.goldenAuraGroup;
  }

  public getLightingGroup(): THREE.Group {
    return this.lightingGroup;
  }

  public getParcelMesh(lotId: number): THREE.Mesh | undefined {
    return this.parcelHitMeshes[lotId];
  }

  public getParcelHitMeshes(): THREE.Mesh[] {
    return [...this.parcelHitMeshes];
  }

  public getBuildingMesh(lotId: number): THREE.Group | undefined {
    return this.buildingMeshes.get(lotId);
  }

  public getSelectedLotId(): number | null {
    return this.selectedLotId;
  }

  public getHoveredLotId(): number | null {
    return this.hoveredLotId;
  }

  public getBaseGroup(): THREE.Group {
    return this.baseGroup;
  }

  public getShadowGroup(): THREE.Group {
    return this.shadowGroup;
  }

  public getClusterGroup(): THREE.Group {
    return this.clusterGroup;
  }

  public getAmbientGroup(): THREE.Group {
    return this.ambientGroup;
  }

  public getOwnerFlag(lotId: number): THREE.Group | undefined {
    return this.ownerFlags[lotId];
  }

  public getLotLabel(lotId: number): THREE.Sprite | undefined {
    return this.labelSprites.get(lotId);
  }

  public getParcelMaterial(lotId: number): THREE.MeshStandardMaterial | undefined {
    return this.parcelMaterials[lotId];
  }

  public getHighlightLotId(): number | null {
    return this.highlightLotId;
  }

  /** How many times the gold lights / crowns have been rebuilt (QA, tests). */
  public getGoldenRebuildCount(): number {
    return this.goldenRebuilds;
  }
}
