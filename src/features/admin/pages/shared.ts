/** First value of a search param that may repeat. */
export const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
