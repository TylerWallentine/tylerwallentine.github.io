// Blog Firebase Integration - Add to your existing j-firebase.js or create blog-functions.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, where, getDocs } from 'firebase/firestore';

// Blog post management functions
class BlogManager {
    constructor(firebaseConfig) {
        this.app = initializeApp(firebaseConfig);
        this.db = getFirestore(this.app);
        this.postsCollection = collection(this.db, 'posts');
    }

    // Load featured post (the one marked as featured)
    async loadFeaturedPost() {
        try {
            const featuredQuery = query(
                this.postsCollection,
                where('featured', '==', true),
                where('published', '==', true),
                orderBy('createdAt', 'desc'),
                limit(1)
            );
            
            const querySnapshot = await getDocs(featuredQuery);
            
            if (querySnapshot.empty) {
                this.displayNoFeaturedPost();
                return null;
            }
            
            const doc = querySnapshot.docs[0];
            const post = { id: doc.id, ...doc.data() };
            this.displayFeaturedPost(post);
            return post;
            
        } catch (error) {
            console.error('Error loading featured post:', error);
            this.displayFeaturedPostError();
            return null;
        }
    }

    // Load recent posts (excluding featured ones)
    async loadRecentPosts(limitCount = 6) {
        try {
            const recentQuery = query(
                this.postsCollection,
                where('published', '==', true),
                orderBy('createdAt', 'desc'),
                limit(limitCount + 1) // Get one extra to filter out featured
            );
            
            const querySnapshot = await getDocs(recentQuery);
            
            if (querySnapshot.empty) {
                this.displayNoRecentPosts();
                return [];
            }
            
            // Filter out featured posts and limit to desired count
            const posts = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(post => !post.featured)
                .slice(0, limitCount);
                
            if (posts.length === 0) {
                this.displayNoRecentPosts();
                return [];
            }
            
            this.displayRecentPosts(posts);
            return posts;
            
        } catch (error) {
            console.error('Error loading recent posts:', error);
            this.displayRecentPostsError();
            return [];
        }
    }

