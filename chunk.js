// chunk.js - Clean version matching Dejan's approach
import fetch from 'node-fetch';
import { load } from 'cheerio';

async function chunk(url) {
  const res = await fetch(url);
  const html = await res.text();
  const $ = load(html);

  const bigChunks = [];

  // Clean text function - removes HTML and normalizes whitespace
  function cleanText(text) {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }

  // Check if element is inside nav or footer
  function isInNavOrFooter(element) {
    return $(element).closest('nav, footer').length > 0;
  }

  // Skip common elements we don't want
  function shouldSkip(text) {
    const skipPatterns = [
      /^\s*$/,                    // Empty or whitespace only
      /^(facebook|twitter|instagram|linkedin)$/i, // Social media
      /^\d+share/,                // Share counters
      /^comments off/i,           // Comment indicators
      /^<img/,                    // Image tags
      /^\s*\d+\s*$/,             // Just numbers
      /^(facebook twitter pinterest linkedin)$/i, // Social media groups
      /privacy policy$/i          // Privacy policy links
    ];
    return skipPatterns.some(pattern => pattern.test(text));
  }

  // Track global content to avoid duplication
  const globalSeen = new Set();

  // First, create the main intro chunk if we find a primary heading
  const mainHeading = $('h1').first();
  if (mainHeading.length && !isInNavOrFooter(mainHeading[0])) {
    const title = cleanText(mainHeading.text());
    const contents = [];
    const seen = new Set();

    // Get content until first h2
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

  // Now process H2+ headings only
  $('h2, h3, h4, h5, h6').each((i, heading) => {
    const $h = $(heading);
    
    // Skip headings in nav/footer
    if (isInNavOrFooter(heading)) return;

    const title = cleanText($h.text());
    if (!title || title.length < 3) return;

    const level = Number(heading.tagName.charAt(1));
    const contents = [];
    const seen = new Set();

    // Process the content following this heading
    let current = $h.next();
    while (current.length) {
      const tagName = current[0].tagName;
      
      // Stop at next heading of same or higher level
      if (/^H[1-6]$/.test(tagName)) {
        const currentLevel = Number(tagName.charAt(1));
        if (currentLevel <= level) break;
      }

      let text = '';
      
      if (current.is('p, div')) {
        text = cleanText(current.text());
      } else if (current.is('ul, ol')) {
        // Process lists as markdown-style bullets
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

      // Add content if it's substantial, not duplicate, and not already used
      if (text && text.length > 10 && !seen.has(text) && !globalSeen.has(text) && !shouldSkip(text)) {
        contents.push(text);
        seen.add(text);
        globalSeen.add(text);
      }

      current = current.next();
    }

    // Only create chunk if we have good content
    if (contents.length > 0) {
      bigChunks.push({
        big_chunk_index: bigChunks.length + 1,
        title,
        level,
        small_chunks: contents
      });
    }
  });

  // If we didn't capture much content, try a different approach
  // Look for the main content area and extract paragraphs
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

  // Final cleanup - remove any remaining duplicates and small chunks
  const cleanedChunks = bigChunks
    .filter(chunk => chunk.small_chunks.length > 0)
    .map(chunk => ({
      ...chunk,
      small_chunks: chunk.small_chunks.filter(content => 
        content.length > 5 && !shouldSkip(content)
      )
    }))
    .filter(chunk => chunk.small_chunks.length > 0);

  // Re-index
  cleanedChunks.forEach((chunk, index) => {
    chunk.big_chunk_index = index + 1;
  });

  // Output JSON
  console.log(JSON.stringify({ big_chunks: cleanedChunks }, null, 2));
}

// Usage: node chunk.js <URL> > page-chunks.json
if (process.argv[2]) {
  chunk(process.argv[2]);
} else {
  console.error('Please provide a URL as an argument');
  process.exit(1);
}