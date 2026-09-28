import { test } from "node:test";
import assert from "node:assert/strict";
import { extractLanguage } from "../src/services/extractor.ts";
import {
  sampleTranscript,
  createSeed,
  seedNodes,
  buildEdges,
} from "../src/data/seed.ts";
import {
  findCategory,
  resolveContext,
  resolveDomain,
  withClassification,
} from "../src/data/taxonomy.ts";
import { dailyContexts } from "../src/services/reactivation.ts";
import { pickToday } from "../src/services/today.ts";
import { searchNodes } from "../src/services/search.ts";
import { localGraph } from "../src/services/localGraph.ts";
import { storage, migrateV1 } from "../src/services/storage.ts";
import { archiveFragments, availableFragments, generateFragment, fragmentForScene, reviewSentences } from "../src/services/fragmentGenerator.ts";
import { saveExtraction } from "../src/services/saveExtraction.ts";
import { deleteMaterial } from "../src/services/deleteMaterial.ts";
import { normalizeMaterialAnalysis } from "../src/services/materialAnalysisParser.ts";
import { requestDeepSeek, requestFurigana, requestLanguageDetection } from "../src/server/deepseek.ts";
import { DEEPSEEK_ENDPOINT } from "../src/config/deepseek.ts";
import { analyzeWithDeepSeek } from "../src/server/deepseek.ts";
import { splitMaterial } from "../src/services/materialChunks.ts";
import { normalizeFurigana, hasCompleteFurigana, needsFurigana } from "../src/services/furigana.ts";
import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createDeepSeekMiddleware } from "../src/server/deepseek.ts";
import { guessLanguage } from "../src/services/languages.ts";
import { languageView } from "../src/services/languageView.ts";
import { handleHostedApi, hostedApiRoutes } from "../src/server/hostedApi.ts";
import { clearHostedApiKey, hostedApiStatus, saveHostedApiConfig } from "../src/services/apiClient.ts";

