// SPA Router - Handles all dynamic content loading and navigation
class SPARouter {
    constructor() {
        this.routes = {
            '/': 'main',
            '/main': 'main',
            '/aboutme': 'aboutme',
            '/projects': 'projects',
            '/blog': 'blog',
            '/contact': 'contact',
            '/login': 'login',
            '/profile': 'profile',
            '/posting': 'posting'
        };
        
        this.currentRoute = null;
        this.contentCache = new Map();
        this.setupEventListeners();
    }
    
    init() {
        // Check for authentication state
        if (window.firebaseAuth) {
            window.firebaseAuth.onAuthStateChanged((user) => {
                this.currentUser = user;
                // Update account bar if function exists
                if (window.updateAccountBar) {
                    window.updateAccountBar(document.querySelector('.account-bar'), 
                        user ? user.displayName || user.email : null);
                }
            });
        }
        
        // Load initial route based on URL or default to main
        const path = window.location.pathname.replace('.html', '');
        const route = this.routes[path] || 'main';
        this.navigate(route);
    }
    
    setupEventListeners() {
        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.route) {
                this.loadContent(e.state.route, false);
            }
        });
        
        // Handle all navigation clicks
        document.addEventListener('click', (e) => {
            // Handle links with href
            const link = e.target.closest('a');
            if (link && link.href) {
                const url = new URL(link.href);
                
                // Check if it's an internal navigation link
                if (url.hostname === window.location.hostname) {
                    const path = url.pathname.replace('.html', '');
                    const route = this.extractRoute(path);
                    
                    if (this.routes.hasOwnProperty('/' + route)) {
                        e.preventDefault();
                        this.navigate(route);
                    }
                }
            }
            
            // Handle grid navigation items
            const gridItem = e.target.closest('[data-nav]');
            if (gridItem) {
                e.preventDefault();
                const route = gridItem.dataset.nav.replace('h-', '');
                this.navigate(route);
            }
            
            // Handle button navigations
            if (e.target.matches('.grid-item, .grid-item-small')) {
                const text = e.target.textContent.toLowerCase().replace(/\s+/g, '');
                if (this.routes.hasOwnProperty('/' + text)) {
                    e.preventDefault();
                    this.navigate(text);
                }
            }
        });
    }
    
    extractRoute(path) {
        // Remove leading slash and 'h-' prefix if present
        return path.replace(/^\//, '').replace('h-', '');
    }
    
    async navigate(route, updateHistory = true) {
        // Add loading state
        this.setLoadingState(true);
        
        try {
            await this.loadContent(route, updateHistory);
        } catch (error) {
            console.error('Navigation error:', error);
            this.showError('Failed to load page. Please try again.');
        } finally {
            this.setLoadingState(false);
        }
    }
    
    async loadContent(route, updateHistory = true) {
        // Don't reload if we're already on this route
        if (this.currentRoute === route && !this.requiresReload(route)) {
            return;
        }
        
        // Clear previous content
        this.clearContent();
        
        // Update browser history
        if (updateHistory) {
            const url = route === 'main' ? '/' : '/' + route;
            window.history.pushState({ route }, '', url);
        }
        
        this.currentRoute = route;
        
        // Load route-specific content
        switch(route) {
            case 'main':
                await this.loadMainPage();
                break;
            case 'login':
                await this.loadLoginPage();
                break;
            case 'profile':
                await this.loadProfilePage();
                break;
            case 'blog':
                await this.loadBlogPage();
                break;
            case 'posting':
                await this.loadPostingPage();
                break;
            case 'aboutme':
            case 'projects':
            case 'contact':
                await this.loadStandardPage(route);
                break;
            default:
                this.loadMainPage();
        }
    }
    
    clearContent() {
        // Clear dynamic sections
        document.getElementById('hero-section').innerHTML = '';
        document.getElementById('main-content').innerHTML = '';
        document.getElementById('navigation').innerHTML = '';
        
        // Reset any special body styles
        document.body.style.background = '';
    }
    
    async loadMainPage() {
        // Load hero
        const heroHtml = `
            <header class="hero">
                <div class="hero-content">
                    <h1>Vapor Main</h1>
                    <p>Precipitating Concreteness from the Esoteric</p>
                </div>
            </header>
        `;
        document.getElementById('hero-section').innerHTML = heroHtml;
        
        // Load navigation grid
        const navHtml = `
            <div class="grid-container">
                <div class="grid-item" data-nav="aboutme">About Me</div>
                <div class="grid-item" data-nav="projects">Projects</div>
                <div class="grid-item" data-nav="blog">Blog</div>
                <div class="grid-item" data-nav="contact">Contact</div>
            </div>
        `;
        document.getElementById('navigation').innerHTML = navHtml;
    }
    
    async loadLoginPage() {
        // Set gradient background
        document.body.style.background = 'linear-gradient(to bottom, white 0%, #1a4d3a 100%)';
        
        // Load hero side
        const heroHtml = `
            <header class="hero_side">
                <div class="hero-content">
                    <h2>Account Creation & Log In</h2>
                </div>
            </header>
        `;
        document.getElementById('hero-section').innerHTML = heroHtml;
        
        // Load login box
        await ModuleLoader.loadModule('modules/login-box.html', '#main-content');
        
        // Initialize login form
        if (window.initializeLoginForm) {
            setTimeout(() => window.initializeLoginForm(), 100);
        }
    }
    
    async loadProfilePage() {
        // Check authentication
        if (!this.currentUser) {
            this.navigate('login');
            return;
        }
        
        // Set gradient background
        document.body.style.background = 'linear-gradient(to bottom, white 0%, #1a4d3a 100%)';
        
        // Load hero side
        const heroHtml = `
            <header class="hero_side">
                <div class="hero-content">
                    <h2>Account Center</h2>
                </div>
            </header>
        `;
        document.getElementById('hero-section').innerHTML = heroHtml;
        
        // Load profile box
        await ModuleLoader.loadModule('modules/profile-box.html', '#main-content');
        
        // Populate profile data
        if (window.populateUserProfile) {
            setTimeout(() => window.populateUserProfile(), 100);
        }
    }
    
    async loadBlogPage() {
        // Load small hero
        const heroHtml = `
            <header class="hero-small">
                <div class="hero-small-content">
                    <h1>Blog</h1>
                </div>
            </header>
        `;
        document.getElementById('hero-section').innerHTML = heroHtml;
        
        // Load navigation
        const navHtml = `
            <div class="grid-container-small">
                <div class="grid-item-small" data-nav="main">Home</div>
                <div class="grid-item-small" data-nav="projects">Projects</div>
                <div class="grid-item-small" data-nav="aboutme">About</div>
                <div class="grid-item-small" data-nav="contact">Contact</div>
            </div>
        `;
        document.getElementById('navigation').innerHTML = navHtml;
        
        // Load blog content
        const blogHtml = `
            <main class="blog-layout">
                <div class="blog-content">
                    <section class="featured-section">
                        <h2 class="section-title">Featured Post</h2>
                        <div id="featured-post" class="featured-post">
                            <div class="loading-message">Loading featured post...</div>
                        </div>
                    </section>
                    <section class="recent-posts-section">
                        <h2 class="section-title">Recent Posts</h2>
                        <div id="recent-posts" class="recent-posts">
                            <div class="loading-message">Loading recent posts...</div>
                        </div>
                    </section>
                </div>
                <aside class="blog-sidebar">
                    <div class="search-section">
                        <h3>Search</h3>
                        <div class="search-box">
                            <input type="text" id="blog-search" placeholder="Search posts...">
                            <button class="search-btn">🔍</button>
                        </div>
                    </div>
                    <div class="filters-section">
                        <h3>Filter by Category</h3>
                        <div class="filter-options">
                            <div class="filter-option">
                                <input type="checkbox" id="mathematics" value="Mathematics">
                                <label for="mathematics">Mathematics</label>
                            </div>
                            <div class="filter-option">
                                <input type="checkbox" id="technology" value="Technology">
                                <label for="technology">Technology</label>
                            </div>
                            <div class="filter-option">
                                <input type="checkbox" id="economics" value="Economics">
                                <label for="economics">Economics</label>
                            </div>
                            <div class="filter-option">
                                <input type="checkbox" id="research" value="Research">
                                <label for="research">Research</label>
                            </div>
                        </div>
                    </div>
                    <div class="tags-section">
                        <h3>Popular Tags</h3>
                        <div class="tags-cloud" id="tags-cloud">
                            <div class="loading-message">Loading tags...</div>
                        </div>
                    </div>
                </aside>
            </main>
        `;
        document.getElementById('main-content').innerHTML = blogHtml;
        
        // Initialize blog functionality
        this.initializeBlog();
    }
    
    async loadPostingPage() {
        // Check authentication
        if (!this.currentUser) {
            this.navigate('login');
            return;
        }
        
        // Clear hero for full editor
        document.getElementById('hero-section').innerHTML = '';
        
        // Load editor HTML
        const editorHtml = `
            <div class="editor-container">
                <div class="toolbar">
                    <div class="toolbar-group">
                        <button class="toolbar-btn" data-action="bold" title="Bold (Ctrl+B)">
                            <strong>B</strong>
                        </button>
                        <button class="toolbar-btn" data-action="italic" title="Italic (Ctrl+I)">
                            <em>I</em>
                        </button>
                        <button class="toolbar-btn" data-action="underline" title="Underline (Ctrl+U)">
                            <u>U</u>
                        </button>
                    </div>
                    
                    <div class="toolbar-group">
                        <select class="font-family" title="Font Family">
                            <option value="Arial">Arial</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Courier New">Courier New</option>
                            <option value="Helvetica">Helvetica</option>
                        </select>
                        <input type="color" class="color-picker" title="Text Color" value="#000000">
                    </div>
                    
                    <div class="toolbar-group">
                        <button class="toolbar-btn" data-action="bulletList" title="Bullet List">• List</button>
                        <button class="toolbar-btn" data-action="numberedList" title="Numbered List">1. List</button>
                    </div>
                    
                    <div class="toolbar-group">
                        <button class="toolbar-btn" data-action="link" title="Insert Link">🔗 Link</button>
                        <button class="toolbar-btn" data-action="image" title="Upload Image">📷 Image</button>
                    </div>
                    
                    <div class="toolbar-group">
                        <button class="toolbar-btn" data-action="markdown" title="Toggle Markdown Mode">MD</button>
                        <button class="toolbar-btn" data-action="latex" title="Insert LaTeX">∑ LaTeX</button>
                    </div>
                    
                    <div class="toolbar-group">
                        <button class="toolbar-btn" data-action="preview" title="Toggle Preview">👁 Preview</button>
                        <button class="toolbar-btn" data-action="export" title="Export Content">💾 Export</button>
                    </div>
                    
                    <div class="toolbar-group">
                        <button class="toolbar-btn" onclick="window.spaRouter.navigate('blog')" title="Back to Blog">
                            ← Back
                        </button>
                    </div>
                </div>
                
                <div class="editor-wrapper">
                    <div class="editor-content" contenteditable="true" id="editor" 
                         placeholder="Start writing... You can paste images directly with Ctrl+V!">
                    </div>
                    <div class="preview-content" id="preview" style="display: none;"></div>
                </div>
                
                <div class="status-bar">
                    <span class="word-count">Words: 0</span>
                    <span class="char-count">Characters: 0</span>
                    <span class="mode-indicator">Rich Text Mode</span>
                </div>
            </div>
            
            <!-- Modals -->
            <div class="modal" id="linkModal">
                <div class="modal-content">
                    <h3>Insert Link</h3>
                    <input type="text" id="linkText" placeholder="Link text">
                    <input type="url" id="linkUrl" placeholder="https://example.com">
                    <div class="modal-buttons">
                        <button id="insertLink">Insert</button>
                        <button id="cancelLink">Cancel</button>
                    </div>
                </div>
            </div>
            
            <div class="modal" id="latexModal">
                <div class="modal-content">
                    <h3>Insert LaTeX</h3>
                    <textarea id="latexInput" placeholder="Enter LaTeX expression"></textarea>
                    <div class="latex-preview" id="latexPreview"></div>
                    <div class="modal-buttons">
                        <button id="insertLatex">Insert</button>
                        <button id="cancelLatex">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('main-content').innerHTML = editorHtml;
        
        // Load the posting script if not already loaded
        if (!window.PostEditor) {
            const script = document.createElement('script');
            script.src = 'j-posting.js';
            script.onload = () => {
                window.postEditor = new PostEditor();
            };
            document.body.appendChild(script);
        } else {
            // Reinitialize editor
            window.postEditor = new PostEditor();
        }
    }
    
    async loadStandardPage(route) {
        // Load small hero
        const titles = {
            'aboutme': 'About Me',
            'projects': 'Projects',
            'contact': 'Contact'
        };
        
        const heroHtml = `
            <header class="hero-small">
                <div class="hero-small-content">
                    <h1>${titles[route]}</h1>
                </div>
            </header>
        `;
        document.getElementById('hero-section').innerHTML = heroHtml;
        
        // Load navigation
        const navHtml = `
            <div class="grid-container-small">
                <div class="grid-item-small" data-nav="main">Home</div>
                <div class="grid-item-small" data-nav="projects">Projects</div>
                <div class="grid-item-small" data-nav="blog">Blog</div>
                <div class="grid-item-small" data-nav="contact">Contact</div>
            </div>
        `;
        document.getElementById('navigation').innerHTML = navHtml;
        
        // Load page-specific content (you can create separate content files for these)
        const content = await this.loadPageContent(route);
        document.getElementById('main-content').innerHTML = content;
    }
    
    async loadPageContent(route) {
        // Try to load content from cache first
        if (this.contentCache.has(route)) {
            return this.contentCache.get(route);
        }
        
        // Default content for each page - you can replace with actual content
        const defaultContent = {
            'aboutme': `
                <div style="padding: 40px; max-width: 800px; margin: 0 auto;">
                    <h2>About Me</h2>
                    <p>Welcome to my personal website. This section is under construction.</p>
                </div>
            `,
            'projects': `
                <div style="padding: 40px; max-width: 800px; margin: 0 auto;">
                    <h2>My Projects</h2>
                    <p>Project showcase coming soon.</p>
                </div>
            `,
            'contact': `
                <div style="padding: 40px; max-width: 800px; margin: 0 auto;">
                    <h2>Contact Information</h2>
                    <p>Contact form coming soon.</p>
                </div>
            `
        };
        
        const content = defaultContent[route] || '<div>Page not found</div>';
        this.contentCache.set(route, content);
        return content;
    }
    
    async initializeBlog() {
        // Initialize Firebase blog functions
        if (!window.blogManager && window.firebaseApp) {
            // Dynamically load blog functions if not loaded
            const script = document.createElement('script');
            script.type = 'module';
            script.textContent = `
                import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
                
                // Initialize blog with existing Firebase app
                if (window.firebaseApp && !window.firestoreDb) {
                    window.firestoreDb = getFirestore(window.firebaseApp);
                }
                
                // Wait for blog functions to be available
                setTimeout(() => {
                    if (window.loadBlogPosts) {
                        window.loadBlogPosts();
                    }
                    if (window.setupSearchAndFilters) {
                        window.setupSearchAndFilters();
                    }
                }, 500);
            `;
            document.body.appendChild(script);
        } else if (window.loadBlogPosts) {
            // Blog functions already loaded
            window.loadBlogPosts();
            if (window.setupSearchAndFilters) {
                window.setupSearchAndFilters();
            }
        }
    }
    
    requiresReload(route) {
        // Some routes might need fresh data on each visit
        return ['blog', 'profile'].includes(route);
    }
    
    setLoadingState(loading) {
        // Add visual loading indicator
        if (loading) {
            document.body.style.cursor = 'wait';
            // You could add a loading spinner here
        } else {
            document.body.style.cursor = '';
        }
    }
    
    showError(message) {
        const errorHtml = `
            <div style="padding: 40px; text-align: center; color: #d32f2f;">
                <h2>Error</h2>
                <p>${message}</p>
                <button onclick="window.spaRouter.navigate('main')" 
                        style="margin-top: 20px; padding: 10px 20px; background: #022d33; 
                               color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Go to Home
                </button>
            </div>
        `;
        document.getElementById('main-content').innerHTML = errorHtml;
    }
}

// Make router globally accessible
window.SPARouter = SPARouter;