# TEST_READY: robin-town Verification Suite Specification

## Overview

This document specifies the automated test architecture, runner configuration, execution commands, and comprehensive 5-tier verification matrix for robin-town. Built to fulfill all requirements in ORIGINAL_REQUEST.md (§ R1 through § R5) and TEST_INFRA.md, this suite guarantees 100% deterministic, offline-first verification across all 12 system features.

## Test Runner and Command Matrix

All tests execute through the native Node.js test runner paired with tsx. Zero external browser drivers, zero external networks, and zero heavyweight containers are required.

| Command | Scope | Target Test Files | Timeout |
|---|---|---|---|
| `npm test` | Unified full suite (Unit + E2E) | `tests/**/*.test.ts` (491 tests) | 30s |
| `npm run test:unit` | Core engine, bot, and math | `tests/unit/**/*.test.ts` (334 tests) | 15s |
| `npm run test:e2e` | Complete 5-tier E2E verification | `tests/e2e/**/*.test.ts` (157 tests) | 30s |
| `npm run test:e2e:tier1` | Tier 1: Feature Coverage (60 tests) | `tests/e2e/tier1-features.test.ts` | 10s |
| `npm run test:e2e:tier2` | Tier 2: Boundary & Corner Cases (60 tests) | `tests/e2e/tier2-boundaries.test.ts` | 10s |
| `npm run test:e2e:tier3` | Tier 3: Pairwise Combinations (12 tests) | `tests/e2e/tier3-pairwise.test.ts` | 10s |
| `npm run test:e2e:tier4` | Tier 4: Real-World Scenarios (6 tests) | `tests/e2e/tier4-scenarios.test.ts` | 15s |
| `npm run test:e2e:tier5` | Tier 5: Adversarial Hardening (19 tests) | `tests/e2e/tier5-adversarial.test.ts` | 15s |
| `npm run test:adversarial` | Empirical stress testing harness | `scripts/adversarial-stress.ts` | 30s |

### Execution Semantics

* **Exit Code Contract**: Exit code 0 indicates 100% test passes. Any non-zero exit code indicates an assertion or runtime failure.
* **Execution Performance**: Sub-second execution for individual tiers, under 1.0 second total for all 157 E2E tests, and under 1.5 seconds for the entire 491-test unified suite.
* **Deterministic Isolation**: Seeded pseudo-random number generator (`createDeterministicRng`) guarantees byte-for-byte reproducibility across runs.

## 5-Tier Test Architecture Breakdown

The verification architecture uses a 5-tier methodology structured to test features from unit-level contracts up to full real-world match loops and white-box adversarial stress tests.

| Tier | Methodology | Target Test Count | Primary Test File | Focus Area |
|---|---|---|---|---|
| Tier 1 | Feature Coverage | 60 tests (5 per feature) | `tests/e2e/tier1-features.test.ts` | Opaque-box verification of all 12 core features through public contracts |
| Tier 2 | Boundary & Corner Cases | 60 tests (5 per feature) | `tests/e2e/tier2-boundaries.test.ts` | Extreme limits, zero values, capacity bounds, and invalid state rejections |
| Tier 3 | Cross-Feature Combinations | 12 tests (P1 to P12) | `tests/e2e/tier3-pairwise.test.ts` | Pairwise subsystem interactions sharing state, data flow, or timing |
| Tier 4 | Real-World Workload Scenarios | 6 tests (Scenario 1 to 6) | `tests/e2e/tier4-scenarios.test.ts` | End-to-end multi-round workloads, tournament matches, and economic runs |
| Tier 5 | Adversarial Coverage Hardening | 19 tests (7 suites) | `tests/e2e/tier5-adversarial.test.ts` | White-box multi-seed fuzzing, monopoly stress, burn accumulation, and room isolation |
| **Total** | **Comprehensive Matrix** | **157 tests** | **All E2E Suites** | **Complete project verification** |

## Feature Checklist and Mapping (F1 through F12)

Every inventoried feature from ORIGINAL_REQUEST.md and PROJECT.md is mapped across all tiers below:

| # | Feature Name | Source Requirement | Tier 1 Tests | Tier 2 Tests | Tier 3 Interaction | Tier 4 Scenario | Tier 5 Coverage | Status |
|---|---|---|---|---|---|---|---|---|
| F1 | Execution Plan & Thematic Docs | ORIGINAL_REQUEST § R1 | 5 tests | 5 tests | Included in F1 x F2 | Included in S1 | Docs schema integrity | READY |
| F2 | Thematic Mapping & Dictionary | ORIGINAL_REQUEST § R1 | 5 tests | 5 tests | Included in F2 x F5 | Included in S1 | M3 nomenclature mutation | READY |
| F3 | Pixel Art Asset Pipeline | ORIGINAL_REQUEST § R4 | 5 tests | 5 tests | Included in F3 x F4 | Included in S1 | Asset pipeline verification | READY |
| F4 | Visual Assets & Rendering | ORIGINAL_REQUEST § R4 | 5 tests | 5 tests | P9 (F4 x F10), P11 (F4 x F5) | Included in S1 | 65/65 asset integrity | READY |
| F5 | Core Game Engine & Rules | ORIGINAL_REQUEST § R2 | 5 tests | 5 tests | P1, P4, P7, P11 | S1, S2, S5, S6 | Suite 1, Suite 2, Suite 6 | READY |
| F6 | AI Bot Negotiation Engine | ORIGINAL_REQUEST § R2 | 5 tests | 5 tests | P1 (F5 x F6), P2 (F6 x F10) | S1, S2, S3, S5 | Suite 2 monopoly trade, M7 | READY |
| F7 | $wif Tokenomics Flywheel | ORIGINAL_REQUEST § R3 | 5 tests | 5 tests | P3, P4, P5, P6, P12 | S1, S2, S3 | Suite 3 burn run, M4, M5 | READY |
| F8 | Dual-Mode Wallet System | ORIGINAL_REQUEST § R3 | 5 tests | 5 tests | P5, P6, P8 | S2, S3, S4, S6 | Suite 7 fallback resilience, M6 | READY |
| F9 | Multiplayer Room Sessions | ORIGINAL_REQUEST § R2 | 5 tests | 5 tests | P7 (F5 x F9), P8 (F8 x F9) | S4, S6 | Suite 4 room isolation, M8 | READY |
| F10 | Web Game UI Application | ORIGINAL_REQUEST § R2 | 5 tests | 5 tests | P2, P3, P9, P10 | S1, S4 | Trade desk & camera transforms | READY |
| F11 | Single-Player Match Loop | ORIGINAL_REQUEST § R2 | 5 tests | 5 tests | P10 (F10 x F11) | S1, S6 | 25-seed full match fuzzing | READY |
| F12 | Automated Verification & Build | ORIGINAL_REQUEST § R5 | 5 tests | 5 tests | P12 (F7 x F12) | Verified across all | Suite 5 mutation sensitivities | READY |

## Tier Breakdown Details

### Tier 1: Feature Coverage (60 Tests)

Located in `tests/e2e/tier1-features.test.ts`. Exactly 5 tests for each of the 12 inventoried features:

* **F1: Execution Plan & Thematic Documentation**: Verifies document presence, 5-step structure, thematic mapping schemas, and requirement coverage.
* **F2: Thematic Mapping & English Dictionary**: Verifies 100% English terminology, shop mappings (DEX Swap, Memecoin Lounge, Staking Vault, Lending Protocol, Derivatives Exchange, Validator Citadel), district mappings, and phase nomenclature.
* **F3: Pixel Art Asset Pipeline**: Verifies PNG binary signatures, 32x32 native and 96x96 HD sprite outputs, programmatic generation scripts, and color palette adherence.
* **F4: Visual Assets & Rendering**: Verifies GAME_IMAGES manifest completeness, zero-404 asset loading, CSS image rendering properties, and nearest-neighbor interpolation.
* **F5: Core Game Engine & Rules**: Verifies 72-lot geometry, 6-year 5-phase loop, non-linear payout arithmetic, and parcel and tile conservation invariants.
* **F6: AI Bot Negotiation Engine**: Verifies Sherwood, Apex, and Luna valuation heuristics, parcel scoring formulas, counteroffer creation, and trade acceptance thresholds.
* **F7: $wif Tokenomics Flywheel**: Verifies 5% match pool burn, 5% treasury vault, 90% prize purse, 3% point swap burn tax, and 1% OTC trade micro-tax formulas.
* **F8: Dual-Mode Wallet System**: Verifies 4 pre-funded simulation accounts (10,000 $wif each), address normalization, EIP-1193 Web3 provider integration, and automatic chain switching.
* **F9: Multiplayer Room Sessions**: Verifies 6-character room codes, lobby state synchronization, seat assignments, host migration, and packet protocols.
* **F10: Web Game UI Application**: Verifies top bar calendar, player ribbon, context-sensitive action bar, inventory drawer, and trade desk view models.
* **F11: Single-Player Match Loop**: Verifies RobinTownApp coordination across all 6 years against bots, quick drafting, automated bot build, and final settlement calculation.
* **F12: Automated Verification Pipeline**: Verifies clean build execution, zero TypeScript errors (`tsc --noEmit`), asset verification scripts, and 100% green test exits.

