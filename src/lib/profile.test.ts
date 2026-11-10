import assert from "node:assert/strict";
import test from "node:test";
import { extractProfilePatches, mergeField } from "./profile";

test("intake text yields UEI, NAICS, and capability section", () => {
  const text = [
    "Summary",
    "Harbor & Pine Analytics is a woman-owned firm that modernizes public health reporting for states.",
    "",
    "Capabilities",
    "The team builds surveillance dashboards and file-based reporting for epidemiologists in the field.",
    "",
    "UEI: HPINE4K8M2LQ",
    "NAICS: 541511, 541512",
    "WOSB",
  ].join("\n");
  const patches = extractProfilePatches(text);
  assert.ok(patches.some((patch) => patch.field === "uei" && patch.value === "HPINE4K8M2LQ"));
  assert.ok(patches.some((patch) => patch.field === "naics" && patch.value.includes("541511")));
  assert.ok(patches.some((patch) => patch.field === "capabilities"));
  assert.equal(mergeField("certifications", "SAM.gov active", "WOSB, SAM.gov active", false), "SAM.gov active, WOSB");
});
