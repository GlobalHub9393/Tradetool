/* Global Trade Tool — optional, quote-safe bundle explorer.
   Reads public offer references from public.gtt_bundle_offers.
   Does NOT write to GTTQuote, main quote state, storage, analytics, or customer records.
   Data source: AT&T CCKM screenshots supplied 2026-11-13; verify final eligibility in OPUS/CCKM. */
(() => {
  'use strict';
  const SB = 'https://uwomiirfvllcafijmkmk.supabase.co';
  // This is a browser-safe *publishable* key already used by the GTT frontend, NOT a secret/service key.
  const KEY = 'sb_publishable_UMb8Nb5DG0w1dv9h5W5-2Q_0PinuBV4';
  const $ = id => document.getElementById(id);
  const validStates = new Set(['promo','nextup_promo','tiered_final','zero','full_retail','full_retail_rerate','tiered_not_offered']);
  const currency = x => '$' + Number(x).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g,' ');
  const data = new Map();
  let loading = true;
  let active = null;
  let tab = 'watch';
  let chosenWatch = null;
  let chosenTablet = null;

  // Only matching *qualified product families* can show a bundle link.
  // The selected phone alone does not prove customer/service eligibility.
  function getQuote() {
    const q = window.GTTQuote;
    if (!q || typeof q.capture !== 'function') return null;
    try {
      const c=q.capture(), r=q.evaluate(c);
      if (!c?.phoneId || !validStates.has(r?.state)) return null;
      const phone=q.phones().find(p=>p.id===c.phoneId);
      if (!phone) return null;
      const metric=q.metric(c,r);
      if (!metric || !Number.isFinite(Number(metric.monthly))) return null;
      const match=[...data.values()].find(row=>(row.eligible_phones||[]).some(name=>norm(name)===norm(phone.name)));
      if (!match) return null;
      return {phone,metric,offer:match};
    } catch (err) {console.warn('GTT bundle: quote unavailable',err);return null;}
  }

  function syncButton() {
    const quote=$('quoteDialog'),link=$('gttBundleLink');
    if (!link) return;
    const offer = !loading && quote?.open ? getQuote() : null;
    link.hidden = !offer;
    if (offer) {
      const label={apple:'Apple',samsung:'Samsung',google:'Pixel'}[offer.offer.brand]||'Device';
      $('gttBundleBrand').textContent = `Explore potential ${label} bundle offers`;
      $('gttBundleSub').textContent = offer.offer.tablets.length ? 'Watches, tablets & combinations' : 'Qualifying watch savings';
    }
  }

  async function loadOffers() {
    try {
      const response=await fetch(`${SB}/rest/v1/gtt_bundle_offers?select=brand,eligible_phones,watches,tablets,terms,effective_on&active=eq.true&order=brand.asc`,{
        method:'GET',headers:{apikey:KEY,Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(12000)
      });
      if(!response.ok)throw new Error('HTTP '+response.status);
      const rows=await response.json();
      if(!Array.isArray(rows))throw new Error('Invalid bundle response');
      for (const row of rows) {
        if(!row?.brand || !Array.isArray(row.eligible_phones)||!Array.isArray(row.watches)||!Array.isArray(row.tablets))continue;
        const validItem = v => v && typeof v.id==='string' && typeof v.name==='string' && Number.isFinite(Number(v.monthly)) && Number(v.monthly)>=0;
        row.watches=row.watches.filter(validItem);
        row.tablets=row.tablets.filter(validItem);
        if(row.watches.length||row.tablets.length)data.set(row.brand,row);
      }
    } catch(error) {
      // Fail closed: no old or guessed offer prices displayed if Supabase is unavailable.
      console.warn('GTT bundle offers unavailable; phone quote remains fully functional.',error);
    } finally {loading=false;syncButton();}
  }

  function drawList(type) {
    const items=(type==='watch'?active.offer.watches:active.offer.tablets);
    const selected=type==='watch'?chosenWatch:chosenTablet;
    if(!items.length)return '<p class="gttb-empty">No current bundle options in this category.</p>';
    return `<p class="gttb-list-intro">Select a device to add it to this <b>optional</b> bundle estimate. Tap again to remove it.</p>
      <div class="gttb-list">${items.map(item=>{
        const on=selected===item.id;
        const retail=Number.isFinite(Number(item.retail))?currency(item.retail):'';
        return `<button type="button" class="gttb-choice${on?' selected':''}" data-bundle-device="${escapeHTML(item.id)}" data-bundle-type="${type}" aria-pressed="${on}">
          <span class="gttb-check" aria-hidden="true">${on?'✓':'+'}</span><span class="gttb-choice-body"><strong>${escapeHTML(item.name)}</strong>${retail?`<small>Retail ${retail} · 36 installments</small>`:''}</span>
          <span class="gttb-choice-price"><strong>${currency(item.monthly)}<span>/mo</span></strong><small>after credits</small></span>
        </button>`;
      }).join('')}</div>`;
  }

  function selectedItem(type) {
    const items=type==='watch'?active.offer.watches:active.offer.tablets;
    const id=type==='watch'?chosenWatch:chosenTablet;
    return items.find(o=>o.id===id)||null;
  }

  function combinedView() {
    const w=selectedItem('watch'),t=selectedItem('tablet');
    const choose=(what,label)=>`<button type="button" class="gttb-pick" data-bundle-tab="${what}">+ Choose a ${label}</button>`;
    return `<p class="gttb-list-intro">Use one qualifying phone for both offers. Device selections stay inside this explorer and never alter the original quote.</p>
      <div class="gttb-combined">
        <section><h3>Watch</h3>${w?`<p>${escapeHTML(w.name)} <b>${currency(w.monthly)}/mo</b></p>${choose('watch','different watch')}`:choose('watch','watch')}</section>
        <section><h3>Tablet</h3>${t?`<p>${escapeHTML(t.name)} <b>${currency(t.monthly)}/mo</b></p>${choose('tablet','different tablet')}`:choose('tablet','tablet')}</section>
      </div>
      <p class="gttb-hint">Both a new watch line and a new tablet line must qualify. The triple offer combines separate credits, not an extra discount on the phone.</p>`;
  }

  function summary() {
    const w=selectedItem('watch'),t=selectedItem('tablet');
    const selected=[w,t].filter(Boolean);
    if(!selected.length)return '<div class="gttb-summary-placeholder">Select a watch or tablet above to see the additional device cost.</div>';
    const extras=selected.reduce((sum,item)=>sum+Number(item.monthly),0);
    const phone=Number(active.metric.monthly);
    return `<div class="gttb-summary">
      <p class="gttb-summary-caption">Optional bundle estimate · Device installments only</p>
      <div class="gttb-summary-row"><span>${escapeHTML(active.phone.name)}</span><strong>${currency(phone)}/mo</strong></div>
      ${selected.map(item=>`<div class="gttb-summary-row"><span>${escapeHTML(item.name)}</span><strong>${currency(item.monthly)}/mo</strong></div>`).join('')}
      <div class="gttb-summary-divider"></div>
      <div class="gttb-summary-row gttb-added"><span>Additional watch / tablet payments</span><strong>${currency(extras)}/mo</strong></div>
      <div class="gttb-summary-row gttb-total"><span>All selected device installments</span><strong>${currency(phone+extras)}/mo</strong></div>
      <p class="gttb-disclaimer">Separate estimate, NOT added to GTT's phone price card. Requires all qualifying offers and new device lines. Phone plan, watch/tablet service, taxes, activation fees and other charges are not included. Confirm in OPUS/CCKM.</p>
    </div>`;
  }

  function draw() {
    if(!active)return;
    const o=active.offer,terms=o.terms||{};
    const brand={apple:'Apple',samsung:'Samsung',google:'Google Pixel'}[o.brand]||'Device';
    const tabs=[['watch','Watches']];
    if(o.tablets.length)tabs.push(['tablet','Tablets'],['both','Both']);
    if(!tabs.some(([key])=>key===tab))tab='watch';
    const content=tab==='both'?combinedView():drawList(tab);
    const d=$('gttBundleDialog');
    d.innerHTML=`<div class="gttb-head"><div><p class="gttb-kicker">POTENTIAL ADD-ON SAVINGS</p><h2>${escapeHTML(brand)} Bundle Offers</h2></div><button class="gttb-close" type="button" data-bundle-close aria-label="Close bundle explorer">×</button></div>
      <div class="gttb-inner">
        <div class="gttb-phone"><div><span>Current phone quote (unchanged)</span><strong>${escapeHTML(active.phone.name)} ${escapeHTML(active.phone.storage||'')}</strong></div><div class="gttb-phone-price">${currency(active.metric.monthly)}<span>/mo</span></div></div>
        <p class="gttb-subhead">${escapeHTML(terms.headline||'Watch and tablet offers')} · Offers dated ${escapeHTML(o.effective_on||'November 2026')}</p>
        <div class="gttb-tabs" role="group" aria-label="Bundle category">${tabs.map(([key,label])=>`<button type="button" data-bundle-tab="${key}" aria-pressed="${key===tab}" >${label}</button>`).join('')}</div>
        <div class="gttb-tabcontent">${content}</div>
        ${summary()}
        <details class="gttb-rules"><summary>How to qualify & stacking rules</summary>
          <div><p><b>Qualifying phones:</b> ${o.eligible_phones.map(escapeHTML).join(', ')}.</p>
          ${terms.qualify?`<p><b>Lines:</b> ${escapeHTML(terms.qualify)}</p>`:''}
          ${terms.stacks?`<p><b>Stacking:</b> ${escapeHTML(terms.stacks)}</p>`:''}
          ${terms.extra?`<p><b>Exceptions:</b> ${escapeHTML(terms.extra)}</p>`:''}
          ${terms.period?`<p><b>Timing:</b> ${escapeHTML(terms.period)}</p>`:''}
          ${terms.note?`<p>${escapeHTML(terms.note)}</p>`:''}
          <p>Promotional eligibility and final bill-credit amounts must be verified in AT&T's approved systems.</p>
          </div></details>
        <p class="gttb-foot">Estimates based on the AT&T offers supplied November 13, 2026. Monthly prices apply after eligible bill credits over 36 months. Additional line charges and taxes are excluded.</p>
      </div>`;
    d.querySelector('[data-bundle-close]').onclick=()=>d.close();
    d.querySelectorAll('[data-bundle-tab]').forEach(btn=>btn.onclick=()=>{tab=btn.dataset.bundleTab;draw();});
    d.querySelectorAll('[data-bundle-device]').forEach(btn=>btn.onclick=()=>{
      const type=btn.dataset.bundleType, id=btn.dataset.bundleDevice;
      if(type==='watch')chosenWatch=chosenWatch===id?null:id;
      else chosenTablet=chosenTablet===id?null:id;
      draw();
    });
  }

  function openExplorer() {
    if(loading)return;
    const quote=getQuote();
    if(!quote||!$('quoteDialog')?.open)return;
    active=quote;chosenWatch=null;chosenTablet=null;tab='watch';
    draw();$('gttBundleDialog').showModal();
  }

  function init() {
    const quote=$('quoteDialog'),mount=$('quoteMount');
    if(!quote||!mount||$('gttBundleLink'))return;
    const link=document.createElement('button');
    link.id='gttBundleLink';link.hidden=true;link.type='button';
    link.setAttribute('aria-label','Explore potential watch and tablet bundle offers');
    link.innerHTML=`<span class="gttb-gift" aria-hidden="true">🎁</span><span class="gttb-linktext"><strong id="gttBundleBrand">Explore bundle offers</strong><small id="gttBundleSub">Optional watch and tablet savings</small></span><span class="gttb-chevron" aria-hidden="true">›</span>`;
    // Insert between existing quote and customer-language/trade-record buttons.
    mount.after(link);
    const dialog=document.createElement('dialog');
    dialog.id='gttBundleDialog';dialog.className='gttb-dialog';dialog.setAttribute('aria-label','Optional bundle explorer');
    document.body.appendChild(dialog);
    dialog.addEventListener('click',ev=>{if(ev.target===dialog)dialog.close();});
    dialog.addEventListener('close',()=>{active=null;chosenWatch=null;chosenTablet=null;syncButton();});
    link.onclick=openExplorer;
    new MutationObserver(syncButton).observe(quote,{attributes:true,attributeFilter:['open']});
    quote.addEventListener('close',()=>{if(dialog.open)dialog.close();syncButton();});
    if(window.GTTQuote?.ready)window.GTTQuote.ready.then(syncButton).catch(()=>{});
    loadOffers();
    syncButton();
  }

  const style=document.createElement('style');
  style.textContent=`
    #gttBundleLink{box-sizing:border-box;display:flex;align-items:center;width:100%;gap:9px;margin:9px 0 2px;padding:9px 11px;text-align:left;cursor:pointer;border:1px solid #d6e4ee;border-radius:11px;background:#f8fbff;color:#224a67;font:inherit;min-height:47px;box-shadow:none}
    #gttBundleLink[hidden]{display:none!important}
    #gttBundleLink:focus-visible{outline:3px solid #208ac1;outline-offset:2px}
    .gttb-gift{font-size:18px;line-height:1}.gttb-linktext{min-width:0;display:flex;flex:1;flex-direction:column;gap:1px}
    .gttb-linktext strong{font:700 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a5679}
    .gttb-linktext small{font:400 11px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#5b7589}
    .gttb-chevron{font:400 28px/1 Arial;color:#668ca4}
    .gttb-dialog{box-sizing:border-box;position:fixed;border:1px solid #d7e3eb;padding:0;width:min(94vw,580px);max-width:580px;max-height:min(92dvh,870px);background:#fff;border-radius:17px;color:#203748;overflow:auto;box-shadow:0 24px 80px #0007;font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
    .gttb-dialog::backdrop{background:#081b31bd}.gttb-dialog *, .gttb-dialog *:before,.gttb-dialog *:after{box-sizing:border-box}
    .gttb-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:18px 19px 14px;border-bottom:1px solid #e4edf4;background:#f8fbff}
    .gttb-head h2{margin:0;font:800 21px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#153e5b}
    .gttb-kicker{margin:0 0 5px;color:#61809a;font-weight:800;font-size:10px;letter-spacing:.09em}
    .gttb-close{background:transparent;border:0;color:#51768f;font-size:29px;line-height:1;min-width:40px;min-height:40px;cursor:pointer;border-radius:7px}
    .gttb-close:focus-visible,.gttb-dialog button:focus-visible{outline:3px solid #197abd;outline-offset:2px}
    .gttb-inner{padding:17px 19px 20px}.gttb-phone{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #dbe8f2;background:#f2f8fd;border-radius:11px;padding:10px 12px}
    .gttb-phone div:first-child{display:flex;flex-direction:column;min-width:0;gap:3px}.gttb-phone span{font-size:11px;color:#607e90}.gttb-phone strong{font-size:13px;color:#173e5d}
    .gttb-phone-price{font-size:18px;font-weight:800;color:#086497;white-space:nowrap}.gttb-phone-price span{font-size:11px;font-weight:500}
    .gttb-subhead{color:#657e90;font-size:11px;line-height:1.45;margin:11px 0 13px}
    .gttb-tabs{display:grid;grid-auto-columns:1fr;grid-auto-flow:column;gap:5px;border:1px solid #dce7f0;border-radius:11px;padding:4px;background:#f2f6fa}
    .gttb-tabs button{font:700 12px -apple-system,BlinkMacSystemFont,Arial,sans-serif;min-height:37px;border:0;border-radius:8px;background:transparent;color:#516e84;cursor:pointer;padding:7px 5px}
    .gttb-tabs button[aria-pressed=true]{background:#0968a0;color:#fff;box-shadow:0 2px 7px #072f4f22}
    .gttb-list-intro{color:#5f7585;font-size:12px;margin:15px 0 10px}
    .gttb-list{display:flex;flex-direction:column;gap:7px}.gttb-choice{display:flex;align-items:center;gap:10px;width:100%;border:1px solid #dce6ee;background:#fff;border-radius:11px;padding:10px 11px;min-height:62px;text-align:left;color:#203b4d;cursor:pointer}
    .gttb-choice.selected{border-color:#0077b8;background:#edf8ff}.gttb-check{width:24px;height:24px;flex:0 0 24px;display:grid;place-items:center;border-radius:50%;background:#e8eff5;color:#2d668d;font-weight:800}
    .gttb-choice.selected .gttb-check{background:#0774ac;color:#fff}.gttb-choice-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}.gttb-choice-body strong{font-size:12px}.gttb-choice-body small{font-size:10px;color:#647e8f}
    .gttb-choice-price{min-width:90px;text-align:right;display:flex;align-items:flex-end;flex-direction:column;gap:2px}.gttb-choice-price strong{font-size:18px;color:#0770a3;white-space:nowrap}.gttb-choice-price strong span{font-size:11px}.gttb-choice-price small{font-size:10px;color:#6b8290}
    .gttb-summary-placeholder{border:1px dashed #c6dce9;border-radius:10px;padding:13px;color:#617e92;text-align:center;font-size:12px;margin-top:17px}
    .gttb-summary{background:#f5f9fc;border:1px solid #d5e6f0;border-radius:12px;padding:13px 14px;margin-top:17px}
    .gttb-summary-caption{font-size:11px;font-weight:800;color:#3d718f;margin:0 0 9px}.gttb-summary-row{display:flex;justify-content:space-between;align-items:baseline;gap:9px;font-size:12px;margin:6px 0}.gttb-summary-row strong{white-space:nowrap}
    .gttb-summary-divider{border-top:1px solid #cbdde8;margin:11px 0}.gttb-added{font-weight:700;color:#156b95}.gttb-total{font-weight:800;font-size:13px;color:#064c76}.gttb-total strong{font-size:19px}
    .gttb-rules{border-top:1px solid #e1e9ef;margin-top:16px;padding-top:11px}.gttb-rules summary{cursor:pointer;font-size:12px;font-weight:800;color:#17688f}.gttb-rules p{font-size:12px;color:#3f5968;margin:9px 0;line-height:1.5}
    .gttb-disclaimer,.gttb-foot{color:#647c8b;font-size:10.5px;line-height:1.5;margin:13px 0 0}
    .gttb-combined{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:13px 0}.gttb-combined section{border:1px solid #d8e5ec;border-radius:10px;padding:11px;background:#fff}.gttb-combined h3{font-size:13px;margin:0 0 7px}.gttb-combined p{font-size:12px;margin:0 0 9px}.gttb-combined p b{display:block;color:#07618f;margin-top:3px}
    .gttb-pick{border:1px solid #a6cede;border-radius:8px;padding:8px 10px;font-size:11px;font-weight:700;color:#126389;background:#ecf7fe;cursor:pointer}
    .gttb-empty,.gttb-hint{color:#678295;font-size:11px;line-height:1.5}
    @media(max-width:460px){.gttb-inner{padding:13px}.gttb-head{padding:14px}.gttb-head h2{font-size:18px}.gttb-choice-price{min-width:82px}.gttb-choice-price strong{font-size:17px}.gttb-combined{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
