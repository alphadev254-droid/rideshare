import { Queue, Worker, type JobsOptions } from "bullmq";
import { getRedisConnection } from "../config/redis.js";
import { env } from "../config/env.js";
import { sendCustomEmail, sendEmergencyAlert, sendOtp, sendSecretCode } from "../lib/sms.js";
import { sendPushNotification } from "../lib/fcm.js";

export type PaymentWebhookJob = {
  txRef: string;
};

export type WithdrawalJob = {
  withdrawalId: string;
};

export type WithdrawalTimeoutJob = {
  withdrawalId: string;
};

export type NotificationJob =
  | { type: "email"; to: string; subject: string; text: string; html?: string }
  | { type: "otp"; recipient: string; otp: string; html?: string }
  | { type: "secret_code"; phone: string; code: string; driverName: string; route: string }
  | { type: "emergency_alert"; phone: string; passengerName: string; route: string; tripId: string }
  | { type: "push"; token: string; title: string; body: string; data?: Record<string, string> };

const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
  removeOnFail: { age: 60 * 60 * 24 * 7, count: 5000 },
};

const PAYMENT_WEBHOOK_QUEUE_NAME = "payments-webhooks";
const NOTIFICATION_QUEUE_NAME = "notifications";
const WITHDRAWAL_QUEUE_NAME = "withdrawals";
const WITHDRAWAL_TIMEOUT_QUEUE_NAME = "withdrawals-timeout";

const queuePrefix = `{${env.REDIS_QUEUE_PREFIX}}`;

export const paymentWebhookQueue = new Queue<PaymentWebhookJob>(PAYMENT_WEBHOOK_QUEUE_NAME, {
  connection: getRedisConnection(),
  prefix: queuePrefix,
  defaultJobOptions,
});

export const notificationQueue = new Queue<NotificationJob>(NOTIFICATION_QUEUE_NAME, {
  connection: getRedisConnection(),
  prefix: queuePrefix,
  defaultJobOptions,
});

export const withdrawalQueue = new Queue<WithdrawalJob>(WITHDRAWAL_QUEUE_NAME, {
  connection: getRedisConnection(),
  prefix: queuePrefix,
  defaultJobOptions,
});

export const withdrawalTimeoutQueue = new Queue<WithdrawalTimeoutJob>(WITHDRAWAL_TIMEOUT_QUEUE_NAME, {
  connection: getRedisConnection(),
  prefix: queuePrefix,
  defaultJobOptions,
});

const workers: Worker[] = [];

export async function enqueuePaymentWebhook(txRef: string) {
  await paymentWebhookQueue.add("paychangu.verify", { txRef }, { jobId: `paychangu-${txRef}` });
}

export async function enqueueNotification(job: NotificationJob) {
  await notificationQueue.add(job.type, job);
}

export async function enqueueWithdrawal(withdrawalId: string) {
  await withdrawalQueue.add("wallet.withdrawal", { withdrawalId }, { jobId: `withdrawal-${withdrawalId}` });
}

export async function enqueueWithdrawalTimeout(withdrawalId: string, delayMs: number) {
  await withdrawalTimeoutQueue.add(
    "wallet.timeout",
    { withdrawalId },
    { jobId: `timeout-${withdrawalId}`, delay: delayMs, removeOnComplete: true, removeOnFail: true },
  );
}

export function startQueueWorkers() {
  if (!env.QUEUE_WORKERS_ENABLED) {
    console.log("[QUEUE] Workers disabled by QUEUE_WORKERS_ENABLED=false");
    return;
  }
  if (workers.length > 0) return;

  workers.push(
    new Worker<PaymentWebhookJob>(
      PAYMENT_WEBHOOK_QUEUE_NAME,
      async (job) => {
        const { verifyAndFinalizeByTxRef } = await import("../modules/payments/payments.service.js");
        await verifyAndFinalizeByTxRef(job.data.txRef);
      },
      {
        connection: getRedisConnection(),
        prefix: queuePrefix,
        concurrency: env.PAYMENT_WEBHOOK_QUEUE_CONCURRENCY,
      },
    ),
  );

  workers.push(
    new Worker<WithdrawalJob>(
      WITHDRAWAL_QUEUE_NAME,
      async (job) => {
        const { processWithdrawalRequest } = await import("../modules/wallet/wallet.service.js");
        await processWithdrawalRequest(job.data.withdrawalId);
      },
      {
        connection: getRedisConnection(),
        prefix: queuePrefix,
        concurrency: env.WITHDRAWAL_QUEUE_CONCURRENCY,
      },
    ),
  );

  workers.push(
    new Worker<WithdrawalTimeoutJob>(
      WITHDRAWAL_TIMEOUT_QUEUE_NAME,
      async (job) => {
        const { handleWithdrawalTimeout } = await import("../modules/wallet/wallet.service.js");
        await handleWithdrawalTimeout(job.data.withdrawalId);
      },
      {
        connection: getRedisConnection(),
        prefix: queuePrefix,
      },
    ),
  );

  workers.push(
    new Worker<NotificationJob>(
      NOTIFICATION_QUEUE_NAME,
      async (job) => {
        const data = job.data;
        switch (data.type) {
          case "email":
            await sendCustomEmail(data.to, data.subject, data.text, data.html);
            return;
          case "otp":
            if (data.html && /@/.test(data.recipient)) {
              await sendCustomEmail(data.recipient, "Your ChepetsaRide verification code", `Your ChepetsaRide verification code is ${data.otp}. Valid for 5 minutes. Do not share this code.`, data.html);
            } else {
              await sendOtp(data.recipient, data.otp);
            }
            return;
          case "secret_code":
            await sendSecretCode(data.phone, data.code, data.driverName, data.route);
            return;
          case "emergency_alert":
            await sendEmergencyAlert(data.phone, data.passengerName, data.route, data.tripId);
            return;
          case "push":
            await sendPushNotification(data.token, data.title, data.body, data.data);
            return;
        }
      },
      {
        connection: getRedisConnection(),
        prefix: queuePrefix,
        concurrency: env.NOTIFICATION_QUEUE_CONCURRENCY,
      },
    ),
  );

  for (const worker of workers) {
    worker.on("failed", (job, err) => {
      console.error(`[QUEUE] ${worker.name} job ${job?.id ?? "unknown"} failed:`, err.message);
    });
  }

  console.log("[QUEUE] Workers started");
}

export async function closeQueueWorkers() {
  await Promise.all(workers.map((worker) => worker.close()));
  workers.length = 0;
  await Promise.all([paymentWebhookQueue.close(), notificationQueue.close(), withdrawalQueue.close(), withdrawalTimeoutQueue.close()]);
}
