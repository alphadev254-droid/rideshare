import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import app from "./app.js";
import { env } from "./config/env.js";
import { checkDbConnection } from "./config/prisma.js";
import { checkRedisConnection, closeRedisConnection, getRedisConnection } from "./config/redis.js";
import { closeQueueWorkers, startQueueWorkers } from "./jobs/queue.js";
import { registerGpsHandlers } from "./socket/gps.socket.js";

async function bootstrap() {
  await checkDbConnection();
  await checkRedisConnection();
  startQueueWorkers();

  const httpServer = createServer(app);

  const io = new SocketServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  const socketRedisPub = getRedisConnection().duplicate();
  const socketRedisSub = getRedisConnection().duplicate();
  await Promise.all([socketRedisPub.connect(), socketRedisSub.connect()]);
  io.adapter(createAdapter(socketRedisPub, socketRedisSub));

  registerGpsHandlers(io);

  httpServer.listen(env.PORT, () => {
    console.log(`🚀 ChepetsaRide API running on http://localhost:${env.PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   WebSocket:   enabled`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down gracefully`);
    httpServer.close(async () => {
      await closeQueueWorkers();
      await Promise.allSettled([socketRedisPub.quit(), socketRedisSub.quit()]);
      await closeRedisConnection();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  console.error("❌ Server failed to start:", err);
  process.exit(1);
});
