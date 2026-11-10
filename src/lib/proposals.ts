import { daysUntil, prettyDate } from "./dates";
import { extractRequirements } from "./requirements";
import { scoreFit } from "./scoring";
import type { FitNotice, FitProfile } from "./types";

export type DraftInput = {
  profile: FitProfile & { legalName: string; city: string; state: string };
  notice: FitNotice & { number: string };
  winThemes: string;
  approachNotes: string;
  constraints: string;
  team: { name: string; kind: string; role: string }[];
  today: string;
};

const WATCH = ["FedRAMP", "NIST 800-171", "CMMI", "ISO 9001", "ISO 27001", "facility clearance", "top secret"];

function quote(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed
    .split(/\n+/)
    .map((line) => `> ${line}`)
    .join("\n");
}

function gapsFor(input: DraftInput, fitScore: number): string[] {
  const corpus = `${input.profile.certifications} ${input.profile.capabilities} ${input.profile.pastPerformance}`.toLowerCase();
  const noticeText = `${input.notice.description} ${input.notice.eligibility} ${input.notice.setAside}`.toLowerCase();
  const gaps = WATCH.filter((word) => noticeText.includes(word.toLowerCase()) && !corpus.includes(word.toLowerCase()))
    .map((word) => `${word} appears in the notice and is not on the company profile.`);
  const days = daysUntil(input.notice.closesOn, input.today);
  if (days != null && days >= 0 && days < 14) {
    gaps.push(`The close date leaves ${days} days. Freeze an outline immediately and cut optional sections.`);
  }
  if (days != null && days < 0) gaps.push("The close date has passed. Confirm whether a late submission is even possible before writing further.");
  if (input.profile.pastPerformance.trim().length < 40) {
    gaps.push("Past performance on the profile is too thin to support a volume. Collect writeups from the customer.");
  }
  if (fitScore < 45) {
    gaps.push("The fit score is weak. Decide whether to pursue, team, or pass before a full draft.");
  }
  if (/page limit/.test(noticeText)) {
    gaps.push("The notice states a page limit. Count pages after formatting, not in the editor.");
  }
  if (gaps.length === 0) gaps.push("No automatic gap was detected. A human reviewer still needs to read the notice against the profile.");
  return gaps;
}

export function draftProposal(input: DraftInput): string {
  const fit = scoreFit(input.profile, input.notice, input.today);
  const requirements = extractRequirements(`${input.notice.description}\n${input.notice.eligibility}`).slice(0, 8);
  const capability = input.profile.capabilities.toLowerCase();
  const crosswalk = requirements.length
    ? requirements
        .map((item) => {
          const token = item.detail
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .find((word) => word.length > 6 && capability.includes(word));
          const response = token
            ? `Profile language covers "${token}". Point the volume at the capability statement.`
            : "No direct profile language yet. Draft a response or mark a gap.";
          return `- ${item.detail}\n  Response: ${response}`;
        })
        .join("\n")
    : "- No shall or must statements were detected in the stored notice text. Read the source document before relying on this crosswalk.";
  const humans = input.team.filter((member) => member.kind === "human");
  const agents = input.team.filter((member) => member.kind === "agent");
  const team = input.team.length
    ? [
        humans.length ? `Humans: ${humans.map((member) => `${member.name} (${member.role})`).join("; ")}.` : "No human is assigned on the pod.",
        agents.length ? `Desk agents: ${agents.map((member) => `${member.name} (${member.role})`).join("; ")}.` : "No desk agent is assigned on the pod.",
      ].join("\n\n")
    : "No capture pod is assigned yet. Assign one before staffing is written into the final volume.";
  const gaps = gapsFor(input, fit.score);
  const place = [input.profile.city, input.profile.state].filter(Boolean).join(", ");

  return [
    `# ${input.notice.title}`,
    "",
    `Prepared for ${input.profile.legalName}${place ? `, ${place}` : ""}.`,
    `${input.notice.agency} · ${input.notice.number || "No opportunity number"} · ${prettyDate(input.notice.closesOn)}.`,
    "",
    "This draft uses only the company profile, customer inputs, and the notice text stored on the desk. It does not invent past performance, rates, or authorizations.",
    "",
    "## Executive summary",
    "",
    `${input.profile.legalName} proposes to perform the work described in "${input.notice.title}." ${fit.summary}`,
    "",
    input.profile.summary.trim() || "A company summary has not been written yet.",
    "",
    "## Understanding of the work",
    "",
    input.notice.description.trim() || "The notice description has not been stored yet. Upload the funding announcement or solicitation before editing this section.",
    "",
    input.notice.eligibility.trim() ? `Eligibility as stored: ${input.notice.eligibility.trim()}` : "Eligibility text has not been stored.",
    "",
    "## Approach",
    "",
    input.profile.capabilities.trim() || "Capabilities have not been captured yet.",
    "",
    "Customer approach notes:",
    "",
    quote(input.approachNotes, "None recorded yet."),
    "",
    "## Organization and past performance",
    "",
    input.profile.pastPerformance.trim() || "Past performance has not been captured yet.",
    "",
    input.profile.certifications.trim()
      ? `Certifications and status on the profile: ${input.profile.certifications.trim()}.`
      : "No certifications are recorded.",
    "",
    "## Win themes",
    "",
    quote(input.winThemes, "None recorded yet."),
    "",
    "## Constraints from the customer",
    "",
    quote(input.constraints, "None recorded."),
    "",
    "## Compliance crosswalk",
    "",
    crosswalk,
    "",
    "## Gaps to close before submission",
    "",
    gaps.map((gap) => `- ${gap}`).join("\n"),
    "",
    "## Team on this capture",
    "",
    team,
    "",
    "## Submission timing",
    "",
    input.notice.closesOn
      ? `The stored close date is ${prettyDate(input.notice.closesOn)}. Work backward from that date on the checklist.`
      : "No close date is stored. Treat the notice as a forecast until a date is confirmed.",
    "",
  ].join("\n");
}

export type DiffLine = { type: "same" | "add" | "del"; text: string };

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.replaceAll("\r\n", "\n").split("\n");
  const b = after.replaceAll("\r\n", "\n").split("\n");
  if (a.length * b.length > 80_000) {
    return [{ type: "same", text: "These versions are too long to compare line by line. Read them separately." }];
  }
  const next = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      next[i][j] = a[i] === b[j] ? next[i + 1][j + 1] + 1 : Math.max(next[i + 1][j], next[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] });
      i += 1;
      j += 1;
    } else if (next[i + 1][j] >= next[i][j + 1]) {
      out.push({ type: "del", text: a[i] });
      i += 1;
    } else {
      out.push({ type: "add", text: b[j] });
      j += 1;
    }
  }
  while (i < a.length) out.push({ type: "del", text: a[i++] });
  while (j < b.length) out.push({ type: "add", text: b[j++] });
  return out;
}
