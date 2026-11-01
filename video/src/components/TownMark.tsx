import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  interpolate,
} from "remotion";
import { C, GROUND, PALETTE, waitForFonts } from "../theme";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const outCubic = Easing.out(Easing.cubic);
export const inOutCubic = Easing.inOut(Easing.cubic);

export function ramp(frame: number, from: number, span: number, ease = outCubic): number {
  return interpolate(frame, [from, from + Math.max(1, span)], [0, 1], {
    ...CLAMP,
    easing: ease,
  });
}

/** Delays every frame until Bungee, Be Vietnam Pro, Lora, and JetBrains Mono are resident. */
export function FontGate({ children }: { children: ReactNode }) {
  const [handle] = useState(() => delayRender("robin-town-fonts"));
  useEffect(() => {
    waitForFonts().then(
      () => continueRender(handle),
      () => continueRender(handle),
    );
  }, [handle]);
  return <>{children}</>;
}

/** Frame-pure Harbor Forest + SolaceUI exposure-grid lattice backdrop (#112a24). */
export function SolaceGround({ children }: { children?: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: GROUND }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 42%, rgba(44, 165, 109, 0.10) 0%, transparent 62%)",
          pointerEvents: "none",
        }}
      />
      {children}
    </AbsoluteFill>
  );
}

/**
 * Pixel-crisp Harbor Shophouse + Striped Emerald Awning + Bullion Gold $wif Lantern Mark.
 * Uses 100% palette.ts tokens (#102a20, #2ca56d, #39a883, #eec353, #fbf6e8, #dc6f57).
 */
export function TownMark({ size = 84 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* Rounded emerald-rimmed badge */}
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="14"
        fill={PALETTE.bgHudDark}
        stroke={PALETTE.accentEmerald}
        strokeWidth="2.5"
      />
      {/* Terracotta pitched shophouse roof */}
      <path d="M12 22 L32 10 L52 22 Z" fill={PALETTE.accentGold} />
      <rect x="15" y="22" width="34" height="4" fill={PALETTE.wood} />
      {/* Striped neighborhood street awning */}
      <path d="M13 26 H51 L54 34 H10 Z" fill={PALETTE.accentEmerald} />
      <path d="M19 26 H25 L26 34 H18 Z" fill={PALETTE.parchmentLight} />
      <path d="M31 26 H37 L37 34 H31 Z" fill={PALETTE.parchmentLight} />
      <path d="M43 26 H49 L50 34 H44 Z" fill={PALETTE.parchmentLight} />
      {/* Warm lit shophouse facade & doorway */}
      <rect x="16" y="34" width="32" height="19" rx="2" fill={PALETTE.bgFelt} stroke={C.lineSolid} strokeWidth="1.5" />
      <rect x="26" y="38" width="12" height="15" rx="1.5" fill={PALETTE.accentGold} />
      <rect x="19" y="38" width="5" height="7" rx="1" fill={PALETTE.accentMintPill} />
      <rect x="40" y="38" width="5" height="7" rx="1" fill={PALETTE.accentMintPill} />
      {/* Glowing coral lantern */}
      <circle cx="50" cy="40" r="3.2" fill={PALETTE.accentCoral} />
    </svg>
  );
}
