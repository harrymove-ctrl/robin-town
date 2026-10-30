# 3D UI/UX Overhaul, Diorama Visual Presentation, and Asset Pipelines Execution Plan

## 1. Executive Summary and Design Philosophy

The 3D UI/UX Overhaul transforms robin-town from a flat 2D canvas web game into an interactive, toy-scale 3D pixel-art diorama inspired by the aesthetics of classic handheld gaming consoles and contemporary fintech interfaces. The design combines the `sloemo01/diorama` Look Contract, the SolaceUI exposure-grid background shader, an Apple Carousel infinite property navigation system, and an iPod Classic tactile click wheel controller into a unified, responsive web experience.

Key architectural objectives include:
1. First-Class 3D Scene Integration: Wire `ThreeBoardRenderer` (`src/ui/board-3d.ts`) directly into the `RobinTownApp` shell (`src/app.ts`), establishing real-time 3D rendering as the primary presentation with automatic fallback to 2D canvas on devices lacking WebGL support.
2. Mathematical Precision and Raycast Hardening: Resolve the 6 empirical stress test failures documented in `scripts/stress-board-3d.ts` (lot 71 coordinate alignment, parcel side-wall hits, NaN and Infinity guards, and camera transition lerp boundaries).
3. Diorama Look Contract Enforcement: Implement the `sloemo01/diorama` v3.8.0 post-processing pipeline (`PixelPost`), featuring 64-color palette quantization, 8x8 ordered Bayer dithering, warm near-black (0.62 mix) inked edge contours, and soft contact shadows.
4. SolaceUI Exposure-Grid Background Shader: Port the `#version 300 es` WebGL2 exposure-grid shader into a shared Three.js background pass, avoiding multi-context overhead while rendering dynamic architectural grids with pointer-reactive distortion.
5. Tangible Retro Controls: Port the Apple Carousel infinite autoplay property navigator and the iPod Classic tactile click wheel controller to vanilla TypeScript with zero external framework dependencies.
6. Instanced Rendering and Audio Polish: Consolidate 72 individual parcel meshes into a single `THREE.InstancedMesh` (reducing parcel draw calls from 72 to 1) and expand procedural audio with click wheel haptic ticks, coin flip rings, and negotiation countdown pings.

```
+---------------------------------------------------------------------------------------------------+
|                                 3D UI/UX & DIORAMA ARCHITECTURE                                   |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  |                            SolaceUI Exposure-Grid WebGL2 Background                         |  |
|  |   u_grid (#162130)  u_accent (#00C805)  u_secondary (#EEC353)  u_ink (#080c14)  u_paper     |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                |                                                  |
|                                                v                                                  |
|  +---------------------------------------------------------------------------------------------+  |
|  |                Three.js Interactive Diorama Scene (fov 20.5, az 45, elev 33)                 |  |
|  |  * 6 Extruded District Slabs with Bevelled Neon Borders                                      |  |
|  |  * 72 Instanced Parcel Meshes (Single THREE.InstancedMesh, Per-Instance Color/Transform)    |  |
|  |  * 6 Procedural Protocol Storefronts Passing 3-Pass Detail Bar (DX, ML, SV, LP, DE, VC/SB)     |  |
|  |  * Golden Completion Halos, Pulsing Light Beacons, and Soft Radial Contact Shadows           |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                |                                                  |
|                                                v                                                  |
|  +---------------------------------------------------------------------------------------------+  |
|  |                       PixelPost Full-Screen Post-Processing Shader Pass                     |  |
|  |        64-Color Palette Snap  |  8x8 Ordered Bayer Dithering  |  Inked Edge Contours        |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                |                                                  |
|                                                v                                                  |
|  +---------------------------------------------+-----------------------------------------------+  |
|  |                                      User Interaction Layer                                 |  |
|  |  +-----------------------------------------+  +------------------------------------------+  |  |
|  |  | Apple Carousel: Property Browser       |  | iPod Classic: Tactile Gamepad Controller |  |  |
|  |  | * Infinite Autoplay (Clone Count 4)    |  | * Angular Click Wheel Tracking (atan2)   |  |  |
|  |  | * Web Animations API Progress Bar      |  | * 8-Degree Reverse Dead Zone             |  |  |
|  |  | * Lot Hover Focus -> 3D Camera Pan      |  | * Menu / Prev / Next / Play / Select     |  |  |
|  |  +-----------------------------------------+  +------------------------------------------+  |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. 3D Board Hardening and Mathematical Precision (Milestone D1)

### 2.1 Coordinate Space Alignment

Inspection of `src/ui/board-3d.ts` identified a coordinate discrepancy between canvas mapping and parcel geometry placement:
```typescript
// Current board-3d.ts:25-26, 111-117, 129-135
export const BOARD_ORIGIN_X = 550;
export const BOARD_ORIGIN_Z = 365;

