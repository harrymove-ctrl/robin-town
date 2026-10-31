/**
 * src/ui/diorama-detail.ts
 *
 * Geometry helpers for the diorama look contract
 * (docs/diorama-kit/SKILL.md, "Detail Bar"):
 *
 *   pass 1  silhouette            (the base volumes in createShopBuilding)
 *   pass 2  construction assemblies  (windows, columns, canopies, vault wheel ...)
 *   pass 3  story detail          (props that say what the shop does)
 *
 * plus the contact shadows that anchor props to the slab, the single cut-out
 * base slab with its curbs and the recessed harbor channel, and the bridges
 * and borders that tie connected shops together.
 *
 * Everything is built from Three.js primitives and DataTextures only, so it
 * also runs under Node (no DOM / canvas required).
 */

import * as THREE from 'three';

/** Materials shared by one storefront while its details are assembled. */
export interface StorefrontMaterials {
  main: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
}

/** Tags written to `userData.detailPass` so QA can count each pass. */
export type DetailPass = 2 | 3;

export const DETAIL_PASS_2 = 2 as const;
export const DETAIL_PASS_3 = 3 as const;

function tag<T extends THREE.Object3D>(obj: T, name: string, pass: DetailPass): T {
  obj.name = name;
  obj.userData.detailPass = pass;
  return obj;
}

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  name: string,
  pass: DetailPass
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return tag(mesh, name, pass);
}

function cylinder(
  rTop: number,
  rBottom: number,
  h: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  name: string,
  pass: DetailPass,
  segments = 8
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), mat);
  mesh.position.set(x, y, z);
  return tag(mesh, name, pass);
}

function glowMaterial(hex: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: hex,
    transparent: opacity < 1,
    opacity,
  });
}

/** Radius of the DEX Swap rooftop dish rim. */
export const SATELLITE_DISH_RADIUS = 7;

/**
 * Parabolic satellite dish: a lathed paraboloid bowl (y = r^2 / 4f), a back
 * hub, a feed arm and a feed horn at the focal point. Built pointing up, then
 * tilted 30 deg toward the street (+Z) and seated on the DEX Swap struts.
 */
export function buildSatelliteDish(
  bowlMat: THREE.Material,
  trimMat: THREE.Material
): THREE.Group {
  const group = new THREE.Group();
  const radius = SATELLITE_DISH_RADIUS;
  const depth = 2.6;
  const focal = (radius * radius) / (4 * depth);
  const profile: THREE.Vector2[] = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const r = (radius * i) / steps;
    profile.push(new THREE.Vector2(r, (r * r) / (4 * focal)));
  }
  const bowlGeom = new THREE.LatheGeometry(profile, 16);
  const bowlSurface = bowlMat.clone();
  bowlSurface.side = THREE.DoubleSide;
  const bowl = new THREE.Mesh(bowlGeom, bowlSurface);
  bowl.name = 'SatelliteDishBowl';
  group.add(bowl);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 1.2, 8), trimMat);
  hub.position.y = -0.4;
  hub.name = 'SatelliteDishHub';
  group.add(hub);

  // Feed arm from the rim to the focus, and the horn at the focus.
  const armLength = Math.hypot(radius * 0.85, focal - depth * 0.72);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, armLength, 4), trimMat);
  arm.position.set(0, (focal + depth * 0.72) / 2, -radius * 0.425);
  arm.rotation.x = Math.atan2(radius * 0.85, focal - depth * 0.72);
  arm.name = 'SatelliteDishArm';
  group.add(arm);

  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 6), trimMat);
  horn.rotation.x = Math.PI;
  horn.position.y = focal;
  horn.name = 'SatelliteDishFeed';
  group.add(horn);

  group.rotation.x = Math.PI / 6;
  group.position.set(0, 23, 0);
  return group;
}

/**
 * Bevelled stone plinth under one district block: a square frustum (chamfered
 * sides) that steps out from the district slab onto the base slab, with a
 * thin lighter cap ring so the bevel reads in the ink pass.
 */
