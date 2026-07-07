// Project drafts manager (editor-only).
// Mirrors the blog drafts system: shows a light-yellow bar at the top of the
// Projects page when there are unpublished projects, and a modal to edit or
// delete them.
(function () {
  const ADMIN_EMAIL = "wallentinetyler@gmail.com";
  if (!location.pathname.includes("projects")) return;

  let isEditor = false;

  function whenReady(cb) {
    if (window.firestoreDb && window.firebaseAuth && window.fsCollection && window.fsGetDocs) cb();
    else setTimeout(() => whenReady(cb), 300);
  }

  async function checkEditor(user) {
    if (!user) return false;
    if (user.email === ADMIN_EMAIL) return true;
    try {
      const snap = await window.fsGetDoc(window.fsDoc(window.firestoreDb, "users", user.uid));
      return snap.exists() && (snap.data().role || "").toLowerCase() === "editor";
    } catch (e) {
      console.warn("Project draft editor check failed:", e);
      return false;
    }
  }

  async function loadDrafts() {
    const db = window.firestoreDb;
    const q = window.fsQuery(
      window.fsCollection(db, "projects"),
      window.fsWhere("published", "==", false)
    );
    const snap = await window.fsGetDocs(q);
    const drafts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    drafts.sort((a, b) => {
      const am = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
      const bm = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
      return bm - am;
    });
    return drafts;
  }

  function updateBar(count) {
    const bar = document.getElementById("project-drafts-bar");
    const text = document.getElementById("project-drafts-bar-text");
    if (!bar || !text) return;
    if (!isEditor || count <= 0) { bar.style.display = "none"; return; }
    text.textContent =
      `You have ${count} unpublished project${count === 1 ? "" : "s"}. Click here to manage them.`;
    bar.style.display = "block";
  }

  async function refresh() {
    if (!isEditor) { updateBar(0); return []; }
    try {
      const drafts = await loadDrafts();
      updateBar(drafts.length);
      return drafts;
    } catch (err) {
      console.error("Failed to load project drafts:", err);
      return [];
    }
  }

  function renderList(drafts) {
    const list = document.getElementById("project-drafts-list");
    if (!list) return;
    if (!drafts.length) { list.innerHTML = "<p>No unpublished projects. 🎉</p>"; return; }
    list.innerHTML = drafts.map((d) => {
      const date = d.updatedAt?.toDate?.() || d.createdAt?.toDate?.() || null;
      const dateStr = date ? date.toLocaleDateString() : "";
      const title = (d.title || "Untitled Project").replace(/</g, "&lt;");
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
    }).join("");
  }

  function openModal(drafts) {
    const modal = document.getElementById("project-drafts-modal");
    if (!modal) return;
    renderList(drafts);
    modal.classList.add("active");
  }
  function closeModal() {
    const modal = document.getElementById("project-drafts-modal");
    if (modal) modal.classList.remove("active");
  }

  function editDraft(id) {
    window.location.href = `/project-editor?id=${encodeURIComponent(id)}`;
  }

  async function deleteDraft(id) {
    if (!confirm("Delete this project draft permanently (including its phases)? This cannot be undone.")) return;
    try {
      // Delete phases subcollection first, then the project doc.
      const projectRef = window.fsDoc(window.firestoreDb, "projects", id);
      const phasesRef = window.fsCollection(projectRef, "phases");
      const phaseSnap = await window.fsGetDocs(phasesRef);
      await Promise.all(phaseSnap.docs.map((d) => window.fsDeleteDoc(window.fsDoc(phasesRef, d.id))));
      await window.fsDeleteDoc(projectRef);
      const drafts = await refresh();
      renderList(drafts);
    } catch (err) {
      console.error("Failed to delete project draft:", err);
      alert("Failed to delete project: " + (err.code || err.message || err));
    }
  }

  function wire() {
    const bar = document.getElementById("project-drafts-bar");
    const modal = document.getElementById("project-drafts-modal");
    const closeBtn = document.getElementById("project-drafts-modal-close");
    const list = document.getElementById("project-drafts-list");

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
})();