export function canvasToWorld(cx: number, cy: number, elevation = ELEVATION_PARCEL_BASE): [number, number, number] {
  return [cx - BOARD_ORIGIN_X, elevation, cy - BOARD_ORIGIN_Z];
}

export function getParcelWorldPosition(lotX: number, lotY: number, elevation = ELEVATION_PARCEL_BASE): [number, number, number] {
  return [lotX - 525, elevation, lotY - 340];
}
```
The subtraction of `(525, 340)` in `getParcelWorldPosition` offsets parcel geometry 25 pixels horizontally and 25 pixels vertically from the canonical origin `(550, 365)` used by `canvasToWorld`. Because parcel 71 resides at the bottom right corner of District 5 (`col 3, row 3`), this offset shifts lot 71 outside the camera raycaster frustum, causing center hit raycasts on lot 71 to fail in `scripts/stress-board-3d.ts`.

Remediation:
Harmonize `getParcelWorldPosition` to use `BOARD_ORIGIN_X` and `BOARD_ORIGIN_Z`:
```typescript
export function getParcelWorldPosition(lotX: number, lotY: number, elevation = ELEVATION_PARCEL_BASE): [number, number, number] {
  return [lotX - BOARD_ORIGIN_X, elevation, lotY - BOARD_ORIGIN_Z];
}
```

### 2.2 Side-Wall Hit Prevention and Horizontal Plane Intersections

In `scripts/stress-board-3d.ts`, raycasts aimed into narrow 4-pixel street gaps between adjacent parcels returned parcel `0` instead of `null`. Similarly, points outside parcel boundaries (`cx + 24.5`) hit parcel `0`.

Root Cause:
Parcels are modeled as 3D boxes (`BoxGeometry(48, 2, 48)`). Because the camera views the diorama at an oblique 33-degree elevation angle, raycaster rays passing through the gap strike the vertical side walls of adjacent parcel boxes.

Remediation:
1. Filter raycast intersections to consider only hits on upward-facing horizontal top planes.
   For individual parcel meshes in Milestone D2:
```typescript
const hits = raycaster.intersectObjects(parcelMeshes, false);
const validHit = hits.find(hit => hit.face && hit.face.normal.y > 0.9);
```
   For the single `THREE.InstancedMesh` optimization in Milestone D6:
   In `THREE.InstancedMesh`, `hit.face.normal` resides in the local coordinate space of the shared base geometry. To verify world-up orientation, transform the normal by the instance transform matrix and the instanced mesh world matrix:
```typescript
const hits = raycaster.intersectObject(parcelInstancedMesh, false);
const instanceMatrix = new THREE.Matrix4();
const validHit = hits.find(hit => {
  if (!hit.face || hit.instanceId === undefined) return false;
  parcelInstancedMesh.getMatrixAt(hit.instanceId, instanceMatrix);
  const worldNormal = hit.face.normal.clone()
    .transformDirection(instanceMatrix)
    .transformDirection(parcelInstancedMesh.matrixWorld);
  return worldNormal.y > 0.9;
});
```
2. When testing raycast hits, check that the intersection point falls within the 2D footprint of the target parcel before accepting the hit. If no upward-facing face is struck, return `null`.

### 2.3 Finite Coordinate Guards for Raycasting

In `scripts/stress-board-3d.ts`, passing `NaN` or `Infinity` into `raycastAt` triggered an unhandled exception or returned lot 0.

Remediation:
Enforce input validation at the top of `raycastAt`:
```typescript
public raycastAt(ndcX: number, ndcY: number): number | null {
  if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) {
    return null;
  }
  // proceed with raycasting
}
```

### 2.4 Camera Mode Transition Boundary Lerp

In `scripts/stress-board-3d.ts` Test 1.3, camera transitions between orthographic and perspective modes exhibited instability at completion.

Remediation:
Ensure that when `progress >= 1.0`, the camera transition cleanly finalizes state:
```typescript
if (this.cameraTransition) {
  const elapsed = (timestamp - this.cameraTransition.startTime) / this.cameraTransition.duration;
  if (elapsed >= 1.0) {
    this.activeCamera = this.cameraTransition.targetCamera;
    this.cameraTransition = null;
  } else {
    // smooth interpolation
  }
}
```

### 2.5 Wiring `ThreeBoardRenderer` into `RobinTownApp`

In `src/app.ts`, `RobinTownApp` currently attaches a 2D HTML5 canvas context. Refactor `RobinTownApp.mount` to:
1. Detect WebGL capability via `isWebGLAvailable()`.
2. Instantiate `ThreeBoardRenderer` inside `#board-container`.
3. Synchronize engine state changes (`onStateChange`) with `ThreeBoardRenderer.syncState(state)`.
4. Fall back to 2D `BoardRenderer` if WebGL initialization fails or is disabled by user settings.

