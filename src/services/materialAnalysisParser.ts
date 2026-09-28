import type { MaterialAnalysis, MaterialProposal } from "../types/materialAnalysis.ts";
import type { LanguageNode } from "../types/language.ts";
import { normalizeFurigana } from "./furigana.ts";

const types = new Set<LanguageNode["type"]>(["collocation", "pragmatic", "pattern", "discourse", "slang", "idiom", "mimetic", "terminology"]);
const levels = new Set<LanguageNode["register"]["level"]>(["casual", "neutral", "formal"]);
const string = (value: unknown, limit = 500) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const strings = (value: unknown, max = 5, limit = 120) => Array.isArray(value)
  ? value.map(x => string(x, limit)).filter(Boolean).slice(0, max) : [];

function sourceExcerpt(rawText: string, proposed: string, expression: string) {
  if (proposed && rawText.includes(proposed)) return proposed;
  const lines = rawText.split(/(?<=[.!?。！？\n])/);
  return (lines.find(line => line.includes(expression)) || rawText.slice(0, 220)).trim().slice(0, 300);
}

export function normalizeMaterialAnalysis(payload: unknown, rawText: string): MaterialAnalysis {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { expressions?: unknown }).expressions))
    throw new Error("API 没有返回可识别的表达列表。");
  const input = payload as Record<string, unknown>;
  const rawExpressions = input.expressions as unknown[];
  const expressions: MaterialProposal[] = rawExpressions.slice(0, 80).flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const x = item as Record<string, unknown>;
    const expression = string(x.expression, 100);
    if (!expression) return [];
    const register = x.register && typeof x.register === "object" ? x.register as Record<string, unknown> : {};
    const type = types.has(x.type as LanguageNode["type"]) ? x.type as LanguageNode["type"] : "collocation";
    const level = levels.has(register.level as LanguageNode["register"]["level"]) ? register.level as LanguageNode["register"]["level"] : "neutral";
    return [{
      expression, reading: string(x.reading, 160), furigana: normalizeFurigana(x.furigana, expression),
      type, meaning: string(x.meaning, 180),
      contextLabels: strings(x.contextLabels, 3, 50), domainLabels: strings(x.domainLabels, 3, 50),
      functionLabels: strings(x.functionLabels, 3, 50), coreImage: string(x.coreImage, 220),
      collocations: strings(x.collocations, 4, 100), examples: strings(x.examples, 3, 250),
      register: { level, notes: string(register.notes, 150) }, nuance: string(x.nuance, 250),
      sourceContext: sourceExcerpt(rawText, string(x.sourceContext, 300), expression),
      uncertain: x.uncertain === true, usefulness: Number.isFinite(x.usefulness) ? Math.max(0, Math.min(100, Number(x.usefulness))) : 50,
    }];
  });
  const groups = Array.isArray(input.groups) ? input.groups.slice(0, 40).flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const x = item as Record<string, unknown>;
    const excerpt = string(x.excerpt, 500);
    return [{ label: string(x.label, 80), excerpt: excerpt && rawText.includes(excerpt) ? excerpt : "",
      expressionIndexes: Array.isArray(x.expressionIndexes) ? x.expressionIndexes.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < expressions.length).slice(0, 80) : [] }];
  }) : [];
  return { summary: string(input.summary, 300), groups, expressions };
}
