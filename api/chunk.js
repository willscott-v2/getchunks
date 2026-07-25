// Web Content Chunker API v3.1.0
// Built by Search Influence
// v3: Defuddle extraction, accurate token counts, sentence-aware splits,
//     heading breadcrumbs, source metadata, multiple output formats.
// v3.1: SSRF guards, redirect validation, size caps, input validation,
//       native fetch with a real timeout.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { load } from 'cheerio';
import { parseHTML } from 'linkedom';
import { Defuddle } from 'defuddle/node';
import { encode as encodeO200k } from 'gpt-tokenizer/encoding/o200k_base';
import { encode as encodeCl100k } from 'gpt-tokenizer/encoding/cl100k_base';
import sbd from 'sbd';

const ENCODERS = {
  o200k_base: encodeO200k,
  cl100k_base: encodeCl100k,
};

const CHUNK_SIZES = {
  small: { min: 100, max: 200, target: 150 },
  medium: { min: 200, max: 500, target: 350 },
  large: { min: 500, max: 1000, target: 750 },
};

const VALID_OPTIONS = {
  chunkSize: ['small', 'medium', 'large'],
  strategy: ['auto', 'heading', 'recursive', 'fixed'],
  extract: ['auto', 'defuddle', 'cheerio'],
  format: ['json', 'markdown', 'jsonl', 'langchain'],
  tokenizer: ['o200k_base', 'cl100k_base', 'none'],
};

const FETCH_TIMEOUT_MS = 25000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_REDIRECTS = 5;
const MAX_OVERLAP_WORDS = 200;

// Errors safe to surface to the client, with an HTTP status.
class ChunkError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const { url } = body;

  if (!url) return res.status(400).json({ error: 'URL is required' });
  try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL format' }); }

  for (const [key, allowed] of Object.entries(VALID_OPTIONS)) {
    const value = body[key];
    if (value !== undefined && value !== null && !allowed.includes(value)) {
      return res.status(400).json({ error: `Invalid ${key} "${value}" — expected one of: ${allowed.join(', ')}` });
    }
  }

  let overlap = null;
  if (body.overlap !== undefined && body.overlap !== null) {
    overlap = Number(body.overlap);
    if (!Number.isFinite(overlap) || overlap < 0 || overlap > MAX_OVERLAP_WORDS) {
      return res.status(400).json({ error: `Invalid overlap — expected a number between 0 and ${MAX_OVERLAP_WORDS}` });
    }
    overlap = Math.round(overlap);
  }

  const options = {
    mode: body.mode || 'auto',
    chunkSize: body.chunkSize || null,
    overlap,
    strategy: body.strategy || 'auto',
    extract: body.extract || 'auto',
    format: body.format || 'json',
    tokenizer: body.tokenizer || 'o200k_base',
  };

  try {
    const result = await chunkUrl(url, options);
    return deliverResponse(res, result, options);
  } catch (error) {
    if (error instanceof ChunkError) {
      return res.status(error.status).json({ error: error.message });
    }
    // Log details server-side only — don't leak internals to the client.
    console.error('Chunking error:', error.message);
    console.error('URL:', url);
    return res.status(500).json({ error: 'Failed to process URL' });
  }
}

// --- SSRF-guarded fetch ----------------------------------------------------

function isPrivateIp(ip) {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split('.').map(Number);
    return a === 0 || a === 10 || a === 127
      || (a === 169 && b === 254)              // link-local / cloud metadata
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127);   // CGNAT
  }
  const lower = ip.toLowerCase();
  return lower === '::' || lower === '::1'
    || /^f[cd]/.test(lower)                    // fc00::/7 unique-local
    || /^fe[89ab]/.test(lower);                // fe80::/10 link-local
}

async function assertPublicHost(hostname) {
  const bare = hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (bare === 'localhost' || bare.endsWith('.localhost') || bare.endsWith('.local') || bare.endsWith('.internal')) {
    throw new ChunkError(400, 'URL points to a private or internal host');
  }
  if (isIP(bare)) {
    if (isPrivateIp(bare)) throw new ChunkError(400, 'URL points to a private or internal host');
    return;
  }
  let addresses;
  try {
    addresses = await lookup(bare, { all: true, verbatim: true });
  } catch {
    throw new ChunkError(400, 'Could not resolve the URL hostname');
  }
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) {
    throw new ChunkError(400, 'URL points to a private or internal host');
  }
  // Note: a hostile DNS server could still rebind between this check and the
  // fetch. Full pinning needs a custom dispatcher; this covers realistic abuse.
}

