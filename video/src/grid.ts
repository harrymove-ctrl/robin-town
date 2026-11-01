// 120 BPM @ 30 fps musical clock:
//   1 beat = 0.50s = 15 frames
//   1 bar  = 2.00s = 60 frames
export const BPM = 120;
export const FPS = 30;
export const BEATS_PER_BAR = 4;

export const framesPerBeat = Math.round((60 / BPM) * FPS); // 15
export const framesPerBar = framesPerBeat * BEATS_PER_BAR; // 60

export const beats = (n: number): number => Math.round(n * framesPerBeat);
export const bars = (n: number): number => Math.round(n * framesPerBar);

export interface BeatSpan {
  from: number;
  frames: number;
}

/** Lay out bar lengths back to back into { from, frames, total } on exact bar boundaries. */
export function layout<K extends string>(lengths: readonly (readonly [K, number])[]) {
  const scenes = {} as Record<K, BeatSpan>;
  let cursor = 0;
  for (const [key, barCount] of lengths) {
    const f = bars(barCount);
    scenes[key] = { from: cursor, frames: f };
    cursor += f;
  }
  return { scenes, total: cursor };
}
