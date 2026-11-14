GTT — Global Language Globe + Bundle What-If Phone Credit
Prepared November 13, 2026

INSTALLATION — GitHub repository GlobalHub9393/Tradetool:

1. Replace index.html in the root with the included index.html.
2. Replace gtt-bundles.js in the root with the included gtt-bundles.js.
3. Replace gtt-customer-tools.js in the root with the included gtt-customer-tools.js.
4. ADD the new gtt-language.js in the root.
5. Leave gtt-analytics.js and all other repository files unchanged.
6. After Cloudflare Pages deploys the updated repository, refresh GTT.
   If the old files stay cached, use a private tab or force reload.

The included index.html is derived from the repository's live version
(blob SHA 997e9588a57aec02b8f9648bbbd39ab2af1002b3) and differs only
by a single script tag that loads gtt-language.js.

FEATURES
- Small 🌐 button on main pages and dialogs, including bundle and quote popups.
- English, Spanish, Brazilian Portuguese, Turkish. The selection persists on device.
- Fixed offline translations for primary GTT controls and bundle content. No
  translation API or personal customer data is sent for translation.
- Existing customer-facing language card follows the globe selection and
  changing the language on that card updates the global choice.
- Bundle explorer: optional 'What-if phone credit' editor.
  Enter TOTAL estimated phone promotional credit (not an incremental credit).
  It recalculates the hypothetical phone installment from full retail MSRP,
  less entered total credit, divided by 36 months, for the BUNDLE comparison only.
  It does NOT change the selected device, plan, trade value, promotion eligibility,
  actual GTT phone quote, Supabase, analytics, trade worksheet or saved history.
  Scenario resets whenever Bundle Explorer is closed and reopened.
- Watch/tablet monthly amounts remain the values from the separate bundle table.

IMPORTANT
- The original phone quote remains the source of truth; what-if credits are
  hypothetical and may not correspond to actual AT&T offer qualification.
- Bundle amounts exclude service plans, taxes, fees and optional charges.
- Product names and technical plan names remain unchanged. Some less-common
  admin screens and historical/legal content may remain in English; core menus,
  common quote controls and the bundle screen use the selected language.
- Final amounts and stacking eligibility must be verified in OPUS/CCKM.

TESTING
- Headless Chromium fixture tests at 390px, 834px, 1280px.
- Tested 4-language switching while bundle modal open, quote state unchanged,
  custom promo credit + watch selection, reset after reopening,
  input maximum validation and zero console exceptions.
- End-to-end Cloudflare Pages deployment not performed by ChatGPT.
