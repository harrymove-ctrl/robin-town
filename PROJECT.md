# Project: robin-town

Chinatown negotiation board game adaptation for Robinhood Chain with $wif tokenomics flywheel, 3D interactive diorama UI/UX, and original pixel art assets.

## Architecture

The robin-town application is structured as a high-performance web game with a clean separation of concerns across presentation, deterministic logic, tokenomics, networking, and automated verification:

* 3D UI/UX Diorama Layer: Real-time Three.js scene implementing the `sloemo01/diorama` Look Contract (locked 20.5 fov, 45 azimuth, 33 elevation), SolaceUI WebGL2 exposure-grid shader background pass, 64-color palette quantization with 8x8 Bayer dithering and inked contours (`PixelPost`), Apple Carousel infinite autoplay property navigation, and iPod Classic tactile click wheel controller.
* Core Game Engine: Pure, deterministic TypeScript state machine with zero DOM or network dependencies. Implements 72-parcel board geometry across 6 financial districts, 120-tile pool conservation, 6 protocol shop types, strict Chinatown capacity enforcement (`canBuildShop` parity), cluster recalculation on trades, canonical action reducer (`gameReducer`), and 3 autonomous AI bot trader personas (Sherwood, Apex, Luna).
* Tokenomics Flywheel: Pure mathematical calculation module managing $wif currency accounting, 4,000 $wif competitive match buy-in pools (5% permanent burn to `0x...dEaD`, 5% community staking vault, 90% podium purse with winner dust conservation), casual point-to-token swap with 3% burn tax, 1% OTC trade micro-tax (50% burn, 50% staking vault), continuous staking yield curves up to 50,000 $wif, and round prediction wagering markets.
* Dual-Mode Wallet Adapter: Instant off-chain simulation with 4 pre-funded local accounts (10,000 $wif each) and browser local storage persistence, combined with standard Web3 EIP-1193 provider integration supporting ERC-20 contract calls (`balanceOf`, `transfer`, `approve`, `burn`) on Robinhood Chain Testnet (Chain ID 46631).
* Networking Layer: Authoritative host multiplayer synchronization supporting 6-character room codes, monotonic state sequencing, deterministic AI bot autofill, heartbeat-based host failover, targeted `SYNC_REQUEST` re-synchronization, and pluggable WebSocket transport relays.
* Pixel Art Asset Pipeline: Standalone programmatic sprite generator producing 32x32 native and 96x96 HD pixel sprites for shops, avatars, board terrain, and UI tokens, with Aseprite fallback compatibility and zero-404 asset verification.
* Automated Verification Pyramid: Multi-tier testing hierarchy containing 517 tests across 137 test suites covering unit rules, boundary analysis, pairwise interactions, multi-epoch match simulations, and adversarial stress testing.

```
+---------------------------------------------------------------------------------------------------+
|                                  ROBIN-TOWN SYSTEM ARCHITECTURE                                   |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  |                            3D UI/UX Diorama Presentation Layer                              |  |
|  |   [SolaceUI WebGL2 Exposure-Grid Shader Background Pass]                                    |  |
|  |   [Three.js Interactive Diorama: 72 Instanced Parcels + 6 Extruded District Slabs]          |  |
|  |   [PixelPost Shader Pass: 64-Color Palette Snap + 8x8 Bayer Dither + Inked Edge Contours]   |  |
|  |   [Apple Carousel Infinite Property Browser]  [iPod Classic Tactile Click Wheel Controller] |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                |                                                  |
|                                                v                                                  |
|  +---------------------------------------------------------------------------------------------+  |
|  |                              HUD Ribbon & Two-Sided OTC Trade Desk                          |  |
|  |  * Liquid $wif Balances  * Annual Yield  * Bot Acceptance Meter  * Staking Multiplier Badges |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                |                                                  |
|                                                v                                                  |
|  +---------------------------------------------------------------------------------------------+  |
|  |                      Core Game Engine: Pure Deterministic State Reducer                     |  |
|  |                 gameReducer(state: GameState, action: GameAction): GameState                |  |
|  |  * 72 Lots across 6 Districts (93 Edges)   * 120 Tiles Conserved (20 per Shop Category)     |  |
|  |  * 6-Epoch 5-Phase Turn Lifecycle          * canBuildShop Strict Capacity Invariant         |  |
|  |  * Cluster Recalculation on Parcel Trades  * Proactive AI Bots (Sherwood, Apex, Luna)       |  |
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
|  | * Continuous Staking Curve        |             +-------------------------------------------+  |
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
+---------------------------------------------------------------------------------------------------+
```

