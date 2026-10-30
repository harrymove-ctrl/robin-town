/**
 * scripts/stress-board-3d.ts
 *
 * Empirical stress test harness for Milestone M6 Three.js 3D board scene.
 * Evaluates:
 * 1. Extreme edge cases: rapid camera mode toggles, repeated mount/unmount cycles,
 *    rapid render updates with zero/all parcels owned, and all clusters completed simultaneously.
 * 2. Raycast hit testing at parcel boundaries, street gaps, off-screen points, and invalid coordinates.
 * 3. Memory disposal and leak tracking on repeatedly unmounted renderers and evolving shop clusters.
 * 4. Runtime crash resilience under hostile and boundary inputs.
 */

import * as assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  DISTRICT_BLOCKS,
  LOT_DEFINITIONS,
  TOTAL_LOTS,
  findAllClusters,
} from '../src/engine/board-layout';
import { createGame } from '../src/engine/engine';
import type { GameState, Lot } from '../src/engine/types';
import {
  BOARD_ORIGIN_X,
  BOARD_ORIGIN_Z,
  ELEVATION_GOLDEN_CROWN,
  ELEVATION_GOLDEN_LIGHT,
  ELEVATION_PARCEL_BASE,
  SHOP_VISUAL_CATEGORIES,
  ThreeBoardRenderer,
  canvasToWorld,
  createShopBuilding,
  getParcelWorldPosition,
  isWebGLAvailable,
  worldToCanvas,
} from '../src/ui/board-3d';

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

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'DEFECT_CONFIRMED';
  details?: string;
}

const results: TestResult[] = [];

function runTest(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, status: 'PASS' });
    console.log(`  PASS: ${name}`);
  } catch (err: any) {
    results.push({ name, status: 'FAIL', details: err.message || String(err) });
    console.log(`  FAIL: ${name}`);
    console.log(`    ${err.message}`);
  }
}

function recordDefect(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, status: 'DEFECT_CONFIRMED' });
    console.log(`  DEFECT CONFIRMED: ${name}`);
  } catch (err: any) {
    results.push({ name, status: 'FAIL', details: err.message || String(err) });
    console.log(`  FAILED TO REPRODUCE DEFECT: ${name}`);
    console.log(`    ${err.message}`);
  }
}

console.log('=== STARTING EMPIRICAL 3D BOARD STRESS HARNESS ===\n');

// ---------------------------------------------------------------------------
// SUITE 1: Extreme Camera Mode Toggles & Continuous Transitions
// ---------------------------------------------------------------------------
console.log('--- Suite 1: Rapid Camera Mode Toggles & Continuous Transitions ---');

runTest('1.1 Rapid camera toggles (1,000 toggles in tight loop)', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });

  for (let i = 0; i < 1000; i++) {
    renderer.toggleCameraMode();
  }

  assert.strictEqual(renderer.getCameraMode(), 'isometric');
  const target = renderer.getCameraTarget();
  assert.ok(Number.isFinite(target.x));
  assert.ok(Number.isFinite(target.y));
  assert.ok(Number.isFinite(target.z));
});

runTest('1.2 setCameraMode idempotency when already in target mode', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });

  for (let i = 0; i < 100; i++) {
    renderer.setCameraMode('isometric');
  }
  assert.strictEqual(renderer.getCameraMode(), 'isometric');

  for (let i = 0; i < 100; i++) {
    renderer.setCameraMode('perspective');
  }
  assert.strictEqual(renderer.getCameraMode(), 'perspective');
});

runTest('1.3 Animation step lerp stability across extreme timestamps', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });
  renderer.setCameraMode('perspective');

  const testTimestamps = [0, 1, 16.6, 50, 100, 375, 750, 1000, 1e6, 1e12];
  for (const t of testTimestamps) {
    (renderer as any).updateAnimations(t);
    const target = renderer.getCameraTarget();
    assert.ok(Number.isFinite(target.x), `target.x must be finite at t=${t}`);
    assert.ok(Number.isFinite(target.y), `target.y must be finite at t=${t}`);
    assert.ok(Number.isFinite(target.z), `target.z must be finite at t=${t}`);
    assert.ok(Number.isFinite((renderer as any).cameraDistance));
  }
});