async function fetchPublicUrl(url) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(current);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new ChunkError(400, 'Only http and https URLs are supported');
    }
    await assertPublicHost(u.hostname);

    let res;
    try {
      res = await fetch(u, {
        headers: { 'User-Agent': 'Web Content Chunker/3.1' },
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new ChunkError(504, 'The page took too long to respond');
      }
      throw new ChunkError(502, 'Could not fetch the URL');
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      await res.body?.cancel?.();
      if (!location) throw new ChunkError(502, `Redirect without a location header (HTTP ${res.status})`);
      current = new URL(location, u).href; // each hop re-validated at loop top
      continue;
    }

    if (!res.ok) throw new ChunkError(502, `The page returned HTTP ${res.status}`);

    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (contentType && !/^(text\/(html|plain|xml)|application\/(xhtml\+xml|xml))$/.test(contentType)) {
      await res.body?.cancel?.();
      throw new ChunkError(415, `Unsupported content type: ${contentType}`);
    }

    return readBodyCapped(res);
  }
  throw new ChunkError(502, 'Too many redirects');
}

async function readBodyCapped(res) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new ChunkError(413, 'Page is too large to process (5MB max)');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function deliverResponse(res, result, options) {
  if (options.format === 'jsonl') {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    return res.status(200).send(toJSONL(result));
  }
  if (options.format === 'markdown') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    return res.status(200).send(toMarkdown(result));
  }
  if (options.format === 'langchain') {
    return res.status(200).json({ success: true, data: toLangChain(result) });
  }
  return res.status(200).json({ success: true, data: result });
}

// --- Main pipeline ---------------------------------------------------------

async function chunkUrl(url, options) {
  const warnings = [];

  const html = await fetchPublicUrl(url);

  const $raw = load(html);
  const source = extractSourceMetadata($raw, url);

  const { $, extractorUsed, defuddleMeta } = await selectExtractor(html, url, options, warnings);

  if (defuddleMeta) {
    source.title ||= defuddleMeta.title;
    source.author ||= defuddleMeta.author;
    source.description ||= defuddleMeta.description;
    source.published ||= defuddleMeta.published;
    source.image ||= defuddleMeta.image;
    source.site ||= defuddleMeta.site;
  }

  const detected = autoDetectParameters($);
  const finalOptions = resolveChunkingOptions(options, detected);

  if (finalOptions.overlap > Math.round(CHUNK_SIZES[finalOptions.chunkSize].target * 0.25)) {
    warnings.push('Overlap exceeds 25% of chunk size — may cause duplicate saturation in RAG retrieval.');
  }

  const bigChunks = buildChunks($, finalOptions, warnings, source.title);
  const enhancedChunks = enhanceChunks(bigChunks, options.tokenizer);
  const chunkability = analyzeChunks(enhancedChunks, source, finalOptions);

  return {
    big_chunks: enhancedChunks,
    source,
    settings: {
      strategy: finalOptions.strategy,
      chunk_size: finalOptions.chunkSize,
      target_words: CHUNK_SIZES[finalOptions.chunkSize],
      overlap_words: finalOptions.overlap,
      extractor: extractorUsed,
      tokenizer: options.tokenizer,
      auto_detected: options.mode === 'auto' || options.strategy === 'auto',
    },
    summary: {
      total_big_chunks: enhancedChunks.length,
      total_small_chunks: enhancedChunks.reduce((s, c) => s + c.small_chunks.length, 0),
      total_words: enhancedChunks.reduce((s, c) => s + c.metadata.total_words, 0),
      total_tokens: enhancedChunks.reduce((s, c) => s + c.metadata.total_tokens, 0),
    },
    chunkability,
    warnings,
  };
}

// --- Extractor selection ---------------------------------------------------

async function selectExtractor(html, url, options, warnings) {
  if (options.extract === 'cheerio') {
    return { $: load(html), extractorUsed: 'cheerio' };
  }

  try {
    const { document } = parseHTML(html);
    const result = await Defuddle(document, url, { markdown: false });
    if (result?.content && result.content.length > 200) {
      const $ = load(`<html><body>${result.content}</body></html>`);
      return {
        $,
        extractorUsed: 'defuddle',
        defuddleMeta: {
          title: result.title,
          author: result.author,
          description: result.description,
          published: result.published,
          image: result.image,
          site: result.site,
        },
      };
    }
    // extract=defuddle means defuddle — fail honestly instead of silently
    // handing back cheerio output labeled as a fallback.
    if (options.extract === 'defuddle') {
      throw new ChunkError(422, 'Defuddle could not extract main content from this page — try extract "auto" or "cheerio"');
    }
    warnings.push('Defuddle returned empty or thin content; falling back to cheerio extraction.');
  } catch (err) {
    if (err instanceof ChunkError) throw err;
    if (options.extract === 'defuddle') {
      throw new ChunkError(422, 'Defuddle failed on this page — try extract "auto" or "cheerio"');
    }
    warnings.push(`Defuddle failed (${err.message}); falling back to cheerio extraction.`);
  }

  return { $: load(html), extractorUsed: 'cheerio-fallback' };
}

