/**
 * tests/unit/diorama.test.ts
 *
 * Diorama look contract: 64-colour palette, 3-pass storefront detail, props
 * stay inside their parcel, contact shadows, base slab / curb / harbor
 * structure, and deterministic hit-testing across all 72 parcels.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as THREE from 'three';
import {
  PALETTE_HEX,
  PALETTE_RGB,
  PALETTE_SIZE,
  isPaletteColor,
  snapToPalette,
} from '../../src/ui/diorama-palette';
import {
  buildBaseSlab,
  buildDistrictCurb,
  countDetailPasses,
  createContactShadow,
  isContactShadow,
} from '../../src/ui/diorama-detail';
import { INK_COLOR, INK_STRENGTH } from '../../src/ui/diorama-post';
import {
  BUILDABLE_HIGHLIGHT_HEX,
  ELEVATION_PARCEL_BASE,
  ELEVATION_PARCEL_HOVER,
  PERSPECTIVE_FOV,
  PLAYER_HEX_COLORS,
  ThreeBoardRenderer,
  createShopBuilding,
  easeOutBack,
  orthoFrustumHeight,
  perimeterPoint,
  perspectiveFitDistance,
} from '../../src/ui/board-3d';
import { rasterizeLabel } from '../../src/ui/diorama-label';
import { CELL_SIZE, LOT_DEFINITIONS, TOTAL_LOTS } from '../../src/engine/board-layout';
import { createGame } from '../../src/engine/engine';
import type { GameState } from '../../src/engine/types';

describe('diorama palette', () => {
  it('has exactly 64 unique sRGB colours', () => {
    assert.strictEqual(PALETTE_SIZE, 64);
    assert.strictEqual(PALETTE_HEX.length, 64);
    assert.strictEqual(PALETTE_RGB.length, 64);
    assert.strictEqual(new Set(PALETTE_HEX).size, 64);
    for (const hex of PALETTE_HEX) assert.match(hex, /^#[0-9a-f]{6}$/);
  });

  it('snaps any colour onto a palette entry and leaves entries unchanged', () => {
    for (const rgb of PALETTE_RGB) assert.deepStrictEqual(snapToPalette(rgb), rgb);
    const snapped = snapToPalette([0.31, 0.62, 0.17]);
    assert.ok(PALETTE_RGB.includes(snapped));
    assert.ok(isPaletteColor(0x00, 0xc8, 0x05));
    assert.ok(!isPaletteColor(1, 2, 3));
  });

  it('keeps the brand colours of the six districts and shops', () => {
    for (const hex of ['#00c805', '#eec353', '#29b6f6', '#ab47bc', '#ff7043', '#587c9a']) {
      assert.ok(PALETTE_HEX.includes(hex), hex);
    }
    for (const hex of ['#39a883', '#b85539', '#a16586', '#648454']) {
      assert.ok(PALETTE_HEX.includes(hex), hex);
    }
  });

  it('mixes contour ink toward warm near-black at 0.62', () => {
    assert.strictEqual(INK_STRENGTH, 0.62);
    assert.ok(INK_COLOR[0] > INK_COLOR[2], 'warm: red above blue');
    assert.ok(INK_COLOR.every((v) => v < 0.1), 'near-black');
  });
});

describe('storefront detail bar', () => {
  for (let shop = 0; shop < 6; shop++) {
    it(`shop ${shop} has silhouette, assemblies and story details`, () => {
      const building = createShopBuilding(shop, 1, false);
      const { pass2, pass3 } = countDetailPasses(building);
      assert.ok(pass2 >= 2, `pass 2 assemblies: ${pass2}`);
      assert.ok(pass3 >= 3, `pass 3 story details: ${pass3}`);
      const shadow = building.children.find((c) => isContactShadow(c));
      assert.ok(shadow, 'contact shadow');
    });

    it(`shop ${shop} props stay inside the 48-unit parcel`, () => {
      const building = createShopBuilding(shop, 1, true);
      building.updateMatrixWorld(true);
      const half = CELL_SIZE / 2 - 1 + 1.6; // parcel half-width allowing the golden halo's tube
      for (const child of building.children) {
        if (isContactShadow(child)) continue;
        const bounds = new THREE.Box3().setFromObject(child);
        assert.ok(bounds.max.x <= half && bounds.min.x >= -half, `${child.name} x ${bounds.min.x}..${bounds.max.x}`);
        assert.ok(bounds.max.z <= half && bounds.min.z >= -half, `${child.name} z ${bounds.min.z}..${bounds.max.z}`);
      }
    });
  }

  it('names the issue-listed props', () => {
    const names = (shop: number) => {
      const out: string[] = [];
      createShopBuilding(shop, 1, false).traverse((c) => out.push(c.name));
      return out.join(' ');
    };
    assert.match(names(0), /SwapArrowRight[\s\S]*SwapArrowLeft[\s\S]*TickerCanopy/);
    assert.match(names(1), /ShibaHead[\s\S]*AwningStripe[\s\S]*Stanchion/);
    assert.match(names(2), /VaultWheel[\s\S]*Bullion[\s\S]*LaserEmitter/);
    assert.match(names(3), /ColumnCapital[\s\S]*AtriumGlass[\s\S]*ScalesBeam/);
    assert.match(names(4), /FloorWindow[\s\S]*Candle[\s\S]*CoolingVent/);
    assert.match(names(5), /ServerTower[\s\S]*Skyway[\s\S]*BeaconCrystal/);
  });
});

describe('contact shadows and slab structure', () => {
  it('builds contact shadows without a DOM', () => {
    const shadow = createContactShadow(40, 0.5);
    assert.ok(isContactShadow(shadow));
    assert.strictEqual((shadow.material as THREE.MeshBasicMaterial).transparent, true);
  });

  it('builds a base slab with a recessed harbor channel', () => {
    const slab = buildBaseSlab({
      west: -100, east: 100, north: -80, south: 80,
      channelWest: 40, channelEast: 100, landTop: 1.5, waterY: 0.1, bottom: -12.5,
    });
    const names = slab.children.map((c) => c.name);
    for (const required of ['BaseSlabLand', 'BaseSlabBevel', 'BaseSlabPlinth', 'HarborWater', 'HarborFloor', 'HarborQuayWest', 'HarborQuayEast']) {
      assert.ok(names.includes(required), required);
    }
    const water = slab.getObjectByName('HarborWater')!;
    const land = slab.getObjectByName('BaseSlabLand')!;
    const waterTop = new THREE.Box3().setFromObject(water).max.y;
    const landTop = new THREE.Box3().setFromObject(land).max.y;
    assert.ok(waterTop < landTop, 'channel is recessed');
  });

  it('wraps a district in four bevelled curb sides', () => {
    const curb = buildDistrictCurb([0, 2.5, 0], 224, 236, '#00c805', 3.5);
    assert.strictEqual(curb.children.filter((c) => c.name.startsWith('DistrictCurbRim_')).length, 4);
    assert.strictEqual(curb.children.filter((c) => c.name.startsWith('DistrictCurbCap_')).length, 4);
  });

  it('adds the slab, shadows and cluster groups to the board without touching districts', () => {
    const renderer = new ThreeBoardRenderer({ container: undefined as unknown as HTMLElement, width: 1000, height: 700 });
    assert.strictEqual(renderer.getDistrictGroup().children.length, 6);
    assert.ok(renderer.getBaseGroup().getObjectByName('BaseSlabGroup'));
    assert.strictEqual(renderer.getBaseGroup().children.filter((c) => c.name === 'DistrictCurb').length, 6);
    assert.strictEqual(renderer.getShadowGroup().children.length, TOTAL_LOTS);
    renderer.unmount();
  });
});

describe('diorama camera and hit-testing', () => {
  it('frames the whole slab at any aspect ratio', () => {
    for (const aspect of [0.75, 1.0, 1.33, 1.78, 2.6]) {
      const height = orthoFrustumHeight(aspect);
      assert.ok(height * aspect >= 1396, `width fits at aspect ${aspect}`);
      assert.ok(height >= 780, `height fits at aspect ${aspect}`);
    }
  });

  it('hits every one of the 72 parcels at its own projected centre', () => {
    const renderer = new ThreeBoardRenderer({ container: undefined as unknown as HTMLElement, width: 1200, height: 800 });
    for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
      const ndc = renderer.projectLotToNdc(lotId);
      assert.ok(ndc, `lot ${lotId} projects`);
      assert.strictEqual(renderer.raycastAt(ndc), lotId, `lot ${lotId} (${LOT_DEFINITIONS[lotId].block})`);
    }
    renderer.unmount();
  });
});

describe('3D board interaction and feel (issue #7 port)', () => {
  const headless = () =>
    new ThreeBoardRenderer({ container: undefined as unknown as HTMLElement, width: 1200, height: 800 });

  const withLots = (game: GameState, patch: Record<number, Partial<GameState['lots'][number]>>): GameState => ({
    ...game,
    lots: game.lots.map((lot) => (patch[lot.id] ? { ...lot, ...patch[lot.id] } : lot)),
  });

  it('shows an owner flag in the owner colour on owned lots, built or not', () => {
    const renderer = headless();
    const game = withLots(createGame({ seed: 7 }), {
      5: { owner: 2 },
      6: { owner: 1, shop: 3 },
    });
    renderer.render(game, null);
    for (const [lotId, owner] of [[5, 2], [6, 1]] as const) {
      const flag = renderer.getOwnerFlag(lotId)!;
      assert.ok(flag.visible, `flag on lot ${lotId}`);
      const cloth = flag.getObjectByName('OwnerFlagCloth') as THREE.Mesh;
      const hex = '#' + (cloth.material as THREE.MeshBasicMaterial).color.getHexString();
      assert.strictEqual(hex, PLAYER_HEX_COLORS[owner].toLowerCase());
    }
    assert.ok(renderer.getBuildingMesh(6), 'lot 6 has a building over it');
    assert.strictEqual(renderer.getOwnerFlag(7)!.visible, false, 'unowned lot has no flag');
    assert.strictEqual(renderer.getDioramaState().ownerFlags, 2);
    renderer.unmount();
  });

  it('uses a buildable highlight that differs from every player colour, before and after the palette snap', () => {
    const bytes = (n: number): [number, number, number] => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const rgb = (n: number): [number, number, number] => bytes(n).map((v) => v / 255) as [number, number, number];
    assert.ok(isPaletteColor(...bytes(BUILDABLE_HIGHLIGHT_HEX)), 'buildable violet is a palette colour');
    const snappedBuildable = snapToPalette(rgb(BUILDABLE_HIGHLIGHT_HEX));
    for (const hex of PLAYER_HEX_COLORS) {
      const player = parseInt(hex.slice(1), 16);
      assert.notStrictEqual(player, BUILDABLE_HIGHLIGHT_HEX, hex);
      assert.notDeepStrictEqual(snapToPalette(rgb(player)), snappedBuildable, `${hex} snaps apart`);
    }

    const renderer = headless();
    const game = withLots(createGame({ seed: 3 }), { 10: { owner: 0 } });
    renderer.render(game, null, { validBuildLots: [10] });
    assert.strictEqual(renderer.getParcelMaterial(10)!.color.getHex(), BUILDABLE_HIGHLIGHT_HEX);
    renderer.unmount();
  });

  it('rebuilds gold lights and crowns only when the complete-cluster set changes', () => {
    let completions = 0;
    const renderer = new ThreeBoardRenderer({
      container: undefined as unknown as HTMLElement,
      width: 1200,
      height: 800,
      onClusterComplete: () => completions++,
    });
    const base = createGame({ seed: 100 });
    const complete = withLots(base, {
      0: { owner: 0, shop: 0 },
      1: { owner: 0, shop: 0 },
      2: { owner: 0, shop: 0 },
    });
    renderer.render(complete, null);
    const crown = renderer.getGoldenAuraGroup().children.find((c) => c.name.startsWith('GoldenCrown_'));
    const light = renderer.getGoldenAuraGroup().children.find((c) => c instanceof THREE.PointLight);
    assert.ok(crown && light);
    const rebuilds = renderer.getGoldenRebuildCount();
    assert.strictEqual(completions, 0, 'no callback on the initial sync');

    // Unrelated changes: another lot's owner, selection, hover highlight, overlays.
    renderer.render(withLots(complete, { 40: { owner: 3 } }), 12, { validBuildLots: [3] });
    renderer.setHighlightLot(20);
    renderer.render(withLots(complete, { 40: { owner: 3 }, 41: { owner: 2, shop: 4 } }), null);
    assert.strictEqual(renderer.getGoldenRebuildCount(), rebuilds, 'no rebuild');
    assert.strictEqual(
      renderer.getGoldenAuraGroup().children.find((c) => c.name.startsWith('GoldenCrown_')),
      crown,
      'same crown instance'
    );
    assert.ok(renderer.getGoldenAuraGroup().children.includes(light!), 'same light instance');

    // Breaking the cluster does rebuild (and removes the crown).
    renderer.render(withLots(complete, { 2: { shop: null } }), null);
    assert.strictEqual(renderer.getGoldenRebuildCount(), rebuilds + 1);
    assert.strictEqual(renderer.getGoldenAuraGroup().children.length, 0);

    // Completing it again fires the cluster-complete callback.
    renderer.render(complete, null);
    assert.strictEqual(completions, 1);
    renderer.unmount();
  });

  it('uses a 20.5 deg perspective lens pulled back to frame all 72 parcels', () => {
    const renderer = headless();
    const persp = renderer.getPerspCamera();
    assert.strictEqual(PERSPECTIVE_FOV, 20.5);
    assert.strictEqual(persp.fov, 20.5);

    renderer.setCameraMode('perspective');
    renderer.freeze(0); // snaps the camera to its target distance
    assert.strictEqual(renderer.getActiveCamera(), persp);
    const distance = persp.position.distanceTo(renderer.getCameraTarget());
    assert.ok(Math.abs(distance - perspectiveFitDistance(1200 / 800)) < 1e-6, `distance ${distance}`);
    assert.ok(persp.far > distance + 800, 'far plane clears the slab');
    for (let lotId = 0; lotId < TOTAL_LOTS; lotId++) {
      const ndc = renderer.projectLotToNdc(lotId)!;
      assert.ok(Math.abs(ndc.x) < 0.98 && Math.abs(ndc.y) < 0.98, `lot ${lotId} at ${ndc.x}, ${ndc.y}`);
      assert.strictEqual(renderer.raycastAt(ndc), lotId, `lot ${lotId} picks in perspective`);
    }
    renderer.unmount();
  });

  it('builds a parabolic satellite dish on the DEX Swap struts and a plinth per district', () => {
    const building = createShopBuilding(0, 1, false);
    const dish = building.getObjectByName('Detail_SatelliteDish')!;
    assert.ok(dish, 'dish group');
    const bowl = dish.getObjectByName('SatelliteDishBowl') as THREE.Mesh;
    assert.ok(bowl.geometry instanceof THREE.LatheGeometry, 'lathed paraboloid');
    assert.ok(dish.getObjectByName('SatelliteDishFeed'), 'feed horn at the focus');
    const strut = building.getObjectByName('Detail_DishStrutA')!;
    const strutTop = new THREE.Box3().setFromObject(strut).max.y;
    const dishBottom = new THREE.Box3().setFromObject(dish).min.y;
    assert.ok(dishBottom <= strutTop + 0.5, `dish sits on the struts (${dishBottom} vs ${strutTop})`);

    const renderer = headless();
    const plinths = renderer.getBaseGroup().getObjectByName('DistrictPlinths')!;
    assert.strictEqual(plinths.children.length, 6);
    const land = renderer.getBaseGroup().getObjectByName('BaseSlabLand')!;
    const landTop = new THREE.Box3().setFromObject(land).max.y;
    for (const plinth of plinths.children) {
      const box = new THREE.Box3().setFromObject(plinth);
      assert.ok(box.min.y >= landTop - 0.01, 'plinth stands on the base slab');
      assert.ok(box.max.y <= ELEVATION_PARCEL_BASE - 1, 'plinth stays under the parcels');
      assert.ok(plinth.getObjectByName('DistrictPlinthBevel'));
    }
    renderer.unmount();
  });

  it('labels selected, hovered and candidate lots with their lot number', () => {
    const renderer = headless();
    const game = createGame({ seed: 9 });
    renderer.render(game, 4, { pendingLots: [8] });
    assert.strictEqual(renderer.getLotLabel(4)?.visible, true);
    assert.strictEqual(renderer.getLotLabel(4)?.userData.text, '5');
    assert.strictEqual(renderer.getLotLabel(8)?.visible, true);
    renderer.setHighlightLot(30);
    assert.strictEqual(renderer.getHighlightLotId(), 30);
    assert.strictEqual(renderer.getParcelMesh(30)!.position.y, ELEVATION_PARCEL_HOVER, 'tray hover lifts the lot');
    assert.strictEqual(renderer.getLotLabel(30)?.visible, true);
    renderer.render(game, null);
    assert.strictEqual(renderer.getLotLabel(4)?.visible, false);

    const { width, height, data } = rasterizeLabel('12 DX');
    assert.strictEqual(data.length, width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      assert.ok(isPaletteColor(data[i], data[i + 1], data[i + 2]), 'label texels are palette colours');
    }
    renderer.unmount();
  });

  it('animates ambient life as a pure function of the frozen clock', () => {
    const renderer = headless();
    renderer.render(withLots(createGame({ seed: 1 }), { 0: { owner: 0, shop: 4 } }), null);
    const snapshot = () => {
      const ambient = renderer.getAmbientGroup();
      const motes = ambient.getObjectByName('DriftMotes') as THREE.Points;
      const walker = ambient.getObjectByName('Walker_2_1')!;
      const beacon = renderer.getBuildingMesh(0)!.getObjectByName('RooftopBeacon')!;
      return JSON.stringify([
        Array.from((motes.geometry.getAttribute('position') as THREE.BufferAttribute).array.slice(0, 12)),
        walker.position.toArray(),
        beacon.visible,
      ]);
    };
    renderer.freeze(1000);
    const a = snapshot();
    renderer.renderAt(7300);
    const b = snapshot();
    renderer.freeze(1000);
    assert.strictEqual(snapshot(), a, 'same frame at the same t');
    assert.notStrictEqual(b, a, 'different t moves things');
    assert.ok(Math.abs(easeOutBack(0)) < 1e-9);
    assert.ok(Math.abs(easeOutBack(1) - 1) < 1e-9);
    assert.ok(easeOutBack(0.7) > 1, 'overshoots before settling');
    const [px, pz] = perimeterPoint(0);
    assert.deepStrictEqual([px, pz], [-126, -132]);
    renderer.unmount();
  });

  it('zooms toward the cursor and pans within the board in iso mode', () => {
    const renderer = headless();
    const ortho = renderer.getOrthoCamera();
    const ndc = { x: 0.4, y: -0.3 };
    const groundAt = () => {
      ortho.updateMatrixWorld(true);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), ortho);
      return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -4.5), new THREE.Vector3())!;
    };
    const before = groundAt();
    renderer.zoomAt(1.8, ndc.x, ndc.y);
    assert.ok(Math.abs(ortho.zoom - 1.8) < 1e-9);
    const after = groundAt();
    assert.ok(before.distanceTo(after) < 1e-6, 'point under cursor stays fixed');

    renderer.panByPixels(-100000, 0);
    const state = renderer.getDioramaState();
    assert.ok(Math.abs(state.cameraTarget.x) <= 600 && Math.abs(state.cameraTarget.z) <= 420, 'pan is clamped');
    renderer.resetCamera();
    renderer.freeze(0);
    assert.strictEqual(ortho.zoom, 1);
    assert.strictEqual(renderer.getCameraTarget().x, 0);
    renderer.unmount();
  });
});
