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
import { ThreeBoardRenderer, createShopBuilding, orthoFrustumHeight } from '../../src/ui/board-3d';
import { CELL_SIZE, LOT_DEFINITIONS, TOTAL_LOTS } from '../../src/engine/board-layout';

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
