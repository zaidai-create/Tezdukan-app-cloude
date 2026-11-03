/** The app shows text, not markdown: drop emphasis marks and turn list stars into bullets. */
export function plain(value: string): string {
  return value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^\s*[*-]\s+/gm, "• ")
    .trim();
}