export function buildDistrictPlinth(
  centre: [number, number, number],
  width: number,
  depth: number,
  bottomY: number,
  topY: number
): THREE.Group {
  const group = new THREE.Group();
  const height = Math.max(0.4, topY - bottomY);
  const stone = new THREE.MeshStandardMaterial({
    color: 0x2d3748,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: true,
  });
  const capStone = new THREE.MeshStandardMaterial({ color: 0x3f4a5c, roughness: 0.75, metalness: 0.05 });

  // A 4-sided cylinder rotated 45 deg is a square frustum with unit-diagonal radius.
  const topPad = 6;
  const bottomPad = 18;
  const frustum = new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2, 1, 4, 1);
  frustum.rotateY(Math.PI / 4);
  // Shape the bottom ring wider than the top so the sides are chamfered.
  const pos = frustum.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const isTop = pos.getY(i) > 0;
    const w = width + (isTop ? topPad : bottomPad);
    const d = depth + (isTop ? topPad : bottomPad);
    pos.setXYZ(i, pos.getX(i) * w, pos.getY(i) * height, pos.getZ(i) * d);
  }
  pos.needsUpdate = true;
  frustum.computeVertexNormals();
  const body = new THREE.Mesh(frustum, stone);
  body.position.set(centre[0], bottomY + height / 2, centre[2]);
  body.name = 'DistrictPlinthBevel';
  group.add(body);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(width + topPad, 0.5, depth + topPad), capStone);
  cap.position.set(centre[0], topY - 0.25, centre[2]);
  cap.name = 'DistrictPlinthCap';
  group.add(cap);

  return group;
}

/**
 * Adds the pass-2 construction assemblies and pass-3 story details for one of
 * the six protocol storefronts. Dimensions follow the 38-unit footprint used by
 * `createShopBuilding`; +Z is the street-facing side.
 */
