# Core Game Engine and Rules Adaptation Execution Plan

## 1. Executive Overview and Architectural Objectives

The Core Game Engine of robin-town delivers a pure, deterministic, zero-dependency implementation of the classic Chinatown tabletop board game mechanics adapted into a Web3 trading strategy environment for the Robinhood Chain Hackathon. The engine is modeled on both the original 1999 tabletop design by Karsten Hartwig and the digital reference implementation from saigon-town.

The engine operates under strict design constraints:
1. Pure Determinism: Given identical initial seeds, match state transitions produce byte-for-byte identical state histories across platforms, browsers, and background test runners.
2. Zero Runtime Dependencies: The engine codebase in `src/engine/` contains zero external imports, zero DOM references, zero Node.js native bindings, and zero network calls.
3. Complete Rule Invariants: All 72 parcels, 120 protocol tiles, 6 protocol business types, 6-year epoch cycles, and non-linear payout tables are strictly conserved and validated without bypass opportunities.
4. Autonomous Bot Negotiation: Three AI personas (Sherwood, Apex, and Luna) execute distinct mathematical valuation models, generate realistic trade evaluations, quote exact shortfalls, and proactively propose bilateral deals during active gameplay.

This execution plan provides technical specifications, TypeScript data models, algorithm specifications, edge case defenses, Tung Lee checklist mappings, and a 5-milestone delivery roadmap (M-ENG-1 through M-ENG-5) to resolve all identified architectural gaps.

