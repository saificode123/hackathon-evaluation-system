export type IdPrefix = "T" | "P";

const ID_PATTERNS: Record<IdPrefix, RegExp> = {
  T: /^T\d{3}$/,
  P: /^P\d{3}$/,
};

/** Normalize while typing: uppercase prefix + max 3 digits (e.g. t001 → T001). */
export function formatPrefixedId(prefix: IdPrefix, raw: string): string {
  if (!raw) return "";

  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let digits: string;

  if (cleaned.startsWith(prefix)) {
    digits = cleaned.slice(1).replace(/\D/g, "");
  } else if (/^[TP]/.test(cleaned)) {
    digits = cleaned.slice(1).replace(/\D/g, "");
  } else {
    digits = cleaned.replace(/\D/g, "");
  }

  digits = digits.slice(0, 3);

  if (digits.length === 0) {
    return cleaned.startsWith(prefix) ? prefix : "";
  }

  return prefix + digits;
}

export function isValidPrefixedId(prefix: IdPrefix, value: string): boolean {
  return ID_PATTERNS[prefix].test(value.trim().toUpperCase());
}

export function prefixedIdError(prefix: IdPrefix, label: string): string {
  return `${label} must be ${prefix} followed by exactly 3 digits (e.g. ${prefix}001).`;
}

/** Case-insensitive key for comparing team/problem IDs. */
export function normalizePrefixedIdKey(value: string): string {
  return value.trim().toUpperCase();
}
