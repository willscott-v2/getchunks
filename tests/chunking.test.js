// Unit tests for the chunking primitives: split, merge, overlap, helpers.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countWords,
  recursiveSplit,
  mergeSmallChunks,
  addOverlap,
  initialism,
  fleschKincaidGrade,
} from '../api/chunk.js';

const sentence = 'The quick brown fox jumps over the lazy dog again today.';
const longText = Array.from({ length: 40 }, () => sentence).join(' ');

test('recursiveSplit returns text unchanged when under the limit', () => {
  assert.deepEqual(recursiveSplit('Short text here.', 100), ['Short text here.']);
});

test('recursiveSplit keeps every piece within maxWords', () => {
  const pieces = recursiveSplit(longText, 50);
  assert.ok(pieces.length > 1);
  for (const piece of pieces) {
    assert.ok(countWords(piece) <= 50, `piece has ${countWords(piece)} words`);
  }
});

test('recursiveSplit preserves all words in order', () => {
  const pieces = recursiveSplit(longText, 50);
  assert.equal(pieces.join(' ').split(/\s+/).join(' '), longText.split(/\s+/).join(' '));
});

test('recursiveSplit prefers paragraph boundaries', () => {
  const para = Array.from({ length: 4 }, () => sentence).join(' '); // 44 words
  const text = `${para}\n\n${para}\n\n${para}`;
  const pieces = recursiveSplit(text, 50);
  assert.equal(pieces.length, 3);
  assert.deepEqual(pieces, [para, para, para]);
});

test('recursiveSplit force-splits a single giant sentence', () => {
  const giant = Array.from({ length: 120 }, (_, i) => `word${i}`).join(' ');
  const pieces = recursiveSplit(giant, 50);
  assert.equal(pieces.length, 3);
  assert.ok(pieces.every((p) => countWords(p) <= 50));
});

test('mergeSmallChunks merges below-minimum pieces forward', () => {
  const merged = mergeSmallChunks(['one two three', 'four five six', sentence], 5);
  assert.equal(merged.length, 2);
  assert.equal(merged[0], 'one two three\n\nfour five six');
  assert.equal(merged[1], sentence);
});

test('mergeSmallChunks leaves compliant chunks alone', () => {
  const chunks = [sentence, sentence, sentence];
  assert.deepEqual(mergeSmallChunks(chunks, 5), chunks);
});

test('addOverlap leaves the first chunk untouched and records the count', () => {
  const chunks = [{ text: longText }, { text: sentence }];
  const out = addOverlap(chunks, 10);
  assert.equal(out[0].text, longText);
  assert.equal(out[0].overlap_word_count, undefined);
  assert.equal(out[1].overlap_word_count, 10);
  const expectedPrefix = longText.trim().split(/\s+/).slice(-10).join(' ');
  assert.ok(out[1].text.startsWith(`${expectedPrefix} `));
  assert.ok(out[1].text.endsWith(sentence));
});

test('addOverlap clamps to the previous chunk length (the 29-word case)', () => {
  // Chuck's page: a 29-word section with a 35-word overlap window — the
  // whole previous section gets prepended and the count must say 29, not 35.
  const short = Array.from({ length: 29 }, (_, i) => `w${i}`).join(' ');
  const out = addOverlap([{ text: short }, { text: sentence }], 35);
  assert.equal(out[1].overlap_word_count, 29);
  assert.equal(out[1].text, `${short} ${sentence}`);
});

test('addOverlap is a no-op for zero overlap or a single chunk', () => {
  const chunks = [{ text: sentence }, { text: sentence }];
  assert.deepEqual(addOverlap(chunks, 0), chunks);
  assert.deepEqual(addOverlap([{ text: sentence }], 10), [{ text: sentence }]);
});

test('initialism builds acronyms from multiword names, skipping stopwords', () => {
  assert.equal(initialism('University of Wisconsin-Milwaukee'), 'uwm');
  assert.equal(initialism('Retrieval-augmented generation'), 'rag');
  assert.equal(initialism('Seaside'), null); // single word
  assert.equal(initialism('Acme Rockets'), null); // 2 letters — too short to match
});

test('fleschKincaidGrade is deterministic and orders simple < dense text', () => {
  const simple = 'We fix cars. We do it fast. You can trust us. Call us today.';
  const dense =
    'Notwithstanding organizational considerations, the implementation of comprehensive infrastructural modernization necessitates extraordinarily deliberate prioritization of interdependent technological capabilities.';
  const simpleGrade = fleschKincaidGrade(simple);
  const denseGrade = fleschKincaidGrade(dense);
  assert.equal(simpleGrade, fleschKincaidGrade(simple));
  assert.ok(simpleGrade < 6, `simple text graded ${simpleGrade}`);
  assert.ok(denseGrade > 15, `dense text graded ${denseGrade}`);
});