export function addStorefrontDetail(
  group: THREE.Group,
  shopType: number,
  mats: StorefrontMaterials,
  isComplete: boolean
): void {
  const { main, dark, trim } = mats;
  const gold = glowMaterial(0xffd700);
  const white = glowMaterial(0xf3f4f6);
  const parts: THREE.Object3D[] = [];

  switch (shopType) {
    case 0: {
      // DEX Swap: dual swap arrows, orderbook ticker canopy, rooftop dish.
      const arrowR = glowMaterial(0x39a883);
      const arrowL = glowMaterial(0xf3f4f6);
      parts.push(box(14, 1.6, 1.2, arrowR, 0, 13.5, 19.6, 'Detail_SwapArrowRight', 3));
      const tipR = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4, 3), arrowR);
      tipR.rotation.z = -Math.PI / 2;
      tipR.position.set(8.5, 13.5, 19.6);
      parts.push(tag(tipR, 'Detail_SwapArrowRightTip', 3));
      parts.push(box(14, 1.6, 1.2, arrowL, 0, 9.5, 19.6, 'Detail_SwapArrowLeft', 3));
      const tipL = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4, 3), arrowL);
      tipL.rotation.z = Math.PI / 2;
      tipL.position.set(-8.5, 9.5, 19.6);
      parts.push(tag(tipL, 'Detail_SwapArrowLeftTip', 3));
      // Orderbook ticker canopy over the entrance with a strip of price bars.
      parts.push(box(30, 1.4, 5, dark, 0, 6.2, 21, 'Detail_TickerCanopy', 2));
      const tickerColors = [0x39a883, 0xef4444, 0x39a883, 0x39a883, 0xef4444];
      tickerColors.forEach((hex, i) => {
        parts.push(
          box(4, 1 + (i % 3), 0.8, glowMaterial(hex), -10 + i * 5, 5.2, 23.2, `Detail_TickerBar_${i}`, 3)
        );
      });
      // Dish support struts.
      parts.push(cylinder(0.5, 0.5, 5, trim, -2, 20, -2, 'Detail_DishStrutA', 2, 6));
      parts.push(cylinder(0.5, 0.5, 5, trim, 2, 20, 2, 'Detail_DishStrutB', 2, 6));
      // Parabolic satellite dish on the struts, tilted toward the street, with
      // a feed arm and horn at its focus.
      parts.push(tag(buildSatelliteDish(main, trim), 'Detail_SatelliteDish', 2));
      break;
    }
    case 1: {
      // Memecoin Lounge: neon Shiba marquee, arcade awning, velvet rope stanchions.
      const neon = glowMaterial(0xeec353);
      parts.push(box(18, 8, 1.6, dark, 0, 19, 21.4, 'Detail_MarqueeBoard', 2));
      parts.push(box(12, 5.4, 1, neon, 0, 18.4, 22.4, 'Detail_ShibaHead', 3));
      const earL = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3.6, 3), neon);
      earL.position.set(-4.4, 22.4, 22.4);
      const earR = earL.clone();
      earR.position.x = 4.4;
      parts.push(tag(earL, 'Detail_ShibaEarL', 3), tag(earR, 'Detail_ShibaEarR', 3));
      parts.push(box(1.4, 1.4, 1.1, dark, -2.6, 19.2, 23, 'Detail_ShibaEyeL', 3));
      parts.push(box(1.4, 1.4, 1.1, dark, 2.6, 19.2, 23, 'Detail_ShibaEyeR', 3));
      // Striped arcade awning.
      for (let i = 0; i < 6; i++) {
        const stripe = box(5.6, 0.8, 5, i % 2 === 0 ? neon : white, -14 + i * 5.6, 8.2, 21.2, `Detail_AwningStripe_${i}`, 2);
        stripe.rotation.x = 0.28;
        parts.push(stripe);
      }
      // Velvet rope between two stanchions.
      const rope = glowMaterial(0xef4444);
      for (const sx of [-9, 9]) {
        parts.push(cylinder(0.5, 0.7, 5, trim, sx, 2.5, 22.4, `Detail_Stanchion_${sx}`, 3, 6));
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 4), gold);
        cap.position.set(sx, 5.4, 22.4);
        parts.push(tag(cap, `Detail_StanchionCap_${sx}`, 3));
      }
      parts.push(box(18, 0.7, 0.7, rope, 0, 4.2, 22.4, 'Detail_VelvetRope', 3));
      break;
    }
    case 2: {
      // Staking Vault: vault door wheel, bullion pillars, laser emitters.
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.8, 6, 16), trim);
      wheel.position.set(0, 9, 21);
      parts.push(tag(wheel, 'Detail_VaultWheel', 2));
      for (let i = 0; i < 3; i++) {
        const spoke = box(9, 0.9, 0.9, trim, 0, 9, 21.4, `Detail_VaultSpoke_${i}`, 2);
        spoke.rotation.z = (i * Math.PI) / 3;
        parts.push(spoke);
      }
      parts.push(cylinder(1.4, 1.4, 1.4, gold, 0, 9, 22, 'Detail_VaultHub', 3, 8));
      // Bullion pillars: stacked gold bars at the two front corners.
      for (const px of [-15, 15]) {
        for (let level = 0; level < 4; level++) {
          parts.push(box(6, 1.6, 3.6, gold, px, 1 + level * 1.7, 22, `Detail_Bullion_${px}_${level}`, 3));
        }
      }
      // Laser security emitters with a thin beam between them.
      const laser = glowMaterial(0xef4444, 0.8);
      for (const lx of [-11, 11]) {
        parts.push(cylinder(0.6, 0.6, 3, dark, lx, 3, 22.4, `Detail_LaserEmitter_${lx}`, 3, 6));
      }
      parts.push(box(22, 0.35, 0.35, laser, 0, 3.4, 22.4, 'Detail_LaserBeamLow', 3));
      parts.push(box(22, 0.35, 0.35, laser, 0, 5.4, 22.4, 'Detail_LaserBeamHigh', 3));
      break;
    }
    case 3: {
      // Lending Protocol: marble columns (capitals, bases, entablature), collateral scales, glass atrium.
      for (const cx of [-14, -5, 5, 14]) {
        parts.push(box(3.8, 1.2, 3.8, white, cx, 3.6, 16, `Detail_ColumnBase_${cx}`, 2));
        parts.push(box(3.8, 1.2, 3.8, white, cx, 18.6, 16, `Detail_ColumnCapital_${cx}`, 2));
      }
      parts.push(box(34, 2.2, 4.2, white, 0, 20.4, 16, 'Detail_Entablature', 2));
      // Glass atrium behind the columns.
      const glass = new THREE.MeshBasicMaterial({ color: 0x8fdbe6, transparent: true, opacity: 0.45 });
      parts.push(box(22, 11, 1, glass, 0, 10.5, 15.4, 'Detail_AtriumGlass', 2));
      for (let i = -1; i <= 1; i++) {
        parts.push(box(0.7, 11, 1.2, dark, i * 7, 10.5, 15.6, `Detail_AtriumMullion_${i}`, 2));
      }
      // Collateral scales on the pediment.
      parts.push(cylinder(0.5, 0.5, 9, gold, 0, 28.5, 0, 'Detail_ScalesPole', 3, 6));
      parts.push(box(14, 0.7, 0.7, gold, 0, 33, 0, 'Detail_ScalesBeam', 3));
      for (const sx of [-6.5, 6.5]) {
        const pan = cylinder(3, 1.2, 0.8, gold, sx, 30, 0, `Detail_ScalesPan_${sx}`, 3, 8);
        parts.push(pan);
        parts.push(box(0.25, 3, 0.25, gold, sx, 31.6, 0, `Detail_ScalesChain_${sx}`, 3));
      }
      break;
    }
    case 4: {
      // Derivatives Exchange: trading floor windows, candlestick hologram spire, cooling vents.
      const windowMat = glowMaterial(0xfff0a0);
      const tiers: [number, number, number][] = [
        [6, 38, 12],
        [19, 28, 14],
        [31, 18, 10],
      ];
      tiers.forEach(([y, width, height], t) => {
        const faceZ = width / 2 + 0.3;
        const cols = Math.max(3, Math.floor(width / 6));
        for (let i = 0; i < cols; i++) {
          const x = -width / 2 + (i + 0.5) * (width / cols);
          parts.push(box(width / cols - 2, height * 0.45, 0.6, windowMat, x, y, faceZ, `Detail_FloorWindow_${t}_${i}`, 2));
        }
      });
      // Candlestick holographic spire above the mast.
      const holo = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.7 });
      const bodies: [number, number, number][] = [
        [-6, 4, 6],
        [-2, 7, 9],
        [2, 5, 4],
        [6, 9, 8],
      ];
      bodies.forEach(([x, h, wick], i) => {
        parts.push(box(2.4, h, 2.4, holo, x, 52 + h / 2, 0, `Detail_Candle_${i}`, 3));
        parts.push(box(0.5, wick + h, 0.5, holo, x, 52 + (wick + h) / 2 - 1, 0, `Detail_CandleWick_${i}`, 3));
      });
      // Cooling vents on the first-tier roof.
      for (const vx of [-12, 12]) {
        parts.push(cylinder(2.4, 2.4, 2.4, dark, vx, 13.4, -10, `Detail_CoolingVent_${vx}`, 2, 10));
        parts.push(cylinder(2.8, 2.8, 0.5, trim, vx, 14.8, -10, `Detail_VentCap_${vx}`, 2, 10));
      }
      break;
    }
    case 5: {
      // Validator Citadel: twin server towers, bridge skyway, golden validator beacon.
      for (const tx of [-9, 9]) {
        parts.push(box(10, 16, 10, dark, tx, 26, 0, `Detail_ServerTower_${tx}`, 2));
        for (let row = 0; row < 5; row++) {
          const led = glowMaterial(row % 2 === 0 ? 0x00ff66 : 0x00f0ff);
          parts.push(box(6, 0.6, 0.5, led, tx, 20 + row * 3, 5.3, `Detail_ServerLed_${tx}_${row}`, 3));
        }
      }
      // Skyway bridging the towers.
      parts.push(box(10, 2.4, 4, trim, 0, 28, 0, 'Detail_Skyway', 2));
      parts.push(box(10, 0.6, 4.4, dark, 0, 29.6, 0, 'Detail_SkywayRoof', 2));
      // Golden beacon with a beam of light on top.
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(4.5, 16, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.32 })
      );
      beam.position.set(0, 48, 0);
      parts.push(tag(beam, 'Detail_BeaconBeam', 3));
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(3.4), gold);
      crystal.position.set(0, 42, 0);
      parts.push(tag(crystal, 'Detail_BeaconCrystal', 3));
      break;
    }
    default:
      break;
  }

  if (isComplete) {
    // Completed clusters read as finished: a gold ridge line along the roof edge.
    parts.push(box(36, 0.8, 0.8, gold, 0, 0.4, 19.4, 'Detail_CompleteSill', 3));
  }

  // `main` is accepted so every storefront receives the same palette trio, even
  // when a category does not use it directly.
  void main;
  for (const part of parts) group.add(part);
}

