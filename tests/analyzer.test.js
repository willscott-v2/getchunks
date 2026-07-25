// analyzeChunks() scenario tests: one isolated case per flag, scoring math,
// and determinism. analyzeChunks mutates its input, so every scenario builds
// fresh chunk objects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeChunks } from '../api/chunk.js';

const OPTIONS = { chunkSize: 'medium', strategy: 'heading', overlap: 35 };

const SOURCE = {
  url: 'https://example.com/rockets',
  title: 'Rocket Engine Maintenance Guide - Acme Rocket Supply',
  site: 'Acme Rocket Supply',
  jsonld: [{ '@type': 'Organization', name: 'Acme Rocket Supply' }],
};

// Unique-vocabulary filler: short, simple sentences whose words never repeat
// across seeds, so scenarios can't collide via the near-duplicate check.
function filler(seed, sentences) {
  return Array.from(
    { length: sentences },
    (_, i) => `${seed}${i}ax ${seed}${i}bx ${seed}${i}cx runs fine.`
  ).join(' ');
}

function mkChunk(index, title, text, extra = {}) {
  return {
    big_chunk_index: index,
    title,
    level: 2,
    fragment: `#chunk-${index}`,
    small_chunks: [{ text, chunk_index: 1 }],
    ...extra,
  };
}

// ~105 words, anchored, heading echoed in the first sentence, no pronoun
// opener, low reading grade — carries no non-info flags.
function goodChunk(index, seed = 'alpha') {
  return mkChunk(
    index,
    'Rocket Engine Maintenance',
    `Rocket engine maintenance keeps every Acme Rocket Supply vehicle safe. ${filler(seed, 19)}`
  );
}

function nonInfoCodes(chunk) {
  return chunk.flags.filter((f) => f.severity !== 'info').map((f) => f.code).sort();
}

test('clean page scores 100/A with no fixes', () => {
  const chunks = [goodChunk(1, 'alpha'), goodChunk(2, 'bravo')];
  const result = analyzeChunks(chunks, SOURCE, OPTIONS);
  assert.deepEqual(nonInfoCodes(chunks[0]), []);
  assert.deepEqual(nonInfoCodes(chunks[1]), []);
  assert.equal(result.score, 100);
  assert.equal(result.grade, 'A');
  assert.deepEqual(result.top_fixes, []);
});

test('dangling-reference: pronoun opener', () => {
  const chunk = mkChunk(
    1,
    'Rocket Engine Maintenance',
    `Our rocket engine maintenance keeps every Acme Rocket Supply vehicle safe. ${filler('charlie', 19)}`
  );
  analyzeChunks([chunk], SOURCE, OPTIONS);
  assert.deepEqual(nonInfoCodes(chunk), ['dangling-reference']);
  assert.match(chunk.flags.find((f) => f.code === 'dangling-reference').message, /"Our"/);
});

test('thin-section: under the 100-word floor', () => {
  const chunk = mkChunk(
    1,
    'Rocket Engine Maintenance',
    `Rocket engine maintenance keeps every Acme Rocket Supply vehicle safe. ${filler('delta', 6)}`
  );
  analyzeChunks([chunk], SOURCE, OPTIONS);
  assert.deepEqual(nonInfoCodes(chunk), ['thin-section']);
});

test('oversized-section: over the medium max with no subheading', () => {
  const chunk = mkChunk(
    1,
    'Rocket Engine Maintenance',
    `Rocket engine maintenance keeps every Acme Rocket Supply vehicle safe. ${filler('echo', 110)}`
  );
  analyzeChunks([chunk], SOURCE, OPTIONS);
  assert.deepEqual(nonInfoCodes(chunk), ['oversized-section']);
});

test('generic-heading flags the stoplist and skips answer-buried', () => {
  const chunk = mkChunk(
    1,
    'Overview',
    `Rocket engine maintenance keeps every Acme Rocket Supply vehicle safe. ${filler('foxtrot', 19)}`
  );
  analyzeChunks([chunk], SOURCE, OPTIONS);
  assert.deepEqual(nonInfoCodes(chunk), ['generic-heading']);
});

test('answer-buried: first sentence ignores a multiword heading', () => {
  const chunk = mkChunk(
    1,
    'Pricing And Contracts',
    `Acme Rocket Supply ships worldwide from three depots. ${filler('golf', 19)}`
  );
  analyzeChunks([chunk], SOURCE, OPTIONS);
  assert.deepEqual(nonInfoCodes(chunk), ['answer-buried']);
});

test('answer-buried skips single-word headings', () => {
  const chunk = mkChunk(
    1,
    'History',
    `Acme Rocket Supply ships worldwide from three depots. ${filler('hotel', 19)}`
  );
  analyzeChunks([chunk], SOURCE, OPTIONS);
  assert.deepEqual(nonInfoCodes(chunk), []);
});

test('no-entity-anchor: section never names any page entity', () => {
  const chunk = mkChunk(
    1,
    'Shipping Options',
    `Shipping options include ground and air delivery for every order. ${filler('india', 19)}`
  );
  analyzeChunks([chunk], SOURCE, OPTIONS);
  assert.deepEqual(nonInfoCodes(chunk), ['no-entity-anchor']);
});

