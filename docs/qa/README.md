# Browser QA for the HUD and OTC desk overhaul (issue #4)

## Screenshots

`before/` is the `feat/issue-2-gameplay` branch (HUD before this change); `after/` is `feat/issue-4-ui-ux`.
Both were captured at 1440x900 with the same scripted sequence:

1. Fresh match: Board with the deed tray.
2. Quick Draft, click Apex in the ribbon, stage a counterparty tile: OTC Desk.
3. Open the wallet pill: Wallet Modal (simulation mode).
4. Auto-play epochs 1 to 6: Epoch 6 Settlement Modal.

Card deals are random, so deed numbers and winners differ between the two sets.

## Layout audit

`public/qa/state-walk.js` walks 11 states (drafting, wallet-simulation, wallet-web3, rules-modal, lobby-modal,
trading, trade-desk-open, building, epoch-summary, proposals-modal, settlement) and reports, per state:
overlapping HUD panels, buttons that are off-screen or covered by another element, sideways scrollers, page-level
horizontal scroll, modals larger than the viewport, and essential OTC desk controls that are not visible.

```js
const { walk } = await import('/qa/state-walk.js');
console.table(await walk());
```

Baseline (before): at 1440x900 and 1280x800 the terminal feed covered the Confirm Deeds and Quick Draft buttons,
and at 768x1024 it covered the Apex and Luna ribbon cards.
After: 11 of 11 states clean at 1440x900, 1280x800 and 768x1024.
