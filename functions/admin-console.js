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
      subscribersCache.find((s) => s.linkedaccount === u.id) ||
      subscribersCache.find((s) => (s.email || "").toLowerCase() === (u.email || "").toLowerCase()) ||
      null
    );
  }

  // Auto-link subscribers to user accounts by matching email. Any subscriber
  // whose linkedaccount is missing/"N/A" but whose email matches a user gets
  // its linkedaccount set to that user's uid. Runs once on load.
  async function autoLinkSubscribers() {
    for (const s of subscribersCache) {
      const linked = s.linkedaccount;
      const isLinked = linked && linked !== "N/A" && usersCache.some((u) => u.id === linked);
      if (isLinked) continue;
      const match = usersCache.find(
        (u) => (u.email || "").toLowerCase() === (s.email || "").toLowerCase()
      );
      if (match && s.linkedaccount !== match.id) {
        try {
          await updateSubscriber(s.id, { linkedaccount: match.id });
        } catch (e) {
          console.warn("Auto-link failed for", s.id, e);
        }
      }
    }
  }

  function linkedUserFor(s) {
    const linked = s.linkedaccount;
    if (linked && linked !== "N/A") {
      return usersCache.find((u) => u.id === linked) || null;
    }
    return usersCache.find(
      (u) => (u.email || "").toLowerCase() === (s.email || "").toLowerCase()
    ) || null;
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
      const st = subStatus(sub);
      const subState = sub ? subLabel(st) : "—";
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
            <span class="admin-tag ${st === "active" ? "ok" : st === "pending" ? "pending" : ""}">${subState}</span>
            ${sub ? `<button class="admin-btn admin-sub-toggle">${st === "active" ? "Deactivate" : "Activate"}</button>` : ""}
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

  // Subscriber status: prefer the explicit `status` field; fall back to the
  // legacy `active` boolean for docs written before statuses existed.
  function subStatus(s) {
    if (!s) return null;
    if (s.status) return s.status;                 // "pending" | "active" | "inactive"
    return (s.active !== false && s.active !== 0) ? "active" : "inactive";
  }
  function subLabel(st) {
    return st === "active" ? "Active"
         : st === "pending" ? "Awaiting Opt-In"
         : "Inactive";
  }

  function renderSubscribers() {
    const el = $("subscribers-table");
    const countEl = $("subscribers-count");
    if (countEl) countEl.textContent = String(subscribersCache.length);
    if (!subscribersCache.length) { el.innerHTML = "<p>No subscribers found.</p>"; return; }
    el.innerHTML = subscribersCache.map((s) => {
      const linkedUser = linkedUserFor(s);
      const linkedLabel = linkedUser ? esc(userName(linkedUser)) : "N/A";
      const st = subStatus(s);
      const label = subLabel(st);
      const tagClass = st === "active" ? "ok" : st === "pending" ? "pending" : "";
      let actionBtn;
      if (st === "pending") actionBtn = `<button class="admin-btn admin-sub-activate">Mark Active</button>`;
      else if (st === "active") actionBtn = `<button class="admin-btn admin-sub-toggle2">Deactivate</button>`;
      else actionBtn = `<button class="admin-btn admin-sub-toggle2">Reactivate</button>`;
      return `
      <div class="admin-row ${st === "active" ? "" : "is-disabled"}" data-sub="${esc(s.id)}">
        <div class="admin-cell admin-cell-main">
          <span class="admin-user-name">${esc(s.email || "—")}</span>
          <span class="admin-user-email">Linked account: ${linkedLabel}</span>
        </div>
        <div class="admin-cell">
          <label class="admin-mini">Status</label>
          <span class="admin-tag ${tagClass}">${label}</span>
        </div>
        <div class="admin-cell">${actionBtn}</div>
        <div class="admin-cell">
          <button class="admin-btn danger admin-sub-delete">Delete</button>
        </div>
      </div>`;
    }).join("");
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

  // Subscriber active/inactive/delete all flow through the Cloud Functions so
  // Zoho Campaigns and Firestore stay in sync. After each call we reload the
  // subscribers from Firestore to reflect the server's canonical state.
  async function subscribeEmail(email) { await window.callFunction("subscribe", { email }); }
  async function unsubscribeEmail(email) { await window.callFunction("unsubscribe", { email }); }
  async function deleteSubscriberEmail(email) { await window.callFunction("unsubscribe", { email, delete: true }); }

  async function reloadSubscribers() {
    const sSnap = await window.fsGetDocs(window.fsCollection(window.firestoreDb, "subscribers")).catch(() => ({ docs: [] }));
    subscribersCache = sSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
          const email = ((sub && sub.email) || u.email || "").toLowerCase();
          if (email) {
            const active = subStatus(sub) === "active";
            status(active ? "Unsubscribing…" : "Subscribing…");
            await (active ? unsubscribeEmail(email) : subscribeEmail(email));
            await reloadSubscribers(); renderAll(); status("Subscription updated.");
          }
        } else if (e.target.classList.contains("admin-sub-toggle2")) {
          const s = subscribersCache.find((x) => x.id === row.dataset.sub);
          if (s && s.email) {
            const active = subStatus(s) === "active";
            status(active ? "Unsubscribing…" : "Subscribing…");
            await (active ? unsubscribeEmail(s.email.toLowerCase()) : subscribeEmail(s.email.toLowerCase()));
            await reloadSubscribers(); renderSubscribers(); status("Subscription updated.");
          }
        } else if (e.target.classList.contains("admin-sub-activate")) {
          // Manual override: mark an "Awaiting Opt-In" subscriber Active without
          // waiting for the Zoho confirmation callback (editor-only per rules).
          const s = subscribersCache.find((x) => x.id === row.dataset.sub);
          if (s) {
            status("Marking active…");
            await updateSubscriber(s.id, { status: "active", active: true });
            renderSubscribers(); status("Subscriber marked active.");
          }
        } else if (e.target.classList.contains("admin-sub-delete")) {
          const s = subscribersCache.find((x) => x.id === row.dataset.sub);
          if (s && confirm(`Delete subscriber ${s.email || s.id}? This also unsubscribes them from Zoho.`)) {
            status("Deleting…");
            await deleteSubscriberEmail((s.email || "").toLowerCase());
            await reloadSubscribers(); renderSubscribers(); status("Subscriber deleted.");
          }
        }
      } catch (err) {
        console.error(err); status("Action failed: " + (err.code || err.message || err), true);
      }
    });

    // Sync the subscriber list FROM Zoho (editor-only Cloud Function).
    const syncBtn = $("sync-subscribers");
    if (syncBtn) {
      syncBtn.addEventListener("click", async () => {
        syncBtn.disabled = true;
        status("Syncing subscribers from Zoho…");
        try {
          const res = await window.callFunction("syncSubscribers", {});
          await reloadSubscribers(); renderAll();
          status(`Synced from Zoho: ${res.active} active, ${res.unsub} unsubscribed (${res.created} new).`);
        } catch (err) {
          console.error(err); status("Sync failed: " + (err.code || err.message || err), true);
        } finally {
          syncBtn.disabled = false;
        }
      });
    }

    // Role changes
    document.body.addEventListener("change", async (e) => {
      if (!e.target.classList.contains("admin-role-select")) return;
      const row = e.target.closest("[data-uid]");
      if (!row) return;
      try { await updateUser(row.dataset.uid, { role: e.target.value }); status("Role updated."); }
      catch (err) { console.error(err); status("Failed to update role: " + (err.code || err.message || err), true); }
    });
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
          await autoLinkSubscribers();
          renderAll();
        } catch (err) {
          console.error("Admin load failed:", err);
          status("Failed to load data: " + (err.code || err.message || err), true);
        }
      });
    });
  });
})();
