#!/usr/bin/env node
// Single-bundle Remotion H.264 1080p @ 30fps renderer for RobinTownXClip (1,320f) and RobinTownMaster (6,000f).
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

console.log("Bundling Remotion project with solved callout-layout.json...");
const serveUrl = await bundle({
  entryPoint: path.join(VIDEO, "src/index.ts"),
  webpackOverride,
});

const targets = [
  { id: "RobinTownXClip", out: path.join(OUT, "x-raw.mp4") },
  { id: "RobinTownMaster", out: path.join(OUT, "master-raw.mp4") },
];

for (const tgt of targets) {
  const t0 = Date.now();
  const composition = await selectComposition({
    serveUrl,
    id: tgt.id,
    inputProps: { calloutMode: "normal" },
    ...browserOpts,
  });
  console.log(
    `Rendering ${tgt.id} (${composition.durationInFrames} frames @ ${composition.fps}fps, ${composition.width}x${composition.height})...`,
  );
  let lastPct = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 17,
    pixelFormat: "yuv420p",
    audioCodec: "aac",
    outputLocation: tgt.out,
    inputProps: { calloutMode: "normal" },
    concurrency: 8,
    ...browserOpts,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== lastPct) {
        lastPct = pct;
        console.log(`  [${tgt.id}] ${pct}%`);
      }
    },
  });
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Finished ${tgt.id} -> ${path.relative(VIDEO, tgt.out)} in ${sec}s`);
}
