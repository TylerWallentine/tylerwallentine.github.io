// Project search (Projects page).
// Search published projects by keyword, an existing tag, and/or a date range
// (createdAt). Shows results in the main column and hides the featured/recent
// sections while a search/filter is active.
(function () {
  if (!location.pathname.includes("projects")) return;

  let cache = null; // published projects, loaded once

  function whenReady(cb) {
    if (window.firestoreDb && window.fsCollection && window.fsGetDocs && window.fsQuery && window.fsWhere) {
      cb();
    } else {
      setTimeout(() => whenReady(cb), 300);
    }
  }

  async function fetchProjects() {
    if (cache) return cache;
    const q = window.fsQuery(
      window.fsCollection(window.firestoreDb, "projects"),
      window.fsWhere("published", "==", true)
    );
    const snap = await window.fsGetDocs(q);
    cache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return cache;
  }

  const toDate = (v) => v?.toDate?.() || (v ? new Date(v) : null);

  async function populateTags() {
    const sel = document.getElementById("project-tag-filter");
    if (!sel) return;
    const projects = await fetchProjects();
    const tags = new Set();
    projects.forEach((p) => (Array.isArray(p.tags) ? p.tags : []).forEach((t) => tags.add(t)));
    [...tags].sort((a, b) => a.localeCompare(b)).forEach((t) => {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      sel.appendChild(o);
    });
  }

  function readFilters() {
    return {
      kw: (document.getElementById("project-search")?.value || "").trim().toLowerCase(),
      tag: document.getElementById("project-tag-filter")?.value || "",
      from: document.getElementById("project-date-from")?.value || "",
      to: document.getElementById("project-date-to")?.value || "",
    };
  }

  const anyActive = (f) => !!(f.kw || f.tag || f.from || f.to);

  async function runSearch() {
    const f = readFilters();
    const featured = document.querySelector(".featured-section");
    const recent = document.querySelector(".recent-projects-section");
    const results = document.getElementById("project-search-results");
    const list = document.getElementById("project-results-list");
    const clearBtn = document.getElementById("project-search-clear");

    // No filters -> restore the default view.
    if (!anyActive(f)) {
      if (results) results.style.display = "none";
      if (featured) featured.style.display = "";
      if (recent) recent.style.display = "";
      if (clearBtn) clearBtn.style.display = "none";
      return;
    }

    if (featured) featured.style.display = "none";
    if (recent) recent.style.display = "none";
    if (results) results.style.display = "";
    if (clearBtn) clearBtn.style.display = "";
    if (list) list.innerHTML = `<div class="loading-message">Searching…</div>`;

    let projects;
    try {
      projects = await fetchProjects();
    } catch (err) {
      console.error("Project search failed to load projects:", err);
      if (list) list.innerHTML = `<div class="error-message">Couldn't load projects.</div>`;
      return;
    }

    const fromD = f.from ? new Date(f.from + "T00:00:00") : null;
    const toD = f.to ? new Date(f.to + "T23:59:59") : null;

    const matches = projects.filter((p) => {
      if (f.kw) {
        const hay = [p.title, p.excerpt, ...(Array.isArray(p.tags) ? p.tags : [])]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(f.kw)) return false;
      }
      if (f.tag && !(Array.isArray(p.tags) ? p.tags : []).includes(f.tag)) return false;
      if (fromD || toD) {
        const d = toDate(p.createdAt);
        if (!d) return false;
        if (fromD && d < fromD) return false;
        if (toD && d > toD) return false;
      }
      return true;
    });

    // Newest first
    matches.sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));

    if (!list) return;
    if (!matches.length) {
      list.innerHTML = `<div class="no-content-message"><h3>No matching projects</h3><p>Try different keywords, tag, or dates.</p></div>`;
      return;
    }

    const render = window.renderProjectCard ||
      ((p) => `<article class="project-card"><div class="project-card-body">
                 <h3>${p.title || "Untitled Project"}</h3>
                 <p>${p.excerpt || ""}</p>
                 <button class="read-more-btn" data-project-id="${p.id}">Read More</button>
               </div></article>`);
    list.innerHTML = matches.map(render).join("");
  }

  function debounce(fn, ms) {
    let t;
    return () => { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  document.addEventListener("DOMContentLoaded", () => {
    whenReady(async () => {
      try { await populateTags(); } catch (e) { console.warn("Could not populate project tags:", e); }

      const kw = document.getElementById("project-search");
      const tag = document.getElementById("project-tag-filter");
      const from = document.getElementById("project-date-from");
      const to = document.getElementById("project-date-to");
      const btn = document.getElementById("project-search-btn");
      const clear = document.getElementById("project-search-clear");
      const deb = debounce(runSearch, 300);

      if (kw) {
        kw.addEventListener("input", deb);
        kw.addEventListener("keypress", (e) => { if (e.key === "Enter") runSearch(); });
      }
      if (tag) tag.addEventListener("change", runSearch);
      if (from) from.addEventListener("change", runSearch);
      if (to) to.addEventListener("change", runSearch);
      if (btn) btn.addEventListener("click", runSearch);
      if (clear) {
        clear.addEventListener("click", () => {
          if (kw) kw.value = "";
          if (tag) tag.value = "";
          if (from) from.value = "";
          if (to) to.value = "";
          runSearch();
        });
      }
    });
  });
})();
