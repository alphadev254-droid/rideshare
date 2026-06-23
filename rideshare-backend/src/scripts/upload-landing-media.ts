import "dotenv/config";
import { readFile } from "fs/promises";
import path from "path";

const MEDIA_BASE_URL = process.env.MEDIA_BASE_URL ?? "https://media.aircnc.co.ke";
const MEDIA_API_KEY = process.env.MEDIA_API_KEY ?? process.env.API_KEY;
const MEDIA_CLIENT_ID = process.env.MEDIA_CLIENT_ID ?? "rideshare";
const MEDIA_HEADER_BASE_URL = process.env.MEDIA_HEADER_BASE_URL ?? MEDIA_BASE_URL;

const files = [
  { name: "hero", filePath: path.resolve(process.cwd(), "hero-section.png") },
  { name: "route", filePath: path.resolve(process.cwd(), "route.png") },
] as const;

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function uploadFile(filePath: string) {
  if (!MEDIA_API_KEY) {
    throw new Error("MEDIA_API_KEY is required");
  }

  const bytes = await readFile(filePath);
  const blob = new Blob([new Uint8Array(bytes)], { type: contentTypeFor(filePath) });
  const form = new FormData();
  form.append("file", blob, path.basename(filePath));

  const res = await fetch(`${MEDIA_BASE_URL}/upload/`, {
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
    throw new Error(`Upload failed for ${filePath}: ${res.status} ${body}`);
  }

  return JSON.parse(body) as { id: string; bucket: string; url: string; size: number; mime: string };
}

async function main() {
  console.log(`[MEDIA] Uploading to ${MEDIA_BASE_URL} as client ${MEDIA_CLIENT_ID}`);
  const results: Record<string, string> = {};

  for (const item of files) {
    const result = await uploadFile(item.filePath);
    results[item.name] = result.url;
    console.log(`[MEDIA] ${item.name}: ${result.url}`);
  }

  console.log("\nAdd these to rideshare-fr/.env:");
  console.log(`VITE_LANDING_HERO_IMAGE_URL=${results.hero}`);
  console.log(`VITE_LANDING_ROUTE_IMAGE_URL=${results.route}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});