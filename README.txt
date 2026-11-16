GLOBAL TRADE TOOL — EMAIL TRADE-IN RECORD
November 16, 2026

INSTALL
1. Open the GitHub repository GlobalHub9393/Tradetool.
2. Replace the root-level gtt-customer-tools.js with the file in this ZIP.
3. Commit to the site's live branch, then refresh globaltradetool.com.
4. No index.html, gtt-language.js, gtt-bundles.js, Supabase tables, or promo calculations need changes.

WHAT IS NEW
- "Email Record" appears alongside Print Record and Print Blank Copy on the standalone #3 Trade-In Record form and the Full Quote prefilled record.
- Opens a message in the device's installed/default email app, addressed to ts8686@cmcnj.com.
- Subject uses account holder's last name. With no name, subject defaults to "Trade-In Record".
- The body contains the purchase/quote date, account holder, trade-in phone number, device/storage, IMEI, plan, quoted promotion, estimated trade value, three condition answers, rep initials, optional notes, and original quote phone when available.
- Any field can remain blank; the button still works.
- Clicking Email does NOT clear the form, so the rep can print it afterward.
- The email app opens a draft; the rep must review it and press Send.

IMPORTANT
- This uses a mailto: link, not an email API, browser clipboard, GTT database or sending service.
- The iPad/phone/browser must have a configured mail app or mailto handler. A browser without an email handler may not open a compose window.
- GTT does not save the customer record, but the mail app/provider may save draft/sent copies once opened. Only send customer information through an employer-approved email system.

BROWSER TESTS
- Test fixture was run at 390px, 834px and 1200px desktop/tablet/mobile viewports in Chromium.
- Verified mail recipient, subject from last name, empty and partial records, formatted body, dollar amounts, phone number, plan, IMEI, condition responses, rep, notes, original quote prefill, and form preservation.
- Verified Print Blank Copy and Print Record still work.
- Cannot test the store iPad's actual installed/default mail app from this environment.
