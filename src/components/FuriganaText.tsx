import type { FuriganaPart, LanguageNode } from "../types/language.ts";
import { normalizeFurigana } from "../services/furigana.ts";

export function FuriganaText({ text, parts, reading, language = "ja" }: { text: string; parts?: FuriganaPart[]; reading?: string; language?: string }) {
  const valid = normalizeFurigana(parts, text);
  if (valid.length) return <span lang={language} className="furigana-text">{valid.map((part, index) => part.reading
    ? <ruby key={index}>{part.text}<rt>{part.reading}</rt></ruby>
    : <span key={index}>{part.text}</span>)}</span>;
  return <span lang={language} className="furigana-text">{text}{reading && <small className="reading-fallback">{reading}</small>}</span>;
}

export function AnnotatedJapanese({ text, nodes }: { text: string; nodes: LanguageNode[] }) {
  const readable = nodes.filter(node => node.expression && normalizeFurigana(node.furigana, node.expression).length);
  if (!readable.length) return <>{text}</>;
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let found: LanguageNode | undefined;
    let at = text.length;
    for (const node of readable) {
      const index = text.indexOf(node.expression, cursor);
      if (index >= 0 && (index < at || (index === at && node.expression.length > (found?.expression.length || 0)))) {
        found = node; at = index;
      }
    }
    if (!found) break;
    if (at > cursor) pieces.push(text.slice(cursor, at));
    pieces.push(<FuriganaText key={`${at}-${found.id}`} text={found.expression} parts={found.furigana}/>);
    cursor = at + found.expression.length;
  }
  if (cursor < text.length) pieces.push(text.slice(cursor));
  return <>{pieces}</>;
}
