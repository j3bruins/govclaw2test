"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { assigneeFor, draftWorkProduct } from "./agents";
import { sql } from "./db";
import { federalToday } from "./dates";
import { extractProfilePatches, fieldLabel, mergeField } from "./profile";
import { fetchGrant, fetchSam } from "./portals";
import { buildChecklist, extractRequirements, phaseFor } from "./requirements";
import { draftProposal } from "./proposals";
import { getOrganization, getOpportunity, listPod, toNotice, toProfile } from "./queries";
import { scoreFit } from "./scoring";
import { clip, newId, safeBack, safeId, withNotice } from "./text";
import type { PortalHit } from "./types";
import { actor, requireSignedIn } from "./viewer";

const FIELD_COLUMNS: Record<string, string> = {
  summary: "summary",
  capabilities: "capabilities",
  past_performance: "past_performance",
  certifications: "certifications",
  naics: "naics",
  uei: "uei",
  cage: "cage",
  socioeconomic: "socioeconomic",
};

async function logActivity(organizationId: string | null, name: string, kind: string, summary: string, href: string) {
  await sql(
    `insert into activity (id, organization_id, actor_name, actor_kind, summary, href) values ($1,$2,$3,$4,$5,$6)`,
    [newId("act"), organizationId, name, kind, summary, href],
  );
}

