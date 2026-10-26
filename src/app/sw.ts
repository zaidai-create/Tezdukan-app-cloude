/// <reference lib="webworker" />
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  type PrecacheEntry,
  type RuntimeCaching,
  Serwist,
  type SerwistGlobalConfig,
  StaleWhileRevalidate,
} from "serwist";
import { privateCacheNames } from "../lib/pwa/caches";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DAY = 24 * 60 * 60;

/**
 * Runtime caching; the first matching rule handles a request. These are our own rules
 * rather than `defaultCache` from `@serwist/turbopack/worker`, which is built against a
 * second copy of `serwist`: its strategies fail the `instanceof` check that attaches the
 * offline fallback, so offline navigations errored instead of showing `/~offline`.
 */
const runtimeCaching: RuntimeCaching[] = [
  // API routes change state or depend on the session: never answer them from a cache.
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/api/"),
    handler: new NetworkOnly(),
  },
  // Screens already visited open offline from their last copy. A slow connection gets 10 s
  // before the copy is used.
  {
    matcher: ({ sameOrigin, request }) => sameOrigin && request.headers.get("RSC") === "1",
    handler: new NetworkFirst({
      cacheName: privateCacheNames.rsc,
      networkTimeoutSeconds: 10,
      plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 7 * DAY })],
    }),
  },
  {
    matcher: ({ sameOrigin, request }) => sameOrigin && request.mode === "navigate",
    handler: new NetworkFirst({
      cacheName: privateCacheNames.pages,
      networkTimeoutSeconds: 10,
      plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 7 * DAY })],
    }),
  },
  // Build output is content-hashed, so a cached copy is always right.
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: "next-static",
      plugins: [new ExpirationPlugin({ maxEntries: 256, maxAgeSeconds: 30 * DAY })],
    }),
  },
  // Inter, Plus Jakarta Sans and the Urdu faces come in several subsets each.
  {
    matcher: ({ request }) => request.destination === "font",
    handler: new CacheFirst({
      cacheName: "fonts",
      plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 365 * DAY })],
    }),
  },
  // Product photos and avatars: show the cached copy, refresh it in the background.
  {
    matcher: ({ request }) => request.destination === "image",
    handler: new StaleWhileRevalidate({
      cacheName: "images",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 256,
          maxAgeSeconds: 30 * DAY,
          purgeOnQuotaError: true,
        }),
      ],
    }),
  },
];

/**
 * TezDukan service worker: the precached app shell and offline page, plus the runtime rules
 * above. Push notifications and background sync of the offline queues are added with those
 * features.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
