// S08 (180f / 3 bars): Custom Frame-Pure OrbitFlow Scene for Chapter 3 ("Six zodiac years. Compounding street yield.")
// Adapted deterministically from /Volumes/Dev/video-effects-kit/custom-scenes/scenes/OrbitFlow.tsx.
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SolaceGround } from "../components/TownMark";
import { C, DISTRICT_PALETTE, PALETTE } from "../palette";
import { BE_VIETNAM, MONO } from "../theme";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const ORBITS = [
  { r: 280, speed: 0.42, dash: "7 11", accent: PALETTE.accentEmerald },
  { r: 395, speed: -0.28, dash: "5 13", accent: PALETTE.borderBrass },
  { r: 515, speed: 0.19, dash: "3 15", accent: PALETTE.accentGold },
] as const;

const STOPS = [
  {
    code: "01 · CLAIM DEEDS",
    sub: "5 → 3 glowing plots",
    orbit: 0,
    angle: -42,
    at: 16,
    dot: DISTRICT_PALETTE[0],
  },
  {
    code: "02 · OTC BARGAIN",
    sub: "$wif + tiles + deeds",
    orbit: 1,
    angle: 145,
    at: 30,
    dot: DISTRICT_PALETTE[1],
  },
  {
    code: "03 · BUILD & PAYDAY",
    sub: "1.20x staked yield",
    orbit: 2,
    angle: 28,
    at: 44,
    dot: DISTRICT_PALETTE[3],
  },
] as const;

export function OrbitFlow({ frames = 180 }: { frames?: number }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cx = width / 2;
  const cy = height / 2 + 12;

  const whipStart = frames - 18;
  const whip = interpolate(frame, [whipStart, frames], [0, 1], {
    ...CLAMP,
    easing: Easing.in(Easing.cubic),
  });
  const worldScale = 1 + whip * 3.1;
  const titleIn = spring({ frame, fps, config: { damping: 22, stiffness: 150 } });

  return (
    <SolaceGround>
      <AbsoluteFill
        style={{
          transform: `scale(${worldScale}) rotate(${whip * 14}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          {ORBITS.map((o, idx) => {
            const draw = interpolate(frame, [idx * 6, idx * 6 + 26], [0, 1], {
              ...CLAMP,
              easing: Easing.out(Easing.cubic),
            });
            const rot = (frame / fps) * o.speed * 42;
            return (
              <g key={o.r} transform={`rotate(${rot} ${cx} ${cy})`} opacity={draw * 0.68}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={o.r}
                  fill="none"
                  stroke={o.accent}
                  strokeWidth={idx === 0 ? 2 : 1.5}
                  strokeDasharray={o.dash}
                />
              </g>
            );
          })}
        </svg>

        {STOPS.map((stop) => {
          const orb = ORBITS[stop.orbit]!;
          const deg = stop.angle + (frame / fps) * orb.speed * 42;
          const rad = (deg * Math.PI) / 180;
          const px = cx + Math.cos(rad) * orb.r;
          const py = cy + Math.sin(rad) * orb.r * 0.76;
          const pop = spring({
            frame: Math.max(0, frame - stop.at),
            fps,
            config: { damping: 18, stiffness: 170 },
          });
          const op = frame < stop.at ? 0 : Math.min(1, (frame - stop.at) / 8) * (1 - whip * 0.85);
          return (
            <div
              key={stop.code}
              style={{
                position: "absolute",
                left: px,
                top: py,
                transform: `translate(-50%, -50%) scale(${0.7 + 0.3 * pop})`,
                opacity: op,
                background: C.card,
                border: `1px solid ${C.line}`,
                borderRadius: 999,
                padding: "12px 24px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: "0 18px 44px rgba(8, 22, 16, 0.65)",
              }}
            >
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 6,
                  background: stop.dot,
                  boxShadow: `0 0 12px ${stop.dot}`,
                }}
              />
              <div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.ink,
                    letterSpacing: "0.04em",
                  }}
                >
                  {stop.code}
                </div>
                <div
                  style={{
                    fontFamily: BE_VIETNAM,
                    fontSize: 16,
                    fontWeight: 500,
                    color: C.muted,
                  }}
                >
                  {stop.sub}
                </div>
              </div>
            </div>
          );
        })}

        {/* Center Headline */}
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            opacity: (1 - whip) * titleIn,
            transform: `scale(${0.92 + 0.08 * titleIn})`,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              textAlign: "center",
              padding: "28px 46px",
              borderRadius: 24,
              background: "rgba(16, 42, 32, 0.92)",
              border: `1px solid ${C.line}`,
              boxShadow: "0 24px 70px rgba(8, 22, 16, 0.78)",
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 17,
                fontWeight: 700,
                color: PALETTE.accentMintPill,
                letterSpacing: "0.14em",
                marginBottom: 10,
              }}
            >
              SNAKE → HORSE → GOAT → MONKEY → ROOSTER → DOG
            </div>
            <div
              style={{
                fontFamily: BE_VIETNAM,
                fontSize: 56,
                fontWeight: 700,
                color: C.ink,
                lineHeight: 1.14,
              }}
            >
              Six zodiac years.
              <br />
              <span style={{ color: PALETTE.accentGold }}>Compounding street yield.</span>
            </div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </SolaceGround>
  );
}
