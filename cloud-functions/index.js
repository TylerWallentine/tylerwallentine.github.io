/**
 * Cloud Functions — Zoho Campaigns newsletter integration.
 *
 * All Zoho credentials live in Secret Manager (never in the browser). The two
 * callable functions are the ONLY way the site talks to Zoho:
 *
 *   subscribe({ email })     PUBLIC. Submits the email through the Zoho
 *                            Campaigns web-optin SIGNUP FORM (double opt-in) so
 *                            the contact is tied to the form's subscription
 *                            (its zcld/list), not just added to a bare list.
 *                            Also upserts a Firestore `subscribers` doc
 *                            { email, linkedaccount, active:true }.
 *
 *                            The signup-form keys (zc_formIx, zcld, zctd, zx …)
 *                            come straight from the Zoho web-optin embed and
 *                            live in WEBOPTIN below. Update them there if the
 *                            form is regenerated in Zoho.
 *   unsubscribe({ email,     AUTH REQUIRED. Editor (admin) OR the owner of the
 *               delete? })   email may call it. Unsubscribes from Zoho and
 *                            sets active:false (or deletes the doc when an
 *                            admin passes delete:true).
 *
 * Firestore is the source of truth for the site UI; Zoho is the mail system.
 * Both are kept in sync here so the admin console / profile never touch Zoho
 * directly.
 *
 * Secrets (set once with `firebase functions:secrets:set <NAME>`):
 *   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_LIST_KEY
 */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const ZOHO_CLIENT_ID = defineSecret("ZOHO_CLIENT_ID");
const ZOHO_CLIENT_SECRET = defineSecret("ZOHO_CLIENT_SECRET");
const ZOHO_REFRESH_TOKEN = defineSecret("ZOHO_REFRESH_TOKEN");
const ZOHO_LIST_KEY = defineSecret("ZOHO_LIST_KEY");
const ZOHO_SECRETS = [ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_LIST_KEY];

// US (.com) data center — matches the account we validated during setup.
const ACCOUNTS_BASE = "https://accounts.zoho.com";
const CAMPAIGNS_BASE = "https://campaigns.zoho.com";
const ADMIN_EMAIL = "wallentinetyler@gmail.com";

// ---- Zoho web-optin SIGNUP FORM keys (from the embed code) ----
// These identify the specific signup form / subscription. `zcld` (populated!)
// is what binds a subscriber to this form's list — an empty zcld would drop
// them into a bare list instead. Copy new values here if the form changes.
const WEBOPTIN = {
  actionUrl: "https://zgnp-zngp.maillist-manage.com/weboptin.zc",
  emailField: "CONTACT_EMAIL",
  fields: {
    submitType: "optinCustomView",
    emailReportId: "",
    formType: "QuickForm",
    zx: "135c11367",
    zcvers: "3.0",
    oldListIds: "",
    mode: "OptinCreateView",
    zcld: "1173a63da1f42fa06",
    zctd: "1173a63da1f42bf71",
    zc_trackCode: "ZCFORMVIEW",
    zc_formIx: "3z5ad3c91b9bb525032f93801a88ae6c6183bb2b832871aa9c9a72b8cb9be39ea8",
    viewFrom: "URL_ACTION",
  },
};

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ""));
}

// ---- Zoho OAuth: cache a short-lived access token per warm instance ----
let cachedToken = null;
let tokenExpiry = 0;
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: ZOHO_CLIENT_ID.value(),
    client_secret: ZOHO_CLIENT_SECRET.value(),
    refresh_token: ZOHO_REFRESH_TOKEN.value(),
  });
  const res = await fetch(`${ACCOUNTS_BASE}/oauth/v2/token`, { method: "POST", body: params });
  const data = await res.json();
  if (!data.access_token) {
    console.error("Zoho token error:", data);
    throw new HttpsError("internal", "Could not authenticate with Zoho.");
  }
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

