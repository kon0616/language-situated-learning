import type { AppData, LanguageNode } from "../types/language.ts";
import type { MaterialAnalysis, MaterialAnalysisResult } from "../types/materialAnalysis.ts";
import { extractLanguage } from "./extractor.ts";
import { guessLanguage, languageCode } from "./languages.ts";
import { apiFetch, hostedApiStatus, isHostedApi } from "./apiClient.ts";
import { mergeMaterialAnalyses, splitMaterial } from "./materialChunks.ts";

interface AnalysisResponse {
  analysis?: MaterialAnalysis;
  detection?: { primary: string; languages: string[]; confidence: "high" | "low" };
  learningLanguage?: string;
  error?: string;
}

async function hostedAnalysis(rawText: string, title: string, sourceType: string, data: AppData, prompt: string,
  targetLanguage: string, explanationLanguage: string): Promise<AnalysisResponse> {
  const detectionResponse = await apiFetch("/api/detect-language", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawText }) });
  const detectionBody = await detectionResponse.json() as AnalysisResponse["detection"] & { error?: string };
  if (!detectionResponse.ok) throw new Error(detectionBody.error || "语言检测失败。");
  const detection = detectionBody;
  const requestedLanguage = languageCode(targetLanguage);
  const learningLanguage = requestedLanguage === "und" ? detection.primary : requestedLanguage;
  if (learningLanguage === "und") throw new Error("无法可靠识别材料语言。请在 Inbox 手动选择本次学习语言后重试。");

  async function analyzePiece(piece: string, pieceTitle: string, depth = 0): Promise<MaterialAnalysis[]> {
    const response = await apiFetch("/api/analyze-chunk", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: piece, title: pieceTitle, sourceType, prompt, targetLanguage: learningLanguage,
        explanationLanguage, taxonomy: { contexts: data.contexts.map(c => c.name),
          domains: data.domains.map(d => d.name), functions: data.functions.map(f => f.name) } }) });
    const body = await response.json().catch(() => ({})) as { analysis?: MaterialAnalysis; error?: string };
    if (response.ok && body.analysis) return [body.analysis];
    if ((response.status === 504 || body.error?.includes("模型输出被截断")) && piece.length > 200 && depth < 5) {
      const smaller = splitMaterial(piece, Math.max(200, Math.ceil(piece.length / 2)));
      if (smaller.length > 1) {
        const recovered: MaterialAnalysis[] = [];
        for (const [index, part] of smaller.entries())
          recovered.push(...await analyzePiece(part, `${pieceTitle}（细分 ${index + 1}/${smaller.length}）`, depth + 1));
        return recovered;
      }
    }
    throw new Error(body.error || `材料分析失败（HTTP ${response.status}）。`);
  }

  const chunks = splitMaterial(rawText, 1200);
  const parts: MaterialAnalysis[] = [];
  for (const [index, chunk] of chunks.entries())
    parts.push(...await analyzePiece(chunk, chunks.length === 1 ? title : `${title}（第 ${index + 1}/${chunks.length} 段）`));
  return { analysis: mergeMaterialAnalyses(parts), detection, learningLanguage };
}

export async function analyzeMaterial(rawText: string, title: string, sourceType: string, data: AppData, prompt: string,
  targetLanguage = "und", explanationLanguage = "zh"): Promise<MaterialAnalysisResult> {
  const status = isHostedApi() ? hostedApiStatus() : await (async () => {
    const response = await fetch("/api/config");
    if (!response.ok) throw new Error("无法连接本地 API 服务。请重新运行 npm run dev。");
    return response.json() as Promise<{ configured?: boolean }>;
  })();
  if (!status.configured) {
    const guessed = guessLanguage(rawText);
    const code = targetLanguage === "und" ? guessed.code : languageCode(targetLanguage, guessed.code);
    if (code !== "ja") throw new Error("多语言材料分析需要先在 AI 配置中填写 DeepSeek API Key；本地示例提取仅支持日语示例。");
    const nodes = await extractLanguage(rawText);
    return { summary: "本地日语示例提取；配置 DeepSeek API 后可分析其他语言。", groups: [],
      nodes: nodes.map(n => ({ ...n, language: "ja" })), mode: "mock", detectedLanguage: "ja", materialLanguage: guessed.code,
      detectedLanguages: ["ja"], confidence: guessed.confidence };
  }
  let body: AnalysisResponse;
  if (isHostedApi()) body = await hostedAnalysis(rawText, title, sourceType, data, prompt, targetLanguage, explanationLanguage);
  else {
    const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText, title, sourceType, prompt, targetLanguage, explanationLanguage,
        taxonomy: { contexts: data.contexts.map(c => c.name), domains: data.domains.map(d => d.name), functions: data.functions.map(f => f.name) } }) });
    body = await response.json() as AnalysisResponse;
    if (!response.ok || !body.analysis) throw new Error(body.error || "材料分析失败，请稍后重试。");
  }
  if (!body.analysis) throw new Error(body.error || "材料分析失败，请稍后重试。");
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
