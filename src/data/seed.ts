import type { LanguageNode, AppData } from "../types/language.ts";
import {
  contextSeed,
  domainSeed,
  functionSeed,
  findCategory,
} from "./taxonomy.ts";
import { fragmentSeed } from "./fragments.ts";
export const sampleTranscript =
  "そこは分かるんですけど、多分個人に言っても結局それって根本的な解決にならないんですよね。ここで言い争っても水掛け論になると思うんで、一旦この話は置いときましょう。";
const entries: [
  string,
  LanguageNode["type"],
  string,
  string,
  string[],
  string,
  string,
  string,
][] = [
  [
    "言いたいことは分かるんだけど",
    "pragmatic",
    "部分同意后反驳",
    "先认同，再补充不同意见",
    ["言いたいことはすごく分かるんだけど", "気持ちは分かるんだけど"],
    "言いたいことは分かるんだけど、そんな単純な話じゃないと思う。",
    "先接住对方的想法，再为不同看法留出空间。",
    "比直接否定温和，但后面通常会接保留意见。",
  ],
  [
    "そういう意味では",
    "discourse",
    "限定同意范围",
    "限定判断的角度",
    ["そういう意味では確かに", "そういう意味では賛成だ"],
    "そういう意味では、確かにいい方法だと思う。",
    "为同意的部分画一个边界。",
    "只在刚才提到的角度上成立，并非全盘赞同。",
  ],
  [
    "決めつける",
    "collocation",
    "指出对方过度下结论",
    "质疑过早的判断",
    ["〜だと決めつける", "最初から決めつける", "勝手に決めつけないで"],
    "まだ話していないのに、最初から決めつけないで。",
    "把尚未确定的判断钉死。",
    "直接对人使用时有责备感。",
  ],
  [
    "押し付ける",
    "collocation",
    "指出对方过度下结论",
    "拒绝强加的观点",
    ["価値観を押し付ける", "考えを押し付ける", "正しさを押し付ける"],
    "自分の価値観を人に押し付けたくない。",
    "把自己的想法硬塞给别人。",
    "通常带负面评价，注意关系与语气。",
  ],
  [
    "水掛け論になる",
    "idiom",
    "结束无效争论",
    "暂停没有产出的争论",
    ["水掛け論にしかならない", "これ以上話しても水掛け論だ"],
    "これ以上話しても水掛け論になると思う。",
    "双方不停往对方身上泼水，但没有真正解决问题。",
    "指出双方各执一词，继续争执无法推进。",
  ],
  [
    "落としどころを探す",
    "collocation",
    "结束无效争论",
    "寻找双方能接受的方案",
    ["現実的な落としどころ", "お互いの落としどころを探す"],
    "お互いに納得できる落としどころを探しましょう。",
    "让悬而未决的分歧找到能落地的地方。",
    "常用于协商，强调可接受的折中。",
  ],
  [
    "一旦置いといて",
    "discourse",
    "结束无效争论",
    "暂停没有产出的争论",
    ["その話は一旦置いといて", "細かいことは一旦置いといて"],
    "その話は一旦置いといて、次の予定を決めよう。",
    "先把话题放在一边，稍后再拿起来。",
    "「置いておいて」的口语缩略，不一定是拒绝讨论。",
  ],
  [
    "〜で言えば",
    "pattern",
    "限定同意范围",
    "限定判断的角度",
    ["値段で言えば", "使いやすさで言えば"],
    "使いやすさで言えば、こっちのほうがいい。",
    "从多个比较维度中选出一个。",
    "清楚说明当前评价依据。",
  ],
  [
    "あくまで〜",
    "pattern",
    "限定同意范围",
    "限定判断的角度",
    ["あくまで個人の意見", "あくまで参考として"],
    "これはあくまで個人の意見です。",
    "给自己的说法划定适用范围。",
    "避免对方把个人看法理解为定论。",
  ],
  [
    "奥行きが出る",
    "terminology",
    "空间评价",
    "描述",
    ["空間に奥行きが出る", "奥行きのある空間"],
    "光の使い方で空間に奥行きが出る。",
    "空间显出纵深与层次。",
    "常用于建筑或视觉构图。",
  ],
  [
    "圧迫感がある",
    "collocation",
    "空间评价",
    "评价",
    ["圧迫感のある空間", "圧迫感を感じる"],
    "天井が低いと圧迫感がある。",
    "空间让人感到被挤压。",
    "常形容尺度或布置带来的感受。",
  ],
  [
    "抜け感がある",
    "collocation",
    "空间评价",
    "评价",
    ["抜け感のあるデザイン", "空間に抜け感を出す"],
    "大きな窓のおかげで抜け感がある。",
    "视野能舒展开来。",
    "设计语境常用。",
  ],
  [
    "視線が抜ける",
    "collocation",
    "空间评价",
    "描述",
    ["外まで視線が抜ける", "視線の抜け"],
    "中庭まで視線が抜ける。",
    "目光能够穿过空间继续延伸。",
    "描述空间的通透关系。",
  ],
  [
    "動線が交差する",
    "terminology",
    "动线",
    "描述",
    ["人の動線が交差する", "動線の交差"],
    "入口で二つの動線が交差する。",
    "两条移动路线在一点相遇。",
    "常用于讨论空间规划。",
  ],
];
export function seedNodes(): LanguageNode[] {
  return entries.map((e, i) => ({
    id: `seed-${i}`,
    language: "ja",
    expression: e[0],
    type: e[1],
    contextIds:
      i === 1
        ? ["social-limited", "social-partial"]
        : i < 9
          ? [findCategory(contextSeed, e[2])?.id || "daily-uncategorized"]
          : ["study-explain"],
    domainIds:
      i < 9
        ? ["general"]
        : [i === 13 ? "architecture-flow" : "architecture-spatial"],
    functionIds:
      i === 0
        ? ["agree", "soften", "disagree"]
        : i === 1
          ? ["limit", "soften"]
          : i < 9
            ? [findCategory(functionSeed, e[3])?.id || "describe"]
            : [findCategory(functionSeed, e[3])?.id || "describe"],
    collocations: e[4],
    examples: [e[5]],
    coreImage: e[6],
    nuance: e[7],
    register: {
      level: i === 6 ? "casual" : "neutral",
      notes: "日常对话 / 讨论",
    },
    status: i === 0 ? "tried" : i % 3 === 0 ? "seen" : "understood",
    encounterCount: 0,
    createdAt: new Date(
      Date.now() - (entries.length - i) * 86400000,
    ).toISOString(),
    sourceId: "seed-source",
    sourceContext: e[5],
    alternatives:
      i === 4
        ? [
            { expression: "一旦置いといて", relation: "softer" },
            { expression: "落としどころを探す", relation: "similar" },
          ]
        : [],
  }));
}
export function buildEdges(nodes: LanguageNode[]) {
  // Index recent members per category instead of comparing every expression pair.
  const byContext = new Map<string, string[]>(),
    byDomain = new Map<string, string[]>();
  const edges: import("../types/language.ts").LanguageEdge[] = [];
  for (const node of nodes) {
    const language = node.language || "ja";
    const candidates = new Map<string, "same_scene" | "same_domain">();
    for (const id of node.contextIds)
      for (const other of byContext.get(`${language}:${id}`) || [])
        candidates.set(other, "same_scene");
    for (const id of node.domainIds.filter((id) => id !== "general"))
      for (const other of byDomain.get(`${language}:${id}`) || [])
        if (!candidates.has(other)) candidates.set(other, "same_domain");
    for (const [other, relation] of [...candidates].slice(0, 3))
      edges.push({
        id: `${other}-${node.id}`,
        source: other,
        target: node.id,
        relation,
      });
    for (const id of node.contextIds) {
      const list = byContext.get(`${language}:${id}`) || [];
      list.unshift(node.id);
      byContext.set(`${language}:${id}`, list.slice(0, 3));
    }
    for (const id of node.domainIds) {
      const list = byDomain.get(`${language}:${id}`) || [];
      list.unshift(node.id);
      byDomain.set(`${language}:${id}`, list.slice(0, 3));
    }
  }
  return edges;
}
export function createSeed(): AppData {
  const nodes = seedNodes();
  return {
    schemaVersion: 2,
    languageNodes: nodes,
    languageEdges: buildEdges(nodes),
    contexts: structuredClone(contextSeed),
    domains: structuredClone(domainSeed),
    functions: structuredClone(functionSeed),
    fragments: structuredClone(fragmentSeed),
    occurrences: nodes.map(n => ({ id: `seed-occurrence-${n.id}`, sourceId: "seed-source", nodeId: n.id, excerpt: n.sourceContext || n.examples[0] || "", createdAt: n.createdAt })),
    todayHistory: {},
    sources: [
      {
        id: "seed-source",
        language: "ja",
        title: "日常讨论 · 示例语料",
        type: "conversation",
        date: new Date().toLocaleDateString("en-CA"),
        rawText: entries.map((e) => e[5]).join("\n"),
      },
    ],
  };
}
