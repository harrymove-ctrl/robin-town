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
import type { GameState } from '../engine/types';

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
  '#AB47BC', // Player 4: Royal Purple
  '#EC407A', // Player 5: Neon Rose
]);

/**
 * Living Town environment configuration options.
 */
export interface LivingTownConfig {
  enableWater?: boolean;
  enableTraffic?: boolean;
  enableTrees?: boolean;
  enableStreetLamps?: boolean;
  enablePeripheralHouses?: boolean;
  defaultViewMode?: 'city-3d' | '2d';
}

/**
 * Visual lifecycle stages for board parcels.
 */
export type LotVisualStage = 'vacant' | 'claimed' | 'constructed' | 'completed';

/**
 * Properties for parcel 3D visualization.
 */
export interface Lot3DProps {
  id: number;
  stage: LotVisualStage;
  ownerColor?: string;
  shopType?: number;
  shopSize?: number;
  isComplete?: boolean;
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

/**
 * Check if HTML5 Canvas 2D context is supported in the current environment.
 */
export function isCanvasSupported(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext && canvas.getContext('2d'));
  } catch {
    return false;
  }
}

/**
 * Determine the visual lifecycle stage of a lot based on ownership and shop state.
 */
export function determineLotStage(
  lot: { owner: number | null; shop?: number | null; shopType?: number | null; isComplete?: boolean },
  isCompleteFlag?: boolean
): LotVisualStage {
  const shopVal = lot.shopType !== undefined ? lot.shopType : lot.shop;
  const hasShop = shopVal !== null && shopVal !== undefined;
  const complete = isCompleteFlag !== undefined ? isCompleteFlag : Boolean(lot.isComplete);
  if (hasShop && complete) return 'completed';
  if (hasShop) return 'constructed';
  if (lot.owner !== null && lot.owner !== undefined) return 'claimed';
  return 'vacant';
}

/**
 * Factory for Vacant Lot 3D Model: concrete perimeter foundation walls,
 * excavated interior pit, corner structural rebar dowels, and tilted lease signpost.
 */
export function createVacantLotModel(lotIdOrProps: number | { lotId: number }): THREE.Group {
  const lotId = typeof lotIdOrProps === 'number' ? lotIdOrProps : lotIdOrProps.lotId;
  const group = new THREE.Group();
  group.name = `VacantLotProps_${lotId}`;

  // Concrete foundation perimeter footings
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x78716c,
    roughness: 0.85,
    metalness: 0.1,
  });

  // Four perimeter foundation walls around the 48x48 parcel footprint
  const northWallGeom = new THREE.BoxGeometry(48, 3.5, 2.0);
  const northWall = new THREE.Mesh(northWallGeom, concreteMat);
  northWall.position.set(0, 1.75, -23);
  group.add(northWall);

  const southWallGeom = new THREE.BoxGeometry(48, 3.5, 2.0);
  const southWall = new THREE.Mesh(southWallGeom, concreteMat);
  southWall.position.set(0, 1.75, 23);
  group.add(southWall);

  const westWallGeom = new THREE.BoxGeometry(2.0, 3.5, 44);
  const westWall = new THREE.Mesh(westWallGeom, concreteMat);
  westWall.position.set(-23, 1.75, 0);
  group.add(westWall);

  const eastWallGeom = new THREE.BoxGeometry(2.0, 3.5, 44);
  const eastWall = new THREE.Mesh(eastWallGeom, concreteMat);
  eastWall.position.set(23, 1.75, 0);
  group.add(eastWall);

  // Excavated soil pit
  const dirtGeom = new THREE.BoxGeometry(44, 0.4, 44);
  const dirtMat = new THREE.MeshStandardMaterial({
    color: 0x382e2b,
    roughness: 0.95,
    metalness: 0.05,
  });
  const dirtPit = new THREE.Mesh(dirtGeom, dirtMat);
  dirtPit.position.set(0, 0.2, 0);
  group.add(dirtPit);

  // Corner rebar dowels (4 corners)
  const rebarGeom = new THREE.CylinderGeometry(0.25, 0.25, 5.0, 4);
  const rebarMat = new THREE.MeshStandardMaterial({
    color: 0x854d0e,
    roughness: 0.7,
    metalness: 0.65,
  });
  const cornerOffsets: [number, number][] = [
    [-22, -22],
    [22, -22],
    [-22, 22],
    [22, 22],
  ];
  for (const [cx, cz] of cornerOffsets) {
    const rebar1 = new THREE.Mesh(rebarGeom, rebarMat);
    rebar1.position.set(cx - 0.4, 3.5, cz - 0.4);
    const rebar2 = new THREE.Mesh(rebarGeom, rebarMat);
    rebar2.position.set(cx + 0.4, 3.5, cz + 0.4);
    group.add(rebar1, rebar2);
  }

  // Tilted Lease Signpost
  const stakeGeom = new THREE.BoxGeometry(0.8, 12.0, 0.8);
  const stakeMat = new THREE.MeshStandardMaterial({
    color: 0x854d0e,
    roughness: 0.8,
    metalness: 0.1,
  });
  const stake = new THREE.Mesh(stakeGeom, stakeMat);
  stake.position.set(10, 6.0, 15);
  group.add(stake);

  const signGroup = new THREE.Group();
  signGroup.name = 'lease-sign';
  signGroup.position.set(10, 11.5, 15);
  signGroup.rotation.x = -0.22;
  signGroup.rotation.y = -0.19;

  const boardFrameGeom = new THREE.BoxGeometry(14, 8.5, 0.8);
  const boardFrameMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.4,
    metalness: 0.2,
  });
  const boardFrame = new THREE.Mesh(boardFrameGeom, boardFrameMat);
  signGroup.add(boardFrame);

  const boardFaceGeom = new THREE.PlaneGeometry(12.5, 7.0);
  const boardFaceMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
  });
  const boardFace = new THREE.Mesh(boardFaceGeom, boardFaceMat);
  boardFace.position.z = 0.45;
  signGroup.add(boardFace);

  group.add(signGroup);
  return group;
}

/**
 * Factory for Claimed Lot 3D Model: owner-colored striped fabric awning canopy,
 * tubular metal frame poles, low street table, iced beverage glass, and molded
 * street-side plastic stools around the table with a corner stack.
 */
