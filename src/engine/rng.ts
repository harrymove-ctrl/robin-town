/**
 * src/engine/rng.ts
 *
 * Deterministic random sources for reproducible matches (QA screenshots,
 * replays). Gameplay defaults to Math.random; pass a seeded source to
 * createGame / draftPlots / nextYear to get the same deal every time.
 */

import type { RandomSource } from './types';

/** mulberry32: tiny, fast, well-distributed 32-bit PRNG returning [0, 1). */
export function createSeededRandom(seed: number): RandomSource {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Reads `?seed=<n>` from a query string. Returns null when absent or not an
 * integer, so callers fall back to Math.random.
 */
export function parseSeedParam(search: string): number | null {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}
