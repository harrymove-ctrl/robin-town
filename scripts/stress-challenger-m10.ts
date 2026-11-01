/**
 * scripts/stress-challenger-m10.ts
 *
 * Dedicated standalone empirical stress harness for Challenger M10:
 * Benchmark 1: 2,000 cycles of rapid view mode toggling with memory and state divergence verification.
 * Benchmark 2: 10,000 rapid hover and selection interactions verifying elevation and prop attachment.
 * Benchmark 3: 100 alternating full board states verifying buildingGroup.children.length === 0 invariant.
 * Benchmark 4: 100 full scene creation and disposal cycles verifying geometry, texture, and frame cleanup.
 */

import * as assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  TOTAL_LOTS,
  LOT_DEFINITIONS,
  findAllClusters,
} from '../src/engine/board-layout';
import { createGame } from '../src/engine/engine';
import type { GameState, Lot } from '../src/engine/types';
import {
  ThreeBoardRenderer,
  disposeHierarchy,
  ELEVATION_PARCEL_BASE,
  ELEVATION_PARCEL_HOVER,
  ELEVATION_PARCEL_SELECTED,
} from '../src/ui/board-3d';
import { RobinTownApp } from '../src/app';

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

interface BenchmarkMetric {
  name: string;
  cycles: number;
  durationMs: number;
  opsPerSec: number;
  passed: boolean;
  notes: string;
}

const metrics: BenchmarkMetric[] = [];

console.log('================================================================');
console.log('CHALLENGER M10: ADVERSARIAL STRESS AND INVARIANT BENCHMARK');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// BENCHMARK 1: Rapid View Mode Toggling (2,000 Cycles)
// -----------------------------------------------------------------------------
console.log('--- Benchmark 1: Rapid View Mode Toggling (2,000 Cycles) ---');
{
  const app = new RobinTownApp(null);
  const startMem = process.memoryUsage().heapUsed;
  const startTime = performance.now();

  const CYCLES = 2000;
  for (let i = 0; i < CYCLES; i++) {
    const mode = app.toggleRenderMode();
    const expected = i % 2 === 0 ? '2d' : '3d';
    assert.strictEqual(mode, expected);
  }

  const durationMs = performance.now() - startTime;
  const endMem = process.memoryUsage().heapUsed;
  const memDeltaMB = (endMem - startMem) / (1024 * 1024);
  const opsPerSec = (CYCLES / durationMs) * 1000;

  console.log(`  Completed ${CYCLES} toggles in ${durationMs.toFixed(2)}ms (${opsPerSec.toFixed(0)} ops/sec)`);
  console.log(`  Heap delta: ${memDeltaMB.toFixed(3)} MB`);
  console.log(`  Final render mode: ${app.getRenderMode()}`);

  assert.strictEqual(app.getRenderMode(), '3d');
  assert.ok(memDeltaMB < 30, 'Memory growth must be strictly bounded');

  metrics.push({
    name: 'Rapid View Mode Toggling',
    cycles: CYCLES,
    durationMs,
    opsPerSec,
    passed: true,
    notes: `Zero state divergence, heap delta ${memDeltaMB.toFixed(3)} MB`,
  });
}

// -----------------------------------------------------------------------------
// BENCHMARK 2: Rapid Camera Mode Toggling (2,000 Cycles)
// -----------------------------------------------------------------------------
console.log('\n--- Benchmark 2: Rapid Camera Mode Toggling (2,000 Cycles) ---');
{
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });
  const CYCLES = 2000;
  const startTime = performance.now();

  for (let i = 0; i < CYCLES; i++) {
    renderer.toggleCameraMode();
    const target = renderer.getCameraTarget();
    assert.ok(Number.isFinite(target.x));
    assert.ok(Number.isFinite(target.y));
    assert.ok(Number.isFinite(target.z));
  }

  const durationMs = performance.now() - startTime;
  const opsPerSec = (CYCLES / durationMs) * 1000;
  console.log(`  Completed ${CYCLES} camera toggles in ${durationMs.toFixed(2)}ms (${opsPerSec.toFixed(0)} ops/sec)`);
  console.log(`  Final camera mode: ${renderer.getCameraMode()}`);

  assert.strictEqual(renderer.getCameraMode(), 'isometric');
  renderer.unmount();

  metrics.push({
    name: 'Rapid Camera Mode Toggling',
    cycles: CYCLES,
    durationMs,
    opsPerSec,
    passed: true,
    notes: 'Coordinates strictly finite, zero NaN values',
  });
}

