import type { AppData, LanguageNode } from "../types/language.ts";
import type { MaterialAnalysis, MaterialAnalysisResult } from "../types/materialAnalysis.ts";
import { extractLanguage } from "./extractor.ts";
import { guessLanguage, languageCode } from "./languages.ts";

export async function analyzeMaterial(rawText: string, title: string, sourceType: string, data: AppData, prompt: string,
  targetLanguage = "und", explanationLanguage = "zh"): Promise<MaterialAnalysisResult> {
  const statusResponse = await fetch("/api/config");
  if (!statusResponse.ok) throw new Error("无法连接本地 API 服务。请重新运行 npm run dev。");
  const status = await statusResponse.json() as { configured?: boolean };
  if (!status.configured) {
    const guessed = guessLanguage(rawText);
    const code = targetLanguage === "und" ? guessed.code : languageCode(targetLanguage, guessed.code);
    if (code !== "ja") throw new Error("多语言材料分析需要先在 AI 配置中填写 DeepSeek API Key；本地示例提取仅支持日语示例。");
    const nodes = await extractLanguage(rawText);
    return { summary: "本地日语示例提取；配置 DeepSeek API 后可分析其他语言。", groups: [],
      nodes: nodes.map(n => ({ ...n, language: "ja" })), mode: "mock", detectedLanguage: "ja", materialLanguage: guessed.code,
      detectedLanguages: ["ja"], confidence: guessed.confidence };
  }
  const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawText, title, sourceType, prompt, targetLanguage, explanationLanguage,
      taxonomy: { contexts: data.contexts.map(c => c.name), domains: data.domains.map(d => d.name), functions: data.functions.map(f => f.name) } }) });
  const body = await response.json() as { analysis?: MaterialAnalysis; detection?: { primary: string; languages: string[]; confidence: "high" | "low" }; learningLanguage?: string; error?: string };
  if (!response.ok || !body.analysis) throw new Error(body.error || "材料分析失败，请稍后重试。");
  const code = languageCode(body.learningLanguage, languageCode(targetLanguage, "ja"));
  const now = new Date().toISOString();
  const nodes: LanguageNode[] = body.analysis.expressions.map(x => ({
    id: crypto.randomUUID(), language: code, expression: x.expression, reading: x.reading, furigana: x.furigana,
    type: x.type, meaning: x.meaning,
    contextIds: [], domainIds: ["general"], functionIds: ["describe"],
    suggestedContexts: x.contextLabels.length ? x.contextLabels : ["待归类"],
    suggestedDomains: x.domainLabels.length ? x.domainLabels : ["General"],
    suggestedFunctions: x.functionLabels.length ? x.functionLabels : ["描述"],
    coreImage: x.coreImage, collocations: x.collocations, examples: x.examples,
    register: x.register, nuance: x.nuance, sourceContext: x.sourceContext,
    uncertain: x.uncertain, usefulness: x.usefulness, status: "seen", encounterCount: 0, createdAt: now,
  }));
  return { summary: body.analysis.summary, groups: body.analysis.groups, nodes, mode: "deepseek",
    detectedLanguage: code, detectedLanguages: body.detection?.languages || [code], materialLanguage: body.detection?.primary || code,
    confidence: body.detection?.confidence || "low" };
}
