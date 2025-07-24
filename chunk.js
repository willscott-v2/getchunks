// chunk.js
import fetch from 'node-fetch';
import { load } from 'cheerio';

async function chunk(url) {
  const res = await fetch(url);
  const html = await res.text();
  const $ = load(html);

  const bigChunks = [];

  // 1) Header Navigation chunk (all nav menus)
  const navContents = [];
  const seenNav = new Set();
  $('nav ul').each((_, ul) => {
    $(ul).find('li').each((_, li) => {
      const raw = $(li).text().trim();
      raw.split(/\n|–|—/)
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(txt => {
          if (!seenNav.has(txt)) {
            navContents.push(txt);
            seenNav.add(txt);
          }
        });
    });
  });
  if (navContents.length) {
    bigChunks.push({
      big_chunk_index: bigChunks.length + 1,
      title: 'Navigation',
      level: 0,
      small_chunks: navContents
    });
  }

  // 2) Footer Links chunk
  const footerContents = [];
  const seenFooter = new Set();
  $('footer ul').each((_, ul) => {
    $(ul).find('li').each((_, li) => {
      const raw = $(li).text().trim();
      raw.split(/\n|–|—/)
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(txt => {
          if (!seenFooter.has(txt)) {
            footerContents.push(txt);
            seenFooter.add(txt);
          }
        });
    });
  });
  if (footerContents.length) {
    bigChunks.push({
      big_chunk_index: bigChunks.length + 1,
      title: 'Footer Links',
      level: 0,
      small_chunks: footerContents
    });
  }

  // 3) Content sections (H1–H6 outside nav/footer)
  $('h1, h2, h3, h4, h5, h6').each((i, heading) => {
    const $h = $(heading);
    if ($h.closest('nav').length || $h.closest('footer').length) return;

    const title = $h.text().trim();
    const seen = new Set();
    let contents = [];

    // Gather until next heading
    let sib = $h.next();
    while (sib.length && !/^H[1-6]$/.test(sib[0].tagName)) {
      if (sib.is('ul')) {
        sib.find('li').each((_, li) => {
          const raw = $(li).text().trim();
          raw.split(/\n|–|—/)
            .map(s => s.trim())
            .filter(Boolean)
            .forEach(txt => {
              if (!seen.has(txt)) {
                contents.push(txt);
                seen.add(txt);
              }
            });
        });
      } else if (sib.is('p')) {
        const txt = sib.text().trim();
        if (txt && !seen.has(txt)) {
          contents.push(txt);
          seen.add(txt);
        }
      }
      sib = sib.next();
    }

    if (!contents.length) return;
    const existing = bigChunks.find(c => c.title === title);
    if (existing) {
      const merged = Array.from(new Set([...existing.small_chunks, ...contents]));
      existing.small_chunks = merged;
    } else {
      bigChunks.push({
        big_chunk_index: bigChunks.length + 1,
        title,
        level: Number(heading.tagName.charAt(1)),
        small_chunks: contents
      });
    }
  });

  // Output JSON
  console.log(JSON.stringify({ big_chunks: bigChunks }, null, 2));
}

// Usage: node chunk.js <URL> > page-chunks.json
chunk(process.argv[2]);
