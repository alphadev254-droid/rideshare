import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(moduleDir, "../..");
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? path.join(backendRoot, "uploads"));

// Ensure upload directories exist
const DOCS_DIR = path.join(UPLOAD_DIR, "documents");
const AVATARS_DIR = path.join(UPLOAD_DIR, "avatars");

[DOCS_DIR, AVATARS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // Route-based destination: avatars go to avatars/, everything else to documents/
    const route = (req as any)?.originalUrl || "";
    if (route.includes("profile-photo") || route.includes("user-avatar")) {
      cb(null, AVATARS_DIR);
    } else {
      cb(null, DOCS_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${randomUUID()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

export function getUploadUrl(filename: string): string {
  return `/uploads/documents/${filename}`;
}

export function getAvatarUrl(filename: string): string {
  return `/uploads/avatars/${filename}`;
}