```
+---------------------------------------------------------------------------------------------------+
|                                  CORE GAME ENGINE ARCHITECTURE                                    |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  +-----------------------------+   +-----------------------------+   +-------------------------+  |
|  |     72-Parcel Geometry      |   |       120-Tile Pool         |   |    6 Protocol Stores    |  |
|  | 6 Districts x 12 Lots       |   | 20 per Category (0..5)      |   | Sizes: 3, 3, 4, 4, 5, 6 |  |
|  | Orthogonal Graph (93 Edges) |   | Conserved: Bag+Hands+Board  |   | Non-Linear Payout Curve |  |
|  +-----------------------------+   +-----------------------------+   +-------------------------+  |
|                 |                                 |                               |               |
|                 +---------------------------------+-------------------------------+               |
|                                                   |                                               |
|                                                   v                                               |
|  +---------------------------------------------------------------------------------------------+  |
|  |                        Deterministic State Machine & Action Reducer                         |  |
|  |                gameReducer(state: GameState, action: GameAction): GameState                 |  |
|  +---------------------------------------------------------------------------------------------+  |
|        |                          |                              |                         |      |
|        v                          v                              v                         v      |
|  [Phase 1: Receive]      [Phase 2: Trade Desk]          [Phase 3: Deployment]    [Phase 4: Harvest] |
|  Deeds: [5,4,3,2,2,2]    Bilateral OTC Exchanges        Strict Capacity Checks   BFS Cluster Yield  |
|  Unowned Pool Drafting   Cash/Tiles/Parcels + 1% Tax    Expansion Prohibitions   1.20x Staking Boost|
|  Discard Preservation    Proactive Bot Offer Queue      Merged Cluster Clamping  Podium Settlement  |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  |                            AI Bot Negotiation & Heuristics Engine                           |  |
|  |  * Sherwood (Margin 1.04, Yield Seeker)   * Apex (Margin 1.09, Arbitrage Shark)             |  |
|  |  * Luna (Margin 1.01, Market Maker)       * Proactive Offer Generation & Shortfall Counters |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Tabletop Chinatown Rules Adaptation and Mathematical Fidelity

### 2.1 Six-Year Epoch Progression and Turn Lifecycle

Chinatown spans six calendar years. In robin-town, these are designated as Epochs 1 through 6. The match structure adheres strictly to the canonical sequence:
* Epoch Count: Exactly 6 sequential epochs.
* Player Count: Exactly 4 players (1 human player and 3 automated AI bots in single-player mode, or up to 4 networked participants in multiplayer rooms).
* Initial Working Capital: Each player starts with 50 $wif in liquid cash.
* Phase Sequence: Each epoch executes 5 sequential phases in deterministic order:
  1. `receive`: Land allocation deeds are dealt and drafted.
  2. `trade`: Free-form bilateral negotiations on the OTC Liquidity Desk.
  3. `build`: Protocol modules from player inventories are deployed to vacant owned parcels.
  4. `income`: Annual yield is calculated for all connected clusters and disbursed into player cash.
  5. `ended`: Reached only after Epoch 6 yield harvest, initiating final podium settlement.

### 2.2 Land Deed Drafting Schedule (`PLOT_KEEP_SCHEDULE`)

The 4-player deed drafting schedule allocates all 72 city parcels across the 6 epochs without surplus or deficit:

| Epoch | Deeds Dealt per Player | Deeds Kept per Player | Discards per Player | Total Deeds Kept (All 4 Players) | Cumulative City Parcels Claimed |
|---|---|---|---|---|---|
| Epoch 1 | 7 deeds | 5 deeds | 2 discards | 20 deeds | 20 / 72 (27.8%) |
| Epoch 2 | 6 deeds | 4 deeds | 2 discards | 16 deeds | 36 / 72 (50.0%) |
| Epoch 3 | 5 deeds | 3 deeds | 2 discards | 12 deeds | 48 / 72 (66.7%) |
| Epoch 4 | 4 deeds | 2 deeds | 2 discards | 8 deeds | 56 / 72 (77.8%) |
| Epoch 5 | 4 deeds | 2 deeds | 2 discards | 8 deeds | 64 / 72 (88.9%) |
| Epoch 6 | 4 deeds | 2 deeds | 2 discards | 8 deeds | 72 / 72 (100.0%) |
| Total | 30 dealt | 18 kept | 12 discarded | 72 kept | 72 parcels (100%) |

Drafting Rules and Invariants:
1. Deeds are dealt exclusively from currently unowned parcels (`lot.owner === null`).
2. Discarded candidate deeds return to the unclaimed parcel pool, available for dealing in subsequent epochs.
3. Every player receives exactly 18 parcels across the match, ensuring 100% parcel utilization by Epoch 6.
4. Input validation rejects duplicate lot selections, selections not present in `state.pending`, or selection counts not matching `state.draftCount`.

### 2.3 120-Tile Pool and Blind Draw Distribution

The protocol module tile bag contains exactly 120 tiles across the 6 protocol categories:
* Quota per Category: Exactly 20 tiles per category for categories 0 through 5.
* Blind Draw Schedule:
  * Epoch 1: Each player draws 5 tiles blindly from the bag (20 tiles total).
  * Epochs 2 through 6: Each player draws 4 tiles blindly per epoch (16 tiles per epoch, 80 tiles total).
* Cumulative Tiles Drawn: 20 + (5 * 16) = 100 tiles drawn across 6 epochs.
* Reserve Invariant: Exactly 20 tiles remain unseen in the bag at the conclusion of Epoch 6.
* Conservation Invariant: At every game tick, `bag.length + sum(player.tiles) + count(placedLots) === 120` holds true.

### 2.4 Six Protocol Storefront Categories

Each protocol category features a defined target size, aesthetic color, and economic profile:

| Index | Protocol Name | Code | Target Size | Accent Color | Bag Quota | Incomplete Yields | Complete Payout | Maximum Turn Yield |
|---|---|---|---|---|---|---|---|---|
| 0 | DEX Swap | DX | 3 parcels | `#39A883` | 20 tiles | 1: 10, 2: 20 $wif | 3: 50 $wif | 50 $wif |
| 1 | Memecoin Lounge | ML | 3 parcels | `#EEC353` | 20 tiles | 1: 10, 2: 20 $wif | 3: 50 $wif | 50 $wif |
| 2 | Staking Vault | SV | 4 parcels | `#B85539` | 20 tiles | 1: 10, 2: 20, 3: 40 $wif | 4: 80 $wif | 80 $wif |
| 3 | Lending Protocol | LP | 4 parcels | `#A16586` | 20 tiles | 1: 10, 2: 20, 3: 40 $wif | 4: 80 $wif | 80 $wif |
| 4 | Derivatives Exchange | DE | 5 parcels | `#587C9A` | 20 tiles | 1: 10, 2: 20, 3: 40, 4: 60 $wif | 5: 110 $wif | 110 $wif |
| 5 | Validator Citadel / Stock Token Bridge | VC / SB | 6 parcels | `#648454` | 20 tiles | 1: 10, 2: 20, 3: 40, 4: 60, 5: 80 $wif | 6: 140 $wif | 140 $wif |

