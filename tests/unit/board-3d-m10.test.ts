/**
 * tests/unit/board-3d-m10.test.ts
 *
 * Comprehensive unit test suite for Milestone M10:
 * 1. Physical lot lifecycle stages: vacant, claimed, constructed, completed.
 * 2. Distinctive procedural 3D lot models: foundation pit with rebar,
 *    owner awning with plastic stools, neon blade signs, rooftop planters,
 *    and celebratory silk banners.
 * 3. Living town miniature diorama environment: canal water, animated boats,
 *    moving street traffic, swaying trees, and peripheral townhouses.
 * 4. Invariant preservation: unbuilt parcel props attached to parcel meshes,
 *    guaranteeing zero buildingGroup child contamination.
 * 5. Default view mode configuration and 1-click toggle coordination.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  TOTAL_LOTS,
  LOT_DEFINITIONS,
  CELL_SIZE,
} from '../../src/engine/board-layout';
import {
  ThreeBoardRenderer,
  createVacantLotModel,
  createClaimedLotModel,
  createShopBuilding,
  determineLotStage,
  disposeHierarchy,
  isWebGLAvailable,
  type LotVisualStage,
  type LivingTownConfig,
} from '../../src/ui/board-3d';

/**
 * Minimal mock HTMLElement for headless Node.js testing.
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

describe('Milestone M10: 3D Living Town Diorama and Distinctive Lot Architecture', () => {
  describe('Physical Lot Lifecycle Stages and Procedural Models', () => {
    it('correctly maps parcel state to the 4 physical lot visual stages', () => {
      assert.strictEqual(
        determineLotStage({ owner: null, shopType: null }),
        'vacant',
        'Unowned parcel with no shop must be vacant'
      );
      assert.strictEqual(
        determineLotStage({ owner: 0, shopType: null }),
        'claimed',
        'Owned parcel with no shop must be claimed'
      );
      assert.strictEqual(
        determineLotStage({ owner: 1, shopType: 2, isComplete: false }),
        'constructed',
        'Owned parcel with incomplete shop must be constructed'
      );
      assert.strictEqual(
        determineLotStage({ owner: 2, shopType: 3, isComplete: true }),
        'completed',
        'Owned parcel with completed shop cluster must be completed'
      );
    });

    it('builds vacant lot model with concrete foundation footings, soil pit, rebar dowels, and lease sign', () => {
      const group = createVacantLotModel({ lotId: 7 });
      assert.ok(group instanceof THREE.Group);
      assert.ok(group.name.startsWith('VacantLotProps_'));
      assert.ok(group.children.length >= 4, 'Vacant lot must contain footings, pit, rebar dowels, and signpost');

      const hasSign = group.children.some((c) => c.name === 'lease-sign');
      assert.ok(hasSign, 'Vacant lot must feature a tilted lease sign');

      assert.doesNotThrow(() => disposeHierarchy(group));
    });

    it('builds claimed lot model with owner colored awning, poles, table, and authentic plastic stools', () => {
      const groupOwner0 = createClaimedLotModel({ lotId: 10, owner: 0 });
      const groupOwner1 = createClaimedLotModel({ lotId: 11, owner: 1 });

      assert.ok(groupOwner0 instanceof THREE.Group);
      assert.ok(groupOwner0.name.startsWith('ClaimedLotProps_'));
      assert.ok(groupOwner0.children.length >= 4, 'Claimed lot must feature awning, frame, table, and stools');

      const hasAwning = groupOwner0.children.some(
        (c) => c.name === 'awning-fabric' || c.children?.some((cc) => cc.name === 'awning-fabric')
      );
      const hasStools = groupOwner0.children.some((c) => c.name === 'plastic-stools');
      assert.ok(hasAwning, 'Claimed lot must have a fabric awning');
      assert.ok(hasStools, 'Claimed lot must have authentic plastic stools');

      assert.doesNotThrow(() => {
        disposeHierarchy(groupOwner0);
        disposeHierarchy(groupOwner1);
      });
    });

    it('enhances constructed shop with cantilevered vertical neon blade sign and rooftop garden', () => {
      for (let category = 0; category < 6; category++) {
        const group = createShopBuilding(category, 1, false);
        assert.ok(group instanceof THREE.Group);

        const hasBlade = group.children.some((c) => c.name === 'NeonBladeSign' || c.name === 'neon-blade-sign');
        const hasRooftop = group.children.some((c) => c.name === 'RooftopGarden' || c.name === 'rooftop-planters');

        assert.ok(hasBlade, `Category ${category} constructed shop must feature a neon blade sign`);
        assert.ok(hasRooftop, `Category ${category} constructed shop must feature rooftop planters`);

        assert.doesNotThrow(() => disposeHierarchy(group));
      }
    });

    it('enhances completed shop chain tower with celebratory red and gold vertical banners', () => {
      for (let category = 0; category < 6; category++) {
        const group = createShopBuilding(category, 3, true);
        assert.ok(group instanceof THREE.Group);

        const hasBanners = group.children.some((c) => c.name === 'CelebratoryBanners' || c.name === 'celebratory-banners');
        assert.ok(hasBanners, `Category ${category} completed tower must feature celebratory banners`);

        assert.doesNotThrow(() => disposeHierarchy(group));
      }
    });
  });

  describe('Living Town Miniature Diorama Environment', () => {
    it('instantiates living town environment components cleanly when enabled in config', () => {
      const container = createMockContainer();
      const config: LivingTownConfig = {
        enableWater: true,
        enableTraffic: true,
        enableTrees: true,
        enableStreetLamps: true,
        enablePeripheralHouses: true,
      };
      const renderer = new ThreeBoardRenderer({
        container,
        livingTown: config,
      });

      assert.ok(renderer.getEnvironmentGroup(), 'Environment group must be mounted to scene');
      assert.ok(renderer.getCanalWater(), 'Canal water plane must be initialized');
      assert.strictEqual(renderer.getBoats().length, 2, 'Exactly 2 animated sampans must be instantiated');
      assert.strictEqual(renderer.getTraffic().length, 4, 'Exactly 4 animated vehicles must be instantiated');
      const living = renderer.getLivingConfig();
      assert.strictEqual(living.enableWater, true);
      assert.strictEqual(living.enableTraffic, true);
      assert.strictEqual(living.enableTrees, true);
      assert.strictEqual(living.enableStreetLamps, true);
      assert.strictEqual(living.enablePeripheralHouses, true);

      renderer.unmount();
    });

    it('advances boat, vehicle, and tree foliage animations on animation tick', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      const boats = renderer.getBoats();
      const traffic = renderer.getTraffic();
      const canopies = renderer.getTreeCanopies();

      assert.ok(boats.length >= 2);
      assert.ok(traffic.length >= 4);
      assert.ok(canopies.length > 0);

      const initialBoatPos = boats[0].mesh.position.clone();
      const initialCarPos = traffic[0].mesh.position.clone();

      renderer.updateLivingTown(1000);
      renderer.updateLivingTown(3000);

      const boatMoved = boats[0].mesh.position.distanceTo(initialBoatPos) > 0;
      const carMoved = traffic[0].mesh.position.distanceTo(initialCarPos) > 0;
      assert.ok(boatMoved, 'Sampan boat must advance along spline track');
      assert.ok(carMoved, 'Traffic vehicle must advance along road spline track');

      renderer.unmount();
    });

    it('handles negative delta timestamps gracefully without backward boundary escape', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      // Establish baseline animation state at t=5000ms and t=5016ms
      renderer.updateLivingTown(5000);
      renderer.updateLivingTown(5016);

      const boats = renderer.getBoats();
      const traffic = renderer.getTraffic();
      assert.ok(boats.length >= 2, 'Must have at least 2 boats');
      assert.ok(traffic.length >= 4, 'Must have at least 4 vehicles');

      const b0_before = boats[0].z;

      // Inject backward negative jump of 2000ms (such as out of order frame or clock adjustment)
      renderer.updateLivingTown(3016);

      // Verify boats remain bounded within canal bounds [-340, 340]
      for (const boat of boats) {
        assert.ok(Number.isFinite(boat.mesh.position.x), 'Boat x must be finite');
        assert.ok(Number.isFinite(boat.mesh.position.y), 'Boat y must be finite');
        assert.ok(Number.isFinite(boat.mesh.position.z), 'Boat z must be finite');
        assert.ok(
          boat.z >= -340 && boat.z <= 340,
          `Boat z (${boat.z}) must remain inside visible canal bounds [-340, 340]`
        );
      }

      // Verify traffic distances remain non-negative and finite
      for (const v of traffic) {
        assert.ok(Number.isFinite(v.distance), 'Vehicle distance must be finite');
        assert.ok(v.distance >= 0, `Vehicle distance (${v.distance}) must be non-negative`);
        assert.ok(Number.isFinite(v.mesh.position.x), 'Vehicle pos x must be finite');
        assert.ok(Number.isFinite(v.mesh.position.z), 'Vehicle pos z must be finite');
      }

      // Verify boat position does not displace backward on negative delta
      assert.strictEqual(
        boats[0].z,
        b0_before,
        'Boat position must freeze at current position rather than displacing backward during negative delta'
      );

      renderer.unmount();
    });

    it('recovers cleanly from timestamp wrap around and tab suspension jumps', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      // Simulate extended session at high timestamp
      renderer.updateLivingTown(1000000000);
      renderer.updateLivingTown(1000000016.6);

      const boats = renderer.getBoats();

      // Simulate clock wrap around to zero (such as integer reset or NTP sync)
      renderer.updateLivingTown(0);

      // Verify boat coordinates remain finite and within visible canal bounds
      for (const b of boats) {
        assert.ok(Number.isFinite(b.mesh.position.x), 'Boat x must be finite');
        assert.ok(Number.isFinite(b.mesh.position.y), 'Boat y must be finite');
        assert.ok(Number.isFinite(b.mesh.position.z), 'Boat z must be finite');
        assert.ok(
          b.z >= -340 && b.z <= 340,
          `Boat z (${b.z}) must remain inside canal bounds upon clock wrap`
        );
      }

      // Resume normal 60 FPS forward progression from wrapped timestamp
      renderer.updateLivingTown(16.6);
      renderer.updateLivingTown(33.3);

      for (const b of boats) {
        assert.ok(Number.isFinite(b.mesh.position.z), 'Resumed boat z must be finite');
        assert.ok(
          b.z >= -340 && b.z <= 340,
          'Boat z must remain inside canal bounds during resumed ticking'
        );
      }

      const traffic = renderer.getTraffic();
      for (const v of traffic) {
        assert.ok(Number.isFinite(v.distance), 'Resumed vehicle distance must be finite');
        assert.ok(v.distance >= 0, 'Vehicle distance must remain non-negative after clock wrap');
        assert.ok(Number.isFinite(v.mesh.position.x), 'Vehicle pos x must be finite');
        assert.ok(Number.isFinite(v.mesh.position.z), 'Vehicle pos z must be finite');
      }

      // Simulate tab suspension recovery (massive forward jump of 10 minutes = +600,000ms)
      renderer.updateLivingTown(33.3 + 600000);

      for (const b of boats) {
        assert.ok(Number.isFinite(b.mesh.position.z), 'Post suspension boat z must be finite');
        assert.ok(
          b.z >= -340 && b.z <= 340,
          'Boat z must remain inside canal bounds after tab suspension recovery'
        );
      }

      // Hostile inputs (NaN, Infinity, -Infinity) must not throw or corrupt coordinates
      assert.doesNotThrow(() => renderer.updateLivingTown(NaN));
      assert.doesNotThrow(() => renderer.updateLivingTown(Infinity));
      assert.doesNotThrow(() => renderer.updateLivingTown(-Infinity));
      assert.ok(Number.isFinite(boats[0].z), 'Boat 0 z must remain finite after hostile timestamps');
      assert.ok(Number.isFinite(traffic[0].distance), 'Traffic distance must remain finite after hostile timestamps');

      renderer.unmount();
    });

    it('strictly preserves the buildingGroup children invariant when parcels are unbuilt', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      const vacantState: any = {
        lots: Array.from({ length: TOTAL_LOTS }, (_, id) => ({
          id,
          owner: null,
          shopType: null,
          buildingId: null,
          isComplete: false,
        })),
      };

      renderer.render(vacantState);
      assert.strictEqual(
        renderer.getBuildingGroup().children.length,
        0,
        'Vacant board must have exactly 0 buildingGroup children'
      );
      assert.strictEqual(
        Object.keys(renderer.getParcelProps()).length,
        TOTAL_LOTS,
        'All 72 lots must have vacant props attached to parcel meshes'
      );

      const claimedState: any = {
        lots: Array.from({ length: TOTAL_LOTS }, (_, id) => ({
          id,
          owner: id % 4,
          shopType: null,
          buildingId: null,
          isComplete: false,
        })),
      };

      renderer.render(claimedState);
      assert.strictEqual(
        renderer.getBuildingGroup().children.length,
        0,
        'Claimed board with no shops must have exactly 0 buildingGroup children'
      );
      assert.strictEqual(
        Object.keys(renderer.getParcelProps()).length,
        TOTAL_LOTS,
        'All 72 lots must have claimed props attached to parcel meshes'
      );

      const builtState: any = {
        lots: Array.from({ length: TOTAL_LOTS }, (_, id) => ({
          id,
          owner: id % 4,
          shopType: id === 0 ? 1 : null,
          buildingId: id === 0 ? 'b-0' : null,
          isComplete: false,
        })),
      };

      renderer.render(builtState);
      assert.strictEqual(
        renderer.getBuildingGroup().children.length,
        1,
        'Constructed shop must be placed inside buildingGroup'
      );

      renderer.unmount();
    });

    it('cleans up environment group, props, and textures upon unmount', () => {
      const container = createMockContainer();
      const renderer = new ThreeBoardRenderer({ container });

      renderer.mount();
      assert.ok(renderer.getEnvironmentGroup());

      renderer.unmount();
      assert.strictEqual(Object.keys(renderer.getParcelProps()).length, 0);
    });
  });
});
