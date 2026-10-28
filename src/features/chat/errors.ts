export const chatErrorKeys = [
  "message_empty",
  "message_too_long",
  "rate_limited",
  "conversation_not_found",
  "not_allowed",
] as const;

export type ChatErrorKey = (typeof chatErrorKeys)[number] | "generic" | "offline";

export function chatErrorKey(error: unknown): ChatErrorKey {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  return (chatErrorKeys as readonly string[]).includes(message)
    ? (message as ChatErrorKey)
    : "generic";
}
