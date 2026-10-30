/**
 * tests/unit/challenger-m6-2.test.ts
 *
 * Empirical Adversarial Challenge Suite for Milestone M6 3D Board Scene.
 *
 * Verification Areas:
 * 1. Drag movement filtering: threshold evaluation at 5px boundary and stationary click reliability.
 * 2. Golden aura halo activation across all 6 shop categories with both complete and incomplete clusters.
 * 3. Hover elevation (+1.0 Y) and selection elevation (+2.0 Y) coordinate transitions under rapid sequences.
 * 4. System side effects, camera matrix stability, and idempotency invariants.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  DISTRICT_BLOCKS,
  LOT_DEFINITIONS,
  SHOP_CATEGORIES,
  SHOP_TARGET_SIZES,
  TOTAL_LOTS,
} from '../../src/engine/board-layout';
import { createGame } from '../../src/engine/engine';
import type { GameState } from '../../src/engine/types';
import {
  ELEVATION_GOLDEN_CROWN,
  ELEVATION_GOLDEN_LIGHT,
  ELEVATION_PARCEL_BASE,
  ELEVATION_PARCEL_HOVER,
  ELEVATION_PARCEL_SELECTED,
  ThreeBoardRenderer,
  createShopBuilding,
} from '../../src/ui/board-3d';

/**
 * Headless mock container factory.
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

/**
 * Configure mock DOM renderer on ThreeBoardRenderer instance for pointer event tests.
 */
function attachMockDomRenderer(
  renderer: ThreeBoardRenderer,
  width = 1100,
  height = 730
): { domElement: any; getBoundingClientRect: () => any } {
  const mockDomElement = {
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
    }),
    style: { cursor: 'default' },
  };

  (renderer as any).renderer = {
    domElement: mockDomElement,
  };

  return {
    domElement: mockDomElement,
    getBoundingClientRect: mockDomElement.getBoundingClientRect,
  };
}

/**
 * Calculate clientX and clientY corresponding to the 3D center of a parcel.
 */
function getParcelScreenCoords(
  renderer: ThreeBoardRenderer,
  lotId: number,
  width = 1100,
  height = 730
): { clientX: number; clientY: number } {
  const ortho = renderer.getOrthoCamera();
  ortho.updateMatrixWorld(true);

  const mesh = renderer.getParcelMesh(lotId)!;
  mesh.updateMatrixWorld(true);
  const worldPos = new THREE.Vector3();
  mesh.getWorldPosition(worldPos);

  const ndc = worldPos.clone().project(ortho);

  const clientX = ((ndc.x + 1) / 2) * width;
  const clientY = ((1 - ndc.y) / 2) * height;

  return { clientX, clientY };
}