// --- Source metadata (JSON-LD, OG, Twitter, basic) -------------------------

function extractSourceMetadata($, url) {
  const source = { url };

  source.title = cleanOneLine($('head > title').first().text()) || null;
  source.description = $('meta[name="description"]').attr('content')?.trim() || null;
  source.canonical = $('link[rel="canonical"]').attr('href')?.trim() || null;
  source.language = $('html').attr('lang')?.trim() || null;

  const og = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property').replace(/^og:/, '');
    const val = $(el).attr('content');
    if (prop && val) og[prop] = val.trim();
  });
  if (Object.keys(og).length) source.opengraph = og;

  const twitter = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const prop = $(el).attr('name').replace(/^twitter:/, '');
    const val = $(el).attr('content');
    if (prop && val) twitter[prop] = val.trim();
  });
  if (Object.keys(twitter).length) source.twitter = twitter;

  const jsonLdNodes = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) jsonLdNodes.push(...parsed);
      else jsonLdNodes.push(parsed);
    } catch {
      // Malformed JSON-LD blocks happen in the wild — skip silently.
    }
  });
  if (jsonLdNodes.length) source.jsonld = jsonLdNodes;

  if (og['title']) source.title ||= og['title'];
  if (og['description']) source.description ||= og['description'];
  if (og['image']) source.image = og['image'];
  if (og['site_name']) source.site = og['site_name'];
  if (og['type']) source.type = og['type'];

  const article = jsonLdNodes.find((n) => n && (n['@type'] === 'Article' || n['@type'] === 'NewsArticle' || n['@type'] === 'BlogPosting'));
  if (article) {
    source.title ||= article.headline;
    source.published ||= article.datePublished;
    source.modified ||= article.dateModified;
    if (article.author) {
      source.author ||= typeof article.author === 'string'
        ? article.author
        : Array.isArray(article.author)
          ? article.author.map((a) => a.name || a).filter(Boolean).join(', ')
          : article.author.name || null;
    }
  }

  return source;
}

// --- Auto-detection --------------------------------------------------------

function autoDetectParameters($) {
  const headings = $('h1, h2, h3, h4, h5, h6').filter((_, h) => !isInNavOrFooter($, h));
  const totalWords = countWords($('body').text());
  const headingCount = headings.length;

  let chunkSize = 'medium';
  if (totalWords < 500) chunkSize = 'small';
  else if (totalWords > 2000) chunkSize = 'large';

  let strategy = 'heading';
  if (headingCount === 0) strategy = 'fixed';
  else if (headingCount > 20) strategy = 'recursive';

  const overlap = Math.round(CHUNK_SIZES[chunkSize].target * 0.1);

  return { chunkSize, strategy, overlap };
}

function resolveChunkingOptions(options, detected) {
  return {
    chunkSize: options.chunkSize || detected.chunkSize,
    strategy: options.strategy === 'auto' ? detected.strategy : options.strategy,
    overlap: options.overlap !== null && options.overlap !== undefined
      ? options.overlap
      : detected.overlap,
  };
}

// --- Chunk building --------------------------------------------------------

