# Robin-Town Look, Motion & Camera Board (`Gate 2` Review)

* **Status**: Ready for Gate 2 Review (Zero code built or rendered prior to approval)
* **Resolution & Timing**: `1920x1080` (`16:9`), `30 fps`, `120 BPM` (`1 beat = 15 frames`, `1 bar = 60 frames`)
* **Design Mandate**: 100% of colors, surface textures, and fonts are inherited programmatically from Robin-Town's real CSS and TypeScript modules (`gen-palette.mjs` -> `video/src/palette.ts`). Zero foreign color fields, zero blur blobs, zero stock fonts (`Inter`, `Archivo`, `Figtree`), and zero `"mock"` strings.

---

## 1. Automated Brand Palette Inheritance (`video/src/palette.ts`)

`video/scripts/gen-palette.mjs` parses `src/styles/saigon/{base,shell,menu,robin-enhancements}.css`, `src/town/robin-town-ui.ts`, `src/town/engine.ts`, and `src/town/city-3d/{robin-city-3d,neighborhood-world}.ts` to emit `video/src/palette.ts` with exact file-and-line provenance:

| Token Name in `palette.ts` | Hex / Value | Exact Source File & Line | Visual Role in Remotion Scenes |
| :--- | :--- | :--- | :--- |
| `bgDeep` | `#112a24` | `src/styles/saigon/base.css:3` (`--deep`) | Primary motion-scene dark background canvas (replaces generic `#06080d`). |
| `bgCityStage` | `#0d2219` | `src/styles/saigon/robin-enhancements.css:198` | Outer vignette stop of `.three-city-stage` radial backdrop (`#233d32` to `#0d2219`). |
| `bgHudDark` | `#102a20` | `src/styles/saigon/robin-enhancements.css:303, 334` | Callout card surface (`rgba(16, 42, 32, 0.96)`), terminal card fill, segmented bar base. |
| `bgFelt` | `#163a30` | `src/styles/saigon/base.css:2` (`--felt`) | Secondary card fill, subtle inner panels, orbit ring surface. |
| `accentEmerald` | `#2ca56d` | `src/styles/saigon/robin-enhancements.css:359, 500` | Primary Robin emerald: Callout target ring (`2px`), `orb-swarm` core glass, `button-press` drawn tick. |
| `accentJade` | `#39a883` | `src/town/robin-town-ui.ts:81, 90` | Seat 01 (`YOU`) stool token hue, Sherwood district accent, `word-gather` traveling ink. |
| `accentMintPill` | `#8bf5b5` | `src/styles/saigon/robin-enhancements.css:43` | High-contrast chain badge text (`ROBINHOOD CHAIN · 46631`) and terminal success lines. |
| `accentGold` | `#eec353` | `src/styles/saigon/robin-enhancements.css:389, 413` | Bullion gold: `1.20x` staking badge, `punch-lines` hero punch word, Market Square accent, `dot-bloom` dots. |
| `brandWordmarkGold` | `#f1d191` | `src/styles/saigon/shell.css:52` | `ROBIN TOWN` wordmark ink in `block-wordmark` and `Lockup.tsx`. |
| `accentCoral` | `#dc6f57` | `src/town/robin-town-ui.ts:81, 90` | Deflationary `$wif` burn highlight, Merchant Row district accent, Seat 03 token hue. |
| `burnPillBg` / `burnText` | `#3d1f1a` / `#ffb899` | `src/styles/saigon/robin-enhancements.css:48-49` | `0x0000...dEaD` burn badge background and flame counter ink. |
| `parchmentLight` | `#fbf6e8` | `src/styles/saigon/robin-enhancements.css:754` | Settled headline ink on dark Harbor forest cards (`Callout` Line 1). |
| `parchmentWarm` | `#f5eedb` | `src/styles/saigon/robin-enhancements.css:731` | Secondary stat label ink and subtle card highlights. |
| `inkMuted` | `#bdd8c8` | `src/styles/saigon/robin-enhancements.css:344` | `Callout` Line 2 (`Why it helps you`) secondary body ink and leader lines (`40%` alpha). |
| `border Brass` | `#cbb98e` | `src/styles/saigon/robin-enhancements.css:732` | Subtle `1px` warm brass hairline (`rgba(203, 185, 142, 0.24)`) on Callout cards and construction grids. |
| `districtPalette` | `['#39a883', '#eec353', '#29b6f6', '#dc6f57', '#a78bfa', '#34d399']` | `src/town/robin-town-ui.ts:81` | 6-card fan deck in `@snapcn/block-wordmark` and 3D point cloud tiers in `ScatterBloom.tsx`. |
| `shopPalette` | `['#825d43', '#b7782c', '#b85539', '#a16586', '#587c9a', '#648454']` | `src/town/engine.ts:18-44` | Storefront bar fills in `MetricMorph.tsx` (`Coffee House`, `Artisan Bakery`, `Noodle Kitchen`, `Flower Studio`, `Tailor Atelier`, `Corner Grocer`). |

