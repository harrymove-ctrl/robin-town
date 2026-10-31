# Full Engineering & Design Goal Checklist for @tung-lee

* **Repository**: https://github.com/harrymove-ctrl/robin-town
* **Collaborator**: `@tung-lee` (https://github.com/tung-lee)
* **Diorama Playbook & Code Kit Reference**: https://github.com/sloemo01/diorama (vendored in [`docs/diorama-kit/`](./diorama-kit/))
* **Hackathon**: Robinhood Chain Hackathon: Build with `$wif` (`10,000 USDG` Winner Takes All)
* **Submission Deadline**: 2 Nov 2026, 17:30 UTC

## Active GitHub Issues Tagged for `@tung-lee`

| Issue | Track | Title |
|---|---|---|
| [#6 (Pinned)](https://github.com/harrymove-ctrl/robin-town/issues/6) | **Master `/goal` Checklist** | `[Master Goal Checklist] Full Robin-Town Support Plan for @tung-lee (Diorama, Gameplay, Rules, UI/UX & $wif Flywheel)` |
| [#1](https://github.com/harrymove-ctrl/robin-town/issues/1) | **Diorama (`sloemo01/diorama`)** | `[Diorama] Integrate sloemo01/diorama Look Contract, 64-Color Palette, Inked Contours & 3-Pass Storefront Detail (@tung-lee)` |
| [#2](https://github.com/harrymove-ctrl/robin-town/issues/2) | **Gameplay Loop & AI Bots** | `[Gameplay] 6-Epoch Turn Pacing, Proactive AI Bot Trade Proposals, Rules Overlay & Multiplayer Lobby UX (@tung-lee)` |
| [#3](https://github.com/harrymove-ctrl/robin-town/issues/3) | **Rules & Math Audit** | `[Rules] Chinatown & saigon-town Rule Invariants, Adjacency Graph, Non-Linear Payouts & OTC Trade Audit (@tung-lee)` |
| [#4](https://github.com/harrymove-ctrl/robin-town/issues/4) | **UI/UX & Responsive QA** | `[UI/UX] HUD Ribbon, Two-Sided OTC Liquidity Desk, Deed & Module Drawer, and Viewport QA Overhaul (@tung-lee)` |
| [#5](https://github.com/harrymove-ctrl/robin-town/issues/5) | **Tokenomics, Wallet & Ship** | `[Tokenomics & Ship] $wif Deflationary Flywheel, Robinhood Chain Testnet Wallet, Live Deployment & Demo Video (@tung-lee)` |

---

## 0. Immediate Onboarding for `@tung-lee`

- [ ] **Accept Collaborator Invite**: Open https://github.com/harrymove-ctrl/robin-town/invitations and accept write access.
- [ ] **Clone and Verify Local Stack**:
  ```bash
  git clone https://github.com/harrymove-ctrl/robin-town.git
  cd robin-town
  npm install
  npm run verify:assets
  npm run typecheck
  npm test
  npm run dev
  ```
- [ ] **Read the Core Specifications**:
  - [`PROJECT.md`](../PROJECT.md): Architecture, interface contracts, and code layout.
  - [`docs/THEMATIC_MAPPING.md`](./THEMATIC_MAPPING.md): Mapping of Chinatown and `saigon-town` districts, shop sizes, and phases to Robin-Town.
  - [`docs/diorama-kit/SKILL.md`](./diorama-kit/SKILL.md): The `sloemo01/diorama` Look Contract, Detail Bar, Animation Bar, and Three.js / pixel post-processing templates in [`docs/diorama-kit/templates/`](./diorama-kit/templates/).

---

## 1. Diorama Visual Overhaul with `sloemo01/diorama` (Board, Camera, Palette & Post-Processing)

Our goal is to elevate the city board from a flat 2D grid into a tactile, toy-scale pixel-art miniature city following the [`sloemo01/diorama` Look Contract](./diorama-kit/SKILL.md):

- [ ] **Locked Three-Quarter Isometric / Diorama Slab Presentation** ([`src/ui/board.ts`](../src/ui/board.ts), [`src/ui/camera.ts`](../src/ui/camera.ts), [`docs/diorama-kit/templates/camera.js`](./diorama-kit/templates/camera.js)):
  - Give the 72-parcel city board (`1100x730` world space across 6 districts) a clean cut-out slab silhouette with bevelled street curbs, recessed water channel, and crisp district block plinths.
  - Support a toggleable or default three-quarter diorama perspective (`azimuth 45 deg`, `elevation 33 deg`, `fov 20.5`) or 2.5D extruded block rendering while keeping `CameraController.hitTest(screenX, screenY)` 100% deterministic for parcel picking.
- [ ] **64-Color Palette Snap, Ordered Bayer Dither & Inked Contours** ([`docs/diorama-kit/templates/palette.js`](./diorama-kit/templates/palette.js), [`docs/diorama-kit/templates/post.js`](./diorama-kit/templates/post.js), [`scripts/generate-assets.ts`](../scripts/generate-assets.ts)):
  - Apply the `sloemo01/diorama` 64-entry palette discipline, `8x8` ordered Bayer dithering on tonal ramps, and warm near-black (`0.62` mix) luminance-edge inked contours so every shop building, token disc, and district block reads as cohesive pixel art.
- [ ] **3-Pass Detail Bar for All 6 Protocol Storefronts** ([`scripts/generate-assets.ts`](../scripts/generate-assets.ts), [`src/ui/board.ts`](../src/ui/board.ts)):
  - Upgrade the 6 shop categories so each building passes the `sloemo01/diorama` 3-pass Detail Bar (1. Instant Silhouette at 1:1, 2. Construction Assemblies, 3. Story Detail + Contact Shadow):
    1. `DEX Swap` (`DX`, Size 3, `#39A883`): Dual swap arrows, orderbook ticker canopy, rooftop satellite dish.
    2. `Memecoin Lounge` (`ML`, Size 3, `#EEC353`): Neon Shiba marquee, arcade awning, velvet rope stanchions.
    3. `Staking Vault` (`SV`, Size 4, `#B85539`): Reinforced vault door wheel, bullion pillars, laser security emitters.
    4. `Lending Protocol` (`LP`, Size 4, `#A16586`): Neoclassical marble columns, collateral scales, glass atrium.
    5. `Derivatives Exchange` (`DE`, Size 5, `#587C9A`): Multi-story trading floor, candlestick holographic spire, cooling vents.
    6. `Validator Citadel` / `Stock Token Bridge` (`VC`, Size 6, `#648454`): Twin server towers, bridge skyway, golden validator beacon.
- [ ] **Contact Shadows & Toy-Scale Ambient Life** ([`docs/diorama-kit/templates/lighting.js`](./diorama-kit/templates/lighting.js), [`docs/diorama-kit/templates/peopleModel-street.js`](./diorama-kit/templates/peopleModel-street.js)):
  - Render soft radial contact shadows under every ownership token, unbuilt deed sign, and deployed shop building so props anchor to the district pavement.
  - Add subtle deterministic(`t`) ambient animations: pulsing golden halo on completed clusters, floating `+XX $wif` yield popups during Harvest, and miniature street traders walking between completed shops.
- [ ] **Deterministic `window.__diorama` QA Hook** ([`src/app.ts`](../src/app.ts), [`docs/diorama-kit/templates/qa/`](./diorama-kit/templates/qa/)):
  - Expose `window.__diorama = { freeze(t), getState(), renderAt(t) }` and `window.__dioramaReady = true` so `shoot.mjs` and `audit.mjs` can capture deterministic, race-free screenshots at any game beat.

---

## 2. Gameplay Loop & Player Experience Polish

Focus on making single-player (vs `Sherwood`, `Apex`, and `Luna`) and 4-player room matches feel fast, intuitive, and impossible to get stuck in:

- [ ] **Phase Transition Pacing & Visual Beats** ([`src/app.ts`](../src/app.ts), [`src/ui/hud.ts`](../src/ui/hud.ts)):
  - Add clear visual step banners and micro-animations when transitioning across the 5 phases of each Epoch:
    1. `Phase 1: Parcel Allocation (Receive)` -> Deed cards deal into the bottom tray and candidate lots pulse on the board.
    2. `Phase 2: OTC Liquidity Desk (Trade)` -> Bots announce their target districts/shops and can proactively propose 1-click deals to the player.
    3. `Phase 3: Protocol Deployment (Build)` -> Valid empty owned lots glow green (`validBuildLots`) when a shop module is selected in the bottom rack.
    4. `Phase 4: Yield Harvest (Income)` -> Each connected shop cluster lights up in sequence and displays its exact `$wif` payout (`COMPLETE` vs `INCOMPLETE` + `1.20x` staking boost).
    5. `Phase 5: Epoch Transition / Final Settlement` -> Year counter flips (`Epoch 1 -> 6`) or opens the Podium & Flywheel Settlement modal at the end of Epoch 6.
- [ ] **Proactive AI Bot Trade Proposals & Counteroffers** ([`src/engine/bot.ts`](../src/engine/bot.ts), [`src/ui/trade-desk.ts`](../src/ui/trade-desk.ts)):
  - During the `trade` phase, surface 1 to 2 smart incoming trade offers generated by `Sherwood` (balanced retail trader), `Apex` (aggressive monopoly hunter), or `Luna` (high-variance speculator) where a swap mutually completes or extends a cluster.
  - Ensure the **Apply Counteroffer** button in `TradeDeskModal` clearly highlights the exact `$wif` cash delta needed to close the shortfall (`evaluation.shortfall`) and stamps `ORDER FILLED` with procedural audio on execution.
- [ ] **Interactive First-Time Onboarding / Rules Overlay** ([`src/app.ts`](../src/app.ts), [`src/ui/hud.ts`](../src/ui/hud.ts)):
  - Add a lightweight, dismissible **"How to Play & Payout Table"** reference modal accessible from the top bar so new players and hackathon judges can immediately see the Shop Size Payout Curve (`Size 3..6`), Adjacency Rules, and `$wif` Flywheel without leaving the game.
- [ ] **Multiplayer Room Lobby & Cross-Tab / Online Sync UX** ([`src/network/room.ts`](../src/network/room.ts), [`src/app.ts`](../src/app.ts)):
  - Add a top-bar **"Multiplayer Room"** button wired to `openRoomModal()` so players can create a 6-character room code, switch seats (`0..3`), toggle Ready, autofill vacant seats with AI bots, and test multi-tab synchronization effortlessly.

---

## 3. Chinatown & `saigon-town` Rules Verification & Edge-Case Audit

Audit every rule in [`src/engine/engine.ts`](../src/engine/engine.ts) and [`src/engine/board-layout.ts`](../src/engine/board-layout.ts) against canonical Chinatown tabletop rules and `saigon-town`:

- [ ] **72-Parcel Allocation & Deed Drafting Schedule (`PLOT_KEEP_SCHEDULE`)**:
  - Verify the 4-player 6-Epoch deed schedule (`Keep: [5, 4, 3, 2, 2, 2]` = `18` lots per player = `72` total lots across the match).
  - Verify that candidate deeds (`state.pending`) never deal already-owned lots, and that discarded candidate deeds return cleanly to the unclaimed pool for future Epochs.
- [ ] **120-Tile Pool Conservation & Blind Draw Schedule**:
  - Verify that the tile bag starts with `120` tiles (`20` per each of the 6 shop categories `0..5`), deals `5` tiles per player in Epoch 1 (`20` total) and `4` tiles per player in Epochs 2 to 6 (`16` per epoch, `80` total), leaving `20` tiles unseen in the bag.
  - Confirm that total tiles across `bag + player racks + placed board shops` equals `120` at every frame of the match.
- [ ] **Strict Block-Internal Orthogonal Adjacency & Cluster Payouts**:
  - Verify that `plotNeighbors(lotId)` connects two lots if and only if `A.block === B.block` and `|A.col - B.col| + |A.row - B.row| === 1` (never across street channels or diagonally).
  - Verify `groupIncome(shop, count)` for incomplete clusters (`INCOMPLETE = [0, 10, 20, 40, 60, 80]`), exact complete clusters (`COMPLETE = [0, 0, 0, 50, 80, 110, 140]`), and oversized merged clusters (`Math.floor(count / target) * COMPLETE[target] + INCOMPLETE[count % target]`).
- [ ] **Bilateral OTC Trading Rules (`validateOffer` & `executeTrade`)**:
  - Verify whether only unbuilt owned lots or both unbuilt and built lots can be traded according to our chosen rule mode, and make sure the UI in `TradeDeskModal` visually distinguishes empty lots vs built lots.
  - Ensure all trades are strictly atomic: no negative cash, no duplicate lot IDs, no self-trades, and exact `1%` micro-tax deduction on net cash transferred.

---

## 4. UI/UX Overhaul (HUD, OTC Trade Desk, Drawer & Responsive Design)

Follow our 6-step UI/UX QA workflow across [`src/ui/hud.ts`](../src/ui/hud.ts), [`src/ui/trade-desk.ts`](../src/ui/trade-desk.ts), and [`src/styles/index.css`](../src/styles/index.css):

- [ ] **Top Bar & 4-Player Status Ribbon Clarity** ([`src/ui/hud.ts`](../src/ui/hud.ts), [`src/styles/index.css`](../src/styles/index.css)):
  - Display each player's liquid `$wif` balance, projected annual `+XX $wif/yr` yield from current board shops, unplaced tile count, owned parcel count, and active `1.20x STAKED` badge.
  - Make clicking any AI bot card (`Sherwood`, `Apex`, `Luna`) in the Player Ribbon during the `trade` phase immediately open the OTC Trade Desk with that bot selected as the counterparty.
- [ ] **Two-Sided OTC Liquidity Desk UX** ([`src/ui/trade-desk.ts`](../src/ui/trade-desk.ts)):
  - Improve visual hierarchy between **Your Offer (Give)** and **Counterparty Request (Take)**: show district color badges on parcel chips, shop size indicators (`Size 3..6`) on tile steppers, a live **Bot Acceptance Meter** (shortfall vs surplus), and a clear breakdown of the `1%` OTC micro-tax routed to the staking vault.
- [ ] **Bottom Dock: Deed Drafting Tray & Protocol Module Rack** ([`src/ui/hud.ts`](../src/ui/hud.ts)):
  - During `receive` (Phase 1): hovering a deed card in the bottom tray should highlight and pan/pulse the corresponding parcel on the city board; clicking either the deed card or the parcel on the board toggles selection.
  - During `build` (Phase 3): each of the 6 shop module cards in the bottom rack should display its target size (`Size 3, 4, 5, or 6`), complete payout (`50 to 140 $wif`), and current inventory count (`xN`).
- [ ] **Adversarial Browser Stress Test & Viewport Responsiveness**:
  - Verify zero overlapping panels across `1440x900` desktop, `1280x800` laptop, and `768x1024` tablet viewports.
  - Red-team rapid double-clicks on `Confirm Deeds`, `Execute Trade`, `Harvest Yield`, and `Advance Epoch`, plus keyboard shortcuts (`Q`, `T`, `Space`, `Escape`).

---

## 5. `$wif` Tokenomics Flywheel, Wallet Verification & Hackathon Submission

- [ ] **Verify All `$wif` Economic Flywheel Sinks in UI** ([`src/tokenomics/flywheel.ts`](../src/tokenomics/flywheel.ts), [`src/app.ts`](../src/app.ts)):
  - Ensure the Epoch 6 **Final Settlement Modal** clearly visualizes:
    - Total 4-player match pool (`4,000 $wif`)
    - `90%` Podium Purse distribution (`2,160 / 900 / 540 $wif`)
    - `5%` Permanent Burn (`200 $wif` to `0x000000000000000000000000000000000000dEaD`)
    - `5%` Community Staking Vault contribution (`200 $wif`)
    - Casual Treasury Points earned and one-click **Swap Points to `$wif`** (`3%` burn tax).
- [ ] **Dual-Mode Wallet & Robinhood Chain Testnet (`Chain ID 46631`)** ([`src/tokenomics/wallet.ts`](../src/tokenomics/wallet.ts)):
  - Test switching between the 4 pre-funded `10,000 $wif` simulation wallets (`Alice`, `Bob`, `Charlie`, `Dave`) and connecting a live EIP-1193 wallet (`window.ethereum`) on Robinhood Chain Testnet (`Chain ID 46631` / `0xb627`).
- [ ] **Quality Gate Before Every PR / Merge**:
  - Every PR must pass:
    ```bash
    npm run verify:assets
    npm run typecheck
    npm test
    npm run build
    ```
  - Capture deterministic before/after screenshots proving visual and UX improvements.
