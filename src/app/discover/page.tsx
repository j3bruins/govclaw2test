import { trackPortalNotice } from "@/lib/actions";
import { federalToday } from "@/lib/dates";
import { searchGrantsSafe, searchSamSafe, samReady } from "@/lib/portals";
import { getOrganization, searchCustomers } from "@/lib/queries";
import { scoreFit } from "@/lib/scoring";
import { instrumentLabel, one } from "@/lib/text";
import type { FitNotice, PortalHit } from "@/lib/types";
import { Notice, Score } from "@/components/widgets";

export const metadata = { title: "Discover" };

function asNotice(hit: PortalHit): FitNotice {
  return {
    title: hit.title,
    agency: hit.agency,
    instrument: hit.instrument,
    naics: hit.naics,
    setAside: hit.setAside,
    description: hit.description,
    eligibility: hit.eligibility,
    closesOn: hit.closesOn,
    awardCeiling: hit.awardCeiling,
  };
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = one(sp.q);
  const orgId = one(sp.org);
  const keyword = one(sp.keyword);
  const run = one(sp.run) === "1";
  const org = orgId ? await getOrganization(orgId) : null;
  const picks = q ? await searchCustomers(q, 8) : [];
  const today = federalToday();
  let grantsError = "";
  let samError = "";
  let grantsCount = 0;
  let samCount = 0;
  let hits: PortalHit[] = [];
  if (run && org && keyword.trim()) {
    const [grants, sam] = await Promise.all([searchGrantsSafe(keyword.trim()), searchSamSafe(keyword.trim())]);
    grantsError = grants.error ?? "";
    samError = sam.error ?? "";
    grantsCount = grants.hitCount;
    samCount = sam.hitCount;
    hits = [...grants.hits, ...sam.hits];
  }
  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">Portals</p>
          <h1>Find a notice and score it</h1>
          <p className="lede">
            Grant search calls the public Grants.gov API. SAM.gov contract search runs when a SAM API key is configured
            {samReady() ? " — a key is configured." : ". No key is configured, so contract search stays quiet."}
          </p>
        </div>
      </div>
      <Notice value={one(sp.notice)} />
      <form className="panel stack" action="/discover" method="get" style={{ marginBottom: 16 }}>
        <input type="hidden" name="run" value="1" />
        {org ? <input type="hidden" name="org" value={org.id} /> : null}
        <div className="fields">
          <label className="field">Customer search
            <input type="search" name="q" defaultValue={q} placeholder="Find who to score against" />
          </label>
          <label className="field">Keyword
            <input name="keyword" defaultValue={keyword} placeholder="workforce, brownfields, diagnostics" />
          </label>
        </div>
        {org ? <p>Scoring against <a href={`/customers/${org.id}`}><strong>{org.name}</strong></a>. <a href="/discover">Choose someone else</a></p> : <p className="muted">Choose a customer before searching. The score needs a profile.</p>}
        {picks.length ? (
          <div className="cluster">
            {picks.map((pick) => (
              <a key={pick.id} className="button secondary" href={`/discover?org=${pick.id}&keyword=${encodeURIComponent(keyword)}`}>
                {pick.name}
              </a>
            ))}
          </div>
        ) : null}
        <button type="submit" disabled={!org}>Search portals</button>
      </form>
      {grantsError ? <p className="banner">{grantsError}</p> : null}
      {samError ? <p className="banner">{samError}</p> : null}
      {run && org && keyword.trim() ? (
        <p className="muted" style={{ marginBottom: 12 }}>
          Grants.gov reports {grantsCount.toLocaleString("en-US")} matching posted or forecasted notices. Showing {hits.filter((hit) => hit.portal === "grants.gov").length} with synopses where the detail call succeeded.
          {samReady() ? ` SAM.gov reports ${samCount.toLocaleString("en-US")} contract notices in the search window.` : ""}
        </p>
      ) : null}
      <div className="stack">
        {org ? hits.map((hit) => {
          const fit = scoreFit(
            {
              name: org.name,
              entityType: org.entityType,
              socioeconomic: org.socioeconomic,
              naics: org.naics,
              summary: org.summary,
              capabilities: org.capabilities,
              pastPerformance: org.pastPerformance,
              certifications: org.certifications,
              annualRevenue: org.annualRevenue,
              employeeCount: org.employeeCount,
            },
            asNotice(hit),
            today,
          );
          return (
            <article className="panel" key={`${hit.portal}-${hit.externalId}`}>
              <div className="cluster">
                <Score score={fit.score} />
                <div>
                  <strong>{hit.title}</strong>
                  <div className="muted">{hit.agency} · {hit.number || hit.externalId} · {instrumentLabel(hit.instrument)} · {hit.portal}</div>
                </div>
                {hit.partial ? <span className="pill">Synopsis incomplete</span> : null}
                {hit.url ? <a href={hit.url}>Source</a> : null}
              </div>
              <p className="summary">{fit.summary}</p>
              <form action={trackPortalNotice}>
                <input type="hidden" name="org" value={org.id} />
                <input type="hidden" name="portal" value={hit.portal} />
                <input type="hidden" name="externalId" value={hit.externalId} />
                <input type="hidden" name="keyword" value={keyword} />
                <button type="submit">Track and build a checklist</button>
              </form>
            </article>
          );
        }) : null}
      </div>
    </>
  );
}