export function createClaimedLotModel(
  lotIdOrProps: number | { lotId: number; owner?: number },
  ownerIndexArg?: number
): THREE.Group {
  const lotId = typeof lotIdOrProps === 'number' ? lotIdOrProps : lotIdOrProps.lotId;
  const ownerIndex =
    typeof lotIdOrProps === 'object' && lotIdOrProps.owner !== undefined
      ? lotIdOrProps.owner
      : (ownerIndexArg ?? 0);
  const group = new THREE.Group();
  group.name = `ClaimedLotProps_${lotId}`;

  const ownerHex = PLAYER_HEX_COLORS[ownerIndex] || PLAYER_HEX_COLORS[0];
  const ownerColor = new THREE.Color(ownerHex);

  // Retractable Striped Fabric Awning
  const canopyMat = new THREE.MeshStandardMaterial({
    color: ownerColor,
    roughness: 0.65,
    metalness: 0.05,
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.65,
    metalness: 0.05,
  });

  const canopyGroup = new THREE.Group();
  canopyGroup.name = 'awning-group';
  canopyGroup.position.set(0, 13.5, 2.0);
  canopyGroup.rotation.x = 0.35; // ~20 deg pitch down toward streetfront

  const canopyGeom = new THREE.BoxGeometry(36, 0.6, 26);
  const canopyMesh = new THREE.Mesh(canopyGeom, canopyMat);
  canopyMesh.name = 'awning-fabric';
  canopyGroup.add(canopyMesh);

  // Decorative white stripes across canopy
  const stripeGeom = new THREE.BoxGeometry(4.0, 0.7, 25.8);
  const stripeOffsets = [-13.5, -4.5, 4.5, 13.5];
  for (const so of stripeOffsets) {
    const stripe = new THREE.Mesh(stripeGeom, whiteMat);
    stripe.position.set(so, 0.05, 0);
    canopyGroup.add(stripe);
  }

  // Drooping valance skirt along front edge
  const valanceGeom = new THREE.BoxGeometry(36, 3.2, 0.3);
  const valance = new THREE.Mesh(valanceGeom, canopyMat);
  valance.position.set(0, -2.5, 13.0);
  canopyGroup.add(valance);

  group.add(canopyGroup);

  // Galvanized Tubular Metal Frame Poles
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.35,
    metalness: 0.8,
  });

  // Front two poles
  const frontPoleGeom = new THREE.CylinderGeometry(0.4, 0.4, 9.5, 6);
  const frontPoleL = new THREE.Mesh(frontPoleGeom, poleMat);
  frontPoleL.position.set(-16, 4.75, 14);
  const frontPoleR = new THREE.Mesh(frontPoleGeom, poleMat);
  frontPoleR.position.set(16, 4.75, 14);
  group.add(frontPoleL, frontPoleR);

  // Rear two poles
  const rearPoleGeom = new THREE.CylinderGeometry(0.4, 0.4, 15.0, 6);
  const rearPoleL = new THREE.Mesh(rearPoleGeom, poleMat);
  rearPoleL.position.set(-16, 7.5, -10);
  const rearPoleR = new THREE.Mesh(rearPoleGeom, poleMat);
  rearPoleR.position.set(16, 7.5, -10);
  group.add(rearPoleL, rearPoleR);

  // Low Street Folding Table
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.25,
    metalness: 0.85,
  });
  const tableTopGeom = new THREE.BoxGeometry(9.0, 0.5, 6.0);
  const tableTop = new THREE.Mesh(tableTopGeom, tableMat);
  tableTop.position.set(0, 3.8, 3.0);
  group.add(tableTop);

  const tableLegGeom = new THREE.CylinderGeometry(0.25, 0.25, 3.8, 4);
  const tableLegOffsets: [number, number][] = [
    [-3.8, 1.0],
    [3.8, 1.0],
    [-3.8, 5.0],
    [3.8, 5.0],
  ];
  for (const [lx, lz] of tableLegOffsets) {
    const leg = new THREE.Mesh(tableLegGeom, poleMat);
    leg.position.set(lx, 1.9, lz);
    group.add(leg);
  }

  // Iced beverage glass on the table
  const cupGeom = new THREE.CylinderGeometry(0.4, 0.3, 1.2, 6);
  const cupMat = new THREE.MeshBasicMaterial({ color: 0xd97706 });
  const cup = new THREE.Mesh(cupGeom, cupMat);
  cup.position.set(0, 4.4, 3.0);
  group.add(cup);

  // Molded street-side plastic stools
  const stoolMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626, // Warm street red plastic
    roughness: 0.35,
    metalness: 0.05,
  });
  const stoolSeatGeom = new THREE.BoxGeometry(3.6, 0.5, 3.6);
  const stoolLegGeom = new THREE.CylinderGeometry(0.22, 0.16, 2.8, 4);

  function createPlasticStool(x: number, y: number, z: number): THREE.Group {
    const stool = new THREE.Group();
    stool.position.set(x, y, z);
    const seat = new THREE.Mesh(stoolSeatGeom, stoolMat);
    seat.position.y = 2.8;
    stool.add(seat);

    const legOffsets: [number, number][] = [
      [-1.4, -1.4],
      [1.4, -1.4],
      [-1.4, 1.4],
      [1.4, 1.4],
    ];
    for (const [ox, oz] of legOffsets) {
      const leg = new THREE.Mesh(stoolLegGeom, stoolMat);
      leg.position.set(ox, 1.4, oz);
      stool.add(leg);
    }
    return stool;
  }

  // Stools arranged around the table and stacked in the corner
  const stoolsGroup = new THREE.Group();
  stoolsGroup.name = 'plastic-stools';
  stoolsGroup.add(createPlasticStool(-6.0, 0, 3.0));
  stoolsGroup.add(createPlasticStool(6.0, 0, 3.0));
  stoolsGroup.add(createPlasticStool(0, 0, 7.5));

  // Stack of three plastic stools in the corner
  const stackBaseX = -12.0;
  const stackBaseZ = -5.0;
  for (let s = 0; s < 3; s++) {
    stoolsGroup.add(createPlasticStool(stackBaseX, s * 0.8, stackBaseZ));
  }
  group.add(stoolsGroup);

  return group;
}

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

      const dishGeom = new THREE.CylinderGeometry(7, 3, 2, 8);
      const dish = new THREE.Mesh(dishGeom, mainMat);
      dish.position.set(0, 22, 0);
      dish.rotation.x = Math.PI / 6;
      group.add(dish);

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

  // Cantilevered Vertical Neon Blade Signboard
  const neonGroup = new THREE.Group();
  neonGroup.name = 'NeonBladeSign';

  const armGeom = new THREE.CylinderGeometry(0.25, 0.25, 7.0, 4);
  const armMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.8,
  });
  const armTop = new THREE.Mesh(armGeom, armMat);
  armTop.rotation.x = Math.PI / 2;
  armTop.position.set(14, 16, 22.0);
  const armBottom = new THREE.Mesh(armGeom, armMat);
  armBottom.rotation.x = Math.PI / 2;
  armBottom.position.set(14, 8, 22.0);
  neonGroup.add(armTop, armBottom);

  const bladeGeom = new THREE.BoxGeometry(0.8, 14, 7);
  const bladeMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.3,
    roughness: 0.2,
    metalness: 0.4,
  });
  const bladeMesh = new THREE.Mesh(bladeGeom, bladeMat);
  bladeMesh.position.set(14, 12, 23.5);
  neonGroup.add(bladeMesh);

  const neonLight = new THREE.PointLight(color, 0.75, 28);
  neonLight.position.set(14, 12, 24.5);
  neonGroup.add(neonLight);
  group.add(neonGroup);

  // Rooftop Garden with Potted Plants and Bougainvillea
  const gardenGroup = new THREE.Group();
  gardenGroup.name = 'RooftopGarden';

  const planterGeom = new THREE.BoxGeometry(9.0, 1.8, 3.2);
  const planterMat = new THREE.MeshStandardMaterial({
    color: 0x9a3412,
    roughness: 0.85,
    metalness: 0.1,
  });
  const planter = new THREE.Mesh(planterGeom, planterMat);
  planter.position.set(0, totalHeight - 0.2, -10.0);
  gardenGroup.add(planter);

  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    roughness: 0.7,
    metalness: 0.05,
    flatShading: true,
  });
  const shrubGeom = new THREE.DodecahedronGeometry(1.6);
  for (let fx = -3.0; fx <= 3.0; fx += 3.0) {
    const shrub = new THREE.Mesh(shrubGeom, foliageMat);
    shrub.position.set(fx, totalHeight + 1.2, -10.0);
    gardenGroup.add(shrub);
  }

  const flowerGeom = new THREE.SphereGeometry(0.4, 4, 3);
  const flowerMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
  const flowerPositions: [number, number, number][] = [
    [-2.2, totalHeight + 1.8, -9.0],
    [0.5, totalHeight + 2.2, -9.2],
    [2.8, totalHeight + 1.6, -9.1],
  ];
  for (const [flx, fly, flz] of flowerPositions) {
    const fl = new THREE.Mesh(flowerGeom, flowerMat);
    fl.position.set(flx, fly, flz);
    gardenGroup.add(fl);
  }

  const potGeom = new THREE.CylinderGeometry(1.6, 1.1, 2.0, 8);
  const potMat = new THREE.MeshStandardMaterial({
    color: 0xc2410c,
    roughness: 0.8,
    metalness: 0.1,
  });
  const pot = new THREE.Mesh(potGeom, potMat);
  pot.position.set(12, totalHeight, -10.0);
  const bonsaiShrub = new THREE.Mesh(shrubGeom, foliageMat);
  bonsaiShrub.position.set(12, totalHeight + 2.0, -10.0);
  gardenGroup.add(pot, bonsaiShrub);

  group.add(gardenGroup);

  // Ground Entrance Interior Warm Glow
  const entranceGeom = new THREE.BoxGeometry(12, 8, 1.5);
  const entranceMat = new THREE.MeshBasicMaterial({
    color: 0xffedd5,
    transparent: true,
    opacity: 0.85,
  });
  const entrance = new THREE.Mesh(entranceGeom, entranceMat);
  entrance.name = 'EntranceGlow';
  entrance.position.set(0, 4, 18.5);
  group.add(entrance);

  // Dynamic cluster height scaling
  const scaleY = 1.0 + 0.12 * Math.min(Math.max(clusterSize - 1, 0), category.targetSize);
  group.scale.set(1.0, scaleY, 1.0);

  // Golden Completion Aura Mesh and Celebratory Banners
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

    // Twin Celebratory Vermilion and Gold Banners
    const bannerGroup = new THREE.Group();
    bannerGroup.name = 'CelebratoryBanners';

    const bannerMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.3,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.9,
    });

    const bannerHeight = totalHeight * scaleY * 0.72;
    const bannerGeom = new THREE.BoxGeometry(3.2, bannerHeight, 0.4);
    const leftBanner = new THREE.Mesh(bannerGeom, bannerMat);
    leftBanner.position.set(-11, bannerHeight / 2 + 1.0, 19.8);
    const rightBanner = new THREE.Mesh(bannerGeom, bannerMat);
    rightBanner.position.set(11, bannerHeight / 2 + 1.0, 19.8);
    bannerGroup.add(leftBanner, rightBanner);

    // Gold dowels and bottom hanging tassels
    const dowelGeom = new THREE.CylinderGeometry(0.3, 0.3, 3.8, 6);
    dowelGeom.rotateZ(Math.PI / 2);
    const tasselGeom = new THREE.ConeGeometry(0.4, 1.4, 5);
    tasselGeom.rotateX(Math.PI);

    for (const bx of [-11, 11]) {
      const dowel = new THREE.Mesh(dowelGeom, goldMat);
      dowel.position.set(bx, 1.0, 20.0);
      const tassel = new THREE.Mesh(tasselGeom, goldMat);
      tassel.position.set(bx, 0.2, 20.0);
      bannerGroup.add(dowel, tassel);
    }

    // Top transverse valance banner
    const valanceGeom = new THREE.BoxGeometry(25, 2.6, 0.5);
    const valanceMesh = new THREE.Mesh(valanceGeom, bannerMat);
    valanceMesh.position.set(0, totalHeight * scaleY + 0.5, 19.8);
    bannerGroup.add(valanceMesh);

    group.add(bannerGroup);
  }

  return group;
}

/**
 * Closed-loop spline road track for vehicle motion simulation.
 */
export class RoadTrack {
  public curve: THREE.CatmullRomCurve3;
  public length: number;

  constructor(points: THREE.Vector3[]) {
    this.curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
    this.length = this.curve.getLength();
  }

  public at(distance: number): { pos: THREE.Vector3; yaw: number } {
    const u = (((distance % this.length) + this.length) % this.length) / this.length;
    const pos = this.curve.getPointAt(u);
    const tangent = this.curve.getTangentAt(u);
    const yaw = Math.atan2(tangent.x, tangent.z);
    return { pos, yaw };
  }
}

