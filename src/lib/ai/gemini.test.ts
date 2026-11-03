import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { geminiGenerate, GeminiError } = await import("./gemini");

describe("Gemini client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("falls through to the next model when one is busy, and returns tool calls", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL_AGENT", "busy-model,good-model");
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("busy-model")
        ? new Response("{}", { status: 503 })
        : Response.json({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        id: "c1",
                        name: "find_my_products",
                        args: { query: "Tapal" },
                      },
                    },
                  ],
                },
              },
            ],
          }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await geminiGenerate({
      contents: [{ role: "user", parts: [{ text: "rate?" }] }],
    });

    expect(result.calls).toEqual([
      { id: "c1", name: "find_my_products", args: { query: "Tapal" } },
    ]);
    // The busy model gets one quick retry before the fallback answers.
    expect(fetchMock.mock.calls.map(([url]) => String(url).includes("good-model"))).toEqual([
      false,
      false,
      true,
    ]);
  });

  it("says plainly when there is no key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(geminiGenerate({ contents: [] })).rejects.toBeInstanceOf(GeminiError);
  });
});
