import { z } from "zod";

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email address").max(180),
  subject: z.string().trim().min(3, "Subject is required").max(160),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(4000),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