/**
 * Animated boat record along canal waterway.
 */
export interface AnimatedBoat {
  mesh: THREE.Group;
  x: number;
  z: number;
  speed: number;
  phase: number;
}

/**
 * Animated traffic vehicle record on spline track.
 */
export interface AnimatedTrafficVehicle {
  mesh: THREE.Group;
  track: RoadTrack;
  distance: number;
  speed: number;
}

/**
 * Swaying tree canopy record.
 */
export interface SwayingTreeCanopy {
  mesh: THREE.Group;
  offset: number;
}

/**
 * Board3D initialization options interface.
 */
export interface Board3DOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  config?: Partial<LivingTownConfig>;
  livingTown?: Partial<LivingTownConfig>;
  onSelectLot?: (lotId: number) => void;
  onHoverLot?: (lotId: number | null) => void;
}

/**
 * Public Board3DRenderer interface contract as defined in SCOPE.md.
 */
export interface Board3DRenderer {
  mount(): void;
  unmount(): void;
  render(state: GameState, selectedLotId?: number | null): void;
  focusLot(lotId: number): void;
  resetCamera(): void;
  resize(width: number, height: number): void;
  pause(): void;
  resume(): void;
}

/**
 * ThreeBoardRenderer implements 3D board rendering, interactive raycasting,
 * procedural shop extrusions, district foundations, golden auras, living town diorama,
 * and dual cameras.
 */
export class ThreeBoardRenderer implements Board3DRenderer {
  private options: Board3DOptions;
  private width: number;
  private height: number;
  private livingConfig: LivingTownConfig;

  // Three.js Core
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer | null = null;
  private animFrameId: number | null = null;
  private isPaused = false;

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
  private environmentGroup: THREE.Group;
  private districtGroup: THREE.Group;
  private parcelGroup: THREE.Group;
  private buildingGroup: THREE.Group;
  private goldenAuraGroup: THREE.Group;
  private lightingGroup: THREE.Group;

  // Parcel and Raycast Target Registry
  private parcelHitMeshes: THREE.Mesh[] = [];
  private parcelMaterials: THREE.MeshStandardMaterial[] = [];
  private parcelPropMeshes = new Map<number, THREE.Group>();
  private buildingMeshes = new Map<number, THREE.Group>();

  // Living Environment Subsystems
  private canalWaterMesh: THREE.Mesh | null = null;
  private boatList: AnimatedBoat[] = [];
  private trafficVehicles: AnimatedTrafficVehicle[] = [];
  private treeCanopies: SwayingTreeCanopy[] = [];
  private lastAnimTimestamp = 0;

  // Interactive Selection and Hover State
  private selectedLotId: number | null = null;
  private hoveredLotId: number | null = null;
  private raycaster = new THREE.Raycaster();

  // Pointer event tracking for drag versus click differentiation
  private pointerDownPos = { x: 0, y: 0, time: 0 };
  private isPointerDown = false;
  private isDragging = false;
  private readonly DRAG_THRESHOLD_PX = 5;
  private readonly CLICK_TIME_LIMIT_MS = 600;

  // DOM Event listener references for clean disposal
  private onPointerDownBound: (e: PointerEvent) => void;
  private onPointerMoveBound: (e: PointerEvent) => void;
  private onPointerUpBound: (e: PointerEvent) => void;
  private onWheelBound: (e: WheelEvent) => void;
  private onResizeBound: () => void;

  constructor(options: Board3DOptions) {
    this.options = options;
    this.width = options.width || BOARD_WIDTH;
    this.height = options.height || BOARD_HEIGHT;

    const cfg = options.livingTown || options.config;
    this.livingConfig = {
      enableWater: cfg?.enableWater ?? true,
      enableTraffic: cfg?.enableTraffic ?? true,
      enableTrees: cfg?.enableTrees ?? true,
      enableStreetLamps: cfg?.enableStreetLamps ?? true,
      enablePeripheralHouses: cfg?.enablePeripheralHouses ?? true,
      defaultViewMode: cfg?.defaultViewMode ?? 'city-3d',
    };

    // Initialize core Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = null; // Transparent to allow exposure-grid shader beneath

    // Build hierarchy groups
    this.boardGroup = new THREE.Group();
    this.boardGroup.name = 'BoardGroup';
    this.environmentGroup = new THREE.Group();
    this.environmentGroup.name = 'EnvironmentGroup';
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

    this.boardGroup.add(
      this.environmentGroup,
      this.districtGroup,
      this.parcelGroup,
      this.buildingGroup,
      this.goldenAuraGroup
    );
    this.scene.add(this.boardGroup, this.lightingGroup);

    // Initialize dual cameras
    const aspect = this.width / this.height;
    const frustumSize = 720;
    this.orthoCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      2000
    );

    this.perspCamera = new THREE.PerspectiveCamera(38, aspect, 1, 2000);
    this.activeCamera = this.orthoCamera;
    this.updateCameraPositions();

    // Setup scene lighting
    this.setupLighting();

    // Setup 6 district slabs
    this.setupDistrictSlabs();

    // Setup 72 parcel meshes
    this.setupParcelMeshes();

    // Setup Living Town Environment
    this.setupLivingTownEnvironment();

    // Bind event handlers
    this.onPointerDownBound = this.handlePointerDown.bind(this);
    this.onPointerMoveBound = this.handlePointerMove.bind(this);
    this.onPointerUpBound = this.handlePointerUp.bind(this);
    this.onWheelBound = this.handleWheel.bind(this);
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
    const ambientLight = new THREE.AmbientLight(0x334155, 1.35);
    ambientLight.name = 'AmbientLight';

    const sunLight = new THREE.DirectionalLight(0xfff6e5, 1.75);
    sunLight.name = 'SunLight';
    sunLight.position.set(300, 600, 400);

    const fillLight = new THREE.DirectionalLight(0x7aa2f7, 0.85);
    fillLight.name = 'FillLight';
    fillLight.position.set(-300, 300, -200);

    this.lightingGroup.add(ambientLight, sunLight, fillLight);

