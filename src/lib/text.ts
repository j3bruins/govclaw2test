export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

export function clip(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function safeId(value: unknown): string {
  const text = String(value ?? "");
  if (!/^[a-z0-9_-]{1,80}$/i.test(text)) {
    throw new Error("Unknown record");
  }
  return text;
}

export function safeBack(value: unknown, fallback: string): string {
  const text = String(value ?? "");
  if (!text.startsWith("/") || text.startsWith("//") || text.includes("\\")) return fallback;
  return text;
}

export function withNotice(path: string, notice: string): string {
  const [base, query] = path.split("?");
  const params = new URLSearchParams(query ?? "");
  params.set("notice", notice);
  return `${base}?${params.toString()}`;
}

export function num(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function nullableNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

const STOP = new Set(
  `the and for with from that this shall must required provide provides provided including into over under than then your their its are was were will would should could about within without during before after where which while such other another each every any all not but can may proposal applicant application grant contract contractor services service program programs federal government agency department support supporting work works task tasks area areas using used use per via onto also more most both only own been being have has had they them our you your across defined stated following above below through between against public state states local national community based system systems organization organizations`.split(
    /\s+/,
  ),
);

export function keywords(text: string, limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().match(/[a-z][a-z0-9-]{4,}/g) ?? []) {
    const word = raw.replace(/^-+|-+$/g, "");
    if (word.length < 5 || STOP.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

export function wordHits(words: string[], haystack: string): string[] {
  const hay = haystack.toLowerCase();
  return words.filter((word) => new RegExp(`\\b${word.replace(/-/g, "\\-")}\\b`).test(hay));
}

export function portalLabel(portal: string): string {
  if (portal === "grants.gov") return "Grants.gov";
  if (portal === "sam.gov") return "SAM.gov";
  if (portal === "sample") return "Sample notice";
  return portal;
}

export function instrumentLabel(instrument: string): string {
  if (instrument === "cooperative") return "Cooperative agreement";
  if (instrument === "grant") return "Grant";
  if (instrument === "contract") return "Contract";
  return instrument || "Notice";
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    prospect: "Prospect",
    active: "Active",
    capture: "In capture",
    watching: "Watching",
    pursuing: "Pursuing",
    passed: "Passed",
    untracked: "Not tracked",
    open: "Open",
    met: "Met",
    gap: "Gap",
    waived: "Waived",
    backlog: "Backlog",
    in_progress: "In progress",
    review: "In review",
    done: "Done",
    drafting: "With GovClaw",
    client_review: "With the client",
    final: "Final",
    submitted: "Submitted",
    paused: "Paused",
    human: "Human",
    agent: "Desk agent",
    person: "Person",
    key: "API key",
    unsigned: "Unsigned",
    govclaw: "GovClaw",
    client: "Client",
  };
  return labels[status] ?? status;
}

export function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    eligibility: "Eligibility",
    technical: "Technical",
    past_performance: "Past performance",
    staffing: "Staffing",
    pricing: "Pricing",
    review: "Review",
    submission: "Submission",
  };
  return labels[phase] ?? phase;
}