test("existing mock transcript suggests all three lenses", async () => {
  const nodes = await extractLanguage(sampleTranscript);
  assert.equal(nodes.length, 4);
  assert.ok(
    nodes.every(
      (n) =>
        n.suggestedContexts?.length &&
        n.suggestedDomains?.length &&
        n.suggestedFunctions?.length,
    ),
  );
  assert.deepEqual(nodes[0].suggestedFunctions,["缓和"]);
  assert.deepEqual(await extractLanguage("今日は雨です。"), []);
});
test("taxonomy is independent, many to many, and aliases reuse controlled categories", () => {
  const data = createSeed();
  const node = data.languageNodes[1];
  assert.equal(node.contextIds.length, 2);
  assert.equal(findCategory(data.contexts, "观点讨论")?.id, "social-opinion");
  assert.equal(resolveContext(data, "讨论"), "social-opinion");
  assert.equal(resolveDomain(data, "建筑"), "architecture-design");
  const roots = data.contexts.filter((x) => !x.parentId).length;
  const classified = withClassification(data, {
    ...node,
    suggestedContexts: ["意见讨论", "观点讨论", "新场景"],
    suggestedDomains: ["建筑", "Architecture & Design"],
    suggestedFunctions: ["缓和", "soften disagreement"],
  });
  assert.equal(classified.contextIds.length, 2);
  assert.deepEqual(classified.domainIds, ["architecture-design"]);
  assert.deepEqual(classified.functionIds, ["soften"]);
  assert.equal(data.contexts.filter((x) => !x.parentId).length, roots);
});
test("v1 migration preserves expressions, status, timestamps, sources and old edges", () => {
  const seed = seedNodes()[0];
  const old = {
    ...seed,
    scene: ["部分同意后反驳", "陌生的旧情景"],
    function: ["先认同，再补充不同意见"],
    contextIds: undefined,
    domainIds: undefined,
    functionIds: undefined,
    status: "spontaneous" as const,
    sourceId: "user-source",
    createdAt: "2020-01-01T00:00:00.000Z",
  };
  const migrated = migrateV1({
    version: 1,
    languageNodes: [old] as any,
    languageEdges: [
      { id: "legacy", source: "seed-0", target: "seed-0", relation: "similar" },
    ],
    sources: [
      {
        id: "user-source",
        title: "我的输入",
        type: "article",
        date: "2020-01-01",
        rawText: "原文",
      },
    ],
  });
  const result = migrated.languageNodes.find((n) => n.id === "seed-0")!;
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(result.status, "spontaneous");
  assert.equal(result.createdAt, old.createdAt);
  assert.equal(result.sourceId, "user-source");
  assert.ok(result.contextIds.includes("social-partial"));
  assert.ok(result.contextIds.some((id) => id.startsWith("custom-")));
  assert.deepEqual(result.domainIds, ["general"]);
  assert.equal(migrated.sources[0].rawText, "原文");
  assert.ok(migrated.languageEdges.some((e) => e.id === "legacy"));
});
test("local graph is bounded at one and two hops even with hundreds of expressions", () => {
  const data = createSeed();
  const template = data.languageNodes[0];
  for (let i = 0; i < 500; i++)
    data.languageNodes.push({
      ...template,
      id: `large-${i}`,
      expression: `expression ${i}`,
      contextIds: ["social-partial"],
    });
  data.languageEdges = buildEdges(data.languageNodes);
  assert.ok(localGraph(data, template.id, 1).nodes.length <= 7);
  assert.ok(localGraph(data, template.id, 2).nodes.length <= 19);
  assert.equal(localGraph(data, template.id, 1).nodes[0].id, template.id);
});
test("search covers expression, collocation, context, domain and function", () => {
  const data = createSeed();
  assert.ok(
    searchNodes(data, "反驳").some(
      (n) => n.expression === "言いたいことは分かるんだけど",
    ),
  );
  assert.ok(
    searchNodes(data, "建筑").some((n) => n.expression === "奥行きが出る"),
  );
  assert.ok(
    searchNodes(data, "価値観を押し付ける").some(
      (n) => n.expression === "押し付ける",
    ),
  );
  assert.ok(
    searchNodes(data, "缓和").some(
      (n) => n.expression === "言いたいことは分かるんだけど",
    ),
  );
});
test("Today prefers unseen learning nodes and avoids shown items until exhausted", () => {
  const nodes = createSeed().languageNodes;
  const first = pickToday(nodes, [], 4, () => 0);
  assert.equal(first.length, 4);
  assert.equal(new Set(first.map((n) => n.id)).size, 4);
  const second = pickToday(
    nodes,
    first.map((n) => n.id),
    4,
    () => 0,
  );
  assert.ok(second.every((n) => !first.some((old) => old.id === n.id)));
  assert.equal(
    pickToday(
      nodes,
      nodes.slice(0, -1).map((n) => n.id),
      4,
      () => 0,
    ).length,
    4,
  );
  assert.equal(dailyContexts(nodes, "2026-09-25").length, 3);
});
test("storage migrates legacy key without removing it and persists v2 roundtrip", () => {
  const values = new Map<string, string>();
  const old = {
    version: 1,
    languageNodes: [
      { ...seedNodes()[0], scene: ["部分同意后反驳"], function: ["缓和"] },
    ],
    languageEdges: [],
    sources: [{ id: "seed-source", title: "旧材料", type: "conversation", date: "2020-01-01", rawText: "旧原文" }],
  };
  values.set("language-web.v1", JSON.stringify(old));
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => values.get(k) || null,
      setItem: (k: string, v: string) => values.set(k, v),
    },
  });
  const loaded = storage.load();
  assert.equal(loaded.needsSave, true);
  assert.equal(
    loaded.data.languageNodes[0].expression,
    "言いたいことは分かるんだけど",
  );
  assert.equal(storage.save(loaded.data), true);
  assert.ok(values.has("language-web.v1"));
  assert.deepEqual(
    storage.load().data,
    JSON.parse(JSON.stringify(loaded.data)),
  );
  const legacyV2 = structuredClone(loaded.data) as any;
  delete legacyV2.fragments;
  delete legacyV2.occurrences;
  delete legacyV2.languageNodes[0].encounterCount;
  values.set("language-web.v2", JSON.stringify(legacyV2));
  const hydrated = storage.load().data;
  assert.equal(hydrated.languageNodes[0].encounterCount, 0);
  assert.ok(hydrated.fragments.length >= 4);
  assert.ok(hydrated.occurrences.some(o => o.nodeId === hydrated.languageNodes[0].id));
  values.set("language-web.v2", "{bad");
  assert.ok(storage.load().warning);
  assert.equal(values.get("language-web.v2"), "{bad");
});

