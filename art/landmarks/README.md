# Saigon Town neighborhood landmarks

Six original 96 × 96 pixel-art designs, created from explicit pixel coordinates using the installed Aseprite application's native Lua `Image:drawPixel`, `Sprite:newLayer`, and `Sprite:newCel` APIs. No image-generation model, downloaded artwork, tracing, or raster conversion was used. All sprites are fictional interpretations for a board game, not architectural records.

Each landmark has a transparent PNG and an editable `.aseprite` source with four painting layers: ground, architecture, feature details, and neighborhood life. The editable atlas preserves all 24 painting layers. The atlas is 288 × 192, in three columns and two rows. Use nearest-neighbor sampling / `image-rendering: pixelated` and preferably integer scaling.

| File | Design | Atlas origin |
| --- | --- | --- |
| `tan-dinh.png` | Pink church with tall bell tower, cross, arched openings and side chapels | 0, 0 |
| `ben-thanh.png` | Ochre market with entrance clock tower and tiled hall roof | 96, 0 |
| `thao-dien.png` | Riverside villas, palm trees and a terrace | 192, 0 |
| `cho-lon.png` | Hoa commercial heritage through a tiled market gateway, lanterns and trading crates | 0, 96 |
| `binh-thanh.png` | Bà Chiểu inspired market frontage, produce awnings and a scooter | 96, 96 |
| `phu-nhuan.png` | Compact houses, leafy alley, laundry and a parked scooter | 192, 96 |

The four optional transparent 48 × 48 props are `palm.png`, `tree.png`, `scooter.png`, and `street-stall.png`; each includes its own native source. `contact-sheet.png` is a labeled 3× enlarged presentation. `draw-landmarks.lua` is the full reproducible drawing source.

## Reference grounding

These official tourism sources informed the identifying motifs; no source imagery is included in the artwork:

- [Official HCMC Tourism: Tân Định, the pink church](https://visithcmc.net/en/news/kham-pha-nha-tho-tan-dinh-net-hong-doc-dao-dep-nhat-sai-gon) — distinctive pink exterior and three principal architectural sections.
- [Vietnam National Authority of Tourism: Tân Định Church](https://vietnamtourism.gov.vn/en/printer/12450?type=1) — French-influenced architecture and nearby market setting.
- [Official HCMC Tourism: Bến Thành Market](https://visithcmc.net/en/news/kham-pha-cho-ben-thanh-diem-den-khong-the-bo-qua-o-tp-ho-chi-minh) — entrance clock tower.
- [Official HCMC Tourism: major markets](https://visithcmc.net/news/top-nhung-khu-cho-lon-nhat-o-hcm) — Bình Tây / Chợ Lớn's market and East Asian architecture.
- [Official HCMC Tourism: night markets](https://visithcmc.net/en/news/kham-pha-9-khu-cho-dem-noi-tieng-o-tphcm) — Bà Chiểu's Bình Thạnh location, street food and market trade; Bình Tây's Hoa commercial community.
- [Vietnam Tourism: Ho Chi Minh City](https://vietnam.travel/places-to-go/southern-vietnam/ho-chi-minh-city) — wider city setting.

Thảo Điền and Phú Nhuận are interpretive neighborhood composites from the design brief, rather than replicas of a sourced building. All six names are board-game neighborhood labels, not a claim about current administrative boundaries.

Palette: dark teal `#183d3c` outlines, ochre `#d9a55a`, terracotta `#d96c49`, cream `#f8e8b9`, pink `#ee6f9f`, jade `#397a57`, and muted aqua `#79bdb0`. Solid pixels have full opacity; the small ground shadow uses alpha 65. The common ground baseline is around y=84, with perspective/shadow/river pixels extending slightly below it.
