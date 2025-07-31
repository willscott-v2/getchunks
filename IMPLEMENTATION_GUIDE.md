# GetChunks Look & Feel - Implementation Guide

## Quick Start

### 1. Include the CSS
```html
<link rel="stylesheet" href="getchunks-styles.css">
```

### 2. Include the JavaScript Patterns
```html
<script src="getchunks-patterns.js"></script>
```

### 3. Basic HTML Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your App</title>
    <link rel="stylesheet" href="getchunks-styles.css">
</head>
<body>
    <!-- Header -->
    <div class="header">
        <div class="container">
            <div class="header-content">
                <div class="logo-section">
                    <div class="logo-container">
                        <img src="your-logo.png" alt="Your Brand" class="si-logo">
                    </div>
                    <h1>Your App Title</h1>
                    <div class="tagline">Your tagline here</div>
                </div>
                <div class="header-description">
                    <p>Your app description goes here.</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Main Content -->
    <div class="main-section">
        <div class="container">
            <!-- Form Card -->
            <div class="form-card">
                <form id="your-form">
                    <div class="form-group">
                        <label for="your-input">Your Label</label>
                        <div class="url-input-group">
                            <input type="text" id="your-input" placeholder="Your placeholder" required>
                            <button type="submit" class="extract-btn">Submit</button>
                        </div>
                    </div>
                </form>
            </div>

            <!-- Loading State -->
            <div class="loading" id="loading">
                <div class="loading-spinner"></div>
                <h3>Processing...</h3>
                <p>Please wait while we process your request.</p>
            </div>

            <!-- Error State -->
            <div class="error" id="error">
                <h3>⚠️ Error</h3>
                <p id="error-message"></p>
            </div>

            <!-- Results -->
            <div class="results" id="results">
                <div class="results-header">
                    <h2>📄 Results</h2>
                    <div class="view-controls">
                        <div class="view-toggle">
                            <button id="view1-btn" class="active">View 1</button>
                            <button id="view2-btn">View 2</button>
                            <button id="view3-btn">View 3</button>
                        </div>
                        <div class="results-actions">
                            <button class="action-btn" id="action1">Action 1</button>
                            <button class="action-btn" id="action2">Action 2</button>
                        </div>
                    </div>
                </div>
                
                <div class="content-area">
                    <div class="webpage-view show" id="view1">
                        <div class="webpage-content" id="content1"></div>
                    </div>
                    <div class="chunks-view" id="view2">
                        <div class="chunks-content" id="content2"></div>
                    </div>
                    <pre class="json-output" id="view3">
                        <div class="json-content" id="content3"></div>
                    </pre>
                </div>
            </div>
        </div>
    </div>

    <!-- Features Section -->
    <div class="features">
        <div class="container">
            <div class="feature">
                <div class="feature-icon">🎯</div>
                <h3>Feature 1</h3>
                <p>Feature description goes here.</p>
            </div>
            <div class="feature">
                <div class="feature-icon">⚡</div>
                <h3>Feature 2</h3>
                <p>Feature description goes here.</p>
            </div>
            <div class="feature">
                <div class="feature-icon">🧹</div>
                <h3>Feature 3</h3>
                <p>Feature description goes here.</p>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <div class="footer">
        <div class="container">
            <p>Your footer content • <a href="#" target="_blank">Link</a></p>
        </div>
    </div>

    <script src="getchunks-patterns.js"></script>
    <script>
        // Your custom JavaScript here
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize your app
        });
    </script>
</body>
</html>
```

## Color Palette Usage

### Primary Colors
```css
/* Dark Blue - Main background */
background: #2c3e50;

/* Lighter Blue - Header gradient */
background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);

