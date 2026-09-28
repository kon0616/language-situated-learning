import type { AppData, LanguageNode } from "../types/language.ts";
import {
  contextNames,
  domainNames,
  functionNames,
  path,
  normalize,
} from "../data/taxonomy.ts";
export function searchNodes(data: AppData, query: string): LanguageNode[] {
  const q = normalize(query);
  if (!q) return [];
  return data.languageNodes
    .filter((n) => {
      const context = n.contextIds.flatMap((id) =>
        path(data.contexts, id).map((c) => c.name),
      );
      const domain = n.domainIds.flatMap((id) =>
        path(data.domains, id).map((c) => c.name),
      );
      return [
        n.expression,
        n.meaning || "",
        ...n.collocations,
        ...n.examples,
        ...context,
        ...domain,
        ...contextNames(data, n),
        ...domainNames(data, n),
        ...functionNames(data, n),
      ].some((text) => normalize(text).includes(q));
    })
    .slice(0, 20);
}
