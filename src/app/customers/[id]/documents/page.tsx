import { notFound } from "next/navigation";
import { uploadDocument } from "@/lib/actions";
import { getOrganization, listDocuments } from "@/lib/queries";
import { one } from "@/lib/text";
import { Notice, When } from "@/components/widgets";

export const metadata = { title: "Documents" };

export default async function DocumentsPage({
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
  const documents = await listDocuments(id);
  return (
    <>
      <Notice value={one(sp.notice)} />
      <p className="lede">Upload a capability statement, past performance sheet, or SAM registration. Text and Markdown are read in full. A PDF is stored, and plain text inside it is pulled when the file is not compressed. Headings named Summary, Capabilities, and Past performance update the profile. Filled fields become suggestions instead of overwrites.</p>
      <form className="panel stack" action={uploadDocument} style={{ margin: "16px 0" }}>
        <input type="hidden" name="org" value={id} />
        <div className="fields">
          <label className="field">Kind
            <select name="kind" defaultValue="capability_statement">
              <option value="capability_statement">Capability statement</option>
              <option value="past_performance">Past performance</option>
              <option value="sam_registration">SAM registration</option>
              <option value="financials">Financials</option>
              <option value="narrative_notes">Narrative notes</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="field">File
            <input name="file" type="file" accept=".txt,.md,.csv,.json,.pdf,text/plain" />
          </label>
          <label className="field wide">Or paste the text
            <textarea name="pasted" placeholder={"Summary\n...\n\nCapabilities\n...\n\nUEI: ABCDEFGHIJKL\nNAICS: 541512"} />
          </label>
        </div>
        <button type="submit">Read into the profile</button>
      </form>
      <div className="stack">
        {documents.map((doc) => (
          <article className="panel" key={String(doc.id)}>
            <div className="cluster">
              <h2 style={{ fontSize: "1.2rem" }}>{String(doc.filename)}</h2>
              <span className="pill">{String(doc.kind).replaceAll("_", " ")}</span>
            </div>
            <p className="muted"><When value={String(doc.created_at)} /> · {String(doc.uploaded_by)}</p>
            <p style={{ marginTop: 8 }}>{String(doc.extraction_summary)}</p>
            <p style={{ marginTop: 8 }}><a href={`/api/documents/${doc.id}`}>Download</a></p>
            {doc.extracted_text ? (
              <details>
                <summary>Extracted text</summary>
                <pre className="work">{String(doc.extracted_text).slice(0, 4000)}</pre>
              </details>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}
