import type {
  AppData,
  LanguageNode,
  LanguageEdge,
  Source,
} from "../types/language.ts";
import { createSeed, seedNodes, buildEdges } from "../data/seed.ts";
import { fragmentSeed } from "../data/fragments.ts";
import {
  findCategory,
  resolveContext,
  resolveFunction,
} from "../data/taxonomy.ts";
const KEY_V1 = "language-web.v1",
  KEY_V2 = "language-web.v2";
const DATABASE = "language-web-data";
const STORE = "snapshots";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("数据库被其他页面占用"));
  });
}

async function readDatabase(): Promise<string | undefined> {
  const db = await openDatabase();
  try {
    return await new Promise<string | undefined>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY_V2);
      request.onsuccess = () => resolve(request.result as string | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function writeDatabase(value: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(value, KEY_V2);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

let writeQueue: Promise<void> = Promise.resolve();
interface OldNode extends Omit<
  LanguageNode,
  "contextIds" | "domainIds" | "functionIds"
> {
  scene: string[];
  function: string[];
}
interface OldData {
  version: 1;
  languageNodes: OldNode[];
  languageEdges: LanguageEdge[];
  sources: Source[];
}
function validNodes(nodes: unknown): nodes is LanguageNode[] {
  return (
    Array.isArray(nodes) &&
    nodes.every(
      (n) =>
        n &&
        typeof n.id === "string" &&
        typeof n.expression === "string" &&
        Array.isArray(n.contextIds) &&
        Array.isArray(n.domainIds) &&
        Array.isArray(n.functionIds) &&
        Array.isArray(n.collocations) &&
        Array.isArray(n.examples) &&
        n.register &&
        ["seen", "understood", "tried", "spontaneous"].includes(n.status),
    )
  );
}
function validV2(d: unknown): d is AppData {
  const x = d as AppData;
  return (
    !!x &&
    x.schemaVersion === 2 &&
    validNodes(x.languageNodes) &&
    Array.isArray(x.languageEdges) &&
    Array.isArray(x.sources) &&
    Array.isArray(x.contexts) &&
    Array.isArray(x.domains) &&
    Array.isArray(x.functions)
  );
}
function hydrate(data: AppData): AppData {
  return {
    ...data,
    languageNodes: data.languageNodes.map((n) => ({
      ...n,
      language: n.language || "ja",
      encounterCount: Number.isFinite(n.encounterCount) ? n.encounterCount : 0,
    })),
    sources: data.sources.map(s => ({ ...s, language: s.language || "ja" })),
    occurrences: Array.isArray(data.occurrences) ? data.occurrences : data.languageNodes
      .filter(n => n.sourceId && data.sources.some(s => s.id === n.sourceId))
      .map(n => ({ id: `legacy-occurrence-${n.id}`, sourceId: n.sourceId!, nodeId: n.id,
        excerpt: n.sourceContext || n.examples[0] || "", createdAt: n.createdAt })),
    fragments: Array.isArray(data.fragments)
      ? [...data.fragments, ...fragmentSeed.filter(f => !data.fragments.some(existing => existing.id === f.id))]
      : structuredClone(fragmentSeed),
  };
}
function validV1(d: unknown): d is OldData {
  const x = d as OldData;
  return (
    !!x &&
    x.version === 1 &&
    Array.isArray(x.languageNodes) &&
    Array.isArray(x.languageEdges) &&
    Array.isArray(x.sources) &&
    x.languageNodes.every(
      (n) =>
        n &&
        typeof n.id === "string" &&
        typeof n.expression === "string" &&
        Array.isArray(n.scene) &&
        Array.isArray(n.function) &&
        Array.isArray(n.collocations) &&
        Array.isArray(n.examples) &&
        n.register,
    )
  );
}
export function migrateV1(old: OldData): AppData {
  if (!validV1(old)) throw new Error("invalid v1 data");
  const data = createSeed();
  const nodes = old.languageNodes.map((oldNode) => {
    const { scene, function: oldFunctions, ...rest } = oldNode;
    const contextIds = [
      ...new Set(
        (scene.length ? scene : ["待归类"]).map(
          (s) => findCategory(data.contexts, s)?.id || resolveContext(data, s),
        ),
      ),
    ];
    const functionIds = [
      ...new Set(
        (oldFunctions.length ? oldFunctions : ["描述"]).map(
          (s) =>
            findCategory(data.functions, s)?.id || resolveFunction(data, s),
        ),
      ),
    ];
    return {
      ...rest,
      contextIds,
      domainIds: ["general"],
      functionIds,
    } as LanguageNode;
  });
  // Introduce new sample architecture expressions without overwriting any saved expression or status.
  for (const example of seedNodes().slice(9))
    if (!nodes.some((n) => n.expression === example.expression))
      nodes.push(example);
  data.languageNodes = nodes;
  const ids = new Set(nodes.map((n) => n.id));
  data.languageEdges = [
    ...old.languageEdges.filter((e) => ids.has(e.source) && ids.has(e.target)),
    ...buildEdges(nodes).filter(
      (e) => !old.languageEdges.some((oldEdge) => oldEdge.id === e.id),
    ),
  ];
  data.sources = old.sources;
  data.occurrences = nodes.filter(n => n.sourceId && old.sources.some(s => s.id === n.sourceId))
    .map(n => ({ id: `legacy-occurrence-${n.id}`, sourceId: n.sourceId!, nodeId: n.id,
      excerpt: n.sourceContext || n.examples[0] || "", createdAt: n.createdAt }));
  return hydrate(data);
}
export const storage = {
  async loadPersistent(): Promise<{ data: AppData; warning?: string; needsSave?: boolean }> {
    if (typeof indexedDB !== "undefined") {
      try {
        const raw = await readDatabase();
        if (raw) {
          const parsed = JSON.parse(raw);
          if (!validV2(parsed)) throw new Error("invalid IndexedDB data");
          return { data: hydrate(parsed) };
        }
      } catch {
        // A readable localStorage snapshot may still be available.
        const fallback = storage.load();
        if (!fallback.warning && !fallback.needsSave) return fallback;
        return { ...fallback, warning: "浏览器数据库无法读取；现有数据未被覆盖。请先备份或检查浏览器存储设置。" };
      }
    }
    return storage.load();
  },
  savePersistent(data: AppData): Promise<void> {
    const serialized = JSON.stringify(data);
    const write = async () => {
      if (typeof indexedDB !== "undefined") {
        await writeDatabase(serialized);
        return;
      }
      localStorage.setItem(KEY_V2, serialized);
    };
    const pending = writeQueue.then(write, write);
    writeQueue = pending.catch(() => {});
    return pending;
  },
  load(): { data: AppData; warning?: string; needsSave?: boolean } {
    try {
      const raw2 = localStorage.getItem(KEY_V2);
      if (raw2) {
        const parsed = JSON.parse(raw2);
        if (!validV2(parsed)) throw new Error("invalid v2");
        return { data: hydrate(parsed) };
      }
      const raw1 = localStorage.getItem(KEY_V1);
      if (raw1) return { data: migrateV1(JSON.parse(raw1)), needsSave: true };
      return { data: createSeed(), needsSave: true };
    } catch {
      return {
        data: createSeed(),
        warning:
          "本地数据无法读取。原始存储没有被覆盖；请先备份浏览器数据后再处理。",
      };
    }
  },
  save(data: AppData) {
    try {
      localStorage.setItem(KEY_V2, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  },
};
