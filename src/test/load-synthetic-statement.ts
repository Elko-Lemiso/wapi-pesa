import { readFileSync } from "node:fs";
import type { ExtractedPage } from "../lib/parser/pdf-decrypt";

export const SYNTHETIC_STATEMENT_PATH =
  "src/test/fixtures/synthetic-personal-statement.txt";

export function loadSyntheticStatement(
  path = SYNTHETIC_STATEMENT_PATH
): ExtractedPage[] {
  const raw = readFileSync(path, "utf8");
  const blocks = raw.split(/=== PAGE \d+ ===\s*\n/).slice(1);
  return blocks.map((text, index) => ({
    pageNumber: index + 1,
    lines: text
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  }));
}
