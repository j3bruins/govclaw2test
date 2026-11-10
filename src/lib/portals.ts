import { parseMoney, parseUsDate } from "./dates";
import { stripHtml } from "./text";
import type { PortalHit, PortalSearch } from "./types";

const USER_AGENT = "GovClaw/1.0";

function instrumentFrom(value: unknown, fallback: string): string {
  const text = JSON.stringify(value ?? "").toLowerCase();
  if (text.includes("coop")) return "cooperative";
  if (text.includes("procurement") || text.includes("contract")) return "contract";
  if (text.includes("grant")) return "grant";
  return fallback;
}

function textOf(value: unknown): string {
  if (typeof value === "string") return stripHtml(value);
  if (Array.isArray(value)) return value.map((item) => textOf(item)).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return textOf(record.description ?? record.label ?? record.name ?? "");
  }
  return "";
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

export async function searchGrants(keyword: string): Promise<PortalSearch> {
  const response = await fetch("https://api.grants.gov/v1/api/search2", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": USER_AGENT,
    },
    body: JSON.stringify({
      keyword,
      oppStatuses: "forecasted|posted",
      rows: 8,
      startRecordNum: 0,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Grants.gov search failed (${response.status})`);
  const payload = (await readJson(response)) as { data?: { hitCount?: number; oppHits?: Record<string, unknown>[] } };
  const rows = payload.data?.oppHits ?? [];
  const hits = await Promise.all(rows.map((row) => grantHit(row)));
  return { hitCount: Number(payload.data?.hitCount ?? hits.length), hits };
}

async function grantHit(row: Record<string, unknown>): Promise<PortalHit> {
  const externalId = String(row.id ?? "");
  const base: PortalHit = {
    portal: "grants.gov",
    externalId,
    number: String(row.number ?? ""),
    title: String(row.title ?? "Untitled notice"),
    agency: String(row.agency ?? row.agencyName ?? ""),
    agencyCode: String(row.agencyCode ?? ""),
    instrument: "grant",
    naics: "",
    setAside: "",
    postedOn: parseUsDate(row.openDate),
    closesOn: parseUsDate(row.closeDate),
    awardCeiling: null,
    description: "",
    eligibility: "",
    url: externalId ? `https://www.grants.gov/search-results-detail/${externalId}` : "https://www.grants.gov",
    partial: true,
  };
  if (!externalId) return base;
  try {
    const detail = await fetchGrant(externalId);
    return { ...base, ...detail, partial: false };
  } catch {
    return base;
  }
}

export async function fetchGrant(externalId: string): Promise<Omit<PortalHit, "portal" | "externalId" | "partial">> {
  const response = await fetch("https://api.grants.gov/v1/api/fetchOpportunity", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": USER_AGENT,
    },
    body: JSON.stringify({ opportunityId: Number(externalId) }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Grants.gov detail failed (${response.status})`);
  const payload = (await readJson(response)) as { data?: Record<string, unknown> };
  const data = payload.data ?? {};
  const synopsis = (data.synopsis ?? {}) as Record<string, unknown>;
  const agencyDetails = (synopsis.topAgencyDetails ?? data.topAgencyDetails ?? {}) as Record<string, unknown>;
  const agencyName = String(agencyDetails.agencyName ?? synopsis.agencyName ?? "");
  return {
    number: String(data.opportunityNumber ?? ""),
    title: String(data.opportunityTitle ?? "Untitled notice"),
    agency: agencyName,
    agencyCode: String(synopsis.agencyCode ?? data.owningAgencyCode ?? ""),
    instrument: instrumentFrom(synopsis.fundingInstruments, "grant"),
    naics: "",
    setAside: "",
    postedOn: parseUsDate(synopsis.postingDateStr ?? synopsis.postingDate),
    closesOn: parseUsDate(synopsis.responseDateStr ?? synopsis.responseDate),
    awardCeiling: parseMoney(synopsis.awardCeiling ?? synopsis.awardCeilingFormatted),
    description: textOf(synopsis.synopsisDesc).slice(0, 20_000),
    eligibility: textOf(synopsis.applicantEligibilityDesc).slice(0, 8_000),
    url: `https://www.grants.gov/search-results-detail/${externalId}`,
  };
}

function samConfigured(): string {
  return process.env.SAM_API_KEY?.trim() ?? "";
}

export function samReady(): boolean {
  return samConfigured() !== "";
}

export async function searchSam(keyword: string): Promise<PortalSearch> {
  const key = samConfigured();
  if (!key) return { hitCount: 0, hits: [] };
  const today = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date());
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 90);
  const postedFrom = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(from);
  const url = new URL("https://api.sam.gov/opportunities/v2/search");
  url.searchParams.set("api_key", key);
  url.searchParams.set("postedFrom", postedFrom);
  url.searchParams.set("postedTo", today);
  url.searchParams.set("limit", "8");
  url.searchParams.set("title", keyword);
  url.searchParams.set("ptype", "o,k,r,s");
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`SAM.gov search failed (${response.status})`);
  const payload = (await readJson(response)) as {
    totalRecords?: number;
    opportunitiesData?: Record<string, unknown>[];
  };
  const rows = payload.opportunitiesData ?? [];
  const hits = await Promise.all(rows.map((row) => samHit(row, key)));
  return { hitCount: Number(payload.totalRecords ?? hits.length), hits };
}

