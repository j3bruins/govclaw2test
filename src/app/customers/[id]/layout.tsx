import { notFound } from "next/navigation";
import { NavLink } from "@/components/nav-link";
import { Pill } from "@/components/widgets";
import { getOrganization } from "@/lib/queries";

export default async function CustomerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getOrganization(id);
  if (!org) notFound();
  return (
    <>
      <p className="kicker">{org.demo ? "Demonstration customer" : "Added on this desk"}</p>
      <div className="page-head">
        <div>
          <h1>{org.name}</h1>
          <p className="lede">{org.legalName} · {org.city}{org.state ? `, ${org.state}` : ""} · {org.naics || "NAICS not set"}</p>
        </div>
        <Pill value={org.status} />
      </div>
      <nav className="subnav">
        <NavLink href={`/customers/${id}`} exact>Profile</NavLink>
        <NavLink href={`/customers/${id}/documents`}>Documents</NavLink>
        <NavLink href={`/customers/${id}/pod`}>Pod</NavLink>
        <NavLink href={`/customers/${id}/opportunities`}>Opportunities</NavLink>
        <NavLink href={`/customers/${id}/work`}>Work</NavLink>
      </nav>
      {children}
    </>
  );
}