// ---------------------------------------------------------------------------
// SUITE 2: Repeated Mount and Unmount Cycles & Lifecycle Invariants
// ---------------------------------------------------------------------------
console.log('\n--- Suite 2: Repeated Mount and Unmount Cycles ---');

runTest('2.1 Repeated mount/unmount cycles on single instance (50 iterations)', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });

  for (let i = 0; i < 50; i++) {
    renderer.mount();
    renderer.unmount();
  }
});

runTest('2.2 Consecutive mount calls without intermediate unmount', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });

  for (let i = 0; i < 20; i++) {
    renderer.mount();
  }
  renderer.unmount();
});

runTest('2.3 Consecutive unmount calls without intermediate mount', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });

  renderer.mount();
  for (let i = 0; i < 20; i++) {
    renderer.unmount();
  }
});

runTest('2.4 Rapid allocation and unmounting of 100 distinct renderer instances', () => {
  for (let i = 0; i < 100; i++) {
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({ container });
    renderer.mount();
    renderer.unmount();
  }
});

runTest('2.5 Post-unmount render execution behavior', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });
  renderer.mount();
  renderer.unmount();

  const game = createGame({ seed: 42 });
  assert.doesNotThrow(() => {
    renderer.render(game, null);
  });
});

// ---------------------------------------------------------------------------
// SUITE 3: Rapid Render Updates with Extreme Game States
// ---------------------------------------------------------------------------
console.log('\n--- Suite 3: Rapid Render Updates & Extreme Game States ---');

runTest('3.1 Zero parcels owned (completely empty board, 100 iterations)', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });

  const baseGame1 = createGame({ seed: 1 });
  const emptyLots: Lot[] = baseGame1.lots.map((l) => ({
    ...l,
    owner: null,
    shop: null,
  }));
  const emptyGame: GameState = { ...baseGame1, lots: emptyLots };

  const start = performance.now();
  for (let i = 0; i < 100; i++) {
    renderer.render(emptyGame, null);
  }
  const duration = performance.now() - start;
  console.log(`    100 empty render cycles completed in ${duration.toFixed(2)}ms`);

  assert.strictEqual(renderer.getBuildingGroup().children.length, 0);
  assert.strictEqual(renderer.getGoldenAuraGroup().children.length, 0);

  for (let id = 0; id < TOTAL_LOTS; id++) {
    const mesh = renderer.getParcelMesh(id)!;
    assert.strictEqual(mesh.position.y, ELEVATION_PARCEL_BASE);
  }
});

runTest('3.2 All 72 parcels owned with no shops (50 iterations)', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });

  const baseGame2 = createGame({ seed: 2 });
  const ownedLots: Lot[] = baseGame2.lots.map((l, id) => ({
    ...l,
    owner: (id % 4) as 0 | 1 | 2 | 3,
    shop: null,
  }));
  const ownedGame: GameState = { ...baseGame2, lots: ownedLots };

  for (let i = 0; i < 50; i++) {
    renderer.render(ownedGame, i % TOTAL_LOTS);
  }

  assert.strictEqual(renderer.getBuildingGroup().children.length, 0);
  assert.strictEqual(renderer.getGoldenAuraGroup().children.length, 0);
});

runTest('3.3 All 72 parcels owned with full shops across all districts', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });

  const baseGame3 = createGame({ seed: 3 });
  const fullShopLots: Lot[] = baseGame3.lots.map((l, id) => {
    const block = LOT_DEFINITIONS[id].block;
    return {
      ...l,
      owner: (block % 4) as 0 | 1 | 2 | 3,
      shop: block,
    };
  });
  const fullShopGame: GameState = { ...baseGame3, lots: fullShopLots };

  renderer.render(fullShopGame, null);

  const buildingGroup = renderer.getBuildingGroup();
  assert.strictEqual(buildingGroup.children.length, TOTAL_LOTS);

  const goldenAuraGroup = renderer.getGoldenAuraGroup();
  const clusters = findAllClusters(fullShopLots);
  const completeClusters = clusters.filter((c) => c.isComplete);
  console.log(`    Detected ${clusters.length} clusters (${completeClusters.length} complete)`);

  const goldenLights = goldenAuraGroup.children.filter((c) => c instanceof THREE.PointLight);
  const goldenCrowns = goldenAuraGroup.children.filter((c) => c.name.startsWith('GoldenCrown_'));

  assert.strictEqual(goldenLights.length, completeClusters.length);
  assert.strictEqual(goldenCrowns.length, completeClusters.length);
});

