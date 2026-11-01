# Gate 3 Build and Master QA Report: Robin-Town

**Status**: PASS (Gate 3 Verified, Mastered, and Exported across Master, X Launch, and Raylight Intro V2)  
**Project**: Robin-Town (`https://github.com/harrymove-ctrl/robin-town`)  
**Approved Scores**: Variant A Harbor Lo-Fi Score (`120 BPM`, `48 kHz` Stereo) and Approved Raylight Intro Track (`raylight-intro.wav`, `33.70s`, `48 kHz` Stereo)  
**Export Directory**: `/Volumes/Dev/china-town/docs/video/exports/`

---

## 1. Mastered Deliverables Summary

| Deliverable | File Path | Resolution & Frame Rate | Exact Frames & Duration | Codec & Pixel Format | File Size (`< 85 MB` Cap) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Hackathon Master (`3:20`)** | `docs/video/exports/robin-town-hackathon-master.mp4` | `1920x1080 @ 30fps` | `6,000 frames` (`200.000000s`) | `h264` (`libx264 -crf 20`, `yuv420p`) + `aac` (`48 kHz`, `2ch`, `320k`) | **`69.1 MB`** (`72,425,317 B`) | **PASS** |
| **X Launch Cut (`0:44`)** | `docs/video/exports/robin-town-x-launch.mp4` | `1920x1080 @ 30fps` | `1,320 frames` (`44.000000s`) | `h264` (`libx264 -crf 20`, `yuv420p`) + `aac` (`48 kHz`, `2ch`, `320k`) | **`20.6 MB`** (`21,555,341 B`) | **PASS** |
| **Robin-Town Intro V2 (`0:33.7`)** | `docs/video/exports/robin-town-intro.mp4` | `1920x1080 @ 30fps` | `1,011 frames` (`33.700000s`) | `h264` (`libx264 -crf 19`, `yuv420p`) + `aac` (`48 kHz`, `2ch`, `320k`) | **`20.8 MB`** (`21,776,292 B`) | **PASS** |
| **Intro V2 16-Panel QA Sheet** | `docs/video/exports/intro-v2-qa-grid.png` | `1910x1226` PNG | `16` beat-locked Intro V2 panels | Lossless RGB PNG | `1.9 MB` | **PASS** |
| **Motion Scenes Contact Sheet** | `docs/video/exports/motion-frames.png` | `1864x1568` PNG | `12` motion & camera panels | Lossless RGB PNG | `1.7 MB` (`1,812,692 B`) | **PASS** |
| **Callout Non-Overlap Sheet** | `docs/video/exports/callouts-middle-frames.png` | `1768x2686` PNG | `10` middle-frame callouts (`C1` to `C8`, `X1`, `X2`) | Lossless RGB PNG | `3.7 MB` (`3,870,905 B`) | **PASS** |

---

## 2. Live Feature & 100% English Localization Verification

| Feature Pillar | Live Evidence Verified in Mastered MP4s & Contact Sheets | Verdict |
| :--- | :--- | :--- |
| **3D Harbor Diorama (Day, Sunset, Night)** | Captured live in `clip-01-living-town.mp4` (`S03`, `S05`, `X03`, `X04`, `I02b`, `I03`), `clip-mobile-3d-fastplay.mp4` (`I04`, `I08`), and `seat-01-3d.png`: chamfered walnut harbor plinth, animated turquoise waves, cargo barges, timber pier, lighthouse beam, connected shop plinths, sidewalk cafes, street-orbit camera sweep, and live `Day` -> `Sunset` -> `Night` -> `2D Map` transitions. | **PASS** |
| **Verified `$wif` On-Chain Burn Proof** | Captured live from `/api/onchain-wif` in `clip-04-wif-flywheel.mp4` (`S12`, `X06Flywheel`, `I06b`), `clip-mobile-wif-hub.mp4` (`I06b`, `I08`), `seat-04-hub.png`, and `MetricMorph` (`S13a`, `I06a`): official ERC-20 `0xE49A1C3033EcC6b804bc423021D3F71F1A3e0F9B` (`0xE49A1C…0F9B`) with live `● On-Chain Block #103,099,794` / `#103,227,116 · 4,600,001 $wif burned on 0x…dEaD`. | **PASS** |
| **Live Cross-Device WebSocket Rooms & Mobile 3D** | Captured live in `clip-05-gadgets-and-rooms.mp4` (`S15`, `X07`), `clip-mobile-3d-fastplay.mp4`, `clip-mobile-wif-hub.mp4`, `S16`, and `I08`: `Create Room Code` spawns a real 6-character room code (`CODE6X`) and connects live desktop and `390x844 @ 2x` (`780x1688`) mobile seats over `/ws/room`. | **PASS** |
| **100% English Copy & Zero Dashes** | Verified across all `video/src/` scenes, captured gameplay HUDs, modals, and `docs/video/` docs: `You`, `Cole`, `Maya`, `Clara`; `Instant Seat 01` to `Instant Seat 04`; `Sherwood`, `Clocktower`, `Harborview`, `Lantern Hall`, `Grand Market`, `Maple Lane`; `Coffee House`, `Artisan Bakery`, `Noodle Kitchen`, `Flower Studio`, `Tailor Atelier`, `Corner Grocer`; `926 tests passed (26 suites), 69/69 pixel sprites verified`; zero em-dashes, en-dashes, or spaced hyphens in prose or UI strings. | **PASS** |

