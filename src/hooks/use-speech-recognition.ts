"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Minimal typing for the Web Speech API (not in TypeScript's DOM lib). */
type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => undefined;

export type SpeechStatus = "idle" | "listening" | "denied" | "error";

/**
 * Browser speech-to-text (Web Speech API, ur-PK / en-PK). It is the fallback voice path;
 * Phase 5 adds a server STT adapter with product-name hints for better Urdu accuracy.
 * `onEnd` receives what was heard when the recogniser stops (empty if nothing).
 */
export function useSpeechRecognition(
  lang: string,
  { onEnd }: { onEnd?: (text: string) => void } = {},
) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const cancelledRef = useRef(false);
  const onEndRef = useRef(onEnd);
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => getRecognitionCtor() !== null,
    () => false,
  );

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    recognitionRef.current?.abort();
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1)
        text += event.results[i]?.[0].transcript ?? "";
      transcriptRef.current = text.trim();
      setTranscript(transcriptRef.current);
    };
    recognition.onerror = (event) => {
      setStatus(
        event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : "error",
      );
    };
    recognition.onend = () => {
      setStatus((current) => (current === "listening" ? "idle" : current));
      if (!cancelledRef.current) onEndRef.current?.(transcriptRef.current);
    };
    recognitionRef.current = recognition;
    cancelledRef.current = false;
    transcriptRef.current = "";
    setTranscript("");
    setStatus("listening");
    recognition.start();
  }, [lang]);

  /** Stop listening and hand over what was heard. */
  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  /** Stop listening and discard what was heard. */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    recognitionRef.current?.abort();
    transcriptRef.current = "";
    setTranscript("");
    setStatus("idle");
  }, []);

  return { supported, status, transcript, start, stop, cancel };
}