    // Search posts by title and content
    async searchPosts(searchTerm, filters = []) {
        try {
            // Note: Firestore doesn't support full-text search natively
            // For production, consider using Algolia or similar
            let searchQuery = query(
                this.postsCollection,
                where('published', '==', true),
                orderBy('createdAt', 'desc')
            );

            // Add category filters if provided
            if (filters.length > 0) {
                searchQuery = query(
                    this.postsCollection,
                    where('published', '==', true),
                    where('tags', 'array-contains-any', filters),
                    orderBy('createdAt', 'desc')
                );
            }

            const querySnapshot = await getDocs(searchQuery);
            let posts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Client-side search filtering (not ideal for large datasets)
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                posts = posts.filter(post => 
                    post.title.toLowerCase().includes(term) ||
                    post.excerpt.toLowerCase().includes(term) ||
                    (post.content && post.content.toLowerCase().includes(term))
                );
            }

            return posts;
            
        } catch (error) {
            console.error('Error searching posts:', error);
            return [];
        }
    }

    // Get all unique tags for filter options
    async loadAvailableTags() {
        try {
            const querySnapshot = await getDocs(
                query(this.postsCollection, where('published', '==', true))
            );
            
            const allTags = new Set();
            querySnapshot.docs.forEach(doc => {
                const tags = doc.data().tags || [];
                tags.forEach(tag => allTags.add(tag));
            });
            
            return Array.from(allTags).sort();
            
        } catch (error) {
            console.error('Error loading tags:', error);
            return [];
        }
    }

    // Display functions
    displayFeaturedPost(post) {
        const featuredContainer = document.getElementById('featured-post');
        const postDate = post.createdAt?.toDate?.() || new Date(post.createdAt);
        
        featuredContainer.innerHTML = `
            <div class="featured-post-image">
                <img src="${post.featuredImage || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="400" height="250" fill="%23f0f0f0"/><text x="200" y="130" text-anchor="middle" fill="%23999" font-family="Arial" font-size="16">Featured Image</text></svg>'}" 
                     alt="${post.title}" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"400\" height=\"250\" viewBox=\"0 0 400 250\"><rect width=\"400\" height=\"250\" fill=\"%23f0f0f0\"/><text x=\"200\" y=\"130\" text-anchor=\"middle\" fill=\"%23999\" font-family=\"Arial\" font-size=\"16\">Featured Image</text></svg>'">
            </div>
            <div class="featured-post-content">
                <div class="featured-post-meta">
                    <span class="post-date">${postDate.toLocaleDateString()}</span>
                    <span class="featured-badge">Featured</span>
                </div>
                <h2>${post.title}</h2>
                <p>${post.excerpt || 'No excerpt available.'}</p>
                <div class="post-tags">
                    ${(post.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                <button class="read-more-btn" data-post-id="${post.id}">Read More</button>
            </div>
        `;
    }

    displayNoFeaturedPost() {
        const featuredContainer = document.getElementById('featured-post');
        featuredContainer.innerHTML = `
            <div class="no-content-message">
                <h3>No featured posts at this time</h3>
                <p>Check back soon for highlighted content from our latest articles.</p>
            </div>
        `;
    }

    displayFeaturedPostError() {
        const featuredContainer = document.getElementById('featured-post');
        featuredContainer.innerHTML = `
            <div class="error-message">
                <h3>Unable to load featured post</h3>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }

    displayRecentPosts(posts) {
        const postsContainer = document.getElementById('recent-posts');
        postsContainer.innerHTML = posts.map(post => {
            const postDate = post.createdAt?.toDate?.() || new Date(post.createdAt);
            return `
                <article class="blog-post-card">
                    <div class="post-meta">
                        <span class="post-date">${postDate.toLocaleDateString()}</span>
                    </div>
                    <h3>${post.title}</h3>
                    <p>${post.excerpt || 'No excerpt available.'}</p>
                    <div class="post-tags">
                        ${(post.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                    <button class="read-more-btn" data-post-id="${post.id}">Read More</button>
                </article>
            `;
        }).join('');
    }

    displayNoRecentPosts() {
        const postsContainer = document.getElementById('recent-posts');
        postsContainer.innerHTML = `
            <div class="no-content-message">
                <h3>No recent posts found</h3>
                <p>New articles will appear here as they are published.</p>
            </div>
        `;
    }

    displayRecentPostsError() {
        const postsContainer = document.getElementById('recent-posts');
        postsContainer.innerHTML = `
            <div class="error-message">
                <h3>Unable to load recent posts</h3>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

// Initialize blog manager and expose globally
window.blogManager = null;

// Initialize when Firebase config is available
window.initializeBlog = function(firebaseConfig) {
    window.blogManager = new BlogManager(firebaseConfig);
};

// Updated page-specific functions for the blog page
window.loadBlogPosts = async function() {
    if (!window.blogManager) {
        console.error('Blog manager not initialized');
        return;
    }
    
    // Show loading states
    document.getElementById('featured-post').innerHTML = '<div class="loading-message">Loading featured post...</div>';
    document.getElementById('recent-posts').innerHTML = '<div class="loading-message">Loading recent posts...</div>';
    
    // Load content
    await Promise.all([
        window.blogManager.loadFeaturedPost(),
        window.blogManager.loadRecentPosts()
    ]);
};

window.setupSearchAndFilters = async function() {
    if (!window.blogManager) {
        console.error('Blog manager not initialized');
        return;
    }
    
    const searchInput = document.getElementById('blog-search');
    const filterCheckboxes = document.querySelectorAll('.filter-option input');
    
    // Load available tags and update filter options
    const availableTags = await window.blogManager.loadAvailableTags();
    updateFilterOptions(availableTags);
    
    // Debounced search function
    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch();
        }, 300);
    });
    
    // Filter change handler
    filterCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', performSearch);
    });
    
    async function performSearch() {
        const searchTerm = searchInput.value.trim();
        const activeFilters = Array.from(filterCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        
        if (searchTerm || activeFilters.length > 0) {
            const results = await window.blogManager.searchPosts(searchTerm, activeFilters);
            displaySearchResults(results);
        } else {
            // Reset to default view
            window.loadBlogPosts();
        }
    }
    
    function displaySearchResults(posts) {
        // Hide featured post section during search
        document.querySelector('.featured-section').style.display = 'none';
        
        // Update section title
        const sectionTitle = document.querySelector('.recent-posts-section .section-title');
        sectionTitle.textContent = 'Search Results';
        
        if (posts.length === 0) {
            document.getElementById('recent-posts').innerHTML = `
                <div class="no-content-message">
                    <h3>No posts found</h3>
                    <p>Try adjusting your search terms or filters.</p>
                </div>
            `;
        } else {
            window.blogManager.displayRecentPosts(posts);
        }
    }
    
    function updateFilterOptions(tags) {
        const filterContainer = document.querySelector('.filter-options');
        if (tags.length === 0) return;
        
        // Keep existing filters and add any new ones from database
        const existingFilters = Array.from(filterContainer.querySelectorAll('input')).map(input => input.value);
        const newTags = tags.filter(tag => !existingFilters.includes(tag));
        
        newTags.forEach(tag => {
            const filterId = tag.toLowerCase().replace(/\s+/g, '-');
            const filterHtml = `
                <div class="filter-option">
                    <input type="checkbox" id="${filterId}" value="${tag}">
                    <label for="${filterId}">${tag}</label>
                </div>
            `;
            filterContainer.insertAdjacentHTML('beforeend', filterHtml);
        });
    }
};