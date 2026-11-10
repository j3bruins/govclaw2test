export type ProfilePatch = {
  field: string;
  value: string;
  replace: boolean;
};

const CERTS = [
  "8(a)",
  "HUBZone",
  "SDVOSB",
  "EDWOSB",
  "WOSB",
  "VOSB",
  "ISO 9001",
  "ISO 27001",
  "CMMI",
  "FedRAMP",
  "SOC 2",
  "NIST 800-171",
];

function section(text: string, heading: string): string | null {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const start = lines.findIndex((line) => line.trim().toLowerCase().replace(/:$/, "") === heading);
  if (start < 0) return null;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^[A-Z][A-Za-z0-9 /&-]{2,40}:?\s*$/.test(line.trim()) && body.length > 0) break;
    body.push(line);
  }
  const value = body.join("\n").trim();
  return value.length >= 40 ? value : null;
}

export function extractProfilePatches(text: string): ProfilePatch[] {
  const patches: ProfilePatch[] = [];
  const uei = /\bUEI[:\s#-]*([A-Z0-9]{12})\b/i.exec(text);
  if (uei) patches.push({ field: "uei", value: uei[1].toUpperCase(), replace: true });
  const cage = /\bCAGE[:\s#-]*([A-Z0-9]{5})\b/i.exec(text);
  if (cage) patches.push({ field: "cage", value: cage[1].toUpperCase(), replace: true });
  const naics = /\bNAICS[:\s#-]*((?:\d{6}\s*(?:,|and)?\s*)+)/i.exec(text);
  if (naics) {
    const codes = [...naics[1].matchAll(/\d{6}/g)].map((match) => match[0]);
    if (codes.length) patches.push({ field: "naics", value: [...new Set(codes)].join(", "), replace: true });
  }
  const foundCerts = CERTS.filter((cert) => text.toLowerCase().includes(cert.toLowerCase()));
  if (/sam\.gov/.test(text.toLowerCase()) && /active/.test(text.toLowerCase())) foundCerts.push("SAM.gov active");
  if (foundCerts.length) patches.push({ field: "certifications", value: foundCerts.join(", "), replace: false });
  if (/service-disabled veteran-owned/i.test(text)) {
    patches.push({ field: "socioeconomic", value: "SDVOSB", replace: true });
  } else if (/\b8\(a\)\b/i.test(text)) {
    patches.push({ field: "socioeconomic", value: "8(a)", replace: true });
  } else if (/\bHUBZone\b/i.test(text)) {
    patches.push({ field: "socioeconomic", value: "HUBZone", replace: true });
  } else if (/\bWOSB\b|woman-owned small business/i.test(text)) {
    patches.push({ field: "socioeconomic", value: "WOSB", replace: true });
  }
  const summary = section(text, "summary") ?? section(text, "company overview");
  if (summary) patches.push({ field: "summary", value: summary, replace: false });
  const capabilities = section(text, "capabilities") ?? section(text, "core capabilities");
  if (capabilities) patches.push({ field: "capabilities", value: capabilities, replace: false });
  const past = section(text, "past performance");
  if (past) patches.push({ field: "past_performance", value: past, replace: false });
  return patches;
}

export function mergeField(field: string, current: string, incoming: string, replace: boolean): string {
  const next = incoming.trim();
  const prior = current.trim();
  if (!next) return prior;
  if (replace || !prior) return next;
  if (field === "certifications") {
    const have = new Set(prior.split(",").map((part) => part.trim()).filter(Boolean));
    for (const part of next.split(",")) {
      const token = part.trim();
      if (token && ![...have].some((item) => item.toLowerCase() === token.toLowerCase())) have.add(token);
    }
    return [...have].join(", ");
  }
  if (prior.includes(next)) return prior;
  return `${prior}\n\n${next}`;
}

export const PROFILE_FIELDS = [
  ["summary", "Summary"],
  ["capabilities", "Capabilities"],
  ["past_performance", "Past performance"],
  ["certifications", "Certifications"],
  ["naics", "NAICS"],
  ["uei", "UEI"],
  ["cage", "CAGE"],
  ["socioeconomic", "Socioeconomic"],
] as const;

export function fieldLabel(field: string): string {
  return PROFILE_FIELDS.find(([key]) => key === field)?.[1] ?? field;
}
