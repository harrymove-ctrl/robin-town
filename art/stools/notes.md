# Saigon Town v8 original Aseprite artwork

Everything was drawn and rendered in the installed Aseprite application using native Lua. The stool photograph guided the recognizable construction only; no photograph pixels were sampled or copied. Branding lettering is an original bitmap alphabet drawn by the script, with no external font dependency. The share artwork reuses the project's original Aseprite shop/city art.

## Player markers

- `stool-0.png`: green, base `#39a883`.
- `stool-1.png`: gold, base `#eec353`.
- `stool-2.png`: red, base `#dc6f57`.
- `stool-3.png`: blue, base `#7fb5cf`.

All four are 64×64 transparent PNGs with matching layered `.aseprite` documents. The design has a square ribbed seat, molded rim and inset, a wide front arch, a smaller side arch, rear support visible through the aperture, a lower cross brace, and flared/tapered legs. Five semantic layers separate the rear frame, side, front, seat, and rib details. Strong outlines and open negative space remain readable at 24px and 32px; use `image-rendering: pixelated` in the game.

## App icons and share art

- `app-icon-512.png`: 512×512, gold stool on dark jade, opaque square base so the OS controls the final rounded mask.
- `app-icon-192.png`: 192×192.
- `app-icon-180.png`: 180×180 for Apple home-screen metadata.
- `app-icon-512.aseprite`: layered master.
- `saigon-town-og.png`: 1200×630 Open Graph/social image. Large SAIGON TOWN brand text; three shop sprites, four stools, and a crop of the actual original city board. No tiny game UI or invented screenshot.
- `saigon-town-og.aseprite`: layered master.
- `stool-contact-sheet.png`: 1200×420 review sheet showing 3× marker enlargement, actual 24/32px markers, and app icon.
- `stool-contact-sheet.aseprite`: editable review sheet.

`draw-saigon-v8-assets.lua` redraws all assets through native Aseprite and reuses the existing project shop/city exports. `validate-v8-assets.lua` checks native sprite sizes, clean transparency, exact player colors, and export dimensions. Files are intentionally kept outside the Site checkout for root integration.
