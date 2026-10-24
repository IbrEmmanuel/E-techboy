import Decimal from "decimal.js";

export type TariffSlice = {
  ratePerKwh: Decimal.Value;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export type CostResult = {
  amount: Decimal;
  currency: string;
  estimated: true;
  incomplete: boolean;
  breakdown: { from: Date; to: Date; kwh: Decimal; rate: Decimal; amount: Decimal }[];
};

export function applyTariff(energyKwh: Decimal.Value, at: Date, tariffs: TariffSlice[], currency: string): CostResult {
  const energy = new Decimal(energyKwh);
  const applicable = tariffs
    .filter((t) => t.effectiveFrom <= at && (!t.effectiveTo || t.effectiveTo > at))
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];

  if (!applicable) {
    return {
      amount: new Decimal(0),
      currency,
      estimated: true,
      incomplete: true,
      breakdown: [],
    };
  }
  const rate = new Decimal(applicable.ratePerKwh);
  const amount = energy.mul(rate).toDecimalPlaces(4);
  return {
    amount,
    currency,
    estimated: true,
    incomplete: false,
    breakdown: [{ from: applicable.effectiveFrom, to: applicable.effectiveTo ?? at, kwh: energy, rate, amount }],
  };
}

export function costForPeriod(
  slices: { start: Date; end: Date; energyKwh: Decimal.Value }[],
  tariffs: TariffSlice[],
  currency: string,
  incomplete: boolean,
): CostResult {
  const breakdown: CostResult["breakdown"] = [];
  let amount = new Decimal(0);
  let missing = incomplete;

  for (const slice of slices) {
    const rateRow = tariffs
      .filter((t) => t.effectiveFrom <= slice.start && (!t.effectiveTo || t.effectiveTo > slice.start))
      .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
    if (!rateRow) {
      missing = true;
      continue;
    }
    const rate = new Decimal(rateRow.ratePerKwh);
    const kwh = new Decimal(slice.energyKwh);
    const part = kwh.mul(rate).toDecimalPlaces(4);
    amount = amount.plus(part);
    breakdown.push({ from: slice.start, to: slice.end, kwh, rate, amount: part });
  }

  return { amount: amount.toDecimalPlaces(4), currency, estimated: true, incomplete: missing, breakdown };
}
