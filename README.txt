GLOBAL TRADE TOOL — Slack Share for Trade-In Record
November 16, 2026

INSTALL — GitHub: GlobalHub9393/Tradetool
1. Open the repo at github.com/GlobalHub9393/Tradetool.
2. Replace ONLY the existing gtt-customer-tools.js with the supplied file.
3. Commit the update. Refresh globaltradetool.com (hard refresh if cached).

No changes needed to index.html, gtt-language.js, gtt-bundles.js, Supabase, or the Full Quote engine.

WHAT'S NEW
On both #3 Trade-In Record and the record accessed from a completed Full Quote, a new
"Share to Slack" button sits beside Print Record, Email Record, and Print Blank Copy.

- On supported devices, it opens the OS share menu with the formatted trade-in record.
- Rep selects Slack, then the desired individual DM or group DM, reviews and taps Send.
- Reps can share with whatever other destinations the OS provides; the website does
  not force Slack or choose a DM on the rep's behalf.
- If native sharing isn't supported, is canceled, or doesn't offer Slack, GTT shows
  "Copy Record" and "Open Slack" actions. Copy/paste into the chosen DM/group.
- All fields optional. Form stays filled in after sharing or copying.
- Existing email-to-ts8686@cmcnj.com and print functionality remain unchanged.
- No Slack login credentials, bot token, webhook, or customer record storage in GTT.

IMPORTANT
This is device-native sharing, NOT a direct Slack API integration. Slack must be
installed, configured, and offered in the iPad's share menu for the quick flow;
otherwise use Copy Record / Open Slack. The recipient chooses and sends in Slack.
GTT cannot confirm delivery to Slack. Shared messages are stored in your Slack
workspace under its retention and access rules; use only company-approved DMs/groups
and follow customer-data policy. Clipboard copies can persist until overwritten.

LOCAL CHECKS COMPLETED
- JavaScript syntax check passed.
- Browser test at 390, 834, and 1280 pixel widths passed.
- Checked full/partial records, surname in title, trade phone number, credit, plan,
  conditions, no form clearing, existing mailto link, fallback, and cancellations.
- Full Quote prefill + share + subsequent print passed.
- Actual iPad share-sheet and Slack app handoff must be tested on a store device.

This ZIP is GitHub-ready; it does NOT publish the website automatically.
