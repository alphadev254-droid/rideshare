import "dotenv/config";
import { access, readFile } from "fs/promises";
import path from "path";

const MEDIA_BASE_URL = process.env.MEDIA_BASE_URL ?? "https://media.aircnc.co.ke";
const MEDIA_API_KEY = process.env.MEDIA_API_KEY ?? process.env.API_KEY;
const MEDIA_CLIENT_ID = process.env.MEDIA_CLIENT_ID ?? "rideshare";
const MEDIA_HEADER_BASE_URL = process.env.MEDIA_HEADER_BASE_URL ?? MEDIA_BASE_URL;

const backendRoot = process.cwd();
const repoRoot = path.resolve(backendRoot, "..");
const frontendPublic = path.resolve(repoRoot, "rideshare-fr", "public");

const files = [
  { name: "hero", envName: "VITE_LANDING_HERO_IMAGE_URL", filePath: path.resolve(backendRoot, "hero-section.png") },
  { name: "route", envName: "VITE_LANDING_ROUTE_IMAGE_URL", filePath: path.resolve(backendRoot, "route.png") },
  { name: "logo", envName: "VITE_SITE_LOGO_IMAGE_URL", filePath: path.resolve(frontendPublic, "logo.png") },
  { name: "og", envName: "VITE_SITE_OG_IMAGE_URL", filePath: path.resolve(frontendPublic, "icon-512.png") },
  { name: "icon192", envName: "VITE_SITE_ICON_192_IMAGE_URL", filePath: path.resolve(frontendPublic, "icon-192.png") },
  { name: "icon512", envName: "VITE_SITE_ICON_512_IMAGE_URL", filePath: path.resolve(frontendPublic, "icon-512.png") },
] as const;

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function uploadFile(filePath: string) {
  if (!MEDIA_API_KEY) {
    throw new Error("MEDIA_API_KEY is required");
  }

  const bytes = await readFile(filePath);
  const blob = new Blob([new Uint8Array(bytes)], { type: contentTypeFor(filePath) });
  const form = new FormData();
  form.append("file", blob, path.basename(filePath));

  const res = await fetch(MEDIA_BASE_URL + "/upload/", {
    method: "POST",
    headers: {
      "X-API-Key": MEDIA_API_KEY,
      "X-Client-Id": MEDIA_CLIENT_ID,
      "X-Media-Base-Url": MEDIA_HEADER_BASE_URL,
    },
    body: form,
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error("Upload failed for " + filePath + ": " + res.status + " " + body);
  }

  return JSON.parse(body) as { id: string; bucket: string; url: string; size: number; mime: string };
}

async function main() {
  console.log("[MEDIA] Uploading to " + MEDIA_BASE_URL + " as client " + MEDIA_CLIENT_ID);
  const results: Record<string, string> = {};

  for (const item of files) {
    if (!(await exists(item.filePath))) {
      console.warn("[MEDIA] Skipping missing " + item.name + ": " + item.filePath);
      continue;
    }

    const result = await uploadFile(item.filePath);
    results[item.envName] = result.url;
    console.log("[MEDIA] " + item.name + ": " + result.url);
  }

  console.log("\nAdd these to rideshare-fr/.env:");
  for (const item of files) {
    const url = results[item.envName];
    if (url) console.log(item.envName + "=" + url);
  }

  console.log("\nKeep favicon.ico, apple-touch-icon.png and manifest icons local for browser/PWA compatibility.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
