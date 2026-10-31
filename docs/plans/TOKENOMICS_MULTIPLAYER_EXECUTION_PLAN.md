# $wif Tokenomics Flywheel, Dual-Mode Wallet Connectivity, Multiplayer State Synchronization, and Automated Verification Suites Execution Plan

## 1. Executive Summary and Economic Objectives

This execution plan details the architecture and implementation roadmap for the $wif Tokenomics Flywheel, Dual-Mode Wallet Connectivity, Multiplayer State Synchronization, and Automated Verification Suites of robin-town. Built for the Robinhood Chain Hackathon ($10,000 USDG prize to single winner), the system turns Chinatown negotiation mechanics into a recurring token-sink flywheel where every match, trade, casual point swap, and prediction wager contributes to deflationary token burns on Robinhood Chain Testnet (Chain ID 46631).

Key system pillars include:
1. Mathematical Tokenomics Flywheel: Pure calculation functions managing competitive match buy-in pools (5% burn, 5% staking vault, 90% podium purse), casual point-to-$wif swaps (3% burn tax), OTC trade micro-taxes (1% fee split 50% to burn and 50% to staking vault), and continuous staking yield curves up to 50,000 $wif.
2. Prediction and Wagering Engine: Round-level prediction markets where players and spectators wager $wif on match outcomes (first completed set, epoch yield leader, district monopolies), with 5% of all prediction pools routed directly to the burn sink.
3. Dual-Mode Wallet Adapter: Frictionless onboarding through off-chain simulation with 4 pre-funded accounts (10,000 $wif each) and browser local storage persistence, combined with standard Web3 EIP-1193 provider integration supporting ERC-20 contract calls (`balanceOf`, `transfer`, `approve`, `burn`) on Robinhood Chain Testnet.
4. Resilient Multiplayer Synchronization: Authoritative host architecture with monotonic sequence counters, deterministic AI bot backfilling, heartbeat-based host failover, explicit state re-synchronization (`SYNC_REQUEST`), and pluggable WebSocket internet relays.
5. Five-Tier Automated Verification: Comprehensive testing hierarchy covering 60 feature tests, 60 boundary tests, 12 pairwise interaction tests, 6 full-match scenarios, and 19 adversarial stress tests, augmented with synthetic latency simulation (`LaggyMemoryTransport`).

