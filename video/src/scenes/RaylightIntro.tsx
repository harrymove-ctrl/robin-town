// RobinTownIntro (1,011 frames = 33.70s @ 30fps):
// 100% real live Robin Town gameplay (<OffthreadVideo> + <Footage>), 100% palette.ts + <SolaceGround /> (#112a24),
// @snapcn/orb-swarm, @snapcn/block-wordmark, @snapcn/laptop-frame, @snapcn/phone-frame, @snapcn/button-press,
// @snapcn/phone-stack, @snapcn/dot-bloom, OrbitFlow, MetricMorph, and Fable EndLockup synced frame-for-frame to raylight-intro.wav.
import {
  AbsoluteFill,
  Audio,
  Easing,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BlockWordmark } from "@/components/snap-cn/block-wordmark";
import { ButtonPress } from "@/components/snap-cn/button-press";
import { CursorTrack } from "@/components/snap-cn/cursor-track";
import { DOT_BLOOM_CUT, DotBloom } from "@/components/snap-cn/dot-bloom";
import { LaptopFrame } from "@/components/snap-cn/laptop-frame";
import { OrbSwarm } from "@/components/snap-cn/orb-swarm";
import { PhoneFrame } from "@/components/snap-cn/phone-frame";
import { PhoneStack } from "@/components/snap-cn/phone-stack";
import { CALLOUT_MODE, Eyebrow } from "../components/Callout";
import { FontGate, SolaceGround, TownMark } from "../components/TownMark";
import { Footage } from "../Footage";
import { C, DISTRICT_PALETTE, PALETTE } from "../palette";
import type { ShotSpec } from "../shots";
import { BE_VIETNAM, BUNGEE, MONO, ROBIN_THEME } from "../theme";
import { OrbitFlow } from "./OrbitFlow";

export const INTRO_FRAMES = 1011; // Exact 33.70s @ 30fps matching raylight-intro.wav

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const outCubic = Easing.out(Easing.cubic);
const inCubic = Easing.in(Easing.cubic);

// I03 (f168..277 = 109f): Live 3D Harbor Diorama sweeping Street -> Sunset -> Night,
// flattening to 0 deg right on f218 (local 50) double-ding for Callout I1.
const INTRO_SHOT_I03: ShotSpec = {
  id: "I03",
  clip: "clips/clip-01-living-town.mp4",
  trimBefore: 162,
  playbackRate: 2.15,
  eyebrow: { n: 1, title: "3D Harbor Diorama" },
  camera: [
    { at: 0, scale: 1.03, focus: { x: 960, y: 540 }, yaw: 9 },
    { at: 42, scale: 1.05, focus: { x: 900, y: 520 }, yaw: 3 },
    { at: 50, scale: 1.05, focus: { x: 880, y: 520 }, yaw: 0 },
    { at: 96, scale: 1.05, focus: { x: 900, y: 515 }, yaw: 0 },
    { at: 109, scale: 1.07, focus: { x: 960, y: 540 }, yaw: -8 },
  ],
  rings: [],
  ticks: [],
  callouts: [
    {
      id: "I1",
      from: 50,
      to: 114,
      side: "right",
      what: "2D tabletop to 3D harbor",
      why: "72 plots across 6 districts, Day to Night.",
      accent: PALETTE.accentEmerald,
    },
  ],
};

// I07 (f700..848 = 148f): Live Year 6 Standings modal flattening to 0 deg and locking
// #1 You (+2,160 $wif Purse) with Callout I2 right on f812 (local 112) victory chime.
const INTRO_SHOT_I07: ShotSpec = {
  id: "I07",
  clip: "clips/clip-06-year6-standings.mp4",
  trimBefore: 108,
  eyebrow: { n: 4, title: "Year 6 Settlement" },
  camera: [
    { at: 0, scale: 1.03, focus: { x: 960, y: 540 }, yaw: -8 },
    { at: 96, scale: 1.03, focus: { x: 960, y: 530 }, yaw: 0, panX: -255 },
    { at: 112, scale: 1.03, focus: { x: 960, y: 530 }, yaw: 0, panX: -255 },
    { at: 148, scale: 1.03, focus: { x: 960, y: 530 }, yaw: 0, panX: -255 },
  ],
  rings: [{ at: 112, p: { x: 960, y: 368 } }],
  ticks: [{ at: 112, p: { x: 960, y: 368 } }],
  callouts: [
    {
      id: "I2",
      from: 112,
      to: 157,
      side: "right",
      what: "Ranked #1 podium settlement",
      why: "Win +2,160 $wif while 4.6M+ $wif burns live.",
      accent: PALETTE.accentGold,
    },
  ],
};

