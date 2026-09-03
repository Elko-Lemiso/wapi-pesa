/**
 * Render every share card to disk for visual smoke-testing.
 *
 * Usage:  npx tsx scripts/render-cards-smoke.ts [outputDir]
 *
 * Reads the bundled synthetic statement fixture, runs the parser + analytics +
 * card builder, and writes one PNG per card per format under the output dir.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { extractTransactions } from "../src/lib/parser/extract-transactions";
import { computeAnalytics } from "../src/lib/analytics/primitives";
import { buildReflectCards } from "../src/lib/generation/build-cards";
import { generateShareCards } from "../src/lib/generation/reflect-cards";
import { loadSyntheticStatement } from "../src/test/load-synthetic-statement";

const OUT_DIR = process.argv[2] || ".cache/share-cards";

async function main() {
  const pages = loadSyntheticStatement();
  const statement = extractTransactions(pages);
  const analytics = computeAnalytics(statement);
  const cards = buildReflectCards(analytics);

  console.log(`Built ${cards.length} cards. Rendering...`);

  const buffers = await generateShareCards(cards, analytics);

  await mkdir(OUT_DIR, { recursive: true });
  for (const card of cards) {
    const story = buffers.get(`card-${card.id}-story`);
    const poster = buffers.get(`card-${card.id}-poster`);
    if (story) await writeFile(join(OUT_DIR, `${String(card.index).padStart(2, "0")}-${card.id}-story.png`), story);
    if (poster) await writeFile(join(OUT_DIR, `${String(card.index).padStart(2, "0")}-${card.id}-poster.png`), poster);
    console.log(`  ✓ ${card.id} (${card.cardType})`);
  }

  console.log(`\nWrote ${cards.length * 2} PNGs to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