---

## 3. Diorama Look Contract and PixelPost Shaders (Milestone D2)

### 3.1 sloemo01/diorama Look Contract Specifications

The visual presentation adheres to the formal `sloemo01/diorama` v3.8.0 Look Contract (`docs/diorama-kit/SKILL.md`):
* Locked Isometric Angle: Azimuth fixed at 45 degrees, elevation fixed at 33 degrees, field of view fixed at 20.5 degrees.
* Cut-Out Plinth Silhouette: The city board floats as a crisp geometric slab with a 12-pixel bevelled perimeter curb and paper-white or deep navy void background.
* 64-Color Palette Discipline: Every pixel on screen resolves to one of 64 fixed sRGB palette values through perceptual color distance mapping.
* Ordered Bayer 8x8 Dithering: Applied to smooth tonal ramps and lighting transitions while preserving solid flat roofs.
* Inked Contours: Warm near-black (0.62 mix) luminance edge detection outlining building geometry and district boundaries.
* Radial Contact Shadows: Subtle dark circular contact discs positioned under every ownership token, signpost, and building prop.
* Deterministic Time Function: All ambient animations (floating cash yield popups, pulsating completion halos, and miniature street merchants) are pure functions of `t`.

### 3.2 PixelPost Post-Processing Pipeline Architecture

Create `src/ui/post-processing.ts` implementing `PixelPost`:
1. Render Target: A `THREE.WebGLRenderTarget` configured with `THREE.HalfFloatType` and `THREE.LinearSRGBColorSpace`.
2. Full-Screen Quad Shader: Evaluates luminance gradients across adjacent pixels to detect silhouette edges, applies an 8x8 Bayer threshold matrix to smooth lighting ramps, and quantizes RGB colors to the nearest entry in the 64-color palette table.
3. Palette Array (`PALETTE_RGB`): 64 pre-computed RGB vectors representing the core robin-town retro palette (Robinhood emeralds, bullion golds, deep ocean blues, amethyst purples, sunset corals, and slate cobalts).

### 3.3 3-Pass Storefront Detail Bar for Protocol Buildings

