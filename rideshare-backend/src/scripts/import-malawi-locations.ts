import fs from "fs";
import path from "path";
import readline from "readline";
import { prisma } from "../config/prisma.js";

type LocationRow = {
  id: number;
  region: string;
  district: string;
  traditionalAuthority: string | null;
  village: string | null;
  createdAt: Date;
  updatedAt: Date;
  country: string;
};

const csvPath = path.resolve(process.cwd(), "locations.csv");
const batchSize = 1000;

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseDate(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
}

function toRow(values: string[]): LocationRow {
  return {
    id: Number(values[0]),
    region: values[1] ?? "",
    district: values[2] ?? "",
    traditionalAuthority: values[3] || null,
    village: values[4] || null,
    createdAt: parseDate(values[5] ?? new Date().toISOString()),
    updatedAt: parseDate(values[6] ?? new Date().toISOString()),
    country: values[7] || "Malawi",
  };
}

async function flush(rows: LocationRow[]) {
  if (rows.length === 0) return 0;
  const result = await prisma.malawiLocation.createMany({
    data: rows,
    skipDuplicates: true,
  });
  return result.count;
}

async function main() {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  if (process.env.LOCATIONS_IMPORT_TRUNCATE === "true") {
    const deleted = await prisma.malawiLocation.deleteMany();
    console.log(`[locations] Cleared ${deleted.count} existing rows`);
  }

  const stream = readline.createInterface({
    input: fs.createReadStream(csvPath),
    crlfDelay: Infinity,
  });

  let headersRead = false;
  let processed = 0;
  let inserted = 0;
  let batch: LocationRow[] = [];

  for await (const line of stream) {
    if (!headersRead) {
      headersRead = true;
      continue;
    }
    if (!line.trim()) continue;

    const row = toRow(parseCsvLine(line));
    if (!Number.isFinite(row.id) || !row.region || !row.district) {
      console.warn(`[locations] Skipping invalid row around line ${processed + 2}`);
      continue;
    }

    batch.push(row);
    processed += 1;

    if (batch.length >= batchSize) {
      inserted += await flush(batch);
      console.log(`[locations] Processed ${processed}, inserted ${inserted}`);
      batch = [];
    }
  }

  inserted += await flush(batch);
  console.log(`[locations] Done. Processed ${processed}, inserted ${inserted}`);
}

main()
  .catch((error) => {
    console.error("[locations] Import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
