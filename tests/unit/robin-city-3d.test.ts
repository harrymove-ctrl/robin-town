import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PLOT_LAYOUT } from '../../src/town/board-layout';
import { newGame, SHOPS } from '../../src/town/engine';
import {
  STREET_YAW_EAST,
  STREET_YAW_NORTH,
  STREET_YAW_SOUTH,
  STREET_YAW_WEST,
  boardRectToWorld,
  computePlotClusterConnections,
  getPlotStreetFacingYaw,
  minRoadClearance2D,
  worldToBoard,
} from '../../src/town/city-3d/types-3d';
import { createNeighborhoodWorld3D } from '../../src/town/city-3d/neighborhood-world';
import {
  createEnglishShop3D,
  createPlasticStool3D,
} from '../../src/town/city-3d/shop-models-3d';
import { RobinCity3DRenderer } from '../../src/town/city-3d/robin-city-3d';
import { SCROLLABLE_SELECTOR, installMobileGuards, type MobileTouchListener } from '../../src/town/mobile';

function createMockContainer(): HTMLElement {
  const listeners = new Map<string, Set<unknown>>();
  const children: unknown[] = [];
  return {
    clientWidth: 1100,
    clientHeight: 730,
    appendChild(child: unknown) {
      children.push(child);
      return child;
    },
    removeChild(child: unknown) {
      const idx = children.indexOf(child);
      if (idx >= 0) children.splice(idx, 1);
      return child;
    },
    addEventListener(type: string, fn: unknown) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: unknown) {
      listeners.get(type)?.delete(fn);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 1100, height: 730, right: 1100, bottom: 730 };
    },
  } as unknown as HTMLElement;
}

