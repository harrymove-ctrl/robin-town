# Robin Town: Hackathon Submission Package and Final Checklist (`v1.6.0`)

## Submission Links and On-Chain Proof

1. **World is Flat Project Page**: [https://worldisflat.fun/build/projects/robin-town](https://worldisflat.fun/build/projects/robin-town)
2. **World is Flat Builder Updates Feed**: [https://worldisflat.fun/build/updates](https://worldisflat.fun/build/updates)
3. **Live Playable URL (Railway HTTPS + WSS)**: [https://robin-town-production.up.railway.app](https://robin-town-production.up.railway.app)
4. **Live Changelog & RSS/Atom/JSON Feeds**: [https://robin-town-production.up.railway.app/changelog](https://robin-town-production.up.railway.app/changelog) · [/changelog.xml](https://robin-town-production.up.railway.app/changelog.xml) · [/atom.xml](https://robin-town-production.up.railway.app/atom.xml) · [/feed.json](https://robin-town-production.up.railway.app/feed.json)
5. **Live Game & Smart Contract Docs Portal**: [https://robin-town-production.up.railway.app/docs](https://robin-town-production.up.railway.app/docs) · [Contract Studio (`/deploy`)](https://robin-town-production.up.railway.app/deploy)
6. **GitHub Repository**: [https://github.com/harrymove-ctrl/robin-town](https://github.com/harrymove-ctrl/robin-town)
7. **Raylight 3D Mobile & `$wif` Economy Intro (`0:34`, 1080p, `v1.6.0`)**: [https://github.com/harrymove-ctrl/robin-town/releases/download/v1.6.0/robin-town-intro.mp4](https://github.com/harrymove-ctrl/robin-town/releases/download/v1.6.0/robin-town-intro.mp4) (local file: `docs/video/exports/robin-town-intro.mp4`)
8. **X Launch Cut (`0:44`, 1080p, `v1.6.0`)**: [https://github.com/harrymove-ctrl/robin-town/releases/download/v1.6.0/robin-town-x-launch.mp4](https://github.com/harrymove-ctrl/robin-town/releases/download/v1.6.0/robin-town-x-launch.mp4) (local file: `docs/video/exports/robin-town-x-launch.mp4`)
9. **Hackathon Master Demo Video (`3:20`, 1080p)**: [https://github.com/harrymove-ctrl/robin-town/releases/download/v1.0.0/robin-town-hackathon-master.mp4](https://github.com/harrymove-ctrl/robin-town/releases/download/v1.0.0/robin-town-hackathon-master.mp4) (local file: `docs/video/exports/robin-town-hackathon-master.mp4`)
10. **Official World is Flat (`$wif`) Token Contract (Robinhood Chain Mainnet `4663`)**: [`0x5173b8eA6923c2d40267890D45C46a3480954773`](https://robinhoodchain.blockscout.com/token/0x5173b8eA6923c2d40267890D45C46a3480954773) (`World is Flat / WIF`, `18` decimals)
11. **Verified Dead Burn Address (`116,335+ $wif` Burned On-Chain)**: [`0x000000000000000000000000000000000000dEaD`](https://robinhoodchain.blockscout.com/token/0x5173b8eA6923c2d40267890D45C46a3480954773?tab=holders)
12. **Live On-Chain Telemetry API**: [https://robin-town-production.up.railway.app/api/onchain-wif](https://robin-town-production.up.railway.app/api/onchain-wif)
13. **Live Harbor Wallet & Daily Seed Registry API**: [https://robin-town-production.up.railway.app/api/wallets](https://robin-town-production.up.railway.app/api/wallets) · [/api/wallets/daily](https://robin-town-production.up.railway.app/api/wallets/daily)
14. **Live Multiplayer Rooms API**: [https://robin-town-production.up.railway.app/api/rooms](https://robin-town-production.up.railway.app/api/rooms)
15. **Smart Contract (`RobinTownHarborVault.sol`)**: [`contracts/RobinTownHarborVault.sol`](../contracts/RobinTownHarborVault.sol) (`stakeWif`, `unstakeWif`, `patronizeDistrict`, `enterRankedHarbor`, `anchorMatchScore`)
16. **Hackathon Schedule**: Submissions Close `12 Nov 2026, 17:30 UTC`, Round One `12 to 14 Nov 2026`, Final Voting `14 to 16 Nov 2026` (`10,000 USDG` Winner Takes All)

## Ready-to-Paste Hackathon Submission Description (`worldisflat.fun/build/projects/robin-town`)

### Tagline
Pull up a stool, haggle for street corners in `$wif`, build connected harbor storefronts in 3D and 2D, and compound annual `$wif` yields on Robinhood Chain.

### What It Does
**Robin Town** turns pure tabletop street negotiation into a replayable `$wif` neighborhood economy on Robinhood Chain (`Chain ID 4663`). Across 6 Zodiac Years, 4 traders (`You`, `Cole`, `Maya`, and `Clara`, or live human players across phones and laptops via 6-character WebSocket room codes) draft 72 numbered street plots across 6 harbor districts (`Sherwood`, `Clocktower`, `Harborview`, `Lantern Hall`, `Grand Market`, `Maple Lane`), draw 6 storefront categories (`Coffee House`, `Corner Bakery`, `Noodle Kitchen`, `Flower Studio`, `Silk Tailor`, `Corner Grocer`), negotiate open bundles of `$wif` cash, land deeds, and shop tiles at the two-way OTC Bargaining Table, and earn compounding annual `$wif` income from connected multi-lot chains.

Players toggle seamlessly with zero state loss between an illustrated `1100x730` Aseprite `2D` and `3D Tilt` street board and a WebGL Three.js **3D Harbor Diorama** complete with a chamfered walnut tabletop plinth, animated turquoise waves, cargo barges, `Day / Sunset / Night` lighting presets, unified connected-cluster terraces, and warm glowing night windows.

### How `$wif` Is Put to Work (The Retention Flywheel)
1. **Zero-Cost Casual Onboarding + 3% Point-to-`$wif` Burn**: Anyone can play Casual Town immediately for free without holding crypto upfront (plus 4 pre-funded `10,000 $wif` instant test wallets). Completed deals, storefronts, and matches award **Town Points** that convert into `$wif` (`10 pts = 1 $wif`) with a **3% permanent burn** to `0x000000000000000000000000000000000000dEaD`.
2. **Ranked `1,000 $wif` Arena + 5% Match Pool Burn**: Competitive 4-player lobbies escrow `4,000 $wif`, distributing **90%** (`3,600 $wif`) to the top-3 podium (`50%` 1st, `25%` 2nd, `15%` 3rd), permanently burning **5%** (`200 $wif`) to `0x000000000000000000000000000000000000dEaD`, and routing **5%** (`200 $wif`) into the neighborhood Staking Vault.
3. **1.20x `$wif` Staking Yield Multiplier & On-Chain Harbor Vault**: Staking `500 $wif` in the Vault (or staking `>= 10 $wif` in `RobinTownHarborVault.sol` on Chain `4663`) multiplies every annual storefront payday by **1.20x** and anchors Year-6 scores on-chain to mint soulbound `RTOWN` Harbor Reputation.
4. **1% OTC Bargaining Cash Micro-Fee**: Every settled `$wif` cash transfer at the OTC Bargaining Table routes a **1% micro-fee** into the Staking Vault so active dealmaking continuously refills community yield.
5. **Community Vote Burn & Live On-Chain Verification**: Players can burn `$wif` on neighborhood governance votes (including 1-click on-chain ERC-20 `$wif` burn on Robinhood Chain Mainnet `4663`) and verify the official `World is Flat` (`$wif`) ERC-20 contract (`0x5173b8eA6923c2d40267890D45C46a3480954773`), Robinhood Chain Mainnet block heights, and the `116,335+ $wif` on-chain burn balance directly inside the `$wif` Hub.

## Ready-to-Paste `v1.6.0` Builder Dispatch (`https://worldisflat.fun/build/updates`)

### Title
Robin Town v1.6.0: Mobile HUD & 2x2 `$wif` Hub Polish, Ledger Ribbon Fix, and Chain 4663 Video Suite

### Body
Shipped **Robin Town `v1.6.0`** live on [robin-town-production.up.railway.app](https://robin-town-production.up.railway.app) with a full 9-viewport UI/UX and concise copy overhaul across desktop (`1280x800`), mobile (`390x844` and `375x667`), and landscape (`844x390`):

1. **Zero-Truncation Mobile HUD & 3D Camera Bar**: Added compact `10k $wif` mobile balance formatting inside `.wif-hud-balance` so `$wif` never truncates on `375px` or `390px` screens, and centered the 7 core 3D camera and atmosphere pills (`✋ Pan · Iso · Street · Top · Day · Sunset · Night`) so every control is 100% reachable without horizontal clipping.
2. **Shopkeeper Ledger Bookmark Fix & Concise 2x2 `$wif` Hub**: Repositioned the red bookmark ribbon on the two-page Shopkeeper Ledger so `Ledger 01` is completely unobstructed, and tightened the 2x2 `$wif` Hub cards (`1. Wallet · Chain 4663`, `2. Staking & Harbor Vault`, `3. Swap Points to $wif`, `4. Online Rooms (WS + P2P)`) to pass automated UI copy density checks with zero violations.
3. **Updated Chain 4663 Remotion Video Suite & 946 Passing Tests**: Re-captured and mastered both the `0:34` Raylight 3D Mobile & `$wif` Economy Intro (`robin-town-intro.mp4`) and the `0:44` X Launch Cut (`robin-town-x-launch.mp4`) showcasing Robinhood Chain Mainnet (`Chain ID 4663`), official `$wif` (`0x5173b8…4773`), `116,335+ $wif` burned on-chain, and `946/946` passing tests across 227 suites.

Play now: https://robin-town-production.up.railway.app
Changelog & RSS: https://robin-town-production.up.railway.app/changelog
GitHub Release v1.6.0: https://github.com/harrymove-ctrl/robin-town/releases/tag/v1.6.0

## Completed Engineering & Submission Checklist

### 1. Repository and Team Onboarding
1. [x] Initialize Git repository and push codebase cleanly as `harrymove-ctrl` to `https://github.com/harrymove-ctrl/robin-town`
2. [x] Invite `tung-lee` (`https://github.com/tung-lee`) as a collaborator with write permissions
3. [x] Publish project page at `https://worldisflat.fun/build/projects/robin-town` and builder dispatches on `https://worldisflat.fun/build/updates`

### 2. Live Deployment and Cross-Device Multiplayer Relay
1. [x] Deploy production Docker build (`scripts/serve-prod.mjs` + `scripts/ws-relay.mjs` + `scripts/wallet-registry.mjs` + `scripts/ship-updates.mjs` + `dist/`) to Railway at `https://robin-town-production.up.railway.app` with persistent `/data/wallets.json` volume
2. [x] Ship cross-device RFC 6455 WebSocket multiplayer rooms (`/ws`, `/api/rooms` 1-click public lobby browser, `TOWN_STATE_SYNC` reconnect replay, live human-to-human `TOWN_TRADE_PROPOSE` OTC bargaining, and `?room=CODE6X` shareable invite links) paired with `BroadcastChannel` in `src/network/room.ts`

### 3. On-Chain `$wif` Contract and Wallet Verification
1. [x] Verify live Robinhood Chain Mainnet (`https://rpc.mainnet.chain.robinhood.com`, Chain ID `4663`) RPC endpoints plus official `World is Flat` (`$wif`) ERC-20 contract `0x5173b8eA6923c2d40267890D45C46a3480954773` and `contracts/RobinTownHarborVault.sol`
2. [x] Wire ERC-20 `$wif` ABI calldata encoders (`balanceOf`, `transfer`, `approve`, `burn`), gasless EIP-191 `personal_sign` verification (`POST /api/wallets/verify`), on-chain `eth_getTransactionReceipt` `$wif` Transfer log verifier (`POST /api/wallets/tx`), and live `/api/onchain-wif` RPC burn proof (`116,335+ $wif` burned on `0x000000000000000000000000000000000000dEaD`) into `src/tokenomics/wallet.ts` and the `$wif` Hub

### 4. Visual Polish, Daily Seed, 3D Harbor Diorama, and Automated QA (`v1.6.0`)
1. [x] Ship complete 3D Harbor Diorama (`Street`, `Iso`, `2D Match`, `Top` camera presets + `Day`, `Sunset`, `Night` atmospheres + 3D hover lot yield tooltip + 3D payday banknote & `+WIF` popups + lazy Three.js code-splitting)
2. [x] Ship `v1.6.0` 9-viewport UI/UX polish: zero-truncation `10k $wif` mobile HUD, unclipped 7-pill mobile 3D camera bar, unobstructed `Ledger 01` Shopkeeper Ledger header, and concise 2x2 `$wif` Hub
3. [x] Pass all `946` unit, integration, WebSocket relay, ERC-20 receipt verification, Daily Seed determinism, and Playwright browser tests (`npm run verify:assets`, `npm run typecheck`, `npm test`, `npm run build`)

### 5. Demo Videos and Final Submission Form (Before 12 Nov 2026, 17:30 UTC)
1. [x] Render and master 1080p @ 30fps `v1.6.0` Raylight Intro (`docs/video/exports/robin-town-intro.mp4`, `0:34`), X Launch Video (`docs/video/exports/robin-town-x-launch.mp4`, `0:44`), and Hackathon Submission Video (`docs/video/exports/robin-town-hackathon-master.mp4`, `3:20`)
2. [x] Post `v1.6.0` Builder Dispatch on `https://worldisflat.fun/build/updates` and keep `https://worldisflat.fun/build/projects/robin-town` updated ahead of Round One (`12 to 14 Nov 2026`) and Final Voting (`14 to 16 Nov 2026`)
