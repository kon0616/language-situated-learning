import type {
  AppData,
  LanguageEdgeRelation,
  LanguageNode,
} from "../types/language.ts";
export interface LocalLink {
  source: string;
  target: string;
  relation: LanguageEdgeRelation;
}
const overlap = (a: string[], b: string[]) => a.some((x) => b.includes(x));
export function relation(
  a: LanguageNode,
  b: LanguageNode,
): LanguageEdgeRelation | undefined {
  if (overlap(a.contextIds, b.contextIds)) return "same_scene";
  if (overlap(a.functionIds, b.functionIds)) return "same_function";
  if (
    overlap(
      a.domainIds.filter((x) => x !== "general"),
      b.domainIds,
    )
  )
    return "same_domain";
  return undefined;
}
export function localGraph(data: AppData, centerId: string, hops: 1 | 2 = 1) {
  const center = data.languageNodes.find((n) => n.id === centerId);
  if (!center) return { nodes: [] as LanguageNode[], links: [] as LocalLink[] };
  const byId = new Map(data.languageNodes.map((n) => [n.id, n]));
  const explicit = new Map<string, LanguageEdgeRelation>();
  for (const e of data.languageEdges) {
    explicit.set(`${e.source}|${e.target}`, e.relation);
    explicit.set(`${e.target}|${e.source}`, e.relation);
  }
  const ranked = (node: LanguageNode, exclude: Set<string>) =>
    data.languageNodes
      .filter((n) => n.id !== node.id && !exclude.has(n.id))
      .map((n) => {
        const rawEdge = explicit.get(`${node.id}|${n.id}`);
        const inferred = relation(node, n);
        const edge =
          rawEdge === "same_scene" && !overlap(node.contextIds, n.contextIds)
            ? undefined
            : rawEdge === "same_function" &&
                !overlap(node.functionIds, n.functionIds)
              ? undefined
              : rawEdge === "same_domain" &&
                  !overlap(node.domainIds, n.domainIds)
                ? undefined
                : rawEdge;
        const score =
          (edge && edge !== "same_scene" ? 8 : 0) +
          (overlap(node.contextIds, n.contextIds) ? 6 : 0) +
          (overlap(node.functionIds, n.functionIds) ? 3 : 0) +
          (overlap(
            node.domainIds.filter((x) => x !== "general"),
            n.domainIds,
          )
            ? 2
            : 0);
        return { node: n, relation: edge || inferred, score };
      })
      .filter((x) => x.relation && x.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score || b.node.createdAt.localeCompare(a.node.createdAt),
      );
  const nodes = [center],
    links: LocalLink[] = [];
  const ids = new Set([center.id]);
  const add = (source: string, limit: number) => {
    const origin = byId.get(source);
    if (!origin) return;
    for (const item of ranked(origin, ids).slice(0, limit)) {
      if (nodes.length >= (hops === 1 ? 7 : 19)) break;
      nodes.push(item.node);
      ids.add(item.node.id);
      links.push({ source, target: item.node.id, relation: item.relation! });
    }
  };
  add(centerId, 6);
  if (hops === 2) {
    const firstHop = nodes.slice(1);
    for (const neighbor of firstHop) {
      if (nodes.length >= 19) break;
      add(neighbor.id, 2);
    }
  }
  return { nodes, links };
}
