GTT Trade Tracker — Calendar-Day Timer Fix

WHY THIS WAS NEEDED
The previous display counted whole 24-hour intervals since the record's creation,
so a trade entered yesterday could still show Day 0 today.

NEW TIMER RULE
- Day 0 on purchase/quote date entered on the record (New Jersey calendar date).
- Day 1 on the following calendar date, regardless of the hour saved.
- A confirmed Reset Timer starts Day 0 on the local date of the reset.
- Original purchase/quote date remains unchanged when resetting.
- Days 15–21 yellow; days 22–29 orange; day 30 onward red.
- Received records remain green.
- Deadline is 30 calendar days; automatic cleanup at day 40.

INSTALLATION
Upload/replace ONLY gtt-trade-tracker.js at the root of
GlobalHub9393/Tradetool on GitHub. This file includes the earlier store gate,
manual delete, and reset-timer features. The backend and database are already updated.
After publishing, completely reload Global Trade Tool (close the existing tab and
reopen if necessary to clear browser script cache). No existing trade is modified.

NOTE
The public no-staff-login test setup is not appropriate for real customer PII.
