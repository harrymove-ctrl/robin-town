/**
 * tests/unit/board-3d.test.ts
 *
 * Comprehensive unit test suite for Milestone M6 Three.js 3D board scene,
 * spatial coordinate mapping, 72 parcel meshes, 6 district slabs,
 * procedural shop buildings, golden completion auras, dual-camera controller,
 * tile raycasting, and headless Node.js execution safety.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CELL_SIZE,
  DISTRICT_BLOCKS,
  LOT_DEFINITIONS,
  TOTAL_LOTS,
} from '../../src/engine/board-layout';
import { buildTile, createGame, draftPlots } from '../../src/engine/engine';
import type { GameState } from '../../src/engine/types';
import {
  BOARD_ORIGIN_X,
  BOARD_ORIGIN_Z,
  ELEVATION_GOLDEN_CROWN,
  ELEVATION_GOLDEN_LIGHT,
  ELEVATION_PARCEL_BASE,
  ELEVATION_PARCEL_HOVER,
  ELEVATION_PARCEL_SELECTED,
  SHOP_VISUAL_CATEGORIES,
  ThreeBoardRenderer,
  canvasToWorld,
  configurePixelArtTexture,
  createShopBuilding,
  disposeHierarchy,
  getParcelWorldPosition,
  isWebGLAvailable,
  worldToCanvas,
} from '../../src/ui/board-3d';

/**
 * Minimal mock HTMLElement for headless testing.
 */
function createMockContainer(): HTMLElement {
  const listeners: Record<string, Function[]> = {};
  return {
    appendChild: () => {},
    removeChild: () => {},
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 1100,
      height: 730,
      right: 1100,
      bottom: 730,
    }),
    addEventListener: (event: string, fn: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    removeEventListener: (event: string, fn: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((cb) => cb !== fn);
      }
    },
    style: {} as any,
  } as unknown as HTMLElement;
}