async function samHit(row: Record<string, unknown>, key: string): Promise<PortalHit> {
  const externalId = String(row.noticeId ?? "");
  const description = await samDescription(row.description, externalId, key);
  return {
    portal: "sam.gov",
    externalId,
    number: String(row.solicitationNumber ?? ""),
    title: String(row.title ?? "Untitled notice"),
    agency: String(row.fullParentPathName ?? ""),
    agencyCode: String(row.fullParentPathCode ?? ""),
    instrument: "contract",
    naics: String(row.naicsCode ?? ""),
    setAside: String(row.typeOfSetAsideDescription ?? row.typeOfSetAside ?? ""),
    postedOn: parseUsDate(row.postedDate),
    closesOn: parseUsDate(row.responseDeadLine),
    awardCeiling: parseMoney(row.awardAmount),
    description,
    eligibility: String(row.typeOfSetAsideDescription ?? ""),
    url: externalId ? `https://sam.gov/opp/${externalId}/view` : "https://sam.gov",
    partial: description.trim() === "",
  };
}

async function samDescription(value: unknown, noticeId: string, key: string): Promise<string> {
  if (typeof value === "string" && value.trim() && !/^https?:/i.test(value.trim())) {
    return stripHtml(value).slice(0, 20_000);
  }
  const endpoint = new URL("https://api.sam.gov/prod/opportunities/v1/noticedesc");
  endpoint.searchParams.set("noticeid", noticeId);
  endpoint.searchParams.set("api_key", key);
  try {
    const response = await fetch(endpoint, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return "";
    const payload = await readJson(response);
    const record = payload as { description?: unknown; descriptionData?: { description?: unknown }[] };
    const raw = record.description ?? record.descriptionData?.[0]?.description ?? "";
    return textOf(raw).slice(0, 20_000);
  } catch {
    return "";
  }
}

export async function fetchSam(noticeId: string): Promise<PortalHit | null> {
  const key = samConfigured();
  if (!key || !/^[a-z0-9-]+$/i.test(noticeId)) return null;
  const postedTo = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date());
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 360);
  const postedFrom = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(from);
  const url = new URL("https://api.sam.gov/opportunities/v2/search");
  url.searchParams.set("api_key", key);
  url.searchParams.set("noticeid", noticeId);
  url.searchParams.set("postedFrom", postedFrom);
  url.searchParams.set("postedTo", postedTo);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`SAM.gov detail failed (${response.status})`);
  const payload = (await readJson(response)) as { opportunitiesData?: Record<string, unknown>[] };
  const row = payload.opportunitiesData?.[0];
  if (!row) return null;
  return samHit(row, key);
}

export async function searchGrantsSafe(keyword: string): Promise<PortalSearch> {
  try {
    return await searchGrants(keyword);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Grants.gov is unavailable";
    return { hitCount: 0, hits: [], error: message.replace(/api_key=[^&\s]+/gi, "api_key") };
  }
}

export async function searchSamSafe(keyword: string): Promise<PortalSearch> {
  try {
    return await searchSam(keyword);
  } catch (error) {
    const message = error instanceof Error ? error.message : "SAM.gov is unavailable";
    return { hitCount: 0, hits: [], error: message.replace(/api_key=[^&\s]+/gi, "api_key") };
  }
}
