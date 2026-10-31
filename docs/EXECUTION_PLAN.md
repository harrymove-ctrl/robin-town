# Robin-Town: Comprehensive Execution Plan

## 1. Executive Summary and System Architecture

### 1.1 Project Mission and Vision
Robin-Town adapts the classic Chinatown negotiation board game (Karsten Hartwig, 1999) and its digital counterpart saigon-town into an interactive 3D Web3 trading strategy web game built for the Robinhood Chain Hackathon ($10,000 USDG prize to single winner).

The project merges retro-cyberpunk pixel art diorama presentation with financial district trading mechanics and a recurring $wif economic flywheel. Players negotiate OTC asset swaps, draft city parcels, deploy protocol modules, and collect yield across 6 sequential market epochs, competing against three distinctive AI bot personas (Sherwood, Apex, and Luna) or networked participants.

### 1.2 Global Subsystem Architecture Diagram

The system comprises six modular, decoupled subsystems with clean architectural boundaries:

```
+---------------------------------------------------------------------------------------------------+
|                                     ROBIN-TOWN MASTER ARCHITECTURE                                |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  |                            3D UI/UX DIORAMA PRESENTATION LAYER                              |  |
|  |                                                                                             |  |
|  |   [SolaceUI WebGL2 Exposure-Grid Shader Background Pass]                                    |  |
|  |         |                                                                                   |  |
|  |         v                                                                                   |  |
|  |   [Three.js Interactive Diorama Scene: fov 20.5, az 45, elev 33]                            |  |
|  |     * 6 Extruded District Slabs with Bevelled Neon Curbs                                    |  |
|  |     * 72 Instanced Parcel Meshes (Draw Calls Reduced from 72 to 1)                          |  |
|  |     * 6 Procedural Protocol Storefronts Passing 3-Pass Detail Bar                           |  |
|  |     * Golden Completion Halos, Pulsing Light Beacons & Soft Contact Shadows                 |  |
|  |         |                                                                                   |  |
|  |         v                                                                                   |  |
|  |   [PixelPost Full-Screen Pass: 64-Color Palette Snap + 8x8 Bayer Dither + Inked Contours]   |  |
|  +---------------------------------------------------------------------------------------------+  |
|        |                                                  |                                       |
|        v                                                  v                                       |
|  +-----------------------------------+  +------------------------------------------------------+  |
|  | Apple Carousel: Property Browser  |  | iPod Classic: Tactile Gamepad Controller             |  |
|  | * Infinite Autoplay Card Gallery  |  | * Angular Pointer Tracking (Math.atan2)              |  |
|  | * 3D Camera Focus on Lot Hover    |  | * 8-Degree Reverse Dead Zone & Velocity Acceleration |  |
|  | * Progress Bar & Tab Semantics    |  | * Wheel, Select, Menu, Prev, Next, Play Buttons      |  |
|  +-----------------------------------+  +------------------------------------------------------+  |
|                                |                                  |                               |
|                                +-----------------+----------------+                               |
|                                                  |                                                |
|                                                  v                                                |
|  +---------------------------------------------------------------------------------------------+  |
|  |                              HUD Ribbon & Two-Sided OTC Trade Desk                          |  |
|  |  * Liquid $wif Balances  * Annual Yield  * Bot Acceptance Meter  * Staking Multiplier Badges |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                  |                                                |
|                                                  v                                                |
|  +---------------------------------------------------------------------------------------------+  |
|  |                          Deterministic Core Game Engine & Action Reducer                    |  |
|  |                   gameReducer(state: GameState, action: GameAction): GameState              |  |
|  |  * 72-Parcel Geometry across 6 Financial Districts (Orthogonal Adjacency Graph: 93 Edges)   |  |
|  |  * 120-Tile Pool (20 per Category 0..5, Conserved: Bag + Player Hands + Placed Board Shops)|  |
|  |  * 6-Epoch Turn Lifecycle: receive -> trade -> build -> income -> ended                     |  |
|  |  * Strict Capacity Validation (canBuildShop Parity in canPlace & buildTile)                 |  |
|  |  * Cluster Completeness Recalculation on Occupied Parcel Trades                            |  |
|  |  * Proactive AI Bot Trade Offer Engine (Sherwood: 1.04, Apex: 1.09, Luna: 1.01)            |  |
|  +---------------------------------------------------------------------------------------------+  |
|                   |                                                           |                   |
|                   v                                                           v                   |
|  +-----------------------------------+             +-------------------------------------------+  |
|  |     Tokenomics Engine ($wif)      |             |         Multiplayer Relay & Network       |  |
|  | * 4,000 $wif Match Pool Accounting|             | * Authoritative Host Pattern (stateSeq)   |  |
|  | * 5% Permanent Burn to 0x...dEaD  |             | * 6-Character Unambiguous Room Codes      |  |
|  | * 5% Community Staking Vault Pool |             | * Deterministic AI Bot Autofill           |  |
|  | * 90% Podium Purse (Winner Dust)  |             | * Resilient Host Migration (3,000ms Ping) |  |
|  | * 3% Casual Point Swap Burn Tax   |             | * Targeted SYNC_REQUEST Resync Handler    |  |
|  | * 1% Trade Micro-Tax (50/50 Split)|             | * Pluggable WebSocket & Broadcast Relays  |  |
|  | * Continuous Staking up to 50k    |             +-------------------------------------------+  |
|  | * Round Prediction Wager Markets  |                                   |                       |
|  +-----------------------------------+                                   |                       |
|                   |                                                       |                       |
|                   +---------------------------+---------------------------+                       |
|                                               |                                                   |
|                                               v                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  |                            Dual-Mode Wallet Connectivity Layer                              |  |
|  |  Mode 1: Simulation (4 Pre-Funded Wallets, 10,000 $wif Each, LocalStorage Persistence)      |  |
|  |  Mode 2: Web3 EIP-1193 Provider (Robinhood Chain Testnet 46631, ERC-20 Call Selectors)      |  |
|  |  Mode 3: Resilient Auto-Fallback on Provider Absence or User Rejection                      |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                               |                                                   |
|                                               v                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  |                       Five-Tier Automated Verification Suite Hierarchy                      |  |
|  |  Tier 1: Feature Coverage (60)  |  Tier 2: Boundary Tests (60)  |  Tier 3: Pairwise (12)    |  |
|  |  Tier 4: Workload Scenarios (6) |  Tier 5: Adversarial Stress (19) + Latency Simulator      |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

### 1.3 Subsystem Directory Mapping and Component Ownership

The project repository organizes components into designated directories:
* Master Execution Plan: `docs/EXECUTION_PLAN.md`
* Core Game Engine Plan: `docs/plans/GAME_ENGINE_EXECUTION_PLAN.md`
* 3D UI/UX Diorama Plan: `docs/plans/3D_UI_UX_EXECUTION_PLAN.md`
* Tokenomics and Networking Plan: `docs/plans/TOKENOMICS_MULTIPLAYER_EXECUTION_PLAN.md`
* Core Game Engine Source: `src/engine/` (`types.ts`, `board-layout.ts`, `engine.ts`, `bot.ts`)
* Tokenomics and Wallet Source: `src/tokenomics/` (`flywheel.ts`, `wallet.ts`, `wagering.ts`)
* Networking Source: `src/network/` (`room.ts`)
* 3D and 2D UI Presentation Source: `src/ui/` (`board-3d.ts`, `post-processing.ts`, `exposure-grid.ts`, `apple-carousel.ts`, `ipod-controller.ts`, `board.ts`, `camera.ts`, `hud.ts`, `trade-desk.ts`, `audio.ts`)
* App Orchestrator: `src/app.ts` and `src/main.ts`
* Asset Pipelines and Slicers: `scripts/` (`generate-assets.ts`, `verify-assets.ts`, `stress-board-3d.ts`)
* Automated Verification Test Suites: `tests/` (`unit/`, `e2e/`)

### 1.4 Five-Stage Implementation Roadmap

The delivery sequence coordinates all project subsystems across five core milestones:
* Milestone 1: Planning, Architecture, and Thematic Mapping. Complete master execution plan, subsystem execution plans, and architectural specifications.
* Milestone 2: Pixel Art Asset Pipeline and Binary Verification. Programmatic sprite generation, 32x32 and 96x96 assets, board textures, avatars, and zero-404 asset integrity.
* Milestone 3: Core Game Engine and AI Bot Negotiation Systems. Pure deterministic rules engine, 72-parcel board geometry, 6 protocol shops, non-linear payout curves, and 3 AI bot trader personalities.
* Milestone 4: $wif Tokenomics Flywheel, Dual-Mode Wallet, and Multiplayer Networking. Deflationary burns, casual point swaps, continuous staking vault, ERC-20 integration on Robinhood Chain, and room session relay.
* Milestone 5: Web Game Application Shell, 3D Diorama UI/UX, and End-to-End Verification. Three.js interactive board, SolaceUI exposure-grid shader, Apple Carousel property browser, iPod classic controller, and 5-tier test suite.

---

## 2. Master Delivery Sequencing and Milestone Roadmap

Delivery is organized across 4 coordinated milestone tracks:

```
+---------------------------------------------------------------------------------------------------+
|                                  MASTER DELIVERY SEQUENCING                                       |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  Track A: Core Game Engine & Rules Adaptation                                                     |
|  +---------------------------------------------------------------------------------------------+  |
|  | [M-ENG-1: Capacity Validation] -> [M-ENG-2: Cluster Recalc] -> [M-ENG-3: Proactive Bot Trade] |  |
|  |                                                 |                                           |  |
|  |                                                 v                                           |  |
|  |                  [M-ENG-4: Pure Reducer] -> [M-ENG-5: Stock Token Bridge]                   |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                                                                   |
|  Track B: 3D UI/UX Overhaul & Diorama Presentation                                                |
|  +---------------------------------------------------------------------------------------------+  |
|  | [D1: 3D Board Hardening] -> [D2: Diorama Shaders] -> [D3: SolaceUI Exposure Grid]          |  |
|  |                                      |                                                      |  |
|  |                                      v                                                      |  |
|  | [D4: Apple Carousel] ----> [D5: iPod Classic Controller] ----> [D6: Audio & Visual QA]       |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                                                                   |
|  Track C: Tokenomics Flywheel, Wallet & Multiplayer State Sync                                    |
|  +---------------------------------------------------------------------------------------------+  |
|  | [M4-A: Flywheel & Wagering] -> [M4-B: Dual-Mode Wallet ERC-20] -> [M4-C: Multiplayer Relay]  |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                                                                   |
|  Track D: Unified Verification & Hardening Gate                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  | [M6: 5-Tier Verification Suite, Synthetic Latency Testing & Production Build Gate]           |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

