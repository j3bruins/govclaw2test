import { notFound } from "next/navigation";
import { addProposalNote, generateProposal, saveProposalInputs, saveProposalVersion } from "@/lib/actions";
import { diffLines } from "@/lib/proposals";
import { getProposal } from "@/lib/queries";
import { one } from "@/lib/text";
import { deskSide } from "@/lib/viewer";
import { Markdown } from "@/components/markdown";
import { Notice, Pill, When } from "@/components/widgets";

export const metadata = { title: "Proposal" };

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const data = await getProposal(id);
  if (!data) notFound();
  const sp = await searchParams;
  const side = await deskSide();
  const { proposal, versions, notes } = data;
  const selectedNumber = Number(one(sp.from) || versions[0]?.version_number || 1);
  const selected = versions.find((version) => Number(version.version_number) === selectedNumber) ?? versions[0];
  const compareNumber = Number(one(sp.compare) || 0);
  const compare = versions.find((version) => Number(version.version_number) === compareNumber);
  const diff = selected && compare ? diffLines(String(compare.body), String(selected.body)) : [];
  let sameRun = 0;
  const compact: { type: string; text: string }[] = [];
  for (const line of diff) {
    if (line.type === "same") {
      sameRun += 1;
      continue;
    }
    if (sameRun) compact.push({ type: "skip", text: `${sameRun} unchanged lines` });
    sameRun = 0;
    compact.push(line);
  }
  if (sameRun) compact.push({ type: "skip", text: `${sameRun} unchanged lines` });
  return (
    <>
      <p className="kicker">Proposal studio</p>
      <div className="page-head">
        <div>
          <h1>{String(proposal.opp_title)}</h1>
          <p className="lede">
            <a href={`/customers/${proposal.organization_id}`}>{String(proposal.org_name)}</a>
            {" · "}
            <a href={`/opportunities/${proposal.opp_id}?org=${proposal.organization_id}`}>{String(proposal.opp_number)}</a>
          </p>
        </div>
        <Pill value={String(proposal.status)} />
      </div>
      <Notice value={one(sp.notice)} />
      <div className="split">
        <div className="stack">
          <section className="panel no-print">
            <h2>Customer inputs</h2>
            <p className="muted">These are saved on the proposal. Generating a draft reads them with the profile and the notice, and stores a new version. Earlier versions stay.</p>
            <form className="stack" action={saveProposalInputs}>
              <input type="hidden" name="proposal" value={id} />
              <label className="field">Win themes<textarea name="winThemes" defaultValue={String(proposal.win_themes ?? "")} /></label>
              <label className="field">Approach notes<textarea name="approachNotes" defaultValue={String(proposal.approach_notes ?? "")} /></label>
              <label className="field">Constraints<textarea name="constraints" defaultValue={String(proposal.constraints ?? "")} /></label>
              <div className="cluster">
                <button className="secondary" type="submit">Save inputs</button>
              </div>
            </form>
            <form className="cluster" action={generateProposal}>
              <input type="hidden" name="proposal" value={id} />
              <input type="hidden" name="winThemes" value={String(proposal.win_themes ?? "")} />
              <input type="hidden" name="approachNotes" value={String(proposal.approach_notes ?? "")} />
              <input type="hidden" name="constraints" value={String(proposal.constraints ?? "")} />
              <button type="submit">Generate the next draft from these inputs</button>
            </form>
          </section>
          {selected ? (
            <article className="panel">
              <div className="cluster">
                <h2>Version {String(selected.version_number)}</h2>
                <Pill value={String(selected.author_side)} />
                <span className="muted">{String(selected.author_name)} · {String(selected.change_note)}</span>
              </div>
              <Markdown text={String(selected.body)} />
            </article>
          ) : <p className="panel">No version yet.</p>}
          {compare && selected ? (
            <section className="panel">
              <h2>Changes from version {compareNumber} to version {String(selected.version_number)}</h2>
              <div className="diff">
                {compact.map((line, index) => (
                  <div key={index} className={line.type}>{line.type === "add" ? "+ " : line.type === "del" ? "− " : ""}{line.text}</div>
                ))}
              </div>
            </section>
          ) : null}
          {selected ? (
            <form className="panel stack no-print" action={saveProposalVersion}>
              <h2>Edit and save a new version</h2>
              <input type="hidden" name="proposal" value={id} />
              <label className="field">Draft<textarea name="body" defaultValue={String(selected.body)} style={{ minHeight: 320 }} /></label>
              <label className="field">What changed<input name="changeNote" placeholder="Short note for the version history" /></label>
              <fieldset className="cluster" style={{ border: 0, padding: 0 }}>
                <legend className="muted">Record this edit as</legend>
                <label className="cluster"><input type="radio" name="side" value="govclaw" defaultChecked={side !== "client"} /> GovClaw desk</label>
                <label className="cluster"><input type="radio" name="side" value="client" defaultChecked={side === "client"} /> Client reviewer</label>
              </fieldset>
              <button type="submit">Save version {Number(selected.version_number) + 1}</button>
            </form>
          ) : null}
          <form className="panel stack no-print" action={addProposalNote}>
            <h2>Note</h2>
            <input type="hidden" name="proposal" value={id} />
            <textarea name="body" placeholder="A comment that should not replace the draft." />
            <div className="cluster">
              <label className="cluster"><input type="radio" name="side" value="govclaw" defaultChecked={side !== "client"} /> GovClaw</label>
              <label className="cluster"><input type="radio" name="side" value="client" defaultChecked={side === "client"} /> Client</label>
              <button type="submit">Add note</button>
            </div>
            <ul className="timeline">
              {notes.map((note) => (
                <li key={String(note.id)}>
                  <When value={String(note.created_at)} />
                  <div>
                    <strong>{String(note.author_name)}</strong> <Pill value={String(note.author_side)} />
                    <p>{String(note.body)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </form>
        </div>
        <aside className="stack no-print">
          <div className="panel">
            <h2>Versions</h2>
            <div className="versions">
              {versions.map((version) => (
                <a
                  key={String(version.id)}
                  href={`/proposals/${id}?from=${version.version_number}`}
                  aria-current={Number(version.version_number) === Number(selected?.version_number)}
                >
                  <strong>v{String(version.version_number)}</strong> <Pill value={String(version.author_side)} />
                  <div className="muted">{String(version.author_name)}</div>
                  <div>{String(version.change_note)}</div>
                  <When value={String(version.created_at)} />
                </a>
              ))}
            </div>
          </div>
          {selected && versions.length > 1 ? (
            <div className="panel">
              <h2>Compare</h2>
              <div className="versions">
                {versions.filter((version) => Number(version.version_number) !== Number(selected.version_number)).map((version) => (
                  <a key={String(version.id)} href={`/proposals/${id}?from=${selected.version_number}&compare=${version.version_number}`}>
                    Against v{String(version.version_number)}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
