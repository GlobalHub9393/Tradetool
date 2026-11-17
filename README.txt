GLOBAL TRADE TOOL — 40-DAY TRADE TRACKER
Release: November 16, 2026

WHAT IS ALREADY BUILT IN SUPABASE
--------------------------------
Project: uwomiirfvllcafijmkmk
Database table: public.gtt_trade_records
Supporting access tables: public.gtt_trade_unlock_sessions and public.gtt_trade_pin_attempts
Deployed Edge Function: gtt-trade-tracker
Daily automatic cleanup: gtt-trades-daily-expiry (04:15 UTC)
Seed records: 12 demonstration entries across the 11 stores.

The records table is not directly readable by anonymous or authenticated Data API clients.
The Edge Function supplies masked records by default and verifies the 4-digit test PIN
on the server for full records. The website never embeds the PIN or service-role key.

UPLOAD THESE EXACT TWO FILES TO THE ROOT OF GlobalHub9393/Tradetool
------------------------------------------------------------------
1. index.html                 REPLACE the current root index.html
2. gtt-trade-tracker.js       ADD this new file to the root

Do not replace or delete gtt-customer-tools.js, gtt-language.js, gtt-bundles.js,
or gtt-analytics.js. This release is built around the current GitHub versions.

After GitHub/Cloudflare deploys, refresh globaltradetool.com and navigate to #3
Trade-In Records.

WORKFLOW
--------
* Choose a store (REQUIRED to save a new trade).
* Create Trade: fill in anything known; blank form fields remain optional.
* Click Save Trade to submit the record into Supabase.
* Copy, Slack and Print still operate without clearing anything.
* View All: choose a specific store or leave All stores selected.
* Pending / Received / All tabs, search and detailed records.
* Check Trade received to add received timestamp; uncheck with confirmation.
* Received is always green; pending ages 25–30 are orange; 31–40 red.
* Records stop appearing at the 40-day limit. Daily cron physically deletes them.
* Unlock details with the previously discussed 4-digit keypad PIN. Unlock sessions
  last up to 30 minutes; click Lock details to hide sensitive fields again.
* Unlocked records can be edited; edits do not reset the record's retention age.

PRIVACY / TESTING LIMIT
-----------------------
This test version has deliberately NO employee login. Anonymous users can create
records or change received status through the server endpoint, and the shared PIN
is not strong authentication. For the testing period use fictional customer information
only. Real customer names, phone numbers and IMEIs should not be entered until
proper staff access controls and company approval are in place.

Only the masked data is sent from the backend to a locked View All screen.
The app does not store customer record details in browser localStorage; the full
records live in the Supabase database until the 40-day expiry job runs.

TESTED
------
Local browser UI tests (with mocked backend) passed on phone (390 px), iPad (834 px)
and desktop (1250 px): saving, store filtering, status colors, unlocked details,
and form preservation. Supabase deployment, tables, RLS and scheduled job verified.
A real-device/live HTTP end-to-end smoke test remains recommended after upload.