---

## 3. EBU R128 Audio Mastering & Pre-Lockup Silence Verification

Measured via `ffmpeg -af loudnorm=print_format=summary` and `astats`:

| Metric | Target | Hackathon Master (`3:20.0`) | X Launch Cut (`0:44.0`) | Robin-Town Intro V2 (`0:33.7`) | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Integrated Loudness (`I`)** | `-14.0 +/- 1.0 LUFS` | **`-14.0 LUFS`** | **`-14.2 LUFS`** | **`-14.0 LUFS`** | **PASS** |
| **True Peak (`TP`)** | `<= -1.0 dBTP` | **`-1.9 dBTP`** | **`-2.0 dBTP`** | **`-4.1 dBTP`** | **PASS** |
| **Loudness Range (`LRA`)** | `3.0 to 9.0 LU` | **`3.9 LU`** | **`4.0 LU`** | **`8.0 LU`** | **PASS** |
| **Sample Rate & Channels** | `48,000 Hz`, Stereo (`2ch`) | `48,000 Hz`, `2ch` | `48,000 Hz`, `2ch` | `48,000 Hz`, `2ch` | **PASS** |
| **Pre-Lockup / End-Card Settling** | Motionless end card (`>= 3.5s`) | **`-inf dB` Peak** (`189.53s` for `0.44s`, `9.1s` hold) | **`-inf dB` Peak** (`39.53s` for `0.44s`, `3.1s` hold) | `DotBloom` cut on `f893` chime, **`3.53s` motionless hold** (`30.17s` to `33.70s`) | **PASS** |

---

## 4. Downbeat Alignment, Transient Sync & Visual Integrity Checks

