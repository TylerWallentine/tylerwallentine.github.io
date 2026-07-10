/* ============================================================
   newsletter.js — Front-end newsletter / subscriber framework
   ------------------------------------------------------------
   USER-FACING ONLY. No backend yet.

   Everything funnels through Newsletter.subscribe(email, source).
   That ONE function is the single integration point: when you pick
   a provider (Zoho Campaigns, etc.), wire it there and nothing else
   on the site needs to change.

   Features provided now:
     • First-visit subscribe popup (shows once, site-wide, via localStorage)
     • Reusable opt-in checkbox for the future registration form
     • Email validation, loading / success / error UI states

   Include on a page with:
     <link rel="stylesheet" href="newsletter.css">
     <script src="functions/newsletter.js"></script>
   The popup auto-initializes. To disable auto-popup on a page, add
   data-newsletter-no-popup to the <body>.
   ============================================================ */

(function () {
  "use strict";

  const Newsletter = {};

  // ---- Configuration ----
  // Subscriptions now go through the `subscribe` Cloud Function, which talks to
  // Zoho Campaigns server-side with secret credentials. No Zoho form URLs or
  // list keys live here anymore.
  Newsletter.config = {
    // UI copy
    popupTitle: "Stay in the loop",
    popupBody: "Get an email when I publish a new project or blog post. No spam, unsubscribe anytime.",
    successMessage: "Thanks! Please check your inbox to confirm your subscription.",
    checkboxLabel: "Email me when there's a new post or project",

    // Behaviour
    popupDelayMs: 1500,                 // wait before showing popup on first visit
  };

  // ---- localStorage keys ----
  const LS = {
    popupSeen: "vr_newsletter_popup_seen",
    subscribed: "vr_newsletter_subscribed",
    pendingEmails: "vr_newsletter_pending", // legacy local capture (unused)
  };

  // ---- Helpers ----
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  function lsGet(key) {
    try { return window.localStorage.getItem(key); } catch (_) { return null; }
  }
  function lsSet(key, val) {
    try { window.localStorage.setItem(key, val); } catch (_) {}
  }

  /**
   * Record a subscription in the Firestore `subscribers` collection.
   *
   * Doc id == the lowercased email, so duplicates are impossible: creating a
   * subscription for an email that already exists is (server-side) an UPDATE,
   * @deprecated Kept only as a thin alias; the real work is done server-side
   * by the `subscribe` Cloud Function (see Newsletter.subscribe).
   */
  Newsletter.recordSubscriber = function (email) {
    return Newsletter.subscribe(email, "record");
  };

  /**
   * THE single integration point.
   *
   * Calls the `subscribe` Cloud Function, which (server-side) submits the email
   * through the Zoho Campaigns web-optin SIGNUP FORM — tying the contact to the
   * form's subscription (its list), not just a bare list — AND upserts the
   * Firestore `subscribers` record. No Zoho keys ever touch the browser.
   *
   * Returns a Promise that resolves on success and rejects with an Error.
   *
   * @param {string} email
   * @param {string} source  e.g. "popup" | "registration" | "profile"
   */
  Newsletter.subscribe = function (email, source) {
    email = String(email || "").trim().toLowerCase();
    source = source || "unknown";

    if (!isValidEmail(email)) {
      return Promise.reject(new Error("Please enter a valid email address."));
    }

    if (typeof window.callFunction !== "function") {
      return Promise.reject(new Error("Subscription service is unavailable right now."));
    }

    return window.callFunction("subscribe", { email }).then((res) => {
      lsSet(LS.subscribed, "1");
      return { email, source, mode: "cloud-function", ...(res || {}) };
    });
  };

  /**
   * Unsubscribe / deactivate a subscription via the `unsubscribe` Cloud
   * Function. Requires the caller to be signed in as the email's owner or an
   * editor. Pass { delete: true } (editors only) to remove the record.
   *
   * @param {string} email
   * @param {object} [opts] { delete?: boolean }
   */
  Newsletter.unsubscribe = function (email, opts) {
    email = String(email || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      return Promise.reject(new Error("Invalid email address."));
    }
    if (typeof window.callFunction !== "function") {
      return Promise.reject(new Error("Subscription service is unavailable right now."));
    }
    return window.callFunction("unsubscribe", {
      email,
      delete: !!(opts && opts.delete),
    });
  };

  // Inspect captured emails during local testing: Newsletter.getPending()
  Newsletter.getPending = function () {
    try { return JSON.parse(lsGet(LS.pendingEmails) || "[]"); } catch (_) { return []; }
  };

  // ============================================================
  //  First-visit popup
  // ============================================================
  Newsletter.initPopup = function (options) {
    options = options || {};
    const cfg = Newsletter.config;

    // Don't show if already seen or already subscribed.
    if (!options.force && (lsGet(LS.popupSeen) || lsGet(LS.subscribed))) return;

    const overlay = document.createElement("div");
    overlay.className = "nl-popup-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", cfg.popupTitle);
    overlay.innerHTML = `
      <div class="nl-popup">
        <button type="button" class="nl-popup-close" aria-label="Close">&times;</button>
        <h2 class="nl-popup-title">${cfg.popupTitle}</h2>
        <p class="nl-popup-body">${cfg.popupBody}</p>
        <form class="nl-form" novalidate>
          <input type="email" class="nl-input" name="email" placeholder="you@example.com"
                 autocomplete="email" required aria-label="Email address">
          <button type="submit" class="nl-submit">Subscribe</button>
        </form>
        <p class="nl-message" role="status" aria-live="polite"></p>
        <button type="button" class="nl-popup-dismiss">No thanks</button>
      </div>`;

    const close = () => {
      lsSet(LS.popupSeen, "1");
      overlay.classList.remove("is-open");
      setTimeout(() => overlay.remove(), 250);
    };

    overlay.querySelector(".nl-popup-close").addEventListener("click", close);
    overlay.querySelector(".nl-popup-dismiss").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", onEsc); }
    });

    const form = overlay.querySelector(".nl-form");
    const input = overlay.querySelector(".nl-input");
    const submit = overlay.querySelector(".nl-submit");
    const message = overlay.querySelector(".nl-message");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      message.className = "nl-message";
      message.textContent = "";
      submit.disabled = true;
      submit.textContent = "Subscribing…";
      try {
        await Newsletter.subscribe(input.value, "popup");
        message.classList.add("is-success");
        message.textContent = cfg.successMessage;
        form.style.display = "none";
        overlay.querySelector(".nl-popup-dismiss").textContent = "Close";
      } catch (err) {
        message.classList.add("is-error");
        message.textContent = err.message || "Something went wrong. Please try again.";
        submit.disabled = false;
        submit.textContent = "Subscribe";
      }
    });

    document.body.appendChild(overlay);
    // Trigger CSS entrance after insert.
    requestAnimationFrame(() => overlay.classList.add("is-open"));
    setTimeout(() => input.focus(), 300);
  };

  // ============================================================
  //  Registration opt-in checkbox (for the future register page)
  // ============================================================
  /**
   * Inject a styled opt-in checkbox into a container.
   * @param {string|Element} target  selector or element to append into
   * @param {object} [opts] { id, label, checked }
   * @returns {HTMLInputElement|null} the checkbox input
   */
  Newsletter.renderCheckbox = function (target, opts) {
    opts = opts || {};
    const host = typeof target === "string" ? document.querySelector(target) : target;
    if (!host) { console.warn("[newsletter] renderCheckbox: target not found", target); return null; }
    const id = opts.id || "nl-optin";
    const label = opts.label || Newsletter.config.checkboxLabel;
    const wrap = document.createElement("label");
    wrap.className = "nl-checkbox";
    wrap.innerHTML = `
      <input type="checkbox" id="${id}" ${opts.checked ? "checked" : ""}>
      <span>${label}</span>`;
    host.appendChild(wrap);
    return wrap.querySelector("input");
  };

  /**
   * Call this AFTER a successful account creation. If the opt-in checkbox is
   * checked, it subscribes the registration email.
   * @param {string} email
   * @param {string} [checkboxSelector] defaults to "#nl-optin"
   * @returns {Promise<boolean>} whether a subscribe was attempted
   */
  Newsletter.handleRegistrationOptIn = function (email, checkboxSelector) {
    const box = document.querySelector(checkboxSelector || "#nl-optin");
    if (box && box.checked) {
      return Newsletter.subscribe(email, "registration").then(() => true).catch((e) => {
        console.warn("[newsletter] registration opt-in failed:", e.message);
        return false;
      });
    }
    return Promise.resolve(false);
  };

  // Expose globally
  window.Newsletter = Newsletter;

  // ---- Auto-init popup on first visit ----
  document.addEventListener("DOMContentLoaded", function () {
    if (document.body.hasAttribute("data-newsletter-no-popup")) return;
    setTimeout(() => Newsletter.initPopup(), Newsletter.config.popupDelayMs);
  });
})();