// ---- Zoho Campaigns SIGNUP FORM subscribe (web-optin) ----
// Posts through the same endpoint the embedded form uses, with the form's
// hidden keys, so the contact is tied to the signup form's subscription and
// Zoho fires the form's double opt-in confirmation email. No OAuth needed —
// this is the public optin endpoint.
async function zohoWebOptinSubscribe(email) {
  const body = new URLSearchParams({ [WEBOPTIN.emailField]: email, ...WEBOPTIN.fields });
  const res = await fetch(WEBOPTIN.actionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    console.error("Zoho web-optin error:", res.status, await res.text().catch(() => ""));
    throw new HttpsError("internal", "Could not submit the subscription to Zoho.");
  }
  // The endpoint returns HTML (the opt-in confirmation page); a 200 means Zoho
  // accepted it and will email the double opt-in confirmation.
  return { ok: true };
}

// ---- Zoho Campaigns list unsubscribe (API, needs OAuth + listkey) ----
async function zohoList(action, email) {
  const token = await getAccessToken();
  const url = new URL(`${CAMPAIGNS_BASE}/api/v1.1/json/${action}`);
  url.searchParams.set("resfmt", "JSON");
  url.searchParams.set("listkey", ZOHO_LIST_KEY.value());
  url.searchParams.set("contactinfo", JSON.stringify({ "Contact Email": email }));
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  const data = await res.json();
  if (data && data.status === "error") {
    const msg = String(data.message || "");
    // Unsubscribing a contact Zoho doesn't have is a no-op, not a failure
    // (e.g. they were recorded locally but never confirmed the double opt-in,
    // so Zoho never created the contact). Let Firestore proceed either way.
    if (action === "listunsubscribe" &&
        /does not exist|not\s+exist|no.*contact|invalid contact|not.*subscrib/i.test(msg)) {
      console.warn(`Zoho ${action}: "${msg}" — treating as already unsubscribed.`);
      return { status: "warning", message: msg, tolerated: true };
    }
    console.error(`Zoho ${action} error:`, data);
    throw new HttpsError("internal", data.message || "Zoho request failed.");
  }
  return data;
}

// ---- Zoho Campaigns: read the contacts on the list (for syncing) ----
// Pulls every contact of the given Zoho status ("active", "unsub", …) with
// pagination, and returns their lowercased emails.
function pickEmail(obj) {
  if (!obj || typeof obj !== "object") return "";
  const keys = ["contact_email", "Contact Email", "email", "EMAIL", "CONTACT_EMAIL", "emailid"];
  for (const k of keys) if (obj[k]) return String(obj[k]);
  for (const v of Object.values(obj)) {
    if (typeof v === "string" && isValidEmail(v)) return v;
  }
  return "";
}

async function zohoFetchContacts(zohoStatus) {
  const token = await getAccessToken();
  const out = [];
  const range = 200;
  let fromindex = 1;
  for (let guard = 0; guard < 200; guard++) {
    const url = new URL(`${CAMPAIGNS_BASE}/api/v1.1/getlistsubscribers`);
    url.searchParams.set("resfmt", "JSON");
    url.searchParams.set("listkey", ZOHO_LIST_KEY.value());
    url.searchParams.set("status", zohoStatus);
    url.searchParams.set("sort", "asc");
    url.searchParams.set("fromindex", String(fromindex));
    url.searchParams.set("range", String(range));
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    const data = await res.json();
    if (data && data.status === "error") {
      const msg = String(data.message || "");
      // "There are no contacts in this list" just means the status is empty
      // (or we've paged past the end) — not an error. Return what we have.
      if (/no contacts|no.*record|not.*found/i.test(msg)) break;
      console.error("Zoho getlistsubscribers error:", data);
      throw new HttpsError("internal", data.message || "Could not fetch contacts from Zoho.");
    }
    const details = data.list_of_details || data.listofdetails || data.list_of_details_list || [];
    for (const d of details) {
      const email = pickEmail(d).trim().toLowerCase();
      if (isValidEmail(email)) out.push(email);
    }
    if (details.length < range) break;
    fromindex += range;
  }
  return out;
}

