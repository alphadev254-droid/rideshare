import type { Request, Response, NextFunction } from "express";
import { type ZodSchema } from "zod";

type Target = "body" | "query" | "params";

export function validate(schema: ZodSchema, target: Target = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      _res.status(400).json({
        success: false,
        error: "Validation error",
        details: result.error.flatten().fieldErrors,
      });
      return;
    }
    (req as Record<string, unknown>)[target] = result.data;
    next();
  };
}
