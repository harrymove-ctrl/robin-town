# Robin-Town Frame-Accurate SFX Cue Sheet (`Gate 2` Review)

* **Grid**: `120 BPM` @ `30 fps` (`1 beat = 15 frames = 0.50s`, `1 bar = 60 frames = 2.00s`)
* **Three-Layer Sound Architecture**:
  1. **Music Bed (`music.md`)**: `-18 LUFS` cruising, `-15.5 LUFS` on Drops 1 and 2.
  2. **Authentic Robin-Town WebAudio Cues (`OfflineAudioContext` WAV renders)**: Rendered directly from `src/town/audio.ts`, `src/ui/audio.ts`, and `src/ui/ipod-controller.ts` so every stool clack, shop shutter, OTC stamp, banknote chime, and click-wheel detent matches the live web game 100%.
  3. **Tone.js Cinema Transitions (`video/scripts/make-sound.mjs`)**: Filtered pink-noise whooshes, downbeat-locked risers, warm sub-impacts, and `$wif` burn ember sizzles. Zero stock library cliches, zero raw `ffmpeg` sine beeps, and zero metronome clicks.
* **Master Loudness & Silence Gate**:
  * **One Cue Per Moment**: Never stack competing UI chimes on the same frame.
  * **Pre-Lockup Silence**: Mandatory `15 frames` (`1 full beat = 0.50s`) of complete `-inf` silence across all stems right before the final end-card downbeat (`Frames 5685 to 5700` in Master; `Frames 1185 to 1200` in X Cut).
  * **Final Master (`video/scripts/master.sh`)**: `loudnorm=I=-14:TP=-1.0:LRA=9` (verified `-14.0 +/- 1.0 LUFS`, true peak `<= -1.0 dBTP`).

---

## 1. Sound Asset Palette & Codebase Provenance

| Cue ID | Source Layer | Exact Codebase / Synthesis Specification | Peak Trim |
| :--- | :--- | :--- | :--- |
| `app-tap` | `src/town/audio.ts:174` | `EFFECTS.tap`: MIDI `76` (`E5`, `659.25 Hz`) triangle `60ms` crisp UI button tap. | `-11 dBFS` |
| `app-stool-clack` | `src/town/audio.ts:175` + `src/ui/audio.ts:181` | `EFFECTS.place` (`G4 -> D5`) layered with `playTilePop()` (`460 Hz -> 75 Hz` `45ms` plastic stool clack on street plot). | `-8 dBFS` |
| `app-deed-slide` | `src/town/audio.ts:189` | `EFFECTS['deal-open']` (`A3 -> E4 -> A4`) + `90ms` soft parchment slide when OTC Bargaining Table opens. | `-10 dBFS` |
| `app-shop-shutter` | `src/town/audio.ts:179` | `EFFECTS.build`: ascending `C4 -> E4 -> G4` warm storefront shutter triad (`240ms`). | `-8 dBFS` |
| `app-deal-stamp` | `src/town/audio.ts:194` + `src/ui/audio.ts:246` | `playDealStamp()` (`95 Hz -> 32 Hz` `150ms` escrow stamp thud) + `EFFECTS.deal` (`E4 -> G4 -> C5 -> E5`) chord. | `-6 dBFS` |
| `app-neighbor-nod` | `src/town/audio.ts:236` | `SPEECH.positive`: 3-formant WebAudio vowel murmur (`eh -> ee -> ah -> ee`) on accepted bargain. | `-12 dBFS` |
| `app-payday-chime` | `src/town/audio.ts:204` + `src/ui/audio.ts:210` | `EFFECTS.income` (`C5 -> E5 -> G5 -> C6`) + `playCoinChime()` banknote cascade as `$wif` notes fly to wallets. | `-6 dBFS` |
| `app-calendar-tear` | `src/town/audio.ts:210` | `EFFECTS.year` (`C4 -> E4 -> G4 -> C5` `650ms`) + crisp paper tear transient on zodiac year flip. | `-9 dBFS` |
| `app-ipod-tick` | `src/ui/ipod-controller.ts:658` | `createClickBuffer()`: exact `3ms` Lehmer LCG (`seed = 7`, `0.7ms` decay) piezo click burst (`50ms` spacing). | `-9 dBFS` |
| `tx-orb-glass` | Tone.js (`make-sound.mjs`) | Soft harmonic `Cmaj7` glass shimmer on `orb-swarm` 4-to-8-to-16 orb splits. | `-12 dBFS` |
| `tx-block-fan` | Tone.js (`make-sound.mjs`) | Six rapid wooden card-fan ticks (`28ms` stagger) resolving into a crisp `Bungee` lock snap. | `-9 dBFS` |
| `tx-bezel-dive` | Tone.js (`make-sound.mjs`) | Bandpass pink-noise whoosh (`320 Hz -> 2,400 Hz -> 180 Hz`, `750ms`) diving through `laptop-frame`. | `-8 dBFS` |
| `tx-callout-open` | Tone.js (`make-sound.mjs`) | Subtle `2px` emerald ring draw tick (`1,200 Hz` damped sine, `35ms`) as camera flattens to `0 deg`. | `-14 dBFS` |
| `tx-orbit-whip` | Tone.js (`make-sound.mjs`) | Stereo bandpass whip (`450ms`) carrying `OrbitFlow` inner ring into Scene `S09`. | `-8 dBFS` |
| `tx-riser-1bar` | Tone.js (`make-sound.mjs`) | `60-frame` (`2.0s`) filtered noise + harmonic fifth swell terminating sharply on the downbeat. | `-9 dBFS` |
| `tx-riser-2bar` | Tone.js (`make-sound.mjs`) | `120-frame` (`4.0s`) tension swell across Bars 61 to 62 terminating sharply at `Frame 3720`. | `-8 dBFS` |
| `tx-sub-impact` | Tone.js (`make-sound.mjs`) | Saturated sine sub drop (`68 Hz -> 34 Hz`, `420ms`) reinforcing Drop 1, Drop 2, and Final Lockup. | `-5 dBFS` |
| `tx-wif-burn` | Tone.js (`make-sound.mjs`) | Warm ember sizzle + upward resonant shimmer (`1.4 kHz -> 5.2 kHz`, `380ms`) on `0x0000...dEaD` `$wif` burn. | `-7 dBFS` |