## Feature Inventory

Every feature from user requirements (R1 through R5), specialist surveys, and hackathon criteria is cataloged below with its designated milestone:

| # | Feature | Subsystem | Description | Milestone | Status |
|---|---|---|---|---|---|
| 1 | Master Execution Plans | Planning | Master execution plan and 3 detailed technical execution plans in `docs/plans/` | M1 | Completed |
| 2 | Thematic Mapping & Dictionary | Planning | Mapping Chinatown and saigon-town concepts to Robin-Town Web3 terminology | M1 | Completed |
| 3 | Pixel Art Asset Pipeline | Assets | Programmatic sprite generator for 32x32 and 96x96 assets with zero-404 verification | M2 | Completed |
| 4 | Visual Assets & Rendering | Assets | Clean export of 6 shop sprites, 4 avatars, board map, $wif coin, and CSS rules | M2 | Completed |
| 5 | Core Game Engine State Machine | Engine | 72-lot geometry, 120-tile pool, 6 shop types, complete set bonuses, and 6-epoch loop | M3 | Completed |
| 6 | AI Bot Negotiation Engine | Engine | Heuristics for drafting (plotScore), building (botBuild), and 3 bot trader personas | M3 | Completed |
| 7 | $wif Tokenomics Flywheel | Tokenomics | Match pool accounting, 5% burn sink, 3% point swap burn, 1% trade tax, and staking | M4 | Completed |
| 8 | Dual-Mode Wallet Connectivity | Wallet | Instant off-chain simulation with 4 accounts plus Web3 EIP-1193 Robinhood Chain | M4 | Completed |
| 9 | Multiplayer Room Sessions | Network | Room creation and joining by room code with authoritative host state relay | M4 | Completed |
| 10 | Web Game Application Shell | UI/UX | Playable web UI with canvas board view, camera zoom, trade desk modal, and audio | M5 | Completed |
| 11 | Single-Player Match Loop | Engine | End-to-end playable single-player match against Sherwood, Apex, and Luna | M5 | Completed |
| 12 | 5-Tier Verification Suite | QA | Automated test pyramid passing 517 tests across Tiers 1 to 5 with 100% green exit code | Final | Completed |
| 13 | Building Capacity Parity | Engine | Enforce `canBuildShop` rules inside `canPlace` and `buildTile` rejecting invalid expansions | M-ENG-1 | Planned |
| 14 | Trade Cluster Recalculation | Engine | Recalculate `lot.isComplete` flags immediately upon exchanging occupied parcels | M-ENG-2 | Planned |
| 15 | Proactive Bot Trade Offers | Engine | AI bots proactively propose deals during trade phase via `incomingOffers` queue | M-ENG-3 | Planned |
| 16 | Canonical Pure Reducer | Engine | Export `gameReducer(state, action)` and delegate network room action transitions | M-ENG-4 | Planned |
| 17 | Stock Token Bridge Alignment | Engine | Rename Category 5 to Stock Token Bridge (Validator Citadel) and add rules modal | M-ENG-5 | Planned |
| 18 | 3D Board Precision Hardening | 3D UI | Align coordinates, fix parcel 71 raycast hit, add horizontal plane guards, lerp fix | D1 | Planned |
| 19 | Diorama Look Contract | 3D UI | Implement `PixelPost` 64-color palette snap, 8x8 Bayer dither, and inked contours | D2 | Planned |
| 20 | SolaceUI Exposure Grid | 3D UI | WebGL2 exposure-grid shader background pass with Robinhood financial palette | D3 | Planned |
| 21 | Apple Carousel Navigator | 3D UI | Infinite autoplay property browser with spring physics and 3D camera focusing | D4 | Planned |
| 22 | iPod Classic Controller | 3D UI | Tangible click wheel controller with angular gesture tracking and tactile audio ticks | D5 | Planned |
| 23 | Audio & Visual Optimization | 3D UI | Instanced parcel mesh (draw calls from 72 to 1), procedural audio expansion, visual QA | D6 | Planned |
| 24 | Trade Tax 50/50 Split & Wagering | Tokenomics | Split trade tax 50% burn / 50% vault, continuous staking curve, round prediction wagers | M4-A | Planned |
| 25 | ERC-20 Encoding & Persistence | Wallet | 4-byte EVM method selectors on Robinhood Chain 46631 and localStorage balance storage | M4-B | Planned |
| 26 | Multiplayer SYNC_REQUEST & Relay | Network | Explicit SYNC_REQUEST packet handler, optimistic action queuing, WebSocket relay | M4-C | Planned |
| 27 | Synthetic Latency Verification | QA | Extend Tier 5 with `LaggyMemoryTransport` test suite validating network resilience | M6 | Planned |

