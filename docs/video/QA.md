# Gate 3 Build and Master QA Report: Robin-Town

**Status**: PASS (Gate 3 Verified, Mastered, and Exported)  
**Project**: Robin-Town (`https://github.com/harrymove-ctrl/robin-town`)  
**Approved Score**: Variant A, Harbor Lo-Fi Acoustic Nylon Guitar, Rhodes, and Emerald Synth Drop (`120 BPM`, `48 kHz` Stereo)  
**Export Directory**: `/Volumes/Dev/china-town/docs/video/exports/`

---

## 1. Mastered Deliverables Summary

| Deliverable | File Path | Resolution & Frame Rate | Exact Frames & Duration | Codec & Pixel Format | File Size (`< 85 MB` Cap) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Hackathon Master (`3:20`)** | `docs/video/exports/robin-town-hackathon-master.mp4` | `1920x1080 @ 30fps` | `6,000 frames` (`200.000000s`) | `h264` (`libx264 -crf 20`, `yuv420p`) + `aac` (`48 kHz`, `2ch`, `320k`) | **`69.1 MB`** (`72,425,317 B`) | **PASS** |
| **X Launch Cut (`0:44`)** | `docs/video/exports/robin-town-x-launch.mp4` | `1920x1080 @ 30fps` | `1,320 frames` (`44.000000s`) | `h264` (`libx264 -crf 20`, `yuv420p`) + `aac` (`48 kHz`, `2ch`, `320k`) | **`20.6 MB`** (`21,555,341 B`) | **PASS** |
| **Motion Scenes Contact Sheet** | `docs/video/exports/motion-frames.png` | `1864x1568` PNG | `12` motion & camera panels | Lossless RGB PNG | `1.7 MB` (`1,812,692 B`) | **PASS** |
| **Callout Non-Overlap Sheet** | `docs/video/exports/callouts-middle-frames.png` | `1768x2686` PNG | `10` middle-frame callouts (`C1` to `C8`, `X1`, `X2`) | Lossless RGB PNG | `3.7 MB` (`3,870,905 B`) | **PASS** |

---

## 2. Live Feature & 100% English Localization Verification

| Feature Pillar | Live Evidence Verified in Mastered MP4s & Contact Sheets | Verdict |
| :--- | :--- | :--- |
| **3D Harbor Diorama (Day, Sunset, Night)** | Captured live in `clip-01-living-town.mp4` (`S03`, `S05`, `X03`, `X04`) and `seat-01-3d.png`: chamfered walnut harbor plinth, animated turquoise waves, cargo barges, timber pier, lighthouse beam, connected shop plinths, sidewalk cafes, street-orbit camera sweep, and live `Day` -> `Sunset` -> `Night` -> `2D Map` transitions. | **PASS** |
| **Verified `$wif` On-Chain Burn Proof** | Captured live from `/api/onchain-wif` in `clip-04-wif-flywheel.mp4` (`S12`, `X06Flywheel`), `seat-04-hub.png`, and `MetricMorph` (`S13a`): official ERC-20 `0xE49A1C3033EcC6b804bc423021D3F71F1A3e0F9B` (`0xE49A1C…0F9B`) with live `● On-Chain Block #103,099,794 · 4,600,001 $wif burned on 0x…dEaD`. | **PASS** |
| **Live Cross-Device WebSocket Rooms** | Captured live in `clip-05-gadgets-and-rooms.mp4` (`S15`, `X07`), `S14`, `S16`, and `S10`: `Create Room Code` spawns a real 6-character room code and connects a live second browser context over `/ws/room`. | **PASS** |
| **100% English Copy & Zero Dashes** | Verified across all `video/src/` scenes, captured gameplay HUDs, modals, and `docs/video/` docs: `You`, `Cole`, `Maya`, `Clara`; `Sherwood`, `Clocktower`, `Harborview`, `Lantern Hall`, `Grand Market`, `Maple Lane`; `Coffee House`, `Artisan Bakery`, `Noodle Kitchen`, `Flower Studio`, `Tailor Atelier`, `Corner Grocer`; `926 tests passed (26 suites), 69/69 pixel sprites verified`; zero em-dashes, en-dashes, or spaced hyphens in prose or UI strings. | **PASS** |

