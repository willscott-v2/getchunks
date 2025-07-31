// GetChunks Interaction Patterns - Extracted JavaScript Patterns

// ===== ANALYTICS TRACKING =====
function trackEvent(eventName, properties = {}) {
    if (window.va && typeof window.va.track === 'function') {
        window.va.track(eventName, properties);
    } else {
        // Queue the event for when analytics loads
        setTimeout(() => {
            if (window.va && typeof window.va.track === 'function') {
                window.va.track(eventName, properties);
            }
        }, 1000);
    }
}

// ===== VIEW TOGGLE SYSTEM =====
class ViewManager {
    constructor() {
        this.currentView = 'webpage';
        this.views = {
            webpage: { element: null, button: null },
            chunks: { element: null, button: null },
            json: { element: null, button: null }
        };
        this.init();
    }

    init() {
        // Initialize view elements
        this.views.webpage.element = document.getElementById('webpage-view');
        this.views.chunks.element = document.getElementById('chunks-view');
        this.views.json.element = document.getElementById('json-output');
        
        // Initialize view buttons
        this.views.webpage.button = document.getElementById('webpage-view-btn');
        this.views.chunks.button = document.getElementById('chunks-view-btn');
        this.views.json.button = document.getElementById('json-view-btn');
        
        // Add event listeners
        this.views.webpage.button?.addEventListener('click', () => this.showView('webpage'));
        this.views.chunks.button?.addEventListener('click', () => this.showView('chunks'));
        this.views.json.button?.addEventListener('click', () => this.showView('json'));
    }

    showView(viewName) {
        // Track view change
        trackEvent('view_changed', { view: viewName });
        
        // Hide all views
        Object.values(this.views).forEach(view => {
            if (view.element) {
                view.element.classList.remove('show');
                view.element.style.display = 'none';
            }
            if (view.button) {
                view.button.classList.remove('active');
            }
        });
        
        // Show selected view
        const selectedView = this.views[viewName];
        if (selectedView.element) {
            selectedView.element.classList.add('show');
            selectedView.element.style.display = 'block';
        }
        if (selectedView.button) {
            selectedView.button.classList.add('active');
        }
        
        this.currentView = viewName;
    }
}

// ===== FORM HANDLING =====
class FormHandler {
    constructor(formId, apiEndpoint) {
        this.form = document.getElementById(formId);
        this.apiEndpoint = apiEndpoint;
        this.submitButton = null;
        this.loadingElement = null;
        this.resultsElement = null;
        this.errorElement = null;
        this.init();
    }

    init() {
        this.submitButton = this.form.querySelector('button[type="submit"]');
        this.loadingElement = document.getElementById('loading');
        this.resultsElement = document.getElementById('results');
        this.errorElement = document.getElementById('error');
        
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(this.form);
        const url = formData.get('url') || document.getElementById('url-input')?.value;
        
        if (!url) return;

        // Reset states
        this.hideAll();
        this.showLoading();
        this.disableSubmit();

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (data.success) {
                this.displayResults(data.data);
                
                // Track successful submission
                trackEvent('content_extracted', {
                    url: url,
                    chunks_count: data.data.big_chunks?.length || 0
                });
            } else {
                this.showError(data.error || 'An error occurred while processing the request');
            }
        } catch (err) {
            console.error('Request failed:', err);
            this.showError('Network error. Please check your connection and try again.');
        } finally {
            this.enableSubmit();
            this.hideLoading();
        }
    }

    hideAll() {
        this.loadingElement?.classList.remove('show');
        this.resultsElement?.classList.remove('show');
        this.errorElement?.classList.remove('show');
    }

    showLoading() {
        this.loadingElement?.classList.add('show');
    }

    hideLoading() {
        this.loadingElement?.classList.remove('show');
    }

    showError(message) {
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.textContent = message;
        }
        this.errorElement?.classList.add('show');
    }

    disableSubmit() {
        if (this.submitButton) {
            this.submitButton.disabled = true;
        }
    }

    enableSubmit() {
        if (this.submitButton) {
            this.submitButton.disabled = false;
        }
    }

    displayResults(data) {
        // This will be implemented by the specific application
        console.log('Display results:', data);
    }
}

