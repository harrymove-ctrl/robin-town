# Robin Town Changelog

Live Web Changelog: [https://robin-town-production.up.railway.app/changelog](https://robin-town-production.up.railway.app/changelog)
RSS 2.0 Release Feed: [https://robin-town-production.up.railway.app/changelog.xml](https://robin-town-production.up.railway.app/changelog.xml)
Atom 1.0 Release Feed: [https://robin-town-production.up.railway.app/atom.xml](https://robin-town-production.up.railway.app/atom.xml)
JSON Feed 1.1: [https://robin-town-production.up.railway.app/feed.json](https://robin-town-production.up.railway.app/feed.json)
Web Game & `$wif` Docs: [https://robin-town-production.up.railway.app/docs](https://robin-town-production.up.railway.app/docs)

## v1.6.0 (2026-11-06)

### 9-Viewport Mobile HUD, Concise 2x2 `$wif` Hub & Chain 4663 Demo Suite

1. Polished mobile 3D camera toolbar (`Pan`, `Iso`, `Street`, `Top`, `Day`, `Sunset`, `Night`), compact `10k $wif` HUD pills, and above-the-fold Start Screen layout across `375x667` and `390x844` viewports with zero clipping or text truncation.
2. Streamlined the `$wif` Hub into a concise 2x2 layout covering EIP-6963 Wallet, `1.20x` Harbor Vault Staking, Town Points Swap (`3%` burn), and 6-character WebSocket Multiplayer Rooms.
3. Fixed Shopkeeper Ledger ribbon geometry and unified Robinhood Chain Mainnet (`4663`) and official `$wif` (`0x5173b8eA6923c2d40267890D45C46a3480954773`) telemetry across the Design Notebook and 1080p60 Remotion video suite.

## v1.5.0 (2026-11-02)

### Unified Changelog Portal, Syndicated Release Feeds & Web Game Documentation

1. Launched `/changelog` with interactive category filtering, version permalinks, and auto-discovered syndication tags in `index.html` for automated release crawlers.
2. Added RFC 822 RSS 2.0 (`/changelog.xml`, `/rss.xml`, `/feed.xml`), RFC 4287 Atom 1.0 (`/atom.xml`), and JSON Feed 1.1 (`/feed.json`) feeds publishing every Robin Town ship.
3. Published comprehensive web game and smart contract documentation at `/docs` covering the 6-year turn loop, storefront `$wif` yield matrix, Zodiac Market Events, and `RobinTownHarborVault` ABI selectors.
4. Linked `/changelog`, `/docs`, and `/changelog.xml` directly inside the in-game Start Menu, How to Play modal, SSR home footer, and `/deploy` HEY Submission Studio.

## v1.4.0 (2026-11-02)

### RobinTownHarborVault Game Contract, On-Chain Match Anchoring, Soulbound RTOWN Reputation & Deploy Studio

1. Upgraded `contracts/RobinTownHarborVault.sol` (`Solc 0.8.24`, EVM `paris`) on Robinhood Chain (`4663`) with gas-only Year 6 match score anchoring (`recordHarborMatch`), Daily Seed streak protection, and soulbound Harbor Reputation (`RTOWN`) while keeping `$wif` as the sole money token.
2. Verified 100% byte-for-byte EVM runtime parity against live Robinhood Chain Mainnet RPC (`4663`) and added full Foundry unit and fork tests for staking, 50/50 deflationary `$wif` burns, and non-transferable reputation.
3. Shipped 1-Click MetaMask Contract Deployer, Blockscout Source Verifier, and HEY Submission Studio at `/deploy` with cryptographic runtime bytecode verification on `/api/wallets/vault`.
4. Wired 1-click Anchor Score On-Chain onto the Year 6 Harbor Empire Score Card and live Vault Staking (`10 $wif` threshold) inside the `$wif` Hub.

## v1.3.0 (2026-11-02)

### Zodiac Harbor Events, AI Counter-Offers, EIP-6963 Wallets & Beat My Score Links

1. Added 6 deterministic Zodiac Market Events (Harbor Cargo Surge, Night Market Festival, Morning Bake & Bloom, Merchant Guild Fair, Master Artisan Grant, Port District Boom) permuted cleanly per Daily Harbor Seed.
2. Added District Guild Majority Seals (`+15 $wif/yr` per 6+ plot majority across the 6 harbor districts) and full income Breakdown tracking in the Shopkeeper Ledger.
3. Added intelligent 1-click AI Counter-Offers and Rival Monopoly Risk warnings inside the OTC Bargaining Table.
4. Added EIP-6963 multi-wallet discovery, mobile MetaMask deep-link handoff, 1-click `wallet_watchAsset` (`$wif`), and `RobinTownHarborVault` ABI encoders on Robinhood Chain (`4663`).
5. Hardened Wallet Registry anti-spoof bounds, per-IP match submission rate limiting, dynamic OpenGraph social preview unfurling (`?room=` and `?daily=&target=`), tabletop deal pings, and Year 6 Harbor Fireworks.

## v1.2.0 (2026-11-01)

### Full-Viewport Responsive Overhaul, Harbor Wallet Registry & Daily Seed Streaks

1. Rebuilt responsive geometry across 9 desktop, tablet, compact laptop, mobile portrait, and mobile landscape viewports with zero horizontal overflow.
2. Shipped persistent Harbor Wallet Registry with gasless EIP-191 `personal_sign` ownership verification, Chain 4663 `$wif` receipt verification, and Daily Harbor Challenge leaderboards.
3. Added downloadable `1200x630` Year 6 Harbor Empire Score Cards, live OTC deal-closeness meters, and 1-click Sweeten (`+10 $wif`) bargaining.

## v1.1.0 (2026-10-31)

### Fast Play A-to-Z Simulation, Smart Draft Synergies & Interactive Coachmarks

1. Added Fast Play `1x`, `3x`, and `8x` tabletop simulation alongside bot-to-bot OTC bargaining between Cole, Maya, and Clara.
2. Added adjacent corner synergy indicators, marginal `+$wif/yr` build yield badges, and a 3-step interactive Year 1 harbor onboarding banner.
3. Upgraded cross-device WebSocket room discovery with 1-click public room joining and perspective-swapped PvP trading.

## v1.0.0 (2026-10-30)

### Robin Town Launch: 3D Harbor Diorama, 2D Street Board & Official `$wif` Flywheel

1. Launched 6-year trading board game across 72 plots, 6 harbor districts, and 6 storefront types with zero-loss switching between Three.js 3D Harbor Diorama (Day, Sunset, Night) and 2D Street Board.
2. Integrated official World is Flat (`$wif`) Mainnet token (`0x5173b8eA6923c2d40267890D45C46a3480954773`) on Robinhood Chain (`4663`) alongside Casual Town free entry and Ranked Arena pots.