/* Orange Accent - Buttons, highlights */
color: #e67e22;
background: linear-gradient(135deg, #e67e22 0%, #d35400 100%);

/* Success Green - Success states */
background: linear-gradient(135deg, #27ae60 0%, #229954 100%);

/* Error Red - Error states */
color: #e74c3c;
border: 2px solid #e74c3c;
```

### Content Colors
```css
/* Content background */
background: #ffffff;
color: #2c3e50;

/* Secondary content */
color: #34495e;

/* Muted text */
color: #7f8c8d;

/* Borders */
border: 1px solid #dee2e6;
```

## Component Usage

### Buttons
```html
<!-- Primary button -->
<button class="extract-btn">Primary Action</button>

<!-- Secondary button -->
<button class="action-btn">Secondary Action</button>

<!-- View toggle button -->
<button class="view-toggle-btn">View</button>
```

### Cards
```html
<!-- Form card -->
<div class="form-card">
    <!-- Your form content -->
</div>

<!-- Feature card -->
<div class="feature">
    <div class="feature-icon">🎯</div>
    <h3>Title</h3>
    <p>Description</p>
</div>

<!-- Content chunk -->
<div class="big-chunk">
    <div class="big-chunk-header">
        <h3 class="big-chunk-title">Title</h3>
        <div class="big-chunk-meta">Meta info</div>
    </div>
    <div class="small-chunks-container">
        <div class="small-chunk">
            <div class="small-chunk-index">1</div>
            <div class="small-chunk-content">Content</div>
        </div>
    </div>
</div>
```

### Loading States
```html
<div class="loading" id="loading">
    <div class="loading-spinner"></div>
    <h3>Processing...</h3>
    <p>Please wait...</p>
</div>
```

### Error States
```html
<div class="error" id="error">
    <h3>⚠️ Error Title</h3>
    <p id="error-message">Error message</p>
</div>
```

## JavaScript Integration

### Using the View Manager
```javascript
// Initialize view manager
const viewManager = new ViewManager();

// Show a specific view
viewManager.showView('webpage');
viewManager.showView('chunks');
viewManager.showView('json');
```

### Using the Form Handler
```javascript
// Initialize form handler
const formHandler = new FormHandler('your-form-id', '/your-api-endpoint');

// Override display results method
formHandler.displayResults = (data) => {
    // Your custom display logic
    console.log('Results:', data);
};
```

### Using Utility Functions
```javascript
// Copy to clipboard
await Utils.copyToClipboard('Text to copy');

// Download file
Utils.downloadFile('file content', 'filename.txt', 'text/plain');

// Show notification
Utils.showNotification('Success message', 'success', 3000);

// Debounce function
const debouncedFunction = Utils.debounce(() => {
    // Your function
}, 300);

// Throttle function
const throttledFunction = Utils.throttle(() => {
    // Your function
}, 1000);
```

### Using Content Display
```javascript
// Display webpage view
ContentDisplay.displayWebpageView(data, 'container-id');

// Display chunks view
ContentDisplay.displayChunksView(data, 'container-id');

// Display JSON view
ContentDisplay.displayJsonView(data, 'container-id');

// Escape HTML
const safeHtml = ContentDisplay.escapeHtml('<script>alert("xss")</script>');
```

## Customization

### Changing Colors
```css
:root {
    --primary-color: #e67e22;
    --primary-dark: #d35400;
    --primary-light: #f39c12;
    --background-dark: #2c3e50;
    --background-light: #34495e;
    --success-color: #27ae60;
    --error-color: #e74c3c;
    --info-color: #3498db;
}
```

### Adding Custom Components
```css
/* Custom component using the design system */
.custom-component {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 40px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
}

.custom-component:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}
```

### Responsive Design
```css
@media (max-width: 768px) {
    /* Mobile-specific styles */
    .header-content {
        grid-template-columns: 1fr;
        text-align: center;
    }
    
    .url-input-group {
        flex-direction: column;
    }
}
```

## Best Practices

1. **Consistency**: Use the provided color palette and spacing system
2. **Accessibility**: Include proper focus states and ARIA labels
3. **Performance**: Use the debounce/throttle utilities for frequent events
4. **Error Handling**: Always handle API errors gracefully
5. **Analytics**: Use the trackEvent function for user interaction tracking
6. **Mobile First**: Test on mobile devices first, then enhance for desktop

## File Structure
```
your-project/
├── getchunks-styles.css      # Design system styles
├── getchunks-patterns.js     # JavaScript patterns
├── index.html               # Your main page
├── LOOK_AND_FEEL_GUIDE.md  # Complete design guide
└── IMPLEMENTATION_GUIDE.md  # This file
```

This implementation guide provides everything you need to quickly adopt the GetChunks look and feel in your own project while maintaining consistency and professional appearance. 