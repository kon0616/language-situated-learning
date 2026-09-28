import { useState } from "react";
import { X, ArrowUpRight, Quote } from "lucide-react";
import type {
  AppData,
  LanguageNode,
  Source,
  Status,
  FuriganaPart,
} from "../../types/language";
import { FuriganaText } from "../FuriganaText.tsx";
import { languageName } from "../../services/languages.ts";
import { statusLabels, typeLabels } from "../../types/language";
import {
  contextNames,
  domainNames,
  functionNames,
  path,
} from "../../data/taxonomy";
import { localGraph } from "../../services/localGraph";
export default function NodeDetail({
  node,
  data,
  nodes,
  sources,
  onStatus,
  onSelect,
  onClose,
  onContext,
  onDomain,
  onExplore,
  onSource,
  onReading,
}: {
  node: LanguageNode;
  data: AppData;
  nodes: LanguageNode[];
  sources: Source[];
  onStatus: (id: string, s: Status) => void;
  onSelect: (id: string) => void;
  onClose?: () => void;
  onContext?: (id: string) => void;
  onDomain?: (id: string) => void;
  onExplore?: () => void;
  onSource?: (id: string) => void;
  onReading?: (id: string, reading: string, furigana: FuriganaPart[]) => void;
}) {
  const [readingBusy, setReadingBusy] = useState(false);
  const [readingMessage, setReadingMessage] = useState("");
  async function generateReading() {
    setReadingBusy(true); setReadingMessage("");
    try {
      const response = await fetch("/api/furigana", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expression: node.expression }) });
      const result = await response.json() as { reading?: string; furigana?: FuriganaPart[]; error?: string };
      if (!response.ok || !result.furigana) throw new Error(result.error || "注音失败。");
      onReading?.(node.id, result.reading || "", result.furigana);
      setReadingMessage("已生成注音；如有多音字，请核对读音。");
    } catch (error) { setReadingMessage(error instanceof Error ? error.message : "注音失败。"); }
    finally { setReadingBusy(false); }
  }
  const source = sources.find((s) => s.id === node.sourceId);
  const appearances = data.occurrences.filter(o => o.nodeId === node.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const related = localGraph(data, node.id, 1).nodes.slice(1, 9);
  return (
    <article className="detail">
      <div className="flex items-center justify-between">
        <span className="eyebrow">EXPRESSION / 表达</span>
        {onClose && (
          <button
            className="icon-button"
            aria-label="关闭详情"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        )}
      </div>
      <h2 lang={node.language || "ja"}><FuriganaText text={node.expression} parts={node.furigana} reading={node.reading} language={node.language || "ja"}/></h2>
      <span className="small muted">{languageName(node.language || "ja")}</span>
      {onReading && <div className="detail-reading"><label className="field"><span>读音{(node.language || "ja") === "ja" ? " · 平假名" : ""}</span><input key={`${node.id}-${node.reading || ""}`} defaultValue={node.reading || ""} placeholder="可手动填写或修改" onBlur={event => {
        const next = event.target.value.trim();
        if (next !== (node.reading || "")) onReading(node.id, next, []);
      }}/></label>{(node.language || "ja") === "ja" && <button className="text-button" disabled={readingBusy} onClick={generateReading}>{readingBusy ? "注音中…" : "生成汉字注音"}</button>}{readingMessage && <p role="status" className="small muted">{readingMessage}</p>}</div>}
      <span className="pill">{typeLabels[node.type]}</span>
      <span className="muted small"> · {node.register.level}</span>
      <section>
        <h3>什么时候会想说？</h3>
        <p>{contextNames(data, node).join(" / ")}</p>
      </section>
      <section className="detail-lenses">
        <h3>CONTEXT</h3>
        {node.contextIds.map((id) => (
          <button
            className="detail-tag"
            key={id}
            onClick={() => onContext?.(id)}
          >
            {path(data.contexts, id)
              .map((x) => x.name)
              .join(" › ")}
          </button>
        ))}
        <h3>DOMAIN</h3>
        {node.domainIds.map((id) => (
          <button
            className="detail-tag"
            key={id}
            onClick={() => onDomain?.(id)}
          >
            {path(data.domains, id)
              .map((x) => x.name)
              .join(" › ")}
          </button>
        ))}
        <h3>FUNCTION</h3>
        {functionNames(data, node).map((name, i) => (
          <span className="chip scene-chip" key={`${name}-${i}`}>
            {name}
          </span>
        ))}
        {onExplore && (
          <button className="text-button detail-explore" onClick={onExplore}>
            Explore nearby expressions <ArrowUpRight size={15} />
          </button>
        )}
      </section>
      <section>
        <h3>意思</h3>
        <p>{node.meaning || node.coreImage || "尚未补充"}</p>
      </section>
      {node.coreImage && node.meaning && node.coreImage !== node.meaning && <section>
        <h3>核心意象</h3>
        <p>{node.coreImage}</p>
      </section>}
      <section>
        <h3>常见搭配</h3>
        <ul className="collocations">
          {node.collocations.map((c, i) => (
            <li lang={node.language || "ja"} key={i}>
              {c}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>在对话中使用</h3>
        {node.examples.map((e, i) => (
          <blockquote lang={node.language || "ja"} key={i}>
            {e}
          </blockquote>
        ))}
        <p className="small muted">{node.nuance}</p>
        <p className="small muted">
          语域：{node.register.level} · {node.register.notes}
        </p>
      </section>
      <section>
        <h3>
          附近的表达 <ArrowUpRight size={14} />
        </h3>
        {related.map((n) => (
          <button className="related" key={n.id} onClick={() => onSelect(n.id)}>
            {n.expression}
            <span>↗</span>
          </button>
        ))}
        {!related.length && (
          <p className="muted small">保存同情景的表达后，会在这里连接。</p>
        )}
      </section>
      <section>
        <h3>
          <Quote size={14} /> 来自真实输入
        </h3>
        <p className="source-quote" lang={source?.languages?.[0] || source?.language || node.language || "ja"}>
          {node.sourceContext || "尚无上下文"}
        </p>
        <span className="muted small">
          {source?.title || "未标注来源"}
          {source && ` · ${source.date} · ${source.type}`}
        </span>
        {!!appearances.length && <div className="detail-appearances"><span className="eyebrow">在 {new Set(appearances.map(o => o.sourceId)).size} 份材料中遇见</span>{appearances.slice(0, 5).map(o => {
          const material = sources.find(s => s.id === o.sourceId);
          return material && <button key={o.id} onClick={() => onSource?.(material.id)}><strong>{material.title}</strong><span lang={material.languages?.[0] || material.language || "ja"}>{o.excerpt.slice(0, 95)}</span></button>;
        })}</div>}
      </section>
      <section>
        <h3>我的使用状态</h3>
        <p className="small muted">目前：{statusLabels[node.status]} · 再次遇见 {node.encounterCount || 0} 次</p>
        <div className="status-buttons quiet-status">
          <button onClick={() => onStatus(node.id, "tried")}>我用过一次</button>
          <button onClick={() => onStatus(node.id, "spontaneous")}>现在能自然使用</button>
        </div>
        {node.lastReviewedAt && (
          <p className="small muted">
            最近唤醒：{new Date(node.lastReviewedAt).toLocaleDateString()}
          </p>
        )}
      </section>
    </article>
  );
}