Upgrade procedural building generators in `src/ui/board-3d.ts` so every building passes the 3-pass Detail Bar:
1. Category 0: DEX Swap (DX, Size 3, `#39A883`):
   * Pass 1 (Silhouette): Compact dual-level automated teller kiosk with angled roofline.
   * Pass 2 (Assemblies): Transparent glass orderbook canopy and curved service counter.
   * Pass 3 (Story & Props): Rotating parabolic satellite dish and glowing green price ticker.
2. Category 1: Memecoin Lounge (ML, Size 3, `#EEC353`):
   * Pass 1 (Silhouette): Stepped rooftop club pavilion with outdoor terrace.
   * Pass 2 (Assemblies): Neon Shiba doge sign silhouette and fabric marquee awning.
   * Pass 3 (Story & Props): Velvet rope stanchions and cocktail tables on the patio.
3. Category 2: Staking Vault (SV, Size 4, `#B85539`):
   * Pass 1 (Silhouette): Brutalist concrete cube monolith with heavy recessed doorway.
   * Pass 2 (Assemblies): Circular vault door relief with rotating mechanical locking spokes.
   * Pass 3 (Story & Props): Flanking gold bullion pillars and red laser security mesh.
4. Category 3: Lending Protocol (LP, Size 4, `#A16586`):
   * Pass 1 (Silhouette): Classical banking hall with stepped plinth and pediment gable.
   * Pass 2 (Assemblies): Four fluted marble columns supporting a triangular entablature.
   * Pass 3 (Story & Props): Brass balance scales relief and central glass skylight.
5. Category 4: Derivatives Exchange (DE, Size 5, `#587C9A`):
   * Pass 1 (Silhouette): 3-tier skyscraper tower with tiered setbacks.
   * Pass 2 (Assemblies): Glass curtain wall facade and open rooftop mezzanine.
   * Pass 3 (Story & Props): Central comms mast, microwave dishes, and holographic candlestick antenna.
6. Category 5: Validator Citadel / Stock Token Bridge (VC/SB, Size 6, `#648454`):
   * Pass 1 (Silhouette): Heavy perimeter fortress bastion with corner towers and skyway bridge.
   * Pass 2 (Assemblies): Server rack ventilation louvers and central consensus tower.
   * Pass 3 (Story & Props): Glowing emerald validator beacon casting a vertical ray of light into the sky.

### 3.4 Deterministic QA Hook (`window.__diorama`)

Expose the standardized testing interface on `window`:
```typescript
window.__diorama = {
  freeze: (t: number) => { /* freeze scene at timestamp t */ },
  getState: () => ({ /* return camera position, active lots, and render stats */ }),
  renderAt: (t: number) => { /* step animation clock to t and render single frame */ }
};
window.__dioramaReady = true;
```
This enables headless testing scripts and Playwright runners to capture frame-accurate screenshot regression tests without race conditions.

---

## 4. SolaceUI Exposure-Grid WebGL2 Background Shader (Milestone D3)

### 4.1 Shader Architecture and Uniform Specifications

Create `src/ui/exposure-grid.ts` porting the SolaceUI exposure-grid shader into a single-pass WebGL2 shader or integrated Three.js background plane.

GLSL Uniform Interface:
* `u_resolution`: `vec2` viewport dimensions in device pixels.
* `u_time`: `float` continuous animation time in seconds.
* `u_columns`: `float` grid column count (default: 4.0).
* `u_rows`: `float` grid row count (default: 4.0).
* `u_lineWidth`: `float` grid divider line thickness (default: 2.5px).
* `u_lineOpacity`: `float` grid divider line opacity (default: 0.4).
* `u_tempo`: `float` motion pulse speed (default: 0.96).
* `u_activity`: `float` dynamic cell activity rate (default: 0.40).
* `u_intensity`: `float` brightness modulation (default: 0.78).
* `u_zoom`: `float` camera focal zoom scale (default: 0.68).
* `u_grain`: `float` analog film grain intensity (default: 0.68).
* `u_treatment`: `int` color treatment mode (0: photographic ink, 1: exposure ramp, 2: monochrome).
* `u_pointer`: `vec2` normalized pointer coordinates [0.0, 1.0].
* `u_pointerStrength`: `float` pointer repulsion and glow radius (default: 0.85).

