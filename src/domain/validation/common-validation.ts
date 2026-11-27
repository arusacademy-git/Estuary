export type FieldErrors<T extends string = string> = Partial<Record<T, string>>;

export const requiredText = (value: unknown, label: string) =>
  typeof value === "string" && value.trim()
    ? undefined
    : `${label} is required.`;

export const validEmail = (value: string, label = "Email") => {
  if (!value.trim()) return `${label} is required.`;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? undefined
    : `Enter a valid ${label.toLowerCase()}.`;
};

export const positiveNumber = (value: number, label: string) =>
  Number.isFinite(value) && value > 0
    ? undefined
    : `${label} must be greater than 0.`;

export const nonNegativeNumber = (value: number, label: string) =>
  Number.isFinite(value) && value >= 0
    ? undefined
    : `${label} must be 0 or greater.`;

export const validDate = (value: string, label = "Date") => {
  if (!value.trim()) return `${label} is required.`;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? `Enter a valid ${label.toLowerCase()}.`
    : undefined;
};

export const validHttpUrl = (value: string, label = "Link") => {
  if (!value.trim()) return `${label} is required.`;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? undefined
      : `Enter a valid ${label.toLowerCase()} beginning with http:// or https://.`;
  } catch {
    return `Enter a valid ${label.toLowerCase()} beginning with http:// or https://.`;
  }
};

export function hasValidationErrors(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some((entry) =>
    typeof entry === "object" ? hasValidationErrors(entry) : Boolean(entry),
  );
}