function DrawnCheckBadge({ at, x, y }: { at: number; x: number; y: number }) {
  const frame = useCurrentFrame();
  if (CALLOUT_MODE === "rings") return null;
  const local = frame - at;
  if (local < 0 || local > 44) return null;
  const draw = interpolate(local, [0, 9], [0, 1], { ...CLAMP, easing: outCubic });
  const fade = interpolate(local, [30, 44], [1, 0], CLAMP);
  const scale = interpolate(local, [0, 8], [0.74, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.back(1.6)),
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x - 24,
        top: y - 24,
        width: 48,
        height: 48,
        borderRadius: 999,
        background: PALETTE.accentEmerald,
        border: `2px solid ${PALETTE.parchmentLight}`,
        boxShadow: "0 10px 22px rgba(8, 22, 16, 0.68)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fade,
        transform: `scale(${scale})`,
        pointerEvents: "none",
      }}
    >
      <svg width={26} height={26} viewBox="0 0 26 26">
        <path
          d="M5 13.5 L10.5 19 L21 7.5"
          fill="none"
          stroke={PALETTE.parchmentLight}
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={30}
          strokeDashoffset={(1 - draw) * 30}
        />
      </svg>
    </div>
  );
}

/** I01 (f0..95): Fast 6-card @snapcn/orb-swarm hook on #112a24 SolaceGround, neutral "you" voice. */
function IntroOrbHook() {
  return (
    <SolaceGround>
      <OrbSwarm
        script="Pull up a stool. | Claim harbor corners. | Bargain $wif. | Build 3D. | Outsmart AI neighbors. | Put $wif to work."
        background={PALETTE.bgDeep}
        ink={PALETTE.parchmentLight}
        orbColor={PALETTE.accentEmerald}
        fontFamily={BE_VIETNAM}
        softness={0}
        speed={1.62}
        theme={ROBIN_THEME}
        mode="dark"
      />
    </SolaceGround>
  );
}

/** I02a (f95..140): @snapcn/block-wordmark + TownMark crest + Chain ID 46631 · 10,000 $wif Ready. */
function IntroBrandWordmark() {
  const frame = useCurrentFrame();
  const speed = 2.25;
  const f = frame * speed;
  const markIn = interpolate(f, [52, 70], [0, 1], { ...CLAMP, easing: outCubic });

  return (
    <SolaceGround>
      <BlockWordmark
        text="ROBIN TOWN"
        fontFamily={BUNGEE}
        fontSize={132}
        color={PALETTE.brandWordmarkGold}
        colors={[...DISTRICT_PALETTE.slice(0, 6)]}
        background="transparent"
        blockSizing="glyph"
        growDuration={8}
        spinDuration={26}
        splitDuration={5}
        ascenderDuration={8}
        holdDuration={10}
        flashStagger={1.8}
        flashDuration={3}
        flashToSwap={3}
        speed={speed}
        theme={ROBIN_THEME}
        mode="dark"
      />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          opacity: markIn,
          transform: `translateY(${(1 - markIn) * -14}px)`,
        }}
      >
        <div style={{ transform: "translateY(-138px)" }}>
          <TownMark size={82} />
        </div>
        <div
          style={{
            position: "absolute",
            top: "50%",
            marginTop: 88,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 22px",
            borderRadius: 999,
            background: "rgba(16, 42, 32, 0.94)",
            border: `1px solid ${PALETTE.borderEmerald}`,
            fontFamily: MONO,
            fontVariantNumeric: "tabular-nums",
            fontSize: 21,
            fontWeight: 700,
            color: PALETTE.accentMintPill,
            letterSpacing: "0.04em",
          }}
        >
          <span>● CHAIN ID 46631</span>
          <span style={{ color: PALETTE.accentGold }}>·</span>
          <span style={{ color: PALETTE.parchmentWarm }}>10,000 $WIF READY</span>
        </div>
      </AbsoluteFill>
    </SolaceGround>
  );
}