describe('Empirical Challenge 1: Drag Movement Filtering and Pointer Click Discrimination', () => {
  it('triggers onSelectLot reliably upon stationary click within 600ms', () => {
    const selectedLots: number[] = [];
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({
      container,
      onSelectLot: (id) => selectedLots.push(id),
    });
    attachMockDomRenderer(renderer);

    const { clientX, clientY } = getParcelScreenCoords(renderer, 0);

    // Simulate stationary pointer click
    (renderer as any).handlePointerDown({ clientX, clientY });
    (renderer as any).handlePointerUp({ clientX, clientY });

    assert.strictEqual(selectedLots.length, 1);
    assert.strictEqual(selectedLots[0], 0);
  });

  it('allows small micro-jitter movements up to and including 5.0 pixels to trigger onSelectLot', () => {
    const selectedLots: number[] = [];
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({
      container,
      onSelectLot: (id) => selectedLots.push(id),
    });
    attachMockDomRenderer(renderer);

    const targetLot = 1;
    const { clientX, clientY } = getParcelScreenCoords(renderer, targetLot);

    // Test jitter with dist = 3.0 px
    (renderer as any).handlePointerDown({ clientX, clientY });
    (renderer as any).handlePointerMove({ clientX: clientX + 3, clientY });
    (renderer as any).handlePointerUp({ clientX: clientX + 3, clientY });
    assert.strictEqual(selectedLots.length, 1);
    assert.strictEqual(selectedLots[0], targetLot);

    // Test diagonal jitter with dx = 3, dy = 3 (dist = 4.24 px <= 5)
    (renderer as any).handlePointerDown({ clientX, clientY });
    (renderer as any).handlePointerMove({ clientX: clientX + 3, clientY: clientY + 3 });
    (renderer as any).handlePointerUp({ clientX: clientX + 3, clientY: clientY + 3 });
    assert.strictEqual(selectedLots.length, 2);
    assert.strictEqual(selectedLots[1], targetLot);

    // Test exact boundary: dx = 5.0, dy = 0 (dist = 5.0 px <= 5)
    (renderer as any).handlePointerDown({ clientX, clientY });
    (renderer as any).handlePointerMove({ clientX: clientX + 5.0, clientY });
    (renderer as any).handlePointerUp({ clientX: clientX + 5.0, clientY });
    assert.strictEqual(selectedLots.length, 3);
    assert.strictEqual(selectedLots[2], targetLot);
  });

  it('strictly filters movements exceeding 5.0 pixels and never triggers onSelectLot', () => {
    const selectedLots: number[] = [];
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({
      container,
      onSelectLot: (id) => selectedLots.push(id),
    });
    attachMockDomRenderer(renderer);

    const { clientX, clientY } = getParcelScreenCoords(renderer, 2);

    // Just above boundary: dx = 5.1 px
    (renderer as any).handlePointerDown({ clientX, clientY });
    (renderer as any).handlePointerMove({ clientX: clientX + 5.1, clientY });
    (renderer as any).handlePointerUp({ clientX: clientX + 5.1, clientY });
    assert.strictEqual(selectedLots.length, 0);

    // Diagonal drag: dx = 4, dy = 4 (dist = 5.656 px > 5)
    (renderer as any).handlePointerDown({ clientX, clientY });
    (renderer as any).handlePointerMove({ clientX: clientX + 4, clientY: clientY + 4 });
    (renderer as any).handlePointerUp({ clientX: clientX + 4, clientY: clientY + 4 });
    assert.strictEqual(selectedLots.length, 0);

    // Moderate drag: dx = 12 px
    (renderer as any).handlePointerDown({ clientX, clientY });
    (renderer as any).handlePointerMove({ clientX: clientX + 12, clientY });
    (renderer as any).handlePointerUp({ clientX: clientX + 12, clientY });
    assert.strictEqual(selectedLots.length, 0);

    // Large camera panning drag: dx = 150 px, dy = 90 px
    (renderer as any).handlePointerDown({ clientX, clientY });
    (renderer as any).handlePointerMove({ clientX: clientX + 150, clientY: clientY + 90 });
    (renderer as any).handlePointerUp({ clientX: clientX + 150, clientY: clientY + 90 });
    assert.strictEqual(selectedLots.length, 0);
  });

  it('filters movements across all directional vectors (negative X, negative Y, diagonals)', () => {
    const selectedLots: number[] = [];
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({
      container,
      onSelectLot: (id) => selectedLots.push(id),
    });
    attachMockDomRenderer(renderer);

    const { clientX, clientY } = getParcelScreenCoords(renderer, 3);

    const dragVectors = [
      [-6, 0], // Left
      [6, 0], // Right
      [0, -6], // Up
      [0, 6], // Down
      [-4.5, -4.5], // Top left (dist = 6.36)
      [4.5, -4.5], // Top right (dist = 6.36)
      [-4.5, 4.5], // Bottom left (dist = 6.36)
      [4.5, 4.5], // Bottom right (dist = 6.36)
    ];

    for (const [vx, vy] of dragVectors) {
      (renderer as any).handlePointerDown({ clientX, clientY });
      (renderer as any).handlePointerMove({ clientX: clientX + vx, clientY: clientY + vy });
      (renderer as any).handlePointerUp({ clientX: clientX + vx, clientY: clientY + vy });
      assert.strictEqual(selectedLots.length, 0, `Vector [${vx}, ${vy}] must be filtered out`);
    }
  });

  it('suppresses selection clicks in both isometric and perspective camera modes during drag', () => {
    const selectedLots: number[] = [];
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({
      container,
      onSelectLot: (id) => selectedLots.push(id),
    });
    attachMockDomRenderer(renderer);

    const { clientX, clientY } = getParcelScreenCoords(renderer, 4);

    // Isometric mode drag
    assert.strictEqual(renderer.getCameraMode(), 'isometric');
    (renderer as any).handlePointerDown({ clientX, clientY });
    (renderer as any).handlePointerMove({ clientX: clientX + 20, clientY });
    (renderer as any).handlePointerUp({ clientX: clientX + 20, clientY });
    assert.strictEqual(selectedLots.length, 0);

    // Perspective mode drag
    renderer.setCameraMode('perspective');
    assert.strictEqual(renderer.getCameraMode(), 'perspective');
    (renderer as any).handlePointerDown({ clientX, clientY, buttons: 1 });
    (renderer as any).handlePointerMove({ clientX: clientX + 20, clientY, buttons: 1 });
    (renderer as any).handlePointerUp({ clientX: clientX + 20, clientY });
    assert.strictEqual(selectedLots.length, 0);
  });

  it('suppresses selection clicks when pointer hold duration exceeds 600ms', () => {
    const selectedLots: number[] = [];
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({
      container,
      onSelectLot: (id) => selectedLots.push(id),
    });
    attachMockDomRenderer(renderer);

    const { clientX, clientY } = getParcelScreenCoords(renderer, 5);

    // Simulate stationary hold for 700ms (exceeding CLICK_TIME_LIMIT_MS of 600ms)
    (renderer as any).handlePointerDown({ clientX, clientY });
    (renderer as any).pointerDownPos.time = performance.now() - 700;
    (renderer as any).handlePointerUp({ clientX, clientY });

    assert.strictEqual(selectedLots.length, 0);
  });

  it('handles rapid alternating sequence of drags and clicks without state leakage', () => {
    const selectedLots: number[] = [];
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({
      container,
      onSelectLot: (id) => selectedLots.push(id),
    });
    attachMockDomRenderer(renderer);

    const lots = [10, 11, 12, 13];

    for (const lotId of lots) {
      const { clientX, clientY } = getParcelScreenCoords(renderer, lotId);

      // Drag sequence on parcel: must NOT select
      (renderer as any).handlePointerDown({ clientX, clientY });
      (renderer as any).handlePointerMove({ clientX: clientX + 25, clientY: clientY + 5 });
      (renderer as any).handlePointerUp({ clientX: clientX + 25, clientY: clientY + 5 });

      // Clean stationary click on parcel: MUST select
      (renderer as any).handlePointerDown({ clientX, clientY });
      (renderer as any).handlePointerUp({ clientX, clientY });
    }

    assert.deepStrictEqual(selectedLots, [10, 11, 12, 13]);
  });

  it('ignores clicks outside of any parcel boundaries', () => {
    const selectedLots: number[] = [];
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({
      container,
      onSelectLot: (id) => selectedLots.push(id),
    });
    attachMockDomRenderer(renderer);

    // Far corner coordinates (10, 10)
    (renderer as any).handlePointerDown({ clientX: 10, clientY: 10 });
    (renderer as any).handlePointerUp({ clientX: 10, clientY: 10 });

    assert.strictEqual(selectedLots.length, 0);
  });

  it('allows passive mouse movements without pointerdown to trigger hover raycasting without flagging drag', () => {
    const hoveredLots: (number | null)[] = [];
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({
      container,
      onHoverLot: (id) => hoveredLots.push(id),
    });
    attachMockDomRenderer(renderer);

    const { clientX, clientY } = getParcelScreenCoords(renderer, 0);

    // Moving mouse across screen without pointerdown: passive move executes hover raycast without drag
    (renderer as any).handlePointerMove({ clientX, clientY, buttons: 0 });
    assert.strictEqual(renderer.getHoveredLotId(), 0);
    assert.strictEqual((renderer as any).isDragging, false);
    assert.strictEqual(hoveredLots.length, 1);
    assert.strictEqual(hoveredLots[0], 0);

    // When pointer position is properly tracked without drag, raycast succeeds
    (renderer as any).pointerDownPos = { x: clientX, y: clientY, time: performance.now() };
    (renderer as any).isDragging = false;
    (renderer as any).handlePointerMove({ clientX, clientY, buttons: 0 });
    assert.strictEqual(renderer.getHoveredLotId(), 0);
  });
});

