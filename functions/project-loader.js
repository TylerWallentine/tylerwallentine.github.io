setTimeout(() => {
  const db = window.firestoreDb;

  window.loadProjects = async function() {
    try {
      // Featured project
      const featuredQuery = window.fsQuery(
        window.fsCollection(db, 'projects'),
        window.fsWhere('published', '==', true),
        window.fsWhere('featured', '==', true),
        window.fsOrderBy('createdAt', 'desc'),
        window.fsLimit(1)
      );
      const featuredSnap = await window.fsGetDocs(featuredQuery);
      if (!featuredSnap.empty) {
        const project = { id: featuredSnap.docs[0].id, ...featuredSnap.docs[0].data() };
        displayFeaturedProject(project);
      } else {
        document.getElementById('featured-project').innerHTML = `<p>No featured project yet.</p>`;
      }

      // Recent projects
      const recentQuery = window.fsQuery(
        window.fsCollection(db, 'projects'),
        window.fsWhere('published', '==', true),
        window.fsOrderBy('createdAt', 'desc'),
        window.fsLimit(6)
      );
      const recentSnap = await window.fsGetDocs(recentQuery);
      if (!recentSnap.empty) {
        const projects = recentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayRecentProjects(projects.filter(p => !p.featured));
      }
    } catch (err) {
      console.error("Error loading projects:", err);
    }
  };

  function displayFeaturedProject(project) {
    const date = project.createdAt?.toDate?.() || new Date();
    document.getElementById('featured-project').innerHTML = `
      <div class="featured-project-content">
        <img src="${project.previewImage || 'default-preview.png'}" class="featured-project-image">
        <h2>${project.title}</h2>
        <p>${project.excerpt}</p>
        <button class="read-more-btn" data-project-id="${project.id}">Read More</button>
      </div>
    `;
  }

  function displayRecentProjects(projects) {
    document.getElementById('recent-projects').innerHTML = projects.map(p => {
      const date = p.createdAt?.toDate?.() || new Date();
      return `
        <article class="project-card">
          <img src="${p.previewImage || 'default-preview.png'}" class="project-preview-image">
          <h3>${p.title}</h3>
          <p>${p.excerpt}</p>
          <span class="status">${p.status || ''}</span>
          <button class="read-more-btn" data-project-id="${p.id}">Read More</button>
        </article>
      `;
    }).join('');
  }

  // Mark ready
  window.projectFunctionsReady = true;
}, 500);
