# GetChunks Look & Feel Guide

## Project Overview
**Web Content Chunker** - A modern web application for extracting and structuring content from web pages into clean, organized JSON chunks. Built with Search Influence branding for professional content analysis and SEO research.

## Design System

### Color Palette

#### Primary Colors
- **Dark Blue**: `#2c3e50` (Main background)
- **Lighter Blue**: `#34495e` (Header gradient)
- **Orange Accent**: `#e67e22` (Primary accent, buttons, highlights)
- **Orange Dark**: `#d35400` (Button hover states)
- **Orange Light**: `#f39c12` (Hover effects)

#### Secondary Colors
- **White**: `#ffffff` (Text on dark backgrounds, content areas)
- **Light Gray**: `#ecf0f1` (Subtle borders and backgrounds)
- **Medium Gray**: `#bdc3c7` (Secondary text, placeholders)
- **Dark Gray**: `#95a5a6` (Footer text)
- **Success Green**: `#27ae60` (Success states)
- **Error Red**: `#e74c3c` (Error states)
- **Info Blue**: `#3498db` (Loading states, links)

#### Content Area Colors
- **Content Background**: `#ffffff` (White for readability)
- **Content Text**: `#2c3e50` (Dark for contrast)
- **Secondary Content**: `#34495e` (Slightly lighter text)
- **Muted Text**: `#7f8c8d` (Meta information)
- **Border Gray**: `#dee2e6` (Subtle borders)
- **Background Gray**: `#f8f9fa` (Light backgrounds)

### Typography

#### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

#### Font Sizes
- **Large Headings**: `4rem` (Main title)
- **Medium Headings**: `2.5rem` (Section titles)
- **Small Headings**: `1.8rem` (Subsection titles)
- **Body Text**: `1.1rem` (Main content)
- **Small Text**: `1rem` (Secondary content)
- **Meta Text**: `0.95rem` (Labels, metadata)
- **Code Text**: `14px` (JSON output)

#### Font Weights
- **Bold**: `800` (Main headings)
- **Semi-bold**: `600` (Subheadings, buttons)
- **Medium**: `500` (Labels, navigation)
- **Regular**: `400` (Body text)
- **Light**: `300` (Descriptions)

### Layout & Spacing

#### Container System
- **Max Width**: `1200px`
- **Side Padding**: `20px`
- **Section Padding**: `60px 0`
- **Card Padding**: `40px`

#### Grid System
- **Header Grid**: `1fr 1fr` (Two-column layout)
- **Features Grid**: `repeat(auto-fit, minmax(300px, 1fr))`
- **Responsive Breakpoint**: `768px`

#### Spacing Scale
- **Small**: `8px`, `12px`, `15px`
- **Medium**: `20px`, `25px`, `30px`
- **Large**: `40px`, `50px`, `60px`
- **Extra Large**: `80px`

### Component Styles

#### Header Design
```css
.header {
    background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
    padding: 80px 0;
    border-bottom: 4px solid #e67e22;
    position: relative;
    overflow: hidden;
}

.header::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: linear-gradient(45deg, transparent 0%, rgba(230, 126, 34, 0.1) 100%);
}
```

#### Form Cards
```css
.form-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 40px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}
```

#### Input Fields
```css
#url-input {
    padding: 18px 24px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    font-size: 16px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    transition: all 0.3s ease;
}

#url-input:focus {
    outline: none;
    border-color: #e67e22;
    background: rgba(255, 255, 255, 0.15);
    box-shadow: 0 0 0 3px rgba(230, 126, 34, 0.2);
}
```

#### Buttons
```css
.extract-btn {
    padding: 18px 36px;
    background: linear-gradient(135deg, #e67e22 0%, #d35400 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.extract-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(230, 126, 34, 0.4);
    background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
}
```

#### Loading States
```css
.loading {
    text-align: center;
    padding: 50px;
    background: rgba(52, 152, 219, 0.1);
    border: 2px solid #3498db;
    border-radius: 12px;
}

.loading-spinner {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(52, 152, 219, 0.3);
    border-top: 4px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}
```

#### Results Display
```css
.results-header {
    background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
    padding: 30px 40px;
    border-radius: 12px 12px 0 0;
}

.content-area {
    background: white;
    color: #2c3e50;
    border-radius: 0 0 12px 12px;
    max-height: 75vh;
    overflow-y: auto;
}
```

#### View Toggle Buttons
```css
.view-toggle {
    display: flex;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.view-toggle button {
    padding: 12px 20px;
    background: transparent;
    color: white;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 14px;
    font-weight: 500;
}

.view-toggle button.active {
    background: rgba(255, 255, 255, 0.25);
    color: white;
    font-weight: 600;
}
```

### Content Display Styles

#### Chunks View
```css
.big-chunk {
    background: #f8f9fa;
    border: 2px solid #e9ecef;
    border-radius: 12px;
    margin-bottom: 30px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

.big-chunk-header {
    background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
    color: white;
    padding: 20px 30px;
}

.small-chunk {
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 15px;
    position: relative;
    transition: all 0.3s ease;
}

.small-chunk:hover {
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    transform: translateY(-2px);
}

.small-chunk-index {
    position: absolute;
    top: -8px;
    left: 15px;
    background: #e67e22;
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 600;
}
```

