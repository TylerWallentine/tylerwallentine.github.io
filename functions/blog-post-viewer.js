// Blog Post Viewer - Add to your /blog or create as blog-post-viewer.js

class BlogPostViewer {
    constructor() {
        this.currentPost = null;
        this.viewerContainer = null;
        this.init();
    }
    
    init() {
        // Create the viewer overlay structure
        this.createViewerOverlay();
        
        // Setup event listeners for all "Read More" buttons
        this.setupReadMoreListeners();
        
        // Check if URL has a post ID on page load
        this.checkUrlForPost();
        
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.postId) {
                this.loadPost(e.state.postId, false);
            } else {
                this.closeViewer(false);
            }
        });
    }
    
    async getUserRole() {
    try {
        const { getAuth, onAuthStateChanged } = await import(
            "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"
        );
        const auth = window.firebaseAuth || getAuth(window.firebaseApp);

        return new Promise((resolve) => {
            onAuthStateChanged(auth, async (user) => {
                if (!user) {
                    console.warn("No user signed in, defaulting to 'user'");
                    resolve("user");
                    return;
                }

                try {
                    const db = window.firestoreDb; // ✅ use shared db
                    const userRef = window.fsDoc(db, "users", user.uid); // ✅ global helper
                    const userSnap = await window.fsGetDoc(userRef);

                    if (userSnap.exists()) {
                        resolve(userSnap.data().role || "user");
                    } else {
                        console.warn("User doc not found, defaulting to 'user'");
                        resolve("user");
                    }
                } catch (err) {
                    console.error("Error reading Firestore user doc:", err);
                    resolve("user");
                }
            });
        });
    } catch (err) {
        console.error("Error fetching user role:", err);
        return "user";
    }
}




    createViewerOverlay() {
        // Create the overlay container
        const overlay = document.createElement('div');
        overlay.id = 'post-viewer-overlay';
        overlay.className = 'post-viewer-overlay';
        overlay.style.display = 'none';
        
        overlay.innerHTML = `
            
            
            <div class="post-viewer-container">
                <div class="post-viewer-header">
                    <h2 style="margin: 0;">Post Viewer</h2>
                    <button class="post-viewer-close" onclick="blogPostViewer.closeViewer()">×</button>
                </div>
                
                <div class="post-viewer-content" id="post-viewer-content">
                    <!-- Post content will be loaded here -->
                </div>

                <div class="post-creator-content" id="post-creator-content">
                    <!-- Post content will be loaded here -->
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.viewerContainer = overlay;
    }
    
setupReadMoreListeners() {
    document.body.addEventListener('click', (e) => {
        const button = e.target.closest('.read-more-btn');
        if (button) {
            e.preventDefault();
            const postId = button.dataset.postId;
            if (postId) {
                this.openPost(postId);
                
            }
        }
    });
}
    
    checkUrlForPost() {
        const urlParams = new URLSearchParams(window.location.search);
        const postId = urlParams.get('post');
        
        if (postId) {
            // Load the post directly
            this.loadPost(postId, false);
        }
    }
    
async openPost(postId) {

    const newUrl = `${window.location.pathname}?post=${postId}`;
    window.history.pushState({ postId }, '', newUrl);

    if (postId === "new") {
        await this.loadNewPost();
    } else {
        await this.loadPost(postId);
    }
}

async loadNewPost() {
    document.getElementById('post-viewer-content').style.display = 'none';
document.getElementById('post-creator-content').style.display = 'block';


    const contentDiv = document.getElementById('post-creator-content');

    this.viewerContainer.style.display = 'block';
    setTimeout(() => this.viewerContainer.classList.add('active'), 10);

    // Update the header title
    const headerTitle = this.viewerContainer.querySelector('.post-viewer-header h2');
    if (headerTitle) headerTitle.textContent = "Creating Post";

    // Hide blog content behind overlay
    const blogLayout = document.querySelector('.blog-layout');
    if (blogLayout) blogLayout.style.display = 'none';

    // Use iframe for the editor
    contentDiv.innerHTML = `
        <article class="new-post-wrapper">
            <iframe src="/posting" class="new-post-frame"></iframe>
        </article>
    `;
}


    
async loadPost(postId, animate = true) {
    this.viewerContainer.style.display = 'block';
    setTimeout(() => this.viewerContainer.classList.add('active'), 10);

    const contentDiv = document.getElementById('post-viewer-content');
    contentDiv.style.display = 'block';
    document.getElementById('post-creator-content').style.display = 'none';

    try {
        const db = window.firestoreDb; // ✅ use the db we already initialized

        const postRef = window.fsDoc(db, 'posts', postId);
        const postSnap = await window.fsGetDoc(postRef);
        
        if (!postSnap.exists()) {
            contentDiv.innerHTML = '<div style="text-align: center; padding: 40px;">Post not found.</div>';
            return;
        }

        const post = { id: postSnap.id, ...postSnap.data() };
        this.currentPost = post;

        // ---- Increment view count ----
        // Rules allow anyone to bump ONLY the `views` field on a post.
        const currentViews = typeof post.views === 'number' ? post.views : 0;
        const displayViews = currentViews + 1;
        try {
            await window.fsUpdateDoc(postRef, { views: window.fsIncrement(1) });
            post.views = displayViews;
        } catch (viewErr) {
            console.warn('Could not increment views:', viewErr);
        }

        // Prev/Next
        const postsRef = window.fsCollection(db, 'posts');
        const prevQuery = window.fsQuery(
            postsRef,
            window.fsWhere('published', '==', true),
            window.fsWhere('createdAt', '<', post.createdAt),
            window.fsOrderBy('createdAt', 'desc'),
            window.fsLimit(1)
        );
        const nextQuery = window.fsQuery(
            postsRef,
            window.fsWhere('published', '==', true),
            window.fsWhere('createdAt', '>', post.createdAt),
            window.fsOrderBy('createdAt', 'asc'),
            window.fsLimit(1)
        );

        const [prevSnap, nextSnap] = await Promise.all([
            window.fsGetDocs(prevQuery),
            window.fsGetDocs(nextQuery)
        ]);
        const prevPost = prevSnap.empty ? null : { id: prevSnap.docs[0].id, ...prevSnap.docs[0].data() };
        const nextPost = nextSnap.empty ? null : { id: nextSnap.docs[0].id, ...nextSnap.docs[0].data() };
        
        // Meta info
        const wordCount = post.wordCount || (post.plainText ? post.plainText.split(/\s+/).length : 0);
        const readTime = Math.max(1, Math.round(wordCount / 200));
        const postDate = post.createdAt?.toDate ? post.createdAt.toDate() : new Date(post.createdAt);

        // Render article
        const role = await this.getUserRole();
        
        contentDiv.innerHTML = `
            <article>
                <div class="post-actions-bar">
                    <h1 class="post-full-title">${post.title}</h1>
                    <div class="post-menu">
                        <button class="menu-btn">⋮</button>
                        <div class="menu-options hidden">
                            <button class="menu-option">♡ Bookmark</button>
                            ${role.toLowerCase() === 'editor' ? `
                                <button class="menu-option feature-option">★ Feature this article</button>
                                <button class="menu-option edit-option">✎ Edit</button>
                                <button class="menu-option delete-option">🗑 Delete</button>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <div class="post-full-meta">
                    <span class="post-author">By ${post.author || 'Anonymous'}</span>
                    <span class="post-date-full">${postDate.toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'})}</span>
                    <span class="post-read-time">${readTime} min read</span>
                    <span class="post-views" title="Views">
                        <svg class="post-views-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                        ${displayViews.toLocaleString()}
                    </span>
                </div>
                
                ${post.tags && post.tags.length > 0 ? `
                    <div class="post-full-tags">
                        ${post.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
                
                ${post.attachments && post.attachments.length ? `
                    <aside class="post-attachments-sidebar">
                        <h3>Attachments:</h3>
                        <ul>
                            ${post.attachments.map(a => `<li><a href="${a.url}" target="_blank" rel="noopener">📎 ${a.name}</a></li>`).join('')}
                        </ul>
                    </aside>
                ` : ''}

                <div class="post-full-content">
                    ${post.content || '<p>No content available.</p>'}
                </div>
                
                <div class="share-buttons">
                    <span>Share:</span>
                    <button class="share-btn" onclick="blogPostViewer.copyLink()">Copy Link</button>
                    <button class="share-btn" onclick="blogPostViewer.shareTwitter()">Twitter</button>
                    <button class="share-btn" onclick="blogPostViewer.shareLinkedIn()">LinkedIn</button>
                    <span class="copy-link-feedback" id="copy-feedback">Link copied!</span>
                </div>
                
                <nav class="post-navigation">
                    ${prevPost ? `
                        <button class="post-nav-btn" onclick="blogPostViewer.openPost('${prevPost.id}')">
                            ← Previous: ${prevPost.title}
                        </button>
                    ` : '<div class="post-nav-btn disabled">No previous post</div>'}
                    
                    ${nextPost ? `
                        <button class="post-nav-btn" onclick="blogPostViewer.openPost('${nextPost.id}')">
                            Next: ${nextPost.title} →
                        </button>
                    ` : '<div class="post-nav-btn disabled">No next post</div>'}
                </nav>
            </article>
        `;
        
        // Attach menu events
        const menuBtn = contentDiv.querySelector('.menu-btn');
        const menuOptions = contentDiv.querySelector('.menu-options');
        if (menuBtn && menuOptions) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log("3-dot clicked");
                menuOptions.classList.toggle('hidden');
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.post-menu')) {
                    menuOptions.classList.add('hidden');
                }
            });
        }
        
        contentDiv.scrollTop = 0;
    } catch (error) {
        console.error('Error loading post:', error);
        document.getElementById('post-viewer-content').innerHTML = 
            '<div style="text-align: center; padding: 40px;">Error loading post. Please try again.</div>';
    }
    const featureBtn = contentDiv.querySelector('.feature-option');
    const editBtn = contentDiv.querySelector('.edit-option');
    const deleteBtn = contentDiv.querySelector('.delete-option');

    // Delete option
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!confirm("Are you sure you want to delete this post?")) return;

            try {
                const db = window.firestoreDb;
                const postRef = window.fsDoc(db, "posts", this.currentPost.id); // ✅ use this.currentPost
                await window.fsDeleteDoc(postRef);

                alert("Post deleted.");
                this.closeViewer();
                if (window.loadBlogPosts) window.loadBlogPosts(); // refresh list
            } catch (err) {
                console.error("Error deleting post:", err);
                alert("Failed to delete post.");
            }
        });
    }

    // Edit option
    if (editBtn && editBtn.textContent.includes("Edit")) {
        editBtn.addEventListener('click', () => {
            this.loadNewPost(); // shows the iframe
            const iframe = document.querySelector(".new-post-frame");
            iframe.src = `/posting?edit=${this.currentPost.id}`; // ✅ use this.currentPost
        });
    }

    // Feature option
    if (featureBtn && featureBtn.textContent.includes("Feature")) {
        featureBtn.addEventListener('click', async () => {
            try {
                const db = window.firestoreDb;
                const postRef = window.fsDoc(db, "posts", this.currentPost.id); // ✅ use this.currentPost
                await window.fsUpdateDoc(postRef, { featured: true });
                alert("Post marked as featured!");
            } catch (err) {
                console.error("Error featuring post:", err);
                alert("Failed to update post.");
            }
        });
    }



}

    
    closeViewer(updateUrl = true) {
        // Animate out
        this.viewerContainer.classList.remove('active');
        
        setTimeout(() => {
            this.viewerContainer.style.display = 'none';
            
            // Show blog content again
            const blogLayout = document.querySelector('.blog-layout');
            if (blogLayout) {
                blogLayout.style.display = '';
            }
        }, 300);
        
        // Update URL to remove post parameter
        if (updateUrl) {
            const url = window.location.pathname;
            window.history.pushState({}, '', url);
        }
        
        this.currentPost = null;
    }
    
    copyLink() {
        const postUrl = `${window.location.origin}${window.location.pathname}?post=${this.currentPost.id}`;
        
        navigator.clipboard.writeText(postUrl).then(() => {
            const feedback = document.getElementById('copy-feedback');
            feedback.style.display = 'inline';
            setTimeout(() => {
                feedback.style.display = 'none';
            }, 2000);
        });
    }
    
    shareTwitter() {
        if (!this.currentPost) return;
        const postUrl = `${window.location.origin}${window.location.pathname}?post=${this.currentPost.id}`;
        const text = `Check out this post: ${this.currentPost.title}`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(postUrl)}`, '_blank');
    }
    
    shareLinkedIn() {
        if (!this.currentPost) return;
        const postUrl = `${window.location.origin}${window.location.pathname}?post=${this.currentPost.id}`;
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`, '_blank');
    }
}

// Initialize the post viewer when page loads
window.blogPostViewer = null;

// At the end of blog-post-viewer.js, replace the initialization with:
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on blog page
    if (window.location.pathname.includes('blog')) {
        // Wait a bit for Firebase to be ready
        setTimeout(() => {
            window.blogPostViewer = new BlogPostViewer();
        }, 1000);
    }
});

// Make sure to update the read more button generation in your blog-functions.js
// Change from: onclick="window.location.href='post.html?id=${post.id}'"
// To: onclick="blogPostViewer.openPost('${post.id}')"