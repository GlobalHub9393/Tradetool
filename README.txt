GTT — Seven-Line Slack Trade-In Record (November 16, 2026)
===========================================================

INSTALL
1. Open your GitHub repository: GlobalHub9393/Tradetool.
2. Replace the existing root-level gtt-customer-tools.js with the enclosed file.
3. Commit the replacement and reload globaltradetool.com (hard refresh if browser cached it).

ONLY ONE WEBSITE FILE CHANGED: gtt-customer-tools.js.
Do not replace index.html, gtt-language.js, or gtt-bundles.js.

WHAT CHANGED
- Copy and Share to Slack use one short message with these seven lines:
  Customer name / Date / Quoted price / Plan / Trade phone / Condition / New phone.
- Each line is separate. Missing information appears as a dash; no field is required.
- Trade phone combines the traded device model/storage and the number being traded.
- Added a New phone text input in the standalone record. When opened from Full Quote,
  this pre-populates from the current quoted new device and can still be edited.
- The full printable worksheet still includes the IMEI, rep, notes, trade value,
  and device-condition detail. No print functionality was removed.
- Copy, Slack share, and Print do NOT clear the entered data; only explicit Clear Form
  (with confirmation) resets fields. Navigating away and back also preserves the draft
  while the page is open. Refreshing/closing the browser discards the draft.
- The Slack button opens the device share picker, then the rep picks the DM or group
  and confirms send. GTT does not deliver automatically or verify Slack receipt.
- No browser storage or backend changes; no GitHub/Cloudflare/Supabase changes needed.

TESTED
Browser tests at 390px phone, 834px iPad, and 1280px desktop:
- exactly seven content lines
- missing field placeholders
- copy and native share payloads
- print without clearing
- retained fields across page switches
- quote auto-prefill and editable New phone
- JavaScript syntax check

NOTE: The receiving Slack workspace retains sent messages per its policies.
