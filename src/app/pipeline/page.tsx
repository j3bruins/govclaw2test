import { closeLabel } from "@/lib/dates";
import { federalToday } from "@/lib/dates";
import { pipeline } from "@/lib/queries";
import { Pill, Portal, Score } from "@/components/widgets";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const rows = await pipeline();
  const today = federalToday();
  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">Pipeline</p>
          <h1>What the desk is watching</h1>
          <p className="lede">Pursuits and watches across the book, scored again from the current profile. Passed notices stay off this list.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Fit</th><th>Customer</th><th>Notice</th><th>Close</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.organizationId}-${row.opportunity.id}`}>
                <td><Score score={row.fit.score} /></td>
                <td><a href={`/customers/${row.organizationId}`}>{row.orgName}</a><div className="muted">{row.city}, {row.state}</div></td>
                <td>
                  <a href={`/opportunities/${row.opportunity.id}?org=${row.organizationId}`}>{row.opportunity.title}</a>
                  <div className="muted">{row.opportunity.number} · <Portal value={row.opportunity.portal} /></div>
                </td>
                <td>{closeLabel(row.opportunity.closesOn, today)}</td>
                <td><Pill value={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