test("persistent storage restores saved materials and reports a failed write", async () => {
  const values = new Map<string, string>();
  let writable = true;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => {
      if (!writable) throw new Error("QuotaExceededError");
      values.set(key, value);
    },
  } });
  const data = createSeed();
  data.sources.push({ id: "persisted-material", language: "en", title: "Saved article",
    type: "article", date: "2026-09-28", rawText: "A real source paragraph." });
  await storage.savePersistent(data);
  assert.equal((await storage.loadPersistent()).data.sources.at(-1)?.id, "persisted-material");
  writable = false;
  await assert.rejects(storage.savePersistent(data), /QuotaExceededError/);
  assert.equal((await storage.loadPersistent()).data.sources.at(-1)?.id, "persisted-material");
});
test("saving a repeated expression keeps one node and links both materials", () => {
  const initial = createSeed();
  const original = initial.languageNodes[0];
  const source = { id: "second-material", title: "新的对话", type: "conversation" as const,
    date: "2026-09-25", rawText: "言いたいことは分かるんだけど、少し考えたい。" };
  const result = saveExtraction(initial, [{ ...original, id: "extracted-copy", sourceContext: source.rawText,
    reading: "いいたいことはわかるんだけど", furigana: [{ text: "言", reading: "い" }, { text: "いたいことは" },
      { text: "分", reading: "わ" }, { text: "かるんだけど" }] }], source);
  assert.equal(result.added, 0);
  assert.equal(result.linked, 1);
  assert.equal(result.data.languageNodes.length, initial.languageNodes.length);
  assert.equal(result.data.languageNodes[0].sourceId, "seed-source");
  assert.equal(result.data.languageNodes[0].reading, "いいたいことはわかるんだけど");
  assert.equal(result.data.occurrences.filter(o => o.nodeId === original.id).length, 2);
  assert.equal(result.data.occurrences.find(o => o.sourceId === source.id)?.excerpt, source.rawText);
  assert.ok(result.data.sources.some(s => s.id === source.id));
});
test("scene fragments stay contextual and generator marks only saved expressions", () => {
  const data = createSeed();
  const scene = fragmentForScene(data, "social-partial");
  assert.equal(scene?.id, "fragment-opinion");
  assert.equal(fragmentForScene(data, "social-end")?.id, "fragment-deescalation");
  assert.equal(fragmentForScene(data, "relationship-feeling"), undefined);
  data.languageNodes = data.languageNodes.filter(n => n.id !== "seed-2");
  const generated = generateFragment({ contextId: "social-opinion" }, data);
  assert.ok(generated.id.startsWith("generated-"));
  assert.ok(!generated.expressionIds.includes("seed-2"));
  assert.ok(generated.content.every(line => !line.expressionIds?.includes("seed-2")));
});
test("DeepSeek adapter sends JSON mode and validates material analysis without a network call", async () => {
  const rawText = "言いたいことは分かるんだけど、少し考えたい。";
  const payload = { summary: "讨论一个提议", groups: [{ label: "部分同意", excerpt: rawText, expressionIndexes: [0] }],
    expressions: [{ expression: "言いたいことは分かるんだけど", type: "pragmatic", meaning: "先认同再保留意见",
      contextLabels: ["部分同意后反驳"], domainLabels: ["General"], functionLabels: ["缓和"],
      collocations: ["言いたいことは分かるんだけど"], examples: [rawText], register: { level: "neutral", notes: "对话" },
      sourceContext: "模型编造的出处", usefulness: 80 }] };
  let called = false;
  const fakeFetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    called = true;
    assert.equal(url, DEEPSEEK_ENDPOINT);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "deepseek-flash");
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.deepEqual(body.thinking, { type: "disabled" });
    assert.ok(body.messages[0].content.includes("JSON"));
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(payload) } }] }), { status: 200 });
  };
  const analysis = await requestDeepSeek({ rawText, title: "测试材料", sourceType: "conversation" }, "test-key", "deepseek-flash", fakeFetch as typeof fetch);
  assert.equal(called, true);
  assert.equal(analysis.expressions[0].sourceContext, rawText);
  assert.equal(analysis.expressions[0].contextLabels[0], "部分同意后反驳");
  assert.equal(analysis.groups[0].expressionIndexes[0], 0);
  assert.throws(() => normalizeMaterialAnalysis({ summary: "x" }, rawText));
});

