import assert from "node:assert/strict";
import test from "node:test";
import { scoreFit } from "./scoring";
import type { FitNotice, FitProfile } from "./types";

const today = "2026-11-10";

const cyber: FitProfile = {
  name: "Northline Cyber Works",
  entityType: "for-profit",
  socioeconomic: "SDVOSB",
  naics: "541512",
  summary: "Civilian cybersecurity integrator.",
  capabilities: "Integrates zero trust controls, continuous diagnostics, vulnerability intake, and identity hygiene reporting.",
  pastPerformance: "Provided zero trust integration and continuous diagnostics, including vulnerability intake and identity hygiene reporting, for a civilian agency.",
  certifications: "SDVOSB, NIST 800-171",
  annualRevenue: 9_000_000,
  employeeCount: 50,
};

const workforce: FitProfile = {
  ...cyber,
  name: "Kindred Workforce Partners",
  entityType: "nonprofit",
  socioeconomic: "Nonprofit",
  naics: "611430",
  summary: "Employment training nonprofit.",
  capabilities: "Designs WIOA cohorts, apprenticeship case management, and employer partnerships.",
  pastPerformance: "Ran WIOA-aligned employment training and apprenticeship case management for a regional workforce board.",
  certifications: "501(c)(3)",
  annualRevenue: 4_000_000,
};

const notice: FitNotice = {
  title: "Continuous diagnostics and mitigation integration support",
  agency: "CISA",
  instrument: "contract",
  naics: "541512",
  setAside: "Service-disabled veteran-owned small business",
  description: "The contractor shall deploy continuous diagnostics, zero trust controls, vulnerability intake, and identity hygiene reporting.",
  eligibility: "Set aside for service-disabled veteran-owned small businesses.",
  closesOn: "2026-12-20",
  awardCeiling: 4_000_000,
};

test("cyber profile outscores an unrelated workforce profile on a cyber notice", () => {
  const strong = scoreFit(cyber, notice, today);
  const weak = scoreFit(workforce, notice, today);
  assert.ok(strong.score > weak.score + 15);
  assert.match(strong.summary, /Northline Cyber Works/);
  assert.match(strong.summary, /Continuous diagnostics/);
  assert.equal(strong.dimensions.length, 7);
});

test("a thin profile is marked provisional", () => {
  const thin = scoreFit({ ...cyber, summary: "Firm.", capabilities: "", pastPerformance: "" }, notice, today);
  assert.equal(thin.provisional, true);
  assert.match(thin.summary, /Provisional/);
});