### 2.5 Non-Linear Yield Payout Matrix and Modular Overflow Formula

Annual harvest payouts are calculated using the modular overflow formula:
```
annualIncome(shopType, clusterSize) = Math.floor(clusterSize / targetSize) * COMPLETE[targetSize] + INCOMPLETE[clusterSize % targetSize]
```
Where:
* `COMPLETE = [0, 0, 0, 50, 80, 110, 140]`
* `INCOMPLETE = [0, 10, 20, 40, 60, 80]`

Comprehensive Payout Matrix across all cluster sizes (1 to 12):

| Size | DEX Swap (Target 3) | Memecoin Lounge (Target 3) | Staking Vault (Target 4) | Lending Protocol (Target 4) | Derivatives Exchange (Target 5) | Validator Citadel / Stock Token Bridge (Target 6) |
|---|---|---|---|---|---|---|
| 1 | 10 $wif | 10 $wif | 10 $wif | 10 $wif | 10 $wif | 10 $wif |
| 2 | 20 $wif | 20 $wif | 20 $wif | 20 $wif | 20 $wif | 20 $wif |
| 3 | 50 $wif (Complete) | 50 $wif (Complete) | 40 $wif | 40 $wif | 40 $wif | 40 $wif |
| 4 | 60 $wif (50 + 10) | 60 $wif (50 + 10) | 80 $wif (Complete) | 80 $wif (Complete) | 60 $wif | 60 $wif |
| 5 | 70 $wif (50 + 20) | 70 $wif (50 + 20) | 90 $wif (80 + 10) | 90 $wif (80 + 10) | 110 $wif (Complete) | 80 $wif |
| 6 | 100 $wif (2x 50) | 100 $wif (2x 50) | 100 $wif (80 + 20) | 100 $wif (80 + 20) | 120 $wif (110 + 10) | 140 $wif (Complete) |
| 7 | 110 $wif (100 + 10) | 110 $wif (100 + 10) | 120 $wif (80 + 40) | 120 $wif (80 + 40) | 130 $wif (110 + 20) | 150 $wif (140 + 10) |
| 8 | 120 $wif (100 + 20) | 120 $wif (100 + 20) | 160 $wif (2x 80) | 160 $wif (2x 80) | 150 $wif (110 + 40) | 160 $wif (140 + 20) |
| 9 | 150 $wif (3x 50) | 150 $wif (3x 50) | 170 $wif (160 + 10) | 170 $wif (160 + 10) | 170 $wif (110 + 60) | 180 $wif (140 + 40) |
| 10 | 160 $wif (150 + 10) | 160 $wif (150 + 10) | 180 $wif (160 + 20) | 180 $wif (160 + 20) | 220 $wif (2x 110) | 200 $wif (140 + 60) |
| 11 | 170 $wif (150 + 20) | 170 $wif (150 + 20) | 200 $wif (160 + 40) | 200 $wif (160 + 40) | 230 $wif (220 + 10) | 220 $wif (140 + 80) |
| 12 | 200 $wif (4x 50) | 200 $wif (4x 50) | 240 $wif (3x 80) | 240 $wif (3x 80) | 240 $wif (220 + 20) | 280 $wif (2x 140) |

---

## 3. 72-Parcel Board Geometry and Orthogonal Graph Topology

### 3.1 Six Financial Districts Coordinate Specifications

The game board measures 1100 pixels wide by 730 pixels high in world coordinates. The 72 parcels are grouped into 6 district blocks with 12 parcels per block:

