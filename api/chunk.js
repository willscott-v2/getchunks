import fetch from 'node-fetch';
import { load } from 'cheerio';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    const chunks = await chunkUrl(url);
    res.status(200).json({ success: true, data: chunks });
  } catch (error) {
    console.error('Chunking error:', error);
    res.status(500).json({ 
      error: 'Failed to process URL', 
      details: error.message 
    });
  }
}

async function chunkUrl(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Web Content Chunker/1.0'
    },
    timeout: 30000
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const html = await res.text();
  const $ = load(html);

  const bigChunks = [];
  const globalSeen = new Set();

  function cleanText(text) {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isInNavOrFooter(element) {
    return $(element).closest('nav, footer').length > 0;
  }

  function shouldSkip(text) {
    const skipPatterns = [
      /^\s*$/,
      /^(facebook|twitter|instagram|linkedin)$/i,
      /^\d+share/,
      /^comments off/i,
      /^<img/,
      /^\s*\d+\s*$/,
      /^(facebook twitter pinterest linkedin)$/i,
      /privacy policy$/i
    ];
    return skipPatterns.some(pattern => pattern.test(text));
  }

  const mainHeading = $('h1').first();
  if (mainHeading.length && !isInNavOrFooter(mainHeading[0])) {
    const title = cleanText(mainHeading.text());
    const contents = [];
    const seen = new Set();

    let current = mainHeading.next();
    while (current.length) {
      if (current.is('h2')) break;
      
      let text = '';
      if (current.is('p, div')) {
        text = cleanText(current.text());
      } else if (current.is('ul, ol')) {
        const listItems = [];
        current.find('li').each((_, li) => {
          const liText = cleanText($(li).text());
          if (liText && liText.length > 2 && !shouldSkip(liText)) {
            listItems.push(`- ${liText}`);
          }
        });
        if (listItems.length > 0) {
          text = listItems.join('\n');
        }
      }

      if (text && text.length > 10 && !seen.has(text) && !shouldSkip(text)) {
        contents.push(text);
        seen.add(text);
        globalSeen.add(text);
      }

      current = current.next();
    }

    if (contents.length > 0) {
      bigChunks.push({
        big_chunk_index: bigChunks.length + 1,
        title,
        level: 1,
        small_chunks: contents
      });
    }
  }

  $('h2, h3, h4, h5, h6').each((i, heading) => {
    const $h = $(heading);
    
    if (isInNavOrFooter(heading)) return;

    const title = cleanText($h.text());
    if (!title || title.length < 3) return;

    const level = Number(heading.tagName.charAt(1));
    const contents = [];
    const seen = new Set();

    let current = $h.next();
    while (current.length) {
      const tagName = current[0].tagName;
      
      if (/^H[1-6]$/.test(tagName)) {
        const currentLevel = Number(tagName.charAt(1));
        // Stop at any heading of same or higher level
        if (currentLevel <= level) break;
      }

      let text = '';
      
      if (current.is('p, div')) {
        text = cleanText(current.text());
      } else if (current.is('ul, ol')) {
        const listItems = [];
        current.find('li').each((_, li) => {
          const liText = cleanText($(li).text());
          if (liText && liText.length > 2 && !shouldSkip(liText)) {
            listItems.push(`- ${liText}`);
          }
        });
        if (listItems.length > 0) {
          text = listItems.join('\n');
        }
      } else if (current.is('blockquote')) {
        text = cleanText(current.text());
        if (text) text = `> ${text}`;
      }

      if (text && text.length > 15 && !seen.has(text) && !globalSeen.has(text) && !shouldSkip(text)) {
        contents.push(text);
        seen.add(text);
        globalSeen.add(text);
      }

      current = current.next();
    }

    if (contents.length > 0) {
      bigChunks.push({
        big_chunk_index: bigChunks.length + 1,
        title,
        level,
        small_chunks: contents
      });
    }
  });

  if (bigChunks.length === 0) {
    const mainContent = $('main, article, .content, .post-content, .entry-content').first();
    if (mainContent.length) {
      const contents = [];
      const seen = new Set();
      
      mainContent.find('p, li').each((_, elem) => {
        const text = cleanText($(elem).text());
        if (text && text.length > 20 && !seen.has(text) && !shouldSkip(text)) {
          contents.push(text);
          seen.add(text);
        }
      });

      if (contents.length > 0) {
        bigChunks.push({
          big_chunk_index: 1,
          title: 'Main Content',
          level: 1,
          small_chunks: contents
        });
      }
    }
  }

  const cleanedChunks = bigChunks
    .filter(chunk => chunk.small_chunks.length > 0)
    .map(chunk => ({
      ...chunk,
      small_chunks: chunk.small_chunks.filter(content => 
        content.length > 5 && !shouldSkip(content)
      )
    }))
    .filter(chunk => chunk.small_chunks.length > 0);

  cleanedChunks.forEach((chunk, index) => {
    chunk.big_chunk_index = index + 1;
  });

  return { big_chunks: cleanedChunks };
}