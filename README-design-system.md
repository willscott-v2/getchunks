# Search Influence Design System

A complete, production-ready design system based on the successful Web Content Chunker project. This system provides a professional, modern look perfect for SaaS applications, tools, and corporate websites.

## 🎨 Features

- **Professional Aesthetic**: Corporate-friendly design with Search Influence branding
- **Fully Responsive**: Works seamlessly across desktop, tablet, and mobile
- **Modular Components**: Easy-to-use, self-contained components
- **CSS Variables**: Customizable color scheme and spacing
- **Modern Effects**: Glassmorphism, hover animations, and smooth transitions
- **Accessibility Ready**: High contrast and proper focus states

## 🚀 Quick Start

### Option 1: Direct Include
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="search-influence-design-system.css">
    <title>Your Project</title>
</head>
<body>
    <!-- Your content using SI classes -->
</body>
</html>
```

### Option 2: CDN (when available)
```html
<link rel="stylesheet" href="https://cdn.example.com/search-influence-design-system@1.0.0/dist/si-design-system.css">
```

## 📋 Components

### Header Component
```html
<div class="si-header">
    <div class="si-container">
        <div class="si-header-content">
            <div class="si-logo-section">
                <div class="si-logo-container">
                    <a href="https://www.searchinfluence.com/">
                        <img src="logo.png" alt="Search Influence" class="si-logo">
                    </a>
                </div>
                <h1 class="si-title">Your Project Title</h1>
                <div class="si-tagline">Your Compelling Tagline</div>
            </div>
            <div class="si-description">
                <p>Your project description...</p>
                <a href="https://www.searchinfluence.com">Powered by Search Influence</a>
            </div>
        </div>
    </div>
</div>
```

### Card Component
```html
<div class="si-card">
    <h3>Card Title</h3>
    <p>Card content goes here...</p>
</div>
```

### Button Component
```html
<button class="si-btn">Primary Button</button>
<a href="#" class="si-btn">Link Button</a>
```

### Features Grid
```html
<div class="si-features">
    <div class="si-container">
        <div class="si-feature">
            <div class="si-feature-icon">🎯</div>
            <h3>Feature Title</h3>
            <p>Feature description...</p>
        </div>
        <!-- Repeat for more features -->
    </div>
</div>
```

### Form Components
```html
<form>
    <div class="si-form-group">
        <label class="si-label" for="input">Label</label>
        <div class="si-input-group">
            <input type="text" class="si-input" placeholder="Enter text...">
            <button type="submit" class="si-btn">Submit</button>
        </div>
    </div>
</form>
```

### FAQ Section
```html
<div class="si-faq-section">
    <div class="si-container">
        <h2>Frequently Asked Questions</h2>
        <div class="si-faq-grid">
            <div class="si-faq-item">
                <h3>Question?</h3>
                <p>Answer...</p>
            </div>
        </div>
    </div>
</div>
```

### Loading Component
```html
<div class="si-loading">
    <div class="si-loading-spinner"></div>
    <h3>Loading...</h3>
    <p>Processing your request...</p>
</div>
```

## 🎨 Customization

All colors and spacing are defined as CSS variables at the top of the stylesheet:

```css
:root {
    --si-orange-accent: #e67e22;
    --si-orange-dark: #d35400;
    --si-orange-light: #f39c12;
    --si-dark-blue: #2c3e50;
    --si-lighter-blue: #34495e;
    /* ... more variables */
}
```

### Custom Color Scheme
```css
:root {
    --si-orange-accent: #your-primary-color;
    --si-dark-blue: #your-background-color;
    /* Override other variables as needed */
}
```

## 📐 Layout Classes

### Container
```html
<div class="si-container">
    <!-- Centered content with max-width and padding -->
</div>
```

### Sections
```html
<div class="si-section"><!-- Standard section padding --></div>
<div class="si-section--compact"><!-- Reduced padding --></div>
```

### Utility Classes
```html
<!-- Spacing -->
<div class="si-mt-lg"><!-- Large top margin --></div>
<div class="si-mb-md"><!-- Medium bottom margin --></div>

<!-- Text Alignment -->
<div class="si-text-center">Centered text</div>
<div class="si-text-left">Left aligned</div>

<!-- Visibility -->
<div class="si-hidden">Hidden element</div>
<div class="si-visible">Visible element</div>
```

## 📱 Responsive Design

The system includes responsive breakpoints:

- **Desktop**: Full grid layouts and larger text
- **Tablet**: Adjusted spacing and grid columns
- **Mobile** (≤768px): Single column layouts and optimized touch targets

## 🔧 Browser Support

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## 📦 File Structure

```
search-influence-design-system/
├── search-influence-design-system.css    # Main stylesheet
├── search-influence-components.html       # Component demo page
├── README-design-system.md               # This documentation
└── examples/                             # Usage examples
    ├── landing-page.html
    ├── dashboard.html
    └── form-page.html
```

## 🌟 Key Design Principles

1. **Professional**: Clean, corporate aesthetic suitable for business applications
2. **Functional**: Clear hierarchy and intuitive user interactions
3. **Responsive**: Seamless experience across all device sizes
4. **Accessible**: High contrast ratios and proper focus management
5. **Modern**: Subtle animations and contemporary visual effects
6. **Consistent**: Unified spacing, typography, and color system

## 🤝 Contributing

This design system was extracted from the Web Content Chunker project. To contribute:

1. Test changes in a real project
2. Maintain consistency with existing patterns
3. Update documentation for any new components
4. Ensure responsive behavior works correctly

## 📄 License

Open source and free to use. Built by Search Influence for the development community.

## 🔗 Related Projects

- [Web Content Chunker](https://getchunks.searchinfluence.com) - The original project
- [Search Influence](https://www.searchinfluence.com) - AI SEO Experts

## 📞 Support

For questions or support:
- Create an issue in the repository
- Contact Search Influence through their website
- Check the component demo page for implementation examples

---

*Built with ❤️ by Search Influence*