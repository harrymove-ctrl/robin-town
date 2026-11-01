# Robin Town: Hackathon Submission Package and Final Checklist

## Submission Links and On-Chain Proof

* **Live Playable URL (Railway HTTPS + WSS)**: [https://robin-town-production.up.railway.app](https://robin-town-production.up.railway.app)
* **GitHub Repository**: [https://github.com/harrymove-ctrl/robin-town](https://github.com/harrymove-ctrl/robin-town)
* **Hackathon Master Demo Video (`3:20`, 1080p)**: [https://github.com/harrymove-ctrl/robin-town/releases/download/v1.0.0/robin-town-hackathon-master.mp4](https://github.com/harrymove-ctrl/robin-town/releases/download/v1.0.0/robin-town-hackathon-master.mp4) (local file: `docs/video/exports/robin-town-hackathon-master.mp4`)
* **Raylight 3D Mobile & `$wif` Economy Intro (`0:34`, 1080p)**: [https://github.com/harrymove-ctrl/robin-town/releases/download/v1.0.0/robin-town-intro.mp4](https://github.com/harrymove-ctrl/robin-town/releases/download/v1.0.0/robin-town-intro.mp4) (local file: `docs/video/exports/robin-town-intro.mp4`)
* **X Launch Cut (`0:44`, 1080p)**: [https://github.com/harrymove-ctrl/robin-town/releases/download/v1.0.0/robin-town-x-launch.mp4](https://github.com/harrymove-ctrl/robin-town/releases/download/v1.0.0/robin-town-x-launch.mp4) (local file: `docs/video/exports/robin-town-x-launch.mp4`)
* **Official World is Flat (`$wif`) Token Contract (Robinhood Chain Mainnet `4663`)**: [`0x5173b8eA6923c2d40267890D45C46a3480954773`](https://robinhoodchain.blockscout.com/token/0x5173b8eA6923c2d40267890D45C46a3480954773) (`World is Flat / WIF`, `18` decimals)
* **Verified Dead Burn Address (`113,917.82+ $wif` Burned On-Chain)**: [`0x000000000000000000000000000000000000dEaD`](https://robinhoodchain.blockscout.com/token/0x5173b8eA6923c2d40267890D45C46a3480954773?tab=holders)
* **Live On-Chain Telemetry API**: [https://robin-town-production.up.railway.app/api/onchain-wif](https://robin-town-production.up.railway.app/api/onchain-wif)
* **Live Multiplayer Rooms API**: [https://robin-town-production.up.railway.app/api/rooms](https://robin-town-production.up.railway.app/api/rooms)
* **Hackathon**: Robinhood Chain Hackathon: Build with `$wif` (`10,000 USDG` Winner Takes All)
* **Submissions Close**: 2 Nov 2026, 17:30 UTC
* **Round One Voting Closes**: 4 Nov 2026, 17:30 UTC
* **Final Voting Closes**: 6 Nov 2026, 17:30 UTC

## Ready-to-Paste Hackathon Submission Description

### Tagline
Pull up a stool, haggle for street corners in `$wif`, build connected harbor storefronts in 3D and 2D, and compound annual `$wif` yields on Robinhood Chain.

### What It Does
**Robin Town** turns pure tabletop street negotiation into a replayable `$wif` neighborhood economy on Robinhood Chain. Across 6 Zodiac Years, 4 traders (`You`, `Cole`, `Maya`, and `Clara`, or live human players across phones and laptops via 6-character WebSocket room codes) draft 72 numbered street plots across 6 harbor districts (`Sherwood`, `Clocktower`, `Harborview`, `Lantern Hall`, `Grand Market`, `Maple Lane`), draw 6 storefront categories (`Coffee House`, `Corner Bakery`, `Noodle Kitchen`, `Flower Studio`, `Silk Tailor`, `Corner Grocer`), negotiate open bundles of `$wif` cash, land deeds, and shop tiles at the two-way OTC Bargaining Table, and earn compounding annual `$wif` income from connected multi-lot chains.

Players can toggle seamlessly with zero state loss between an illustrated `1100x730` Aseprite `2D` and `3D Tilt` street board and a WebGL Three.js **3D Harbor Diorama** complete with a chamfered walnut tabletop plinth, animated turquoise waves, cargo barges, `Day / Sunset / Night` lighting presets, unified connected-cluster terraces, and warm glowing night windows.

### How `$wif` Is Put to Work (The Retention Flywheel)
1. **Zero-Cost Casual Onboarding + 3% Point-to-`$wif` Burn**: Anyone can play Casual Town immediately for free without holding crypto upfront (plus 4 pre-funded `10,000 $wif` instant test wallets). Completed deals, storefronts, and matches award **Town Points** that convert into `$wif` (`10 pts = 1 $wif`) with a **3% permanent burn** to `0x000000000000000000000000000000000000dEaD`.
2. **Ranked `1,000 $wif` Arena + 5% Match Pool Burn**: Competitive 4-player lobbies escrow `4,000 $wif`, distributing **90%** (`3,600 $wif`) to the top-3 podium (`50%` 1st, `25%` 2nd, `15%` 3rd), permanently burning **5%** (`200 $wif`) to `0x000000000000000000000000000000000000dEaD`, and routing **5%** (`200 $wif`) into the neighborhood Staking Vault.
3. **1.20x `$wif` Staking Yield Multiplier**: Staking `500 $wif` in the Vault multiplies every annual storefront payday by **1.20x**, rewarding committed `$wif` holders every game year.
4. **1% OTC Bargaining Cash Micro-Fee**: Every settled `$wif` cash transfer at the OTC Bargaining Table routes a **1% micro-fee** into the Staking Vault so active dealmaking continuously refills community yield.
5. **Community Vote Burn & Live On-Chain Verification**: Players can burn `$wif` on neighborhood governance votes (including 1-click on-chain ERC-20 `$wif` burn on Robinhood Chain Mainnet `4663`) and verify the official `World is Flat` (`$wif`) ERC-20 contract (`0x5173b8eA6923c2d40267890D45C46a3480954773`), Robinhood Chain Mainnet block heights, and the `113,917.82+ $wif` on-chain burn balance directly inside the `$wif` Hub.

## Completed Engineering & Submission Checklist

### 1. Repository and Team Onboarding
- [x] Initialize Git repository and push codebase cleanly as `harrymove-ctrl` to `https://github.com/harrymove-ctrl/robin-town`
- [x] Invite `tung-lee` (`https://github.com/tung-lee`) as a collaborator with write permissions
- [ ] Confirm final team roster (up to 4 members) and the team lead receiving wallet address on the hackathon submission form for the `10,000 USDG` prize

### 2. Live Deployment and Cross-Device Multiplayer Relay
- [x] Deploy production Docker build (`scripts/serve-prod.mjs` + `scripts/ws-relay.mjs` + `dist/`) to Railway at `https://robin-town-production.up.railway.app`
- [x] Ship cross-device RFC 6455 WebSocket multiplayer rooms (`/ws`, `/api/rooms`, and `?room=CODE6X` shareable invite links) paired with `BroadcastChannel` in `src/network/room.ts`

### 3. On-Chain `$wif` Contract and Wallet Verification
- [x] Verify live Robinhood Chain Mainnet (`https://rpc.mainnet.chain.robinhood.com`, Chain ID `4663`) and Testnet (`https://rpc.testnet.chain.robinhood.com`, Chain ID `46630`) RPC endpoints plus official `$wif` ERC-20 contract `0xE49A1C3033EcC6b804bc423021D3F71F1A3e0F9B`
- [x] Wire ERC-20 `$wif` ABI calldata encoders (`balanceOf`, `transfer`, `approve`, `burn`) and live `/api/onchain-wif` RPC burn proof (`4,600,000.60 $wif` burned on `0x000000000000000000000000000000000000dEaD`) into `src/tokenomics/wallet.ts` and the `$wif` Hub

### 4. Visual Polish, 3D Harbor Diorama, and Automated QA
- [x] Ship complete 3D Harbor Diorama (`Street`, `Iso`, `2D Match`, `Top` camera presets + `Day`, `Sunset`, `Night` atmospheres + connected multi-tile cluster plinths + shoreline boats)
- [x] Pass all `926` unit, integration, WebSocket relay, ERC-20 calldata, and Playwright browser tests (`npm run verify:assets`, `npm run typecheck`, `npm test`, `npm run build`)
- [x] Embed deterministic high-resolution `Day`, `Sunset`, `Night`, and `Iso` 3D Harbor Diorama screenshots in `docs/screenshots/` and `README.md`

### 5. Demo Videos and Final Submission Form (Before 2 Nov 2026, 17:30 UTC)
- [x] Render and master 1080p @ 30fps Hackathon Submission Video (`docs/video/exports/robin-town-hackathon-master.mp4`, `3:20`) and X Launch Video (`docs/video/exports/robin-town-x-launch.mp4`, `0:44`)
- [ ] Upload demo video and submit the live Railway URL, GitHub repository link, and `$wif` flywheel write-up on the Robinhood Chain Hackathon portal before **2 Nov 2026, 17:30 UTC**
- [ ] Share the X Launch Video (`0:44`) and playable Railway room link for Round One `$wif` community voting (2 Nov to 4 Nov 2026)