### Surface Texture & Typography Rules
* **Background Texture (`SolaceDitherBackdrop.tsx`)**: Every motion scene renders `bgDeep` (`#112a24`) layered with the exact SVG `feTurbulence` fractal noise grain (`base.css:32`, `opacity: 0.08`) and a frame-pure port of the SolaceUI `exposure-grid` dot/cell lattice (`robin-enhancements.css:4-13`, `opacity: 0.14`).
* **Bundled App Fonts Only (`src/styles/saigon/menu.css:2-40`)**:
  * **Wordmarks & Display Badges**: `Bungee` (`public/assets/saigon/fonts/bungee.ttf`, weight `400`).
  * **Motion Headlines, Chapter Cards & Callouts**: `Be Vietnam Pro` (`be-vietnam-regular.ttf` & `be-vietnam-bold.ttf`, weights `500`, `600`, `700`) with `font-variant-numeric: tabular-nums`.
  * **Ledger & District Medallions**: `Lora` (`lora.ttf`, weights `400`, `700`).
  * **CLI & On-Chain Hashes**: `JetBrains Mono` (`400`, `600`, `700`).

---

## 2. Motion Component Matrix (Free MIT `@snapcn/*` vs Custom Frame-Pure `video/src/scenes/*`)

All 13 `@snapcn/*` components selected below are verified **Free MIT** packages in `references/snapcn/llms.txt` and `references/snapcn/docs/`. Custom scenes are deterministic functions of `useCurrentFrame()` adapted from `/Volumes/Dev/video-effects-kit/custom-scenes/`.

### Install Command (Executed Only After Gate 2 Approval)
```bash
npx shadcn@latest add \
  @snapcn/orb-swarm \
  @snapcn/block-wordmark \
  @snapcn/laptop-frame \
  @snapcn/word-gather \
  @snapcn/text-highlight \
  @snapcn/punch-lines \
  @snapcn/button-press \
  @snapcn/cursor-track \
  @snapcn/count-grid \
  @snapcn/check-cycle \
  @snapcn/phone-stack \
  @snapcn/terminal-simulator \
  @snapcn/dot-bloom
```

### Scene-by-Scene Component Assignment

