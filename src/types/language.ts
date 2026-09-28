export type Status = "seen" | "understood" | "tried" | "spontaneous";
export interface FuriganaPart { text: string; reading?: string }
export interface LanguageNode {
  id: string;
  language?: string;
  expression: string;
  reading?: string;
  readingManual?: boolean;
  furigana?: FuriganaPart[];
  type:
    | "collocation"
    | "pragmatic"
    | "pattern"
    | "discourse"
    | "slang"
    | "idiom"
    | "mimetic"
    | "terminology";
  meaning?: string;
  contextIds: string[];
  domainIds: string[];
  functionIds: string[];
  coreImage?: string;
  collocations: string[];
  examples: string[];
  alternatives?: {
    expression: string;
    relation: "softer" | "stronger" | "formal" | "casual" | "similar";
  }[];
  register: { level: "casual" | "neutral" | "formal"; notes?: string };
  nuance?: string;
  sourceContext?: string;
  sourceId?: string;
  status: Status;
  createdAt: string;
  lastReviewedAt?: string;
  encounterCount: number;
  lastEncounteredAt?: string;
  tags?: string[];
  uncertain?: boolean;
  usefulness?: number;
  suggestedLinks?: string[];
  suggestedContexts?: string[];
  suggestedDomains?: string[];
  suggestedFunctions?: string[];
}
export interface FragmentLine { speaker?: string; text: string; expressionIds?: string[] }
export interface LanguageFragment {
  id: string;
  type: "dialogue" | "short_text" | "inner_speech";
  contextId?: string;
  domainId?: string;
  title?: string;
  content: FragmentLine[];
  expressionIds: string[];
  source: "generated" | "original";
  sourceId?: string;
  createdAt: string;
}
export type LanguageEdgeRelation =
  | "same_scene"
  | "same_function"
  | "same_domain"
  | "similar"
  | "contrast"
  | "stronger"
  | "softer"
  | "often_with"
  | "followed_by";
export interface LanguageEdge {
  id: string;
  source: string;
  target: string;
  relation: LanguageEdgeRelation;
}
export interface ContextCategory {
  id: string;
  name: string;
  parentId?: string;
  aliases?: string[];
}
export interface DomainCategory {
  id: string;
  name: string;
  parentId?: string;
  aliases?: string[];
}
export interface LanguageFunction {
  id: string;
  name: string;
  aliases?: string[];
}
export interface Source {
  id: string;
  language?: string;
  languages?: string[];
  title: string;
  type:
    "voice room" | "YouTube" | "conversation" | "article" | "drama" | "other";
  date: string;
  rawText: string;
}
export interface SourceOccurrence {
  id: string;
  sourceId: string;
  nodeId: string;
  excerpt: string;
  createdAt: string;
}
export interface AppData {
  schemaVersion: 2;
  languageNodes: LanguageNode[];
  languageEdges: LanguageEdge[];
  sources: Source[];
  occurrences: SourceOccurrence[];
  contexts: ContextCategory[];
  domains: DomainCategory[];
  functions: LanguageFunction[];
  fragments: LanguageFragment[];
  todayHistory?: Record<string, string[]>;
}
export const statusLabels: Record<Status, string> = {
  seen: "见过",
  understood: "理解",
  tried: "尝试使用",
  spontaneous: "自然使用",
};
export const typeLabels: Record<LanguageNode["type"], string> = {
  collocation: "固定搭配",
  pragmatic: "语用表达",
  pattern: "句型骨架",
  discourse: "话语衔接",
  slang: "口语俚语",
  idiom: "惯用语",
  mimetic: "拟声拟态",
  terminology: "术语表达",
};