| Check | Specification | Measured Result | Verdict |
| :--- | :--- | :--- | :--- |
| **120 BPM Bar Grid (`bars()`)** | Master & X Launch scenes start and end on exact `60`-frame (`2.00s`) bar boundaries | `RobinTownMaster = 100 bars (6,000f)`, `RobinTownXClip = 22 bars (1,320f)`, zero fractional bar drift | **PASS** |
| **Intro V2 Audio Transient Sync (`raylight-intro.wav`)** | Frame-exact alignment across `1,011` frames (`33.70s`) | `f35` (`1.17s`) OrbSwarm vortex cut; `f95` (`3.17s`) BlockWordmark; `f168` (`5.60s`) LaptopFrame shutter snap into live 3D Harbor; `f218` (`7.27s`) double-ding `Callout I1`; `f277` (`9.23s`) OTC + Mobile 3D rotate-in; `f483, 506, 519, 542` bass-kick Payday cards + `f557` whip; `f677` (`22.57s`) exact `ButtonPress` `CLICK_AT=36` + mobile `Stake 500 $wif` flip; `f812` (`27.07s`) victory chime `Callout I2`; `f893` (`29.77s`) `DotBloom` chime cut into motionless `EndLockup` | **PASS** |
| **Master Drop 1 & Drop 2 Frame Sync** | Annual Payday click (`Frame 2640`), `$wif` Staking `1.20x` (`Frame 3720`), Year 6 Settlement (`Frame 4350`) | Verified across `motion-07.png`, `callout-06.png`, and `S13b` (`1,480 $wif`, `+2,160 $wif` payout, `200 $wif` burned) | **PASS** |
| **X Clip Drop Frame Sync** | OTC Bargain & Deal Sealed (`X05b`) across frames `600` to `780` (`00:20.0` to `00:26.0`) | Verified `DEAL!` stamp + `1% OTC protocol fee` routed to Staking Vault, followed by `Frame 780` Payday drop | **PASS** |
| **Black Frame Detection** | `blackdetect=d=0.1:pix_th=0.05` (`0` unintended black segments) | **`0` black segments** across `robin-town-hackathon-master.mp4`, `robin-town-x-launch.mp4`, and `robin-town-intro.mp4` | **PASS** |
| **Freeze Frame Detection** | `freezedetect=n=0.003:d=1.5` (zero stalled gameplay clips) | `0` stalled gameplay clips; in `robin-town-intro.mp4`, `freezedetect` triggers strictly at `30.1667s` (`f905` to `f1011` = `3.53s` motionless `EndLockup`) | **PASS** |
| **Zero Fake CSS UI / Zero Slop Audit** | Zero `#040709`, `StudioSpotlight`, `IPhone3D`, `"mock"`, `"simulation"`, `"Alice"`, `"Dana"` strings; `showDynamicIsland={false}` on `@snapcn/phone-frame` | Verified across `intro_v2_qa_grid.png`, `intro_v2_hero_1..4.png`, `motion-frames.png`, and `callouts-middle-frames.png`: 100% live `<OffthreadVideo>` gameplay on desktop and `780x1688` Retina mobile | **PASS** |
| **Single-Pointer Discipline** | At most one cursor or click ring visible on any frame | Verified across all footage scenes: headless Playwright hides the OS cursor and at most one `@snapcn/cursor-track`, `@snapcn/button-press`, or `DrawnTick` renders | **PASS** |
| **Final Watermark Rule** | Zero preview watermarks on final masters | Verified clean across all `6,000` Master frames, `1,320` X frames, and `1,011` Intro V2 frames | **PASS** |
| **Clean Repository Separation** | Zero modifications to `/Volumes/Dev/china-town/src/` by the video build | All video code, assets, and masters isolated strictly inside `video/` and `docs/video/`; `npx tsc --noEmit` exited `0` | **PASS** |

---

## 5. Callout Non-Overlap Solver Verification (`video/out/callout-qa.json`)

Solved by `video/scripts/layout-callouts.py` using pixel-differenced UI edge detection (`abs(clean, bare)`) over a `16px` grid (`120x68` cells) at `1920x1080`:

| Callout ID | Scene & Composition | Mid Frame | Target Ring Box `[x1, y1, x2, y2]` | Ring Edge Margin (`>= 20px`) | Solved Card Box `[x, y, w, h]` | Covered UI Text Cells (`== 0`) | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`C1`** | `S05` (`RobinTownMaster`) | `900` | `[397, 303, 1260, 777]` | `303 px` | `[1200, 800, 660, 158]` | **`0`** | **PASS** |
| **`C2`** | `S05` (`RobinTownMaster`) | `1200` | `[1360, 25, 1537, 74]` | `25 px` | `[1120, 112, 660, 158]` | **`0`** | **PASS** |
| **`C3`** | `S07` (`RobinTownMaster`) | `1800` | `[290, 460, 712, 535]` | `290 px` | `[1024, 656, 660, 158]` | **`0`** | **PASS** |
| **`C4`** | `S07` (`RobinTownMaster`) | `2160` | `[492, 473, 1427, 571]` | `473 px` | `[624, 800, 660, 158]` | **`0`** | **PASS** |
| **`C5`** | `S09` (`RobinTownMaster`) | `2850` | `[740, 418, 1179, 601]` | `418 px` | `[624, 640, 660, 158]` | **`0`** | **PASS** |
| **`C6`** | `S12` (`RobinTownMaster`) | `3600` | `[322, 241, 1088, 510]` | `241 px` | `[1136, 288, 660, 158]` | **`0`** | **PASS** |
| **`C7`** | `S12` (`RobinTownMaster`) | `3870` | `[322, 626, 1088, 785]` | `295 px` | `[1136, 624, 660, 158]` | **`0`** | **PASS** |
| **`C8`** | `S15` (`RobinTownMaster`) | `4890` | `[1647, 569, 1895, 997]` | `25 px` | `[944, 704, 660, 158]` | **`0`** | **PASS** |
| **`X1`** | `X04` (`RobinTownXClip`) | `435` | `[1245, 25, 1370, 75]` | `25 px` | `[976, 112, 660, 158]` | **`0`** | **PASS** |
| **`X2`** | `X06Flywheel` (`RobinTownXClip`) | `980` | `[322, 168, 1088, 244]` | `168 px` | `[1136, 128, 660, 158]` | **`0`** | **PASS** |
| **`I1`** | `I03` (`RobinTownIntro`) | `245` | `[436, 299, 1296, 777]` | `299 px` | `[1200, 832, 660, 158]` | **`0`** | **PASS** |
| **`I2`** | `I07` (`RobinTownIntro`) | `828` | `[319, 326, 1088, 419]` | `319 px` | `[1152, 288, 660, 158]` | **`0`** | **PASS** |

