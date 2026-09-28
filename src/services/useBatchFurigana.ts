import { useEffect, useRef, useState } from "react";
import type { FuriganaPart, LanguageNode } from "../types/language.ts";
import { hasCompleteFurigana, needsFurigana, normalizeFurigana } from "./furigana.ts";
import { apiFetch } from "./apiClient.ts";

export function useBatchFurigana(nodes: LanguageNode[], save: (id: string, reading: string, parts: FuriganaPart[]) => void) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const stop = useRef(false);
  const running = useRef(false);
  useEffect(() => () => { stop.current = true; }, []);
  const pending = nodes.filter(needsFurigana);
  async function start() {
    if (running.current || !pending.length) return;
    running.current = true; stop.current = false; setBusy(true);
    let completed = 0;
    const failed: string[] = [];
    let errorMessage = "";
    try {
      for (const [index, node] of pending.entries()) {
        if (stop.current) break;
        setMessage(`正在处理 ${index + 1} / ${pending.length}：${node.expression}`);
        try {
          const response = await apiFetch("/api/furigana", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expression: node.expression }) });
          const result = await response.json() as { reading?: string; furigana?: FuriganaPart[]; error?: string };
          const parts = normalizeFurigana(result.furigana, node.expression);
          if (!response.ok || !hasCompleteFurigana(parts, node.expression)) {
            if (response.status === 503 || response.status === 401 || response.status === 429 || /HTTP (401|402|403|429)/.test(result.error || "")) stop.current = true;
            throw new Error(result.error || "注音结果不完整或无法对齐，保留待补全。");
          }
          save(node.id, node.reading || result.reading || "", parts);
          completed++;
        } catch (error) {
          failed.push(node.expression);
          errorMessage = error instanceof Error ? error.message : "请求失败";
        }
      }
      setMessage(`${stop.current ? "已停止" : "处理完成"}：已补全 ${completed} 条。${failed.length ? `失败 ${failed.length} 条（${failed.slice(0, 3).join("、")}）。${errorMessage} 可再次点击继续。` : ""}`);
    } finally { running.current = false; setBusy(false); }
  }
  return { busy, message, pending: pending.map(n => ({ id: n.id, expression: n.expression })), remaining: pending.length, start,
    stop: () => { stop.current = true; setMessage("将在当前表达完成后停止，已生成的注音会保留。"); } };
}
