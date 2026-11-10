import { closeLabel, prettyDate } from "@/lib/dates";
import { dashboard } from "@/lib/queries";
import { num, one } from "@/lib/text";
import { Notice, Pill, When } from "@/components/widgets";

export default async function DeskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const data = await dashboard();
  return (
    <>
      <Notice value={one(sp.notice)} />
      <div className="page-head">
        <div>
          <p className="kicker">Today on the desk</p>
          <h1>Capture work in motion</h1>
          <p className="lede">
            {data.customers.toLocaleString("en-US")} customers are in the book
            {data.added ? `, including ${data.added} added on this desk` : ""}. Live grant search uses Grants.gov.
            Sample notices are marked so they stay distinct from portal results.
          </p>
        </div>
      </div>
      <section className="stats">
        <div className="stat"><b>{data.customers.toLocaleString("en-US")}</b><span>Customers</span></div>
        <div className="stat"><b>{data.pursuing}</b><span>Pursuits underway</span></div>
        <div className="stat"><b>{data.inReview}</b><span>Tasks in review</span></div>
        <div className="stat"><b>{data.withClient}</b><span>Proposals with the client</span></div>
      </section>
      <div className="split">
        <section className="stack">
          <div className="panel">
            <h2>Submission window</h2>
            <div className="table-wrap" style={{ border: "none" }}>
              <table className="data">
                <thead>
                  <tr><th>Customer</th><th>Notice</th><th>Close</th></tr>
                </thead>
                <tbody>
                  {data.deadlines.map((row) => (
                    <tr key={String(row.project_id)}>
                      <td><a href={`/customers/${row.org_id}`}>{String(row.org_name)}</a></td>
                      <td><a href={`/projects/${row.project_id}`}>{String(row.number)}</a><div className="muted">{String(row.title)}</div></td>
                      <td>{closeLabel(row.closes_on ? String(row.closes_on) : null, data.today)}<div className="muted">{prettyDate(row.closes_on ? String(row.closes_on) : null)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel">
            <h2>Recent desk activity</h2>
            <ul className="timeline">
              {data.activity.map((row, index) => (
                <li key={`${row.created_at}-${index}`}>
                  <When value={String(row.created_at)} />
                  <div>
                    <strong>{String(row.actor_name)}</strong> <Pill value={String(row.actor_kind)} />
                    <p>{row.href ? <a href={String(row.href)}>{String(row.summary)}</a> : String(row.summary)}</p>
                    {row.org_name ? <p className="muted">{String(row.org_name)}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <aside className="panel">
          <h2>Pod load</h2>
          <p className="lede">Open tasks still on someone&apos;s list. Agents stay on the work they were given.</p>
          <table className="data">
            <thead><tr><th>Name</th><th>Open</th></tr></thead>
            <tbody>
              {data.load.map((row) => (
                <tr key={String(row.id)}>
                  <td>
                    {String(row.name)}
                    <div className="muted">{String(row.role)} · {String(row.kind)}</div>
                  </td>
                  <td>{num(row.open_tasks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </aside>
      </div>
    </>
  );
}
