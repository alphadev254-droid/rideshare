import type { ComfortClass } from "../types/index.js";

interface FareConfig {
  baseFareMwk: number;
  perKmRateMwk: number;
  comfortMultiplier: Record<ComfortClass, number>;
}

const DEFAULT_CONFIG: FareConfig = {
  baseFareMwk: 1500,
  perKmRateMwk: 120,
  comfortMultiplier: {
    economy: 1.0,
    standard: 1.3,
    comfort: 1.7,
  },
};

export function calculateFare(
  distanceKm: number,
  comfortClass: ComfortClass,
  config: Partial<FareConfig> = {},
): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const rawFare =
    (cfg.baseFareMwk + distanceKm * cfg.perKmRateMwk) *
    cfg.comfortMultiplier[comfortClass];
  return Math.round(rawFare / 100) * 100;
}

export function calculateCommission(
  fareMwk: number,
  rate: number,
): { commission: number; net: number } {
  const commission = Math.round(fareMwk * rate);
  return { commission, net: fareMwk - commission };
}