---

## 2. Hackathon Submission Master Cue Sheet (`3:20` / `Frames 0 to 6000`)

| Frame (`30fps`) | Time (`mm:ss.f`) | Bar.Beat | Scene | Cue ID | Visual Trigger on Screen |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `0` | `0:00.0` | `1.1` | `S01` | `tx-orb-glass` | Four emerald glass orbs burst from `"Pull up a stool."` |
| `60` | `0:02.0` | `2.1` | `S01` | `tx-orb-glass` | Orbs split to 8 under `"Bargain for street corners."` |
| `120` | `0:04.0` | `3.1` | `S01` | `tx-orb-glass` | Orbs split to 16 vortex under `"Open neighborhood shops."` |
| `180` | `0:06.0` | `4.1` | `S01` | `app-payday-chime` | Bead chain loops around `"Put $wif to work."` |
| `240` | `0:08.0` | `5.1` | `S02` | `tx-block-fan` | Six district-colored cards fan out in `@snapcn/block-wordmark`. |
| `315` | `0:10.5` | `6.2` | `S02` | `app-stool-clack` | Blocks hard-cut into `ROBIN TOWN` + `TownMark` lockup. |
| `360` | `0:12.0` | `7.1` | `S03` | `app-tap` | `laptop-frame` opens; notch connects `Robinhood Chain 46631`. |
| `435` | `0:14.5` | `8.2` | `S03` | `tx-bezel-dive` | Camera dives through MacBook bezel into the 3D Harbor Diorama. |
| `480` | `0:16.0` | `9.1` | `S04` | `app-tap` | `word-gather` lead word `"One"` lands; marker sweeps `"Two instant views."` |
| `780` | `0:26.0` | `14.1` | `S05` | `tx-callout-open` | Camera flattens to `0 deg`; **Callout 1** ring draws around 3D Sherwood Harbor cluster. |
| `1020` | `0:34.0` | `18.1` | `S05` | `app-tap` | `button-press` clicks `3D City ⇄` (`view-toggle`), flipping instantly to 2D Aseprite street map. |
| `1080` | `0:36.0` | `19.1` | `S05` | `tx-callout-open` | **Callout 2** ring draws around `.view-mode-segmented`. |
| `1335` | `0:44.5` | `23.2` | `S05` | `app-stool-clack` | Green plastic stools clack onto 5 glowing offered plots (`Keep 5/5 ✓`). |
| `1440` | `0:48.0` | `25.1` | `S06` | `app-deed-slide` | `punch-lines` Card 1 (`"Cash. Shop tiles. Street deeds."`) slides in. |
| `1520` | `0:50.7` | `26.2` | `S06` | `app-stool-clack` | Hero punch card `"Everything is negotiable."` swells in bullion gold. |
| `1575` | `0:52.5` | `27.2` | `S07` | `app-deed-slide` | Two-way OTC Bargaining Table (`dialog.trade-dialog`) opens across the woven mat. |
| `1680` | `0:56.0` | `29.1` | `S07` | `tx-callout-open` | **Callout 3** ring draws around `.offer-tray`. |
| `1950` | `1:05.0` | `33.3` | `S07` | `app-deal-stamp` | Neighbor accepts swap and stamps `DEAL!` (`40 $wif` + `Plot #14` <-> `Plot #08` + `Noodle Kitchen ×1`). |
| `1965` | `1:05.5` | `33.4` | `S07` | `app-neighbor-nod` | Subtle WebAudio 3-formant positive neighbor greeting (`SPEECH.positive`). |
| `2040` | `1:08.0` | `35.1` | `S07` | `tx-callout-open` | **Callout 4** highlights `1% OTC cash micro-fee` routed to Staking Vault. |
| `2310` | `1:17.0` | `39.3` | `S07` | `app-shop-shutter` | `Noodle Kitchen` storefront placed on `Plot #08`, completing 4-tile golden banner tower (`80 $wif/yr`). |
| `2400` | `1:20.0` | `41.1` | `S08` | `app-tap` | `OrbitFlow` 3-phase rings settle on `#112a24` SolaceUI grid. |
| `2565` | `1:25.5` | `43.4` | `S08` | `tx-orbit-whip` | Inner orbit winds up and whips into Payday harvest scene. |
| `2580` | `1:26.0` | `44.1` | `S09` | `tx-riser-1bar` | `60-frame` harmonic riser builds as cursor approaches `Collect $wif income`. |
| **`2640`** | **`1:28.0`** | **`45.1`** | **`S09`** | **`tx-sub-impact` + `app-payday-chime`** | **DROP 1 DOWNBEAT**: Drawn emerald tick lands; Aseprite `$wif` banknotes fly into wallets! |
| `2685` | `1:29.5` | `45.4` | `S09` | `app-calendar-tear` | Tear-off zodiac calendar flips cleanly from `Year 1 · Snake` to `Year 2 · Horse`. |
| `2700` | `1:30.0` | `46.1` | `S09` | `tx-callout-open` | **Callout 5** ring draws around `.payday-banner`. |
| `3060` | `1:42.0` | `52.1` | `S10` | `tx-bezel-dive` | `ScatterBloom` 926 verification points + `@snapcn/count-grid` rush in with horizontal smear. |
| `3150` | `1:45.0` | `53.3` | `S10` | `app-stool-clack` | `count-grid` outer rings populate (`72 Lots`, `120 Tiles`, `926 Passing Tests`). |
| `3360` | `1:52.0` | `57.1` | `S11` | `app-tap` | `word-gather` + gold underline sweep under `"burn $wif"`. |
| `3480` | `1:56.0` | `59.1` | `S12` | `tx-callout-open` | **Callout 6** opens over `Verified $wif on Chain 46631` (`0xE49A1C…0F9B`). |
| `3600` | `2:00.0` | `61.1` | `S12` | `tx-riser-2bar` | `120-frame` tension riser builds toward `$wif` Staking & Burn trigger. |
| **`3720`** | **`2:04.0`** | **`63.1`** | **`S12`** | **`tx-sub-impact` + `app-payday-chime`** | **HERO DROP 2 DOWNBEAT**: `Stake 500 $wif -> Activate 1.20x Boost` ticks emerald & lights gold HUD pill! |
| `3750` | `2:05.0` | `63.3` | `S12` | `tx-wif-burn` | `Swap Points (3% Burn)` + `100 $wif Community Vote` sizzle permanently to `0x0000...dEaD` (`4,600,000+ $wif` burned). |
| `3780` | `2:06.0` | `64.1` | `S12` | `tx-callout-open` | **Callout 7** highlights `1.20x staking and permanent burns`. |
| `3960` | `2:12.0` | `67.1` | `S13` | `app-deal-stamp` | `MetricMorph` collapses `4,000 $wif` pill into `90% / 5% / 5%` deterministic conservation bars. |
| `4080` | `2:16.0` | `69.1` | `S13` | `app-payday-chime` | Year 6 `FINAL $WIF STANDINGS` settles podium payout (`+$[real] $wif`). |
| `4440` | `2:28.0` | `75.1` | `S14` | `app-ipod-tick` | `check-cycle` rolls 5 slot items (`20f` intervals, subtle piezo tick per slot roll). |
| `4635` | `2:34.5` | `78.2` | `S15` | `app-tap` | `@ncdai/apple-carousel` morphing play/pause toggle & progress dot advance. |
| `4740` | `2:38.0` | `80.1` | `S15` | `tx-callout-open` | **Callout 8** frames `#robin-ipod-dock` (`ROBIN-POD` click wheel). |
| `4800` | `2:40.0` | `81.1` | `S15` | `app-ipod-tick` | Cursor dials 6 rotary `15 deg` detents (`Frames 4800, 4806, 4812, 4818, 4824, 4830`) with authentic piezo clicks. |
| `5100` | `2:50.0` | `86.1` | `S16` | `app-deed-slide` | Four `phone-stack` WebSocket room seats rise (`stagger = 24f` at `5100, 5124, 5148, 5172`). |
| `5400` | `3:00.0` | `91.1` | `S17` | `tx-bezel-dive` | `terminal-simulator` single-camera whip from headline to `git clone` command panel. |
| `5550` | `3:05.0` | `93.3` | `S17` | `app-payday-chime` | Focus terminal prints `✓ 926 tests passed` & `✓ http://127.0.0.1:5173`. |
| **`5685`** | **`3:09.5`** | **`95.4`** | **`S17`** | **`[HARD SILENCE]`** | **Mandatory 15-frame (`1-beat`) total audio silence across all stems (`5685 to 5700`)**. |
| **`5700`** | **`3:10.0`** | **`96.1`** | **`S18`** | **`tx-sub-impact` + `app-shop-shutter`** | `dot-bloom` resolves into `ROBIN TOWN` final `Lockup.tsx`; warm acoustic tail decays naturally to `3:20.0`. |