test('no-entity-anchor accepts the initialism (UWM anchors the full name)', () => {
  const source = {
    url: 'https://example.edu/',
    title: 'Admissions - University of Wisconsin-Milwaukee',
    site: 'University of Wisconsin-Milwaukee',
    jsonld: [],
  };
  const chunk = mkChunk(
    1,
    'Application Deadlines',
    `Application deadlines at UWM fall in January and August. ${filler('juliet', 19)}`
  );
  analyzeChunks([chunk], source, OPTIONS);
  assert.deepEqual(nonInfoCodes(chunk), []);
});

test('near-duplicate: identical chunks flag each other, counted once as a pair', () => {
  const text = `Rocket engine maintenance keeps every Acme Rocket Supply vehicle safe. ${filler('kilo', 19)}`;
  const a = mkChunk(1, 'Rocket Engine Maintenance', text);
  const b = mkChunk(2, 'Rocket Engine Maintenance', text);
  const result = analyzeChunks([a, b], SOURCE, OPTIONS);
  assert.deepEqual(nonInfoCodes(a), ['near-duplicate']);
  assert.deepEqual(nonInfoCodes(b), ['near-duplicate']);
  const fix = result.top_fixes.find((f) => f.code === 'near-duplicate');
  assert.equal(fix.count, 1); // one pair, not two instances
});

test('overlap prefixes are excluded from duplicate and thin checks', () => {
  const a = goodChunk(1, 'lima');
  const aWords = a.small_chunks[0].text.trim().split(/\s+/);
  const prefix = aWords.slice(-60).join(' ');
  const b = mkChunk(2, 'Launch Day Checklist', '', {
    small_chunks: [{
      text: `${prefix} The launch day checklist covers Acme Rocket Supply steps. ${filler('mike', 20)}`,
      chunk_index: 1,
      overlap_word_count: 60,
    }],
  });
  analyzeChunks([a, b], SOURCE, OPTIONS);
  assert.deepEqual(nonInfoCodes(a), []);
  assert.deepEqual(nonInfoCodes(b), []);
});

test('readability: dense prose gets an info flag, simple prose does not', () => {
  const dense = mkChunk(
    1,
    'Rocket Engine Maintenance',
    'Rocket engine maintenance necessitates extraordinarily comprehensive organizational preparation incorporating interdependent technological capabilities alongside institutional considerations regarding Acme Rocket Supply operational infrastructure modernization initiatives representing considerable administrative complexity throughout implementation phases requiring deliberate prioritization frameworks additionally encompassing evaluation methodologies ' +
      Array.from({ length: 12 }, (_, i) => `furthermore incorporating supplementary considerations regarding notwithstanding organizational deliberations ${i}`).join(' ')
  );
  // Genuinely plain prose — the synthetic filler() words are multi-syllable
  // by accident, so a hand-written low-grade text is used here instead.
  const simple = mkChunk(
    2,
    'Rocket Engine Maintenance',
    'Rocket engine maintenance keeps each Acme Rocket Supply craft safe. We check the pump. We check the seals. We log each part. The crew signs off. Then we test fire the stand. It takes one day.'
  );
  analyzeChunks([dense, simple], SOURCE, OPTIONS);
  assert.ok(dense.flags.some((f) => f.code === 'readability' && f.severity === 'info'));
  assert.ok(!simple.flags.some((f) => f.code === 'readability'));
});

test('score is the per-chunk average and top fixes report point gains', () => {
  const clean = goodChunk(1, 'oscar');
  const flagged = mkChunk(
    2,
    'Rocket Engine Maintenance',
    `Our rocket engine maintenance keeps every Acme Rocket Supply vehicle safe. ${filler('papa', 19)}`
  );
  const result = analyzeChunks([clean, flagged], SOURCE, OPTIONS);
  assert.equal(clean.chunk_score, 100);
  assert.equal(flagged.chunk_score, 70); // dangling-reference weighs 30
  assert.equal(result.score, 85);
  assert.equal(result.grade, 'B');
  assert.deepEqual(result.top_fixes.map((f) => [f.code, f.count, f.points]), [
    ['dangling-reference', 1, 15],
  ]);
});

test('analysis is deterministic: identical input, identical output', () => {
  const build = () => [
    goodChunk(1, 'quebec'),
    mkChunk(2, 'Overview', `Acme Rocket Supply ships worldwide from three depots. ${filler('romeo', 6)}`),
  ];
  const first = build();
  const second = build();
  const r1 = analyzeChunks(first, SOURCE, OPTIONS);
  const r2 = analyzeChunks(second, SOURCE, OPTIONS);
  assert.deepEqual(r1, r2);
  assert.deepEqual(first, second); // flags + chunk_score attached identically
});

test('empty chunk list returns null', () => {
  assert.equal(analyzeChunks([], SOURCE, OPTIONS), null);
});
