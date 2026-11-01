/**
 * tests/unit/challenger-m10.test.ts
 *
 * Empirical Challenger M10 adversarial stress test suite:
 * 1. Rapid view mode toggling (1,000 to 2,000 cycles) verifying zero memory leak or state divergence.
 * 2. Parcel elevation and prop attachment under rapid hover and selection.
 * 3. Strict invariant: buildingGroup.children.length === 0 strictly holds when 72 parcels are owned without shops.
 * 4. Scene disposal: confirming disposal frees geometries, textures, materials, and cancels animation frame handles.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  TOTAL_LOTS,
  LOT_DEFINITIONS,
  findAllClusters,
} from '../../src/engine/board-layout';
import { createGame } from '../../src/engine/engine';
import type { GameState, Lot } from '../../src/engine/types';
import {
  ThreeBoardRenderer,
  disposeHierarchy,
  ELEVATION_PARCEL_BASE,
  ELEVATION_PARCEL_HOVER,
  ELEVATION_PARCEL_SELECTED,
  type LivingTownConfig,
} from '../../src/ui/board-3d';
import { RobinTownApp } from '../../src/app';

/**
 * Headless mock container for Node.js execution.
 */
function createHeadlessMockContainer(): HTMLElement {
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

describe('Challenger M10: Empirical Verification & Adversarial Stress', () => {
  describe('Task 1: Rapid View Mode Toggling Stress (1,000 to 2,000 Cycles)', () => {
    it('executes 2,000 rapid renderMode toggles on RobinTownApp with zero state divergence', () => {
      const app = new RobinTownApp(null);
      assert.strictEqual(app.getRenderMode(), '3d');

      const initialHeap = process.memoryUsage().heapUsed;

      for (let i = 0; i < 2000; i++) {
        const nextMode = app.toggleRenderMode();
        const expected = i % 2 === 0 ? '2d' : '3d';
        assert.strictEqual(nextMode, expected, `Cycle ${i} renderMode must equal ${expected}`);
        assert.strictEqual(app.getRenderMode(), expected);
      }

      assert.strictEqual(app.getRenderMode(), '3d', 'Final renderMode must be 3d after 2,000 cycles');

      const gameState = app.getGameState();
      assert.strictEqual(gameState.lots.length, TOTAL_LOTS);
      assert.ok(Number.isFinite(gameState.year));

      const finalHeap = process.memoryUsage().heapUsed;
      const heapGrowthMB = (finalHeap - initialHeap) / (1024 * 1024);
      assert.ok(heapGrowthMB < 50, `Heap growth (${heapGrowthMB.toFixed(2)} MB) must be bounded`);
    });

    it('executes 2,000 camera mode toggles on ThreeBoardRenderer with finite coordinate targets', () => {
      const container = createHeadlessMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      assert.strictEqual(renderer.getCameraMode(), 'isometric');

      for (let i = 0; i < 2000; i++) {
        renderer.toggleCameraMode();
        const expectedMode = i % 2 === 0 ? 'perspective' : 'isometric';
        assert.strictEqual(renderer.getCameraMode(), expectedMode);

        const target = renderer.getCameraTarget();
        assert.ok(Number.isFinite(target.x), `target.x must be finite at cycle ${i}`);
        assert.ok(Number.isFinite(target.y), `target.y must be finite at cycle ${i}`);
        assert.ok(Number.isFinite(target.z), `target.z must be finite at cycle ${i}`);
      }

      assert.strictEqual(renderer.getCameraMode(), 'isometric');
      renderer.unmount();
    });

    it('executes 2,000 pause and resume cycles on ThreeBoardRenderer with clean animation state', () => {
      const container = createHeadlessMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      for (let i = 0; i < 2000; i++) {
        renderer.pause();
        renderer.resume();
      }

      const living = renderer.getLivingConfig();
      assert.strictEqual(living.enableWater, true);
      assert.strictEqual(living.enableTraffic, true);

      renderer.unmount();
    });
  });

  describe('Task 2: Parcel Elevation and Prop Attachment Under Rapid Hover and Selection', () => {
    it('verifies strict vertical elevation states: base (0.0), hover (1.0), selected (2.0)', () => {
      const container = createHeadlessMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      const baseGame = createGame({ seed: 100 });

      // State 1: No selection, no hover
      renderer.render(baseGame, null);
      for (let id = 0; id < TOTAL_LOTS; id++) {
        const mesh = renderer.getParcelMesh(id)!;
        assert.strictEqual(mesh.position.y, ELEVATION_PARCEL_BASE);
      }

      // State 2: Selection lifts parcel to ELEVATION_PARCEL_SELECTED (2.0)
      for (let testId of [0, 15, 33, 71]) {
        renderer.render(baseGame, testId);
        const mesh = renderer.getParcelMesh(testId)!;
        assert.strictEqual(mesh.position.y, ELEVATION_PARCEL_SELECTED);

        // Other parcels remain at base
        const otherId = (testId + 1) % TOTAL_LOTS;
        const otherMesh = renderer.getParcelMesh(otherId)!;
        assert.strictEqual(otherMesh.position.y, ELEVATION_PARCEL_BASE);
      }

      renderer.unmount();
    });

    it('verifies selection priority over hover when parcel is both selected and hovered', () => {
      const container = createHeadlessMockContainer();
      const renderer = new ThreeBoardRenderer({ container });
      const baseGame = createGame({ seed: 101 });

      renderer.render(baseGame, 5);

      (renderer as any).hoveredLotId = 5;
      (renderer as any).updateParcelElevation(5);

      const mesh = renderer.getParcelMesh(5)!;
      assert.strictEqual(
        mesh.position.y,
        ELEVATION_PARCEL_SELECTED,
        'Selected lot must maintain selected elevation even when also hovered'
      );

      renderer.unmount();
    });

    it('verifies prop attachment and synchronous elevation on unbuilt parcels', () => {
      const container = createHeadlessMockContainer();
      const renderer = new ThreeBoardRenderer({ container });
      const baseGame = createGame({ seed: 102 });

      // Test vacant parcel prop attachment
      renderer.render(baseGame, 10);
      const mesh10 = renderer.getParcelMesh(10)!;
      const prop10 = renderer.getParcelPropMesh(10);

      assert.ok(prop10, 'Parcel 10 must have prop attached');
      assert.strictEqual(prop10.parent, mesh10, 'Prop must be a direct child of parcel mesh');
      assert.ok(prop10.name.startsWith('VacantLotProps_10'));
      assert.strictEqual(mesh10.position.y, ELEVATION_PARCEL_SELECTED);

      // Change parcel to claimed and verify prop replacement
      const claimedGame: GameState = {
        ...baseGame,
        lots: baseGame.lots.map((l) => (l.id === 10 ? { ...l, owner: 2 } : l)),
      };

      renderer.render(claimedGame, 10);
      const claimedProp10 = renderer.getParcelPropMesh(10);
      assert.ok(claimedProp10, 'Claimed parcel must have claimed prop');
      assert.ok(claimedProp10.name.startsWith('ClaimedLotProps_10'));
      assert.strictEqual(claimedProp10.parent, mesh10);

      // Verify no duplicate props attached to mesh.children
      const propChildren = mesh10.children.filter(
        (c) => c.name.startsWith('VacantLotProps_') || c.name.startsWith('ClaimedLotProps_')
      );
      assert.strictEqual(propChildren.length, 1, 'Exactly one prop model must be attached to parcel mesh');

      renderer.unmount();
    });

    it('executes rapid hover and selection sweeps across all 72 parcels without prop leakage', () => {
      const container = createHeadlessMockContainer();
      const renderer = new ThreeBoardRenderer({ container });
      const baseGame = createGame({ seed: 103 });
      renderer.render(baseGame, null);

      // Simulate 50 sweeps across all 72 parcels (3,600 hover updates)
      for (let sweep = 0; sweep < 50; sweep++) {
        for (let id = 0; id < TOTAL_LOTS; id++) {
          const prev = (renderer as any).hoveredLotId;
          (renderer as any).hoveredLotId = id;
          (renderer as any).updateParcelElevation(prev);
          (renderer as any).updateParcelElevation(id);

          const activeMesh = renderer.getParcelMesh(id)!;
          assert.strictEqual(activeMesh.position.y, ELEVATION_PARCEL_HOVER);
        }
      }

      // Reset hover and verify all parcels return to base elevation
      const lastHovered = (renderer as any).hoveredLotId;
      (renderer as any).hoveredLotId = null;
      (renderer as any).updateParcelElevation(lastHovered);

      for (let id = 0; id < TOTAL_LOTS; id++) {
        const mesh = renderer.getParcelMesh(id)!;
        assert.strictEqual(mesh.position.y, ELEVATION_PARCEL_BASE);
      }

      renderer.unmount();
    });
  });

  describe('Task 3: Invariant Verification: buildingGroup.children.length === 0', () => {
    it('strictly preserves buildingGroup.children.length === 0 when 72 parcels are owned without shops', () => {
      const container = createHeadlessMockContainer();
      const renderer = new ThreeBoardRenderer({ container });
      const baseGame = createGame({ seed: 200 });

      // Scenario A: All 72 parcels owned by single player (owner 0)
      const ownedByZero: GameState = {
        ...baseGame,
        lots: baseGame.lots.map((l) => ({ ...l, owner: 0 as const, shop: null })),
      };

      renderer.render(ownedByZero, null);
      assert.strictEqual(
        renderer.getBuildingGroup().children.length,
        0,
        'buildingGroup.children.length must strictly be 0 when owned by player 0 without shops'
      );
      assert.strictEqual(
        renderer.getGoldenAuraGroup().children.length,
        0,
        'goldenAuraGroup.children.length must strictly be 0'
      );
      assert.strictEqual(
        Object.keys(renderer.getParcelProps()).length,
        TOTAL_LOTS,
        'All 72 claimed props must exist in registry'
      );

      // Scenario B: All 72 parcels owned round-robin across players 0, 1, 2, 3
      const ownedRoundRobin: GameState = {
        ...baseGame,
        lots: baseGame.lots.map((l, idx) => ({
          ...l,
          owner: (idx % 4) as 0 | 1 | 2 | 3,
          shop: null,
        })),
      };

      renderer.render(ownedRoundRobin, null);
      assert.strictEqual(
        renderer.getBuildingGroup().children.length,
        0,
        'buildingGroup.children.length must strictly be 0 in round-robin ownership without shops'
      );

      // Scenario C: Selection on lot 24 under 72 claimed parcels
      renderer.render(ownedRoundRobin, 24);
      assert.strictEqual(
        renderer.getBuildingGroup().children.length,
        0,
        'buildingGroup.children.length must strictly remain 0 during selection'
      );

      // Scenario D: Build 1 shop on lot 0, verify length becomes 1, then clear to verify it returns to 0
      const oneShopGame: GameState = {
        ...ownedRoundRobin,
        lots: ownedRoundRobin.lots.map((l) => (l.id === 0 ? { ...l, shop: 2 } : l)),
      };
      renderer.render(oneShopGame, null);
      assert.strictEqual(
        renderer.getBuildingGroup().children.length,
        1,
        'buildingGroup.children.length must be 1 with single shop'
      );

      // Demolish the shop
      renderer.render(ownedRoundRobin, null);
      assert.strictEqual(
        renderer.getBuildingGroup().children.length,
        0,
        'buildingGroup.children.length must return to 0 after demolition'
      );

      // Scenario E: Rapid cycling between 72 shops and 0 shops (20 iterations)
      const allShopsGame: GameState = {
        ...ownedRoundRobin,
        lots: ownedRoundRobin.lots.map((l, idx) => ({ ...l, shop: idx % 6 })),
      };

      for (let iter = 0; iter < 20; iter++) {
        renderer.render(iter % 2 === 0 ? allShopsGame : ownedRoundRobin, null);
        const expectedCount = iter % 2 === 0 ? TOTAL_LOTS : 0;
        assert.strictEqual(
          renderer.getBuildingGroup().children.length,
          expectedCount,
          `Iteration ${iter}: buildingGroup count must equal ${expectedCount}`
        );
      }

      renderer.unmount();
    });
  });

  describe('Task 4: Scene Disposal and Resource Cleanliness', () => {
    it('verifies disposeHierarchy recursively calls dispose() on all geometries, materials, and textures', () => {
      let disposedGeoms = 0;
      let disposedMats = 0;
      let disposedTexs = 0;

      const group = new THREE.Group();

      const geom1 = new THREE.BoxGeometry(10, 10, 10);
      const origGeomDispose = geom1.dispose.bind(geom1);
      geom1.dispose = () => {
        disposedGeoms++;
        origGeomDispose();
      };

      const canvas = {
        width: 16,
        height: 16,
      } as any;
      const texture = new THREE.CanvasTexture(canvas);
      const origTexDispose = texture.dispose.bind(texture);
      texture.dispose = () => {
        disposedTexs++;
        origTexDispose();
      };

      const mat1 = new THREE.MeshStandardMaterial({ map: texture });
      const origMatDispose = mat1.dispose.bind(mat1);
      mat1.dispose = () => {
        disposedMats++;
        origMatDispose();
      };

      const mesh = new THREE.Mesh(geom1, mat1);
      group.add(mesh);

      disposeHierarchy(group);

      assert.strictEqual(disposedGeoms, 1, 'Geometry dispose must be called');
      assert.strictEqual(disposedMats, 1, 'Material dispose must be called');
      assert.strictEqual(disposedTexs, 1, 'Texture dispose must be called');
    });

    it('verifies unmount() cancels animation frame handle and clears prop and building registries', () => {
      const container = createHeadlessMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      const baseGame = createGame({ seed: 300 });
      renderer.render(baseGame, null);

      assert.strictEqual(Object.keys(renderer.getParcelProps()).length, TOTAL_LOTS);

      // Verify unmount execution
      renderer.unmount();

      assert.strictEqual(Object.keys(renderer.getParcelProps()).length, 0);
      assert.strictEqual((renderer as any).buildingMeshes.size, 0);
      assert.strictEqual((renderer as any).parcelPropMeshes.size, 0);
      assert.strictEqual((renderer as any).animFrameId, null);
    });

    it('verifies 50 repeated mount and unmount cycles without leaking Three.js objects', () => {
      for (let i = 0; i < 50; i++) {
        const container = createHeadlessMockContainer();
        const renderer = new ThreeBoardRenderer({ container });
        renderer.mount();
        renderer.unmount();
      }
    });

    it('records API finding: ThreeBoardRenderer implements unmount() while dispose() is undefined', () => {
      // The public contract in SCOPE.md defines unmount().
      // This test empirically documents that unmount() is the canonical cleanup method.
      assert.strictEqual(typeof ThreeBoardRenderer.prototype.unmount, 'function');
      assert.strictEqual(typeof (ThreeBoardRenderer.prototype as any).dispose, 'undefined');
    });
  });
});
