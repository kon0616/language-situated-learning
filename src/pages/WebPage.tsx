import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import {
  Search,
  ArrowRight,
  Shuffle,
  Network,
  ChevronRight,
} from "lucide-react";
import type {
  AppData,
  Status,
  LanguageNode,
  ContextCategory,
  DomainCategory,
  LanguageEdgeRelation,
} from "../types/language.ts";
import { statusLabels } from "../types/language.ts";
import {
  contextNames,
  domainNames,
  descendants,
  path,
} from "../data/taxonomy.ts";
import { pickToday } from "../services/today.ts";
import { searchNodes } from "../services/search.ts";
import { localGraph } from "../services/localGraph.ts";
import { languageName } from "../services/languages.ts";
import NodeDetail from "../components/node-detail/NodeDetail.tsx";
import SceneView from "../components/SceneView.tsx";
export type WebLens = "today" | "context" | "domain" | "explore";
type GraphNode = Node<{
  label: string;
  meta: string;
  center: boolean;
  kind: "expression" | "scene";
  language?: string;
}>;
function ExpressionNode({ data, selected }: NodeProps<GraphNode>) {
  return (
    <div
      className={`graph-card ${data.kind} ${data.center ? "ego-center" : ""} ${selected ? "selected" : ""}`}
    >
      <Handle type="target" position={Position.Left} />
      <span className="graph-kind">
        {data.kind === "scene"
          ? "CONTEXT"
          : data.center
            ? "CURRENT EXPRESSION"
            : "NEARBY EXPRESSION"}
      </span>
      <div lang={data.kind === "expression" ? data.language || "ja" : undefined}>
        {data.label}
      </div>
      <small>{data.meta}</small>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { expression: ExpressionNode };
const relationNames: Record<LanguageEdgeRelation, string> = {
  same_scene: "同一情景",
  same_function: "同一功能",
  same_domain: "同一领域",
  similar: "相似",
  contrast: "对比",
  stronger: "更强",
  softer: "更柔和",
  often_with: "常搭配",
  followed_by: "常接续",
};
function ExpressionShelf({
  items,
  data,
  onOpen,
}: {
  items: LanguageNode[];
  data: AppData;
  onOpen: (id: string) => void;
}) {
  const [visible, setVisible] = useState(8);
  const mixed = new Set(data.languageNodes.map(node => node.language || "ja")).size > 1;
  const itemKey = items.map(n => n.id).join("|");
  useEffect(() => setVisible(8), [itemKey]);
  return (
    <div className="lens-card-grid">
      {items.slice(0, visible).map((node) => (
        <button
          className="lens-expression"
          key={node.id}
          onClick={() => onOpen(node.id)}
        >
          <div className="lens-expression-top">
            <span className="eyebrow">EXPRESSION{mixed ? ` · ${languageName(node.language || "ja")}` : ""}</span>
            <span className="small muted">{statusLabels[node.status]}</span>
          </div>
          <strong lang={node.language || "ja"}>{node.expression}</strong>
          <span className="lens-expression-context">
            {contextNames(data, node).join(" · ")}
          </span>
          <span lang={node.language || "ja"} className="lens-expression-example">
            {node.collocations[0] || node.examples[0]}
          </span>
          <ArrowRight size={16} />
        </button>
      ))}
      {!items.length && (
        <div className="lens-empty">
          这里还没有表达。可以从 Inbox 保存语料，或选择其他分类。
        </div>
      )}
      {items.length > visible && <button className="text-button shelf-more" onClick={() => setVisible(v => v + 8)}>继续查看 · 还有 {items.length - visible} 个</button>}
    </div>
  );
}
function LocalNetwork({
  data,
  centerId,
  onOpen,
}: {
  data: AppData;
  centerId: string;
  onOpen: (id: string) => void;
}) {
  const [hops, setHops] = useState<1 | 2>(1),
    [hover, setHover] = useState<string | null>(null),
    [activeEdge, setActiveEdge] = useState<string | null>(null);
  useEffect(() => {
    setHops(1);
    setHover(null);
    setActiveEdge(null);
  }, [centerId]);
  const graph = useMemo(
    () => localGraph(data, centerId, hops),
    [data, centerId, hops],
  );
  const ids = graph.nodes.map((n) => n.id).join("|");
  const nodes: GraphNode[] = graph.nodes.map((n, i) => {
    const angle =
      ((i - 1) / Math.max(graph.nodes.length - 1, 1)) * Math.PI * 2 -
      Math.PI / 2;
    const first = i === 0 || i <= 11;
    return {
      id: n.id,
      type: "expression",
      position:
        i === 0
          ? { x: 350, y: 260 }
          : {
              x: 350 + Math.cos(angle) * (first ? 340 : 580),
              y: 260 + Math.sin(angle) * (first ? 260 : 450),
            },
      data: {
        label: n.expression,
        meta: statusLabels[n.status],
        center: i === 0,
        kind: "expression",
        language: n.language || "ja",
      },
    };
  });
  const contextId = graph.nodes[0]?.contextIds[0];
  const context = data.contexts.find((c) => c.id === contextId);
  if (context)
    nodes.push({
      id: `context-${context.id}`,
      type: "expression",
      position: { x: 350, y: -130 },
      data: {
        label: context.name,
        meta: "共同情景",
        center: false,
        kind: "scene",
      },
    });
  const edgeLinks = context
    ? [
        ...graph.links,
        {
          source: `context-${context.id}`,
          target: centerId,
          relation: "same_scene" as const,
        },
      ]
    : graph.links;
  const edges: Edge[] = edgeLinks.map((link) => ({
    id: `${link.source}-${link.target}`,
    source: link.source,
    target: link.target,
    type: "smoothstep",
    label:
      hover === `${link.source}-${link.target}` ||
      activeEdge === `${link.source}-${link.target}`
        ? relationNames[link.relation]
        : undefined,
    labelStyle: { fontSize: 11, fill: "#678071" },
    labelBgStyle: { fill: "#fafcfb" },
    style: { stroke: "#a9c4b3", strokeWidth: 1.5 },
  }));
  return (
    <div className="local-network">
      <div className="local-network-bar">
        <div>
          <span className="eyebrow">LOCAL NETWORK</span>
          <p className="small muted">
            {hops === 1 ? "直接相邻 · 1 hop" : "附近关系 · 2 hops"} ·{" "}
            {nodes.length} 个节点
          </p>
        </div>
        <button
          className="secondary"
          disabled={hops === 2}
          onClick={() => setHops(2)}
        >
          {hops === 1 ? "展开附近节点" : "已展开到两跳"}
        </button>
      </div>
      <div className="local-graph">
        <ReactFlow
          key={`${centerId}-${hops}-${ids}`}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.24, maxZoom: 1 }}
          minZoom={0.3}
          maxZoom={1.5}
          nodesConnectable={false}
          onNodeClick={(_, n) => {
            if (n.data.kind === "expression") onOpen(n.id);
          }}
          onEdgeMouseEnter={(_, e) => setHover(e.id)}
          onEdgeMouseLeave={() => setHover(null)}
          onEdgeClick={(_, e) =>
            setActiveEdge(e.id === activeEdge ? null : e.id)
          }
        >
          <Background gap={24} size={1} color="#d7dfdc" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
export default function WebPage({
  data,
  selected,
  onSelect,
  onStatus,
  onReading,
  lens,
  setLens,
  categoryId,
  setCategoryId,
  onShown,
  exploreTarget,
  setExploreTarget,
  onSource,
}: {
  data: AppData;
  selected: string;
  onSelect: (id: string) => void;
  onStatus: (id: string, s: Status) => void;
  onReading: (id: string, reading: string, furigana: import("../types/language.ts").FuriganaPart[]) => void;
  lens: WebLens;
  setLens: (lens: WebLens) => void;
  categoryId: string;
  setCategoryId: (id: string) => void;
  onShown: (ids: string[]) => void;
  exploreTarget: string | null;
  setExploreTarget: (id: string | null) => void;
  onSource: (id: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [functions, setFunctions] = useState<string[]>([]),
    [panel, setPanel] = useState(false),
    [showDirect, setShowDirect] = useState(false);
  const [exploreMode, setExploreMode] = useState<"scene" | "expression" | "surprise">("scene");
  const [exploreScene, setExploreScene] = useState("");
  const [expressionQuery, setExpressionQuery] = useState("");
  const [today, setToday] = useState(() =>
    pickToday(
      data.languageNodes,
      data.todayHistory?.[new Date().toLocaleDateString("en-CA")] || [],
    ),
  );
  useEffect(() => {
    onShown(today.map((n) => n.id));
  }, []); // Today's first shelf is counted once when Web opens.
  const current =
    data.languageNodes.find((n) => n.id === selected) || data.languageNodes[0];
  const exploreCenter = data.languageNodes.find(n => n.id === exploreTarget);
  const search = useMemo(() => searchNodes(data, query), [data, query]);
  const sceneClusters = data.contexts.map(c => {
    const ids = descendants(data.contexts, c.id);
    const items = data.languageNodes.filter(n => n.contextIds.some(id => ids.includes(id)));
    return { c, count: items.length, recent: items.map(n => n.createdAt).sort().at(-1) || "" };
  }).filter(x => x.count).sort((a,b) => b.count - a.count || b.recent.localeCompare(a.recent)).slice(0, 8);
  const categories = lens === "domain" ? data.domains : data.contexts;
  const active = categories.find((c) => c.id === categoryId);
  const children = categories.filter(
    (c) => c.parentId === (active?.id || undefined),
  );
  const categoryIds = active ? descendants(categories, active.id) : [];
  const categoryItems = data.languageNodes.filter((n) => {
    const belongs = (lens === "domain" ? n.domainIds : n.contextIds).some(
      (id) => categoryIds.includes(id),
    );
    return (
      belongs &&
      (!functions.length || functions.some((f) => n.functionIds.includes(f)))
    );
  });
  const directItems = active
    ? categoryItems.filter((n) =>
        (lens === "domain" ? n.domainIds : n.contextIds).includes(active.id),
      )
    : [];
  const categoryPath = active ? path(categories, active.id) : [];
  const chooseLens = (next: WebLens) => {
    setLens(next);
    setCategoryId("");
    setPanel(false);
    setQuery("");
    setFunctions([]);
    setShowDirect(false);
    setExploreTarget(null);
    setExploreScene("");
  };
  const open = (id: string) => {
    onSelect(id);
    setPanel(true);
  };
  const exploreExpression = (id: string) => { onSelect(id); setExploreTarget(id); setLens("explore"); setPanel(false); setQuery(""); };
  const changeBatch = () => {
    const date = new Date().toLocaleDateString("en-CA");
    const shown = [
      ...(data.todayHistory?.[date] || []),
      ...today.map((n) => n.id),
    ];
    const next = pickToday(data.languageNodes, shown);
    setToday(next);
    onShown(next.map((n) => n.id));
  };
  const goCategory = (nextLens: "context" | "domain", id: string) => {
    setLens(nextLens);
    setCategoryId(id);
    setQuery("");
    setPanel(false);
    setFunctions([]);
    setShowDirect(false);
  };
  return (
    <div className="web-page lens-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR LIVING LANGUAGE</div>
          <h1>
            语言网 <span>Language Web</span>
          </h1>
          <p>从不同角度，再遇见你收集的语言。</p>
        </div>
        <div className="counter">
          <strong>{data.languageNodes.length}</strong>
          <span>个语言节点</span>
        </div>
      </div>
      <div className="lens-tabs" role="tablist" aria-label="语言网视角">
        {(
          [
            ["today", "Today"],
            ["context", "场景 Context"],
            ["domain", "领域 Domain"],
            ["explore", "Explore / 局部语言网"],
          ] as const
        ).map(([key, label]) => (
          <button
            role="tab"
            aria-selected={lens === key}
            className={lens === key ? "active" : ""}
            key={key}
            onClick={() => chooseLens(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="lens-search">
        <Search size={17} />
        <input
          aria-label="搜索语言"
          placeholder="搜索表达、意思、搭配、情景、领域或功能…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {query.trim() ? (
        <section className="lens-section">
          <div className="section-title">
            <div>
              <span className="eyebrow">SEARCH RESULTS</span>
              <h2>找到 {search.length} 个表达</h2>
            </div>
            <button className="text-button" onClick={() => setQuery("")}>
              清除搜索
            </button>
          </div>
          <ExpressionShelf data={data} items={search} onOpen={open} />
        </section>
      ) : (
        <>
          {lens === "today" && (
            <section className="lens-section">
              <div className="section-title">
                <div>
                  <span className="eyebrow">
                    THINGS WORTH MEETING AGAIN TODAY
                  </span>
                  <h2>今日漂流</h2>
                  <p className="small muted">
                    从你以前收集的表达里，随手捞起几句。
                  </p>
                </div>
                <button className="secondary" onClick={changeBatch}>
                  <Shuffle size={15} /> 换一批
                </button>
              </div>
              <ExpressionShelf data={data} items={today} onOpen={open} />
            </section>
          )}
          {(lens === "context" || lens === "domain") && (
            <section className="lens-section">
              <div className="lens-breadcrumb">
                <button
                  onClick={() => {
                    setCategoryId("");
                    setShowDirect(false);
                  }}
                >
                  {lens === "context" ? "Context" : "Domain"}
                </button>
                {categoryPath.map((c) => (
                  <span key={c.id}>
                    <ChevronRight size={14} />
                    <button
                      onClick={() => {
                        setCategoryId(c.id);
                        setShowDirect(false);
                      }}
                    >
                      {c.name}
                    </button>
                  </span>
                ))}
                {showDirect && (
                  <span>
                    <ChevronRight size={14} />
                    本分类收录
                  </span>
                )}
              </div>
              <div className="section-title">
                <div>
                  <span className="eyebrow">
                    {lens === "context"
                      ? "WHEN WOULD YOU SAY IT?"
                      : "WHAT ARE YOU TALKING ABOUT?"}
                  </span>
                  <h2>
                    {active?.name ||
                      (lens === "context" ? "场景 Context" : "领域 Domain")}
                  </h2>
                  <p className="small muted">
                    {active
                      ? children.length && !showDirect
                        ? "选择下一层。"
                        : "查看这个分类里的表达。"
                      : "选择一个方向，逐层找到相关表达。"}
                  </p>
                </div>
              </div>
              {children.length > 0 && !showDirect && (
                <div className="category-grid">
                  {children.map((c) => {
                    const sub = descendants(categories, c.id);
                    const count = data.languageNodes.filter((n) =>
                      (lens === "context" ? n.contextIds : n.domainIds).some(
                        (id) => sub.includes(id),
                      ),
                    ).length;
                    return (
                      <button
                        key={c.id}
                        className="category-card"
                        onClick={() => {
                          setCategoryId(c.id);
                          setShowDirect(false);
                        }}
                      >
                        <span>{c.name}</span>
                        <small>{count} 个表达</small>
                        <ArrowRight size={17} />
                      </button>
                    );
                  })}
                  {active && directItems.length > 0 && (
                    <button
                      className="category-card"
                      onClick={() => setShowDirect(true)}
                    >
                      <span>本分类收录</span>
                      <small>{directItems.length} 个表达</small>
                      <ArrowRight size={17} />
                    </button>
                  )}
                </div>
              )}
              {active && (children.length === 0 || showDirect) && (
                <div className="function-filter">
                  <details>
                    <summary>
                      Function 筛选{" "}
                      {functions.length > 0 && `· ${functions.length} 已选`}
                    </summary>
                    <div className="function-options">
                      {data.functions.map((f) => (
                        <label key={f.id}>
                          <input
                            type="checkbox"
                            checked={functions.includes(f.id)}
                            onChange={(e) =>
                              setFunctions((current) =>
                                e.target.checked
                                  ? [...current, f.id]
                                  : current.filter((x) => x !== f.id),
                              )
                            }
                          />
                          {f.name}
                        </label>
                      ))}
                    </div>
                  </details>
                </div>
              )}
              {active && (children.length === 0 || showDirect) && (
                <div className="category-expressions">
                  <div className="section-title">
                    <h2>这里的表达</h2>
                    <span className="small muted">
                      {showDirect ? directItems.length : categoryItems.length}{" "}
                      个
                    </span>
                  </div>
                  {lens === "context" && !showDirect && !functions.length ? <SceneView key={active.id} data={data} sceneId={active.id} onOpen={open} onExplore={exploreExpression} onScene={setCategoryId}/> : <ExpressionShelf data={data} items={showDirect ? directItems : categoryItems} onOpen={open} />}
                </div>
              )}
            </section>
          )}
          {lens === "explore" && (
            <section className="lens-section">
              {exploreTarget && exploreCenter ? <><button className="text-button" onClick={() => setExploreTarget(null)}>← Explore</button><div className="section-title"><div><span className="eyebrow">LOCAL NETWORK</span><h2 lang={exploreCenter.language || "ja"}>{exploreCenter.expression}</h2><p className="small muted">从这个表达向外看，点击邻居查看详情。</p></div></div><LocalNetwork data={data} centerId={exploreTarget} onOpen={open}/></> : exploreScene ? <><button className="text-button" onClick={() => setExploreScene("")}>← Explore</button><div className="section-title"><div><span className="eyebrow">FROM A SCENE</span><h2>{data.contexts.find(c => c.id === exploreScene)?.name}</h2></div></div><SceneView key={exploreScene} data={data} sceneId={exploreScene} onOpen={open} onExplore={exploreExpression} onScene={setExploreScene}/></> : <>
                <div className="section-title"><div><span className="eyebrow">EXPLORE YOUR LANGUAGE</span><h2>从哪里开始探索？</h2><p className="small muted">选择一个情景，或从熟悉的表达出发。</p></div></div>
                <div className="explore-entry-grid">
                  <button className={exploreMode === "scene" ? "active" : ""} onClick={() => setExploreMode("scene")}><strong>从场景开始</strong><span>From a Scene</span></button>
                  <button className={exploreMode === "expression" ? "active" : ""} onClick={() => setExploreMode("expression")}><strong>从表达开始</strong><span>From an Expression</span></button>
                  <button onClick={() => { if (Math.random() < 0.5 && sceneClusters.length) setExploreScene(sceneClusters[Math.floor(Math.random()*sceneClusters.length)].c.id); else if (data.languageNodes.length) { const node = data.languageNodes[Math.floor(Math.random()*data.languageNodes.length)]; onSelect(node.id); setExploreTarget(node.id); } }}><strong>随便走走</strong><span>Surprise Me</span></button>
                </div>
                {exploreMode === "scene" ? <div className="explore-scene-grid">{sceneClusters.map(({c,count}) => <button key={c.id} onClick={() => setExploreScene(c.id)}><span>{c.name}</span><small>{count} 个表达</small><ArrowRight size={16}/></button>)}</div> : <div className="explore-expression-entry"><label className="lens-search"><Search size={16}/><input aria-label="搜索中心表达" placeholder="搜索一个表达…" value={expressionQuery} onChange={e => setExpressionQuery(e.target.value)}/></label><div className="explore-recent">{(expressionQuery ? searchNodes(data, expressionQuery) : [...data.languageNodes].sort((a,b) => b.createdAt.localeCompare(a.createdAt))).slice(0, 8).map(n => <button key={n.id} onClick={() => { onSelect(n.id); setExploreTarget(n.id); }} lang={n.language || "ja"}>{n.expression}<ArrowRight size={15}/></button>)}</div></div>}
              </>}
            </section>
          )}
        </>
      )}
      {panel && current && (
        <div className="lens-detail-overlay">
          <div
            className="lens-detail-backdrop"
            onClick={() => setPanel(false)}
          />
          <NodeDetail
            node={current}
            data={data}
            nodes={data.languageNodes}
            sources={data.sources}
            onStatus={onStatus}
            onReading={onReading}
            onSelect={onSelect}
            onClose={() => setPanel(false)}
            onContext={(id) => goCategory("context", id)}
            onDomain={(id) => goCategory("domain", id)}
            onExplore={() => {
              setLens("explore");
              setExploreTarget(current.id);
              setQuery("");
              setPanel(false);
            }}
            onSource={onSource}
          />
        </div>
      )}
    </div>
  );
}
