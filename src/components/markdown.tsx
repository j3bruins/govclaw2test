import { Fragment } from "react";

function inline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={`${keyPrefix}-${index}`}>{part}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: string) => {
    if (!list.length) return;
    blocks.push(
      <ul key={key}>
        {list.map((item, index) => (
          <li key={`${key}-${index}`}>{inline(item, `${key}-${index}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  lines.forEach((line, index) => {
    const key = `l${index}`;
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      return;
    }
    flush(`list-${index}`);
    if (!line.trim()) return;
    if (line.startsWith("# ")) blocks.push(<h1 key={key}>{inline(line.slice(2), key)}</h1>);
    else if (line.startsWith("## ")) blocks.push(<h2 key={key}>{inline(line.slice(3), key)}</h2>);
    else if (line.startsWith("### ")) blocks.push(<h3 key={key}>{inline(line.slice(4), key)}</h3>);
    else if (line.startsWith("> ")) blocks.push(<blockquote key={key}>{inline(line.slice(2), key)}</blockquote>);
    else blocks.push(<p key={key}>{inline(line, key)}</p>);
  });
  flush("list-end");
  return <div className="md">{blocks}</div>;
}
