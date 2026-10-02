/** A positive number, or an error string to show under the field. */
export function validatePositiveNumber(value, label) {
  if (value === '' || value === null || value === undefined) {
    return `Enter ${label.toLowerCase()}.`;
  }
  const num = Number(value);
  if (Number.isNaN(num)) return `${label} must be a number.`;
  if (num <= 0) return `${label} must be greater than zero.`;
  return null;
}
