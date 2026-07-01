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

  // ---- Configuration (placeholders until backend is chosen) ----
  Newsletter.config = {
    // When using Zoho Campaigns' hosted signup form, set this to the form's
    // POST action URL and list field names Zoho generates. Until then the
    // subscribe() call below runs in PLACEHOLDER mode (no network request).
    provider: "PLACEHOLDER",            // "PLACEHOLDER" | "zoho"
    zohoFormActionUrl: "TODO_ZOHO_FORM_ACTION_URL",
    zohoEmailFieldName: "TODO_ZOHO_EMAIL_FIELD",   // e.g. "CONTACT_EMAIL"
    zohoExtraFields: {},                // any hidden fields Zoho requires (listname, etc.)

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
    pendingEmails: "vr_newsletter_pending", // local record while in PLACEHOLDER mode
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
   * THE single integration point.
   * Returns a Promise that resolves on success and rejects with an Error.
   *
   * @param {string} email
   * @param {string} source  e.g. "popup" | "registration"
   */
  Newsletter.subscribe = function (email, source) {
    email = String(email || "").trim().toLowerCase();
    source = source || "unknown";

    if (!isValidEmail(email)) {
      return Promise.reject(new Error("Please enter a valid email address."));
    }

    if (Newsletter.config.provider === "zoho") {
      // ----- FUTURE: real Zoho Campaigns submission -----
      // Zoho's hosted signup form expects a normal form POST. Because that
      // endpoint is cross-origin and returns HTML, the simplest reliable
      // approach is a hidden <form> submit (no-cors) or their JS form embed.
      // Wire this up when you have the real action URL + field names.
      const cfg = Newsletter.config;
      const form = document.createElement("form");
      form.action = cfg.zohoFormActionUrl;
      form.method = "POST";
      form.target = "vr_newsletter_sink";
      form.style.display = "none";

      const addField = (name, value) => {
        const i = document.createElement("input");
        i.type = "hidden"; i.name = name; i.value = value;
        form.appendChild(i);
      };
      addField(cfg.zohoEmailFieldName, email);
      Object.entries(cfg.zohoExtraFields || {}).forEach(([k, v]) => addField(k, v));

      // Hidden iframe sink so the page doesn't navigate away.
      let sink = document.getElementById("vr_newsletter_sink");
      if (!sink) {
        sink = document.createElement("iframe");
        sink.name = "vr_newsletter_sink";
        sink.id = "vr_newsletter_sink";
        sink.style.display = "none";
        document.body.appendChild(sink);
      }
      document.body.appendChild(form);
      form.submit();
      form.remove();

      lsSet(LS.subscribed, "1");
      return Promise.resolve({ email, source, mode: "zoho" });
    }

    // ----- PLACEHOLDER mode: no backend yet -----
    // Records the email locally so the UI works end-to-end and you can see
    // captured addresses in the console / localStorage while testing.
    return new Promise((resolve) => {
      setTimeout(() => {
        let pending = [];
        try { pending = JSON.parse(lsGet(LS.pendingEmails) || "[]"); } catch (_) {}
        pending.push({ email, source, at: new Date().toISOString() });
        lsSet(LS.pendingEmails, JSON.stringify(pending));
        lsSet(LS.subscribed, "1");
        console.info(
          "[newsletter] PLACEHOLDER subscribe captured:",
          { email, source },
          "\n(No email was actually sent — wire Newsletter.subscribe() to Zoho to go live.)"
        );
        resolve({ email, source, mode: "placeholder" });
      }, 500);
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
