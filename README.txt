GLOBAL TRADE TOOL — STANDALONE TRADE-IN RECORD
Prepared November 16, 2026

INSTALLATION (GitHub repo GlobalHub9393/Tradetool)
1. Open your repository and upload the four root-level files from this ZIP.
2. Replace index.html, gtt-customer-tools.js and gtt-language.js.
3. gtt-bundles.js is included UNCHANGED so the complete last working release is in one ZIP. Overwriting it is optional.
4. Keep gtt-analytics.js, Supabase and all other files as they are.
5. Refresh the website; if necessary, clear the website cache on the store tablet.

FEATURES
- Home menu #3: Trade-In Record. Sales Tax Calculator moves to #4.
- Also accessible in the More menu.
- Standalone record: Date (defaults to Eastern today, editable), account holder,
  trade-in phone number, trade-in device (searchable active trade catalog or
  manual text), storage, IMEI, AT&T plan (catalog selection or manual text),
  required Yes/No for three condition questions, promotional credit quoted
  (manual, including prior quotes), optional rep initials and notes.
- Original completed Full Quote Print Trade Record button remains available.
  It pre-fills the trade-in phone, storage, condition, plan and available promo
  credit; the entered promotional amount remains editable for the record.
- Prints the same internal inspection sheet, with the amount clearly marked
  as a CUSTOMER QUOTE, not a guaranteed AT&T credit.
- No customer personal details are saved to browser storage or a database.
  Form fields clear when leaving the standalone page, closing the record popup
  or opening the print window. The printed page stays open until closed.
- Live GTT trade catalog is used for dropdown options. A manually typed phone
  is allowed if the model is absent from the catalog.
- The globe and customer language features remain intact; new record labels
  have translations for Spanish, Brazilian Portuguese and Turkish.

NOT CHANGED
- Main quote, credit calculations, Supabase data, Simple Tool, bundle offer
  math or scenario changes, tax calculator math, and seasonal decorations.

VALIDATION
- Node syntax checks passed for all changed scripts and embedded index JS.
- Static HTML navigation checked: #3 Trade-In Record; #4 Sales Tax Calculator.
- JavaScript unit checks passed for date formatting, quoted credit print,
  preserved quote prefill, phone formatting, condition fields and HTML escaping.
- An interactive browser run was not possible in this environment because
  the browser blocks local navigation. Verify visual fit on the store tablet.

This ZIP is an update package, not a confirmed deployment. Nothing was
published to GitHub automatically.
