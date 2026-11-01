// S10 (300f / 5 bars): ScatterBloom 926 deterministic test vectors + @snapcn/count-grid + 4 Engine Proof Stat Cards.
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CountGrid } from "@/components/snap-cn/count-grid";
import { SolaceGround } from "../components/TownMark";
import { C, DISTRICT_PALETTE, PALETTE } from "../palette";
import { BE_VIETNAM, MONO, ROBIN_THEME } from "../theme";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Deterministic golden-angle spiral for 240 visible representative nodes out of 926 verified tests
const NODES = Array.from({ length: 240 }, (_, i) => {
  const angle = i * 2.399963229728653;
  const radius = Math.sqrt(i / 240);
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.58,
    color: DISTRICT_PALETTE[i % 6]!,
    size: i < 72 ? 5.2 : 3.1,
    delay: (i % 40) * 0.7,
  };
});

const PROOF_STATS = [
  { value: "72", label: "Street Lots", sub: "6 Harbor districts, 12 lots each", accent: PALETTE.accentEmerald },
  { value: "120", label: "Conserved Tiles", sub: "Exact bag invariants across 6 shop types", accent: PALETTE.accentGold },
  { value: "3 to 6", label: "Player Scaling", sub: "Live WebSocket rooms & balanced schedules", accent: PALETTE.accentJade },
  { value: "926", label: "Passing Tests", sub: "26 Vitest suites & 69/69 pixel sprites", accent: PALETTE.accentMintPill },
] as const;

export function EngineProof() {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // First 115f: @snapcn/count-grid rushes in with Robin-Town captures (72 -> 926 verified checks)
  // Frame 95..300: ScatterBloom 3D point plane + 4 deterministic engine proof cards settle cleanly
  const gridOpacity = interpolate(frame, [95, 125], [1, 0.16], CLAMP);
  const cardsPhase = interpolate(frame, [92, 128], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const planeScale = interpolate(frame, [80, 300], [0.94, 1.08], CLAMP);

  const robinCards = [
    staticFile("clips/seat-01-3d.png"),
    staticFile("sprites/coffee.png"),
    staticFile("clips/seat-02-otc.png"),
    staticFile("sprites/pho.png"),
    staticFile("clips/seat-03-2d.png"),
    staticFile("sprites/banhmi.png"),
    staticFile("clips/seat-04-hub.png"),
    staticFile("sprites/game-banknote.png"),
  ];

  return (
    <SolaceGround>
      <AbsoluteFill style={{ opacity: gridOpacity }}>
        <CountGrid
          from="72"
          to="926"
          noun="verified checks"
          cards={robinCards}
          background={PALETTE.bgDeep}
          inkFrom={PALETTE.accentGold}
          inkTo={PALETTE.accentEmerald}
          speed={0.55}
          theme={ROBIN_THEME}
          mode="dark"
        />
      </AbsoluteFill>

      {/* ScatterBloom 3D tilted verification field */}
      <AbsoluteFill
        style={{
          opacity: cardsPhase,
          transform: `scale(${planeScale}) rotate(0.35deg)`,
          pointerEvents: "none",
        }}
      >
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          {NODES.map((n, idx) => {
            const p = interpolate(frame, [85 + n.delay, 122 + n.delay], [0, 1], {
              ...CLAMP,
              easing: Easing.out(Easing.cubic),
            });
            const px = width / 2 + n.x * 820 * p;
            const py = height / 2 + n.y * 460 * p;
            return (
              <circle
                key={idx}
                cx={px}
                cy={py}
                r={n.size}
                fill={n.color}
                opacity={0.42 * p}
              />
            );
          })}
        </svg>
      </AbsoluteFill>

      {/* Four Deterministic Proof Cards */}
      {frame >= 90 ? (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            padding: "0 96px",
            opacity: cardsPhase,
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 42 }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 18,
                fontWeight: 700,
                color: PALETTE.accentMintPill,
                letterSpacing: "0.14em",
                marginBottom: 10,
              }}
            >
              DETERMINISTIC ENGINE &amp; ASSET INVARIANTS
            </div>
            <div
              style={{
                fontFamily: BE_VIETNAM,
                fontSize: 54,
                fontWeight: 700,
                color: C.ink,
              }}
            >
              Every tile conserved. <span style={{ color: PALETTE.accentGold }}>926 tests green.</span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 24,
              width: "100%",
              maxWidth: 1680,
            }}
          >
            {PROOF_STATS.map((st, idx) => {
              const pop = spring({
                frame: Math.max(0, frame - (102 + idx * 7)),
                fps,
                config: { damping: 19, stiffness: 160 },
              });
              return (
                <div
                  key={st.label}
                  style={{
                    background: C.card,
                    border: `1px solid ${C.line}`,
                    borderRadius: 20,
                    padding: "30px 28px",
                    transform: `translateY(${(1 - pop) * 28}px) scale(${0.94 + 0.06 * pop})`,
                    opacity: pop,
                    boxShadow: "0 24px 60px rgba(8, 22, 16, 0.74)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: BE_VIETNAM,
                      fontSize: 64,
                      fontWeight: 800,
                      color: st.accent,
                      lineHeight: 1.05,
                    }}
                  >
                    {st.value}
                  </div>
                  <div
                    style={{
                      marginTop: 12,
                      fontFamily: BE_VIETNAM,
                      fontSize: 28,
                      fontWeight: 700,
                      color: C.ink,
                    }}
                  >
                    {st.label}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: BE_VIETNAM,
                      fontSize: 20,
                      fontWeight: 500,
                      color: C.muted,
                      lineHeight: 1.32,
                    }}
                  >
                    {st.sub}
                  </div>
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      ) : null}
    </SolaceGround>
  );
}