runTest('3.4 Alternating extreme states (empty vs full, 50 cycles)', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });

  const baseEmpty = createGame({ seed: 10 });
  const emptyGame: GameState = {
    ...baseEmpty,
    lots: baseEmpty.lots.map((l) => ({ ...l, owner: null, shop: null })),
  };

  const baseFull = createGame({ seed: 11 });
  const fullGame: GameState = {
    ...baseFull,
    lots: baseFull.lots.map((l, id) => ({
      ...l,
      owner: (id % 4) as 0 | 1 | 2 | 3,
      shop: id % 6,
    })),
  };

  const start = performance.now();
  for (let i = 0; i < 50; i++) {
    renderer.render(i % 2 === 0 ? emptyGame : fullGame, i % 2 === 0 ? null : 0);
  }
  const duration = performance.now() - start;
  console.log(`    50 alternating state renders completed in ${duration.toFixed(2)}ms`);
});

// ---------------------------------------------------------------------------
// SUITE 4: Raycast Hit Testing at Boundaries, Gaps, Off-Screen, and Edge Cases
// ---------------------------------------------------------------------------
console.log('\n--- Suite 4: Raycast Hit Testing at Boundaries and Edge Cases ---');

runTest('4.1 Center hit on testable sample of parcels under orthographic camera', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });
  const ortho = renderer.getOrthoCamera();
  ortho.updateMatrixWorld(true);

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

runTest('4.2 Center hit on parcels under perspective camera', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });
  renderer.setCameraMode('perspective');
  (renderer as any).isTransitioning = false;
  (renderer as any).activeCamera = renderer.getPerspCamera();

  const persp = renderer.getPerspCamera();
  persp.updateMatrixWorld(true);

  const sampleLots = [0, 5, 12, 24, 36, 48, 60];
  for (const lotId of sampleLots) {
    const mesh = renderer.getParcelMesh(lotId)!;
    mesh.updateMatrixWorld(true);
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);

    const ndc = worldPos.clone().project(persp);
    const hit = renderer.raycastAt({ x: ndc.x, y: ndc.y });
    assert.strictEqual(hit, lotId, `Perspective raycast must hit lot ${lotId}`);
  }
});

runTest('4.3 Extreme off-screen NDC coordinates return null without crashing', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });

  const offScreenPoints = [
    { x: 1.5, y: 1.5 },
    { x: -2.0, y: 0.0 },
    { x: 100.0, y: -100.0 },
    { x: 0.0, y: 50.0 },
    { x: -999.0, y: -999.0 },
  ];

  for (const pt of offScreenPoints) {
    const hit = renderer.raycastAt(pt);
    assert.strictEqual(hit, null, `Off-screen NDC (${pt.x}, ${pt.y}) must return null`);
  }
});

// ---------------------------------------------------------------------------
// SUITE 5: Remediated Invariants & Resilience Verification
// ---------------------------------------------------------------------------
console.log('\n--- Suite 5: Remediated Invariants & Resilience Verification ---');

runTest('5.1 Safe handling of focusLot(NaN) without runtime crash', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });

  let threw = false;
  try {
    renderer.focusLot(NaN);
  } catch (err: any) {
    threw = true;
  }
  assert.strictEqual(threw, false, 'focusLot(NaN) must not throw');
});

runTest('5.2 Safe handling of focusLot(undefined) without runtime crash', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });

  let threw = false;
  try {
    renderer.focusLot(undefined as any);
  } catch (err: any) {
    threw = true;
  }
  assert.strictEqual(threw, false, 'focusLot(undefined) must not throw');
});

runTest('5.3 Safe handling of focusLot with float index 1.5 without runtime crash', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });

  let threw = false;
  try {
    renderer.focusLot(1.5);
  } catch (err: any) {
    threw = true;
  }
  assert.strictEqual(threw, false, 'focusLot(1.5) must not throw');
});