function buildChunks($, finalOptions, warnings, docTitle) {
  const target = CHUNK_SIZES[finalOptions.chunkSize];
  const bigChunks = [];
  const globalSeen = new Set();

  if (finalOptions.strategy === 'heading' || finalOptions.strategy === 'recursive') {
    const headings = collectHeadings($, docTitle);

    headings.forEach((heading, idx) => {
      const nextHeading = headings[idx + 1];
      const stopCondition = (current) => {
        if (nextHeading && current[0] === nextHeading.element[0]) return true;
        if (current.is('h1, h2, h3, h4, h5, h6') && current[0] !== heading.element[0]) return true;
        // A container wrapping the next heading (nested <section> markup) is
        // the section boundary too — extracting its text wholesale would
        // duplicate the child section's content into this chunk.
        if (nextHeading && current.find('h1, h2, h3, h4, h5, h6').toArray().includes(nextHeading.element[0])) return true;
        return false;
      };

      const pieces = extractContentPieces($, heading.element, stopCondition);
      const unique = [];
      const seen = new Set();
      for (const piece of pieces) {
        if (!seen.has(piece.text) && !globalSeen.has(piece.text)) {
          unique.push(piece);
          seen.add(piece.text);
          globalSeen.add(piece.text);
        }
      }
      if (!unique.length) return;

      let smallChunks;
      if (finalOptions.strategy === 'recursive') {
        const combinedText = unique.map((p) => p.text).join('\n\n');
        const split = recursiveSplit(combinedText, target.max);
        const merged = mergeSmallChunks(split, 50);
        smallChunks = merged.map((text) => ({ text, content_type: detectContentType(text) }));
      } else {
        smallChunks = [];
        for (const p of unique) {
          if (countWords(p.text) <= target.max) {
            smallChunks.push({ text: p.text, content_type: p.type });
          } else {
            for (const piece of recursiveSplit(p.text, target.max)) {
              smallChunks.push({ text: piece, content_type: p.type });
            }
          }
        }
      }

      bigChunks.push({
        title: heading.title,
        level: heading.level,
        heading_path: heading.path,
        fragment: heading.fragment,
        small_chunks: smallChunks,
      });
    });
  }

  if (!bigChunks.length || finalOptions.strategy === 'fixed') {
    if (finalOptions.strategy !== 'fixed' && bigChunks.length === 0) {
      warnings.push('No usable headings found; using fixed-size chunking on main content.');
    }
    const mainContent = $('main, article, .content, .post-content, .entry-content').first();
    const root = mainContent.length ? mainContent : $('body');
    const paragraphs = [];
    root.find('p, li, blockquote, pre').each((_, elem) => {
      const text = cleanText($(elem).text());
      if (text && text.length > 20 && !shouldSkip(text)) paragraphs.push(text);
    });
    if (paragraphs.length) {
      const combined = paragraphs.join('\n\n');
      const split = recursiveSplit(combined, target.max);
      const merged = mergeSmallChunks(split, 50);
      bigChunks.push({
        title: 'Main Content',
        level: 1,
        heading_path: ['Main Content'],
        fragment: null,
        small_chunks: merged.map((text) => ({ text, content_type: detectContentType(text) })),
      });
    }
  }

  if (finalOptions.overlap > 0) {
    for (const chunk of bigChunks) {
      chunk.small_chunks = addOverlap(chunk.small_chunks, finalOptions.overlap);
    }
  }

  return bigChunks;
}

function collectHeadings($, docTitle) {
  const headings = [];
  const stack = [];
  if (docTitle) stack.push({ title: docTitle, level: 0 });
  $('h1, h2, h3, h4, h5, h6').each((_, heading) => {
    const $h = $(heading);
    if (isInNavOrFooter($, heading)) return;
    const title = cleanText($h.text());
    if (!title || title.length < 3) return;
    const level = Number(heading.tagName.charAt(1));

    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    stack.push({ title, level });

    const path = stack.slice(-3).map((h) => h.title).filter((t, i, arr) => i === 0 || t !== arr[i - 1]);
    const id = $h.attr('id');
    const fragment = id ? `#${id}` : `#${slugify(title)}`;

    headings.push({ element: $h, title, level, path, fragment });
  });
  return headings;
}

function extractContentPieces($, startElement, stopCondition) {
  const pieces = [];
  let current = startElement.next();

  while (current.length) {
    if (stopCondition(current)) break;
    // Containers holding headings that never became chunks (nav/aside blocks,
    // headings under 3 chars) would pollute this section's text — skip them.
    if (current.find('h1, h2, h3, h4, h5, h6').length) {
      current = current.next();
      continue;
    }
    let text = '';
    let type = 'prose';

    if (current.is('ul, ol')) {
      const items = [];
      current.find('li').each((_, li) => {
        const t = cleanText($(li).text());
        if (t && t.length > 2 && !shouldSkip(t)) items.push(`- ${t}`);
      });
      if (items.length) { text = items.join('\n'); type = 'list'; }
    } else if (current.is('blockquote')) {
      text = cleanText(current.text());
      if (text) { text = `> ${text}`; type = 'quote'; }
    } else if (current.is('pre, code')) {
      text = cleanText(current.text());
      if (text) { text = `\`\`\`\n${text}\n\`\`\``; type = 'code'; }
    } else if (current.is('table')) {
      text = cleanText(current.text());
      type = 'table';
    } else if (current.is('p, div:not(:has(*)), section, article')) {
      text = cleanText(current.text());
      type = 'prose';
    }

    if (text && text.length > 15 && !shouldSkip(text)) {
      pieces.push({ text, type });
    }
    current = current.next();
  }

  return pieces;
}

// --- Splitting helpers -----------------------------------------------------

function recursiveSplit(text, maxWords) {
  if (countWords(text) <= maxWords) return [text];

  const paragraphs = text.split(/\n\n+/);
  if (paragraphs.length > 1) {
    const result = [];
    let current = '';
    for (const para of paragraphs) {
      const test = current ? `${current}\n\n${para}` : para;
      if (countWords(test) <= maxWords) {
        current = test;
      } else {
        if (current) result.push(current);
        current = para;
        if (countWords(current) > maxWords) {
          result.push(...splitBySentences(current, maxWords));
          current = '';
        }
      }
    }
    if (current) result.push(current);
    return result;
  }

  return splitBySentences(text, maxWords);
}

