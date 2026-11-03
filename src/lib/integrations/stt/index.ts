import "server-only";
import { z } from "zod";

/**
 * Speech-to-text for Munshi and voice search. `whisper` is any OpenAI-compatible
 * /audio/transcriptions endpoint (Groq's free tier runs whisper-large-v3-turbo, which hears
 * Urdu well); `gemini` sends the clip to a Gemini model. `browser` (the Sandbox) means no
 * server STT: the phone's own speech recognition is used instead.
 */
const sttEnvSchema = z.object({
  AI_STT_PROVIDER: z.enum(["browser", "whisper", "gemini"]).default("browser"),
  STT_API_BASE_URL: z.url().default("https://api.groq.com/openai/v1"),
  STT_API_KEY: z.string().optional(),
  STT_MODEL: z.string().min(1).default("whisper-large-v3-turbo"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL_STT: z.string().min(1).default("gemini-2.5-flash"),
});

function sttEnv() {
  return sttEnvSchema.parse({
    AI_STT_PROVIDER: process.env.AI_STT_PROVIDER || undefined,
    STT_API_BASE_URL: process.env.STT_API_BASE_URL || undefined,
    STT_API_KEY: process.env.STT_API_KEY || undefined,
    STT_MODEL: process.env.STT_MODEL || undefined,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
    GEMINI_MODEL_STT: process.env.GEMINI_MODEL_STT || undefined,
  });
}

export function sttProvider(): "browser" | "whisper" | "gemini" {
  const env = sttEnv();
  if (env.AI_STT_PROVIDER === "whisper" && env.STT_API_KEY) return "whisper";
  if (env.AI_STT_PROVIDER === "gemini" && env.GEMINI_API_KEY) return "gemini";
  return "browser";
}

// Words shopkeepers say that a general model mishears; biases the transcription toward them.
const VOCABULARY =
  "TezDukan, kiryana, dukan, atta, cheeni, chawal, daal, ghee, tel, doodh, chai, Tapal Danedar, " +
  "Lipton, Olper's, Milkpak, Nestle, Dalda, Habib, Sufi, Surf Excel, Ariel, Bonus, Lifebuoy, Lux, " +
  "Safeguard, Colgate, Sensodyne, Peek Freans, Sooper, Candi, Kurkure, Lays, Knorr, National, Shan, " +
  "Coca-Cola, Pepsi, Nestle Pure Life, Aquafina, packet, carton, darjan, kilo, rupay, rate, stock";

const textSchema = z.object({ text: z.string() });
const geminiSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({ parts: z.array(z.object({ text: z.string().optional() })) }),
      }),
    )
    .min(1),
});

/** Turns a short voice clip into text, in Urdu script for Urdu and Latin letters otherwise. */
export async function transcribe(audio: Blob, locale: string): Promise<string> {
  const env = sttEnv();
  const provider = sttProvider();
  const urduScript = locale === "ur" || locale === "sd";

  if (provider === "whisper") {
    const form = new FormData();
    form.append("file", audio, "speech.webm");
    form.append("model", env.STT_MODEL);
    form.append("response_format", "json");
    form.append("temperature", "0");
    if (urduScript) form.append("language", "ur");
    form.append("prompt", VOCABULARY);
    const response = await fetch(`${env.STT_API_BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.STT_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`stt_${response.status}`);
    return textSchema.parse(await response.json()).text.trim();
  }

  if (provider === "gemini") {
    const base64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    const instruction =
      "Transcribe this voice note from a Pakistani shopkeeper exactly as spoken. It may mix " +
      "Urdu, Sindhi, Punjabi and English, with product brand names and prices. Write it in " +
      (urduScript ? "Urdu script" : "Roman Urdu (Latin letters), English words as English") +
      ", digits as digits. Reply with the transcription only. Likely words: " +
      VOCABULARY;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL_STT}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY ?? "" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: instruction },
                { inline_data: { mime_type: audio.type || "audio/webm", data: base64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0 },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) throw new Error(`stt_${response.status}`);
    const parsed = geminiSchema.parse(await response.json());
    return (
      parsed.candidates[0]?.content.parts.map((part) => part.text ?? "").join("") ?? ""
    ).trim();
  }

  throw new Error("stt_not_configured");
}
