import type { LanguageNode } from "../types/language.ts";
import { seedNodes } from "../data/seed.ts";
export interface ExtractionAdapter {
  extract(rawText: string): Promise<LanguageNode[]>;
}
export const mockExtractor: ExtractionAdapter = {
  async extract(rawText) {
    const seeds = seedNodes();
    const candidates: [RegExp, LanguageNode][] = [
      [
        /そこは分かる/,
        {
          ...seeds[0],
          expression: "そこは分かるんですけど",
          collocations: ["そこは分かる", "そこはよく分かるんですけど"],
          examples: ["そこは分かるんですけど、別の方法もあると思います。"],
        },
      ],
      [
        /根本的な解決/,
        {
          ...seeds[2],
          expression: "根本的な解決にならない",
          contextIds: ["social-oversimplified"],
          functionIds: ["evaluate"],
          suggestedContexts: ["指出过度简化"],
          suggestedFunctions: ["评价"],
          coreImage: "只处理表面的现象，根部的问题依然存在。",
          collocations: ["根本的な解決を図る", "根本的な解決にはならない"],
          examples: ["個人に言っても、根本的な解決にはならないと思う。"],
          nuance: "质疑方案是否解决根源，而非否定对方的善意。",
        },
      ],
      [/水掛け論/, seeds[4]],
      [
        /一旦(?:この話は)?置い/,
        { ...seeds[6], expression: "一旦この話は置いとく" },
      ],
    ];
    return candidates
      .filter(([pattern]) => pattern.test(rawText))
      .map(([, n]) => ({
        ...n,
        suggestedContexts: n.suggestedContexts || [
          n.contextIds[0] === "social-partial"
            ? "部分同意后反驳"
            : "结束无效争论",
        ],
        suggestedDomains: n.suggestedDomains || ["General"],
        suggestedFunctions: n.suggestedFunctions || [
          n.functionIds.includes("soften") ? "缓和" : "结束话题",
        ],
        id: crypto.randomUUID(),
        status: "seen",
        sourceId: undefined,
        createdAt: new Date().toISOString(),
        sourceContext:
          rawText
            .split(/(?<=[。！？])/)
            .find((s) => s.includes(n.expression.slice(0, 5))) ||
          rawText.slice(0, 300),
      }));
  },
};
// Replace this adapter with a service calling your server; keep API keys off the client.
let adapter: ExtractionAdapter = mockExtractor;
export function setExtractionAdapter(next: ExtractionAdapter) {
  adapter = next;
}
export function extractLanguage(rawText: string) {
  return adapter.extract(rawText);
}
