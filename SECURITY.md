# InvoGen security notes (v3.24.0)

- Strict Content-Security-Policy (meta tag in index.html): same-origin scripts/styles/fonts only, no eval, no plugins, no form posts, no third-party requests.
- No runtime CDN: SheetJS (Excel import) is self-hosted in js/vendor/ (npm xlsx@0.18.5, integrity verified).
- Service worker only handles same-origin GET requests and caches only successful, complete responses.
- Imported JSON / saved data: logo must be an embedded image (remote URLs dropped); file size capped; all text is escaped before display.
- Data never leaves the device (localStorage only); no analytics, no network calls.
- Known limits: GitHub Pages cannot send HTTP security headers, so clickjacking protection (frame-ancestors) and Permissions-Policy are not possible there. SheetJS 0.18.5 has known issues with maliciously crafted .xlsx/.xls files; only open spreadsheets you trust (CSV import does not use it).
- If the inline install-prompt script in index.html is ever edited, regenerate its sha256 in the CSP.
