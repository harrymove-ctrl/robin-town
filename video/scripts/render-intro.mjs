#!/usr/bin/env node
// Single-bundle Remotion H.264 1080p @ 30fps renderer for RobinTownIntro (1,011 frames = 33.70s).
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "../webpack-override.ts";

const VIDEO = path.resolve(import.meta.dirname, "..");
const OUT = path.join(VIDEO, "out");
mkdirSync(OUT, { recursive: true });

const CHROME_MAC = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browserExecutable = existsSync(CHROME_MAC) ? CHROME_MAC : null;
const browserOpts = {
  browserExecutable,
  chromeMode: "chrome-for-testing",
  chromiumOptions: { gl: "angle" },
};

console.log("Bundling Remotion project with solved callout-layout.json for RobinTownIntro...");
const serveUrl = await bundle({
  entryPoint: path.join(VIDEO, "src/index.ts"),
  webpackOverride,
});

const outPath = path.join(OUT, "intro-raw.mp4");
const t0 = Date.now();
const composition = await selectComposition({
  serveUrl,
  id: "RobinTownIntro",
  inputProps: { calloutMode: "normal" },
  ...browserOpts,
});
console.log(
  `Rendering RobinTownIntro (${composition.durationInFrames} frames @ ${composition.fps}fps, ${composition.width}x${composition.height})...`,
);
let lastPct = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  crf: 17,
  pixelFormat: "yuv420p",
  audioCodec: "aac",
  outputLocation: outPath,
  inputProps: { calloutMode: "normal" },
  concurrency: 8,
  ...browserOpts,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 10) * 10;
    if (pct !== lastPct) {
      lastPct = pct;
      console.log(`  [RobinTownIntro] ${pct}%`);
    }
  },
});
const sec = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`Finished RobinTownIntro -> ${path.relative(VIDEO, outPath)} in ${sec}s`);
