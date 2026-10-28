/**
 * Links that hand off to the phone: a call, a WhatsApp chat, a map. Phones are E.164
 * (+923001234567); anything else yields null so no broken link is ever shown.
 */
const E164 = /^\+[1-9]\d{7,14}$/;

export function telHref(phone: string | null | undefined): string | null {
  return phone && E164.test(phone) ? `tel:${phone}` : null;
}

/** WhatsApp click-to-chat (wa.me takes the number without the plus), with an optional message. */
export function whatsappHref(phone: string | null | undefined, text?: string): string | null {
  if (!phone || !E164.test(phone)) return null;
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${phone.slice(1)}${query}`;
}

export function mapsHref(
  lat: number | null | undefined,
  lng: number | null | undefined,
): string | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
