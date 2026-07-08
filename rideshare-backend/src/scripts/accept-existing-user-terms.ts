import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function countMissingTerms() {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM users
    WHERE terms_accepted = false
  `;
  return rows[0]?.count ?? 0n;
}

async function main() {
  const before = await countMissingTerms();
  console.log(`[TERMS] Users missing terms acceptance before backfill: ${before.toString()}`);

  const updated = await prisma.$executeRaw`
    UPDATE users
    SET
      terms_accepted = true,
      terms_accepted_at = COALESCE(terms_accepted_at, created_at, NOW())
    WHERE terms_accepted = false
  `;

  const after = await countMissingTerms();
  console.log(`[TERMS] Users updated: ${updated}`);
  console.log(`[TERMS] Users missing terms acceptance after backfill: ${after.toString()}`);
}

main()
  .catch((error) => {
    console.error("[TERMS] Backfill failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
