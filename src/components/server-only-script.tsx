"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * An inline script that exists only in the server HTML, where it runs before first paint.
 * Hydration keeps it (the snapshots differ on purpose); afterwards, and on any later client
 * render such as a language switch that re-renders the root layout, it is dropped: a <script>
 * created on the client never runs, and React warns about it.
 */
export function ServerOnlyScript({ code }: { code: string }) {
  const serverRender = useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  );
  return serverRender ? <script dangerouslySetInnerHTML={{ __html: code }} /> : null;
}