```
+---------------------------------------------------------------------------------------------------+
|                         $wif ECONOMIC FLYWHEEL & NETWORKING ARCHITECTURE                          |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  |                            Competitive Match Buy-In Pool (4,000 $wif)                       |  |
|  |        5% Burn (200 $wif)  |  5% Staking Vault (200 $wif)  |  90% Purse (3,600 $wif)        |  |
|  |                                                               1st: 2,160  2nd: 900  3rd: 540 |  |
|  +---------------------------------------------------------------------------------------------+  |
|                 |                                                                 |               |
|                 v                                                                 v               |
|  +-----------------------------+   +-----------------------------+   +-------------------------+  |
|  |  Casual Point-to-$wif Swap  |   |    OTC Trade 1% Micro-Tax   |   | Round Prediction Market |  |
|  |  10 Points = 1 $wif         |   |    50% Burn Sink            |   | First Set / Yield King  |  |
|  |  3% Burn Tax                |   |    50% Staking Vault        |   | 5% Burn on Wager Pools  |  |
|  +-----------------------------+   +-----------------------------+   +-------------------------+  |
|                 |                                 |                               |               |
|                 +---------------------------------+-------------------------------+               |
|                                                   |                                               |
|                                                   v                                               |
|  +---------------------------------------------------------------------------------------------+  |
|  |                     Canonical Burn Address: 0x000...dEaD (Permanent Sinks)                  |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  |                                Dual-Mode Wallet Adapter Layer                               |  |
|  |  Mode 1: Simulation (10,000 $wif, LocalStorage) | Mode 2: Web3 ERC-20 (Chain ID 46631)       |  |
|  |  Mode 3: Resilient Fallback on Missing Provider or User Rejection (Zero Match Interruption) |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  |                          Authoritative Host Multiplayer Relay Layer                         |  |
|  |  * 6-Character Unambiguous Room Codes     * Monotonic State Sequencing (stateSeq)           |  |
|  |  * Deterministic AI Bot Autofill          * Resilient Host Migration (Heartbeat 3,000ms)    |  |
|  |  * Targeted SYNC_REQUEST Resync Handler   * Pluggable WebSocket & BroadcastChannel Relays   |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. $wif Tokenomics Flywheel and Mathematical Specifications

### 2.1 Canonical Burn Address and Flywheel Parameters

All deflationary sinks route tokens to the standard Ethereum burn address:
```typescript
export const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
```

Default Tokenomics Parameters (`DEFAULT_FLYWHEEL_CONFIG`):
* Standard Player Buy-In: 1,000 $wif.
* Competitive Match Pool Burn Rate: 0.05 (5%).
* Community Staking Vault Contribution: 0.05 (5%).
* Competitive Prize Purse Allocation: 0.90 (90%).
* Podium Shares: 60% to 1st place, 25% to 2nd place, 15% to 3rd place, 0% to 4th place.
* Casual Point Swap Exchange Rate: 0.10 (10 gameplay points = 1 $wif).
* Casual Point Swap Burn Tax: 0.03 (3%).
* OTC Bilateral Trade Micro-Tax: 0.01 (1% fee on net cash transferred).
* Trade Micro-Tax Allocation: 50% permanently burned, 50% routed to staking vault.
* Staking Multiplier Ceiling: 1.20x boost on annual harvest yields.

### 2.2 Competitive Match Buy-In Pool Accounting and Dust Conservation

For a standard 4-player competitive match:
```
totalPool = buyInPerPlayer * 4 = 1,000 * 4 = 4,000 $wif
burnedAmount = Math.floor(totalPool * 0.05) = 200 $wif
vaultAmount = Math.floor(totalPool * 0.05) = 200 $wif
purseAmount = totalPool - (burnedAmount + vaultAmount) = 3,600 $wif
```

Podium Distribution:
* 1st Place: `Math.floor(purseAmount * 0.60) = 2,160 $wif`
* 2nd Place: `Math.floor(purseAmount * 0.25) = 900 $wif`
* 3rd Place: `Math.floor(purseAmount * 0.15) = 540 $wif`
* 4th Place: `0 $wif`

Winner Dust Conservation Invariant:
To prevent truncation loss from floating point divisions across arbitrary buy-ins, integer division dust is allocated to first place:
```typescript
const distributedPurse = payouts[firstPlace] + payouts[secondPlace] + payouts[thirdPlace];
const purseDust = purseAmount - distributedPurse;
payouts[firstPlace] += purseDust;
```
This guarantees the conservation invariant: `burnedAmount + vaultAmount + sum(payouts) === totalPool`.

### 2.3 Casual Point-to-$wif Swap and Burn Tax

In casual matches without up-front buy-ins, players earn loyalty points from their final board performance:
* Base Points: 1 point per 1 $wif ending cash.
* Shop Size Points: 10 points per placed shop tile.
* Monopoly Bonus: 50 points per completed shop cluster.

Conversion to liquid $wif:
```typescript
export function calculatePointSwap(points: number, config = DEFAULT_FLYWHEEL_CONFIG): PointSwapResult {
  if (!Number.isFinite(points) || points <= 0) {
    return { points: 0, grossWif: 0, burnedWif: 0, netWif: 0 };
  }
  const grossWif = Math.floor(points * config.pointToWifRate);
  const burnedWif = Math.ceil(grossWif * config.swapBurnTax);
  const netWif = grossWif - burnedWif;
  return { points, grossWif, burnedWif, netWif };
}
```

### 2.4 OTC Trade Micro-Tax 50/50 Burn Split (Milestone M4-A)

Inspection of `src/tokenomics/flywheel.ts` line 248 revealed that `calculateTradeTax` currently allocates 100% of collected trade tax to `vaultAmount` and 0% to `burnedAmount`.

Remediation:
Align `src/tokenomics/flywheel.ts` with the project specification:
```typescript
export function calculateTradeTax(cashAmount: number, config = DEFAULT_FLYWHEEL_CONFIG): TradeTaxResult {
  if (!Number.isFinite(cashAmount) || cashAmount <= 0) {
    return { grossCash: 0, taxAmount: 0, netCash: 0, vaultAmount: 0, burnedAmount: 0 };
  }
  const taxAmount = Math.min(cashAmount, Math.ceil(cashAmount * config.tradeMicroTax));
  const burnedAmount = Math.floor(taxAmount / 2);
  const vaultAmount = taxAmount - burnedAmount;
  const netCash = cashAmount - taxAmount;
  return { grossCash: cashAmount, taxAmount, netCash, vaultAmount, burnedAmount };
}
```

### 2.5 Continuous Staking Multiplier Curve (Milestone M4-A)

Currently, `calculateStakingBoost` takes a boolean flag `isStaked` and applies a flat binary 1.20x boost.
Remediation:
Implement the continuous staking curve scaling with staked volume up to 50,000 $wif:
```typescript
export function calculateStakingBoost(baseReward: number, stakeInput: boolean | number, config = DEFAULT_FLYWHEEL_CONFIG): number {
  if (!Number.isFinite(baseReward) || baseReward <= 0) return 0;
  if (typeof stakeInput === 'boolean') {
    return stakeInput ? Math.floor(baseReward * config.stakingMultiplier) : baseReward;
  }
  const sanitizedStake = typeof stakeInput === 'number' && Number.isFinite(stakeInput) ? Math.max(0, stakeInput) : 0;
  const stakedAmount = Math.min(sanitizedStake, 50000);
  const multiplier = 1.0 + 0.20 * (stakedAmount / 50000);
  return Math.floor(baseReward * multiplier);
}
```
* 10,000 $wif staked: 1.04x yield multiplier (+4%).
* 25,000 $wif staked: 1.10x yield multiplier (+10%).
* 50,000 $wif staked: 1.20x yield multiplier (+20%).

### 2.6 Round Prediction Markets and Wagering Engine (Milestone M4-A)

Create `src/tokenomics/wagering.ts` implementing side-prediction markets:
1. Supported Prediction Types:
   * `FIRST_COMPLETED_SHOP`: Predict which player constructs the match's first complete business cluster.
   * `EPOCH_HARVEST_LEADER`: Predict which player collects the highest yield in Epoch 3 or Epoch 5.
   * `DISTRICT_MONOPOLY`: Predict which district block is first to be 100% occupied by a single player.
2. Pool Economics:
   * Players and spectators place wagers in $wif.
   * Total Wager Pool: `sum(wagers)`.
   * Deflationary Burn Sink: 5% of the total wager pool is burned permanently to `0x...dEaD` regardless of market outcome.
   * Winner Payouts: When one or more winning bets exist, 95% of the pool is distributed proportionally to bettors on the winning outcome (`payout = floor(0.95 * totalPool * (bet / winningBets))`), allocating rounding dust to the first winning bettor.
   * Orphan Pool Fallback: If zero winning bets occur (for example, no participant predicted the winning outcome or the milestone was unachieved), the 5% deflationary burn remains permanent, while the remaining 95% prize purse is refunded pro-rata to all active bettors in proportion to their initial wager (`refund = floor(bet * 0.95)`), routing any integer remainder dust to the burn address.

---

## 3. Dual-Mode Wallet System and Robinhood Chain Testnet (Milestone M4-B)

### 3.1 Network Configuration

Robinhood Chain Testnet Constants:
* Network Name: Robinhood Chain Testnet
* Chain ID (Decimal): 46631
* Chain ID (Hex): `0xb627`
* Currency Symbol: $wif
* Decimals: 18
* RPC URL: `https://rpc.testnet.robinhood.com`
* Block Explorer URL: `https://explorer.testnet.robinhood.com`

