/**
 * The words a shopper recognises a product by: the brand, plus the next word when the brand is
 * very short ("LU Prince"), never a pack size. "Coca-Cola 1.5 L" gives "Coca-Cola".
 */
export function shortName(name: string): string {
  const words = name.replace(/[(),]/g, " ").split(/\s+/).filter(Boolean);
  const [first = "", second] = words;
  return first.length <= 3 && second && !/^\d/.test(second) ? `${first} ${second}` : first;
}
