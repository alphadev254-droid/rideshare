import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { prisma } from "../config/prisma.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        name       TEXT        NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const migrations = [
      "001_schema.sql",
      "002_review_requested_at.sql",
      "003_trip_duration.sql",
      "004_vehicle_images.sql",
      "005_paychangu_transactions.sql",
      "006_pending_payments_before_booking.sql",
    ];

    for (const file of migrations) {
      const exists = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM _migrations WHERE name = ${file}
      `;
      if (exists.length > 0) {
        console.log(`  - ${file} already applied`);
        continue;
      }

      const sql = readFileSync(join(__dirname, "migrations", file), "utf-8");
      console.log(`  Applying ${file}...`);
      await prisma.$executeRawUnsafe(sql);
      await prisma.$executeRaw`INSERT INTO _migrations (name) VALUES (${file})`;
      console.log(`  - ${file} applied`);
    }

    console.log("All migrations complete");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();