// Admin Console (editor-only).
// Manages users (role, approval, disable) and subscribers (active, status,
// linking to user accounts). Purely client-side: all privileged writes are
// enforced by Firestore security rules (admin/editor only). "Delete account"
// = disable (no backend auth deletion).
(function () {
  const ADMIN_EMAIL = "wallentinetyler@gmail.com";
  const ROLES = ["user", "writer", "editor"];

  let usersCache = [];
  let subscribersCache = [];

  function whenReady(cb) {
    if (window.firestoreDb && window.firebaseAuth && window.fsCollection && window.fsGetDocs) cb();
    else setTimeout(() => whenReady(cb), 300);
  }

  const $ = (id) => document.getElementById(id);

  function status(msg, isError) {
    const el = $("admin-status");
    if (!el) return;
    el.textContent = msg;
    el.className = "admin-status" + (isError ? " is-error" : " is-success");
    if (msg) setTimeout(() => { if (el.textContent === msg) { el.textContent = ""; el.className = "admin-status"; } }, 3000);
  }

  const esc = (s) => String(s == null ? "" : s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

  async function isAdmin(user) {
    if (!user) return false;
    if (user.email === ADMIN_EMAIL) return true;
    try {
      const snap = await window.fsGetDoc(window.fsDoc(window.firestoreDb, "users", user.uid));
      return snap.exists() && (snap.data().role || "").toLowerCase() === "editor";
    } catch (e) { return false; }
  }

  // ---------- Data ----------
  async function loadAll() {
    const db = window.firestoreDb;
    const [uSnap, sSnap] = await Promise.all([
      window.fsGetDocs(window.fsCollection(db, "users")),
      window.fsGetDocs(window.fsCollection(db, "subscribers")).catch(() => ({ docs: [] })),
    ]);
    usersCache = uSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    subscribersCache = sSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  function subForUser(u) {
    return (
      subscribersCache.find((s) => s.id === u.id) ||
      subscribersCache.find((s) => (s.email || "").toLowerCase() === (u.email || "").toLowerCase()) ||
      null
    );
  }

  // ---------- Rendering ----------
  function userName(u) {
    return u.alias || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id;
  }

  function renderUsers() {
    const el = $("users-table");
    if (!usersCache.length) { el.innerHTML = "<p>No users found.</p>"; return; }

    el.innerHTML = usersCache.map((u) => {
      const sub = subForUser(u);
      const subState = sub ? (sub.active ? "Active" : "Inactive") : "—";
      const currentRole = (u.role || "user").toLowerCase();
      const roleOpts = ROLES.map((r) =>
        `<option value="${r}" ${currentRole === r ? "selected" : ""}>${r}</option>`).join("");
      return `
        <div class="admin-row ${u.disabled ? "is-disabled" : ""}" data-uid="${u.id}">
          <div class="admin-cell admin-cell-main">
            <span class="admin-user-name">${esc(userName(u))}</span>
            <span class="admin-user-email">${esc(u.email || "")}</span>
          </div>
          <div class="admin-cell">
            <label class="admin-mini">Role</label>
            <select class="admin-role-select">${roleOpts}</select>
          </div>
          <div class="admin-cell">
            <label class="admin-mini">Approved</label>
            ${u.approved
              ? '<span class="admin-tag ok">Approved</span>'
              : '<button class="admin-btn admin-approve">Approve</button>'}
          </div>
          <div class="admin-cell">
            <label class="admin-mini">Subscription</label>
            <span class="admin-tag">${subState}</span>
            ${sub ? `<button class="admin-btn admin-sub-toggle">${sub.active ? "Deactivate" : "Activate"}</button>` : ""}
          </div>
          <div class="admin-cell">
            <button class="admin-btn ${u.disabled ? "" : "danger"} admin-disable">
              ${u.disabled ? "Enable" : "Disable"}
            </button>
          </div>
        </div>`;
    }).join("");
  }

  function renderPending() {
    const el = $("pending-list");
    const pending = usersCache.filter((u) => !u.approved && !u.disabled);
    $("pending-count").textContent = String(pending.length);
    if (!pending.length) { el.innerHTML = "<p>No pending requests. 🎉</p>"; return; }
    el.innerHTML = pending.map((u) => `
      <div class="admin-row" data-uid="${u.id}">
        <div class="admin-cell admin-cell-main">
          <span class="admin-user-name">${esc(userName(u))}</span>
          <span class="admin-user-email">${esc(u.email || "")}</span>
        </div>
        <div class="admin-cell">
          <button class="admin-btn admin-approve">Approve</button>
        </div>
      </div>`).join("");
  }

  function renderSubscribers() {
    const el = $("subscribers-table");
    if (!subscribersCache.length) { el.innerHTML = "<p>No subscribers found.</p>"; return; }
    el.innerHTML = subscribersCache.map((s) => `
      <div class="admin-row" data-sub="${s.id}">
        <div class="admin-cell admin-cell-main">
          <span class="admin-user-name">${esc(s.alias || s.username || "—")}</span>
          <span class="admin-user-email">${esc(s.email || "")}</span>
        </div>
        <div class="admin-cell"><label class="admin-mini">Status</label><span class="admin-tag">${esc(s.status ?? "—")}</span></div>
        <div class="admin-cell"><label class="admin-mini">Linked uid</label><span class="admin-tag">${s.id && usersCache.some(u=>u.id===s.id) ? "yes" : (s.id ? esc(s.id) : "—")}</span></div>
        <div class="admin-cell">
          <button class="admin-btn admin-sub-toggle2">${s.active ? "Deactivate" : "Activate"}</button>
        </div>
      </div>`).join("");
  }

  function renderAll() { renderPending(); renderUsers(); renderSubscribers(); }

  // ---------- Actions ----------
  async function updateUser(uid, data) {
    await window.fsUpdateDoc(window.fsDoc(window.firestoreDb, "users", uid), data);
    const u = usersCache.find((x) => x.id === uid);
    if (u) Object.assign(u, data);
  }
  async function updateSubscriber(id, data) {
    await window.fsUpdateDoc(window.fsDoc(window.firestoreDb, "subscribers", id), data);
    const s = subscribersCache.find((x) => x.id === id);
    if (s) Object.assign(s, data);
  }

  async function normalizeSubscribers() {
    if (!confirm("Normalize all subscribers (add status:1 where missing, set id = matching user's uid)?")) return;
    status("Normalizing subscribers…");
    let changed = 0;
    for (const s of subscribersCache) {
      const patch = {};
      if (s.status === undefined || s.status === null) patch.status = 1;
      const match = usersCache.find((u) => (u.email || "").toLowerCase() === (s.email || "").toLowerCase());
      if (match && s.id !== match.id) patch.id = match.id; // store uid as a FIELD (doc id can't be changed in place)
      else if (match && s.id === undefined) patch.id = match.id;
      if (Object.keys(patch).length) {
        try { await updateSubscriber(s.id, patch); changed++; } catch (e) { console.error("normalize failed for", s.id, e); }
      }
    }
    renderSubscribers();
    status(`Normalized ${changed} subscriber${changed === 1 ? "" : "s"}.`);
  }

  function wire() {
    // Delegated actions across users + pending + subscribers.
    document.body.addEventListener("click", async (e) => {
      const row = e.target.closest("[data-uid],[data-sub]");
      if (!row) return;

      try {
        if (e.target.classList.contains("admin-approve")) {
          await updateUser(row.dataset.uid, { approved: true });
          renderAll(); status("User approved.");
        } else if (e.target.classList.contains("admin-disable")) {
          const u = usersCache.find((x) => x.id === row.dataset.uid);
          await updateUser(row.dataset.uid, { disabled: !u.disabled });
          renderAll(); status(u.disabled ? "Account enabled." : "Account disabled.");
        } else if (e.target.classList.contains("admin-sub-toggle")) {
          const u = usersCache.find((x) => x.id === row.dataset.uid);
          const sub = subForUser(u);
          if (sub) { await updateSubscriber(sub.id, { active: !sub.active }); renderAll(); status("Subscription updated."); }
        } else if (e.target.classList.contains("admin-sub-toggle2")) {
          const s = subscribersCache.find((x) => x.id === row.dataset.sub);
          if (s) { await updateSubscriber(s.id, { active: !s.active }); renderSubscribers(); status("Subscription updated."); }
        }
      } catch (err) {
        console.error(err); status("Action failed: " + (err.code || err.message || err), true);
      }
    });

    // Role changes
    document.body.addEventListener("change", async (e) => {
      if (!e.target.classList.contains("admin-role-select")) return;
      const row = e.target.closest("[data-uid]");
      if (!row) return;
      try { await updateUser(row.dataset.uid, { role: e.target.value }); status("Role updated."); }
      catch (err) { console.error(err); status("Failed to update role: " + (err.code || err.message || err), true); }
    });

    const normBtn = $("normalize-subscribers-btn");
    if (normBtn) normBtn.addEventListener("click", normalizeSubscribers);
  }

  document.addEventListener("DOMContentLoaded", () => {
    wire();
    whenReady(() => {
      window.firebaseAuth.onAuthStateChanged(async (user) => {
        const admin = await isAdmin(user);
        $("admin-checking").style.display = "none";
        if (!admin) {
          $("admin-denied").style.display = "";
          $("admin-console").style.display = "none";
          return;
        }
        $("admin-denied").style.display = "none";
        $("admin-console").style.display = "";
        try {
          await loadAll();
          renderAll();
        } catch (err) {
          console.error("Admin load failed:", err);
          status("Failed to load data: " + (err.code || err.message || err), true);
        }
      });
    });
  });
})();
