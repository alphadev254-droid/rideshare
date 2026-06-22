import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
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
      const exists = await client.query(
        "SELECT id FROM _migrations WHERE name = $1",
        [file],
      );
      if (exists.rowCount && exists.rowCount > 0) {
        console.log(`  ✓ ${file} already applied`);
        continue;
      }

      const sql = readFileSync(join(__dirname, "migrations", file), "utf-8");
      console.log(`  ↳ Applying ${file}…`);
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      console.log(`  ✓ ${file} applied`);
    }

    console.log("✅ All migrations complete");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
