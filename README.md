# Web Content Chunker

A Node.js script that extracts and structures content from web pages into JSON chunks.

## Features

- Extracts content by heading hierarchy (H1-H6)
- Removes HTML tags and formatting
- Groups related content logically
- Avoids content duplication
- Outputs clean, structured JSON
- Handles lists, paragraphs, and blockquotes
- Filters out navigation, footer, and social media content

## Installation

```bash
npm install
```

## Usage

```bash
node chunk.js <URL> > output.json
```

## Examples

```bash
# Basic usage
node chunk.js https://example.com > page-chunks.json

# Process a blog post
node chunk.js https://www.searchinfluence.com/blog/seo-automation/ > blog-chunks.json

# View output in terminal
node chunk.js https://example.com | jq '.'
```

## Dependencies

- node-fetch - For fetching web page content
- cheerio - For HTML parsing and manipulation

## Output Format

The script outputs JSON with the following structure:

```json
{
  "big_chunks": [
    {
      "big_chunk_index": 1,
      "title": "Main Article Title",
      "level": 1,
      "small_chunks": [
        "Introduction paragraph with key information.",
        "Another paragraph explaining the concept.",
        "- List item 1\n- List item 2\n- List item 3"
      ]
    },
    {
      "big_chunk_index": 2,
      "title": "Section Heading",
      "level": 2,
      "small_chunks": [
        "Section content goes here.",
        "> Blockquote if present"
      ]
    }
  ]
}
```

## How It Works

1. **Fetches Content**: Downloads the HTML from the provided URL
2. **Parses Structure**: Uses Cheerio to parse and navigate the HTML DOM
3. **Identifies Headings**: Finds H1-H6 elements to create content boundaries
4. **Extracts Content**: Collects paragraphs, lists, and other content following each heading
5. **Cleans Text**: Removes HTML tags, normalizes whitespace, and filters noise
6. **Prevents Duplication**: Ensures content doesn't appear in multiple chunks
7. **Structures Output**: Creates hierarchical JSON with numbered chunks

## Content Processing

### What Gets Included
- Main article content under headings
- Paragraphs and text content
- Lists (formatted as markdown-style bullets)
- Blockquotes (prefixed with `>`)

### What Gets Filtered Out
- Navigation menus
- Footer content
- Social media links and share buttons
- HTML tags and formatting
- Empty or very short content
- Duplicate content

### Heading Hierarchy
- **H1**: Main article title and introduction
- **H2**: Major sections (each becomes a separate chunk)
- **H3-H6**: Subsections (grouped under parent sections)

## Error Handling

The script includes basic error handling for:
- Invalid URLs
- Network timeouts
- Malformed HTML
- Missing content

## Limitations

- Requires public URLs (no authentication)
- JavaScript-rendered content may not be captured
- Very large pages may take time to process
- Some complex layouts may not parse perfectly

## Contributing

Feel free to submit issues and enhancement requests!

## License

ISC