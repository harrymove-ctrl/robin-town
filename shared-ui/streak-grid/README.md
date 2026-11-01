# BunUI Streak Grid: Project Impact & How I Build (All Registered Hackathons)

Canonical shared UI component inspired by `https://www.bunui.xyz/components/streak-grid` and synced across every registered hackathon in `/Volumes/Dev/hackathon-registry.json`.

## Files Included

- `streak-grid.tsx`: React / Next.js Tailwind component (`StreakGrid` + `HackathonImpactStreakSection`) featuring 5-tier phosphor-emerald streak squares, month headers, `Less / More` legend, 3 interactive view modes (`Impact + Build`, `Pure Streak`, `All 7 Matrix`), scope pills for all 7 registered hackathons, and interactive stage filtering (`How I Build`).
- `hackathon-impact-data.ts` & `hackathon-impact-data.json`: Auto-generated impact metrics, real workspace file counts, git commit activity, and 6-stage build pipelines across all registered hackathons.
- `streak-grid-element.js`: Zero-dependency Custom Element (`<bunui-streak-grid>`) for Vite, static HTML, or Atlassian Forge Custom UI apps.
- `sync-impact.mjs`: Non-destructive synchronization script that refreshes telemetry and distributes `shared-ui/streak-grid/` into every active workspace on `/Volumes/Dev`.

## Refresh Across All Registered Hackathons

```bash
node /Volumes/Dev/shared/bunui-streak-grid/sync-impact.mjs
```
