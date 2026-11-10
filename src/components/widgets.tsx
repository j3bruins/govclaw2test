import { closeLabel, prettyDate, prettyWhen } from "@/lib/dates";
import { phaseLabel, portalLabel, statusLabel } from "@/lib/text";
import type { Fit } from "@/lib/types";

export function Notice({ value }: { value?: string }) {
  if (!value) return null;
  return (
    <p className="banner" role="status">
      {value}
    </p>
  );
}

export function scoreClass(score: number): string {
  if (score >= 80) return "high";
  if (score >= 65) return "mid";
  return "low";
}

export function Score({ score }: { score: number }) {
  return <b className={`score ${scoreClass(score)}`}>{score}</b>;
}

export function FitBlock({ fit, today, closesOn }: { fit: Fit; today?: string; closesOn?: string | null }) {
  return (
    <div>
      <p className="summary">{fit.summary}</p>
      {closesOn !== undefined && today ? <p className="muted">{closeLabel(closesOn, today)} · {prettyDate(closesOn)}</p> : null}
      <div className="dimensions">
        {fit.dimensions.map((dimension) => (
          <div className="dimension" key={dimension.key}>
            <span>{dimension.label}</span>
            <b className={scoreClass(dimension.score)}>{dimension.score}</b>
            <span>{dimension.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Pill({ value }: { value: string }) {
  const tone = value === "pursuing" || value === "met" || value === "done" || value === "capture"
    ? "good"
    : value === "passed" || value === "gap" || value === "low"
      ? "warn"
      : value === "agent"
        ? "agent"
        : "";
  return <span className={`pill ${tone}`}>{statusLabel(value)}</span>;
}

export function When({ value }: { value: string | Date }) {
  return <time dateTime={String(value)}>{prettyWhen(value)}</time>;
}

export function Phase({ value }: { value: string }) {
  return <span className="pill">{phaseLabel(value)}</span>;
}

export function Portal({ value }: { value: string }) {
  return <span className="pill">{portalLabel(value)}</span>;
}

export function Pager({ page, pages, total, href }: { page: number; pages: number; total: number; href: (page: number) => string }) {
  return (
    <div className="pager">
      {page > 1 ? <a className="button secondary" href={href(page - 1)}>Previous</a> : <span />}
      <span className="muted">Page {page} of {pages} · {total.toLocaleString("en-US")} customers</span>
      {page < pages ? <a className="button secondary" href={href(page + 1)}>Next</a> : <span />}
    </div>
  );
}
