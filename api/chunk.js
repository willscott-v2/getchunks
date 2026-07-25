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