// ===== CONTENT DISPLAY PATTERNS =====
class ContentDisplay {
    static displayWebpageView(data, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = '';
        
        if (data.big_chunks && data.big_chunks.length > 0) {
            data.big_chunks.forEach(chunk => {
                html += `<div class="chunk-section">`;
                
                // Add title
                html += `<h${Math.min(chunk.level + 1, 6)} class="chunk-title level-${chunk.level}">${this.escapeHtml(chunk.title)}</h${Math.min(chunk.level + 1, 6)}>`;
                
                // Add meta info
                html += `<div class="chunk-meta">Section Level ${chunk.level} • ${chunk.small_chunks.length} content ${chunk.small_chunks.length === 1 ? 'piece' : 'pieces'}</div>`;
                
                // Add content
                html += `<div class="chunk-content">`;
                chunk.small_chunks.forEach(content => {
                    if (content.startsWith('- ')) {
                        // Handle lists
                        const listItems = content.split('\n').map(item => {
                            if (item.startsWith('- ')) {
                                return `<li>${this.escapeHtml(item.substring(2))}</li>`;
                            }
                            return '';
                        }).filter(Boolean).join('');
                        html += `<ul>${listItems}</ul>`;
                    } else if (content.startsWith('> ')) {
                        // Handle blockquotes
                        html += `<blockquote>${this.escapeHtml(content.substring(2))}</blockquote>`;
                    } else {
                        // Handle regular paragraphs
                        html += `<p>${this.escapeHtml(content)}</p>`;
                    }
                });
                html += `</div>`;
                
                html += `</div>`;
            });
        } else {
            html = '<div class="chunk-section"><p>No content chunks were extracted from this URL. The page may not have structured content or may be protected.</p></div>';
        }
        
        container.innerHTML = html;
    }

    static displayChunksView(data, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = '';
        
        if (data.big_chunks && data.big_chunks.length > 0) {
            data.big_chunks.forEach((chunk, chunkIndex) => {
                html += `<div class="big-chunk">`;
                
                // Big chunk header
                html += `<div class="big-chunk-header">`;
                html += `<h3 class="big-chunk-title">${this.escapeHtml(chunk.title)}</h3>`;
                html += `<div class="big-chunk-meta">Chunk ${chunk.big_chunk_index} • Level ${chunk.level} • ${chunk.small_chunks.length} sections</div>`;
                html += `</div>`;
                
                // Small chunks container
                html += `<div class="small-chunks-container">`;
                chunk.small_chunks.forEach((smallChunk, smallIndex) => {
                    html += `<div class="small-chunk">`;
                    html += `<div class="small-chunk-index">${smallIndex + 1}</div>`;
                    html += `<div class="small-chunk-content">`;
                    
                    if (smallChunk.startsWith('- ')) {
                        // Handle lists
                        const listItems = smallChunk.split('\n').map(item => {
                            if (item.startsWith('- ')) {
                                return `<li>${this.escapeHtml(item.substring(2))}</li>`;
                            }
                            return '';
                        }).filter(Boolean).join('');
                        html += `<ul>${listItems}</ul>`;
                    } else if (smallChunk.startsWith('> ')) {
                        // Handle blockquotes
                        html += `<blockquote>${this.escapeHtml(smallChunk.substring(2))}</blockquote>`;
                    } else {
                        // Handle regular content
                        html += this.escapeHtml(smallChunk);
                    }
                    
                    html += `</div>`;
                    html += `</div>`;
                });
                html += `</div>`;
                
                html += `</div>`;
            });
        } else {
            html = '<div class="big-chunk"><div class="big-chunk-header"><h3 class="big-chunk-title">No Chunks Found</h3></div><div class="small-chunks-container"><p>No content chunks were extracted from this URL.</p></div></div>';
        }
        
        container.innerHTML = html;
    }