| District ID | District Name | Lots (0-indexed) | Display # | Accent Color | Block Offset (X, Y) |
|---|---|---|---|---|---|
| District 0 | Robinhood District | 0 to 11 | 1 to 12 | `#00C805` | (92, 100) |
| District 1 | Wall Street Quarter | 12 to 23 | 13 to 24 | `#EEC353` | (399, 105) |
| District 2 | Crypto Wharf | 24 to 35 | 25 to 36 | `#29B6F6` | (747, 120) |
| District 3 | Silicon Strip | 36 to 47 | 37 to 48 | `#AB47BC` | (156, 439) |
| District 4 | Memecoin Boulevard | 48 to 59 | 49 to 60 | `#FF7043` | (464, 404) |
| District 5 | DeFi Citadel | 60 to 71 | 61 to 72 | `#455A64` | (796, 451) |

Parcel Geometry Dimensions:
* Cell Size: 50 pixels wide by 50 pixels high.
* Cell Pitch: 52 pixels (50px cell plus 2px gutter).
* Total Parcels: Exactly 72 parcels.
* Parcels per District: Exactly 12 parcels.

### 3.2 Orthogonal Adjacency Graph and Topological Invariants

Parcels A and B are adjacent if and only if they satisfy two conditions:
1. Intra-District Co-location: `A.block === B.block` (parcels in different districts never connect across street channels).
2. Manhattan Orthogonality: `Math.abs(A.col - B.col) + Math.abs(A.row - B.row) === 1` (diagonal parcels sharing only a corner point never connect).

Empirical Graph Invariants:
* Total Undirected Graph Edges: Exactly 93 edges across the entire city board.
* Total Directed Edges: Exactly 186 directed edges.
* Cross-District Parcel Pairs: Exactly 2,160 pairs across district borders; 100% of these pairs evaluate to non-adjacent (`false`).
* Diagonal Parcel Pairs: Exactly 72 diagonal pairs within blocks; 100% of these pairs evaluate to non-adjacent (`false`).
* Self-Adjacency: 100% of parcels evaluate to non-adjacent with themselves (`false`).
* District Reachability: BFS traversal starting from any of the 12 parcels in any district visits exactly all 12 parcels of that district without crossing into any other district.

---

## 4. Building Validation, Capacity Rules, and Cluster Discovery

### 4.1 Strict Chinatown Capacity Validation (`canBuildShop`)

Chinatown enforces strict constraints on building placement to prevent players from creating un-targetable sprawling monopolies. In `src/engine/board-layout.ts`, `canBuildShop` evaluates 7 criteria:
1. Parcel Index Validity: `lotId >= 0 && lotId < 72`.
2. Shop Category Validity: `shopType >= 0 && shopType < 6`.
3. Parcel Ownership: `lots[lotId].owner === playerId`.
4. Parcel Vacancy: `lots[lotId].shop === null`.
5. Inventory Availability: `playerTileCount >= 1`.
6. Expansion Prohibition on Completed Shops: If placing the tile connects orthogonally to an adjacent friendly shop of identical type that is already marked complete (`isComplete === true`), the placement is rejected. Players cannot expand a finished business.
7. Capacity Overflow on Merging Clusters: If placing the tile bridges two or more separate clusters of identical shop type, the merged size is computed: `mergedSize = 1 + sum(adjacentClusterSizes)`. If `mergedSize > targetSize`, the placement is rejected.

### 4.2 Architectural Remediation for Capacity Validation (Milestone M-ENG-1)

Currently, `src/engine/engine.ts` defines a simplified helper `canPlace` that only verifies ownership, vacancy, and inventory count:
```typescript
// Current engine.ts:146-156
export function canPlace(state: GameState, player: number, id: number, shop: number): boolean {
  if (id < 0 || id >= state.lots.length) return false;
  const lot = state.lots[id];
  return lot.owner === player && lot.shop === null && state.players[player].tiles[shop] >= 1;
}
```
`buildTile` in `src/engine/engine.ts:401` currently calls `canPlace` rather than `canBuildShop`. This creates an invariant vulnerability where direct engine actions can place tiles next to completed shops or create oversized clusters.

