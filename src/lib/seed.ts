import { draftWorkProduct, assigneeFor } from "./agents";
import {
  featured,
  industries,
  nameFirst,
  nameSecond,
  nameSuffix,
  notices,
  places,
  pursuits,
  socioCycle,
  team,
  type FeaturedOrg,
} from "./catalog";
import type { Query } from "./db";
import { addDays, federalToday } from "./dates";
import { draftProposal } from "./proposals";
import { buildChecklist } from "./requirements";
import { scoreFit } from "./scoring";
import { newId } from "./text";
import type { FitNotice, FitProfile } from "./types";

const GENERATED = 1988;

function token(seed: number, length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = (seed + 1) >>> 0;
  let out = "";
  for (let index = 0; index < length; index += 1) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    out += alphabet[value % alphabet.length];
  }
  return out;
}

async function insertRows(q: Query, table: string, columns: string[], rows: unknown[][]): Promise<void> {
  const width = columns.length;
  for (let start = 0; start < rows.length; start += 80) {
    const slice = rows.slice(start, start + 80);
    const params: unknown[] = [];
    const groups = slice.map((row) => {
      if (row.length !== width) throw new Error(`Row for ${table} has ${row.length} values`);
      return `(${row
        .map((value) => {
          params.push(value);
          return `$${params.length}`;
        })
        .join(", ")})`;
    });
    await q(`insert into ${table} (${columns.join(", ")}) values ${groups.join(", ")}`, params);
  }
}

