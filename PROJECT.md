# Project: robin-town

Chinatown negotiation board game adaptation for Robinhood Chain with $wif tokenomics flywheel and original pixel art assets.

## Architecture

The robin-town application is structured as a high-performance web game with a clean separation of concerns:
* Core Game Engine: Pure, deterministic TypeScript state machine with zero DOM or network dependencies. Implements 72-parcel board geometry across 6 districts, tile drafting, shop clustering, non-linear payout curves, and 3 AI bot personalities.
* Tokenomics and Flywheel: Dedicated mathematical module managing $wif currency accounting, competitive match buy-in pools, deflationary burn sinks, point-to-token swap formulas, and dual-mode wallet connectivity (Off-Chain Simulation and Web3 Robinhood Chain Testnet).
* Pixel Art Asset Pipeline: Standalone programmatic sprite generator producing 32x32 native and 96x96 HD pixel sprites for shops, avatars, board terrain, and UI tokens, with Aseprite fallback and zero-404 asset verification.
* UI and Game Shell: Fast Vite and TypeScript application with interactive board view, camera zoom and pan, visual two-sided trade desk, asset drawers, calendar flips, and procedural audio.
* Networking Layer: Room-based multiplayer state synchronization supporting wallet addresses and distinct player sessions.

```
+-------------------------------------------------------------------------------+
|                                  robin-town UI                                |
|  [Board View & Camera]  [Trade Desk]  [Inventory Drawer]  [Tokenomics Flywheel]|
+-------------------------------------------------------------------------------+
           |                                                |
           v                                                v
+------------------------------------+   +--------------------------------------+
|          Core Game Engine          |   |          Tokenomics Engine           |
| * 72 Lots across 6 Districts       |   | * $wif In-Game Accounting            |
| * 6 Shop Types (Sizes 3, 4, 5, 6)  |   | * 5% Buy-In Burn Sink                |
| * 6-Year Phase Progression         |   | * 3% Point Swap Burn Tax             |
| * Payouts & Grouping Math          |   | * 1% Trade Micro-Tax                 |
| * AI Heuristics (Sherwood/Apex/Luna|   | * Dual-Mode Wallet Connect           |
+------------------------------------+   +--------------------------------------+
           |                                                |
           +-----------------------+------------------------+
                                   |
                                   v
+-------------------------------------------------------------------------------+
|                       State Sync & Multiplayer Relay                          |
| * Local AI Loop (Single-Player)                                               |
| * Room Code Session Relay (Multiplayer by Wallet / Session ID)                |
+-------------------------------------------------------------------------------+
```

## Feature Inventory

Every feature from user requirements (R1 through R5) and survey reports is inventoried below with its assigned milestone:

| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| 1 | Execution Plan Document | Structured 5-step execution plan covering research, thematic mapping, asset workflow, engine, and testing | M1 | R1, survey |
| 2 | Thematic Mapping & Dictionary | Complete documentation mapping Chinatown and saigon-town concepts, districts, shops, and phases to robin-town | M1 | R1, survey |
| 3 | Pixel Art Asset Pipeline | Programmatic sprite generator for 32x32 and 96x96 pixel art assets with Aseprite fallback and zero-404 validator | M2 | R4, survey |
| 4 | Visual Assets & Rendering | Clean export of 6 shop sprites, 4 player avatars, board textures, $wif coin, and nearest-neighbor CSS pixel rendering | M2 | R4, survey |
| 5 | Core Game Engine & Rules | 72-parcel board geometry, 120-tile pool, 6 shop types, complete set bonuses, and 6-year 5-phase loop | M3 | R2, survey |
| 6 | AI Bot Negotiation Engine | Heuristics for drafting (plotScore), building (botBuild), and 3 bot trader personas (Sherwood, Apex, Luna) | M3 | R2, survey |
| 7 | $wif Tokenomics Flywheel | In-game currency calculations, 5% match pool burn, 3% point swap burn, 1% trade tax, and staking yield boost | M4 | R3, survey |
| 8 | Dual-Mode Wallet Connectivity | Instant off-chain simulation with pre-funded local wallets plus standard EIP-1193 Web3 connection for Robinhood Chain | M4 | R3, survey |
| 9 | Multiplayer Room Sessions | Room creation and joining by room code with state synchronization across distinct wallet addresses or sessions | M4 | R2, survey |
| 10 | Web Game Application Shell | Full playable English web application with interactive board view, camera zoom and pan, trade desk, and audio | M5 | R2, survey |
| 11 | Single-Player Match Loop | End-to-end playable single-player match from allocation through Year 6 final scoring against 3 AI bots | M5 | R2, survey |
| 12 | Automated E2E Test Suite | Automated end-to-end test suite covering game transitions, rules, bot decisions, token swaps, and UI states | Final Milestone | R5, survey |

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Planning & Specifications | Execution plan, architecture decision record, English thematic dictionary, and project scaffold | none | DONE |
| M2 | Pixel Art Asset Pipeline | Programmatic sprite generator, shop sprites, avatars, board textures, and asset verification | M1 | DONE |
| M3 | Core Game Engine & AI Bots | Deterministic rules engine, 72-lot board geometry, 6 shop categories, payout formulas, and AI heuristics | M1, M2 | DONE |
| M4 | Tokenomics & Networking | $wif flywheel math, burn sinks, dual-mode wallet adapter, and room-based multiplayer sync | M3 | DONE |
| M5 | Game App & UI Integration | Full English web game UI, board view, trade desk, audio, and end-to-end single-player match loop | M2, M3, M4 | DONE |
| Final | E2E Verification & Hardening | Pass 100% of E2E test suite (Tiers 1 to 4) followed by adversarial coverage hardening (Tier 5) | M5, TEST_READY | DONE |