**Summary**: `12 / 12` callouts solved with **`max coveredTextCells = 0`** and **`min ringEdgeMarginPx = 25 px`**.

---

## 6. Palette Hue Fidelity Audit (`video/out/palette-qa.json`)

Audited by `video/scripts/qa-frames.py` across `27` sampled frames (`12` Master + `6` X Launch + `9` Intro V2) against hues programmatically extracted from Robin-Town's real CSS and TypeScript design tokens (`video/src/palette.ts`, generated by `video/scripts/gen-palette.mjs`):

| Video File | Sample Timestamp (`s`) | Scene Context | Foreign-Hue Pixels (`< 2.0%` Cap) | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| `robin-town-hackathon-master.mp4` | `2.0s` | `S01` OrbSwarm 4-Beat Hook | **`0.000%`** | **PASS** |
| `robin-town-hackathon-master.mp4` | `9.5s` | `S02` BlockWordmark + TownMark Lockup | **`0.000%`** | **PASS** |
| `robin-town-hackathon-master.mp4` | `13.5s` | `S03` LaptopFrame Dive | **`0.000%`** | **PASS** |
| `robin-town-hackathon-master.mp4` | `18.0s` | `S04` WordGather + TextHighlight | **`0.000%`** | **PASS** |
| `robin-town-hackathon-master.mp4` | `30.0s` | `S05` 3D Harbor Diorama Night (`C1` Callout) | **`0.000%`** | **PASS** |
| `robin-town-hackathon-master.mp4` | `50.0s` | `S07` OTC Bargaining Table | **`0.000%`** | **PASS** |
| `robin-town-hackathon-master.mp4` | `84.0s` | `S08` OrbitFlow 3-Phase Loop | **`0.000%`** | **PASS** |
| `robin-town-hackathon-master.mp4` | `106.0s` | `S10` ScatterBloom + CountGrid (`926` Tests) | **`0.000%`** | **PASS** |
| `robin-town-hackathon-master.mp4` | `114.0s` | `S11` `$wif` Flywheel Card | **`0.000%`** | **PASS** |
| `robin-town-hackathon-master.mp4` | `133.0s` | `S13a` MetricMorph (`4,000 $wif` Pool & `4.6M+` Burn Proof) | **`0.000%`** | **PASS** |
| `robin-town-hackathon-master.mp4` | `175.0s` | `S16` PhoneStack 4-Seat WebSocket Parity | **`0.000%`** | **PASS** |
| `robin-town-hackathon-master.mp4` | `195.0s` | `S18` Final EndLockup (`ROBIN TOWN`) | **`0.000%`** | **PASS** |
| `robin-town-x-launch.mp4` | `1.5s` | `X01` OrbSwarm Fast Hook | **`0.000%`** | **PASS** |
| `robin-town-x-launch.mp4` | `5.0s` | `X02` BlockWordmark Lockup | **`0.000%`** | **PASS** |
| `robin-town-x-launch.mp4` | `14.5s` | `X04` 3D Harbor Diorama & 2D Toggle (`X1` Callout) | **`0.000%`** | **PASS** |
| `robin-town-x-launch.mp4` | `22.0s` | `X05b` OTC Deal Bundle | **`0.000%`** | **PASS** |
| `robin-town-x-launch.mp4` | `32.5s` | `X06Flywheel` Verified `$wif` & Staking (`X2` Callout) | **`0.000%`** | **PASS** |
| `robin-town-x-launch.mp4` | `42.0s` | `X08` Final EndLockup (`ROBIN TOWN`) | **`0.000%`** | **PASS** |
| `robin-town-intro.mp4` | `1.5s` | `I01` OrbSwarm Beat-Cut Hook | **`0.000%`** | **PASS** |
| `robin-town-intro.mp4` | `4.0s` | `I02a` BlockWordmark + TownMark Lockup | **`0.000%`** | **PASS** |
| `robin-town-intro.mp4` | `7.5s` | `I03` Live 3D Harbor Diorama (`I1` Callout) | **`0.000%`** | **PASS** |
| `robin-town-intro.mp4` | `11.0s` | `I04` Live OTC Bargaining + Mobile 3D Fast Play | **`0.000%`** | **PASS** |
| `robin-town-intro.mp4` | `15.0s` | `I05a` OrbitFlow 6-Year Zodiac Loop | **`0.000%`** | **PASS** |
| `robin-town-intro.mp4` | `17.5s` | `I05b` Bass-Kick Live Payday Harvest | **`0.000%`** | **PASS** |
| `robin-town-intro.mp4` | `22.0s` | `I06b` Live Desktop + Mobile `$wif` Hub & `ButtonPress` | **`0.000%`** | **PASS** |
| `robin-town-intro.mp4` | `26.5s` | `I07` Live Year 6 Standings (`I2` Callout) | **`0.000%`** | **PASS** |
| `robin-town-intro.mp4` | `31.5s` | `I08` Motionless EndLockup (`ROBIN TOWN`) | **`0.000%`** | **PASS** |