function splitBySentences(text, maxWords) {
  let sentences;
  try {
    sentences = sbd.sentences(text, { newline_boundaries: true, sanitize: false });
    if (!sentences.length) sentences = regexSentences(text);
  } catch {
    sentences = regexSentences(text);
  }
  if (!sentences.length || (sentences.length === 1 && countWords(sentences[0]) > maxWords)) {
    return forceSplitByWords(text, maxWords);
  }

  const result = [];
  let current = '';
  for (const sentence of sentences) {
    const test = current ? `${current} ${sentence}` : sentence;
    if (countWords(test) <= maxWords) current = test;
    else {
      if (current) result.push(current);
      if (countWords(sentence) > maxWords) {
        result.push(...forceSplitByWords(sentence, maxWords));
        current = '';
      } else {
        current = sentence;
      }
    }
  }
  if (current) result.push(current);
  return result;
}

function forceSplitByWords(text, maxWords) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [text];
  const result = [];
  for (let i = 0; i < words.length; i += maxWords) {
    result.push(words.slice(i, i + maxWords).join(' '));
  }
  return result;
}

function regexSentences(text) {
  return text.match(/[^.!?]+[.!?]+/g) || [text];
}

function mergeSmallChunks(chunks, minWords = 50) {
  if (chunks.length <= 1) return chunks;
  const result = [];
  let i = 0;
  while (i < chunks.length) {
    let current = chunks[i];
    let wc = countWords(current);
    while (wc < minWords && i + 1 < chunks.length) {
      i++;
      current = `${current}\n\n${chunks[i]}`;
      wc = countWords(current);
    }
    result.push(current);
    i++;
  }
  return result;
}

function addOverlap(smallChunks, overlapWords) {
  if (overlapWords === 0 || smallChunks.length <= 1) return smallChunks;
  const result = [];
  for (let i = 0; i < smallChunks.length; i++) {
    if (i === 0) { result.push(smallChunks[i]); continue; }
    const prevWords = smallChunks[i - 1].text.trim().split(/\s+/);
    const overlapCount = Math.min(overlapWords, prevWords.length);
    const overlap = prevWords.slice(-overlapCount).join(' ');
    result.push({
      ...smallChunks[i],
      text: `${overlap} ${smallChunks[i].text}`,
      overlap_word_count: overlapCount,
    });
  }
  return result;
}

// --- Enhancement: metadata, positions, token counts ------------------------

function enhanceChunks(bigChunks, tokenizer) {
  let charCursor = 0;
  const allTexts = bigChunks.flatMap((c) => c.small_chunks.map((sc) => sc.text));
  const totalChars = allTexts.join('\n\n').length || 1;
  const encoder = ENCODERS[tokenizer] || null;

  return bigChunks.map((chunk, bigIdx) => {
    const smalls = chunk.small_chunks.map((sc, idx) => {
      const text = sc.text;
      const word_count = countWords(text);
      const char_count = text.length;
      const tokens = encoder ? encoder(text).length : Math.ceil(word_count * 0.75);
      const start_char = charCursor;
      const end_char = charCursor + char_count;
      const percent_through_doc = Math.round((start_char / totalChars) * 1000) / 1000;
      charCursor = end_char + 2;

      return {
        text,
        content_type: sc.content_type || detectContentType(text),
        overlap_word_count: sc.overlap_word_count || 0,
        chunk_index: idx + 1,
        word_count,
        char_count,
        tokens,
        token_estimate: tokens,
        start_char,
        end_char,
        percent_through_doc,
      };
    });

    const totalWords = smalls.reduce((s, c) => s + c.word_count, 0);
    const totalChunkChars = smalls.reduce((s, c) => s + c.char_count, 0);
    const totalTokens = smalls.reduce((s, c) => s + c.tokens, 0);

    return {
      big_chunk_index: bigIdx + 1,
      title: chunk.title,
      level: chunk.level,
      heading_path: chunk.heading_path,
      fragment: chunk.fragment,
      small_chunks: smalls,
      metadata: {
        total_small_chunks: smalls.length,
        total_words: totalWords,
        total_characters: totalChunkChars,
        total_tokens: totalTokens,
        total_tokens_estimate: totalTokens,
      },
    };
  });
}

// --- Chunk quality analysis (v3.3) -----------------------------------------
// Deterministic diagnosis: same input, same score. No AI calls — regex, word
// counts, stoplists, Jaccard shingles, and Flesch-Kincaid only.

