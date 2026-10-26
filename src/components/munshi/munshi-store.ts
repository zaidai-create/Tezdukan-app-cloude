"use client";

import { create } from "zustand";

type MunshiState = {
  open: boolean;
  /** Start listening immediately (hold-to-talk on the mic button). */
  listenOnOpen: boolean;
  /** Text to pre-fill (e.g. a command typed in the Ctrl+K palette). */
  draft: string;
  openMunshi: (options?: { listen?: boolean; draft?: string }) => void;
  setOpen: (open: boolean) => void;
};

export const useMunshi = create<MunshiState>((set) => ({
  open: false,
  listenOnOpen: false,
  draft: "",
  openMunshi: (options) =>
    set({ open: true, listenOnOpen: options?.listen ?? false, draft: options?.draft ?? "" }),
  setOpen: (open) => set(open ? { open } : { open, listenOnOpen: false, draft: "" }),
}));
