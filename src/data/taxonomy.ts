import type {
  AppData,
  ContextCategory,
  DomainCategory,
  LanguageFunction,
  LanguageNode,
} from "../types/language.ts";
const contextRows: [string, string, string?, string[]?][] = [
  ["social", "日常社交"],
  ["social-chat", "闲聊", "social"],
  ["social-opinion", "意见讨论", "social", ["讨论", "观点讨论"]],
  ["social-agree", "表达同意", "social-opinion"],
  ["social-partial", "部分同意后反驳", "social-opinion", ["部分同意"]],
  ["social-soft-no", "温和反对", "social-opinion"],
  [
    "social-oversimplified",
    "指出过度简化",
    "social-opinion",
    ["指出对方过度下结论"],
  ],
  ["social-explain", "请求解释", "social-opinion"],
  ["social-end", "结束无效争论", "social-opinion", ["结束争论"]],
  ["social-limited", "限定同意范围", "social-opinion"],
  ["social-request", "请求", "social"],
  ["social-invite", "邀请 / 拒绝", "social"],
  ["social-topic", "转换话题", "social"],
  ["work", "工作 / 商务"],
  ["work-task", "确认任务", "work"],
  ["work-suggest", "提出建议", "work"],
  ["work-disagree", "表达不同意见", "work"],
  ["work-report", "汇报问题", "work"],
  ["work-schedule", "时间协调", "work"],
  ["study", "学习 / 讨论"],
  ["study-explain", "解释观点", "study"],
  ["study-summary", "总结", "study"],
  ["study-example", "举例", "study"],
  ["study-guess", "推测", "study"],
  ["study-rephrase", "修正表达", "study"],
  ["study-question", "提问", "study"],
  ["relationship", "关系 / 情绪"],
  ["relationship-feeling", "表达感受", "relationship"],
  ["relationship-boundary", "设定边界", "relationship"],
  ["relationship-clarify", "澄清误解", "relationship"],
  ["relationship-expect", "表达期待", "relationship"],
  ["online", "线上交流"],
  ["daily", "生活事务"],
  ["daily-uncategorized", "待归类", "daily"],
];
const domainRows: [string, string, string?, string[]?][] = [
  ["general", "General", undefined, ["一般", "通用", "日常", "general"]],
  [
    "architecture-design",
    "建筑・设计",
    undefined,
    ["建筑", "设计", "Architecture", "Architecture & Design"],
  ],
  ["architecture-spatial", "空间评价", "architecture-design"],
  ["architecture-feeling", "空间感受", "architecture-design"],
  ["architecture-flow", "动线", "architecture-design"],
  ["architecture-scale", "尺度", "architecture-design"],
  ["architecture-material", "材料", "architecture-design"],
  ["architecture-light", "光", "architecture-design"],
  ["architecture-construction", "构法", "architecture-design"],
  ["architecture-landscape", "城市 / 景观", "architecture-design"],
  ["art-visual", "艺术・视觉"],
  ["art-description", "作品描述", "art-visual"],
  ["art-aesthetics", "审美", "art-visual"],
  ["art-process", "创作过程", "art-visual"],
  ["art-medium", "媒介", "art-visual"],
  ["literature-writing", "文学・写作"],
  ["literature-emotion", "情绪描写", "literature-writing"],
  ["literature-narrative", "叙事", "literature-writing"],
  ["literature-rhetoric", "修辞", "literature-writing"],
  ["literature-written", "书面表达", "literature-writing"],
  ["society-culture", "社会・文化"],
  ["technology", "科技・互联网"],
  ["business", "工作・商业"],
  ["daily-life", "日常生活"],
];
const functionRows: [string, string, string[]?][] = [
  ["agree", "同意", ["表达同意", "acknowledge"]],
  ["disagree", "反驳", ["不同意见", "指出过度简化"]],
  ["soften", "缓和", ["soften disagreement", "先认同，再补充不同意见"]],
  ["limit", "限定", ["限定判断的角度"]],
  ["summary", "总结"],
  ["example", "举例"],
  ["compare", "比较"],
  ["reject", "拒绝", ["拒绝强加的观点"]],
  ["request", "请求"],
  ["confirm", "确认"],
  ["describe", "描述"],
  ["evaluate", "评价", ["质疑过早的判断", "指出方案未触及根源"]],
  ["guess", "推测"],
  ["shift", "转话题"],
  ["end", "结束话题", ["暂停没有产出的争论", "判断讨论无法推进"]],
  ["negotiate", "寻找共识", ["寻找双方能接受的方案"]],
];
export const contextSeed: ContextCategory[] = contextRows.map(
  ([id, name, parentId, aliases]) => ({ id, name, parentId, aliases }),
);
export const domainSeed: DomainCategory[] = domainRows.map(
  ([id, name, parentId, aliases]) => ({ id, name, parentId, aliases }),
);
export const functionSeed: LanguageFunction[] = functionRows.map(
  ([id, name, aliases]) => ({ id, name, aliases }),
);
export const normalize = (s: string) =>
  s
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s・·／/（）()，,。.!！?？]/g, "");
const equivalent = (a: string, b: string) => normalize(a) === normalize(b);
const slug = () => crypto.randomUUID();
export function findCategory<
  T extends { id: string; name: string; aliases?: string[] },
