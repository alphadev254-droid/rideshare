import "dotenv/config";
import { access, readFile } from "fs/promises";
import path from "path";

const MEDIA_BASE_URL = process.env.MEDIA_BASE_URL ?? "https://media.aircnc.co.ke";
const MEDIA_API_KEY = process.env.MEDIA_API_KEY ?? process.env.API_KEY;
const MEDIA_CLIENT_ID = process.env.MEDIA_CLIENT_ID ?? "rideshare";
const MEDIA_HEADER_BASE_URL = process.env.MEDIA_HEADER_BASE_URL ?? MEDIA_BASE_URL;

const backendRoot = process.cwd();
const repoRoot = path.resolve(backendRoot, "..");
const heroImagePath = path.resolve(repoRoot, "rideshare-fr", "public", "hello.png");
const envName = "VITE_HOME_HERO_SIDE_IMAGE_URL";

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
  console.log("[MEDIA] Uploading home hero image to " + MEDIA_BASE_URL + " as client " + MEDIA_CLIENT_ID);
  console.log("[MEDIA] Source: " + heroImagePath);

  if (!(await exists(heroImagePath))) {
    throw new Error("Missing image: " + heroImagePath);
  }

  const result = await uploadFile(heroImagePath);

  console.log("[MEDIA] home hero image: " + result.url);
  console.log("\nAdd this to rideshare-fr/.env:");
  console.log(envName + "=" + result.url);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