// Weights are per-chunk points: every chunk starts at 100, loses the weight
// of each flag it carries, and the page score is the average across chunks —
// proportional by construction, so a 12-chunk page with 2 flagged chunks
// outscores a 4-chunk page with 2 flagged chunks.
const FLAG_META = {
  'dangling-reference': { label: 'Dangling reference', severity: 'high', weight: 30, fix: 'Open sections with the entity name instead of a pronoun.' },
  'near-duplicate': { label: 'Near-duplicate', severity: 'high', weight: 30, fix: 'Consolidate near-identical sections or differentiate them.' },
  'no-entity-anchor': { label: 'No entity anchor', severity: 'warn', weight: 25, fix: 'Name the brand or entity inside each section.' },
  'generic-heading': { label: 'Generic heading', severity: 'warn', weight: 20, fix: 'Rename vague headings to name the topic.' },
  'oversized-section': { label: 'Oversized section', severity: 'warn', weight: 20, fix: 'Break long sections up with subheadings.' },
  'thin-section': { label: 'Thin section', severity: 'warn', weight: 20, fix: 'Merge or expand short sections.' },
  'answer-buried': { label: 'Answer buried', severity: 'warn', weight: 15, fix: 'Answer the heading in the first sentence.' },
  readability: { label: 'Hard to read', severity: 'info', weight: 0, fix: 'Shorten sentences; prefer plain words.' },
};

const GENERIC_HEADINGS = new Set([
  'overview', 'introduction', 'intro', 'learn more', 'read more', 'more', 'more info',
  'more information', 'additional information', 'details', 'why choose us', 'why us',
  'our services', 'services', 'our approach', 'our story', 'our mission', 'about',
  'about us', 'welcome', 'get started', 'getting started', 'features', 'benefits',
  'faq', 'faqs', 'frequently asked questions', 'resources', 'conclusion', 'summary',
  'next steps', 'contact', 'contact us', 'get in touch', 'our team', 'testimonials',
  'gallery', 'miscellaneous', 'misc', 'other',
]);

const ANALYSIS_STOPWORDS = new Set(('a an the and or but if then else for nor so yet at by in of on to up as is are was were be been ' +
  'being am do does did have has had will would can could may might must shall should with from into onto over under about after ' +
  'before between during through above below out off again further once here there all any both each few most other some such no ' +
  'not only own same than too very just more less much many what which who whom whose when where why how this that these those it ' +
  'its they their them we our us you your yours he she his her i me my mine thing things page home welcome official website site online').split(' '));

function tokenizeTerms(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter((w) => w.length >= 3 && !ANALYSIS_STOPWORDS.has(w));
}

function lightStem(word) {
  return word.length > 4
    ? word.replace(/(ings|ing|ers|er|ies|ed|es|s)$/, '')
    : word.replace(/s$/, '');
}

function stemSet(text) {
  return new Set(tokenizeTerms(text).map(lightStem));
}

function setsIntersect(a, b) {
  for (const item of a) if (b.has(item)) return true;
  return false;
}

// Words prepended by addOverlap() are context carry-over, not page content —
// every quality check runs on the de-overlapped text.
function deOverlappedText(chunk) {
  return chunk.small_chunks
    .map((sc) => {
      if (!sc.overlap_word_count) return sc.text;
      return sc.text.trim().split(/\s+/).slice(sc.overlap_word_count).join(' ');
    })
    .join('\n\n');
}

function firstSentenceOf(text) {
  const plain = text.replace(/^[->\s]+/, '').replace(/\s+/g, ' ').trim();
  const match = plain.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : plain).trim();
}

// "University of Wisconsin-Milwaukee" → "uwm", "Retrieval-augmented
// generation" → "rag" — pages routinely fall back to the initialism after
// first mention, and that still anchors the entity.
function initialism(name) {
  const words = (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w && !ANALYSIS_STOPWORDS.has(w));
  if (words.length < 2) return null;
  const initials = words.map((w) => w[0]).join('');
  return initials.length >= 3 ? initials : null;
}

function buildAnchorTerms(source, chunks) {
  const titleMain = (source.title || '').split(/\s+[|–—-]\s+/)[0];
  const names = [titleMain, source.site];
  const jsonldNodes = (source.jsonld || []).flatMap((n) => (n && n['@graph'] ? n['@graph'] : [n]));
  for (const node of jsonldNodes) {
    if (!node || typeof node.name !== 'string') continue;
    const types = [].concat(node['@type'] || []).join(' ');
    if (/Organization|Business|WebSite|WebPage|Brand|Hotel|Store|Restaurant|Resort/i.test(types)) {
      names.push(node.name);
    }
  }
  const h1 = chunks.find((c) => c.level === 1);
  if (h1) names.push(h1.title);

  const anchors = stemSet(`${source.title || ''} ${names.join(' ')}`);
  for (const name of names) {
    const init = initialism(name);
    if (init) anchors.add(init);
  }
  return anchors;
}

