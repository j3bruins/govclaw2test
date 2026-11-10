import { notFound } from "next/navigation";
import { runAgent, updateTask } from "@/lib/actions";
import { closeLabel, prettyDate } from "@/lib/dates";
import { federalToday } from "@/lib/dates";
import { getProject, listPod } from "@/lib/queries";
import { one, phaseLabel, statusLabel } from "@/lib/text";
import { Notice, Phase, Pill, When } from "@/components/widgets";

const COLUMNS = ["backlog", "in_progress", "review", "done"] as const;

export const metadata = { title: "Project" };

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const projectData = await getProject(id);
  if (!projectData) notFound();
  const sp = await searchParams;
  const { project, tasks, notes, proposal } = projectData;
  const pod = await listPod(String(project.organization_id));
  const today = federalToday();
  const notesFor = (taskId: string) => notes.filter((note) => note.task_id === taskId);
  return (
    <>
      <p className="kicker">Capture project</p>
      <div className="page-head">
        <div>
          <h1>{String(project.name)}</h1>
          <p className="lede">
            <a href={`/customers/${project.organization_id}`}>{String(project.org_name)}</a>
            {" · "}
            <a href={`/opportunities/${project.opp_id}?org=${project.organization_id}`}>{String(project.opp_number)}</a>
            {" · "}
            {closeLabel(project.closes_on ? String(project.closes_on) : null, today)}
          </p>
        </div>
        <div className="cluster">
          <Pill value={String(project.status)} />
          {proposal ? <a className="button" href={`/proposals/${proposal.id}`}>Proposal</a> : (
            <a className="button secondary" href={`/opportunities/${project.opp_id}?org=${project.organization_id}`}>Open a proposal from the notice</a>
          )}
        </div>
      </div>
      <Notice value={one(sp.notice)} />
      <div className="phasebar">
        {["eligibility", "technical", "past_performance", "staffing", "pricing", "review", "submission"].map((phase) => {
          const count = tasks.filter((task) => task.phase === phase).length;
          if (!count) return null;
          return <span key={phase} style={{ flex: count }}>{phaseLabel(phase)} · {count}</span>;
        })}
      </div>
      <div className="board">
        {COLUMNS.map((column) => (
          <section className="column" key={column}>
            <h2>{statusLabel(column)} · {tasks.filter((task) => task.status === column).length}</h2>
            {tasks.filter((task) => task.status === column).map((task) => (
              <article className="card" key={String(task.id)}>
                <details>
                  <summary>
                    <strong>{String(task.title)}</strong>
                    <div className="muted">{prettyDate(task.due_on ? String(task.due_on) : null)} · {String(task.assignee_name ?? "Unassigned")}</div>
                    <Phase value={String(task.phase)} />
                  </summary>
                  <p>{String(task.detail)}</p>
                  {task.work_product ? <pre className="work">{String(task.work_product)}</pre> : null}
                  <ul className="timeline">
                    {notesFor(String(task.id)).map((note) => (
                      <li key={String(note.id)}>
                        <When value={String(note.created_at)} />
                        <div>
                          <strong>{String(note.author_name)}</strong> <Pill value={String(note.author_kind)} />
                          <p>{String(note.body)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <form action={updateTask} className="stack" style={{ marginTop: 8 }}>
                    <input type="hidden" name="task" value={String(task.id)} />
                    <label className="field">Status
                      <select name="status" defaultValue={String(task.status)}>
                        {COLUMNS.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                      </select>
                    </label>
                    <label className="field">Assignee
                      <select name="assignee" defaultValue={String(task.assignee_id ?? "")}>
                        <option value="">Unassigned</option>
                        {pod.map((member) => (
                          <option key={String(member.id)} value={String(member.id)}>
                            {String(member.name)} · {String(member.kind)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">Note<textarea name="note" placeholder="What changed" /></label>
                    <button type="submit">Update task</button>
                  </form>
                  {task.assignee_kind === "agent" ? (
                    <form action={runAgent} style={{ marginTop: 8 }}>
                      <input type="hidden" name="task" value={String(task.id)} />
                      <button className="secondary" type="submit">Ask {String(task.assignee_name)} to draft</button>
                    </form>
                  ) : null}
                </details>
              </article>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
