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
import { PixelPost } from './pixel-post';

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

const BOARD_FIT_HEIGHT = 40;
const BOARD_FIT_PADDING = 1.06;
const PAN_LIMIT = 380;
const WALK_LOOP = 2 * (2 * 126 + 2 * 132);
const MOTE_CEILING = 180;
const BUILD_RISE_MS = 400;
const SINK_MS = 300;
const EMPTY_PARCEL_HEX = 0x2d3a56;
const FLAG_POLE_GEOM = new THREE.CylinderGeometry(0.5, 0.5, 16, 6);
const FLAG_CLOTH_GEOM = new THREE.BoxGeometry(8, 5, 0.6);

// Valid build target: violet, distinct from every PLAYER_HEX_COLORS entry
export const BUILDABLE_HIGHLIGHT_HEX = 0xc77dff;

const DUSK_COLOR = new THREE.Color(0x8fa8ff);

/**
 * Point on a rectangular loop (half-extents 126 x 132) at distance d along its perimeter.
 */
export function perimeterPoint(d: number): [number, number] {
  const hw = 126;
  const hd = 132;
  const w = 2 * hw;
  const h = 2 * hd;
  let t = ((d % (2 * (w + h))) + 2 * (w + h)) % (2 * (w + h));
  if (t < w) return [-hw + t, -hd];
  t -= w;
  if (t < h) return [hw, -hd + t];
  t -= h;
  if (t < w) return [hw - t, hd];
  t -= w;
  return [-hw, hd - t];
}

/** Ease-out-back: overshoots slightly before settling at 1. */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = Math.min(Math.max(t, 0), 1);
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

// Player palette
export const PLAYER_HEX_COLORS: readonly string[] = Object.freeze([
  '#00C805', // Player 0: Robin Emerald
  '#EEC353', // Player 1: Bullion Gold
  '#29B6F6', // Player 2: Ocean Cyan
  '#FF7043', // Player 3: Sunset Coral
]);

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

  // Blinking rooftop beacon (animated by the renderer)
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff4d4d })
  );
  beacon.name = 'RooftopBeacon';
  beacon.position.set(14, totalHeight + 12, -14);
  group.add(beacon);

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
  /** Fired when a cluster becomes complete (after the initial sync). */
  onClusterComplete?: () => void;
}