test("hosted API requires a per-request key and handles detection and one analysis chunk", async () => {
  assert.deepEqual(hostedApiRoutes, ["/api/detect-language", "/api/analyze-chunk", "/api/furigana"]);
  const url = "https://example.netlify.app/api/analyze-chunk";
  const input = { rawText: "We can work out a plan.", title: "Plan", sourceType: "conversation", targetLanguage: "en" };
  const request = (path: string, headers: Record<string, string> = {}) => new Request(`https://example.netlify.app${path}`,
    { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(input) });
  assert.equal((await handleHostedApi(request("/api/analyze-chunk"))).status, 401);
  assert.equal((await handleHostedApi(request("/api/analyze-chunk", { origin: "https://other.example", "x-deepseek-key": "test-key" }))).status, 403);
  assert.equal((await handleHostedApi(new Request(url, { method: "GET" }))).status, 405);

  const calls: string[] = [];
  const fakeFetch = async (target: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(target, DEEPSEEK_ENDPOINT);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-key");
    const body = JSON.parse(String(init?.body));
    calls.push(body.model);
    const content = body.max_tokens === 250
      ? { primary: "en", languages: ["en"], confidence: "high" }
      : { summary: "计划", groups: [], expressions: [{ expression: "work out a plan", type: "collocation",
        sourceContext: input.rawText, contextLabels: ["计划"], domainLabels: ["General"], functionLabels: ["解决"] }] };
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }] });
  };
  const headers = { origin: "https://example.netlify.app", "x-deepseek-key": "test-key", "x-deepseek-model": "test-model" };
  const detection = await handleHostedApi(request("/api/detect-language", headers), fakeFetch as typeof fetch);
  assert.equal((await detection.json()).primary, "en");
  const analysis = await handleHostedApi(request("/api/analyze-chunk", headers), fakeFetch as typeof fetch);
  assert.equal((await analysis.json()).analysis.expressions[0].sourceContext, input.rawText);
  assert.deepEqual(calls, ["test-model", "test-model"]);
  assert.equal(analysis.headers.get("Cache-Control"), "no-store");
});

test("hosted API configuration stays in browser storage and never echoes the key", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } });
  try {
    assert.equal(hostedApiStatus().configured, false);
    const saved = saveHostedApiConfig("test-private-key", "deepseek-chat");
    assert.equal(saved.configured, true);
    assert.equal(saved.model, "deepseek-chat");
    assert.equal(JSON.stringify(saved).includes("test-private-key"), false);
    assert.equal(hostedApiStatus().configured, true);
    assert.equal(saveHostedApiConfig("", "deepseek-reasoner").configured, true);
    assert.equal(clearHostedApiKey().configured, false);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("long material is analyzed in chunks and all distinct expressions remain available", async () => {
  const first = "自然な言い方を覚えたい。".repeat(120);
  const second = "よく使う搭配も拾いたい。".repeat(120);
  const rawText = first + second;
  assert.ok(splitMaterial(rawText).length > 1);
  let calls = 0;
  const fakeFetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const chunk = JSON.parse(body.messages[1].content).rawText as string;
    const index = calls++;
    const expressions = Array.from({ length: 18 }, (_, i) => ({
      expression: i === 0 ? "共通の言い方" : `第${index}段の搭配${i}`,
      type: "collocation", sourceContext: chunk.slice(0, 20),
      contextLabels: ["日常会话"], domainLabels: ["General"], functionLabels: ["描述"],
    }));
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
      summary: `第${index}段`, groups: [{ label: "言い方", excerpt: chunk.slice(0, 20), expressionIndexes: [0, 17] }], expressions,
    }) } }] }), { status: 200 });
  };
  const analysis = await analyzeWithDeepSeek({ rawText, title: "长材料", sourceType: "conversation" }, "test-key", "deepseek-flash", fakeFetch as typeof fetch);
  assert.equal(calls, splitMaterial(rawText).length);
  assert.ok(analysis.expressions.length > 15);
  assert.equal(analysis.expressions.length, calls * 17 + 1);
  assert.equal(analysis.groups.length, calls);
  assert.ok(analysis.groups.every(group => group.expressionIndexes.every(index => index < analysis.expressions.length)));
});

