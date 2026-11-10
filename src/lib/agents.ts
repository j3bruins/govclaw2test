import type { FitNotice, FitProfile } from "./types";

export function draftWorkProduct(input: {
  phase: string;
  title: string;
  detail: string;
  profile: FitProfile;
  notice: FitNotice;
  agentName: string;
}): string {
  const capability = input.profile.capabilities.trim() || "No capability language is on the profile yet.";
  const past = input.profile.pastPerformance.trim() || "No past performance is on the profile yet.";
  if (input.phase === "eligibility") {
    return [
      `${input.agentName} checked eligibility for ${input.profile.name}.`,
      `Entity type on the profile: ${input.profile.entityType || "not recorded"}. Socioeconomic status: ${input.profile.socioeconomic || "not recorded"}.`,
      `Notice eligibility: ${input.notice.eligibility.trim() || "not stored"}.`,
      `Set-aside: ${input.notice.setAside.trim() || "not stored"}.`,
      "A capture lead still has to confirm SAM.gov is active on the day of submission.",
    ].join("\n\n");
  }
  if (input.phase === "past_performance") {
    return [
      `${input.agentName} pulled past performance already on the profile. Nothing new was invented.`,
      past,
      "Ask the customer to confirm the period of performance, contract numbers, and points of contact before this goes into a volume.",
    ].join("\n\n");
  }
  if (input.phase === "pricing") {
    return [
      `${input.agentName} sketched a budget shell. Rates and hours are intentionally blank.`,
      `Award ceiling on the notice: ${input.notice.awardCeiling == null ? "not listed" : input.notice.awardCeiling}.`,
      `Recorded annual revenue: ${input.profile.annualRevenue || "not recorded"}.`,
      "Labor categories: [name them from the notice]. Hours: [insert]. Rate: [insert negotiated rate]. Other direct costs: [insert].",
      "A pricing lead has to replace every bracketed item before review.",
    ].join("\n\n");
  }
  if (input.phase === "staffing") {
    return [
      `${input.agentName} listed staffing questions for ${input.title}.`,
      "Name the key person, their role on this pursuit, current employer, and percent of time available.",
      "Do not attach a resume until the customer confirms it is current.",
    ].join("\n\n");
  }
  if (input.phase === "review" || input.phase === "submission") {
    return [
      `${input.agentName} wrote a compliance row.`,
      `Requirement: ${input.detail || input.title}`,
      `Profile language to point at: ${capability.slice(0, 500)}`,
      "Status: open until a human marks the checklist item met and names the file that satisfies it.",
    ].join("\n\n");
  }
  return [
    `${input.agentName} drafted a starting paragraph for "${input.title}."`,
    input.detail || "The checklist item has no longer requirement text.",
    capability,
    "Edit this into the proposal volume. The paragraph only restates the profile and the requirement.",
  ].join("\n\n");
}

export function assigneeFor(
  phase: string,
  pod: { id: string; kind: string; podRole: string }[],
): string | null {
  const byRole = (role: string) => pod.find((member) => member.podRole === role)?.id ?? null;
  const byId = (id: string) => pod.find((member) => member.id === id)?.id ?? null;
  const human = pod.find((member) => member.kind === "human")?.id ?? null;
  const agent = pod.find((member) => member.kind === "agent")?.id ?? null;
  if (phase === "eligibility" || phase === "submission") return byRole("capture_lead") ?? human;
  if (phase === "staffing") return byRole("proposal_manager") ?? human;
  if (phase === "pricing") return byRole("pricing") ?? byRole("proposal_manager") ?? human;
  if (phase === "past_performance") return byId("agt_past") ?? agent ?? human;
  if (phase === "review") return byId("agt_matrix") ?? agent ?? human;
  return byId("agt_narrative") ?? agent ?? human;
}