### 3.2 Mode 1: Instant Off-Chain Simulation with Storage Persistence

To ensure players can play immediately with zero setup:
1. Pre-Funded Accounts: Alice (`0x10...01`), Bob (`0x20...02`), Charlie (`0x30...03`), and Dave (`0x40...04`), each initialized with 10,000 $wif.
2. Local Storage Persistence: Save balances to `localStorage.getItem('robin_town_sim_balances')` so casual players retain their earned $wif across page refreshes.
3. Cryptographic Signatures: Simulate deterministic EIP-712 / `personal_sign` message signatures via SHA-256 string hashing (`0xsim_sig_...`).

### 3.3 Mode 2: Web3 EIP-1193 Provider Integration with ERC-20 Calls

Upgrade `src/tokenomics/wallet.ts` to support standard ERC-20 contract calls on Robinhood Chain:
1. Method Selectors:
   * `balanceOf(address)`: `0x70a08231`
   * `transfer(address,uint256)`: `0xa9059cbb`
   * `approve(address,uint256)`: `0x095ea7b3`
   * `burn(uint256)`: `0x42966c68`
2. Auto Chain Switching: Call `wallet_switchEthereumChain` with `0xb627`. If error code 4902 is returned, automatically invoke `wallet_addEthereumChain` with Robinhood Chain parameters.
3. EIP-6963 Multi-Wallet Discovery: Listen for `eip6963:announceProvider` events to detect Robinhood Wallet alongside MetaMask.

