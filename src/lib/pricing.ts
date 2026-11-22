export const MRP_BELOW_PRICE_MESSAGE = 'MRP must be the same as or higher than the sale price';

export function percentOff(pricePaise: number, mrpPaise: number | null | undefined): number {
  if (mrpPaise == null || mrpPaise <= pricePaise) return 0;
  return Math.floor(((mrpPaise - pricePaise) * 100) / mrpPaise);
}

export function savingsPaise(pricePaise: number, mrpPaise: number | null | undefined, quantity: number): number {
  if (mrpPaise == null || mrpPaise <= pricePaise) return 0;
  return (mrpPaise - pricePaise) * quantity;
}
