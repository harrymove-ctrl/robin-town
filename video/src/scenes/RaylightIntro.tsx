import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FontGate, TownMark } from "../components/TownMark";
import { BE_VIETNAM, BUNGEE, MONO, PALETTE } from "../theme";

export const INTRO_FRAMES = 1011; // Exact 33.70s @ 30fps matching raylight-intro.wav

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.out(Easing.cubic);
const easeInOut = Easing.inOut(Easing.cubic);

function prog(frame: number, start: number, dur: number, easing = easeOut): number {
  return interpolate(frame, [start, start + Math.max(1, dur)], [0, 1], {
    ...CLAMP,
    easing,
  });
}

/** Moody Raylight dark spotlight studio backdrop tuned to Robin Town emerald & bullion gold. */
function StudioSpotlight({
  intensity = 1,
  cx = 52,
  cy = 48,
  goldMix = 0,
}: {
  intensity?: number;
  cx?: number;
  cy?: number;
  goldMix?: number;
}) {
  const eAlpha = (0.28 * intensity).toFixed(3);
  const bAlpha = (0.22 * intensity).toFixed(3);
  const gAlpha = (0.22 * goldMix * intensity).toFixed(3);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#040709",
        backgroundImage: [
          `radial-gradient(64% 58% at ${cx}% ${cy}%, rgba(44, 165, 109, ${eAlpha}) 0%, rgba(16, 48, 68, ${bAlpha}) 42%, rgba(4, 7, 9, 0.98) 78%)`,
          `radial-gradient(38% 36% at ${cx + 8}% ${cy - 6}%, rgba(238, 195, 83, ${gAlpha}) 0%, transparent 70%)`,
        ].join(", "),
      }}
    >
      {/* Subtle studio vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 220px 60px rgba(0, 0, 0, 0.82)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
}

/** True 3D extruded Titanium iPhone rig with multi-slice depth rails, Dynamic Island & specular sheen. */
function IPhone3D({
  rotateX,
  rotateY,
  rotateZ = 0,
  scale = 1,
  tx = 0,
  ty = 0,
  glarePos = 0.35,
  children,
}: {
  rotateX: number;
  rotateY: number;
  rotateZ?: number;
  scale?: number;
  tx?: number;
  ty?: number;
  glarePos?: number;
  children: ReactNode;
}) {
  const W = 430;
  const H = 910;
  const R = 64;
  const slices = [-18, -14, -10, -6, -3];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: 1500,
      }}
    >
      <div
        style={{
          width: W,
          height: H,
          position: "relative",
          transformStyle: "preserve-3d",
          transform: `translate3d(${tx}px, ${ty}px, 0px) scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`,
        }}
      >
        {/* Extruded metallic titanium depth slices */}
        {slices.map((z, idx) => (
          <div
            key={z}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: R,
              transform: `translateZ(${z}px)`,
              background:
                idx === 0
                  ? "linear-gradient(145deg, #0b1412 0%, #1c312b 50%, #0a1110 100%)"
                  : "linear-gradient(135deg, #27423a 0%, #13211d 48%, #3c5c51 100%)",
              border: "1.5px solid rgba(139, 245, 181, 0.22)",
              boxShadow:
                idx === 0 ? "0 60px 140px rgba(0, 0, 0, 0.88)" : undefined,
            }}
          />
        ))}

        {/* Front titanium bezel */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: R,
            padding: 13,
            background:
              "linear-gradient(160deg, #3c594f 0%, #15231f 36%, #0c1412 72%, #2f4b41 100%)",
            boxShadow:
              "inset 0 0 0 2px rgba(241, 209, 145, 0.28), 0 30px 90px rgba(0, 0, 0, 0.78)",
            transform: "translateZ(0px)",
          }}
        >
          {/* Inner OLED screen */}
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: R - 11,
              overflow: "hidden",
              position: "relative",
              backgroundColor: "#0a1914",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Dedicated top iOS status bar + Dynamic Island safe area (zero content overlap) */}
            <div
              style={{
                height: 40,
                padding: "8px 26px 0",
                background: "#081712",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
                zIndex: 30,
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  fontFamily: BE_VIETNAM,
                  fontWeight: 700,
                  fontSize: 13,
                  color: PALETTE.parchmentLight,
                  letterSpacing: 0.3,
                }}
              >
                22:03
              </span>
              <div
                style={{
                  width: 112,
                  height: 25,
                  borderRadius: 999,
                  background: "#020504",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    width: 16,
                    height: 9,
                    borderRadius: 2.5,
                    border: "1.4px solid rgba(251,246,232,0.88)",
                    display: "inline-block",
                    padding: 1.2,
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      width: "82%",
                      height: "100%",
                      background: PALETTE.accentMintPill,
                      borderRadius: 1,
                    }}
                  />
                </span>
              </div>
            </div>

            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
              {children}
            </div>

            {/* Specular diagonal glass reflection */}
            <div
              style={{
                position: "absolute",
                inset: -120,
                background: `linear-gradient(115deg, transparent ${(glarePos * 100 - 18).toFixed(1)}%, rgba(255, 255, 255, 0.11) ${(glarePos * 100).toFixed(1)}%, transparent ${(glarePos * 100 + 18).toFixed(1)}%)`,
                pointerEvents: "none",
                zIndex: 35,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Stool player badge icon matching Robin Town HUD. */
function StoolBadge({ color, size = 34 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect
        x="2"
        y="2"
        width="32"
        height="32"
        rx="9"
        fill="rgba(8, 20, 16, 0.9)"
        stroke={color}
        strokeWidth="2"
      />
      <ellipse cx="18" cy="12" rx="9" ry="3.6" fill={color} />
      <path
        d="M11 13 L9 27 M25 13 L27 27 M15 15 L14 27 M21 15 L22 27 M10.5 21 H25.5"
        stroke={color}
        strokeWidth="2.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** SCENE 1 (f0..150 | 0.0s..5.0s): 3D Angled iPhone Reveal, Beat-Cut CTA Zoom & Turn Drawer Tilt */
function Scene1HeroReveal() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Sub-shot A (0..35): Angled right-facing hero reveal ("Welcome, Trader")
  // Sub-shot B (35..95): Hard beat cut at f35 into "+ Enter 1,000 $wif Arena" button
  // Sub-shot C (95..150): Steep 3D side tilt into Turn 1 Street Deed setup
  let rx = -14;
  let ry = -44;
  let rz = 3;
  let sc = 1.48;
  let tx = 40;
  let ty = 120;

  if (f < 35) {
    const p = prog(f, 0, 35, easeOut);
    rx = interpolate(p, [0, 1], [-22, -12]);
    ry = interpolate(p, [0, 1], [-58, -38]);
    rz = interpolate(p, [0, 1], [6, 2]);
    sc = interpolate(p, [0, 1], [1.34, 1.56]);
    tx = interpolate(p, [0, 1], [90, 20]);
    ty = interpolate(p, [0, 1], [180, 145]);
  } else if (f < 95) {
    const p = prog(f, 35, 60, easeOut);
    const kick = spring({ frame: f - 35, fps, config: { damping: 14, stiffness: 180 } });
    rx = interpolate(p, [0, 1], [10, 16]);
    ry = interpolate(p, [0, 1], [-18, -10]);
    rz = interpolate(p, [0, 1], [-2, -1]);
    sc = interpolate(kick, [0, 1], [1.62, 1.88]);
    tx = interpolate(p, [0, 1], [-20, 10]);
    ty = interpolate(p, [0, 1], [55, 25]);
  } else {
    const p = prog(f, 95, 55, easeInOut);
    rx = interpolate(p, [0, 1], [24, 34]);
    ry = interpolate(p, [0, 1], [32, 22]);
    rz = interpolate(p, [0, 1], [-18, -10]);
    sc = interpolate(p, [0, 1], [1.45, 1.62]);
    tx = interpolate(p, [0, 1], [-30, 15]);
    ty = interpolate(p, [0, 1], [110, 40]);
  }

  const showDrawer = f >= 95;
  const ctaGlow = 0.55 + 0.45 * Math.sin(f * 0.25);

  return (
    <AbsoluteFill>
      <StudioSpotlight
        intensity={1.08}
        cx={f < 35 ? 58 : 48}
        cy={46}
        goldMix={f >= 35 && f < 95 ? 0.85 : 0.35}
      />

      <IPhone3D
        rotateX={rx}
        rotateY={ry}
        rotateZ={rz}
        scale={sc}
        tx={tx}
        ty={ty}
        glarePos={interpolate(f, [0, 150], [0.18, 0.82], CLAMP)}
      >
        {/* Subtle live 3D town hero background at top */}
        <Img
          src={staticFile("intro/retina_1_start.png")}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.22,
            filter: "blur(2px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(8,20,16,0.86) 0%, rgba(10,24,19,0.96) 38%, #07120e 100%)",
          }}
        />

        {!showDrawer ? (
          <div
            style={{
              position: "relative",
              zIndex: 10,
              padding: "24px 26px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            {/* Top brand header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "rgba(44, 165, 109, 0.18)",
                  border: "1px solid rgba(139, 245, 181, 0.35)",
                  fontFamily: MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  color: PALETTE.accentMintPill,
                }}
              >
                10,000 $wif READY
              </div>
              <TownMark size={36} />
            </div>

            <div style={{ textAlign: "center", marginTop: 6 }}>
              <div
                style={{
                  fontFamily: BUNGEE,
                  fontSize: 28,
                  letterSpacing: 1.5,
                  color: PALETTE.brandWordmarkGold,
                }}
              >
                ROBIN TOWN
              </div>
              <div
                style={{
                  fontFamily: BE_VIETNAM,
                  fontWeight: 800,
                  fontSize: 30,
                  color: PALETTE.parchmentLight,
                  marginTop: 10,
                }}
              >
                Welcome, Alice
              </div>
              <div
                style={{
                  fontFamily: BE_VIETNAM,
                  fontSize: 14,
                  color: PALETTE.inkMuted,
                  marginTop: 4,
                }}
              >
                6-Year 3D Harbor Negotiation Game
              </div>
            </div>

            {/* Glowing Hero CTA button matching "+ Nowy temat" slot */}
            <div
              style={{
                marginTop: 8,
                padding: "18px 20px",
                borderRadius: 18,
                background:
                  "linear-gradient(135deg, rgba(44, 165, 109, 0.28) 0%, rgba(238, 195, 83, 0.18) 100%)",
                border: `2px solid rgba(238, 195, 83, ${(0.55 + 0.35 * ctaGlow).toFixed(2)})`,
                boxShadow: `0 0 36px rgba(44, 165, 109, ${(0.35 * ctaGlow).toFixed(2)})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  fontFamily: MONO,
                  fontWeight: 800,
                  fontSize: 22,
                  color: PALETTE.accentGold,
                }}
              >
                +
              </span>
              <span
                style={{
                  fontFamily: BE_VIETNAM,
                  fontWeight: 800,
                  fontSize: 18,
                  color: PALETTE.parchmentLight,
                }}
              >
                Enter 1,000 $wif Arena
              </span>
            </div>

            {/* District cards below CTA */}
            {[
              { name: "Grand Market Corner", stats: "4/4 Lots", pct: 100, color: PALETTE.accentEmerald },
              { name: "Harborview Quay", stats: "3/6 Lots", pct: 50, color: PALETTE.accentGold },
              { name: "Clocktower Plaza", stats: "4/5 Lots", pct: 80, color: "#29b6f6" },
            ].map((d) => (
              <div
                key={d.name}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: "rgba(16, 42, 32, 0.88)",
                  border: "1px solid rgba(203, 185, 142, 0.2)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: BE_VIETNAM,
                    fontWeight: 700,
                    fontSize: 14,
                    color: PALETTE.parchmentLight,
                    marginBottom: 8,
                  }}
                >
                  <span>{d.name}</span>
                  <span style={{ fontFamily: MONO, color: d.color }}>{d.stats}</span>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 99,
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${d.pct}%`,
                      height: "100%",
                      borderRadius: 99,
                      background: d.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Sub-shot C (95..150): Year 1 Street Deed & Shop Tile Drawer */
          <div
            style={{
              position: "relative",
              zIndex: 10,
              padding: "26px 26px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                fontFamily: BUNGEE,
                fontSize: 20,
                color: PALETTE.accentGold,
                letterSpacing: 1,
              }}
            >
              YEAR 1 · SNAKE
            </div>
            <div
              style={{
                fontFamily: BE_VIETNAM,
                fontWeight: 800,
                fontSize: 24,
                color: PALETTE.parchmentLight,
              }}
            >
              Claim Your Corner
            </div>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                background: "rgba(22, 58, 48, 0.85)",
                border: "1px solid rgba(139, 245, 181, 0.3)",
                fontFamily: MONO,
                fontSize: 13,
                color: PALETTE.accentMintPill,
              }}
            >
              Deeds Dealt: #53 · #54 · #55 · #60
            </div>
            <div
              style={{
                height: 210,
                borderRadius: 18,
                border: `2px dashed ${PALETTE.accentEmerald}`,
                background: "rgba(44, 165, 109, 0.12)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: PALETTE.accentEmerald,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: MONO,
                  fontWeight: 800,
                  fontSize: 28,
                  color: "#06150f",
                }}
              >
                +
              </div>
              <div
                style={{
                  fontFamily: BE_VIETNAM,
                  fontWeight: 700,
                  fontSize: 16,
                  color: PALETTE.parchmentLight,
                }}
              >
                Snap Into 3D Harbor Map
              </div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  color: PALETTE.inkMuted,
                }}
              >
                4 Players · You, Cole, Maya, Clara
              </div>
            </div>
          </div>
        )}
      </IPhone3D>
    </AbsoluteFill>
  );
}

