#!/usr/bin/env node
// Fast single-bundle batch still renderer for layout-callouts.py, make-contact-sheets.py, and qa-frames.py.
// Usage: node scripts/stills.mjs <manifest.json>
// where manifest.json is Array<{ comp: string, frame: number, out: string, inputProps?: Record<string, unknown> }>
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { webpackOverride } from "../webpack-override.ts";

const VIDEO = path.resolve(import.meta.dirname, "..");
const manifestPath = path.resolve(process.argv[2]);
const jobs = JSON.parse(readFileSync(manifestPath, "utf8"));

const CHROME_MAC = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browserExecutable = existsSync(CHROME_MAC) ? CHROME_MAC : null;

const serveUrl = await bundle({
  entryPoint: path.join(VIDEO, "src/index.ts"),
  webpackOverride,
});

const browser = await openBrowser("chrome", {
  browserExecutable,
  chromiumOptions: { gl: "angle" },
});

try {
  const compCache = new Map();
  for (const job of jobs) {
    mkdirSync(path.dirname(job.out), { recursive: true });
    const propsKey = `${job.comp}:${JSON.stringify(job.inputProps || {})}`;
    let composition = compCache.get(propsKey);
    if (!composition) {
      composition = await selectComposition({
        serveUrl,
        id: job.comp,
        inputProps: job.inputProps || {},
        puppeteerInstance: browser,
      });
      compCache.set(propsKey, composition);
    }
    await renderStill({
      composition,
      serveUrl,
      output: job.out,
      frame: job.frame,
      inputProps: job.inputProps || {},
      imageFormat: "png",
      puppeteerInstance: browser,
    });
    console.log(`Rendered ${job.comp}@${job.frame} -> ${path.relative(VIDEO, job.out)}`);
  }
} finally {
  await browser.close({ silent: true });
}
