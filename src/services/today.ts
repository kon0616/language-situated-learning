import type { LanguageNode } from "../types/language.ts";
function weighted<T>(
  items: T[],
  weight: (item: T) => number,
  rng: () => number,
): T {
  const total = items.reduce((s, x) => s + weight(x), 0);
  let ticket = rng() * total;
  for (const item of items) {
    ticket -= weight(item);
    if (ticket < 0) return item;
  }
  return items[items.length - 1];
}
export function pickToday(
  nodes: LanguageNode[],
  shown: string[],
  count = 4,
  rng = Math.random,
): LanguageNode[] {
  const pool = nodes.filter((n) => !shown.includes(n.id));
  const result: LanguageNode[] = [];
  while (result.length < Math.min(count, 5, nodes.length)) {
    if (!pool.length)
      pool.push(
        ...nodes.filter((n) => !result.some((chosen) => chosen.id === n.id)),
      );
    if (!pool.length) break;
    const learning = pool.filter((n) => n.status !== "spontaneous");
    const candidates = rng() < 0.7 && learning.length ? learning : pool;
    const selected = weighted(
      candidates,
      (n) => (n.status === "spontaneous" ? 0.2 : 1),
      rng,
    );
    result.push(selected);
    pool.splice(
      pool.findIndex((n) => n.id === selected.id),
      1,
    );
  }
  return result;
}
