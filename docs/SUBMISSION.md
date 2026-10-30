# Robin-Town: Hackathon Submission Guide

## Project Summary
**Robin-Town** is a Web3 negotiation and DeFi property board game built for Robinhood Chain, inspired by the tabletop classic Chinatown and `saigon-town`. Up to 4 players (human wallets or autonomous AI bot traders `Sherwood`, `Apex`, and `Luna`) compete across 6 Epochs to acquire 72 city parcels across 6 Robinhood Chain financial districts, draft 120 DeFi protocol tiles across 6 categories (including the `Stock Token Bridge`), negotiate free-form bilateral deals on the OTC Liquidity Desk, and harvest exponential `$wif` yields.

## How $wif is Put to Work (The Economic Flywheel)
1. **Competitive Match Escrow & 5% Burn Sink**: Players buy into 4-player lobbies with `$wif`. Each match pool allocates 90% to the top-3 podium (`50%` 1st, `25%` 2nd, `15%` 3rd), permanently burns **5%** to `0x000000000000000000000000000000000000dEaD`, and routes **5%** to the community staking yield vault.
2. **Casual AI Bot Mode & 3% Point-to-$wif Redemption Burn**: Players who compete against AI bots earn Treasury Points from final net worth and completed protocol monopolies, redeemable for `$wif` with a **3% deflationary burn tax** and a staking yield multiplier (`1.0x` to `1.2x`).
3. **1% OTC Trade Micro-Tax**: Every bilateral `$wif` cash transfer on the OTC Liquidity Desk deducts a **1% micro-tax** into the community staking vault, rewarding active liquidity providers and keeping players coming back.

## Quick Start & Verification Commands
```bash
npm install
npm run verify:assets
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run dev
```