### 3.4 Mode 3: Resilient Auto-Fallback

If `window.ethereum` is absent, connection is rejected (error code 4001), or the provider emits a disconnect event, `WalletAdapter` falls back cleanly to simulation mode without throwing unhandled exceptions or disrupting turn progress.

---

## 4. Multiplayer Room Synchronization and State Relay (Milestone M4-C)

### 4.1 Room Code Generation and Validation

Room codes are 6 uppercase alphanumeric characters drawn from an unambiguous 32-character alphabet:
```typescript
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
```
Characters `I`, `O`, `0`, and `1` are excluded to eliminate visual confusion.

### 4.2 Authoritative Host Pattern and Monotonic Sequencing

1. Host Authority: The room creator acts as the authoritative host, initializing `GameState` and incrementing `stateSeq` on each valid action.
2. Client Actions: Clients dispatch `GAME_ACTION` packets containing `expectedStateSeq`.
3. Validation and Relay: The host validates seat permissions, applies `gameReducer`, increments `stateSeq`, and broadcasts `GAME_STATE_SYNC` to all peers.
4. Deterministic Bot Backfill: When the host starts a match with fewer than 4 human players, vacant seats are filled with Sherwood, Apex, or Luna.

### 4.3 Missing `SYNC_REQUEST` Packet Handler Implementation

Inspection of `src/network/room.ts` revealed that while `SYNC_REQUEST` is declared in `PacketType` and interface `SyncRequestPacket`, `handleIncomingPacket` has no `case 'SYNC_REQUEST':` handler.

Remediation:
Add explicit handler in `src/network/room.ts`:
```typescript
case 'SYNC_REQUEST': {
  if (this.isHost && this.gameState) {
    this.transport.send({
      type: 'GAME_STATE_SYNC',
      roomCode: this.roomCode,
      senderId: this.clientId,
      recipientId: packet.senderId,
      state: this.gameState,
      stateSeq: this.stateSeq,
      timestamp: Date.now()
    });
  }
  break;
}
```
This enables reconnecting clients or clients detecting a sequence gap to request an immediate, complete state snapshot.

### 4.4 Heartbeat Detection and Resilient Host Failover

1. Heartbeat Interval: Peers broadcast heartbeats every 3,000ms.
2. Disconnect Timeout: If no packet is received from the host for 9,000ms, the host is marked disconnected.
3. Failover Election: The connected peer occupying the lowest numerical seat (0 to 3) is elected as new host.
4. Announcement: The new host broadcasts `HOST_MIGRATION_ANNOUNCE` and resumes authoritative state management without match reset.

### 4.5 Pluggable WebSocket Transport Relay

To support multiplayer games across different physical devices over the internet, create `WebSocketTransport` conforming to `NetworkTransport`:
```typescript
export class WebSocketTransport implements NetworkTransport {
  constructor(private serverUrl: string, private roomCode: string, private clientId: string) {}
  // WebSocket connection, packet serialization, heartbeat routing, and reconnect logic
}
```