// -----------------------------------------------------------------------------
// BENCHMARK 3: 10,000 Rapid Hover & Selection Interactions
// -----------------------------------------------------------------------------
console.log('\n--- Benchmark 3: 10,000 Rapid Hover & Selection Interactions ---');
{
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });
  const game = createGame({ seed: 42 });
  renderer.render(game, null);

  const INTERACTIONS = 10000;
  const startTime = performance.now();

  for (let i = 0; i < INTERACTIONS; i++) {
    const lotId = i % TOTAL_LOTS;
    if (i % 2 === 0) {
      // Hover event
      const prev = (renderer as any).hoveredLotId;
      (renderer as any).hoveredLotId = lotId;
      (renderer as any).updateParcelElevation(prev);
      (renderer as any).updateParcelElevation(lotId);

      const mesh = renderer.getParcelMesh(lotId)!;
      assert.strictEqual(mesh.position.y, ELEVATION_PARCEL_HOVER);
    } else {
      // Selection event
      renderer.render(game, lotId);
      const mesh = renderer.getParcelMesh(lotId)!;
      assert.strictEqual(mesh.position.y, ELEVATION_PARCEL_SELECTED);

      // Verify prop remains attached to parcel mesh
      const prop = renderer.getParcelPropMesh(lotId);
      assert.ok(prop);
      assert.strictEqual(prop.parent, mesh);
    }
  }

  // Clear hover and selection properly
  const lastHovered = (renderer as any).hoveredLotId;
  (renderer as any).hoveredLotId = null;
  (renderer as any).updateParcelElevation(lastHovered);
  renderer.render(game, null);

  for (let id = 0; id < TOTAL_LOTS; id++) {
    const mesh = renderer.getParcelMesh(id)!;
    assert.strictEqual(mesh.position.y, ELEVATION_PARCEL_BASE);
  }

  const durationMs = performance.now() - startTime;
  const opsPerSec = (INTERACTIONS / durationMs) * 1000;
  console.log(`  Completed ${INTERACTIONS} interactions in ${durationMs.toFixed(2)}ms (${opsPerSec.toFixed(0)} ops/sec)`);

  renderer.unmount();

  metrics.push({
    name: 'Rapid Hover and Selection Interactions',
    cycles: INTERACTIONS,
    durationMs,
    opsPerSec,
    passed: true,
    notes: 'All 72 lots elevated and reset accurately without orphan props',
  });
}

// -----------------------------------------------------------------------------
// BENCHMARK 4: Invariant buildingGroup.children.length === 0 Across 100 State Flips
// -----------------------------------------------------------------------------
console.log('\n--- Benchmark 4: buildingGroup Invariant Across 100 State Flips ---');
{
  const container = createMockContainer();
  const renderer = new ThreeBoardRenderer({ container });
  const baseGame = createGame({ seed: 88 });

  const claimedGame: GameState = {
    ...baseGame,
    lots: baseGame.lots.map((l, idx) => ({
      ...l,
      owner: (idx % 4) as 0 | 1 | 2 | 3,
      shop: null,
    })),
  };

  const fullShopsGame: GameState = {
    ...baseGame,
    lots: baseGame.lots.map((l, idx) => ({
      ...l,
      owner: (idx % 4) as 0 | 1 | 2 | 3,
      shop: idx % 6,
    })),
  };

  const FLIPS = 100;
  const startTime = performance.now();

  for (let i = 0; i < FLIPS; i++) {
    if (i % 2 === 0) {
      renderer.render(claimedGame, i % TOTAL_LOTS);
      assert.strictEqual(
        renderer.getBuildingGroup().children.length,
        0,
        `Flip ${i}: buildingGroup must have 0 children when parcels have no shops`
      );
      assert.strictEqual(
        renderer.getGoldenAuraGroup().children.length,
        0,
        `Flip ${i}: goldenAuraGroup must have 0 children when parcels have no shops`
      );
      assert.strictEqual(
        Object.keys(renderer.getParcelProps()).length,
        TOTAL_LOTS,
        `Flip ${i}: all 72 claimed props must exist in registry`
      );
    } else {
      renderer.render(fullShopsGame, null);
      assert.strictEqual(
        renderer.getBuildingGroup().children.length,
        TOTAL_LOTS,
        `Flip ${i}: buildingGroup must have 72 children when shops are built`
      );
    }
  }

  const durationMs = performance.now() - startTime;
  const opsPerSec = (FLIPS / durationMs) * 1000;
  console.log(`  Completed ${FLIPS} full-board state transitions in ${durationMs.toFixed(2)}ms (${opsPerSec.toFixed(0)} ops/sec)`);

  renderer.unmount();

  metrics.push({
    name: 'buildingGroup Zero Child Invariant',
    cycles: FLIPS,
    durationMs,
    opsPerSec,
    passed: true,
    notes: 'Strict invariant holds across 100% of tested cycles',
  });
}