function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]e|ed|es)$/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function fleschKincaidGrade(text) {
  const words = text.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (!words.length) return 0;
  const sentences = Math.max(1, (text.match(/[.!?]+(?=\s|$)/g) || []).length);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const grade = 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
  return Math.round(grade * 10) / 10;
}

function wordShingles(text, size = 5) {
  const words = tokenizeTerms(text).map(lightStem);
  const set = new Set();
  for (let i = 0; i + size <= words.length; i++) {
    set.add(words.slice(i, i + size).join(' '));
  }
  return set;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

// Attaches flags[] to each enhanced big chunk (mutates) and returns the
// page-level chunkability verdict.
function analyzeChunks(chunks, source, finalOptions) {
  if (!chunks.length) return null;
  const target = CHUNK_SIZES[finalOptions.chunkSize];
  const anchorTerms = buildAnchorTerms(source, chunks);
  const entityName = source.site || (chunks.find((c) => c.level === 1) || {}).title || 'the brand';
  const tally = {};
  const addFlag = (chunk, code, message) => {
    const meta = FLAG_META[code];
    chunk.flags.push({ code, label: meta.label, severity: meta.severity, message, fix: meta.fix });
    tally[code] = (tally[code] || 0) + 1;
  };

  const texts = chunks.map((chunk) => deOverlappedText(chunk));

  chunks.forEach((chunk, i) => {
    chunk.flags = [];
    const text = texts[i];
    const wordCount = countWords(text);
    const syntheticHeading = !chunk.fragment; // fixed-strategy fallback ("Main Content")

    // Absolute floor, not the chunk-size minimum: a 300-word section on a
    // "large"-sized page is still plenty to rank — under ~100 words it isn't.
    const thinMin = Math.min(target.min, 100);
    if (wordCount < thinMin) {
      addFlag(chunk, 'thin-section', `${wordCount} words of content — under ${thinMin} words a section rarely carries enough context to rank or be quoted on its own.`);
    } else if (wordCount > target.max) {
      addFlag(chunk, 'oversized-section', `${wordCount} words under one heading (${finalOptions.chunkSize} max is ${target.max}). Retrieval had to split it mid-flow, so pieces lose their framing.`);
    }

    const normalizedTitle = (chunk.title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const isGeneric = !syntheticHeading && GENERIC_HEADINGS.has(normalizedTitle);
    if (isGeneric) {
      addFlag(chunk, 'generic-heading', `"${chunk.title}" says nothing about the topic — as a retrieval label it matches almost any query weakly and none well.`);
    }

    const opening = (chunk.small_chunks[0]?.text || '').replace(/^[->\s]+/, '');
    const pronounMatch = opening.match(/^(our|we|this|these|those|it|its|they|their|he|she)\b/i);
    if (pronounMatch) {
      addFlag(chunk, 'dangling-reference', `Opens with "${pronounMatch[1]}" — retrieved on its own, nothing in this section says who or what that refers to.`);
    }

    if (anchorTerms.size && !setsIntersect(stemSet(`${chunk.title} ${text}`), anchorTerms)) {
      addFlag(chunk, 'no-entity-anchor', `Never mentions ${entityName} (or any page-level entity term) — an AI quoting this section can't attribute it.`);
    }

    if (!syntheticHeading && !isGeneric) {
      const headingStems = stemSet(chunk.title);
      const sentence = firstSentenceOf(text);
      // Single-word headings ("History") make lexical-echo checks pure noise
      if (headingStems.size >= 2 && sentence && !setsIntersect(headingStems, stemSet(sentence))) {
        addFlag(chunk, 'answer-buried', `The first sentence shares no content words with the heading "${chunk.title}" — the direct answer sits lower in the section, where ranking functions weight it less.`);
      }
    }

    if (wordCount >= 30) {
      const grade = fleschKincaidGrade(text);
      if (grade > 12) {
        addFlag(chunk, 'readability', `Reads at ~grade ${grade} (Flesch-Kincaid). Long sentences make clean quoting harder.`);
      }
    }
  });

  const shingleSets = texts.map((t) => (countWords(t) >= 20 ? wordShingles(t) : null));
  let duplicatePairs = 0;
  for (let i = 0; i < chunks.length; i++) {
    for (let j = i + 1; j < chunks.length; j++) {
      if (!shingleSets[i] || !shingleSets[j]) continue;
      const similarity = jaccard(shingleSets[i], shingleSets[j]);
      if (similarity >= 0.6) {
        duplicatePairs++;
        const pct = `${Math.round(similarity * 100)}%`;
        addFlag(chunks[i], 'near-duplicate', `${pct} similar to Chunk ${chunks[j].big_chunk_index} ("${chunks[j].title}") — retrieval returns them interchangeably, splitting relevance between them.`);
        addFlag(chunks[j], 'near-duplicate', `${pct} similar to Chunk ${chunks[i].big_chunk_index} ("${chunks[i].title}") — retrieval returns them interchangeably, splitting relevance between them.`);
      }
    }
  }

  chunks.forEach((chunk) => {
    const lost = chunk.flags.reduce((sum, f) => sum + FLAG_META[f.code].weight, 0);
    chunk.chunk_score = Math.max(0, 100 - lost);
  });
  const score = Math.round(chunks.reduce((sum, c) => sum + c.chunk_score, 0) / chunks.length);

  // Page-level points recoverable per flag type: weight × occurrences,
  // averaged over the chunk count — the same math the score is built from.
  const fixGroups = [];
  for (const [code, meta] of Object.entries(FLAG_META)) {
    const count = code === 'near-duplicate' ? duplicatePairs : (tally[code] || 0);
    if (!count || !meta.weight) continue;
    const points = Math.round((meta.weight * (tally[code] || 0)) / chunks.length);
    fixGroups.push({ code, label: meta.label, count, points, fix: meta.fix });
  }
  fixGroups.sort((a, b) => b.points - a.points || b.count - a.count);

  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  return { score, grade, top_fixes: fixGroups.slice(0, 3) };
}

// --- Format converters -----------------------------------------------------

function toJSONL(result) {
  const lines = [];
  for (const big of result.big_chunks) {
    for (const sc of big.small_chunks) {
      lines.push(JSON.stringify({
        text: sc.text,
        heading_path: big.heading_path,
        fragment: big.fragment,
        content_type: sc.content_type,
        word_count: sc.word_count,
        tokens: sc.tokens,
        percent_through_doc: sc.percent_through_doc,
        source_url: result.source.url,
      }));
    }
  }
  return lines.join('\n');
}

function toMarkdown(result) {
  const lines = [];
  if (result.source.title) lines.push(`# ${result.source.title}`, '');
  if (result.source.author) lines.push(`*by ${result.source.author}*`, '');
  if (result.source.published) lines.push(`*published ${result.source.published}*`, '');
  lines.push(`Source: ${result.source.url}`, '', '---', '');
  for (const big of result.big_chunks) {
    const prefix = '#'.repeat(Math.min(Math.max(big.level, 1), 6));
    lines.push(`${prefix} ${big.title}`, '');
    for (const sc of big.small_chunks) {
      lines.push(sc.text, '');
    }
  }
  return lines.join('\n');
}

function toLangChain(result) {
  const documents = [];
  for (const big of result.big_chunks) {
    for (const sc of big.small_chunks) {
      documents.push({
        page_content: sc.text,
        metadata: {
          source: result.source.url,
          title: result.source.title,
          author: result.source.author,
          heading_path: big.heading_path,
          heading: big.title,
          level: big.level,
          fragment: big.fragment,
          content_type: sc.content_type,
          word_count: sc.word_count,
          tokens: sc.tokens,
          char_range: [sc.start_char, sc.end_char],
          percent_through_doc: sc.percent_through_doc,
        },
      });
    }
  }
  return documents;
}

// --- Small helpers ---------------------------------------------------------

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function cleanText(text) {
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function cleanOneLine(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function isInNavOrFooter($, element) {
  return $(element).closest('nav, footer, header.site-header').length > 0;
}

function shouldSkip(text) {
  const skipPatterns = [
    /^\s*$/,
    /^(facebook|twitter|instagram|linkedin)$/i,
    /^\d+\s*share/i,
    /^comments off/i,
    /^<img/,
    /^\s*\d+\s*$/,
    /^(facebook twitter pinterest linkedin)$/i,
    /privacy policy$/i,
    /^share$/i,
    /^tweet$/i,
  ];
  return skipPatterns.some((p) => p.test(text));
}

function detectContentType(text) {
  if (/^```/.test(text)) return 'code';
  if (/^> /.test(text)) return 'quote';
  if (/^- /.test(text) && text.split('\n').every((l) => !l.trim() || l.startsWith('- '))) return 'list';
  return 'prose';
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64);
}

// Named exports for the test suite (tests/). Vercel only uses the default
// handler; these change nothing at runtime.
export {
  CHUNK_SIZES,
  countWords,
  recursiveSplit,
  mergeSmallChunks,
  addOverlap,
  buildChunks,
  enhanceChunks,
  analyzeChunks,
  extractSourceMetadata,
  initialism,
  fleschKincaidGrade,
};
