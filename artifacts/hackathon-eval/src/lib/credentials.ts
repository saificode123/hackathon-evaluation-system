const EMAIL_DOMAIN = "cust.edu.pk";
const PASSWORD_SUFFIX = "hack2026";

/** Split a full name into lowercase parts. */
function nameParts(name: string): string[] {
  return name.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * "Hassan Ali" → "hassan.ali@cust.edu.pk"
 */
export function generateEvaluatorEmail(name: string): string {
  const parts = nameParts(name);
  if (parts.length === 0) return `evaluator@${EMAIL_DOMAIN}`;
  return `${parts.join(".")}@${EMAIL_DOMAIN}`;
}

/**
 * "Hassan Ali" → "ali.hassanhack2026" (reversed name parts + suffix)
 */
export function generateEvaluatorPassword(name: string): string {
  const parts = nameParts(name);
  if (parts.length === 0) return PASSWORD_SUFFIX;
  if (parts.length === 1) return `${parts[0]}${PASSWORD_SUFFIX}`;
  return `${[...parts].reverse().join(".")}${PASSWORD_SUFFIX}`;
}