### 2.1 Track A: Core Game Engine and Rules Adaptation
* Detailed Specification: [`docs/plans/GAME_ENGINE_EXECUTION_PLAN.md`](./plans/GAME_ENGINE_EXECUTION_PLAN.md)
* Milestones:
  1. Milestone M-ENG-1: Invariant Hardening and Building Capacity Enforcement. Harmonize `canPlace` in `src/engine/engine.ts` with `src/engine/board-layout.ts:canBuildShop`, strictly rejecting illegal cluster mergers and expansions of completed businesses.
  2. Milestone M-ENG-2: Cluster Recalculation on Built Parcel Exchange. Re-evaluate `lot.isComplete` flags for both parties immediately after an occupied parcel is traded on the OTC desk.
  3. Milestone M-ENG-3: Proactive AI Bot Trade Offer Engine. Surface 1 to 2 proactive incoming trade proposals in `state.incomingOffers` during the trade phase using `generateBotTradeOffer`.
  4. Milestone M-ENG-4: Canonical Pure Reducer Architecture. Export `gameReducer(state, action)` from `src/engine/engine.ts` and delegate action transitions in `src/network/room.ts`.
  5. Milestone M-ENG-5: Category 5 Thematic Alignment and Rules Reference Modal. Update Category 5 title to `Stock Token Bridge (Validator Citadel)` and add an in-game rules and payout table modal.

