# Robin-Town

Web3 negotiation and DeFi property board game built for the **Robinhood Chain Hackathon: Build with `$wif`**, inspired by the tabletop classic Chinatown and `saigon-town`.

Up to 4 players (human wallets or autonomous AI bot traders `Sherwood`, `Apex`, and `Luna`) compete across 6 Epochs to acquire 72 city parcels across 6 Robinhood Chain financial districts, draft 120 DeFi protocol tiles across 6 categories (including the `Stock Token Bridge`), negotiate free-form bilateral deals on the OTC Liquidity Desk, and harvest exponential `$wif` yields.

## How `$wif` Powers the Economic Flywheel

1. **Competitive Match Escrow and 5% Burn Sink**: Players buy into 4-player lobbies with `$wif` (default `1,000 $wif` per seat, `4,000 $wif` total pool). Each match pool allocates **90%** to the top-3 podium (`50%` 1st, `25%` 2nd, `15%` 3rd), permanently burns **5%** to `0x000000000000000000000000000000000000dEaD`, and routes **5%** to the community staking yield vault.
2. **Casual AI Bot Mode and 3% Point-to-`$wif` Redemption Burn**: Players competing against AI bots earn Treasury Points from final net worth, placed protocol tiles, and completed district monopolies. Points are redeemable for `$wif` (`10 points = 1 $wif`) with a **3% deflationary burn tax**.
3. **1% OTC Trade Micro-Tax**: Every bilateral `$wif` cash transfer on the OTC Liquidity Desk deducts a **1% micro-tax** into the community staking vault, rewarding active liquidity providers.
4. **1.20x Seasonal Staking Boost**: Players who stake `$wif` in the community vault earn a **1.20x yield multiplier** on every Epoch income harvest.
5. **Dual-Mode Wallet Onboarding**: Instant off-chain simulation mode with 4 pre-funded `10,000 $wif` accounts (`Alice`, `Bob`, `Charlie`, `Dave`) for zero-friction onboarding, paired with native EIP-1193 Web3 connectivity for **Robinhood Chain Testnet** (`Chain ID 46631`, `0xb627`).

## Architecture Overview

* [`src/engine/`](./src/engine): Deterministic TypeScript game engine implementing the 72-parcel adjacency graph across 6 districts, 120-tile bag conservation, 6 protocol categories (`DEX Swap`, `Memecoin Lounge`, `Staking Vault`, `Lending Protocol`, `Derivatives Exchange`, `Stock Token Bridge`), non-linear cluster payout curves, and 3 AI negotiation personas (`Sherwood`, `Apex`, `Luna`).
* [`src/tokenomics/`](./src/tokenomics): `$wif` economic flywheel math ([`flywheel.ts`](./src/tokenomics/flywheel.ts)) and dual-mode EIP-1193 / simulation wallet adapter ([`wallet.ts`](./src/tokenomics/wallet.ts)).
* [`src/network/`](./src/network): Authoritative 4-seat multiplayer room synchronization ([`room.ts`](./src/network/room.ts)) with 6-character room codes, AI bot seat autofill, and automatic host failover.
* [`src/ui/`](./src/ui): Interactive HTML5 Canvas board renderer, pan/zoom camera controller, two-sided OTC Trade Desk modal, HUD view models, and procedural Web Audio synthesizer.
* [`scripts/`](./scripts): Programmatic pixel art asset generator ([`generate-assets.ts`](./scripts/generate-assets.ts)) and zero-404 asset integrity verifier ([`verify-assets.ts`](./scripts/verify-assets.ts)).
* [`docs/`](./docs): Detailed [Execution Plan](./docs/EXECUTION_PLAN.md), [Thematic Mapping](./docs/THEMATIC_MAPPING.md), [Competition Brief](./docs/COMPETITION.md), and [Submission Guide](./docs/SUBMISSION.md).

## Quick Start

```bash
npm install
npm run dev
```

## Verification and Testing

All 491 unit and 5-tier end-to-end tests execute deterministically in under 1.5 seconds via the native Node.js test runner:

```bash
npm run verify:assets   # Verify all 65 PNG/SVG pixel art assets (zero 404s)
npm run typecheck       # Strict TypeScript 7 type checking (tsc --noEmit)
npm test                # Run all 491 unit and E2E tests
npm run test:e2e        # Run 157 5-tier E2E and adversarial tests
npm run build           # Production Vite bundle into dist/
```