Remediation Specification:
`canPlace` must be refactored to delegate directly to `canBuildShop`:
```typescript
export function canPlace(state: GameState, player: number, id: number, shop: number): boolean {
  const result = canBuildShop(state.lots, id, player, shop, state.players[player].tiles[shop] ?? 0);
  return result.valid;
}
```
This ensures that every call to `buildTile` in local matches, AI bot turns, and multiplayer packet processing strictly enforces Chinatown building capacity.

### 4.3 Cluster Recalculation on Parcel Trades (Milestone M-ENG-2)

When an occupied parcel (a parcel containing a built protocol module) is traded on the OTC desk, ownership of the parcel transfers to the counterparty:
```typescript
// Current engine.ts:597-598
for (const id of offer.give.lots) state.lots[id].owner = partner.id;
for (const id of offer.take.lots) state.lots[id].owner = proposer.id;
```
However, `executeTrade` does not re-compute `lot.isComplete` flags for the affected players. If trading an occupied parcel completes or breaks a connected cluster, the completion status remains stale until the next harvest or building action.

Remediation Specification:
Inside `executeTrade`, immediately following ownership reassignment, the engine must trigger cluster re-evaluation for both the proposer and partner:
```typescript
// Re-evaluate cluster completeness for both trading parties
const affectedPlayers = [proposer.id, partner.id];
for (const pid of affectedPlayers) {
  const playerClusters = groups(state, pid);
  for (const cluster of playerClusters) {
    for (const lotId of cluster.lots) {
      state.lots[lotId].isComplete = cluster.isComplete;
      state.lots[lotId].shopSize = cluster.targetSize;
    }
  }
}
```

---

## 5. AI Bot Personalities and Negotiation Engine

### 5.1 Persona Profiles and Valuation Divergence

The game features three distinct AI bot personas replacing the original street vendor personas from saigon-town:

| Bot ID | Name | Replaces | Archetype | Profit Margin | Risk Tolerance | Preferred Shops | Preferred Districts |
|---|---|---|---|---|---|---|---|
| Bot 1 | Sherwood | Linh | Conservative Yield Seeker | 1.04 (4% surplus) | 0.50 | DEX Swap (0), Staking Vault (2) | Robinhood (0), Crypto Wharf (2) |
| Bot 2 | Apex | Minh | High-Frequency Arbitrage Shark | 1.09 (9% to 12% surplus) | 0.20 | Derivatives (4), Validator Citadel (5) | Wall Street (1), DeFi Citadel (5) |
| Bot 3 | Luna | An | Liquid Market Maker | 1.01 (1% surplus) | 0.85 | Memecoin Lounge (1), DEX Swap (0) | Memecoin Blvd (4), Silicon Strip (3) |

### 5.2 Multi-Factor Valuation Formulations

Asset valuations dynamically evolve across the 6 epochs to reflect remaining yield compounding:

1. Tile Valuation (`calculateTileValue`):
```
tileValue = 10 + (matchingTilesOwned * 8) + (canCompleteNow ? 25 : 0) + (7 - currentEpoch) * 3 + personaAffinityBonus
```
Tiles possess higher value in Epoch 1 (worth +18 $wif from epoch multiplier) because completed businesses pay yield over 6 consecutive harvests. In Epoch 6, the epoch multiplier drops to +3 $wif.

2. Parcel Valuation (`calculateLotValue`):
```
lotValue = 18 + (friendlyAdjacentLots * 14) + (matchingShopAdjacent ? 20 : 0) + (isOccupied ? 15 + (7 - currentEpoch) * 5 : 0) + districtAffinityBonus
```
Parcels adjacent to bot-owned lots receive a substantial premium (+14 $wif). Parcels that match adjacent incomplete shops receive +20 $wif. Occupied parcels command an additional premium reflecting future yield.

### 5.3 Bilateral Trade Evaluation and One-Click Counteroffers