## Interface Contracts

### Engine ↔ UI State
```typescript
export type GamePhase = 'receive' | 'trade' | 'build' | 'income' | 'ended';

export interface Player {
  id: number;
  name: string;
  address: string;
  cash: number; // in $wif
  tiles: number[]; // count of unplaced tiles per shop type [0..5]
}

export interface Lot {
  id: number;
  block: number;
  col: number;
  row: number;
  owner: number | null;
  shop: number | null;
}

export interface GameState {
  version: 1;
  year: number; // 1 to 6
  phase: GamePhase;
  players: Player[];
  lots: Lot[];
  bag: number[];
  pending: number[];
  draftCount: number;
  logs: string[];
  lastIncome: number[];
  trades: number;
}
```

### Engine ↔ AI Bot Negotiation
```typescript
export interface OfferSide {
  cash: number;
  tiles: number[];
  lots: number[];
}

export interface TradeOffer {
  fromPlayer: number;
  toPlayer: number;
  give: OfferSide;
  take: OfferSide;
}

export interface TradeEvaluation {
  accepted: boolean;
  shortfall: number;
  counterOffer?: OfferSide;
  quoteMessage: string;
}
```

### Tokenomics Flywheel Contract
```typescript
export interface FlywheelConfig {
  buyInAmount: number; // default 1000 $wif
  burnRate: number; // 0.05 (5%)
  vaultRate: number; // 0.05 (5%)
  purseRate: number; // 0.90 (90%)
  pointToWifRate: number; // 0.10 (10 points = 1 $wif)
  swapBurnTax: number; // 0.03 (3%)
  tradeMicroTax: number; // 0.01 (1%)
}

export interface MatchPoolResult {
  totalPool: number;
  burnedAmount: number;
  vaultAmount: number;
  purseAmount: number;
  payouts: { [playerId: number]: number };
}

export interface PointSwapResult {
  points: number;
  grossWif: number;
  burnedWif: number;
  netWif: number;
}
```

## Code Layout

```
/Volumes/Dev/china-town/
├── .agents/                      # Agent orchestration metadata only
├── docs/                         # Project documentation and execution plan
│   ├── EXECUTION_PLAN.md         # 5-step execution plan
│   └── THEMATIC_MAPPING.md       # Chinatown / Saigon to Robin-Town dictionary
├── public/                       # Static public assets
│   ├── assets/                   # Exported pixel art sprites, tiles, and audio
│   └── favicon.svg               # Game favicon
├── scripts/                      # Build and verification scripts
│   ├── generate-assets.ts        # Programmatic pixel art generator
│   └── verify-assets.ts          # Zero-404 asset integrity checker
├── src/                          # TypeScript source code
│   ├── engine/                   # Pure deterministic game logic
│   │   ├── types.ts              # Data contracts and schemas
│   │   ├── board-layout.ts       # 72-parcel geometry and adjacency graph
│   │   ├── engine.ts             # State transitions, drafting, payouts
│   │   └── bot.ts                # Sherwood, Apex, and Luna AI heuristics
│   ├── tokenomics/               # $wif economic flywheel
│   │   ├── flywheel.ts           # Math for buy-in pool, burns, and swaps
│   │   └── wallet.ts             # Off-chain mock and Robinhood Chain provider
│   ├── network/                  # Multiplayer room synchronization
│   │   └── room.ts               # Room state relay and action dispatch
│   ├── ui/                       # Game view and interactive components
│   │   ├── board.ts              # Canvas/DOM board renderer
│   │   ├── camera.ts             # Pan and zoom controls
│   │   ├── trade-desk.ts         # Two-sided negotiation interface
│   │   ├── audio.ts              # Procedural Web Audio sound generator
│   │   └── hud.ts                # Player stats, drawer, and calendar
│   ├── app.ts                    # Application shell coordinator
│   └── main.ts                   # Entry point
├── tests/                        # Test suites
│   ├── unit/                     # Engine, bot, and tokenomics unit tests
│   └── e2e/                      # End-to-end gameplay and match tests
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # Strict TypeScript configuration
└── vite.config.ts                # Vite bundler configuration
```
