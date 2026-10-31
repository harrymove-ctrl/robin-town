/**
 * src/ui/diorama-palette.ts
 *
 * Robin-Town's 64-colour sRGB palette for the diorama look contract
 * (docs/diorama-kit/templates/palette.js). The 3D board is quantised to these
 * values after an 8x8 ordered dither. Keep the length at exactly 64: the
 * post-processing shader declares vec3[64].
 *
 * Layout: night-city neutrals and warm ink, then a dark / base / light ramp for
 * each district accent and protocol-shop colour, then gold, harbor water and
 * highlight accents.
 */

export const PALETTE_HEX: readonly string[] = Object.freeze([
  '#05070d',
  '#0b0f19',
  '#111827',
  '#161d2b',
  '#1f2937',
  '#2d3748',
  '#3f4a5c',
  '#4b5563',
  '#6b7280',
  '#9ca3af',
  '#d1d5db',
  '#f3f4f6',
  '#15140f',
  '#2a2620',
  '#e8dcc0',
  '#005a02',
  '#00c805',
  '#61dd64',
  '#6b5825',
  '#eec353',
  '#f4da94',
  '#12526f',
  '#29b6f6',
  '#7ad2f9',
  '#4d2055',
  '#ab47bc',
  '#cb8dd5',
  '#73321e',
  '#ff7043',
  '#ffa68a',
  '#283845',
  '#587c9a',
  '#97aec0',
  '#1a4c3b',
  '#39a883',
  '#84c9b2',
  '#53261a',
  '#b85539',
  '#d39684',
  '#482d3c',
  '#a16586',
  '#c5a0b4',
  '#2d3b26',
  '#648454',
  '#9fb395',
  '#8a6d00',
  '#c9a100',
  '#ffd700',
  '#fff0a0',
  '#0b3a4a',
  '#0f5a6e',
  '#1b7f95',
  '#39a9bd',
  '#8fdbe6',
  '#00a8b3',
  '#00f0ff',
  '#ef4444',
  '#a855f7',
  '#ff3b5c',
  '#7c3aed',
  '#fbbf24',
  '#34d399',
  '#ffe4a8',
  '#1e3a5f',
]);

export const PALETTE_SIZE = 64;

export type RGB = readonly [number, number, number];

/** Palette as 0..1 sRGB triples. */
export const PALETTE_RGB: readonly RGB[] = Object.freeze(
  PALETTE_HEX.map((hex): RGB => {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  })
);

/** Channel weights used by the shader's nearest-colour search (green heavy, blue light). */
export const SNAP_WEIGHTS: RGB = [1.0, 1.12, 0.93];

/**
 * CPU mirror of the shader's nearest palette search. Used by tests and by the
 * QA tooling to check that rendered pixels land on palette entries.
 */
export function snapToPalette(rgb: RGB): RGB {
  let best = PALETTE_RGB[0];
  let bestDistance = Infinity;
  for (const candidate of PALETTE_RGB) {
    const dr = (rgb[0] - candidate[0]) * SNAP_WEIGHTS[0];
    const dg = (rgb[1] - candidate[1]) * SNAP_WEIGHTS[1];
    const db = (rgb[2] - candidate[2]) * SNAP_WEIGHTS[2];
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/** True when the 0..255 colour is exactly one of the palette entries. */
export function isPaletteColor(r: number, g: number, b: number): boolean {
  const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  return PALETTE_HEX.includes(hex);
}
