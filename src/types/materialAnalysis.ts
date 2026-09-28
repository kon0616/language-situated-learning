import type { FuriganaPart, LanguageNode } from "./language.ts";

export interface MaterialGroup {
  label: string;
  excerpt: string;
  expressionIndexes: number[];
}

export interface MaterialProposal {
  expression: string;
  reading?: string;
  furigana?: FuriganaPart[];
  type: LanguageNode["type"];
  meaning: string;
  contextLabels: string[];
  domainLabels: string[];
  functionLabels: string[];
  coreImage: string;
  collocations: string[];
  examples: string[];
  register: { level: LanguageNode["register"]["level"]; notes: string };
  nuance: string;
  sourceContext: string;
  uncertain: boolean;
  usefulness: number;
}

export interface MaterialAnalysis {
  summary: string;
  groups: MaterialGroup[];
  expressions: MaterialProposal[];
}

export interface MaterialAnalysisResult {
  summary: string;
  groups: MaterialGroup[];
  nodes: LanguageNode[];
  mode: "deepseek" | "mock";
  detectedLanguage: string;
  materialLanguage: string;
  detectedLanguages: string[];
  confidence: "high" | "low";
}
