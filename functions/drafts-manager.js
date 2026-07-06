// Drafts manager (editor-only).
// Shows a light-yellow bar at the top of the Blog page when there are
// unpublished drafts, and a modal to edit or delete them.
(function () {
  const ADMIN_EMAIL = "wallentinetyler@gmail.com";

  // Only run on the blog page.
  if (!location.pathname.includes("blog")) return;

  let isEditor = false;

  // Wait until the shared Firebase globals are available.
  function whenReady(cb) {
    if (window.firestoreDb && window.firebaseAuth && window.fsCollection && window.fsGetDocs) {
      cb();
    } else {
      setTimeout(() => whenReady(cb), 300);
    }
  }

  // Editor = the site owner (by auth token email) OR a user whose Firestore
  // profile role is "editor".
  async function checkEditor(user) {
    if (!user) return false;
    if (user.email === ADMIN_EMAIL) return true;
    try {
      const snap = await window.fsGetDoc(window.fsDoc(window.firestoreDb, "users", user.uid));
      return snap.exists() && (snap.data().role || "").toLowerCase() === "editor";
    } catch (e) {
      console.warn("Draft editor check failed:", e);
      return false;
    }
  }

  // Query unpublished drafts (single-field where -> no composite index needed),
  // sorted newest-first client-side.
  async function loadDrafts() {
    const db = window.firestoreDb;
    const q = window.fsQuery(
      window.fsCollection(db, "posts"),
      window.fsWhere("published", "==", false)
    );
    const snap = await window.fsGetDocs(q);
    const drafts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    drafts.sort((a, b) => {
      const am = a.lastModified?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
      const bm = b.lastModified?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
      return bm - am;
    });
    return drafts;
  }

  function updateBar(count) {
    const bar = document.getElementById("drafts-bar");
    const text = document.getElementById("drafts-bar-text");
    if (!bar || !text) return;
    if (!isEditor || count <= 0) {
      bar.style.display = "none";
      return;
    }
    text.textContent =
      `You have ${count} unpublished draft${count === 1 ? "" : "s"}. Click here to manage them.`;
    bar.style.display = "block";
  }

  async function refresh() {
    if (!isEditor) {
      updateBar(0);
      return [];
    }
    try {
      const drafts = await loadDrafts();
      updateBar(drafts.length);
      return drafts;
    } catch (err) {
      console.error("Failed to load drafts:", err);
      return [];
    }
  }

  function renderList(drafts) {
    const list = document.getElementById("drafts-list");
    if (!list) return;
    if (!drafts.length) {
      list.innerHTML = "<p>No unpublished drafts. 🎉</p>";
      return;
    }
    list.innerHTML = drafts
      .map((d) => {
        const date = d.lastModified?.toDate?.() || d.createdAt?.toDate?.() || null;
        const dateStr = date ? date.toLocaleDateString() : "";
        const title = (d.title || "Untitled").replace(/</g, "&lt;");
        return `
          <div class="draft-item" data-id="${d.id}">
            <div class="draft-info">
              <span class="draft-title">${title}</span>
              <span class="draft-date">${dateStr}</span>
            </div>
            <div class="draft-actions">
              <button class="draft-edit" data-id="${d.id}">✎ Edit</button>
              <button class="draft-delete" data-id="${d.id}">🗑 Delete</button>
            </div>
          </div>`;
      })
      .join("");
  }

  function openModal(drafts) {
    const modal = document.getElementById("drafts-modal");
    if (!modal) return;
    renderList(drafts);
    modal.classList.add("active");
  }

  function closeModal() {
    const modal = document.getElementById("drafts-modal");
    if (modal) modal.classList.remove("active");
  }

  // Open a draft in the editor (reuse the blog's in-page editor overlay).
  function editDraft(id) {
    closeModal();
    if (window.blogPostViewer && typeof window.blogPostViewer.loadNewPost === "function") {
      window.blogPostViewer.loadNewPost();
      setTimeout(() => {
        const iframe = document.querySelector(".new-post-frame");
        if (iframe) iframe.src = `/posting?edit=${id}`;
      }, 60);
    } else {
      window.location.href = `/posting?edit=${id}`;
    }
  }

  async function deleteDraft(id) {
    if (!confirm("Delete this draft permanently? This cannot be undone.")) return;
    try {
      await window.fsDeleteDoc(window.fsDoc(window.firestoreDb, "posts", id));
      const drafts = await refresh();
      renderList(drafts);
    } catch (err) {
      console.error("Failed to delete draft:", err);
      alert("Failed to delete draft: " + (err.code || err.message || err));
    }
  }

  function wire() {
    const bar = document.getElementById("drafts-bar");
    const modal = document.getElementById("drafts-modal");
    const closeBtn = document.getElementById("drafts-modal-close");
    const list = document.getElementById("drafts-list");

    if (bar) bar.addEventListener("click", async () => openModal(await refresh()));
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

    if (list) {
      list.addEventListener("click", (e) => {
        const edit = e.target.closest(".draft-edit");
        const del = e.target.closest(".draft-delete");
        if (edit) editDraft(edit.dataset.id);
        else if (del) deleteDraft(del.dataset.id);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    wire();
    whenReady(() => {
      window.firebaseAuth.onAuthStateChanged(async (user) => {
        isEditor = await checkEditor(user);
        refresh();
      });
    });
  });

  // Expose a refresh hook so other code (e.g. after publishing) can update the bar.
  window.refreshDraftsBar = refresh;
})();
