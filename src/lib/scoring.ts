import { daysUntil, money } from "./dates";
import { keywords, wordHits } from "./text";
import type { Dimension, Fit, FitNotice, FitProfile } from "./types";

const WEIGHTS: Record<string, number> = {
  capabilities: 24,
  naics: 16,
  eligibility: 16,
  set_aside: 12,
  past_performance: 12,
  timeline: 10,
  scale: 10,
};

function band(score: number): string {
  if (score >= 80) return "Strong fit";
  if (score >= 65) return "Workable fit";
  if (score >= 45) return "Partial fit";
  return "Weak fit";
}

function codes(value: string): string[] {
  return [...value.matchAll(/\b\d{6}\b/g)].map((match) => match[0]);
}

function includesAny(text: string, needles: string[]): boolean {
  const hay = text.toLowerCase();
  return needles.some((needle) => hay.includes(needle));
}

function smallBusiness(profile: FitProfile): boolean {
  return includesAny(`${profile.socioeconomic} ${profile.certifications}`, [
    "small business",
    "8(a)",
    "8a",
    "sdvosb",
    "wosb",
    "edwosb",
    "hubzone",
    "vosb",
    "woman-owned",
    "service-disabled",
  ]);
}

function capabilityNote(hits: string[], total: number): { score: number; note: string } {
  if (total === 0) {
    return { score: 48, note: "The notice has too little narrative to judge capability overlap." };
  }
  if (hits.length >= 5) {
    return {
      score: 92,
      note: `Capability language overlaps the notice on ${hits.slice(0, 4).join(", ")}.`,
    };
  }
  if (hits.length >= 3) {
    return {
      score: 76,
      note: `Capability language overlaps the notice on ${hits.slice(0, 3).join(", ")}.`,
    };
  }
  if (hits.length >= 1) {
    return {
      score: 52,
      note: `Only light capability overlap, on ${hits.join(", ")}.`,
    };
  }
  return { score: 28, note: "The capability statement does not use the notice's distinctive terms." };
}

function naicsDimension(profile: FitProfile, notice: FitNotice): Dimension {
  const left = codes(profile.naics);
  const right = codes(notice.naics);
  let score = 60;
  let note = "The notice does not list a NAICS code, so industry fit is judged from the narrative.";
  if (left.length === 0 && right.length > 0) {
    score = 40;
    note = `The notice lists NAICS ${right.join(", ")}, and the profile has no NAICS yet.`;
  } else if (left.length > 0 && right.length === 0) {
    score = 60;
    note = "The notice does not list a NAICS code. The profile lists " + left.join(", ") + ".";
  } else if (left.length > 0 && right.length > 0) {
    const exact = left.filter((code) => right.includes(code));
    const four = left.filter((code) => right.some((item) => item.slice(0, 4) === code.slice(0, 4)));
    const two = left.filter((code) => right.some((item) => item.slice(0, 2) === code.slice(0, 2)));
    if (exact.length > 0) {
      score = 100;
      note = `NAICS ${exact.join(", ")} on the profile matches the notice.`;
    } else if (four.length > 0) {
      score = 74;
      note = `NAICS ${left.join(", ")} is in the same industry group as ${right.join(", ")}.`;
    } else if (two.length > 0) {
      score = 48;
      note = `NAICS ${left.join(", ")} shares only a sector with ${right.join(", ")}.`;
    } else {
      score = 22;
      note = `The notice asks for NAICS ${right.join(", ")}, and the profile lists ${left.join(", ")}.`;
    }
  }
  return { key: "naics", label: "NAICS", score, note };
}

