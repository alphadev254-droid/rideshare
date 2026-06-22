import { z } from "zod";
import dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");
dotenv.config({ path: envPath });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGINS: z.string().default("http://localhost:8080"),
  APP_URL: z.string().default("http://localhost:8080"),
  FRONTEND_URL: z.string().default(""),
  API_URL: z.string().default("http://localhost:5000"),
  REDIS_URL: z.string().default(""),
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default(""),
  REDIS_QUEUE_PREFIX: z.string().default("rideshare"),
  QUEUE_WORKERS_ENABLED: z.coerce.boolean().default(true),
  PAYMENT_WEBHOOK_QUEUE_CONCURRENCY: z.coerce.number().default(5),
  NOTIFICATION_QUEUE_CONCURRENCY: z.coerce.number().default(10),
  WITHDRAWAL_QUEUE_CONCURRENCY: z.coerce.number().default(5),
  WITHDRAWAL_PROCESSING_TIMEOUT_MINUTES: z.coerce.number().default(30),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be >= 32 chars"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be >= 32 chars"),
  JWT_ACCESS_EXPIRES: z.string().default("15m"),
  JWT_REFRESH_EXPIRES: z.string().default("30d"),

  AT_API_KEY: z.string().default(""),
  AT_USERNAME: z.string().default("sandbox"),
  AT_SENDER_ID: z.string().default("RideShare"),
  SMS_DEFAULT_COUNTRY_CODE: z.string().default("+265"),

  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("RideShare <info@chepetsaride.com>"),

  FIREBASE_SERVICE_ACCOUNT_PATH: z
    .string()
    .default("./firebase-service-account.json"),

  GOOGLE_MAPS_API_KEY: z.string().default(""),
  MAPBOX_ACCESS_TOKEN: z.string().default(""),
  MAPBOX_REVERSE_GEOCODE_MIN_DISTANCE_METERS: z.coerce.number().default(75),
  MAPBOX_REVERSE_GEOCODE_MIN_INTERVAL_SECONDS: z.coerce.number().default(20),

  PAYCHANGU_SECRET_KEY: z.string().default(""),
  PAYCHANGU_PUBLIC_KEY: z.string().default(""),
  PAYCHANGU_BASE_URL: z.string().default("https://api.paychangu.com"),
  PAYCHANGU_WEBHOOK_SECRET: z.string().default(""),
  PAYCHANGU_TRANSACTION_FEE_RATE: z.coerce.number().default(0.038),
  PAYCHANGU_MIN_AMOUNT_MWK: z.coerce.number().default(50),
  PAYCHANGU_AIRTEL_MONEY_OPERATOR_REF_ID: z.string().default(""),
  PAYCHANGU_TNM_MPAMBA_OPERATOR_REF_ID: z.string().default(""),
  WITHDRAWAL_MOBILE_MONEY_FEE_RATE: z.coerce.number().default(0.03),
  WITHDRAWAL_BANK_FEE_RATE: z.coerce.number().default(0.01),
  WITHDRAWAL_BANK_FIXED_FEE: z.coerce.number().default(700),

  IMAGEKIT_PUBLIC_KEY: z.string().default(""),
  IMAGEKIT_PRIVATE_KEY: z.string().default(""),
  IMAGEKIT_URL_ENDPOINT: z.string().default(""),

  COMMISSION_RATE: z.coerce.number().default(0.15),
  SYSTEM_FEE_RATE: z.coerce.number().default(0.03),
  REFUND_CONVENIENCE_FEE_RATE: z.coerce.number().default(0.05),
  DRIVER_REFUND_CONVENIENCE_SHARE_RATE: z.coerce.number().default(0.5),
  OTP_TTL_SECONDS: z.coerce.number().default(300),
  SECRET_CODE_TTL_HOURS: z.coerce.number().default(2),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
