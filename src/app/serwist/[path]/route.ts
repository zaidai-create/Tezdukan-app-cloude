import { createSerwistRoute } from "@serwist/turbopack";
import { cacheLife } from "next/cache";
import { spawnSync } from "node:child_process";

// Precache revision for the offline page: the commit being built (or a fresh id).
const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

const serwist = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});

export const generateStaticParams = serwist.generateStaticParams;

/**
 * Bundles the worker and its precache manifest once, during the build. Uncached, the route
 * would render per request: on a serverless host the first request after every cold start
 * would run esbuild and scan a build folder that is not deployed with the function.
 */
async function serwistFile(path: string) {
  "use cache";
  cacheLife("max");
  const response = await serwist.GET(new Request("http://localhost/"), {
    params: Promise.resolve({ path }),
  });
  return {
    body: await response.text(),
    contentType: response.headers.get("Content-Type") ?? "text/plain",
  };
}

// The only files the build emits. Anything else is a 404 rather than a fresh esbuild run.
const files = new Set(["sw.js", "sw.js.map"]);

export async function GET(_request: Request, { params }: RouteContext<"/serwist/[path]">) {
  const { path } = await params;
  if (!files.has(path)) return new Response(null, { status: 404 });
  const file = await serwistFile(path);
  return new Response(file.body, {
    headers: { "Content-Type": file.contentType, "Service-Worker-Allowed": "/" },
  });
}
