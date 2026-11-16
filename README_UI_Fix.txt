GLOBAL TRADE TOOL — TRADE-IN RECORD UI / BLANK PRINT FIX
November 16, 2026

INSTALL (GitHub repository GlobalHub9393/Tradetool)
1. Unzip this package.
2. Upload ONLY these two .js files into the repository's root:
   - gtt-customer-tools.js
   - gtt-language.js
3. Choose Replace / Commit changes for the existing files.
4. Reload globaltradetool.com; on the iPad, refresh the page if the old styles remain cached.

DO NOT replace index.html, gtt-bundles.js, gtt-analytics.js, or any other files for this update.
The existing standalone #3 Trade-In Record page and quote-linked print button remain.

CHANGES
- Refreshed Trade-In Record appearance to match the site's dark/light theme.
- Better labels, spacing, contrast and more compact condition choices on iPad.
- NO required fields. Account holder, trade phone number, phone, storage, plan,
  three condition checks, promotional quote, date, IMEI, rep, and notes can all be left blank.
- Date still defaults to today, but is editable/clearable.
- “Print Record” prints what is entered and leaves unfilled rows empty, without blockers.
- “Print Blank Copy” prints a fully empty worksheet, including a blank date,
  and checkbox spaces for condition answers, without clearing an in-progress form.
- Trade-in IMEI moves to the collapsed Optional Details section, along with rep and notes.
- Phone, storage, and plan suggestions display in small scrollable menus anchored
  directly underneath the corresponding input; the browser's floating datalists are gone.
- Can search active trade-in options or type an unlisted phone manually.
- Quote-linked record still pre-fills the new phone, current trade-in model,
  capacity, condition, plan and promo amount as available; entered promo remains editable.
- Language translations refreshed for English, Spanish, Brazilian Portuguese, Turkish.
- No records are saved to a database or browser storage.
- No changes to the Full Quote calculator, Simple Tool, promotion math, tax tool, bundles,
  seasonal effects or Supabase records.

VERIFICATION
- Node syntax check on both modified files passed.
- Headless Chromium functional tests passed at 390px, 834px, 1200px:
  all fields optional, IMEI collapsed, anchored suggestions, device selection
  and reference value, Print Blank Copy (no date or customer data), partial
  record printing, clear after printing, quote prefill, safe blank print in quote popup.
- Language switching verified in all four languages.
- This ZIP is an upload package, not confirmation of a live deployment.