/** Short-lived expanding ring / burst effect. */
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

  // Parcel and Raycast Target Registry
  private parcelHitMeshes: THREE.Mesh[] = [];
  private parcelMaterials: THREE.MeshStandardMaterial[] = [];
  private buildingMeshes = new Map<number, THREE.Group>();

  // Tweened state (current vs. target parcel height) and pulse/label bookkeeping
  private lotCurrentY: number[] = [];
  private lotTargetY: number[] = [];
  private lotPulseBase: number[] = [];
  private lotPulseAmp: number[] = [];
  private ownerFlags: THREE.Mesh[] = [];
  private labelSprites = new Map<number, THREE.Sprite>();
  private ambientGroup: THREE.Group;
  private pixelPost: PixelPost | null = null;
  private pixelMode = false;
  private motes: THREE.Points | null = null;
  private walkers: { group: THREE.Group; district: number; offset: number; speed: number }[] = [];
  private sunLight: THREE.DirectionalLight | null = null;
  private ambientLightRef: THREE.AmbientLight | null = null;
  private targetDusk = 0;
  private dusk = 0;
  private effects: RingEffect[] = [];
  private sinking: SinkingBuilding[] = [];
  private completeSignature: string | null = null;
  private highlightLotId: number | null = null;
  private lastRender: { state: GameState; selected: number | null; overlay: Board3DOverlay } | null =
    null;
  private lastFrameTime = 0;

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

    this.boardGroup.add(
      this.districtGroup,
      this.parcelGroup,
      this.buildingGroup,
      this.goldenAuraGroup
    );
    this.ambientGroup = new THREE.Group();
    this.ambientGroup.name = 'AmbientGroup';
    this.scene.add(this.boardGroup, this.lightingGroup, this.ambientGroup);

    // Initialize dual cameras
    const aspect = this.width / this.height;
    this.orthoCamera = new THREE.OrthographicCamera(-360 * aspect, 360 * aspect, 360, -360, 0.1, 2000);

    this.perspCamera = new THREE.PerspectiveCamera(38, aspect, 1, 2000);
    this.activeCamera = this.orthoCamera;
    this.updateCameraPositions();
    this.fitOrthoFrustum();

    // Setup scene lighting
    this.setupLighting();

    // Setup 6 district slabs
    this.setupDistrictSlabs();

    // Setup 72 parcel meshes
    this.setupParcelMeshes();

    // Ground glow, grid and drifting motes behind the board
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
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -420;
    sunLight.shadow.camera.right = 420;
    sunLight.shadow.camera.top = 420;
    sunLight.shadow.camera.bottom = -420;
    sunLight.shadow.camera.near = 100;
    sunLight.shadow.camera.far = 1400;
    sunLight.shadow.bias = -0.0006;

    const fillLight = new THREE.DirectionalLight(0x7aa2f7, 0.5);
    fillLight.name = 'FillLight';
    fillLight.position.set(-300, 300, -200);

    this.sunLight = sunLight;
    this.ambientLightRef = ambientLight;
    this.lightingGroup.add(ambientLight, sunLight, fillLight);

    // Add subtle colored point lights above each of the 6 districts
    for (const district of DISTRICT_BLOCKS) {
      const slabCenter = this.getDistrictCenter3D(district);
      const districtLight = new THREE.PointLight(district.accentHex, 0.55, 180);
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
        color: 0x24304a,
        roughness: 0.6,
        metalness: 0.3,
      });
      const slabMesh = new THREE.Mesh(slabGeom, slabMat);
      slabMesh.receiveShadow = true;
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
   * Fill the empty backdrop: radial ground glow, a faint grid and drifting light motes.
   */
  private setupAmbient(): void {
    if (typeof document !== 'undefined') {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, 'rgba(38, 78, 120, 0.85)');
        grad.addColorStop(0.45, 'rgba(24, 40, 80, 0.45)');
        grad.addColorStop(1, 'rgba(7, 10, 18, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        const disc = new THREE.Mesh(
          new THREE.PlaneGeometry(1500, 1500),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = -3;
        disc.name = 'GroundGlow';
        this.ambientGroup.add(disc);
      }
    }

    const grid = new THREE.GridHelper(1500, 30, 0x2a4a7a, 0x1b2a44);
    const gridMat = grid.material as THREE.LineBasicMaterial;
    gridMat.transparent = true;
    gridMat.opacity = 0.35;
    gridMat.depthWrite = false;
    grid.position.y = -2.5;
    grid.name = 'GroundGrid';
    this.ambientGroup.add(grid);

    // Motes drift upward and wrap around, like pixels of data rising off the city
    const count = 140;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1100;
      positions[i * 3 + 1] = Math.random() * MOTE_CEILING;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 900;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.motes = new THREE.Points(
      geom,
      new THREE.PointsMaterial({
        color: 0x7fd8ff,
        size: 2.6,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.motes.name = 'DriftMotes';
    this.ambientGroup.add(this.motes);

    // Tiny pedestrians strolling the street around each district slab
    const bodyGeom = new THREE.BoxGeometry(1.6, 3.2, 1.6);
    const headGeom = new THREE.BoxGeometry(1.3, 1.3, 1.3);
    const palette = [0xe5e7eb, 0xeec353, 0x29b6f6, 0xff7043, 0x00c805];
    for (const district of DISTRICT_BLOCKS) {
      for (let n = 0; n < 3; n++) {
        const walker = new THREE.Group();
        walker.name = `Walker_${district.id}_${n}`;
        const body = new THREE.Mesh(bodyGeom, new THREE.MeshStandardMaterial({ color: palette[(district.id + n) % palette.length] }));
        body.position.y = 1.6;
        const head = new THREE.Mesh(headGeom, new THREE.MeshStandardMaterial({ color: 0xf1d3b0 }));
        head.position.y = 3.8;
        walker.add(body, head);
        this.ambientGroup.add(walker);
        this.walkers.push({
          group: walker,
          district: district.id,
          offset: (n / 3) * WALK_LOOP + district.id * 40,
          speed: (n % 2 === 0 ? 1 : -1) * (10 + n * 3),
        });
      }
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
        color: EMPTY_PARCEL_HEX,
        roughness: 0.6,
        metalness: 0.15,
      });
      this.parcelMaterials[lotId] = mat;

      const mesh = new THREE.Mesh(sharedGeom, mat);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.lotCurrentY[lotId] = ELEVATION_PARCEL_BASE;
      this.lotTargetY[lotId] = ELEVATION_PARCEL_BASE;
      this.lotPulseBase[lotId] = 0;
      this.lotPulseAmp[lotId] = 0;

      // Owner flag at the parcel corner: stays visible once a building covers the lot
      const flag = new THREE.Group();
      const pole = new THREE.Mesh(
        FLAG_POLE_GEOM,
        new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.4, metalness: 0.5 })
      );
      pole.position.y = 8;
      const cloth = new THREE.Mesh(FLAG_CLOTH_GEOM, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      cloth.position.set(4, 13, 0);
      flag.add(pole, cloth);
      flag.position.set(-21.5, parcelHeight / 2, 21.5);
      flag.visible = false;
      mesh.add(flag);
      this.ownerFlags[lotId] = cloth;
      (cloth.userData as { flag: THREE.Group }).flag = flag;

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
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
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
      this.updateAnimations(timestamp);

      if (this.renderer) {
        if (this.pixelMode && this.pixelPost) {
          this.pixelPost.render(this.scene, this.activeCamera);
        } else {
          this.renderer.render(this.scene, this.activeCamera);
        }
      }

      this.animFrameId = requestAnimationFrame(animate);
    };

    this.animFrameId = requestAnimationFrame(animate);
  }

  /**
   * Update continuous animations: parcel height tweens, building rise/sink,
   * pulsing highlights, golden auras, ring effects and camera lerps.
   */
  private updateAnimations(timestamp: number): void {
    const timeSec = timestamp * 0.001;
    const dt = this.lastFrameTime ? Math.min((timestamp - this.lastFrameTime) / 1000, 0.1) : 0.016;
    this.lastFrameTime = timestamp;
    const follow = 1 - Math.exp(-dt * 14);

    for (const child of this.goldenAuraGroup.children) {
      if (child.name.startsWith('GoldenCrown_')) {
        child.rotation.y += 0.02;
        child.position.y = ELEVATION_GOLDEN_CROWN + Math.sin(timeSec * 2.5) * 1.2;
      }
    }

    // Parcels ease toward their target height; buildings and labels ride along
    for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
      const mesh = this.parcelHitMeshes[lotId];
      const current = this.lotCurrentY[lotId];
      const target = this.lotTargetY[lotId];
      if (Math.abs(target - current) > 0.001) {
        this.lotCurrentY[lotId] = current + (target - current) * follow;
      } else {
        this.lotCurrentY[lotId] = target;
      }
      mesh.position.y = this.lotCurrentY[lotId];

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
          const t = (performance.now() - birth) / BUILD_RISE_MS;
          const baseScaleY = building.userData.baseScaleY as number;
          if (t >= 1) {
            building.scale.y = baseScaleY;
            delete building.userData.birth;
          } else {
            building.scale.y = Math.max(0.001, baseScaleY * easeOutBack(t));
          }
        }
      }
    }

    // Demolished buildings sink, then are removed
    const now = performance.now();
    this.sinking = this.sinking.filter((entry) => {
      const t = (now - entry.start) / SINK_MS;
      if (t >= 1) {
        this.buildingGroup.remove(entry.group);
        disposeHierarchy(entry.group);
        return false;
      }
      entry.group.scale.y = Math.max(0.001, entry.group.userData.baseScaleY * (1 - t * t));
      return true;
    });

    // Expanding ring bursts (build dust, cluster-complete shockwave)
    this.effects = this.effects.filter((fx) => {
      const t = (now - fx.start) / fx.duration;
      if (t >= 1) {
        this.boardGroup.remove(fx.mesh);
        disposeHierarchy(fx.mesh);
        return false;
      }
      const scale = 1 + (fx.maxScale - 1) * (1 - Math.pow(1 - t, 3));
      fx.mesh.scale.set(scale, 1, scale);
      (fx.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
      return true;
    });

    // Day to night drift across the six epochs
    this.dusk += (this.targetDusk - this.dusk) * (1 - Math.exp(-dt * 1.5));
    if (this.sunLight && this.ambientLightRef) {
      this.sunLight.intensity = 1.2 - 0.6 * this.dusk;
      this.sunLight.color.setHex(0xfff2d6).lerp(DUSK_COLOR, this.dusk);
      this.ambientLightRef.intensity = 0.7 - 0.15 * this.dusk;
    }

    // Walkers pace the loop around their district
    for (const w of this.walkers) {
      w.offset = (w.offset + w.speed * dt + WALK_LOOP) % WALK_LOOP;
      const center = this.getDistrictCenter3D(DISTRICT_BLOCKS[w.district]);
      const [px, pz] = perimeterPoint(w.offset);
      w.group.position.set(center[0] + px, 0.5, center[2] + pz);
      w.group.position.y = 0.5 + Math.abs(Math.sin(timeSec * 8 + w.offset)) * 0.3;
    }

    // Rooftop beacons blink
    for (const building of this.buildingMeshes.values()) {
      const beacon = building.getObjectByName('RooftopBeacon');
      if (beacon) beacon.visible = Math.sin(timeSec * 3 + building.position.x) > 0;
    }

    if (this.motes) {
      const attr = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < attr.count; i++) {
        let y = attr.getY(i) + dt * (6 + (i % 5) * 2);
        if (y > MOTE_CEILING) y = 0;
        attr.setY(i, y);
        attr.setX(i, attr.getX(i) + Math.sin(timeSec * 0.5 + i) * dt * 3);
      }
      attr.needsUpdate = true;
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
   * Spawn a flat expanding ring on the ground at a world position.
   */
  private spawnRing(x: number, z: number, color: number, radius: number, maxScale: number, duration: number): void {
    if (!this.isAnimating()) return;
    const geom = new THREE.RingGeometry(radius * 0.8, radius, 40);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, ELEVATION_PARCEL_BASE + 2.2, z);
    mesh.name = 'RingEffect';
    this.boardGroup.add(mesh);
    this.effects.push({ mesh, start: performance.now(), duration, maxScale });
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
      this.pixelPost?.dispose();
      this.pixelPost = null;
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
    this.motes?.geometry.dispose();
    (this.motes?.material as THREE.Material | undefined)?.dispose();
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
    this.targetDusk = Math.min(Math.max((state.year - 1) / 5, 0), 1);
    this.selectedLotId = selectedLotId;
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

    this.syncGoldenAuras(allClusters);

    // Update 72 parcels and procedural buildings
    for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
      const lot = state.lots[lotId];
      const mat = this.parcelMaterials[lotId];
      const def = LOT_DEFINITIONS[lotId];
      const basePos = getParcelWorldPosition(def.x, def.y, ELEVATION_PARCEL_BASE);

      const isSelected = this.selectedLotId === lotId;
      const isHovered = this.hoveredLotId === lotId || this.highlightLotId === lotId;

      // Vertical elevation lift (eased in the animation loop)
      this.lotTargetY[lotId] = this.getTargetElevation(lotId);
      if (!this.isAnimating()) {
        this.lotCurrentY[lotId] = this.lotTargetY[lotId];
        this.parcelHitMeshes[lotId].position.y = this.lotCurrentY[lotId];
      }
      const elevationY = this.lotCurrentY[lotId];

      // Dynamic material colors; candidate / buildable lots pulse
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
        // Owned parcel (built or not): player ownership color
        const ownerHex = PLAYER_HEX_COLORS[lot.owner] || PLAYER_HEX_COLORS[0];
        mat.color.set(ownerHex);
        mat.emissive.set(ownerHex);
        mat.emissiveIntensity = lot.shop !== null ? 0.18 : 0.3;
      } else {
        // Unowned lot
        mat.color.setHex(EMPTY_PARCEL_HEX);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
      }
      this.lotPulseBase[lotId] = mat.emissiveIntensity;
      this.lotPulseAmp[lotId] = pulse;

      // Owner flag
      const cloth = this.ownerFlags[lotId];
      const flag = (cloth.userData as { flag: THREE.Group }).flag;
      if (lot.owner !== null) {
        (cloth.material as THREE.MeshBasicMaterial).color.set(
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
          if (existingBuilding) {
            disposeHierarchy(existingBuilding);
            this.buildingGroup.remove(existingBuilding);
          }
          const newBuilding = createShopBuilding(lot.shop, clusterSize, isComplete);
          newBuilding.traverse((obj) => {
            if (obj instanceof THREE.Mesh && obj.name !== 'FacadeDecal') {
              obj.castShadow = true;
              obj.receiveShadow = true;
            }
          });
          newBuilding.userData = {
            shopType: lot.shop,
            clusterSize,
            isComplete,
            baseScaleY: newBuilding.scale.y,
          };
          if (isNewBuild && this.isAnimating()) {
            // Rise out of the lot with ease-out-back plus a dust ring
            newBuilding.userData.birth = performance.now();
            newBuilding.scale.y = 0.001;
            this.spawnRing(basePos[0], basePos[2], 0xcbd5e1, 18, 2.2, 500);
          } else if (existingBuilding?.userData.birth !== undefined) {
            newBuilding.userData.birth = existingBuilding.userData.birth;
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
          // Sink before removal
          this.sinking.push({ group: existingBuilding, start: performance.now() });
          existingBuilding.userData.baseScaleY = existingBuilding.scale.y;
        } else {
          disposeHierarchy(existingBuilding);
          this.buildingGroup.remove(existingBuilding);
        }
      }
    }
  }

  /**
   * Rebuild golden crowns/lights only when the set of complete clusters changes.
   */
  private syncGoldenAuras(allClusters: ShopCluster[]): void {
    const complete = allClusters.filter((c) => c.isComplete && c.lots.length > 0);
    const signature = complete.map((c) => `${c.districtId}_${c.shopType}:${c.lots.join('.')}`).join('|');
    if (signature === this.completeSignature) return;

    const previous = this.completeSignature;
    this.completeSignature = signature;

    while (this.goldenAuraGroup.children.length > 0) {
      const child = this.goldenAuraGroup.children[0];
      this.goldenAuraGroup.remove(child);
      disposeHierarchy(child);
    }

    const prevKeys = new Set(
      (previous ?? '').split('|').filter(Boolean).map((entry) => entry.split(':')[0])
    );
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
      this.goldenAuraGroup.add(crownMesh);

      if (previous !== null && !prevKeys.has(`${cluster.districtId}_${cluster.shopType}`)) {
        newlyComplete = { x: centroidX, z: centroidZ };
      }
    }

    // Cluster-complete moment: gold shockwave, camera move, audio cue
    if (newlyComplete && this.isAnimating()) {
      this.spawnRing(newlyComplete.x, newlyComplete.z, 0xffd700, 30, 5, 900);
      this.spawnRing(newlyComplete.x, newlyComplete.z, 0xfff3b0, 20, 3.5, 650);
      this.targetCameraTarget.set(newlyComplete.x, 0, newlyComplete.z);
      this.options.onClusterComplete?.();
    }
  }

  /** True while the render loop runs; otherwise state changes snap instead of tweening. */
  private isAnimating(): boolean {
    return this.animFrameId !== null;
  }

  private getTargetElevation(lotId: number): number {
    if (this.selectedLotId === lotId) return ELEVATION_PARCEL_SELECTED;
    if (this.hoveredLotId === lotId || this.highlightLotId === lotId) return ELEVATION_PARCEL_HOVER;
    return ELEVATION_PARCEL_BASE;
  }

  private labelText(lotId: number, shop: number | null): string {
    const code = shop !== null ? (SHOP_VISUAL_CATEGORIES[shop] || SHOP_VISUAL_CATEGORIES[0]).code : '';
    return code ? `#${lotId} ${code}` : `#${lotId}`;
  }

  /**
   * Show (or hide when text is null) a lot-number sprite floating above a parcel.
   */
  private updateLabel(lotId: number, text: string | null): void {
    let sprite = this.labelSprites.get(lotId);
    if (text === null) {
      if (sprite) sprite.visible = false;
      return;
    }
    if (typeof document === 'undefined') return;
    if (!sprite) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 48;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
      sprite = new THREE.Sprite(mat);
      sprite.scale.set(34, 12.75, 1);
      sprite.position.set(0, 46, 0);
      sprite.renderOrder = 10;
      sprite.userData.text = '';
      sprite.raycast = () => {};
      this.parcelHitMeshes[lotId].add(sprite);
      this.labelSprites.set(lotId, sprite);
    }
    sprite.visible = true;
    if (sprite.userData.text !== text) {
      sprite.userData.text = text;
      const tex = sprite.material.map as THREE.CanvasTexture;
      const ctx = (tex.image as HTMLCanvasElement).getContext?.('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 128, 48);
        ctx.fillStyle = 'rgba(11, 15, 25, 0.88)';
        ctx.fillRect(2, 2, 124, 44);
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 124, 44);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 25);
        tex.needsUpdate = true;
      }
    }
  }

  /**
   * Externally highlight a lot (e.g. while hovering its deed card in the tray).
   */
  public setHighlightLot(lotId: number | null): void {
    if (this.highlightLotId === lotId) return;
    this.highlightLotId = lotId;
    if (this.lastRender) {
      this.render(this.lastRender.state, this.lastRender.selected, this.lastRender.overlay);
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
   * Switch the pixel-art post pass (palette snap, 8x8 dither, ink contours) on or off.
   */
  public setPixelMode(enabled: boolean): void {
    if (!this.renderer) return;
    if (enabled && !this.pixelPost) {
      this.pixelPost = new PixelPost(this.renderer, 2);
      this.pixelPost.setSize(this.width, this.height);
    }
    this.pixelMode = enabled;
  }

  public isPixelMode(): boolean {
    return this.pixelMode;
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
   * Fit the ortho frustum to the projected board bounds for the current aspect ratio.
   * Uses a camera aimed at the origin, so the fit is independent of pan.
   */
  private fitOrthoFrustum(): void {
    const aspect = this.width / this.height;
    const cosElev = Math.cos(this.cameraElevation);
    const probe = new THREE.OrthographicCamera();
    probe.position.set(
      this.cameraDistance * cosElev * Math.sin(this.cameraAzimuth),
      this.cameraDistance * Math.sin(this.cameraElevation),
      this.cameraDistance * cosElev * Math.cos(this.cameraAzimuth)
    );
    probe.lookAt(0, 0, 0);
    probe.updateMatrixWorld(true);
    const inverse = probe.matrixWorld.clone().invert();

    let maxX = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    const corner = new THREE.Vector3();
    for (const district of DISTRICT_BLOCKS) {
      const [cx, , cz] = this.getDistrictCenter3D(district);
      for (const dx of [-112, 112]) {
        for (const dz of [-118, 118]) {
          for (const y of [0, BOARD_FIT_HEIGHT]) {
            corner.set(cx + dx, y, cz + dz).applyMatrix4(inverse);
            maxX = Math.max(maxX, Math.abs(corner.x));
            minY = Math.min(minY, corner.y);
            maxY = Math.max(maxY, corner.y);
          }
        }
      }
    }

    // Pad, then widen whichever axis the container aspect leaves spare
    let halfHeight = ((maxY - minY) / 2) * BOARD_FIT_PADDING;
    let halfWidth = maxX * BOARD_FIT_PADDING;
    if (halfWidth / halfHeight < aspect) {
      halfWidth = halfHeight * aspect;
    } else {
      halfHeight = halfWidth / aspect;
    }
    const centerY = (maxY + minY) / 2;

    this.orthoCamera.left = -halfWidth;
    this.orthoCamera.right = halfWidth;
    this.orthoCamera.top = centerY + halfHeight;
    this.orthoCamera.bottom = centerY - halfHeight;
    this.orthoCamera.updateProjectionMatrix();
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
    this.pixelPost?.setSize(width, height);

    const aspect = width / height;
    this.fitOrthoFrustum();

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
    // Right / middle / Shift+left drag pans the isometric view
    this.isPanning =
      this.cameraMode === 'isometric' && (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey === true));
    try {
      this.renderer?.domElement.setPointerCapture?.(e.pointerId);
    } catch {
      // Synthetic pointer ids cannot be captured
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
      // Nothing captured
    }
  }

  /**
   * Pan the isometric view so the scene follows the pointer by (dx, dy) pixels.
   */
  private panByPixels(dx: number, dy: number): void {
    const rect = this.renderer?.domElement.getBoundingClientRect();
    const pxWidth = rect && rect.width > 0 ? rect.width : this.width;
    const unitsPerPx = (this.orthoCamera.right - this.orthoCamera.left) / this.orthoCamera.zoom / pxWidth;
    const sinAz = Math.sin(this.cameraAzimuth);
    const cosAz = Math.cos(this.cameraAzimuth);
    const sinElev = Math.sin(this.cameraElevation);

    // Screen-right on the ground is (cosAz, 0, -sinAz); screen-up is (-sinAz, 0, -cosAz) / sinElev
    const moveX = -cosAz * dx * unitsPerPx + (-sinAz * dy * unitsPerPx) / sinElev;
    const moveZ = sinAz * dx * unitsPerPx + (-cosAz * dy * unitsPerPx) / sinElev;
    this.shiftCameraTarget(moveX, moveZ);
  }

  /**
   * Move both the live and goal camera targets, clamped to the board area.
   */
  private shiftCameraTarget(dx: number, dz: number): void {
    this.cameraTarget.x = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, this.cameraTarget.x + dx));
    this.cameraTarget.z = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, this.cameraTarget.z + dz));
    this.targetCameraTarget.x = this.cameraTarget.x;
    this.targetCameraTarget.z = this.cameraTarget.z;
  }

  private updateParcelElevation(lotId: number | null): void {
    if (lotId === null || lotId < 0 || lotId >= TOTAL_LOTS) return;
    if (!this.parcelHitMeshes[lotId]) return;
    this.lotTargetY[lotId] = this.getTargetElevation(lotId);
    if (!this.isAnimating()) {
      this.lotCurrentY[lotId] = this.lotTargetY[lotId];
      this.parcelHitMeshes[lotId].position.y = this.lotCurrentY[lotId];
      const building = this.buildingMeshes.get(lotId);
      if (building) building.position.y = this.lotCurrentY[lotId] + 1.0;
    }
  }

  /** Ground-plane (y = 0) point under the given NDC for the active ortho view. */
  private groundPointAt(ndcX: number, ndcY: number): THREE.Vector3 | null {
    this.orthoCamera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.orthoCamera);
    return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    if (this.cameraMode === 'isometric') {
      const rect = this.renderer?.domElement.getBoundingClientRect();
      const ndcX = rect && rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0;
      const ndcY = rect && rect.height > 0 ? -((e.clientY - rect.top) / rect.height) * 2 + 1 : 0;

      // Zoom toward the cursor: keep the ground point under it fixed
      const before = this.groundPointAt(ndcX, ndcY);
      this.orthoCamera.zoom = Math.max(
        0.6,
        Math.min(4, this.orthoCamera.zoom * Math.exp(-e.deltaY * 0.0015))
      );
      this.orthoCamera.updateProjectionMatrix();
      const after = this.groundPointAt(ndcX, ndcY);
      if (before && after) {
        this.shiftCameraTarget(before.x - after.x, before.z - after.z);
      }
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
}