/** I02b (f140..168 = 28f): @snapcn/laptop-frame bezel dive landing on exact f168 camera shutter snap. */
function IntroLaptopDive() {
  return (
    <SolaceGround>
      <LaptopFrame
        entrance="open"
        finale="zoom-to-screen"
        showNotch={true}
        notchLabel="Chain ID 46631 · 10,000 $wif Ready"
        indicatorColor={PALETTE.accentEmerald}
        bezelColor={PALETTE.bgHudDark}
        screenColor={PALETTE.bgCityStage}
        shadow="0 16px 24px rgba(8, 22, 16, 0.72)"
        fontFamily={BE_VIETNAM}
        speed={185 / 28}
        theme={ROBIN_THEME}
        mode="dark"
      >
        <OffthreadVideo
          src={staticFile("clips/clip-01-living-town.mp4")}
          trimBefore={154}
          muted
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            maxWidth: "none",
            objectFit: "cover",
          }}
        />
      </LaptopFrame>
    </SolaceGround>
  );
}

/** I04 (f277..390 = 113f): Two-Way OTC Bargaining (desktop clip-02) + Live Mobile 3D Fast Play (@snapcn/phone-frame). */
function IntroOtcAndMobileStage() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const cardIn = interpolate(frame, [0, 18], [0, 1], { ...CLAMP, easing: outCubic });
  const yaw = interpolate(frame, [0, 45, 113], [6, 2.5, 4], CLAMP);

  // Left desktop card sits at x: 52..1276 (w=1224), y: 144..832 (h=688 = exact 16:9), leaving >= 64px gap to phone bezel!
  const clickX = Math.round(52 + 1325 * (1224 / 1920)); // 897
  const clickY = Math.round(144 + 877 * (688 / 1080)); // 703

  const waypoints = [
    { at: 24, x: 0.56, y: 0.78, duration: 5 },
    { at: 32, x: clickX / width, y: clickY / height, duration: 13, click: true },
  ];

  return (
    <SolaceGround>
      <CursorTrack path={waypoints} theme={ROBIN_THEME} mode="dark">
        <AbsoluteFill>
          {/* Top-left non-overlapping stage pill */}
          <div
            style={{
              position: "absolute",
              left: 52,
              top: 52,
              display: "flex",
              alignItems: "center",
              gap: 14,
              opacity: cardIn,
              transform: `translateY(${(1 - cardIn) * -12}px)`,
            }}
          >
            <div
              style={{
                padding: "10px 20px",
                borderRadius: 999,
                background: C.card,
                border: `1px solid ${PALETTE.borderEmerald}`,
                fontFamily: MONO,
                fontVariantNumeric: "tabular-nums",
                fontSize: 18,
                fontWeight: 700,
                color: PALETTE.accentMintPill,
                letterSpacing: "0.06em",
              }}
            >
              TWO-WAY OTC DEALS · CASH + DEEDS + SHOP TILES
            </div>
            <div
              style={{
                padding: "10px 20px",
                borderRadius: 999,
                background: C.card,
                border: `1px solid ${C.line}`,
                fontFamily: BE_VIETNAM,
                fontVariantNumeric: "tabular-nums",
                fontSize: 20,
                fontWeight: 600,
                color: PALETTE.accentGold,
              }}
            >
              1% cash fee feeds Staking Vault
            </div>
          </div>

          {/* Left 16:9 Live OTC Bargaining Gameplay Card */}
          <div
            style={{
              position: "absolute",
              left: 52,
              top: 144,
              width: 1224,
              height: 688,
              perspective: 1600,
              opacity: cardIn,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 20,
                overflow: "hidden",
                border: `1px solid ${C.line}`,
                boxShadow: "0 16px 24px rgba(8, 22, 16, 0.72)",
                background: PALETTE.bgCityStage,
                transform: `translateY(${(1 - cardIn) * 24}px) rotateY(${yaw}deg)`,
              }}
            >
              <OffthreadVideo
                src={staticFile("clips/clip-02-otc-bargain.mp4")}
                trimBefore={430}
                playbackRate={1.06}
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
          </div>

          {/* Right Live Mobile 3D Fast Play inside @snapcn/phone-frame (showDynamicIsland=false) */}
          <div
            style={{
              position: "absolute",
              left: 1344,
              top: 16,
              width: 528,
              height: 952,
            }}
          >
            <PhoneFrame
              variant="tilt"
              tiltAngle={-11}
              entrance="rotate-in"
              scale={1.34}
              bezelColor={PALETTE.bgHudDark}
              screenColor={PALETTE.bgCityStage}
              shadow="0 16px 24px rgba(8, 22, 16, 0.72)"
              showDynamicIsland={false}
              theme={ROBIN_THEME}
              mode="dark"
            >
              <OffthreadVideo
                src={staticFile("clips/clip-mobile-3d-fastplay.mp4")}
                trimBefore={80}
                playbackRate={1.85}
                muted
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  maxWidth: "none",
                  objectFit: "cover",
                }}
              />
            </PhoneFrame>
          </div>

          {/* Clean mobile caption badge below phone */}
          <div
            style={{
              position: "absolute",
              left: 1356,
              bottom: 34,
              width: 504,
              display: "flex",
              justifyContent: "center",
              opacity: cardIn,
            }}
          >
            <div
              style={{
                padding: "10px 22px",
                borderRadius: 999,
                background: C.card,
                border: `1px solid ${PALETTE.borderEmerald}`,
                fontFamily: MONO,
                fontVariantNumeric: "tabular-nums",
                fontSize: 18,
                fontWeight: 700,
                color: PALETTE.accentMintPill,
                letterSpacing: "0.05em",
              }}
            >
              ● 390×844 MOBILE 3D · 3X FAST PLAY
            </div>
          </div>

          <DrawnCheckBadge at={45} x={clickX} y={clickY} />
          <Eyebrow n={2} title="OTC Bargaining & Mobile 3D" />
        </AbsoluteFill>
      </CursorTrack>
    </SolaceGround>
  );
}