/** Counts pass-2 and pass-3 detail meshes on a storefront (QA helper). */
export function countDetailPasses(group: THREE.Object3D): { pass2: number; pass3: number } {
  let pass2 = 0;
  let pass3 = 0;
  group.traverse((child) => {
    if (child.userData.detailPass === DETAIL_PASS_2) pass2++;
    if (child.userData.detailPass === DETAIL_PASS_3) pass3++;
  });
  return { pass2, pass3 };
}

// ---------------------------------------------------------------------------
// Contact shadows
// ---------------------------------------------------------------------------

let sharedShadowTexture: THREE.DataTexture | null = null;

/** Soft radial falloff, generated procedurally so it works without a DOM. */
export function getContactShadowTexture(): THREE.DataTexture {
  if (sharedShadowTexture) return sharedShadowTexture;
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const falloff = Math.max(0, 1 - r);
      const alpha = Math.pow(falloff, 1.6);
      const i = (y * size + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  sharedShadowTexture = texture;
  return texture;
}

/** A flat, soft shadow disc lying on the surface under a prop. */
export function createContactShadow(size: number, opacity = 0.55, name = 'ContactShadow'): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.name = name;
  mesh.renderOrder = 1;
  mesh.userData.isContactShadow = true;
  return mesh;
}

/** True for meshes created by `createContactShadow`. */
export function isContactShadow(obj: THREE.Object3D): boolean {
  return obj.userData.isContactShadow === true;
}

