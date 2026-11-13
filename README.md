# Global Trade Tool — Bundle Explorer (November 13, 2026)

## Upload to GitHub

Repository: `GlobalHub9393/Tradetool` (default branch; repository root).

1. Replace existing `index.html` with this release's `index.html`.
2. Add **new** `gtt-bundles.js` in the same repository root.
3. Do not delete or replace existing `gtt-customer-tools.js` (customer language + printable trade record), `gtt-analytics.js`, or any other files.
4. Wait for Cloudflare Pages deployment and reload `globaltradetool.com`.

These are the ONLY two website files required. `index.html` is copied from the currently connected GitHub commit and changed by only one line (the extra deferred bundle script). Its prior markup, quote calculator, all price/promo logic, existing customer tools, analytics, settings, and appearance are unchanged.

## How it works

- On a **completed** quote for a qualifying Apple, Samsung, or Pixel model, a small 'Explore potential bundle offers' row appears **below** the quote, ahead of the existing Customer language / Print trade record actions.
- Tap it to open the independent explorer. Pick any watch, tablet or both (where offered) and see **additional device monthly payment** plus a clearly separate device-only combined estimate. No selections carry into the GTT quote.
- Close with × or Escape: original completed quote remains open with identical amounts and selections.
- For other phone models, no bundle row appears. If bundle reference data cannot be loaded, the row stays hidden; the original quote works normally.
- Data source: `public.gtt_bundle_offers` on existing Supabase project. Public `SELECT` only and RLS enforced. The three promotion groups were populated using the AT&T offer screenshots supplied on Nov 13: Apple, Samsung, Pixel.
- Changing offer prices or eligible phone families later requires only updating the Supabase table, not changing frontend code.
- All prices are estimate **device installments after qualifying bill credits for 36 months**. Service plans, taxes, activation, other charges not included. Final promotion eligibility must always be verified in OPUS/CCKM.

## Tests run

- JavaScript syntax validation: PASS (`node --check`).
- Browser fixture tests: PASS at 390px phone, 834px tablet portrait and 1280px desktop.
- Tested Apple, Samsung, Pixel offer visibility, watch + tablet selections, 'Both' combined preview, close-to-original-quote, unchanged quote state, ineligible-phone hidden.
- Supabase `anon` read-only policy and live REST GET: PASS.

## Caution

This is a separate optional sales aid; it does not validate a specific customer's account eligibility or calculate their **full wireless service bill**. Historical copies of the screenshot-based prices may change. If needed, disable a brand in the Supabase table by setting `active=false`.