const KICK_CARDS = [
  { at: 0, tag: "YEAR 1 · SNAKE", stat: "+240 $wif", sub: "Connected corner harvest", accent: PALETTE.accentEmerald },
  { at: 23, tag: "YEAR 3 · GOAT", stat: "4-Lot Chain", sub: "District multiplier active", accent: PALETTE.accentGold },
  { at: 36, tag: "YEAR 5 · ROOSTER", stat: "1.20x Yield", sub: "500 $wif staked on 46631", accent: PALETTE.accentJade },
  { at: 59, tag: "YEAR 6 · DOG", stat: "926 Tests", sub: "120 tiles conserved", accent: PALETTE.accentMintPill },
] as const;

/** I05b (f483..559 = 76f): Live Payday Harvest locked to exact bass kicks f483, f506, f519, f542 -> f557 whip. */
function IntroBassKickPayday() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Subtle camera punch on each of the 4 bass kicks (sub-local 0, 23, 36, 59) + kinetic whip out at 73..76
  const kickImpulse = KICK_CARDS.reduce((acc, k) => {
    const dt = frame - k.at;
    if (dt < 0 || dt > 10) return acc;
    return acc + Math.sin((dt / 10) * Math.PI) * 0.018;
  }, 0);
  const whip = interpolate(frame, [72, 76], [0, 1], { ...CLAMP, easing: inCubic });

  return (
    <SolaceGround>
      <AbsoluteFill
        style={{
          transform: `scale(${1 + kickImpulse + whip * 0.14}) translateX(${-whip * 90}px)`,
        }}
      >
        {/* Top Live Payday Gameplay Stage (x: 84..1836, y: 48..864) */}
        <div
          style={{
            position: "absolute",
            left: 84,
            top: 48,
            width: 1752,
            height: 816,
            borderRadius: 22,
            overflow: "hidden",
            border: `1px solid ${C.line}`,
            background: PALETTE.bgCityStage,
            boxShadow: "0 16px 24px rgba(8, 22, 16, 0.72)",
          }}
        >
          <OffthreadVideo
            src={staticFile("clips/clip-03-payday-harvest.mp4")}
            trimBefore={122}
            playbackRate={1.15}
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>

        {/* Bottom 4-Card Beat-Synced Zodiac Progression Dock (y: 884..1032, >= 48px safe margin) */}
        <div
          style={{
            position: "absolute",
            left: 84,
            top: 884,
            width: 1752,
            height: 148,
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 18,
          }}
        >
          {KICK_CARDS.map((card) => {
            const active = frame >= card.at;
            const pop = spring({
              frame: Math.max(0, frame - card.at),
              fps,
              config: { damping: 17, stiffness: 220 },
            });
            return (
              <div
                key={card.tag}
                style={{
                  background: active ? C.card : "rgba(16, 42, 32, 0.48)",
                  border: `1px solid ${active ? card.accent : C.line}`,
                  borderRadius: 18,
                  padding: "16px 22px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  opacity: active ? 1 : 0.38,
                  transform: `translateY(${active ? (1 - pop) * 16 : 8}px) scale(${active ? 0.94 + 0.06 * pop : 0.96})`,
                  boxShadow: active ? "0 12px 24px rgba(8, 22, 16, 0.72)" : "none",
                }}
              >
                <div
                  style={{
                    fontFamily: MONO,
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 15,
                    fontWeight: 700,
                    color: card.accent,
                    letterSpacing: "0.06em",
                  }}
                >
                  ● {card.tag}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: BE_VIETNAM,
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 30,
                    fontWeight: 700,
                    color: C.ink,
                    lineHeight: 1.1,
                  }}
                >
                  {card.stat}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontFamily: BE_VIETNAM,
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 17,
                    fontWeight: 500,
                    color: C.muted,
                  }}
                >
                  {card.sub}
                </div>
              </div>
            );
          })}
        </div>

        <DrawnCheckBadge at={2} x={1620} y={820} />
      </AbsoluteFill>
    </SolaceGround>
  );
}

