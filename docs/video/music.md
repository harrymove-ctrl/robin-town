# Robin-Town Music Direction & Suno Briefs (`Gate 2` Review)

* **Tempo & Meter**: `120 BPM`, `4/4` (`1 beat = 0.50s = 15 frames @ 30fps`, `1 bar = 2.00s = 60 frames @ 30fps`)
* **Key Signature**: `C Major / A Dorian` (matching `PHASES` MIDI voicings `[60, 64, 67, 71]` `Cmaj7` -> `[57, 60, 64, 67]` `Am7` -> `[62, 65, 69, 72]` `Dm7` -> `[65, 69, 72, 76]` `Fmaj7` in `src/town/audio.ts:97-170`)
* **Mix Headroom Contract**: Music bed sits at `-18 LUFS` during gameplay chapters and `-15.5 LUFS` on Drops 1 and 2, carving a gentle `-2.5 dB` bell dip at `1.8 kHz` so wooden stool clacks, `ROBIN-POD` piezo clicks, and `$wif` banknote chimes cut through cleanly. Integrated master loudness targets `-14.0 +/- 1.0 LUFS` with true peak `<= -1.0 dBTP`.

---

## 1. Three Paste-Ready Suno `[Instrumental]` Prompts (`120 BPM`)

> **Mandatory Suno Settings**: Set **`Instrumental = ON`** (zero vocals, zero spoken samples, zero vocal chops). For the `3:20` master, generate one full track and extend cleanly from Bar 80 if Suno caps initial generation under `3:20`.

### Variant A (Recommended): Harbor Morning Lo-Fi Acoustic + Warm Emerald Synth Drop
**Style / Prompt Box**:
```text
120 BPM, instrumental only, no vocals, warm harbor street-cafe lo-fi beat meets modern product film score, fingerpicked nylon acoustic guitar and Rhodes electric piano in C major7, crisp wooden rimshot and tabletop bamboo percussion, round upright sub bass, uplifting lush emerald analog polysynth drop at 1:28 and 2:04, spacious midrange headroom for UI sound effects, clean resolved acoustic chord tail
```

**Structure Tags (Custom Mode Lyrics Box with `Instrumental = ON`)**:
```text
[Intro: Warm Rhodes chords and subtle vinyl street air, 8 bars]
[Verse 1: Fingerpicked nylon guitar, brushed snare, upright bass pocket, 16 bars]
[Verse 2: Tight rimshot tabletop groove, playful jazz-hop bassline, 16 bars]
[Build: Rising filtered marimba arpeggio and snare roll, 4 bars]
[Drop 1: Uplifting warm emerald analog synth chords, crisp 120 BPM pocket drums, 12 bars]
[Breakdown: Intimate Rhodes electric piano and sub pulse, 6 bars]
[Drop 2: Full celebratory brass-warm synth lead, rich bass, sparkling bell plucks, 12 bars]
[Bridge: Laid-back lo-fi click-wheel pocket groove, Rhodes and muted guitar, 16 bars]
[Pre-Outro: Focused minimal pulse building to a sudden 1-beat stop, 5 bars]
[Outro: Single warm Cmaj9 chord hit with natural acoustic decay to silence, 5 bars]
```

### Variant B: Tactile Tabletop Marimba & Jazz-Hop Breakbeat
**Style / Prompt Box**:
```text
120 BPM, instrumental only, no vocals, tactile wooden marimba and kalimba plucks with warm Wurlitzer electric piano, tight dry hip-hop breakbeat drums, deep Moog bassline, cozy board-game cafe atmosphere transitioning into a bright triumphant melodic synth chorus at 1:28 and 2:04, crisp transient clarity, zero mud, resolved electric piano outro
```

### Variant C: Modern Fintech Emerald House & Acoustic Hybrid
**Style / Prompt Box**:
```text
120 BPM, instrumental only, no vocals, warm melodic house and lo-fi acoustic hybrid, plucked mute guitar, glassy emerald synth pads, soft four-on-the-floor kick with crisp shaker and woodblock groove, clean harmonic lift on the drops, modern Web3 consumer game showcase soundtrack, spacious stereo image, gentle resolved tail
```

---

## 2. Bar-by-Bar Musical Section Map (`3:20` Hackathon Submission Master)

Every musical transition lands on an exact bar boundary (`bars(n)`), with **Drop 1** locked to the `Collect $wif income` payday burst (`Frame 2640`) and **Drop 2** locked to the `Stake 500 $wif -> Activate 1.20x Boost` & `$wif` burn trigger (`Frame 3720`).