test("a truncated model response retries smaller pieces without repeating successful ones", async () => {
  const rawText = "自然な言い方を拾う。".repeat(100);
  const completed: string[] = [];
  let truncated = 0;
  const fakeFetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const piece = JSON.parse(body.messages[1].content).rawText as string;
    if (piece.length > 600) {
      truncated++;
      return new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{" } }] }), { status: 200 });
    }
    completed.push(piece);
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
      summary: "表达", groups: [], expressions: [{ expression: `言い方 ${completed.length}`, sourceContext: piece.slice(0, 20) }],
    }) } }] }), { status: 200 });
  };
  const analysis = await analyzeWithDeepSeek({ rawText, title: "自动重试", sourceType: "conversation" }, "test-key", "deepseek-flash", fakeFetch as typeof fetch);
  assert.ok(truncated > 0);
  assert.equal(completed.join(""), rawText);
  assert.equal(analysis.expressions.length, completed.length);
});

test("furigana only appears when annotated parts match the saved expression", async () => {
  assert.deepEqual(normalizeFurigana([{ text: "漢字", reading: "かんじ" }, { text: "を" }, { text: "読む", reading: "よ" }], "漢字を読む"),
    [{ text: "漢字", reading: "かんじ" }, { text: "を" }, { text: "読む", reading: "よ" }]);
  assert.deepEqual(normalizeFurigana([{ text: "別の語", reading: "べつのご" }], "漢字を読む"), []);
  const fakeFetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
    reading: "かんじをよむ", furigana: [{ text: "漢字", reading: "かんじ" }, { text: "を" }, { text: "読む", reading: "よ" }],
  }) } }] }), { status: 200 });
  const result = await requestFurigana("漢字を読む", "test-key", "deepseek-flash", fakeFetch as typeof fetch);
  assert.equal(result.reading, "かんじをよむ");
  assert.equal(result.furigana[2].reading, "よ");
});

test("API settings survive middleware recreation without returning the key", async () => {
  const directory = mkdtempSync(join(tmpdir(), "language-web-config-"));
  const configFile = join(directory, "api.json");
  const call = (middleware: ReturnType<typeof createDeepSeekMiddleware>, method: string, body?: object) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const req = Object.assign(Readable.from(body ? [JSON.stringify(body)] : []), {
      method, url: "/config", headers: { host: "localhost" },
    });
    const res = { statusCode: 200, setHeader() {}, end(value: string) {
      const result = JSON.parse(value);
      if (res.statusCode >= 400) reject(new Error(result.error)); else resolve(result);
    } };
    middleware(req as IncomingMessage, res as unknown as ServerResponse, reject);
  });
  try {
    const first = createDeepSeekMiddleware({ configFile });
    await call(first, "POST", { apiKey: "test-local-only-key", model: "test-model" });
    const restarted = createDeepSeekMiddleware({ configFile });
    const status = await call(restarted, "GET");
    assert.equal(status.configured, true);
    assert.equal(status.model, "test-model");
    assert.equal(status.keySource, "local");
    assert.equal(JSON.stringify(status).includes("test-local-only-key"), false);
    await call(restarted, "POST", { apiKey: "", model: "new-model" });
    const again = await call(createDeepSeekMiddleware({ configFile }), "GET");
    assert.equal(again.configured, true);
    assert.equal(again.model, "new-model");
  } finally { unlinkSync(configFile); rmdirSync(directory); }
});