describe('Empirical Challenge 2: Golden Aura Halo Activation Across All 6 Shop Categories', () => {
  it('activates GoldenAuraHalo on building mesh if and only if isComplete is true for all 6 shop types', () => {
    for (let shopType = 0; shopType < 6; shopType++) {
      const targetSize = SHOP_TARGET_SIZES[shopType];

      // Incomplete clusters (sizes 1 to targetSize - 1)
      for (let size = 1; size < targetSize; size++) {
        const incompleteBuilding = createShopBuilding(shopType, size, false);
        const halo = incompleteBuilding.children.find((c) => c.name === 'GoldenAuraHalo');
        assert.strictEqual(
          halo,
          undefined,
          `Shop ${shopType} at incomplete size ${size} must not have GoldenAuraHalo`
        );
      }

      // Complete cluster
      const completeBuilding = createShopBuilding(shopType, targetSize, true);
      const halo = completeBuilding.children.find((c) => c.name === 'GoldenAuraHalo') as THREE.Mesh;
      assert.ok(
        halo,
        `Shop ${shopType} at complete size ${targetSize} must have GoldenAuraHalo`
      );
      assert.ok(halo.geometry instanceof THREE.TorusGeometry);
      assert.strictEqual((halo.material as THREE.MeshBasicMaterial).color.getHex(), 0xffd700);
    }
  });

  it('manages golden aura lighting and floating crowns across all 6 shop categories in GameState', () => {
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({ container });

    // Contiguous cluster path in District 0: lots [0, 1, 2, 5, 6, 4] are orthogonally connected
    const contiguousPath = [0, 1, 2, 5, 6, 4];

    // Test each shop category progressively
    for (let shopType = 0; shopType < 6; shopType++) {
      const targetSize = SHOP_TARGET_SIZES[shopType];
      const completeLots = contiguousPath.slice(0, targetSize);

      // 1. Incomplete state: allocate targetSize - 1 lots
      const incompleteLots = completeLots.slice(0, targetSize - 1);
      let gameIncomplete = createGame({ seed: 100 + shopType });
      gameIncomplete = {
        ...gameIncomplete,
        lots: gameIncomplete.lots.map((lot) => {
          if (incompleteLots.includes(lot.id)) {
            return { ...lot, owner: 0, shop: shopType };
          }
          return lot;
        }),
      };

      renderer.render(gameIncomplete, null);

      const auraGroupIncomplete = renderer.getGoldenAuraGroup();
      assert.strictEqual(
        auraGroupIncomplete.children.length,
        0,
        `Golden aura group must have 0 elements for incomplete category ${shopType} (size ${incompleteLots.length})`
      );

      // Check that individual building meshes do not possess GoldenAuraHalo
      for (const lotId of incompleteLots) {
        const building = renderer.getBuildingMesh(lotId);
        assert.ok(building);
        const halo = building.children.find((c) => c.name === 'GoldenAuraHalo');
        assert.strictEqual(
          halo,
          undefined,
          `Incomplete building on lot ${lotId} must not have GoldenAuraHalo`
        );
      }

      // 2. Complete state: allocate all targetSize lots
      let gameComplete = createGame({ seed: 200 + shopType });
      gameComplete = {
        ...gameComplete,
        lots: gameComplete.lots.map((lot) => {
          if (completeLots.includes(lot.id)) {
            return { ...lot, owner: 0, shop: shopType };
          }
          return lot;
        }),
      };

      renderer.render(gameComplete, null);

      const auraGroupComplete = renderer.getGoldenAuraGroup();
      assert.ok(
        auraGroupComplete.children.length >= 2,
        `Complete category ${shopType} must generate light and crown markers in goldenAuraGroup`
      );

      const light = auraGroupComplete.children.find(
        (c) => c instanceof THREE.PointLight
      ) as THREE.PointLight;
      assert.ok(light, `Radiant point light must exist for category ${shopType}`);
      assert.strictEqual(light.position.y, ELEVATION_GOLDEN_LIGHT);
      assert.strictEqual(light.color.getHex(), 0xffd700);

      const crown = auraGroupComplete.children.find((c) =>
        c.name.startsWith('GoldenCrown_')
      ) as THREE.Mesh;
      assert.ok(crown, `Crown marker must exist for category ${shopType}`);
      assert.strictEqual(crown.position.y, ELEVATION_GOLDEN_CROWN);
      assert.ok(crown.geometry instanceof THREE.OctahedronGeometry);

      // Check that all complete buildings have GoldenAuraHalo
      for (const lotId of completeLots) {
        const building = renderer.getBuildingMesh(lotId);
        assert.ok(building);
        const halo = building.children.find((c) => c.name === 'GoldenAuraHalo');
        assert.ok(halo, `Complete building on lot ${lotId} must have GoldenAuraHalo`);
      }
    }
  });

  it('isolates golden auras so incomplete clusters on the same board never trigger auras', () => {
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({ container });

    // Setup: Player 0 has complete DEX Swap (lots 0, 1, 2 in District 0)
    // Player 1 has incomplete Staking Vault (lots 48, 49, 50 in District 4: target is 4, only 3 built)
    let game = createGame({ seed: 42 });
    game = {
      ...game,
      lots: game.lots.map((lot) => {
        if (lot.id === 0 || lot.id === 1 || lot.id === 2) {
          return { ...lot, owner: 0, shop: 0 };
        }
        if (lot.id === 48 || lot.id === 49 || lot.id === 50) {
          return { ...lot, owner: 1, shop: 2 };
        }
        return lot;
      }),
    };

    renderer.render(game, null);

    // Exactly 1 complete cluster should be active
    const auraGroup = renderer.getGoldenAuraGroup();
    const lights = auraGroup.children.filter((c) => c instanceof THREE.PointLight);
    const crowns = auraGroup.children.filter((c) => c.name.startsWith('GoldenCrown_'));

    assert.strictEqual(lights.length, 1);
    assert.strictEqual(crowns.length, 1);
    assert.ok(crowns[0].name.includes('0_0')); // District 0, Shop 0

    // Completed DEX Swap buildings have halos
    for (const lotId of [0, 1, 2]) {
      const b = renderer.getBuildingMesh(lotId)!;
      assert.ok(b.children.some((c) => c.name === 'GoldenAuraHalo'));
    }

    // Incomplete Staking Vault buildings must NOT have halos
    for (const lotId of [48, 49, 50]) {
      const b = renderer.getBuildingMesh(lotId)!;
      assert.ok(!b.children.some((c) => c.name === 'GoldenAuraHalo'));
    }
  });

  it('clears golden aura elements cleanly when a completed cluster is unbuilt', () => {
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({ container });

    let game = createGame({ seed: 50 });
    // Build complete DEX Swap
    game = {
      ...game,
      lots: game.lots.map((lot) =>
        lot.id === 0 || lot.id === 1 || lot.id === 2 ? { ...lot, owner: 0, shop: 0 } : lot
      ),
    };
    renderer.render(game, null);
    assert.ok(renderer.getGoldenAuraGroup().children.length >= 2);

    // Demolish lot 2 (cluster now size 2, incomplete)
    game = {
      ...game,
      lots: game.lots.map((lot) => (lot.id === 2 ? { ...lot, shop: null } : lot)),
    };
    renderer.render(game, null);

    assert.strictEqual(renderer.getGoldenAuraGroup().children.length, 0);
    assert.strictEqual(renderer.getBuildingMesh(2), undefined);

    // Remaining lots 0 and 1 buildings must lose their halos
    for (const lotId of [0, 1]) {
      const b = renderer.getBuildingMesh(lotId)!;
      assert.strictEqual(b.children.find((c) => c.name === 'GoldenAuraHalo'), undefined);
    }
  });
});

