# VietnamTown original Aseprite materials

All PNG assets were hand specified as pixel primitives in `draw-materials.lua`, then rendered and saved by the installed Aseprite application. No generated images, stock images, or SVG conversion were used. Native editable `.aseprite` source files accompany every asset. `materials-atlas.aseprite` is a layered collection with a separate named layer per asset.

| Asset | Native size | Description |
| --- | --- | --- |
| token-0.png | 32 × 32 | Jade plastic ownership disc, #39a883 face |
| token-1.png | 32 × 32 | Gold plastic ownership disc, #eec353 face |
| token-2.png | 32 × 32 | Coral plastic ownership disc, #dc6f57 face |
| token-3.png | 32 × 32 | Sky plastic ownership disc, #7fb5cf face |
| plot-ground.png | 64 × 64 | Stone curb and quiet earth center for readable lot number |
| street-texture.png | 64 × 64 | Seamless muted pine road texture |
| calendar-wheel.png | 192 × 192 | Six-segment wooden calendar with brass rim and six animal insets |
| zodiac-snake.png | 32 × 32 | Tỵ |
| zodiac-horse.png | 32 × 32 | Ngọ |
| zodiac-goat.png | 32 × 32 | Mùi |
| zodiac-monkey.png | 32 × 32 | Thân |
| zodiac-rooster.png | 32 × 32 | Dậu |
| zodiac-dog.png | 32 × 32 | Tuất |

Render assets with `image-rendering: pixelated`; keep whole-number scale where possible. The road and lot are opaque. The counters, calendar, and separate zodiac animals have transparent backgrounds.

Calendar geometry: 192 × 192; wheel center (95.5, 95.5), open center radius 43 px, medallion center radius 68 px. Starting at twelve o'clock and proceeding clockwise, the six positions are Tỵ, Ngọ, Mùi, Thân, Dậu, Tuất. Approximate medallion centers in pixels: (96,28), (154,62), (154,130), (96,164), (37,130), (37,62). Add the year text, Vietnamese labels, and current-year highlight in accessible HTML. There is intentionally no text baked into the images.

`materials-atlas.png` is the original-size contact sheet. `contact-sheet.png` is its 3× nearest-neighbor enlargement for inspection.