**Summary**: `27 / 27` sampled frames passed with **`max foreignHuePct = 0.000%`** (strictly below the `2.0%` ceiling).

---

## 7. Gate 3 Checklist Verification (Sections F & G)

- [x] **Section F.1**: Every scene starts on a musical boundary (`bars()` on Master and X Launch, and exact `raylight-intro.wav` audio transients on `RobinTownIntro`), sharing the same frame-pure Remotion scene language (`SolaceGround`, `TownMark`, `OrbitFlow`, `MetricMorph`, `Footage`, `Callout`, and native `@snapcn/*` components).
- [x] **Section F.2**: Primary action clicks (`Collect payday` at Master `2640`, `$wif` staking `1.20x` at Master `3720`, Year 6 settlement at Master `4350`, `DEAL!` stamp + Payday drop at X `780`, and `Stake 500 $wif` tap on Intro V2 `f677`) verified directly via rendered stills and MP4 frames, not from memory.
- [x] **Section F.3**: All `12` callout rings (`C1` to `C8`, `X1`, `X2`, `I1`, `I2`) sit cleanly on their real measured DOM bounding boxes (`min ringEdgeMarginPx = 25 px`), cards cover zero UI text (`max coveredTextCells = 0`), and chapter eyebrow chips sit in open stage space.
- [x] **Section F.4**: Palette fidelity verified across `27` sampled frames (`max foreignHuePct = 0.000% < 2.0%`), with 100% of tokens generated programmatically into `video/src/palette.ts`.
- [x] **Section F.5**: Full measured QA tables recorded in `docs/video/QA.md` alongside contact sheets (`docs/video/exports/intro-v2-qa-grid.png`, `docs/video/exports/motion-frames.png`, and `docs/video/exports/callouts-middle-frames.png`).
- [x] **Section F.6**: All three final 1080p masters (`robin-town-hackathon-master.mp4` at `69.1 MB`, `robin-town-x-launch.mp4` at `20.6 MB`, and `robin-town-intro.mp4` at `20.8 MB`) exported cleanly to `docs/video/exports/` under the `85 MB` size limit.
- [x] **Section F.7**: Strictly isolated inside `video/` and `docs/video/`, with zero changes to `src/` and zero `git commit` or `git push` actions executed.
- [x] **Section F.8 (Explicit Unverified Item by Name)**: **Human-ear acoustic playback** was not listened to physically in this headless build session; audio quality, EBU R128 loudness (`-14.0 LUFS` / `-14.2 LUFS` / `-14.0 LUFS`), True Peak (`-1.9 dBTP` / `-2.0 dBTP` / `-4.1 dBTP`), and pre-lockup settling were verified instrumentally via `ffmpeg loudnorm`, `astats`, and `freezedetect`.
- [x] **Section G**: Complete build-and-master handoff recorded, preserving script/board/music/sfx approval parity, captured `captured-boxes.json` coordinates, solved `callout-layout.json`, and reproducible scripts (`capture-takes.mjs`, `make-sound.mjs`, `layout-callouts.py`, `render-videos.mjs`, `render-intro.mjs`, `master.sh`, `qa.sh`, `qa-frames.py`, `make-contact-sheets.py`).
