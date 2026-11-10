import { federalToday } from "./dates";
import { sql } from "./db";
import { scoreFit } from "./scoring";
import { likePattern, nullableNum, num, one } from "./text";
import type { Fit, FitNotice, FitProfile } from "./types";

export type Organization = {
  id: string;
  name: string;
  legalName: string;
  uei: string;
  cage: string;
  entityType: string;
  socioeconomic: string;
  city: string;
  state: string;
  naics: string;
  summary: string;
  capabilities: string;
  pastPerformance: string;
  certifications: string;
  annualRevenue: number;
  employeeCount: number;
  status: string;
  featured: boolean;
  demo: boolean;
  createdAt: string;
};

export type Opportunity = {
  id: string;
  portal: string;
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
};

type OrgRow = Record<string, unknown>;

function organization(row: OrgRow): Organization {
  return {
    id: String(row.id),
    name: String(row.name),
    legalName: String(row.legal_name),
    uei: String(row.uei ?? ""),
    cage: String(row.cage ?? ""),
    entityType: String(row.entity_type),
    socioeconomic: String(row.socioeconomic ?? ""),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    naics: String(row.naics ?? ""),
    summary: String(row.summary ?? ""),
    capabilities: String(row.capabilities ?? ""),
    pastPerformance: String(row.past_performance ?? ""),
    certifications: String(row.certifications ?? ""),
    annualRevenue: num(row.annual_revenue),
    employeeCount: num(row.employee_count),
    status: String(row.status),
    featured: Boolean(row.featured),
    demo: Boolean(row.demo),
    createdAt: String(row.created_at),
  };
}

function opportunity(row: OrgRow): Opportunity {
  return {
    id: String(row.id),
    portal: String(row.portal),
    externalId: String(row.external_id),
    number: String(row.number),
    title: String(row.title),
    agency: String(row.agency),
    agencyCode: String(row.agency_code ?? ""),
    instrument: String(row.instrument),
    naics: String(row.naics ?? ""),
    setAside: String(row.set_aside ?? ""),
    postedOn: row.posted_on ? String(row.posted_on) : null,
    closesOn: row.closes_on ? String(row.closes_on) : null,
    awardCeiling: nullableNum(row.award_ceiling),
    description: String(row.description ?? ""),
    eligibility: String(row.eligibility ?? ""),
    url: String(row.url ?? ""),
  };
}

export function toProfile(org: Organization): FitProfile {
  return {
    name: org.name,
    entityType: org.entityType,
    socioeconomic: org.socioeconomic,
    naics: org.naics,
    summary: org.summary,
    capabilities: org.capabilities,
    pastPerformance: org.pastPerformance,
    certifications: org.certifications,
    annualRevenue: org.annualRevenue,
    employeeCount: org.employeeCount,
  };
}

export function toNotice(opp: Opportunity): FitNotice {
  return {
    title: opp.title,
    agency: opp.agency,
    instrument: opp.instrument,
    naics: opp.naics,
    setAside: opp.setAside,
    description: opp.description,
    eligibility: opp.eligibility,
    closesOn: opp.closesOn,
    awardCeiling: opp.awardCeiling,
  };
}

export async function getOrganization(id: string): Promise<Organization | null> {
  const rows = await sql<OrgRow>("select * from organizations where id = $1", [id]);
  return rows[0] ? organization(rows[0]) : null;
}

export async function listCustomers(input: {
  q: string;
  status: string;
  state: string;
  origin: string;
  page: number;
}): Promise<{ rows: Organization[]; total: number; page: number; pages: number }> {
  const params: unknown[] = [];
  const where = ["true"];
  if (input.q.trim()) {
    params.push(likePattern(input.q.trim()));
    const token = `$${params.length}`;
    where.push(
      `(name ilike ${token} escape '\\' or legal_name ilike ${token} escape '\\' or uei ilike ${token} escape '\\' or city ilike ${token} escape '\\' or naics ilike ${token} escape '\\')`,
    );
  }
  if (input.status) {
    params.push(input.status);
    where.push(`status = $${params.length}`);
  }
  if (input.state) {
    params.push(input.state);
    where.push(`state = $${params.length}`);
  }
  if (input.origin === "demo" || input.origin === "added") {
    params.push(input.origin === "demo");
    where.push(`demo = $${params.length}`);
  }
  const clause = where.join(" and ");
  const total = num((await sql<OrgRow>(`select count(*)::int as count from organizations where ${clause}`, params))[0]?.count);
  const pageSize = 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, input.page), pages);
  const rows = await sql<OrgRow>(
    `select * from organizations where ${clause} order by featured desc, case status when 'capture' then 0 when 'active' then 1 else 2 end, name asc limit ${pageSize} offset ${(page - 1) * pageSize}`,
    params,
  );
  return { rows: rows.map(organization), total, page, pages };
}

export async function customerStates(): Promise<string[]> {
  const rows = await sql<OrgRow>("select distinct state from organizations where state <> '' order by state");
  return rows.map((row) => String(row.state));
}

