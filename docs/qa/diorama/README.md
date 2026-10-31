# Diorama look contract (issue #1)

Open the game with `?view=3d` (or press `V`) to get the diorama board. `?post=off` turns the post pass off.

## What is implemented

| Contract item | Where |
| --- | --- |
| Three-quarter slab at azimuth 45 deg, elevation 33 deg (orthographic block extrusion, framed to the slab at any aspect) | `board-3d.ts` (`orthoFrustumHeight`) |
| One cut-out base slab, bevelled district curbs, recessed harbor channel with quay walls | `diorama-detail.ts` (`buildBaseSlab`, `buildDistrictCurb`) |
| 64-colour palette (`PALETTE_HEX`), nearest-colour snap | `diorama-palette.ts`, `diorama-post.ts` |
| Contour ink mixed toward warm near-black at 0.62 | `diorama-post.ts` (`INK_STRENGTH`) |
| 8x8 ordered Bayer dither gated to tonal transitions, flat areas get none | `diorama-post.ts` |
| Nearest-neighbour upscale (render at half size, `image-rendering: pixelated`) | `diorama-post.ts`, `board-3d.ts` |
| 3-pass storefront detail for all 6 protocols (silhouette, assemblies, story detail) | `diorama-detail.ts` (`addStorefrontDetail`) |
| Contact shadows under every parcel token / deed sign and every building | `diorama-detail.ts` (`createContactShadow`), `board-3d.ts` |
| Bridges between connected same-type shops, animated golden border when `cluster.isComplete` | `board-3d.ts` (`rebuildClusterVisuals`) |
| `window.__diorama = { freeze(t), getState(), renderAt(t), projectLot(id) }` and `window.__dioramaReady` | `app.ts`, `board-3d.ts` |

The kit palette (`docs/diorama-kit/templates/palette.js`) is tuned for a pool scene, so Robin-Town uses its own
64 colours with the same structure: night-city neutrals and warm ink, a dark / base / light ramp for each district
accent and protocol colour, gold, harbor water and highlight accents.

## How it was checked

Unit tests (`tests/unit/diorama.test.ts`): palette is exactly 64 unique colours, every shop has pass-2 and pass-3
detail and keeps its props inside the 48-unit parcel, slab / curb / harbor structure, and all 72 parcels are hit at
their projected centres.

Browser check (`public/qa/diorama-check.js`), run against the live game:

```js
const { check } = await import('/qa/diorama-check.js');
console.table(await check());
```

Results at 1440x900, 1280x800 and 768x1024: hook present, post pass active at pixel size 2, 100% of rendered pixels are
palette colours, single-pixel speckle about 0.13%, `freeze(t)` is pixel-identical when repeated, and 72 of 72 parcels
are picked by real pointer events on the pixelated canvas.

## Screenshots

- `board-1440.jpg`: staged state with a complete DEX Swap cluster, an incomplete Memecoin pair, deed candidates and a selected lot.
- `cluster-closeup.jpg`: the same state, zoomed on the completed cluster (gold rings, parcel borders, bridges).
- `board-tablet-768.jpg`: a live game at tablet size under the HUD.