const CONSERVATION_BARS = [
  {
    pct: "90%",
    amount: "3,600 $wif",
    label: "Podium Purse (1st 60% · 2nd 25% · 3rd 15%)",
    fill: 0.9,
    color: PALETTE.accentEmerald,
  },
  {
    pct: "5%",
    amount: "200 $wif",
    label: "Permanently Burned to 0x0000...dEaD",
    fill: 0.34,
    color: PALETTE.accentCoral,
  },
  {
    pct: "5%",
    amount: "200 $wif",
    label: "Staking Vault (Funds 1.20x Shopkeeper Boost)",
    fill: 0.34,
    color: PALETTE.accentGold,
  },
] as const;

/** I06a (f559..612 = 53f): Fast MetricMorph conservation split for Ranked Arena 4,000 $wif Pool. */
function IntroMetricMorph() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pillCollapse = interpolate(frame, [6, 14], [0, 1], { ...CLAMP, easing: inCubic });
  const chartOpen = spring({
    frame: Math.max(0, frame - 11),
    fps,
    config: { damping: 19, stiffness: 185 },
  });

  return (
    <SolaceGround>
      {pillCollapse < 1 ? (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            opacity: 1 - pillCollapse,
            transform: `scale(${1 - 0.32 * pillCollapse})`,
          }}
        >
          <div
            style={{
              padding: "24px 48px",
              borderRadius: 999,
              background: C.card,
              border: `1.5px solid ${PALETTE.accentGold}`,
              fontFamily: BE_VIETNAM,
              fontVariantNumeric: "tabular-nums",
              fontSize: 46,
              fontWeight: 700,
              color: C.ink,
              boxShadow: "0 16px 24px rgba(8, 22, 16, 0.72)",
            }}
          >
            Ranked Arena · <span style={{ color: PALETTE.accentGold }}>4,000 $wif Pool</span>
          </div>
        </AbsoluteFill>
      ) : null}

      {frame >= 10 ? (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            padding: "0 140px",
            opacity: chartOpen,
            transform: `scale(${0.93 + 0.07 * chartOpen})`,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1520,
              background: C.card,
              border: `1px solid ${C.line}`,
              borderRadius: 26,
              padding: "42px 52px",
              boxShadow: "0 16px 24px rgba(8, 22, 16, 0.76)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 28,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 17,
                    fontWeight: 700,
                    color: PALETTE.accentMintPill,
                    letterSpacing: "0.08em",
                  }}
                >
                  RANKED ARENA CONSERVATION · VERIFIED $WIF 0xE49A1C…0F9B
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: BE_VIETNAM,
                    fontSize: 44,
                    fontWeight: 700,
                    color: C.ink,
                  }}
                >
                  Zero inflation. Every single $wif accounted for.
                </div>
              </div>
              <div
                style={{
                  fontFamily: MONO,
                  fontVariantNumeric: "tabular-nums",
                  fontSize: 32,
                  fontWeight: 700,
                  color: PALETTE.accentGold,
                }}
              >
                Σ = 4,000 $wif
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {CONSERVATION_BARS.map((b, idx) => {
                const grow = interpolate(frame, [13 + idx * 4, 28 + idx * 4], [0, 1], {
                  ...CLAMP,
                  easing: outCubic,
                });
                return (
                  <div key={b.label}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: 8,
                        fontFamily: BE_VIETNAM,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <span style={{ fontSize: 25, fontWeight: 600, color: C.ink }}>
                        {b.label}
                      </span>
                      <span
                        style={{
                          fontFamily: MONO,
                          fontVariantNumeric: "tabular-nums",
                          fontSize: 26,
                          fontWeight: 700,
                          color: b.color,
                        }}
                      >
                        {b.pct} · {b.amount}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 22,
                        borderRadius: 999,
                        background: PALETTE.bgCityStage,
                        border: `1px solid ${C.line}`,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${b.fill * grow * 100}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: b.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </AbsoluteFill>
      ) : null}
    </SolaceGround>
  );
}

