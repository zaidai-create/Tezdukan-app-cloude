import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { sttProvider, transcribe } = await import("./index");

describe("speech-to-text adapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("stays on the phone's own recogniser until a key is set", () => {
    vi.stubEnv("AI_STT_PROVIDER", "whisper");
    vi.stubEnv("STT_API_KEY", "");
    expect(sttProvider()).toBe("browser");
    vi.stubEnv("STT_API_KEY", "test-key");
    expect(sttProvider()).toBe("whisper");
  });

  it("sends Urdu-script locales to Whisper as Urdu, with shop words as a hint", async () => {
    vi.stubEnv("AI_STT_PROVIDER", "whisper");
    vi.stubEnv("STT_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => Response.json({ text: " Tapal Danedar ka rate 1250 " }));
    vi.stubGlobal("fetch", fetchMock);

    const text = await transcribe(new Blob(["voice"], { type: "audio/webm" }), "ur");

    expect(text).toBe("Tapal Danedar ka rate 1250");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
    const body = init.body as FormData;
    expect(body.get("language")).toBe("ur");
    expect(String(body.get("prompt"))).toContain("Tapal Danedar");
  });
});
