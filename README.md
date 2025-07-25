# Web Content Chunker v1.2.0

A modern web application that extracts and structures content from web pages into clean, organized JSON chunks. Built with Search Influence branding for professional content analysis and SEO research.

🔗 **Live App**: [https://getchunks.vercel.app](https://getchunks.vercel.app)

## Features

- **🎯 Smart Content Extraction**: Automatically identifies and extracts meaningful content based on heading hierarchy
- **🧹 Clean, Structured Output**: Removes HTML tags, normalizes formatting, and eliminates duplicate content
- **⚡ Fast Serverless Processing**: Powered by Vercel edge functions for lightning-fast processing
- **📖 Multiple View Modes**: 
  - **Webpage View**: Clean, article-style presentation for easy reading
  - **Chunks View**: Structured display showing big chunks and numbered small chunks
  - **JSON View**: Raw JSON data for developers and technical analysis
- **📋 Easy Export**: Copy to clipboard or download JSON files
- **📱 Responsive Design**: Works perfectly on desktop and mobile devices
- **🔄 Real-time Processing**: No rate limits or infrastructure concerns
- **📊 Analytics Tracking**: Built-in Vercel Analytics for usage insights
- **🎨 Professional Branding**: Search Influence branded interface

## How to Use

1. **Visit the web app**: [https://getchunks.vercel.app](https://getchunks.vercel.app)
2. **Enter any public URL** in the input field
3. **Click "Extract Content"** to process the page
4. **Choose your view**:
   - **📖 Webpage**: Clean, article-style presentation
   - **🧩 Chunks**: Structured view showing big chunks and small chunks
   - **📋 JSON**: Raw JSON data for developers

## Recent Updates (v1.2.0)

- ✅ **Enhanced Chunking Algorithm**: Improved content separation between headings
- ✅ **Three-View Interface**: Added dedicated Chunks view alongside Webpage and JSON views
- ✅ **Search Influence Branding**: Professional header with official logo and styling
- ✅ **Analytics Integration**: Vercel Analytics with custom event tracking
- ✅ **Version Tracking**: Added version comments to all files for better debugging
- ✅ **Improved Error Handling**: Better error messages and debugging capabilities

### What Gets Extracted
- Main article content organized by headings (H1-H6)
- Paragraphs and text content
- Lists (formatted as markdown-style bullets)
- Blockquotes (prefixed with `>`)
- Structured content hierarchy

### What Gets Filtered Out
- Navigation menus and headers
- Footer content and links
- Social media buttons and share widgets
- Advertisements and sidebar content
- HTML tags and formatting
- Empty or very short content
- Duplicate content across sections

## Output Format

The application generates JSON with this structure:

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

## Use Cases

- **SEO Research**: Analyze competitor content structure and organization
- **Content Analysis**: Extract and study content patterns from websites
- **Data Processing**: Convert web content into structured data for analysis
- **Content Migration**: Extract content for CMS migrations or restructuring
- **Research**: Gather and organize information from multiple web sources

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js serverless functions (Vercel)
- **Processing**: Cheerio for HTML parsing, node-fetch for content retrieval
- **Deployment**: Vercel edge network for global performance
- **Styling**: Search Influence branding and responsive design

## Local Development

If you want to run this locally or contribute:

```bash
# Clone the repository
git clone https://github.com/willscott-v2/getchunks.git
cd getchunks

# Install dependencies
npm install

# Run development server
vercel dev

# Open http://localhost:3000
```

## API Usage

You can also use the extraction API directly:

```bash
# POST request to extract content
curl -X POST https://getchunks.vercel.app/api/chunk \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

## Error Handling

The application includes robust error handling for:
- Invalid URLs and malformed requests
- Network timeouts and connection issues
- Protected or authentication-required pages
- Malformed HTML and parsing errors
- Rate limiting and server errors

## Limitations

- **Public URLs only**: Cannot access password-protected or private content
- **JavaScript rendering**: May not capture dynamically generated content
- **Large pages**: Very large pages may take longer to process
- **Complex layouts**: Some highly customized layouts may not parse perfectly

## Contributing

We welcome contributions! Feel free to:
- Submit bug reports and feature requests via GitHub Issues
- Improve the extraction algorithms for better content detection
- Enhance the user interface and user experience
- Add new export formats (CSV, XML, etc.)
- Improve documentation and examples
- Add support for new content types

## Version History

- **v1.2.0** (July 2025): Enhanced chunking, three-view interface, analytics integration
- **v1.1.0** (July 2025): Search Influence branding, improved UI/UX
- **v1.0.0** (July 2025): Initial release with core extraction functionality

## License

ISC License - free to use and modify

## Credits

Built by [Search Influence](https://www.searchinfluence.com) - AI-driven SEO and digital marketing experts.

---

**Need help with SEO or content strategy?** [Contact Search Influence](https://www.searchinfluence.com/contact/) for professional digital marketing services.