| Musical Section | Bars | Time (`120 BPM`) | Frames (`30fps`) | Scenes Covered | Harmonic & Rhythmic Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`[Intro]`** | `1 to 8` (`8b`) | `0:00 to 0:16` | `0 to 480` | `S01` (`orb-swarm`), `S02` (`block-wordmark`), `S03` (`laptop-frame`) | Warm `Cmaj7` Rhodes glass chords + subtle shaker pulse on Beat 1 of each bar; low sub bloom as camera dives through MacBook bezel at Bar 8. |
| **`[Groove A: Living Street]`** | `9 to 24` (`16b`) | `0:16 to 0:48` | `480 to 1440` | `S04` (`word-gather`), `S05` (3D Living Town & 2D Toggle) | Nylon guitar + upright bass enter on Bar 9; crisp rimshot groove mirrors scooters and canal boats; bright chord turn at Bar 18 on `3D City ⇄` click. |
| **`[Groove B: Bargaining Mat]`** | `25 to 40` (`16b`) | `0:48 to 1:20` | `1440 to 2400` | `S06` (`punch-lines`), `S07` (OTC Bargaining Table) | Shifts to `Am7 -> Dm7 -> G7 -> Em7` (`trade` / `bargain` progression from `src/town/audio.ts:110-169`); tight syncopated woodblock pocket; warm chord stab on `DEAL!` at Bar 34. |
| **`[Build 1: Orbit Windup]`** | `41 to 44` (`4b`) | `1:20 to 1:28` | `2400 to 2640` | `S08` (`OrbitFlow`), `S09` Bar 44 pre-click | Kick drops out for 3 bars as marimba arpeggio + Tone.js filtered noise riser climb across Bar 44 toward the `Collect $wif income` button. |
| **`[Drop 1: Year-End $wif Payday]`** | `45 to 56` (`12b`) | `1:28 to 1:52` | `2640 to 3360` | `S09` (Payday banknotes + Ledger), `S10` (`ScatterBloom` + `count-grid`) | **Exact Downbeat Hit at `1:28.0` (`Frame 2640`)**: Full `Fmaj7 -> G7 -> Cmaj7` emerald polysynth + warm sub bass + crisp drums erupt as `$wif` banknotes fly across the neighborhood. |
| **`[Breakdown: Chain 46631]`** | `57 to 62` (`6b`) | `1:52 to 2:04` | `3360 to 3720` | `S11` (`word-gather`), `S12` (`$wif` Hub Dual-Mode Wallet) | Drums strip back to Rhodes pads + sub heartbeat so Callout 6 (`Instant Play` + `Chain ID 46631`) reads effortlessly; 2-bar harmonic riser across Bars 61 to 62. |
| **`[Drop 2: Hero $wif Flywheel]`** | `63 to 74` (`12b`) | `2:04 to 2:28` | `3720 to 4440` | `S12` (`1.20x` Stake + `0x...dEaD` Burn), `S13` (`MetricMorph` `4,000 $wif` Pool) | **Exact Downbeat Hit at `2:04.0` (`Frame 3720`)**: Peak energy of the film as `Stake 500 $wif` activates `1.20x` boost, `100 $wif` burns permanently, and `MetricMorph` builds the Ranked Pool chart. |
| **`[Bridge: ROBIN-POD Pocket]`** | `75 to 90` (`16b`) | `2:28 to 3:00` | `4440 to 5400` | `S14` (`check-cycle`), `S15` (`ROBIN-POD` + Carousel), `S16` (`phone-stack`) | Cozy Harbor lo-fi radio groove matching the `ROBIN-POD` click wheel rotation; playful bass walk under the 4-phone WebSocket room stack. |
| **`[Quickstart & 1-Beat Stop]`** | `91 to 95` (`5b`) | `3:00 to 3:10` | `5400 to 5700` | `S17` (`terminal-simulator`) | Clean minimal arpeggio drives CLI typing (`926 tests passed`). **Hard mute at `Frame 5685` (`3:09.5`)**: `15 frames` (`1 full beat`) of total silence before the end card. |
| **`[Outro: Resolved Lockup]`** | `96 to 100` (`5b`) | `3:10 to 3:20` | `5700 to 6000` | `S18` (`dot-bloom` + `Lockup.tsx`) | Warm `Cmaj9` acoustic + Rhodes chord blooms at `Frame 5700` (`3:10.0`) and decays naturally to `-inf` by `Frame 6000` (`3:20.0`) while the repo URL and `npm run dev` hold still. |

---

## 3. Bar-by-Bar Musical Section Map (`0:44` X Launch Cut)

| Musical Section | Bars | Time (`120 BPM`) | Frames (`30fps`) | Scenes Covered | Musical Alignment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`[Hook Intro]`** | `1 to 4` (`4b`) | `0:00 to 0:08` | `0 to 240` | `X01` (`orb-swarm`), `X02` (`block-wordmark`), `X03` (`laptop-frame`) | Crisp Rhodes + woodblock pulse; bezel-dive sub drop into Bar 5. |
| **`[Street & OTC Groove]`** | `5 to 13` (`9b`) | `0:08 to 0:26` | `240 to 780` | `X04` (3D/2D Toggle), `X05a` (`punch-lines`), `X05b` (OTC `DEAL!`) | Tight 120 BPM acoustic/breakbeat pocket; 1-bar snare/marimba riser across Bar 13 (`Frames 720 to 780`). |
| **`[Hero Drop: Payday & $wif]`** | `14 to 18` (`5b`) | `0:26 to 0:36` | `780 to 1080` | `X06` (Payday banknotes + `1.20x` Stake + `MetricMorph`) | **Exact Downbeat Hit at `0:26.0` (`Frame 780`)** on `Collect $wif income` tick and `$wif` burn chart. |
| **`[Gadget Tag & Silence]`** | `19 to 20` (`2b`) | `0:36 to 0:40` | `1080 to 1200` | `X07` (`ROBIN-POD` + Carousel + Room Code) | Lo-fi pocket groove; **complete 1-beat silence across `Frames 1185 to 1200` (`0:39.5 to 0:40.0`)**. |
| **`[Resolved Sting]`** | `21 to 22` (`2b`) | `0:40 to 0:44` | `1200 to 1320` | `X08` (`dot-bloom` + `Lockup.tsx`) | Warm `Cmaj9` chord lands at `Frame 1200` (`0:40.0`) and decays cleanly by `0:44.0`. |

---

## 4. Tone.js Preview Score Specification (`video/scripts/make-sound.mjs`)

For deterministic local preview builds prior to dropping in the final Suno `.mp3`:
* Synthesize the exact MIDI chord voicings from `src/town/audio.ts:97-170` (`PolySynth` warm triangle/sine Rhodes + filtered acoustic pluck + soft membrane kick/rimshot at `120 BPM`).
* **Strict Anti-Click Rule**: Never render a metronome click track or raw `ffmpeg` sine beep in any preview or final render.
