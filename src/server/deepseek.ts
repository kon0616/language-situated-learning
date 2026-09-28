import type { IncomingMessage, ServerResponse } from "node:http";
import { materialAnalysisPrompt, languageRules } from "../prompts/materialAnalysis.ts";
import { normalizeMaterialAnalysis } from "../services/materialAnalysisParser.ts";
import { DEEPSEEK_ENDPOINT, DEFAULT_MODEL } from "../config/deepseek.ts";
import { mergeMaterialAnalyses, splitMaterial } from "../services/materialChunks.ts";
import type { MaterialAnalysis } from "../types/materialAnalysis.ts";
import { normalizeFurigana } from "../services/furigana.ts";
import { readApiConfig, writeApiConfig } from "./apiConfig.ts";
import { languageCode, languageName } from "../services/languages.ts";

class OutputTruncatedError extends Error {}

export interface DeepSeekRequest {
  rawText: string;
  title: string;
  sourceType: string;
  targetLanguage?: string;
  explanationLanguage?: string;
  prompt?: string;
  taxonomy?: { contexts?: string[]; domains?: string[]; functions?: string[] };
}

export async function requestDeepSeek(input: DeepSeekRequest, apiKey: string, model = DEFAULT_MODEL, fetchImpl: typeof fetch = fetch) {
  const prompt = input.prompt?.trim() || materialAnalysisPrompt;
  const targetLanguage = languageCode(input.targetLanguage, "ja");
  const explanationLanguage = languageCode(input.explanationLanguage, "zh");
  const response = await fetchImpl(DEEPSEEK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(90000),
    body: JSON.stringify({ model, stream: false, thinking: { type: "disabled" }, max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${prompt}\n\n本次学习语言：${languageName(targetLanguage)}（${targetLanguage}）。释义语言：${languageName(explanationLanguage)}（${explanationLanguage}）。语言补充规则：${languageRules[targetLanguage.split("-")[0]] || "保留该语言真实自然的搭配、语域和使用语境；不确定的读音留空。"}` },
        { role: "user", content: JSON.stringify({
          title: input.title?.slice(0, 120) || "未命名材料",
          sourceType: input.sourceType?.slice(0, 40) || "other",
          targetLanguage, explanationLanguage,
          taxonomy: input.taxonomy || {}, rawText: input.rawText,
        }) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`DeepSeek 返回 HTTP ${response.status}。请检查密钥、模型和账户状态。`);
  const result = await response.json() as { choices?: { finish_reason?: string; message?: { content?: string | null } }[] };
  const choice = result.choices?.[0];
  if (choice?.finish_reason === "length") throw new OutputTruncatedError("模型输出被截断。");
  const content = choice?.message?.content;
  if (!content) throw new Error("DeepSeek 未返回分析内容，请重试。");
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { throw new Error("DeepSeek 返回的 JSON 无法解析，请重试。"); }
  return normalizeMaterialAnalysis(parsed, input.rawText);
}

export async function requestLanguageDetection(rawText: string, apiKey: string, model = DEFAULT_MODEL, fetchImpl: typeof fetch = fetch) {
  const sample = rawText.length <= 3600 ? rawText :
    `${rawText.slice(0, 1200)}\n…\n${rawText.slice(Math.floor(rawText.length / 2) - 600, Math.floor(rawText.length / 2) + 600)}\n…\n${rawText.slice(-1200)}`;
  const response = await fetchImpl(DEEPSEEK_ENDPOINT, { method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ model, stream: false, thinking: { type: "disabled" }, max_tokens: 250,
      response_format: { type: "json_object" }, messages: [
        { role: "system", content: '判断材料中实际使用的自然语言。只返回 JSON：{"primary":"ISO 639-1 或 BCP 47 语言代码","languages":["代码"],"confidence":"high 或 low"}。混合语言可列多个，primary 为主要学习语言。短句或歧义严重时 primary 为 und。不要把人名或引用的少量词判为主要语言。' },
        { role: "user", content: sample },
      ] }),
  });
  if (!response.ok) throw new Error(`DeepSeek 语言检测返回 HTTP ${response.status}。`);
  const result = await response.json() as { choices?: { message?: { content?: string | null } }[] };
  let parsed: { primary?: unknown; languages?: unknown; confidence?: unknown };
  try { parsed = JSON.parse(result.choices?.[0]?.message?.content || "") as typeof parsed; }
  catch { throw new Error("语言检测结果无法解析，请手动选择学习语言。"); }
  const primary = languageCode(parsed.primary);
  const languages = Array.isArray(parsed.languages)
    ? [...new Set(parsed.languages.map(value => languageCode(value)).filter(code => code !== "und"))].slice(0, 5) : [];
  if (primary !== "und") {
    const index = languages.indexOf(primary);
    if (index >= 0) languages.splice(index, 1);
    languages.unshift(primary);
  }
  return { primary, languages, confidence: parsed.confidence === "high" ? "high" : "low" };
}

export async function analyzeWithDeepSeek(input: DeepSeekRequest, apiKey: string, model = DEFAULT_MODEL, fetchImpl: typeof fetch = fetch) {
  const chunks = splitMaterial(input.rawText);
  const parts: MaterialAnalysis[] = [];
  async function analyzeChunk(rawText: string, title: string, depth = 0): Promise<MaterialAnalysis[]> {
    try {
      return [await requestDeepSeek({ ...input, rawText, title }, apiKey, model, fetchImpl)];
    } catch (error) {
      if (!(error instanceof OutputTruncatedError)) throw error;
      if (rawText.length <= 200 || depth >= 5)
        throw new Error("模型在自动细分材料后仍截断输出。请检查自定义提示词是否要求过多内容，或稍后重试。");
      const smaller = splitMaterial(rawText, Math.max(200, Math.ceil(rawText.length / 2)));
      if (smaller.length < 2)
        throw new Error("模型在自动细分材料后仍截断输出。请检查自定义提示词是否要求过多内容，或稍后重试。");
      const recovered: MaterialAnalysis[] = [];
      for (const [index, piece] of smaller.entries())
        recovered.push(...await analyzeChunk(piece, `${title}（细分 ${index + 1}/${smaller.length}）`, depth + 1));
      return recovered;
    }
  }
  for (const [index, rawText] of chunks.entries()) {
    const title = chunks.length === 1 ? input.title : `${input.title}（第 ${index + 1}/${chunks.length} 段）`;
    parts.push(...await analyzeChunk(rawText, title));
  }
  return mergeMaterialAnalyses(parts);
}

export async function requestFurigana(expression: string, apiKey: string, model = DEFAULT_MODEL, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(DEEPSEEK_ENDPOINT, { method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ model, stream: false, thinking: { type: "disabled" }, max_tokens: 900,
      response_format: { type: "json_object" }, messages: [
        { role: "system", content: "为日语表达中的汉字标注平假名读音。只返回 JSON 对象：{\"reading\":\"整个表达的平假名读音\",\"furigana\":[{\"text\":\"原文片段\",\"reading\":\"汉字片段的平假名读音\"}]}。按原文顺序拆分；所有 text 连起来必须与输入完全相同。只有含汉字的片段需要 reading，假名和标点片段不要加 reading。不要改写原文；不确定的读音留空。" },
        { role: "user", content: expression },
      ] }),
  });
  if (!response.ok) throw new Error(`DeepSeek 返回 HTTP ${response.status}。`);
  const result = await response.json() as { choices?: { message?: { content?: string | null } }[] };
  let parsed: { reading?: unknown; furigana?: unknown };
  try { parsed = JSON.parse(result.choices?.[0]?.message?.content || "") as typeof parsed; }
  catch { throw new Error("注音结果无法解析，请重试。"); }
  const furigana = normalizeFurigana(parsed.furigana, expression);
  if (!furigana.length) throw new Error("注音未能与原表达对齐，请重试或手动填写读音。");
  return { reading: typeof parsed.reading === "string" ? parsed.reading.trim().slice(0, 160) : "", furigana };
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit = 100_000) {
  let text = "";
  for await (const chunk of req) {
    text += chunk.toString();
    if (text.length > limit) throw new Error("材料或提示词过长。");
  }
  try { return JSON.parse(text) as Record<string, unknown>; }
  catch { throw new Error("请求格式不正确。"); }
}

export function createDeepSeekMiddleware(env: { apiKey?: string; model?: string; configFile?: string } = {}) {
  const saved = readApiConfig(env.configFile);
  let runtimeKey = saved.apiKey || "";
  let model = saved.model || env.model?.trim() || DEFAULT_MODEL;
  return (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    const route = new URL(req.url || "/", "http://local").pathname;
    if (route !== "/config" && route !== "/analyze" && route !== "/furigana") return next();
    const origin = req.headers.origin;
    if (origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) {
      send(res, 403, { error: "跨站请求已拒绝。" }); return;
    }
    void (async () => {
      if (route === "/config" && req.method === "GET") {
        send(res, 200, { configured: !!(runtimeKey || env.apiKey), model, endpoint: DEEPSEEK_ENDPOINT,
          keySource: runtimeKey ? (env.configFile ? "local" : "session") : env.apiKey ? "env" : "none" }); return;
      }
      if (route === "/config" && req.method === "POST") {
        const body = await readBody(req, 10_000);
        const nextModel = typeof body.model === "string" && body.model.trim() ? body.model.trim().slice(0, 100) : model;
        const nextKey = typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : runtimeKey;
        if (env.configFile) writeApiConfig(env.configFile, { model: nextModel, apiKey: nextKey });
        model = nextModel;
        runtimeKey = nextKey;
        send(res, 200, { configured: !!(runtimeKey || env.apiKey), model, endpoint: DEEPSEEK_ENDPOINT,
          keySource: runtimeKey ? (env.configFile ? "local" : "session") : env.apiKey ? "env" : "none" }); return;
      }
      if (route === "/analyze" && req.method === "POST") {
        const key = runtimeKey || env.apiKey;
        if (!key) { send(res, 503, { error: "请先在 AI 配置中填写 DeepSeek API Key。" }); return; }
        const body = await readBody(req);
        const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
        const prompt = typeof body.prompt === "string" ? body.prompt : "";
        if (!rawText || rawText.length > 12_000 || prompt.length > 20_000)
          throw new Error("材料须为 1–12000 字符，提示词最多 20000 字符。");
        const requestedLanguage = languageCode(body.targetLanguage);
        const detection = await requestLanguageDetection(rawText, key, model);
        const learningLanguage = requestedLanguage === "und" ? detection.primary : requestedLanguage;
        if (learningLanguage === "und") throw new Error("无法可靠识别材料语言。请在 Inbox 手动选择本次学习语言后重试。");
        const analysis = await analyzeWithDeepSeek({ rawText, prompt,
          targetLanguage: learningLanguage,
          explanationLanguage: languageCode(body.explanationLanguage, "zh"),
          title: typeof body.title === "string" ? body.title : "",
          sourceType: typeof body.sourceType === "string" ? body.sourceType : "",
          taxonomy: body.taxonomy && typeof body.taxonomy === "object" ? body.taxonomy as DeepSeekRequest["taxonomy"] : {} }, key, model);
        send(res, 200, { analysis, detection, learningLanguage }); return;
      }
      if (route === "/furigana" && req.method === "POST") {
        const key = runtimeKey || env.apiKey;
        if (!key) { send(res, 503, { error: "请先在 AI 配置中填写 DeepSeek API Key，或手动输入读音。" }); return; }
        const body = await readBody(req, 3_000);
        const expression = typeof body.expression === "string" ? body.expression.trim() : "";
        if (!expression || expression.length > 120) throw new Error("表达须为 1–120 字符。");
        send(res, 200, await requestFurigana(expression, key, model)); return;
      }
      send(res, 405, { error: "不支持的请求方法。" });
    })().catch(error => send(res, 400, { error: error instanceof Error ? error.message : "请求失败。" }));
  };
}
