class ModuleLoader {
    static async loadModule(modulePath, targetSelector, authCallback = null) {
        try {
            const response = await fetch(modulePath);
            if (!response.ok) {
                throw new Error(`Failed to load module: ${modulePath}`);
            }
            
            const html = await response.text();
            const targetElement = document.querySelector(targetSelector);
            
            if (targetElement) {
                targetElement.innerHTML = html;
                
                // If there's an auth callback, call it after loading
                if (authCallback && window.firebaseAuth) {
                    authCallback(targetElement);
                }
            } else {
                console.error(`Target element not found: ${targetSelector}`);
            }
        } catch (error) {
            console.error('Module loading error:', error);
        }
    }
    
    static async loadMultipleModules(modules) {
        const promises = modules.map(module => 
            this.loadModule(module.path, module.target, module.authCallback)
        );
        
        await Promise.all(promises);
    }
}

// Add to j-modules.js
window.navigateTo = async function(page) {
    const pageContent = document.getElementById('page-content');
    const heroTitle = document.querySelector('.hero-small-content h1');
    
    // Start transition
    pageContent.classList.add('page-transition');
    
    try {
        // Fetch content
        const response = await fetch(`${page}-content.html`);
        if (!response.ok) throw new Error('Page not found');
        
        const content = await response.text();
        
        // Update content after transition starts
        setTimeout(() => {
            pageContent.innerHTML = content;
            
            // Update hero title based on page
            const titles = {
                'h-blog': 'Blog',
                'projects': 'Projects',
                'contact': 'Contact',
                'home': 'Home'
            };
            if (heroTitle) heroTitle.textContent = titles[page] || 'Home';
            
            // Remove transition class
            pageContent.classList.remove('page-transition');
            
            // Update URL
            history.pushState({page}, '', `${page}.html`);
            
        }, 150);
        
    } catch (error) {
        console.warn('Navigation failed, falling back to traditional:', error);
        window.location.href = `${page}.html`;
    }
};


window.ModuleLoader = ModuleLoader;