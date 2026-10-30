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
}

/**
 * Public Board3DRenderer interface contract as defined in SCOPE.md.
 */
export interface Board3DRenderer {
  mount(): void;
  unmount(): void;
  render(state: GameState, selectedLotId: number | null): void;
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
    const ambientLight = new THREE.AmbientLight(0x1e293b, 0.7);
    ambientLight.name = 'AmbientLight';

    const sunLight = new THREE.DirectionalLight(0xfff2d6, 1.2);
    sunLight.name = 'SunLight';
    sunLight.position.set(300, 600, 400);

    const fillLight = new THREE.DirectionalLight(0x7aa2f7, 0.5);
    fillLight.name = 'FillLight';
    fillLight.position.set(-300, 300, -200);

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
        this.renderer.render(this.scene, this.activeCamera);
      }

      this.animFrameId = requestAnimationFrame(animate);
    };

    this.animFrameId = requestAnimationFrame(animate);
  }

  /**
   * Update continuous animations: golden auras, camera transition lerp, target lerps.
   */
  private updateAnimations(timestamp: number): void {
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
  }

  /**
   * Synchronize 3D board scene with incoming GameState and selected lot ID.
   */
  public render(state: GameState, selectedLotId: number | null): void {
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
        mat.emissiveIntensity = 0.3;
      } else {
        // Unowned lot
        mat.color.setHex(0x161d2b);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
      }

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
          if (existingBuilding) {
            disposeHierarchy(existingBuilding);
            this.buildingGroup.remove(existingBuilding);
          }
          const newBuilding = createShopBuilding(lot.shop, clusterSize, isComplete);
          newBuilding.userData = { shopType: lot.shop, clusterSize, isComplete };
          newBuilding.position.set(basePos[0], elevationY + 1.0, basePos[2]);
          this.buildingMeshes.set(lotId, newBuilding);
          this.buildingGroup.add(newBuilding);
        } else {
          existingBuilding.position.set(basePos[0], elevationY + 1.0, basePos[2]);
        }
      } else if (existingBuilding) {
        disposeHierarchy(existingBuilding);
        this.buildingGroup.remove(existingBuilding);
        this.buildingMeshes.delete(lotId);
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
}