### 2.2 Track B: 3D UI/UX Overhaul and Diorama Presentation
* Detailed Specification: [`docs/plans/3D_UI_UX_EXECUTION_PLAN.md`](./plans/3D_UI_UX_EXECUTION_PLAN.md)
* Milestones:
  1. Milestone D1: 3D Board Hardening and App Shell Integration. Align parcel origin coordinates (`BOARD_ORIGIN_X = 550`, `BOARD_ORIGIN_Z = 365`), enforce top-plane horizontal raycasting, add finite coordinate guards, finalize camera lerp transitions, and mount `ThreeBoardRenderer` into `src/app.ts` with 2D fallback.
  2. Milestone D2: Diorama Look Contract and PixelPost Shaders. Implement `PixelPost` full-screen shader pass evaluating 64-color palette quantization, 8x8 ordered Bayer dithering, warm near-black inked contours, contact shadows, and the `window.__diorama` QA hook.
  3. Milestone D3: SolaceUI Exposure-Grid WebGL2 Background Shader. Port the `#version 300 es` WebGL2 exposure-grid shader into a shared Three.js background pass with the Robinhood financial palette and pointer tracking.
  4. Milestone D4: Apple Carousel Property Navigation Integration. Implement vanilla TypeScript infinite carousel with 4 cloned cards, Web Animations API progress bar, and 3D camera focusing on lot hover.
  5. Milestone D5: iPod Classic Controller Component and Input Mapping. Implement angular pointer tracking (`Math.atan2`), 8-degree jitter dead-zone filter, and action triggers for Wheel, Select, Menu, Prev, Next, and Play.
  6. Milestone D6: Audio Pipeline Expansion, Instanced Rendering, and Visual QA. Expand procedural audio with click wheel ticks, coin flip rings, and negotiation metronomes, refactor 72 parcel meshes into a single `THREE.InstancedMesh`, and run visual regression testing.