Color Uniforms (Robinhood Financial Palette):
* `u_grid`: `vec3` `#162130` (subtle midnight grid line).
* `u_accent`: `vec3` `#00C805` (Robinhood electric emerald).
* `u_secondary`: `vec3` `#EEC353` (bullion gold).
* `u_ink`: `vec3` `#080c14` (deep dark background).
* `u_paper`: `vec3` `#0d131f` (rich dark card surface).

### 4.2 Single WebGL Context vs Dual Canvas Layering

To prevent WebGL context loss on mobile browsers, the primary integration renders the exposure-grid as a background mesh within the existing Three.js scene:
1. Background Mesh: An orthographic plane positioned behind the city plinth (`z = -500`) textured with the exposure-grid shader material.
2. Fallback Mode: If running in 2D mode, instantiate a standalone background `<canvas id="exposure-grid-canvas">` layered behind `#game-board-canvas`.
3. Event Handlers: Attach listeners for `webglcontextlost` and `webglcontextrestored` to gracefully recompile shaders and restore render buffers after system sleep.

---

## 5. Apple Carousel Property Navigation System (Milestone D4)

### 5.1 Vanilla TypeScript Infinite Looping Architecture

Create `src/ui/apple-carousel.ts` providing an infinite autoplay card carousel without React dependencies.

Core Architectural Mechanics:
1. Clone Padding: Prepend 4 cloned cards to the beginning and append 4 cloned cards to the end of the item list (`CLONE_COUNT = 4`). To reliably support small item counts (such as 4 cards or fewer during late-epoch property drafting), generate each cloned card via modulo indexing `items[((index % items.length) + items.length) % items.length]` rather than naive array slicing. This guarantees symmetrical 4-card leading and trailing buffers even when `items.length <= 4`.
2. Seamless Wrap: Monitor container scroll offset. When the scroll reaches the outer cloned boundaries, reset `scrollLeft` to the matching real card index without animation, creating the illusion of infinite content.
3. Motion Spring Dynamics: Animate transitions using spring physics (`damping: 28`, `stiffness: 180`, `mass: 1.0`).
4. Autoplay Progress Bar: Drive the turn progress bar using the Web Animations API on the compositor thread (`KeyframeEffect` scaling `transform: scaleX(0)` to `scaleX(1)`), pausing immediately on user hover or pointer down.
5. Accessibility: Emit full ARIA semantics (`role="region"`, `role="tablist"`, `role="tabpanel"`) and support keyboard arrow navigation (`ArrowLeft`, `ArrowRight`, `Home`, `End`).

### 5.2 HUD Integration for Property Drafting and Protocol Modules

The Apple Carousel integrates into two primary game phases:
1. Phase 1 (Receive): Displays candidate property deed cards dealt in `state.pending`.
   * Hovering or scrolling to a deed card invokes `ThreeBoardRenderer.focusLot(lotId)`, causing the 3D camera to smoothly pan and highlight the matching city parcel.
   * Clicking a card toggles its selection status for the drafting action.
2. Phase 3 (Build): Displays available protocol shop categories (Sizes 3 through 6).
   * Displays protocol name, target size, quota, payout table, and player inventory count.
   * Selecting a category highlights all valid vacant parcels on the 3D board.

---

## 6. iPod Classic Controller Component and Input Mapping (Milestone D5)

### 6.1 Mechanical Click Wheel Gesture Engine

Create `src/ui/ipod-controller.ts` replicating the tactile interface of the Apple iPod Classic click wheel.

