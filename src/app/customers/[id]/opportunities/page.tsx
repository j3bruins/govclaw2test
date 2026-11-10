import { notFound } from "next/navigation";
import { setMatchStatus } from "@/lib/actions";
import { federalToday } from "@/lib/dates";
import { getOrganization, scoredOpportunities } from "@/lib/queries";
import { instrumentLabel, keywords, one } from "@/lib/text";
import { FitBlock, Notice, Pill, Portal, Score } from "@/components/widgets";

export const metadata = { title: "Opportunities" };

export default async function OpportunitiesPage({
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
  const portal = one(sp.portal);
  const today = federalToday();
  const rows = (await scoredOpportunities(org)).filter((row) => !portal || row.portal === portal);
  const suggested = keywords(`${org.capabilities} ${org.summary}`, 3).join(" ");
  return (
    <>
      <Notice value={one(sp.notice)} />
      <div className="cluster" style={{ marginBottom: 12 }}>
        <a className="button" href={`/discover?org=${id}&keyword=${encodeURIComponent(suggested)}&run=1`}>Search Grants.gov</a>
        <a className={`button secondary`} href={`/customers/${id}/opportunities`}>All notices</a>
        <a className="button secondary" href={`/customers/${id}/opportunities?portal=sample`}>Sample book</a>
        <a className="button secondary" href={`/customers/${id}/opportunities?portal=grants.gov`}>Grants.gov</a>
        <a className="button secondary" href={`/customers/${id}/opportunities?portal=sam.gov`}>SAM.gov</a>
      </div>
      <p className="muted" style={{ marginBottom: 12 }}>
        Scores weigh capability language, NAICS, eligibility, set-aside, past performance, time to close, and award scale. They are recomputed from the profile on this page.
      </p>
      <div className="stack">
        {rows.map((row) => (
          <article className="panel" key={row.id}>
            <div className="cluster">
              <Score score={row.fit.score} />
              <div>
                <a href={`/opportunities/${row.id}?org=${id}`}><strong>{row.title}</strong></a>
                <div className="muted">{row.agency} · {row.number} · {instrumentLabel(row.instrument)}</div>
              </div>
              <Portal value={row.portal} />
              <Pill value={row.trackStatus} />
            </div>
            <FitBlock fit={row.fit} today={today} closesOn={row.closesOn} />
            <form action={setMatchStatus} className="cluster" style={{ marginTop: 12 }}>
              <input type="hidden" name="org" value={id} />
              <input type="hidden" name="opportunity" value={row.id} />
              <input type="hidden" name="back" value={`/customers/${id}/opportunities`} />
              <button name="status" value="pursuing" type="submit">Pursue</button>
              <button className="secondary" name="status" value="watching" type="submit">Watch</button>
              <button className="secondary" name="status" value="passed" type="submit">Pass</button>
            </form>
          </article>
        ))}
      </div>
    </>
  );
}