describe('Milestone M6: Three.js 3D Board Scene & Infrastructure', () => {
  describe('Headless Environment Safety & Coordinate Transformations', () => {
    it('reports WebGL availability cleanly in Node.js environment without throwing', () => {
      const available = isWebGLAvailable();
      assert.strictEqual(typeof available, 'boolean');
      assert.strictEqual(available, false);
    });

    it('instantiates ThreeBoardRenderer headlessly without DOM or WebGL errors', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });
      assert.ok(renderer);
      assert.strictEqual(renderer.getCameraMode(), 'isometric');
      assert.ok(renderer.getScene());
      assert.ok(renderer.getOrthoCamera());
      assert.ok(renderer.getPerspCamera());
    });

    it('mounts and unmounts safely in headless Node.js environment', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });
      assert.doesNotThrow(() => renderer.mount());
      assert.doesNotThrow(() => renderer.unmount());
    });

    it('performs exact reversible coordinate transforms between 2D canvas and 3D world', () => {
      const testPoints: [number, number][] = [
        [0, 0],
        [550, 365],
        [1100, 730],
        [144, 100],
        [900, 607],
      ];

      for (const [cx, cy] of testPoints) {
        const [wx, wy, wz] = canvasToWorld(cx, cy);
        assert.strictEqual(wx, cx - BOARD_ORIGIN_X);
        assert.strictEqual(wz, cy - BOARD_ORIGIN_Z);
        assert.strictEqual(wy, ELEVATION_PARCEL_BASE);

        const [recoveredX, recoveredY] = worldToCanvas(wx, wz);
        assert.strictEqual(recoveredX, cx);
        assert.strictEqual(recoveredY, cy);
      }
    });

    it('calculates parcel center 3D coordinates matching board layout geometry', () => {
      // Lot 0 (Robinhood District: x = 144, y = 100)
      const lot0 = LOT_DEFINITIONS[0];
      const pos0 = getParcelWorldPosition(lot0.x, lot0.y);
      assert.strictEqual(pos0[0], 144 - 525); // -381.0
      assert.strictEqual(pos0[2], 100 - 340); // -240.0
      assert.strictEqual(pos0[1], ELEVATION_PARCEL_BASE);

      // Lot 71 (Defi Citadel: x = 900, y = 607)
      const lot71 = LOT_DEFINITIONS[71];
      const pos71 = getParcelWorldPosition(lot71.x, lot71.y);
      assert.strictEqual(pos71[0], 900 - 525); // +375.0
      assert.strictEqual(pos71[2], 607 - 340); // +267.0
      assert.strictEqual(pos71[1], ELEVATION_PARCEL_BASE);
    });
  });

  describe('72 Parcel Meshes & Centered 3D Layout', () => {
    it('creates exactly 72 parcel meshes with corresponding lot metadata', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });
      const parcelGroup = renderer.getParcelGroup();

      assert.strictEqual(parcelGroup.children.length, TOTAL_LOTS);
      const hitMeshes = renderer.getParcelHitMeshes();
      assert.strictEqual(hitMeshes.length, TOTAL_LOTS);

      for (let i = 0; i < TOTAL_LOTS; i++) {
        const mesh = renderer.getParcelMesh(i);
        assert.ok(mesh, `Mesh for lot ${i} must exist`);
        assert.strictEqual(mesh.userData.lotId, i);
        assert.strictEqual(mesh.userData.blockId, LOT_DEFINITIONS[i].block);

        const def = LOT_DEFINITIONS[i];
        const expectedPos = getParcelWorldPosition(def.x, def.y);
        assert.strictEqual(mesh.position.x, expectedPos[0]);
        assert.strictEqual(mesh.position.z, expectedPos[2]);
        assert.strictEqual(mesh.position.y, ELEVATION_PARCEL_BASE);
      }
    });

    it('assigns 48x48 footprint box geometry to parcels leaving street gaps', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });
      const mesh = renderer.getParcelMesh(0);
      assert.ok(mesh);
      assert.ok(mesh.geometry instanceof THREE.BoxGeometry);

      const params = (mesh.geometry as THREE.BoxGeometry).parameters;
      assert.strictEqual(params.width, 48);
      assert.strictEqual(params.depth, 48);
      assert.strictEqual(params.height, 2.0);
    });
  });

  describe('6 Extruded District Foundation Slabs', () => {
    it('creates exactly 6 district foundation groups with neon accent outlines', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });
      const districtGroup = renderer.getDistrictGroup();

      assert.strictEqual(districtGroup.children.length, 6);

      for (const district of DISTRICT_BLOCKS) {
        const slabGroup = districtGroup.children.find(
          (c) => c.name === `DistrictSlabGroup_${district.id}`
        ) as THREE.Group;
        assert.ok(slabGroup, `Group for district ${district.id} must exist`);

        const slabMesh = slabGroup.children.find(
          (c) => c.name === `DistrictSlabMesh_${district.id}`
        ) as THREE.Mesh;
        assert.ok(slabMesh, `Slab mesh for district ${district.id} must exist`);
        assert.ok(slabMesh.geometry instanceof THREE.BoxGeometry);

        const neonEdges = slabGroup.children.find(
          (c) => c.name === `DistrictNeonEdges_${district.id}`
        ) as THREE.LineSegments;
        assert.ok(neonEdges, `Neon edges for district ${district.id} must exist`);
        assert.ok(neonEdges.material instanceof THREE.LineBasicMaterial);

        const center = renderer.getDistrictCenter3D(district);
        assert.strictEqual(slabMesh.position.x, center[0]);
        assert.strictEqual(slabMesh.position.z, center[2]);
      }
    });

    it('positions localized colored point lights above each district center', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });
      const lightingGroup = renderer.getLightingGroup();

      for (const district of DISTRICT_BLOCKS) {
        const light = lightingGroup.children.find(
          (c) => c.name === `DistrictLight_${district.id}`
        ) as THREE.PointLight;
        assert.ok(light, `District point light for district ${district.id} must exist`);
        assert.strictEqual(light.position.y, 35.0);

        const center = renderer.getDistrictCenter3D(district);
        assert.strictEqual(light.position.x, center[0]);
        assert.strictEqual(light.position.z, center[2]);
      }
    });
  });

  describe('Procedural 3D Shop Buildings for All 6 Categories', () => {
    it('constructs procedural buildings for category 0 DEX Swap with antenna array', () => {
      const building = createShopBuilding(0, 1, false);
      assert.strictEqual(building.name, 'Building_Shop_0');
      assert.ok(building.children.length >= 4);

      const hasDecal = building.children.some((c) => c.name === 'FacadeDecal');
      assert.ok(hasDecal, 'DEX Swap must include a facade decal plane');
    });

    it('constructs procedural buildings for category 1 Memecoin Lounge with pergola', () => {
      const building = createShopBuilding(1, 1, false);
      assert.strictEqual(building.name, 'Building_Shop_1');
      assert.ok(building.children.length >= 4);

      const hasDecal = building.children.some((c) => c.name === 'FacadeDecal');
      assert.ok(hasDecal, 'Memecoin Lounge must include a facade decal plane');
    });

    it('constructs procedural buildings for category 2 Staking Vault with vault relief', () => {
      const building = createShopBuilding(2, 1, false);
      assert.strictEqual(building.name, 'Building_Shop_2');
      assert.ok(building.children.length >= 4);

      const hasDecal = building.children.some((c) => c.name === 'FacadeDecal');
      assert.ok(hasDecal, 'Staking Vault must include a facade decal plane');
    });

    it('constructs procedural buildings for category 3 Lending Protocol with columns', () => {
      const building = createShopBuilding(3, 1, false);
      assert.strictEqual(building.name, 'Building_Shop_3');
      assert.ok(building.children.length >= 5);

      const hasDecal = building.children.some((c) => c.name === 'FacadeDecal');
      assert.ok(hasDecal, 'Lending Protocol must include a facade decal plane');
    });

    it('constructs procedural buildings for category 4 Derivatives Exchange with 3 tiers', () => {
      const building = createShopBuilding(4, 1, false);
      assert.strictEqual(building.name, 'Building_Shop_4');
      assert.ok(building.children.length >= 4);

      const hasDecal = building.children.some((c) => c.name === 'FacadeDecal');
      assert.ok(hasDecal, 'Derivatives Exchange must include a facade decal plane');
    });

    it('constructs procedural buildings for category 5 Validator Citadel with bastion turrets', () => {
      const building = createShopBuilding(5, 1, false);
      assert.strictEqual(building.name, 'Building_Shop_5');
      assert.ok(building.children.length >= 6);

      const hasDecal = building.children.some((c) => c.name === 'FacadeDecal');
      assert.ok(hasDecal, 'Validator Citadel must include a facade decal plane');
    });

    it('scales building height dynamically as cluster size expands', () => {
      const singleTile = createShopBuilding(0, 1, false);
      const multiTile = createShopBuilding(0, 3, false);
      assert.strictEqual(singleTile.scale.y, 1.0);
      assert.ok(multiTile.scale.y > 1.0, 'Multi-tile building scale must be larger than 1.0');
      assert.strictEqual(multiTile.scale.y, 1.0 + 0.12 * 2);
    });

    it('attaches GoldenAuraHalo torus mesh when building is complete', () => {
      const incomplete = createShopBuilding(0, 2, false);
      const complete = createShopBuilding(0, 3, true);

      const incompleteHalo = incomplete.children.find((c) => c.name === 'GoldenAuraHalo');
      assert.strictEqual(incompleteHalo, undefined);

      const completeHalo = complete.children.find((c) => c.name === 'GoldenAuraHalo');
      assert.ok(completeHalo, 'Complete building must have GoldenAuraHalo mesh');
      assert.ok(completeHalo instanceof THREE.Mesh);
      assert.ok((completeHalo as THREE.Mesh).geometry instanceof THREE.TorusGeometry);
    });

    it('configures pixel art textures with nearest-neighbor filtering and no mipmaps', () => {
      const texture = new THREE.Texture();
      const configured = configurePixelArtTexture(texture);

      assert.strictEqual(configured.minFilter, THREE.NearestFilter);
      assert.strictEqual(configured.magFilter, THREE.NearestFilter);
      assert.strictEqual(configured.generateMipmaps, false);
      assert.strictEqual(configured.colorSpace, THREE.SRGBColorSpace);
      assert.strictEqual(configured.wrapS, THREE.ClampToEdgeWrapping);
      assert.strictEqual(configured.wrapT, THREE.ClampToEdgeWrapping);
    });
  });

  describe('Dynamic GameState Synchronization & Golden Auras', () => {
    it('updates parcel materials and elevations based on ownership and selection', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      let game = createGame({ seed: 42 });
      renderer.render(game, null);

      // Unowned parcel 0
      const mesh0 = renderer.getParcelMesh(0)!;
      assert.strictEqual(mesh0.position.y, ELEVATION_PARCEL_BASE);

      // Assign parcel 0 to player 0
      game = {
        ...game,
        lots: game.lots.map((lot) => (lot.id === 0 ? { ...lot, owner: 0 } : lot)),
      };
      renderer.render(game, null);
      assert.strictEqual(mesh0.position.y, ELEVATION_PARCEL_BASE);

      // Select parcel 0: elevation lifts to ELEVATION_PARCEL_SELECTED
      renderer.render(game, 0);
      assert.strictEqual(mesh0.position.y, ELEVATION_PARCEL_SELECTED);
      assert.strictEqual(renderer.getSelectedLotId(), 0);

      // Deselect parcel 0: elevation returns to ELEVATION_PARCEL_BASE
      renderer.render(game, null);
      assert.strictEqual(mesh0.position.y, ELEVATION_PARCEL_BASE);
    });

    it('spawns 3D buildings and golden completion auras upon cluster completion', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      // Create game state and allocate adjacent plots for a complete DEX Swap (size 3)
      // In District 0: lots 0, 1, 2 are adjacent
      let game = createGame({ seed: 100 });
      game = {
        ...game,
        lots: game.lots.map((lot) => {
          if (lot.id === 0 || lot.id === 1 || lot.id === 2) {
            return { ...lot, owner: 0, shop: 0 };
          }
          return lot;
        }),
      };

      renderer.render(game, null);

      const buildingGroup = renderer.getBuildingGroup();
      assert.strictEqual(buildingGroup.children.length, 3);

      const goldenAuraGroup = renderer.getGoldenAuraGroup();
      // Should have radiant golden point light and floating crown marker
      const hasLight = goldenAuraGroup.children.some((c) => c instanceof THREE.PointLight);
      const hasCrown = goldenAuraGroup.children.some((c) => c.name.startsWith('GoldenCrown_'));

      assert.ok(hasLight, 'Golden radiant point light must exist for completed cluster');
      assert.ok(hasCrown, 'Golden 3D crown marker must exist for completed cluster');

      const crown = goldenAuraGroup.children.find((c) =>
        c.name.startsWith('GoldenCrown_')
      ) as THREE.Mesh;
      assert.strictEqual(crown.position.y, ELEVATION_GOLDEN_CROWN);
    });
  });

  describe('Dual-Camera Controller', () => {
    it('initializes in isometric orthographic mode and transitions to perspective mode', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      assert.strictEqual(renderer.getCameraMode(), 'isometric');
      assert.strictEqual(renderer.getActiveCamera(), renderer.getOrthoCamera());

      renderer.toggleCameraMode();
      assert.strictEqual(renderer.getCameraMode(), 'perspective');

      renderer.setCameraMode('isometric');
      assert.strictEqual(renderer.getCameraMode(), 'isometric');
    });

    it('focuses camera target on parcel position and resets back to center', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      // Initially targeting (0, 0, 0)
      const initialTarget = renderer.getCameraTarget();
      assert.strictEqual(initialTarget.x, 0);
      assert.strictEqual(initialTarget.z, 0);

      // Focus lot 0 (-381, 4.5, -240)
      renderer.focusLot(0);
      // Reset camera
      renderer.resetCamera();
      assert.strictEqual(renderer.getCameraTarget().x, 0);
      assert.strictEqual(renderer.getCameraTarget().z, 0);
    });

    it('updates camera frustums on viewport resize', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container, width: 800, height: 600 });

      renderer.resize(1920, 1080);
      const ortho = renderer.getOrthoCamera();
      const persp = renderer.getPerspCamera();

      assert.strictEqual(persp.aspect, 1920 / 1080);
      assert.ok(ortho.right > ortho.top);
    });
  });

  describe('Tile Raycasting & Pointer Interaction', () => {
    it('detects parcel hits via programmatic NDC raycasting', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      // Ensure active camera world matrix is up to date
      const ortho = renderer.getOrthoCamera();
      ortho.updateMatrixWorld(true);

      // For parcel 0, project its 3D center to NDC
      const parcel0 = renderer.getParcelMesh(0)!;
      parcel0.updateMatrixWorld(true);
      const worldPos = new THREE.Vector3();
      parcel0.getWorldPosition(worldPos);

      const ndc = worldPos.clone().project(ortho);
      const hitLotId = renderer.raycastAt({ x: ndc.x, y: ndc.y });

      assert.strictEqual(hitLotId, 0);
    });

    it('returns null when raycasting outside of board parcel boundaries', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      // Far corner of screen outside board boundaries
      const hitLotId = renderer.raycastAt({ x: 0.95, y: 0.95 });
      assert.strictEqual(hitLotId, null);
    });

    it('raycasts accurately across multiple parcels across different districts', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });
      const ortho = renderer.getOrthoCamera();
      ortho.updateMatrixWorld(true);

      // Test parcels from different districts
      const testLots = [0, 12, 24, 36, 48, 60];
      for (const lotId of testLots) {
        const mesh = renderer.getParcelMesh(lotId)!;
        mesh.updateMatrixWorld(true);
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);

        const ndc = worldPos.clone().project(ortho);
        const hit = renderer.raycastAt({ x: ndc.x, y: ndc.y });
        assert.strictEqual(hit, lotId, `Raycast must hit lot ${lotId}`);
      }
    });
  });

  describe('Milestone M6 Iteration 2 Remediation Suite', () => {
    function attachMockDomRenderer(renderer: ThreeBoardRenderer): void {
      (renderer as any).renderer = {
        domElement: {
          getBoundingClientRect: () => ({
            left: 0,
            top: 0,
            width: 1100,
            height: 730,
            right: 1100,
            bottom: 730,
          }),
          style: { cursor: 'default' },
        },
      };
    }

    function getParcelScreenCoords(
      renderer: ThreeBoardRenderer,
      lotId: number
    ): { clientX: number; clientY: number } {
      const ortho = renderer.getOrthoCamera();
      ortho.updateMatrixWorld(true);
      const mesh = renderer.getParcelMesh(lotId)!;
      mesh.updateMatrixWorld(true);
      const worldPos = new THREE.Vector3();
      mesh.getWorldPosition(worldPos);

      const ndc = worldPos.clone().project(ortho);
      const clientX = ((ndc.x + 1) / 2) * 1100;
      const clientY = ((1 - ndc.y) / 2) * 730;
      return { clientX, clientY };
    }

    it('allows passive mouse hover raycasting with buttons 0 without flagging drag', () => {
      let hoveredLot: number | null = null;
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({
        container,
        onHoverLot: (id) => {
          hoveredLot = id;
        },
      });
      attachMockDomRenderer(renderer);

      const { clientX, clientY } = getParcelScreenCoords(renderer, 0);

      // Passive mouse movement across canvas with zero buttons pressed
      (renderer as any).handlePointerMove({ clientX, clientY, buttons: 0 });

      assert.strictEqual((renderer as any).isDragging, false);
      assert.strictEqual(renderer.getHoveredLotId(), 0);
      assert.strictEqual(hoveredLot, 0);
      assert.strictEqual((renderer as any).renderer.domElement.style.cursor, 'pointer');

      // Hovered parcel elevates by +1.0 Y
      const mesh0 = renderer.getParcelMesh(0)!;
      assert.strictEqual(mesh0.position.y, ELEVATION_PARCEL_HOVER);

      // Moving mouse to off-screen coordinates clears hover state
      (renderer as any).handlePointerMove({ clientX: 10, clientY: 10, buttons: 0 });
      assert.strictEqual(renderer.getHoveredLotId(), null);
      assert.strictEqual(hoveredLot, null);
      assert.strictEqual((renderer as any).renderer.domElement.style.cursor, 'default');
      assert.strictEqual(mesh0.position.y, ELEVATION_PARCEL_BASE);
    });

    it('safely handles hostile inputs in focusLot without throwing exceptions', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      const hostileInputs = [NaN, undefined, null, 1.5, -0.5, -1, 72, 100, '0', 'lot', {}, [], true, false, Infinity, -Infinity];
      for (const input of hostileInputs) {
        assert.doesNotThrow(() => {
          renderer.focusLot(input as any);
        }, `focusLot must not throw for input: ${String(input)}`);
      }

      // Valid lot centers targetCameraTarget cleanly
      renderer.focusLot(0);
      const def0 = LOT_DEFINITIONS[0];
      const pos0 = getParcelWorldPosition(def0.x, def0.y);
      const target = (renderer as any).targetCameraTarget as THREE.Vector3;
      assert.strictEqual(target.x, pos0[0]);
      assert.strictEqual(target.z, pos0[2]);
    });

    it('safely handles non-finite NDC coordinates in raycastAt returning null', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      const hostileNdc = [
        { x: NaN, y: NaN },
        { x: 0, y: NaN },
        { x: NaN, y: 0 },
        { x: Infinity, y: 0 },
        { x: 0, y: -Infinity },
        null as any,
        undefined as any,
      ];

      for (const ndc of hostileNdc) {
        const result = renderer.raycastAt(ndc);
        assert.strictEqual(result, null, `raycastAt must return null for hostile input`);
      }
    });

    it('recursively disposes geometries, materials, and textures via disposeHierarchy', () => {
      let disposedGeoms = 0;
      let disposedMats = 0;
      let disposedTexs = 0;

      const group = new THREE.Group();
      const geom = new THREE.BoxGeometry(10, 10, 10);
      const origGeomDispose = geom.dispose.bind(geom);
      geom.dispose = () => {
        disposedGeoms++;
        origGeomDispose();
      };

      const texture = new THREE.Texture();
      const origTexDispose = texture.dispose.bind(texture);
      texture.dispose = () => {
        disposedTexs++;
        origTexDispose();
      };

      const mat = new THREE.MeshStandardMaterial({ map: texture });
      const origMatDispose = mat.dispose.bind(mat);
      mat.dispose = () => {
        disposedMats++;
        origMatDispose();
      };

      const mesh = new THREE.Mesh(geom, mat);
      group.add(mesh);

      disposeHierarchy(group);

      assert.strictEqual(disposedGeoms, 1);
      assert.strictEqual(disposedMats, 1);
      assert.strictEqual(disposedTexs, 1);
    });

    it('disposes building geometries and materials on building upgrade and demolition', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      let disposedGeometries = 0;
      let disposedMaterials = 0;

      const origGeomDispose = THREE.BufferGeometry.prototype.dispose;
      THREE.BufferGeometry.prototype.dispose = function() {
        disposedGeometries++;
        return origGeomDispose.apply(this, arguments as any);
      };

      const origMatDispose = THREE.Material.prototype.dispose;
      THREE.Material.prototype.dispose = function() {
        disposedMaterials++;
        return origMatDispose.apply(this, arguments as any);
      };

      const baseGame = createGame({ seed: 50 });

      // Step 1: Place initial shop on lot 0
      const game1: GameState = {
        ...baseGame,
        lots: baseGame.lots.map((l) => (l.id === 0 ? { ...l, owner: 0, shop: 0 } : l)),
      };
      renderer.render(game1, null);

      const baselineGeom = disposedGeometries;
      const baselineMat = disposedMaterials;

      // Step 2: Replace with different shop type on lot 0
      const game2: GameState = {
        ...baseGame,
        lots: baseGame.lots.map((l) => (l.id === 0 ? { ...l, owner: 0, shop: 1 } : l)),
      };
      renderer.render(game2, null);

      // Step 3: Demolish shop on lot 0
      const game3: GameState = {
        ...baseGame,
        lots: baseGame.lots.map((l) => (l.id === 0 ? { ...l, owner: 0, shop: null } : l)),
      };
      renderer.render(game3, null);

      const newGeom = disposedGeometries - baselineGeom;
      const newMat = disposedMaterials - baselineMat;

      THREE.BufferGeometry.prototype.dispose = origGeomDispose;
      THREE.Material.prototype.dispose = origMatDispose;

      assert.ok(newGeom > 0, 'Geometries must be disposed upon building replacement and demolition');
      assert.ok(newMat > 0, 'Materials must be disposed upon building replacement and demolition');
    });

    it('frames all 72 parcels cleanly in orthographic view without near plane clipping', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });
      const ortho = renderer.getOrthoCamera();
      ortho.updateMatrixWorld(true);

      assert.strictEqual(ortho.near, 0.1);
      assert.strictEqual(ortho.far, 2000);

      // Test all 72 parcels project to NDC within [-1.0, 1.0]
      for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
        const mesh = renderer.getParcelMesh(lotId)!;
        mesh.updateMatrixWorld(true);
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);

        const ndc = worldPos.clone().project(ortho);
        assert.ok(
          ndc.x >= -1.0 && ndc.x <= 1.0,
          `Lot ${lotId} NDC X (${ndc.x}) must be within [-1, 1]`
        );
        assert.ok(
          ndc.y >= -1.0 && ndc.y <= 1.0,
          `Lot ${lotId} NDC Y (${ndc.y}) must be within [-1, 1]`
        );
        assert.ok(
          ndc.z >= -1.0 && ndc.z <= 1.0,
          `Lot ${lotId} NDC Z (${ndc.z}) must be within [-1, 1]`
        );

        // Raycasting center of parcel must accurately hit this lot
        const hit = renderer.raycastAt({ x: ndc.x, y: ndc.y });
        assert.strictEqual(hit, lotId, `Raycast must accurately hit lot ${lotId}`);
      }
    });

    it('unifies getParcelWorldPosition with canvasToWorld and centers district slabs with zero spatial offset', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      // Invariant 1: getParcelWorldPosition matches canvasToWorld with explicit CELL_SIZE / 2 offset
      for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
        const def = LOT_DEFINITIONS[lotId];
        const parcelPos = getParcelWorldPosition(def.x, def.y);
        const canvasPos = canvasToWorld(def.x + CELL_SIZE / 2, def.y + CELL_SIZE / 2);
        assert.strictEqual(parcelPos[0], canvasPos[0]);
        assert.strictEqual(parcelPos[1], canvasPos[1]);
        assert.strictEqual(parcelPos[2], canvasPos[2]);
      }

      // Invariant 2: district foundation slabs align with bounding midpoint of parcels with exact zero offset
      for (const d of DISTRICT_BLOCKS) {
        const lots = LOT_DEFINITIONS.filter((l) => l.block === d.id);
        const positions = lots.map((l) => getParcelWorldPosition(l.x, l.y));
        const minX = Math.min(...positions.map((p) => p[0]));
        const maxX = Math.max(...positions.map((p) => p[0]));
        const minZ = Math.min(...positions.map((p) => p[2]));
        const maxZ = Math.max(...positions.map((p) => p[2]));

        const slabCenter = renderer.getDistrictCenter3D(d);
        const offsetX = slabCenter[0] - (minX + maxX) / 2;
        const offsetZ = slabCenter[2] - (minZ + maxZ) / 2;

        assert.strictEqual(offsetX, 0, `District ${d.id} slab center X must have zero offset`);
        assert.strictEqual(offsetZ, 0, `District ${d.id} slab center Z must have zero offset`);
      }
    });
  });
});


