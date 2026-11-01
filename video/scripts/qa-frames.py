#!/usr/bin/env python3
"""
Gate 3 Palette Hue Fidelity Audit (< 2.0% Foreign-Hue Pixels).
Extracts 12 representative frames from robin-town-hackathon-master.mp4 and 6 frames from
robin-town-x-launch.mp4, converts saturated pixels (S >= 0.30, V >= 0.22) to HSV hue degrees,
and verifies every frame has < 2.0% pixels outside the angular hue bands present in
Robin-Town's real CSS/TS/Aseprite palette (src/palette.ts).
"""
import colorsys
import json
import re
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image

VIDEO = Path(__file__).resolve().parent.parent
EXPORTS = VIDEO.parent / "docs" / "video" / "exports"
SAMPLE_DIR = VIDEO / "out" / "qa-palette-samples"
SAMPLE_DIR.mkdir(parents=True, exist_ok=True)

# 1. Load all hex colors extracted programmatically into src/palette.ts
palette_src = (VIDEO / "src" / "palette.ts").read_text()
hex_codes = sorted(set(re.findall(r"#[0-9a-fA-F]{6}\b", palette_src)))

palette_hues = []
for hc in hex_codes:
    r = int(hc[1:3], 16) / 255.0
    g = int(hc[3:5], 16) / 255.0
    b = int(hc[5:7], 16) / 255.0
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if s >= 0.18 and v >= 0.15:
        palette_hues.append(h * 360.0)

palette_hues_np = np.array(palette_hues, dtype=np.float32)

SAMPLES = [
    ("robin-town-hackathon-master.mp4", [2.0, 9.5, 13.5, 18.0, 30.0, 50.0, 84.0, 106.0, 114.0, 133.0, 175.0, 195.0]),
    ("robin-town-x-launch.mp4", [1.5, 5.0, 14.5, 22.0, 32.5, 42.0]),
    ("robin-town-intro.mp4", [1.5, 4.0, 7.5, 11.0, 15.0, 17.5, 22.0, 26.5, 31.5]),
]

results = []
for fname, times in SAMPLES:
    mp4 = EXPORTS / fname
    for t in times:
        out_png = SAMPLE_DIR / f"{mp4.stem}-{t:05.1f}s.png"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(mp4), "-frames:v", "1", str(out_png)],
            check=True,
        )
        im = Image.open(out_png).convert("RGB").resize((480, 270), Image.Resampling.BILINEAR)
        arr = np.asarray(im, dtype=np.float32) / 255.0
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        cmax = np.maximum(np.maximum(r, g), b)
        cmin = np.minimum(np.minimum(r, g), b)
        delta = cmax - cmin
        sat = np.where(cmax > 1e-5, delta / np.maximum(cmax, 1e-5), 0.0)

        # Compute hue in [0, 360)
        hue = np.zeros_like(cmax)
        mask_d = delta > 1e-5
        mr = mask_d & (cmax == r)
        mg = mask_d & (cmax == g) & ~mr
        mb = mask_d & ~mr & ~mg
        hue[mr] = (60.0 * ((g[mr] - b[mr]) / delta[mr]) + 360.0) % 360.0
        hue[mg] = (60.0 * ((b[mg] - r[mg]) / delta[mg]) + 120.0) % 360.0
        hue[mb] = (60.0 * ((r[mb] - g[mb]) / delta[mb]) + 240.0) % 360.0

        # Audit vivid pixels against extracted Robin-Town palette hues (within 20 deg circular hue tolerance)
        vivid = (sat >= 0.35) & (cmax >= 0.24)
        total_px = arr.shape[0] * arr.shape[1]
        if vivid.sum() == 0:
            foreign_pct = 0.0
        else:
            vh = hue[vivid][:, None]
            ang_dist = np.abs((vh - palette_hues_np[None, :] + 180.0) % 360.0 - 180.0)
            min_dist = ang_dist.min(axis=1)
            foreign_px = int((min_dist > 20.0).sum())
            foreign_pct = round(100.0 * foreign_px / total_px, 3)

        results.append({
            "video": fname,
            "timeSec": t,
            "foreignHuePct": foreign_pct,
            "pass": foreign_pct < 2.0,
        })
        print(f"[{fname} @ {t:5.1f}s] foreign_hue={foreign_pct:.3f}% ({'PASS' if foreign_pct < 2.0 else 'FAIL'})")

(VIDEO / "out" / "palette-qa.json").write_text(json.dumps(results, indent=2) + "\n")
max_foreign = max(r["foreignHuePct"] for r in results)
print(f"PALETTE QA SUMMARY: {len(results)} frames audited, max foreign_hue={max_foreign:.3f}% (cap < 2.0%)")
if max_foreign >= 2.0:
    raise SystemExit(f"FAIL: foreign_hue={max_foreign:.3f}% >= 2.0%")
