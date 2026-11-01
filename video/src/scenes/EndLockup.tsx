// S18 (300f / 5 bars) & X08 (120f / 2 bars): @snapcn/dot-bloom halftone transition resolving into
// final Lockup holding TownMark + ROBIN TOWN, Chain ID 46631, repo URL, and CLI command completely still >= 3.0s.
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { DOT_BLOOM_CUT, DotBloom } from "@/components/snap-cn/dot-bloom";
import { SolaceGround, TownMark } from "../components/TownMark";
import { C, PALETTE } from "../palette";
import { BE_VIETNAM, BUNGEE, MONO } from "../theme";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export function EndLockup() {
  const frame = useCurrentFrame();
  // Settle completely by frame 28 so the lockup holds 100% motionless through clip end (>= 3.0s in X, > 8.5s in Master)!
  const settle = interpolate(frame, [DOT_BLOOM_CUT - 4, 28], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });

  return (
    <SolaceGround>
      {frame >= DOT_BLOOM_CUT - 4 ? (
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
              Build with <span style={{ color: PALETTE.accentGold }}>$wif</span> on Robinhood Chain ·{" "}
              <span style={{ color: PALETTE.accentMintPill }}>Chain ID 46631</span>
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
                github.com/harrymove-ctrl/robin-town
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
                $ npm install &amp;&amp; npm run dev
              </div>
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* Re-tinted @snapcn/dot-bloom halftone wipe over #112a24 + #eec353 / #2ca56d */}
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
    </SolaceGround>
  );
}
