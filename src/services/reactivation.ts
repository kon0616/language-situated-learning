import type { AppData, LanguageNode } from "../types/language.ts";
export const scenarios: Record<string, string> = {
  "social-opinion":
    "你正在和朋友讨论一个看法。你想先说明自己认同的部分，再温和地补充不同角度。你会怎么说？",
  "social-partial":
    "对方说了一个你觉得有一定道理、但过度简化的观点。你想先承认一部分，再表达不同意见。你会怎么回应？",
  "social-limited":
    "朋友问你两种方案哪一个更好。你只认可其中一个方面，不想让对方以为你完全赞同。你会怎么说？",
  "social-oversimplified":
    "对方还没了解完整情况，就认定别人一定是错的。你想提醒他留一点判断空间。你会怎么回应？",
  "social-end":
    "讨论了很久，双方一直重复自己的立场。你想先暂停争论，让事情往前推进。你会怎么说？",
};
export function dailyContexts(
  nodes: LanguageNode[],
  date = new Date().toLocaleDateString("en-CA"),
) {
  const groups = [...new Set(nodes.flatMap((n) => n.contextIds))];
  const hash = (s: string) =>
    [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
  const priority = (id: string) => {
    const related = nodes.filter((n) => n.contextIds.includes(id));
    return (
      (related.some((n) => n.status !== "spontaneous") ? 1e14 : 0) +
      Math.max(...related.map((n) => Date.parse(n.createdAt) || 0)) +
      hash(date + id) * 100
    );
  };
  return groups.sort((a, b) => priority(b) - priority(a)).slice(0, 3);
}