function eligibilityDimension(profile: FitProfile, notice: FitNotice): Dimension {
  const text = notice.eligibility.toLowerCase();
  const entity = profile.entityType.toLowerCase();
  const socio = `${profile.socioeconomic} ${profile.certifications}`.toLowerCase();
  let score = 58;
  let note = "Eligibility does not clearly include or exclude this entity type.";
  if (!text.trim()) {
    score = 62;
    note = "Eligibility is not stated on the notice.";
  } else if (/for[- ]profit/.test(text) && /nonprofit/.test(text)) {
    score = 84;
    note = "The notice accepts both for-profit and nonprofit applicants.";
  } else if (/unrestricted|all eligible applicants|open to all/.test(text)) {
    score = 84;
    note = "Eligibility is written broadly enough for this entity type.";
  } else if (/nonprofit|501\(c\)/.test(text) && entity.includes("nonprofit")) {
    score = 94;
    note = "The notice is open to nonprofits, which matches the profile.";
  } else if (/nonprofit|501\(c\)/.test(text) && !entity.includes("nonprofit") && !/for[- ]profit|small business/.test(text)) {
    score = 34;
    note = "The notice emphasizes nonprofit applicants, and this profile is not a nonprofit.";
  } else if (/institution of higher|universit|college/.test(text) && entity.includes("university")) {
    score = 95;
    note = "The notice is aimed at higher-education institutions, which matches the profile.";
  } else if (/small business/.test(text) && smallBusiness(profile)) {
    score = 92;
    note = "The notice is open to small businesses, which matches the profile.";
  } else if (/for[- ]profit|commercial/.test(text) && entity.includes("for-profit")) {
    score = 86;
    note = "The notice accepts for-profit applicants, which matches the profile.";
  } else if (/state government|local government|tribal/.test(text) && entity.includes("government")) {
    score = 90;
    note = "The notice is aimed at government applicants, which matches the profile.";
  } else if (/8\(a\)|sdvosb|hubzone|wosb|service-disabled|woman-owned/.test(text) && includesAny(socio, ["8(a)", "sdvosb", "hubzone", "wosb", "service-disabled", "woman"])) {
    score = 88;
    note = "Eligibility language lines up with the socioeconomic status on the profile.";
  }
  return { key: "eligibility", label: "Eligibility", score, note };
}

function setAsideDimension(profile: FitProfile, notice: FitNotice): Dimension {
  const text = notice.setAside.toLowerCase();
  const socio = `${profile.socioeconomic} ${profile.certifications}`.toLowerCase();
  let score = 70;
  let note = "No set-aside is stated.";
  if (!text.trim() || /none|unrestricted|full and open/.test(text)) {
    score = 78;
    note = "No restrictive set-aside is stated.";
  } else if (/service-disabled|sdvosb/.test(text)) {
    score = /sdvosb|service-disabled/.test(socio) ? 96 : 28;
    note = score > 50
      ? "The set-aside is service-disabled veteran-owned small business, which matches the profile."
      : "The set-aside is service-disabled veteran-owned small business, which the profile does not claim.";
  } else if (/8\(a\)|8a/.test(text)) {
    score = /8\(a\)|8a/.test(socio) ? 96 : 30;
    note = score > 50
      ? "The set-aside is 8(a), which matches the profile."
      : "The set-aside is 8(a), which the profile does not claim.";
  } else if (/hubzone/.test(text)) {
    score = socio.includes("hubzone") ? 96 : 30;
    note = score > 50
      ? "The set-aside is HUBZone, which matches the profile."
      : "The set-aside is HUBZone, which the profile does not claim.";
  } else if (/edwosb|wosb|woman/.test(text)) {
    score = /wosb|woman/.test(socio) ? 94 : 34;
    note = score > 50
      ? "The set-aside is woman-owned small business, which matches the profile."
      : "The set-aside is woman-owned small business, which the profile does not claim.";
  } else if (/vosb|veteran/.test(text)) {
    score = /vosb|veteran|sdvosb|service-disabled/.test(socio) ? 90 : 32;
    note = score > 50
      ? "The set-aside is veteran-owned, which matches the profile."
      : "The set-aside is veteran-owned, which the profile does not claim.";
  } else if (/small business/.test(text)) {
    score = smallBusiness(profile) ? 90 : 36;
    note = score > 50
      ? "The set-aside is total small business, which matches the profile."
      : "The set-aside is total small business, which the profile does not claim.";
  } else if (/nonprofit/.test(text)) {
    score = profile.entityType.toLowerCase().includes("nonprofit") ? 94 : 30;
    note = score > 50
      ? "The notice is limited to nonprofits, which matches the profile."
      : "The notice is limited to nonprofits, which this profile is not.";
  }
  return { key: "set_aside", label: "Set-aside", score, note };
}

function pastDimension(profile: FitProfile, terms: string[]): Dimension {
  if (profile.pastPerformance.trim().length < 40) {
    return {
      key: "past_performance",
      label: "Past performance",
      score: 35,
      note: "Past performance on the profile is too short to judge relevance.",
    };
  }
  const hits = wordHits(terms, profile.pastPerformance);
  if (hits.length >= 4) {
    return {
      key: "past_performance",
      label: "Past performance",
      score: 90,
      note: `Past performance overlaps the notice on ${hits.slice(0, 4).join(", ")}.`,
    };
  }
  if (hits.length >= 2) {
    return {
      key: "past_performance",
      label: "Past performance",
      score: 72,
      note: `Past performance overlaps the notice on ${hits.join(", ")}.`,
    };
  }
  if (hits.length === 1) {
    return {
      key: "past_performance",
      label: "Past performance",
      score: 55,
      note: `Past performance mentions ${hits[0]}, with little else in common with the notice.`,
    };
  }
  return {
    key: "past_performance",
    label: "Past performance",
    score: 30,
    note: "Recorded past performance does not overlap the notice language.",
  };
}