---

## 3. EBU R128 Audio Mastering & Pre-Lockup Silence Verification

Measured via `ffmpeg -af loudnorm=print_format=summary` and `astats` in `video/scripts/qa.sh` (`video/out/qa-report.txt`):

| Metric | Target | Hackathon Master (`3:20.0`) | X Launch Cut (`0:44.0`) | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Integrated Loudness (`I`)** | `-14.0 +/- 1.0 LUFS` | **`-14.0 LUFS`** | **`-14.2 LUFS`** | **PASS** |
| **True Peak (`TP`)** | `<= -1.0 dBTP` | **`-1.9 dBTP`** | **`-2.0 dBTP`** | **PASS** |
| **Loudness Range (`LRA`)** | `3.0 to 9.0 LU` | **`3.9 LU`** | **`4.0 LU`** | **PASS** |
| **Sample Rate & Channels** | `48,000 Hz`, Stereo (`2ch`) | `48,000 Hz`, `2ch` | `48,000 Hz`, `2ch` | **PASS** |
| **Pre-Lockup 1-Beat Hard Silence** | `<= -70.0 dBFS` (`0.50s` before end card) | **`-inf dB` Peak / `-inf dB` RMS** (`189.53s` for `0.44s`) | **`-inf dB` Peak / `-inf dB` RMS** (`39.53s` for `0.44s`) | **PASS** |

---

## 4. Downbeat Alignment, Drop Sync & Visual Integrity Checks

| Check | Specification | Measured Result | Verdict |
| :--- | :--- | :--- | :--- |
| **120 BPM Bar Grid (`bars()`)** | Every scene starts and ends on exact `60`-frame (`2.00s`) bar boundaries | `RobinTownMaster = 100 bars (6,000f)`, `RobinTownXClip = 22 bars (1,320f)`, zero fractional bar drift | **PASS** |
| **Master Drop 1 Frame Sync** | Annual Payday click (`Collect payday`) + `DrawnTick` on frame `2640` (`01:28.0`) | Verified on `motion-07.png` (`Frame 2648`): `DrawnTick` badge active on `Collect payday`, `+240 $wif` (`1.20x $wif Staking Boost applied`), HUD updated cleanly | **PASS** |
| **Master Drop 2 Frame Sync** | `$wif` Staking `1.20x` activation (`Frame 3720`) & Year 6 Pool Settlement (`Frame 4350`) | Verified across `callout-06.png` (`Unstake 500 $wif (Active 1.20x)`) and `S13b` Year 6 Final Standings (`1,480 $wif`, `+2,160 $wif` payout, `200 $wif` burned) | **PASS** |
| **X Clip Drop Frame Sync** | OTC Bargain & Deal Sealed (`X05b`) across frames `600` to `780` (`00:20.0` to `00:26.0`) | Verified `DEAL!` stamp + `1% OTC protocol fee` routed to Staking Vault, followed by `Frame 780` Payday drop | **PASS** |
| **Black Frame Detection** | `blackdetect=d=0.3:pix_th=0.05` (`0` unintended black segments) | **`0` black segments** in both `robin-town-hackathon-master.mp4` and `robin-town-x-launch.mp4` | **PASS** |
| **Freeze Frame Detection** | `freezedetect=n=0.003:d=1.5` (no stalled gameplay recordings; static holds allowed only on title cards, dimmed modal callout plates, and end lockup) | `0` stalled gameplay clips; all detected static spans map strictly to kinetic card holds (`S02`, `S04`, `S06`, `S10`, `S11`, `S14`), flattened modal callout plates (`C2`, `C3`, `C4`, `C5`, `C6`, `C7`, `C8`, `X1`, `X2`), and final end-card holds (`190.9s to 200.0s` Master, `40.9s to 44.0s` X) | **PASS** |
| **Zero Slop / Zero Mock Audit** | Zero `"mock"`, `"simulation"`, `"Alice"`, `"Dana"` strings; real EIP-1193 `0x7F4C89…` wallet and verified `0xE49A1C…0F9B` token | Visually verified across `motion-frames.png`, `callouts-middle-frames.png`, and `seat-04-hub.png`: `Connected: 0x7F4C89…`, `0xE49A1C…0F9B`, `4,600,001 $wif burned on 0x…dEaD`, `Active 1.20x` boost | **PASS** |
| **Single-Pointer Discipline** | At most one cursor or click ring visible on any frame | Verified across all footage scenes: headless Playwright hides the OS cursor and only `@snapcn/cursor-track` or `DrawnTick` renders | **PASS** |
| **Final Watermark Rule** | Zero preview watermarks on final masters | Verified clean across all `6,000` Master frames and `1,320` X frames | **PASS** |
| **Clean Repository Separation** | Zero modifications to `/Volumes/Dev/china-town/src/` by the video build | All video code, assets, and masters isolated strictly inside `video/` and `docs/video/`; `npm run typecheck` exited `0` | **PASS** |

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