/**
 * I06b (f612..700 = 88f): Live $wif Flywheel on Desktop (clip-04) + Live Mobile $wif Hub (@snapcn/phone-frame)
 * + Tactile @snapcn/button-press clicking frame-accurately on global f677 (local 65: (65 - 50) * 2.40 = 36 = CLICK_AT).
 */
function IntroWifFlywheelAndTap() {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 16], [0, 1], { ...CLAMP, easing: outCubic });
  const staked = frame >= 79; // Locks right as ButtonPress finishes Chain 46631 spinner -> 1.20x Active!

  return (
    <SolaceGround>
      {/* Left Column (x: 52..616, y: 72..904): Live Desktop $wif Hub Modal (clip-04-wif-flywheel.mp4), clear of Eyebrow */}
      <div
        style={{
          position: "absolute",
          left: 52,
          top: 72,
          width: 564,
          height: 832,
          borderRadius: 24,
          overflow: "hidden",
          border: `1px solid ${C.line}`,
          background: PALETTE.bgCityStage,
          boxShadow: "0 16px 24px rgba(8, 22, 16, 0.72)",
          opacity: enter,
          transform: `translateY(${(1 - enter) * 24}px)`,
        }}
      >
        <OffthreadVideo
          src={staticFile("clips/clip-04-wif-flywheel.mp4")}
          trimBefore={251}
          muted
          style={{
            width: "210%",
            height: "100%",
            maxWidth: "none",
            marginLeft: "-55%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>

      {/* Center Column Top Header Card (x: 680..1240, y: 128..396) cleanly above ButtonPress (y: 483..597) */}
      <div
        style={{
          position: "absolute",
          left: 680,
          top: 128,
          width: 560,
          padding: "26px 30px",
          borderRadius: 22,
          background: C.card,
          border: `1px solid ${staked ? PALETTE.accentGold : PALETTE.borderEmerald}`,
          boxShadow: "0 14px 24px rgba(8, 22, 16, 0.72)",
          opacity: enter,
          transform: `translateY(${(1 - enter) * -18}px)`,
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontVariantNumeric: "tabular-nums",
            fontSize: 16,
            fontWeight: 700,
            color: PALETTE.accentMintPill,
            letterSpacing: "0.08em",
          }}
        >
          ● CHAIN ID 46631 · STAKING VAULT
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: BE_VIETNAM,
            fontVariantNumeric: "tabular-nums",
            fontSize: 34,
            fontWeight: 700,
            color: C.ink,
            lineHeight: 1.18,
          }}
        >
          Lock 500 <span style={{ color: PALETTE.accentGold }}>$wif</span> for{" "}
          <span style={{ color: PALETTE.accentMintPill }}>1.20x</span> paydays.
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: BE_VIETNAM,
            fontVariantNumeric: "tabular-nums",
            fontSize: 21,
            fontWeight: 500,
            color: C.muted,
            lineHeight: 1.32,
          }}
        >
          4,600,001 $wif burned on 0x…dEaD · Play free or connect live.
        </div>
      </div>

      {/* Center Bottom Status Pill (x: 680..1240, y: 668) cleanly below ButtonPress */}
      <div
        style={{
          position: "absolute",
          left: 680,
          top: 668,
          width: 560,
          display: "flex",
          justifyContent: "center",
          opacity: enter,
        }}
      >
        <div
          style={{
            padding: "12px 26px",
            borderRadius: 999,
            background: staked ? PALETTE.bgFelt : C.card,
            border: `1px solid ${staked ? PALETTE.accentEmerald : C.line}`,
            fontFamily: MONO,
            fontVariantNumeric: "tabular-nums",
            fontSize: 19,
            fontWeight: 700,
            color: staked ? PALETTE.accentMintPill : PALETTE.accentGold,
          }}
        >
          {staked ? "✓ 1.20x SHOPKEEPER BOOST VERIFIED" : "0xE49A1C…0F9B · READY TO STAKE"}
        </div>
      </div>

      {/* Right Column (x: 1320..1868): Live Mobile $wif Hub inside @snapcn/phone-frame (showDynamicIsland=false) */}
      <div
        style={{
          position: "absolute",
          left: 1320,
          top: 24,
          width: 548,
          height: 1032,
        }}
      >
        <PhoneFrame
          variant="tilt"
          tiltAngle={-11}
          entrance="rotate-in"
          scale={1.32}
          bezelColor={PALETTE.bgHudDark}
          screenColor={PALETTE.bgCityStage}
          shadow="0 16px 24px rgba(8, 22, 16, 0.72)"
          showDynamicIsland={false}
          theme={ROBIN_THEME}
          mode="dark"
        >
          {/* trimBefore=79 -> clip frame 144 (Stake 500 $wif -> Active 1.20x) hits on local 65 = global f677! */}
          <OffthreadVideo
            src={staticFile("clips/clip-mobile-wif-hub.mp4")}
            trimBefore={79}
            muted
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              maxWidth: "none",
              objectFit: "cover",
            }}
          />
        </PhoneFrame>
      </div>

      {/* Pre-click resting button preview (local 0..53 = f612..665) */}
      {frame < 53 ? (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            opacity: enter,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 320 * 1.5,
              height: 76 * 1.5,
              borderRadius: 19 * 1.5,
              background: PALETTE.accentEmerald,
              boxShadow: "0 14px 24px rgba(8, 22, 16, 0.72)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: BE_VIETNAM,
              fontVariantNumeric: "tabular-nums",
              fontSize: 28 * 1.5,
              fontWeight: 600,
              color: PALETTE.bgCityStage,
            }}
          >
            Stake 500 $wif
          </div>
        </AbsoluteFill>
      ) : null}

      {/* Native @snapcn/button-press (local 53..88 = global f665..700):
          (677 - 665) * 3.0 = 12 * 3.0 = 36.0 === CLICK_AT -> exact screen-tap on f677, settled by f693! */}
      <Sequence from={53} durationInFrames={35}>
        <ButtonPress
          label="Stake 500 $wif"
          pending="Chain 46631"
          done="1.20x Active"
          width={320}
          speed={3.0}
          theme={{ ...ROBIN_THEME, background: "transparent" }}
          mode="dark"
        />
      </Sequence>

      <Eyebrow n={3} title="$wif Economic Flywheel" />
    </SolaceGround>
  );
}

