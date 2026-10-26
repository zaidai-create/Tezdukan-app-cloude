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

/**
 * Formats a number while it is being typed into the +92 field: "03001234567" → "0300 1234567",
 * "3001234567" → "300 1234567". A pasted country code (+92, 92, 0092) is dropped because the
 * field shows +92 already. `caret` is the cursor position in `raw`; the result says where it
 * belongs in the formatted text, so editing in the middle does not jump to the end.
 */
export function formatPkMobileInput(raw: string, caret = raw.length) {
  const digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, "").length;
  let digits = raw.replace(/\D/g, "");
  let dropped = 0;
  if (digits.startsWith("0092")) dropped = 4;
  // No national mobile number starts with 9, so "923…" (or anything after a "+") is +92.
  else if (/^923/.test(digits) || (digits.startsWith("92") && raw.trim().startsWith("+"))) {
    dropped = 2;
  }
  digits = digits.slice(dropped);

  const max = digits.startsWith("0") ? 11 : 10;
  const split = digits.startsWith("0") ? 4 : 3;
  digits = digits.slice(0, max);
  const value = digits.length > split ? `${digits.slice(0, split)} ${digits.slice(split)}` : digits;

  // Place the cursor after the same digit it followed before formatting.
  const target = Math.min(Math.max(digitsBeforeCaret - dropped, 0), digits.length);
  let seen = 0;
  let position = 0;
  while (position < value.length && seen < target) {
    if (/\d/.test(value.charAt(position))) seen += 1;
    position += 1;
  }
  return { value, caret: position };
}