---

## 5. Automated Verification Hierarchy (Milestone M6)

The test suite implements an exhaustive 5-tier testing hierarchy running entirely offline with zero external network dependencies:

```
+---------------------------------------------------------------------------------------------------+
|                               5-TIER AUTOMATED TEST PYRAMID                                       |
+---------------------------------------------------------------------------------------------------+
| Tier 5: Adversarial Stress Hardening (19 Tests across 7 Suites)                                   |
| * 25-Seed Fuzzing  * Keystone Monopoly Trades  * Deflationary Accumulation  * Mutation Testing   |
+---------------------------------------------------------------------------------------------------+
| Tier 4: Real-World Workload Scenarios (6 Tests)                                                   |
| * Complete 6-Epoch Match Loop  * Wallet Transitions  * Multi-Room Concurrent Session Isolation   |
+---------------------------------------------------------------------------------------------------+
| Tier 3: Pairwise Combinatorial Interactions (12 Tests: P1 to P12)                                 |
| * Drafting + Wallet Sync  * Trade + Micro-Tax  * Overflow Payouts + Staking Boost                 |
+---------------------------------------------------------------------------------------------------+
| Tier 2: Boundary Value Analysis & Corner Cases (60 Tests)                                         |
| * Zero Balances  * Bag Depletion  * Invalid Lots  * Integer Remainder Dust Conservation           |
+---------------------------------------------------------------------------------------------------+
| Tier 1: Category-Partition Feature Coverage (60 Tests: 5 Tests per 12 Features)                  |
| * Board Geometry  * Tile Pool  * Reducer Transitions  * Bot Valuation  * Flywheel Calculations   |
+---------------------------------------------------------------------------------------------------+
```

### 5.1 Synthetic Network Impairment Testing (`LaggyMemoryTransport`)

Extend Tier 5 in `tests/e2e/tier5-adversarial.test.ts` with synthetic network impairment tests:
* Artificial Latency: Injects 150ms to 400ms synthetic delays on packet routing.
* Out-of-Order Delivery: Shuffles packet delivery order to verify that monotonic `stateSeq` guards reject stale packets.
* Packet Drop Simulation: Simulates 10% packet drop rates to prove that `SYNC_REQUEST` successfully triggers snapshot recovery.

---

## 6. Milestone Execution Plan (M4-A, M4-B, M4-C, and M6)

```
+---------------------------------------------------------------------------------------------------+
|                    MILESTONE DELIVERY SEQUENCE: TOKENOMICS & MULTIPLAYER                          |
+---------------------------------------------------------------------------------------------------+
| M4-A: Tokenomics Math Polish, 50/50 Trade Tax Split, Continuous Staking & Wagering Engine         |
| M4-B: Dual-Mode Wallet ERC-20 Encoding, Storage Persistence & Robinhood Chain Testnet Integration  |
| M4-C: Multiplayer Room SYNC_REQUEST Handler, Optimistic Queuing & WebSocket Relay                 |
| M6:   Automated Verification Hardening, Laggy Transport Suite & Framebuffer Checks                |
+---------------------------------------------------------------------------------------------------+
```

### Milestone M4-A: Tokenomics Math Polish, Continuous Staking, and Wagering
* Scope: Update `src/tokenomics/flywheel.ts` to split trade taxes 50% to burn and 50% to staking vault, implement continuous staking curve up to 50,000 $wif, create `src/tokenomics/wagering.ts` with 5% burn sink on wager pools, and extend unit tests.
* Deliverables:
  1. 50/50 trade tax burn and vault split in `calculateTradeTax`.
  2. Continuous volume-based staking curve in `calculateStakingBoost`.
  3. `src/tokenomics/wagering.ts` supporting `FIRST_COMPLETED_SHOP`, `EPOCH_HARVEST_LEADER`, and `DISTRICT_MONOPOLY`.
  4. Unit test suite in `tests/unit/tokenomics.test.ts` covering updated math.
