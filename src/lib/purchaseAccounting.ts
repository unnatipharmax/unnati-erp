type PurchaseAmountItem = {
  quantity: number;
  rate: number;
  taxableAmount?: number | null;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
};

function toNumber(value: number | string | null | undefined) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function getPurchaseTaxes(item: PurchaseAmountItem) {
  return roundMoney(
    toNumber(item.cgstAmount) +
    toNumber(item.sgstAmount) +
    toNumber(item.igstAmount)
  );
}

export function getPurchaseBillLineAmount(item: PurchaseAmountItem) {
  const base = toNumber(item.taxableAmount) > 0
    ? toNumber(item.taxableAmount)
    : toNumber(item.rate) * toNumber(item.quantity);

  return roundMoney(base + getPurchaseTaxes(item));
}

export function getCreditNoteLineAmount(item: PurchaseAmountItem) {
  const grossBase = Math.max(
    toNumber(item.rate) * toNumber(item.quantity),
    toNumber(item.taxableAmount)
  );

  return roundMoney(grossBase + getPurchaseTaxes(item));
}

export function getPurchaseBillAmount(items: PurchaseAmountItem[]) {
  return roundMoney(items.reduce((sum, item) => sum + getPurchaseBillLineAmount(item), 0));
}

export function getCreditNoteAmount(items: PurchaseAmountItem[]) {
  return roundMoney(items.reduce((sum, item) => sum + getCreditNoteLineAmount(item), 0));
}
