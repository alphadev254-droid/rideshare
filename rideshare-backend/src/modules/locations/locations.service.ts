import { prisma } from "../../config/prisma.js";

export async function getDistricts(): Promise<string[]> {
  const rows = await prisma.malawiLocation.findMany({
    select: { district: true },
    distinct: ["district"],
    orderBy: { district: "asc" },
  });
  return rows.map((r) => r.district);
}