describe('Empirical Challenge 3: Hover and Selection Elevation Coordinate Transitions', () => {
  it('transitions parcel vertical positions accurately between base, hover (+1.0 Y), and selected (+2.0 Y)', () => {
    const hoveredLots: (number | null)[] = [];
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({
      container,
      onHoverLot: (id) => hoveredLots.push(id),
    });
    attachMockDomRenderer(renderer);

    const game = createGame({ seed: 77 });
    renderer.render(game, null);

    const mesh0 = renderer.getParcelMesh(0)!;
    const mesh1 = renderer.getParcelMesh(1)!;

    // 1. Initial base elevation
    assert.strictEqual(mesh0.position.y, ELEVATION_PARCEL_BASE); // 4.5
    assert.strictEqual(mesh1.position.y, ELEVATION_PARCEL_BASE); // 4.5

    // 2. Set parcel 0 as hovered
    (renderer as any).hoveredLotId = 0;
    renderer.render(game, null);
    assert.strictEqual(mesh0.position.y, ELEVATION_PARCEL_HOVER); // 5.5 (+1.0 Y)
    assert.strictEqual(mesh1.position.y, ELEVATION_PARCEL_BASE); // 4.5

    // 3. Select parcel 0
    renderer.render(game, 0);
    assert.strictEqual(mesh0.position.y, ELEVATION_PARCEL_SELECTED); // 6.5 (+2.0 Y)
    assert.strictEqual(mesh1.position.y, ELEVATION_PARCEL_BASE); // 4.5

    // 4. Hover parcel 1 while parcel 0 remains selected
    (renderer as any).hoveredLotId = 1;
    renderer.render(game, 0);
    assert.strictEqual(mesh0.position.y, ELEVATION_PARCEL_SELECTED); // 6.5 (+2.0 Y)
    assert.strictEqual(mesh1.position.y, ELEVATION_PARCEL_HOVER); // 5.5 (+1.0 Y)

    // 5. Select parcel 1 (parcel 0 drops back to base, parcel 1 stays at selected)
    renderer.render(game, 1);
    assert.strictEqual(mesh0.position.y, ELEVATION_PARCEL_BASE); // 4.5
    assert.strictEqual(mesh1.position.y, ELEVATION_PARCEL_SELECTED); // 6.5

    // 6. Unhover all and deselect
    (renderer as any).hoveredLotId = null;
    renderer.render(game, null);
    assert.strictEqual(mesh0.position.y, ELEVATION_PARCEL_BASE); // 4.5
    assert.strictEqual(mesh1.position.y, ELEVATION_PARCEL_BASE); // 4.5
  });

  it('maintains strict precedence of selection elevation (+2.0 Y) over hover elevation (+1.0 Y)', () => {
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({ container });
    attachMockDomRenderer(renderer);

    const game = createGame({ seed: 88 });

    // Set parcel 5 as hovered
    (renderer as any).hoveredLotId = 5;

    // Render with parcel 5 also selected: selection must take precedence
    renderer.render(game, 5);

    const mesh5 = renderer.getParcelMesh(5)!;
    assert.strictEqual(mesh5.position.y, ELEVATION_PARCEL_SELECTED); // 6.5

    // Deselect parcel 5 while hover remains active: must drop to hover elevation
    renderer.render(game, null);
    assert.strictEqual(mesh5.position.y, ELEVATION_PARCEL_HOVER); // 5.5
  });

  it('causes procedural building meshes to mirror parcel elevation lifts synchronously', () => {
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({ container });
    attachMockDomRenderer(renderer);

    // Build DEX Swap on parcel 10
    let game = createGame({ seed: 99 });
    game = {
      ...game,
      lots: game.lots.map((lot) => (lot.id === 10 ? { ...lot, owner: 0, shop: 0 } : lot)),
    };

    // 1. Base elevation
    renderer.render(game, null);
    const building10 = renderer.getBuildingMesh(10)!;
    assert.ok(building10);
    assert.strictEqual(building10.position.y, ELEVATION_PARCEL_BASE + 1.0); // 5.5

    // 2. Hover parcel 10
    (renderer as any).hoveredLotId = 10;
    renderer.render(game, null);
    assert.strictEqual(building10.position.y, ELEVATION_PARCEL_HOVER + 1.0); // 6.5

    // 3. Select parcel 10
    renderer.render(game, 10);
    assert.strictEqual(building10.position.y, ELEVATION_PARCEL_SELECTED + 1.0); // 7.5

    // 4. Return to base
    (renderer as any).hoveredLotId = null;
    renderer.render(game, null);
    assert.strictEqual(building10.position.y, ELEVATION_PARCEL_BASE + 1.0); // 5.5
  });

  it('preserves single-parcel elevation invariants across rapid sweeps over all 72 parcels', () => {
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({ container });
    attachMockDomRenderer(renderer);

    const game = createGame({ seed: 123 });

    // Rapid selection sweep over all 72 parcels
    for (let selectedId = 0; selectedId < TOTAL_LOTS; selectedId++) {
      renderer.render(game, selectedId);

      for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
        const mesh = renderer.getParcelMesh(lotId)!;
        if (lotId === selectedId) {
          assert.strictEqual(
            mesh.position.y,
            ELEVATION_PARCEL_SELECTED,
            `Selected lot ${lotId} must be at ELEVATION_PARCEL_SELECTED`
          );
        } else {
          assert.strictEqual(
            mesh.position.y,
            ELEVATION_PARCEL_BASE,
            `Unselected lot ${lotId} must be at ELEVATION_PARCEL_BASE`
          );
        }
      }
    }
  });

  it('maintains elevation invariants through a 200-cycle randomized rapid event fuzz test', () => {
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({ container });
    attachMockDomRenderer(renderer);

    const game = createGame({ seed: 777 });

    let currentSelected: number | null = null;
    let currentHovered: number | null = null;

    // Pseudo-random deterministic LCG generator
    let seed = 42;
    function rand() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    for (let cycle = 0; cycle < 200; cycle++) {
      const action = Math.floor(rand() * 4);

      if (action === 0) {
        // Select random lot
        currentSelected = Math.floor(rand() * TOTAL_LOTS);
      } else if (action === 1) {
        // Deselect
        currentSelected = null;
      } else if (action === 2) {
        // Hover random lot
        currentHovered = Math.floor(rand() * TOTAL_LOTS);
        (renderer as any).hoveredLotId = currentHovered;
      } else {
        // Unhover
        currentHovered = null;
        (renderer as any).hoveredLotId = null;
      }

      renderer.render(game, currentSelected);

      // Verify spatial invariants across all 72 parcels
      for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
        const mesh = renderer.getParcelMesh(lotId)!;
        const isSelected = lotId === currentSelected;
        const isHovered = lotId === currentHovered;

        let expectedY = ELEVATION_PARCEL_BASE;
        if (isSelected) {
          expectedY = ELEVATION_PARCEL_SELECTED;
        } else if (isHovered) {
          expectedY = ELEVATION_PARCEL_HOVER;
        }

        assert.strictEqual(
          mesh.position.y,
          expectedY,
          `Cycle ${cycle}: lot ${lotId} elevation Y must match expected (${expectedY})`
        );
      }
    }
  });
});