// ---- Firestore helpers (one subscription per email; sweep legacy dupes) ----
async function findUserIdByEmail(email) {
  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

async function isEditor(uid, tokenEmail) {
  if ((tokenEmail || "").toLowerCase() === ADMIN_EMAIL) return true;
  if (!uid) return false;
  const s = await db.collection("users").doc(uid).get();
  return s.exists && String(s.data().role || "").toLowerCase() === "editor";
}

// Canonical subscriber doc id == the lowercased email. Merge/clean any legacy
// docs (random ids) that share the same email into that canonical doc.
//   status: "pending"  — recorded, awaiting the Zoho double opt-in click
//           "active"   — confirmed via the opt-in email
//           "inactive" — unsubscribed
// `active` (bool) is kept in sync for backward-compatible reads.
async function upsertSubscriber(email, linkedaccount, status) {
  status = status || "pending";
  const canonical = db.collection("subscribers").doc(email);
  const dupes = await db.collection("subscribers").where("email", "==", email).get();
  const batch = db.batch();
  batch.set(canonical, { email, linkedaccount, status, active: status === "active" }, { merge: true });
  dupes.forEach((d) => { if (d.id !== email) batch.delete(d.ref); });
  await batch.commit();
}

async function setSubscriberActive(email, active) {
  const status = active ? "active" : "inactive";
  const dupes = await db.collection("subscribers").where("email", "==", email).get();
  if (dupes.empty) {
    await db.collection("subscribers").doc(email)
      .set({ email, linkedaccount: "N/A", status, active }, { merge: true });
    return;
  }
  const batch = db.batch();
  dupes.forEach((d) => batch.set(d.ref, { status, active }, { merge: true }));
  await batch.commit();
}

async function deleteSubscriber(email) {
  const dupes = await db.collection("subscribers").where("email", "==", email).get();
  const batch = db.batch();
  let sawCanonical = false;
  dupes.forEach((d) => { batch.delete(d.ref); if (d.id === email) sawCanonical = true; });
  if (!sawCanonical) batch.delete(db.collection("subscribers").doc(email));
  await batch.commit();
}

// ============================================================
//  subscribe — PUBLIC (works for anonymous visitors)
// ============================================================
exports.subscribe = onCall({ secrets: ZOHO_SECRETS }, async (request) => {
  const email = String((request.data && request.data.email) || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    throw new HttpsError("invalid-argument", "Please enter a valid email address.");
  }

  const authUid = (request.auth && request.auth.uid) || null;
  const authEmail = ((request.auth && request.auth.token && request.auth.token.email) || "").toLowerCase();

  // Link to a user account: the caller themselves, else any user with that email.
  let linkedaccount = "N/A";
  if (authUid && authEmail === email) linkedaccount = authUid;
  else {
    const uid = await findUserIdByEmail(email);
    if (uid) linkedaccount = uid;
  }

  // Record the subscriber up front as "Awaiting Opt-In" so the admin console
  // shows them immediately — but never downgrade someone already confirmed.
  const existing = await db.collection("subscribers").doc(email).get();
  const alreadyActive = existing.exists && (
    existing.data().status === "active" ||
    (existing.data().status === undefined && existing.data().active === true)
  );
  await upsertSubscriber(email, linkedaccount, alreadyActive ? "active" : "pending");

  // Hand off to Zoho for the double opt-in email. Best-effort: a Zoho hiccup
  // must not hide the pending subscriber we just recorded.
  let optinEmailSent = true;
  try {
    await zohoWebOptinSubscribe(email);   // signup-form optin; Zoho emails the opt-in link
  } catch (err) {
    optinEmailSent = false;
    console.error("Zoho web-optin submit failed (kept subscriber as pending):", err);
  }
  return { ok: true, email, linkedaccount, status: alreadyActive ? "active" : "pending", optinEmailSent };
});

// ============================================================
//  unsubscribe — AUTH REQUIRED (admin or the email's owner)
// ============================================================
exports.unsubscribe = onCall({ secrets: ZOHO_SECRETS }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
  const email = String((request.data && request.data.email) || "").trim().toLowerCase();
  if (!isValidEmail(email)) throw new HttpsError("invalid-argument", "Invalid email.");

  const authEmail = ((request.auth.token && request.auth.token.email) || "").toLowerCase();
  const editor = await isEditor(request.auth.uid, authEmail);
  const owner = authEmail === email;
  if (!editor && !owner) {
    throw new HttpsError("permission-denied", "Not allowed to modify this subscription.");
  }

  const wantDelete = !!(request.data && request.data.delete) && editor;

  await zohoList("listunsubscribe", email);
  if (wantDelete) await deleteSubscriber(email);
  else await setSubscriberActive(email, false);
  return { ok: true, deleted: wantDelete };
});

