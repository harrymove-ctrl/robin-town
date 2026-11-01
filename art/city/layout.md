# Saigon city board

Original 1100 × 730 pixel artwork painted and exported through installed Aseprite's native Lua image API. This is fictional Saigon-inspired city geography, with a crooked central boulevard, curving western park road, a river promenade, market rooftops and cafés. No source photograph or AI image is used.

Files:
- `saigon-city-board.png`: final full-resolution map background.
- `saigon-city-board.aseprite`: nine named painting layers, preserving all original artwork.
- `draw-city-board.lua`: reproducible source; `OUT` is the only destination setting.

Use the PNG at world coordinates (0, 0), width 1100, height 730. Place gameplay plots over these exact unoccupied stone-paving envelopes. Each has four columns × three rows at 58px pitch; root's proposed 56px tiles leave a 2px seam.

| District index | x | y | Width | Height |
| --- | --- | --- | --- | --- |
| 0 | 85 | 100 | 232 | 174 |
| 1 | 394 | 73 | 232 | 174 |
| 2 | 735 | 125 | 232 | 174 |
| 3 | 144 | 451 | 232 | 174 |
| 4 | 454 | 400 | 232 | 174 |
| 5 | 783 | 475 | 232 | 174 |

Landmark overlay clearings are nearby, but keep sprites small enough not to obscure lots, curbs or crossings. Approximate useful centers (for ~48–64px displayed landmarks) are (300, 288), (643, 185), (720, 90), (153, 423), (704, 448), (976, 419); a landmark can instead sit just above its district envelope as part of a labeled plaque.

Vehicle routes: use SVG or CSS motion paths on these centerlines, ideally with lane offset 6–9px to prevent two-way collisions. For a facing-right sprite, sprite rotation may need an offset when following curves.

- Main boulevard: `M -30 355 L 180 339 L 333 331 L 512 333 L 684 348 L 845 364 L 990 390 L 1130 421`.
- Outer park road: `M 30 -10 L 30 85 L 39 220 L 48 285 L 70 324 L 90 352 L 107 379 L 111 420 L 100 480 L 96 580 L 112 645 L 165 685 L 310 700 L 506 699 L 704 688 L 876 683 L 1039 676`.
- Upper avenue: `M -20 45 L 355 40 L 664 44 L 861 55 L 1090 70`.
- West connector: `M 355 38 L 348 134 L 346 243 L 333 331`.
- East connector: `M 680 45 L 681 172 L 694 260 L 684 348`.
- Southwest connector: `M 391 333 L 402 409 L 411 510 L 414 604 L 432 699`.
- Southeast connector: `M 729 353 L 730 447 L 734 549 L 750 686`.
- Riverside road: `M 1024 65 L 1020 200 L 1030 305 L 1046 402 L 1047 499 L 1040 588 L 1039 676 L 1052 745`.

Visible zebra-crossing centers (x, y) and pedestrian direction: (316,303) horizontal; (368,334) vertical; (428,338) vertical; (670,319) horizontal; (734,391) horizontal; (1027,370) horizontal; (407,443) horizontal; (112,427) horizontal; (707,690) vertical. Each crossing is roughly 40px long. The eastbound bus lay-by sits near (879, 398).

Validation: exported natively in Aseprite, visually inspected the resulting PNG, confirmed all six exact plot envelopes remain clear. Background intentionally stays muted so gameplay shop pieces and ownership tokens remain strongest on top.