describe('RobinCity3DRenderer 2D-to-3D Neighborhood Parity', () => {
  it('places all 72 numbered plots at exact 2D PLOT_LAYOUT coordinates inside the neighborhood world', () => {
    const container = createMockContainer();
    const renderer = new RobinCity3DRenderer({
      container,
      width: 1100,
      height: 730,
    });

    renderer.mount();

    const scene = renderer.getScene();
    const worldGroup = scene.getObjectByName('robin-neighborhood-world');
    assert.ok(worldGroup, 'Expected robin-neighborhood-world group in scene');

    for (let lotId = 0; lotId < 72; lotId++) {
      const slot = renderer.getPlotSlot(lotId);
      assert.ok(slot, `Expected PlotSlot3D for lot ${lotId}`);
      const plot = PLOT_LAYOUT[lotId];
      const [expectedX, expectedY, expectedZ] = boardRectToWorld(plot.x, plot.y, 50, 50, 0.9);
      assert.ok(Math.abs(slot.root.position.x - expectedX) < 1e-3);
      assert.ok(Math.abs(slot.root.position.y - expectedY) < 1e-3);
      assert.ok(Math.abs(slot.root.position.z - expectedZ) < 1e-3);
      assert.equal(slot.tileMesh.userData.lotId, lotId);
    }

    renderer.unmount();
  });

  it('highlights pending deed offers and chosen plots in Receive phase and renders stools + all 6 English shops', () => {
    const container = createMockContainer();
    const renderer = new RobinCity3DRenderer({
      container,
      width: 1100,
      height: 730,
    });
    renderer.mount();

    const state = newGame(() => 0.42, 'casual');
    const firstPending = state.pending[0];
    const secondPending = state.pending[1];

    renderer.render({
      state,
      selectedLot: firstPending,
      chosenLots: [secondPending],
      selectedShop: null,
    });

    const offeredSlot = renderer.getPlotSlot(firstPending)!;
    assert.equal(offeredSlot.deedBadgeGroup.visible, true);

    const chosenSlot = renderer.getPlotSlot(secondPending)!;
    assert.equal(chosenSlot.ringMesh.visible, true);
    assert.equal(
      chosenSlot.deedBadgeGroup.visible,
      false,
      'Chosen Receive plot should hide LAND DEED banner so stool preview does not overlap',
    );
    let chosenMeshes = 0;
    chosenSlot.root.traverse((node) => {
      if ((node as { isMesh?: boolean }).isMesh) chosenMeshes++;
    });
    assert.ok(chosenMeshes > 5);

    state.phase = 'build';
    state.pending = [];
    for (let p = 0; p < 4; p++) {
      state.lots[p].owner = p;
      state.lots[p].shop = null;
    }

    // Complete 3-tile Coffee cluster on Sherwood lots 4, 5, 6
    state.lots[4].owner = 0;
    state.lots[4].shop = 0;
    state.lots[5].owner = 0;
    state.lots[5].shop = 0;
    state.lots[6].owner = 0;
    state.lots[6].shop = 0;

    for (let shopIdx = 1; shopIdx < SHOPS.length; shopIdx++) {
      state.lots[11 + shopIdx].owner = shopIdx % 4;
      state.lots[11 + shopIdx].shop = shopIdx;
    }

    renderer.setDropTargetLot(0);
    renderer.render({
      state,
      selectedLot: 4,
      chosenLots: [],
      selectedShop: 1,
    });

    assert.ok(renderer.getPlotSlot(0)!.occupantKey.includes('0:null'));
    assert.ok(renderer.getPlotSlot(4)!.occupantKey.includes('true'));

    for (const preset of ['neighborhood', 'isometric', 'topdown', 'street'] as const) {
      renderer.setCameraPreset(preset);
      assert.equal(renderer.getCameraPreset(), preset);
    }

    renderer.focusLot(4);
    renderer.resetCamera();
    renderer.pause();
    renderer.resume();
    renderer.unmount();
  });

  it('constructs standalone 3D plastic stools and all 6 English shophouses cleanly in headless Node', () => {
    for (let owner = 0; owner < 4; owner++) {
      const stool = createPlasticStool3D(owner);
      let meshCount = 0;
      stool.traverse((n) => {
        if ((n as { isMesh?: boolean }).isMesh) meshCount++;
      });
      assert.ok(meshCount >= 10, `Expected >= 10 meshes in 3D plastic stool, got ${meshCount}`);
    }
    for (let shopIdx = 0; shopIdx < 6; shopIdx++) {
      const shop = createEnglishShop3D(shopIdx, shopIdx % 4, SHOPS[shopIdx].size, true);
      let meshCount = 0;
      shop.traverse((n) => {
        if ((n as { isMesh?: boolean }).isMesh) meshCount++;
      });
      assert.ok(meshCount >= 20, `Expected >= 20 meshes in 3D English shop ${shopIdx}, got ${meshCount}`);
    }
  });

  it('orients 3D shops and connected clusters toward their nearest adjacent street while keeping plinth unrotated', () => {
    // Plot #53 (lotId 52, Grand Market col 0 row 1) borders road v3 on the West
    assert.equal(getPlotStreetFacingYaw(52), STREET_YAW_WEST);
    // Plot #50 (lotId 49, Grand Market col 1 row 0) borders Merchant Blvd on the North
    assert.equal(getPlotStreetFacingYaw(49), STREET_YAW_NORTH);
    // Plot #58 (lotId 57, Grand Market col 0 row 3) borders Harborfront/v3; Plot #59 (lotId 58) faces South
    assert.equal(getPlotStreetFacingYaw(58), STREET_YAW_SOUTH);
    // Plot #21 (lotId 20, Clocktower col 3 row 2) borders road v2 on the East
    assert.equal(getPlotStreetFacingYaw(20), STREET_YAW_EAST);

    // Connected 3-tile cluster [52, 53, 54] inherits West street orientation consistently
    const cluster = [52, 53, 54];
    for (const id of cluster) {
      assert.equal(getPlotStreetFacingYaw(id, cluster), STREET_YAW_WEST);
    }

    const westShop = createEnglishShop3D(0, 0, 3, true, STREET_YAW_WEST);
    const buildingGroup = westShop.getObjectByName('street-facing-building');
    assert.ok(buildingGroup, 'Expected street-facing-building child group');
    assert.equal(buildingGroup.rotation.y, STREET_YAW_WEST);
    assert.equal(westShop.children[0].rotation.y, 0, 'Plinth stays unrotated so SE plot number stays clear');
  });

  it('keeps all 18 curbside traffic lights and 4 cafe parasols off road asphalt and keeps vehicles inside road lanes', () => {
    const world = createNeighborhoodWorld3D();

    const poles: { bx: number; by: number; clearance: number }[] = [];
    const parasols: { bx: number; by: number; clearance: number }[] = [];
    const scooters: Array<{ position: { x: number; z: number } }> = [];
    const buses: Array<{ position: { x: number; z: number } }> = [];

    world.group.traverse((obj) => {
      if (obj.name === 'traffic-light-pole') {
        const [bx, by] = worldToBoard(obj.position.x, obj.position.z);
        poles.push({ bx, by, ...minRoadClearance2D(bx, by) });
      } else if (obj.name === 'cafe-parasol-set') {
        const [bx, by] = worldToBoard(obj.position.x, obj.position.z);
        parasols.push({ bx, by, ...minRoadClearance2D(bx, by) });
      } else if (obj.name === 'street-scooter') {
        scooters.push(obj);
      } else if (obj.name === 'city-bus') {
        buses.push(obj);
      }
    });

    assert.equal(poles.length, 18, 'Expected 18 curbside traffic light poles');
    for (const p of poles) {
      assert.ok(
        p.clearance >= 6.0 && p.bx <= 1056,
        `Traffic light pole at (${p.bx.toFixed(1)}, ${p.by.toFixed(1)}) encroaches road or river (clearance=${p.clearance.toFixed(2)})`,
      );
    }

    assert.equal(parasols.length, 4, 'Expected 4 cafe parasol sets');
    for (const c of parasols) {
      assert.ok(
        c.clearance >= 14.0,
        `Cafe parasol at (${c.bx.toFixed(1)}, ${c.by.toFixed(1)}) is too close to road (clearance=${c.clearance.toFixed(2)})`,
      );
    }

    assert.equal(scooters.length, 6, 'Expected 6 street scooters');
    assert.equal(buses.length, 1, 'Expected 1 city-bus in neighborhood world');

    for (let t = 0; t <= 45; t += 1.5) {
      world.update(t, 0.05);
      for (let sIdx = 0; sIdx < scooters.length; sIdx++) {
        const [bx, by] = worldToBoard(scooters[sIdx].position.x, scooters[sIdx].position.z);
        const check = minRoadClearance2D(bx, by);
        assert.ok(
          check.clearance <= -1.2,
          `Scooter ${sIdx} at t=${t}s left road asphalt at (${bx.toFixed(1)}, ${by.toFixed(1)}), clearance=${check.clearance.toFixed(2)}`,
        );
      }
      const [busBx, busBy] = worldToBoard(buses[0].position.x, buses[0].position.z);
      const busCheck = minRoadClearance2D(busBx, busBy);
      assert.ok(
        busCheck.clearance <= -1.0,
        `City bus at t=${t}s left road asphalt at (${busBx.toFixed(1)}, ${busBy.toFixed(1)}), clearance=${busCheck.clearance.toFixed(2)}`,
      );
    }

    world.dispose();
  });

  it('merges adjacent same-shop clusters with courtyard bridges, flagship crown, and vacant garden corners', () => {
    // Grand Market row 1 lots: 52 (col 0), 53 (col 1), 54 (col 2)
    const cluster = [52, 53, 54];
    const c52 = computePlotClusterConnections(52, cluster);
    const c53 = computePlotClusterConnections(53, cluster);
    const c54 = computePlotClusterConnections(54, cluster);

    assert.deepEqual(c52.mask, { north: false, south: false, east: true, west: false });
    assert.deepEqual(c53.mask, { north: false, south: false, east: true, west: true });
    assert.deepEqual(c54.mask, { north: false, south: false, east: false, west: true });
    // Center lot 53 has 2 neighbors, so it is the canonical flagship lot
    assert.equal(c53.isFlagship, true);
    assert.equal(c52.isFlagship, false);
    assert.equal(c54.isFlagship, false);

    const container = createMockContainer();
    const renderer = new RobinCity3DRenderer({
      container,
      width: 1100,
      height: 730,
      initialAtmosphere: 'day',
    });
    renderer.mount();

    const state = newGame(() => 0.25, 'casual');
    state.phase = 'build';
    state.pending = [];
    for (const id of cluster) {
      state.lots[id].owner = 0;
      state.lots[id].shop = 0; // 3-tile Coffee complete chain
    }

    renderer.render({
      state,
      selectedLot: null,
      chosenLots: [],
      selectedShop: null,
    });

    const flagshipSlot = renderer.getPlotSlot(53)!;
    const westWingSlot = renderer.getPlotSlot(52)!;
    const vacantSlot = renderer.getPlotSlot(60)!;

    assert.ok(flagshipSlot.occupantGroup.getObjectByName('cluster-bridge-east'));
    assert.ok(flagshipSlot.occupantGroup.getObjectByName('cluster-bridge-west'));
    assert.ok(flagshipSlot.occupantGroup.getObjectByName('complete-prosperity-crown'));

    assert.ok(westWingSlot.occupantGroup.getObjectByName('cluster-bridge-east'));
    assert.ok(westWingSlot.occupantGroup.getObjectByName('wing-prosperity-finial'));
    assert.equal(westWingSlot.occupantGroup.getObjectByName('complete-prosperity-crown'), undefined);

    const flagshipGarden = flagshipSlot.root.getObjectByName('vacant-parcel-garden');
    const vacantGarden = vacantSlot.root.getObjectByName('vacant-parcel-garden');
    assert.ok(flagshipGarden && vacantGarden);
    assert.equal(flagshipGarden.visible, false, 'Built shop lot hides vacant parcel garden');
    assert.equal(vacantGarden.visible, true, 'Empty lot displays manicured vacant parcel garden');

    for (const atmo of ['sunset', 'night', 'day'] as const) {
      renderer.setAtmosphere(atmo);
      assert.equal(renderer.getAtmosphere(), atmo);
    }

    renderer.unmount();
  });

  it('builds scenic sky dome, harbor islands, compact district monuments, and curbside heritage streetlamps', () => {
    const world = createNeighborhoodWorld3D();

    assert.ok(world.group.getObjectByName('scenic-sky-dome'), 'Expected 360-deg scenic sky dome');
    assert.ok(
      world.group.getObjectByName('distant-harbor-backdrop'),
      'Expected walnut tabletop and harbor islands backdrop',
    );

    const lamps: { bx: number; by: number; clearance: number }[] = [];
    let monumentCount = 0;
    world.group.traverse((obj) => {
      if (obj.name.startsWith('district-corner-monument-')) {
        monumentCount++;
      } else if (obj.name === 'street-heritage-lamp') {
        const [bx, by] = worldToBoard(obj.position.x, obj.position.z);
        lamps.push({ bx, by, ...minRoadClearance2D(bx, by) });
      }
    });

    assert.equal(monumentCount, 6, 'Expected 6 low-profile district corner monuments');
    assert.equal(lamps.length, 12, 'Expected 12 curbside heritage streetlamps');
    for (const lamp of lamps) {
      assert.ok(
        lamp.clearance >= 6.5,
        `Streetlamp at (${lamp.bx.toFixed(1)}, ${lamp.by.toFixed(1)}) is too close to road (clearance=${lamp.clearance.toFixed(2)})`,
      );
    }

    world.setAtmosphere?.('sunset');
    world.update(2.5, 0.05);
    world.setAtmosphere?.('night');
    world.update(5.0, 0.05);
    world.setAtmosphere?.('day');
    world.dispose();
  });

  it('adapts 3D portrait FOV and touch drag mode cleanly for mobile viewports and allows horizontal 3D toolbar swipe', () => {
    assert.ok(
      SCROLLABLE_SELECTOR.includes('.three-city-toolbar'),
      'Expected .three-city-toolbar in mobile SCROLLABLE_SELECTOR',
    );
    assert.ok(
      SCROLLABLE_SELECTOR.includes('.robin-hud-utilities'),
      'Expected .robin-hud-utilities in mobile SCROLLABLE_SELECTOR',
    );

    const mobileContainer = {
      ...createMockContainer(),
      clientWidth: 390,
      clientHeight: 690,
      getBoundingClientRect() {
        return { left: 0, top: 0, width: 390, height: 690, right: 390, bottom: 690 };
      },
    } as unknown as HTMLElement;

    const renderer = new RobinCity3DRenderer({
      container: mobileContainer,
      width: 390,
      height: 690,
      initialPreset: 'neighborhood',
    });
    renderer.mount();

    const portraitFov = renderer.getCamera().fov;
    assert.ok(
      portraitFov > 44 && portraitFov <= 50,
      `Expected widened portrait FOV between 44 and 50 deg on 390x690, got ${portraitFov}`,
    );
    assert.equal(renderer.getTouchDragMode(), 'pan', 'Expected default mobile 1-finger mode to be pan');

    renderer.setTouchDragMode('orbit');
    assert.equal(renderer.getTouchDragMode(), 'orbit');
    renderer.setTouchDragMode('pan');
    assert.equal(renderer.getTouchDragMode(), 'pan');

    renderer.resize(1440, 760);
    assert.equal(renderer.getCamera().fov, 38, 'Expected desktop landscape FOV to remain 38 deg');

    renderer.unmount();

    // Verify installMobileGuards permits horizontal swipe inside .three-city-toolbar
    const touchListeners = new Map<string, MobileTouchListener>();
    installMobileGuards({
      addEventListener(type: string, listener: unknown) {
        if (type === 'touchstart' || type === 'touchmove') {
          touchListeners.set(type, listener as MobileTouchListener);
        }
      },
    });
    const toolbarRegion = {
      scrollLeft: 10,
      scrollWidth: 520,
      clientWidth: 374,
      scrollTop: 0,
      scrollHeight: 38,
      clientHeight: 38,
    };
    const fakeTarget = {
      closest(sel: string) {
        return sel.includes('.three-city-toolbar') ? toolbarRegion : null;
      },
    };
    let prevented = false;
    touchListeners.get('touchstart')?.({
      target: fakeTarget,
      touches: [{ clientX: 200, clientY: 740 }],
      preventDefault() {},
    });
    touchListeners.get('touchmove')?.({
      target: fakeTarget,
      cancelable: true,
      touches: [{ clientX: 140, clientY: 741 }],
      preventDefault() {
        prevented = true;
      },
    });
    assert.equal(prevented, false, 'Horizontal swipe inside .three-city-toolbar must not be blocked');
  });
});
