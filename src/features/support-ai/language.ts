const ROMAN_URDU = new Set(
  "hai hain ho mera meri mere mujhe mujh aap ap apna kya kia kyun kyon kaise kese kahan kab nahi nahin chahiye karun karna karein kar raha rahi tha thi ka ki ke ko se mein main bhi abhi jaldi wapas paise paisay dukan dukaan theek shukriya salam assalam alaikum walaikum aoa bhai ji haan han".split(
    " ",
  ),
);

/**
 * Which language to answer in, from the person's own words: Urdu script, Roman Urdu or
 * English. The FAQ is in English, so without this the model drifts into English.
 */
export function replyLanguage(text: string): "Urdu (Urdu script)" | "Roman Urdu" | "English" {
  if (/[\u0600-\u06FF]/.test(text)) return "Urdu (Urdu script)";
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const urduWords = words.filter((word) => ROMAN_URDU.has(word)).length;
  return urduWords >= 1 && urduWords / Math.max(words.length, 1) >= 0.2 ? "Roman Urdu" : "English";
}