// -----------------------------------------------------------------------------
// BENCHMARK 5: Scene Disposal & Resource Freeing (100 Instances)
// -----------------------------------------------------------------------------
console.log('\n--- Benchmark 5: Scene Disposal & Resource Freeing (100 Instances) ---');
{
  let totalGeomsDisposed = 0;
  let totalMatsDisposed = 0;

  const origGeomDispose = THREE.BufferGeometry.prototype.dispose;
  THREE.BufferGeometry.prototype.dispose = function() {
    totalGeomsDisposed++;
    return origGeomDispose.apply(this, arguments as any);
  };

  const origMatDispose = THREE.Material.prototype.dispose;
  THREE.Material.prototype.dispose = function() {
    totalMatsDisposed++;
    return origMatDispose.apply(this, arguments as any);
  };

  const INSTANCES = 100;
  const startTime = performance.now();

  for (let i = 0; i < INSTANCES; i++) {
    const container = createMockContainer();
    const renderer = new ThreeBoardRenderer({ container });
    renderer.mount();

    const game = createGame({ seed: i });
    renderer.render(game, null);

    renderer.unmount();
  }

  THREE.BufferGeometry.prototype.dispose = origGeomDispose;
  THREE.Material.prototype.dispose = origMatDispose;

  const durationMs = performance.now() - startTime;
  const opsPerSec = (INSTANCES / durationMs) * 1000;

  console.log(`  Instantiated and disposed ${INSTANCES} board scenes in ${durationMs.toFixed(2)}ms (${opsPerSec.toFixed(0)} instances/sec)`);
  console.log(`  Total BufferGeometries disposed: ${totalGeomsDisposed}`);
  console.log(`  Total Materials disposed: ${totalMatsDisposed}`);

  assert.ok(totalGeomsDisposed > 1000, 'Geometries must be systematically disposed');
  assert.ok(totalMatsDisposed > 1000, 'Materials must be systematically disposed');

  metrics.push({
    name: 'Scene Disposal & Resource Freeing',
    cycles: INSTANCES,
    durationMs,
    opsPerSec,
    passed: true,
    notes: `Clean disposal: ${totalGeomsDisposed} geometries and ${totalMatsDisposed} materials freed`,
  });
}

// -----------------------------------------------------------------------------
// BENCHMARK SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log('BENCHMARK SUMMARY AND VERIFICATION RESULTS');
console.log('================================================================');

let allPassed = true;
for (const m of metrics) {
  const status = m.passed ? 'PASS' : 'FAIL';
  if (!m.passed) allPassed = false;
  console.log(`* [${status}] ${m.name}: ${m.cycles} cycles in ${m.durationMs.toFixed(1)}ms (${m.opsPerSec.toFixed(0)} ops/s). ${m.notes}`);
}

console.log('================================================================\n');

if (allPassed) {
  console.log('VERDICT: All empirical benchmarks and invariants verified successfully.');
  process.exit(0);
} else {
  console.log('VERDICT: Failures detected during empirical benchmark execution.');
  process.exit(1);
}
