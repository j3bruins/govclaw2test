import assert from "node:assert/strict";
import test from "node:test";
import { diffLines, draftProposal } from "./proposals";
import type { FitNotice, FitProfile } from "./types";

const profile: FitProfile & { legalName: string; city: string; state: string } = {
  name: "Harbor & Pine Analytics",
  legalName: "Harbor & Pine Analytics LLC",
  entityType: "for-profit",
  socioeconomic: "WOSB",
  naics: "541511",
  summary: "Public health data firm in Seattle.",
  capabilities: "Builds surveillance data modernization and epidemiology dashboards.",
  pastPerformance: "Supported a state public health agency on surveillance dashboards from 2022 to 2025.",
  certifications: "WOSB, SAM.gov active",
  annualRevenue: 6_000_000,
  employeeCount: 40,
  city: "Seattle",
  state: "WA",
};

const notice: FitNotice & { number: string } = {
  title: "Public health surveillance data modernization",
  agency: "CDC",
  instrument: "cooperative",
  naics: "541511",
  setAside: "",
  description: "The recipient shall deploy epidemiology dashboards. A FedRAMP authorization should be stated. A page limit of 15 pages applies.",
  eligibility: "For-profit organizations may apply with a public health partner.",
  closesOn: "2026-12-26",
  awardCeiling: 3_000_000,
  number: "CDC-RFA-OE-26-0041",
};

test("draft quotes the profile and flags a missing authorization", () => {
  const body = draftProposal({
    profile,
    notice,
    winThemes: "Lead with dashboards.",
    approachNotes: "",
    constraints: "Do not invent contract numbers.",
    team: [{ name: "Mara Ellison", kind: "human", role: "Capture lead" }],
    today: "2026-11-10",
  });
  assert.match(body, /Harbor & Pine Analytics LLC/);
  assert.match(body, /epidemiology dashboards/);
  assert.match(body, /FedRAMP/);
  assert.match(body, /Do not invent contract numbers/);
  assert.doesNotMatch(body, /contract number \d/i);
});

test("line diff shows an added constraint", () => {
  const before = "Line one\nLine two";
  const after = "Line one\nLine two\nClient added a limit.";
  const diff = diffLines(before, after);
  assert.ok(diff.some((line) => line.type === "add" && line.text.includes("Client added")));
  assert.ok(diff.some((line) => line.type === "same" && line.text === "Line one"));
});