/** SCENE 2 (f150..277 | 5.0s..9.23s): Camera Shutter Snap (f168) + 3 Fanning 3D Cards + District Rows (f218) */
function Scene2ShutterAndCards() {
  const f = useCurrentFrame(); // 0..127 (global 150..277)
  const { fps } = useVideoConfig();
  const gf = f + 150;

  // Sub-shot A (gf 150..218): 3D Phone on left + Shutter Flash at gf=168 + 3 3D Gameplay Cards fanning out on right!
  // Sub-shot B (gf 218..252): Macro pan across glowing District Yield bars (ding-ding cue at gf=218!)
  // Sub-shot C (gf 252..277): Full 3D Phone pull-back overview
  const shutterFlash =
    gf >= 167 && gf <= 176
      ? interpolate(gf, [167, 169, 176], [0, 0.88, 0], CLAMP)
      : 0;

  if (gf < 218) {
    const phoneSlide = prog(gf, 166, 26, easeOut);
    const fanSpring = spring({
      frame: Math.max(0, gf - 168),
      fps,
      config: { damping: 13, stiffness: 150 },
    });

    const cards = [
      {
        step: "01 RECEIVE",
        title: "Harbor Street Deeds",
        metric: "Plots #53 · #54 · #55",
        badge: "Grand Market",
        accent: PALETTE.accentEmerald,
        sprite: "sprites/coffee.png",
      },
      {
        step: "02 BARGAIN OTC",
        title: "2-Way Neighbor Deals",
        metric: "Trade Deeds + Tiles + $wif",
        badge: "1% Vault Fee",
        accent: PALETTE.accentGold,
        sprite: "sprites/banhmi.png",
      },
      {
        step: "03 BUILD IN 3D",
        title: "Connected Shophouses",
        metric: "+140 $wif / yr Harvest",
        badge: "1.20x Boost",
        accent: PALETTE.accentCoral,
        sprite: "sprites/pho.png",
      },
    ];

    return (
      <AbsoluteFill>
        <StudioSpotlight intensity={1.1} cx={46} cy={50} goldMix={0.5} />

        <IPhone3D
          rotateX={interpolate(phoneSlide, [0, 1], [6, 8])}
          rotateY={interpolate(phoneSlide, [0, 1], [0, 28])}
          rotateZ={interpolate(phoneSlide, [0, 1], [0, -3])}
          scale={interpolate(phoneSlide, [0, 1], [0.84, 0.82])}
          tx={interpolate(phoneSlide, [0, 1], [0, -290])}
          ty={10}
          glarePos={0.42}
        >
          <Img
            src={staticFile("intro/retina_2_receive_3d.png")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* Camera viewfinder ring before shutter */}
          <div
            style={{
              position: "absolute",
              bottom: 34,
              left: "50%",
              transform: "translateX(-50%)",
              width: 62,
              height: 62,
              borderRadius: 999,
              border: `4px solid ${PALETTE.parchmentLight}`,
              background: "rgba(238, 195, 83, 0.9)",
              boxShadow: "0 8px 28px rgba(0,0,0,0.6)",
            }}
          />
        </IPhone3D>

        {/* 3 Fanning 3D Parchment & Emerald Cards on the right (matching t=6s Studdly fanning sheets!) */}
        {gf >= 168 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              perspective: 1400,
              pointerEvents: "none",
            }}
          >
            {cards.map((c, idx) => {
              const delay = idx * 4;
              const sp = spring({
                frame: Math.max(0, gf - 168 - delay),
                fps,
                config: { damping: 13, stiffness: 145 },
              });
              const xOff = 185 + idx * 82 * sp;
              const yOff = (idx - 1) * 195 * sp;
              const zOff = idx * 24;
              const rotY = -20 + idx * 5;
              const rotZ = (idx - 1) * 4 * sp;
              return (
                <div
                  key={c.step}
                  style={{
                    position: "absolute",
                    width: 350,
                    padding: "24px 26px",
                    borderRadius: 24,
                    background:
                      "linear-gradient(155deg, #fbf6e8 0%, #efe2c0 100%)",
                    border: `2.5px solid ${c.accent}`,
                    boxShadow: "0 34px 80px rgba(0, 0, 0, 0.72)",
                    opacity: sp,
                    transform: `translate3d(${xOff}px, ${yOff}px, ${zOff}px) scale(${0.72 + 0.28 * fanSpring}) rotateY(${rotY}deg) rotateZ(${rotZ}deg)`,
                    color: PALETTE.inkDark,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 14,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: MONO,
                        fontWeight: 800,
                        fontSize: 12,
                        padding: "5px 10px",
                        borderRadius: 99,
                        background: "#102a20",
                        color: PALETTE.accentMintPill,
                      }}
                    >
                      {c.step}
                    </span>
                    <Img
                      src={staticFile(c.sprite)}
                      style={{
                        width: 40,
                        height: 40,
                        imageRendering: "pixelated",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontFamily: BE_VIETNAM,
                      fontWeight: 800,
                      fontSize: 23,
                      color: "#12261e",
                      lineHeight: 1.2,
                    }}
                  >
                    {c.title}
                  </div>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontWeight: 700,
                      fontSize: 15,
                      color: "#2b5e49",
                      marginTop: 10,
                    }}
                  >
                    {c.metric}
                  </div>
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 12,
                      borderTop: "1px solid rgba(18, 38, 30, 0.14)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontFamily: BE_VIETNAM,
                      fontWeight: 700,
                      fontSize: 13,
                      color: "#574834",
                    }}
                  >
                    <span>{c.badge}</span>
                    <span style={{ color: "#102a20", fontWeight: 800 }}>LIVE 3D</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Crisp white iPhone camera shutter flash right at gf=168 */}
        {shutterFlash > 0 && (
          <AbsoluteFill
            style={{
              backgroundColor: "#ffffff",
              opacity: shutterFlash,
              pointerEvents: "none",
            }}
          />
        )}
      </AbsoluteFill>
    );
  }

  // Sub-shot B & C (gf 218..277): Ding-Ding District Yield Rows -> Pull-out to full 3D Phone
  const pullOut = prog(gf, 246, 30, easeInOut);
  const fillAnim = prog(gf, 218, 24, easeOut);

  return (
    <AbsoluteFill>
      <StudioSpotlight intensity={1.05} cx={50} cy={48} goldMix={0.45} />

      <IPhone3D
        rotateX={interpolate(pullOut, [0, 1], [18, 6])}
        rotateY={interpolate(pullOut, [0, 1], [8, -12])}
        rotateZ={interpolate(pullOut, [0, 1], [-2, 1])}
        scale={interpolate(pullOut, [0, 1], [1.95, 0.88])}
        tx={0}
        ty={interpolate(pullOut, [0, 1], [-40, 8])}
        glarePos={0.55}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(180deg, #0b1f18 0%, #07120e 100%)",
            padding: "22px 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: BUNGEE, fontSize: 20, color: PALETTE.brandWordmarkGold }}>
              ROBIN TOWN
            </span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: PALETTE.accentMintPill }}>
              +276 $wif / yr
            </span>
          </div>

          {/* Mini 3D viewport preview */}
          <div
            style={{
              height: 220,
              borderRadius: 18,
              overflow: "hidden",
              border: "1.5px solid rgba(139, 245, 181, 0.3)",
              position: "relative",
            }}
          >
            <Img
              src={staticFile("intro/fast_play_2_midgame_bots_3d.png")}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          {[
            { label: "Grand Market Noodle Block", count: "4/4", pct: 100, yieldText: "+120 $wif/yr" },
            { label: "Clocktower Bakery Row", count: "3/3", pct: 100, yieldText: "+80 $wif/yr" },
            { label: "Harborview Coffee Corner", count: "5/6", pct: 83, yieldText: "+76 $wif/yr" },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                padding: "14px 16px",
                borderRadius: 16,
                background: "rgba(18, 46, 36, 0.92)",
                border: "1px solid rgba(139, 245, 181, 0.24)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: BE_VIETNAM,
                  fontWeight: 700,
                  fontSize: 13.5,
                  color: PALETTE.parchmentLight,
                  marginBottom: 8,
                }}
              >
                <span>{row.label}</span>
                <span style={{ fontFamily: MONO, color: PALETTE.accentGold }}>{row.yieldText}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    flex: 1,
                    height: 9,
                    borderRadius: 99,
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(row.pct * fillAnim).toFixed(1)}%`,
                      height: "100%",
                      borderRadius: 99,
                      background: `linear-gradient(90deg, ${PALETTE.accentEmerald}, ${PALETTE.accentMintPill})`,
                    }}
                  />
                </div>
                <span style={{ fontFamily: MONO, fontSize: 12, color: PALETTE.inkMuted }}>
                  {row.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </IPhone3D>
    </AbsoluteFill>
  );
}

/** SCENE 3 (f277..390 | 9.23s..13.0s): Floating 3D OTC Deal Notification Pill -> Full 3D Harbor Phone */
function Scene3FloatingDealPill() {
  const f = useCurrentFrame(); // 0..113 (global 277..390)
  const { fps } = useVideoConfig();
  const gf = f + 277;

  // gf 277..352: Floating 3D glass notification pill in spotlight (matching Studdly "Przygotowywanie tematu 6/7 >")
  // gf 352..390: Smooth pull-back into full 3D Harbor mobile screen
  if (gf < 352) {
    const enter = spring({ frame: f, fps, config: { damping: 14, stiffness: 120 } });
    const settled = gf >= 318;
    const barPct = interpolate(gf, [282, 318], [28, 100], CLAMP);
    const tiltY = interpolate(gf, [277, 352], [-16, 14], CLAMP);
    const tiltX = interpolate(gf, [277, 352], [10, -6], CLAMP);

    return (
      <AbsoluteFill>
        <StudioSpotlight intensity={1.15} cx={50} cy={50} goldMix={settled ? 0.75 : 0.25} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            perspective: 1200,
          }}
        >
          <div
            style={{
              width: 720,
              padding: "32px 38px",
              borderRadius: 28,
              background:
                "linear-gradient(145deg, rgba(16, 42, 32, 0.95) 0%, rgba(9, 22, 18, 0.98) 100%)",
              border: settled
                ? `2px solid ${PALETTE.accentGold}`
                : "1.5px solid rgba(139, 245, 181, 0.32)",
              boxShadow: settled
                ? "0 30px 90px rgba(0,0,0,0.85), 0 0 60px rgba(238, 195, 83, 0.24)"
                : "0 30px 90px rgba(0,0,0,0.85)",
              transform: `scale(${0.82 + 0.18 * enter}) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <StoolBadge color={settled ? PALETTE.accentGold : PALETTE.accentEmerald} size={46} />
                <div>
                  <div
                    style={{
                      fontFamily: BE_VIETNAM,
                      fontWeight: 800,
                      fontSize: 26,
                      color: PALETTE.parchmentLight,
                    }}
                  >
                    Grand Market Plot #54 OTC Swap
                  </div>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 15,
                      color: settled ? PALETTE.accentMintPill : PALETTE.inkMuted,
                      marginTop: 6,
                    }}
                  >
                    {settled
                      ? "Deal Accepted by Maya · 4-Lot Corner Connected (6/6)"
                      : "Bargaining with Cole, Maya & Clara... (5/6)"}
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontFamily: MONO,
                  fontWeight: 800,
                  fontSize: 26,
                  color: settled ? PALETTE.accentGold : PALETTE.inkMuted,
                }}
              >
                &gt;
              </div>
            </div>

            <div
              style={{
                marginTop: 22,
                height: 10,
                borderRadius: 99,
                background: "rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${barPct.toFixed(1)}%`,
                  height: "100%",
                  borderRadius: 99,
                  background: settled
                    ? `linear-gradient(90deg, ${PALETTE.accentEmerald}, ${PALETTE.accentGold})`
                    : PALETTE.accentEmerald,
                }}
              />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // Pull back to crisp 3D phone (gf 352..390)
  const p = prog(gf, 352, 38, easeOut);
  return (
    <AbsoluteFill>
      <StudioSpotlight intensity={1.05} cx={50} cy={48} goldMix={0.4} />
      <IPhone3D
        rotateX={interpolate(p, [0, 1], [14, 4])}
        rotateY={interpolate(p, [0, 1], [-18, 8])}
        rotateZ={0}
        scale={interpolate(p, [0, 1], [1.15, 0.86])}
        glarePos={0.5}
      >
        <Img
          src={staticFile("intro/retina_4_build_3d.png")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </IPhone3D>
    </AbsoluteFill>
  );
}