export async function setDeskSide(formData: FormData) {
  await requireSignedIn();
  const side = formData.get("side") === "client" ? "client" : "govclaw";
  const jar = await cookies();
  jar.set("govclaw_side", side, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(safeBack(formData.get("back"), "/"));
}

export async function createOrganization(formData: FormData) {
  await requireSignedIn();
  const name = clip(String(formData.get("name") ?? ""), 160);
  if (name.length < 2) redirect(withNotice("/customers/new", "Enter a customer name."));
  const who = await actor();
  const id = newId("org");
  const entity = String(formData.get("entity") ?? "for-profit");
  const entityType = ["for-profit", "nonprofit", "university", "government"].includes(entity) ? entity : "for-profit";
  await sql(
    `insert into organizations (
      id, name, legal_name, uei, cage, entity_type, socioeconomic, city, state, naics, summary,
      capabilities, past_performance, certifications, annual_revenue, employee_count, status, featured, demo
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'','','','','',$10,$11,'prospect',false,false)`,
    [
      id,
      name,
      clip(String(formData.get("legal") ?? "") || name, 180),
      clip(String(formData.get("uei") ?? "").toUpperCase(), 12),
      clip(String(formData.get("cage") ?? "").toUpperCase(), 5),
      entityType,
      clip(String(formData.get("socioeconomic") ?? ""), 80),
      clip(String(formData.get("city") ?? ""), 80),
      clip(String(formData.get("state") ?? "").toUpperCase(), 2),
      Number(formData.get("revenue") ?? 0) || 0,
      Number(formData.get("employees") ?? 0) || 0,
    ],
  );
  if (formData.get("pod") !== "off") {
    const lead = (await sql<{ id: string }>("select id from team_members where id in ('mem_mara','mem_andre') order by id"))[0]?.id ?? "mem_mara";
    const manager = lead === "mem_mara" ? "mem_owen" : "mem_june";
    for (const [memberId, podRole] of [
      [lead, "capture_lead"],
      [manager, "proposal_manager"],
      ["agt_reader", "requirements"],
      ["agt_narrative", "narrative"],
      ["agt_matrix", "compliance"],
      ["agt_past", "past_performance"],
    ]) {
      await sql(
        `insert into assignments (id, organization_id, member_id, pod_role) values ($1,$2,$3,$4)`,
        [newId("asg"), id, memberId, podRole],
      );
    }
  }
  await logActivity(id, who.name, who.kind, `Added ${name} to the customer book.`, `/customers/${id}`);
  redirect(withNotice(`/customers/${id}`, "Customer added. Upload a capability statement to fill the profile."));
}

export async function saveProfile(formData: FormData) {
  await requireSignedIn();
  const id = safeId(formData.get("org"));
  const org = await getOrganization(id);
  if (!org) redirect("/customers");
  const who = await actor();
  const values = {
    legal_name: clip(String(formData.get("legal") ?? org.legalName), 180),
    entity_type: ["for-profit", "nonprofit", "university", "government"].includes(String(formData.get("entity")))
      ? String(formData.get("entity"))
      : org.entityType,
    socioeconomic: clip(String(formData.get("socioeconomic") ?? ""), 80),
    city: clip(String(formData.get("city") ?? ""), 80),
    state: clip(String(formData.get("state") ?? "").toUpperCase(), 2),
    uei: clip(String(formData.get("uei") ?? "").toUpperCase(), 12),
    cage: clip(String(formData.get("cage") ?? "").toUpperCase(), 5),
    naics: clip(String(formData.get("naics") ?? ""), 80),
    summary: clip(String(formData.get("summary") ?? ""), 4000),
    capabilities: clip(String(formData.get("capabilities") ?? ""), 8000),
    past_performance: clip(String(formData.get("past_performance") ?? ""), 8000),
    certifications: clip(String(formData.get("certifications") ?? ""), 500),
    annual_revenue: Number(formData.get("revenue") ?? 0) || 0,
    employee_count: Number(formData.get("employees") ?? 0) || 0,
  };
  await sql(
    `update organizations set legal_name=$2, entity_type=$3, socioeconomic=$4, city=$5, state=$6, uei=$7, cage=$8,
     naics=$9, summary=$10, capabilities=$11, past_performance=$12, certifications=$13, annual_revenue=$14, employee_count=$15
     where id=$1`,
    [
      id, values.legal_name, values.entity_type, values.socioeconomic, values.city, values.state, values.uei,
      values.cage, values.naics, values.summary, values.capabilities, values.past_performance, values.certifications,
      values.annual_revenue, values.employee_count,
    ],
  );
  await sql(
    `insert into profile_facts (id, organization_id, field, value, source_label) values ($1,$2,'summary',$3,$4)`,
    [newId("fact"), id, values.summary || "(cleared)", `Profile edited by ${who.name}`],
  );
  await logActivity(id, who.name, who.kind, "Updated the company profile.", `/customers/${id}`);
  redirect(withNotice(`/customers/${id}`, "Profile saved."));
}

export async function applySuggestion(formData: FormData) {
  await requireSignedIn();
  const id = safeId(formData.get("suggestion"));
  const rows = await sql<Record<string, unknown>>(
    "select * from profile_suggestions where id = $1 and status = 'open'",
    [id],
  );
  const suggestion = rows[0];
  if (!suggestion) redirect("/customers");
  const orgId = String(suggestion.organization_id);
  const field = String(suggestion.field);
  const column = FIELD_COLUMNS[field];
  const org = await getOrganization(orgId);
  if (!column || !org) redirect(`/customers/${orgId}`);
  const current = String((org as unknown as Record<string, string>)[field === "past_performance" ? "pastPerformance" : field] ?? "");
  const camel: Record<string, keyof typeof org> = {
    summary: "summary",
    capabilities: "capabilities",
    past_performance: "pastPerformance",
    certifications: "certifications",
    naics: "naics",
    uei: "uei",
    cage: "cage",
    socioeconomic: "socioeconomic",
  };
  const merged = mergeField(field, String(org[camel[field]] ?? current), String(suggestion.value), field === "uei" || field === "cage" || field === "naics" || field === "socioeconomic");
  await sql(`update organizations set ${column} = $1 where id = $2`, [merged, orgId]);
  await sql("update profile_suggestions set status = 'applied' where id = $1", [id]);
  await sql(
    `insert into profile_facts (id, organization_id, field, value, source_label) values ($1,$2,$3,$4,$5)`,
    [newId("fact"), orgId, field, merged, String(suggestion.source_label)],
  );
  const who = await actor();
  await logActivity(orgId, who.name, who.kind, `Applied a ${fieldLabel(field).toLowerCase()} suggestion.`, `/customers/${orgId}`);
  redirect(withNotice(`/customers/${orgId}`, `Applied the ${fieldLabel(field).toLowerCase()} suggestion.`));
}

export async function dismissSuggestion(formData: FormData) {
  await requireSignedIn();
  const id = safeId(formData.get("suggestion"));
  const rows = await sql<{ organization_id: string }>("select organization_id from profile_suggestions where id = $1", [id]);
  await sql("update profile_suggestions set status = 'dismissed' where id = $1", [id]);
  redirect(withNotice(`/customers/${rows[0]?.organization_id ?? ""}`, "Suggestion dismissed."));
}

function pdfText(bytes: Buffer): string {
  const raw = bytes.toString("latin1");
  const parts: string[] = [];
  for (const match of raw.match(/\((?:\\\)|\\\(|\\n|[^)]){4,}\)/g) ?? []) {
    const inner = match.slice(1, -1).replace(/\\n/g, "\n").replace(/\\\)/g, ")").replace(/\\\(/g, "(");
    if (/[A-Za-z]{3,}/.test(inner)) parts.push(inner);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export async function uploadDocument(formData: FormData) {
  await requireSignedIn();
  const orgValue = String(formData.get("org") ?? "");
  const oppValue = String(formData.get("opportunity") ?? "");
  const orgId = orgValue ? safeId(orgValue) : null;
  const opportunityId = oppValue ? safeId(oppValue) : null;
  if (!orgId && !opportunityId) redirect("/customers");
  const pasted = clip(String(formData.get("pasted") ?? ""), 200_000);
  const file = formData.get("file");
  let extracted = pasted;
  let filename = pasted ? "pasted-notes.txt" : "upload.txt";
  let mediaType = "text/plain";
  let byteSize = Buffer.byteLength(pasted);
  let base64: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 1_500_000) {
      redirect(withNotice(orgId ? `/customers/${orgId}/documents` : `/opportunities/${opportunityId}`, "Files need to be 1.5 MB or smaller."));
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    filename = file.name.replace(/[^\w.\- ()]+/g, "_").slice(0, 140) || filename;
    mediaType = file.type || "application/octet-stream";
    byteSize = bytes.length;
    base64 = bytes.toString("base64");
    if (!extracted) {
      if (/text|json|csv|markdown|xml/.test(mediaType) || /\.(txt|md|csv|json)$/i.test(filename)) {
        extracted = bytes.toString("utf8");
      } else if (/\.pdf$/i.test(filename)) {
        extracted = pdfText(bytes);
      }
    }
  }
  extracted = extracted.trim();
  if (!extracted && !base64) {
    redirect(withNotice(orgId ? `/customers/${orgId}/documents` : `/opportunities/${opportunityId}?org=${orgId ?? ""}`, "Add a file or paste the document text."));
  }
  const kind = clip(String(formData.get("kind") ?? "other"), 40);
  const who = await actor();
  const docId = newId("doc");
  let extractionSummary = extracted
    ? "Text stored."
    : "File stored. Paste the text as well if this format could not be read.";
  const org = orgId ? await getOrganization(orgId) : null;
  if (org && extracted && !opportunityId) {
    const patches = extractProfilePatches(extracted);
    const applied: string[] = [];
    const suggested: string[] = [];
    for (const patch of patches) {
      const column = FIELD_COLUMNS[patch.field];
      if (!column) continue;
      const camel: Record<string, keyof NonNullable<typeof org>> = {
        summary: "summary",
        capabilities: "capabilities",
        past_performance: "pastPerformance",
        certifications: "certifications",
        naics: "naics",
        uei: "uei",
        cage: "cage",
        socioeconomic: "socioeconomic",
      };
      const current = String(org[camel[patch.field]] ?? "");
      if (!current.trim()) {
        const merged = mergeField(patch.field, current, patch.value, patch.replace);
        await sql(`update organizations set ${column} = $1 where id = $2`, [merged, org.id]);
        (org as unknown as Record<string, string>)[camel[patch.field]] = merged;
        await sql(
          `insert into profile_facts (id, organization_id, field, value, source_label) values ($1,$2,$3,$4,$5)`,
          [newId("fact"), org.id, patch.field, merged, filename],
        );
        applied.push(fieldLabel(patch.field));
      } else {
        await sql(
          `insert into profile_suggestions (id, organization_id, field, value, source_label, status) values ($1,$2,$3,$4,$5,'open')`,
          [newId("sug"), org.id, patch.field, patch.value, filename],
        );
        suggested.push(fieldLabel(patch.field));
      }
    }
    extractionSummary = [
      applied.length ? `Filled ${applied.join(", ")}.` : "",
      suggested.length ? `Suggested updates for ${suggested.join(", ")} because those fields already had text.` : "",
      !applied.length && !suggested.length ? "No structured profile fields were detected. The text is stored with the customer." : "",
    ].filter(Boolean).join(" ");
  }
  await sql(
    `insert into documents (
      id, organization_id, opportunity_id, kind, filename, media_type, byte_size, extracted_text, extraction_summary, uploaded_by, content_base64
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [docId, orgId, opportunityId, kind, filename, mediaType, byteSize, extracted.slice(0, 200_000), extractionSummary, who.name, base64],
  );
  let added = 0;
  if (opportunityId && orgId && extracted && formData.get("pull") === "on") {
    added = await appendRequirements(orgId, opportunityId, extracted, filename);
    extractionSummary += added ? ` Requirements Reader added ${added} checklist lines.` : " Requirements Reader found no new shall or must lines.";
    await sql("update documents set extraction_summary = $1 where id = $2", [extractionSummary, docId]);
  }
  await logActivity(
    orgId,
    opportunityId && formData.get("pull") === "on" ? "Requirements Reader" : who.name,
    opportunityId && formData.get("pull") === "on" ? "agent" : who.kind,
    opportunityId
      ? `Stored ${filename} on the notice${added ? ` and added ${added} checklist lines` : ""}.`
      : `Stored ${filename} on the customer profile.`,
    opportunityId ? `/opportunities/${opportunityId}?org=${orgId ?? ""}` : `/customers/${orgId}/documents`,
  );
  const back = opportunityId
    ? `/opportunities/${opportunityId}?org=${orgId ?? ""}`
    : `/customers/${orgId}/documents`;
  redirect(withNotice(back, extractionSummary));
}

async function appendRequirements(orgId: string, opportunityId: string, text: string, source: string): Promise<number> {
  const opp = await getOpportunity(opportunityId);
  if (!opp) return 0;
  const checklistId = await ensureChecklist(orgId, opp.id, opp.number, opp.closesOn);
  const existing = await sql<{ detail: string; position: number }>(
    "select detail, position from checklist_items where checklist_id = $1",
    [checklistId],
  );
  const have = new Set(existing.map((row) => row.detail.toLowerCase()));
  let position = existing.reduce((max, row) => Math.max(max, Number(row.position)), 0);
  const today = federalToday();
  const drafts = extractRequirements(text);
  let added = 0;
  for (const draft of drafts) {
    if (have.has(draft.detail.toLowerCase())) continue;
    position += 1;
    const phase = phaseFor(draft.detail);
    const scheduled = buildChecklist({
      instrument: opp.instrument,
      description: draft.detail,
      eligibility: "",
      closesOn: opp.closesOn,
      number: opp.number,
      today,
    });
    const due = scheduled[scheduled.length - 1]?.dueOn ?? opp.closesOn;
    await sql(
      `insert into checklist_items (id, checklist_id, position, phase, title, detail, source_ref, due_on, status, evidence)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'open','')`,
      [newId("item"), checklistId, position, phase, draft.title, draft.detail, source, due],
    );
    added += 1;
  }
  return added;
}

async function ensureChecklist(orgId: string, opportunityId: string, number: string, closesOn: string | null): Promise<string> {
  const existing = await sql<{ id: string }>(
    "select id from checklists where organization_id = $1 and opportunity_id = $2",
    [orgId, opportunityId],
  );
  if (existing[0]) return existing[0].id;
  const id = newId("chk");
  await sql(
    `insert into checklists (id, organization_id, opportunity_id, title, closes_on) values ($1,$2,$3,$4,$5)`,
    [id, orgId, opportunityId, `Submission checklist · ${number || "notice"}`, closesOn],
  );
  return id;
}

export async function addPodMember(formData: FormData) {
  await requireSignedIn();
  const orgId = safeId(formData.get("org"));
  const memberId = safeId(formData.get("member"));
  const role = clip(String(formData.get("podRole") ?? "support"), 40);
  await sql(
    `insert into assignments (id, organization_id, member_id, pod_role) values ($1,$2,$3,$4)
     on conflict (organization_id, member_id) do update set pod_role = excluded.pod_role`,
    [newId("asg"), orgId, memberId, role],
  );
  const who = await actor();
  await logActivity(orgId, who.name, who.kind, "Updated the capture pod.", `/customers/${orgId}/pod`);
  redirect(withNotice(`/customers/${orgId}/pod`, "Pod updated."));
}

export async function setMatchStatus(formData: FormData) {
  await requireSignedIn();
  const orgId = safeId(formData.get("org"));
  const opportunityId = safeId(formData.get("opportunity"));
  const status = String(formData.get("status") ?? "");
  if (!["watching", "pursuing", "passed", "untracked"].includes(status)) redirect(`/customers/${orgId}/opportunities`);
  const org = await getOrganization(orgId);
  const opp = await getOpportunity(opportunityId);
  if (!org || !opp) redirect("/customers");
  if (status === "untracked") {
    await sql("delete from matches where organization_id = $1 and opportunity_id = $2", [orgId, opportunityId]);
  } else {
    const fit = scoreFit(toProfile(org), toNotice(opp), federalToday());
    await sql(
      `insert into matches (id, organization_id, opportunity_id, score, summary, dimensions_json, status)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (organization_id, opportunity_id)
       do update set score = excluded.score, summary = excluded.summary, dimensions_json = excluded.dimensions_json, status = excluded.status`,
      [newId("match"), orgId, opportunityId, fit.score, fit.summary, JSON.stringify(fit.dimensions), status],
    );
  }
  const who = await actor();
  await logActivity(orgId, who.name, who.kind, `Marked ${opp.number || opp.title} as ${status}.`, `/opportunities/${opportunityId}?org=${orgId}`);
  const back = String(formData.get("back") ?? "");
  redirect(withNotice(safeBack(back, `/opportunities/${opportunityId}?org=${orgId}`), "Tracking updated."));
}

export async function createChecklist(formData: FormData) {
  await requireSignedIn();
  const orgId = safeId(formData.get("org"));
  const opportunityId = safeId(formData.get("opportunity"));
  const org = await getOrganization(orgId);
  const opp = await getOpportunity(opportunityId);
  if (!org || !opp) redirect("/customers");
  const existing = await sql<{ id: string }>(
    "select id from checklists where organization_id = $1 and opportunity_id = $2",
    [orgId, opportunityId],
  );
  if (existing[0]) {
    const project = await sql<{ id: string }>("select id from projects where checklist_id = $1", [existing[0].id]);
    if (project[0]) {
      redirect(withNotice(`/opportunities/${opportunityId}?org=${orgId}`, "A project already holds this checklist. Add source text to append requirements."));
    }
    await sql("delete from checklist_items where checklist_id = $1", [existing[0].id]);
    await sql("delete from checklists where id = $1", [existing[0].id]);
  }
  const items = buildChecklist({
    instrument: opp.instrument,
    description: `${opp.description}\n${await sourceText(opportunityId)}`,
    eligibility: opp.eligibility,
    closesOn: opp.closesOn,
    number: opp.number,
    today: federalToday(),
  });
  const checklistId = newId("chk");
  await sql(
    `insert into checklists (id, organization_id, opportunity_id, title, closes_on) values ($1,$2,$3,$4,$5)`,
    [checklistId, orgId, opportunityId, `Submission checklist · ${opp.number || opp.title}`, opp.closesOn],
  );
  for (const [index, item] of items.entries()) {
    await sql(
      `insert into checklist_items (id, checklist_id, position, phase, title, detail, source_ref, due_on, status, evidence)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'open','')`,
      [newId("item"), checklistId, index + 1, item.phase, item.title, item.detail, item.sourceRef, item.dueOn],
    );
  }
  await logActivity(orgId, "Schedule Keeper", "agent", `Built a ${items.length}-line checklist for ${opp.number || opp.title}.`, `/opportunities/${opportunityId}?org=${orgId}`);
  redirect(withNotice(`/opportunities/${opportunityId}?org=${orgId}`, `Checklist built with ${items.length} lines.`));
}

async function sourceText(opportunityId: string): Promise<string> {
  const rows = await sql<{ extracted_text: string }>(
    "select extracted_text from documents where opportunity_id = $1 order by created_at",
    [opportunityId],
  );
  return rows.map((row) => row.extracted_text).join("\n");
}

export async function saveChecklist(formData: FormData) {
  await requireSignedIn();
  const orgId = safeId(formData.get("org"));
  const opportunityId = safeId(formData.get("opportunity"));
  const ids = formData.getAll("item").map((value) => safeId(value));
  for (const id of ids) {
    const status = String(formData.get(`status_${id}`) ?? "open");
    const safeStatus = ["open", "met", "gap", "waived"].includes(status) ? status : "open";
    const due = String(formData.get(`due_${id}`) ?? "");
    const dueOn = /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null;
    const evidence = clip(String(formData.get(`evidence_${id}`) ?? ""), 1000);
    await sql(
      "update checklist_items set status = $1, due_on = $2, evidence = $3 where id = $4",
      [safeStatus, dueOn, evidence, id],
    );
  }
  redirect(withNotice(`/opportunities/${opportunityId}?org=${orgId}`, "Checklist saved."));
}

export async function addChecklistItem(formData: FormData) {
  await requireSignedIn();
  const orgId = safeId(formData.get("org"));
  const opportunityId = safeId(formData.get("opportunity"));
  const title = clip(String(formData.get("title") ?? ""), 180);
  if (title.length < 3) redirect(withNotice(`/opportunities/${opportunityId}?org=${orgId}`, "Give the checklist line a title."));
  const opp = await getOpportunity(opportunityId);
  if (!opp) redirect("/customers");
  const checklistId = await ensureChecklist(orgId, opportunityId, opp.number, opp.closesOn);
  const rows = await sql<{ position: number }>("select coalesce(max(position), 0)::int as position from checklist_items where checklist_id = $1", [checklistId]);
  const phase = phaseFor(`${title} ${String(formData.get("detail") ?? "")}`);
  await sql(
    `insert into checklist_items (id, checklist_id, position, phase, title, detail, source_ref, due_on, status, evidence)
     values ($1,$2,$3,$4,$5,$6,'Added on the desk',$7,'open','')`,
    [newId("item"), checklistId, num(rows[0]?.position) + 1, phase, title, clip(String(formData.get("detail") ?? ""), 1000), opp.closesOn],
  );
  redirect(withNotice(`/opportunities/${opportunityId}?org=${orgId}`, "Checklist line added."));
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function convertToProject(formData: FormData) {
  await requireSignedIn();
  const orgId = safeId(formData.get("org"));
  const opportunityId = safeId(formData.get("opportunity"));
  const org = await getOrganization(orgId);
  const opp = await getOpportunity(opportunityId);
  if (!org || !opp) redirect("/customers");
  const lists = await sql<{ id: string }>(
    "select id from checklists where organization_id = $1 and opportunity_id = $2",
    [orgId, opportunityId],
  );
  if (!lists[0]) redirect(withNotice(`/opportunities/${opportunityId}?org=${orgId}`, "Build a checklist before opening a project."));
  const existing = await sql<{ id: string }>("select id from projects where checklist_id = $1", [lists[0].id]);
  if (existing[0]) redirect(`/projects/${existing[0].id}`);
  const items = await sql<Record<string, unknown>>(
    "select * from checklist_items where checklist_id = $1 order by position",
    [lists[0].id],
  );
  const podRows = await listPod(orgId);
  const pod = podRows.map((row) => ({ id: String(row.id), kind: String(row.kind), podRole: String(row.pod_role) }));
  const projectId = newId("prj");
  await sql(
    `insert into projects (id, organization_id, opportunity_id, checklist_id, name, status, closes_on)
     values ($1,$2,$3,$4,$5,'active',$6)`,
    [projectId, orgId, opportunityId, lists[0].id, `${org.name} · ${opp.number || opp.title}`, opp.closesOn],
  );
  for (const item of items) {
    await sql(
      `insert into tasks (
        id, project_id, checklist_item_id, position, phase, title, detail, assignee_id, status, due_on, work_product
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,'backlog',$9,'')`,
      [
        newId("task"),
        projectId,
        item.id,
        item.position,
        item.phase,
        item.title,
        item.detail,
        assigneeFor(String(item.phase), pod),
        item.due_on,
      ],
    );
  }
  const who = await actor();
  await logActivity(orgId, who.name, who.kind, `Turned the ${opp.number || "notice"} checklist into a capture project.`, `/projects/${projectId}`);
  redirect(withNotice(`/projects/${projectId}`, "Project opened. Tasks are assigned across the pod."));
}

export async function updateTask(formData: FormData) {
  await requireSignedIn();
  const taskId = safeId(formData.get("task"));
  const rows = await sql<Record<string, unknown>>(
    `select t.*, p.id as project_id, p.organization_id from tasks t join projects p on p.id = t.project_id where t.id = $1`,
    [taskId],
  );
  const task = rows[0];
  if (!task) redirect("/");
  const status = String(formData.get("status") ?? task.status);
  const safeStatus = ["backlog", "in_progress", "review", "done"].includes(status) ? status : String(task.status);
  const assignee = String(formData.get("assignee") ?? "");
  const assigneeId = assignee ? safeId(assignee) : null;
  await sql("update tasks set status = $1, assignee_id = $2 where id = $3", [safeStatus, assigneeId, taskId]);
  if (task.checklist_item_id) {
    const itemStatus = safeStatus === "done" ? "met" : "open";
    await sql("update checklist_items set status = $1 where id = $2 and status <> 'waived'", [itemStatus, task.checklist_item_id]);
  }
  const note = clip(String(formData.get("note") ?? ""), 2000);
  const who = await actor();
  if (note) {
    await sql(
      `insert into task_notes (id, task_id, author_name, author_kind, author_side, body) values ($1,$2,$3,$4,$5,$6)`,
      [newId("note"), taskId, who.name, who.kind, who.side, note],
    );
  }
  redirect(withNotice(`/projects/${task.project_id}`, "Task updated."));
}

export async function runAgent(formData: FormData) {
  await requireSignedIn();
  const taskId = safeId(formData.get("task"));
  const rows = await sql<Record<string, unknown>>(
    `select t.*, p.organization_id, p.opportunity_id, p.id as project_id, m.name as assignee_name, m.kind as assignee_kind
     from tasks t
     join projects p on p.id = t.project_id
     left join team_members m on m.id = t.assignee_id
     where t.id = $1`,
    [taskId],
  );
  const task = rows[0];
  if (!task) redirect("/");
  if (task.assignee_kind !== "agent") {
    redirect(withNotice(`/projects/${task.project_id}`, "Assign a desk agent before asking for a draft."));
  }
  const org = await getOrganization(String(task.organization_id));
  const opp = await getOpportunity(String(task.opportunity_id));
  if (!org || !opp) redirect(`/projects/${task.project_id}`);
  const work = draftWorkProduct({
    phase: String(task.phase),
    title: String(task.title),
    detail: String(task.detail),
    profile: toProfile(org),
    notice: toNotice(opp),
    agentName: String(task.assignee_name ?? "Desk agent"),
  });
  await sql("update tasks set work_product = $1, status = 'review' where id = $2", [work, taskId]);
  await sql(
    `insert into task_notes (id, task_id, author_name, author_kind, author_side, body) values ($1,$2,$3,'agent','govclaw',$4)`,
    [newId("note"), taskId, String(task.assignee_name ?? "Desk agent"), "Filed a work product from the profile and the requirement. A human still has to review it."],
  );
  await logActivity(org.id, String(task.assignee_name ?? "Desk agent"), "agent", `Drafted work for “${task.title}”.`, `/projects/${task.project_id}`);
  redirect(withNotice(`/projects/${task.project_id}`, `${task.assignee_name} filed a work product for review.`));
}

async function proposalContext(proposalId: string) {
  const rows = await sql<Record<string, unknown>>(
    `select p.*, o.name, o.legal_name, o.entity_type, o.socioeconomic, o.naics, o.summary, o.capabilities,
            o.past_performance, o.certifications, o.annual_revenue, o.employee_count, o.city, o.state,
            n.title as opp_title, n.agency, n.instrument, n.naics as opp_naics, n.set_aside, n.description,
            n.eligibility, n.closes_on, n.award_ceiling, n.number
     from proposals p
     join organizations o on o.id = p.organization_id
     join opportunities n on n.id = p.opportunity_id
     where p.id = $1`,
    [proposalId],
  );
  return rows[0] ?? null;
}

export async function openProposal(formData: FormData) {
  await requireSignedIn();
  const orgId = safeId(formData.get("org"));
  const opportunityId = safeId(formData.get("opportunity"));
  const existing = await sql<{ id: string }>(
    "select id from proposals where organization_id = $1 and opportunity_id = $2",
    [orgId, opportunityId],
  );
  if (existing[0]) redirect(`/proposals/${existing[0].id}`);
  const org = await getOrganization(orgId);
  const opp = await getOpportunity(opportunityId);
  if (!org || !opp) redirect("/customers");
  const project = await sql<{ id: string }>(
    "select id from projects where organization_id = $1 and opportunity_id = $2",
    [orgId, opportunityId],
  );
  const proposalId = newId("prop");
  await sql(
    `insert into proposals (id, organization_id, opportunity_id, project_id, title, status, win_themes, approach_notes, constraints)
     values ($1,$2,$3,$4,$5,'drafting','','','')`,
    [proposalId, orgId, opportunityId, project[0]?.id ?? null, `${org.name} · ${opp.title}`],
  );
  await generateInto(proposalId, "Generated from the company profile and the notice.");
  redirect(`/proposals/${proposalId}`);
}

async function generateInto(proposalId: string, changeNote: string) {
  const row = await proposalContext(proposalId);
  if (!row) return;
  const pod = await listPod(String(row.organization_id));
  const who = await actor();
  const body = draftProposal({
    profile: {
      name: String(row.name),
      legalName: String(row.legal_name),
      entityType: String(row.entity_type),
      socioeconomic: String(row.socioeconomic ?? ""),
      naics: String(row.naics ?? ""),
      summary: String(row.summary ?? ""),
      capabilities: String(row.capabilities ?? ""),
      pastPerformance: String(row.past_performance ?? ""),
      certifications: String(row.certifications ?? ""),
      annualRevenue: Number(row.annual_revenue ?? 0),
      employeeCount: Number(row.employee_count ?? 0),
      city: String(row.city ?? ""),
      state: String(row.state ?? ""),
    },
    notice: {
      title: String(row.opp_title),
      agency: String(row.agency ?? ""),
      instrument: String(row.instrument),
      naics: String(row.opp_naics ?? ""),
      setAside: String(row.set_aside ?? ""),
      description: String(row.description ?? ""),
      eligibility: String(row.eligibility ?? ""),
      closesOn: row.closes_on ? String(row.closes_on) : null,
      awardCeiling: row.award_ceiling == null ? null : Number(row.award_ceiling),
      number: String(row.number ?? ""),
    },
    winThemes: String(row.win_themes ?? ""),
    approachNotes: String(row.approach_notes ?? ""),
    constraints: String(row.constraints ?? ""),
    team: pod.map((member) => ({ name: String(member.name), kind: String(member.kind), role: String(member.role) })),
    today: federalToday(),
  });
  const version = await nextVersion(proposalId);
  await sql(
    `insert into proposal_versions (id, proposal_id, version_number, body, author_name, author_side, author_kind, change_note)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [newId("ver"), proposalId, version, body, who.kind === "unsigned" ? "Narrative Drafter" : who.name, "govclaw", who.kind === "person" ? "person" : "agent", changeNote],
  );
  await sql("update proposals set status = 'client_review' where id = $1", [proposalId]);
  await logActivity(String(row.organization_id), who.name, who.kind, `Saved proposal version ${version}.`, `/proposals/${proposalId}`);
}

