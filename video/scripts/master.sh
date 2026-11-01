#!/usr/bin/env bash
set -euo pipefail

VIDEO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXPORT_DIR="$(cd "$VIDEO_DIR/.." && pwd)/docs/video/exports"
mkdir -p "$EXPORT_DIR"

master_one() {
  local in_mp4="$1"
  local out_mp4="$2"
  local sil_start="$3"
  local sil_end="$4"
  local exact_dur="$5"

  echo "=== Pass 1 loudnorm analysis: $(basename "$in_mp4") ==="
  local stats_json
  stats_json=$(ffmpeg -hide_banner -nostats -i "$in_mp4" \
    -af "loudnorm=I=-13.8:TP=-1.8:LRA=9:print_format=json" \
    -f null - 2>&1 | sed -n '/^{$/,/^}$/p')

  local m_I m_TP m_LRA m_thresh offset
  m_I=$(echo "$stats_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['input_i'])")
  m_TP=$(echo "$stats_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['input_tp'])")
  m_LRA=$(echo "$stats_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['input_lra'])")
  m_thresh=$(echo "$stats_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['input_thresh'])")
  offset=$(echo "$stats_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['target_offset'])")

  echo "Measured Pass 1: I=$m_I LUFS, TP=$m_TP dBTP, LRA=$m_LRA, offset=$offset"
  echo "=== Pass 2 loudnorm + 4x True-Peak brickwall limiter + pre-lockup hard silence ($sil_start..$sil_end s) -> $(basename "$out_mp4") ==="

  ffmpeg -hide_banner -v error -y -i "$in_mp4" \
    -t "$exact_dur" \
    -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p \
    -af "loudnorm=I=-13.8:TP=-1.8:LRA=9:measured_I=${m_I}:measured_TP=${m_TP}:measured_LRA=${m_LRA}:measured_thresh=${m_thresh}:offset=${offset},aresample=192000,alimiter=limit=0.78:attack=2:release=30:level=false,aresample=48000,volume=enable='between(t,${sil_start},${sil_end})':volume=0" \
    -c:a aac -b:a 320k -ar 48000 \
    -movflags +faststart \
    "$out_mp4"

  echo "Mastered: $out_mp4"
}

master_one "$VIDEO_DIR/out/master-raw.mp4" "$EXPORT_DIR/robin-town-hackathon-master.mp4" "189.50" "190.00" "200.00"
master_one "$VIDEO_DIR/out/x-raw.mp4" "$EXPORT_DIR/robin-town-x-launch.mp4" "39.50" "40.00" "44.00"
