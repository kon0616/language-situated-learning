import { useState } from "react";
import { ArrowRight, Sparkles, Trash2, FileText } from "lucide-react";
import { sampleTranscript } from "../data/seed";
import { analyzeMaterial } from "../services/materialAnalysis";
import { getMaterialPrompt } from "../services/promptSettings";
import type { AppData, LanguageNode, Source } from "../types/language";
import type { MaterialAnalysisResult } from "../types/materialAnalysis";
import { commonLanguages, guessLanguage, languageCode, languageName } from "../services/languages.ts";
export default function InboxPage({
  data,
  activeLanguage,
  onSave,
}: {
  data: AppData;
  activeLanguage: string;
  onSave: (nodes: LanguageNode[], source: Source) => void;
}) {
  const [raw, setRaw] = useState(""),
    [title, setTitle] = useState(""),
    [type, setType] = useState<Source["type"]>("voice room"),
    [date, setDate] = useState(new Date().toLocaleDateString("en-CA")),
    [results, setResults] = useState<LanguageNode[]>([]),
    [chosen, setChosen] = useState<Set<string>>(new Set()),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [extractedRaw, setExtractedRaw] = useState(""),
    [analysis, setAnalysis] = useState<MaterialAnalysisResult | null>(null);
  const [targetLanguage, setTargetLanguage] = useState("und");
  const [otherLanguage, setOtherLanguage] = useState("");
  const [explanationLanguage, setExplanationLanguage] = useState("zh");
  const guessed = guessLanguage(raw);
  const requestedLanguage = targetLanguage === "other" ? languageCode(otherLanguage) : targetLanguage;
  async function extract() {
    setBusy(true);
    setMessage("");
    try {
      if (targetLanguage === "other" && requestedLanguage === "und") throw new Error("请输入有效的语言代码，例如 es、de 或 pt-BR。");
      const result = await analyzeMaterial(raw, title, type, data, getMaterialPrompt(), requestedLanguage, explanationLanguage);
      setAnalysis(result);
      setResults(result.nodes);
      setChosen(new Set(result.nodes.map((n) => n.id)));
      setExtractedRaw(raw);
      if (!result.nodes.length)
        setMessage(
          result.mode === "mock" ? "本地 Mock 尚未匹配到表达。可在 AI 配置填写 DeepSeek API Key，以分析其他材料。" : "这份材料没有提取到合适表达。原文仍可保留，或调整提示词后重试。",
        );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提取失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  function edit(
    id: string,
    key:
      | "expression"
      | "reading"
      | "collocations"
      | "suggestedContexts"
      | "suggestedDomains"
      | "suggestedFunctions",
    value: string,
  ) {
    setResults((r) =>
      r.map((n) =>
        n.id === id
          ? key === "expression" ? { ...n, expression: value, reading: "", furigana: [], readingManual: false }
            : key === "reading" ? { ...n, reading: value, furigana: [], readingManual: !!value.trim() }
            : {
              ...n,
              [key]: value
                      .split(/[、,，\n]/)
                      .map((s) => s.trim())
                      .filter(Boolean),
            }
          : n,
      ),
    );
  }
  const valid = results.filter(
    (n) =>
      chosen.has(n.id) &&
      n.expression.trim() &&
      (n.suggestedContexts?.length || n.contextIds.length),
  );
  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">COLLECT FROM REAL LIFE</div>
          <h1>
            输入收件箱 <span>Inbox</span>
          </h1>
          <p>留下今天的真实语言，让它成为下次对话的起点。</p>
        </div>
        <span className="pill">{analysis?.mode === "deepseek" ? "DeepSeek 分析" : analysis?.mode === "mock" ? "本地 Mock 提取" : "材料分析"}</span>
      </div>
      <div className="inbox-grid">
        <section className="paper">
          <div className="section-title">
            <h2>
              <FileText size={20} /> 今天遇到了什么？
            </h2>
            <button
              className="text-button"
              onClick={() => {
                setRaw(sampleTranscript);
                setTargetLanguage("und");
                setTitle("日语语音房 · 关于讨论");
                setResults([]);
                setAnalysis(null);
                setMessage("");
              }}
            >
              使用日语示例
            </button>
          </div>
          <label className="field">
            <span>原始材料</span>
            <textarea
              className="raw-input"
              placeholder="粘贴聊天、转写、字幕或文章中的真实语言……"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setResults([]);
                setAnalysis(null);
                setMessage("");
              }}
            />
          </label>
          <div className="input-footer">
            <span>{raw.length} 字符</span>
            <span>转写 · 字幕 · 聊天 · 文章</span>
          </div>
          <div className="language-detection-panel">
            <span>初步识别：{guessed.code === "und" ? "待模型识别" : languageName(guessed.code)}{guessed.confidence === "low" && " · 需核对"}</span>
            <span>当前空间：{languageName(activeLanguage)}</span>
          </div>
          <div className="metadata language-inputs">
            <label className="field"><span>本次学习语言</span><select aria-label="本次学习语言" value={targetLanguage} onChange={e => { setTargetLanguage(e.target.value); setResults([]); setAnalysis(null); }}>
              <option value="und">自动识别</option>
              {commonLanguages.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              <option value="other">其他语言代码…</option>
            </select></label>
            {targetLanguage === "other" && <label className="field"><span>语言代码</span><input aria-label="语言代码" value={otherLanguage} onChange={e => { setOtherLanguage(e.target.value); setResults([]); setAnalysis(null); }} placeholder="例如 nl、id、pt-BR"/></label>}
            <label className="field"><span>释义语言</span><select aria-label="释义语言" value={explanationLanguage} onChange={e => { setExplanationLanguage(e.target.value); setResults([]); setAnalysis(null); }}>
              <option value="zh">中文</option><option value="en">English</option><option value="ja">日本語</option>
            </select></label>
          </div>
          <div className="metadata">
            <label className="field">
              <span>来源标题</span>
              <input
                placeholder="例如：周五的语音讨论"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="field">
              <span>来源类型</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as Source["type"])}
              >
                {[
                  "voice room",
                  "YouTube",
                  "conversation",
                  "article",
                  "drama",
                  "other",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>日期</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <button
            className="primary"
            disabled={!raw.trim() || busy}
            onClick={extract}
          >
            <Sparkles size={17} />
            {busy ? "正在分析材料…" : "分析材料并提取语言"}
            <ArrowRight size={17} />
          </button>
          <p className="small muted">
            未配置 API 时使用本地示例匹配；配置 DeepSeek 后，会逐段分析这份材料并发送给 DeepSeek。长材料可能产生多次 API 请求。
          </p>
        </section>
        <aside className="inbox-note">
          <span className="eyebrow">不是收集更多词汇</span>
          <h2>
            留住一个
            <br />
            你会想说的瞬间。
          </h2>
          <div className="note-step">
            <span>01</span>
            <p>
              真实输入<small>不用整理，保留原来的语境。</small>
            </p>
          </div>
          <div className="note-step">
            <span>02</span>
            <p>
              值得留下的表达<small>选择、微调，再连接到情景。</small>
            </p>
          </div>
          <div className="note-step">
            <span>03</span>
            <p>
              下一次，主动说出来<small>让理解慢慢变成自己的语言。</small>
            </p>
          </div>
        </aside>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {analysis && <section className="paper material-analysis-preview"><span className="eyebrow">MATERIAL OVERVIEW</span><h2>材料概览 · 学习 {languageName(analysis.detectedLanguage)}</h2><p>{analysis.summary}</p><p className="small muted">材料语言：{analysis.detectedLanguages.map(languageName).join(" / ") || languageName(analysis.materialLanguage)} · 本次学习：{languageName(analysis.detectedLanguage)}。请核对；需要调整时请在上方修改后重新分析。</p>{analysis.groups.length > 0 && <div className="analysis-groups">{analysis.groups.map((group, i) => <article key={`${group.label}-${i}`}><strong>{group.label || "一个片段"}</strong>{group.excerpt && <p lang={analysis.materialLanguage}>{group.excerpt}</p>}<span className="small muted">{group.expressionIndexes.map(index => analysis.nodes[index]?.expression).filter(Boolean).join(" · ")}</span></article>)}</div>}</section>}
      {results.length > 0 && (
        <section className="extraction-section">
          <div className="section-title">
            <div>
              <h2>
                提取到的表达与搭配 <span className="pill">{results.length}</span>
              </h2>
              <p className="muted small">
                包括地道说法、有趣搭配与常见搭配；逐条选择并修改归类，多项用逗号分隔。
              </p>
            </div>
            <button
              className="primary"
              disabled={!valid.length || !date}
              onClick={() =>
                onSave(valid, {
                  id: crypto.randomUUID(),
                  title: title.trim() || "未命名输入",
                  type,
                  date,
                  rawText: extractedRaw,
                  language: analysis?.detectedLanguage || "ja",
                  languages: analysis?.detectedLanguages || ["ja"],
                })
              }
            >
              保存材料与表达 · {valid.length}
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="extraction-grid">
            {results.map((n) => (
              <article className="paper extraction-card" key={n.id}>
                <div className="section-title">
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={chosen.has(n.id)}
                      onChange={(e) =>
                        setChosen((prev) => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(n.id) : next.delete(n.id);
                          return next;
                        })
                      }
                    />
                    保留表达
                  </label>
                  <button
                    className="icon-button"
                    aria-label={`删除 ${n.expression}`}
                    onClick={() =>
                      setResults((r) => r.filter((x) => x.id !== n.id))
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <label className="field">
                  <span>表达</span>
                  <input
                    value={n.expression}
                    onChange={(e) => edit(n.id, "expression", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>读音{n.language === "ja" ? " · 平假名" : " · 可选"}</span>
                  <input value={n.reading || ""} placeholder="需要时可手动补充" onChange={(e) => edit(n.id, "reading", e.target.value)}/>
                </label>
                <label className="field">
                  <span>Context · 场景</span>
                  <input
                    defaultValue={(n.suggestedContexts || []).join("，")}
                    onBlur={(e) =>
                      edit(n.id, "suggestedContexts", e.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span>Domain · 领域</span>
                  <input
                    defaultValue={(n.suggestedDomains || []).join("，")}
                    onBlur={(e) =>
                      edit(n.id, "suggestedDomains", e.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span>Function · 交流功能</span>
                  <input
                    defaultValue={(n.suggestedFunctions || []).join("，")}
                    onBlur={(e) =>
                      edit(n.id, "suggestedFunctions", e.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span>搭配</span>
                  <textarea
                    defaultValue={n.collocations.join("，")}
                    onBlur={(e) => edit(n.id, "collocations", e.target.value)}
                  />
                </label>
                {(!n.expression.trim() ||
                  !(n.suggestedContexts?.length || n.contextIds.length)) && (
                  <p className="error small">表达与 Context 不能为空。</p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
