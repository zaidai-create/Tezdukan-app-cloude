# TezDukan — working rules

@AGENTS.md

Read `PLAN.md` for architecture, routes and the data model; `DECISIONS.md` for why things are
the way they are. This file is the short list of rules to follow on every change.

## Commands

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Dev server | `pnpm dev` (http://localhost:3000) |
| Production build / start | `pnpm build` / `pnpm start` |
| Typecheck | `pnpm typecheck` |
| Lint / format | `pnpm lint` / `pnpm format` (check: `pnpm format:check`) |
| Unit tests | `pnpm test` (watch: `pnpm test:watch`) |
| E2E tests | `pnpm test:e2e` (both viewports; needs dev DB + seed) |
| Screenshots | `pnpm screenshots` (writes `e2e/__screenshots__/`) |
| Local Supabase | `pnpm db:start` / `pnpm db:stop` / `pnpm db:status` |
| Reset DB (migrations + seed) | `pnpm db:reset` |
| DB tests (pgTAP) | `pnpm db:test` |
| Lint SQL / advisors | `pnpm db:lint` |
| Generate DB types | `pnpm db:types` → `src/lib/supabase/database.types.ts` |
| New migration | `pnpm db:migration <name>` |
| Seed / remove seed | `pnpm seed` / `pnpm seed:reset` |

Local Supabase pulls images from Docker Hub (`SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`,
set by the `db:*` scripts). Start Docker first if it isn't running (`sudo dockerd &`).

Before every commit: `pnpm typecheck && pnpm lint && pnpm test` (and `pnpm db:test` if SQL
changed). After a phase: also `pnpm test:e2e` and `pnpm screenshots`, then review them.

## Next.js 16.4 specifics (read the bundled docs in `node_modules/next/dist/docs/`)

- **Cache Components + Partial Prefetching are on.** Anything that reads the request
  (`cookies()`, `headers()`, the Supabase session, user data) must sit inside `<Suspense>`
  with a skeleton that matches the final layout. Keep layouts static; push dynamic reads down.
- Use `'use cache'` (+ `cacheLife`/`cacheTag`) for shared reference data (categories, brands,
  areas). Use `'use cache: private'` for session-derived reads. Never read cookies inside
  plain `'use cache'`.
- `proxy.ts` (not middleware) runs on Node: session refresh → locale rewrite → role routing.
- `params`, `searchParams`, `cookies()`, `headers()` are async. `revalidateTag(tag, profile)`
  needs a profile; use `updateTag` in Server Actions for read-your-writes.
- `experimental.useOffline` is on: use `useOffline()` (from `next/offline`) for offline UI.

## Code conventions

- TypeScript strict. No `any`; no non-null `!` on data from the network; parse with Zod at
  every boundary (forms, Server Actions, Route Handlers, RPC results we depend on, IndexedDB).
- Files: `kebab-case.tsx`; components `PascalCase`; hooks `useX`; Server Actions in
  `features/<domain>/actions.ts` with `'use server'`; queries in `queries.ts`; Zod in `schemas.ts`.
- Server-only modules import `'server-only'`. Never import the admin (service-role) client
  outside `src/lib/supabase/admin.ts` callers that are server-only and audited.
- Data access: reads in Server Components via the server client (RLS applies). Writes via
  Server Actions or RPC. Anything atomic (orders, stock, ledger, payments, POS bills) is a
  Postgres function. Client components use TanStack Query hooks from `features/*/queries.ts`.
- Optimistic updates for cart, stepper, status changes and khata entries, always with
  rollback on error and a toast (with Undo for reversible actions).
- Realtime: subscribe in a client hook, update the TanStack Query cache, clean up on unmount.
- Comments explain *why*, not *what*. Match the surrounding code.

## Money, numbers, dates, phones

- Money is integer **paisa** (`bigint` in SQL, `number` in TS; values stay < 2^53).
  Convert only at the edges with `src/lib/money.ts`. Display as `Rs 1,250` (no decimals unless
  paisa ≠ 0). Never use floats for money maths.
- Dates: `DD/MM/YYYY`, time zone `Asia/Karachi`, via `src/lib/format.ts`.
- Phones: store E.164 `+923001234567`; display `0300 1234567`; parse with `src/lib/phone.ts`.
- Numbers and prices use `tabular-nums`.

## Database rules

- Every table: `id uuid`, `created_at`, `updated_at` (trigger), `created_by`; financial tables
  add `deleted_at` and are never hard-deleted (reverse instead).
- RLS on every table, with pgTAP tests in `supabase/tests/`. Policies call helpers as
  `(select private.fn())`. No direct insert/update policies on financial or stock tables.
- Every foreign key and search column is indexed. Use enums for statuses.
- New schema change = new migration file (`pnpm db:migration name`). Never edit an applied
  migration that has been pushed. Regenerate types after every migration.
- Seeded rows are registered in `seed_registry` so `pnpm seed:reset` can remove them.

## Design rules (brand: section 3 of the spec)

- **Tokens only.** Colours come from CSS variables (`--primary`, `--mint`, `--awning`, `--ink`,
  `--muted`, `--canvas`, `--surface`, `--border`, `--danger`, …) exposed as Tailwind colours.
  No hex values or Tailwind palette colours (`bg-green-500`) in components.
- Status colours are fixed app-wide: green = paid/delivered/in stock; amber = pending/due soon;
  red = overdue/cancelled/out of stock. Use `<StatusBadge>`.
- Type: headings Plus Jakarta Sans 600/700; body and numbers Inter (`tabular-nums` for prices
  and tables); Urdu/Sindhi UI in Noto Naskh Arabic; Noto Nastaliq Urdu only for large display
  headings. Scale 12/14/16/18/20/24/30/36. Body never below 14px on mobile.
- 4px grid. Radius: 10px buttons/inputs, 14px cards, 24px bottom sheets. Soft, low shadows.
  Minimum touch target 48×48.
- Icons: Lucide only, one stroke width (1.75). **Never emoji** anywhere.
- Images: real photos only. Product images square on white, `object-contain`. Use
  `<ProductImage>` (blur placeholder, lazy, AVIF/WebP, branded initials fallback — never a
  broken-image icon).
- Signature motifs, at most one per screen: the **awning edge** (storefront headers,
  onboarding, order success, empty states) and the **speed lines** (loaders, order placed,
  Munshi listening).
- Must not look AI-generated: no purple gradients, no glassmorphism, no blobs, no cards inside
  cards, consistent spacing, real short copy for Pakistani shopkeepers.
- Motion 150–250 ms ease-out; spring for ADD→stepper and the cart bar; respect
  `prefers-reduced-motion`.
- Every screen has designed loading (skeletons, never full-screen spinners), empty (awning +
  one clear action), error (with Retry) and offline states.
- Low-literacy friendly: icons always paired with labels, large numbers, short words, and a
  speaker button to read key information aloud.

## i18n and RTL

- No hard-coded UI text. Every string lives in `messages/{en,ur,ur-Latn,sd}.json` and is
  read with `useTranslations` / `getTranslations`. Keys are namespaced by feature.
- Locales: `en` (default), `ur` (RTL), `ur-Latn` (Roman Urdu), `sd` (RTL, hidden until ready;
  falls back to Urdu). The locale lives in the `NEXT_LOCALE` cookie, not the URL.
- Use logical CSS (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`) so layouts
  mirror in RTL. Directional icons (chevrons, arrows) flip with `rtl:-scale-x-100`.
- Product names, prices and numbers stay LTR inside RTL text (`dir="ltr"` / `<bdi>`).

## Integrations

Every external service is an adapter in `src/lib/integrations/<kind>/` with a real
implementation and a **Sandbox** implementation chosen by env vars. Sandbox mode is labelled
"Sandbox" in the UI and behaves realistically. Never fake success silently.

## Testing

- Unit tests next to the code (`*.test.ts`) or in `src/**/__tests__`.
- E2E in `e2e/`, run at 390×844 (mobile) and 1440×900 (desktop).
- Each feature is covered by at least one test. RLS changes need pgTAP coverage.

## Git

- Work on the designated feature branch. Commit after each working feature with a clear
  message; keep `CHANGELOG.md` current. Never commit secrets (`.env*` except `.env.example`).
