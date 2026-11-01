#!/usr/bin/env node
// Unpacks Free MIT @snapcn/* components from the offline registry at
// /Volumes/Dev/video-effects-kit/snapcn/registry/ into video/src/
// and copies Robin-Town's bundled fonts into video/public/fonts/.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VIDEO = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(VIDEO, "..");
const REGISTRY = "/Volumes/Dev/video-effects-kit/snapcn/registry";

const PACKAGES = [
  "snap-cn-ui",
  "caret",
  "input",
  "pulsing-border",
  "orb-swarm",
  "block-wordmark",
  "laptop-frame",
  "word-gather",
  "text-highlight",
  "punch-lines",
  "button-press",
  "cursor-track",
  "count-grid",
  "check-cycle",
  "phone-frame",
  "phone-stack",
  "terminal-simulator",
  "dot-bloom",
  "screen-recording",
];

let written = 0;
for (const pkg of PACKAGES) {
  const jsonPath = join(REGISTRY, `${pkg}.json`);
  if (!existsSync(jsonPath)) {
    throw new Error(`Missing offline registry package: ${jsonPath}`);
  }
  const data = JSON.parse(readFileSync(jsonPath, "utf8"));
  for (const file of data.files ?? []) {
    // target or path inside registry json, e.g. "components/snap-cn/orb-swarm.tsx" or "lib/snap-cn-ui.tsx"
    let rel = file.target || file.path || "";
    rel = rel.replace(/^src\//, "");
    if (!rel.startsWith("components/") && !rel.startsWith("lib/")) {
      if (pkg === "snap-cn-ui") rel = `lib/${rel.split("/").pop()}`;
      else rel = `components/snap-cn/${rel.split("/").pop()}`;
    }
    const dest = join(VIDEO, "src", rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, file.content, "utf8");
    written++;
  }
}

// Copy bundled Robin-Town fonts from public/assets/saigon/fonts/
const fontSrcDir = join(REPO, "public/assets/saigon/fonts");
const fontDestDir = join(VIDEO, "public/fonts");
mkdirSync(fontDestDir, { recursive: true });
for (const fontFile of ["bungee.ttf", "be-vietnam-regular.ttf", "be-vietnam-bold.ttf", "lora.ttf"]) {
  copyFileSync(join(fontSrcDir, fontFile), join(fontDestDir, fontFile));
}

// Also copy key Aseprite sprites for TownCrestMark / decorative badges if needed
const spriteDestDir = join(VIDEO, "public/sprites");
mkdirSync(spriteDestDir, { recursive: true });
for (const [sub, name] of [
  ["shops", "pho.png"],
  ["shops", "coffee.png"],
  ["shops", "banhmi.png"],
  ["life", "game-banknote.png"],
]) {
  const src = join(REPO, "public/assets/saigon", sub, name);
  if (existsSync(src)) copyFileSync(src, join(spriteDestDir, name));
}

console.log(`Unpacked ${written} files from ${PACKAGES.length} @snapcn MIT packages + 4 bundled Robin-Town fonts.`);