**Summary**: `10 / 10` callouts solved with **`max coveredTextCells = 0`** and **`min ringEdgeMarginPx = 25 px`**.

---

## 6. Palette Hue Fidelity Audit (`video/out/palette-qa.json`)

Audited by `video/scripts/qa-frames.py` across `18` sampled frames (`12` Master + `6` X Launch) against hues programmatically extracted from Robin-Town's real CSS and TypeScript design tokens (`video/src/palette.ts`, generated by `video/scripts/gen-palette.mjs`):

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

**Summary**: `18 / 18` sampled frames passed with **`max foreignHuePct = 0.000%`** (strictly below the `2.0%` ceiling).

---

## 7. Gate 3 Checklist Verification (Sections F & G)

- [x] **Section F.1**: Every scene starts on a downbeat (`bars()`); both `RobinTownMaster` (`6,000f`) and `RobinTownXClip` (`1,320f`) share the exact same frame-pure scene components, with `RobinTownXClip` structured as a tight `22`-bar (`0:44.0`) launch re-timing of the master cut.
- [x] **Section F.2**: Primary action clicks (`Collect payday` at Master frame `2640`, `$wif` staking `1.20x` activation at Master frame `3720`, Year 6 settlement at Master frame `4350`, and `DEAL!` stamp + Payday drop at X frame `780`) verified directly via rendered stills and MP4 frames, not from memory.
- [x] **Section F.3**: All `10` callout rings sit cleanly on their real measured DOM bounding boxes (`min ringEdgeMarginPx = 25 px`), cards cover zero UI text (`max coveredTextCells = 0`), and chapter eyebrow chips sit in open stage space (`callouts-middle-frames.png`).
- [x] **Section F.4**: Palette fidelity verified across `18` sampled frames (`max foreignHuePct = 0.000% < 2.0%`), with 100% of tokens generated programmatically into `video/src/palette.ts`.
- [x] **Section F.5**: Full measured QA tables recorded in `docs/video/QA.md` alongside both contact sheets (`docs/video/exports/motion-frames.png` and `docs/video/exports/callouts-middle-frames.png`).
- [x] **Section F.6**: Both final 1080p masters (`robin-town-hackathon-master.mp4` at `69.1 MB` and `robin-town-x-launch.mp4` at `20.6 MB`) exported cleanly to `docs/video/exports/` under the `85 MB` size limit.
- [x] **Section F.7**: Strictly isolated inside `video/` and `docs/video/`, with zero changes to `src/` and zero `git commit` or `git push` actions executed.
- [x] **Section F.8 (Explicit Unverified Item by Name)**: **Human-ear acoustic playback** was not listened to physically in this headless build session; audio quality, EBU R128 loudness (`-14.0 LUFS` / `-14.2 LUFS`), True Peak (`-1.9 dBTP` / `-2.0 dBTP`), and pre-lockup hard silence (`-inf dB`) were verified instrumentally via `ffmpeg loudnorm` and `astats`.
- [x] **Section G**: Complete build-and-master handoff recorded, preserving script/board/music/sfx approval parity, captured `captured-boxes.json` coordinates, solved `callout-layout.json`, and reproducible scripts (`capture-takes.mjs`, `make-sound.mjs`, `layout-callouts.py`, `render-videos.mjs`, `master.sh`, `qa.sh`, `qa-frames.py`, `make-contact-sheets.py`).
