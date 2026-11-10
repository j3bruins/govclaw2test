import { Suspense } from "react";
import { DeskSwitch } from "./desk-switch";
import { NavLink } from "./nav-link";
import type { DeskViewer } from "@/lib/viewer";

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 23V9h8.2C20.6 9 20.6 15.2 16.2 15.2H8M16.2 15.2C21 15.2 21 23 16 23H8" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function Shell({
  viewer,
  side,
  children,
}: {
  viewer: DeskViewer;
  side: "govclaw" | "client";
  children: React.ReactNode;
}) {
  return (
    <div className="shell">
      <aside className="rail">
        <a className="brand" href="/">
          <Mark />
          <span>
            <strong>GovClaw</strong>
            <span>Capture desk</span>
          </span>
        </a>
        <nav className="nav">
          <NavLink href="/" exact>Desk</NavLink>
          <NavLink href="/customers">Customers</NavLink>
          <NavLink href="/discover">Discover</NavLink>
          <NavLink href="/pipeline">Pipeline</NavLink>
        </nav>
        <p className="rail-foot">Humans and desk agents share one book of customers, notices, and drafts.</p>
      </aside>
      <div className="main">
        <header className="topbar">
          <form className="finder" action="/customers" method="get">
            <label className="field">
              Find a customer
              <input type="search" name="q" placeholder="Name, city, UEI, NAICS" />
            </label>
          </form>
          <Suspense fallback={null}>
            <DeskSwitch side={side} />
          </Suspense>
          <div className="viewer">
            <strong>{viewer.label}</strong>
            <span>
              {viewer.simulated
                ? "Local preview viewer. Nothing verified this session."
                : viewer.kind === "key"
                  ? viewer.detail
                  : viewer.verified
                    ? viewer.detail
                    : viewer.detail}
            </span>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
