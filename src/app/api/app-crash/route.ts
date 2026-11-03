import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

/**
 * Crash reports from the Android app (see android/.../CrashReport.java). The app never shows
 * an error screen; it posts here instead and the report lands in the server logs.
 */
const reportSchema = z.object({
  version: z.string().max(20),
  device: z.string().max(120),
  android: z.number().int().min(1).max(100),
  trace: z.string().max(8000),
});

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 12_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { version, device, android, trace } = parsed.data;
  console.error(`[android-crash] app ${version}, ${device}, API ${android}\n${trace}`);
  return new NextResponse(null, { status: 204 });
}