#### Webpage View
```css
.chunk-title.level-1 {
    font-size: 2.5rem;
    color: #2c3e50;
    border-bottom: 4px solid #e67e22;
    padding-bottom: 15px;
}

.chunk-title.level-2 {
    font-size: 2rem;
    color: #34495e;
    border-bottom: 2px solid #3498db;
    padding-bottom: 10px;
}

.chunk-title.level-3 {
    font-size: 1.5rem;
    color: #555;
    border-bottom: 1px solid #bdc3c7;
    padding-bottom: 8px;
}

.chunk-content {
    font-size: 1.1rem;
    line-height: 1.7;
    color: #2c3e50;
}

.chunk-content blockquote {
    border-left: 4px solid #e67e22;
    padding-left: 25px;
    margin: 25px 0;
    font-style: italic;
    color: #555;
    background: #f8f9fa;
    padding: 20px 25px;
    border-radius: 0 6px 6px 0;
}
```

#### JSON Output
```css
.json-output {
    background: #1e1e1e;
    color: #e6e6e6;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 14px;
    line-height: 1.6;
    padding: 0;
    margin: 0;
    overflow-x: auto;
}
```

### Interactive Elements

#### Hover Effects
- **Buttons**: `transform: translateY(-2px)` with shadow
- **Cards**: `transform: translateY(-5px)` for features
- **Chunks**: `transform: translateY(-2px)` with enhanced shadow
- **Links**: Color change with underline

#### Transitions
```css
transition: all 0.3s ease;
```

#### Focus States
- **Inputs**: Orange border with glow effect
- **Buttons**: Enhanced shadow and color change

### Responsive Design

#### Mobile Breakpoints
```css
@media (max-width: 768px) {
    .header-content {
        grid-template-columns: 1fr;
        gap: 30px;
        text-align: center;
    }
    
    .logo-section h1 {
        font-size: 2.5rem;
    }
    
    .url-input-group {
        flex-direction: column;
    }
    
    .results-header {
        flex-direction: column;
        text-align: center;
    }
}
```

### Branding Elements

#### Search Influence Logo
- **Container**: White background with padding and shadow
- **Logo**: 40px height, auto width
- **Position**: Top-left of header

#### Color Usage by Brand
- **Primary Brand**: Orange (`#e67e22`) for CTAs and highlights
- **Professional**: Dark blues for backgrounds and structure
- **Success**: Green for positive states
- **Error**: Red for error states

### Animation & Micro-interactions

#### Loading Animation
```css
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
```

#### Button States
- **Default**: Gradient background
- **Hover**: Lighter gradient with shadow and lift
- **Disabled**: Reduced opacity
- **Active**: Enhanced shadow

### Accessibility Features

#### Color Contrast
- **Text on Dark**: White text on dark backgrounds
- **Text on Light**: Dark text on white backgrounds
- **Accent Text**: Orange for important elements

#### Focus Indicators
- **Inputs**: Orange border with glow
- **Buttons**: Enhanced shadow on focus
- **Links**: Underline on hover

### Content Hierarchy

#### Visual Hierarchy
1. **Main Title**: Large, bold, white
2. **Tagline**: Medium, orange accent
3. **Section Headers**: Medium, white
4. **Content**: Regular weight, appropriate color
5. **Meta Information**: Smaller, muted color

#### Information Architecture
- **Header**: Brand + Value Proposition
- **Form**: Primary action (URL input)
- **Results**: Three-view system (Webpage, Chunks, JSON)
- **Features**: Supporting information
- **Footer**: Links and attribution

### Technical Implementation

#### CSS Organization
- **Reset**: Box-sizing, margins, padding
- **Layout**: Container, grid, spacing
- **Components**: Buttons, forms, cards
- **States**: Loading, error, success
- **Responsive**: Mobile adaptations

#### JavaScript Patterns
- **Event Handling**: Form submission, view toggles
- **State Management**: Current data, view states
- **API Integration**: Fetch with error handling
- **Analytics**: Event tracking for user actions

### File Structure Reference

```
getchunks/
├── public/
│   └── index.html          # Main application (1167 lines)
├── api/
│   └── chunk.js            # Backend processing (261 lines)
├── package.json            # Dependencies and scripts
├── vercel.json            # Deployment configuration
└── README.md              # Project documentation
```

### Key Design Principles

1. **Professional**: Clean, corporate aesthetic with Search Influence branding
2. **Functional**: Clear hierarchy and intuitive navigation
3. **Responsive**: Works seamlessly across all devices
4. **Accessible**: High contrast and clear focus states
5. **Modern**: Subtle animations and micro-interactions
6. **Consistent**: Unified color palette and spacing system

This design system creates a professional, trustworthy interface that emphasizes functionality while maintaining visual appeal and brand consistency. 