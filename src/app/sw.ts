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
 * TezDukan service worker: the precached app shell and offline page, the runtime rules above,
 * and Web Push. Background sync of the offline queues is added with that feature.
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

type PushMessage = { title: string; body?: string; link?: string; tag?: string };

function readPush(event: PushEvent): PushMessage | null {
  try {
    const data: unknown = event.data?.json();
    if (data && typeof data === "object" && "title" in data && typeof data.title === "string") {
      const record = data as Record<string, unknown>;
      return {
        title: data.title,
        body: typeof record.body === "string" ? record.body : undefined,
        link: typeof record.link === "string" && record.link.startsWith("/") ? record.link : "/",
        tag: typeof record.tag === "string" ? record.tag : undefined,
      };
    }
  } catch {
    // Not JSON: nothing we sent.
  }
  return null;
}

// Every push becomes a phone notification, even with TezDukan open: a new order must reach the
// dukandar's screen like any other app alert (owner's call, Nov 2026). The tag replaces an
// earlier alert for the same order instead of stacking, and renotify sounds it again.
self.addEventListener("push", (event) => {
  const message = readPush(event);
  if (!message) return;
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: message.tag,
      renotify: Boolean(message.tag),
      vibrate: [200, 100, 200],
      data: { link: message.link },
    } as NotificationOptions),
  );
});

// Tapping a notification opens the screen it is about, reusing an open TezDukan window.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data: unknown = event.notification.data;
  const link =
    data && typeof data === "object" && "link" in data && typeof data.link === "string"
      ? data.link
      : "/";
  event.waitUntil(
    (async () => {
      const url = new URL(link, self.location.origin).href;
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await existing.focus();
        await existing.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
