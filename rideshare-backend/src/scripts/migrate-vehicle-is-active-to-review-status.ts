import { prisma } from "../config/prisma.js";

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TYPE "VehicleReviewStatus" ADD VALUE IF NOT EXISTS 'deleted'`);

  const columnRows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'vehicles'
        AND column_name = 'is_active'
    ) AS exists
  `;

  if (!columnRows[0]?.exists) {
    console.log("Vehicle is_active column is already gone. Nothing to migrate.");
    return;
  }

  const updated = await prisma.$executeRawUnsafe(
    `UPDATE vehicles
     SET review_status = 'deleted'::"VehicleReviewStatus"
     WHERE is_active = false
       AND review_status <> 'deleted'::"VehicleReviewStatus"`,
  );

  console.log(`Marked ${updated} inactive vehicle(s) as deleted.`);
}

main()
  .catch((error) => {
    console.error("Failed to migrate vehicle statuses", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