// ============================================================
//  confirmOptin — Zoho double opt-in confirmation callback (HTTP)
// ------------------------------------------------------------
//  When a subscriber clicks the link in their opt-in email and Zoho confirms
//  them, Zoho calls this endpoint and we flip the Firestore doc from
//  "pending" -> "active". Wire the URL into Zoho Campaigns as a signup webhook
//  (or the signup form's post-confirmation redirect), appending the shared
//  token, e.g.:
//    https://us-central1-<project>.cloudfunctions.net/confirmOptin?token=...
//  Zoho must include the contact's email (we accept several common param
//  names). Change OPTIN_CONFIRM_TOKEN below to your own long random string.
// ============================================================
const OPTIN_CONFIRM_TOKEN = "vr_optin_9f3c1a7e5b2d4680change_me";

function extractEmail(req) {
  const src = Object.assign({}, req.query || {}, (req.body && typeof req.body === "object") ? req.body : {});
  const raw = src.email || src.contact_email || src.CONTACT_EMAIL ||
              src["Contact Email"] || src.EMAIL || "";
  return String(raw || "").trim().toLowerCase();
}

exports.confirmOptin = onRequest(async (req, res) => {
  const token = (req.query && req.query.token) || (req.body && req.body.token) || "";
  if (token !== OPTIN_CONFIRM_TOKEN) {
    res.status(403).send("Forbidden");
    return;
  }
  const email = extractEmail(req);
  if (!isValidEmail(email)) {
    res.status(400).send("Missing or invalid email.");
    return;
  }
  await setSubscriberActive(email, true);   // pending/inactive -> active (confirmed)
  res.status(200).send(
    "<!doctype html><meta charset=utf-8><title>Subscription confirmed</title>" +
    "<p style='font-family:sans-serif'>Thanks \u2014 your subscription is confirmed.</p>"
  );
});

// ============================================================
//  syncSubscribers — EDITOR ONLY. Pull the subscriber list FROM Zoho
// ------------------------------------------------------------
//  Reads the contacts on the Zoho list and upserts them into the Firestore
//  `subscribers` collection so the admin console mirrors Zoho. Zoho is treated
//  as the source of truth for status: "active" contacts become active (this is
//  also how a pending signup flips to Active after they confirm), "unsub"
//  contacts become inactive. Existing linkedaccount values are preserved.
// ============================================================
async function syncUpsertSubscriber(email, status) {
  const ref = db.collection("subscribers").doc(email);
  const snap = await ref.get();
  const data = { email, status, active: status === "active" };
  // Only (re)compute the linked account when we don't already have one.
  if (!snap.exists || !snap.data().linkedaccount || snap.data().linkedaccount === "N/A") {
    const uid = await findUserIdByEmail(email);
    data.linkedaccount = uid || "N/A";
  }
  await ref.set(data, { merge: true });
  return snap.exists;
}

exports.syncSubscribers = onCall({ secrets: ZOHO_SECRETS }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be signed in.");
  const authEmail = ((request.auth.token && request.auth.token.email) || "").toLowerCase();
  const editor = await isEditor(request.auth.uid, authEmail);
  if (!editor) throw new HttpsError("permission-denied", "Editors only.");

  const activeEmails = await zohoFetchContacts("active");
  const unsubEmails = await zohoFetchContacts("unsub");

  let created = 0, seen = 0;
  for (const email of activeEmails) {
    const existed = await syncUpsertSubscriber(email, "active");
    existed ? seen++ : created++;
  }
  for (const email of unsubEmails) {
    const existed = await syncUpsertSubscriber(email, "inactive");
    existed ? seen++ : created++;
  }
  return { ok: true, active: activeEmails.length, unsub: unsubEmails.length, created, seen };
});
