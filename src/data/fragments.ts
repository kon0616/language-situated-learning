import type { LanguageFragment } from "../types/language.ts";

// Curated examples are written as coherent contexts, never assembled word by word.
export const fragmentSeed: LanguageFragment[] = [
  {id:"fragment-opinion",type:"dialogue",contextId:"social-opinion",title:"意见讨论",source:"generated",createdAt:"2026-09-25T00:00:00.000Z",expressionIds:["seed-0","seed-2","seed-1"],content:[
    {speaker:"A",text:"でも、それって本人の責任じゃない？"},
    {speaker:"B",text:"言いたいことは分かるんだけど、それだけで決めつけるのはちょっと違うと思う。",expressionIds:["seed-0","seed-2"]},
    {speaker:"A",text:"まあ、そういう意味では確かにそうかも。",expressionIds:["seed-1"]},
    {speaker:"B",text:"もう少し状況を聞いてから考えよう。"}
  ]},
  {id:"fragment-chat",type:"dialogue",contextId:"social-chat",title:"日常闲聊",source:"generated",createdAt:"2026-09-25T00:00:00.000Z",expressionIds:[],content:[
    {speaker:"A",text:"そういえば、週末は何してた？"},{speaker:"B",text:"久しぶりに友達と散歩してきたよ。"},{speaker:"A",text:"いいね。天気もよかったしね。"},{speaker:"B",text:"うん、気づいたら夕方まで話してた。"}
  ]},
  {id:"fragment-deescalation",type:"dialogue",contextId:"social-end",title:"暂停争论",source:"generated",createdAt:"2026-09-25T00:00:00.000Z",expressionIds:["seed-4","seed-5","seed-6"],content:[
    {speaker:"A",text:"このまま話しても水掛け論になる気がする。",expressionIds:["seed-4"]},
    {speaker:"B",text:"そうだね。その話は一旦置いといて、まずできることを整理しよう。",expressionIds:["seed-6"]},
    {speaker:"A",text:"うん。その上で落としどころを探すのがよさそう。",expressionIds:["seed-5"]},
    {speaker:"B",text:"明日、また落ち着いて話そう。"}
  ]},
  {id:"fragment-architecture",type:"short_text",contextId:"study-explain",domainId:"architecture-spatial",title:"空间评价",source:"generated",createdAt:"2026-09-25T00:00:00.000Z",expressionIds:["seed-9","seed-12","seed-10"],content:[
    {text:"この空間は、入口から奥まで視線が抜ける。",expressionIds:["seed-12"]},
    {text:"光の入り方で奥行きが出る一方、壁の位置によっては少し圧迫感がある。",expressionIds:["seed-9","seed-10"]}
  ]},
  {id:"fragment-work",type:"dialogue",contextId:"work-task",title:"工作沟通",source:"generated",createdAt:"2026-09-25T00:00:00.000Z",expressionIds:[],content:[
    {speaker:"A",text:"今日中に資料を確認できそうですか。"},{speaker:"B",text:"午前中に一度見て、気になる点をまとめます。"},{speaker:"A",text:"ありがとうございます。変更があれば先に教えてください。"},{speaker:"B",text:"分かりました。確認でき次第、共有します。"}
  ]}
];
