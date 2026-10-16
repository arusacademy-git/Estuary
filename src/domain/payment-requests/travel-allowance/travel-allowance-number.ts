export function formatTravelAllowanceNumber(
  year: number,
  month: number,
  sequence: number,
) {
  const shortYear = String(year).slice(-2);
  const paddedMonth = String(month).padStart(2, '0');
  const paddedSequence = String(sequence).padStart(2, '0');

  return `TA${shortYear}-${paddedMonth}-${paddedSequence}`;
}