## Master Milestones Delivery Roadmap

| Milestone ID | Track | Milestone Name | Scope and Deliverables | Dependencies |
|---|---|---|---|---|
| M1 to M5 | Baseline | Foundations & Core Game | Core engine, tokenomics, pixel art, wallet, and single-player loop | None |
| Final | Baseline | Initial 5-Tier Verification | 517 tests passing across unit and E2E suites | M1 to M5 |
| M-ENG-1 | Engine | Capacity Validation Parity | Delegate `canPlace` to `canBuildShop` in `engine.ts` | Baseline |
| M-ENG-2 | Engine | Cluster Recalculation | Update `isComplete` immediately in `executeTrade` | M-ENG-1 |
| M-ENG-3 | Engine | Proactive Bot Offers | Populate `incomingOffers` during trade phase using `bot.ts` | M-ENG-2 |
| M-ENG-4 | Engine | Canonical Pure Reducer | Export `gameReducer` and refactor `room.ts` to call it | M-ENG-3 |
| M-ENG-5 | Engine | Stock Token Thematic Alignment | Rename Category 5, add in-game rules and payout modal | M-ENG-4 |
| D1 | 3D UI/UX | 3D Board Precision Hardening | Coordinate alignment, top-face raycasting, app shell mounting | Baseline |
| D2 | 3D UI/UX | Diorama Look Contract | `PixelPost` 64-color palette snap, Bayer dither, inked contours | D1 |
| D3 | 3D UI/UX | SolaceUI Exposure Grid | WebGL2 exposure-grid shader background pass | D2 |
| D4 | 3D UI/UX | Apple Carousel Navigator | Infinite autoplay property browser with 3D camera pan | D1 |
| D5 | 3D UI/UX | iPod Classic Controller | Angular click wheel controller with procedural haptic ticks | D4, M-ENG-3 |
| D6 | 3D UI/UX | Audio & Visual Optimization | `InstancedMesh` parcel draw call reduction, audio expansion | D2, D3, D5 |
| M4-A | Tokenomics | Flywheel Polish & Wagering | 50/50 trade tax burn split, continuous staking, wagering engine | Baseline |
| M4-B | Wallet | ERC-20 & Storage Persistence | ABI method selectors on Robinhood Chain 46631, localStorage | M4-A |
| M4-C | Network | SYNC_REQUEST & WebSocket | Targeted state snapshot resync, WebSocket transport relay | M-ENG-4, M4-B |
| M6 | QA | Hardening & Build Gate | `LaggyMemoryTransport` suite, full build and test pass | All Tracks |

