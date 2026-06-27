import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const logo = join(root, "public", "logo.png");

function findMagick() {
  const candidates = ["magick"];

  if (process.platform === "win32") {
    const bases = [
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Programs") : undefined,
    ].filter(Boolean);

    for (const base of bases) {
      try {
        for (const entry of readdirSync(base)) {
          if (entry.toLowerCase().startsWith("imagemagick")) {
            candidates.push(join(base, entry, "magick.exe"));
          }
        }
      } catch {
        // Ignore missing or inaccessible folders.
      }
    }
  }

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["-version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

if (!existsSync(logo)) {
  console.error("Missing public/logo.png");
  process.exit(1);
}

const magick = findMagick();
if (!magick) {
  console.error("ImageMagick was not found. Install it with: winget install ImageMagick.ImageMagick");
  console.error("After installing, reopen PowerShell or make sure magick.exe is in PATH.");
  process.exit(1);
}

const outputs = [
  ["16x16", "public/favicon-16x16.png"],
  ["32x32", "public/favicon-32x32.png"],
  ["180x180", "public/apple-touch-icon.png"],
  ["192x192", "public/icon-192.png"],
  ["512x512", "public/icon-512.png"],
];

for (const [size, output] of outputs) {
  execFileSync(magick, [logo, "-resize", size, output], { stdio: "inherit" });
}

execFileSync(
  magick,
  [logo, "-define", "icon:auto-resize=16,32,48", "public/favicon.ico"],
  { stdio: "inherit" },
);

console.log("Generated favicon and app icons from public/logo.png");