### Tier 2: Boundary & Corner Cases (60 Tests)

Located in `tests/e2e/tier2-boundaries.test.ts`. Exactly 5 tests for each of the 12 features covering boundary conditions:

* Boundary cash limits: zero balance, negative cash rejection, balance overflow safeguards.
* Parcel extremes: all 72 parcels occupied, completely empty board, isolated lot placement.
* Shop size constraints: shop size 6 max capacity, expansion prohibition on completed shops, invalid merges exceeding target sizes.
* Trading edge cases: zero-asset empty offers, trade offers to self, circular trading loops, maximum balance transfers.
* Room edge cases: room code casing and whitespace normalization, invalid character rejections, room capacity overflow, rapid join-leave toggles.
* Wallet edge cases: zero token transfers, transfers exceeding balance, invalid chain IDs, user-rejected RPC calls.
* Asset and pipeline boundaries: explicit RangeError on negative dimensions, asset integrity validator rejection on zero-dimension PNGs, missing files, and corrupted headers.
* CLI execution boundaries: parser rejection on unknown options and non-zero exit code propagation on assertion failures.

### Tier 3: Cross-Feature Pairwise Combinations (12 Tests)

Located in `tests/e2e/tier3-pairwise.test.ts`. Focuses on pairwise integration across system boundaries:

* **P1 (F5 x F6)**: Core engine drafting loop with AI bot plotScore evaluation.
* **P2 (F6 x F10)**: Bot trade valuation integrated with TradeDeskController state machine.
* **P3 (F7 x F10)**: OTC trade execution triggering 1% micro-tax flywheel deduction.
* **P4 (F5 x F7)**: Year 6 match completion triggering 4,000 $wif match pool breakdown and 60/25/15 podium purse distribution.
* **P5 (F7 x F8)**: Off-chain wallet simulation account balance funding the 1,000 $wif match buy-in.
* **P6 (F7 x F8)**: Web3 provider connection applying 1.20x staking yield bonus on harvested income.
* **P7 (F5 x F9)**: Multiplayer room creation synchronizing pure GameState via MemoryTransport.
* **P8 (F8 x F9)**: Room reconnection preserving player seat assignments and wallet addresses.
* **P9 (F4 x F10)**: Board layout geometry projection translated through CameraController coordinate transforms.
* **P10 (F10 x F11)**: Full single-player match loop triggering procedural Web Audio cues.
* **P11 (F4 x F5)**: Complete 6-year game engine progression rendering zero-404 visual asset sprites.
* **P12 (F7 x F12)**: Point-to-$wif swap formula verification executed within automated build pipeline.

### Tier 4: Real-World Application Scenarios (6 Tests)

Located in `tests/e2e/tier4-scenarios.test.ts`. End-to-end workload simulations:

1. **Scenario 1: Complete 4-Player 6-Year AI Match (F5, F6, F7, F10, F11)**:
   Simulates all 6 years and 5 phases from initial Year 1 allocation through Year 6 podium rankings, validating state progression and settlement payouts.
2. **Scenario 2: High-Stakes Land Monopoly Trade (F5, F6, F7, F8)**:
   Simulates a multi-asset bilateral OTC trade where a player exchanges 2 adjacent parcels plus liquid $wif for a critical shop tile to complete a size 4 Staking Vault.
