# Saigon Town: irregular city board v4

Original pixel art painted and exported with the installed Aseprite application through native Lua. No AI image service or external artwork was used. The .aseprite document keeps terrain, river, blocks, parks, streets, crossings, outer architecture, vegetation, irregular foundations, corner architecture, and clear nameplate backing in separate layers.

Deliverables:
- `saigon-city-board-v4.png`: final 1100 × 730 game background.
- `saigon-city-board-v4.aseprite`: editable layered source.
- `draw-city-board-v4.lua`: repeatable native Aseprite drawing script.
- `geometry-overlay-preview.png`: review-only background with the existing ground tile superimposed on the exact new coordinates. Do not ship it as the background.
- `preview-geometry.lua`: repeatable preview script.

Each district has exactly 12 connected plots. Plot cells are 50 × 50 at a 52px pitch. Layout uses zero-based row/column coordinates:

| District | Origin | Columns per row (rows 0–3) |
| --- | --- | --- |
| Tân Định | 92,100 | 1 2 3 / 0 1 2 3 / 0 1 2 / 0 1 |
| Bến Thành | 399,105 | 0 1 / 0 1 2 / 0 1 2 3 / 1 2 3 |
| Thảo Điền | 747,120 | 0 1 2 / 0 1 2 / 0 1 2 3 / 2 3 |
| Chợ Lớn | 156,439 | 1 2 / 1 2 3 / 0 1 2 / 0 1 2 3 |
| Bình Thạnh | 464,404 | 0 1 2 3 / 0 1 2 / 0 1 / 0 1 2 |
| Phú Nhuận | 796,451 | 1 2 3 / 0 1 2 3 / 0 1 / 0 1 2 |

The 210 × 29 district-nameplate bands begin at `origin.x, origin.y - 35`. They intentionally contain no text or landmarks. Existing road centerlines, riverside route, park, crosswalks, and traffic paths are unchanged. Some roof clusters were removed where the expanded four-row plot area or label band overlaps them. Missing corners contain tube-house roofs, terraces, or planted courtyards. The union of occupied cell foundations receives a stepped stone curb so nonplayable space reads as real architecture rather than gaps in a rectangular panel.

Roads were darkened moderately and curbs lightened, while city stone remains quiet behind the actual game pieces. This is fictional Saigon-inspired city scenery rather than a geographic map.