export async function searchCustomers(q: string, limit = 8): Promise<Organization[]> {
  const pattern = likePattern(q.trim());
  const rows = await sql<OrgRow>(
    `select * from organizations
     where name ilike $1 escape '\\' or legal_name ilike $1 escape '\\' or city ilike $1 escape '\\' or uei ilike $1 escape '\\'
     order by featured desc, name asc
     limit $2`,
    [pattern, limit],
  );
  return rows.map(organization);
}

export async function dashboard() {
  const [counts] = await sql<OrgRow>(
    `select
      (select count(*)::int from organizations) as customers,
      (select count(*)::int from organizations where demo = false) as added,
      (select count(*)::int from matches where status = 'pursuing') as pursuing,
      (select count(*)::int from tasks where status = 'review') as in_review,
      (select count(*)::int from proposals where status = 'client_review') as with_client`,
  );
  const deadlines = await sql<OrgRow>(
    `select p.id as project_id, p.name as project_name, p.closes_on, o.name as org_name, o.id as org_id, n.title, n.number
     from projects p
     join organizations o on o.id = p.organization_id
     join opportunities n on n.id = p.opportunity_id
     where p.status = 'active'
     order by p.closes_on asc nulls last
     limit 6`,
  );
  const load = await sql<OrgRow>(
    `select m.id, m.name, m.kind, m.role,
       count(t.id) filter (where t.status <> 'done')::int as open_tasks
     from team_members m
     left join tasks t on t.assignee_id = m.id
     group by m.id, m.name, m.kind, m.role
     order by m.kind asc, open_tasks desc, m.name asc`,
  );
  const activity = await sql<OrgRow>(
    `select a.summary, a.href, a.actor_name, a.actor_kind, a.created_at, o.name as org_name
     from activity a
     left join organizations o on o.id = a.organization_id
     order by a.created_at desc
     limit 10`,
  );
  return {
    customers: num(counts?.customers),
    added: num(counts?.added),
    pursuing: num(counts?.pursuing),
    inReview: num(counts?.in_review),
    withClient: num(counts?.with_client),
    deadlines,
    load,
    activity,
    today: federalToday(),
  };
}

export async function listDocuments(organizationId: string) {
  return sql<OrgRow>(
    `select * from documents where organization_id = $1 and opportunity_id is null order by created_at desc`,
    [organizationId],
  );
}

export async function listOpportunityDocuments(opportunityId: string) {
  return sql<OrgRow>(
    `select * from documents where opportunity_id = $1 order by created_at desc`,
    [opportunityId],
  );
}

export async function listFacts(organizationId: string) {
  return sql<OrgRow>(
    `select * from profile_facts where organization_id = $1 order by created_at desc limit 20`,
    [organizationId],
  );
}

export async function listSuggestions(organizationId: string) {
  return sql<OrgRow>(
    `select * from profile_suggestions where organization_id = $1 and status = 'open' order by created_at desc`,
    [organizationId],
  );
}

export async function listPod(organizationId: string) {
  return sql<OrgRow>(
    `select m.id, m.name, m.kind, m.role, m.specialty, a.pod_role
     from assignments a
     join team_members m on m.id = a.member_id
     where a.organization_id = $1
     order by case m.kind when 'human' then 0 else 1 end, m.name`,
    [organizationId],
  );
}

export async function listBench(organizationId: string) {
  return sql<OrgRow>(
    `select m.id, m.name, m.kind, m.role, m.specialty
     from team_members m
     where not exists (
       select 1 from assignments a where a.organization_id = $1 and a.member_id = m.id
     )
     order by m.kind, m.name`,
    [organizationId],
  );
}

export type ScoredOpportunity = Opportunity & {
  fit: Fit;
  trackStatus: string;
  checklistId: string | null;
  projectId: string | null;
  proposalId: string | null;
};

export async function scoredOpportunities(org: Organization): Promise<ScoredOpportunity[]> {
  const today = federalToday();
  const opps = (await sql<OrgRow>("select * from opportunities")).map(opportunity);
  const matches = await sql<OrgRow>("select * from matches where organization_id = $1", [org.id]);
  const lists = await sql<OrgRow>("select id, opportunity_id from checklists where organization_id = $1", [org.id]);
  const projects = await sql<OrgRow>("select id, opportunity_id from projects where organization_id = $1", [org.id]);
  const proposals = await sql<OrgRow>("select id, opportunity_id from proposals where organization_id = $1", [org.id]);
  const matchByOpp = new Map(matches.map((row) => [String(row.opportunity_id), String(row.status)]));
  const listByOpp = new Map(lists.map((row) => [String(row.opportunity_id), String(row.id)]));
  const projectByOpp = new Map(projects.map((row) => [String(row.opportunity_id), String(row.id)]));
  const proposalByOpp = new Map(proposals.map((row) => [String(row.opportunity_id), String(row.id)]));
  return opps
    .map((opp) => ({
      ...opp,
      fit: scoreFit(toProfile(org), toNotice(opp), today),
      trackStatus: matchByOpp.get(opp.id) ?? "untracked",
      checklistId: listByOpp.get(opp.id) ?? null,
      projectId: projectByOpp.get(opp.id) ?? null,
      proposalId: proposalByOpp.get(opp.id) ?? null,
    }))
    .sort((a, b) => b.fit.score - a.fit.score || a.title.localeCompare(b.title));
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  const rows = await sql<OrgRow>("select * from opportunities where id = $1", [id]);
  return rows[0] ? opportunity(rows[0]) : null;
}

