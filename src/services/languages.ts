export const commonLanguages = [
  ["ja", "日本語"], ["en", "English"], ["zh", "中文"], ["ko", "한국어"],
  ["fr", "Français"], ["es", "Español"], ["de", "Deutsch"], ["it", "Italiano"],
  ["pt", "Português"], ["ru", "Русский"], ["ar", "العربية"], ["hi", "हिन्दी"],
] as const;

export function languageCode(value: unknown, fallback = "und") {
  if (typeof value !== "string") return fallback;
  const code = value.trim().replace(/_/g, "-").toLowerCase();
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(code) ? code : fallback;
}

export function languageName(code: string) {
  const known = commonLanguages.find(([id]) => id === code);
  if (known) return known[1];
  if (code === "all") return "全部语言";
  if (code === "und") return "待确认";
  try { return new Intl.DisplayNames(["zh"], { type: "language" }).of(code) || code; }
  catch { return code; }
}

export function guessLanguage(text: string): { code: string; confidence: "high" | "low" } {
  const sample = text.slice(0, 4000);
  if (!sample.trim()) return { code: "und", confidence: "low" };
  const count = (pattern: RegExp) => [...sample.matchAll(pattern)].length;
  const kana = count(/[ぁ-ゖァ-ヺ]/gu);
  const hangul = count(/[가-힣]/gu);
  const han = count(/[一-龯]/gu);
  const cyrillic = count(/[А-Яа-яЁё]/gu);
  const arabic = count(/[\u0600-\u06ff]/gu);
  const devanagari = count(/[\u0900-\u097f]/gu);
  if (kana >= 2) return { code: "ja", confidence: "high" };
  if (hangul >= 2) return { code: "ko", confidence: "high" };
  if (cyrillic >= 3) return { code: "ru", confidence: "high" };
  if (arabic >= 3) return { code: "ar", confidence: "high" };
  if (devanagari >= 3) return { code: "hi", confidence: "high" };
  if (han >= 3) return { code: "zh", confidence: "high" };
  return { code: "und", confidence: "low" };
}
