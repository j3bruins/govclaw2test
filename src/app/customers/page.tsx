import { customerStates, listCustomers, pageFrom } from "@/lib/queries";
import { one, statusLabel } from "@/lib/text";
import { Notice, Pager, Pill } from "@/components/widgets";

export const metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = one(sp.q);
  const status = one(sp.status);
  const state = one(sp.state);
  const origin = one(sp.origin);
  const result = await listCustomers({ q, status, state, origin, page: pageFrom(sp.page) });
  const states = await customerStates();
  const href = (page: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (state) params.set("state", state);
    if (origin) params.set("origin", origin);
    params.set("page", String(page));
    return `/customers?${params.toString()}`;
  };
  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">Customer book</p>
          <h1>Companies the desk can service</h1>
          <p className="lede">
            The book opens with {result.total.toLocaleString("en-US")} records under the current filter.
            Demonstration companies carry full profiles so fit scoring, checklists, and drafts can be tried at volume.
            Customers you add stay beside them.
          </p>
        </div>
        <a className="button" href="/customers/new">New customer</a>
      </div>
      <Notice value={one(sp.notice)} />
      <form className="panel stack" method="get" action="/customers" style={{ marginBottom: 16 }}>
        <div className="fields">
          <label className="field wide">Search
            <input type="search" name="q" defaultValue={q} placeholder="Name, city, UEI, NAICS" />
          </label>
          <label className="field">Status
            <select name="status" defaultValue={status}>
              <option value="">Any status</option>
              <option value="capture">In capture</option>
              <option value="active">Active</option>
              <option value="prospect">Prospect</option>
            </select>
          </label>
          <label className="field">State
            <select name="state" defaultValue={state}>
              <option value="">Any state</option>
              {states.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="field">Origin
            <select name="origin" defaultValue={origin}>
              <option value="">All records</option>
              <option value="demo">Demonstration book</option>
              <option value="added">Added on this desk</option>
            </select>
          </label>
        </div>
        <div className="cluster">
          <button type="submit">Apply</button>
          <a className="button secondary" href="/customers">Clear</a>
        </div>
      </form>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Customer</th><th>Place</th><th>NAICS</th><th>Status</th></tr>
          </thead>
          <tbody>
            {result.rows.map((org) => (
              <tr key={org.id}>
                <td>
                  <a href={`/customers/${org.id}`}><strong>{org.name}</strong></a>
                  <div className="muted">{org.socioeconomic || org.entityType}{org.demo ? "" : " · Added"}</div>
                </td>
                <td>{org.city}{org.state ? `, ${org.state}` : ""}</td>
                <td>{org.naics || "—"}</td>
                <td><Pill value={org.status} /><div className="muted">{statusLabel(org.entityType)}</div></td>
              </tr>
            ))}
            {result.rows.length === 0 ? (
              <tr><td colSpan={4}>No customers match that search.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Pager page={result.page} pages={result.pages} total={result.total} href={href} />
    </>
  );
}
