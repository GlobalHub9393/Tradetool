GLOBAL TRADE TOOL — COMPACT SLACK TRADE-IN RECORD
November 16, 2026

INSTALL
1. Open the GlobalHub9393/Tradetool GitHub repository.
2. Replace the existing root-level gtt-customer-tools.js with the file in this ZIP.
3. Commit and wait for the Cloudflare Pages deployment; refresh GTT.
4. On #3 Trade-In Record, test Copy, Slack, and Print on a store iPad.

WHAT CHANGED
- Only four actions remain: Copy, Slack, Print, Clear Form.
- Email Record and Print Blank Copy buttons are removed.
- Slack / Copy message is a compact record: Promo Quoted, Plan, and Date first;
  customer name, trade phone, trade model/value, conditions, IMEI, rep,
  optional notes, and original new phone follow when available.
- Empty fields are omitted from Slack/Copy message, not lost from the print template.
- The single Print action prints current entries or a completely blank worksheet
  if no record details have been entered. No automatic form reset.
- Switching GTT pages, closing/reopening a quote record, printing, copying,
  and sharing leave typed details in place. Only Clear Form (confirmed by the rep)
  or refreshing/closing the browser page discards them.
- Clear Form intentionally clears everything, including today's prefilled date.
- Native Share opens the iPad/phone share menu; a rep selects Slack and the DM
  or group. The OS determines whether Slack appears. Copy is the fallback.
- No customer records are sent to a GTT backend or saved to localStorage.
  Shared messages may be retained under your organization's Slack policies.

SAFETY
Trade-In Records may contain customer phone numbers and IMEIs. Share only to
company-approved private conversations and follow your organization's data
handling policies. The message is an internal record, not an official AT&T
receipt or guarantee of promotion eligibility.

FILES
  gtt-customer-tools.js — only file to upload