// ---------------------------------------------------------------------------
// Base slab, curbs and harbor channel
// ---------------------------------------------------------------------------

export interface BaseSlabLayout {
  /** World-space edges of the land slab (x: west..east of land, z: north..south). */
  west: number;
  east: number;
  north: number;
  south: number;
  /** World-space x range of the recessed harbor channel on the east side. */
  channelWest: number;
  channelEast: number;
  /** Heights: land surface, channel water, slab bottom. */
  landTop: number;
  waterY: number;
  bottom: number;
}

/**
 * Builds the single cut-out slab the whole city sits on: bevelled stone
 * edge, a recessed harbor channel on the east side with quay walls, and a
 * strip of water. Returned in its own group so the district group keeps
 * exactly one child per district.
 */
export function buildBaseSlab(layout: BaseSlabLayout): THREE.Group {
  const group = new THREE.Group();
  group.name = 'BaseSlabGroup';

  const stone = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8, metalness: 0.1 });
  const stoneLight = new THREE.MeshStandardMaterial({ color: 0x3f4a5c, roughness: 0.7, metalness: 0.1 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9, metalness: 0.05 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1b7f95,
    roughness: 0.25,
    metalness: 0.2,
    emissive: 0x0f5a6e,
    emissiveIntensity: 0.35,
  });

  const { west, east, north, south, channelWest, channelEast, landTop, waterY, bottom } = layout;
  const depth = south - north;
  const centreZ = (north + south) / 2;
  const thickness = landTop - bottom;

  // Land slab: west edge to the channel.
  const landWidth = channelWest - west;
  const land = new THREE.Mesh(new THREE.BoxGeometry(landWidth, thickness, depth), stone);
  land.position.set(west + landWidth / 2, bottom + thickness / 2, centreZ);
  land.name = 'BaseSlabLand';
  group.add(land);

  // Bevel: a slightly inset lighter lip on top of the land edge.
  const lipInset = 6;
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(landWidth - lipInset, 1.6, depth - lipInset),
    stoneLight
  );
  lip.position.set(west + landWidth / 2 - lipInset / 4, landTop - 0.2, centreZ);
  lip.name = 'BaseSlabBevel';
  group.add(lip);

  // Plinth below the slab: a step wider than the land at the bottom for a chunky cut-out edge.
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(landWidth + 8, 4, depth + 8),
    stoneDark
  );
  plinth.position.set(west + landWidth / 2 - 2, bottom + 2, centreZ);
  plinth.name = 'BaseSlabPlinth';
  group.add(plinth);

  // Harbor channel: floor, water surface, and the two quay walls.
  const channelWidth = channelEast - channelWest;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(channelWidth, 2, depth), stoneDark);
  floor.position.set(channelWest + channelWidth / 2, waterY - 2, centreZ);
  floor.name = 'HarborFloor';
  group.add(floor);

  const water = new THREE.Mesh(new THREE.BoxGeometry(channelWidth, 0.6, depth), waterMat);
  water.position.set(channelWest + channelWidth / 2, waterY - 0.3, centreZ);
  water.name = 'HarborWater';
  group.add(water);

  const quayHeight = landTop - waterY + 2;
  const quayWest = new THREE.Mesh(new THREE.BoxGeometry(3, quayHeight, depth), stoneLight);
  quayWest.position.set(channelWest + 1.5, waterY - 2 + quayHeight / 2, centreZ);
  quayWest.name = 'HarborQuayWest';
  group.add(quayWest);

  const quayEast = new THREE.Mesh(new THREE.BoxGeometry(3, quayHeight, depth), stoneLight);
  quayEast.position.set(channelEast - 1.5, waterY - 2 + quayHeight / 2, centreZ);
  quayEast.name = 'HarborQuayEast';
  group.add(quayEast);

  // Mooring posts along the west quay.
  for (let i = 0; i < 5; i++) {
    const z = north + 40 + i * ((depth - 80) / 4);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 4, 6), stoneDark);
    post.position.set(channelWest + 1.5, landTop + 1.2, z);
    post.name = `HarborMooring_${i}`;
    group.add(post);
  }

  return group;
}

