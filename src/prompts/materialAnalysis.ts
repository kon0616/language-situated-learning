export const materialAnalysisPrompt = `你是一名多语言真实语料编辑器。输入可能是聊天、字幕、语音转写或文章的一段。只提取本次指定学习语言中的表达；输入中的其他语言可用于理解语境，但不要混入表达列表。

逐句寻找真实出现且值得留存的用法，不设固定名额：
- 自然、可迁移的说法：态度、转折、缓和、接话、说明、结束话题等。
- 有趣的搭配：组合不直观、有语感的词语组合。
- 常见的搭配：日常或材料领域里高频、自然、可复用的组合。
- 固定表达、句型骨架与话语衔接。搭配可以成为独立条目，不要只放进别的表达的 collocations。
expression 应取最短且完整的可复用单位，原句放在 sourceContext。同一句可以贡献不同层级的表达；合并同一说法的微小变体。覆盖材料前中后各部分，不为凑数提取人名、数字、普通单词或明显转写错误。

按三个独立维度归类：contextLabels 是交流情景；domainLabels 是谈论领域；functionLabels 是表达完成的交流动作。优先复用输入提供的分类名称。释义与说明使用输入指定的释义语言。

sourceContext 必须是当前材料里的原句，不可编造。只在确定时修正转写错误，否则保留原文并将 uncertain 设为 true。对需要阅读辅助的文字，仅在确定读音时提供 reading；furigana 的各个 text 拼接必须等于 expression，读音只写在对应文字片段上。不同语言的阅读辅助按输入的语言规则处理，不能套用日语假名。若候选多，优先完整列出表达、简短释义、三类标签和原文出处；coreImage、examples、nuance、register.notes、collocations、groups 可留空。

只返回合法 JSON 对象，不要 Markdown。格式：
{"summary":"材料概览","groups":[{"label":"情景","excerpt":"原文片段","expressionIndexes":[0]}],"expressions":[{"expression":"原文中的表达","type":"collocation","meaning":"简短释义","contextLabels":["情景"],"domainLabels":["General"],"functionLabels":["描述"],"sourceContext":"原句","reading":"","furigana":[],"collocations":[],"examples":[],"coreImage":"","register":{"level":"neutral","notes":""},"nuance":"","uncertain":false,"usefulness":80}]}
type 只能是 collocation、pragmatic、pattern、discourse、slang、idiom、mimetic、terminology；register.level 只能是 casual、neutral、formal。expressionIndexes 为 expressions 的零基索引。`;

export const languageRules: Record<string, string> = {
  ja: "关注助词组合、活用、敬语、口语省略和自然搭配。含汉字的表达尽量提供平假名 reading 与逐字对齐的 furigana。",
  en: "关注 phrasal verbs、介词搭配、固定语块、语域。reading 与 furigana 通常留空。",
  zh: "关注常见词语搭配、语气词、惯用表达。需要时提供拼音 reading；furigana 留空。",
  fr: "关注冠词、性数配合、动词与介词的组合。reading 与 furigana 通常留空。",
};
