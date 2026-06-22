import { Router } from "express";
import { getDistrictsController } from "./locations.controller.js";

const router = Router();

router.get("/districts", getDistrictsController);

export default router;