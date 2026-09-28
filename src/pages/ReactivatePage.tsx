import { useEffect, useState } from "react";
import { ArrowRight, Shuffle } from "lucide-react";
import type { AppData, LanguageFragment } from "../types/language";
import { availableFragments, eligibleExpressions } from "../services/fragmentGenerator";
import LanguageFragmentView from "../components/LanguageFragmentView";
import NodeDetail from "../components/node-detail/NodeDetail";
import { contextNames } from "../data/taxonomy";
import type { FuriganaPart, Status } from "../types/language";

const emptyFragment: LanguageFragment = { id: "empty-review", type: "short_text", title: "暂无可回看的片段",
  content: [], expressionIds: [], source: "generated", createdAt: "" };

export default function ReactivatePage({ data, onExposure, onSource, onStatus, onReading, onContext, onDomain, onExplore }: {
  data: AppData; onExposure: (key: string, ids: string[]) => void;
  onSource: (id: string) => void; onStatus: (id: string, status: Status) => void;
  onReading: (id: string, reading: string, furigana: FuriganaPart[]) => void;
  onContext: (id: string) => void; onDomain: (id: string) => void; onExplore: (id: string) => void;
}) {
  const [changed, setChanged] = useState(0);
  const [sourceFilter, setSourceFilter] = useState("archive");
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = data.languageNodes.find(node => node.id === detailId);
  const eligible = eligibleExpressions(data.languageNodes);
  const allowed = new Set(eligible.map(node => node.id));
  const allFragments = availableFragments(data);
  const reviewable = (fragment: LanguageFragment) => fragment.content.some(line =>
    line.expressionIds?.some(id => allowed.has(id) && line.text.toLocaleLowerCase()
      .includes((data.languageNodes.find(node => node.id === id)?.expression || "\0").toLocaleLowerCase())));
  const originals = allFragments.filter(item => item.source === "original" && reviewable(item));
  const curated = allFragments.filter(item => item.source === "generated" && reviewable(item));
  const sourceChoices = data.sources.filter(source => originals.some(item => item.sourceId === source.id));
  const choices = sourceFilter === "curated" ? curated : sourceFilter === "archive"
    ? originals : originals.filter(item => item.sourceId === sourceFilter);
  const fragment: LanguageFragment = choices.length ? choices[changed % choices.length] : emptyFragment;
  const visibleIds = fragment.expressionIds.filter(id => eligible.some(n => n.id === id));
  const displayedFragment = { ...fragment, expressionIds: visibleIds,
    content: fragment.content.map(line => ({ ...line, expressionIds: line.expressionIds?.filter(id => visibleIds.includes(id)) })) };
  const met = visibleIds.map(id => data.languageNodes.find(n => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n).slice(0, 5);
  const [randomEchoId] = useState(() => {
    const sources = data.sources.filter(source => data.occurrences.some(o => o.sourceId === source.id));
    return sources[Math.floor(Math.random() * sources.length)]?.id;
  });
  const echoId = choices.length ? fragment.sourceId || randomEchoId : undefined;
  const echoes = data.sources.filter(source => source.id === echoId);
  useEffect(() => { onExposure(`fragment:${fragment.id}`, visibleIds); }, [fragment.id]);
  useEffect(() => {
    for (const source of echoes) {
      const ids = [...new Set(data.occurrences.filter(o => o.sourceId === source.id).map(o => o.nodeId))].slice(0, 5);
      onExposure(`echo:${source.id}`, ids);
    }
  }, [echoes.map(s => s.id).join("|")]);
  const change = () => {
    setChanged(index => index + 1);
    setDetailId(null);
  };
  return <div className="content-page reencounter-page"><div className={`reencounter-layout${detail ? " has-detail" : ""}`}><div className="reencounter-main">
    <div className="page-heading"><div><div className="eyebrow">RE-ENCOUNTER</div><h1>再次遇见 <span>Re-encounter</span></h1><p>在自然的片段里，和收藏过的语言轻轻重逢。</p></div></div>
    <section className="reencounter-section"><div className="section-title"><div><span className="eyebrow">TODAY'S FRAGMENT</span><h2>今天的语言片段</h2><p className="small muted">{fragment.title || "日常片段"}{fragment.source === "original" ? " · 来自原始材料" : " · 场景片段"} · 轻点高亮表达查看详情</p></div><button className="secondary" disabled={choices.length < 2} onClick={change}><Shuffle size={15}/> 换一个片段{choices.length > 1 ? ` · ${changed % choices.length + 1}/${choices.length}` : ""}</button></div>
      <label className="fragment-source-select">片段来源 <select aria-label="片段来源" value={sourceFilter} onChange={event => { setSourceFilter(event.target.value); setChanged(0); setDetailId(null); }}>
        <option value="archive">我的全部材料 · {originals.length} 段</option>
        {sourceChoices.map((source, index) => <option key={source.id} value={source.id}>{source.title}{sourceChoices.filter(item => item.title === source.title).length > 1 ? `（第 ${index + 1} 份）` : ""} · {originals.filter(item => item.sourceId === source.id).length} 段</option>)}
        {curated.length > 0 && <option value="curated">精选场景 · {curated.length} 段</option>}
      </select></label>
      {displayedFragment.content.length ? <LanguageFragmentView fragment={displayedFragment} nodes={data.languageNodes} language={data.sources.find(source => source.id === fragment.sourceId)?.languages?.[0]} onOpen={setDetailId}/> : <p className="lens-empty">这里还没有含已收藏表达的原文片段。可以从 Inbox 收藏表达，或切换到精选场景。</p>}
      {fragment.sourceId && <button className="text-button" onClick={() => onSource(fragment.sourceId!)}>查看原始材料 <ArrowRight size={15}/></button>}</section>
    {met.length > 0 && <section className="reencounter-section"><div className="section-title"><div><span className="eyebrow">EXPRESSIONS I MET AGAIN</span><h2>这次遇见的表达</h2></div></div><div className="reencounter-cards">{met.map(n => <button key={n.id} className={`reencounter-card${detailId === n.id ? " active" : ""}`} onClick={() => setDetailId(n.id)}><strong lang={n.language || "ja"}>{n.expression}</strong><span>{n.meaning || n.coreImage}</span><small>{contextNames(data, n)[0]} · {n.collocations[0]}</small><em lang={n.language || "ja"}>{n.examples[0]}</em><ArrowRight size={15}/></button>)}</div></section>}
    <section className="reencounter-section"><div className="section-title"><div><span className="eyebrow">ECHOES FROM MY ARCHIVE</span><h2>来自我的输入</h2></div></div>{echoes.length ? echoes.map(source => {
      const excerpt = source.rawText.split(/\n/)[0].slice(0, 160);
      return <article className="archive-echo" key={source.id}><button className="text-button" onClick={() => onSource(source.id)}>{source.title} · {source.date} ↗</button><p lang={source.languages?.[0] || source.language || "ja"}>{excerpt}{source.rawText.length > excerpt.length ? "…" : ""}</p><span className="small muted">你从这里收藏了</span><div>{[...new Set(data.occurrences.filter(o => o.sourceId === source.id).map(o => o.nodeId))].slice(0, 5).map(id => { const n = data.languageNodes.find(node => node.id === id); return n && <button key={n.id} className="detail-tag" onClick={() => setDetailId(n.id)}>{n.expression}</button>; })}</div></article>;
    }) : <p className="small muted">从 Inbox 保存真实输入后，这里会出现它的回声。</p>}</section>
    </div>{detail && <><button className="reencounter-detail-backdrop" aria-label="关闭详情" onClick={() => setDetailId(null)}/><aside className="reencounter-detail-panel" aria-label="表达详情"><NodeDetail node={detail} data={data} nodes={data.languageNodes} sources={data.sources}
      onStatus={onStatus} onReading={onReading} onSelect={setDetailId} onClose={() => setDetailId(null)}
      onContext={onContext} onDomain={onDomain} onExplore={() => onExplore(detail.id)} onSource={onSource}/></aside></>}</div>
  </div>;
}
