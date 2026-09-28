import { materialAnalysisPrompt } from "../prompts/materialAnalysis.ts";

const KEY = "language-web.material-analysis-prompt.v5";
const LEGACY_KEYS = ["language-web.material-analysis-prompt.v4", "language-web.material-analysis-prompt.v3", "language-web.material-analysis-prompt.v2", "language-web.material-analysis-prompt.v1"];
export function getMaterialPrompt() {
  try {
    const current = localStorage.getItem(KEY);
    if (current) return current;
    const legacy = LEGACY_KEYS.map(key => localStorage.getItem(key)).find(Boolean);
    // Replace saved default prompts from earlier versions; preserve independently written prompts.
    if (legacy?.startsWith("你是一名日语真实语料编辑器。") &&
      legacy.endsWith("groups 的 expressionIndexes 是 expressions 数组的零基位置。") &&
      (legacy.includes("质量优先，通常选 3–12 个") || legacy.includes("不设固定提取名额")))
      return materialAnalysisPrompt;
    return legacy || materialAnalysisPrompt;
  }
  catch { return materialAnalysisPrompt; }
}
export function saveMaterialPrompt(prompt: string) {
  try { localStorage.setItem(KEY, prompt); return true; }
  catch { return false; }
}
export function resetMaterialPrompt() {
  try { localStorage.removeItem(KEY); LEGACY_KEYS.forEach(key => localStorage.removeItem(key)); } catch { /* Keep the in-memory default. */ }
  return materialAnalysisPrompt;
}