Gesture Math and Tracking:
1. Pointer Capture: On `pointerdown`, call `element.setPointerCapture(event.pointerId)` so rotational movement outside the wheel perimeter continues tracking without losing events.
2. Angular Calculation: On each `pointermove`, compute the current angle relative to the wheel center:
   ```typescript
   const dx = event.clientX - wheelCenterX;
   const dy = event.clientY - wheelCenterY;
   const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
   ```
3. Angular Delta: Compute signed delta from previous angle (`-180` to `+180` degrees).
4. Jitter Dead Zone: Ignore direction reversals of less than 8 degrees (`REVERSE_THRESHOLD_DEGREES = 8`) to eliminate finger tremor.
5. Angular Velocity Acceleration: Measure rotational speed in degrees per second. When the user spins the wheel rapidly, accelerate values exponentially (useful for adjusting large $wif cash amounts in trades).

### 6.2 Button Mapping and Action Triggers

The physical buttons map to robin-town game controls:
* Wheel Rotation:
  * In Phase 2 (Trade): Clockwise spinning increases $wif cash offer; counter-clockwise decreases offer.
  * In Phase 1 (Receive): Wheel spinning cycles through candidate property deeds.
* Center Select Button:
  * Confirms deed selection in Phase 1.
  * Submits or accepts trade offer in Phase 2.
  * Deploys selected protocol tile in Phase 3.
  * Confirms income harvest in Phase 4.
* Top MENU Button:
  * Cancels active selection, closes open modal dialogs, or navigates back one level.
* Left PREV (`<<`) and Right NEXT (`>>`) Buttons:
  * Cycles through AI bot counterparties (Sherwood, Apex, Luna) on the trade desk.
* Bottom PLAY/PAUSE (`>||`) Button:
  * Toggles audio mute or pauses the Apple Carousel autoplay timer.

---

## 7. Audio Pipeline Expansion, Instanced Rendering, and QA (Milestone D6)

### 7.1 Procedural Audio Synthesizer Expansion

Expand `src/ui/audio.ts` with new procedural sound cues using Web Audio API nodes:
1. `playClickWheelTick()`: Generates an ultra-short mechanical impulse at 2,200Hz using a bandpass filter (`Q: 8.0`) and exponential gain decay (6ms duration) on every 15 degrees of wheel rotation.
2. `playCoinFlip()`: Frequency-modulated sine wave ping (1,480Hz base modulated by 180Hz) creating a metallic coin ring when $wif cash is adjusted.
3. `playNegotiationTick()`: Urgency metronome pulse (740Hz sine wave) accelerating in frequency as the negotiation phase timer approaches zero.

### 7.2 Instanced Parcel Rendering Optimization

Currently, `ThreeBoardRenderer` creates 72 individual `THREE.Mesh` objects with 72 distinct `THREE.MeshStandardMaterial` instances.
Optimization:
1. Refactor parcel rendering into a single `THREE.InstancedMesh(sharedBoxGeometry, sharedStandardMaterial, 72)`.
2. Encode parcel world positions and elevations into instance transform matrices via `setMatrixAt(index, matrix)`.
3. Encode parcel ownership colors and selection highlights into an instance color buffer via `setColorAt(index, color)`.
4. Result: Parcel draw calls drop from 72 down to 1, guaranteeing stable 60 FPS performance across desktop and mobile devices.

---

## 8. Milestone Execution Plan (D1 through D6)

```
+---------------------------------------------------------------------------------------------------+
|                            MILESTONE DELIVERY SEQUENCE: 3D UI/UX                                  |
+---------------------------------------------------------------------------------------------------+
| D1: 3D Board Hardening, Coordinate Alignment & App Shell Integration                              |
| D2: Diorama Look Contract, 64-Color Palette Snap & PixelPost Shaders                              |
| D3: SolaceUI Exposure-Grid WebGL2 Background Shader Pass                                         |
| D4: Apple Carousel Infinite Autoplay Property Navigation Integration                             |
| D5: iPod Classic Controller Component & Tactile Input Mapping                                    |
| D6: Audio Expansion, Instanced Mesh Optimization & Visual QA                                      |
+---------------------------------------------------------------------------------------------------+
```

