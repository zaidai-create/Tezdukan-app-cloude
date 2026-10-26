# TezDukan logo

| File | What it is |
| --- | --- |
| `tezdukan-logo.png` | The original artwork from the owner (1254 × 1254, on black). |
| `tezdukan-logo.svg` | The same lockup as vectors: mark, wordmark and tagline, on black. Use it for print, signboards and social posts. |
| `tezdukan-mark.svg` | The mark alone, transparent background. Place it on black only. |

In the app, use the components in `src/components/brand/logo.tsx`. They draw from
`src/lib/brand/logo-art.ts`. After changing the artwork, run
`pnpm exec tsx scripts/gen-icons.ts` to rebuild the favicon and app icons.

## Colours

| | Hex |
| --- | --- |
| Mint (T, cart, "Dukan" on dark) | `#02E3AC` |
| "Dukan" on light surfaces | `#009B76` |
| Awning amber (top to bottom) | `#FECB29` to `#FEA104` |
| Awning orange (top to bottom) | `#FD7202` to `#E54402` |
| Flag fold (left to right) | `#02483A` to `#00D39C` |
| Black | `#0A0F0D` |

## Rules

- On light or coloured backgrounds, show the mark on its black rounded tile, like the app icon.
- Do not recolour, stretch, outline or mirror the logo, including in Urdu and Sindhi layouts.
- Keep clear space around the logo of at least the height of the "T" bar.
- Smallest size: 16 px for the tile (favicon) and 12 px tall for the wordmark.
