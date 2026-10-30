# Robin-Town: Comprehensive Execution Plan

## 1. Executive Summary and System Architecture

### 1.1 Project Mission and Objectives
The mission of robin-town is to adapt the classic Chinatown negotiation board game and its digital counterpart saigon-town into a Web3 themed trading strategy game built for the Robinhood Chain ecosystem. The game targets the Robinhood Chain hackathon with a focus on deep economic loops, deterministic game mechanics, original retro pixel art, and an economic flywheel anchored by $wif tokenomics.

Key objectives include:
1. Re-theming the Vietnamese Chinatown trading environment into a retro-cyberpunk Web3 metropolis with six specialized financial districts and six decentralized finance protocol storefronts.
2. Delivering a pure, zero-dependency, deterministic TypeScript game engine executing 72-parcel board geometry, six-year epoch progression, tile drafting, shop clustering, non-linear payouts, and automated AI bot negotiations.
3. Establishing an economic flywheel integrating $wif as the in-game currency, featuring a 5% competitive match pool burn, a 3% casual point swap burn, a 1% trade micro-tax, and an optional staking yield multiplier.
4. Synthesizing original 32x32 native and 96x96 HD pixel art assets programmatically, supported by local Aseprite fallback compatibility and a zero-404 verification gate.
5. Providing a multi-tier automated test suite covering rules, boundary conditions, bot heuristics, and complete multi-year match simulations passing with a 100% green exit code.

### 1.2 High-Level Architecture Diagram
The architecture is structured with modular boundaries separating game logic, tokenomics, networking, asset pipeline, and user interface:

```
+---------------------------------------------------------------------------------+
|                                  robin-town UI                                  |
|   [Canvas Board & Camera]  [OTC Trade Desk]  [Asset Drawer]  [Tokenomics HUD]   |
+---------------------------------------------------------------------------------+
             |                                                  |
             v                                                  v
+--------------------------------------+   +--------------------------------------+
|           Core Game Engine           |   |          Tokenomics Engine           |
| * 72 Lots across 6 Districts         |   | * $wif In-Game Accounting            |
| * 6 Shop Types (Sizes 3, 4, 5, 6)    |   | * 5% Buy-In Burn Sink (Deflation)    |
| * 6-Epoch 5-Phase Turn Progression   |   | * 3% Casual Point Swap Burn Tax      |
| * Non-Linear Payouts & Cluster Math  |   | * 1% OTC Trade Micro-Tax             |
| * AI Personalities: Sherwood/Apex/Luna|  | * Staking Yield Multiplier (1.0-1.2x)|
+--------------------------------------+   +--------------------------------------+
             |                                                  |
             +------------------------+-------------------------+
                                      |
                                      v
+---------------------------------------------------------------------------------+
|                         State Sync & Networking Layer                           |
| * Single-Player Deterministic Loop (Local AI Bots)                              |
| * Dual-Mode Wallet Adapter (Off-Chain Simulation vs EIP-1193 Web3 Provider)     |
| * Room Code Multiplayer Session Relay                                           |
+---------------------------------------------------------------------------------+
```

### 1.3 Core Technical Stack and Zero-Dependency Engine Philosophy
The technical stack is selected for performance, determinism, and longevity:
1. Runtime Environment: Node.js 24+ and evergreen desktop/mobile browsers.
2. Core Engine: Pure TypeScript with zero third-party runtime dependencies. The engine does not import DOM, window, Canvas, or network primitives, allowing identical execution in browsers, Node.js background workers, and headless test runners.
3. Bundler and Dev Server: Vite 8 providing sub-100ms hot module replacement and optimized tree-shaken production bundles.
4. Compiler: TypeScript 7 configured with strict null checks, bundler module resolution, and relative path mapping.
5. Styling Architecture: Pure CSS with custom design tokens, responsive CSS Grid/Flexbox layouts, and pixelated image rendering rules.
6. Audio Engine: Procedural Web Audio API synthesizer generating chiptune melodies, cash registers, and retro UI sound effects without external audio files.

### 1.4 Five-Stage Implementation Roadmap
The implementation is executed across five structured milestones:
1. Milestone 1: Planning and Specifications. Complete execution plan, thematic mapping dictionary, and project scaffold.
2. Milestone 2: Pixel Art Asset Pipeline. Programmatic sprite generator for 32x32 and 96x96 assets, board textures, avatars, and zero-404 validation.
3. Milestone 3: Core Game Engine and AI Bots. Pure deterministic game rules, 72-lot board geometry, 6 protocol shops, payout curves, and 3 AI bot traders.
4. Milestone 4: Tokenomics Flywheel and Networking. $wif accounting, match pool burns, swap taxes, dual-mode wallet, and room multiplayer relay.
5. Milestone 5: Web Game Application Shell and Single-Player Loop. Complete interactive UI, board view, trade desk, audio integration, and end-to-end playable match against bots.
6. Final Milestone: Comprehensive E2E Verification and Hardening. Verification of 138+ automated tests across all tiers.

