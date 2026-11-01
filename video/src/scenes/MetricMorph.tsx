// MetricMorph: Ranked Arena 4,000 $wif Pool pill collapses (ease-in) and blooms into deterministic
// conservation bars (3,600 $wif 90% Podium Purse, 200 $wif 5% Burned to 0x0000...dEaD, 200 $wif 5% Staking Vault,
// plus 3% Point Swap Burn and 1% OTC Cash Fee badges).
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SolaceGround } from "../components/TownMark";
import { C, PALETTE } from "../palette";
import { BE_VIETNAM, MONO } from "../theme";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const BARS = [
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

export function MetricMorph({ fast = false }: { fast?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = fast ? 1.35 : 1.0;
  const f = frame * k;

  // Pill holds briefly (0..22), collapses ease-in (22..34), and conservation chart opens (32..65)
  const pillCollapse = interpolate(f, [20, 34], [0, 1], {
    ...CLAMP,
    easing: Easing.in(Easing.cubic),
  });
  const chartOpen = spring({
    frame: Math.max(0, Math.round(f - 30)),
    fps,
    config: { damping: 20, stiffness: 155 },
  });

  return (
    <SolaceGround>
      {/* Initial Pill */}
      {pillCollapse < 1 ? (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            opacity: 1 - pillCollapse,
            transform: `scale(${1 - 0.35 * pillCollapse})`,
          }}
        >
          <div
            style={{
              padding: "24px 48px",
              borderRadius: 999,
              background: C.card,
              border: `2px solid ${PALETTE.accentGold}`,
              fontFamily: BE_VIETNAM,
              fontSize: 46,
              fontWeight: 700,
              color: C.ink,
              boxShadow: "0 24px 64px rgba(8, 22, 16, 0.75)",
            }}
          >
            Ranked Arena · <span style={{ color: PALETTE.accentGold }}>4,000 $wif Pool</span>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* Deterministic Conservation Chart */}
      {f >= 28 ? (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            padding: "0 140px",
            opacity: chartOpen,
            transform: `scale(${0.92 + 0.08 * chartOpen})`,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1520,
              background: C.card,
              border: `1px solid ${C.line}`,
              borderRadius: 26,
              padding: "44px 52px",
              boxShadow: "0 30px 80px rgba(8, 22, 16, 0.8)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 32,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 17,
                    fontWeight: 700,
                    color: PALETTE.accentMintPill,
                    letterSpacing: "0.12em",
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
                  fontSize: 32,
                  fontWeight: 700,
                  color: PALETTE.accentGold,
                }}
              >
                Σ = 4,000 $wif
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {BARS.map((b, idx) => {
                const grow = interpolate(f, [36 + idx * 8, 66 + idx * 8], [0, 1], {
                  ...CLAMP,
                  easing: Easing.out(Easing.cubic),
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
                      }}
                    >
                      <span style={{ fontSize: 25, fontWeight: 600, color: C.ink }}>
                        {b.label}
                      </span>
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: 26,
                          fontWeight: 700,
                          color: b.color,
                        }}
                      >
                        {b.amount} ({b.pct})
                      </span>
                    </div>
                    <div
                      style={{
                        height: 24,
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

            {/* Deflationary Sink Pills */}
            <div
              style={{
                marginTop: 32,
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              {[
                { tag: "ON-CHAIN 0x…dEaD PROOF", text: "4,600,000+ $wif Burned on Robinhood Chain", c: PALETTE.burnText },
                { tag: "OTC CASH MICRO-TAX", text: "1% Fee Routed to Staking Vault", c: PALETTE.accentGold },
                { tag: "CASUAL & GOVERNANCE", text: "3% Point Swap + 100 $wif Vote Burns", c: PALETTE.accentMintPill },
              ].map((pill) => (
                <div
                  key={pill.tag}
                  style={{
                    flex: 1,
                    padding: "14px 20px",
                    borderRadius: 14,
                    background: PALETTE.bgFelt,
                    border: `1px solid ${C.line}`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 14,
                      fontWeight: 700,
                      color: pill.c,
                      letterSpacing: "0.08em",
                    }}
                  >
                    {pill.tag}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontFamily: BE_VIETNAM,
                      fontSize: 20,
                      fontWeight: 600,
                      color: C.ink,
                    }}
                  >
                    {pill.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AbsoluteFill>
      ) : null}
    </SolaceGround>
  );
}
