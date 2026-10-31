/**
 * src/ui/diorama-label.ts
 *
 * Pixel-font lot labels for the 3D board. Text is rasterised from a 3x5
 * bitmap font straight into a DataTexture (no DOM or canvas, so it also runs
 * under Node), using exact palette colours and nearest filtering. The board
 * draws these sprites after the diorama post pass, one texel per two CSS
 * pixels, so they stay crisp and on-palette.
 */

import * as THREE from 'three';

/** 3x5 glyphs: one string per row, '#' marks a lit texel. */
const GLYPHS: Record<string, readonly string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  '#': ['#.#', '###', '#.#', '###', '#.#'],
  ' ': ['...', '...', '...', '...', '...'],
  C: ['###', '#..', '#..', '#..', '###'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  P: ['###', '#.#', '###', '#..', '#..'],
  S: ['###', '#..', '###', '..#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
};

/** Palette entries used by the label (background, border, text). */
export const LABEL_COLORS = Object.freeze({
  background: 0x0b0f19,
  border: 0x9ca3af,
  text: 0xf3f4f6,
});

const PAD = 2;

/** Texel size of the label for `text`: glyphs 3 wide, 1 texel apart, plus padding. */
export function labelTextureSize(text: string): [number, number] {
  const n = Math.max(1, text.length);
  return [PAD * 2 + n * 4 - 1, PAD * 2 + 5];
}

/** Rasterise `text` into an RGBA texel array (row 0 is the top row). */
export function rasterizeLabel(text: string): { width: number; height: number; data: Uint8Array } {
  const upper = text.toUpperCase();
  const [width, height] = labelTextureSize(upper);
  const data = new Uint8Array(width * height * 4);
  const put = (x: number, y: number, hex: number) => {
    const i = (y * width + x) * 4;
    data[i] = (hex >> 16) & 255;
    data[i + 1] = (hex >> 8) & 255;
    data[i + 2] = hex & 255;
    data[i + 3] = 255;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      put(x, y, edge ? LABEL_COLORS.border : LABEL_COLORS.background);
    }
  }
  [...upper].forEach((ch, i) => {
    const glyph = GLYPHS[ch] ?? GLYPHS[' '];
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        if (glyph[gy][gx] === '#') put(PAD + i * 4 + gx, PAD + gy, LABEL_COLORS.text);
      }
    }
  });
  return { width, height, data };
}

/** DataTexture of a pixel-font label, nearest-filtered, in sRGB. */
export function createLabelTexture(text: string): THREE.DataTexture {
  const { width, height, data } = rasterizeLabel(text);
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.flipY = false;
  // DataTexture rows start at the bottom; flip so row 0 is the top of the label.
  const flipped = new Uint8Array(data.length);
  const row = width * 4;
  for (let y = 0; y < height; y++) {
    flipped.set(data.subarray(y * row, (y + 1) * row), (height - 1 - y) * row);
  }
  tex.image.data = flipped;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
