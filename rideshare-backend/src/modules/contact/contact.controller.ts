import type { Request, Response, NextFunction } from "express";
import { sendContactMessage } from "./contact.service.js";
import type { ContactMessageInput } from "./contact.schemas.js";

export async function sendContactMessageController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await sendContactMessage(req.body as ContactMessageInput);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