3. **Scenario 3: Tokenomics Deflationary Burn Run (F6, F7, F8)**:
   Simulates 10 consecutive matches tracking cumulative 5% match pool burn, 3% point swap burn, and 1% trade taxes transferred to the burn address `0x000000000000000000000000000000000000dEaD`.
4. **Scenario 4: Offline to Online Wallet Transition (F8, F9, F10)**:
   Simulates a player initiating a match in off-chain simulation mode, connecting a Web3 provider mid-session, and verifying seamless balance and address synchronization.
5. **Scenario 5: Edge-Case Block Boundary Adjacency (F5, F6)**:
   Tests shop placement and cluster analysis across district boundaries and street channels, verifying strict adherence to Chinatown contiguous placement rules.
6. **Scenario 6: Simultaneous Multiplayer Room Play (F5, F8, F9, F11)**:
   Simulates two independent 4-player game rooms running concurrently with distinct room codes, isolated memory transports, and zero cross-room state leakage.

### Tier 5: Adversarial Coverage Hardening (19 Tests)

Located in `tests/e2e/tier5-adversarial.test.ts`. Integrates empirical white-box adversarial stress tests into a formal test suite across 7 suites:

* **Suite 1: Deterministic Multi-Seed Game Engine Fuzzing (25 Seeds)**: Validates state invariants across 25 distinct pseudo-random seeds (0, 1, 42, 99, 123, 777, 1001, 1337, 2024, 2025, 2026, 9999, 12345, 67890, 111111, 314159, 271828, 987654, 1000003, 1048576, 2147483647, 4294967295, 20261030, 88888888, 55555555). Proves 72 lots conservation, monotonic deed drafting, non-negative payouts, exactly 120 tile conservation across all years, and 18 parcels per player at conclusion.
* **Suite 2: Keystone Monopoly Trade Stress & Income Jump Verification**: Proves complete shop income jump of at least +30 $wif across all 6 shop types. Executes bilateral OTC keystone parcel acquisition from Sherwood bot, rejecting greedy under-offers and accepting generous multi-parcel offers to achieve an exact +30 $wif (+150%) income jump upon DEX Swap completion.
* **Suite 3: Multi-Match Deflationary Burn Accumulation & Conservation**: Proves exact mathematical conservation across non-standard buy-in amounts (0 to 100,000 $wif), casual point swaps (0 to 99,999 points), and OTC trade micro-taxes (0 to 10,000 $wif). Simulates 10 consecutive matches tracking cumulative totals of 2,090 $wif burned, 2,030 $wif deposited in staking vault, and 36,000 $wif disbursed in tournament prizes with zero token leakage.
* **Suite 4: Concurrent Multi-Room Traffic Isolation (5 Rooms)**: Runs 5 simultaneous active network rooms (STRESS1 to STRESS5) over MemoryTransportHub, verifying complete message isolation, zero cross-room chat leakage, and independent state sequence tracking.
* **Suite 5: Invariant Mutation Sensitivity Verifications (8 Mutations)**: Validates that test assertions genuinely catch injected defects across payout curves, parcel counts, district nomenclature, buy-in burn sinks, casual point swaps, wallet initial balances, AI bot risk profiles, and room code constraints.
* **Suite 6: Board Geometry and District Isolation Enforcement**: Proves that all 72 lots in ADJACENCY_GRAPH are strictly block-internal with zero cross-district connections, prevents cross-street parcel clustering, and blocks illegal expansion of completed businesses.
* **Suite 7: Wallet Mode Transition and Resilient Fallback Handling**: Verifies seamless transitions between simulation mode and Web3 EIP-1193 providers, testing missing provider fallback, user rejection error handling, and mid-game provider disconnect recovery.

## Quality and Verification Invariants

Every test suite in robin-town enforces three inviolable domain conservation invariants:

1. **Parcel Conservation**: Exactly 72 parcels exist at all times. Parcels are never created, destroyed, or duplicated.
2. **Tile Pool Conservation**: Exactly 120 shop tiles exist across the tile bag, player racks, and board lots, with exactly 20 tiles per each of the 6 shop categories.
3. **Tokenomics Balance Conservation**: In-game currency transactions strictly account for all funds across player wallets, match pools, and burn addresses without rounding leaks or negative balances.

All tests run deterministically offline with zero external dependencies and zero flaky assertions.
