import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/auth.js";
import { upload } from "../../lib/file-upload.js";
import {
  uploadDriverDocumentController,
  uploadProfilePhotoController,
  uploadUserAvatarController,
  serveUploadController,
} from "./uploads.controller.js";

const router = Router();

router.get("/file", authenticate, serveUploadController);

router.post(
  "/driver-document",
  authenticate,
  requireRole("driver"),
  upload.single("file"),
  uploadDriverDocumentController,
);

router.post(
  "/profile-photo",
  authenticate,
  requireRole("driver"),
  upload.single("file"),
  uploadProfilePhotoController,
);

router.post(
  "/user-avatar",
  authenticate,
  upload.single("file"),
  uploadUserAvatarController,
);

export default router;
