// Production value of one logged entry.
// Normal products are priced per unit (quantity x price); products with
// pricing_unit = 'kg' are priced per kg (weight x price).
export const isKg = (p) => p?.pricing_unit === 'kg';
export const entryValue = (qty, weight, p) =>
  (isKg(p) ? Number(weight || 0) : Number(qty || 0)) * Number(p?.selling_price || 0);
export const priceUnitLabel = (p) => (isKg(p) ? 'kg' : 'unit');
