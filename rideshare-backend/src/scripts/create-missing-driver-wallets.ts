import { prisma } from "../config/prisma.js";

async function main() {
  const drivers = await prisma.driverProfile.findMany({
    where: {
      isApproved: true,
      wallet: null,
    },
    select: {
      id: true,
      user: { select: { fullName: true, phone: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (drivers.length === 0) {
    console.log("No approved drivers are missing wallets.");
    return;
  }

  const created = await prisma.$transaction(
    drivers.map((driver) =>
      prisma.driverWallet.create({
        data: { driverId: driver.id },
        select: { id: true, driverId: true },
      }),
    ),
  );

  console.log(`Created ${created.length} driver wallet(s).`);
  for (const driver of drivers) {
    console.log(`- ${driver.user.fullName} (${driver.user.phone})`);
  }
}

main()
  .catch((error) => {
    console.error("Failed to create missing driver wallets:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