/**
 * I08 (f848..1011 = 163f):
 * - Local 0..45 (f848..893): @snapcn/phone-stack fly-by with real 780x1688 Retina mobile captures
 * - Local 29..59 (f877..907): @snapcn/dot-bloom halftone wipe whose DOT_BLOOM_CUT (16) lands on exact f893 chime!
 * - Local 45..163 (f893..1011 = 3.93s): Fable EndLockup settling in 8f and holding 100% motionless for 3.67s (>= 3.5s)!
 */
function IntroOutroAndEndLockup() {
  const frame = useCurrentFrame();
  // Lockup unveils at local 45 (f893 chime) and settles completely by local 53 (f901),
  // leaving 110 frames (3.67s >= 3.5s) 100% motionless through f1011!
  const settle = interpolate(frame, [41, 53], [0, 1], { ...CLAMP, easing: outCubic });
  const stackBadge = interpolate(frame, [0, 14], [0, 1], { ...CLAMP, easing: outCubic });

  return (
    <SolaceGround>
      {frame < 45 ? (
        <AbsoluteFill>
          <PhoneStack
            videos={[
              staticFile("clips/mobile-street-2x.png"),
              staticFile("clips/clip-mobile-wif-hub.mp4"),
              staticFile("clips/mobile-sunset-2x.png"),
              staticFile("clips/clip-mobile-3d-fastplay.mp4"),
            ]}
            stagger={9}
            speed={1.35}
            background={PALETTE.bgDeep}
            glowColor={PALETTE.accentEmerald}
            statusColor={PALETTE.parchmentLight}
            time="46631"
          />
          <div
            style={{
              position: "absolute",
              left: 64,
              top: 64,
              maxWidth: 480,
              opacity: stackBadge,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 17,
                fontWeight: 700,
                color: PALETTE.accentMintPill,
                letterSpacing: "0.12em",
              }}
            >
              LIVE DESKTOP + MOBILE + WEBSOCKET
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: BE_VIETNAM,
                fontSize: 42,
                fontWeight: 700,
                color: C.ink,
                lineHeight: 1.15,
              }}
            >
              Four seats.
              <br />
              <span style={{ color: PALETTE.accentGold }}>Instant room codes.</span>
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      {frame >= 45 - (DOT_BLOOM_CUT - 12) ? (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            opacity: settle,
            transform: `translateY(${(1 - settle) * 14}px)`,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <TownMark size={96} />
              <div
                style={{
                  fontFamily: BUNGEE,
                  fontSize: 108,
                  lineHeight: 1,
                  color: PALETTE.brandWordmarkGold,
                  letterSpacing: "0.03em",
                }}
              >
                ROBIN <span style={{ color: PALETTE.accentEmerald }}>TOWN</span>
              </div>
            </div>

            <div
              style={{
                fontFamily: BE_VIETNAM,
                fontSize: 34,
                fontWeight: 600,
                color: C.ink,
              }}
            >
              Bargain for corners, build in 3D, and put{" "}
              <span style={{ color: PALETTE.accentGold }}>$wif</span> to work.
            </div>

            <div
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                gap: 18,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  padding: "14px 28px",
                  borderRadius: 999,
                  background: C.card,
                  border: `1px solid ${C.line}`,
                  fontFamily: MONO,
                  fontSize: 24,
                  fontWeight: 600,
                  color: PALETTE.parchmentLight,
                }}
              >
                robin-town-production.up.railway.app
              </div>
              <div
                style={{
                  padding: "14px 28px",
                  borderRadius: 999,
                  background: PALETTE.bgFelt,
                  border: `1px solid ${PALETTE.accentEmerald}`,
                  fontFamily: MONO,
                  fontSize: 24,
                  fontWeight: 700,
                  color: PALETTE.accentMintPill,
                }}
              >
                10,000 $wif Ready · Chain ID 46631
              </div>
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* DotBloom starts at local 29 (f877) so DOT_BLOOM_CUT (16) lands on local 45 = exact f893 chime! */}
      <Sequence from={45 - DOT_BLOOM_CUT} durationInFrames={36}>
        <DotBloom
          groundColor={PALETTE.bgDeep}
          dotColors={[
            PALETTE.accentGold,
            PALETTE.accentEmerald,
            PALETTE.accentJade,
            PALETTE.brandWordmarkGold,
            PALETTE.accentMintPill,
          ]}
        />
      </Sequence>
    </SolaceGround>
  );
}

