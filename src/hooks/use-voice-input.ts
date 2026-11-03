"use client";

import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { type SpeechStatus, useSpeechRecognition } from "./use-speech-recognition";

export type VoiceStatus = SpeechStatus | "working";

const availabilitySchema = z.object({ available: z.boolean() });
const textSchema = z.object({ text: z.string() });

let serverCheck: Promise<boolean> | null = null;
/** Asked once per page load: is server speech-to-text switched on? */
function serverSttAvailable(): Promise<boolean> {
  serverCheck ??= fetch("/api/stt")
    .then((response) => response.json())
    .then((json) => availabilitySchema.parse(json).available)
    .catch(() => false);
  return serverCheck;
}

function canRecord(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

// Loudness (RMS of the waveform) above which we count it as speech.
const SPEECH_LEVEL = 0.035;

/**
 * Voice input for Munshi and voice search. With server speech-to-text on, it records a clip,
 * stops by itself after a short pause, and sends it to /api/stt (a model trained on far more
 * Urdu than the phone's recogniser). Otherwise it falls back to the browser's recognition.
 * Same shape as useSpeechRecognition, plus a "working" status while the clip is transcribed.
 */
export function useVoiceInput(lang: string, { onEnd }: { onEnd?: (text: string) => void } = {}) {
  const locale = useLocale();
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const browser = useSpeechRecognition(lang, { onEnd: (text) => onEndRef.current?.(text) });
  const { start: browserStart, stop: browserStop, cancel: browserCancel } = browser;
  const [server, setServer] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!canRecord()) return;
    let alive = true;
    void serverSttAvailable().then((available) => {
      if (alive) setServer(available);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      cleanupRef.current?.();
    },
    [],
  );

  const startServer = useCallback(async () => {
    cancelledRef.current = false;
    setTranscript("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setStatus("denied");
      return;
    }
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    // Stop on its own: 1.5 s of quiet after speech, 6 s of nothing, or 15 s in all.
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const startedAt = performance.now();
    let quietSince = startedAt;
    let heard = false;
    const timer = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
      const now = performance.now();
      if (Math.sqrt(sum / samples.length) > SPEECH_LEVEL) {
        heard = true;
        quietSince = now;
      }
      const done =
        (heard && now - quietSince > 1500) ||
        (!heard && now - startedAt > 6000) ||
        now - startedAt > 15_000;
      if (done && recorder.state === "recording") recorder.stop();
    }, 100);

    const cleanup = () => {
      window.clearInterval(timer);
      for (const track of stream.getTracks()) track.stop();
      void audioContext.close().catch(() => undefined);
      cleanupRef.current = null;
    };
    cleanupRef.current = cleanup;

    recorder.onstop = async () => {
      cleanup();
      recorderRef.current = null;
      if (cancelledRef.current) return;
      if (!heard || chunks.length === 0) {
        setStatus("idle");
        onEndRef.current?.("");
        return;
      }
      setStatus("working");
      try {
        const form = new FormData();
        form.append(
          "audio",
          new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
          "speech",
        );
        form.append("locale", locale);
        const response = await fetch("/api/stt", { method: "POST", body: form });
        const parsed = textSchema.safeParse(await response.json());
        if (cancelledRef.current) return;
        const text = response.ok && parsed.success ? parsed.data.text : "";
        setTranscript(text);
        setStatus(response.ok ? "idle" : "error");
        onEndRef.current?.(text);
      } catch {
        if (cancelledRef.current) return;
        setStatus("error");
        onEndRef.current?.("");
      }
    };

    recorderRef.current = recorder;
    recorder.start(250);
    setStatus("listening");
  }, [locale]);

  const start = useCallback(() => {
    if (server) void startServer();
    else browserStart();
  }, [server, startServer, browserStart]);

  /** Stop listening and hand over what was heard. */
  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    else browserStop();
  }, [browserStop]);

  /** Stop listening and discard what was heard. */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    cleanupRef.current?.();
    setStatus("idle");
    setTranscript("");
    browserCancel();
  }, [browserCancel]);

  if (!server) return { ...browser, status: browser.status as VoiceStatus, start, stop, cancel };
  return { supported: true, status, transcript, start, stop, cancel };
}