function timelineDimension(notice: FitNotice, today: string): Dimension {
  const days = daysUntil(notice.closesOn, today);
  if (days == null) {
    return {
      key: "timeline",
      label: "Timeline",
      score: 64,
      note: "No close date is listed, so this is treated as a forecast or an open notice.",
    };
  }
  if (days < 0) {
    return { key: "timeline", label: "Timeline", score: 20, note: "The close date has passed." };
  }
  if (days <= 7) {
    return {
      key: "timeline",
      label: "Timeline",
      score: 38,
      note: `The close date leaves ${days} days, which compresses drafting and review.`,
    };
  }
  if (days <= 20) {
    return {
      key: "timeline",
      label: "Timeline",
      score: 62,
      note: `The close date leaves ${days} days, a tight capture sprint.`,
    };
  }
  if (days <= 75) {
    return {
      key: "timeline",
      label: "Timeline",
      score: 92,
      note: `The close date leaves ${days} days, enough for a standard capture sprint.`,
    };
  }
  return {
    key: "timeline",
    label: "Timeline",
    score: 80,
    note: `The close date leaves ${days} days, a long planning window.`,
  };
}

function scaleDimension(profile: FitProfile, notice: FitNotice): Dimension {
  if (notice.awardCeiling == null) {
    return { key: "scale", label: "Scale", score: 68, note: "No award ceiling is listed." };
  }
  if (profile.annualRevenue <= 0) {
    return {
      key: "scale",
      label: "Scale",
      score: 60,
      note: "No annual revenue is on the profile, so scale is unjudged.",
    };
  }
  const ceiling = money(notice.awardCeiling);
  const revenue = money(profile.annualRevenue);
  if (notice.awardCeiling <= profile.annualRevenue * 1.5) {
    return {
      key: "scale",
      label: "Scale",
      score: 90,
      note: `The ceiling of ${ceiling} is within range of recorded revenue of ${revenue}.`,
    };
  }
  if (notice.awardCeiling <= profile.annualRevenue * 4) {
    return {
      key: "scale",
      label: "Scale",
      score: 74,
      note: `The ceiling of ${ceiling} is larger than recorded revenue of ${revenue}, and still a plausible prime or major sub role.`,
    };
  }
  return {
    key: "scale",
    label: "Scale",
    score: 42,
    note: `The ceiling of ${ceiling} is large relative to recorded revenue of ${revenue}, so teaming or a narrower role may be required.`,
  };
}

export function scoreFit(profile: FitProfile, notice: FitNotice, today?: string): Fit {
  const day = today ?? new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const terms = keywords(`${notice.title} ${notice.description} ${notice.eligibility}`, 8);
  const capability = capabilityNote(
    wordHits(terms, `${profile.capabilities} ${profile.summary}`),
    terms.length,
  );
  const dimensions: Dimension[] = [
    { key: "capabilities", label: "Capabilities", score: capability.score, note: capability.note },
    naicsDimension(profile, notice),
    eligibilityDimension(profile, notice),
    setAsideDimension(profile, notice),
    pastDimension(profile, terms),
    timelineDimension(notice, day),
    scaleDimension(profile, notice),
  ];
  const narrative = `${profile.summary} ${profile.capabilities} ${profile.pastPerformance}`.trim();
  const provisional = narrative.length < 160;
  let score = Math.round(
    dimensions.reduce((sum, dimension) => sum + dimension.score * WEIGHTS[dimension.key], 0) / 100,
  );
  if (provisional) score = Math.round(score * 0.75);
  score = Math.max(0, Math.min(100, score));
  const ranked = [...dimensions].sort((a, b) => b.score - a.score);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];
  const agency = notice.agency.trim() || "the issuing agency";
  const label = provisional ? `Provisional ${band(score).toLowerCase()}` : band(score);
  let summary = `${label} (${score}) for ${profile.name} against "${notice.title}" from ${agency}. ${strongest.note}`;
  if (weakest.key !== strongest.key && weakest.score < 70) summary += ` ${weakest.note}`;
  if (provisional) {
    summary += " The profile narrative is still thin, so this score should be read again after documents are intake.";
  }
  return { score, summary, dimensions, provisional };
}
