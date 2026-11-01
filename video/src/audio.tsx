// Two-layer audio engine for RobinTownMaster (6,000f) and RobinTownXClip (1,320f):
//   1. MusicBed (Variant A Saigon Lo-Fi Nylon Guitar, Rhodes & Emerald Synth Drop @ 120 BPM)
//   2. SfxTrack (18 authentic Robin-Town WebAudio + Tone.js WAV cues from docs/video/sfx.md)
// Enforces hard -inf silence during pre-lockup beat (Frames 5685..5700 in Master; 1185..1200 in X Cut).
import { Audio, Sequence, interpolate, staticFile } from "remotion";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type SfxCueId =
  | "app-tap"
  | "app-stool-clack"
  | "app-deed-slide"
  | "app-shop-shutter"
  | "app-deal-stamp"
  | "app-neighbor-nod"
  | "app-payday-chime"
  | "app-calendar-tear"
  | "app-ipod-tick"
  | "tx-orb-glass"
  | "tx-block-fan"
  | "tx-bezel-dive"
  | "tx-callout-open"
  | "tx-orbit-whip"
  | "tx-riser-1bar"
  | "tx-riser-2bar"
  | "tx-sub-impact"
  | "tx-wif-burn";

interface CueEvent {
  at: number;
  cue: SfxCueId;
  gain?: number;
  maxFrames?: number;
}

const DEFAULT_GAIN: Record<SfxCueId, number> = {
  "app-tap": 0.42,
  "app-stool-clack": 0.56,
  "app-deed-slide": 0.48,
  "app-shop-shutter": 0.56,
  "app-deal-stamp": 0.72,
  "app-neighbor-nod": 0.36,
  "app-payday-chime": 0.68,
  "app-calendar-tear": 0.50,
  "app-ipod-tick": 0.52,
  "tx-orb-glass": 0.42,
  "tx-block-fan": 0.52,
  "tx-bezel-dive": 0.56,
  "tx-callout-open": 0.30,
  "tx-orbit-whip": 0.55,
  "tx-riser-1bar": 0.52,
  "tx-riser-2bar": 0.56,
  "tx-sub-impact": 0.80,
  "tx-wif-burn": 0.64,
};

export const MASTER_SFX: CueEvent[] = [
  // Ch 0: Opening Hook & Lockup
  { at: 0, cue: "tx-orb-glass" },
  { at: 60, cue: "tx-orb-glass" },
  { at: 120, cue: "tx-orb-glass" },
  { at: 180, cue: "app-payday-chime" },
  { at: 240, cue: "tx-block-fan" },
  { at: 315, cue: "app-stool-clack" },
  { at: 360, cue: "app-tap" },
  { at: 435, cue: "tx-bezel-dive" },

  // Ch 1: Living Town & 2D/3D Toggle
  { at: 480, cue: "app-tap" },
  { at: 780, cue: "tx-callout-open" },
  { at: 1020, cue: "app-tap" },
  { at: 1080, cue: "tx-callout-open" },
  { at: 1335, cue: "app-stool-clack" },
  { at: 1350, cue: "app-stool-clack", gain: 0.44 },

  // Ch 2: Two-Way OTC Bargaining
  { at: 1440, cue: "app-deed-slide" },
  { at: 1520, cue: "app-stool-clack" },
  { at: 1575, cue: "app-deed-slide" },
  { at: 1680, cue: "tx-callout-open" },
  { at: 1935, cue: "app-tap" },
  { at: 1950, cue: "app-deal-stamp" },
  { at: 1965, cue: "app-neighbor-nod" },
  { at: 2040, cue: "tx-callout-open" },
  { at: 2310, cue: "app-shop-shutter" },

  // Ch 3: 6-Year Engine & DROP 1 (Frame 2640)
  { at: 2400, cue: "app-tap" },
  { at: 2565, cue: "tx-orbit-whip" },
  { at: 2580, cue: "tx-riser-1bar", maxFrames: 60 },
  { at: 2640, cue: "tx-sub-impact" },
  { at: 2640, cue: "app-payday-chime", gain: 0.76 },
  { at: 2685, cue: "app-calendar-tear" },
  { at: 2700, cue: "tx-callout-open" },
  { at: 3060, cue: "tx-bezel-dive" },
  { at: 3150, cue: "app-stool-clack" },

  // Ch 4: $wif Flywheel & HERO DROP 2 (Frame 3720)
  { at: 3360, cue: "app-tap" },
  { at: 3480, cue: "tx-callout-open" },
  { at: 3600, cue: "tx-riser-2bar", maxFrames: 120 },
  { at: 3720, cue: "tx-sub-impact" },
  { at: 3720, cue: "app-payday-chime", gain: 0.78 },
  { at: 3750, cue: "tx-wif-burn" },
  { at: 3780, cue: "tx-callout-open" },
  { at: 3960, cue: "app-deal-stamp" },
  { at: 4080, cue: "app-payday-chime" },

  // Ch 5: ROBIN-POD, Apple Carousel & Multi-Seat Stack
  { at: 4440, cue: "app-ipod-tick" },
  { at: 4460, cue: "app-ipod-tick" },
  { at: 4480, cue: "app-ipod-tick" },
  { at: 4500, cue: "app-ipod-tick" },
  { at: 4635, cue: "app-tap" },
  { at: 4740, cue: "tx-callout-open" },
  { at: 4800, cue: "app-ipod-tick" },
  { at: 4806, cue: "app-ipod-tick" },
  { at: 4812, cue: "app-ipod-tick" },
  { at: 4818, cue: "app-ipod-tick" },
  { at: 4824, cue: "app-ipod-tick" },
  { at: 4830, cue: "app-ipod-tick" },
  { at: 5100, cue: "app-deed-slide" },
  { at: 5124, cue: "app-tap", gain: 0.34 },
  { at: 5148, cue: "app-tap", gain: 0.34 },
  { at: 5172, cue: "app-tap", gain: 0.34 },

  // Ch 6: Quickstart -> Mandatory 15-frame Silence (5685..5700) -> Final Lockup (5700)
  { at: 5400, cue: "tx-bezel-dive" },
  { at: 5550, cue: "app-payday-chime", maxFrames: 120 },
  { at: 5700, cue: "tx-sub-impact" },
  { at: 5700, cue: "app-shop-shutter", gain: 0.62 },
];

