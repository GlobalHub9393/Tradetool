GTT TRADE TRACKER — MANUAL DELETE UPDATE
November 16, 2026

DATABASE STATUS
- All 13 previous Trade Tracker rows were deleted from the existing Supabase project.
- Confirmed there are 0 trade records remaining across the 11 stores.
- Database tables, store selector, and the active 40-day automatic cleanup remain intact.

BACKEND STATUS
- Supabase Edge Function 'gtt-trade-tracker' version 2 is already deployed.
- It supports a permanent delete operation only when provided a valid, unexpired
  9393-unlocked server session. The PIN is checked server-side.

INSTALL THIS WEBSITE UPDATE
1. Open GitHub repository GlobalHub9393/Tradetool.
2. Upload the provided gtt-trade-tracker.js to the repository ROOT, replacing
   the existing gtt-trade-tracker.js. Commit the change.
3. Refresh https://globaltradetool.com (hard refresh if the old script is cached).

HOW TO DELETE A TRADE
Trade-In Records > View All > Unlock details (9393) > expand a trade >
Delete Trade > confirm permanent deletion.
Canceling the confirmation does not delete anything.
Deletion removes the trade from Pending, Received and All lists.

UNCHANGED
- The 30-day trade deadline and day-left/day-late label.
- Orange on days 25–30; red on days 31–40; received remains green.
- Automatic deletion after 40 days.
- Existing create-trade, search, received, editing, copy, print and Slack features.

IMPORTANT
This is still a low-security prototype. Use fictional customer information until
staff access and server-side authorization are strengthened.

Only one website file needs replacing. The database and Edge Function changes
are already live; the website Delete Trade button is not live until uploaded.
