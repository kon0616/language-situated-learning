import { DEFAULT_MODEL } from "../config/deepseek.ts";
import { languageCode } from "../services/languages.ts";
import { requestDeepSeek, requestFurigana, requestLanguageDetection, type DeepSeekRequest } from "./deepseek.ts";

const routes = new Set(["/api/detect-language", "/api/analyze-chunk", "/api/furigana"]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function bodyOf(request: Request, limit = 100_000): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > limit) throw new Error("材料或提示词过长。");
  const text = await request.text();
  if (text.length > limit) throw new Error("材料或提示词过长。");
  try {
    const body: unknown = JSON.parse(text);
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch { /* The same validation error covers malformed JSON. */ }
  throw new Error("请求格式不正确。");
}

// Netlify Functions have a 60-second synchronous limit. Abort the provider
// request sooner so the client can retry a smaller material chunk.
const timedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(50_000) });

export async function handleHostedApi(request: Request, fetchImpl: typeof fetch = timedFetch): Promise<Response> {
  const url = new URL(request.url);
  if (!routes.has(url.pathname)) return json({ error: "接口不存在。" }, 404);
  if (request.method !== "POST") return json({ error: "仅支持 POST 请求。" }, 405);
  if (request.headers.get("origin") && request.headers.get("origin") !== url.origin)
    return json({ error: "跨站请求已拒绝。" }, 403);

  const key = request.headers.get("x-deepseek-key")?.trim() || "";
  if (!key || key.length > 256) return json({ error: "请先在 AI 配置中填写 DeepSeek API Key。" }, 401);
  const model = request.headers.get("x-deepseek-model")?.trim().slice(0, 100) || DEFAULT_MODEL;

  try {
    const body = await bodyOf(request, url.pathname === "/api/furigana" ? 3_000 : 100_000);
    if (url.pathname === "/api/furigana") {
      const expression = typeof body.expression === "string" ? body.expression.trim() : "";
      if (!expression || expression.length > 120) throw new Error("表达须为 1–120 字符。");
      return json(await requestFurigana(expression, key, model, fetchImpl));
    }
    const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
    if (!rawText || rawText.length > (url.pathname === "/api/detect-language" ? 12_000 : 2_000))
      throw new Error("材料片段长度不正确。");
    if (url.pathname === "/api/detect-language")
      return json(await requestLanguageDetection(rawText, key, model, fetchImpl));

    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    if (prompt.length > 20_000) throw new Error("提示词最多 20000 字符。");
    const taxonomy = body.taxonomy && typeof body.taxonomy === "object" ? body.taxonomy as DeepSeekRequest["taxonomy"] : {};
    const analysis = await requestDeepSeek({ rawText, prompt,
      targetLanguage: languageCode(body.targetLanguage, "ja"),
      explanationLanguage: languageCode(body.explanationLanguage, "zh"),
      title: typeof body.title === "string" ? body.title : "",
      sourceType: typeof body.sourceType === "string" ? body.sourceType : "",
      taxonomy }, key, model, fetchImpl);
    return json({ analysis });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
      return json({ error: "分析超时，将尝试缩小材料片段。" }, 504);
    return json({ error: error instanceof Error ? error.message : "请求失败。" }, 400);
  }
}

export const hostedApiRoutes = [...routes];