export function RobinTownIntro() {
  return (
    <FontGate>
      <AbsoluteFill style={{ backgroundColor: PALETTE.bgDeep }}>
        {CALLOUT_MODE !== "rings" ? (
          <Audio src={staticFile("audio/raylight-intro.wav")} volume={1} />
        ) : null}

        {/* f0..95 (3.17s): @snapcn/orb-swarm fast hook */}
        <Sequence from={0} durationInFrames={95}>
          <IntroOrbHook />
        </Sequence>

        {/* f95..140 (1.50s): @snapcn/block-wordmark + TownMark + Chain 46631 */}
        <Sequence from={95} durationInFrames={45}>
          <IntroBrandWordmark />
        </Sequence>

        {/* f140..168 (0.93s): @snapcn/laptop-frame bezel dive -> f168 shutter snap */}
        <Sequence from={140} durationInFrames={28}>
          <IntroLaptopDive />
        </Sequence>

        {/* f168..277 (3.63s): Live 3D Harbor Diorama + f218 double-ding Callout I1 */}
        <Sequence from={168} durationInFrames={109}>
          <Footage shot={INTRO_SHOT_I03} />
        </Sequence>

        {/* f277..390 (3.77s): Live Two-Way OTC Bargaining + Live Mobile 3D Fast Play */}
        <Sequence from={277} durationInFrames={113}>
          <IntroOtcAndMobileStage />
        </Sequence>

        {/* f390..483 (3.10s): OrbitFlow 6-Year Zodiac Compounding Loop */}
        <Sequence from={390} durationInFrames={93}>
          <OrbitFlow frames={93} />
        </Sequence>

        {/* f483..559 (2.53s): Live Payday Harvest synced to Bass Kicks f483, 506, 519, 542 -> f557 whip */}
        <Sequence from={483} durationInFrames={76}>
          <IntroBassKickPayday />
        </Sequence>

        {/* f559..612 (1.77s): MetricMorph 4,000 $wif Ranked Arena conservation split */}
        <Sequence from={559} durationInFrames={53}>
          <IntroMetricMorph />
        </Sequence>

        {/* f612..700 (2.93s): Live Desktop & Mobile $wif Hub + @snapcn/button-press click on f677 */}
        <Sequence from={612} durationInFrames={88}>
          <IntroWifFlywheelAndTap />
        </Sequence>

        {/* f700..848 (4.93s): Live Year 6 Standings + Victory Chime Callout I2 on f812 */}
        <Sequence from={700} durationInFrames={148}>
          <Footage shot={INTRO_SHOT_I07} />
        </Sequence>

        {/* f848..1011 (5.43s): @snapcn/phone-stack fly-by -> @snapcn/dot-bloom at f893 -> motionless EndLockup */}
        <Sequence from={848} durationInFrames={163}>
          <IntroOutroAndEndLockup />
        </Sequence>
      </AbsoluteFill>
    </FontGate>
  );
}
