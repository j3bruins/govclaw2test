import assert from "node:assert/strict";
import test from "node:test";
import { pdfText, safeMediaType } from "./documents";

test("a long run of backslash-n pairs finishes immediately", () => {
  const payload = Buffer.from("(" + "\\n".repeat(4000), "latin1");
  const started = Date.now();
  const text = pdfText(payload);
  assert.equal(text, "");
  assert.ok(Date.now() - started < 250);
});

test("a parenthesized sentence is recovered", () => {
  const payload = Buffer.from("(Harbor provides public health surveillance)", "latin1");
  assert.match(pdfText(payload), /Harbor provides public health surveillance/);
});

test("download types stay on a short safe list", () => {
  assert.equal(safeMediaType("application/pdf"), "application/pdf");
  assert.equal(safeMediaType("text/html"), "application/octet-stream");
  assert.equal(safeMediaType("text/html; charset=utf-8"), "application/octet-stream");
  assert.equal(safeMediaType(""), "application/octet-stream");
});