## Interface Contracts

### 1. Engine State and Action Reducer Contract
```typescript
export type GamePhase = 'receive' | 'trade' | 'build' | 'income' | 'ended';

export interface Player {
  id: number;
  name: string;
  address: string;
  cash: number; // in $wif
  tiles: number[]; // count of unplaced tiles per category [0..5]
  avatar?: string;
  ownedLots?: number[];
}

export interface Lot {
  id: number; // 0 to 71
  displayId: number; // 1 to 72
  block: number; // 0 to 5
  col: number; // 0 to 3
  row: number; // 0 to 3
  owner: number | null; // player ID or null
  shop: number | null; // shop type 0 to 5 or null
  shopSize?: number; // target size (3, 4, 5, 6)
  isComplete?: boolean;
}

export interface GameState {
  version: 1;
  boardRevision?: number;
  year: number; // 1 to 6
  phase: GamePhase;
  players: Player[];
  lots: Lot[];
  bag: number[]; // remaining tile pool
  pending: number[]; // candidate deed IDs offered in Phase 1
  draftCount: number; // deeds to keep this epoch
  incomingOffers?: TradeOffer[]; // proactive AI bot trade proposals
  logs: string[];
  lastIncome: number[];
  trades: number;
}

export type GameAction =
  | { type: 'START_YEAR' }
  | { type: 'DRAFT_PLOTS'; playerId: number; lotIds: number[] }
  | { type: 'BEGIN_BUILD' }
  | { type: 'BUILD_TILE'; playerId: number; lotId: number; shopType: number }
  | { type: 'EXECUTE_TRADE'; offer: TradeOffer }
  | { type: 'COLLECT_INCOME' }
  | { type: 'NEXT_YEAR' };

export function gameReducer(state: GameState, action: GameAction): GameState;
```

### 2. AI Bot Negotiation Contract
```typescript
export interface OfferSide {
  cash: number;
  tiles: number[];
  lots: number[];
}

export interface TradeOffer {
  fromPlayer: number;
  toPlayer: number;
  partner?: number;
  give: OfferSide;
  take: OfferSide;
}

export interface TradeEvaluation {
  accepted: boolean;
  shortfall: number;
  counterOffer?: OfferSide;
  quoteMessage: string;
  valueReceived?: number;
  valueSurrendered?: number;
  requiredValue?: number;
}
```

### 3. Tokenomics Flywheel and Wagering Contracts
```typescript
export interface FlywheelConfig {
  buyInAmount: number; // default 1000 $wif
  burnRate: number; // 0.05 (5%)
  vaultRate: number; // 0.05 (5%)
  purseRate: number; // 0.90 (90%)
  pointToWifRate: number; // 0.10 (10 points = 1 $wif)
  swapBurnTax: number; // 0.03 (3%)
  tradeMicroTax: number; // 0.01 (1%)
  stakingMultiplier: number; // 1.20
}

export interface MatchPoolResult {
  totalPool: number;
  burnedAmount: number;
  vaultAmount: number;
  purseAmount: number;
  payouts: { [playerId: number]: number };
}

export interface TradeTaxResult {
  grossCash: number;
  taxAmount: number;
  netCash: number;
  vaultAmount: number;
  burnedAmount: number;
}

export type WagerType = 'FIRST_COMPLETED_SHOP' | 'EPOCH_HARVEST_LEADER' | 'DISTRICT_MONOPOLY';

export interface WagerPool {
  id: string;
  type: WagerType;
  epoch: number;
  totalWagered: number;
  burnedAmount: number; // 5% burn sink
  payoutAmount: number; // 95% prize pool
  wagers: { address: string; predictedTarget: number; amount: number }[];
}
```

