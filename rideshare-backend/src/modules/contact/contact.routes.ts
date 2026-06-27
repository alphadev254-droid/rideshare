import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { sendContactMessageController } from "./contact.controller.js";
import { contactMessageSchema } from "./contact.schemas.js";

const router = Router();

router.post("/", validate(contactMessageSchema), sendContactMessageController);

export default router;