### 2.3 Track C: $wif Tokenomics Flywheel, Dual-Mode Wallet, and Multiplayer
* Detailed Specification: [`docs/plans/TOKENOMICS_MULTIPLAYER_EXECUTION_PLAN.md`](./plans/TOKENOMICS_MULTIPLAYER_EXECUTION_PLAN.md)
* Milestones:
  1. Milestone M4-A: Tokenomics Math Polish, Continuous Staking, and Wagering. Update `calculateTradeTax` to split 50% to burn and 50% to staking vault, implement continuous staking curve up to 50,000 $wif, and introduce round prediction markets (`src/tokenomics/wagering.ts`) with 5% burn sinks.
  2. Milestone M4-B: Dual-Mode Wallet ERC-20 Encoding and Persistence Upgrade. Add ERC-20 ABI method encoders (`balanceOf`, `transfer`, `approve`, `burn`), add browser local storage persistence for simulation mode, and support EIP-6963 multi-wallet discovery on Robinhood Chain Testnet (Chain ID 46631).
  3. Milestone M4-C: Multiplayer Room SYNC_REQUEST Handler and WebSocket Relay. Implement `case 'SYNC_REQUEST':` in `src/network/room.ts`, add optimistic action queuing with visual rollback toast feedback in `src/app.ts`, and create pluggable `WebSocketTransport`.

### 2.4 Track D: Comprehensive Verification and Hardening
* Milestones:
  1. Milestone M6: Automated Verification Hardening and Visual QA. Augment the 5-tier test pyramid with synthetic network latency testing (`LaggyMemoryTransport`), verify prediction and wagering math, and run the single-command validation suite (`npm run typecheck && npm test && npm run build`).

---

## 3. Cross-Subsystem Dependency Graph

The table below catalogs dependencies across subsystems to ensure synchronized delivery:

| Subsystem Component | Pre-requisite Components | Blocks Downstream Components | Critical Interface Contract |
|---|---|---|---|
| M-ENG-1 (Capacity Hardening) | Core engine schemas in `types.ts` | M-ENG-2, M-ENG-3, M-ENG-4 | `canBuildShop(lots, lotId, player, shop, tiles)` |
| M-ENG-2 (Trade Recalculation) | M-ENG-1 capacity validation | M-ENG-4 pure reducer | `executeTrade(state, offer)` updating `isComplete` |
| M-ENG-3 (Proactive Bot Offers) | M-ENG-2 trade recalculation | M-ENG-4, D4 carousel, D5 iPod | `generateBotTradeOffer(botId, targetId, state)` |
| M-ENG-4 (Pure Reducer) | M-ENG-1, M-ENG-2, M-ENG-3 | M4-C multiplayer room sync | `gameReducer(state, action): GameState` |
| D1 (3D Board Hardening) | Canvas coordinate constants | D2 diorama shaders, D4 carousel | `ThreeBoardRenderer.raycastAt(ndcX, ndcY)` |
| D2 (Diorama Look Contract) | D1 3D board scene graph | D3 background pass, D6 QA | `PixelPost.render(renderer, scene, camera)` |
| D3 (SolaceUI Exposure Grid) | D2 Three.js render target | D6 visual QA | `ExposureGridBackground.render(uniforms)` |
| D4 (Apple Carousel) | D1 camera focus API | D5 iPod controller mapping | `ThreeBoardRenderer.focusLot(lotId)` |
| D5 (iPod Controller) | M-ENG-3 trade desk actions | D6 audio expansion | `bindWheelGesture(element, onDelta, onCommit)` |
| M4-A (Flywheel & Wagering) | Engine types in `types.ts` | M4-B wallet, M6 verification | `calculateTradeTax`, `calculateStakingBoost` |
| M4-B (Wallet ERC-20) | M4-A tokenomics math | M4-C room transactions | `WalletAdapter.executeContractCall(method, args)` |
| M4-C (Multiplayer Sync) | M-ENG-4 pure reducer, M4-B | M6 verification | `handleIncomingPacket(packet)` for `SYNC_REQUEST` |
| M6 (Verification & Build) | M-ENG-5, D6, M4-C | Production deployment | `npm run typecheck && npm test && npm run build` |

---

## 4. Tung Lee Checklist Master Mapping Matrix

Every action item in `docs/TUNG_LEE_CHECKLIST.md` is mapped to an execution milestone and verification method:

| Checklist Section | Action Item Description | Milestone | Deliverable File | Automated Verification Command |
|---|---|---|---|---|
| Section 1: Diorama | Three-Quarter Isometric Slab Presentation | D1 | `src/ui/board-3d.ts` | `npx tsx scripts/stress-board-3d.ts` |
| Section 1: Diorama | 64-Color Palette Snap & Bayer Dither | D2 | `src/ui/post-processing.ts` | `node --import tsx --test tests/unit/board-3d.test.ts` |
| Section 1: Diorama | 3-Pass Detail Bar for 6 Protocol Shops | D2 | `src/ui/board-3d.ts` | `npm run verify:assets` |
| Section 1: Diorama | Contact Shadows & Ambient Animations | D2 | `src/ui/board-3d.ts` | Frame screenshot verification |
| Section 1: Diorama | Deterministic `window.__diorama` QA Hook | D2 | `src/app.ts` | Headless evaluation in Node |
| Section 2: Gameplay | 6-Epoch Phase Transitions & Visual Beats | M-ENG-3 | `src/app.ts`, `src/ui/hud.ts` | Tier 1 test F5-3 |
| Section 2: Gameplay | Proactive AI Bot Trade Proposals | M-ENG-3 | `src/engine/bot.ts` | `node --import tsx --test tests/unit/bot.test.ts` |
| Section 2: Gameplay | Rules Reference Modal & Payout Table | M-ENG-5 | `src/ui/hud.ts` | DOM component inspection |
| Section 2: Gameplay | Multiplayer Room Lobby & Sync UX | M4-C | `src/network/room.ts` | `node --import tsx --test tests/unit/network.test.ts` |
| Section 3: Rules & Math | 72-Parcel Drafting Schedule (Keep [5,4,3,2,2,2]) | M-ENG-1 | `src/engine/engine.ts` | Tier 1 test F5-2, Tier 5 seed fuzzing |
| Section 3: Rules & Math | 120-Tile Pool Conservation (20 per Shop) | M-ENG-1 | `src/engine/engine.ts` | Invariant test in `engine.test.ts` |
| Section 3: Rules & Math | Strict Orthogonal Adjacency (93 Edges) | M-ENG-1 | `src/engine/board-layout.ts` | `node --import tsx --test tests/unit/board-layout.test.ts` |
| Section 3: Rules & Math | Bilateral OTC Trading & 1% Micro-Tax | M4-A | `src/tokenomics/flywheel.ts` | `node --import tsx --test tests/unit/tokenomics.test.ts` |
| Section 4: UI/UX | Top Bar & 4-Player Status Ribbon Clarity | D4 | `src/ui/hud.ts` | HUD unit test in `hud.test.ts` |
| Section 4: UI/UX | Two-Sided OTC Trade Desk UX & Meters | D5 | `src/ui/trade-desk.ts` | Headless trade desk test |
| Section 4: UI/UX | Bottom Dock: Deed Drawer & Module Rack | D4 | `src/ui/apple-carousel.ts` | Carousel unit test |
| Section 4: UI/UX | Viewport Responsiveness & Keyboard Shortcuts | D6 | `src/styles/index.css` | Viewport stress harness |
| Section 5: Tokenomics | Final Settlement Modal & 4 Flywheel Sinks | M4-A | `src/tokenomics/flywheel.ts` | Tier 1 test F7-1, Tier 5 accumulation |
| Section 5: Tokenomics | Dual-Mode Wallet on Robinhood Chain 46631 | M4-B | `src/tokenomics/wallet.ts` | `node --import tsx --test tests/unit/wallet.test.ts` |
| Section 5: Tokenomics | Quality Gate Before Every Merge | M6 | `package.json` | `npm run typecheck && npm test && npm run build` |