### 4. 3D Board and Diorama Contracts
```typescript
export interface Board3DRenderer {
  mount(container: HTMLElement): void;
  unmount(): void;
  syncState(state: GameState): void;
  focusLot(lotId: number): void;
  raycastAt(ndcX: number, ndcY: number): number | null;
  setInteractive(enabled: boolean): void;
}

export interface DioramaQA {
  freeze: (t: number) => void;
  getState: () => { camera: { azimuth: number; elevation: number; fov: number }; frame: number };
  renderAt: (t: number) => void;
}
```

## Code Layout

```
/Volumes/Dev/china-town/
├── .agents/                      # Multi-agent coordination metadata only
├── docs/                         # Master architectural and competition docs
│   ├── COMPETITION.md            # Robinhood Chain Hackathon rules and prizes
│   ├── EXECUTION_PLAN.md         # Master unified execution plan
│   ├── SUBMISSION.md             # Devpost submission summary
│   ├── THEMATIC_MAPPING.md       # Chinatown to Robin-Town terminology dictionary
│   ├── TUNG_LEE_CHECKLIST.md     # Full design and engineering checklist
│   ├── diorama-kit/              # sloemo01/diorama Look Contract and shaders
│   └── plans/                    # Comprehensive subsystem execution plans
│       ├── GAME_ENGINE_EXECUTION_PLAN.md
│       ├── 3D_UI_UX_EXECUTION_PLAN.md
│       └── TOKENOMICS_MULTIPLAYER_EXECUTION_PLAN.md
├── public/                       # Static web assets
│   ├── assets/                   # 65 verified pixel art sprites, textures, and audio
│   └── favicon.svg               # Web favicon
├── scripts/                      # Build, verification, and stress scripts
│   ├── generate-assets.ts        # Programmatic pixel art generator
│   ├── verify-assets.ts          # Zero-404 asset verification gate
│   └── stress-board-3d.ts        # 25-test empirical 3D board stress test
├── src/                          # TypeScript source code
│   ├── engine/                   # Pure deterministic game logic
│   │   ├── types.ts              # Data models and reducer actions
│   │   ├── board-layout.ts       # 72-parcel geometry and adjacency graph
│   │   ├── engine.ts             # State transitions, drafting, payouts, gameReducer
│   │   └── bot.ts                # Sherwood, Apex, and Luna AI heuristics
│   ├── tokenomics/               # $wif economic flywheel
│   │   ├── flywheel.ts           # Math for buy-in pool, burns, and swaps
│   │   ├── wallet.ts             # Off-chain mock and Robinhood Chain provider
│   │   └── wagering.ts           # Prediction markets and side-wagering
│   ├── network/                  # Multiplayer room synchronization
│   │   └── room.ts               # Authoritative host room relay and SYNC_REQUEST
│   ├── ui/                       # 3D diorama and 2D presentation
│   │   ├── board-3d.ts           # Three.js 3D board scene renderer
│   │   ├── post-processing.ts    # PixelPost 64-color palette and Bayer shader
│   │   ├── exposure-grid.ts      # SolaceUI WebGL2 exposure-grid background
│   │   ├── apple-carousel.ts     # Infinite autoplay property browser
│   │   ├── ipod-controller.ts    # Tactile click wheel controller
│   │   ├── board.ts              # 2D fallback canvas renderer
│   │   ├── camera.ts             # Camera controls
│   │   ├── trade-desk.ts         # Two-sided negotiation interface
│   │   ├── audio.ts              # Procedural Web Audio synthesizer
│   │   └── hud.ts                # Player stats, ribbon, drawer, and modals
│   ├── app.ts                    # Application shell coordinator
│   └── main.ts                   # Entry point
├── tests/                        # 5-Tier automated verification suite
│   ├── unit/                     # Engine, bot, and tokenomics unit tests
│   └── e2e/                      # Tier 1 to Tier 5 test suites
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # Strict TypeScript configuration
└── vite.config.ts                # Vite bundler configuration
```