export const X_SFX: CueEvent[] = [
  { at: 0, cue: "tx-orb-glass" },
  { at: 90, cue: "app-payday-chime" },
  { at: 120, cue: "tx-block-fan" },
  { at: 180, cue: "tx-bezel-dive" },
  { at: 330, cue: "app-tap" },
  { at: 360, cue: "tx-callout-open" },
  { at: 540, cue: "app-stool-clack" },
  { at: 660, cue: "app-deal-stamp" },
  { at: 720, cue: "tx-riser-1bar", maxFrames: 60 },
  { at: 780, cue: "tx-sub-impact" },
  { at: 780, cue: "app-payday-chime", gain: 0.78 },
  { at: 840, cue: "tx-wif-burn" },
  { at: 900, cue: "tx-callout-open" },
  { at: 1110, cue: "app-ipod-tick" },
  { at: 1116, cue: "app-ipod-tick" },
  { at: 1122, cue: "app-ipod-tick" },
  { at: 1128, cue: "app-ipod-tick" },
  // Mandatory 15-frame Silence: 1185..1200 -> Final Lockup at 1200
  { at: 1200, cue: "tx-sub-impact" },
  { at: 1200, cue: "app-shop-shutter", gain: 0.62 },
];

export function MasterAudio() {
  return (
    <>
      <Audio
        src={staticFile("audio/music-full.wav")}
        volume={(f) => {
          // Hard -inf silence across pre-lockup beat (Frames 5685..5700)
          if (f >= 5684 && f < 5700) return 0;
          if (f >= 5680 && f < 5684) {
            return interpolate(f, [5680, 5684], [0.64, 0], CLAMP);
          }
          // Natural end decay on final bar (5930..6000)
          if (f >= 5930) {
            return interpolate(f, [5930, 5998], [0.68, 0], CLAMP);
          }
          // Hero Drop 1 (2640..3060) & Hero Drop 2 (3720..4440)
          if ((f >= 2640 && f < 3060) || (f >= 3720 && f < 4440)) {
            return 0.86;
          }
          // Pre-drop risers slightly tucked so harmonic swell shines
          if ((f >= 2580 && f < 2640) || (f >= 3600 && f < 3720)) {
            return 0.56;
          }
          return 0.68;
        }}
      />
      {MASTER_SFX.map((ev, idx) => {
        const capBeforeSilence = ev.at < 5684 ? 5684 - ev.at : 300;
        const dur = Math.max(1, Math.min(ev.maxFrames ?? 90, capBeforeSilence));
        return (
          <Sequence key={`m-sfx-${idx}-${ev.at}-${ev.cue}`} from={ev.at} durationInFrames={dur}>
            <Audio
              src={staticFile(`audio/sfx/${ev.cue}.wav`)}
              volume={ev.gain ?? DEFAULT_GAIN[ev.cue]}
            />
          </Sequence>
        );
      })}
    </>
  );
}

export function XClipAudio() {
  return (
    <>
      <Audio
        src={staticFile("audio/music-x.wav")}
        volume={(f) => {
          // Hard -inf silence across pre-lockup beat (Frames 1185..1200)
          if (f >= 1184 && f < 1200) return 0;
          if (f >= 1180 && f < 1184) {
            return interpolate(f, [1180, 1184], [0.64, 0], CLAMP);
          }
          if (f >= 1275) {
            return interpolate(f, [1275, 1318], [0.68, 0], CLAMP);
          }
          // Hero Drop (780..1080)
          if (f >= 780 && f < 1080) return 0.86;
          if (f >= 720 && f < 780) return 0.56;
          return 0.68;
        }}
      />
      {X_SFX.map((ev, idx) => {
        const capBeforeSilence = ev.at < 1184 ? 1184 - ev.at : 120;
        const dur = Math.max(1, Math.min(ev.maxFrames ?? 90, capBeforeSilence));
        return (
          <Sequence key={`x-sfx-${idx}-${ev.at}-${ev.cue}`} from={ev.at} durationInFrames={dur}>
            <Audio
              src={staticFile(`audio/sfx/${ev.cue}.wav`)}
              volume={ev.gain ?? DEFAULT_GAIN[ev.cue]}
            />
          </Sequence>
        );
      })}
    </>
  );
}