async function nextVersion(proposalId: string): Promise<number> {
  const rows = await sql<{ version: number }>(
    "select coalesce(max(version_number), 0)::int as version from proposal_versions where proposal_id = $1",
    [proposalId],
  );
  return Number(rows[0]?.version ?? 0) + 1;
}

export async function saveProposalInputs(formData: FormData) {
  await requireSignedIn();
  const id = safeId(formData.get("proposal"));
  await sql(
    "update proposals set win_themes = $2, approach_notes = $3, constraints = $4 where id = $1",
    [
      id,
      clip(String(formData.get("winThemes") ?? ""), 4000),
      clip(String(formData.get("approachNotes") ?? ""), 8000),
      clip(String(formData.get("constraints") ?? ""), 4000),
    ],
  );
  redirect(withNotice(`/proposals/${id}`, "Customer inputs saved. Generate a draft when you want them in the proposal."));
}

export async function generateProposal(formData: FormData) {
  await requireSignedIn();
  const id = safeId(formData.get("proposal"));
  await sql(
    "update proposals set win_themes = $2, approach_notes = $3, constraints = $4 where id = $1",
    [
      id,
      clip(String(formData.get("winThemes") ?? ""), 4000),
      clip(String(formData.get("approachNotes") ?? ""), 8000),
      clip(String(formData.get("constraints") ?? ""), 4000),
    ],
  );
  await generateInto(id, clip(String(formData.get("changeNote") ?? "") || "Generated from the profile, notice, and customer inputs.", 240));
  redirect(withNotice(`/proposals/${id}`, "New draft generated as the next version."));
}

