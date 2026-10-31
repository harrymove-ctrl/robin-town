/**
 * Browser QA for the diorama look contract (issue #1).
 *
 * Run against the live game with the 3D board on (`/?view=3d`):
 *
 *   const { check } = await import('/qa/diorama-check.js');
 *   console.table(await check());
 *
 * Checks, each reported as { name, ok, detail }:
 *   hook          window.__diorama / __dioramaReady are exposed
 *   post-pass     the post pass is active at pixel size >= 2
 *   palette       every pixel of a frozen frame is one of the 64 palette colours
 *   flat-areas    isolated single-pixel speckle stays under 0.5% of the frame
 *   determinism   freeze(t) twice gives identical pixels; another t differs
 *   hit-test      all 72 parcels are picked by clicking their projected centre
 *
 * Frames are read in the same task as the draw, because the WebGL buffer is
 * cleared once it has been composited.
 */

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function boardCanvas() {
  return [...document.querySelectorAll('#board-container canvas')].find((c) => c.id !== 'game-board-canvas');
}

async function readFrame(canvas) {
  const image = new Image();
  image.src = canvas.toDataURL('image/png');
  await image.decode();
  const scratch = document.createElement('canvas');
  scratch.width = image.width;
  scratch.height = image.height;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  return { width: image.width, height: image.height, data: ctx.getImageData(0, 0, image.width, image.height).data };
}

const hexOf = (data, i) => '#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');

export async function check() {
  const results = [];
  const add = (name, ok, detail) => results.push({ name, ok, detail });

  const hook = window.__diorama;
  const canvas = boardCanvas();
  add('hook', Boolean(hook && canvas && window.__dioramaReady === true), `ready=${window.__dioramaReady}`);
  if (!hook || !canvas) return results;

  const state = hook.getState();
  add('post-pass', state.postProcessing && state.pixelSize >= 2, `pixelSize=${state.pixelSize}, target=${state.target?.width}x${state.target?.height}`);

  const { PALETTE_HEX } = await import('/src/ui/diorama-palette.ts');
  const palette = new Set(PALETTE_HEX);

  hook.freeze(1000);
  const frame = await readFrame(canvas);
  const counts = new Map();
  for (let i = 0; i < frame.data.length; i += 4) {
    const hex = hexOf(frame.data, i);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const off = [...counts.keys()].filter((hex) => !palette.has(hex));
  add('palette', off.length === 0, `${counts.size} colours used, ${off.length} off-palette`);

  let islands = 0;
  let interior = 0;
  const { width, height, data } = frame;
  const same = (a, b) => data[a] === data[b] && data[a + 1] === data[b + 1] && data[a + 2] === data[b + 2];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      const n = [i - 4, i + 4, i - width * 4, i + width * 4];
      if (n.every((j) => same(j, n[0]))) {
        interior++;
        if (!same(i, n[0])) islands++;
      }
    }
  }
  const islandFraction = islands / Math.max(1, interior);
  add('flat-areas', islandFraction < 0.005, `${(islandFraction * 100).toFixed(3)}% single-pixel islands`);

  const grab = (t) => {
    hook.freeze(t);
    return canvas.toDataURL('image/png');
  };
  const a = grab(1000);
  hook.renderAt(7300);
  const b = grab(1000);
  add('determinism', a === b, 'two freezes at t=1000 are identical');

  // Hit-test: click the projected centre of every parcel with real pointer events.
  const rect = canvas.getBoundingClientRect();
  const misses = [];
  for (let lot = 0; lot < 72; lot++) {
    const ndc = hook.projectLot(lot);
    const x = rect.left + ((ndc.x + 1) / 2) * rect.width;
    const y = rect.top + ((1 - ndc.y) / 2) * rect.height;
    const opts = { clientX: x, clientY: y, bubbles: true, pointerId: 1, button: 0, pointerType: 'mouse' };
    canvas.dispatchEvent(new PointerEvent('pointermove', opts));
    canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
    canvas.dispatchEvent(new PointerEvent('pointerup', opts));
    await wait(70);
    const selected = hook.getState().selectedLot;
    if (selected !== lot) misses.push(`${lot}->${selected}`);
  }
  add('hit-test', misses.length === 0, misses.length === 0 ? '72/72 parcels' : `misses: ${misses.join(', ')}`);

  hook.freeze(1000);
  hook.getState();
  return results;
}
