# Robin-Town: Hackathon Submission Guide and Action Checklist

## Project Summary
**Robin-Town** is a Web3 negotiation and DeFi property board game built for Robinhood Chain, inspired by the tabletop classic Chinatown and `saigon-town`. Up to 4 players (human wallets or autonomous AI bot traders `Sherwood`, `Apex`, and `Luna`) compete across 6 Epochs to acquire 72 city parcels across 6 Robinhood Chain financial districts, draft 120 DeFi protocol tiles across 6 categories (including the `Stock Token Bridge`), negotiate free-form bilateral deals on the OTC Liquidity Desk, and harvest exponential `$wif` yields.

* **GitHub Repository**: https://github.com/harrymove-ctrl/robin-town
* **Hackathon**: Robinhood Chain Hackathon: Build with `$wif` (`10,000 USDG` Winner Takes All)
* **Submissions Close**: 2 Nov 2026, 17:30 UTC
* **Round One Voting Closes**: 4 Nov 2026, 17:30 UTC
* **Final Voting Closes**: 6 Nov 2026, 17:30 UTC

## How `$wif` is Put to Work (The Economic Flywheel)
1. **Competitive Match Escrow and 5% Burn Sink**: Players buy into 4-player lobbies with `$wif`. Each match pool allocates 90% to the top-3 podium (`50%` 1st, `25%` 2nd, `15%` 3rd), permanently burns **5%** to `0x000000000000000000000000000000000000dEaD`, and routes **5%** to the community staking yield vault.
2. **Casual AI Bot Mode and 3% Point-to-`$wif` Redemption Burn**: Players who compete against AI bots earn Treasury Points from final net worth and completed protocol monopolies, redeemable for `$wif` with a **3% deflationary burn tax** and a staking yield multiplier (`1.0x` to `1.2x`).
3. **1% OTC Trade Micro-Tax**: Every bilateral `$wif` cash transfer on the OTC Liquidity Desk deducts a **1% micro-tax** into the community staking vault, rewarding active liquidity providers and keeping players coming back.

## Action Checklist (What We Need To Do Right Now)

### 1. Repository and Team Onboarding
- [x] Initialize Git repository and push codebase to `https://github.com/harrymove-ctrl/robin-town`
- [x] Invite `tung-lee` (`https://github.com/tung-lee`) as a collaborator with write permissions (`https://github.com/harrymove-ctrl/robin-town/invitations`)
- [ ] `tung-lee` accepts the GitHub collaborator invitation and clones the repository
- [ ] Confirm final team roster (up to 4 members) and the team lead receiving wallet address for the `10,000 USDG` prize

### 2. Live Deployment and Multiplayer Relay
- [ ] Deploy the production build (`npm run build` output in `dist/`) to a public HTTPS URL (Vercel, Cloudflare Pages, or Railway) so judges and voters can play immediately in browser
- [ ] Optional: Add a lightweight WebSocket or PartyKit relay alongside `BroadcastChannelTransport` in `src/network/room.ts` for cross-device online multiplayer rooms (currently supports local AI bot matches and cross-tab `BroadcastChannel` multiplayer)

### 3. On-Chain `$wif` Contract and Wallet Verification
- [ ] Verify the live Robinhood Chain RPC endpoint and official `$wif` token contract details
- [ ] Wire optional ERC-20 `$wif` contract call data in `src/tokenomics/wallet.ts` alongside the native EIP-1193 transfer flow and simulation mode
- [ ] Execute and record at least one live testnet/mainnet transaction hash as on-chain proof for the submission

### 4. Visual Polish and Live Browser QA
- [ ] Playtest full 6-Epoch matches in browser (`npm run dev`) across desktop and mobile viewports
- [ ] Capture high-resolution screenshots of the Board View, OTC Liquidity Desk negotiation, Dual-Mode Wallet Modal, and Epoch 6 Final Settlement burn breakdown for `README.md`

### 5. Demo Video and Final Submission (Before 2 Nov 2026, 17:30 UTC)
- [ ] Record a 2 to 3 minute gameplay and tokenomics pitch video demonstrating instant simulation onboarding, OTC trade negotiation with `1%` micro-tax, `Stock Token Bridge` monopoly completion, and the `5%` match pool + `3%` swap burn flywheel
- [ ] Submit the live game URL, GitHub repository link, demo video, and `$wif` flywheel write-up before **2 Nov 2026, 17:30 UTC**
- [ ] Rally community and judge support for Round One `$wif` voting (2 Nov to 4 Nov 2026)

## Quick Start and Verification Commands
```bash
npm install
npm run verify:assets
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run dev
```