---

## 2. Step 1: Gameplay Research and Board Mechanics Analysis

### 2.1 Chinatown Tabletop Game Rules and Systems Analysis
Chinatown is a classic negotiation board game designed by Karsten Hartwig. The game takes place over six years, during which players acquire city plots, draw business tiles, trade assets freely, build businesses, and collect revenue. 

Key mechanical pillars from the tabletop game include:
1. Fixed Board Capacity: The board represents city blocks divided into distinct property spaces.
2. Perfect Information on Placed Assets: All placed businesses, active cash earnings, and owned lots are visible to all players.
3. Hidden Hands: Tile draws remain semi-hidden in inventory until deployed or offered on the trade desk.
4. Free-Form Negotiation: Any asset (cash, unbuilt tiles, owned empty plots, and occupied lots) can be traded between players with zero artificial restrictions.
5. Set Collection Synergy: Connected tiles of the same business type yield non-linear payouts, incentivizing players to negotiate swaps to assemble monopolies.

### 2.2 Six-Year Epoch Progression and Five-Phase Turn Cycle
Each match lasts exactly six years (designated as Epochs in robin-town). Each epoch consists of five sequential phases:

```
[Phase 1: Allocation] -> [Phase 2: Tile Draw] -> [Phase 3: OTC Trade] -> [Phase 4: Deployment] -> [Phase 5: Harvest]
```

1. Phase 1: Parcel Allocation (Receive Land Deeds)
   Players receive building deed cards. In a 4-player match, players are dealt a specific number of cards and must discard non-selected cards:
   * Epoch 1: Dealt 7 deed cards, keep 5.
   * Epoch 2: Dealt 6 deed cards, keep 4.
   * Epoch 3: Dealt 5 deed cards, keep 3.
   * Epoch 4: Dealt 4 deed cards, keep 2.
   * Epoch 5: Dealt 4 deed cards, keep 2.
   * Epoch 6: Dealt 4 deed cards, keep 2.
   Total parcels acquired per player across 6 epochs: 5 + 4 + 3 + 2 + 2 + 2 = 18 parcels.
   Across 4 players: 18 * 4 = 72 parcels, perfectly claiming 100% of the board by the end of Epoch 6.

2. Phase 2: Protocol Liquidity Draw (Shop Tiles)
   Players draw shop tiles blindly from the 120-tile pool:
   * Epoch 1: Draw 5 tiles per player (20 tiles total).
   * Epochs 2 to 6: Draw 4 tiles per player per epoch (16 tiles per epoch, 80 tiles total).
   Total tiles dealt across 6 epochs: 20 + 80 = 100 tiles, leaving a reserve of 20 tiles in the pool.

3. Phase 3: OTC Trading and Negotiation
   All players negotiate simultaneously or via bilateral desks. Any combination of $wif cash, unplaced tiles, and owned parcels can be traded. Deals can be partial, multi-asset, or one-sided gifts.

4. Phase 4: Protocol Deployment (Building)
   Players place unbuilt tiles from their inventory onto vacant parcels they own. Placed tiles cannot be moved or removed once deployed.

5. Phase 5: Yield Harvest (Income Collection)
   The engine computes connected orthogonal clusters for each player and disburses annual $wif yield according to the non-linear payout curve.

### 2.3 Board Geometry: 72 Lots, 6 Districts, and Adjacency Rules
The board consists of 72 parcels organized into six irregular city blocks (Districts 0 through 5). Each district contains exactly 12 parcels.

Board Coordinate Constants:
* CELL_SIZE: 50 pixels.
* CELL_PITCH: 52 pixels (50px cell plus 2px inner gutter).
* Total Canvas Dimensions: 1100x730 pixels.

District Block Grid Offsets:
* District 0 (Robinhood District): x: 92, y: 100.
* District 1 (Wall Street Quarter): x: 399, y: 105.
* District 2 (Crypto Wharf): x: 747, y: 120.
* District 3 (Silicon Strip): x: 156, y: 439.
* District 4 (Memecoin Boulevard): x: 464, y: 404.
* District 5 (DeFi Citadel): x: 796, y: 451.

Strict Adjacency Rules:
Two parcels A and B are adjacent if and only if:
1. They reside in the exact same district block: `A.block === B.block`.
2. They share an orthogonal edge: `Math.abs(A.col-B.col) + Math.abs(A.row-B.row) === 1`.
Parcels on opposite sides of a street never connect, and diagonal parcels sharing only a vertex never connect.

