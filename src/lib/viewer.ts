import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getIdentity } from "../../cursor/identity.js";

declare module "../../cursor/identity.js" {
  export function getIdentity(request: unknown): Promise<
    | { verified: false; reason: string }
    | {
        verified: true;
        name: string;
        email: string;
        kind: string;
        simulated?: boolean;
        stage?: string;
        sub: string;
      }
  >;
}

export type DeskViewer = {
  label: string;
  detail: string;
  kind: "person" | "key" | "unsigned";
  simulated: boolean;
  verified: boolean;
};

export async function currentViewer(): Promise<DeskViewer> {
  const identity = await getIdentity(await headers());
  if (!identity.verified) {
    return {
      label: "Unsigned session",
      detail: "No verified viewer on this request.",
      kind: "unsigned",
      simulated: false,
      verified: false,
    };
  }
  if (identity.kind === "key") {
    return {
      label: identity.name || "API key",
      detail: "This caller is an API key, not a person.",
      kind: "key",
      simulated: Boolean(identity.simulated),
      verified: true,
    };
  }
  return {
    label: identity.name || "Signed-in viewer",
    detail: identity.email || "Signed-in viewer",
    kind: "person",
    simulated: Boolean(identity.simulated),
    verified: true,
  };
}

export async function requireSignedIn(): Promise<void> {
  const viewer = await currentViewer();
  if (!viewer.verified) redirect("/?notice=Sign+in+to+use+the+desk.");
}

export async function deskSide(): Promise<"govclaw" | "client"> {
  const jar = await cookies();
  return jar.get("govclaw_side")?.value === "client" ? "client" : "govclaw";
}

export async function actor(): Promise<{
  name: string;
  kind: "person" | "key" | "unsigned";
  side: "govclaw" | "client";
}> {
  const [viewer, side] = await Promise.all([currentViewer(), deskSide()]);
  return { name: viewer.label, kind: viewer.kind, side };
}
