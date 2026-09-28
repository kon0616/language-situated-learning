import type { FuriganaPart, LanguageNode } from "../types/language.ts";

export function hasCompleteFurigana(parts: unknown, expression: string) {
  const valid = normalizeFurigana(parts, expression);
  return valid.length > 0 && valid.every(part => !/[一-龯々〆ヶ]/u.test(part.text) || !!part.reading);
}

export function needsFurigana(node: LanguageNode) {
  return (node.language || "ja") === "ja" && /[一-龯々〆ヶ]/u.test(node.expression) && !(node.readingManual && node.reading?.trim()) &&
    !hasCompleteFurigana(node.furigana, node.expression);
}

export function normalizeFurigana(value: unknown, expression: string): FuriganaPart[] {
  if (!Array.isArray(value) || value.length > 100) return [];
  const parts = value.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const part = item as Record<string, unknown>;
    const text = typeof part.text === "string" ? part.text : "";
    if (!text || text.length > expression.length) return [];
    const reading = typeof part.reading === "string" ? part.reading.trim() : "";
    return [{ text, ...(reading && /[一-龯々〆ヶ]/u.test(text) ? { reading: reading.slice(0, 80) } : {}) }];
  });
  return parts.map(part => part.text).join("") === expression && parts.some(part => part.reading) ? parts : [];
}
