import assert from "node:assert/strict";
import test from "node:test";
import { buildChecklist, extractRequirements } from "./requirements";

const notice = `
The contractor shall deploy asset discovery and vulnerability intake.
The contractor must provide a compliance matrix.
Past performance shall include two relevant efforts.
Proposals must be submitted electronically before the closing time.
A page limit of 15 pages applies to the narrative.
`;

test("extractor keeps shall and must statements", () => {
  const items = extractRequirements(notice);
  assert.ok(items.length >= 4);
  assert.ok(items.some((item) => /compliance matrix/i.test(item.detail)));
});

test("checklist dates stay inside the window and end on the close date", () => {
  const items = buildChecklist({
    instrument: "contract",
    description: notice,
    eligibility: "Offerors shall hold an active SAM.gov registration.",
    closesOn: "2026-11-30",
    number: "TEST-1",
    today: "2026-11-10",
  });
  assert.ok(items.length > 8);
  assert.ok(items.every((item) => item.dueOn && item.dueOn >= "2026-11-10" && item.dueOn <= "2026-11-30"));
  assert.equal(items[items.length - 1].dueOn, "2026-11-30");
  assert.ok(items.some((item) => item.phase === "submission"));
  assert.ok(items.some((item) => /compliance matrix/i.test(item.detail)));
});
