import { useRef, useState } from "react";
import { analyzeMaterial } from "./materialAnalysis.ts";
import { getMaterialPrompt } from "./promptSettings.ts";
import { languageCode } from "./languages.ts";
import type { AppData, LanguageNode, Source } from "../types/language.ts";
import type { MaterialAnalysisResult } from "../types/materialAnalysis.ts";

export function useInboxDraft() {
  const [raw, setRaw] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<Source["type"]>("voice room");
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [results, setResults] = useState<LanguageNode[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [extractedRaw, setExtractedRaw] = useState("");
  const [analysis, setAnalysis] = useState<MaterialAnalysisResult | null>(null);
  const [targetLanguage, setTargetLanguage] = useState("und");
  const [otherLanguage, setOtherLanguage] = useState("");
  const [explanationLanguage, setExplanationLanguage] = useState("zh");
  const running = useRef(false);

  function clearAnalysis() {
    setResults([]);
    setChosen(new Set());
    setAnalysis(null);
    setExtractedRaw("");
    setMessage("");
  }

  async function extract(data: AppData) {
    if (running.current || !raw.trim()) return;
    running.current = true;
    setBusy(true);
    clearAnalysis();
    try {
      const requestedLanguage = targetLanguage === "other" ? languageCode(otherLanguage) : targetLanguage;
      if (targetLanguage === "other" && requestedLanguage === "und")
        throw new Error("请输入有效的语言代码，例如 es、de 或 pt-BR。");
      const result = await analyzeMaterial(raw, title, type, data, getMaterialPrompt(), requestedLanguage, explanationLanguage);
      setAnalysis(result);
      setResults(result.nodes);
      setChosen(new Set(result.nodes.map(n => n.id)));
      setExtractedRaw(raw);
      if (!result.nodes.length)
        setMessage(result.mode === "mock"
          ? "本地 Mock 尚未匹配到表达。可在 AI 配置填写 DeepSeek API Key，以分析其他材料。"
          : "这份材料没有提取到合适表达。原文仍可保留，或调整提示词后重试。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提取失败，请重试。");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function reset() {
    setRaw(""); setTitle(""); setType("voice room");
    setDate(new Date().toLocaleDateString("en-CA"));
    setTargetLanguage("und"); setOtherLanguage(""); setExplanationLanguage("zh");
    clearAnalysis();
  }

  return { raw, setRaw, title, setTitle, type, setType, date, setDate,
    results, setResults, chosen, setChosen, busy, message, setMessage,
    extractedRaw, analysis, targetLanguage, setTargetLanguage,
    otherLanguage, setOtherLanguage, explanationLanguage, setExplanationLanguage,
    clearAnalysis, extract, reset };
}

export type InboxDraft = ReturnType<typeof useInboxDraft>;
