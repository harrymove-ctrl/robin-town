#!/usr/bin/env python3
"""
Renders and stitches Gate 3 visual proof contact sheets:
  1. docs/video/exports/callouts-middle-frames.png (all 10 callout middle frames with solved callout-layout.json)
  2. docs/video/exports/motion-frames.png (12 representative motion & gameplay frames across Master & X Cut)
"""
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

VIDEO = Path(__file__).resolve().parent.parent
EXPORTS = VIDEO.parent / "docs" / "video" / "exports"
STILLS_DIR = VIDEO / "out" / "contact-stills"
EXPORTS.mkdir(parents=True, exist_ok=True)
STILLS_DIR.mkdir(parents=True, exist_ok=True)

CALLOUT_FRAMES = [
    ("RobinTownMaster", 900, "C1 · S05 (0:30) 3D Harbor Diorama, Day to Night"),
    ("RobinTownMaster", 1200, "C2 · S05 (0:40) One-click 2D and 3D toggle"),
    ("RobinTownMaster", 1800, "C3 · S07 (1:00) Two-way OTC bargaining table"),
    ("RobinTownMaster", 2160, "C4 · S07 (1:12) 1% OTC cash micro-fee"),
    ("RobinTownMaster", 2850, "C5 · S09 (1:35) Compounding annual $wif payday"),
    ("RobinTownMaster", 3600, "C6 · S12 (2:00) Verified $wif on Chain 46631"),
    ("RobinTownMaster", 3870, "C7 · S12 (2:09) 1.20x staking and permanent burns"),
    ("RobinTownMaster", 4890, "C8 · S15 (2:43) Collapsible ROBIN-POD click wheel"),
    ("RobinTownXClip", 435, "X1 · X04 (0:14.5) 3D Harbor Diorama and 2D toggle"),
    ("RobinTownXClip", 980, "X2 · X06 (0:32.7) 1.20x staking and $wif burns"),
]

MOTION_FRAMES = [
    ("RobinTownMaster", 195, "S01 · OrbSwarm 4-Beat Hook (Put $wif to work)"),
    ("RobinTownMaster", 330, "S02 · BlockWordmark + TownMark Lockup"),
    ("RobinTownMaster", 405, "S03 · LaptopFrame Notch (Chain 46631) Dive"),
    ("RobinTownMaster", 570, "S04 · WordGather + Marker Highlight"),
    ("RobinTownMaster", 690, "S05 · 3D Harbor Diorama (Street Orbit)"),
    ("RobinTownMaster", 1535, "S06 · PunchLines (Everything is negotiable)"),
    ("RobinTownMaster", 2500, "S08 · OrbitFlow 3-Phase Neighborhood Loop"),
    ("RobinTownMaster", 2648, "S09 · DROP 1 Downbeat (Frame 2640 Payday)"),
    ("RobinTownMaster", 3240, "S10 · ScatterBloom + CountGrid (926 Tests)"),
    ("RobinTownMaster", 4045, "S13a · MetricMorph (4.6M+ $wif Burn Proof)"),
    ("RobinTownMaster", 5280, "S16 · PhoneStack 4-Seat WebSocket Parity"),
    ("RobinTownMaster", 5850, "S18 · DotBloom -> ROBIN TOWN Final Lockup"),
]

jobs = []
for idx, (comp, fr, label) in enumerate(CALLOUT_FRAMES):
    jobs.append({
        "comp": comp,
        "frame": fr,
        "out": str(STILLS_DIR / f"callout-{idx:02d}.png"),
        "inputProps": {"calloutMode": "normal"},
    })
for idx, (comp, fr, label) in enumerate(MOTION_FRAMES):
    jobs.append({
        "comp": comp,
        "frame": fr,
        "out": str(STILLS_DIR / f"motion-{idx:02d}.png"),
        "inputProps": {"calloutMode": "normal"},
    })
# Also render Frame 0 payoff proof
jobs.append({
    "comp": "RobinTownMaster",
    "frame": 18,
    "out": str(STILLS_DIR / "opening-frame-18.png"),
    "inputProps": {"calloutMode": "normal"},
})

manifest = STILLS_DIR / "manifest.json"
manifest.write_text(json.dumps(jobs, indent=2))
subprocess.run(["npx", "tsx", "scripts/stills.mjs", str(manifest)], cwd=VIDEO, check=True)


def stitch_sheet(items: list[tuple[Path, str]], cols: int, thumb_w: int, out_path: Path) -> None:
    thumb_h = round(thumb_w * 9 / 16)
    label_h = 34
    pad = 16
    rows = (len(items) + cols - 1) // cols
    sheet_w = pad + cols * (thumb_w + pad)
    sheet_h = pad + rows * (thumb_h + label_h + pad)
    sheet = Image.new("RGB", (sheet_w, sheet_h), (17, 42, 36))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Menlo.ttc", 16)
    except Exception:
        font = ImageFont.load_default()

    for i, (img_path, label) in enumerate(items):
        r = i // cols
        c = i % cols
        x = pad + c * (thumb_w + pad)
        y = pad + r * (thumb_h + label_h + pad)
        im = Image.open(img_path).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(im, (x, y))
        draw.rectangle([x, y, x + thumb_w - 1, y + thumb_h - 1], outline=(57, 168, 131), width=2)
        draw.text((x + 6, y + thumb_h + 7), label, fill=(251, 246, 232), font=font)

    sheet.save(out_path, optimize=True)
    print(f"Wrote contact sheet: {out_path} ({sheet_w}x{sheet_h})")


stitch_sheet(
    [(STILLS_DIR / f"callout-{i:02d}.png", lbl) for i, (_, _, lbl) in enumerate(CALLOUT_FRAMES)],
    cols=2,
    thumb_w=860,
    out_path=EXPORTS / "callouts-middle-frames.png",
)

stitch_sheet(
    [(STILLS_DIR / f"motion-{i:02d}.png", lbl) for i, (_, _, lbl) in enumerate(MOTION_FRAMES)],
    cols=3,
    thumb_w=600,
    out_path=EXPORTS / "motion-frames.png",
)
