import { Fragment, type ReactNode } from 'react';

/** Just enough formatting for the assistant's replies: bold, italics, headings, bullets. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((raw, i) => {
        const line = raw.trim();
        if (!line) return null;
        if (/^-{3,}$/.test(line)) return <hr key={i} />;
        if (line.startsWith('#')) return <h4 key={i}>{inline(line.replace(/^#+\s*/, ''))}</h4>;
        if (/^[-*]\s/.test(line)) return <p key={i} className="bullet">{inline(line.slice(2))}</p>;
        return <p key={i}>{inline(line)}</p>;
      })}
    </>
  );
}
