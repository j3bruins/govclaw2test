"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { setDeskSide } from "@/lib/actions";

export function DeskSwitch({ side }: { side: "govclaw" | "client" }) {
  const path = usePathname();
  const search = useSearchParams();
  const query = search.toString();
  const back = query ? `${path}?${query}` : path;
  return (
    <form action={setDeskSide} className="side-switch">
      <input type="hidden" name="back" value={back} />
      <button type="submit" name="side" value="govclaw" aria-pressed={side === "govclaw"}>
        GovClaw desk
      </button>
      <button type="submit" name="side" value="client" aria-pressed={side === "client"}>
        Client reviewer
      </button>
    </form>
  );
}