### Milestone D1: 3D Board Hardening and App Shell Integration
* Scope: Fix coordinate alignment between `canvasToWorld` and `getParcelWorldPosition`, implement top-plane horizontal raycasting, add finite coordinate guards, resolve camera lerp transitions, and wire `ThreeBoardRenderer` into `src/app.ts`.
* Target Files: `src/ui/board-3d.ts`, `src/app.ts`, `scripts/stress-board-3d.ts`.
* Deliverables:
  1. Coordinate alignment resolving lot 71 hit failure.
  2. Raycast top-face filtering resolving street gap false positives.
  3. Finite number guards on `raycastAt`.
  4. Camera mode transition completion finalizer.
  5. 25 out of 25 passing tests in `scripts/stress-board-3d.ts`.
  6. `ThreeBoardRenderer` mounted by default in `RobinTownApp` with 2D fallback.
* Automated Verification: `npx tsx scripts/stress-board-3d.ts && npm run typecheck`

### Milestone D2: Diorama Look Contract and PixelPost Shaders
* Scope: Integrate `PixelPost` post-processing shader evaluating 64-color palette quantization, 8x8 Bayer dithering, warm near-black inked contours, contact shadows, and the `window.__diorama` QA test hook.
* Target Files: `src/ui/post-processing.ts` (new), `src/ui/board-3d.ts`, `src/app.ts`.
* Deliverables:
  1. `PixelPost` full-screen shader pass class.
  2. 64-color palette snap mapping.
  3. 8x8 ordered Bayer dither ramp.
  4. Luminance edge ink detection.
  5. Soft contact shadow discs under buildings.
  6. `window.__diorama` test hook with `freeze`, `getState`, and `renderAt`.
* Automated Verification: `npm run typecheck && node --import tsx --test tests/unit/board-3d.test.ts`

### Milestone D3: SolaceUI Exposure-Grid Background Shader
* Scope: Create `src/ui/exposure-grid.ts` porting the SolaceUI WebGL2 shader to vanilla TypeScript, configured with the Robinhood financial color palette and pointer interaction.
* Target Files: `src/ui/exposure-grid.ts` (new), `src/ui/board-3d.ts`, `src/styles/index.css`.
* Deliverables:
  1. WebGL2 fragment shader (`#version 300 es`) compilation.
  2. Single-context background plane in Three.js with dual-canvas fallback.
  3. Robinhood color palette uniforms (emerald, gold, midnight).
  4. Pointer tracking and smooth lerping.
  5. Context loss and restore event handlers.
* Automated Verification: `npm run typecheck && npm test`

### Milestone D4: Apple Carousel Property Navigation Integration
* Scope: Create `src/ui/apple-carousel.ts` implementing infinite autoplay, spring dynamics, cloned cards, ARIA accessibility, and 3D camera focus on hover.
* Target Files: `src/ui/apple-carousel.ts` (new), `src/ui/hud.ts`, `src/styles/index.css`.
* Deliverables:
  1. Vanilla TypeScript infinite carousel with 4 cloned boundary cards.
  2. Web Animations API turn timer progress bar.
  3. Hover and focus camera panning to matching city parcel.
  4. Phase 1 deed drafting and Phase 3 protocol module drawer integration.
  5. Full keyboard arrow navigation.
* Automated Verification: `npm run typecheck && node --import tsx --test tests/unit/hud.test.ts`

### Milestone D5: iPod Classic Controller Component and Input Mapping
* Scope: Create `src/ui/ipod-controller.ts` providing angular pointer tracking, dead-zone filtering, acceleration, button actions, and procedural haptic ticks.
* Target Files: `src/ui/ipod-controller.ts` (new), `src/app.ts`, `src/styles/index.css`.
* Deliverables:
  1. Angular pointer tracking using `Math.atan2` with pointer capture.
  2. 8-degree jitter dead-zone filter and angular velocity acceleration.
  3. Action mapping for Wheel, Select, Menu, Prev, Next, and Play buttons.
  4. Haptic audio tick triggered on 15-degree rotation increments.