describe('Empirical Challenge 4: Full Suite Side Effects and Integration Invariants', () => {
  it('preserves parcel geometries and coordinates across camera mode transitions', () => {
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({ container });

    const initialPositions = Array.from({ length: TOTAL_LOTS }, (_, i) => {
      const mesh = renderer.getParcelMesh(i)!;
      return { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
    });

    // Toggle camera mode 4 times
    renderer.toggleCameraMode();
    assert.strictEqual(renderer.getCameraMode(), 'perspective');
    renderer.toggleCameraMode();
    assert.strictEqual(renderer.getCameraMode(), 'isometric');
    renderer.setCameraMode('perspective');
    renderer.setCameraMode('isometric');

    // Verify all 72 positions are completely unaltered
    for (let i = 0; i < TOTAL_LOTS; i++) {
      const mesh = renderer.getParcelMesh(i)!;
      assert.strictEqual(mesh.position.x, initialPositions[i].x);
      assert.strictEqual(mesh.position.y, initialPositions[i].y);
      assert.strictEqual(mesh.position.z, initialPositions[i].z);
    }
  });

  it('guarantees render idempotency with zero duplicate mesh allocations on identical state', () => {
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({ container });

    let game = createGame({ seed: 333 });
    game = {
      ...game,
      lots: game.lots.map((lot) =>
        lot.id < 6 ? { ...lot, owner: 0, shop: lot.id % 6 } : lot
      ),
    };

    // First render
    renderer.render(game, 2);
    const buildingGroup = renderer.getBuildingGroup();
    const auraGroup = renderer.getGoldenAuraGroup();

    const buildingCount1 = buildingGroup.children.length;
    const auraCount1 = auraGroup.children.length;

    // Second render with exact same parameters
    renderer.render(game, 2);
    assert.strictEqual(buildingGroup.children.length, buildingCount1);
    assert.strictEqual(auraGroup.children.length, auraCount1);

    // Third render with exact same parameters
    renderer.render(game, 2);
    assert.strictEqual(buildingGroup.children.length, buildingCount1);
    assert.strictEqual(auraGroup.children.length, auraCount1);
  });
});
