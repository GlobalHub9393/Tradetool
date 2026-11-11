/* GTT Analytics v1 — independent, lightweight and privacy-conscious.
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
  function metric(title, count) { return '<div class="gtt-an-metric"><small>' + esc(title) + '</small><strong>' + fmt(count) + '</strong></div>'; }
  function topList(title, rows) {
    rows = Array.isArray(rows) ? rows : [];
    const max = Math.max(1, ...rows.map(x => Number(x.count) || 0));
    const content = rows.length ? rows.slice(0, 8).map(x =>
      '<div class="gtt-an-item"><span>' + esc(x.name) + '</span><b>' + fmt(x.count) + '</b></div>' +
      '<div class="gtt-an-track"><i style="width:' + Math.round((Number(x.count) || 0) / max * 100) + '%"></i></div>').join('')
      : '<p class="gtt-an-muted">No tracked selections yet</p>';
    return '<section class="gtt-an-panel"><h4>' + esc(title) + '</h4>' + content + '</section>';
  }
  function trend(rows) {
    rows = Array.isArray(rows) ? rows : [];
    const max = Math.max(1, ...rows.map(x => Number(x.unique_browsers) || 0));
    return '<div class="gtt-an-chart" role="img" aria-label="Daily unique browsers">' +
      rows.map(x => '<div title="' + esc(x.date + ': ' + x.unique_browsers + ' browsers, ' + x.quotes + ' quotes') + '">' +
        '<i style="height:' + Math.max(2, Math.round(Number(x.unique_browsers) / max * 100)) + '%"></i></div>').join('') +
      '</div><p class="gtt-an-muted">Daily active browsers on days with tracked activity (Eastern time)</p>';
  }
  function fillDashboard(data, days) {
    const root = $('gttAnalyticsDashboard'); if (!root) return;
    root.innerHTML = '<div class="gtt-an-heading"><div><h3>GTT Usage Analytics</h3>' +
      '<p class="gtt-an-muted">Pseudonymous browser-level activity. 1 browser does not always equal 1 person.</p></div>' +
      '<div><select id="gttAnDays" aria-label="Reporting period"><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select> ' +
      '<button class="admin-btn secondary" type="button" id="gttAnRefresh">Refresh</button></div></div>' +
      '<div class="gtt-an-grid">' + metric('Unique browsers', data.unique_browsers) + metric('Visits / sessions', data.visits) +
      metric('Pageviews', data.pageviews) + metric('Full quotes', data.quotes) + metric('Simple results', data.simple_results) +
      metric('Tax calculations', data.tax_calculations) + metric('Comparisons', data.comparison_runs) + metric('Investigations', data.investigator_runs) + '</div>' +
      '<div class="gtt-an-cols"><section class="gtt-an-panel"><h4>New vs. returning visits</h4>' +
      '<div class="gtt-an-split"><span><b>' + fmt(data.new_visits) + '</b> New</span><span><b>' + fmt(data.returning_visits) + '</b> Returning</span></div>' +
      '<p class="gtt-an-muted">A browser that clears its stored identifier may appear new again.</p></section>' +
      '<section class="gtt-an-panel"><h4>Activity by day</h4>' + trend(data.daily) + '</section></div>' +
      '<div class="gtt-an-cols">' + topList('Most selected new phones', data.quoted_devices) +
      topList('Most selected trade-in phones', data.trade_models) + topList('Most selected plans', data.plans) +
      topList('Most used sections', data.tools) + '</div>' +
      '<p class="gtt-an-muted">Updated ' + esc(new Date(data.as_of).toLocaleString()) +
      '. Tracking begins after you add this file to the site. No names, account numbers, typed questions, IP addresses, or quote dollar amounts are stored.' +
      (data.truncated ? ' This report reached its event limit and may be incomplete.' : '') + '</p>';
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
  style.textContent = '.gtt-an-privacy{border-top:1px solid #d8e2ec;margin:12px 16px 0;padding:14px 0;font-size:12px;color:#516478}.gtt-an-privacy p{margin:4px 0 9px}.gtt-an-privacy button{background:transparent;border:0;color:#0568ae;text-decoration:underline;cursor:pointer;padding:4px 0;font:inherit}.gtt-an-privacy button:disabled{color:#8193a2;cursor:default}.gtt-an-heading{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.gtt-an-heading h3{margin:0}.gtt-an-heading select{padding:8px;border-radius:8px}.gtt-an-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:9px;margin:18px 0}.gtt-an-metric{border:1px solid #cee4f4;background:#eef7ff;border-radius:12px;padding:12px}.gtt-an-metric small{display:block;color:#536e80}.gtt-an-metric strong{display:block;color:#0b2a4a;font-size:24px;margin-top:4px}.gtt-an-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin:14px 0}.gtt-an-panel{background:#fff;border:1px solid #d8e2ec;border-radius:12px;padding:15px;min-width:0}.gtt-an-panel h4{margin:0 0 11px}.gtt-an-item{display:flex;justify-content:space-between;gap:12px;font-size:12px}.gtt-an-item span{overflow-wrap:anywhere}.gtt-an-track{height:7px;border-radius:6px;background:#edf3fa;margin:5px 0 11px}.gtt-an-track i{height:100%;border-radius:6px;background:#0568ae;display:block}.gtt-an-muted{font-size:12px;color:#6c7e8c}.gtt-an-split{display:flex;gap:28px}.gtt-an-split b{font-size:27px;display:block;color:#0b2a4a}.gtt-an-chart{display:flex;gap:3px;align-items:end;height:120px;overflow:hidden}.gtt-an-chart>div{flex:1;height:100%;display:flex;align-items:end}.gtt-an-chart i{display:block;background:#0568ae;width:100%;min-height:2px}.gtt-an-error{color:#aa3030}.gtt-an-gate{margin:12px 0;padding:16px;border:1px solid #d8e2ec;border-radius:12px;background:#fff}.gtt-an-gate input{padding:10px;margin-right:5px;border:1px solid #abbcca;border-radius:8px}';
  document.head.appendChild(style);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
