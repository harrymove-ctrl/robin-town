# Saigon Town street life

Original pixel-coordinate drawings executed and exported using the installed Aseprite application and its native Lua image, layer, cel and frame APIs. All PNGs use transparent backgrounds and the existing warm Saigon Town palette. No AI-generated image was used.

| Export | Native size | Notes |
| --- | --- | --- |
| `ninja-lead.png` | 48 × 48 | Right-facing scooter with visible driver: gold helmet, eye opening, pink hood/face cover, gloves and long sun skirt. Four editable layers. |
| `city-bus.png` | 72 × 40 | Right-facing green/cream city bus; driver, passenger, four windows and split door. Four editable layers. |
| `pedestrian-walk.png` | 96 × 32 | Four horizontal frames, each 24 × 32, facing right. Frame timing 160 ms; loop 640 ms. |
| `pedestrian.png` | 24 × 32 | Walking frame 1 for static/fallback use. |
| `game-banknote.png` | 48 × 24 | Fictional teal game money with original lotus ornament and a small 10 đ mark; no real banknote artwork. Three editable layers. |
| `contact-sheet.png` | 1024 × 576 | Nearest-neighbor enlarged review sheet. |

The `pedestrian-walk.aseprite` file is the editable animated original with five semantic layers and a `walk` tag. `pedestrian-walk-sheet.aseprite` is its flattened sheet layout. Other PNGs have matching layered `.aseprite` originals. Run `draw-street-life.lua` with Aseprite `--batch --script` to reproduce all files (its output directory is declared at the top).

Use `image-rendering: pixelated` and whole-number output dimensions. The walking sheet can be displayed with a 24 × 32 viewport, `background-size: 96px 32px`, and a 640 ms `steps(4)` animation from background-position `0 0` to `-96px 0`. Multiply every dimension equally for 2× or 3× rendering. Flip a wrapper horizontally for left-facing traffic, leaving the inner sprite-frame animation unchanged. Motion paths should belong to a separate outer wrapper.

These fictional assets depict ordinary Saigon street life; they do not claim to reproduce a particular vehicle brand, transport route, or real banknote.
