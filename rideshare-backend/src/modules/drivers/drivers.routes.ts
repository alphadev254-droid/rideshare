import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { upload } from "../../lib/file-upload.js";
import {
  registerDriverController,
  addVehicleController,
  updateVehicleController,
  deleteVehicleController,
  getMyVehiclesController,
  uploadVehicleImageController,
  removeVehicleImageController,
  uploadVehicleInsuranceDocumentController,
  removeVehicleInsuranceDocumentController,
  addVehicleAdminController,
  updateVehicleAdminController,
  deleteVehicleAdminController,
  uploadVehicleImageAdminController,
  removeVehicleImageAdminController,
  uploadVehicleInsuranceDocumentAdminController,
  removeVehicleInsuranceDocumentAdminController,
  getMyEarningsController,
  listDriversController,
  approveDriverController,
  getDriverProfileController,
  getDriverByIdController,
  getDashboardController,
  uploadDocumentsController,
  requestReviewController,
  removeDriverProfileFileAdminController,
  uploadDriverDocumentAdminController,
  uploadDriverProfilePhotoAdminController,
  updateDriverProfileAdminController,
  toggleVehicleActiveAdminController,
  reviewVehicleAdminController,
} from "./drivers.controller.js";
import {
  adminUpdateDriverProfileSchema,
  registerDriverSchema,
  addVehicleSchema,
  uploadDocumentsSchema,
} from "./drivers.schemas.js";

const router = Router();

router.get("/dashboard", authenticate, requireRole("driver"), getDashboardController);
router.get("/profile", authenticate, requireRole("driver"), getDriverProfileController);
router.post("/profile", authenticate, validate(registerDriverSchema), registerDriverController);
router.post("/profile/request-review", authenticate, requireRole("driver"), requestReviewController);
router.get("/vehicles", authenticate, requireRole("driver"), getMyVehiclesController);
router.post("/vehicles", authenticate, requireRole("driver"), upload.single("insuranceDocument"), validate(addVehicleSchema), addVehicleController);
router.patch("/vehicles/:id", authenticate, requireRole("driver"), upload.single("insuranceDocument"), validate(addVehicleSchema), updateVehicleController);
router.post("/vehicles/:id/images", authenticate, requireRole("driver"), upload.single("file"), uploadVehicleImageController);
router.delete("/vehicles/:id/images", authenticate, requireRole("driver"), removeVehicleImageController);
router.post("/vehicles/:id/insurance-document", authenticate, requireRole("driver"), upload.single("file"), uploadVehicleInsuranceDocumentController);
router.delete("/vehicles/:id/insurance-document", authenticate, requireRole("driver"), removeVehicleInsuranceDocumentController);
router.delete("/vehicles/:id", authenticate, requireRole("driver"), deleteVehicleController);
router.patch("/documents", authenticate, requireRole("driver"), validate(uploadDocumentsSchema), uploadDocumentsController);
router.get("/me/vehicles", authenticate, requireRole("driver"), getMyVehiclesController);
router.get("/me/earnings", authenticate, requireRole("driver"), getMyEarningsController);
router.get("/", authenticate, requireRole("admin"), listDriversController);
router.get("/:id", authenticate, requireRole("admin"), getDriverByIdController);
router.patch("/:id", authenticate, requireRole("admin"), validate(adminUpdateDriverProfileSchema), updateDriverProfileAdminController);
router.post("/:id/vehicles", authenticate, requireRole("admin"), upload.single("insuranceDocument"), validate(addVehicleSchema), addVehicleAdminController);
router.patch("/:id/vehicles/:vehicleId", authenticate, requireRole("admin"), upload.single("insuranceDocument"), validate(addVehicleSchema), updateVehicleAdminController);
router.delete("/:id/vehicles/:vehicleId", authenticate, requireRole("admin"), deleteVehicleAdminController);
router.post("/:id/vehicles/:vehicleId/images", authenticate, requireRole("admin"), upload.single("file"), uploadVehicleImageAdminController);
router.delete("/:id/vehicles/:vehicleId/images", authenticate, requireRole("admin"), removeVehicleImageAdminController);
router.post("/:id/vehicles/:vehicleId/insurance-document", authenticate, requireRole("admin"), upload.single("file"), uploadVehicleInsuranceDocumentAdminController);
router.delete("/:id/vehicles/:vehicleId/insurance-document", authenticate, requireRole("admin"), removeVehicleInsuranceDocumentAdminController);
router.post("/:id/profile-photo", authenticate, requireRole("admin"), upload.single("file"), uploadDriverProfilePhotoAdminController);
router.post("/:id/document", authenticate, requireRole("admin"), upload.single("file"), uploadDriverDocumentAdminController);
router.patch("/:id/file", authenticate, requireRole("admin"), removeDriverProfileFileAdminController);
router.patch("/:id/approve", authenticate, requireRole("admin"), approveDriverController);
router.patch("/:id/vehicles/:vehicleId/review", authenticate, requireRole("admin"), reviewVehicleAdminController);
router.patch("/:id/vehicles/:vehicleId/active", authenticate, requireRole("admin"), toggleVehicleActiveAdminController);

export default router;
