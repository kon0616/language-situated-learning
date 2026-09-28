import type { AppData, LanguageNode, Source } from "../types/language.ts";
import { withClassification } from "../data/taxonomy.ts";
import { buildEdges } from "../data/seed.ts";

const key = (expression: string, language: string) => `${language}\0${expression.trim().normalize("NFKC")}`;

export function saveExtraction(data: AppData, incoming: LanguageNode[], source: Source) {
  const next: AppData = { ...data, contexts: [...data.contexts], domains: [...data.domains],
    functions: [...data.functions], languageNodes: [...data.languageNodes], sources: [...data.sources, source],
    occurrences: [...data.occurrences] };
  const language = source.language || "ja";
  const byExpression = new Map(next.languageNodes.map(n => [key(n.expression, n.language || "ja"), n]));
  let added = 0;
  let firstId = "";
  const seenInSource = new Set<string>();
  for (const item of incoming) {
    const expression = item.expression.trim().normalize("NFKC");
    if (!expression) continue;
    const expressionKey = key(expression, language);
    let node = byExpression.get(expressionKey);
    if (!node) {
      node = withClassification(next, { ...item, expression, language, sourceId: source.id, encounterCount: item.encounterCount || 0 });
      next.languageNodes.push(node);
      byExpression.set(expressionKey, node);
      added++;
    } else if ((!node.furigana?.length && item.furigana?.length) || (!node.reading && item.reading)) {
      node = { ...node, reading: node.reading || item.reading, furigana: node.furigana?.length ? node.furigana : item.furigana };
      next.languageNodes = next.languageNodes.map(existing => existing.id === node!.id ? node! : existing);
      byExpression.set(expressionKey, node);
    }
    firstId ||= node.id;
    if (seenInSource.has(node.id)) continue;
    seenInSource.add(node.id);
    next.occurrences.push({ id: crypto.randomUUID(), sourceId: source.id, nodeId: node.id,
      excerpt: item.sourceContext || item.examples[0] || "", createdAt: new Date().toISOString() });
  }
  if (added) {
    const existing = new Set(data.languageEdges.map(e => e.id));
    next.languageEdges = [...data.languageEdges, ...buildEdges(next.languageNodes).filter(e => !existing.has(e.id))];
  }
  return { data: next, added, linked: seenInSource.size, firstId };
}
