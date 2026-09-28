import type { AppData } from "../types/language.ts";

export function languageView(data: AppData, language: string): AppData {
  if (language === "all") return data;
  const nodes = data.languageNodes.filter(node => (node.language || "ja") === language);
  const nodeIds = new Set(nodes.map(node => node.id));
  const sources = data.sources.filter(source => (source.language || "ja") === language);
  const sourceIds = new Set(sources.map(source => source.id));
  return { ...data, languageNodes: nodes, sources,
    occurrences: data.occurrences.filter(occurrence => nodeIds.has(occurrence.nodeId) && sourceIds.has(occurrence.sourceId)),
    languageEdges: data.languageEdges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
    fragments: data.fragments.filter(fragment => fragment.expressionIds.some(id => nodeIds.has(id)))
      .map(fragment => ({ ...fragment, expressionIds: fragment.expressionIds.filter(id => nodeIds.has(id)) })),
  };
}
