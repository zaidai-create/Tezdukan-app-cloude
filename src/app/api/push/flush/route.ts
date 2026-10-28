import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { flushPushOutbox } from "@/features/notifications/dispatch";
import { serverEnv } from "@/lib/server-env";

/**
 * Scheduled job (Vercel Cron or any scheduler): delivers push messages still queued, e.g.
 * notifications written by database jobs rather than app actions. Guarded by CRON_SECRET.
 */
function authorized(request: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await flushPushOutbox(200);
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
