#!/usr/bin/env node
// Renders all 18 SFX cues (9 verbatim Robin-Town WebAudio cues + 9 Tone.js transitions)
// and both Variant A 120 BPM music stems (full 200s + x 44s) offline at 48 kHz stereo.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..");
const SFX_DIR = path.join(root, "public/audio/sfx");
const AUDIO_DIR = path.join(root, "public/audio");
const only = process.argv[2];

const app = (id) => ({ type: "appCue", spec: { id } });
const des = (kind, seconds, extra = {}) => ({ type: "designed", spec: { kind, seconds, ...extra } });

const SOUNDS = {
  "app-tap": app("app-tap"),
  "app-stool-clack": app("app-stool-clack"),
  "app-deed-slide": app("app-deed-slide"),
  "app-shop-shutter": app("app-shop-shutter"),
  "app-deal-stamp": app("app-deal-stamp"),
  "app-neighbor-nod": app("app-neighbor-nod"),
  "app-payday-chime": app("app-payday-chime"),
  "app-calendar-tear": app("app-calendar-tear"),
  "app-ipod-tick": app("app-ipod-tick"),
  "tx-orb-glass": des("orb-glass", 0.9),
  "tx-block-fan": des("block-fan", 0.35),
  "tx-bezel-dive": des("bezel-dive", 0.75),
  "tx-callout-open": des("callout-open", 0.16),
  "tx-orbit-whip": des("orbit-whip", 0.45),
  "tx-riser-1bar": des("riser", 2.0),
  "tx-riser-2bar": des("riser", 4.0),
  "tx-sub-impact": des("sub-impact", 0.65),
  "tx-wif-burn": des("wif-burn", 0.45),
};

const MAP = JSON.parse(readFileSync(path.join(root, "sound/music-map.json"), "utf8"));
const sections = (m) => m.map(([name, from, to]) => ({ name, from, to }));

function writeWav(file, base64, sr, normalise, keepFullLength = false) {
  const pcm = Buffer.from(base64, "base64");
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2);
  if (normalise) {
    let peak = 1;
    for (const v of samples) peak = Math.max(peak, Math.abs(v));
    const g = (32767 * 10 ** (-1 / 20)) / peak;
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * g)));
    }
  }
  let end = samples.length;
  if (!keepFullLength) {
    while (end > 2 && Math.abs(samples[end - 1]) < 8 && Math.abs(samples[end - 2]) < 8) end -= 2;
  }
  const body = Buffer.from(samples.buffer, samples.byteOffset, end * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + body.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(body.length, 40);
  writeFileSync(file, Buffer.concat([h, body]));
}

function findChrome() {
  const candidates = [
    process.env.BROWSER_EXECUTABLE,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Users/harryphan/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

const bundle = await build({
  entryPoints: [path.join(root, "sound/page.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  write: false,
  logLevel: "warning",
});

const browser = await chromium.launch({
  executablePath: findChrome(),
  headless: true,
});
const page = await browser.newPage();
await page.setContent("<!doctype html><title>robin-town-sound</title>");
await page.addScriptTag({ content: bundle.outputFiles[0].text });
const SR = await page.evaluate(() => window.sound.SR);

mkdirSync(AUDIO_DIR, { recursive: true });

if (only !== "score") {
  rmSync(SFX_DIR, { recursive: true, force: true });
  mkdirSync(SFX_DIR, { recursive: true });
  for (const [name, { type, spec }] of Object.entries(SOUNDS)) {
    const b64 = await page.evaluate(([t, s]) => window.sound[t](s), [type, spec]);
    writeWav(path.join(SFX_DIR, `${name}.wav`), b64, SR, true, false);
  }
  console.log(`Rendered ${Object.keys(SOUNDS).length} stereo 48 kHz WAV cues in public/audio/sfx/`);
}

if (only !== "sfx") {
  for (const cut of ["full", "x"]) {
    const { sections: map, seconds } = MAP[cut];
    console.log(`Synthesizing Variant A 120 BPM score for ${cut} (${seconds}s)...`);
    const b64 = await page.evaluate(([s, sec]) => window.sound.score(s, sec), [sections(map), seconds]);
    const wavOut = path.join(AUDIO_DIR, `music-${cut}.wav`);
    writeWav(wavOut, b64, SR, true, true);
    const mp3Out = path.join(AUDIO_DIR, `music-${cut}.mp3`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", wavOut, "-c:a", "libmp3lame", "-b:a", "256k", mp3Out]);
    console.log(`Rendered ${path.relative(root, wavOut)} + ${path.relative(root, mp3Out)}`);
  }
}

await browser.close();