When an offer is submitted to an AI bot:
1. Value Received: `valueReceived = evaluateOfferSide(offer.give, botId, state)` (assets surrendered by human player).
2. Value Surrendered: `valueSurrendered = evaluateOfferSide(offer.take, botId, state)` (assets surrendered by bot).
3. Required Value: `requiredValue = valueSurrendered * botMargin`.
4. Decision:
   * If `valueReceived >= requiredValue`: `accepted = true`, `shortfall = 0`.
   * If `valueReceived < requiredValue`: `accepted = false`, `shortfall = Math.ceil(requiredValue - valueReceived)`.
5. Counteroffer Generation:
   If `offer.give.cash + shortfall <= proposer.cash`, the bot generates a counteroffer with `give.cash = offer.give.cash + shortfall`. The human player can click "Accept Counteroffer" to instantly close the deal with cash.

### 5.4 Proactive AI Bot Trade Proposals (Milestone M-ENG-3)

`src/engine/bot.ts:673` implements `generateBotTradeOffer(botId, targetPlayerId, state)`. It identifies situations where an opponent owns an empty parcel adjacent to an incomplete bot cluster and constructs a fair cash offer to purchase the parcel.

Currently, this capability is not wired into the turn loop in `src/engine/engine.ts` or `src/app.ts`.

Remediation Specification:
1. Extend `GameState` in `src/engine/types.ts` with `incomingOffers?: TradeOffer[]`.
2. When transitioning into `trade` phase in `src/engine/engine.ts`, evaluate proactive offers:
```typescript
state.incomingOffers = [];
for (let botId = 1; botId < state.players.length; botId++) {
  const offer = generateBotTradeOffer(botId, 0, state);
  if (offer) {
    state.incomingOffers.push(offer);
  }
}
```
3. In `src/app.ts`, if `state.incomingOffers.length > 0`, display an incoming trade notification banner with options to "Inspect Deal", "Accept", "Counter", or "Decline".

---

## 6. Canonical Pure Reducer Architecture and Network Reconciliation

### 6.1 State Reducer Contract (`gameReducer`) (Milestone M-ENG-4)

Currently, `src/engine/engine.ts` exposes individual state-mutating functions (`draftPlots`, `buildTile`, `executeTrade`, `collectIncome`, `startYear`). In contrast, `src/network/room.ts` implements a custom switch statement to route incoming network actions.

To ensure perfect determinism, testability, and action logging, export a canonical pure reducer from `src/engine/engine.ts`:
```typescript
export function gameReducer(state: GameState, action: GameAction): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  switch (action.type) {
    case 'START_YEAR':
      startYear(next);
      return next;
    case 'DRAFT_PLOTS':
      draftPlots(next, action.playerId, action.lotIds);
      return next;
    case 'BEGIN_BUILD':
      beginBuild(next);
      return next;
    case 'BUILD_TILE':
      buildTile(next, action.playerId, action.lotId, action.shopType);
      return next;
    case 'EXECUTE_TRADE':
      executeTrade(next, action.offer);
      return next;
    case 'COLLECT_INCOME':
      collectIncome(next);
      return next;
    case 'NEXT_YEAR':
      nextYear(next);
      return next;
    default:
      return next;
  }
}
```

### 6.2 Network Room Relay Reconciliation

Refactor `NetworkRoom.applyAuthoritativeAction` in `src/network/room.ts` to call `gameReducer(this.state, action)` directly rather than executing fragmented action handlers. This guarantees that local single-player execution and authoritative multiplayer host execution produce 100% identical state transitions.

---

## 7. Thematic Alignment and Stock Token Bridge Integration (Milestone M-ENG-5)

### 7.1 Category 5 Renaming

In accordance with `docs/COMPETITION.md` and `docs/TUNG_LEE_CHECKLIST.md` item 58, Category 5 is designated as `Validator Citadel / Stock Token Bridge` (code: `VC/SB` or alias `SB`, Size 6, Color `#648454`).
* Update `SHOPS[5].name` in `src/engine/engine.ts` to `Stock Token Bridge (Validator Citadel)`.
* Update `SHOP_CATEGORIES[5].name` in `src/engine/board-layout.ts`.
* Ensure that the HUD and trade desk prominently display the Stock Token Bridge branding.