* Automated Verification: `node --import tsx --test tests/unit/tokenomics.test.ts`

### Milestone M4-B: Dual-Mode Wallet ERC-20 Encoding and Persistence
* Scope: Add ERC-20 method call encoders (`balanceOf`, `transfer`, `approve`, `burn`), add browser storage persistence for simulation mode, and support EIP-6963 multi-wallet discovery.
* Deliverables:
  1. ERC-20 ABI encoding using 4-byte EVM selectors in `src/tokenomics/wallet.ts`.
  2. `localStorage` simulation balance persistence across page refreshes.
  3. EIP-6963 discovery support for Robinhood Wallet.
  4. Unit tests in `tests/unit/wallet.test.ts`.
* Automated Verification: `node --import tsx --test tests/unit/wallet.test.ts`

### Milestone M4-C: Multiplayer SYNC_REQUEST Handler and WebSocket Relay
* Scope: Implement `case 'SYNC_REQUEST':` in `src/network/room.ts`, implement optimistic action queuing in `src/app.ts`, and create pluggable `WebSocketTransport`.
* Deliverables:
  1. Targeted state snapshot resynchronization in `handleIncomingPacket`.
  2. Client-side optimistic action queuing with visual rollback toast notifications.
  3. Pluggable `WebSocketTransport` conforming to `NetworkTransport`.
  4. Multiplayer resynchronization tests in `tests/unit/network.test.ts`.
* Automated Verification: `node --import tsx --test tests/unit/network.test.ts`

### Milestone M6: Automated Verification Hardening and Visual QA
* Scope: Extend the 5-tier test pyramid with synthetic network latency testing, wagering tests, and verify 100% green exit code.
* Deliverables:
  1. `LaggyMemoryTransport` suite in `tests/e2e/tier5-adversarial.test.ts`.
  2. Wagering coverage across Tiers 1 through 3.
  3. Single-command test pass across all 517+ tests.
  4. Clean production build verification.
* Automated Verification: `npm run typecheck && npm test && npm run build`

---

## 7. Tung Lee Checklist Mapping: Tokenomics and Multiplayer Subsystems

All action items from `docs/TUNG_LEE_CHECKLIST.md` pertaining to tokenomics, wallet, and networking are mapped directly to concrete deliverables:

| Checklist Item | Description | Target Milestone | Deliverable File | Verification Method |
|---|---|---|---|---|
| Item 83 to 86 | Multiplayer Room Lobby & Sync UX | Milestone M4-C | `src/network/room.ts`, `src/app.ts` | Multi-seat room test |
| Item 127 to 133 | Final Settlement Modal & Flywheel Sinks | Milestone M4-A | `src/tokenomics/flywheel.ts`, `src/app.ts` | Final settlement test |
| Item 134 to 136 | Dual-Mode Wallet on Robinhood Chain 46631 | Milestone M4-B | `src/tokenomics/wallet.ts` | Wallet unit and switch test |
| Item 137 to 144 | Quality Gate Before Every PR / Merge | Milestone M6 | `package.json`, `tests/` | Full build and test suite |

---

## 8. Automated Verification Suite Specifications

Automated CLI commands verify the tokenomics, wallet, and multiplayer subsystems:

1. Tokenomics Flywheel Verification:
```bash
node --import tsx --test tests/unit/tokenomics.test.ts
```
Confirms 5% buy-in burn, 3% swap burn, 50/50 trade tax split, and continuous staking curves across 100 simulated transactions.

2. Dual-Mode Wallet Verification:
```bash
node --import tsx --test tests/unit/wallet.test.ts
```
Verifies pre-funded simulation accounts, ERC-20 method encoding, chain ID switching (46631), and resilient fallback.

3. Multiplayer Synchronization Verification:
```bash
node --import tsx --test tests/unit/network.test.ts
```
Verifies room creation, monotonic action sequencing, host failover election, and `SYNC_REQUEST` recovery.

4. Comprehensive 5-Tier Verification Suite:
```bash
npm test
```
Executes all 517+ tests across 137 test suites, confirming 100% green exit code in under 2 seconds.