---

## 3. X Launch Cut Cue Sheet (`0:44` / `Frames 0 to 1320`)

| Frame (`30fps`) | Time (`mm:ss.f`) | Bar.Beat | Scene | Cue ID | Visual Trigger on Screen |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `0` | `0:00.0` | `1.1` | `X01` | `tx-orb-glass` | `orb-swarm` 4-beat hook opens on `#112a24` grid. |
| `90` | `0:03.0` | `2.3` | `X01` | `app-payday-chime` | Bead chain loops around `"Put $wif to work."` |
| `120` | `0:04.0` | `3.1` | `X02` | `tx-block-fan` | `block-wordmark` shuffles and snaps to `ROBIN TOWN`. |
| `180` | `0:06.0` | `4.1` | `X03` | `tx-bezel-dive` | `laptop-frame` notch flashes `Chain 46631` and dives into 3D Harbor Diorama. |
| `330` | `0:11.0` | `6.3` | `X04` | `app-tap` | `button-press` clicks `3D City ⇄` into `1100x730` Aseprite board. |
| `360` | `0:12.0` | `7.1` | `X04` | `tx-callout-open` | **Callout X1** (`3D Harbor Diorama and 2D toggle`) opens at `0 deg` flat. |
| `540` | `0:18.0` | `10.1` | `X05a` | `app-stool-clack` | `punch-lines` (`"Cash. Tiles. Deeds. / Everything is negotiable."`). |
| `660` | `0:22.0` | `12.1` | `X05b` | `app-deal-stamp` | OTC Bargaining Table stamps `DEAL!` (`1%` fee to Vault). |
| `720` | `0:24.0` | `13.1` | `X05b` | `tx-riser-1bar` | `60-frame` riser builds across completed 4-lot `Noodle Kitchen` tower toward Payday click. |
| **`780`** | **`0:26.0`** | **`14.1`** | **`X06`** | **`tx-sub-impact` + `app-payday-chime`** | **HERO DROP DOWNBEAT**: `Collect $wif income` ticks emerald; `$wif` banknotes fly! |
| `840` | `0:28.0` | `15.1` | `X06` | `tx-wif-burn` | `1.20x` Staking badge + `MetricMorph` `4,000 $wif` pool (`5%` burned to `0x0000...dEaD`). |
| `900` | `0:30.0` | `16.1` | `X06` | `tx-callout-open` | **Callout X2** (`1.20x staking and $wif burns`) opens at `0 deg` flat. |
| `1110` | `0:37.0` | `19.3` | `X07` | `app-ipod-tick` | `ROBIN-POD` click wheel dials detents alongside `@ncdai/apple-carousel`. |
| **`1185`** | **`0:39.5`** | **`20.4`** | **`X07`** | **`[HARD SILENCE]`** | **Mandatory 15-frame (`1-beat`) total silence (`1185 to 1200`)**. |
| **`1200`** | **`0:40.0`** | **`21.1`** | **`X08`** | **`tx-sub-impact` + `app-shop-shutter`** | `dot-bloom` -> `ROBIN TOWN` + `Chain ID 46631` + repo URL held still through `0:44.0`. |