| Master Scene (X Scene) | Bars (`Frames`) | Component & Source Classification | Local Doc / Vault Reference | Key Props & Brand Overrides |
| :--- | :--- | :--- | :--- | :--- |
| **S01** (`X01`) | `1 to 4` (`0 to 240`) | `@snapcn/orb-swarm` (**Free MIT**) | `snapcn/docs/scenes/orb-swarm.md` | `mode="dark"`, `background="#112a24"`, `ink="#fbf6e8"`, `orbColor="#2ca56d"`, `softness={0}`, 4 pipe-delimited beats on `Be Vietnam Pro` `64px`. |
| **S02** (`X02`) | `5 to 6` (`240 to 360`) | `@snapcn/block-wordmark` (**Free MIT**) + `TownMark.tsx` (**Custom SVG**) | `snapcn/docs/logos/block-wordmark.md` | Text `"ROBIN TOWN"`, `fontFamily="Bungee"`, `color="#f1d191"`, `colors={palette.districtPalette}`, `blockSizing="glyph"`, `flashStagger={2}` so 10 chars resolve cleanly inside `120f`. |
| **S03** (`X03`) | `7 to 8` (`360 to 480`) | `@snapcn/laptop-frame` (**Free MIT**) | `snapcn/docs/screens/laptop-frame.md` | `entrance="open"`, `finale="zoom-to-screen"`, `showNotch={true}`, `notchLabel="Robinhood Chain 46631 · Verified $wif"`, `screenSrc={staticFile('clips/clip-01-living-town.mp4')}`. |
| **S04** (Master only) | `9 to 10` (`480 to 600`) | `@snapcn/word-gather` + `@snapcn/text-highlight` (**Free MIT**) | `snapcn/docs/text/word-gather.md`, `text-highlight.md` | Lead word `"One"`, `accent="#39a883"`, `ink="#fbf6e8"`, `preset="marker"` (`#2ca56d` `16%` tint) on `"Two instant views."` |
| **S05** (`X04`) | `11 to 24` (`600 to 1440`) | `Footage.tsx` + `Callout.tsx` (**Custom**) + `@snapcn/cursor-track` & `@snapcn/button-press` (**Free MIT**) | `custom-scenes/Footage.tsx`, `cursor/button-press.md` | `clip-01-living-town.mp4` (`1.00x`). `cursor-track` in ring-only mode (`#2ca56d`). `button-press` on `3D City ⇄` at Frame `1020`. Callouts 1 & 2 (`0 deg` flat). |
| **S06** (`X05a`) | `25 to 26` (`1440 to 1560`) | `@snapcn/punch-lines` (**Free MIT**) | `snapcn/docs/text/punch-lines.md` | `mode="dark"`, `ground="#112a24"`, `ink="#fbf6e8"`, `accentColor="#eec353"`, `accentBeat={3}`, `holds="40,40,40"`, `lead={4}`, `motionBlur={1}`. |
| **S07** (`X05b`) | `27 to 40` (`1560 to 2400`) | `Footage.tsx` + `Callout.tsx` (**Custom**) + `@snapcn/button-press` (**Free MIT**) | `custom-scenes/Callout.tsx`, `cursor/button-press.md` | `clip-02-otc-bargain.mp4` (`1.00x`). `button-press` on `Propose deal` at Frame `1935`; Callouts 3 & 4 (`0 deg` flat). |
| **S08** (Master only) | `41 to 43` (`2400 to 2580`) | `OrbitFlow.tsx` (**Custom Frame-Pure**) | `custom-scenes/scenes/OrbitFlow.tsx` | Three dashed `#cbb98e` / `#2ca56d` orbits on `#112a24` SolaceUI grid; pill stops `"01 · CLAIM DEEDS"`, `"02 · OTC BARGAIN"`, `"03 · BUILD & PAYDAY"`; whip-pan exit at Frame `2565`. |
| **S09** (`X06`) | `44 to 51` (`2580 to 3060`) | `Footage.tsx` + `Callout.tsx` (**Custom**) + `@snapcn/button-press` (**Free MIT**) | `custom-scenes/Footage.tsx` | `clip-03-payday-harvest.mp4`. Drawn tick of `button-press` lands on **Exact Downbeat Frame `2640` (`1:28.0`)** (`X06`: Frame `780` / `0:26.0`) as `$wif` banknotes fly; Callout 5 (`10.0s`). |
| **S10** (Master only) | `52 to 56` (`3060 to 3360`) | `ScatterBloom.tsx` (**Custom**) + `@snapcn/count-grid` (**Free MIT**) | `custom-scenes/scenes/ScatterBloom.tsx`, `scenes/count-grid.md` | 926 deterministic test vectors + 72 lots bloom across tilted plane (`roll: 0.33 deg`, `scale: 1.10x`); `count-grid` stamps `72 Lots`, `120 Tiles`, `3 to 6 Seats`, `926 Tests`. |
| **S11** (Master only) | `57 to 58` (`3360 to 3480`) | `@snapcn/word-gather` + `@snapcn/text-highlight` (**Free MIT**) | `snapcn/docs/text/word-gather.md` | Copy `"Play free. Stake, compete, and burn $wif."` with `preset="underline"` in `#eec353` under `"burn $wif"`. |
| **S12** (`X06`) | `59 to 66` (`3480 to 3960`) | `Footage.tsx` + `Callout.tsx` (**Custom**) + `@snapcn/button-press` (**Free MIT**) | `custom-scenes/Footage.tsx` | `clip-04-wif-flywheel.mp4`. Callout 6 (`Verified $wif on Chain 46631`); **Hero Drop 2 Downbeat Frame `3720` (`2:04.0`)** presses `Stake 500 $wif -> Activate 1.20x Boost` + `100 $wif` burn vote; Callout 7 (`6.0s`). |
| **S13** (`X06`) | `67 to 74` (`3960 to 4440`) | `MetricMorph.tsx` (**Custom Frame-Pure**) + `Footage.tsx` | `custom-scenes/scenes/MetricMorph.tsx` | `Ranked Arena · 4,000 $wif` pill collapses (`ease-in`) into deterministic bars: `90%` Purse (`#2ca56d`), `5%` Burned (`#dc6f57`), `5%` Vault (`#eec353`), `3%` Swap Burn, `1%` OTC Tax; cuts to Year 6 Standings. |
| **S14** (Master only) | `75 to 77` (`4440 to 4620`) | `@snapcn/check-cycle` (**Free MIT**) | `snapcn/docs/text/check-cycle.md` | `mode="dark"`, font overridden to `Be Vietnam Pro` (`600`), checkbox in `#2ca56d`, 5 slot rolls (`20f` each) stepping back to `80%` rest. |
| **S15** (`X07`) | `78 to 85` (`4620 to 5100`) | `Footage.tsx` + `Callout.tsx` (**Custom**) + `@snapcn/cursor-track` (**Free MIT**) | `custom-scenes/Footage.tsx` | `clip-05-gadgets-and-rooms.mp4`. Showcases `@ncdai/apple-carousel`, SolaceUI shader, `ROBIN-POD` `15 deg` click wheel detents (Callout 8, `10.0s`), and live WebSocket room lobby. |
| **S16** (Master only) | `86 to 90` (`5100 to 5400`) | `@snapcn/phone-stack` (**Free MIT**) | `snapcn/docs/screens/phone-stack.md` | `stagger={24}` on `#112a24` SolaceUI grid; 4 real `390x844` mobile & WebSocket room captures rising in stack formation. |
| **S17** (Master only) | `91 to 95` (`5400 to 5700`) | `@snapcn/terminal-simulator` (**Free MIT**) | `snapcn/docs/screens/terminal-simulator.md` | `background="#102a20"`, `borderColor="#356852"`, `fontFamily="JetBrains Mono"`, `zoom={{ enabled: true, scale: 2.2 }}`, accent `#8bf5b5`. |
| **S18** (`X08`) | `96 to 100` (`5700 to 6000`) | `@snapcn/dot-bloom` (**Free MIT**) + `Lockup.tsx` (**Custom Frame-Pure**) | `snapcn/docs/transitions/dot-bloom.md`, `custom-scenes/scenes/Lockup.tsx` | `DotBloom` re-tinted from default cream to `#112a24` ground + `#eec353` / `#2ca56d` halftone dots (`DOT_BLOOM_CUT` at Frame `5730`); `Lockup.tsx` holds `ROBIN TOWN`, `Chain ID 46631`, repo URL, and `npm install && npm run dev` still through Frame `6000`. |

