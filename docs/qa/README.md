# Browser QA for the HUD and OTC desk overhaul (issue #4)

## Screenshots

`before/` is the `feat/issue-2-gameplay` branch (HUD before this change), captured at 1440x900 with random deals.

`after/<viewport>/` is `main` after #2, #4, #1 and #7 merged, captured at **1440x900, 1280x800 and 768x1024**
with `?seed=42`, so every run deals the same deeds and produces the same winner. The viewport was set with
DevTools device emulation (exact CSS pixels, DPR 1). Each viewport follows the same scripted sequence:

1. Fresh match (`/?seed=42`): `board.jpg`, Board with the deed tray.
2. Quick Draft (`Q`), click Apex in the ribbon to open the desk: `otc-desk.jpg`.
3. Close the desk, open the wallet pill: `wallet-modal.jpg` (simulation mode).
4. Auto-play epochs 1 to 6 (`Q` to draft, `Space` to advance, dismiss summaries/proposals): `settlement-epoch6.jpg`.

## Layout audit

`public/qa/state-walk.js` walks 13 states (idle, drafting, wallet-simulation, wallet-web3, rules-modal,
lobby-modal, trading, trade-desk-open, building, harvesting, epoch-summary, proposals-modal, settlement) and
reports, per state: overlapping HUD panels, buttons that are off-screen or covered by another element, sideways
scrollers, page-level horizontal scroll, modals larger than the viewport, and essential OTC desk controls that are
not visible.

```js
const { walk } = await import('/qa/state-walk.js');
console.table(await walk());
```

Baseline (before): at 1440x900 and 1280x800 the terminal feed covered the Confirm Deeds and Quick Draft buttons,
and at 768x1024 it covered the Apex and Luna ribbon cards.

After (`main`, `?seed=42`, 2026-10-31):

| Viewport | States clean | Page horizontal scroll |
|---|---|---|
| 1440x900 | 13 / 13 | none |
| 1280x800 | 13 / 13 | none |
| 768x1024 | 13 / 13 | none |
