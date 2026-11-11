/* GTT Analytics v2 — independent, lightweight and privacy-conscious.
   Installation: load this file with <script defer src="/gtt-analytics.js"></script>.
   It sends NO customer details, search text, quote amounts, IPs or user agents. */
(function () {
  'use strict';
  const API = 'https://uwomiirfvllcafijmkmk.supabase.co/functions/v1/gtt-analytics';
  const VISITOR_KEY = 'gtt_analytics_browser_v1';
  const SESSION_KEY = 'gtt_analytics_session_v1';
  const OPT_OUT_KEY = 'gtt_analytics_opt_out';
  const VALID = new Set(['page_view', 'tool_view', 'device_select', 'trade_select', 'plan_select', 'quote_complete', 'simple_result', 'tax_calculation', 'comparison_run', 'investigation_run']);
  let visitor = '', session = '', first = false, lastQuote = '', lastPlan = '', lastPhone = '', lastTrade = '';
  let quoteInteracted = false, pendingInvestigation = false, taxTimer, adminPassword = '';
  const recent = new Map();
  const $ = id => document.getElementById(id);

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,
      c => (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> Number(c) / 4)).toString(16));
  }
  function permitted() {
    try { return localStorage.getItem(OPT_OUT_KEY) !== '1' && navigator.doNotTrack !== '1' && navigator.globalPrivacyControl !== true; }
    catch (_) { return false; }
  }
  function ensureIdentity() {
    if (!permitted()) return false;
    try {
      visitor = localStorage.getItem(VISITOR_KEY) || '';
      if (!visitor) { visitor = uuid(); first = true; localStorage.setItem(VISITOR_KEY, visitor); }
      let state = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!state || !state.id || Date.now() - Number(state.last || 0) > 30 * 60 * 1000) {
        state = {id: uuid(), last: Date.now()};
      }
      session = state.id;
      state.last = Date.now();
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
      return true;
    } catch (_) { return false; }
  }
  function track(event, data = {}) {
    if (!VALID.has(event) || !ensureIdentity()) return;
    const tool = String(data.tool || 'other').slice(0, 30);
    const device = typeof data.device === 'string' ? data.device.slice(0, 90) : null;
    const plan = typeof data.plan === 'string' ? data.plan.slice(0, 50) : null;
    const key = [event, tool, device, plan].join('|');
    const now = Date.now();
    if (event !== 'page_view' && now - (recent.get(key) || 0) < 3000) return;
    recent.set(key, now);
    const payload = {action: 'track', visitor, session, event, tool, device, plan, first_visit: event === 'page_view' && first};
    if (event === 'page_view') first = false;
    fetch(API, {method: 'POST', mode: 'cors', keepalive: true,
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)}).catch(() => {});
  }
  function context() {
    try { return window.GTTQuote && typeof window.GTTQuote.capture === 'function' ? window.GTTQuote.capture() : null; }
    catch (_) { return null; }
  }
  function findPhone(id) {
    try { const p = window.GTTQuote.phones().find(x => x.id === id); return p ? p.name : ''; }
    catch (_) { return ''; }
  }
  function recordQuoteChoices() {
    const c = context(); if (!c) return;
    const p = c.phoneId || '';
    if (p && p !== lastPhone) { lastPhone = p; track('device_select', {tool: 'trade', device: findPhone(p)}); }
    if (c.plan && c.plan !== lastPlan) { lastPlan = c.plan; track('plan_select', {tool: 'trade', plan: c.plan}); }
    const t = c.tradeDevice ? [c.tradeDevice.brand, c.tradeDevice.model].filter(Boolean).join(' ') : '';
    if (t && t !== lastTrade) { lastTrade = t; track('trade_select', {tool: 'trade', device: t}); }
  }
  function recordCompletedQuote() {
    const c = context(), view = $('viewQuote'), display = $('display');
    if (!quoteInteracted || !c || !c.phoneId || !c.plan || !view || !display || view.hidden || !display.classList.contains('quote-complete')) return;
    // Internal signature is NEVER sent. It prevents multiple result re-renders from counting as new quotes.
    const signature = JSON.stringify([c.phoneId, c.plan, c.tradeDevice, c.tradeStorage,
      c.value, c.tradeCondition, c.nextUp, c.nextUpType, c.noTrade]);
    if (signature === lastQuote) return;
    lastQuote = signature;
    track('quote_complete', {tool: 'trade', device: findPhone(c.phoneId), plan: c.plan});
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g,
      c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  }
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  function metric(title, count, note = '') {
    return '<div class="gtt-an-metric"><span class="gtt-an-metric-label">' + esc(title) + '</span>' +
      '<strong>' + fmt(count) + '</strong>' + (note ? '<span class="gtt-an-metric-note">' + esc(note) + '</span>' : '') + '</div>';
  }
  function topList(title, rows) {
    rows = Array.isArray(rows) ? rows : [];
    const max = Math.max(1, ...rows.map(x => Number(x.count) || 0));
    const content = rows.length ? rows.slice(0, 8).map((x, i) =>
      '<div class="gtt-an-item"><span class="gtt-an-rank">' + (i + 1) + '</span>' +
      '<span class="gtt-an-item-label">' + esc(x.name) + '</span><b>' + fmt(x.count) + '</b></div>' +
      '<div class="gtt-an-track"><i style="width:' + Math.round((Number(x.count) || 0) / max * 100) + '%"></i></div>').join('')
      : '<div class="gtt-an-empty"><span aria-hidden="true">◌</span><p>No selections recorded yet</p></div>';
    return '<section class="gtt-an-panel"><h4>' + esc(title) + '</h4>' + content + '</section>';
  }
  function dateKey(d) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(d);
    const part = type => parts.find(p => p.type === type)?.value || '';
    return part('year') + '-' + part('month') + '-' + part('day');
  }
  function trend(rows, days) {
    const byDay = new Map((Array.isArray(rows) ? rows : []).map(x => [x.date, x]));
    const daily = [];
    // Include days with zero activity; otherwise one tracked day becomes one giant full-width bar.
    for (let offset = days - 1; offset >= 0; offset--) {
      const date = dateKey(new Date(Date.now() - offset * 86400000));
      const entry = byDay.get(date) || {};
      daily.push({date, visitors: Number(entry.unique_browsers) || 0, quotes: Number(entry.quotes) || 0});
    }
    const peak = Math.max(1, ...daily.map(x => x.visitors));
    const totalActiveDays = daily.filter(x => x.visitors > 0).length;
    const columns = daily.map(x => {
      const height = x.visitors ? Math.max(8, Math.round(x.visitors / peak * 100)) : 2;
      const title = x.date + ': ' + x.visitors + ' unique browsers, ' + x.quotes + ' quotes';
      return '<div class="gtt-an-day" title="' + esc(title) + '">' +
        '<i class="' + (x.visitors ? 'active' : '') + '" style="height:' + height + '%"></i></div>';
    }).join('');
    return '<div class="gtt-an-chart-top"><span>Unique browsers</span><strong>' + fmt(peak) + ' max/day</strong></div>' +
      '<div class="gtt-an-chart" style="--gtt-an-days:' + days + '" role="img" aria-label="Unique browsers per day for ' + days + ' days. ' + totalActiveDays + ' active days">' + columns + '</div>' +
      '<div class="gtt-an-chart-axis"><span>' + esc(daily[0].date.slice(5)) + '</span><span>' + esc(daily[daily.length - 1].date.slice(5)) + '</span></div>' +
      '<p class="gtt-an-muted">' + fmt(totalActiveDays) + ' day' + (totalActiveDays === 1 ? '' : 's') +
      ' with recorded activity · Eastern Time</p>';
  }
  function fillDashboard(data, days) {
    const root = $('gttAnalyticsDashboard'); if (!root) return;
    root.innerHTML = '<div class="gtt-an-heading"><div class="gtt-an-heading-copy"><div class="gtt-an-eyebrow">PRIVATE REPORTING</div><h3>Usage analytics</h3>' +
      '<p>See how reps are using Global Trade Tool. Browser counts are estimates of people, not employee identities.</p></div>' +
      '<div class="gtt-an-toolbar"><label for="gttAnDays">Period</label><select id="gttAnDays" aria-label="Reporting period"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>' +
      '<button class="gtt-an-refresh" type="button" id="gttAnRefresh" aria-label="Refresh usage analytics">↻ Refresh</button></div></div>' +
      '<div class="gtt-an-grid">' + metric('Unique browsers', data.unique_browsers) + metric('Visits / sessions', data.visits) +
      metric('Pageviews', data.pageviews) + metric('Full quotes', data.quotes) + metric('Simple results', data.simple_results) +
      metric('Tax calculations', data.tax_calculations) + metric('Comparisons', data.comparison_runs) + metric('Investigations', data.investigator_runs) + '</div>' +
      '<div class="gtt-an-section-title"><h4>Audience &amp; activity</h4><span>Last ' + days + ' days</span></div>' +
      '<div class="gtt-an-cols gtt-an-insights"><section class="gtt-an-panel"><h4>New vs. returning visits</h4>' +
      '<div class="gtt-an-split"><div><b>' + fmt(data.new_visits) + '</b><span>New</span></div><div><b>' + fmt(data.returning_visits) + '</b><span>Returning</span></div></div>' +
      '<p class="gtt-an-muted">If someone clears browser storage, their next visit may be counted as new.</p></section>' +
      '<section class="gtt-an-panel"><h4>Daily activity</h4>' + trend(data.daily, days) + '</section></div>' +
      '<div class="gtt-an-section-title"><h4>What people are using</h4><span>Ranked by recorded selections</span></div>' +
      '<div class="gtt-an-cols gtt-an-lists">' + topList('New phones selected', data.quoted_devices) +
      topList('Trade-in phones selected', data.trade_models) + topList('Plans selected', data.plans) +
      topList('Popular sections', data.tools) + '</div>' +
      '<p class="gtt-an-disclaimer">Updated ' + esc(new Date(data.as_of).toLocaleString()) +
      '. Tracking started when the analytics file was installed. No customer names, account numbers, typed questions, IP addresses, or quoted dollar amounts are stored by this analytics feature.' +
      (data.truncated ? ' The reporting limit was reached; some results may be incomplete.' : '') + '</p>';
    $('gttAnDays').value = String(days);
    $('gttAnDays').onchange = e => loadStats(Number(e.target.value));
    $('gttAnRefresh').onclick = () => loadStats(days);
  }
  async function loadStats(days = 30) {
    const root = $('gttAnalyticsDashboard'); if (!root) return;
    if (!adminPassword) { showPasswordInput(); return; }
    root.innerHTML = '<p class="gtt-an-muted">Loading private analytics…</p>';
    try {
      const res = await fetch(API, {method: 'POST', mode: 'cors', cache: 'no-store',
        headers: {'Content-Type': 'application/json', 'x-gtt-admin-password': adminPassword},
        body: JSON.stringify({action: 'stats', days})});
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Analytics not available');
      fillDashboard(data.data, days);
    } catch (err) {
      adminPassword = '';
      root.innerHTML = '<p class="gtt-an-error">Unable to load: ' + esc(err.message) + '</p>';
      showPasswordInput();
    }
  }
  function showPasswordInput() {
    const root = $('gttAnalyticsDashboard'); if (!root) return;
    const input = document.createElement('div'); input.className = 'gtt-an-gate';
    input.innerHTML = '<h3>Private usage statistics</h3><p>Enter your existing GTT Admin password to load reports. The password is not saved.</p>' +
      '<form id="gttAnLogin"><input type="password" id="gttAnPassword" placeholder="Admin password" autocomplete="off" required /> ' +
      '<button type="submit" class="admin-btn">View Reports</button></form>';
    root.appendChild(input);
    $('gttAnLogin').onsubmit = e => {
      e.preventDefault(); adminPassword = $('gttAnPassword').value; loadStats(30);
    };
  }
  function addPrivacyControl() {
    const sheet = document.querySelector('#v4More .v4-more-sheet'); if (!sheet) return;
    const box = document.createElement('div'); box.className = 'gtt-an-privacy';
    box.innerHTML = '<b>Usage statistics</b><p>GTT counts tool usage with a random browser ID to improve features. It does not record customer data, searches, or quote prices.</p>' +
      '<button id="gttAnPrivacyButton" type="button"></button>';
    sheet.appendChild(box);
    function refresh() {
      const enabled = permitted(), opted = localStorage.getItem(OPT_OUT_KEY) === '1';
      const b = $('gttAnPrivacyButton');
      b.textContent = opted ? 'Enable usage statistics' : enabled ? 'Turn off usage statistics' : 'Disabled by browser privacy settings';
      b.disabled = !enabled && !opted;
    }
    $('gttAnPrivacyButton').onclick = () => {
      const opted = localStorage.getItem(OPT_OUT_KEY) === '1';
      if (opted) { localStorage.removeItem(OPT_OUT_KEY); visitor = ''; session = ''; first = false; if (ensureIdentity()) track('page_view', {tool: 'home'}); }
      else { localStorage.setItem(OPT_OUT_KEY, '1'); localStorage.removeItem(VISITOR_KEY); sessionStorage.removeItem(SESSION_KEY); visitor = ''; session = ''; }
      refresh();
    };
    refresh();
  }
  function addAdminTab() {
    const tabRow = document.querySelector('#adminModal .admin-tabs');
    const panel = $('adminModal') && $('adminModal').querySelector('.admin-panel');
    if (!tabRow || !panel) return;
    const tab = document.createElement('button'); tab.type = 'button'; tab.className = 'admin-tab';
    tab.dataset.tab = 'usage'; tab.setAttribute('aria-pressed', 'false'); tab.textContent = '📈 Usage';
    tabRow.appendChild(tab);
    const section = document.createElement('section'); section.className = 'admin-section'; section.dataset.section = 'usage';
    section.innerHTML = '<div id="gttAnalyticsDashboard"></div>';
    panel.appendChild(section);
    tab.onclick = () => {
      document.querySelectorAll('#adminModal .admin-tab').forEach(t => t.setAttribute('aria-pressed', t === tab ? 'true' : 'false'));
      document.querySelectorAll('#adminModal .admin-section').forEach(s => s.classList.toggle('open', s === section));
      if (adminPassword) loadStats(30); else { $('gttAnalyticsDashboard').innerHTML = ''; showPasswordInput(); }
    };
    const lock = $('adminLock'); if (lock) lock.addEventListener('click', () => {
      adminPassword = '';
      const root = $('gttAnalyticsDashboard'); if (root) root.replaceChildren();
    });
  }
  function observeQuote() {
    const display = $('display'), view = $('viewQuote');
    if (!display || !view) return;
    let queued = false;
    function check() {
      if (queued) return; queued = true;
      setTimeout(() => { queued = false; recordQuoteChoices(); recordCompletedQuote(); }, 170);
    }
    new MutationObserver(check).observe(display, {attributes: true, attributeFilter: ['class'], childList: true, subtree: true});
    new MutationObserver(check).observe(view, {attributes: true, attributeFilter: ['hidden']});
    const page = $('tradePage');
    if (page) {
      ['click', 'input', 'change'].forEach(type => page.addEventListener(type, () => { quoteInteracted = true; check(); }));
    }
  }
  function init() {
    if (ensureIdentity()) { track('page_view', {tool: 'home'}); track('tool_view', {tool: 'home'}); }
    addPrivacyControl(); addAdminTab(); observeQuote();
    document.addEventListener('click', e => {
      const route = e.target.closest('[data-v4go]');
      if (route && route.dataset.v4go) track('tool_view', {tool: route.dataset.v4go});
      const other = e.target.closest('[data-v4tool], [data-tools-page]');
      if (other) track('tool_view', {tool: other.dataset.v4tool || other.dataset.toolsPage || 'other'});
      if (e.target.closest('#compareRun')) track('comparison_run', {tool: 'compare'});
      if (e.target.closest('#v4Storage .v4-chip')) {
        setTimeout(() => {
          const text = $('v4SelectedTrade') && $('v4SelectedTrade').textContent.split(' · ')[0];
          if (text) track('simple_result', {tool: 'simple', device: text});
        }, 30);
      }
      if (e.target.closest('#piRun,[data-pi-example],#piRetry')) pendingInvestigation = true;
    });
    const invForm = $('piQuestionForm');
    if (invForm) invForm.addEventListener('submit', () => { pendingInvestigation = true; });
    const status = $('piStatus');
    if (status) new MutationObserver(() => {
      if (pendingInvestigation && /Answer ready/i.test(status.textContent || '')) {
        pendingInvestigation = false; track('investigation_run', {tool: 'investigator'});
      }
    }).observe(status, {childList: true, subtree: true, characterData: true});
    const tax = $('v4Tax');
    if (tax) ['input', 'change'].forEach(kind => tax.addEventListener(kind, e => {
      if (!e.target.closest('input, select')) return;
      clearTimeout(taxTimer); taxTimer = setTimeout(() => track('tax_calculation', {tool: 'tax'}), 1700);
    }));
  }
  const style = document.createElement('style');
  style.id = 'gtt-analytics-ui-v2';
  style.textContent = "\n/* Analytics styles scoped to the admin modal to avoid changing the rest of GTT. */\n#adminModal .admin-head h2 {color:#18334c !important;opacity:1 !important}\n#adminModal .admin-head .eyebrow {color:#0568ae !important}\n#adminModal #gttAnalyticsDashboard {--an-ink:#152c41;--an-muted:#576b7e;--an-blue:#0568ae;--an-border:#d8e5f0;color:var(--an-ink) !important;font-size:14px;line-height:1.45;min-width:0;padding:2px 0 20px}\n#adminModal #gttAnalyticsDashboard *,#adminModal #gttAnalyticsDashboard *::before,#adminModal #gttAnalyticsDashboard *::after{box-sizing:border-box}\n#adminModal #gttAnalyticsDashboard h3,#adminModal #gttAnalyticsDashboard h4{color:var(--an-ink) !important;opacity:1 !important;text-shadow:none !important;letter-spacing:-.02em}\n#adminModal #gttAnalyticsDashboard p,#adminModal #gttAnalyticsDashboard span,#adminModal #gttAnalyticsDashboard b{opacity:1}\n#adminModal .gtt-an-heading {display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;padding:14px 0 8px;border-bottom:1px solid var(--an-border)}\n#adminModal .gtt-an-heading-copy{flex:1 1 250px;min-width:0}\n#adminModal .gtt-an-eyebrow{font-size:10px;letter-spacing:.13em;font-weight:850;color:#22689f !important;margin-bottom:4px}\n#adminModal .gtt-an-heading h3{font-size:22px !important;line-height:1.2;margin:0 0 6px !important;font-weight:850}\n#adminModal .gtt-an-heading p{font-size:12px;line-height:1.5;color:var(--an-muted) !important;max-width:620px;margin:0 0 10px}\n#adminModal .gtt-an-toolbar{display:flex;align-items:center;gap:8px;flex:0 0 auto;flex-wrap:wrap}\n#adminModal .gtt-an-toolbar label{font-size:11px;font-weight:800;color:var(--an-muted)}\n#adminModal .gtt-an-toolbar select{width:auto !important;min-width:130px;max-width:160px;min-height:38px;padding:8px 28px 8px 10px;background:#fff !important;border:1px solid #b7cbde !important;border-radius:9px !important;color:#193a54 !important;font:700 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif !important}\n#adminModal .gtt-an-refresh{appearance:none;min-height:38px;border:1px solid #b7d4eb;border-radius:9px;padding:8px 12px;background:#eaf6ff;color:#075b94;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap}\n#adminModal .gtt-an-refresh:focus-visible{outline:3px solid #68b7eb;outline-offset:2px}\n#adminModal .gtt-an-grid {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0 20px}\n#adminModal .gtt-an-metric {min-width:0;min-height:95px;background:#fff;border:1px solid var(--an-border);border-radius:13px;padding:13px 14px;box-shadow:0 1px 2px rgba(11,42,74,.025)}\n#adminModal .gtt-an-metric-label{display:block;color:#4f6477 !important;font-size:12px;font-weight:700;line-height:1.3;min-height:30px}\n#adminModal .gtt-an-metric strong{display:block;margin-top:3px;font-size:29px;font-weight:850;line-height:1.1;letter-spacing:-.035em;color:#0b5286 !important;font-variant-numeric:tabular-nums}\n#adminModal .gtt-an-section-title{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:20px 0 10px;flex-wrap:wrap}\n#adminModal .gtt-an-section-title h4{font-size:15px !important;font-weight:850;margin:0 !important}\n#adminModal .gtt-an-section-title span{font-size:11px;font-weight:650;color:var(--an-muted) !important}\n#adminModal .gtt-an-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0 0 12px}\n#adminModal .gtt-an-panel{background:#fff;color:var(--an-ink) !important;border:1px solid var(--an-border);border-radius:13px;padding:16px;min-width:0;box-shadow:0 1px 2px rgba(11,42,74,.025)}\n#adminModal .gtt-an-panel h4{margin:0 0 14px !important;font-weight:800;font-size:14px !important;line-height:1.2}\n#adminModal .gtt-an-split{display:flex;gap:12px;align-items:stretch}\n#adminModal .gtt-an-split>div{flex:1;min-width:0;background:#f2f7fc;border-radius:9px;padding:12px 14px}\n#adminModal .gtt-an-split b{display:block;font-size:30px;line-height:1.1;font-weight:850;color:#0d4f82 !important;font-variant-numeric:tabular-nums}\n#adminModal .gtt-an-split span{display:block;margin-top:4px;color:#53687c !important;font-size:12px;font-weight:700}\n#adminModal .gtt-an-muted{font-size:11px;color:#627487 !important;line-height:1.45;margin:12px 0 0}\n#adminModal .gtt-an-chart-top{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;color:#5a6b7b !important;margin-bottom:5px}\n#adminModal .gtt-an-chart-top span{color:#5a6b7b !important}\n#adminModal .gtt-an-chart-top strong{color:#1f5a86;font-size:11px;font-variant-numeric:tabular-nums}\n#adminModal .gtt-an-chart{height:112px;display:grid;grid-template-columns:repeat(var(--gtt-an-days),minmax(0,1fr));align-items:end;gap:2px;padding:7px 0 0;border-bottom:1px solid #ccdbe9;background:repeating-linear-gradient(to top,#eaf2f9 0 1px,transparent 1px 33%)}\n#adminModal .gtt-an-day{height:100%;display:flex;align-items:flex-end;justify-content:center;min-width:0}\n#adminModal .gtt-an-day i{display:block;width:100%;max-width:15px;border-radius:3px 3px 0 0;background:#d8e5f0;min-height:2px}\n#adminModal .gtt-an-day i.active{background:linear-gradient(180deg,#2389cd,#075b95)}\n#adminModal .gtt-an-chart-axis{display:flex;justify-content:space-between;color:#697d8d;font-size:10px;padding-top:6px;font-variant-numeric:tabular-nums}\n#adminModal .gtt-an-item{display:flex;align-items:center;gap:10px;line-height:1.35;margin-top:10px;font-size:12px}\n#adminModal .gtt-an-rank{display:flex;align-items:center;justify-content:center;width:21px;height:21px;flex:0 0 21px;border-radius:6px;background:#edf5fb;color:#31678f !important;font-size:10px;font-weight:850}\n#adminModal .gtt-an-item-label{color:#213f55 !important;flex:1;min-width:0;overflow-wrap:anywhere;font-weight:650}\n#adminModal .gtt-an-item b{color:#193954 !important;font-size:12px;flex:0 0 auto;font-variant-numeric:tabular-nums}\n#adminModal .gtt-an-track{background:#ebf2f8;height:5px;border-radius:20px;overflow:hidden;margin:7px 0 12px 31px}\n#adminModal .gtt-an-track i{display:block;height:100%;background:#338ece;border-radius:20px}\n#adminModal .gtt-an-empty{text-align:center;padding:18px 7px;color:#687b8a}\n#adminModal .gtt-an-empty>span{font-size:24px;color:#7c9fba !important}\n#adminModal .gtt-an-empty p{font-size:11px;color:#6a7f8d !important;margin:5px 0 0}\n#adminModal .gtt-an-disclaimer{border-top:1px solid var(--an-border);margin:18px 0 0;padding:12px 2px;color:#576b7b !important;font-size:11px;line-height:1.65}\n#adminModal .gtt-an-error{background:#fff0ef;color:#9e3333;padding:11px;border-radius:9px}\n#adminModal .gtt-an-gate{padding:18px;border:1px solid #d6e4ef;border-radius:12px;background:#fff}\n#adminModal .gtt-an-gate h3{font-size:18px !important;margin:0 0 8px !important}\n#adminModal .gtt-an-gate p{font-size:12px;color:#576b7b !important}\n#adminModal .gtt-an-gate form{display:flex;gap:8px;align-items:stretch;flex-wrap:wrap;margin-top:12px}\n#adminModal .gtt-an-gate input{width:min(290px,100%) !important;flex:1 1 180px;min-height:42px;margin:0;padding:10px;font-size:14px !important;border:1px solid #b8cddd !important;border-radius:9px}\n#adminModal .gtt-an-gate button{min-height:42px}\n.gtt-an-privacy{border-top:1px solid #d8e2ec;margin:12px 16px 0;padding:14px 0;font-size:12px;color:#516478}\n.gtt-an-privacy p{margin:4px 0 9px}\n.gtt-an-privacy button{background:transparent;border:0;color:#0568ae;text-decoration:underline;cursor:pointer;padding:4px 0;font:inherit}\n.gtt-an-privacy button:disabled{color:#8193a2;cursor:default}\n@media(max-width:720px){\n #adminModal .gtt-an-grid{grid-template-columns:repeat(2,minmax(0,1fr))}\n #adminModal .gtt-an-cols{grid-template-columns:minmax(0,1fr)}\n #adminModal .gtt-an-heading{align-items:stretch;gap:10px}\n #adminModal .gtt-an-toolbar{width:100%}\n #adminModal .gtt-an-toolbar select{flex:1 1 auto;max-width:none}\n}\n@media(max-width:420px){\n #adminModal .gtt-an-metric{padding:11px;min-height:86px}\n #adminModal .gtt-an-metric strong{font-size:26px}\n #adminModal .gtt-an-metric-label{font-size:11px}\n #adminModal .gtt-an-panel{padding:13px}\n}\n";
  document.head.appendChild(style);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
