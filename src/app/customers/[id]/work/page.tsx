import { notFound } from "next/navigation";
import { closeLabel } from "@/lib/dates";
import { federalToday } from "@/lib/dates";
import { customerWork, getOrganization } from "@/lib/queries";
import { Pill } from "@/components/widgets";

export const metadata = { title: "Work" };

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await getOrganization(id);
  if (!org) notFound();
  const { projects, proposals } = await customerWork(id);
  const today = federalToday();
  return (
    <div className="split">
      <section className="stack">
        <h2>Capture projects</h2>
        {projects.map((project) => (
          <a className="panel" key={String(project.id)} href={`/projects/${project.id}`}>
            <strong>{String(project.name)}</strong>
            <p className="muted">{String(project.number)} · {closeLabel(project.closes_on ? String(project.closes_on) : null, today)}</p>
            <Pill value={String(project.status)} />
          </a>
        ))}
        {projects.length === 0 ? <p className="panel">No project yet. Build a checklist on an opportunity, then turn it into a project.</p> : null}
      </section>
      <section className="stack">
        <h2>Proposals</h2>
        {proposals.map((proposal) => (
          <a className="panel" key={String(proposal.id)} href={`/proposals/${proposal.id}`}>
            <strong>{String(proposal.opp_title)}</strong>
            <p className="muted">Version {String(proposal.versions ?? 0)} · {String(proposal.number)}</p>
            <Pill value={String(proposal.status)} />
          </a>
        ))}
        {proposals.length === 0 ? <p className="panel">No proposal yet. Open one from a notice the customer is pursuing.</p> : null}
      </section>
    </div>
  );
}