---

## 5. Competition Criteria Mapping: Robinhood Chain Hackathon

Specifications from `docs/COMPETITION.md` are mapped directly to implementation deliverables:

| Hackathon Criterion | Thematic & Technical Implementation | Supporting Milestone |
|---|---|---|
| Winner Takes All ($10,000 USDG) | Production-grade software architecture, deterministic game engine, zero 404 assets, and full automated test coverage | M-ENG-1 through M6 |
| $wif Token Utility & Flywheel | $wif serves as the in-game currency across match buy-in pools, bilateral OTC trading desks, point redemption swaps, and round prediction wagers | M4-A |
| Permanent Deflationary Burns | 5% competitive match pool burn, 3% casual point swap burn, 50% trade micro-tax burn, and 5% prediction pool burn permanently routed to `0x000...dEaD` | M4-A |
| Stock Tokens Submission Track | Dedicated Category 5 protocol storefront named `Stock Token Bridge (Validator Citadel)` (Size 6, Color `#648454`, paying 140 $wif annual yield) | M-ENG-5 |
| Agents & AI Track | Three autonomous negotiation agents (Sherwood, Apex, Luna) evaluating offers, calculating shortfalls, and generating proactive counteroffers | M-ENG-3 |
| Seamless User Onboarding | Dual-mode wallet adapter providing instant off-chain simulation with 4 pre-funded 10,000 $wif accounts, requiring zero browser extension installs | M4-B |

---

## 6. Risk Management and Architectural Safeguards

| Identified Risk | Failure Impact | Architectural Safeguard and Remediation |
|---|---|---|
| WebGL Context Loss on Mobile | Crash or black canvas when switching tabs or backgrounding | Implement single-context Three.js background pass for SolaceUI shader, add `webglcontextlost` event listeners, and maintain 2D canvas fallback |
| Raycasting Misses on Corner Parcels | Inability to select parcel 71 or street gap misclicks | Harmonize coordinate origin offsets (`BOARD_ORIGIN_X = 550`, `BOARD_ORIGIN_Z = 365`) and clamp ray intersections to upward-facing top planes (`normal.y > 0.9`) |
| Multi-Turn Tile Count Drift | Tile counts in bag, racks, and board drift over 6 epochs | Enforce strict invariant assertions (`bag + racks + board === 120`) at every phase transition and reducer action |
| Multi-Tab State Desynchronization | Clients diverge during simultaneous OTC trades | Authoritative host increments monotonic `stateSeq`, validates seat permissions, and dispatches authoritative state diffs with `SYNC_REQUEST` recovery |
| Rounding Remainder Loss in Prize Purses | Fractional token loss during integer purse splits | Allocate all division dust remainder to first-place winner (`purseDust = purseAmount - distributedPurse`), preserving exact currency conservation |

---

## 7. Master Verification and Quality Assurance Gate

The entire system is validated through a unified single-command quality gate executed in `/Volumes/Dev/china-town`:

```bash
npm run verify:assets && npm run typecheck && npm test && npm run build
```

Success Invariants:
1. Zero missing assets across all 65 declared sprites, textures, and audio cues.
2. Zero TypeScript compiler diagnostics under strict mode.
3. 100% green exit code across all 517+ tests in the 5-tier testing pyramid.
4. Clean Vite production bundle compilation into `dist/` with zero warnings.
