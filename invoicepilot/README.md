# InvoicePilot AI

A conversational AI agent for processing invoice PDFs and images, under a
strict state-machine workflow with an explicit human approval gate.

The user uploads an original PDF and one or more invoice images. The AI reads
them, asks about the changes needed in natural language, and returns a
structured plan. The user approves, modifies, or cancels. Only after approval
does a deterministic PDF engine produce a verified output file.

- Next.js 15 (App Router, Server Actions / Route Handlers)
- Supabase (Postgres, Storage, Auth) with row-level security
- OpenAI chat + vision for invoice understanding and conversation
- `pdf-lib` for deterministic PDF modification
- Tailwind CSS, iOS-inspired design, mobile-friendly layout

## Workflow

A project moves through these states (see `src/lib/state/machine.ts`):

`WAITING_FOR_PDF → PDF_RECEIVED → WAITING_FOR_IMAGES → IMAGES_RECEIVED →
COLLECTING_CHANGES → CHANGE_SUMMARY → APPROVED → PROCESSING → QUALITY_CHECK →
COMPLETED` (any state can transition to `CANCELLED`).

The state machine is enforced on the server. The AI only *proposes*
transitions; the server validates and refuses illegal jumps (e.g., the model
cannot push the project into `PROCESSING` or `COMPLETED` on its own).

## Setup

```bash
pnpm install        # or npm install
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY and OPENAI_API_KEY.

# Apply the schema and storage buckets:
supabase db push                             # against a remote project
# or, for a local dev stack:
supabase start && supabase migration up

pnpm dev
# http://localhost:3100
```

### Supabase

- Project migrations live in `supabase/migrations/`.
- Two private storage buckets are created: `originals` (uploads) and `outputs`
  (generated files). Both are gated by RLS so users can only access files
  whose path starts with their own user id.
- Email+password auth is used out of the box. Open the project dashboard and
  enable the Email provider under *Authentication → Providers*.

### Running tests

```bash
pnpm test
```

The unit tests exercise the PDF engine (text preservation, image appending,
quality validation) and the state machine (allowed vs forbidden transitions).

## Deployment (Vercel)

1. Push this directory to a Git repo.
2. In Vercel, import the project. Set the Root Directory to `invoicepilot/`.
3. Add environment variables from `.env.example` in Project → Settings →
   Environment Variables.
4. Deploy. The `/api/projects/[id]/process` route is configured for up to a
   60-second invocation; raise if your PDFs are large.

## Design notes

- The AI's job is to **plan** changes, never to *perform* them. All actual
  document mutation happens inside `src/lib/pdf/engine.ts` using `pdf-lib`.
- Change plans are validated with Zod (`src/lib/schemas.ts`) before processing
  starts. Plans that fail validation are rejected.
- The approval endpoint re-validates the stored plan before flipping the
  project to `APPROVED`. The processing endpoint refuses to run unless the
  project is in `APPROVED` state and an approved plan exists.
- Original uploads are never modified. The engine loads them, renders a new
  PDF, and writes it to a separate `outputs` bucket.
- Quality checks run after processing: page count must meet the original
  PDF's page count, no page may collapse below 100pt, and the output must
  open successfully. On failure, the project is reverted to `APPROVED` and
  the user is told; it is never marked `COMPLETED` until a verified output
  exists.
- The agent is explicitly instructed never to fabricate supplier-issued
  facts (tax lines, dates, stamps, registration numbers). Requests that
  would misrepresent an official record are flagged as questions rather
  than silently applied.

## File map

```
src/
  app/
    (app)/
      dashboard, new, projects, projects/[id], history, settings
    api/
      projects, projects/[id]/upload, documents/[docId], message,
      images-done, approve, cancel, process, state, jobs/[jobId]/download
    layout.tsx, page.tsx, signin/
  lib/
    openai/   agent.ts, client.ts
    pdf/      engine.ts (deterministic), engine.test.ts
    state/    machine.ts, machine.test.ts
    supabase/ server.ts, browser.ts, admin.ts, types.ts
    schemas.ts (Zod), cn.ts, format.ts
  components/
    upload-panel.tsx, preview-panel.tsx, chat.tsx, change-summary.tsx
    sign-out-button.tsx
  middleware.ts
supabase/migrations/20260101000000_init.sql
```
