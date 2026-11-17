GTT — Mobile-first Trade-In Record form redesign

Upload the included gtt-customer-tools.js to the root of the GitHub repository,
replacing the existing file. Do not change index.html or gtt-trade-tracker.js.

The same form fields and field names are retained for database Save Trade,
GTT quote prefill, copy, share, print, and clear. Includes a searchable
New phone purchased field sourced from GTT's phone catalog.

The UI uses a single column on phones (up to 700 px), and a two-column
layout on iPads/desktops. Condition controls are touch-friendly radio
buttons with large targets. Save Trade becomes a full-width top action
on phones when the tracker injects its button.

No database schema or backend changes required. The form design update
goes live after GitHub deployment. Hard-refresh/reopen GTT to see it.