### Explicitly Rejected Effects (Never Used)
* **Stock `Focus Pull` Blue/Green Blur Field**: Rejected; foreign color washes clash with `#112a24` Harbor forest green.
* **Light-Paper Scenes (`Glow Pullback`, `Ember Reveal`, `Trend Type` on white)**: Rejected; bright white full-bleed flashes break dark tabletop immersion.
* **Mock Composers (`App Reveal`, `Brief Send`, `Agent Compose`)**: Rejected; Robin-Town's real 3D Harbor diorama, OTC Bargaining Table, `$wif` Hub, and `ROBIN-POD` are shown live instead.

---

## 3. Two-State 3D Camera Rig (`video/src/Footage.tsx`)

All recorded gameplay clips (`1920x1080 @ 60fps` lossless WebM/MP4 downsampled cleanly in Remotion `<OffthreadVideo>`) occupy `>= 88%` of the 1920x1080 frame inside a deterministic `useCurrentFrame()` camera rig:

1. **Cruising State (No Callout Open)**:
   * `perspective: 1200px`
   * `rotateY (yaw)`: gentle sinusoidal sweep inside `8 deg to 14 deg` (`+11 deg` on Ch 1/3/5, `-10 deg` on Ch 2/4 for visual variety)
   * `rotateX (pitch)`: `2.5 deg to 4.0 deg`
   * `scale`: continuous `+2.5% per bar` micro-push (`1.00 -> 1.06`) so zero frames trigger `freezedetect`
   * Far-edge optical softness: `1.5px` edge mask over `#0d2219` backdrop
