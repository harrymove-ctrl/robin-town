#!/usr/bin/env bash
set -euo pipefail

VIDEO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXPORT_DIR="$(cd "$VIDEO_DIR/.." && pwd)/docs/video/exports"
OUT_REPORT="$VIDEO_DIR/out/qa-report.txt"
mkdir -p "$VIDEO_DIR/out"

exec > >(tee "$OUT_REPORT") 2>&1

audit_file() {
  local mp4="$1"
  local sil_ss="$2"
  local sil_dur="$3"
  local label="$4"

  echo "================================================================"
  echo "GATE 3 QA AUDIT: $label ($(basename "$mp4"))"
  echo "================================================================"

  echo "--- 1. ffprobe Stream & Container Verification ---"
  ffprobe -v error -show_entries format=duration,size,bit_rate -show_entries stream=codec_name,width,height,pix_fmt,r_frame_rate,nb_frames,duration,sample_rate,channels -of json "$mp4"

  echo "--- 2. Freeze & Black Frame Detection (freezedetect d=1.5, blackdetect d=0.3) ---"
  ffmpeg -hide_banner -nostats -i "$mp4" -vf "freezedetect=n=0.003:d=1.5,blackdetect=d=0.3:pix_th=0.05" -an -f null - 2>&1 | grep -E "freeze_|black_" || echo "No unintended freezes or black spots detected."

  echo "--- 3. EBU R128 Loudness Summary (Target: -14.0 +/- 1.0 LUFS, TP <= -1.0 dBTP) ---"
  ffmpeg -hide_banner -nostats -i "$mp4" -af "loudnorm=print_format=summary" -vn -f null - 2>&1 | tail -n 14

  echo "--- 4. Pre-Lockup 1-Beat Silence Verification (${sil_ss}s + ${sil_dur}s) ---"
  ffmpeg -hide_banner -nostats -ss "$sil_ss" -t "$sil_dur" -i "$mp4" -af "astats=metadata=1:reset=0" -vn -f null - 2>&1 | grep -E "RMS level dB|Peak level dB" | tail -n 6
}

audit_file "$EXPORT_DIR/robin-town-hackathon-master.mp4" "189.53" "0.44" "Hackathon Master (3:20)"
audit_file "$EXPORT_DIR/robin-town-x-launch.mp4" "39.53" "0.44" "X Launch Cut (0:44)"
