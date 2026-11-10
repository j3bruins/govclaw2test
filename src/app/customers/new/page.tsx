import { createOrganization } from "@/lib/actions";
import { one } from "@/lib/text";
import { Notice } from "@/components/widgets";

export const metadata = { title: "New customer" };

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <>
      <p className="kicker">Customer book</p>
      <h1>Add a customer</h1>
      <p className="lede">Start with the legal name and entity type. A capture pod is assigned unless you turn that off. Documents fill the rest of the profile.</p>
      <Notice value={one(sp.notice)} />
      <form className="panel stack" action={createOrganization} style={{ marginTop: 16 }}>
        <div className="fields">
          <label className="field">Customer name
            <input name="name" required placeholder="Harbor & Pine Analytics" />
          </label>
          <label className="field">Legal name
            <input name="legal" placeholder="Same as the customer name if identical" />
          </label>
          <label className="field">Entity
            <select name="entity" defaultValue="for-profit">
              <option value="for-profit">For-profit</option>
              <option value="nonprofit">Nonprofit</option>
              <option value="university">University</option>
              <option value="government">Government</option>
            </select>
          </label>
          <label className="field">Socioeconomic
            <input name="socioeconomic" placeholder="WOSB, 8(a), SDVOSB, nonprofit" />
          </label>
          <label className="field">City<input name="city" /></label>
          <label className="field">State<input name="state" maxLength={2} placeholder="WA" /></label>
          <label className="field">UEI<input name="uei" maxLength={12} /></label>
          <label className="field">CAGE<input name="cage" maxLength={5} /></label>
          <label className="field">Annual revenue<input name="revenue" type="number" min="0" step="1000" /></label>
          <label className="field">Employees<input name="employees" type="number" min="0" step="1" /></label>
        </div>
        <label className="cluster">
          <input type="checkbox" name="pod" value="off" />
          Skip pod assignment
        </label>
        <button type="submit">Add customer</button>
      </form>
    </>
  );
}
