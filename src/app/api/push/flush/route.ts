import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { flushPushOutbox } from "@/features/notifications/dispatch";
import { getSupabaseAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/server-env";

/**
 * Sends queued push messages. Called by the database the moment a push is queued (pg_net, with
 * a token the database made for itself) and every minute for anything left waiting; any other
 * scheduler may use CRON_SECRET. Keeps going while there is more, so a broadcast to many phones
 * goes out in one call.
 */
export const maxDuration = 60;

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function authorized(request: NextRequest): Promise<boolean> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return false;
  if (serverEnv.CRON_SECRET && sameSecret(token, serverEnv.CRON_SECRET)) return true;
  if (!/^[0-9a-f]{64}$/.test(token) || !hasAdminClient()) return false;
  const { data } = await getSupabaseAdminClient().rpc("push_flush_token_ok", { p_token: token });
  return data === true;
}

const BATCH = 200;
const BUDGET_MS = 45_000;

async function handle(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  let claimed = 0;
  for (;;) {
    const result = await flushPushOutbox(BATCH);
    claimed += result.claimed;
    if (result.claimed < BATCH || Date.now() - started > BUDGET_MS) break;
  }
  return NextResponse.json({ claimed });
}

export const GET = handle;
export const POST = handle;
