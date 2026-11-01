import { Img, staticFile } from "remotion";
import { LaptopFrame } from "@/components/snap-cn/laptop-frame";
import { PhoneFrame } from "@/components/snap-cn/phone-frame";
import { FontGate, SolaceGround, TownMark } from "../components/TownMark";
import { PALETTE } from "../palette";
import { BE_VIETNAM, BUNGEE, MONO, ROBIN_THEME } from "../theme";

const HERO_PILLS = [
  {
    label: "3D + 2D Live",
    dot: PALETTE.accentEmerald,
    border: PALETTE.accentEmerald,
    text: PALETTE.parchmentLight,
  },
  {
    label: "Fast 8x Bots & Rooms",
    dot: PALETTE.accentEmerald,
    border: PALETTE.accentEmerald,
    text: PALETTE.parchmentLight,
  },
  {
    label: "World is Flat ($wif)",
    dot: PALETTE.accentGold,
    border: PALETTE.accentGold,
    text: PALETTE.accentGold,
  },
] as const;

export const DISPATCH_STILL_FRAMES = 60;

export function DispatchBannerStill() {
  return (
    <FontGate>
      <SolaceGround>
        {/* Subtle studio key-light frame border inside 1920x1080 */}
        <div
          style={{
            position: "absolute",
            inset: 28,
            borderRadius: 28,
            border: "1px solid rgba(44, 165, 109, 0.24)",
            pointerEvents: "none",
          }}
        />

        {/* LEFT EDITORIAL LOCKUP (x: 88..648, maxWidth: 560px, generous breathing room) */}
        <div
          style={{
            position: "absolute",
            left: 88,
            top: 0,
            bottom: 0,
            width: 560,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 26,
            zIndex: 4,
          }}
        >
          {/* Brand Crest + Dispatch Release Chip */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <TownMark size={64} />
            <div
              style={{
                padding: "9px 18px",
                borderRadius: 999,
                background: PALETTE.bgHudDark,
                border: `1.5px solid ${PALETTE.accentEmerald}`,
                fontFamily: MONO,
                fontVariantNumeric: "tabular-nums",
                fontSize: 15,
                fontWeight: 700,
                color: PALETTE.parchmentLight,
                letterSpacing: "0.08em",
              }}
            >
              ● BUILDER DISPATCH · LIVE WEB + MOBILE
            </div>
          </div>

          {/* Main Display Wordmark: ROBIN TOWN v1.0 in Bungee #fbf6e8 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                fontFamily: BUNGEE,
                fontVariantNumeric: "tabular-nums",
                fontSize: 66,
                lineHeight: 1.02,
                color: PALETTE.parchmentLight,
                letterSpacing: "0.02em",
              }}
            >
              ROBIN TOWN
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span
                style={{
                  fontFamily: BUNGEE,
                  fontVariantNumeric: "tabular-nums",
                  fontSize: 44,
                  lineHeight: 1,
                  color: PALETTE.parchmentLight,
                  letterSpacing: "0.03em",
                }}
              >
                v1.0
              </span>
              <span
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: PALETTE.bgHudDark,
                  border: `1px solid ${PALETTE.accentGold}`,
                  fontFamily: MONO,
                  fontVariantNumeric: "tabular-nums",
                  fontSize: 15,
                  fontWeight: 700,
                  color: PALETTE.accentGold,
                  letterSpacing: "0.06em",
                }}
              >
                72 PLOTS · 6 DISTRICTS
              </span>
            </div>
          </div>

          {/* Crisp Subtitle */}
          <div
            style={{
              fontFamily: BE_VIETNAM,
              fontVariantNumeric: "tabular-nums",
              fontSize: 25,
              fontWeight: 600,
              lineHeight: 1.38,
              color: PALETTE.parchmentLight,
              opacity: 0.94,
            }}
          >
            3D Harbor Board Game · OTC Bargaining · Official{" "}
            <span style={{ color: PALETTE.accentGold, fontWeight: 700 }}>$wif (4663)</span>
          </div>

          {/* 3 Emerald / Gold Feature Pills */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 4,
            }}
          >
            {HERO_PILLS.map((pill) => (
              <div
                key={pill.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "11px 20px",
                  borderRadius: 999,
                  background: PALETTE.bgHudDark,
                  border: `1.5px solid ${pill.border}`,
                  boxShadow: "0 10px 20px rgba(8, 22, 16, 0.58)",
                  fontFamily: BE_VIETNAM,
                  fontVariantNumeric: "tabular-nums",
                  fontSize: 18,
                  fontWeight: 700,
                  color: pill.text,
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: pill.dot,
                    display: "inline-block",
                  }}
                />
                <span>{pill.label}</span>
              </div>
            ))}
          </div>

          {/* Clean Telemetry / URL Footer */}
          <div
            style={{
              marginTop: 6,
              paddingTop: 18,
              borderTop: "1px solid rgba(44, 165, 109, 0.28)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: MONO,
              fontVariantNumeric: "tabular-nums",
              fontSize: 15,
              fontWeight: 600,
              color: PALETTE.accentEmerald,
            }}
          >
            <span style={{ color: PALETTE.parchmentLight }}>
              robin-town-production.up.railway.app
            </span>
            <span style={{ color: PALETTE.accentGold }}>·</span>
            <span>926 Tests Passed</span>
          </div>
        </div>

        {/* RIGHT / CENTER-RIGHT HERO HARDWARE STAGE (x: 660..1868) */}
        {/* 1. Angled @snapcn/laptop-frame displaying crisp 3D Harbor Diorama gameplay */}
        <div
          style={{
            position: "absolute",
            left: 620,
            top: 74,
            width: 1120,
            height: 760,
            perspective: 2000,
            zIndex: 2,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: "rotateY(-10deg) rotateX(2deg)",
              transformStyle: "preserve-3d",
            }}
          >
            <LaptopFrame
              entrance="none"
              finale="none"
              floatLoop={false}
              restTilt={6}
              scale={1.14}
              showNotch={false}
              bezelColor={PALETTE.bgHudDark}
              screenColor={PALETTE.bgDeep}
              shadow="0 20px 24px rgba(8, 22, 16, 0.78)"
              fontFamily={BE_VIETNAM}
              theme={ROBIN_THEME}
              mode="dark"
            >
              <Img
                src={staticFile("clips/desktop-sunset-clean.png")}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </LaptopFrame>
          </div>
        </div>

        {/* 2. Bottom-Right Overlapping @snapcn/phone-frame displaying live 2x Retina Mobile 3D Harbor */}
        <div
          style={{
            position: "absolute",
            left: 1472,
            top: 318,
            width: 384,
            height: 716,
            zIndex: 5,
          }}
        >
          <PhoneFrame
            variant="tilt"
            tiltAngle={-12}
            entrance="rise"
            floatLoop={false}
            scale={0.98}
            bezelColor={PALETTE.bgHudDark}
            screenColor={PALETTE.bgDeep}
            shadow="0 20px 24px rgba(8, 22, 16, 0.88)"
            showDynamicIsland={false}
            fontFamily={BE_VIETNAM}
            theme={ROBIN_THEME}
            mode="dark"
          >
            <Img
              src={staticFile("clips/mobile-sunset-2x.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </PhoneFrame>
        </div>
      </SolaceGround>
    </FontGate>
  );
}
