# tylerwallentine.github.io

Personal website hosted via GitHub Pages.

## Structure

- Static frontend (HTML/CSS/JS) lives at the repository root and is served by GitHub Pages.
- `index.html` is the homepage (served at `/`).
- Pages use clean, extensionless URLs (GitHub Pages serves `projects.html` at
  `/projects`, `blog.html` at `/blog`, `about.html` at `/about`, etc.). Link to
  pages without the `.html` (e.g. `/projects`).
- `404.html` is shown automatically for unknown paths.
- Local preview (`preview.bat` / `preview-server.py`) mimics this: `/projects`
  resolves to `projects.html` and unknown paths serve `404.html`.
- The site talks to Firebase (Firestore + Auth) directly from the browser.
- `server/` contains an optional Express + firebase-admin backend. **It is not run by GitHub Pages** (Pages serves static files only). Run it locally with Node if needed.

## Local development

Serve the root folder with any static server, e.g.:

```bash
npx serve .
```

## Backend (optional, local only)

```bash
cd server
npm install
# Provide your own serviceAccountKey.json (NOT committed - it is a secret)
node app.js
```

## Security note

`server/serviceAccountKey.json` is a private Firebase credential and is intentionally
git-ignored. Never commit it. The Firebase web config in `j-firebase.js` is public by design.