function profileOf(org: {
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
}): FitProfile {
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

export async function seedDatabase(q: Query): Promise<void> {
  await q("begin");
  try {
    const today = federalToday();
    await insertRows(
      q,
      "team_members",
      ["id", "name", "kind", "role", "specialty"],
      team.map((member) => [...member]),
    );

    const orgRows: unknown[][] = featured.map((org) => [
      org.id,
      org.name,
      org.legalName,
      org.uei,
      org.cage,
      org.entityType,
      org.socioeconomic,
      org.city,
      org.state,
      org.naics,
      org.summary,
      org.capabilities,
      org.pastPerformance,
      org.certifications,
      org.annualRevenue,
      org.employeeCount,
      "capture",
      true,
      true,
    ]);

    const generated: FeaturedOrg[] = [];
    for (let index = 0; index < GENERATED; index += 1) {
      const industry = industries[index % industries.length];
      const socio = socioCycle[Math.floor(index / industries.length) % socioCycle.length];
      const [city, state] = places[index % places.length];
      const name = `${nameFirst[index % nameFirst.length]} ${nameSecond[Math.floor(index / nameFirst.length) % nameSecond.length]} ${nameSuffix[Math.floor(index / (nameFirst.length * nameSecond.length)) % nameSuffix.length]}`;
      const org: FeaturedOrg = {
        id: `org_g${String(index + 1).padStart(4, "0")}`,
        name,
        legalName: socio.entityType === "nonprofit" ? name : `${name} LLC`,
        uei: token(index + 40, 12),
        cage: token(index + 900, 5),
        entityType: socio.entityType,
        socioeconomic: socio.socioeconomic,
        city,
        state,
        naics: industry.naics,
        summary: `${name} is a ${socio.socioeconomic.toLowerCase()} ${socio.entityType} in ${city}, ${state}, working in ${industry.label}.`,
        capabilities: `${name} provides ${industry.offer} The ${city} team has delivered ${industry.proof}`,
        pastPerformance: `${name}: ${industry.past}`,
        certifications: socio.certifications,
        annualRevenue: 900_000 + (index % 19) * 475_000,
        employeeCount: 8 + (index % 23) * 3,
        lead: index % 2 === 0 ? "mem_mara" : "mem_andre",
        manager: index % 2 === 0 ? "mem_owen" : "mem_june",
      };
      generated.push(org);
      orgRows.push([
        org.id,
        org.name,
        org.legalName,
        org.uei,
        org.cage,
        org.entityType,
        org.socioeconomic,
        org.city,
        org.state,
        org.naics,
        org.summary,
        org.capabilities,
        org.pastPerformance,
        org.certifications,
        org.annualRevenue,
        org.employeeCount,
        index < 40 ? "active" : "prospect",
        false,
        true,
      ]);
    }

    await insertRows(q, "organizations", [
      "id", "name", "legal_name", "uei", "cage", "entity_type", "socioeconomic", "city", "state", "naics",
      "summary", "capabilities", "past_performance", "certifications", "annual_revenue", "employee_count",
      "status", "featured", "demo",
    ], orgRows);

    const staffed = [...featured, ...generated.slice(0, 40)];
    await insertRows(
      q,
      "assignments",
      ["id", "organization_id", "member_id", "pod_role"],
      staffed.flatMap((org) => [
        [`asg_${org.id}_lead`, org.id, org.lead, "capture_lead"],
        [`asg_${org.id}_mgr`, org.id, org.manager, "proposal_manager"],
        [`asg_${org.id}_reader`, org.id, "agt_reader", "requirements"],
        [`asg_${org.id}_narrative`, org.id, "agt_narrative", "narrative"],
        [`asg_${org.id}_matrix`, org.id, "agt_matrix", "compliance"],
        [`asg_${org.id}_past`, org.id, "agt_past", "past_performance"],
      ]),
    );

    await insertRows(q, "opportunities", [
      "id", "portal", "external_id", "number", "title", "agency", "agency_code", "instrument", "naics",
      "set_aside", "posted_on", "closes_on", "award_ceiling", "description", "eligibility", "url",
    ], notices.map((notice) => [
      notice.id,
      "sample",
      `sample-${notice.id}`,
      notice.number,
      notice.title,
      notice.agency,
      notice.agencyCode,
      notice.instrument,
      notice.naics,
      notice.setAside,
      addDays(today, -notice.postDaysAgo),
      notice.closeInDays == null ? null : addDays(today, notice.closeInDays),
      notice.awardCeiling,
      notice.description,
      notice.eligibility,
      "",
    ]));

    const noticeById = new Map(notices.map((notice) => [notice.id, notice]));
    const orgById = new Map<string, FeaturedOrg>([...featured, ...generated].map((org) => [org.id, org]));

    const documents: unknown[][] = [];
    const facts: unknown[][] = [];
    for (const org of featured) {
      const docId = `doc_${org.id}_cap`;
      const text = [`Summary`, org.summary, ``, `Capabilities`, org.capabilities, ``, `Past performance`, org.pastPerformance, ``, `UEI: ${org.uei}`, `CAGE: ${org.cage}`, `NAICS: ${org.naics}`, org.certifications].join("\n");
      documents.push([
        docId, org.id, null, "capability_statement", `${org.name} capability statement.txt`, "text/plain",
        text.length, text, "Intake pulled summary, capabilities, past performance, UEI, CAGE, and NAICS into the profile.",
        "Requirements Reader", null,
      ]);
      for (const [field, value] of [
        ["summary", org.summary],
        ["capabilities", org.capabilities],
        ["past_performance", org.pastPerformance],
        ["uei", org.uei],
        ["naics", org.naics],
      ] as const) {
        facts.push([newId("fact"), org.id, field, value, `${org.name} capability statement.txt`]);
      }
    }
    for (const notice of notices) {
      const text = `${notice.description}\n\nEligibility\n${notice.eligibility}`;
      documents.push([
        `doc_${notice.id}`,
        null,
        notice.id,
        notice.instrument === "contract" ? "rfp" : "nofo",
        `${notice.number}.txt`,
        "text/plain",
        text.length,
        text,
        "Stored as the source text for this sample notice.",
        "Requirements Reader",
        null,
      ]);
    }
    await insertRows(q, "documents", [
      "id", "organization_id", "opportunity_id", "kind", "filename", "media_type", "byte_size",
      "extracted_text", "extraction_summary", "uploaded_by", "content_base64",
    ], documents);
    await insertRows(q, "profile_facts", ["id", "organization_id", "field", "value", "source_label"], facts);

    const matches: unknown[][] = [];
    const activity: unknown[][] = [];
    for (const pursuit of pursuits) {
      const org = orgById.get(pursuit.orgId);
      const notice = noticeById.get(pursuit.oppId);
      if (!org || !notice) continue;
      const closesOn = notice.closeInDays == null ? null : addDays(today, notice.closeInDays);
      const fitNotice: FitNotice = {
        title: notice.title,
        agency: notice.agency,
        instrument: notice.instrument,
        naics: notice.naics,
        setAside: notice.setAside,
        description: notice.description,
        eligibility: notice.eligibility,
        closesOn,
        awardCeiling: notice.awardCeiling,
      };
      const fit = scoreFit(profileOf(org), fitNotice, today);
      matches.push([
        `match_${pursuit.orgId}_${pursuit.oppId}`,
        pursuit.orgId,
        pursuit.oppId,
        fit.score,
        fit.summary,
        JSON.stringify(fit.dimensions),
        pursuit.status,
      ]);

      const checklistId = `chk_${pursuit.orgId}_${pursuit.oppId}`;
      const items = buildChecklist({
        instrument: notice.instrument,
        description: notice.description,
        eligibility: notice.eligibility,
        closesOn,
        number: notice.number,
        today,
      });
      await q(
        `insert into checklists (id, organization_id, opportunity_id, title, closes_on) values ($1,$2,$3,$4,$5)`,
        [checklistId, pursuit.orgId, pursuit.oppId, `Submission checklist · ${notice.number}`, closesOn],
      );
      const itemIds = items.map(() => newId("item"));
      await insertRows(q, "checklist_items", [
        "id", "checklist_id", "position", "phase", "title", "detail", "source_ref", "due_on", "status", "evidence",
      ], items.map((item, index) => [
        itemIds[index],
        checklistId,
        index + 1,
        item.phase,
        item.title,
        item.detail,
        item.sourceRef,
        item.dueOn,
        pursuit.project && index < 2 ? "met" : "open",
        pursuit.project && index < 2 ? "Work product is on the capture project." : "",
      ]));

      const pod = [
        { id: org.lead, kind: "human", podRole: "capture_lead" },
        { id: org.manager, kind: "human", podRole: "proposal_manager" },
        { id: "agt_reader", kind: "agent", podRole: "requirements" },
        { id: "agt_narrative", kind: "agent", podRole: "narrative" },
        { id: "agt_matrix", kind: "agent", podRole: "compliance" },
        { id: "agt_past", kind: "agent", podRole: "past_performance" },
      ];
      let projectId: string | null = null;
      if (pursuit.project) {
        projectId = `prj_${pursuit.orgId}_${pursuit.oppId}`;
        await q(
          `insert into projects (id, organization_id, opportunity_id, checklist_id, name, status, closes_on) values ($1,$2,$3,$4,$5,'active',$6)`,
          [projectId, pursuit.orgId, pursuit.oppId, checklistId, `${org.name} · ${notice.number}`, closesOn],
        );
        const taskRows = items.map((item, index) => {
          const status = index < 2 ? "done" : index < 4 ? "review" : index < 6 ? "in_progress" : "backlog";
          const assignee = assigneeFor(item.phase, pod);
          const agentName = team.find((member) => member[0] === assignee)?.[1] ?? "Desk agent";
          const work = status === "done" || status === "review"
            ? draftWorkProduct({
                phase: item.phase,
                title: item.title,
                detail: item.detail,
                profile: profileOf(org),
                notice: fitNotice,
                agentName,
              })
            : "";
          return [
            newId("task"),
            projectId,
            itemIds[index],
            index + 1,
            item.phase,
            item.title,
            item.detail,
            assignee,
            status,
            item.dueOn,
            work,
          ];
        });
        await insertRows(q, "tasks", [
          "id", "project_id", "checklist_item_id", "position", "phase", "title", "detail",
          "assignee_id", "status", "due_on", "work_product",
        ], taskRows);
        activity.push([
          newId("act"),
          pursuit.orgId,
          "Checklist Clerk",
          "agent",
          `Opened the capture project for ${notice.number}.`,
          `/projects/${projectId}`,
          new Date(Date.now() - 36 * 3_600_000).toISOString(),
        ]);
      }

      if (pursuit.proposal && projectId) {
        const proposalId = `prop_${pursuit.orgId}_${pursuit.oppId}`;
        const teamMembers = pod.map((member) => {
          const record = team.find((item) => item[0] === member.id);
          return { name: record?.[1] ?? member.id, kind: member.kind, role: record?.[3] ?? member.podRole };
        });
        const baseInput = {
          profile: { ...profileOf(org), legalName: org.legalName, city: org.city, state: org.state },
          notice: { ...fitNotice, number: notice.number },
          team: teamMembers,
          today,
        };
        const v1 = draftProposal({ ...baseInput, winThemes: "", approachNotes: "", constraints: "" });
        let versions: { body: string; side: string; kind: string; author: string; note: string }[] = [];
        if (pursuit.orgId === "org_harbor") {
          const v2 = v1.replace(
            "## Executive summary\n\n",
            "## Executive summary\n\nRevised by the proposal manager to lead with epidemiology dashboards and to keep the FedRAMP gap visible.\n\n",
          );
          const v3 = v2.replace(
            "## Constraints from the customer\n\nNone recorded.",
            "## Constraints from the customer\n\n> Do not imply that Harbor & Pine holds a FedRAMP authorization. The profile states that it does not.",
          );
          versions = [
            { body: v1, side: "govclaw", kind: "agent", author: "Narrative Drafter", note: "Generated from the profile and the CDC notice." },
            { body: v2, side: "govclaw", kind: "person", author: "Owen Briggs", note: "Tightened the executive summary." },
            { body: v3, side: "client", kind: "person", author: "Harbor & Pine reviewer", note: "Removed any implication of a FedRAMP authorization." },
          ];
          await q(
            `insert into proposals (id, organization_id, opportunity_id, project_id, title, status, win_themes, approach_notes, constraints)
             values ($1,$2,$3,$4,$5,'drafting',$6,$7,$8)`,
            [
              proposalId,
              pursuit.orgId,
              pursuit.oppId,
              projectId,
              `${org.name} · ${notice.title}`,
              "Lead with epidemiology dashboards the agency already knows how to use.",
              "Pair a Seattle analyst with agency epidemiologists for the first 60 days.",
              "Do not imply that Harbor & Pine holds a FedRAMP authorization. The profile states that it does not.",
            ],
          );
        } else {
          const v2 = v1.replace(
            "## Constraints from the customer\n\nNone recorded.",
            "## Constraints from the customer\n\n> Do not claim that Kindred administers formula WIOA funds.",
          );
          const v3 = v2.replace(
            "## Approach\n\n",
            "## Approach\n\nGovClaw note: formula WIOA administration is out of scope for this draft.\n\n",
          );
          versions = [
            { body: v1, side: "govclaw", kind: "agent", author: "Narrative Drafter", note: "Generated from the profile and the ETA notice." },
            { body: v2, side: "client", kind: "person", author: "Kindred program director", note: "Added the formula-funding constraint." },
            { body: v3, side: "govclaw", kind: "person", author: "June Park", note: "Acknowledged the constraint in the approach." },
          ];
          await q(
            `insert into proposals (id, organization_id, opportunity_id, project_id, title, status, win_themes, approach_notes, constraints)
             values ($1,$2,$3,$4,$5,'client_review',$6,$7,$8)`,
            [
              proposalId,
              pursuit.orgId,
              pursuit.oppId,
              projectId,
              `${org.name} · ${notice.title}`,
              "We deliver services under subawards. We do not administer formula funds.",
              "Describe employer partnerships and the case management model in the customer's words.",
              "Do not claim that Kindred administers formula WIOA funds.",
            ],
          );
        }
        await insertRows(q, "proposal_versions", [
          "id", "proposal_id", "version_number", "body", "author_name", "author_side", "author_kind", "change_note",
        ], versions.map((version, index) => [
          newId("ver"),
          proposalId,
          index + 1,
          version.body,
          version.author,
          version.side,
          version.kind,
          version.note,
        ]));
        activity.push([
          newId("act"),
          pursuit.orgId,
          versions[versions.length - 1].author,
          versions[versions.length - 1].kind,
          `Saved proposal version ${versions.length} on ${notice.number}.`,
          `/proposals/${proposalId}`,
          new Date(Date.now() - (pursuit.orgId === "org_harbor" ? 5 : 9) * 3_600_000).toISOString(),
        ]);
      }

      activity.push([
        newId("act"),
        pursuit.orgId,
        "Fit Analyst",
        "agent",
        `Scored ${notice.number} at ${fit.score} and marked it ${pursuit.status}.`,
        `/opportunities/${pursuit.oppId}?org=${pursuit.orgId}`,
        new Date(Date.now() - 72 * 3_600_000).toISOString(),
      ]);
    }
    await insertRows(q, "matches", [
      "id", "organization_id", "opportunity_id", "score", "summary", "dimensions_json", "status",
    ], matches);
    await insertRows(q, "activity", [
      "id", "organization_id", "actor_name", "actor_kind", "summary", "href", "created_at",
    ], activity);

    await q("commit");
  } catch (error) {
    try {
      await q("rollback");
    } catch {
      /* the original error is the one to surface */
    }
    throw error;
  }
}
