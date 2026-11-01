// Typed shot specifications for RobinTownMaster (6,000f) and RobinTownXClip (1,320f).
// Every bounding box and event timestamp comes from real 1920x1080 DOM measurements in captured-boxes.json.
import CAPTURED from "./datasets/captured-boxes.json";
import type { CalloutSpec, ScreenBox, TargetId } from "./components/Callout";
import { FPS } from "./grid";
import { PALETTE } from "./palette";

export interface Point {
  x: number;
  y: number;
}

export interface CamKey {
  at: number;
  scale: number;
  /** Viewport coordinate (1920x1080) placed near canvas center. */
  focus: Point;
  /** Y-axis perspective tilt in degrees (cruising 8..11 deg, callout 0 deg flat). */
  yaw?: number;
  /** Optional horizontal framing shift over SolaceGround for tall centered modals. */
  panX?: number;
}

export interface ShotSpec {
  id: string;
  clip: string;
  trimBefore: number;
  playbackRate?: number;
  eyebrow?: { n: number; title: string };
  camera: CamKey[];
  /** Scene-local click rings (single-pointer @snapcn/cursor-track). */
  rings?: Array<{ at: number; p: Point }>;
  /** Drawn emerald confirmation ticks synced to button-press / downbeats. */
  ticks?: Array<{ at: number; p: Point }>;
  callouts?: CalloutSpec[];
}

const B = CAPTURED.boxes as Record<string, ScreenBox>;
const E = CAPTURED.events;

export const TARGETS: Record<TargetId, ScreenBox> = {
  C1: B.C1,
  C2: B.C2,
  C3: B.C3,
  C4: B.C4,
  C5: B.C5,
  C6: B.C6,
  C7: B.C7,
  C8: B.C8,
  X1: B.X1,
  X2: B.X2,
};

const centerOf = (box: ScreenBox): Point => ({
  x: Math.round(box.x + box.w / 2),
  y: Math.round(box.y + box.h / 2),
});

const f = (sec: number): number => Math.max(0, Math.round(sec * FPS));

