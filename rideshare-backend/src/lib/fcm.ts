import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import { env } from "../config/env.js";

let initialized = false;

function initFirebase(): void {
  if (initialized) return;
  if (!existsSync(env.FIREBASE_SERVICE_ACCOUNT_PATH)) {
    console.warn("[FCM] Service account file not found — push notifications disabled");
    return;
  }
  const serviceAccount = JSON.parse(
    readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf-8"),
  );
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  initialized = true;
}

initFirebase();

export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (!initialized) return;
  await admin.messaging().send({
    token: fcmToken,
    notification: { title, body },
    data,
    android: { priority: "high" },
    apns: { payload: { aps: { contentAvailable: true } } },
  });
}

export async function sendMulticastNotification(
  fcmTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (!initialized || fcmTokens.length === 0) return;
  await admin.messaging().sendEachForMulticast({
    tokens: fcmTokens,
    notification: { title, body },
    data,
  });
}