### 7.2 In-Game Rules and Payout Modal

Implement a lightweight, dismissible "How to Play and Payout Table" modal in `src/ui/hud.ts`:
* Visual breakdown of the 6 protocol categories and target sizes (3 to 6).
* Complete non-linear payout table (complete bonus vs incomplete rewards).
* 72-parcel geometry and orthogonal connectivity rules.
* $wif tokenomics flywheel summary (5% burn, 1% trade tax, 1.20x staking boost).

---

## 8. Milestone Execution Plan (M-ENG-1 through M-ENG-5)

```
+---------------------------------------------------------------------------------------------------+
|                           MILESTONE DELIVERY SEQUENCE: GAME ENGINE                                |
+---------------------------------------------------------------------------------------------------+
| M-ENG-1: Capacity Validation Invariant Hardening (`canBuildShop` parity in `engine.ts`)           |
| M-ENG-2: Cluster Recalculation on Parcel Trades (`isComplete` refresh in `executeTrade`)         |
| M-ENG-3: Proactive AI Bot Trade Offer Engine & UI Notification Integration                        |
| M-ENG-4: Canonical Pure Reducer Architecture (`gameReducer`) & Network Room Delegation            |
| M-ENG-5: Category 5 Thematic Alignment (`Stock Token Bridge`) & In-Game Rules Modal              |
+---------------------------------------------------------------------------------------------------+
```

### Milestone M-ENG-1: Capacity Validation Invariant Hardening
* Objective: Guarantee that all engine-level tile placements strictly enforce Chinatown building capacity limits.
* Deliverables:
  1. Refactor `canPlace` in `src/engine/engine.ts` to call `canBuildShop` from `src/engine/board-layout.ts`.
  2. Reject placements adjacent to completed shops of the same type.
  3. Reject placements that bridge clusters exceeding target capacity.
  4. Add unit tests in `tests/unit/engine.test.ts` verifying rejection of oversized merges and expansion of complete shops.
* Dependencies: None.
* Automated Verification: `node --import tsx --test tests/unit/engine.test.ts tests/unit/board-layout.test.ts`

### Milestone M-ENG-2: Cluster Recalculation on Parcel Trades
* Objective: Ensure that trading occupied parcels immediately updates cluster completeness and target size flags for both players.
* Deliverables:
  1. Update `executeTrade` in `src/engine/engine.ts` to re-run `groups(state, playerId)` for both the proposer and partner immediately following parcel reassignment.
  2. Synchronize `lot.isComplete` and `lot.shopSize` across all lots in affected clusters.
  3. Add unit tests in `tests/unit/engine.test.ts` testing parcel trades that complete a recipient cluster or fracture a surrendered cluster.
* Dependencies: Milestone M-ENG-1.
* Automated Verification: `node --import tsx --test tests/unit/engine.test.ts`

### Milestone M-ENG-3: Proactive AI Bot Trade Offer Engine
* Objective: Enable AI bots to proactively propose mutually beneficial deals to the human player during the `trade` phase.
* Deliverables:
  1. Add `incomingOffers?: TradeOffer[]` to `GameState` in `src/engine/types.ts`.
  2. Populate `state.incomingOffers` upon entering `trade` phase using `generateBotTradeOffer` across all active bots.
  3. Update `src/app.ts` to surface incoming offer banners with one-click review, accept, counter, and decline buttons.
  4. Add unit tests in `tests/unit/bot.test.ts` verifying proactive offer generation across all 3 personas.
* Dependencies: Milestone M-ENG-2.
* Automated Verification: `node --import tsx --test tests/unit/bot.test.ts`

### Milestone M-ENG-4: Canonical Pure Reducer Architecture
* Objective: Unify local engine transitions and network authoritative action execution under a single pure reducer function.
* Deliverables:
  1. Export `gameReducer(state: GameState, action: GameAction): GameState` from `src/engine/engine.ts`.
  2. Refactor `NetworkRoom.applyAuthoritativeAction` in `src/network/room.ts` to delegate action transitions to `gameReducer`.
  3. Add unit tests in `tests/unit/network.test.ts` confirming identical state progression between local reducer execution and network room relay.