runTest('5.4 Raycast safety: returns null on non-finite NDC coordinates', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });

  const hitNaN = renderer.raycastAt({ x: NaN, y: NaN });
  const hitNaNDivergent = renderer.raycastAt({ x: NaN, y: 0 });

  assert.strictEqual(hitNaN, null, 'raycastAt on NaN returns null');
  assert.strictEqual(hitNaNDivergent, null, 'raycastAt on NaN returns null');
});

runTest('5.5 Memory management: child geometries and materials disposed on building replacement and demolition', () => {
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

  const baseGame = createGame({ seed: 42 });

  // Step 1: Render shop 0 on lot 0
  const lots1: Lot[] = baseGame.lots.map(l => l.id === 0 ? { ...l, owner: 0, shop: 0 } : l);
  renderer.render({ ...baseGame, lots: lots1 }, null);

  const baselineGeomDispose = disposedGeometries;
  const baselineMatDispose = disposedMaterials;

  // Step 2: Replace with shop 1 on lot 0
  const lots2: Lot[] = baseGame.lots.map(l => l.id === 0 ? { ...l, owner: 0, shop: 1 } : l);
  renderer.render({ ...baseGame, lots: lots2 }, null);

  // Step 3: Demolish shop on lot 0
  const lots3: Lot[] = baseGame.lots.map(l => l.id === 0 ? { ...l, owner: 0, shop: null } : l);
  renderer.render({ ...baseGame, lots: lots3 }, null);

  const newGeomDispose = disposedGeometries - baselineGeomDispose;
  const newMatDispose = disposedMaterials - baselineMatDispose;

  // Restore prototypes
  THREE.BufferGeometry.prototype.dispose = origGeomDispose;
  THREE.Material.prototype.dispose = origMatDispose;

  console.log(`    Disposed geometries during building replacement/demolition: ${newGeomDispose}`);
  console.log(`    Disposed materials during building replacement/demolition: ${newMatDispose}`);

  assert.ok(newGeomDispose > 0, 'BufferGeometries must be disposed during building replacement and demolition');
  assert.ok(newMatDispose > 0, 'Materials must be disposed during building replacement and demolition');
});

runTest('5.6 Camera near-plane clearance: Lot 71 center raycast succeeds without near-plane clipping', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });
  const ortho = renderer.getOrthoCamera();
  ortho.updateMatrixWorld(true);

  const mesh71 = renderer.getParcelMesh(71)!;
  mesh71.updateMatrixWorld(true);
  const pos71 = new THREE.Vector3();
  mesh71.getWorldPosition(pos71);

  const ndc71 = pos71.clone().project(ortho);
  const hit71 = renderer.raycastAt({ x: ndc71.x, y: ndc71.y });

  console.log(`    Lot 71 NDC coordinates: x=${ndc71.x.toFixed(4)}, y=${ndc71.y.toFixed(4)}, z=${ndc71.z.toFixed(4)}`);
  console.log(`    Lot 71 raycast result: ${hit71}`);

  assert.ok(ndc71.z >= -1.0 && ndc71.z <= 1.0, 'Lot 71 ndc.z must be within [-1, 1] frustum');
  assert.strictEqual(hit71, 71, 'Lot 71 center raycast returns 71');
});

runTest('5.7 Coordinate frame unification: getParcelWorldPosition matches canvasToWorld with CELL_SIZE/2 offset', () => {
  const [worldX, , worldZ] = canvasToWorld(144 + 25, 100 + 25);
  const [parcelX, , parcelZ] = getParcelWorldPosition(144, 100);

  const deltaX = Math.abs(worldX - parcelX);
  const deltaZ = Math.abs(worldZ - parcelZ);

  console.log(`    canvasToWorld(144 + 25, 100 + 25): [${worldX}, ${worldZ}]`);
  console.log(`    getParcelWorldPosition(144, 100): [${parcelX}, ${parcelZ}]`);
  console.log(`    Coordinate delta: deltaX=${deltaX}, deltaZ=${deltaZ}`);

  assert.strictEqual(deltaX, 0, 'canvasToWorld and getParcelWorldPosition align with zero offset');
  assert.strictEqual(deltaZ, 0, 'canvasToWorld and getParcelWorldPosition align with zero offset');
});

