import { addDays, daysUntil, shiftWeekday } from "./dates";
import type { RequirementDraft } from "./types";

const PHASE_ORDER = [
  "eligibility",
  "technical",
  "past_performance",
  "staffing",
  "pricing",
  "review",
  "submission",
];

export function phaseFor(text: string): string {
  const value = text.toLowerCase();
  if (/eligib|sam\.gov|uei|registration|set-aside|set aside/.test(value)) return "eligibility";
  if (/past performance|relevant experience|prior award/.test(value)) return "past_performance";
  if (/key personnel|resume|staffing|technical lead|personnel/.test(value)) return "staffing";
  if (/price|pricing|budget|cost share|cost|sf-424a|sf424a/.test(value)) return "pricing";
  if (/review|compliance matrix|color team|quality/.test(value)) return "review";
  if (/submit|deadline|closing|portal|package/.test(value)) return "submission";
  return "technical";
}

export function extractRequirements(text: string): { title: string; detail: string }[] {
  const chunks = text
    .split(/\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/));
  const items: { title: string; detail: string }[] = [];
  const seen = new Set<string>();
  for (const raw of chunks) {
    const sentence = raw.replace(/\s+/g, " ").trim();
    if (sentence.length < 40 || sentence.length > 420) continue;
    if (!/\b(shall|must|required to|no later than|page limit)\b/i.test(sentence)) continue;
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      title: sentence.length > 110 ? `${sentence.slice(0, 107).trimEnd()}…` : sentence,
      detail: sentence,
    });
    if (items.length >= 18) break;
  }
  return items;
}

function standardItems(instrument: string): { phase: string; title: string; detail: string }[] {
  if (instrument === "contract") {
    return [
      ["eligibility", "Confirm set-aside and NAICS eligibility", "Match the solicitation set-aside and NAICS to the company profile before any drafting starts."],
      ["eligibility", "Confirm SAM.gov registration is active", "The offeror must have an active SAM.gov registration and a current UEI at submission."],
      ["technical", "Acknowledge the solicitation and amendments", "List every amendment and confirm the proposal responds to the amended PWS."],
      ["technical", "Draft the technical volume against the PWS", "Every shall statement in the performance work statement needs a response in the technical volume."],
      ["staffing", "Draft staffing and key personnel", "Name key personnel, attach resumes, and show availability for the period of performance."],
      ["past_performance", "Draft the past performance volume", "Select relevant efforts and request questionnaires early enough to arrive before review."],
      ["pricing", "Draft the price volume", "Build labor categories, hours, and other direct costs from the PWS, with assumptions written down."],
      ["review", "Map each shall statement into a compliance matrix", "A matrix row is the handoff between the notice and the volume page that answers it."],
      ["review", "Run color-team review", "Reviewers read the matrix, the volumes, and the open gaps with enough time to revise."],
      ["submission", "Submit through the stated portal", "Package the files in the required format and submit before the closing time, with a day of margin."],
    ].map(([phase, title, detail]) => ({ phase, title, detail }));
  }
  return [
    ["eligibility", "Confirm entity eligibility against the notice", "Check applicant type, location limits, and any cost-share rule against the company profile."],
    ["eligibility", "Confirm UEI and SAM.gov registration", "SAM.gov must be active on the date of submission. Start renewal early if the registration is near expiry."],
    ["pricing", "Complete SF-424", "The authorized representative named on the profile signs the application for federal assistance."],
    ["pricing", "Complete SF-424A and the budget narrative", "Line items in the budget narrative have to match SF-424A and the approach."],
    ["pricing", "Complete SF-LLL", "Disclose lobbying activity or confirm that none applies."],
    ["technical", "Draft the project narrative", "Follow the notice section order and stop at the stated page limit."],
    ["technical", "Collect letters of commitment", "Partners named in the approach need letters that state the role and the resource they commit."],
    ["review", "Internal compliance review", "A reviewer who did not draft the narrative checks required forms, attachments, and page limits."],
    ["submission", "Authorized representative submits before the deadline", "Submit in the portal named by the notice, then save the confirmation."],
  ].map(([phase, title, detail]) => ({ phase, title, detail }));
}

export function buildChecklist(input: {
  instrument: string;
  description: string;
  eligibility: string;
  closesOn: string | null;
  number: string;
  today: string;
}): RequirementDraft[] {
  const standards = standardItems(input.instrument);
  const extracted = extractRequirements(`${input.description}\n${input.eligibility}`).map((item) => ({
    phase: phaseFor(item.detail),
    title: item.title,
    detail: item.detail,
    sourceRef: input.number ? `Notice ${input.number}` : "Notice text",
  }));
  const covered = standards.map((item) => item.title.toLowerCase());
  const extras = extracted.filter((item) => !covered.some((title) => item.detail.toLowerCase().includes(title.slice(0, 24).toLowerCase())));
  const merged = [
    ...standards.map((item) => ({ ...item, sourceRef: "Desk standard" })),
    ...extras,
  ];
  const ordered = merged
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase) || a.index - b.index);

  const close = input.closesOn && daysUntil(input.closesOn, input.today) != null
    ? input.closesOn
    : addDays(input.today, 21);
  const overdue = input.closesOn != null && (daysUntil(input.closesOn, input.today) ?? 0) < 0;
  const span = Math.max(1, daysUntil(close, input.today) ?? 1);

  return ordered.map((item, index) => {
    let due = close;
    if (!overdue) {
      const offset = Math.round(((index + 1) / (ordered.length + 1)) * span);
      due = addDays(input.today, Math.min(span, Math.max(1, offset)));
      if (index === ordered.length - 1 || item.phase === "submission" && index > ordered.length - 3) {
        due = close;
      }
      due = shiftWeekday(due, close);
    }
    return {
      phase: item.phase,
      title: item.title,
      detail: item.detail,
      sourceRef: item.sourceRef,
      dueOn: due,
    };
  });
}
