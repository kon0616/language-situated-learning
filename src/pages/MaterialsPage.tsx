import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, FileText, Search, Trash2 } from "lucide-react";
import type { AppData, FuriganaPart, Status } from "../types/language.ts";
import NodeDetail from "../components/node-detail/NodeDetail.tsx";
import { AnnotatedJapanese, FuriganaText } from "../components/FuriganaText.tsx";
import { languageName } from "../services/languages.ts";

export default function MaterialsPage({ data, selectedId, expressionId, onSelect, onDelete, onOpenExpression, onCloseExpression, onStatus, onReading, onContext, onDomain, onExplore }: {
  data: AppData;
  selectedId: string | null;
  expressionId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onOpenExpression: (id: string) => void;
  onCloseExpression: () => void;
  onStatus: (id: string, status: Status) => void;
  onReading: (id: string, reading: string, furigana: FuriganaPart[]) => void;
  onContext: (id: string) => void;
  onDomain: (id: string) => void;
  onExplore: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(12);
  const [showFull, setShowFull] = useState(false);
  const [fragmentPage, setFragmentPage] = useState(1);
  const [deletePending, setDeletePending] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const selected = data.sources.find(s => s.id === selectedId);
  const expression = data.languageNodes.find(n => n.id === expressionId);
  const sources = [...data.sources]
    .filter(s => !query.trim() || `${s.title} ${s.type} ${s.rawText}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));
  const occurrences = selected
    ? data.occurrences.filter(o => o.sourceId === selected.id && data.languageNodes.some(n => n.id === o.nodeId))
    : [];
  const materialNodes = data.languageNodes.filter(n => occurrences.some(o => o.nodeId === n.id));
  const groups = new Map<string, typeof occurrences>();
  for (const occurrence of occurrences) {
    const excerpt = occurrence.excerpt.trim() || selected?.rawText.slice(0, 180) || "";
    groups.set(excerpt, [...(groups.get(excerpt) || []), occurrence]);
  }
  const snippets = [...groups];
  const pageCount = Math.max(1, Math.ceil(snippets.length / 15));
  const currentPage = Math.min(fragmentPage, pageCount);
  useEffect(() => { setFragmentPage(1); setShowFull(false); setDeletePending(false); }, [selectedId]);
  useEffect(() => {
    if (expressionId && window.matchMedia("(max-width: 850px)").matches)
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [expressionId]);

  return <div className="content-page materials-page">
    <div className="page-heading">
      <div><div className="eyebrow">MY MATERIALS</div><h1>材料库 <span>Materials</span></h1><p>回到语言最初出现的地方。材料保存在此浏览器；清除网站数据或换浏览器会失去这些记录。</p></div>
      <span className="pill">{data.sources.length} 份材料</span>
    </div>
    {selected || expression ? <>
      <button className="text-button materials-back" onClick={() => { onSelect(null); setShowFull(false); setFragmentPage(1); }}>
        <ArrowLeft size={16}/> 返回材料库
      </button>
      {selected && <div className="material-detail-head">
        <span className="eyebrow">学习 {languageName(selected.language || "ja")}{selected.languages?.length ? ` · 原文 ${selected.languages.map(languageName).join(" / ")}` : ""} · {selected.type} · {selected.date}</span>
        <div className="material-detail-title"><h2>{selected.title}</h2><button className="material-delete-button" onClick={() => setDeletePending(true)}><Trash2 size={15}/> 删除材料</button></div>
        <p>{new Set(occurrences.map(o => o.nodeId)).size} 个从这份材料收藏的表达</p>
        {deletePending && <div className="material-delete-confirm" role="group" aria-label="确认删除材料">
          <strong>删除「{selected.title}」？</strong>
          <p>将删除原文、相关片段和出现记录。只属于这份材料的表达也会删除；在其他材料中出现过的表达会保留。此操作无法在页面中撤销。</p>
          <div><button className="secondary" onClick={() => setDeletePending(false)}>取消</button><button className="material-delete-confirm-button" onClick={() => onDelete(selected.id)}>确认删除</button></div>
        </div>}
      </div>}
      <div className={`material-workspace ${expression ? "has-detail" : ""}`}>
        <div className="material-main">
          {selected ? <>
            <section className="material-section">
              <div className="section-title"><h3>原始材料</h3><span className="small muted">保留输入时的原文</span></div>
              <div className="material-original" lang={selected.languages?.[0] || selected.language || "ja"}><AnnotatedJapanese text={showFull ? selected.rawText : selected.rawText.slice(0, 200)} nodes={materialNodes}/>{!showFull && selected.rawText.length > 200 ? "…" : ""}</div>
              {selected.rawText.length > 200 && <button className="text-button" onClick={() => setShowFull(!showFull)}>{showFull ? "收起原文" : "展开完整原文"}</button>}
            </section>
            <section className="material-section">
              <div className="section-title"><div><span className="eyebrow">FRAGMENTS FROM THIS MATERIAL</span><h3>当时的片段</h3></div></div>
              {snippets.length ? snippets.slice((currentPage - 1) * 15, currentPage * 15).map(([excerpt, linked], i) =>
                <article className="material-fragment" key={`${excerpt}-${i}`}>
                  <p lang={selected.languages?.[0] || selected.language || "ja"}><AnnotatedJapanese text={excerpt} nodes={materialNodes}/></p>
                  <div>{linked.map(o => {
                    const node = data.languageNodes.find(n => n.id === o.nodeId);
                    return node && <button key={o.id} className={expressionId === node.id ? "active" : ""} onClick={() => onOpenExpression(node.id)}><FuriganaText text={node.expression} parts={node.furigana} reading={node.reading} language={node.language || "ja"}/><ArrowRight size={14}/></button>;
                  })}</div>
                </article>
              ) : <p className="small muted">这份材料尚未关联表达。</p>}
              {snippets.length > 0 && <nav className="fragment-pagination" aria-label="片段分页">
                <button className="text-button" disabled={currentPage === 1} onClick={() => setFragmentPage(currentPage - 1)}>上一页</button>
                <span className="small muted">第 {currentPage} / {pageCount} 页 · 共 {snippets.length} 条 · 每页 15 条</span>
                <button className="text-button" disabled={currentPage === pageCount} onClick={() => setFragmentPage(currentPage + 1)}>下一页</button>
              </nav>}
            </section>
          </> : <p className="lens-empty">这个表达没有关联的原始材料。可以从右侧查看它的语言信息。</p>}
        </div>
        <aside ref={panelRef} className="material-detail-panel" aria-label="表达详情">
          {expression ? <NodeDetail node={expression} data={data} nodes={data.languageNodes} sources={data.sources}
            onStatus={onStatus} onReading={onReading} onSelect={onOpenExpression} onClose={onCloseExpression}
            onContext={onContext} onDomain={onDomain} onExplore={() => onExplore(expression.id)}
            onSource={onSelect}/>
          : <div className="material-detail-placeholder"><span className="eyebrow">EXPRESSION IN CONTEXT</span><h3>从片段进入表达</h3><p>点击左侧收藏的表达，在这里查看意思、搭配，以及它还出现在哪些材料中。</p></div>}
        </aside>
      </div>
    </> : <>
      <label className="lens-search material-search"><Search size={17}/><input aria-label="搜索材料" placeholder="搜索材料标题或原文…" value={query} onChange={e => { setQuery(e.target.value); setVisible(12); }}/></label>
      <div className="material-grid">{sources.slice(0, visible).map(source => {
        const count = new Set(data.occurrences.filter(o => o.sourceId === source.id).map(o => o.nodeId)).size;
        return <button className="material-card" key={source.id} onClick={() => { onSelect(source.id); setShowFull(false); setFragmentPage(1); }}>
          <span className="material-card-icon"><FileText size={19}/></span>
          <span className="eyebrow">学习 {languageName(source.language || "ja")}{(source.languages?.length || 0) > 1 ? ` · 混合材料 ${source.languages?.map(languageName).join(" / ")}` : ""} · {source.type} · {source.date}</span>
          <strong>{source.title}</strong>
          <span className="material-preview" lang={source.languages?.[0] || source.language || "ja"}>{source.rawText.slice(0, 105)}{source.rawText.length > 105 ? "…" : ""}</span>
          <span className="material-card-foot">{count} 个表达 <ArrowRight size={16}/></span>
        </button>;
      })}</div>
      {sources.length > visible && <button className="text-button" onClick={() => setVisible(v => v + 12)}>继续查看材料 · 还有 {sources.length - visible} 份</button>}
      {!sources.length && <p className="lens-empty">没有找到材料。可以从 Inbox 保存一份真实输入。</p>}
    </>}
  </div>;
}