/**
 * Bevelled curb around a district slab: a dark outer rim with a lighter inset
 * cap, so the edge reads as cut stone in the ink pass.
 */
export function buildDistrictCurb(
  centre: [number, number, number],
  width: number,
  depth: number,
  accentHex: string,
  topY: number
): THREE.Group {
  const group = new THREE.Group();
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.8 });
  const capMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentHex).multiplyScalar(0.55),
    roughness: 0.6,
  });
  const curbWidth = 3;
  const curbHeight = 2.2;
  const sides: [number, number, number, number][] = [
    // x offset, z offset, width, depth
    [0, -depth / 2 + curbWidth / 2, width, curbWidth],
    [0, depth / 2 - curbWidth / 2, width, curbWidth],
    [-width / 2 + curbWidth / 2, 0, curbWidth, depth - 2 * curbWidth],
    [width / 2 - curbWidth / 2, 0, curbWidth, depth - 2 * curbWidth],
  ];
  sides.forEach(([ox, oz, w, d], i) => {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w, curbHeight, d), rimMat);
    rim.position.set(centre[0] + ox, topY + curbHeight / 2, centre[2] + oz);
    rim.name = `DistrictCurbRim_${i}`;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w - 0.8, 0.7, d - 0.8), capMat);
    cap.position.set(centre[0] + ox, topY + curbHeight + 0.35, centre[2] + oz);
    cap.name = `DistrictCurbCap_${i}`;
    group.add(rim, cap);
  });
  group.name = 'DistrictCurb';
  return group;
}
