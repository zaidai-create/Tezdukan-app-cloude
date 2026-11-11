"use client";

import { useEffect, useRef } from "react";

/**
 * Placed beside the active item of a sideways-scrolling row: brings that item into view, so
 * the shopper sees which tab they are on even when it sits far along the row.
 */
export function RevealInRow() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    marker.current?.parentElement?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);
  return <span ref={marker} hidden />;
}