### 2.4 Shop Categories, Capacity Constraints, and Non-Linear Payout Curves
The game includes six distinct protocol shop categories with varying maximum sizes:
* Category 0: DEX Swap (Code: DX, Target Size: 3, Color: #39A883, Quota: 20 tiles).
* Category 1: Memecoin Lounge (Code: ML, Target Size: 3, Color: #EEC353, Quota: 20 tiles).
* Category 2: Staking Vault (Code: SV, Target Size: 4, Color: #B85539, Quota: 20 tiles).
* Category 3: Lending Protocol (Code: LP, Target Size: 4, Color: #A16586, Quota: 20 tiles).
* Category 4: Derivatives Exchange (Code: DE, Target Size: 5, Color: #587C9A, Quota: 20 tiles).
* Category 5: Validator Citadel (Code: VC, Target Size: 6, Color: #648454, Quota: 20 tiles).

The total tile bag contains 120 tiles, with exactly 20 tiles per category.

Payout Schedules:
* Complete Set Bonuses: `COMPLETE = [0, 0, 0, 50, 80, 110, 140]`
  * Size 3 complete: 50 $wif
  * Size 4 complete: 80 $wif
  * Size 5 complete: 110 $wif
  * Size 6 complete: 140 $wif
* Incomplete Cluster Payouts: `INCOMPLETE = [0, 10, 20, 40, 60, 80]`
  * 1 tile: 10 $wif
  * 2 tiles: 20 $wif
  * 3 tiles (in size 4, 5, 6): 40 $wif
  * 4 tiles (in size 5, 6): 60 $wif
  * 5 tiles (in size 6): 80 $wif

### 2.5 Overflow Mathematics and Connected Set Scoring
When a connected cluster of tiles of the same type exceeds the target size, the engine applies the overflow formula:

```typescript
function groupIncome(shop: number, count: number): number {
  const target = SHOP_SIZES[shop];
  const completeMultiplier = Math.floor(count / target);
  const remainder = count % target;
  return completeMultiplier * COMPLETE[target] + INCOMPLETE[remainder];
}
```

Detailed Payout Matrix for Cluster Sizes 1 to 12:

| Connected Tiles | Target 3 (DX, ML) | Target 4 (SV, LP) | Target 5 (DE) | Target 6 (VC) |
|---|---|---|---|---|
| 1 tile | 10 $wif | 10 $wif | 10 $wif | 10 $wif |
| 2 tiles | 20 $wif | 20 $wif | 20 $wif | 20 $wif |
| 3 tiles | 50 $wif (Complete) | 40 $wif | 40 $wif | 40 $wif |
| 4 tiles | 60 $wif (50 + 10) | 80 $wif (Complete) | 60 $wif | 60 $wif |
| 5 tiles | 70 $wif (50 + 20) | 90 $wif (80 + 10) | 110 $wif (Complete) | 80 $wif |
| 6 tiles | 100 $wif (2x 50) | 100 $wif (80 + 20) | 120 $wif (110 + 10) | 140 $wif (Complete) |
| 7 tiles | 110 $wif (100 + 10) | 120 $wif (80 + 40) | 130 $wif (110 + 20) | 150 $wif (140 + 10) |
| 8 tiles | 120 $wif (100 + 20) | 160 $wif (2x 80) | 150 $wif (110 + 40) | 160 $wif (140 + 20) |
| 9 tiles | 150 $wif (3x 50) | 170 $wif (160 + 10) | 170 $wif (110 + 60) | 180 $wif (140 + 40) |
| 10 tiles | 160 $wif (150 + 10) | 180 $wif (160 + 20) | 220 $wif (2x 110) | 200 $wif (140 + 60) |
| 11 tiles | 170 $wif (150 + 20) | 200 $wif (160 + 40) | 230 $wif (220 + 10) | 220 $wif (140 + 80) |
| 12 tiles | 200 $wif (4x 50) | 240 $wif (3x 80) | 240 $wif (220 + 20) | 280 $wif (2x 140) |

Connected Component Detection:
The engine uses Breadth-First Search (BFS) to identify connected components. For each player and each shop type, unvisited occupied lots are explored through orthogonal neighbors within the same block. Each connected component of size N is scored using `groupIncome(shop, N)`.

### 2.6 Saigon-Town Digital Adaptation Audit and Invariant Verification
Inspection of the reference implementation in saigon-town confirms the following critical invariants:
1. Spatial Adjacency Invariant: Adjacency graphs are computed statically at boot and are strictly immutable.
2. Asset Conservation Invariant: The sum of cash across all players plus the bank equals total currency minted. Trades preserve total currency minus applicable taxes.
3. Tile Count Invariant: The sum of unplaced tiles in player hands, placed tiles on the board, and remaining tiles in the bag strictly equals 120 at all times.
4. Determinism Invariant: Given identical initial seeds, the engine state transitions and bot decisions produce byte-for-byte identical state histories across platforms.

---

## 3. Step 2: Vietnamese to Robinhood Thematic Mapping

### 3.1 Overarching Narrative: Fintech Lore and Crypto Financial Districts
The game reimagines the Saigon street-market negotiation into a high-stakes cryptocurrency and fintech metropolis called robin-town. Players act as entrepreneurial Web3 fund managers and protocol architects vying to establish market dominance across the city. By negotiating OTC asset swaps, building liquidity pools, and deploying decentralized protocols, players amass cash reserves denominated in $wif.

### 3.2 Six Web3 Districts: Visual Identifiers, Colors, and Plot Allocations
1. District 0: Robinhood District (Lots 0 to 11 / Display 1 to 12)
   * Color: #00C805 (Robinhood Emerald Green).
   * Landmark: Robinhood Tower and Sherwood Retail Pavilion.
   * Aesthetic: Sleek glass interfaces, green candlesticks, retail investor energy.
2. District 1: Wall Street Quarter (Lots 12 to 23 / Display 13 to 24)
   * Color: #EEC353 (Bullion Gold).
   * Landmark: Bullion High-Frequency Exchange and Golden Bull Plaza.
   * Aesthetic: Neoclassical marble pillars overlaid with golden tickertape streams.
3. District 2: Crypto Wharf (Lots 24 to 35 / Display 25 to 36)
   * Color: #29B6F6 (Deep Ocean Cyan).
   * Landmark: Subsea Cable Landing Terminal and ASIC Container Docks.
   * Aesthetic: Industrial maritime docks, cold storage warehouses, ocean breezes.
4. District 3: Silicon Strip (Lots 36 to 47 / Display 37 to 48)
   * Color: #AB47BC (Electric Amethyst).
   * Landmark: Open-Source Foundry and VC Incubator Spire.
   * Aesthetic: Purple neon, smart contract compilers, venture hack houses.
5. District 4: Memecoin Boulevard (Lots 48 to 59 / Display 49 to 60)
   * Color: #FF7043 (Sunset Coral).
   * Landmark: Dogwifhat Monument and Prediction Market Arcade.
   * Aesthetic: Vibrant carnival atmosphere, pink beanies, viral excitement.
6. District 5: DeFi Citadel (Lots 60 to 71 / Display 61 to 72)
   * Color: #455A64 (Slate Cobalt).
   * Landmark: Consensus Monolith and Cold Storage Spire.
   * Aesthetic: Fortified concrete bastions, validator server racks, cryptographic purity.

### 3.3 Six Protocol Storefronts: Sizes, Economics, and Aesthetic Palettes
1. DEX Swap (Category 0, Code DX, Size 3, Color #39A883)
   Automated market maker liquidity pool providing high early yield with low capital requirements.
2. Memecoin Lounge (Category 1, Code ML, Size 3, Color #EEC353)
   High-velocity retail speculation venue pairing well with rapid community trades.
3. Staking Vault (Category 2, Code SV, Size 4, Color #B85539)
   Proof-of-stake node infrastructure yielding steady, compounding annual rewards.
4. Lending Protocol (Category 3, Code LP, Size 4, Color #A16586)
   Overcollateralized money market generating institutional interest fees.
5. Derivatives Exchange (Category 4, Code DE, Size 5, Color #587C9A)
   Perpetual futures exchange yielding substantial income when fully assembled.
6. Validator Citadel (Category 5, Code VC, Size 6, Color #648454)
   Massive Layer 1 consensus engine offering the highest single-turn payout (140 $wif) on the board.

### 3.4 AI Bot Trader Archetypes: Sherwood, Apex, and Luna
Three AI bot personalities provide diverse negotiation challenges:
1. Sherwood (Replaces Linh):
   * Archetype: The Conservative Yield Seeker.
   * Visual: Cyber-hooded archer with a luminous green visor.
   * Margin Threshold: 1.04 (demands 4% surplus on trades).
   * Behavior: Prioritizes smaller Size 3 and 4 protocols. Friendly, cooperative, eager to reach mutual agreements that close incomplete sets.
2. Apex (Replaces Minh):
   * Archetype: The High-Frequency Arbitrage Shark.
   * Visual: Wall Street bull trader in a dark navy pinstripe suit.
   * Margin Threshold: 1.09 (demands 9% to 12% surplus).
   * Behavior: Aggressive institutional player aiming for large Size 5 and 6 monopolies. Hoards key bottleneck parcels and demands steep cash compensations.
3. Luna (Replaces An):
   * Archetype: The Liquid Market Maker.
   * Visual: Shiba inu sporting a signature knitted pink beanie.
   * Margin Threshold: 1.01 (operates near parity with a 1% margin).
   * Behavior: High capital velocity trader who hates idle inventory. Trades readily to keep tiles flowing into active construction every epoch.

### 3.5 English Terminology Dictionary and Localization Schema
All user-facing strings are strictly 100% English:
* Game Round -> Epoch (Epoch 1 to 6)
* Currency ($) -> $wif
* Land Space / Plot -> Parcel / District Lot
* Shop Tile -> Protocol Module / DApp Tile
* Card Hand -> Asset Inventory / Hardware Wallet
* Deal Stamp -> FILLED!
* Trade Desk -> OTC Liquidity Desk
* Income Phase -> Yield Harvest
* Final Round -> Final Settlement
* Discard / Pass -> Confirm Allocation / Next Epoch

---

## 4. Step 3: Asset Generation Workflows

### 4.1 Pixel Art Aesthetic Guidelines and Palette Architecture
The visual style is characterized by retro 16-bit pixel art with crisp edges and neon accents. A master color palette anchors the aesthetic:
* Dark Canvas Background: #0B0F19
* Panel Card Surfaces: #111827
* Primary Brand Emerald: #00C805
* Bullion Gold: #EEC353
* Ocean Cyan: #29B6F6
* Amethyst Purple: #AB47BC
* Sunset Coral: #FF7043
* Muted Text: #9CA3AF
* High-Contrast White: #F3F4F6

### 4.2 Programmatic Sprite Generator (scripts/generate-assets.ts)
A standalone Node.js and TypeScript script generates all required graphical assets without external C-bindings or native canvas dependencies. The generator writes standard PNG files using pure binary buffer synthesis:
1. Shop Tiles: Six 32x32 native pixel sprites and six 96x96 HD variants featuring distinct icon designs (swapping arrows, doge silhouette, vault door, currency pillars, candlesticks, and monolith towers).
2. Player Avatars: Four distinct avatars (Human Trader, Sherwood, Apex, Luna).
3. Currency Tokens: 32x32 $wif coin with doge silhouette and green rim, plus USDG treasury bill.
4. Board Textures: 1100x730 pixel background depicting streets, district blocks, and parcel boundary lines.
5. UI Glyphs: Trade arrows, verification badges, deal stamps, and lock icons.

### 4.3 Native 32x32 and HD 96x96 Resolution Standards
To ensure visual clarity across both standard mobile screens and high-DPI desktop monitors, all tile and avatar assets are generated in dual resolutions:
* Standard Native: 32x32 pixels, optimized for board parcel placement and tight inventory grids.
* High Definition: 96x96 pixels (exact 3x integer scaling with enhanced micro-details), used in the negotiation desk, avatar profile cards, and modal dialogs.

### 4.4 Local Aseprite Slicer and Frame Extraction Fallback
When pre-rendered `.aseprite` or sprite sheet files exist in the `art/` directory, the build pipeline can invoke an optional frame slicer to unpack frames into PNGs. If no external Aseprite files are present, `scripts/generate-assets.ts` serves as the primary asset creation engine, ensuring complete standalone reproducibility.

### 4.5 Nearest-Neighbor CSS Rendering Rules for Retina Displays
To eliminate bilinear filtering blur on modern high-DPI displays, the global stylesheet enforces nearest-neighbor interpolation:

```css
canvas,
img.pixel-art,
.tile-sprite,
.avatar-sprite {
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
  image-rendering: pixelated;
}
```

### 4.6 Zero-404 Build Asset Verification Gate (scripts/verify-assets.ts)
The verification script scans the `public/assets/` directory against a manifest of required asset paths:
* Six 32x32 shop icons (`shop_0.png` through `shop_5.png`).
* Six 96x96 shop icons (`shop_0_hd.png` through `shop_5_hd.png`).
* Four player avatars (`avatar_0.png` through `avatar_3.png`).
* Board background map (`board_map.png`).
* Currency tokens (`coin_wif.png`, `bill_usdg.png`).
* Favicon (`public/favicon.svg`).

The build script chains `npm run verify:assets` before Vite compilation. If any asset is missing or has a file size of zero bytes, the build aborts with a non-zero exit code.

---

## 5. Step 4: Game Engine and Core Implementation

### 5.1 Pure Deterministic TypeScript State Machine (src/engine/)
The core engine resides in `src/engine/` and manages all game rules and state transitions. It operates as a pure reducer: `nextState = transition(currentState, action)`. State immutability is maintained via structured cloning, guaranteeing that historical state rollbacks, replays, and undo actions are mathematically clean.

### 5.2 Core Data Interfaces and Schemas (GameState, Lot, Player, Shop)
The engine contracts are defined in `src/engine/types.ts`:

```typescript
export type GamePhase = 'receive' | 'trade' | 'build' | 'income' | 'ended';

export interface Player {
  id: number;
  name: string;
  address: string;
  cash: number; // in $wif
  tiles: number[]; // unplaced tiles count per shop type [0..5]
  avatar: string;
}

export interface Lot {
  id: number; // 0..71
  block: number; // 0..5
  col: number; // grid col within block
  row: number; // grid row within block
  owner: number | null; // player ID or null
  shop: number | null; // shop type 0..5 or null
}

export interface GameState {
  version: 1;
  year: number; // 1 to 6
  phase: GamePhase;
  players: Player[];
  lots: Lot[];
  bag: number[]; // remaining tile indices
  pending: number[]; // parcel deed IDs offered in Phase 1
  draftCount: number; // count of parcels player must keep
  logs: string[];
  lastIncome: number[];
  trades: number;
}
```

### 5.3 AI Bot Negotiation Engine and Valuation Algorithms (src/engine/bot.ts)
Bot negotiation heuristics evaluate trade offers using a multi-factor valuation model:

```
Valuation(OfferSide) = Cash + TileValue + LotValue
```

1. Cash Valuation:
   Cash is valued at 1.0x face value in $wif.

2. Tile Valuation:
   The perceived value of an unplaced tile depends on the bot's current holdings and the remaining epochs:
   ```
   TileValue = base(10) + (ownedMatchingTiles * 8) + (canCompleteThisTurn ? 25 : 0) + (7-currentEpoch) * 3
   ```

3. Lot Valuation:
   The value of a parcel depends on its proximity to the bot's existing properties:
   ```
   LotValue = base(18) + (adjacentFriendlyPlots * 14) + (hasMatchingShopAdjacent ? 20 : 0) + (isOccupied ? 15 : 0)
   ```

4. Evaluation and Acceptance:
   When receiving an offer from a proposing player, the bot computes the subjective valuation of both sides:
   ```
   valueReceived = evaluate(offer.give, botId, epoch);
   valueSurrendered = evaluate(offer.take, botId, epoch);
   requiredValue = valueSurrendered * botMargin;
   ```
   Here, `offer.give` represents the assets surrendered by the proposer (received by the bot), while `offer.take` represents the assets requested by the proposer (surrendered by the bot). The bot requires the received value to at least cover the surrendered value multiplied by its margin threshold.

   If `valueReceived >= requiredValue`, the trade is accepted (`accepted = true`, `shortfall = 0`).
   If not, the trade is rejected (`accepted = false`), and the shortfall is computed:
   ```
   shortfall = Math.max(0, Math.ceil(requiredValue-valueReceived));
   ```
   If the proposing player possesses enough cash (`offer.give.cash + shortfall <= proposer.cash`), the bot generates a one-click counteroffer specifying `give.cash = offer.give.cash + shortfall`, enabling the proposer to bridge the valuation gap by topping up $wif.

### 5.4 $wif Tokenomics Flywheel, Burn Sinks, and Staking (src/tokenomics/)
The tokenomics module implements mathematical sinks supporting the Robinhood Chain hackathon theme:

1. Competitive Match Buy-In Pool:
   In a 4-player match with a 1,000 $wif buy-in per player:
   * Total Pool: 4,000 $wif.
   * 5% Burn Sink: 200 $wif permanently burned.
   * 5% Ecosystem Treasury: 200 $wif allocated to developer rewards.
   * 90% Prize Purse: 3,600 $wif awarded to top finishers.
   Podium Distribution:
   * 1st Place (60%): 2,160 $wif.
   * 2nd Place (25%): 900 $wif.
   * 3rd Place (15%): 540 $wif.
   * 4th Place (0%): 0 $wif.

2. Casual Point-to-$wif Swap:
   Casual players earn gameplay points based on business size, complete sets, and final cash. Points convert to $wif at a rate of 10 points = 1 $wif, subject to a 3% burn tax:
   ```
   grossWif = Math.floor(points / 10);
   burnedWif = Math.ceil(grossWif * 0.03);
   netWif = grossWif-burnedWif;
   ```

3. OTC Trade Micro-Tax:
   To prevent zero-cost churning while supporting token burn velocity, all accepted trades transferring cash incur a 1% micro-tax:
   ```
   tax = Math.ceil(cashTransferred * 0.01);
   burnAmount = Math.floor(tax / 2);
   vaultAmount = tax-burnAmount;
   netCashReceived = cashTransferred-tax;
   ```

4. Staking Yield Multiplier:
   Players staking $wif before a match receive a boost of up to 1.20x on annual harvest yield:
   ```
   multiplier = 1.0 + 0.20 * Math.min(stakedWif, 50000) / 50000;
   finalYield = Math.floor(baseYield * multiplier);
   ```

### 5.5 Dual-Mode Wallet System: Off-Chain Simulation and Web3 EIP-1193
The wallet adapter provides two seamless operating modes:
* Mode A: Off-Chain Simulation. Pre-funded local mock wallets (10,000 $wif balance per player) stored in browser memory or local storage. Enables zero-setup gameplay and offline testing.
* Mode B: Web3 EIP-1193 Provider. Connects to MetaMask or Robinhood Wallet targeting the Robinhood Chain Testnet (Chain ID 46631). Handles address retrieval, on-chain balances, and gasless transaction simulation.

### 5.6 Room-Based Multiplayer State Synchronization (src/network/)
Multiplayer functionality allows players to host or join rooms using a 6-character room code. State sync operates through an optimistic action-relay pattern:
1. Room Host initializes `GameState` with the room seed.
2. Players dispatch typed actions (draft parcel, propose trade, deploy tile).
3. The room controller serializes actions, updates the deterministic state machine, and broadcasts state diffs to all connected peers.

### 5.7 Web Game Application Shell and UI Views (src/ui/)
The user interface combines Canvas rendering with responsive HTML5 dialogs:
* Board View: Canvas element rendering 72 parcels, glowing district borders, placed protocol sprites, and ownership discs.
* Camera Controller: Pan, zoom, and focus easing allowing smooth inspection of city blocks on both mobile screens and desktop monitors.
* OTC Trade Desk: Two-column visual escrow interface displaying assets on offer, cash steppers, bot dialogue bubbles, and one-click counteroffer buttons.
* Inventory Drawer: Slide-out tray displaying unplaced protocol tiles and owned parcel deeds.
* Procedural Audio Synthesizer: Retro sound effects for tile placement, coin chimes, deal stamps, and phase transitions.

---

## 6. Step 5: Comprehensive Testing and Verification

### 6.1 Four-Tier Testing Methodology Overview
Following the testing philosophy in `TEST_INFRA.md`, the test suite verifies all features using four structured testing tiers with zero external network dependencies:
* Tier 1: Category-Partition Feature Coverage (60 tests).
* Tier 2: Boundary Value Analysis and Corner Cases (60 tests).
* Tier 3: Pairwise Cross-Feature Combinations (12 tests).
* Tier 4: Real-World Multi-Year Simulation Scenarios (6 scenarios).
Total test suite target: Minimum 138 automated test cases.

### 6.2 Tier 1: Category-Partition Feature Tests (60 Tests)
Five targeted tests for each of the 12 inventoried features:
1. Execution Plan and Thematic Docs: Document existence, section headers, math formulas, glossary mapping, zero forbidden dashes.
2. Thematic Mapping and Dictionary: District colors, 6 protocol codes, payout curves, bot profiles, English localization.
3. Pixel Art Asset Pipeline: Sprite generator execution, 32x32 outputs, 96x96 outputs, PNG chunk validity, palette consistency.
4. Visual Assets and Rendering: Asset manifest completeness, zero-404 verification, CSS pixelated rules, image dimension validation.
5. Core Game Engine and Rules: Phase order, parcel drafting quotas, 120-tile bag depletion, BFS cluster detection, overflow math.
6. AI Bot Negotiation Engine: Multi-factor valuation, Sherwood 1.04 margin, Apex 1.09 margin, Luna 1.01 margin, cash counteroffer math.
7. $wif Tokenomics Flywheel: 4,000 $wif pool split, 5% burn, 3% swap burn, 1% trade tax, 1.20x staking multiplier.
8. Dual-Mode Wallet System: Off-chain pre-funding, balance deductions, EIP-1193 interface conformance, disconnect fallback, address switching.
9. Multiplayer Room Sessions: Room code generation, 4-player capacity enforcement, action dispatch, state synchronization, disconnect handling.
10. Web Game UI Application: Main entry mount, canvas initialization, trade desk modal, audio context toggle, responsive drawer.
11. Single-Player Match Loop: Epoch 1 to 6 sequence, bot turn execution, cash settlement, podium ranking, win condition.
12. Automated Verification and Build: Typecheck zero errors, single-command test pass, clean build output, zero lint warnings.

### 6.3 Tier 2: Boundary Value Analysis and Corner Cases (60 Tests)
Edge-case evaluations across all systems:
* Board Geometry: Diagonal plots non-adjacency, cross-street non-adjacency, boundary parcels (plots 0, 11, 12, 71).
* Bag Depletion: Empty bag behavior in later epochs, drawing remaining tiles when bag count is less than required.
* Tile Placement: Attempting to build on opponent-owned lots, building with zero inventory tiles, double-building on occupied lots.
* Trade Offers: Zero cash trades, negative cash rejection, trades exceeding player balance, counteroffer when player cash is insufficient.
* Overflow Payouts: Cluster sizes 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 tiles across all shop sizes.
* Scoring Ties: Identical cash resolution via total placed tiles, secondary tie-breaker via owned parcels.
* Micro-Tax Rounding: 1 $wif cash transfer with Math.ceil(0.01) tax deduction.

### 6.4 Tier 3: Pairwise Cross-Feature Combinations (12 Tests)
Interaction tests evaluating system couplings:
1. Drafting parcels while wallet balance is updated.
2. Bot counteroffer accepted with trade micro-tax deducted from final cash.
3. Overflow shop payouts combined with active staking yield multiplier.
4. Single-player match transitioning to final point-to-$wif swap.
5. Complete set bonus triggering procedural audio chime.
6. Multiplayer action dispatch evaluated by local deterministic engine.
7. Simultaneous bilateral trades between human player and multiple bots.
8. Tile placement immediately reflected in board canvas and inventory HUD.
9. Competitive match pool burn executed upon room start.
10. Offline simulation switching to Web3 provider without state corruption.
11. Full set assembly in District 0 triggering Sherwood cooperative dialogue.
12. Zero-404 asset validation executing prior to production bundle.

### 6.5 Tier 4: Real-World Multi-Year Simulation Scenarios (6 Scenarios)
Comprehensive end-to-end match simulations:
1. Complete 4-Player 6-Epoch AI Match: Full simulation from Epoch 1 allocation to Epoch 6 final settlement, verifying state progression and positive winning balance.
2. High-Stakes Land Monopoly Trade: Multi-asset trade swapping 2 parcels and 200 $wif for 3 bottleneck tiles, followed by immediate complete set deployment.
3. Tokenomics Deflationary Burn Run: Tracking 10 consecutive matches, verifying cumulative 5% pool burns and 3% swap burns reduce circulating supply.
4. Offline to Online Wallet Transition: Starting game in off-chain simulation and seamlessly linking Web3 address during Phase 3 trading.
5. Edge-Case Block Boundary Adjacency: Attempting to form cross-district businesses along adjacent streets, verifying zero erroneous connections.
6. Multi-Room Concurrent Session Play: Running two independent 4-player game instances concurrently, proving complete memory isolation and determinism.

### 6.6 Single-Command Execution and Automated CI Gates
All tests run offline via a single command:
```bash
npm test
```
The command invokes `node --import tsx --test tests/**/*.test.ts`, outputting structured TAP results and returning exit code 0 when all assertions pass.

---

## 7. Milestone Breakdown, Deliverables, and Dependency Graph

### 7.1 Milestone 1: Planning and Specifications
* Deliverables:
  * `docs/EXECUTION_PLAN.md`
  * `docs/THEMATIC_MAPPING.md`
  * `package.json`
  * `tsconfig.json`
  * `vite.config.ts`
  * `index.html`
  * `src/main.ts`
  * `src/styles/index.css`
  * `public/favicon.svg`
* Verification: Clean `npm install` and zero errors on `npm run typecheck`.

### 7.2 Milestone 2: Pixel Art Asset Pipeline
* Deliverables:
  * `scripts/generate-assets.ts`
  * `scripts/verify-assets.ts`
  * Generated 32x32 and 96x96 sprites in `public/assets/`
  * Board map texture (1100x730)
  * CSS nearest-neighbor rendering styles
* Dependencies: Milestone 1 scaffold.

### 7.3 Milestone 3: Core Game Engine and AI Bots
* Deliverables:
  * `src/engine/types.ts`
  * `src/engine/board-layout.ts`
  * `src/engine/engine.ts`
  * `src/engine/bot.ts`
  * `tests/unit/engine.test.ts`
* Dependencies: Milestone 1 contracts.

### 7.4 Milestone 4: Tokenomics Flywheel and Networking
* Deliverables:
  * `src/tokenomics/flywheel.ts`
  * `src/tokenomics/wallet.ts`
  * `src/network/room.ts`
  * `tests/unit/flywheel.test.ts`
* Dependencies: Milestone 3 engine.

### 7.5 Milestone 5: Web Game Application Shell and Single-Player Loop
* Deliverables:
  * `src/ui/board.ts`
  * `src/ui/camera.ts`
  * `src/ui/trade-desk.ts`
  * `src/ui/hud.ts`
  * `src/ui/audio.ts`
  * `src/app.ts`
* Dependencies: Milestones 2, 3, 4.

### 7.6 Final Milestone: Comprehensive Verification and Hardening
* Deliverables:
  * Complete test suite passing 138+ tests across Tiers 1 through 4.
  * Zero lint warnings, zero build errors, zero 404 assets.
* Dependencies: Milestone 5 completion.
