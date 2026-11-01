# Saigon Town — original Aseprite shop sprites

Six original 96 × 96 transparent RGBA shop sprites. All drawing was authored as deliberate integer-coordinate pixel marks in `draw-shops.lua` and executed by the installed Aseprite binary. No source photograph was traced, imported into the artwork, or used as a texture; no image-generation tool was used.

Each `.png` has a corresponding editable native `.aseprite` document with six or seven named layers. The source includes ground/shadow, plaster/timber, tile roof, shopfront fixtures, shop goods, and finishing details. `contact-sheet.png` was assembled and enlarged using Aseprite itself.

| File | Shop | Distinguishing details |
| --- | --- | --- |
| coffee.png | Cà phê | Metal phin filters, coffee cups, low blue stools, lanterns |
| banhmi.png | Bánh mì | Striped canopy, glass baguette cart, wheels, herb crate |
| pho.png | Phở | Stockpot, curling steam, soup bowls, chopsticks, red stools |
| flowers.png | Tiệm hoa | Flower buckets, clustered blossoms, hanging planter, climbing vine |
| tailor.png | Tiệm may | Áo dài, dress form, sewing machine, balcony, fabric rolls |
| grocery.png | Tạp hóa | Tins, bottles, hanging packets, rice sacks, produce crates |

## Visual research

- [Vietnam Tourism: The secret art of Vietnamese coffee](https://www.vietnam.travel/things-to-do/secret-art-vietnamese-coffee) — phin filter and street coffee enjoyed on tiny stools.
- [Vietnam Tourism: 7 superb bánh mì to try in Vietnam](https://www.vietnam.travel/things-to-do/banh-mi-in-vietnam) — the baguette and varied street-food fillings.
- [Vietnam Tourism: The story of Vietnamese phở](https://vietnam.travel/node/125) — sidewalk kitchens, steam, broth, noodles, herbs, and bowls assembled to order.
- [Vietnam Tourism: Explore the Old Quarter your way](https://www.vietnam.travel/things-to-do/explore-old-quarter-your-way) — narrow shopfronts, sidewalk trade, flower and fruit vendors, and coffee shops.
- [Vietnam Tourism: The shopaholic’s guide to Hội An](https://beta-v2.vietnam.travel/things-to-do/shopaholics-guide-hoi) — traditional shop setting and local craft retail context.
- [Tuổi Trẻ News: How Anthony Bourdain changed the fate of a bánh mì stall in Hội An](https://news.tuoitre.vn/how-anthony-bourdain-changed-fate-of-banh-mi-stall-in-vietnams-hoi-an-10374756.htm) — image reference for the glass food display and fresh ingredient arrangement.
- [The Happy Tailor](https://thehappytailor.com/) — local shop photographic context for tailoring and garment retail.

The coral and ochre tiled roofs, warm plaster, restrained teal trim, exact shapes, composition, and boardgame proportions are original art direction, not a reconstruction of any individual photographed shop.

## Aseprite execution

Binary: `/Users/thohong/Library/Application Support/Steam/steamapps/common/Aseprite/Aseprite.app/Contents/MacOS/aseprite`

Execution arguments: `--batch --script /private/tmp/vietnamtown-shops/draw-shops.lua`

API references used: [Image](https://www.aseprite.org/api/image), [Sprite](https://www.aseprite.org/api/sprite), [Layer](https://aseprite.org/api/layer), [CLI](https://aseprite.app/docs/cli/).

Use `image-rendering: pixelated` for browser scaling. Keep the full 96 × 96 canvas: all six share the same approximate ground baseline. Transparent edge pixels are alpha 0; the ground shadow alone uses a fixed partial-alpha color.