export async function saveProposalVersion(formData: FormData) {
  await requireSignedIn();
  const id = safeId(formData.get("proposal"));
  const body = String(formData.get("body") ?? "").slice(0, 200_000);
  if (body.trim().length < 20) redirect(withNotice(`/proposals/${id}`, "The draft is too short to save as a version."));
  const who = await actor();
  const side = formData.get("side") === "client" ? "client" : "govclaw";
  const version = await nextVersion(id);
  await sql(
    `insert into proposal_versions (id, proposal_id, version_number, body, author_name, author_side, author_kind, change_note)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [newId("ver"), id, version, body, who.name, side, who.kind, clip(String(formData.get("changeNote") ?? "") || "Edited on the desk.", 240)],
  );
  await sql("update proposals set status = $2 where id = $1", [id, side === "client" ? "drafting" : "client_review"]);
  const row = await sql<{ organization_id: string }>("select organization_id from proposals where id = $1", [id]);
  await logActivity(row[0]?.organization_id ?? null, who.name, who.kind, `Saved proposal version ${version} as ${side === "client" ? "the client" : "GovClaw"}.`, `/proposals/${id}`);
  redirect(withNotice(`/proposals/${id}`, `Version ${version} saved.`));
}

export async function addProposalNote(formData: FormData) {
  await requireSignedIn();
  const id = safeId(formData.get("proposal"));
  const body = clip(String(formData.get("body") ?? ""), 4000);
  if (!body) redirect(`/proposals/${id}`);
  const who = await actor();
  const side = formData.get("side") === "client" ? "client" : "govclaw";
  await sql(
    `insert into proposal_notes (id, proposal_id, author_name, author_side, author_kind, body) values ($1,$2,$3,$4,$5,$6)`,
    [newId("pnote"), id, who.name, side, who.kind, body],
  );
  redirect(withNotice(`/proposals/${id}`, "Note added."));
}

export async function trackPortalNotice(formData: FormData) {
  await requireSignedIn();
  const orgId = safeId(formData.get("org"));
  const portal = String(formData.get("portal") ?? "");
  const externalId = String(formData.get("externalId") ?? "");
  const org = await getOrganization(orgId);
  if (!org) redirect("/discover");
  const back = `/discover?org=${orgId}&keyword=${encodeURIComponent(String(formData.get("keyword") ?? ""))}&run=1`;
  let hit: PortalHit | null = null;
  try {
    if (portal === "grants.gov") {
      if (!/^\d{1,12}$/.test(externalId)) redirect(withNotice(back, "That Grants.gov id is not usable."));
      const detail = await fetchGrant(externalId);
      hit = { portal: "grants.gov", externalId, partial: false, ...detail };
    } else if (portal === "sam.gov") {
      hit = await fetchSam(externalId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The portal request failed.";
    redirect(withNotice(back, message.replace(/api_key=[^&\s]+/gi, "api_key")));
  }
  if (!hit) redirect(withNotice(back, "The notice could not be retrieved."));
  const existing = await sql<{ id: string }>(
    "select id from opportunities where portal = $1 and external_id = $2",
    [hit.portal, hit.externalId],
  );
  const opportunityId = existing[0]?.id ?? newId("opp");
  if (!existing[0]) {
    await sql(
      `insert into opportunities (
        id, portal, external_id, number, title, agency, agency_code, instrument, naics, set_aside,
        posted_on, closes_on, award_ceiling, description, eligibility, url
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        opportunityId, hit.portal, hit.externalId, hit.number || hit.externalId, hit.title, hit.agency,
        hit.agencyCode, hit.instrument, hit.naics, hit.setAside, hit.postedOn, hit.closesOn, hit.awardCeiling,
        hit.description, hit.eligibility, hit.url,
      ],
    );
  }
  const opp = await getOpportunity(opportunityId);
  if (!opp) redirect(back);
  const fit = scoreFit(toProfile(org), toNotice(opp), federalToday());
  await sql(
    `insert into matches (id, organization_id, opportunity_id, score, summary, dimensions_json, status)
     values ($1,$2,$3,$4,$5,$6,'pursuing')
     on conflict (organization_id, opportunity_id)
     do update set score = excluded.score, summary = excluded.summary, dimensions_json = excluded.dimensions_json, status = 'pursuing'`,
    [newId("match"), orgId, opportunityId, fit.score, fit.summary, JSON.stringify(fit.dimensions)],
  );
  const checklistId = await ensureChecklist(orgId, opportunityId, opp.number, opp.closesOn);
  const count = await sql<{ count: number }>("select count(*)::int as count from checklist_items where checklist_id = $1", [checklistId]);
  if (Number(count[0]?.count ?? 0) === 0) {
    const items = buildChecklist({
      instrument: opp.instrument,
      description: opp.description,
      eligibility: opp.eligibility,
      closesOn: opp.closesOn,
      number: opp.number,
      today: federalToday(),
    });
    for (const [index, item] of items.entries()) {
      await sql(
        `insert into checklist_items (id, checklist_id, position, phase, title, detail, source_ref, due_on, status, evidence)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'open','')`,
        [newId("item"), checklistId, index + 1, item.phase, item.title, item.detail, item.sourceRef, item.dueOn],
      );
    }
  }
  const who = await actor();
  await logActivity(orgId, who.name, who.kind, `Tracked ${opp.number || opp.title} from ${hit.portal}. Fit score ${fit.score}.`, `/opportunities/${opportunityId}?org=${orgId}`);
  redirect(withNotice(`/opportunities/${opportunityId}?org=${orgId}`, `Tracked from ${hit.portal}. Fit score ${fit.score}.`));
}
