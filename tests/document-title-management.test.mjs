import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/documents/displayTitle.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { normalizeDocumentDisplayTitle } = await import(`data:text/javascript,${encodeURIComponent(compiled)}`);

test("display title preserves original filename fallback and accepts owner labels", () => {
  assert.equal(normalizeDocumentDisplayTitle("My Will", "image.jpg"), "My Will");
  assert.equal(normalizeDocumentDisplayTitle("  Bank statement  ", "statement.pdf"), "Bank statement");
  assert.equal(normalizeDocumentDisplayTitle("", "image.jpg"), null);
  assert.equal(normalizeDocumentDisplayTitle("image.jpg", "image.jpg"), null);
});

test("display title rejects control characters and oversized input", () => {
  assert.throws(() => normalizeDocumentDisplayTitle("account\nnumber", "image.jpg"));
  assert.throws(() => normalizeDocumentDisplayTitle("x".repeat(161), "image.jpg"));
});