test("batch furigana includes missing ruby even with a full reading and excludes manual readings", () => {
  const node = { ...seedNodes()[0], expression: "漢字を読む", reading: "かんじをよむ", furigana: [] };
  assert.equal(needsFurigana(node), true);
  assert.equal(needsFurigana({ ...node, readingManual: true }), false);
  const incomplete = [{ text: "漢字", reading: "かんじ" }, { text: "を読む" }];
  assert.equal(hasCompleteFurigana(incomplete, node.expression), false);
  assert.equal(needsFurigana({ ...node, furigana: incomplete }), true);
  const complete = [{ text: "漢字", reading: "かんじ" }, { text: "を" }, { text: "読", reading: "よ" }, { text: "む" }];
  assert.equal(needsFurigana({ ...node, furigana: complete }), false);
  assert.equal(needsFurigana({ ...node, expression: "ありがとう" }), false);
});

test("old materials stay Japanese and identical expressions in another language remain distinct", () => {
  const old = createSeed();
  delete old.sources[0].language;
  delete old.languageNodes[0].language;
  const values = new Map([["language-web.v2", JSON.stringify(old)]]);
  Object.defineProperty(globalThis, "localStorage", { configurable: true,
    value: { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value) } });
  const loaded = storage.load().data;
  assert.equal(loaded.sources[0].language, "ja");
  assert.equal(loaded.languageNodes[0].language, "ja");
  const englishSource = { id: "en-source", language: "en", title: "English chat", type: "conversation" as const,
    date: "2026-09-27", rawText: loaded.languageNodes[0].expression };
  const added = saveExtraction(loaded, [{ ...loaded.languageNodes[0], id: "en-copy", language: "en" }], englishSource).data;
  assert.equal(added.languageNodes.filter(n => n.expression === loaded.languageNodes[0].expression).length, 2);
  assert.equal(languageView(added, "en").sources.length, 1);
  assert.equal(languageView(added, "en").languageNodes.length, 1);
  assert.equal(languageView(added, "ja").sources.length, 1);
  assert.ok(languageView(added, "en").languageEdges.every(edge => edge.source === "en-copy" || edge.target === "en-copy"));
  assert.equal(storage.save(added), true);
  const reloaded = storage.load().data;
  assert.equal(languageView(reloaded, "en").sources[0].language, "en");
  assert.equal(languageView(reloaded, "en").languageNodes[0].language, "en");
  const fragment = generateFragment({}, languageView(reloaded, "en"));
  assert.equal(fragment.content.some(line => line.text.includes("今日は")), false);
});

test("language detection distinguishes clear scripts and supports model detection of Latin text", async () => {
  assert.equal(guessLanguage("今日は日本語を話します。分かりますか。 ").code, "ja");
  assert.equal(guessLanguage("안녕하세요. 오늘은 한국어를 배우고 있어요.").code, "ko");
  assert.equal(guessLanguage("This is a short English conversation.").code, "und");
  let calls = 0;
  const fakeFetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    calls++;
    if (calls === 1) return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      primary: "en", languages: ["fr", "en"], confidence: "high",
    }) } }] }), { status: 200 });
    assert.ok(body.messages[0].content.includes("English（en）"));
    assert.ok(body.messages[0].content.includes("phrasal verbs"));
    assert.equal(JSON.parse(body.messages[1].content).targetLanguage, "en");
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
      summary: "讨论计划", groups: [], expressions: [{ expression: "work out", type: "collocation",
        meaning: "解决", contextLabels: ["讨论计划"], domainLabels: ["General"], functionLabels: ["解决问题"], sourceContext: "We can work out a plan." }],
    }) } }] }), { status: 200 });
  };
  const rawText = "We can work out a plan.";
  const detection = await requestLanguageDetection(rawText, "test-key", "deepseek-flash", fakeFetch as typeof fetch);
  assert.deepEqual(detection.languages, ["en", "fr"]);
  const analysis = await requestDeepSeek({ rawText, title: "Plan", sourceType: "conversation",
    targetLanguage: detection.primary, explanationLanguage: "zh" }, "test-key", "deepseek-flash", fakeFetch as typeof fetch);
  assert.equal(analysis.expressions[0].sourceContext, rawText);
  assert.equal(calls, 2);
});