    static displayJsonView(data, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const formattedJson = JSON.stringify(data, null, 2);
        container.textContent = formattedJson;
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ===== UTILITY FUNCTIONS =====
class Utils {
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Copy failed:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        }
    }

    static downloadFile(content, filename, mimeType = 'application/json') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    static showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;

        // Set background color based on type
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            info: '#3498db',
            warning: '#f39c12'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(notification);

        // Auto remove after duration
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);

        return notification;
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// ===== ACTION BUTTONS =====
class ActionButtons {
    constructor() {
        this.currentData = null;
        this.init();
    }

    init() {
        // Copy JSON button
        const copyBtn = document.getElementById('copy-json');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyJson());
        }

        // Download JSON button
        const downloadBtn = document.getElementById('download-json');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadJson());
        }

        // New extraction button
        const newExtractionBtn = document.getElementById('new-extraction');
        if (newExtractionBtn) {
            newExtractionBtn.addEventListener('click', () => this.newExtraction());
        }
    }

    setData(data) {
        this.currentData = data;
    }

    async copyJson() {
        if (!this.currentData) return;
        
        // Track copy action
        trackEvent('json_copied');
        
        const success = await Utils.copyToClipboard(JSON.stringify(this.currentData, null, 2));
        
        if (success) {
            const copyBtn = document.getElementById('copy-json');
            if (copyBtn) {
                copyBtn.textContent = '✅ Copied!';
                setTimeout(() => {
                    copyBtn.textContent = '📋 Copy JSON';
                }, 2000);
            }
        }
    }

    downloadJson() {
        if (!this.currentData) return;
        
        // Track download action
        trackEvent('json_downloaded');
        
        Utils.downloadFile(
            JSON.stringify(this.currentData, null, 2),
            'page-chunks.json',
            'application/json'
        );
    }

    newExtraction() {
        // Track new extraction action
        trackEvent('new_extraction');
        
        // Hide all results
        const results = document.getElementById('results');
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        
        if (results) results.classList.remove('show');
        if (loading) loading.classList.remove('show');
        if (error) error.classList.remove('show');
        
        // Clear input
        const urlInput = document.getElementById('url-input');
        if (urlInput) {
            urlInput.value = '';
            urlInput.focus();
        }
        
        // Reset data
        this.currentData = null;
    }
}

// ===== INITIALIZATION PATTERN =====
class App {
    constructor() {
        this.viewManager = null;
        this.formHandler = null;
        this.actionButtons = null;
        this.currentData = null;
    }

    init() {
        // Initialize view manager
        this.viewManager = new ViewManager();
        
        // Initialize form handler
        this.formHandler = new FormHandler('chunker-form', '/api/chunk');
        
        // Initialize action buttons
        this.actionButtons = new ActionButtons();
        
        // Override form handler's display results method
        this.formHandler.displayResults = (data) => this.displayResults(data);
        
        // Focus on input when page loads
        const urlInput = document.getElementById('url-input');
        if (urlInput) {
            urlInput.focus();
        }
    }

    displayResults(data) {
        this.currentData = data;
        this.actionButtons.setData(data);
        
        // Display JSON
        ContentDisplay.displayJsonView(data, 'json-content');
        
        // Display webpage view
        ContentDisplay.displayWebpageView(data, 'webpage-content');
        
        // Display chunks view
        ContentDisplay.displayChunksView(data, 'chunks-content');
        
        // Show results
        const results = document.getElementById('results');
        if (results) {
            results.classList.add('show');
        }
        
        // Show webpage view by default
        this.viewManager.showView('webpage');
        
        // Scroll to results
        results?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ===== EXPORT FOR USE IN OTHER PROJECTS =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ViewManager,
        FormHandler,
        ContentDisplay,
        Utils,
        ActionButtons,
        App,
        trackEvent
    };
} else {
    // Browser environment
    window.GetChunksPatterns = {
        ViewManager,
        FormHandler,
        ContentDisplay,
        Utils,
        ActionButtons,
        App,
        trackEvent
    };
}

// ===== AUTO-INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    const app = new App();
    app.init();
}); 