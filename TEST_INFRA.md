# E2E Test Infra: robin-town

## Test Philosophy
* Opaque-box and requirement-driven testing derived from ORIGINAL_REQUEST.md.
* Independent verification without internal module dependencies.
* Systematic 4-tier methodology: Category-Partition, Boundary Value Analysis, Pairwise Combinatorial Testing, and Real-World Workload Testing.
* Zero external network dependency: all tests run offline deterministically using the native Node/tsx test runner or Vitest.

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|---|---|
| 1 | Execution Plan & Thematic Docs | ORIGINAL_REQUEST § R1 | 5 | 5 | yes |
| 2 | Thematic Mapping & Dictionary | ORIGINAL_REQUEST § R1 | 5 | 5 | yes |
| 3 | Pixel Art Asset Pipeline | ORIGINAL_REQUEST § R4 | 5 | 5 | yes |
| 4 | Visual Assets & Rendering | ORIGINAL_REQUEST § R4 | 5 | 5 | yes |
| 5 | Core Game Engine & Rules | ORIGINAL_REQUEST § R2 | 5 | 5 | yes |
| 6 | AI Bot Negotiation Engine | ORIGINAL_REQUEST § R2 | 5 | 5 | yes |
| 7 | $wif Tokenomics Flywheel | ORIGINAL_REQUEST § R3 | 5 | 5 | yes |
| 8 | Dual-Mode Wallet System | ORIGINAL_REQUEST § R3 | 5 | 5 | yes |
| 9 | Multiplayer Room Sessions | ORIGINAL_REQUEST § R2 | 5 | 5 | yes |
| 10 | Web Game UI Application | ORIGINAL_REQUEST § R2 | 5 | 5 | yes |
| 11 | Single-Player Match Loop | ORIGINAL_REQUEST § R2 | 5 | 5 | yes |
| 12 | Automated Verification & Build | ORIGINAL_REQUEST § R5 | 5 | 5 | yes |

## Test Architecture
* Test Runner: Node.js native test runner via tsx (`node --import tsx --test tests/**/*.test.ts` or `npm test`).
* Exit Code Semantics: 0 on all tests passing; non-zero on any assertion failure.
* Directory Layout:
  * `tests/unit/`: Logic tests for engine rules, adjacency graph, payout tables, bot valuation, and tokenomics math.
  * `tests/e2e/`: Full simulation tests for multi-round game matches, trading sequences, wallet swaps, and multiplayer room lifecycle.
* Test Format: Structured test suites with assertions on state immutability, mathematical invariants, error codes, and complete match scoring.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|---|---|---|
| 1 | Complete 4-Player 6-Year AI Match | F5, F6, F7, F10, F11 | High |
| 2 | High-Stakes Land Monopoly Trade | F5, F6, F7, F8 | High |
| 3 | Tokenomics Deflationary Burn Run | F6, F7, F8 | Medium |
| 4 | Offline to Online Wallet Transition | F8, F9, F10 | Medium |
| 5 | Edge-Case Block Boundary Adjacency | F5, F6 | Medium |
| 6 | Simultaneous Multiplayer Room Play | F5, F8, F9, F11 | High |

## Coverage Thresholds
* Total Inventoried Features (N): 12 features.
* Tier 1 (Feature Coverage): Minimum 5 per feature = 60 tests.
* Tier 2 (Boundary & Corner Cases): Minimum 5 per feature = 60 tests.
* Tier 3 (Cross-Feature Combinations): Minimum 12 interaction tests.
* Tier 4 (Real-World Scenarios): Minimum 6 realistic full-match scenarios.
* Total Minimum Tests Target: 138 test cases.