test("other languages re-encounter actual source excerpts and rotate across materials", () => {
  let data = createSeed();
  const examples = [
    { id: "source-plan", title: "Plan discussion", rawText: "We can work out a plan. Let's take it step by step.",
      expression: "work out a plan", excerpt: "We can work out a plan." },
    { id: "source-chat", title: "Casual chat", rawText: "Take it easy today. We have plenty of time.",
      expression: "take it easy", excerpt: "Take it easy today." },
  ];
  for (const example of examples) {
    const node = { ...data.languageNodes[0], id: `node-${example.id}`, language: "en",
      expression: example.expression, sourceContext: example.excerpt, examples: [example.excerpt] };
    data = saveExtraction(data, [node], { id: example.id, language: "en", title: example.title,
      type: "conversation", date: "2026-09-28", rawText: example.rawText }).data;
  }
  const english = languageView(data, "en");
  const fragments = archiveFragments(english);
  assert.equal(fragments.length, 2);
  assert.deepEqual(fragments.map(fragment => fragment.title), ["Plan discussion", "Casual chat"]);
  assert.ok(fragments.every(fragment => fragment.expressionIds.length > 0));
  assert.ok(fragments.every(fragment => fragment.content.every(line =>
    english.sources.some(source => source.id === fragment.sourceId && source.rawText.includes(line.text)))));
  assert.deepEqual(availableFragments(english).map(fragment => fragment.id), fragments.map(fragment => fragment.id));
  assert.equal(fragmentForScene(english, english.languageNodes[0].contextIds[0])?.source, "original");
});

test("review fragments skip material and sentences without saved expressions", () => {
  const data = createSeed();
  const plainSource = { id: "plain-source", language: "en", title: "Unmarked article", type: "article" as const,
    date: "2026-09-28", rawText: "First idea. Second idea!\nThird idea?" };
  data.sources.push(plainSource);
  assert.deepEqual(reviewSentences(plainSource.rawText), ["First idea.", "Second idea!", "Third idea?"]);
  const fragments = archiveFragments(languageView(data, "en"));
  assert.equal(fragments.length, 0);
  const node = { ...data.languageNodes[0], id: "late-expression", language: "en", expression: "Third idea",
    sourceContext: "Third idea?", examples: ["Third idea?"] };
  const linked = saveExtraction(createSeed(), [node], plainSource).data;
  const review = archiveFragments(languageView(linked, "en"));
  assert.equal(review.length, 1);
  assert.equal(review[0].content[0].text, "Third idea?");
  assert.deepEqual(review[0].expressionIds, ["late-expression"]);
});

test("deleting a material removes exclusive expressions and keeps shared expressions with their surviving source", () => {
  const original = createSeed();
  const sourceId = original.sources[0].id;
  const shared = original.languageNodes.find(node => node.sourceId === sourceId)!;
  const exclusive = original.languageNodes.find(node => node.sourceId === sourceId && node.id !== shared.id)!;
  const secondSource = { id: "second-source", language: "ja", title: "Second material",
    type: "conversation" as const, date: "2026-09-28", rawText: `別の場面で${shared.expression}を使う。` };
  const linked = saveExtraction(original, [{ ...shared, sourceContext: secondSource.rawText }], secondSource).data;
  const deleted = deleteMaterial(linked, sourceId);
  assert.ok(!deleted.sources.some(source => source.id === sourceId));
  assert.ok(!deleted.occurrences.some(item => item.sourceId === sourceId));
  assert.ok(!deleted.languageNodes.some(node => node.id === exclusive.id));
  assert.equal(deleted.languageNodes.find(node => node.id === shared.id)?.sourceId, secondSource.id);
  assert.equal(deleted.languageNodes.find(node => node.id === shared.id)?.sourceContext, secondSource.rawText);
  assert.ok(deleted.languageEdges.every(edge => edge.source !== exclusive.id && edge.target !== exclusive.id));
  assert.equal(deleteMaterial(deleted, "missing"), deleted);
});