    // Add subtle colored point lights above each of the 6 districts
    for (const district of DISTRICT_BLOCKS) {
      const slabCenter = this.getDistrictCenter3D(district);
      const districtLight = new THREE.PointLight(district.accentHex, 1.1, 220);
      districtLight.name = `DistrictLight_${district.id}`;
      districtLight.position.set(slabCenter[0], 35.0, slabCenter[2]);
      this.lightingGroup.add(districtLight);
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

      // Architectural corner beacon pylons for clear 3D district depth
      const pylonGeom = new THREE.CylinderGeometry(2.2, 3.0, 9.0, 6);
      const pylonMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(district.accentHex),
        emissive: new THREE.Color(district.accentHex),
        emissiveIntensity: 0.45,
        roughness: 0.3,
        metalness: 0.7,
      });
      const cornerOffsets: [number, number][] = [
        [-slabWidth / 2 + 6, -slabDepth / 2 + 6],
        [slabWidth / 2 - 6, -slabDepth / 2 + 6],
        [-slabWidth / 2 + 6, slabDepth / 2 - 6],
        [slabWidth / 2 - 6, slabDepth / 2 - 6],
      ];
      cornerOffsets.forEach(([ox, oz], idx) => {
        const pylon = new THREE.Mesh(pylonGeom, pylonMat);
        pylon.name = `DistrictPylon_${district.id}_${idx}`;
        pylon.position.set(center[0] + ox, center[1] + 5.0, center[2] + oz);
        districtGroup.add(pylon);
      });

      this.districtGroup.add(districtGroup);
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
    const sharedEdgeGeom = new THREE.EdgesGeometry(sharedGeom);

    this.parcelHitMeshes = [];
    this.parcelMaterials = [];

    for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
      const def = LOT_DEFINITIONS[lotId];
      const pos = getParcelWorldPosition(def.x, def.y, ELEVATION_PARCEL_BASE);
      const district = DISTRICT_BLOCKS[def.block] || DISTRICT_BLOCKS[0];

      // Distinct standard material per parcel allowing individual state updates
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.45,
        metalness: 0.35,
      });
      this.parcelMaterials[lotId] = mat;

      const mesh = new THREE.Mesh(sharedGeom, mat);
      mesh.name = `ParcelMesh_${lotId}`;
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.userData = { lotId, blockId: def.block };

      // Subtle neon edge frame so every 3D parcel reads crisply
      const edgeMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(district.accentHex),
        transparent: true,
        opacity: 0.45,
      });
      const edgeLines = new THREE.LineSegments(sharedEdgeGeom, edgeMat);
      edgeLines.name = `ParcelEdges_${lotId}`;
      mesh.add(edgeLines);

      this.parcelHitMeshes[lotId] = mesh;
      this.parcelGroup.add(mesh);
    }
  }

  /**
   * Set up living town diorama environment with terrain, canals, streets,
   * sidewalks, street lamps, trees, traffic vehicles, and framing townhouses.
   */
  private setupLivingTownEnvironment(): void {
    this.setupTerrainBase();

    if (this.livingConfig.enableWater) {
      this.setupCanalAndBoats();
    }

    this.setupRoadNetworkAndMarkings();

    if (this.livingConfig.enableStreetLamps) {
      this.setupSidewalksAndLamps();
    }

    if (this.livingConfig.enableTrees) {
      this.setupVegetation();
    }

    if (this.livingConfig.enableTraffic) {
      this.setupTraffic();
    }

    if (this.livingConfig.enablePeripheralHouses) {
      this.setupPeripheralHouses();
    }
  }

  /**
   * Set up dark slate terrain foundation under the town diorama.
   */
  private setupTerrainBase(): void {
    const terrainGeom = new THREE.BoxGeometry(1180, 4.0, 800);
    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x151921,
      roughness: 0.95,
      metalness: 0.05,
    });
    const terrainBase = new THREE.Mesh(terrainGeom, terrainMat);
    terrainBase.name = 'TerrainBaseMesh';
    terrainBase.position.set(0, -2.0, 0);
    this.environmentGroup.add(terrainBase);
  }

  /**
   * Set up eastern canal with recessed bed, stone quay walls,
   * reflective water surface, and two animated sampan boats.
   */
  private setupCanalAndBoats(): void {
    const canalGroup = new THREE.Group();
    canalGroup.name = 'CanalGroup';

    // Canal bed recessed to y = -2.50
    const bedGeom = new THREE.BoxGeometry(70.0, 2.0, 760.0);
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0x0f2327,
      roughness: 0.95,
      metalness: 0.1,
    });
    const bedMesh = new THREE.Mesh(bedGeom, bedMat);
    bedMesh.name = 'CanalBedMesh';
    bedMesh.position.set(515.0, -2.5, 0);
    canalGroup.add(bedMesh);

    // Stone Quay Walls along banks
    const quaysGroup = new THREE.Group();
    quaysGroup.name = 'CanalQuays';
    const quayMat = new THREE.MeshStandardMaterial({
      color: 0x5e656a,
      roughness: 0.75,
      metalness: 0.25,
    });
    const westQuayGeom = new THREE.BoxGeometry(3.0, 3.8, 760.0);
    const westQuay = new THREE.Mesh(westQuayGeom, quayMat);
    westQuay.position.set(480.0, -0.6, 0);

    const eastQuayGeom = new THREE.BoxGeometry(3.0, 3.8, 760.0);
    const eastQuay = new THREE.Mesh(eastQuayGeom, quayMat);
    eastQuay.position.set(550.0, -0.6, 0);
    quaysGroup.add(westQuay, eastQuay);
    canalGroup.add(quaysGroup);

    // Water Surface with physical material
    const waterGeom = new THREE.PlaneGeometry(68.0, 760.0, 16, 32);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x226b74,
      roughness: 0.15,
      metalness: 0.05,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    this.canalWaterMesh = new THREE.Mesh(waterGeom, waterMat);
    this.canalWaterMesh.name = 'CanalWaterMesh';
    this.canalWaterMesh.rotation.x = -Math.PI / 2;
    this.canalWaterMesh.position.set(515.0, -0.3, 0);
    canalGroup.add(this.canalWaterMesh);

    // Boat Group
    const boatGroup = new THREE.Group();
    boatGroup.name = 'BoatGroup';

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x8a7654,
      roughness: 0.75,
      metalness: 0.15,
    });
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0xc9a267,
      roughness: 0.65,
      metalness: 0.1,
    });
    const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffb74d });
    const rudderMat = new THREE.MeshStandardMaterial({
      color: 0x4a3b2c,
      roughness: 0.8,
      metalness: 0.2,
    });

    const createSampanBoat = (): THREE.Group => {
      const boat = new THREE.Group();
      // Hull
      const hullGeom = new THREE.BoxGeometry(5.0, 1.8, 14.0);
      const hull = new THREE.Mesh(hullGeom, hullMat);
      hull.position.y = 0.9;
      boat.add(hull);

      // Arched bamboo canopy midship
      const awningGeom = new THREE.CylinderGeometry(2.4, 2.4, 7.5, 8, 1, false, 0, Math.PI);
      awningGeom.rotateZ(Math.PI / 2);
      awningGeom.rotateY(Math.PI / 2);
      const awning = new THREE.Mesh(awningGeom, canopyMat);
      awning.position.set(0, 2.0, 0);
      boat.add(awning);

      // Stern rudder
      const rudderGeom = new THREE.CylinderGeometry(0.2, 0.2, 5.0, 4);
      const rudder = new THREE.Mesh(rudderGeom, rudderMat);
      rudder.rotation.x = Math.PI / 4;
      rudder.position.set(0, 1.5, -7.5);
      boat.add(rudder);

      // Bow lantern
      const lanternGeom = new THREE.SphereGeometry(0.45, 6, 6);
      const lantern = new THREE.Mesh(lanternGeom, lanternMat);
      lantern.position.set(0, 2.2, 6.8);
      boat.add(lantern);

      return boat;
    };

    const boat0Mesh = createSampanBoat();
    boat0Mesh.name = 'SampanBoat_0';
    this.boatList.push({
      mesh: boat0Mesh,
      x: 504.0,
      z: -120.0,
      speed: 22.0,
      phase: 0.0,
    });
    boatGroup.add(boat0Mesh);

    const boat1Mesh = createSampanBoat();
    boat1Mesh.name = 'SampanBoat_1';
    boat1Mesh.rotation.y = Math.PI; // Heading opposite direction
    this.boatList.push({
      mesh: boat1Mesh,
      x: 526.0,
      z: 140.0,
      speed: -18.0,
      phase: Math.PI,
    });
    boatGroup.add(boat1Mesh);

    canalGroup.add(boatGroup);
    this.environmentGroup.add(canalGroup);
  }

  /**
   * Set up asphalt road grid, painted lane markings, and zebra crosswalks.
   */
  private setupRoadNetworkAndMarkings(): void {
    const streetGroup = new THREE.Group();
    streetGroup.name = 'StreetGroup';

    const asphaltRoadsGroup = new THREE.Group();
    asphaltRoadsGroup.name = 'AsphaltRoads';

    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x24282f,
      roughness: 0.88,
      metalness: 0.12,
    });

    // 9 Asphalt road segments covering outer avenues, central boulevard, and cross-streets
    const roadDefs: Array<{ name: string; x: number; z: number; w: number; d: number }> = [
      { name: 'Road_NorthAvenue', x: 0, z: -315, w: 1040, d: 36 },
      { name: 'Road_SouthAvenue', x: 0, z: 325, w: 1040, d: 36 },
      { name: 'Road_WestParkRoad', x: -475, z: 0, w: 36, d: 670 },
      { name: 'Road_EastRiverPromenade', x: 455, z: 0, w: 36, d: 670 },
      { name: 'Road_CentralBoulevard', x: 0, z: 0, w: 920, d: 40 },
      { name: 'Road_CrossAvenue_1', x: -202, z: -165, w: 32, d: 260 },
      { name: 'Road_CrossAvenue_2', x: 126, z: -165, w: 32, d: 260 },
      { name: 'Road_CrossAvenue_3', x: -137, z: 165, w: 32, d: 260 },
      { name: 'Road_CrossAvenue_4', x: 183, z: 165, w: 32, d: 260 },
    ];

    for (const rd of roadDefs) {
      const roadGeom = new THREE.BoxGeometry(rd.w, 0.4, rd.d);
      const roadMesh = new THREE.Mesh(roadGeom, asphaltMat);
      roadMesh.name = rd.name;
      roadMesh.position.set(rd.x, 0.6, rd.z);
      asphaltRoadsGroup.add(roadMesh);
    }
    streetGroup.add(asphaltRoadsGroup);

    // Lane Markings Group
    const laneMarkingsGroup = new THREE.Group();
    laneMarkingsGroup.name = 'LaneMarkings';

    const dashMat = new THREE.MeshBasicMaterial({
      color: 0xc1bc8d,
      transparent: true,
      opacity: 0.85,
    });

    // Dashed lines along North and South Avenues
    const dashHGeom = new THREE.PlaneGeometry(12.0, 1.2);
    dashHGeom.rotateX(-Math.PI / 2);

    for (let x = -440; x <= 440; x += 30) {
      const dashN = new THREE.Mesh(dashHGeom, dashMat);
      dashN.position.set(x, 0.82, -315);
      const dashS = new THREE.Mesh(dashHGeom, dashMat);
      dashS.position.set(x, 0.82, 325);
      const dashC = new THREE.Mesh(dashHGeom, dashMat);
      dashC.position.set(x, 0.82, 0);
      laneMarkingsGroup.add(dashN, dashS, dashC);
    }

    // Dashed lines along West and East Roads
    const dashVGeom = new THREE.PlaneGeometry(1.2, 12.0);
    dashVGeom.rotateX(-Math.PI / 2);

    for (let z = -280; z <= 280; z += 30) {
      const dashW = new THREE.Mesh(dashVGeom, dashMat);
      dashW.position.set(-475, 0.82, z);
      const dashE = new THREE.Mesh(dashVGeom, dashMat);
      dashE.position.set(455, 0.82, z);
      laneMarkingsGroup.add(dashW, dashE);
    }

    streetGroup.add(laneMarkingsGroup);

    // Crosswalks Group
    const crosswalksGroup = new THREE.Group();
    crosswalksGroup.name = 'Crosswalks';

    const zebraMat = new THREE.MeshBasicMaterial({
      color: 0xf1e1b7,
      transparent: true,
      opacity: 0.9,
    });

    const stripeHGeom = new THREE.PlaneGeometry(8.0, 1.8);
    stripeHGeom.rotateX(-Math.PI / 2);

    const crosswalkPositions: [number, number][] = [
      [-202, -315],
      [126, -315],
      [-137, 325],
      [183, 325],
      [-202, 0],
      [126, 0],
    ];

    for (const [cx, cz] of crosswalkPositions) {
      for (let s = -6; s <= 6; s += 3.0) {
        const stripe = new THREE.Mesh(stripeHGeom, zebraMat);
        stripe.position.set(cx + s, 0.82, cz);
        crosswalksGroup.add(stripe);
      }
    }

    streetGroup.add(crosswalksGroup);
    this.environmentGroup.add(streetGroup);
  }

  /**
   * Set up pedestrian sidewalks, stone curbs, post lanterns, and intersection lighting.
   */
  private setupSidewalksAndLamps(): void {
    const sidewalkGroup = new THREE.Group();
    sidewalkGroup.name = 'SidewalkGroup';

    const sidewalkPavingGroup = new THREE.Group();
    sidewalkPavingGroup.name = 'SidewalkPaving';

    const pavingMat = new THREE.MeshStandardMaterial({
      color: 0xbaae9a,
      roughness: 0.78,
      metalness: 0.1,
    });

    // Concrete pedestrian sidewalk slabs framing blocks
    const pavingDefs: Array<{ x: number; z: number; w: number; d: number }> = [
      { x: 0, z: -338, w: 1040, d: 10 },
      { x: 0, z: -292, w: 1040, d: 10 },
      { x: 0, z: 302, w: 1040, d: 10 },
      { x: 0, z: 348, w: 1040, d: 10 },
      { x: -498, z: 0, w: 10, d: 670 },
      { x: -452, z: 0, w: 10, d: 670 },
      { x: 432, z: 0, w: 10, d: 670 },
      { x: 478, z: 0, w: 10, d: 670 },
    ];

    for (const pv of pavingDefs) {
      const geom = new THREE.BoxGeometry(pv.w, 0.6, pv.d);
      const mesh = new THREE.Mesh(geom, pavingMat);
      mesh.position.set(pv.x, 1.4, pv.z);
      sidewalkPavingGroup.add(mesh);
    }
    sidewalkGroup.add(sidewalkPavingGroup);

    // Stone Curbs Group
    const stoneCurbsGroup = new THREE.Group();
    stoneCurbsGroup.name = 'StoneCurbs';

    const curbMat = new THREE.MeshStandardMaterial({
      color: 0x6c7378,
      roughness: 0.85,
      metalness: 0.2,
    });

    const curbDefs: Array<{ x: number; z: number; w: number; d: number }> = [
      { x: 0, z: -333, w: 1040, d: 1.2 },
      { x: 0, z: -297, w: 1040, d: 1.2 },
      { x: 0, z: 307, w: 1040, d: 1.2 },
      { x: 0, z: 343, w: 1040, d: 1.2 },
      { x: -493, z: 0, w: 1.2, d: 670 },
      { x: -457, z: 0, w: 1.2, d: 670 },
      { x: 437, z: 0, w: 1.2, d: 670 },
      { x: 473, z: 0, w: 1.2, d: 670 },
    ];

    for (const cb of curbDefs) {
      const geom = new THREE.BoxGeometry(cb.w, 0.7, cb.d);
      const mesh = new THREE.Mesh(geom, curbMat);
      mesh.position.set(cb.x, 1.15, cb.z);
      stoneCurbsGroup.add(mesh);
    }
    sidewalkGroup.add(stoneCurbsGroup);

    // 18 Street Lamps with glowing bulbs and 4 strategic PointLights
    const streetLampsGroup = new THREE.Group();
    streetLampsGroup.name = 'StreetLamps';

    const postMat = new THREE.MeshStandardMaterial({
      color: 0x2d3748,
      roughness: 0.45,
      metalness: 0.75,
    });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe082 });

    const lampPositions: [number, number][] = [
      // North promenade
      [-380, -336],
      [-202, -336],
      [-20, -336],
      [126, -336],
      [320, -336],
      // South promenade
      [-380, 346],
      [-137, 346],
      [20, 346],
      [183, 346],
      [320, 346],
      // Central boulevard
      [-320, -22],
      [-120, -22],
      [60, -22],
      [260, -22],
      // East river promenade
      [476, -200],
      [476, -50],
      [476, 100],
      [476, 250],
    ];

    const postGeom = new THREE.CylinderGeometry(0.35, 0.55, 12.0, 6);
    const lanternGeom = new THREE.CylinderGeometry(0.9, 0.6, 1.5, 6);
    const bulbGeom = new THREE.SphereGeometry(0.65, 8, 8);
    const armGeom = new THREE.BoxGeometry(2.8, 0.4, 0.4);

    lampPositions.forEach(([lx, lz], idx) => {
      const lamp = new THREE.Group();
      lamp.name = `StreetLamp_${idx}`;
      lamp.position.set(lx, 1.4, lz);

      const post = new THREE.Mesh(postGeom, postMat);
      post.position.y = 6.0;
      lamp.add(post);

      const arm = new THREE.Mesh(armGeom, postMat);
      arm.position.set(1.0, 11.8, 0);
      lamp.add(arm);

      const lantern = new THREE.Mesh(lanternGeom, postMat);
      lantern.position.set(2.2, 11.2, 0);
      lamp.add(lantern);

      const bulb = new THREE.Mesh(bulbGeom, bulbMat);
      bulb.position.set(2.2, 11.0, 0);
      lamp.add(bulb);

      streetLampsGroup.add(lamp);
    });

    // Four strategic PointLights at primary cross intersections
    const crossIntersections: [number, number, string][] = [
      [-202, -315, 'IntersectionLight_1'],
      [126, -315, 'IntersectionLight_2'],
      [-137, 325, 'IntersectionLight_3'],
      [183, 325, 'IntersectionLight_4'],
    ];

    for (const [ix, iz, lname] of crossIntersections) {
      const light = new THREE.PointLight(0xffe082, 0.75, 75);
      light.name = lname;
      light.position.set(ix, 14.0, iz);
      streetLampsGroup.add(light);
    }

    sidewalkGroup.add(streetLampsGroup);
    this.environmentGroup.add(sidewalkGroup);
  }

  /**
   * Set up street trees and pocket park foliage with low-poly compound canopies.
   */
  private setupVegetation(): void {
    const vegetationGroup = new THREE.Group();
    vegetationGroup.name = 'VegetationGroup';

    const streetTreesGroup = new THREE.Group();
    streetTreesGroup.name = 'StreetTrees';

    const pocketParkGroup = new THREE.Group();
    pocketParkGroup.name = 'PocketParkTrees';

    const trunkGeom = new THREE.CylinderGeometry(0.6, 0.95, 6.5, 6);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5a3d28,
      roughness: 0.88,
      metalness: 0.08,
    });

    const basinGeom = new THREE.CylinderGeometry(2.5, 2.0, 0.8, 8);
    const basinMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.8,
      metalness: 0.15,
    });

    const foliageMats = [
      new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.72, metalness: 0.05, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x40916c, roughness: 0.7, metalness: 0.05, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x74c69d, roughness: 0.68, metalness: 0.05, flatShading: true }),
    ];

    const dodecGeoms = [
      new THREE.DodecahedronGeometry(3.8),
      new THREE.DodecahedronGeometry(4.4),
      new THREE.DodecahedronGeometry(3.2),
    ];

    const createTree = (x: number, z: number, offset: number): THREE.Group => {
      const tree = new THREE.Group();
      tree.position.set(x, 1.4, z);

      const basin = new THREE.Mesh(basinGeom, basinMat);
      basin.position.y = 0.4;
      tree.add(basin);

      const trunk = new THREE.Mesh(trunkGeom, trunkMat);
      trunk.position.y = 3.65;
      tree.add(trunk);

      const canopyGroup = new THREE.Group();
      canopyGroup.position.set(0, 7.5, 0);

      const mesh1 = new THREE.Mesh(dodecGeoms[0], foliageMats[0]);
      mesh1.position.set(0, 0, 0);
      const mesh2 = new THREE.Mesh(dodecGeoms[1], foliageMats[1]);
      mesh2.position.set(1.0, 1.8, 0.5);
      const mesh3 = new THREE.Mesh(dodecGeoms[2], foliageMats[2]);
      mesh3.position.set(-0.8, 1.5, -0.6);
      canopyGroup.add(mesh1, mesh2, mesh3);

      tree.add(canopyGroup);
      this.treeCanopies.push({ mesh: canopyGroup, offset });
      return tree;
    };

    // 16 sidewalk trees along avenues
    const sidewalkTreeCoords: [number, number][] = [
      [-340, -336],
      [-260, -336],
      [-80, -336],
      [60, -336],
      [240, -336],
      [360, -336],
      [-340, 346],
      [-240, 346],
      [-40, 346],
      [100, 346],
      [260, 346],
      [360, 346],
      [476, -260],
      [476, -120],
      [476, 20],
      [476, 180],
    ];

    sidewalkTreeCoords.forEach(([tx, tz], i) => {
      const tree = createTree(tx, tz, i * 0.45);
      tree.name = `StreetTree_${i}`;
      streetTreesGroup.add(tree);
    });
    vegetationGroup.add(streetTreesGroup);

    // 8 pocket park trees in western area
    const parkTreeCoords: [number, number][] = [
      [-470, -75],
      [-460, -50],
      [-475, -25],
      [-465, 0],
      [-472, 25],
      [-460, 50],
      [-475, 75],
      [-462, 100],
    ];

    parkTreeCoords.forEach(([px, pz], i) => {
      const tree = createTree(px, pz, (i + 16) * 0.45);
      tree.name = `ParkTree_${i}`;
      pocketParkGroup.add(tree);
    });
    vegetationGroup.add(pocketParkGroup);

    this.environmentGroup.add(vegetationGroup);
  }

  /**
   * Set up moving traffic with scooters, taxis, and cars along closed-loop spline tracks.
   */
  private setupTraffic(): void {
    const trafficGroup = new THREE.Group();
    trafficGroup.name = 'TrafficGroup';

    // Loop A: Outer town perimeter track (counter-clockwise)
    const loopAPoints: THREE.Vector3[] = [
      new THREE.Vector3(-465, 0.8, -315),
      new THREE.Vector3(0, 0.8, -315),
      new THREE.Vector3(445, 0.8, -315),
      new THREE.Vector3(445, 0.8, 0),
      new THREE.Vector3(445, 0.8, 325),
      new THREE.Vector3(0, 0.8, 325),
      new THREE.Vector3(-465, 0.8, 325),
      new THREE.Vector3(-465, 0.8, 0),
    ];
    const trackA = new RoadTrack(loopAPoints);

    // Loop B: Inner central boulevard and cross avenues track (clockwise)
    const loopBPoints: THREE.Vector3[] = [
      new THREE.Vector3(-440, 0.8, -5),
      new THREE.Vector3(-202, 0.8, -5),
      new THREE.Vector3(-202, 0.8, -250),
      new THREE.Vector3(126, 0.8, -250),
      new THREE.Vector3(126, 0.8, 5),
      new THREE.Vector3(420, 0.8, 15),
      new THREE.Vector3(183, 0.8, 15),
      new THREE.Vector3(183, 0.8, 250),
      new THREE.Vector3(-137, 0.8, 250),
      new THREE.Vector3(-137, 0.8, -5),
    ];
    const trackB = new RoadTrack(loopBPoints);

    // Shared vehicle materials
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9, metalness: 0.2 });
    const wheelGeom = new THREE.CylinderGeometry(0.75, 0.75, 0.5, 8);
    wheelGeom.rotateZ(Math.PI / 2);
    const headlampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const taillampMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    // 1. Scooter Factory
    const createScooter = (colorHex: number, helmetColorHex: number): THREE.Group => {
      const sc = new THREE.Group();
      const frameMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4, metalness: 0.4 });
      const frameGeom = new THREE.BoxGeometry(0.9, 1.1, 2.8);
      const frame = new THREE.Mesh(frameGeom, frameMat);
      frame.position.y = 1.0;
      sc.add(frame);

      // Front and rear wheels
      const scWheelGeom = new THREE.CylinderGeometry(0.45, 0.45, 0.28, 8);
      scWheelGeom.rotateZ(Math.PI / 2);
      const frontWheel = new THREE.Mesh(scWheelGeom, wheelMat);
      frontWheel.position.set(0, 0.45, 1.2);
      const rearWheel = new THREE.Mesh(scWheelGeom, wheelMat);
      rearWheel.position.set(0, 0.45, -1.2);
      sc.add(frontWheel, rearWheel);

      // Rider torso and helmet
      const torsoGeom = new THREE.BoxGeometry(0.9, 1.2, 0.7);
      const torsoMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.1 });
      const torso = new THREE.Mesh(torsoGeom, torsoMat);
      torso.position.set(0, 2.0, -0.1);
      sc.add(torso);

      const helmetGeom = new THREE.SphereGeometry(0.45, 6, 6);
      const helmetMat = new THREE.MeshStandardMaterial({ color: helmetColorHex, roughness: 0.3, metalness: 0.5 });
      const helmet = new THREE.Mesh(helmetGeom, helmetMat);
      helmet.position.set(0, 2.9, -0.1);
      sc.add(helmet);

      // Headlight
      const headGeom = new THREE.BoxGeometry(0.35, 0.35, 0.15);
      const headlight = new THREE.Mesh(headGeom, headlampMat);
      headlight.position.set(0, 1.3, 1.45);
      sc.add(headlight);

      return sc;
    };

    // 2. Car Factory
    const createCar = (bodyColorHex: number, isTaxi = false): THREE.Group => {
      const car = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColorHex, roughness: 0.35, metalness: 0.45 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1, metalness: 0.9 });

      // Chassis
      const chassisGeom = new THREE.BoxGeometry(3.8, 1.4, 7.8);
      const chassis = new THREE.Mesh(chassisGeom, bodyMat);
      chassis.position.y = 1.1;
      car.add(chassis);

      // Cabin
      const cabinGeom = new THREE.BoxGeometry(3.2, 1.2, 4.4);
      const cabin = new THREE.Mesh(cabinGeom, glassMat);
      cabin.position.set(0, 2.2, -0.4);
      car.add(cabin);

      // 4 Wheels
      const wCoords: [number, number][] = [
        [-1.9, 2.2],
        [1.9, 2.2],
        [-1.9, -2.2],
        [1.9, -2.2],
      ];
      for (const [wx, wz] of wCoords) {
        const wheel = new THREE.Mesh(wheelGeom, wheelMat);
        wheel.position.set(wx, 0.75, wz);
        car.add(wheel);
      }

      // Lights
      const headGeom = new THREE.BoxGeometry(0.6, 0.4, 0.15);
      const headL = new THREE.Mesh(headGeom, headlampMat);
      headL.position.set(-1.2, 1.2, 3.95);
      const headR = new THREE.Mesh(headGeom, headlampMat);
      headR.position.set(1.2, 1.2, 3.95);
      car.add(headL, headR);

      const tailGeom = new THREE.BoxGeometry(0.6, 0.4, 0.15);
      const tailL = new THREE.Mesh(tailGeom, taillampMat);
      tailL.position.set(-1.2, 1.2, -3.95);
      const tailR = new THREE.Mesh(tailGeom, taillampMat);
      tailR.position.set(1.2, 1.2, -3.95);
      car.add(tailL, tailR);

      if (isTaxi) {
        const taxiSignGeom = new THREE.BoxGeometry(1.1, 0.45, 0.45);
        const taxiSignMat = new THREE.MeshBasicMaterial({ color: 0x00e676 });
        const sign = new THREE.Mesh(taxiSignGeom, taxiSignMat);
        sign.position.set(0, 3.0, -0.4);
        car.add(sign);
      }

      return car;
    };

    // Vehicle 0: Robin emerald scooter on Loop A
    const scooter0 = createScooter(0x00c805, 0xf8fafc);
    scooter0.name = 'scooter_0';
    this.trafficVehicles.push({ mesh: scooter0, track: trackA, distance: 0, speed: 65.0 });
    trafficGroup.add(scooter0);

    // Vehicle 1: Bullion gold scooter on Loop B
    const scooter1 = createScooter(0xeec353, 0xffd700);
    scooter1.name = 'scooter_1';
    this.trafficVehicles.push({ mesh: scooter1, track: trackB, distance: 100, speed: 55.0 });
    trafficGroup.add(scooter1);

    // Vehicle 2: Robin taxi on Loop A
    const taxi0 = createCar(0x00c805, true);
    taxi0.name = 'taxi_0';
    this.trafficVehicles.push({ mesh: taxi0, track: trackA, distance: 450, speed: 50.0 });
    trafficGroup.add(taxi0);

    // Vehicle 3: Sunset coral sedan on Loop B
    const car1 = createCar(0xff7043, false);
    car1.name = 'car_1';
    this.trafficVehicles.push({ mesh: car1, track: trackB, distance: 350, speed: 45.0 });
    trafficGroup.add(car1);

    this.environmentGroup.add(trafficGroup);
  }

  /**
   * Set up 22 modular neighborhood shophouses framing the outer town diorama.
   */
  private setupPeripheralHouses(): void {
    const peripheralHousesGroup = new THREE.Group();
    peripheralHousesGroup.name = 'PeripheralHousesGroup';

    const northHousesGroup = new THREE.Group();
    northHousesGroup.name = 'northHousesGroup';

    const southHousesGroup = new THREE.Group();
    southHousesGroup.name = 'southHousesGroup';

    const westHousesGroup = new THREE.Group();
    westHousesGroup.name = 'westHousesGroup';

    const facadePalette = [
      0xeadfb7, // Colonial cream
      0xc9a267, // Ochre gold
      0x8aaca0, // Jade mint
      0xba7056, // Terracotta brick
      0x6fa0c9, // Dusty blue
    ];

    const roofMat = new THREE.MeshStandardMaterial({ color: 0xb17650, roughness: 0.8, metalness: 0.1 });
    const balconyMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.7 });
    const tankMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.2, metalness: 0.9 });
    const tankGeom = new THREE.CylinderGeometry(1.2, 1.2, 2.8, 8);
    tankGeom.rotateZ(Math.PI / 2);

    const createHouse = (name: string, x: number, z: number, rotY: number, colorIdx: number, stories: number): THREE.Group => {
      const house = new THREE.Group();
      house.name = name;
      house.position.set(x, 1.4, z);
      house.rotation.y = rotY;

      const facadeColor = facadePalette[colorIdx % facadePalette.length];
      const facadeMat = new THREE.MeshStandardMaterial({ color: facadeColor, roughness: 0.65, metalness: 0.1 });

      const totalH = stories * 7.5;
      const bodyGeom = new THREE.BoxGeometry(14.0, totalH, 20.0);
      const body = new THREE.Mesh(bodyGeom, facadeMat);
      body.position.y = totalH / 2;
      house.add(body);

      // Cantilevered front balcony on story 2
      const balconyGeom = new THREE.BoxGeometry(12.0, 1.2, 3.5);
      const balcony = new THREE.Mesh(balconyGeom, balconyMat);
      balcony.position.set(0, 7.5, 11.0);
      house.add(balcony);

      // Roof: clay tile gable or flat terrace with stainless steel water tank
      if (stories % 2 === 0) {
        const roofGeom = new THREE.ConeGeometry(12.0, 4.0, 4);
        roofGeom.rotateY(Math.PI / 4);
        const roof = new THREE.Mesh(roofGeom, roofMat);
        roof.position.y = totalH + 2.0;
        house.add(roof);
      } else {
        const waterTank = new THREE.Mesh(tankGeom, tankMat);
        waterTank.position.set(2.5, totalH + 1.6, -3.0);
        house.add(waterTank);
      }

      return house;
    };

    // 8 North townhouses along z = -360
    const northXCoords = [-420, -300, -180, -60, 60, 180, 300, 420];
    northXCoords.forEach((nx, i) => {
      const house = createHouse(`NorthHouse_${i}`, nx, -360, 0, i, 2 + (i % 3));
      northHousesGroup.add(house);
    });
    peripheralHousesGroup.add(northHousesGroup);

    // 8 South townhouses along z = 360
    const southXCoords = [-420, -300, -180, -60, 60, 180, 300, 420];
    southXCoords.forEach((sx, i) => {
      const house = createHouse(`SouthHouse_${i}`, sx, 360, Math.PI, i + 2, 2 + ((i + 1) % 3));
      southHousesGroup.add(house);
    });
    peripheralHousesGroup.add(southHousesGroup);

    // 6 West townhouses along x = -515
    const westZCoords = [-250, -150, -50, 50, 150, 250];
    westZCoords.forEach((wz, i) => {
      const house = createHouse(`WestHouse_${i}`, -515, wz, Math.PI / 2, i + 4, 3);
      westHousesGroup.add(house);
    });
    peripheralHousesGroup.add(westHousesGroup);

    this.environmentGroup.add(peripheralHousesGroup);
  }

  /**
   * Update dynamic living town animations on each frame tick:
   * canal water breathing, sampan boat travel and rocking, vehicular traffic, and tree sway.
   */
  public updateLivingTown(timestamp: number): void {
    if (!Number.isFinite(timestamp)) {
      return;
    }
    if (this.lastAnimTimestamp === 0 || timestamp < this.lastAnimTimestamp) {
      this.lastAnimTimestamp = timestamp;
      return;
    }
    const dt = Math.max(0.0, Math.min((timestamp - this.lastAnimTimestamp) * 0.001, 0.1));
    this.lastAnimTimestamp = timestamp;
    const timeSec = timestamp * 0.001;

    // 1. Canal water gentle elevation breathing
    if (this.canalWaterMesh) {
      this.canalWaterMesh.position.y = -0.3 + Math.sin(timeSec * 1.6) * 0.05;
    }

    // 2. Animated sampan boat travel and buoyancy rocking
    for (const boat of this.boatList) {
      boat.z += boat.speed * dt;
      if (boat.speed > 0) {
        if (boat.z > 340 || boat.z < -340) {
          boat.z = -340;
        }
      } else if (boat.speed < 0) {
        if (boat.z < -340 || boat.z > 340) {
          boat.z = 340;
        }
      }
      boat.mesh.position.set(
        boat.x,
        -0.25 + Math.sin(timeSec * 2.2 + boat.phase) * 0.12,
        boat.z
      );
      boat.mesh.rotation.z = Math.sin(timeSec * 1.8 + boat.phase) * 0.045; // roll
      boat.mesh.rotation.x = Math.cos(timeSec * 1.4 + boat.phase) * 0.03; // pitch
    }

    // 3. Vehicular traffic along closed loops
    for (const v of this.trafficVehicles) {
      v.distance = (v.distance + v.speed * dt) % v.track.length;
      if (v.distance < 0) {
        v.distance = ((v.distance % v.track.length) + v.track.length) % v.track.length;
      }
      const { pos, yaw } = v.track.at(v.distance);
      v.mesh.position.set(pos.x, 0.85 + Math.sin(v.distance * 0.5) * 0.02, pos.z);
      v.mesh.rotation.y = yaw;
    }

    // 4. Tree canopy wind sway
    for (const c of this.treeCanopies) {
      c.mesh.rotation.z = Math.sin(timeSec * 1.5 + c.offset) * 0.03;
      c.mesh.rotation.x = Math.cos(timeSec * 1.2 + c.offset) * 0.02;
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

    const offsetX = this.cameraDistance * cosElev * sinAzim;
    const offsetY = this.cameraDistance * sinElev;
    const offsetZ = this.cameraDistance * cosElev * cosAzim;

    const cameraPos = new THREE.Vector3(
      this.cameraTarget.x + offsetX,
      this.cameraTarget.y + offsetY,
      this.cameraTarget.z + offsetZ
    );

    this.orthoCamera.position.copy(cameraPos);
    this.orthoCamera.lookAt(this.cameraTarget);

    this.perspCamera.position.copy(cameraPos);
    this.perspCamera.lookAt(this.cameraTarget);
  }

  /**
   * Mount renderer to DOM container and begin render loop (browser mode).
   */
  public mount(): void {
    if (!isWebGLAvailable()) {
      return;
    }

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      this.renderer.setSize(this.width, this.height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      const domElement = this.renderer.domElement;
      domElement.style.display = 'block';
      domElement.style.width = '100%';
      domElement.style.height = '100%';
      domElement.style.touchAction = 'none';

      if (this.options.container && typeof this.options.container.appendChild === 'function') {
        this.options.container.appendChild(domElement);
      }

      // Attach interaction listeners
      domElement.addEventListener('pointerdown', this.onPointerDownBound);
      domElement.addEventListener('pointermove', this.onPointerMoveBound);
      domElement.addEventListener('pointerup', this.onPointerUpBound);
      domElement.addEventListener('wheel', this.onWheelBound, { passive: false });
      window.addEventListener('resize', this.onResizeBound);

      // Start animation loop
      this.isPaused = false;
      this.startAnimationLoop();
    } catch {
      this.renderer = null;
    }
  }

  /**
   * Pause the 3D animation loop to suspend GPU and CPU consumption during 2D mode.
   */
  public pause(): void {
    this.isPaused = true;
    if (this.animFrameId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * Resume the 3D animation loop when returning from 2D mode.
   */
  public resume(): void {
    if (!this.isPaused) {
      return;
    }
    this.isPaused = false;
    this.lastAnimTimestamp = 0;
    if (this.renderer && this.animFrameId === null) {
      this.startAnimationLoop();
    }
  }

  /**
   * Animation render loop updating halos, lerps, and rendering scene.
   */
  private startAnimationLoop(): void {
    if (this.isPaused || this.animFrameId !== null) {
      return;
    }

    const animate = (timestamp: number) => {
      if (this.isPaused) {
        this.animFrameId = null;
        return;
      }

      this.updateAnimations(timestamp);

      if (this.renderer) {
        this.renderer.render(this.scene, this.activeCamera);
      }

      this.animFrameId = requestAnimationFrame(animate);
    };

    this.animFrameId = requestAnimationFrame(animate);
  }

  /**
   * Update continuous animations: living town environment, golden auras, camera transition lerp, target lerps.
   */
  private updateAnimations(timestamp: number): void {
    if (!Number.isFinite(timestamp)) {
      return;
    }
    // Living town environment animations
    this.updateLivingTown(timestamp);

    // Golden aura pulsating bob and rotation
    const timeSec = timestamp * 0.001;
    for (const child of this.goldenAuraGroup.children) {
      if (child.name.startsWith('GoldenCrown_')) {
        child.rotation.y += 0.02;
        child.position.y = ELEVATION_GOLDEN_CROWN + Math.sin(timeSec * 2.5) * 1.2;
      }
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
  }

  /**
   * Unmount renderer, cancel animations, detach DOM listeners, and dispose resources.
   */
  public unmount(): void {
    this.isPaused = true;
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
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', this.onResizeBound);
      }

      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
      this.renderer.dispose();
      this.renderer = null;
    }

    // Systematic geometry and material disposal
    disposeHierarchy(this.scene);
    for (const building of this.buildingMeshes.values()) {
      disposeHierarchy(building);
    }
    this.buildingMeshes.clear();
    for (const prop of this.parcelPropMeshes.values()) {
      disposeHierarchy(prop);
    }
    this.parcelPropMeshes.clear();
    this.lastAnimTimestamp = 0;
  }

  /**
   * Synchronize 3D board scene with incoming GameState and selected lot ID.
   */
  public render(state: GameState, selectedLotId: number | null = null): void {
    this.selectedLotId = selectedLotId;

    // Detect completed clusters
    const allClusters = findAllClusters(state.lots);
    const clusterMap = new Map<number, ShopCluster>();
    for (const cluster of allClusters) {
      for (const lotId of cluster.lots) {
        clusterMap.set(lotId, cluster);
      }
    }

    // Clear and rebuild golden auras
    while (this.goldenAuraGroup.children.length > 0) {
      const child = this.goldenAuraGroup.children[0];
      this.goldenAuraGroup.remove(child);
      disposeHierarchy(child);
    }

    // Render golden cluster markers
    for (const cluster of allClusters) {
      if (cluster.isComplete && cluster.lots.length > 0) {
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
        const rootLotId = cluster.lots[0];
        const rootDef = LOT_DEFINITIONS[rootLotId];
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
        this.goldenAuraGroup.add(crownMesh);
      }
    }

    // Update 72 parcels and procedural buildings
    for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
      const lot = state.lots[lotId];
      const mesh = this.parcelHitMeshes[lotId];
      const mat = this.parcelMaterials[lotId];
      const def = LOT_DEFINITIONS[lotId];
      const basePos = getParcelWorldPosition(def.x, def.y, ELEVATION_PARCEL_BASE);

      const isSelected = this.selectedLotId === lotId;
      const isHovered = this.hoveredLotId === lotId;

      // Vertical elevation lift: selection lifts +2.0, hover lifts +1.0
      let elevationY = ELEVATION_PARCEL_BASE;
      if (isSelected) {
        elevationY = ELEVATION_PARCEL_SELECTED;
      } else if (isHovered) {
        elevationY = ELEVATION_PARCEL_HOVER;
      }
      mesh.position.set(basePos[0], elevationY, basePos[2]);

      // Dynamic material colors
      if (isSelected) {
        mat.color.setHex(0x00c805); // Robin emerald
        mat.emissive.setHex(0x00c805);
        mat.emissiveIntensity = 0.85;
      } else if (isHovered) {
        mat.color.setHex(0x00f0ff); // Cyber cyan
        mat.emissive.setHex(0x00f0ff);
        mat.emissiveIntensity = 0.6;
      } else if (lot.owner !== null && lot.shop !== null) {
        // Built shop parcel: protocol category color
        const cat = SHOP_VISUAL_CATEGORIES[lot.shop] || SHOP_VISUAL_CATEGORIES[0];
        mat.color.set(cat.colorHex);
        mat.emissive.set(cat.colorHex);
        mat.emissiveIntensity = 0.25;
      } else if (lot.owner !== null) {
        // Owned unbuilt parcel: player ownership color
        const ownerHex = PLAYER_HEX_COLORS[lot.owner] || PLAYER_HEX_COLORS[0];
        mat.color.set(ownerHex);
        mat.emissive.set(ownerHex);
        mat.emissiveIntensity = 0.35;
      } else if (state.phase === 'receive' && Array.isArray(state.pending) && state.pending.includes(lotId)) {
        // Candidate parcel currently dealt to the player in Phase 1
        mat.color.setHex(0xeec353);
        mat.emissive.setHex(0xeec353);
        mat.emissiveIntensity = 0.45;
      } else {
        // Unowned lot
        mat.color.setHex(0x1e293b);
        mat.emissive.setHex(0x0f172a);
        mat.emissiveIntensity = 0.15;
      }

      // 4 Lot Lifecycle Models synchronization
      const cluster = clusterMap.get(lotId);
      const clusterSize = cluster ? cluster.size : 1;
      const isComplete = cluster ? cluster.isComplete : false;
      const stage = determineLotStage(lot, isComplete);

      const existingProp = this.parcelPropMeshes.get(lotId);
      const existingBuilding = this.buildingMeshes.get(lotId);

      if (stage === 'vacant') {
        // Demolish or remove building if present
        if (existingBuilding) {
          disposeHierarchy(existingBuilding);
          this.buildingGroup.remove(existingBuilding);
          this.buildingMeshes.delete(lotId);
        }
        // Ensure vacant lot model attached to parcel mesh
        if (!existingProp || existingProp.userData.stage !== 'vacant') {
          if (existingProp) {
            disposeHierarchy(existingProp);
            mesh.remove(existingProp);
          }
          const vacantModel = createVacantLotModel(lotId);
          vacantModel.userData = { stage: 'vacant' };
          vacantModel.position.set(0, 1.0, 0);
          this.parcelPropMeshes.set(lotId, vacantModel);
          mesh.add(vacantModel);
        }
      } else if (stage === 'claimed') {
        // Demolish or remove building if present
        if (existingBuilding) {
          disposeHierarchy(existingBuilding);
          this.buildingGroup.remove(existingBuilding);
          this.buildingMeshes.delete(lotId);
        }
        // Ensure claimed lot model with matching owner attached to parcel mesh
        if (
          !existingProp ||
          existingProp.userData.stage !== 'claimed' ||
          existingProp.userData.owner !== lot.owner
        ) {
          if (existingProp) {
            disposeHierarchy(existingProp);
            mesh.remove(existingProp);
          }
          const claimedModel = createClaimedLotModel(lotId, lot.owner ?? 0);
          claimedModel.userData = { stage: 'claimed', owner: lot.owner };
          claimedModel.position.set(0, 1.0, 0);
          this.parcelPropMeshes.set(lotId, claimedModel);
          mesh.add(claimedModel);
        }
      } else {
        // Built shop parcel: constructed or completed
        // Remove parcel unbuilt prop if present
        if (existingProp) {
          disposeHierarchy(existingProp);
          mesh.remove(existingProp);
          this.parcelPropMeshes.delete(lotId);
        }

        // Recreate or update building in buildingGroup
        if (
          !existingBuilding ||
          existingBuilding.userData.shopType !== lot.shop ||
          existingBuilding.userData.clusterSize !== clusterSize ||
          existingBuilding.userData.isComplete !== isComplete
        ) {
          if (existingBuilding) {
            disposeHierarchy(existingBuilding);
            this.buildingGroup.remove(existingBuilding);
          }
          const newBuilding = createShopBuilding(lot.shop!, clusterSize, isComplete);
          newBuilding.userData = { shopType: lot.shop, clusterSize, isComplete };
          newBuilding.position.set(basePos[0], elevationY + 1.0, basePos[2]);
          this.buildingMeshes.set(lotId, newBuilding);
          this.buildingGroup.add(newBuilding);
        } else {
          existingBuilding.position.set(basePos[0], elevationY + 1.0, basePos[2]);
        }
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
   * Reset camera target to board center and reset zoom.
   */
  public resetCamera(): void {
    this.targetCameraTarget.set(0, 0, 0);
    this.targetCameraDistance = 600;
    this.orthoCamera.zoom = 1.0;
    this.orthoCamera.updateProjectionMatrix();
  }

  /**
   * Toggle between isometric orthographic and perspective orbit camera modes.
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
      this.targetCameraDistance = 600;
    } else {
      // Perspective mode matched distance
      this.cameraAzimuth = Math.PI / 4;
      this.cameraElevation = (35 * Math.PI) / 180;
      this.targetCameraDistance = 600;
    }
  }

  /**
   * Update viewport dimensions, renderer resolution, and camera projection matrices.
   */
  public resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;

    if (this.renderer) {
      this.renderer.setSize(width, height);
    }

    const aspect = width / height;
    const frustumSize = 720;

    this.orthoCamera.left = (-frustumSize * aspect) / 2;
    this.orthoCamera.right = (frustumSize * aspect) / 2;
    this.orthoCamera.top = frustumSize / 2;
    this.orthoCamera.bottom = -frustumSize / 2;
    this.orthoCamera.updateProjectionMatrix();

    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();
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
  }

  private handlePointerMove(e: PointerEvent): void {
    if (e.buttons !== undefined && e.buttons === 0) {
      this.isDragging = false;
      this.isPointerDown = false;
    }

    if (this.isPointerDown) {
      const dx = e.clientX - this.pointerDownPos.x;
      const dy = e.clientY - this.pointerDownPos.y;
      const dist = Math.hypot(dx, dy);

      if (dist > this.DRAG_THRESHOLD_PX) {
        this.isDragging = true;
        // If dragging with primary button in perspective mode, orbit camera
        if (e.buttons === 1 && this.cameraMode === 'perspective') {
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
    if (this.isPointerDown && !this.isDragging && elapsed < this.CLICK_TIME_LIMIT_MS) {
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
  }

  private updateParcelElevation(lotId: number | null): void {
    if (lotId === null || lotId < 0 || lotId >= TOTAL_LOTS) return;
    const mesh = this.parcelHitMeshes[lotId];
    if (!mesh) return;
    const def = LOT_DEFINITIONS[lotId];
    const basePos = getParcelWorldPosition(def.x, def.y, ELEVATION_PARCEL_BASE);
    const isSelected = this.selectedLotId === lotId;
    const isHovered = this.hoveredLotId === lotId;
    let elevationY = ELEVATION_PARCEL_BASE;
    if (isSelected) {
      elevationY = ELEVATION_PARCEL_SELECTED;
    } else if (isHovered) {
      elevationY = ELEVATION_PARCEL_HOVER;
    }
    mesh.position.set(basePos[0], elevationY, basePos[2]);

    const building = this.buildingMeshes.get(lotId);
    if (building) {
      building.position.set(basePos[0], elevationY + 1.0, basePos[2]);
    }
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    if (this.cameraMode === 'isometric') {
      const zoomDelta = e.deltaY * -0.001;
      this.orthoCamera.zoom = Math.max(0.5, Math.min(2.5, this.orthoCamera.zoom + zoomDelta));
      this.orthoCamera.updateProjectionMatrix();
    } else {
      this.targetCameraDistance = Math.max(
        100,
        Math.min(550, this.targetCameraDistance + e.deltaY * 0.3)
      );
    }
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

  public getEnvironmentGroup(): THREE.Group {
    return this.environmentGroup;
  }

  public getCanalWaterMesh(): THREE.Mesh | null {
    return this.canalWaterMesh;
  }

  public getCanalWater(): THREE.Mesh | null {
    return this.canalWaterMesh;
  }

  public getTrafficVehicles(): AnimatedTrafficVehicle[] {
    return [...this.trafficVehicles];
  }

  public getTraffic(): AnimatedTrafficVehicle[] {
    return [...this.trafficVehicles];
  }

  public getBoatList(): AnimatedBoat[] {
    return [...this.boatList];
  }

  public getBoats(): AnimatedBoat[] {
    return [...this.boatList];
  }

  public getTreeCanopies(): SwayingTreeCanopy[] {
    return [...this.treeCanopies];
  }

  public getParcelPropMesh(lotId: number): THREE.Group | undefined {
    return this.parcelPropMeshes.get(lotId);
  }

  public getParcelProps(): Record<number, THREE.Group> {
    const props: Record<number, THREE.Group> = {};
    for (const [id, mesh] of this.parcelPropMeshes.entries()) {
      props[id] = mesh;
    }
    return props;
  }

  public getLivingConfig(): LivingTownConfig {
    return { ...this.livingConfig };
  }
}