* Dependencies: Milestone M-ENG-3.
* Automated Verification: `node --import tsx --test tests/unit/network.test.ts`

### Milestone M-ENG-5: Category 5 Thematic Alignment & In-Game Rules Reference
* Objective: Promote the Stock Token Bridge hackathon theme and provide an accessible in-game rules modal.
* Deliverables:
  1. Update Category 5 naming to `Stock Token Bridge (Validator Citadel)` across `src/engine/engine.ts` and `src/engine/board-layout.ts`.
  2. Add dismissible "How to Play and Payout Table" modal in `src/ui/hud.ts`.
  3. Verify zero non-English strings across all engine constants.
  4. Confirm all existing unit and e2e tests pass with code 0.
* Dependencies: Milestone M-ENG-4.
* Automated Verification: `npm run typecheck && npm test`

---

## 9. Tung Lee Checklist Mapping: Core Game Engine Subsystem

All action items from `docs/TUNG_LEE_CHECKLIST.md` pertaining to rules, math, and engine logic are mapped directly to concrete deliverables:

| Checklist Item | Description | Target Milestone | Deliverable File | Verification Method |
|---|---|---|---|---|
| Item 71 to 77 | 6-Epoch Phase Transition Pacing & Visual Beats | Milestone M-ENG-3 | `src/app.ts`, `src/ui/hud.ts` | Phase banner integration test |
| Item 78 to 80 | Proactive AI Bot Trade Proposals & Counteroffers | Milestone M-ENG-3 | `src/engine/bot.ts`, `src/engine/engine.ts` | Unit test in `bot.test.ts` |
| Item 81 to 82 | Interactive Rules Overlay & Payout Table Modal | Milestone M-ENG-5 | `src/ui/hud.ts` | DOM inspection in `hud.test.ts` |
| Item 83 to 86 | Multiplayer Room Lobby & Sync UX | Milestone M-ENG-4 | `src/network/room.ts`, `src/app.ts` | Network test in `network.test.ts` |
| Item 91 to 94 | 72-Parcel Allocation & Deed Drafting Schedule | Milestone M-ENG-1 | `src/engine/engine.ts` | Tier 1 test F5-2, Tier 5 seed test |
| Item 95 to 97 | 120-Tile Pool Conservation & Blind Draw Schedule | Milestone M-ENG-1 | `src/engine/engine.ts` | Invariant test in `engine.test.ts` |
| Item 98 to 100 | Strict Orthogonal Adjacency & Cluster Payouts | Milestone M-ENG-1 | `src/engine/board-layout.ts` | Adjacency test in `board-layout.test.ts` |
| Item 101 to 104 | Bilateral OTC Trading Rules & Micro-Tax | Milestone M-ENG-2 | `src/engine/engine.ts` | Trade test in `engine.test.ts` |

---

## 10. Automated Verification Suite Specifications

Every milestone in this execution plan is verified through automated CLI commands without requiring manual interaction:

1. Invariant Conservation Verification:
```bash
node --import tsx --test tests/unit/engine.test.ts
```
Confirms 72 parcels, 120 tiles, and cash balances remain conserved across 100 simulated turns.

2. Adjacency Graph and Topology Verification:
```bash
node --import tsx --test tests/unit/board-layout.test.ts
```
Verifies 93 undirected edges, 0 cross-district connections, 0 diagonal connections, and 12-parcel district reachability.

3. Bot Heuristics and Negotiation Verification:
```bash
node --import tsx --test tests/unit/bot.test.ts
```
Validates valuation formulas, profit margins (1.04, 1.09, 1.01), shortfall calculations, and proactive trade offer generation.

4. Comprehensive Engine Regression Test:
```bash
npm run typecheck && npm test
```
Confirms 0 TypeScript errors and 100% green exit code across all 517+ automated tests.