export const MASTER_SHOTS = {
  // S05 (Bars 11..24 = 14 bars = 840f, Composition 600..1440):
  // 3D Harbor Diorama (Street -> Sunset -> Night -> Isometric Day) -> Callout C1 -> 1-click 2D toggle at 420f -> Callout C2 -> Stool draft
  S05: {
    id: "S05",
    clip: "clips/clip-01-living-town.mp4",
    trimBefore: f(E.clip01Start),
    eyebrow: { n: 1, title: "3D Harbor Diorama" },
    camera: [
      { at: 0, scale: 1.01, focus: { x: 960, y: 540 }, yaw: 11 },
      { at: 150, scale: 1.06, focus: { x: 920, y: 520 }, yaw: 11 },
      { at: 180, scale: 1.05, focus: { x: 880, y: 520 }, yaw: 0 },
      { at: 420, scale: 1.05, focus: { x: 1020, y: 480 }, yaw: 0 },
      { at: 480, scale: 1.05, focus: { x: 1060, y: 460 }, yaw: 0 },
      { at: 720, scale: 1.05, focus: { x: 960, y: 520 }, yaw: 0 },
      { at: 765, scale: 1.02, focus: { x: 960, y: 540 }, yaw: -10 },
      { at: 840, scale: 1.07, focus: { x: 960, y: 540 }, yaw: -10 },
    ],
    rings: [
      { at: 420, p: centerOf(B.viewToggleBtn) },
      { at: 735, p: { x: 820, y: 480 } },
      { at: 765, p: { x: 930, y: 520 } },
    ],
    ticks: [{ at: 420, p: centerOf(B.viewToggleBtn) }],
    callouts: [
      {
        id: "C1",
        from: 180,
        to: 420,
        side: "right",
        what: "3D Harbor Diorama, Day to Night",
        why: "Spot vacant deeds, connected shops, and golden chains instantly.",
        accent: PALETTE.accentEmerald,
      },
      {
        id: "C2",
        from: 480,
        to: 720,
        side: "below",
        what: "One-click 2D and 3D toggle",
        why: "Switch views anytime without losing plots or $wif balances.",
        accent: PALETTE.accentGold,
      },
    ],
  } satisfies ShotSpec,

  // S07 (Bars 27..40 = 14 bars = 840f, Composition 1560..2400):
  // Open OTC Bargaining Table -> Callout C3 -> Propose & DEAL! stamp (Comp 1950) -> Callout C4 -> Noodle Kitchen chain tower
  S07: {
    id: "S07",
    clip: "clips/clip-02-otc-bargain.mp4",
    trimBefore: f(E.clip02Start),
    eyebrow: { n: 2, title: "OTC Bargaining" },
    camera: [
      { at: 0, scale: 1.02, focus: { x: 960, y: 540 }, yaw: 10 },
      { at: 90, scale: 1.06, focus: { x: 960, y: 520 }, yaw: 8 },
      { at: 120, scale: 1.04, focus: { x: 960, y: 520 }, yaw: 0, panX: -220 },
      { at: 350, scale: 1.04, focus: { x: 960, y: 520 }, yaw: 0, panX: -220 },
      { at: 375, scale: 1.05, focus: { x: 960, y: 560 }, yaw: 0, panX: 0 },
      { at: 480, scale: 1.05, focus: { x: 960, y: 520 }, yaw: 0, panX: 0 },
      { at: 720, scale: 1.05, focus: { x: 960, y: 520 }, yaw: 0, panX: 0 },
      { at: 765, scale: 1.03, focus: { x: 920, y: 510 }, yaw: 10 },
      { at: 840, scale: 1.09, focus: { x: 890, y: 495 }, yaw: 10 },
    ],
    rings: [
      { at: 66, p: { x: 260, y: 310 } },
      { at: 375, p: centerOf(B.proposeBtn) },
      { at: 750, p: { x: 860, y: 520 } },
    ],
    ticks: [{ at: 375, p: centerOf(B.proposeBtn) }],
    callouts: [
      {
        id: "C3",
        from: 120,
        to: 360,
        side: "right",
        what: "Two-way OTC bargaining table",
        why: "Trade $wif, deeds, and shop tiles in one swap.",
        accent: PALETTE.accentGold,
      },
      {
        id: "C4",
        from: 480,
        to: 720,
        side: "below",
        what: "1% OTC cash micro-fee",
        why: "Every settled cash trade feeds the neighborhood Staking Vault.",
        accent: PALETTE.accentEmerald,
      },
    ],
  } satisfies ShotSpec,

  // S09 (Bars 44..51 = 8 bars = 480f, Composition 2580..3060):
  // 1-bar riser -> DROP 1 at 60f (Comp 2640 Exact Downbeat!) -> Callout C5 -> Two-page Shopkeeper Ledger
  S09: {
    id: "S09",
    clip: "clips/clip-03-payday-harvest.mp4",
    trimBefore: f(E.clip03Start),
    eyebrow: { n: 3, title: "Annual Payday" },
    camera: [
      { at: 0, scale: 1.02, focus: { x: 1020, y: 560 }, yaw: -10 },
      { at: 60, scale: 1.07, focus: { x: 1000, y: 540 }, yaw: -5 },
      { at: 120, scale: 1.05, focus: { x: 960, y: 510 }, yaw: 0 },
      { at: 420, scale: 1.05, focus: { x: 960, y: 510 }, yaw: 0 },
      { at: 450, scale: 1.03, focus: { x: 960, y: 540 }, yaw: 9 },
      { at: 480, scale: 1.06, focus: { x: 960, y: 540 }, yaw: 9 },
    ],
    rings: [
      { at: 60, p: centerOf(B.collectBtn) },
      { at: 425, p: { x: 1520, y: 42 } },
    ],
    ticks: [{ at: 60, p: centerOf(B.collectBtn) }],
    callouts: [
      {
        id: "C5",
        from: 120,
        to: 420,
        side: "below",
        what: "Compounding annual $wif payday",
        why: "Connected storefronts pay higher $wif yields every single year.",
        accent: PALETTE.accentGold,
      },
    ],
  } satisfies ShotSpec,

  // S12 (Bars 59..66 = 8 bars = 480f, Composition 3480..3960):
  // Callout C6 (Chain 46631 + Verified $wif) -> HERO DROP 2 at 240f (Comp 3720) -> 1.20x Stake & Burn -> Callout C7
  S12: {
    id: "S12",
    clip: "clips/clip-04-wif-flywheel.mp4",
    trimBefore: f(E.clip04Start),
    eyebrow: { n: 4, title: "$wif Flywheel" },
    camera: [
      { at: 0, scale: 1.02, focus: { x: 960, y: 520 }, yaw: 0, panX: -255 },
      { at: 225, scale: 1.02, focus: { x: 960, y: 520 }, yaw: 0, panX: -255 },
      { at: 240, scale: 1.05, focus: { x: 960, y: 540 }, yaw: 0, panX: 0 },
      { at: 295, scale: 1.05, focus: { x: 960, y: 540 }, yaw: 0, panX: 0 },
      { at: 310, scale: 1.02, focus: { x: 960, y: 540 }, yaw: 0, panX: -255 },
      { at: 480, scale: 1.02, focus: { x: 960, y: 540 }, yaw: 0, panX: -255 },
    ],
    rings: [
      { at: 42, p: { x: 740, y: 420 } },
      { at: 240, p: centerOf(B.stakeBtn) },
      { at: 270, p: { x: 760, y: 710 } },
    ],
    ticks: [{ at: 240, p: centerOf(B.stakeBtn) }],
    callouts: [
      {
        id: "C6",
        from: 0,
        to: 240,
        side: "right",
        what: "Verified $wif on Chain 46631",
        why: "Start free immediately, then connect your Robinhood Chain wallet.",
        accent: PALETTE.accentEmerald,
      },
      {
        id: "C7",
        from: 300,
        to: 480,
        side: "right",
        what: "1.20x staking and permanent burns",
        why: "Boost shop payouts while swaps and votes burn $wif.",
        accent: PALETTE.accentGold,
      },
    ],
  } satisfies ShotSpec,

  // S13b (Bars 69..74 = 6 bars = 360f, Composition 4080..4440):
  // Year 6 Final $wif Standings & Ranked 4,000 $wif Purse Settlement
  S13b: {
    id: "S13b",
    clip: "clips/clip-06-year6-standings.mp4",
    trimBefore: f(E.clip06Start),
    eyebrow: { n: 4, title: "Year 6 Settlement" },
    camera: [
      { at: 0, scale: 1.02, focus: { x: 960, y: 540 }, yaw: -9 },
      { at: 90, scale: 1.06, focus: { x: 960, y: 520 }, yaw: -7 },
      { at: 360, scale: 1.11, focus: { x: 960, y: 500 }, yaw: -5 },
    ],
    rings: [{ at: 42, p: { x: 1680, y: 1030 } }],
    ticks: [{ at: 42, p: { x: 1680, y: 1030 } }],
  } satisfies ShotSpec,

  // S15 (Bars 78..85 = 8 bars = 480f, Composition 4620..5100):
  // Apple Carousel + SolaceUI shader -> ROBIN-POD Click Wheel Callout C8 -> Live WebSocket Room Lobby
  S15: {
    id: "S15",
    clip: "clips/clip-05-gadgets-and-rooms.mp4",
    trimBefore: f(E.clip05Start),
    eyebrow: { n: 5, title: "ROBIN-POD & Rooms" },
    camera: [
      { at: 0, scale: 1.02, focus: { x: 960, y: 540 }, yaw: 10 },
      { at: 105, scale: 1.05, focus: { x: 960, y: 540 }, yaw: 8 },
      { at: 120, scale: 1.04, focus: { x: 1060, y: 560 }, yaw: 0 },
      { at: 420, scale: 1.04, focus: { x: 1060, y: 560 }, yaw: 0 },
      { at: 445, scale: 1.04, focus: { x: 960, y: 540 }, yaw: -8 },
      { at: 480, scale: 1.07, focus: { x: 960, y: 540 }, yaw: -8 },
    ],
    rings: [
      { at: 36, p: { x: 960, y: 860 } },
      { at: 180, p: { x: 1775, y: 830 } },
      { at: 425, p: { x: 740, y: 780 } },
    ],
    ticks: [{ at: 435, p: { x: 740, y: 780 } }],
    callouts: [
      {
        id: "C8",
        from: 120,
        to: 420,
        side: "left",
        what: "Collapsible ROBIN-POD click wheel",
        why: "Control Harbor lo-fi radio and game phases one-handed.",
        accent: PALETTE.accentMintPill,
      },
    ],
  } satisfies ShotSpec,
} as const;

