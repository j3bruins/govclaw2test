import { notFound } from "next/navigation";
import { addPodMember } from "@/lib/actions";
import { getOrganization, listBench, listPod } from "@/lib/queries";
import { one } from "@/lib/text";
import { Notice, Pill } from "@/components/widgets";

export const metadata = { title: "Pod" };

export default async function PodPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const org = await getOrganization(id);
  if (!org) notFound();
  const sp = await searchParams;
  const [pod, bench] = await Promise.all([listPod(id), listBench(id)]);
  return (
    <>
      <Notice value={one(sp.notice)} />
      <p className="lede">The pod is the human capture team and the desk agents that draft from the profile. Agents do not invent past performance or rates.</p>
      <div className="split" style={{ marginTop: 16 }}>
        <section className="stack">
          {pod.map((member) => (
            <article className="panel" key={String(member.id)}>
              <div className="cluster">
                <h2 style={{ fontSize: "1.25rem" }}>{String(member.name)}</h2>
                <Pill value={String(member.kind)} />
              </div>
              <p>{String(member.role)} · {String(member.pod_role).replaceAll("_", " ")}</p>
              <p className="muted">{String(member.specialty)}</p>
            </article>
          ))}
          {pod.length === 0 ? <p className="panel">No pod yet. Add people and agents from the bench.</p> : null}
        </section>
        <form className="panel stack" action={addPodMember}>
          <h2>Add to the pod</h2>
          <input type="hidden" name="org" value={id} />
          <label className="field">Bench
            <select name="member" required>
              {bench.map((member) => (
                <option key={String(member.id)} value={String(member.id)}>
                  {String(member.name)} · {String(member.role)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">Role on this customer
            <select name="podRole" defaultValue="support">
              <option value="capture_lead">Capture lead</option>
              <option value="proposal_manager">Proposal manager</option>
              <option value="pricing">Pricing</option>
              <option value="requirements">Requirements</option>
              <option value="narrative">Narrative</option>
              <option value="compliance">Compliance</option>
              <option value="past_performance">Past performance</option>
              <option value="support">Support</option>
            </select>
          </label>
          <button type="submit" disabled={bench.length === 0}>Add</button>
        </form>
      </div>
    </>
  );
}