>(items: T[], value: string): T | undefined {
  const v = normalize(value);
  return items.find(
    (x) =>
      normalize(x.id) === v ||
      equivalent(x.name, value) ||
      x.aliases?.some((a) => equivalent(a, value)),
  );
}
export function path<T extends { id: string; parentId?: string }>(
  items: T[],
  id: string,
): T[] {
  const result: T[] = [];
  let item = items.find((x) => x.id === id);
  const seen = new Set<string>();
  while (item && !seen.has(item.id)) {
    result.unshift(item);
    seen.add(item.id);
    item = items.find((x) => x.id === item?.parentId);
  }
  return result;
}
export function descendants<T extends { id: string; parentId?: string }>(
  items: T[],
  id: string,
): string[] {
  const result = [id];
  for (let i = 0; i < result.length; i++)
    result.push(
      ...items.filter((x) => x.parentId === result[i]).map((x) => x.id),
    );
  return result;
}
// Extraction may create children, but never an uncontrolled top-level category.
function resolveTree<
  T extends { id: string; name: string; parentId?: string; aliases?: string[] },
>(items: T[], label: string, rootId: string): string {
  const clean = label.trim();
  if (!clean) return rootId;
  const existing = findCategory(items, clean);
  if (existing) return existing.id;
  const id = `custom-${slug()}`;
  items.push({ id, name: clean, parentId: rootId } as T);
  return id;
}
export function resolveContext(data: AppData, label: string) {
  return resolveTree(data.contexts, label, "daily");
}
export function resolveDomain(data: AppData, label: string) {
  return resolveTree(data.domains, label, "general");
}
export function resolveFunction(data: AppData, label: string) {
  const clean = label.trim();
  if (!clean) return "describe";
  const existing = findCategory(data.functions, clean);
  if (existing) return existing.id;
  const id = `custom-${slug()}`;
  data.functions.push({ id, name: clean });
  return id;
}
export function withClassification(
  data: AppData,
  node: LanguageNode,
): LanguageNode {
  const contexts = node.suggestedContexts?.length
    ? node.suggestedContexts
    : node.contextIds;
  const domains = node.suggestedDomains?.length
    ? node.suggestedDomains
    : node.domainIds;
  const functions = node.suggestedFunctions?.length
    ? node.suggestedFunctions
    : node.functionIds;
  return {
    ...node,
    contextIds: [
      ...new Set(
        contexts.map((x) =>
          data.contexts.some((c) => c.id === x) ? x : resolveContext(data, x),
        ),
      ),
    ],
    domainIds: [
      ...new Set(
        domains.map((x) =>
          data.domains.some((c) => c.id === x) ? x : resolveDomain(data, x),
        ),
      ),
    ],
    functionIds: [
      ...new Set(
        functions.map((x) =>
          data.functions.some((c) => c.id === x) ? x : resolveFunction(data, x),
        ),
      ),
    ],
    suggestedContexts: undefined,
    suggestedDomains: undefined,
    suggestedFunctions: undefined,
  };
}
export function contextNames(data: AppData, node: LanguageNode) {
  return node.contextIds.map(
    (id) => data.contexts.find((x) => x.id === id)?.name || "待归类",
  );
}
export function domainNames(data: AppData, node: LanguageNode) {
  return node.domainIds.map(
    (id) => data.domains.find((x) => x.id === id)?.name || "General",
  );
}
export function functionNames(data: AppData, node: LanguageNode) {
  return node.functionIds.map(
    (id) => data.functions.find((x) => x.id === id)?.name || "描述",
  );
}
