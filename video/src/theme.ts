import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";
import { staticFile } from "remotion";
import type { SnapCnTheme } from "@/lib/snap-cn-ui";
import { C, DITHER, DITHER_CELL, GROUND, PALETTE } from "./palette";

export { C, DITHER, DITHER_CELL, GROUND, PALETTE };

export const BUNGEE_FAMILY = "Robin Bungee";
export const BE_VIETNAM_FAMILY = "Robin Be Vietnam Pro";
export const LORA_FAMILY = "Robin Lora";

export const BUNGEE = `"${BUNGEE_FAMILY}", sans-serif`;
export const BE_VIETNAM = `"${BE_VIETNAM_FAMILY}", sans-serif`;
export const LORA = `"${LORA_FAMILY}", Georgia, serif`;

const monoLoaded = loadJetBrainsMono("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});
export const MONO = monoLoaded.fontFamily;

let localFontsPromise: Promise<unknown> | null = null;

function ensureLocalBrandFonts(): Promise<unknown> {
  if (localFontsPromise) return localFontsPromise;
  if (typeof FontFace === "undefined" || typeof document === "undefined") {
    localFontsPromise = Promise.resolve();
    return localFontsPromise;
  }
  const faces = [
    new FontFace(BUNGEE_FAMILY, `url(${staticFile("fonts/bungee.ttf")})`, {
      weight: "400",
      style: "normal",
    }),
    new FontFace(BE_VIETNAM_FAMILY, `url(${staticFile("fonts/be-vietnam-regular.ttf")})`, {
      weight: "400 500",
      style: "normal",
    }),
    new FontFace(BE_VIETNAM_FAMILY, `url(${staticFile("fonts/be-vietnam-bold.ttf")})`, {
      weight: "600 800",
      style: "normal",
    }),
    new FontFace(LORA_FAMILY, `url(${staticFile("fonts/lora.ttf")})`, {
      weight: "400 700",
      style: "normal",
    }),
  ];
  for (const f of faces) {
    document.fonts.add(f);
  }
  localFontsPromise = Promise.all(faces.map((f) => f.load().catch(() => undefined)));
  return localFontsPromise;
}

export const waitForFonts = (): Promise<unknown> =>
  Promise.all([ensureLocalBrandFonts(), monoLoaded.waitUntilDone()]);

/** Robin-Town's Saigon Forest + Emerald + Bullion Gold theme passed to SnapCnUIProvider. */
export const ROBIN_THEME: Partial<SnapCnTheme> = {
  background: PALETTE.bgDeep,
  foreground: PALETTE.parchmentLight,
  card: PALETTE.bgHudDark,
  cardForeground: PALETTE.parchmentLight,
  popover: PALETTE.bgHudDark,
  popoverForeground: PALETTE.parchmentLight,
  primary: PALETTE.accentEmerald,
  primaryForeground: PALETTE.bgCityStage,
  secondary: PALETTE.bgFelt,
  secondaryForeground: PALETTE.parchmentWarm,
  muted: PALETTE.bgFelt,
  mutedForeground: PALETTE.inkMuted,
  accent: PALETTE.accentGold,
  accentForeground: PALETTE.bgCityStage,
  destructive: PALETTE.accentCoral,
  destructiveForeground: PALETTE.parchmentLight,
  border: PALETTE.borderEmerald,
  input: PALETTE.borderEmerald,
  ring: PALETTE.accentEmerald,
  radius: 12,
  fontFamily: BE_VIETNAM,
};
