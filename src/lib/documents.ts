const SAFE_MEDIA_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/octet-stream",
]);

export function safeMediaType(claimed: unknown): string {
  const raw = String(claimed ?? "").split(";")[0].trim().toLowerCase();
  return SAFE_MEDIA_TYPES.has(raw) ? raw : "application/octet-stream";
}

/** Best-effort PDF literal-string reader. One forward pass, so a crafted file cannot stall the desk. */
export function pdfText(bytes: Buffer): string {
  const raw = bytes.toString("latin1");
  const parts: string[] = [];
  let i = 0;
  while (i < raw.length && parts.length < 400) {
    if (raw[i] !== "(") {
      i += 1;
      continue;
    }
    let inner = "";
    let j = i + 1;
    let closed = false;
    while (j < raw.length && inner.length < 2000) {
      const ch = raw[j];
      if (ch === "\\") {
        const next = raw[j + 1];
        if (next === undefined) break;
        inner += next === "n" ? "\n" : next === "r" ? "\r" : next === "t" ? "\t" : next;
        j += 2;
        continue;
      }
      if (ch === ")") {
        closed = true;
        j += 1;
        break;
      }
      inner += ch;
      j += 1;
    }
    if (closed && inner.length >= 4 && /[A-Za-z]{3,}/.test(inner)) parts.push(inner);
    i = Math.max(j, i + 1);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 200_000);
}
