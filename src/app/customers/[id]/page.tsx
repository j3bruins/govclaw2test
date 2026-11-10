import { notFound } from "next/navigation";
import { applySuggestion, dismissSuggestion, saveProfile } from "@/lib/actions";
import { fieldLabel } from "@/lib/profile";
import { getOrganization, listFacts, listSuggestions } from "@/lib/queries";
import { money } from "@/lib/dates";
import { one } from "@/lib/text";
import { Notice, When } from "@/components/widgets";

export const metadata = { title: "Profile" };

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const org = await getOrganization(id);
  if (!org) notFound();
  const [facts, suggestions] = await Promise.all([listFacts(id), listSuggestions(id)]);
  return (
    <>
      <Notice value={one(sp.notice)} />
      {suggestions.length ? (
        <section className="stack" style={{ marginBottom: 16 }}>
          {suggestions.map((suggestion) => (
            <div className="panel" key={String(suggestion.id)}>
              <p className="kicker">Suggested from {String(suggestion.source_label)}</p>
              <h2>{fieldLabel(String(suggestion.field))}</h2>
              <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{String(suggestion.value)}</p>
              <div className="cluster" style={{ marginTop: 10 }}>
                <form action={applySuggestion}>
                  <input type="hidden" name="suggestion" value={String(suggestion.id)} />
                  <button type="submit">Apply to profile</button>
                </form>
                <form action={dismissSuggestion}>
                  <input type="hidden" name="suggestion" value={String(suggestion.id)} />
                  <button className="secondary" type="submit">Dismiss</button>
                </form>
              </div>
            </div>
          ))}
        </section>
      ) : null}
      <form className="panel stack" action={saveProfile}>
        <input type="hidden" name="org" value={org.id} />
        <div className="fields">
          <label className="field">Legal name<input name="legal" defaultValue={org.legalName} /></label>
          <label className="field">Entity
            <select name="entity" defaultValue={org.entityType}>
              <option value="for-profit">For-profit</option>
              <option value="nonprofit">Nonprofit</option>
              <option value="university">University</option>
              <option value="government">Government</option>
            </select>
          </label>
          <label className="field">Socioeconomic<input name="socioeconomic" defaultValue={org.socioeconomic} /></label>
          <label className="field">NAICS<input name="naics" defaultValue={org.naics} /></label>
          <label className="field">City<input name="city" defaultValue={org.city} /></label>
          <label className="field">State<input name="state" defaultValue={org.state} /></label>
          <label className="field">UEI<input name="uei" defaultValue={org.uei} /></label>
          <label className="field">CAGE<input name="cage" defaultValue={org.cage} /></label>
          <label className="field">Annual revenue<input name="revenue" type="number" defaultValue={org.annualRevenue || ""} /></label>
          <label className="field">Employees<input name="employees" type="number" defaultValue={org.employeeCount || ""} /></label>
          <label className="field wide">Summary<textarea name="summary" defaultValue={org.summary} /></label>
          <label className="field wide">Capabilities<textarea name="capabilities" defaultValue={org.capabilities} /></label>
          <label className="field wide">Past performance<textarea name="past_performance" defaultValue={org.pastPerformance} /></label>
          <label className="field wide">Certifications<textarea name="certifications" defaultValue={org.certifications} /></label>
        </div>
        <p className="muted">Revenue on file: {money(org.annualRevenue)}. Saving records an edit on the profile history.</p>
        <button type="submit">Save profile</button>
      </form>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Profile history</h2>
        <ul className="timeline">
          {facts.map((fact) => (
            <li key={String(fact.id)}>
              <When value={String(fact.created_at)} />
              <div>
                <strong>{fieldLabel(String(fact.field))}</strong>
                <p className="muted">{String(fact.source_label)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
