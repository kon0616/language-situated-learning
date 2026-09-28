import { useState } from "react";
import { ReactFlow, Background, Controls, type Node, type Edge } from "@xyflow/react";
import { ArrowRight } from "lucide-react";
import type { AppData } from "../types/language";
import { descendants, contextNames } from "../data/taxonomy";
import { fragmentForScene } from "../services/fragmentGenerator";
import LanguageFragmentView from "./LanguageFragmentView";

export default function SceneView({ data, sceneId, kind = "context", onOpen, onExplore, onScene }: {
  data: AppData; sceneId: string; kind?: "context" | "domain"; onOpen: (id: string) => void;
  onExplore?: (id: string) => void; onScene?: (id: string) => void;
}) {
  const [visible, setVisible] = useState(8);
  const categories = kind === "context" ? data.contexts : data.domains;
  const scene = categories.find(c => c.id === sceneId);
  const ids = descendants(categories, sceneId);
  const expressions = data.languageNodes.filter(n => (kind === "context" ? n.contextIds : n.domainIds).some(id => ids.includes(id)));
  const fragment = fragmentForScene(data, kind === "context" ? sceneId : undefined, kind === "domain" ? sceneId : undefined);
  const children = categories.filter(c => c.parentId === sceneId && expressions.some(n => (kind === "context" ? n.contextIds : n.domainIds).some(id => descendants(categories,c.id).includes(id))));
  const graphItems = expressions.slice(0, 7);
  const nodes: Node[] = [{ id: "scene", position: { x: 240, y: 190 }, data: { label: scene?.name || "场景" }, className: "scene-flow-root" },
    ...graphItems.map((n, i) => ({ id: n.id, position: { x: 240 + Math.cos(i * Math.PI * 2 / graphItems.length) * 260, y: 190 + Math.sin(i * Math.PI * 2 / graphItems.length) * 150 }, data: { label: n.expression }, className: "scene-flow-expression" }))];
  const edges: Edge[] = graphItems.map(n => ({ id: `scene-${n.id}`, source: "scene", target: n.id, style: { stroke: "#aac7b1" } }));
  return <div className="scene-view">
    <span className="eyebrow">ABOUT THIS SCENE</span><p className="scene-about">{scene?.name} · {expressions.length} 个已收藏表达。这里聚在一起的语言，来自相近的谈话情景。</p>
    {!!children.length && onScene && <div className="scene-subtopics">{children.slice(0, 8).map(c => <button key={c.id} onClick={() => onScene(c.id)}>{c.name}</button>)}</div>}
    {fragment && <div className="scene-fragment"><span className="eyebrow">{fragment.source === "original" ? "ORIGINAL CONTEXT" : "LANGUAGE IN CONTEXT"} · {fragment.title}</span><LanguageFragmentView fragment={fragment} nodes={data.languageNodes} language={data.sources.find(source => source.id === fragment.sourceId)?.languages?.[0]} onOpen={onOpen}/></div>}
    <div className="section-title"><h3>这里的表达 <span className="small muted">Expressions in this scene</span></h3><span className="small muted">{expressions.length} 个</span></div>
    <div className="scene-expression-grid">{expressions.slice(0, visible).map(n => <div className="scene-expression" key={n.id}><button onClick={() => onOpen(n.id)}><strong lang={n.language || "ja"}>{n.expression}</strong><span>{contextNames(data, n).join(" · ")}</span><ArrowRight size={15}/></button>{onExplore && <button className="text-button" onClick={() => onExplore(n.id)}>Explore connections ↗</button>}</div>)}</div>
    {expressions.length > visible && <button className="text-button" onClick={() => setVisible(v => expressions.length <= 20 ? expressions.length : v + 8)}>{expressions.length <= 20 ? `查看全部 ${expressions.length} 个表达` : `继续查看 · 还有 ${expressions.length - visible} 个`}</button>}
    <div className="scene-graph-heading"><span className="eyebrow">NEARBY LANGUAGE</span><p className="small muted">点击节点查看表达 · 最多 8 个节点</p></div>
    <div className="scene-flow"><ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.5} maxZoom={1.4} nodesConnectable={false} onNodeClick={(_, n) => { if (n.id !== "scene") onOpen(n.id); }}><Background gap={24} size={1} color="#d7dfdc"/><Controls showInteractive={false}/></ReactFlow></div>
  </div>;
}