export async function pipeline() {
  const today = federalToday();
  const rows = await sql<OrgRow>(
    `select m.status, m.organization_id, m.opportunity_id, o.name as org_name, o.city, o.state,
            o.entity_type, o.socioeconomic, o.naics as org_naics, o.summary, o.capabilities,
            o.past_performance, o.certifications, o.annual_revenue, o.employee_count,
            n.*
     from matches m
     join organizations o on o.id = m.organization_id
     join opportunities n on n.id = m.opportunity_id
     where m.status in ('watching', 'pursuing')
     order by n.closes_on asc nulls last`,
  );
  return rows.map((row) => {
    const opp = opportunity(row);
    const org = organization({
      ...row,
      id: row.organization_id,
      name: row.org_name,
      legal_name: row.org_name,
      naics: row.org_naics,
      past_performance: row.past_performance,
    });
    return {
      status: String(row.status),
      organizationId: String(row.organization_id),
      orgName: String(row.org_name),
      city: String(row.city ?? ""),
      state: String(row.state ?? ""),
      opportunity: opp,
      fit: scoreFit(toProfile(org), toNotice(opp), today),
    };
  });
}

export async function checklistFor(organizationId: string, opportunityId: string) {
  const lists = await sql<OrgRow>(
    "select * from checklists where organization_id = $1 and opportunity_id = $2",
    [organizationId, opportunityId],
  );
  if (!lists[0]) return null;
  const items = await sql<OrgRow>(
    "select * from checklist_items where checklist_id = $1 order by position",
    [lists[0].id],
  );
  return { list: lists[0], items };
}

export async function projectByChecklist(checklistId: string) {
  const rows = await sql<OrgRow>("select id, name, status from projects where checklist_id = $1", [checklistId]);
  return rows[0] ?? null;
}

export async function getProject(id: string) {
  const rows = await sql<OrgRow>(
    `select p.*, o.name as org_name, n.title as opp_title, n.number as opp_number, n.id as opp_id
     from projects p
     join organizations o on o.id = p.organization_id
     join opportunities n on n.id = p.opportunity_id
     where p.id = $1`,
    [id],
  );
  if (!rows[0]) return null;
  const tasks = await sql<OrgRow>(
    `select t.*, m.name as assignee_name, m.kind as assignee_kind
     from tasks t
     left join team_members m on m.id = t.assignee_id
     where t.project_id = $1
     order by t.position`,
    [id],
  );
  const noteIds = tasks.map((task) => String(task.id));
  const notes = noteIds.length
    ? await sql<OrgRow>(
        `select * from task_notes where task_id in (${noteIds.map((_, index) => `$${index + 1}`).join(", ")}) order by created_at`,
        noteIds,
      )
    : [];
  const proposal = await sql<OrgRow>(
    "select id, title, status from proposals where project_id = $1",
    [id],
  );
  return { project: rows[0], tasks, notes, proposal: proposal[0] ?? null };
}

export async function customerWork(organizationId: string) {
  const projects = await sql<OrgRow>(
    `select p.*, n.title, n.number from projects p
     join opportunities n on n.id = p.opportunity_id
     where p.organization_id = $1
     order by p.closes_on asc nulls last`,
    [organizationId],
  );
  const proposals = await sql<OrgRow>(
    `select p.*, n.title as opp_title, n.number,
       (select max(version_number) from proposal_versions v where v.proposal_id = p.id) as versions
     from proposals p
     join opportunities n on n.id = p.opportunity_id
     where p.organization_id = $1
     order by p.created_at desc`,
    [organizationId],
  );
  return { projects, proposals };
}

export async function getProposal(id: string) {
  const rows = await sql<OrgRow>(
    `select p.*, o.name as org_name, o.legal_name, n.title as opp_title, n.number as opp_number, n.id as opp_id
     from proposals p
     join organizations o on o.id = p.organization_id
     join opportunities n on n.id = p.opportunity_id
     where p.id = $1`,
    [id],
  );
  if (!rows[0]) return null;
  const versions = await sql<OrgRow>(
    "select * from proposal_versions where proposal_id = $1 order by version_number desc",
    [id],
  );
  const notes = await sql<OrgRow>(
    "select * from proposal_notes where proposal_id = $1 order by created_at",
    [id],
  );
  return { proposal: rows[0], versions, notes };
}

export function pageFrom(value: string | string[] | undefined): number {
  const parsed = Number(one(value) || "1");
  return Number.isFinite(parsed) ? parsed : 1;
}
