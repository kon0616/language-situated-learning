import type { AppData, LanguageFragment, LanguageNode } from "../types/language.ts";
import { descendants } from "../data/taxonomy.ts";

export interface FragmentRequest { contextId?: string; domainId?: string; expressionIds?: string[] }
export type FragmentAdapter = (request: FragmentRequest, data: AppData) => LanguageFragment;

export function reviewSentences(rawText: string): string[] {
  const sentences = rawText.replace(/\r\n/g, "\n").split(/\n+/)
    .flatMap(paragraph => paragraph.match(/[^。！？.!?؟।]+[。！？.!?؟।]*/g) || [])
    .map(sentence => sentence.trim()).filter(Boolean);
  return sentences.flatMap(sentence => {
    const parts: string[] = [];
    let rest = sentence;
    while (rest.length > 280) {
      const space = rest.lastIndexOf(" ", 280);
      const cut = space >= 140 ? space : 280;
      parts.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) parts.push(rest);
    return parts;
  });
}

export function archiveFragments(data: AppData): LanguageFragment[] {
  const nodes = new Map(data.languageNodes.map(node => [node.id, node]));
  return [...data.sources].sort((a, b) => b.date.localeCompare(a.date)).flatMap(source => {
    const occurrences = data.occurrences.filter(item => item.sourceId === source.id && nodes.has(item.nodeId));
    const sentences = reviewSentences(source.rawText);
    return sentences.flatMap((text, index) => {
      const expressionIdsFor = (line: string) => [...new Set(occurrences
        .filter(item => line.toLocaleLowerCase().includes(nodes.get(item.nodeId)!.expression.toLocaleLowerCase()))
        .map(item => item.nodeId))];
      // Each review card starts with an expression-bearing sentence. The next
      // sentence adds context, but cannot create a second copy of the same card.
      const focalIds = expressionIdsFor(text);
      if (!focalIds.length) return [];
      const next = sentences[index + 1];
      const lines = [text, next].filter((line): line is string => !!line).map(line => ({ text: line,
        expressionIds: expressionIdsFor(line) }));
      const ids = [...new Set(lines.flatMap(line => line.expressionIds))];
      return [{ id: `archive-${source.id}-${index}`, type: "short_text", title: source.title,
        content: lines, expressionIds: ids, source: "original", sourceId: source.id,
        createdAt: occurrences[0]?.createdAt || `${source.date}T00:00:00.000Z` } satisfies LanguageFragment];
    });
  });
}

export function availableFragments(data: AppData): LanguageFragment[] {
  const saved = new Set(data.languageNodes.map(node => node.id));
  const curated = data.fragments.filter(fragment => fragment.source === "generated" && fragment.expressionIds.some(id => saved.has(id)))
    .map(fragment => ({ ...fragment, expressionIds: fragment.expressionIds.filter(id => saved.has(id)),
      content: fragment.content.map(line => ({ ...line, expressionIds: line.expressionIds?.filter(id => saved.has(id)) })) }));
  const originals = archiveFragments(data);
  return [...originals, ...curated];
}

const matches = (fragment: LanguageFragment, request: FragmentRequest, data: AppData) => {
  const contextIds = request.contextId ? descendants(data.contexts, request.contextId) : [];
  const domainIds = request.domainId ? descendants(data.domains, request.domainId) : [];
  const contextScore = !request.contextId || !fragment.contextId ? 0 : request.contextId === fragment.contextId ? 8
    : contextIds.includes(fragment.contextId) ? 6 : descendants(data.contexts, fragment.contextId).includes(request.contextId) ? 4 : 0;
  const domainScore = !request.domainId || !fragment.domainId ? 0 : request.domainId === fragment.domainId ? 8
    : domainIds.includes(fragment.domainId) ? 6 : descendants(data.domains, fragment.domainId).includes(request.domainId) ? 4 : 0;
  return contextScore + domainScore +
    (request.expressionIds || []).filter(id => fragment.expressionIds.includes(id)).length * 3;
};

export const mockFragmentAdapter: FragmentAdapter = (request, data) => {
  const candidates = availableFragments(data)
    .sort((a, b) => matches(b, request, data) - matches(a, request, data));
  const template = candidates[0];
  if (template) {
    return {
      ...template,
      id: `generated-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
  }
  return { id: `generated-${crypto.randomUUID()}`, type: "short_text", title: "暂无可回看的片段",
    content: [],
    expressionIds: [], source: "generated", createdAt: new Date().toISOString() };
};

let adapter: FragmentAdapter = mockFragmentAdapter;
export function setFragmentAdapter(next: FragmentAdapter) { adapter = next; }
export function generateFragment(request: FragmentRequest, data: AppData) { return adapter(request, data); }
export function fragmentForScene(data: AppData, contextId?: string, domainId?: string) {
  const categories = contextId ? descendants(data.contexts, contextId) : domainId ? descendants(data.domains, domainId) : [];
  return availableFragments(data)
    .filter(fragment => fragment.source === "original"
      ? fragment.expressionIds.some(id => { const node = data.languageNodes.find(n => n.id === id);
        return node && (contextId ? node.contextIds : node.domainIds).some(category => categories.includes(category)); })
      : matches(fragment, { contextId, domainId }, data) > 0)
    .sort((a,b) => matches(b, { contextId, domainId }, data) - matches(a, { contextId, domainId }, data))[0];
}
export function eligibleExpressions(nodes: LanguageNode[]) {
  return nodes.filter(n => n.status !== "spontaneous");
}
