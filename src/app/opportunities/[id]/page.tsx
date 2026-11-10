import { notFound } from "next/navigation";
import {
  addChecklistItem,
  convertToProject,
  createChecklist,
  openProposal,
  saveChecklist,
  setMatchStatus,
  uploadDocument,
} from "@/lib/actions";
import { closeLabel, money, prettyDate } from "@/lib/dates";
import { federalToday } from "@/lib/dates";
import {
  checklistFor,
  getOpportunity,
  getOrganization,
  listOpportunityDocuments,
  projectByChecklist,
  searchCustomers,
  toNotice,
  toProfile,
} from "@/lib/queries";
import { scoreFit } from "@/lib/scoring";
import { instrumentLabel, one, phaseLabel } from "@/lib/text";
import { FitBlock, Notice, Phase, Pill, Portal } from "@/components/widgets";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = await getOpportunity(id);
  return { title: opp?.title ?? "Notice" };
}

export default async function OpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const opp = await getOpportunity(id);
  if (!opp) notFound();
  const orgId = one(sp.org);
  const q = one(sp.q);
  const org = orgId ? await getOrganization(orgId) : null;
  const today = federalToday();
  const fit = org ? scoreFit(toProfile(org), toNotice(opp), today) : null;
  const checklist = org ? await checklistFor(org.id, opp.id) : null;
  const project = checklist ? await projectByChecklist(String(checklist.list.id)) : null;
  const documents = await listOpportunityDocuments(opp.id);
  const picks = !org && q ? await searchCustomers(q, 8) : [];
  const phases = checklist
    ? [...new Set(checklist.items.map((item) => String(item.phase)))]
    : [];
  return (
    <>
      <p className="kicker"><Portal value={opp.portal} /> · {instrumentLabel(opp.instrument)}</p>
      <div className="page-head">
        <div>
          <h1>{opp.title}</h1>
          <p className="lede">{opp.agency} · {opp.number} · {closeLabel(opp.closesOn, today)} · Ceiling {money(opp.awardCeiling)}</p>
        </div>
        {opp.url ? <a className="button secondary" href={opp.url}>Open the portal record</a> : null}
      </div>
      <Notice value={one(sp.notice)} />
      {!org ? (
        <form className="panel stack" action={`/opportunities/${opp.id}`} method="get">
          <h2>Score this notice against a customer</h2>
          <label className="field">Customer search
            <input type="search" name="q" defaultValue={q} placeholder="Name or city" />
          </label>
          <button type="submit">Find</button>
          <div className="cluster">
            {picks.map((pick) => (
              <a key={pick.id} className="button secondary" href={`/opportunities/${opp.id}?org=${pick.id}`}>{pick.name}</a>
            ))}
          </div>
        </form>
      ) : (
        <section className="panel" style={{ marginBottom: 16 }}>
          <div className="cluster">
            <h2>{org.name}</h2>
            <a href={`/customers/${org.id}`}>Profile</a>
            <a href={`/opportunities/${opp.id}`}>Score someone else</a>
          </div>
          {fit ? <FitBlock fit={fit} today={today} closesOn={opp.closesOn} /> : null}
          <form action={setMatchStatus} className="cluster" style={{ marginTop: 12 }}>
            <input type="hidden" name="org" value={org.id} />
            <input type="hidden" name="opportunity" value={opp.id} />
            <button name="status" value="pursuing" type="submit">Pursue</button>
            <button className="secondary" name="status" value="watching" type="submit">Watch</button>
            <button className="secondary" name="status" value="passed" type="submit">Pass</button>
          </form>
        </section>
      )}
      <div className="split">
        <section className="stack">
          <article className="panel">
            <h2>Notice text</h2>
            <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{opp.description || "No description stored yet."}</p>
            {opp.eligibility ? <p style={{ marginTop: 10 }}><strong>Eligibility. </strong>{opp.eligibility}</p> : null}
            <p className="muted" style={{ marginTop: 8 }}>Posted {prettyDate(opp.postedOn)} · NAICS {opp.naics || "not listed"} · Set-aside {opp.setAside || "not listed"}</p>
          </article>
          <article className="panel">
            <h2>Source documents</h2>
            <div className="stack" style={{ marginTop: 10 }}>
              {documents.map((doc) => (
                <div key={String(doc.id)}>
                  <a href={`/api/documents/${doc.id}`}>{String(doc.filename)}</a>
                  <p className="muted">{String(doc.extraction_summary)}</p>
                </div>
              ))}
            </div>
            <form className="stack" action={uploadDocument} style={{ marginTop: 12 }}>
              {org ? <input type="hidden" name="org" value={org.id} /> : null}
              <input type="hidden" name="opportunity" value={opp.id} />
              <label className="field">Kind
                <select name="kind" defaultValue={opp.instrument === "contract" ? "rfp" : "nofo"}>
                  <option value="nofo">NOFO / funding announcement</option>
                  <option value="rfp">RFP / PWS</option>
                  <option value="amendment">Amendment</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field">File<input type="file" name="file" accept=".txt,.md,.pdf,text/plain" /></label>
              <label className="field">Paste the government text<textarea name="pasted" placeholder="Paste the requirements section." /></label>
              {org ? (
                <label className="cluster">
                  <input type="checkbox" name="pull" value="on" defaultChecked />
                  Have Requirements Reader add shall / must lines to the checklist
                </label>
              ) : <p className="muted">Choose a customer to pull requirements into their checklist.</p>}
              <button type="submit">Store source document</button>
            </form>
          </article>
        </section>
        <section className="stack">
          <article className="panel">
            <h2>Submission checklist</h2>
            {!org ? <p className="muted">Choose a customer to build their checklist.</p> : null}
            {org && !checklist ? (
              <form action={createChecklist}>
                <input type="hidden" name="org" value={org.id} />
                <input type="hidden" name="opportunity" value={opp.id} />
                <p className="lede">Schedule Keeper builds the standard package for this instrument, then adds shall and must lines from the notice and any stored source text. Dates run backward from the close date.</p>
                <button type="submit">Build checklist</button>
              </form>
            ) : null}
            {org && checklist ? (
              <>
                <div className="phasebar" aria-hidden="true">
                  {phases.map((phase) => (
                    <span key={phase} style={{ flex: checklist.items.filter((item) => item.phase === phase).length }}>
                      {phaseLabel(phase)}
                    </span>
                  ))}
                </div>
                <form action={saveChecklist} className="stack">
                  <input type="hidden" name="org" value={org.id} />
                  <input type="hidden" name="opportunity" value={opp.id} />
                  <ol className="timeline">
                    {checklist.items.map((item) => (
                      <li key={String(item.id)}>
                        <div>
                          <strong>{prettyDate(item.due_on ? String(item.due_on) : null)}</strong>
                          <div><Phase value={String(item.phase)} /></div>
                        </div>
                        <div>
                          <input type="hidden" name="item" value={String(item.id)} />
                          <strong>{String(item.title)}</strong>
                          <p className="muted">{String(item.detail)}</p>
                          <p className="muted">{String(item.source_ref)}</p>
                          <div className="fields" style={{ marginTop: 8 }}>
                            <label className="field">Status
                              <select name={`status_${item.id}`} defaultValue={String(item.status)}>
                                <option value="open">Open</option>
                                <option value="met">Met</option>
                                <option value="gap">Gap</option>
                                <option value="waived">Waived</option>
                              </select>
                            </label>
                            <label className="field">Due
                              <input type="date" name={`due_${item.id}`} defaultValue={item.due_on ? String(item.due_on) : ""} />
                            </label>
                            <label className="field wide">Evidence
                              <input name={`evidence_${item.id}`} defaultValue={String(item.evidence ?? "")} placeholder="File name or note" />
                            </label>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <button type="submit">Save checklist</button>
                </form>
                <form action={addChecklistItem} className="stack">
                  <input type="hidden" name="org" value={org.id} />
                  <input type="hidden" name="opportunity" value={opp.id} />
                  <label className="field">Add a line<input name="title" placeholder="Collect the indirect rate agreement" /></label>
                  <label className="field">Detail<textarea name="detail" /></label>
                  <button className="secondary" type="submit">Add line</button>
                </form>
                <div className="cluster">
                  {project ? <a className="button" href={`/projects/${project.id}`}>Open the capture project</a> : (
                    <form action={convertToProject}>
                      <input type="hidden" name="org" value={org.id} />
                      <input type="hidden" name="opportunity" value={opp.id} />
                      <button type="submit">Turn checklist into a project</button>
                    </form>
                  )}
                  <form action={openProposal}>
                    <input type="hidden" name="org" value={org.id} />
                    <input type="hidden" name="opportunity" value={opp.id} />
                    <button className="secondary" type="submit">Open a proposal draft</button>
                  </form>
                  <form action={createChecklist}>
                    <input type="hidden" name="org" value={org.id} />
                    <input type="hidden" name="opportunity" value={opp.id} />
                    <button className="secondary" type="submit" disabled={Boolean(project)}>Rebuild checklist</button>
                  </form>
                </div>
                {project ? <p className="muted">This checklist already feeds a project, so a rebuild is locked. Upload source text to append requirements.</p> : null}
              </>
            ) : null}
          </article>
        </section>
      </div>
    </>
  );
}
