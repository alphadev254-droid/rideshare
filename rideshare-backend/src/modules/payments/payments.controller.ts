import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../../types/index.js";
import * as paymentsService from "./payments.service.js";
import type { InitiatePaymentInput, InitiateRidePaymentInput } from "./payments.schemas.js";

export async function initiatePaymentController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await paymentsService.initiatePayment(
      req.user!.sub,
      req.body as InitiatePaymentInput & { phone: string },
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function initiateRidePaymentController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await paymentsService.initiateRidePayment(
      req.user!.sub,
      req.body as InitiateRidePaymentInput & { phone: string },
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function paychanguWebhookController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sig = (req.headers.signature ?? req.headers["verif-hash"] ?? "") as string;
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString("utf8")
      : JSON.stringify(req.body);
    console.log(
      "[PAYCHANGU] Webhook HTTP hit:",
      safeJsonStringify({
        receivedAt: new Date().toISOString(),
        ip: req.ip,
        signaturePresent: Boolean(sig),
        headers: req.headers,
        body: parseJsonIfPossible(rawBody),
      }),
    );
    const data = await paymentsService.handlePaychanguWebhook(req.body, sig);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

function parseJsonIfPossible(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export async function paychanguCallbackController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const txRef = String(req.query.tx_ref ?? req.query.transaction_id ?? "");
    const data = await paymentsService.verifyAndFinalizeByTxRef(txRef);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function verifyPaymentController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await paymentsService.verifyPayment(req.params.paymentId, req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listPassengerTransactionsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await paymentsService.listPassengerTransactions(req.user!.sub, page, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listDriverTransactionsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await paymentsService.listDriverTransactions(req.user!.sub, page, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listAdminTransactionsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 70;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const data = await paymentsService.listAdminTransactions({ page, limit, status, search });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getTransactionController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await paymentsService.getTransactionById(req.params.id, req.user!.sub);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getPaymentStatusController(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await paymentsService.getPaymentStatus(
      req.params.bookingId,
      req.user!.sub,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function adminRefundController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await paymentsService.adminRefund(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