// ---------------------------------------------------------------------------
// SUITE 6: Viewport Resize Stress
// ---------------------------------------------------------------------------
console.log('\n--- Suite 6: Viewport Resize Stress ---');

runTest('6.1 Extreme resize dimensions', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });

  const extremeDims = [
    [1, 1],
    [320, 240],
    [1920, 1080],
    [3840, 2160],
    [7680, 4320],
    [10, 10000],
    [10000, 10],
  ];

  for (const [w, h] of extremeDims) {
    renderer.resize(w, h);
    const ortho = renderer.getOrthoCamera();
    const persp = renderer.getPerspCamera();
    assert.ok(Number.isFinite(ortho.top));
    assert.ok(Number.isFinite(ortho.right));
    assert.ok(Number.isFinite(persp.aspect));
  }
});

runTest('6.2 Invalid resize dimensions (<= 0) do not corrupt cameras', () => {
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });
  renderer.resize(1100, 730);
  const baselineAspect = renderer.getPerspCamera().aspect;

  renderer.resize(0, 730);
  assert.strictEqual(renderer.getPerspCamera().aspect, baselineAspect);

  renderer.resize(1100, 0);
  assert.strictEqual(renderer.getPerspCamera().aspect, baselineAspect);

  renderer.resize(-500, -500);
  assert.strictEqual(renderer.getPerspCamera().aspect, baselineAspect);
});

// ---------------------------------------------------------------------------
// SUITE 7: Procedural Shop Building Geometry & Material Integrity
// ---------------------------------------------------------------------------
console.log('\n--- Suite 7: Procedural Shop Building Geometry & Material Integrity ---');

runTest('7.1 Shop visual category catalog consistency', () => {
  assert.strictEqual(SHOP_VISUAL_CATEGORIES.length, 6);
  for (let i = 0; i < 6; i++) {
    const cat = SHOP_VISUAL_CATEGORIES[i];
    assert.strictEqual(cat.id, i);
    assert.ok(cat.name.length > 0);
    assert.ok(cat.code.length > 0);
    assert.ok(cat.targetSize >= 3 && cat.targetSize <= 6);
    assert.ok(cat.colorHex.startsWith('#'));
  }
});

runTest('7.2 All 6 shop categories construct valid non-empty groups across cluster sizes 1 to 6', () => {
  for (let shopType = 0; shopType < 6; shopType++) {
    for (let size = 1; size <= 6; size++) {
      for (const complete of [false, true]) {
        const building = createShopBuilding(shopType, size, complete);
        assert.ok(building instanceof THREE.Group);
        assert.ok(building.children.length >= 3);
        assert.ok(Number.isFinite(building.scale.y));

        let meshCount = 0;
        building.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            meshCount++;
            assert.ok(obj.geometry, `Mesh in shop ${shopType} size ${size} must have geometry`);
            assert.ok(obj.material, `Mesh in shop ${shopType} size ${size} must have material`);
          }
        });
        assert.ok(meshCount >= 3, `Shop ${shopType} size ${size} must contain at least 3 meshes`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
const passCount = results.filter((r) => r.status === 'PASS').length;
const defectCount = results.filter((r) => r.status === 'DEFECT_CONFIRMED').length;
const failCount = results.filter((r) => r.status === 'FAIL').length;

console.log('\n=== EMPIRICAL STRESS TEST SUMMARY ===');
console.log(`Total tests executed: ${results.length}`);
console.log(`Baseline stress tests passed: ${passCount}`);
console.log(`Empirical defects confirmed: ${defectCount}`);
console.log(`Test execution failures: ${failCount}`);

if (failCount > 0) {
  console.log('\nFailures recorded:');
  results.filter(r => r.status === 'FAIL').forEach((f) => console.log(`  - ${f.name}: ${f.details}`));
  process.exit(1);
} else {
  console.log('\nHarness executed cleanly with all test assertions and defect verifications confirmed!');
  process.exit(0);
}
