import type { AppData } from "../types/language.ts";

export function deleteMaterial(data: AppData, sourceId: string): AppData {
  const removed = data.sources.find(source => source.id === sourceId);
  if (!removed) return data;

  const sources = data.sources.filter(source => source.id !== sourceId);
  const occurrences = data.occurrences.filter(item => item.sourceId !== sourceId);
  const survivingOccurrence = new Map<string, typeof occurrences[number]>();
  for (const item of occurrences)
    if (!survivingOccurrence.has(item.nodeId)) survivingOccurrence.set(item.nodeId, item);

  const removedNodeIds = new Set(data.languageNodes
    .filter(node => node.sourceId === sourceId && !survivingOccurrence.has(node.id))
    .map(node => node.id));
  const languageNodes = data.languageNodes.filter(node => !removedNodeIds.has(node.id)).map(node => {
    if (node.sourceId !== sourceId) return node;
    const replacement = survivingOccurrence.get(node.id);
    if (!replacement) return node;
    return { ...node, sourceId: replacement.sourceId, sourceContext: replacement.excerpt,
      examples: node.examples.filter(example => !removed.rawText.includes(example) ||
        sources.some(source => source.rawText.includes(example))) };
  });
  const validIds = new Set(languageNodes.map(node => node.id));
  return { ...data, sources, languageNodes,
    occurrences: occurrences.filter(item => validIds.has(item.nodeId)),
    languageEdges: data.languageEdges.filter(edge => validIds.has(edge.source) && validIds.has(edge.target)),
    fragments: data.fragments.filter(fragment => fragment.sourceId !== sourceId).map(fragment => ({
      ...fragment, expressionIds: fragment.expressionIds.filter(id => validIds.has(id)),
      content: fragment.content.map(line => ({ ...line, expressionIds: line.expressionIds?.filter(id => validIds.has(id)) })),
    })),
    todayHistory: data.todayHistory && Object.fromEntries(Object.entries(data.todayHistory)
      .map(([day, ids]) => [day, ids.filter(id => validIds.has(id))])),
  };
}
