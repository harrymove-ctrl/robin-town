import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { PhoneStack } from "@/components/snap-cn/phone-stack";
import { SolaceGround } from "../components/TownMark";
import { C, PALETTE } from "../palette";
import { BE_VIETNAM, MONO } from "../theme";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const SEAT_LABELS = [
  "Seat 01 · 3D Harbor Diorama (390×844)",
  "Seat 02 · Two-Way OTC Bargain",
  "Seat 03 · 2D Pixel Street Map",
  "Seat 04 · $wif Hub & WebSocket Room",
] as const;

/** S16 (300f / 5 bars): @snapcn/phone-stack rising with 4 captured 390x844 mobile & WebSocket seat screens. */
export function MultiSeatStack() {
  const frame = useCurrentFrame();
  const activeIdx = Math.min(3, Math.max(0, Math.floor((frame - 6) / 24)));
  const badgeIn = interpolate(frame, [0, 18], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });

  return (
    <SolaceGround>
      <PhoneStack
        videos={[
          staticFile("clips/seat-01-3d.png"),
          staticFile("clips/seat-02-otc.png"),
          staticFile("clips/seat-03-2d.png"),
          staticFile("clips/seat-04-hub.png"),
        ]}
        stagger={24}
        background={PALETTE.bgDeep}
        glowColor={PALETTE.accentEmerald}
        statusColor={PALETTE.parchmentLight}
        time="46631"
      />
      {/* Left/Right Context Rail so the centered 390x844 stack reads with crystal clarity */}
      <AbsoluteFill
        style={{
          justifyContent: "space-between",
          padding: "56px 72px",
          pointerEvents: "none",
          opacity: badgeIn,
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 17,
              fontWeight: 700,
              color: PALETTE.accentMintPill,
              letterSpacing: "0.12em",
            }}
          >
            CROSS-DEVICE WEBSOCKET + MOBILE
          </div>
          <div
            style={{
              marginTop: 10,
              fontFamily: BE_VIETNAM,
              fontSize: 44,
              fontWeight: 700,
              color: C.ink,
              lineHeight: 1.15,
            }}
          >
            Four seats.
            <br />
            <span style={{ color: PALETTE.accentGold }}>Live WebSocket rooms.</span>
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: BE_VIETNAM,
              fontSize: 24,
              fontWeight: 500,
              color: C.muted,
              lineHeight: 1.35,
            }}
          >
            Share a 6-character room code or invite link and bargain live across laptops and phones.
          </div>
        </div>

        <div
          style={{
            alignSelf: "flex-start",
            padding: "14px 26px",
            borderRadius: 999,
            background: C.card,
            border: `1px solid ${C.line}`,
            fontFamily: MONO,
            fontSize: 20,
            fontWeight: 700,
            color: PALETTE.accentGold,
          }}
        >
          ● {SEAT_LABELS[activeIdx]}
        </div>
      </AbsoluteFill>
    </SolaceGround>
  );
}