/** SCENE 4 (f390..559 | 13.0s..18.63s): Signature 6-Year Zodiac Vertical Ring Count-Up + White Whip Flash (f557) */
function Scene4ZodiacCountUp() {
  const f = useCurrentFrame(); // 0..169 (global 390..559)
  const { fps } = useVideoConfig();
  const gf = f + 390;

  // Glides along a 3D S-curve of 6 numbered Zodiac Year nodes (1 Snake -> 6 Dog),
  // hitting bass accents at gf=483, 506, 519, 542 and ending on Year 6 Finale Card + white whip flash at gf=555..559!
  const years = [
    { num: 6, zodiac: "Year 6 · Dog", yieldLabel: "+276 $wif / yr", x: 0, y: 0 },
    { num: 5, zodiac: "Year 5 · Rooster", yieldLabel: "+240 $wif / yr", x: 180, y: 210 },
    { num: 4, zodiac: "Year 4 · Monkey", yieldLabel: "+195 $wif / yr", x: -150, y: 420 },
    { num: 3, zodiac: "Year 3 · Goat", yieldLabel: "+145 $wif / yr", x: 165, y: 630 },
    { num: 2, zodiac: "Year 2 · Horse", yieldLabel: "+95 $wif / yr", x: -140, y: 840 },
    { num: 1, zodiac: "Year 1 · Snake", yieldLabel: "+50 $wif / yr", x: 90, y: 1050 },
  ];

  const travel = prog(gf, 390, 130, easeInOut);
  const camY = interpolate(travel, [0, 1], [-980, 40]);
  const camScale = interpolate(gf, [515, 558], [1, 1.38], CLAMP);

  // Beat pulse on heavy kicks (483, 506, 519, 542)
  const beatFrames = [483, 506, 519, 542];
  let beatBoost = 0;
  for (const bf of beatFrames) {
    if (gf >= bf && gf <= bf + 10) {
      beatBoost = Math.max(beatBoost, interpolate(gf, [bf, bf + 10], [1, 0], CLAMP));
    }
  }

  const cardPop = spring({
    frame: Math.max(0, gf - 504),
    fps,
    config: { damping: 13, stiffness: 150 },
  });

  const whipFlash =
    gf >= 551 ? interpolate(gf, [551, 558], [0, 1], CLAMP) : 0;

  return (
    <AbsoluteFill>
      <StudioSpotlight
        intensity={1.1 + 0.35 * beatBoost}
        cx={50}
        cy={46}
        goldMix={0.35 + 0.55 * beatBoost}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          perspective: 1300,
        }}
      >
        <div
          style={{
            width: 900,
            height: 900,
            position: "relative",
            transformStyle: "preserve-3d",
            transform: `scale(${camScale}) rotateX(${interpolate(travel, [0, 1], [54, 34])}deg) rotateZ(${interpolate(travel, [0, 1], [-8, 0])}deg) translateY(${camY}px)`,
          }}
        >
          {years.map((yr) => {
            const dist = Math.abs(yr.y + camY - 260);
            const active = dist < 210 || (yr.num === 6 && gf >= 500);
            return (
              <div
                key={yr.num}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 220 + yr.y,
                  transform: `translate(-50%, -50%) translateX(${yr.x}px)`,
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                }}
              >
                <div
                  style={{
                    width: 124,
                    height: 124,
                    borderRadius: 999,
                    background: active
                      ? "radial-gradient(circle, rgba(44,165,109,0.42) 0%, rgba(12,32,24,0.95) 75%)"
                      : "rgba(14, 30, 24, 0.85)",
                    border: active
                      ? `3px solid ${PALETTE.accentGold}`
                      : "2px solid rgba(139, 245, 181, 0.25)",
                    boxShadow: active
                      ? "0 0 55px rgba(238, 195, 83, 0.42)"
                      : "0 18px 40px rgba(0,0,0,0.65)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: BE_VIETNAM,
                    fontWeight: 800,
                    fontSize: 48,
                    color: active ? PALETTE.parchmentLight : PALETTE.inkMuted,
                  }}
                >
                  {yr.num}
                </div>
                <div
                  style={{
                    padding: "10px 18px",
                    borderRadius: 14,
                    background: "rgba(10, 26, 20, 0.9)",
                    border: "1px solid rgba(203, 185, 142, 0.25)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: BE_VIETNAM,
                      fontWeight: 800,
                      fontSize: 18,
                      color: PALETTE.parchmentLight,
                    }}
                  >
                    {yr.zodiac}
                  </div>
                  <div
                    style={{
                      fontFamily: MONO,
                      fontWeight: 700,
                      fontSize: 15,
                      color: PALETTE.accentGold,
                    }}
                  >
                    {yr.yieldLabel}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Year 6 Finale CTA Card floating above Ring 6 (matching Studdly Sloth + "Rozpocznij naukę" card!) */}
          {gf >= 502 && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 90,
                transform: `translate(-50%, -50%) translateZ(50px) scale(${0.75 + 0.25 * cardPop})`,
                opacity: cardPop,
                width: 480,
                padding: "24px 28px",
                borderRadius: 24,
                background: "rgba(12, 31, 24, 0.96)",
                border: `2px solid ${PALETTE.accentGold}`,
                boxShadow: "0 30px 80px rgba(0,0,0,0.88), 0 0 60px rgba(44,165,109,0.35)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <TownMark size={58} />
              <div
                style={{
                  fontFamily: BE_VIETNAM,
                  fontWeight: 800,
                  fontSize: 22,
                  color: PALETTE.parchmentLight,
                }}
              >
                Year 6 Final Harvest Ready
              </div>
              <div
                style={{
                  width: "100%",
                  padding: "13px 20px",
                  borderRadius: 14,
                  background: `linear-gradient(90deg, ${PALETTE.accentEmerald}, #39b97c)`,
                  textAlign: "center",
                  fontFamily: BE_VIETNAM,
                  fontWeight: 800,
                  fontSize: 18,
                  color: "#04120c",
                }}
              >
                Settle 4,000 $wif Ranked Pot
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Exact kinetic white whip-flash at gf 551..559 matching Studdly reference */}
      {whipFlash > 0 && (
        <AbsoluteFill
          style={{
            backgroundColor: PALETTE.parchmentLight,
            opacity: whipFlash,
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
}

/** SCENE 5 (f559..700 | 18.63s..23.33s): 3D $wif Flywheel Phone + Tactile Hand Click at f677 */
function Scene5FlywheelAndClick() {
  const f = useCurrentFrame(); // 0..141 (global 559..700)
  const { fps } = useVideoConfig();
  const gf = f + 559;

  const flashOut = gf <= 566 ? interpolate(gf, [559, 566], [0.9, 0], CLAMP) : 0;

  // Sub-shot A (gf 559..638): Angled 3D iPhone inspecting $wif Flywheel & Live Bot Economy
  // Sub-shot B (gf 638..700): Macro close-up on "Finish & Crown Winner" button + Pointer Hand Tap at gf=677!
  const isMacro = gf >= 638;

  if (!isMacro) {
    const p = prog(gf, 559, 79, easeOut);
    const tabTap = gf >= 605; // Synced to screen-tap cue at gf=605!
    return (
      <AbsoluteFill>
        <StudioSpotlight intensity={1.08} cx={52} cy={48} goldMix={tabTap ? 0.65 : 0.3} />
        <IPhone3D
          rotateX={interpolate(p, [0, 1], [12, 6])}
          rotateY={interpolate(p, [0, 1], [-34, -22])}
          rotateZ={interpolate(p, [0, 1], [4, 2])}
          scale={interpolate(p, [0, 1], [0.92, 1.18])}
          tx={0}
          ty={12}
          glarePos={interpolate(p, [0, 1], [0.25, 0.68])}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(180deg, #0b1f18 0%, #06110d 100%)",
              padding: "20px 26px 26px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ fontFamily: BUNGEE, fontSize: 22, color: PALETTE.brandWordmarkGold }}>
              ROBIN TOWN
            </div>
            <div
              style={{
                fontFamily: BE_VIETNAM,
                fontWeight: 800,
                fontSize: 22,
                color: PALETTE.parchmentLight,
              }}
            >
              Deflationary $wif Flywheel
            </div>
            <div
              style={{
                fontFamily: BE_VIETNAM,
                fontSize: 13.5,
                lineHeight: 1.55,
                color: PALETTE.inkMuted,
              }}
            >
              Every 4-player Ranked Arena pools 4,000 $wif. Winners take 3,600 $wif across 1st,
              2nd, and 3rd place while 200 $wif is burned forever and 200 $wif rewards stakers.
            </div>

            <div
              style={{
                height: 220,
                borderRadius: 16,
                overflow: "hidden",
                border: `1.5px solid ${tabTap ? PALETTE.accentGold : "rgba(139,245,181,0.28)"}`,
              }}
            >
              <Img
                src={staticFile(
                  tabTap
                    ? "intro/fast_play_4_completed_3d_city.png"
                    : "intro/retina_5_wif_hub.png",
                )}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div
                style={{
                  padding: "12px",
                  borderRadius: 12,
                  background: "rgba(44,165,109,0.16)",
                  border: "1px solid rgba(139,245,181,0.3)",
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 11, color: PALETTE.accentMintPill }}>
                  PODIUM PURSE
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontWeight: 800,
                    fontSize: 18,
                    color: PALETTE.parchmentLight,
                  }}
                >
                  3,600 $wif
                </div>
              </div>
              <div
                style={{
                  padding: "12px",
                  borderRadius: 12,
                  background: "rgba(220,111,87,0.18)",
                  border: "1px solid rgba(255,184,153,0.35)",
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 11, color: PALETTE.burnText }}>
                  BURNED + VAULT
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontWeight: 800,
                    fontSize: 18,
                    color: PALETTE.accentGold,
                  }}
                >
                  400 $wif
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: "auto",
                padding: "15px",
                borderRadius: 14,
                background: `linear-gradient(90deg, ${PALETTE.accentEmerald}, #39b97c)`,
                textAlign: "center",
                fontFamily: BE_VIETNAM,
                fontWeight: 800,
                fontSize: 16,
                color: "#05140e",
              }}
            >
              Crown Year 6 Winner
            </div>
          </div>
        </IPhone3D>

        {flashOut > 0 && (
          <AbsoluteFill style={{ backgroundColor: PALETTE.parchmentLight, opacity: flashOut }} />
        )}
      </AbsoluteFill>
    );
  }

  // Sub-shot B (gf 638..700): Macro button + tactile pointer click at gf=677!
  const approach = prog(gf, 642, 34, easeOut);
  const clicked = gf >= 677;
  const pressScale =
    gf >= 676 && gf <= 685
      ? interpolate(gf, [676, 679, 685], [1, 0.93, 1.03], CLAMP)
      : 1;
  const ripple = clicked ? prog(gf, 677, 20, easeOut) : 0;
  const handSpring = spring({
    frame: Math.max(0, gf - 645),
    fps,
    config: { damping: 15, stiffness: 140 },
  });

  return (
    <AbsoluteFill>
      <StudioSpotlight intensity={1.15} cx={50} cy={54} goldMix={clicked ? 0.9 : 0.4} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          perspective: 1100,
        }}
      >
        {/* Bottom bezel edge of 3D phone in macro view */}
        <div
          style={{
            width: 820,
            height: 460,
            borderRadius: 48,
            background: "linear-gradient(180deg, rgba(12, 30, 24, 0.96) 0%, #06100c 100%)",
            border: "2px solid rgba(139, 245, 181, 0.24)",
            boxShadow: "0 50px 130px rgba(0,0,0,0.9)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
            transform: `scale(${0.94 + 0.08 * approach}) rotateX(12deg)`,
            position: "relative",
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: 16, color: PALETTE.inkMuted }}>
            YEAR 6 COMPLETE · ALL 4 PLAYERS SETTLED
          </div>

          <div
            style={{
              padding: "24px 64px",
              borderRadius: 20,
              background: clicked
                ? `linear-gradient(90deg, ${PALETTE.accentGold}, ${PALETTE.accentMintPill})`
                : `linear-gradient(90deg, ${PALETTE.accentEmerald}, #3cc483)`,
              boxShadow: clicked
                ? "0 0 70px rgba(238, 195, 83, 0.65)"
                : "0 18px 50px rgba(44, 165, 109, 0.45)",
              transform: `scale(${pressScale})`,
              fontFamily: BE_VIETNAM,
              fontWeight: 800,
              fontSize: 30,
              color: "#05140e",
              position: "relative",
            }}
          >
            Reveal Ranked Podium

            {/* Expanding golden click shockwave right on gf=677 */}
            {clicked && (
              <div
                style={{
                  position: "absolute",
                  left: "68%",
                  top: "58%",
                  width: 140,
                  height: 140,
                  borderRadius: 999,
                  border: `3px solid ${PALETTE.accentGold}`,
                  transform: `translate(-50%, -50%) scale(${0.3 + 1.8 * ripple})`,
                  opacity: 1 - ripple,
                  pointerEvents: "none",
                }}
              />
            )}
          </div>

          {/* Crisp white/dark vector pointer hand gliding in to tap (matching t=22.5s!) */}
          <svg
            width="68"
            height="68"
            viewBox="0 0 64 64"
            style={{
              position: "absolute",
              left: interpolate(handSpring, [0, 1], [640, 515]),
              top: interpolate(handSpring, [0, 1], [390, 250]),
              transform: `scale(${clicked ? 0.9 : 1}) rotate(-14deg)`,
              filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.75))",
            }}
          >
            <path
              d="M26 10 C26 7, 31 7, 31 10 V28 H34 C36 25, 40 26, 40 29 V31 H43 C45 29, 49 30, 49 33 V42 C49 50, 42 56, 33 56 H27 C20 56, 16 50, 16 43 V35 C16 32, 20 31, 22 34 L26 38 Z"
              fill="#0a1410"
              stroke={PALETTE.parchmentLight}
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** SCENE 6 (f700..848 | 23.33s..28.27s): Mascot Crest + Lens Flare + 4-Player Podium Showdown (Chime at f812!) */
function Scene6PodiumShowdown() {
  const f = useCurrentFrame(); // 0..148 (global 700..848)
  const { fps } = useVideoConfig();
  const gf = f + 700;

  // Sub-shot A (gf 700..768): Mascot Crest Spotlight + Warm Bullion Lens-Flare Sweep (peaks gf 724..730!)
  // Sub-shot B (gf 768..848): 4-Row Ranked Podium Showdown -> Row 1 (#1 YOU) lights up on gf=812 victory chime!
  if (gf < 768) {
    const pop = spring({ frame: f, fps, config: { damping: 12, stiffness: 135 } });
    const flare =
      gf >= 714 && gf <= 744
        ? interpolate(gf, [714, 726, 744], [0, 0.92, 0.12], CLAMP)
        : 0.12;

    return (
      <AbsoluteFill>
        <StudioSpotlight intensity={1.25} cx={50} cy={45} goldMix={0.85} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            perspective: 1200,
          }}
        >
          <div style={{ transform: `scale(${0.7 + 0.35 * pop}) rotateY(${interpolate(gf, [700, 768], [-16, 12])}deg)` }}>
            <TownMark size={156} />
          </div>

          <div
            style={{
              padding: "26px 44px",
              borderRadius: 24,
              background: "rgba(12, 30, 24, 0.94)",
              border: `2px solid ${PALETTE.accentGold}`,
              boxShadow: "0 30px 90px rgba(0,0,0,0.85)",
              textAlign: "center",
              transform: `rotateX(10deg) scale(${0.85 + 0.15 * pop})`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 15, color: PALETTE.accentMintPill }}>
              YEAR 6 FINAL AUDIT · 4,000 $WIF ARENA POT
            </div>
            <div
              style={{
                fontFamily: BE_VIETNAM,
                fontWeight: 800,
                fontSize: 34,
                color: PALETTE.parchmentLight,
                marginTop: 8,
              }}
            >
              Who Claims the Harbor Crown?
            </div>
          </div>

          {/* Warm volumetric lens flare matching Studdly t=24s flare */}
          <div
            style={{
              position: "absolute",
              left: `${interpolate(gf, [710, 755], [32, 68], CLAMP)}%`,
              top: "46%",
              width: 560,
              height: 560,
              transform: "translate(-50%, -50%)",
              background:
                "radial-gradient(circle, rgba(255,250,230,0.95) 0%, rgba(238,195,83,0.45) 28%, transparent 68%)",
              opacity: flare,
              pointerEvents: "none",
              mixBlendMode: "screen",
            }}
          />
        </div>
      </AbsoluteFill>
    );
  }

  // Sub-shot B (gf 768..848): 4-Player Ranked Standings Rows (matching A/B/C/D layout + StuddlyCorrect chime at gf=812!)
  const winnerLit = gf >= 811;
  const winPop = spring({
    frame: Math.max(0, gf - 811),
    fps,
    config: { damping: 11, stiffness: 180 },
  });
  const camTiltY = interpolate(gf, [768, 848], [-12, 4], CLAMP);

  const standings = [
    {
      rank: "1",
      name: "YOU (Alice)",
      detail: "1,029 $wif Town Value · +2,160 $wif 1st Purse",
      color: PALETTE.accentEmerald,
      winner: true,
    },
    {
      rank: "2",
      name: "COLE (Bot)",
      detail: "876 $wif Town Value · +1,080 $wif 2nd Purse",
      color: PALETTE.accentGold,
      winner: false,
    },
    {
      rank: "3",
      name: "MAYA (Bot)",
      detail: "830 $wif Town Value · +540 $wif 3rd Purse",
      color: PALETTE.accentCoral,
      winner: false,
    },
    {
      rank: "4",
      name: "CLARA (Bot)",
      detail: "798 $wif · 200 $wif Burned + 200 $wif Staking Vault",
      color: "#7fb5cf",
      winner: false,
    },
  ];

  return (
    <AbsoluteFill>
      <StudioSpotlight intensity={1.15} cx={50} cy={50} goldMix={winnerLit ? 0.85 : 0.3} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          perspective: 1300,
        }}
      >
        <div
          style={{
            width: 960,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            transform: `rotateX(12deg) rotateY(${camTiltY}deg)`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
              padding: "0 8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <TownMark size={44} />
              <span
                style={{
                  fontFamily: BUNGEE,
                  fontSize: 22,
                  color: PALETTE.brandWordmarkGold,
                }}
              >
                YEAR 6 PODIUM
              </span>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 15, color: PALETTE.accentMintPill }}>
              90% PURSE · 5% BURN · 5% VAULT
            </span>
          </div>

          {standings.map((row, idx) => {
            const rowIn = spring({
              frame: Math.max(0, gf - 768 - idx * 4),
              fps,
              config: { damping: 14, stiffness: 150 },
            });
            const isHighlighted = row.winner && winnerLit;
            const rowStyle: CSSProperties = {
              padding: "20px 28px",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              opacity: rowIn,
              transform: `translateX(${(1 - rowIn) * 60}px) scale(${
                isHighlighted ? 1 + 0.045 * winPop : 1
              })`,
              background: isHighlighted
                ? "linear-gradient(90deg, rgba(44, 165, 109, 0.42) 0%, rgba(238, 195, 83, 0.26) 100%)"
                : "rgba(12, 28, 22, 0.9)",
              border: isHighlighted
                ? `2.5px solid ${PALETTE.accentGold}`
                : "1.5px solid rgba(203, 185, 142, 0.18)",
              boxShadow: isHighlighted
                ? "0 18px 60px rgba(44, 165, 109, 0.45), 0 0 40px rgba(238, 195, 83, 0.35)"
                : "0 14px 36px rgba(0,0,0,0.6)",
            };

            return (
              <div key={row.rank} style={rowStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: isHighlighted ? PALETTE.accentGold : "rgba(255,255,255,0.07)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: MONO,
                      fontWeight: 800,
                      fontSize: 20,
                      color: isHighlighted ? "#07150f" : PALETTE.inkMuted,
                    }}
                  >
                    #{row.rank}
                  </div>
                  <StoolBadge color={row.color} size={38} />
                  <div>
                    <div
                      style={{
                        fontFamily: BE_VIETNAM,
                        fontWeight: 800,
                        fontSize: 22,
                        color: PALETTE.parchmentLight,
                      }}
                    >
                      {row.name}
                    </div>
                    <div
                      style={{
                        fontFamily: MONO,
                        fontSize: 15,
                        color: isHighlighted ? PALETTE.accentMintPill : PALETTE.inkMuted,
                        marginTop: 2,
                      }}
                    >
                      {row.detail}
                    </div>
                  </div>
                </div>

                {isHighlighted && (
                  <div
                    style={{
                      padding: "8px 16px",
                      borderRadius: 999,
                      background: PALETTE.accentGold,
                      fontFamily: BUNGEE,
                      fontSize: 15,
                      color: "#081711",
                      letterSpacing: 0.8,
                    }}
                  >
                    CHAMPION
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** SCENE 7 (f848..1011 | 28.27s..33.70s): Pure Obsidian Hero Brand Finale Lockup (1:1 Studdly End Card) */
function Scene7BrandFinale() {
  const f = useCurrentFrame(); // 0..163 (global 848..1011)
  const { fps } = useVideoConfig();
  const gf = f + 848;

  // Phase A (gf 848..893): Minimal white-cream center tagline on pure #030504 black
  // Phase B (gf 893..1011): Brand Wordmark -> TownMark Crest -> Two sleek glass badges at bottom!
  const isLockup = gf >= 893;

  if (!isLockup) {
    const fadeIn = prog(gf, 850, 14, easeOut);
    const fadeOut = gf >= 884 ? interpolate(gf, [884, 892], [1, 0], CLAMP) : 1;
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#020403",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: BE_VIETNAM,
            fontWeight: 600,
            fontSize: 34,
            letterSpacing: -0.3,
            color: PALETTE.parchmentLight,
            opacity: fadeIn * fadeOut,
            transform: `translateY(${(1 - fadeIn) * 14}px)`,
          }}
        >
          Bargain for corners, build in 3D, and put $wif to work.
        </div>
      </AbsoluteFill>
    );
  }

  const wordSpring = spring({
    frame: Math.max(0, gf - 893),
    fps,
    config: { damping: 15, stiffness: 150 },
  });
  const logoSpring = spring({
    frame: Math.max(0, gf - 915),
    fps,
    config: { damping: 13, stiffness: 150 },
  });
  const badgeSpring = spring({
    frame: Math.max(0, gf - 932),
    fps,
    config: { damping: 15, stiffness: 140 },
  });
  const endFade = gf >= 998 ? interpolate(gf, [998, 1010], [1, 0], CLAMP) : 1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#020403",
        backgroundImage:
          "radial-gradient(45% 42% at 50% 48%, rgba(44, 165, 109, 0.14) 0%, transparent 72%)",
        opacity: endFade,
      }}
    >
      {/* Top hackathon attribution whisper (matching "edited by keewinek" slot) */}
      <div
        style={{
          position: "absolute",
          top: 52,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 13,
          letterSpacing: 2.2,
          color: "rgba(189, 216, 200, 0.68)",
          opacity: logoSpring,
        }}
      >
        WORLD IS FLAT HACKATHON · BUILD WITH $WIF
      </div>

      {/* Center Mascot Crest + ROBIN TOWN Wordmark */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            opacity: logoSpring,
            transform: `scale(${0.65 + 0.35 * logoSpring}) translateY(${(1 - logoSpring) * 14}px)`,
          }}
        >
          <TownMark size={86} />
        </div>

        <div
          style={{
            fontFamily: BUNGEE,
            fontSize: 66,
            letterSpacing: 3.5,
            color: PALETTE.parchmentLight,
            opacity: wordSpring,
            transform: `scale(${0.88 + 0.12 * wordSpring})`,
            textShadow: "0 12px 44px rgba(44, 165, 109, 0.32)",
          }}
        >
          ROBIN TOWN
        </div>

        <div
          style={{
            fontFamily: MONO,
            fontSize: 16,
            color: PALETTE.accentGold,
            opacity: logoSpring,
            letterSpacing: 0.6,
          }}
        >
          robin-town-production.up.railway.app
        </div>
      </div>

      {/* Bottom stacked sleek dark-glass badges (matching Google Play / App Store stack) */}
      <div
        style={{
          position: "absolute",
          bottom: 58,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          opacity: badgeSpring,
          transform: `translateY(${(1 - badgeSpring) * 20}px)`,
        }}
      >
        <div
          style={{
            width: 290,
            padding: "11px 18px",
            borderRadius: 12,
            background: "rgba(16, 42, 32, 0.85)",
            border: "1.5px solid rgba(251, 246, 232, 0.26)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 99,
              background: PALETTE.accentMintPill,
            }}
          />
          <span
            style={{
              fontFamily: BE_VIETNAM,
              fontWeight: 800,
              fontSize: 14,
              color: PALETTE.parchmentLight,
              letterSpacing: 0.4,
            }}
          >
            PLAY LIVE · WEB & MOBILE
          </span>
        </div>

        <div
          style={{
            width: 290,
            padding: "11px 18px",
            borderRadius: 12,
            background: "rgba(22, 36, 30, 0.72)",
            border: `1.5px solid rgba(238, 195, 83, 0.45)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: 13,
              color: PALETTE.accentGold,
            }}
          >
            10,000 $WIF READY · 5% BURN
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function RobinTownIntro() {
  return (
    <FontGate>
      <AbsoluteFill style={{ backgroundColor: "#040709" }}>
        {/* Exact 1:1 Raylight Studdly App mixed soundtrack + SFX */}
        <Audio src={staticFile("audio/raylight-intro.mp3")} volume={1} />

        <Sequence from={0} durationInFrames={150} name="Intro-S1-HeroReveal">
          <Scene1HeroReveal />
        </Sequence>

        <Sequence from={150} durationInFrames={127} name="Intro-S2-ShutterAndCards">
          <Scene2ShutterAndCards />
        </Sequence>

        <Sequence from={277} durationInFrames={113} name="Intro-S3-FloatingDealPill">
          <Scene3FloatingDealPill />
        </Sequence>

        <Sequence from={390} durationInFrames={169} name="Intro-S4-ZodiacCountUp">
          <Scene4ZodiacCountUp />
        </Sequence>

        <Sequence from={559} durationInFrames={141} name="Intro-S5-FlywheelAndClick">
          <Scene5FlywheelAndClick />
        </Sequence>

        <Sequence from={700} durationInFrames={148} name="Intro-S6-PodiumShowdown">
          <Scene6PodiumShowdown />
        </Sequence>

        <Sequence from={848} durationInFrames={163} name="Intro-S7-BrandFinale">
          <Scene7BrandFinale />
        </Sequence>
      </AbsoluteFill>
    </FontGate>
  );
}
