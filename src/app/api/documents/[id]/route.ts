import { sql } from "@/lib/db";
import { currentViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await currentViewer();
  if (!viewer.verified) return new Response("Sign in required", { status: 401, headers: { "cache-control": "private, no-store" } });
  const { id } = await context.params;
  if (!/^[a-z0-9_-]{1,80}$/i.test(id)) {
    return new Response("Not found", { status: 404 });
  }
  const rows = await sql<Record<string, unknown>>("select * from documents where id = $1", [id]);
  const doc = rows[0];
  if (!doc) return new Response("Not found", { status: 404 });
  const filename = String(doc.filename ?? "document.txt").replace(/["\r\n]/g, "");
  const headers = {
    "content-disposition": `attachment; filename="${filename}"`,
    "cache-control": "private, no-store",
  };
  if (doc.content_base64) {
    const bytes = Buffer.from(String(doc.content_base64), "base64");
    return new Response(bytes, {
      headers: { ...headers, "content-type": String(doc.media_type || "application/octet-stream") },
    });
  }
  return new Response(String(doc.extracted_text ?? ""), {
    headers: { ...headers, "content-type": "text/plain; charset=utf-8" },
  });
}