* Automated Verification: `npm run typecheck && npm test`

### Milestone D6: Audio Expansion, Instanced Mesh Optimization, and Visual QA
* Scope: Expand procedural audio synthesizer, optimize parcel meshes into `THREE.InstancedMesh`, validate 60 FPS performance, and run automated visual regression suite.
* Target Files: `src/ui/audio.ts`, `src/ui/board-3d.ts`, `tests/e2e/diorama-visual.test.ts` (new).
* Deliverables:
  1. Click wheel tick, coin flip ping, and negotiation timer sound cues.
  2. 72-parcel `THREE.InstancedMesh` with instance color and transform buffers.
  3. Draw call reduction from 72+ to under 20 per frame.
  4. Automated visual QA test verifying zero missing assets and zero context loss.
* Automated Verification: `npm run verify:assets && npm test && npm run build`

---

## 9. Tung Lee Checklist Mapping: 3D UI/UX Subsystem

All action items from `docs/TUNG_LEE_CHECKLIST.md` pertaining to diorama presentation and UI/UX are mapped directly to concrete deliverables:

| Checklist Item | Description | Target Milestone | Deliverable File | Verification Method |
|---|---|---|---|---|
| Item 46 to 48 | Locked Three-Quarter Isometric Slab Presentation | Milestone D1 | `src/ui/board-3d.ts` | Camera angle and stress test |
| Item 49 to 50 | 64-Color Palette Snap, Bayer Dither & Inked Contours | Milestone D2 | `src/ui/post-processing.ts` | Shader compilation and visual test |
| Item 51 to 58 | 3-Pass Detail Bar for All 6 Protocol Storefronts | Milestone D2 | `src/ui/board-3d.ts` | Mesh hierarchy validation |
| Item 59 to 61 | Contact Shadows & Ambient Animations | Milestone D2 | `src/ui/board-3d.ts` | Shadow mesh and clock test |
| Item 62 to 64 | Deterministic `window.__diorama` QA Hook | Milestone D2 | `src/app.ts`, `src/ui/board-3d.ts` | Playwright and Node inspection |
| Item 111 to 114 | Top Bar & 4-Player Status Ribbon Clarity | Milestone D4 | `src/ui/hud.ts` | HUD unit test in `hud.test.ts` |
| Item 115 to 116 | Two-Sided OTC Liquidity Desk UX | Milestone D5 | `src/ui/trade-desk.ts` | Trade desk controller test |
| Item 117 to 118 | Bottom Dock: Deed Drafting Tray & Module Rack | Milestone D4 | `src/ui/apple-carousel.ts` | Carousel interaction test |
| Item 119 to 123 | Viewport Responsiveness & Adversarial Stress | Milestone D6 | `src/styles/index.css` | Viewport stress test |

---

## 10. Automated Verification Suite Specifications

Automated CLI commands verify the 3D diorama and UI/UX implementation without manual steps:

1. 3D Board Empirical Stress Verification:
```bash
npx tsx scripts/stress-board-3d.ts
```
Executes 25 empirical stress tests verifying parcel raycasting, street gaps, NaN guards, and camera lerp stability, requiring 25 out of 25 passing tests.

2. Visual Asset Pipeline Integrity Verification:
```bash
npm run verify:assets
```
Confirms all 65 graphic sprites, 12 shop icons, 4 avatars, board textures, and audio cues exist with valid PNG signatures and zero 404 errors.

3. Strict TypeScript Compilation Verification:
```bash
npm run typecheck
```
Confirms 0 TypeScript errors across all 3D renderer, post-processing, carousel, and controller files.

4. Production Bundle Build Verification:
```bash
npm run build
```
Confirms successful compilation and bundling into `dist/` with zero asset or shader bundling errors.
