import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";

type Args = {
  email?: string;
  phone?: string;
  password?: string;
  fullName?: string;
};

function readArgs(): Args {
  const args: Args = {
    email: process.env.ADMIN_EMAIL,
    phone: process.env.ADMIN_PHONE,
    password: process.env.ADMIN_PASSWORD,
    fullName: process.env.ADMIN_FULL_NAME,
  };

  for (const raw of process.argv.slice(2)) {
    const [key, ...valueParts] = raw.replace(/^--/, "").split("=");
    const value = valueParts.join("=").trim();
    if (!value) continue;
    if (key === "email") args.email = value;
    if (key === "phone") args.phone = value;
    if (key === "password") args.password = value;
    if (key === "name" || key === "fullName") args.fullName = value;
  }

  return args;
}

function requireValue(value: string | undefined, label: string) {
  if (!value?.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

async function main() {
  const args = readArgs();
  const phone = requireValue(args.phone, "ADMIN_PHONE or --phone");
  const password = requireValue(args.password, "ADMIN_PASSWORD or --password");
  const email = args.email?.trim() || null;
  const fullName = args.fullName?.trim() || "System Administrator";

  if (password.length < 8) throw new Error("Admin password must be at least 8 characters");

  const existingByPhone = await prisma.user.findUnique({ where: { phone } });
  const existingByEmail = email ? await prisma.user.findUnique({ where: { email } }) : null;

  if (existingByPhone && existingByEmail && existingByPhone.id !== existingByEmail.id) {
    throw new Error("ADMIN_PHONE and ADMIN_EMAIL belong to two different users. Resolve that before creating admin.");
  }

  const existing = existingByPhone ?? existingByEmail;
  const passwordHash = await bcrypt.hash(password, 12);

  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        phone,
        email,
        fullName,
        passwordHash,
        role: "admin",
        isActive: true,
        isVerified: true,
      },
      select: { id: true, fullName: true, phone: true, email: true, role: true },
    });
    console.log(`Admin updated: ${user.fullName} (${user.phone}) ${user.email ?? ""}`.trim());
    return;
  }

  const user = await prisma.user.create({
    data: {
      phone,
      email,
      fullName,
      passwordHash,
      role: "admin",
      isActive: true,
      isVerified: true,
    },
    select: { id: true, fullName: true, phone: true, email: true, role: true },
  });

  console.log(`Admin created: ${user.fullName} (${user.phone}) ${user.email ?? ""}`.trim());
}

main()
  .catch((error) => {
    console.error("Failed to create admin:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
