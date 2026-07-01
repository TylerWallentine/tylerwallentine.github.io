/* ============================================================
   contact.js — Front-end contact form handler
   ------------------------------------------------------------
   Static site (GitHub Pages) can't send email by itself, so all
   submissions go through ONE function: ContactForm.send(data).
   Wire your chosen form-to-email service there and nothing else
   on the page needs to change.

   Supported providers (set ContactForm.config.provider):
     "PLACEHOLDER" — default. Validates + logs + stores locally,
                     sends nothing. Lets the UI work end-to-end.
     "formsubmit"  — FormSubmit.co  (no signup; confirm once by email)
     "web3forms"   — Web3Forms      (free access key)
     "formspree"   — Formspree      (free tier)

   Markup contract (see h-contact.html):
     <form id="contact-form"> with fields named:
        name, email, subject, message, and a honeypot named "_gotcha".
     A <p class="cf-message"> for status text.
   ============================================================ */

(function () {
  "use strict";

  const ContactForm = {};

  ContactForm.config = {
    provider: "formspree", // "PLACEHOLDER" | "formsubmit" | "web3forms" | "formspree"

    // FormSubmit.co — set to your email (or their per-form hashed endpoint).
    // e.g. "https://formsubmit.co/ajax/you@example.com"
    formsubmitUrl: "TODO_FORMSUBMIT_AJAX_URL",

    // Web3Forms — get a free access key at web3forms.com
    web3formsAccessKey: "TODO_WEB3FORMS_ACCESS_KEY",

    // Formspree — your form endpoint, e.g. "https://formspree.io/f/abcdwxyz"
    formspreeUrl: "https://formspree.io/f/mbdvaejj",

    // UI copy
    successMessage: "Thanks! Your message has been sent — I'll get back to you soon.",
    errorMessage: "Sorry, something went wrong sending your message. Please try again or email me directly.",
  };

  const LS_PENDING = "vr_contact_pending"; // local record while in PLACEHOLDER mode

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  /**
   * THE single integration point.
   * @param {{name:string,email:string,subject:string,message:string}} data
   * @returns {Promise<void>} resolves on success, rejects with Error
   */
  ContactForm.send = async function (data) {
    const cfg = ContactForm.config;

    // ---- Validation (shared by all providers) ----
    if (!data.name || !data.name.trim()) throw new Error("Please enter your name.");
    if (!isValidEmail(data.email)) throw new Error("Please enter a valid email address.");
    if (!data.message || !data.message.trim()) throw new Error("Please enter a message.");

    // ---- FormSubmit.co (AJAX) ----
    if (cfg.provider === "formsubmit") {
      const res = await fetch(cfg.formsubmitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          _subject: data.subject || "New contact form message",
          message: data.message,
        }),
      });
      if (!res.ok) throw new Error("Mail service error (" + res.status + ").");
      return;
    }

    // ---- Web3Forms ----
    if (cfg.provider === "web3forms") {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: cfg.web3formsAccessKey,
          name: data.name,
          email: data.email,
          subject: data.subject || "New contact form message",
          message: data.message,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Mail service error.");
      }
      return;
    }

    // ---- Formspree ----
    if (cfg.provider === "formspree") {
      const res = await fetch(cfg.formspreeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          _subject: data.subject || "New contact form message",
          message: data.message,
        }),
      });
      if (!res.ok) throw new Error("Mail service error (" + res.status + ").");
      return;
    }

    // ---- PLACEHOLDER mode: no backend yet ----
    await new Promise((r) => setTimeout(r, 500));
    let pending = [];
    try { pending = JSON.parse(localStorage.getItem(LS_PENDING) || "[]"); } catch (_) {}
    pending.push({ ...data, at: new Date().toISOString() });
    try { localStorage.setItem(LS_PENDING, JSON.stringify(pending)); } catch (_) {}
    console.info(
      "[contact] PLACEHOLDER submission captured:", data,
      "\n(No email was sent — set ContactForm.config.provider to a real service to go live.)"
    );
  };

  // Inspect captured messages during local testing.
  ContactForm.getPending = function () {
    try { return JSON.parse(localStorage.getItem(LS_PENDING) || "[]"); } catch (_) { return []; }
  };

  // ---- Wire up the form on the page ----
  ContactForm.init = function () {
    const form = document.getElementById("contact-form");
    if (!form) return;
    const message = form.querySelector(".cf-message");
    const submit = form.querySelector('button[type="submit"], .cf-submit');

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (message) { message.className = "cf-message"; message.textContent = ""; }

      // Honeypot: real users leave this empty; bots fill it.
      if (form.querySelector('[name="_gotcha"]') && form.querySelector('[name="_gotcha"]').value) {
        return; // silently ignore bots
      }

      const data = {
        name: form.elements.name?.value || "",
        email: form.elements.email?.value || "",
        subject: form.elements.subject?.value || "",
        message: form.elements.message?.value || "",
      };

      if (submit) { submit.disabled = true; submit.dataset.label = submit.textContent; submit.textContent = "Sending…"; }
      try {
        await ContactForm.send(data);
        if (message) { message.classList.add("is-success"); message.textContent = ContactForm.config.successMessage; }
        form.reset();
      } catch (err) {
        if (message) {
          message.classList.add("is-error");
          message.textContent = err.message || ContactForm.config.errorMessage;
        }
      } finally {
        if (submit) { submit.disabled = false; submit.textContent = submit.dataset.label || "Send message"; }
      }
    });
  };

  window.ContactForm = ContactForm;
  document.addEventListener("DOMContentLoaded", ContactForm.init);
})();
