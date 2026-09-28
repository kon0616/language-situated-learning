import type { LanguageFragment, LanguageNode } from "../types/language";

function age(date: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
  return days === 0 ? "今天收藏" : `${days} 天前收藏`;
}
export default function LanguageFragmentView({ fragment, nodes, language, onOpen }: {
  fragment: LanguageFragment; nodes: LanguageNode[]; language?: string; onOpen: (id: string) => void;
}) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  return <div className="language-fragment" lang={language || nodes.find(n => fragment.expressionIds.includes(n.id))?.language || "ja"}>
    {fragment.content.map((line, lineIndex) => {
      const matches = (line.expressionIds || []).map(id => byId.get(id)).filter((n): n is LanguageNode => !!n)
        .flatMap(n => { const index = line.text.toLocaleLowerCase().indexOf(n.expression.toLocaleLowerCase()); return index < 0 ? [] : [{ n, index }]; })
        .sort((a, b) => a.index - b.index);
      const pieces: React.ReactNode[] = []; let cursor = 0;
      for (const { n, index } of matches) {
        if (index < cursor) continue;
        pieces.push(line.text.slice(cursor, index));
        pieces.push(<button key={n.id} lang={n.language || "ja"} className="fragment-highlight" title={age(n.createdAt)} onClick={() => onOpen(n.id)}>{line.text.slice(index, index + n.expression.length)}</button>);
        cursor = index + n.expression.length;
      }
      pieces.push(line.text.slice(cursor));
      return <p key={lineIndex}>{line.speaker && <span className="fragment-speaker">{line.speaker}</span>}{pieces}</p>;
    })}
  </div>;
}
