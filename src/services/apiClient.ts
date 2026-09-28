import { DEEPSEEK_ENDPOINT, DEFAULT_MODEL } from "../config/deepseek.ts";

export interface ApiStatus {
  configured: boolean;
  model: string;
  endpoint: string;
  keySource: "local" | "session" | "env" | "browser" | "none";
}

const KEY = "language-web.deepseek-key.v1";
const MODEL = "language-web.deepseek-model.v1";

export function isHostedApi() {
  return !!import.meta.env?.PROD && typeof window !== "undefined" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname);
}

export function hostedApiStatus(): ApiStatus {
  const key = localStorage.getItem(KEY) || "";
  return { configured: !!key, model: localStorage.getItem(MODEL) || DEFAULT_MODEL,
    endpoint: DEEPSEEK_ENDPOINT, keySource: key ? "browser" : "none" };
}

export function saveHostedApiConfig(apiKey: string, model: string): ApiStatus {
  const nextModel = model.trim().slice(0, 100) || DEFAULT_MODEL;
  localStorage.setItem(MODEL, nextModel);
  if (apiKey.trim()) localStorage.setItem(KEY, apiKey.trim());
  return hostedApiStatus();
}

export function clearHostedApiKey(): ApiStatus {
  localStorage.removeItem(KEY);
  return hostedApiStatus();
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!isHostedApi()) return fetch(path, init);
  const key = localStorage.getItem(KEY) || "";
  if (!key) return Response.json({ error: "请先在 AI 配置中填写 DeepSeek API Key。" }, { status: 401 });
  const headers = new Headers(init?.headers);
  headers.set("X-DeepSeek-Key", key);
  headers.set("X-DeepSeek-Model", localStorage.getItem(MODEL) || DEFAULT_MODEL);
  return fetch(path, { ...init, headers });
}
