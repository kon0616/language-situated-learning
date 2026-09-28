import { useEffect, useMemo, useRef, useState } from "react";
import {
  Network,
  Inbox,
  Sprout,
  Plus,
  Check,
  FileText,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  Languages,
} from "lucide-react";
import { storage } from "./services/storage";
import type { FuriganaPart, LanguageNode, Source, Status } from "./types/language";
import WebPage, { type WebLens } from "./pages/WebPage";
import InboxPage from "./pages/InboxPage";
import ReactivatePage from "./pages/ReactivatePage";
import MaterialsPage from "./pages/MaterialsPage";
import SettingsPage from "./pages/SettingsPage";
import { saveExtraction } from "./services/saveExtraction";
import { useBatchFurigana } from "./services/useBatchFurigana";
import { languageView } from "./services/languageView.ts";
import { languageName } from "./services/languages.ts";
import { deleteMaterial } from "./services/deleteMaterial.ts";
import { useInboxDraft } from "./services/useInboxDraft.ts";
type Page = "web" | "inbox" | "materials" | "reactivate" | "settings";
export default function App() {
  const [initial] = useState(() => storage.load());
  const [storageReady, setStorageReady] = useState(false);
  const inboxDraft = useInboxDraft();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("language-web.sidebar-collapsed") === "true"; } catch { return false; }
  });
  function toggleSidebar() {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try { localStorage.setItem("language-web.sidebar-collapsed", String(next)); }
    catch { setNotice("菜单已切换，但浏览器未能保存此偏好。"); }
  }
  const [showFurigana, setShowFurigana] = useState(() => {
    try { return localStorage.getItem("language-web.show-furigana") !== "false"; } catch { return true; }
  });
  function toggleFurigana() {
    const next = !showFurigana;
    setShowFurigana(next);
    try { localStorage.setItem("language-web.show-furigana", String(next)); }
    catch { setNotice("注音显示已切换，但浏览器未能保存此偏好。"); }
  }
  const [data, setData] = useState(initial.data),
    [activeLanguage, setActiveLanguage] = useState(() => {
      try { return localStorage.getItem("language-web.active-language") || "ja"; } catch { return "ja"; }
    }),
    [page, setPage] = useState<Page>("web"),
    [selected, setSelected] = useState(initial.data.languageNodes[0]?.id || ""),
    [notice, setNotice] = useState(""),
    [storageError, setStorageError] = useState("");
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const saveLock = useRef(false);
  const [webLens, setWebLens] = useState<WebLens>("today"),
    [webCategory, setWebCategory] = useState(""),
    [exploreTarget, setExploreTarget] = useState<string | null>(null),
    [selectedMaterial, setSelectedMaterial] = useState<string | null>(null),
    [selectedExpression, setSelectedExpression] = useState<string | null>(null);
  const exposureKeys = useRef(new Set<string>());
  function recordExposure(key: string, ids: string[]) {
    if (exposureKeys.current.has(key)) return;
    exposureKeys.current.add(key);
    const shown = new Set(ids);
    const at = new Date().toISOString();
    setData(d => ({ ...d, languageNodes: d.languageNodes.map(n => shown.has(n.id)
      ? { ...n, encounterCount: (n.encounterCount || 0) + 1, lastEncounteredAt: at } : n) }));
  }
  useEffect(() => {
    let cancelled = false;
    void storage.loadPersistent().then(loaded => {
      if (cancelled) return;
      setData(loaded.data);
      setSelected(loaded.data.languageNodes[0]?.id || "");
      if (loaded.warning) { setStorageError(loaded.warning); setStorageBlocked(true); }
      setStorageReady(true);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!storageReady || storageBlocked) return;
    let cancelled = false;
    void storage.savePersistent(data).then(() => {
      if (!cancelled) setStorageError("");
    }).catch(() => {
      if (!cancelled) setStorageError("浏览器存储不可用或空间已满。本次修改尚未持久保存，请勿刷新。");
    });
    return () => { cancelled = true; };
  }, [data, storageReady, storageBlocked]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  function status(id: string, s: Status) {
    setData((d) => ({
      ...d,
      languageNodes: d.languageNodes.map((n) =>
        n.id === id
          ? { ...n, status: s, lastReviewedAt: new Date().toISOString() }
          : n,
      ),
    }));
  }
  function reading(id: string, value: string, furigana: FuriganaPart[]) {
    setData(d => ({ ...d, languageNodes: d.languageNodes.map(n => n.id === id
      ? { ...n, reading: value, furigana, readingManual: !!value.trim() && !furigana.length } : n) }));
  }
  const batchFurigana = useBatchFurigana(data.languageNodes, reading);
  const viewData = useMemo(() => languageView(data, activeLanguage), [data, activeLanguage]);
  const languageChoices = [...new Set([...data.sources.map(s => s.language || "ja"), ...data.languageNodes.map(n => n.language || "ja"), ...(activeLanguage === "all" ? [] : [activeLanguage])])].sort();
  function chooseLanguage(code: string) {
    setActiveLanguage(code);
    setSelectedMaterial(null); setSelectedExpression(null); setExploreTarget(null); setWebCategory("");
    try { localStorage.setItem("language-web.active-language", code); } catch { /* This preference is optional. */ }
  }
  async function save(incoming: LanguageNode[], source: Source) {
    if (saveLock.current) return;
    const result = saveExtraction(data, incoming, source);
    if (storageBlocked) {
      setStorageError("现有数据无法读取，保存已暂停以保护原始存储。请先检查浏览器数据。");
      return;
    }
    saveLock.current = true;
    setSavingMaterial(true);
    try { await storage.savePersistent(result.data); }
    catch {
      setStorageError("保存失败：浏览器存储不可用或空间已满。材料仍在收件箱中，请勿刷新。");
      saveLock.current = false;
      setSavingMaterial(false);
      return;
    }
    saveLock.current = false;
    setSavingMaterial(false);
    setData(result.data);
    inboxDraft.reset();
    chooseLanguage(source.language || "ja");
    if (result.firstId) setSelected(result.firstId);
    setSelectedMaterial(source.id);
    setSelectedExpression(null);
    setPage("materials");
    setNotice(`已保存材料，关联 ${result.linked} 个表达${result.added ? `（其中 ${result.added} 个新表达）` : ""}。`);
  }
  function removeMaterial(id: string) {
    const source = data.sources.find(item => item.id === id);
    if (!source) return;
    setData(current => deleteMaterial(current, id));
    setSelected(""); setSelectedMaterial(null); setSelectedExpression(null);
    setNotice(`已删除「${source.title}」及其独有表达；其他材料共享的表达已保留。`);
  }
  async function renameMaterial(id: string, title: string): Promise<boolean> {
    const name = title.trim();
    if (!name || storageBlocked || !data.sources.some(source => source.id === id)) return false;
    const next = { ...data, sources: data.sources.map(source => source.id === id ? { ...source, title: name } : source) };
    try { await storage.savePersistent(next); }
    catch {
      setStorageError("名称保存失败：浏览器存储不可用或空间已满。请勿刷新。");
      return false;
    }
    setData(current => ({ ...current, sources: current.sources.map(source => source.id === id ? { ...source, title: name } : source) }));
    setNotice("材料名称已更新。");
    return true;
  }
  function showToday(ids: string[]) {
    const date = new Date().toLocaleDateString("en-CA");
    recordExposure(`today:${date}:${ids.join("|")}`, ids);
    setData((d) => {
      const prior = d.todayHistory?.[date] || [];
      const next = [...new Set([...prior, ...ids])];
      return next.length === prior.length
        ? d
        : { ...d, todayHistory: { ...d.todayHistory, [date]: next } };
    });
  }
  function goLens(lens: WebLens, id = "") {
    setWebLens(lens);
    setWebCategory(id);
    setPage("web");
    setExploreTarget(lens === "explore" ? selected : null);
  }
  function openInMaterials(id: string, preferredSourceId?: string | null) {
    const occurrence = data.occurrences.find(o => o.nodeId === id && o.sourceId === preferredSourceId)
      || [...data.occurrences].reverse().find(o => o.nodeId === id);
    setSelected(id);
    setSelectedMaterial(occurrence?.sourceId || null);
    setSelectedExpression(id);
    setPage("materials");
  }
  const natural = viewData.languageNodes.filter(
    (n) => n.status === "spontaneous",
  ).length;
  if (!storageReady) return <div className="content-page" role="status">正在读取本地材料…</div>;
  return (
    <div className={`app-shell${showFurigana ? "" : " hide-furigana"}${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar" aria-label="主菜单">
        <a
          className="brand"
          aria-label="Language Web · 返回语言网"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            goLens("today");
          }}
        >
          <span className="brand-icon">
            <Network size={23} />
          </span>
          <span className="brand-label">
            Language Web<small>语言网</small>
          </span>
        </a>
        <div className="sidebar-controls">
          <button className="sidebar-collapse-button" aria-label={sidebarCollapsed ? "展开菜单" : "折叠菜单"} aria-expanded={!sidebarCollapsed} aria-controls="main-navigation" title={sidebarCollapsed ? "展开菜单" : "折叠菜单"} onClick={toggleSidebar}>
            {sidebarCollapsed ? <PanelLeftOpen size={19}/> : <PanelLeftClose size={19}/>}
            <span className="sidebar-control-label">折叠菜单</span>
          </button>
          <button className="sidebar-furigana-toggle" aria-label="显示注音" aria-pressed={showFurigana} title={`注音：${showFurigana ? "开，点击关闭" : "关，点击开启"}`} onClick={toggleFurigana}>
            <Languages size={19}/><span className="sidebar-control-label">注音</span><span className="sidebar-furigana-state">{showFurigana ? "开" : "关"}</span>
          </button>
        </div>
        <label className="workspace-label language-space-select"><span>语言空间</span><select aria-label="语言空间" value={activeLanguage} onChange={e => chooseLanguage(e.target.value)}>
          <option value="all">全部语言</option>
          {languageChoices.map(code => <option key={code} value={code}>{languageName(code)}</option>)}
        </select></label>
        <nav id="main-navigation" aria-label="页面导航">
          {(
            [
              { id: "inbox", label: "输入收件箱", en: "Inbox", icon: Inbox },
              { id: "materials", label: "材料库", en: "Materials", icon: FileText },
              { id: "web", label: "语言网", en: "Language Web", icon: Network },
              {
                id: "reactivate",
                label: "再次遇见",
                en: "Re-encounter",
                icon: Sprout,
              },
              { id: "settings", label: "AI 配置", en: "Settings", icon: Settings2 },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              title={item.label}
              className={page === item.id ? "active" : ""}
              onClick={() => {
                if (item.id === "web") goLens("today");
                else { if (item.id === "materials") { setSelectedMaterial(null); setSelectedExpression(null); } setPage(item.id); }
              }}
            >
              <item.icon size={19} />
              <span>
                {item.label}
                <small>{item.en}</small>
              </span>
              {item.id === "inbox" && inboxDraft.busy && <span className="nav-task-status" title="材料分析进行中">分析中</span>}
              {item.id === "inbox" && !inboxDraft.busy && inboxDraft.results.length > 0 && page !== "inbox" && <span className="nav-task-status" title="分析结果待保存">待保存</span>}
              {page === item.id && <span className="nav-mark" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="growth">
            <Sprout size={19} />
            <span>让语言慢慢生长</span>
            <p>
              <strong>{natural}</strong> / {viewData.languageNodes.length}{" "}
              个表达已能自然使用
            </p>
            <div className="progress-track">
              <i
                style={{
                  width: `${(natural / Math.max(viewData.languageNodes.length, 1)) * 100}%`,
                }}
              />
            </div>
          </div>
          <span className="local-label">
            <span /> 仅保存在此浏览器
          </span>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            我的空间 <span>/</span>{" "}
            {
              {
                web: "语言网",
                inbox: "输入收件箱",
                materials: "材料库",
                reactivate: "再次遇见",
                settings: "AI 配置",
              }[page]
            }
          </div>
          <div className="flex items-center gap-4">
            <span className="top-language">{languageName(activeLanguage)} <span>{activeLanguage.toUpperCase()}</span></span>
            <button className="add-input" onClick={() => setPage("inbox")}>
              <Plus size={16} /> 添加输入
            </button>
          </div>
        </header>
        {storageError && (
          <div role="alert" className="notice error">
            {storageError}
          </div>
        )}
        {notice && (
          <div role="status" className="toast">
            <Check size={18} />
            {notice}
          </div>
        )}
        {page === "web" && (
          <WebPage
            key={activeLanguage}
            data={viewData}
            selected={selected}
            onSelect={setSelected}
            onStatus={status}
            onReading={reading}
            lens={webLens}
            setLens={setWebLens}
            categoryId={webCategory}
            setCategoryId={setWebCategory}
            onShown={showToday}
            exploreTarget={exploreTarget}
            setExploreTarget={setExploreTarget}
            onSource={(id) => { setSelectedMaterial(id); setSelectedExpression(null); setPage("materials"); }}
          />
        )}{" "}
        {page === "inbox" && <InboxPage data={data} activeLanguage={activeLanguage} onSave={save} draft={inboxDraft} saving={savingMaterial} />}{" "}
        {page === "settings" && <SettingsPage batchFurigana={batchFurigana} />}{" "}
        {page === "materials" && <MaterialsPage data={viewData} selectedId={selectedMaterial} expressionId={selectedExpression}
          onSelect={(id) => { setSelectedMaterial(id); setSelectedExpression(null); }}
          onDelete={removeMaterial}
          onRename={renameMaterial}
          onOpenExpression={(id) => openInMaterials(id, selectedMaterial)} onCloseExpression={() => setSelectedExpression(null)}
          onStatus={status} onReading={reading} onContext={(id) => goLens("context", id)} onDomain={(id) => goLens("domain", id)}
          onExplore={(id) => { setSelected(id); setExploreTarget(id); setWebLens("explore"); setPage("web"); }} />}{" "}
        {page === "reactivate" && (
          <ReactivatePage
            key={activeLanguage}
            data={viewData}
            onExposure={recordExposure}
            onStatus={status}
            onReading={reading}
            onContext={(id) => goLens("context", id)}
            onDomain={(id) => goLens("domain", id)}
            onExplore={(id) => { setSelected(id); setExploreTarget(id); setWebLens("explore"); setPage("web"); }}
            onSource={(id) => { setSelectedMaterial(id); setSelectedExpression(null); setPage("materials"); }}
          />
        )}{" "}
      </main>
    </div>
  );
}
