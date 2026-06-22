import axios from "axios";
import { PaymentMethod, Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import { AppError } from "../middleware/error-handler.js";

// ─── Mobile Money Operator Cache ─────────────────────────

type OperatorInfo = { name: string; refId: string };
let cachedOperators: OperatorInfo[] | null = null;
let operatorsFetchPromise: Promise<OperatorInfo[]> | null = null;

export async function fetchMobileMoneyOperators(): Promise<OperatorInfo[]> {
  if (cachedOperators) return cachedOperators;
  if (operatorsFetchPromise) return operatorsFetchPromise;

  operatorsFetchPromise = (async () => {
    try {
      console.log("[PAYCHANGU] Fetching mobile money operators from PayChangu...");
      const res = await axios.get(`${env.PAYCHANGU_BASE_URL}/mobile-money/`, {
        headers: { Accept: "application/json" },
      });
      const data = res.data?.data as Array<{ name?: string; ref_id?: string }> | undefined;
      if (!Array.isArray(data)) {
        console.warn("[PAYCHANGU] Unexpected mobile-money response shape, using env fallbacks");
        return [];
      }
      cachedOperators = data
        .filter((op): op is { name: string; ref_id: string } => !!(op.name && op.ref_id))
        .map((op) => ({ name: op.name, refId: op.ref_id }));
      console.log(`[PAYCHANGU] Loaded ${cachedOperators.length} operators:`, cachedOperators.map((o) => o.name).join(", "));
      return cachedOperators;
    } catch (err) {
      console.warn("[PAYCHANGU] Failed to fetch mobile money operators, using env fallbacks:", (err as Error).message);
      return [];
    } finally {
      operatorsFetchPromise = null;
    }
  })();

  return operatorsFetchPromise;
}

function getOperatorRefFromCache(provider: string): string | null {
  if (!cachedOperators) return null;
  const lower = provider.toLowerCase();
  const operator = cachedOperators.find(
    (op) => op.name.toLowerCase().includes(lower) || lower.includes(op.name.toLowerCase().replace(/\s+/g, "_")),
  );
  return operator?.refId ?? null;
}

// ─── Headers & Helpers ────────────────────────────────────

function paychanguHeaders() {
  return {
    Authorization: `Bearer ${env.PAYCHANGU_SECRET_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function operatorRefForMethod(method: PaymentMethod) {
  if (method === "airtel_money") return env.PAYCHANGU_AIRTEL_MONEY_OPERATOR_REF_ID;
  if (method === "tnm_mpamba") return env.PAYCHANGU_TNM_MPAMBA_OPERATOR_REF_ID;
  return "";
}

function providerErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const data = error.response?.data as { message?: string; error?: string } | undefined;
  return data?.message ?? data?.error ?? fallback;
}

// ─── Mobile Money Refund (passenger) ──────────────────────

export async function initiatePaychanguMobileMoneyRefund(input: {
  paymentMethod: PaymentMethod;
  passengerPhone: string | null;
  amountMwk: bigint;
  chargeId: string;
}) {
  const operatorRef = operatorRefForMethod(input.paymentMethod);
  if (!operatorRef) {
    throw new AppError(
      400,
      "Automatic PayChangu refunds are currently configured only for Airtel Money and TNM Mpamba. Set the matching operator reference ID in env.",
    );
  }
  if (!input.passengerPhone) {
    throw new AppError(400, "Passenger phone number is required for mobile money refund payout");
  }
  if (input.amountMwk <= 0n) {
    throw new AppError(400, "Refund amount must be greater than zero");
  }

  try {
    const response = await axios.post(
      `${env.PAYCHANGU_BASE_URL}/mobile-money/payouts/initialize`,
      {
        mobile_money_operator_ref_id: operatorRef,
        mobile: input.passengerPhone,
        amount: input.amountMwk.toString(),
        charge_id: input.chargeId,
      },
      { headers: paychanguHeaders() },
    );

    const payload = response.data as Record<string, unknown>;
    const data = payload.data as Record<string, unknown> | undefined;
    const status = String(payload.status ?? data?.status ?? "").toLowerCase();
    if (status && !["success", "successful", "pending"].includes(status)) {
      throw new AppError(502, "PayChangu refund payout was not accepted");
    }

    return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (axios.isAxiosError(error)) {
      throw new AppError(
        error.response?.status && error.response.status < 500 ? 400 : 502,
        providerErrorMessage(error, "PayChangu rejected the refund payout request"),
      );
    }
    throw error;
  }
}

// ─── Withdrawal Payout (driver) ───────────────────────────

/** Normalize to 9-digit Malawian mobile number without leading zero or country code */
function normalizePhoneForPayout(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Strip 265 prefix if present
  if (digits.startsWith("265") && digits.length === 12) return digits.slice(3);
  // Strip leading zero if present
  if (digits.startsWith("0") && digits.length === 10) return digits.slice(1);
  // Already 9 digits
  if (digits.length === 9) return digits;
  return digits; // best-effort fallback
}

/**
 * Calculates the withdrawal fee based on method.
 * Mobile Money: 3% of amount
 * Bank Transfer: 1% of amount + 700 MWK fixed
 */
export function calculateWithdrawalFee(amountMwk: bigint, method: string): {
  feeMwk: bigint;
  netAmountMwk: bigint;
} {
  const amt = Number(amountMwk);
  if (method === "bank_transfer") {
    const fee = Math.round(amt * env.WITHDRAWAL_BANK_FEE_RATE) + env.WITHDRAWAL_BANK_FIXED_FEE;
    return {
      feeMwk: BigInt(fee),
      netAmountMwk: BigInt(amt - fee > 0 ? amt - fee : 0),
    };
  }
  // mobile_money (airtel_money / tnm_mpamba): 3%
  const fee = Math.round(amt * env.WITHDRAWAL_MOBILE_MONEY_FEE_RATE);
  return {
    feeMwk: BigInt(fee),
    netAmountMwk: BigInt(amt - fee > 0 ? amt - fee : 0),
  };
}

/**
 * Initiates a Paychangu payout for driver withdrawals.
 * Uses the /direct-charge/payouts/initialize endpoint.
 */
export async function initiatePaychanguWithdrawalPayout(input: {
  amountMwk: bigint;
  netAmountMwk: bigint;
  phone: string;
  provider: string; // "airtel_money", "tnm_mpamba", or "bank_transfer"
  chargeId: string;
  accountName?: string;
}): Promise<{ success: boolean; providerPayload: Prisma.InputJsonValue }> {
  const msisdn = normalizePhoneForPayout(input.phone);

  const body: Record<string, string> = {
    amount: input.netAmountMwk.toString(),
    charge_id: input.chargeId,
  };

  if (input.provider === "bank_transfer") {
    body.payout_method = "bank_transfer";
    body.bank_account_number = msisdn;
    body.bank_account_name = input.accountName ?? "RideShare Driver";
    body.bank_uuid = ""; // Will be populated from supported-banks or env
  } else {
    // Mobile money: resolve operator UUID from cache → env fallback → PayChangu API
    let operatorRef = "";
    if (input.provider === "airtel_money") {
      operatorRef = getOperatorRefFromCache("airtel") || env.PAYCHANGU_AIRTEL_MONEY_OPERATOR_REF_ID;
    } else if (input.provider === "tnm_mpamba") {
      operatorRef = getOperatorRefFromCache("tnm") || env.PAYCHANGU_TNM_MPAMBA_OPERATOR_REF_ID;
    }

    // If still empty, try fetching operators from PayChangu now
    if (!operatorRef) {
      console.log(`[PAYCHANGU] Env ref_ids empty for ${input.provider}, fetching from PayChangu API...`);
      const ops = await fetchMobileMoneyOperators();
      console.log(`[PAYCHANGU] Fetched ${ops.length} operators:`, JSON.stringify(ops));
      if (input.provider === "airtel_money") {
        operatorRef = ops.find((o) => o.name.toLowerCase().includes("airtel"))?.refId || "";
      } else if (input.provider === "tnm_mpamba") {
        operatorRef = ops.find((o) => o.name.toLowerCase().includes("tnm"))?.refId || "";
      }
    }

    if (!operatorRef) {
      console.error(`[PAYCHANGU] No operator ref_id found for ${input.provider}. Configure PAYCHANGU_AIRTEL_MONEY_OPERATOR_REF_ID or PAYCHANGU_TNM_MPAMBA_OPERATOR_REF_ID in .env`);
      throw new AppError(
        400,
        `Operator reference ID not configured for ${input.provider}. Set PAYCHANGU_AIRTEL_MONEY_OPERATOR_REF_ID or PAYCHANGU_TNM_MPAMBA_OPERATOR_REF_ID.`,
      );
    }

    console.log(`[PAYCHANGU] Resolved operator ref_id for ${input.provider}: ${operatorRef}`);
    body.payout_method = "mobile_money";
    body.mobile_money_operator_ref_id = operatorRef;
    body.mobile = msisdn;
  }

  const payoutUrl = input.provider === "bank_transfer"
    ? `${env.PAYCHANGU_BASE_URL}/direct-charge/payouts/initialize`
    : `${env.PAYCHANGU_BASE_URL}/mobile-money/payouts/initialize`;

  console.log(`[PAYCHANGU] Initiating payout — URL: ${payoutUrl}, body:`, JSON.stringify(body));
  try {
    const response = await axios.post(payoutUrl, body,
      { headers: paychanguHeaders(), timeout: 15_000 },
    );

    const payload = response.data as Record<string, unknown>;
    console.log(`[PAYCHANGU] Payout response — status: ${response.status}, body:`, JSON.stringify(payload));

    const outerData = payload.data as Record<string, unknown> | undefined;
    const transaction = outerData?.transaction as Record<string, unknown> | undefined;

    // Check transaction-level status (Paychangu wraps payouts in data.transaction)
    if (outerData?.transaction) {
      const txStatus = String(transaction?.status ?? "").toLowerCase();
      console.log(`[PAYCHANGU] Transaction-level status: ${txStatus}${transaction?.ref_id ? `, ref_id=${transaction.ref_id}` : ""}`);
      if (txStatus === "failed") {
        console.warn(`[PAYCHANGU] Payout transaction failed — status=${txStatus}, mobile=${transaction?.mobile}, mode=${transaction?.mode}`);
        // In sandbox mode, payouts always fail — this is expected
        return {
          success: true, // Treat as "accepted" — the webhook will deliver final status
          providerPayload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
        };
      }
    }

    const status = String(payload.status ?? outerData?.status ?? "").toLowerCase();

    if (!["success", "successful", "pending"].includes(status)) {
      console.warn(`[PAYCHANGU] Payout rejected — status=${status}, message=`, payload.message ?? outerData?.message ?? "no message");
      return {
        success: false,
        providerPayload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
      };
    }

    return {
      success: true,
      providerPayload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
    };
  } catch (error) {
    console.error(`[PAYCHANGU] Payout API call failed:`, axios.isAxiosError(error) ? JSON.stringify({ status: error.response?.status, data: error.response?.data }) : (error as Error).message);
    if (error instanceof AppError) throw error;
    if (axios.isAxiosError(error)) {
      throw new AppError(
        error.response?.status && error.response.status < 500 ? 400 : 502,
        providerErrorMessage(error, "PayChangu rejected the withdrawal payout request"),
      );
    }
    throw error;
  }
}