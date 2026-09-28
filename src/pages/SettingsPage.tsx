import { useEffect, useState } from "react";
import { KeyRound, RotateCcw, Save } from "lucide-react";
import { DEFAULT_MODEL, DEEPSEEK_ENDPOINT } from "../config/deepseek.ts";
import { getMaterialPrompt, resetMaterialPrompt, saveMaterialPrompt } from "../services/promptSettings.ts";
import type { useBatchFurigana } from "../services/useBatchFurigana.ts";

interface ApiStatus { configured: boolean; model: string; endpoint: string; keySource: "local" | "session" | "env" | "none" }

export default function SettingsPage({ batchFurigana }: { batchFurigana: ReturnType<typeof useBatchFurigana> }) {
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState(getMaterialPrompt);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/config").then(r => r.ok ? r.json() : Promise.reject()).then((s: ApiStatus) => {
      setStatus(s); setModel(s.model);
    }).catch(() => setMessage("无法连接本地 API 服务。请重新运行 npm run dev。"));
  }, []);
  async function save() {
    setBusy(true); setMessage("");
    try {
      if (!saveMaterialPrompt(prompt.trim())) throw new Error("提示词未能保存到此浏览器。");
      const response = await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: model.trim(), apiKey: apiKey.trim() }) });
      const body = await response.json() as ApiStatus & { error?: string };
      if (!response.ok) throw new Error(body.error || "API 配置失败。");
      setStatus(body); setApiKey("");
      setMessage(body.configured ? "已保存。下一次在 Inbox 提取材料时将使用 DeepSeek。" : "提示词已保存；填写 API Key 后即可启用 DeepSeek。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败。"); }
    finally { setBusy(false); }
  }
  return <div className="content-page ai-settings-page">
    <div className="page-heading"><div><div className="eyebrow">MATERIAL ANALYSIS</div><h1>AI 配置 <span>DeepSeek</span></h1><p>配置材料分析入口和归类规则，提取前仍可逐条检查。</p></div></div>
    <section className="paper api-settings-card">
      <div className="section-title"><h2><KeyRound size={19}/> API 入口</h2><span className="pill">{status?.configured ? "已填写密钥" : "本地 Mock"}</span></div>
      <p className="small muted">保存后，密钥和模型会保存在本机项目的私有配置文件中，刷新页面或重启服务后仍有效。密钥不会回显，也不写入浏览器存储。</p>
      <label className="field"><span>接口地址</span><input value={status?.endpoint || DEEPSEEK_ENDPOINT} readOnly/></label>
      <div className="metadata"><label className="field"><span>模型</span><input value={model} onChange={e => setModel(e.target.value)} placeholder={DEFAULT_MODEL}/></label>
        <label className="field"><span>DeepSeek API Key</span><input type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={status?.configured ? "已配置；留空则保持原值" : "输入你的 API Key"}/></label></div>
      <p className="small muted">当前状态只表示密钥已提供；首次分析材料时才会验证密钥是否有效。<a href="https://api-docs.deepseek.com/guides/json_mode/" target="_blank" rel="noreferrer">DeepSeek JSON Output 文档 ↗</a></p>
    </section>
    <section className="paper api-settings-card"><div className="section-title"><div><span className="eyebrow">PROMPT</span><h2>材料分析与归类提示词</h2></div><button className="text-button" onClick={() => { setPrompt(resetMaterialPrompt()); setMessage("已恢复默认提示词；点击保存配置后生效。"); }}><RotateCcw size={15}/> 恢复默认</button></div>
      <p className="small muted">通用提示词负责地道说法、搭配与三种归类；分析时会追加当前语言的补充规则。这里的修改只保存在此浏览器。若以前写过日语专用提示词，请检查或恢复默认。</p>
      <textarea className="prompt-editor" aria-label="材料分析提示词" value={prompt} onChange={e => setPrompt(e.target.value)} spellCheck={false}/>
    </section>
    <div className="settings-actions"><button className="primary" disabled={busy || !model.trim() || !prompt.trim()} onClick={save}><Save size={16}/>{busy ? "保存中…" : "保存配置"}</button>{message && <p role="status" className="small muted">{message}</p>}</div>
    <section className="paper api-settings-card">
      <h2>现有资料 · 批量补全注音</h2>
      <p className="small muted">还有 {batchFurigana.remaining} 个表达缺少或尚未补齐汉字注音。会跳过完整注音及已标记的手动读音，保留已有读音文字；成功结果逐条保存。此操作会调用 DeepSeek。</p>
      {batchFurigana.remaining > 0 && <details className="pending-furigana"><summary>查看待补全表达（{batchFurigana.remaining}）</summary><ul>{batchFurigana.pending.map(item => <li key={item.id} lang="ja">{item.expression}</li>)}</ul></details>}
      <button className="primary" disabled={!status?.configured || batchFurigana.busy || !batchFurigana.remaining} onClick={batchFurigana.start}>{batchFurigana.busy ? "正在补全注音…" : "一键补全现有表达注音"}</button>
      {batchFurigana.busy && <button className="text-button" onClick={batchFurigana.stop}>停止处理</button>}
      {!status?.configured && <p className="small muted">先填写 API Key 并点击「保存配置」，即可批量处理。</p>}
      {batchFurigana.message && <p role="status" className="small muted">{batchFurigana.message}</p>}
    </section>
  </div>;
}