export const X_SHOTS = {
  // X04 (Bars 5..9 = 5 bars = 300f, Composition 240..540):
  // 3D Harbor Diorama -> click 3D City toggle at 90f (Comp 330) -> Callout X1 (120..270f = 5.0s)
  X04: {
    id: "X04",
    clip: "clips/clip-01-living-town.mp4",
    trimBefore: Math.max(0, f(E.clip01Toggle - 3.0)),
    camera: [
      { at: 0, scale: 1.02, focus: { x: 960, y: 540 }, yaw: 11 },
      { at: 90, scale: 1.06, focus: { x: 1040, y: 480 }, yaw: 6 },
      { at: 120, scale: 1.05, focus: { x: 1040, y: 470 }, yaw: 0 },
      { at: 270, scale: 1.05, focus: { x: 1000, y: 490 }, yaw: 0 },
      { at: 300, scale: 1.07, focus: { x: 960, y: 530 }, yaw: -9 },
    ],
    rings: [{ at: 90, p: centerOf(B.viewToggleBtn) }],
    ticks: [{ at: 90, p: centerOf(B.viewToggleBtn) }],
    callouts: [
      {
        id: "X1",
        from: 120,
        to: 270,
        side: "below",
        what: "3D Harbor Diorama and 2D toggle",
        why: "Switch views anytime with zero state loss.",
        accent: PALETTE.accentGold,
      },
    ],
  } satisfies ShotSpec,

  // X05b (Bars 11..13 = 3 bars = 180f, Composition 600..780):
  // OTC Bargaining Table stamps DEAL! at 60f (Comp 660) + completes 4-lot Noodle Kitchen golden chain tower
  X05b: {
    id: "X05b",
    clip: "clips/clip-02-otc-bargain.mp4",
    trimBefore: Math.max(0, f(E.clip02Propose - 1.5)),
    playbackRate: 1.08,
    camera: [
      { at: 0, scale: 1.03, focus: { x: 960, y: 540 }, yaw: 9 },
      { at: 60, scale: 1.07, focus: { x: 980, y: 560 }, yaw: 7 },
      { at: 180, scale: 1.10, focus: { x: 900, y: 500 }, yaw: -9 },
    ],
    rings: [{ at: 45, p: centerOf(B.proposeBtn) }],
    ticks: [{ at: 45, p: centerOf(B.proposeBtn) }],
  } satisfies ShotSpec,

  // X06a (Bar 14 = 60f, Composition 780..840):
  // HERO DROP DOWNBEAT at 0f (Comp 780): Collect $wif income ticks emerald & $wif banknotes fly!
  X06Payday: {
    id: "X06Payday",
    clip: "clips/clip-03-payday-harvest.mp4",
    trimBefore: Math.max(0, f(E.clip03Collect - 0.15)),
    camera: [
      { at: 0, scale: 1.04, focus: { x: 1000, y: 540 }, yaw: -8 },
      { at: 60, scale: 1.09, focus: { x: 960, y: 510 }, yaw: -4 },
    ],
    rings: [{ at: 4, p: centerOf(B.collectBtn) }],
    ticks: [{ at: 4, p: centerOf(B.collectBtn) }],
  } satisfies ShotSpec,

  // X06c (Bars 16..18 = 3 bars = 180f, Composition 900..1080):
  // Callout X2 (0..165f = 5.5s, 0 deg flat) over live Chain 46631 + 1.20x Staked + 1,534 $wif Burned
  X06Flywheel: {
    id: "X06Flywheel",
    clip: "clips/clip-04-wif-flywheel.mp4",
    trimBefore: Math.max(0, f(E.clip04Stake + 2.2)),
    camera: [
      { at: 0, scale: 1.02, focus: { x: 960, y: 490 }, yaw: 0, panX: -255 },
      { at: 165, scale: 1.02, focus: { x: 960, y: 490 }, yaw: 0, panX: -255 },
      { at: 180, scale: 1.07, focus: { x: 960, y: 510 }, yaw: 6, panX: 0 },
    ],
    callouts: [
      {
        id: "X2",
        from: 0,
        to: 165,
        side: "right",
        what: "1.20x staking and $wif burns",
        why: "Play free or compete live on Chain 46631.",
        accent: PALETTE.accentEmerald,
      },
    ],
  } satisfies ShotSpec,

  // X07 (Bars 19..20 = 2 bars = 120f, Composition 1080..1200):
  // ROBIN-POD Click Wheel rotary detents + 6-character P2P Room Lobby right before 1-beat silence (1185..1200)
  X07: {
    id: "X07",
    clip: "clips/clip-05-gadgets-and-rooms.mp4",
    trimBefore: Math.max(0, f(E.clip05Start + 5.0)),
    playbackRate: 1.08,
    camera: [
      { at: 0, scale: 1.04, focus: { x: 1120, y: 580 }, yaw: 10 },
      { at: 120, scale: 1.09, focus: { x: 1180, y: 600 }, yaw: 8 },
    ],
    rings: [{ at: 30, p: { x: 1775, y: 830 } }],
  } satisfies ShotSpec,
} as const;
