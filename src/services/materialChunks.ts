import type { MaterialAnalysis, MaterialProposal } from "../types/materialAnalysis.ts";

const CHUNK_SIZE = 2000;

export function splitMaterial(rawText: string, maxChars = CHUNK_SIZE): string[] {
  const text = rawText.trim();
  if (!text) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const minimum = start + Math.floor(maxChars * 0.7);
      for (let i = end; i >= minimum; i--) {
        if (/[.!?。！？\n]/.test(text[i - 1])) { end = i; break; }
      }
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start = end;
  }
  return chunks;
}

function expressionKey(item: MaterialProposal) {
  return item.expression.normalize("NFKC").replace(/[\s、。，．!！?？]+/g, "").toLowerCase();
}

function distinct(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function mergeMaterialAnalyses(parts: MaterialAnalysis[]): MaterialAnalysis {
  const expressions: MaterialProposal[] = [];
  const indexes = new Map<string, number>();
  const groups: MaterialAnalysis["groups"] = [];
  for (const part of parts) {
    const localIndexes = new Map<number, number>();
    part.expressions.forEach((item, index) => {
      const key = expressionKey(item);
      const existingIndex = indexes.get(key);
      if (existingIndex === undefined) {
        localIndexes.set(index, expressions.length);
        indexes.set(key, expressions.length);
        expressions.push(item);
      } else {
        localIndexes.set(index, existingIndex);
        const prior = expressions[existingIndex];
        expressions[existingIndex] = {
          ...prior,
          reading: prior.reading || item.reading,
          furigana: prior.furigana?.length ? prior.furigana : item.furigana,
          contextLabels: distinct([...prior.contextLabels, ...item.contextLabels]),
          domainLabels: distinct([...prior.domainLabels, ...item.domainLabels]),
          functionLabels: distinct([...prior.functionLabels, ...item.functionLabels]),
          collocations: distinct([...prior.collocations, ...item.collocations]).slice(0, 6),
          examples: distinct([...prior.examples, ...item.examples]).slice(0, 3),
          usefulness: Math.max(prior.usefulness, item.usefulness),
          uncertain: prior.uncertain || item.uncertain,
        };
      }
    });
    groups.push(...part.groups.map(group => ({ ...group,
      expressionIndexes: [...new Set(group.expressionIndexes
        .map(index => localIndexes.get(index))
        .filter((index): index is number => index !== undefined))],
    })));
  }
  return { summary: parts.map(part => part.summary).filter(Boolean).join(" / "), groups, expressions };
}
