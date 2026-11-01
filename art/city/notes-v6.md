# Saigon v6: corrected crossings and district sign icons

All artwork was drawn and exported in the installed Aseprite application through native Lua. No AI imagery or external art was used. Sources and exports are exclusively under `/private/tmp/saigon-v6-art`.

## Board

- `saigon-city-board-v6.png`: final 1100 × 730 board.
- `saigon-city-board-v6.aseprite`: layered editable board.
- `draw-city-board-v6.lua`: repeatable drawing source.
- `crossings-v6.json`: centers, directions, and sidewalk-to-sidewalk pedestrian routes.

The six irregular plot regions, their unused corner buildings/courtyards, and nameplate bands are pixel-identical to v4. Roads, river, park, and existing architecture retain their geometry. Old ladder-shaped crossings were removed. New zebra markings have 16px-long cream stripes running **parallel to vehicle travel**, spaced **across** the width of each road. Pedestrians move perpendicular to traffic. The road center dash is cleared under every crossing, small approach stop lines flank it, and paired traffic lights sit beside its curb ends.

The park crossing is now centered on the vertical road at (110.7,417), with vertical stripe long axes, and pedestrian travel from approximately (131.1,415) to (90.3,419). Junction crossings elsewhere follow their local road slopes instead of forcing horizontal/vertical rectangles onto curved streets.

Pedestrian endpoints below are ground-contact/feet coordinates, not image top-left positions.

| Crossing | Center | Start → end |
|---|---|---|
| park | [110.7, 417] | [131.1, 415.01] → [90.3, 418.99] |
| tan-dinh-south | [336.8, 305] | [356.59, 307.92] → [317.01, 302.08] |
| market-west | [362, 331.3] | [362.28, 305.8] → [361.72, 356.8] |
| garden-east | [397, 374.5] | [416.79, 371.64] → [377.21, 377.36] |
| river-market-north | [687.4, 318] | [708.27, 320.37] → [666.53, 315.63] |
| binh-thanh-east | [729.4, 390] | [750.4, 389.78] → [708.4, 390.22] |
| riverside-north | [1041.7, 376] | [1059.95, 372.99] → [1023.45, 379.01] |
| riverside-west | [1007, 393.8] | [1012.51, 368.9] → [1001.49, 418.7] |
| south-market | [710, 687.8] | [709.4, 667.31] → [710.6, 708.29] |

## Transparent sign icons

The six final PNGs are exactly 32 × 32, one opaque warm-cream ink (`#f1e1b7`) and fully transparent negative space. They have no square backing and no antialiasing. Display on the existing dark green sign at 24px or 32px with pixelated image rendering.

- `icons/tan-dinh-v6.png`: church and cross.
- `icons/ben-thanh-v6.png`: central clock tower and market wings.
- `icons/thao-dien-v6.png`: leaf, riverside villa, and water.
- `icons/cho-lon-v6.png`: traditional market gate.
- `icons/binh-thanh-v6.png`: broad market roof and open colonnade.
- `icons/phu-nhuan-v6.png`: shade tree and alley house.

Each icon has a matching layered `.aseprite` source. `draw-district-icons-v6.lua` is the repeatable source. `icons/district-sign-icons-preview-v6.png` is a review-only atlas on a dark green background; ship the six transparent individual PNGs rather than the atlas. `validate-v6.lua` verifies protected gameplay pixels and icon dimensions/color/transparency.
