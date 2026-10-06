export function parsePaymentAmountInput(
  value: string,
) {
  const normalizedValue = value
    .replace(/,/g, '')
    .replace(/^RM\s*/i, '')
    .trim();

  if (!normalizedValue) {
    return 0;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : 0;
}