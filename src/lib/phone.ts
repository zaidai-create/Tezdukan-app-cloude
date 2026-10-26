/**
 * Pakistani mobile numbers. Stored as E.164 (+923001234567), shown as 0300 1234567.
 * People type them every way imaginable: 0300-1234567, 3001234567, 92 300 1234567,
 * +92 (300) 123 4567, 0092300…; all of those normalise to the same value.
 */
const MOBILE = /^3\d{9}$/;

export type E164 = `+92${string}`;

export function normalizePkMobile(input: string): E164 | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith("0092")) digits = digits.slice(4);
  else if (digits.startsWith("92") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return MOBILE.test(digits) ? `+92${digits}` : null;
}

export function isPkMobile(input: string): boolean {
  return normalizePkMobile(input) !== null;
}

/** +923001234567 → "0300 1234567" */
export function formatPkMobile(e164: string): string {
  const local = e164.replace(/^\+92/, "");
  if (!MOBILE.test(local)) return e164;
  return `0${local.slice(0, 3)} ${local.slice(3)}`;
}

/** +923001234567 → "0300 ••• 4567" for OTP screens and receipts. */
export function maskPkMobile(e164: string): string {
  const local = e164.replace(/^\+92/, "");
  if (!MOBILE.test(local)) return e164;
  return `0${local.slice(0, 3)} ••• ${local.slice(6)}`;
}

/** WhatsApp click-to-chat number format (no plus). */
export function whatsappNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}