2. **Callout Inspection State (Whenever Callout 1 through 8 or X1/X2 Is Active)**:
   * Over `30 to 60 frames` (`0.5 to 1.0 bar`, critically damped spring `{ damping: 22, stiffness: 120 }`), the rig relaxes to **`rotateY: 0 deg, rotateX: 0 deg`** and zooms (`1.35x to 1.85x`) onto the target bounding box so every ringed UI label renders at **`>= 28px` pixel height** at 1080p.
   * Outside the `2px` `#2ca56d` target ring (`8px` padding, `>= 25px` inside `SAFE` margin), the backdrop dims by `25%` (`rgba(13, 34, 25, 0.25)`).
   * When the Callout closes, the camera eases smoothly back to its `10 deg` cruising tilt.

---

## 4. Callout Target Map & Non-Overlap Solver (`layout-callouts.py`)

Before final render at Gate 3, `video/scripts/layout-callouts.py` inspects the glyph-edge grid across middle frames of each callout to guarantee **`covered_text_cells == 0`**. Below are the DOM selectors, target bounding boxes (1920x1080 viewport), and primary clean gutter slots:

| Callout ID | Scene & Frames | DOM Target Selector | Target BBox `[x, y, w, h]` (`1080p`) | Preferred Card Slot (`0` Text Overlap) | Line 1 (`34px`, `600`, `#fbf6e8`) / Line 2 (`28px`, `500`, `#bdd8c8`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C1** | `S05` (`780 to 1020`) | `.three-city-canvas-host` (Sherwood 3D Harbor cluster) | `[397, 303, 863, 474]` | **Right Gutter** `[1200, 800, 660, 158]` | `3D Harbor Diorama, Day to Night`<br/>`Spot vacant deeds, connected shops, and golden chains instantly.` |
| **C2** | `S05` (`1080 to 1320`) | `.robin-hud-utilities .view-mode-segmented` | `[1360, 25, 177, 49]` | **Below-Left Gutter** `[1120, 112, 660, 158]` | `One-click 2D and 3D toggle`<br/>`Switch views anytime without losing plots or $wif balances.` |
| **C3** | `S07` (`1680 to 1920`) | `dialog.trade-dialog .barter-side:first-of-type .offer-tray` | `[290, 460, 422, 75]` | **Right Gutter** `[1024, 656, 660, 158]` | `Two-way OTC bargaining table`<br/>`Trade $wif, deeds, and shop tiles in one swap.` |
| **C4** | `S07` (`2040 to 2280`) | `dialog.trade-dialog .bargain-dialogue.accepted` | `[492, 473, 935, 98]` | **Below Gutter** `[624, 800, 660, 158]` | `1% OTC cash micro-fee`<br/>`Every settled cash trade feeds the neighborhood Staking Vault.` |
| **C5** | `S09` (`2700 to 3000`) | `.payday-banner` | `[740, 418, 439, 183]` | **Below Gutter** `[624, 640, 660, 158]` | `Compounding annual $wif payday`<br/>`Connected storefronts pay higher $wif yields every single year.` |
| **C6** | `S12` (`3480 to 3720`) | `dialog[data-wif-hub="true"] .wif-hub-section:nth-of-type(1)` | `[322, 241, 766, 269]` | **Right Gutter** `[1136, 288, 660, 158]` | `Verified $wif on Chain 46631`<br/>`Start free immediately, then connect your Robinhood Chain wallet.` |
| **C7** | `S12` (`3780 to 3960`) | `dialog[data-wif-hub="true"] .wif-hub-section:nth-of-type(2)` | `[322, 626, 766, 159]` | **Right Gutter** `[1136, 624, 660, 158]` | `1.20x staking and permanent burns`<br/>`Boost shop payouts while swaps and votes burn $wif.` |
| **C8** | `S15` (`4740 to 5040`) | `#robin-ipod-dock .robin-ipod-card` | `[1647, 569, 248, 428]` | **Left Gutter** `[944, 704, 660, 158]` | `Collapsible ROBIN-POD click wheel`<br/>`Control Harbor lo-fi radio and game phases one-handed.` |
| **X1** | `X04` (`360 to 480`) | `.robin-hud-utilities .view-toggle-btn` | `[1245, 25, 125, 50]` | **Below-Left Gutter** `[976, 112, 660, 158]` | `3D Harbor Diorama and 2D toggle`<br/>`Switch views anytime with zero state loss.` |
| **X2** | `X06` (`900 to 1020`) | `.wif-hud-pill` | `[322, 168, 766, 76]` | **Right Gutter** `[1136, 128, 660, 158]` | `1.20x staking and $wif burns`<br/>`Play free or compete live on Chain 46631.` |

---

## 5. Pre-Capture Hygiene & Real Testnet Proof Rules (For Gate 3)

1. **Zero `?debug=1` Overlay in Demo Captures**: Capture all 5 Playwright/Chromium 1080p clips at `http://127.0.0.1:5173/` **without** `?debug=1` so dashed QA hitboxes never appear in the film.
2. **Single Pointer Rule**: Hide the OS cursor during automated Playwright capture (`cursor: none` capture injection) when driving `@snapcn/cursor-track` + `@snapcn/button-press`, OR run `@snapcn/cursor-track` in **ring-only mode** (`pointer="none"`) when native cursor motion is recorded. Two cursors never appear on the same frame.
3. **Neutral Role Wallet Seats & Zero `"mock"` Strings**:
   * Seed `localStorage` (`robintown-flywheel-v1` & `robintown-save-v2`) with clean role seat labels (`Seat 01 · Instant Play`, `Seat 02 · Instant Play`) and connect a real EIP-1193 wallet on **Robinhood Chain Testnet (`Chain ID 46631`)** for `clip-04-wif-flywheel.mp4` so the active address, `$wif` balance, and `0x0000...dEaD` burn transaction hash on screen are 100% real (`$[real]`).
   * Preview renders carry only a single `11px` bottom-right corner watermark (`PREVIEW · TEMP SCORE`), stripped completely on final master render.
