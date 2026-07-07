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

  function tagsHtml(tags) {
    if (!Array.isArray(tags) || !tags.length) return '';
    return `<div class="project-card-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`;
  }

  // A real preview image displays larger + is click-to-zoom; the default
  // vapor-rain logo keeps its small icon size.
  function imageMarkup(previewImage, extraClass) {
    const hasImg = !!previewImage;
    const cls = hasImg
      ? `${extraClass} has-custom-image project-img-zoom`
      : `${extraClass} default-logo`;
    return `<img src="${previewImage || 'default-preview.png'}" class="${cls}" alt="">`;
  }

  function displayFeaturedProject(project) {
    const date = project.createdAt?.toDate?.() || new Date();
    document.getElementById('featured-project').innerHTML = `
      <div class="featured-project-content">
        ${imageMarkup(project.previewImage, 'featured-project-image')}
        <h2>${project.title}</h2>
        ${tagsHtml(project.tags)}
        <p>${project.excerpt}</p>
        <button class="read-more-btn" data-project-id="${project.id}">Read More</button>
      </div>
    `;
  }

  // Single source of truth for a project card (used by the recent feed AND
  // the search results, so they stay visually identical).
  function renderProjectCard(p) {
    return `
        <article class="project-card">
          ${imageMarkup(p.previewImage, 'project-preview-image')}
          <div class="project-card-body">
            <h3>${p.title || 'Untitled Project'}</h3>
            ${tagsHtml(p.tags)}
            <p>${p.excerpt || ''}</p>
            <span class="status">${p.status || ''}</span>
            <button class="read-more-btn" data-project-id="${p.id}">Read More</button>
          </div>
        </article>
      `;
  }
  window.renderProjectCard = renderProjectCard;

  function displayRecentProjects(projects) {
    document.getElementById('recent-projects').innerHTML = projects.map(renderProjectCard).join('');
  }

  // Mark ready
  window.projectFunctionsReady = true;
}, 500);
