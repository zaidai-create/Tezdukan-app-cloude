/** First value of a search param ("?q=a&q=b" reads as "a"). */
export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
