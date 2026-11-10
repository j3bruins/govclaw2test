export type FitProfile = {
  name: string;
  entityType: string;
  socioeconomic: string;
  naics: string;
  summary: string;
  capabilities: string;
  pastPerformance: string;
  certifications: string;
  annualRevenue: number;
  employeeCount: number;
};

export type FitNotice = {
  title: string;
  agency: string;
  instrument: string;
  naics: string;
  setAside: string;
  description: string;
  eligibility: string;
  closesOn: string | null;
  awardCeiling: number | null;
};

export type Dimension = {
  key: string;
  label: string;
  score: number;
  note: string;
};

export type Fit = {
  score: number;
  summary: string;
  dimensions: Dimension[];
  provisional: boolean;
};

export type RequirementDraft = {
  phase: string;
  title: string;
  detail: string;
  sourceRef: string;
  dueOn: string | null;
};

export type PortalHit = {
  portal: "grants.gov" | "sam.gov";
  externalId: string;
  number: string;
  title: string;
  agency: string;
  agencyCode: string;
  instrument: string;
  naics: string;
  setAside: string;
  postedOn: string | null;
  closesOn: string | null;
  awardCeiling: number | null;
  description: string;
  eligibility: string;
  url: string;
  partial: boolean;
};

export type PortalSearch = {
  hitCount: number;
  hits: PortalHit[];
  error?: string;
};
