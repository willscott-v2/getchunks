// Fixture snapshot tests: committed HTML pages run through the full offline
// pipeline (extract metadata → build chunks → enhance → analyze), and the
// entire result is compared against a committed snapshot. Any change to
// splitting, merging, overlap, extraction, or scoring shows up as a diff.
//
// Intentional behavior change? Regenerate with:  UPDATE_SNAPSHOTS=1 npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { load } from 'cheerio';
import {
  extractSourceMetadata,
  buildChunks,
  enhanceChunks,
  analyzeChunks,
} from '../api/chunk.js';

const FIXTURES = new URL('./fixtures/', import.meta.url);

// Mirrors chunkUrl() minus the network fetch and Defuddle (cheerio path only,
// fully deterministic). Tokenizer 'estimate' keeps snapshots independent of
// gpt-tokenizer versions.
function runPipeline(fixtureName, url, finalOptions) {
  const html = readFileSync(new URL(fixtureName, FIXTURES), 'utf8');
  const $ = load(html);
  const source = extractSourceMetadata($, url);
  const warnings = [];
  const bigChunks = buildChunks($, finalOptions, warnings, source.title);
  const enhanced = enhanceChunks(bigChunks, 'estimate');
  const chunkability = analyzeChunks(enhanced, source, finalOptions);
  return { source, warnings, big_chunks: enhanced, chunkability };
}

function checkSnapshot(name, actual) {
  const file = new URL(`${name}.snapshot.json`, FIXTURES);
  if (process.env.UPDATE_SNAPSHOTS) {
    writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`);
    return;
  }
  let expected;
  try {
    expected = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    assert.fail(`Missing snapshot ${name}.snapshot.json — run UPDATE_SNAPSHOTS=1 npm test`);
  }
  assert.deepEqual(actual, expected);
}

const MARKETING_OPTIONS = { chunkSize: 'small', strategy: 'heading', overlap: 15 };

test('marketing page: full pipeline matches snapshot', () => {
  const result = runPipeline(
    'marketing-page.html',
    'https://maplegrove.example/assisted-living',
    MARKETING_OPTIONS
  );
  checkSnapshot('marketing-page', result);
});

test('marketing page: expected structure and flags', () => {
  const result = runPipeline(
    'marketing-page.html',
    'https://maplegrove.example/assisted-living',
    MARKETING_OPTIONS
  );
  const titles = result.big_chunks.map((c) => c.title);
  assert.deepEqual(titles, [
    'Assisted Living in Springfield',
    'Personalized Care Plans',
    'Overview',
    'Amenities at Maple Grove',
    'Frequently Asked Questions About Cost',
  ]);

  const flagsFor = (title) =>
    result.big_chunks.find((c) => c.title === title).flags.map((f) => f.code);
  assert.ok(flagsFor('Personalized Care Plans').includes('dangling-reference'), 'pronoun opener');
  assert.ok(flagsFor('Overview').includes('generic-heading'), 'stoplist heading');
  assert.ok(result.chunkability.score > 0 && result.chunkability.score < 100);

  // Overlap prefixes recorded wherever a chunk has multiple sections
  for (const chunk of result.big_chunks) {
    chunk.small_chunks.forEach((sc, i) => {
      if (i === 0) assert.equal(sc.overlap_word_count, 0);
      else assert.ok(sc.overlap_word_count > 0, `${chunk.title} section ${i + 1}`);
    });
  }
});

test('nested sections: parent chunk must not swallow child content', () => {
  const result = runPipeline(
    'nested-sections.html',
    'https://acme.example/engine-tuning',
    { chunkSize: 'small', strategy: 'heading', overlap: 0 }
  );
  const byTitle = Object.fromEntries(result.big_chunks.map((c) => [c.title, c]));
  assert.deepEqual(Object.keys(byTitle), ['Improvements', 'Injector', 'Turbopump']);

  const improvementsText = byTitle.Improvements.small_chunks.map((sc) => sc.text).join(' ');
  assert.ok(improvementsText.includes('three points in the assembly flow'), 'keeps its own intro');
  assert.ok(!improvementsText.includes('nozzle plate'), 'must not contain Injector content');
  assert.ok(!improvementsText.includes('balancing rig'), 'must not contain Turbopump content');

  const injectorText = byTitle.Injector.small_chunks.map((sc) => sc.text).join(' ');
  assert.ok(injectorText.includes('machined manifold'), 'child section extracted on its own');

  // And no near-duplicate flags — the old extraction bug produced them
  for (const chunk of result.big_chunks) {
    assert.ok(!chunk.flags.some((f) => f.code === 'near-duplicate'), chunk.title);
  }

  checkSnapshot('nested-sections', result);
});
