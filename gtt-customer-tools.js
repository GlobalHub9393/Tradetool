/* Global Trade Tool customer presentation & print-only trade worksheet.
   No external translation API, no network calls, no storage of account holder name, trade-in phone number or IMEI.
   Uses the existing GTTQuote engine so promotional arithmetic stays consistent. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const money = value => '$' + Number(value || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const safe = v => String(v ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const VALID_STATES = new Set(['promo', 'nextup_promo', 'tiered_final', 'zero', 'full_retail', 'full_retail_rerate', 'tiered_not_offered']);
  let activeContext = null;
  let selectedLanguage = 'en';

  const strings = {
    en: {
      header:'Your new phone', price:'Estimated monthly device payment', period:'/month',
      promo:({trade,value,credit,save}) => (trade ? `Your trade-in phone has an estimated trade value of ${value}. ` : '') + `This offer may provide ${credit} in promotional bill credits over 36 months, saving approximately ${save} per month on the device.`,
      next:({credit,save}) => `This Next Up upgrade may provide ${credit} in promotional bill credits over 36 months, saving approximately ${save} per month. The old phone is a turn-in and does not receive a separate trade-in credit.`,
      tier:() => `This is a special monthly-price offer over 36 months. A trade-in is not required for this offer.`,
      retail:() => `No promotional trade-in bill credit is included in this estimate.`,
      note:'Device installment only. Monthly service charges, taxes, fees, and optional features are extra. Promotional eligibility and final amounts must be confirmed in official AT&T systems.',
      back:'Close',title:'Customer explanation'
    },
    es: {
      header:'Su nuevo teléfono', price:'Pago mensual estimado del equipo', period:'/mes',
      promo:({trade,value,credit,save}) => (trade ? `Su teléfono para entregar tiene un valor de intercambio estimado de ${value}. ` : '') + `Esta oferta podría incluir ${credit} en créditos promocionales en la factura durante 36 meses, con un ahorro aproximado de ${save} al mes en el equipo.`,
      next:({credit,save}) => `Esta actualización con Next Up podría incluir ${credit} en créditos promocionales durante 36 meses, con un ahorro aproximado de ${save} al mes. Debe devolver el teléfono anterior; no se otorga un crédito adicional por entregarlo.`,
      tier:() => `Este es un precio mensual especial durante 36 meses. No es necesario entregar un teléfono para esta oferta.`,
      retail:() => `Este cálculo no incluye créditos promocionales por la entrega de un teléfono.`,
      note:'Solo incluye el pago del equipo. El servicio mensual, los impuestos, los cargos y las funciones opcionales se cobran aparte. La elegibilidad y los importes finales deben confirmarse en los sistemas oficiales de AT&T.',
      back:'Cerrar',title:'Explicación para el cliente'
    },
    pt: {
      header:'Seu novo celular', price:'Parcela mensal estimada do aparelho', period:'/mês',
      promo:({trade,value,credit,save}) => (trade ? `Seu celular usado tem um valor de troca estimado de ${value}. ` : '') + `Esta oferta pode conceder ${credit} em créditos promocionais na fatura ao longo de 36 meses, economizando aproximadamente ${save} por mês no aparelho.`,
      next:({credit,save}) => `Esta atualização pelo Next Up pode conceder ${credit} em créditos promocionais ao longo de 36 meses, economizando aproximadamente ${save} por mês. O aparelho antigo deve ser devolvido e não gera um crédito de troca separado.`,
      tier:() => `Esta é uma oferta com preço mensal especial por 36 meses. Não é necessário trocar um aparelho para aproveitar a oferta.`,
      retail:() => `Esta estimativa não inclui créditos promocionais pela troca de um aparelho.`,
      note:'Somente a parcela do aparelho. Plano mensal, impostos, taxas e recursos opcionais são cobrados à parte. A elegibilidade e os valores finais devem ser confirmados nos sistemas oficiais da AT&T.',
      back:'Fechar',title:'Explicação para o cliente'
    },
    tr: {
      header:'Yeni telefonunuz', price:'Tahmini aylık cihaz ödemeniz', period:'/ay',
      promo:({trade,value,credit,save}) => (trade ? `Takas edeceğiniz telefonun tahmini değeri ${value}. ` : '') + `Bu kampanya, 36 ay boyunca toplam ${credit} tutarında fatura indirimi sağlayabilir. Böylece cihaz ödemesinde ayda yaklaşık ${save} tasarruf edebilirsiniz.`,
      next:({credit,save}) => `Bu Next Up yükseltmesi, 36 ay boyunca toplam ${credit} tutarında fatura indirimi sağlayabilir; aylık tasarrufunuz yaklaşık ${save} olabilir. Eski telefonun teslim edilmesi gerekir ve ayrıca bir takas indirimi verilmez.`,
      tier:() => `Bu, 36 ay boyunca geçerli özel aylık cihaz fiyatıdır. Bu teklif için eski telefonunuzu takas etmeniz gerekmez.`,
      retail:() => `Bu tahmine takas karşılığında verilen herhangi bir kampanya indirimi dahil değildir.`,
      note:'Bu tutar yalnızca cihaz taksitidir. Aylık tarife ücreti, vergiler, diğer ücretler ve isteğe bağlı hizmetler dahil değildir. Kampanya koşulları ve kesin tutarlar AT&T sistemlerinde doğrulanmalıdır.',
      back:'Kapat',title:'Müşteri için açıklama'
    }
  };

  function quoteSnapshot() {
    const engine = window.GTTQuote;
    if (!engine || typeof engine.capture !== 'function') return null;
    try {
      const c = engine.capture();
      const r = engine.evaluate(c);
      if (!c?.phoneId || !c?.plan || !VALID_STATES.has(r?.state)) return null;
      const m = engine.metric(c, r);
      if (!m || !Number.isFinite(Number(m.monthly))) return null;
      const phone = engine.phones().find(p => p.id === c.phoneId);
      if (!phone) return null;
      return {c,r,m,phone,deviceLabel:phone.name + (phone.storage ? ' ' + phone.storage : ''),
        tradeLabel:c.tradeDevice ? [c.tradeDevice.brand,c.tradeDevice.model,c.tradeStorage].filter(Boolean).join(' ') : ''};
    } catch (e) { console.warn('Customer tools: quote unavailable',e); return null; }
  }
  function creditFacts(s) {
    const tradeValue = s.c.value === null || s.c.value === undefined || s.c.value === '' ? NaN : Number(s.c.value);
    const credit = Number(s.r.credit || 0);
    const savings = Number(s.r.monthly);
    return {
      trade: !!s.c.tradeDevice && !s.c.noTrade && Number.isFinite(tradeValue) && tradeValue >= 0,
      value: money(tradeValue), credit:money(credit), save:money(Number.isFinite(savings) ? savings : credit / 36)
    };
  }

  function createDialog(id, title) {
    const dlg = document.createElement('dialog');
    dlg.id = id;
    dlg.className = 'gtt-cust-dialog';
    dlg.setAttribute('aria-label', title);
    document.body.appendChild(dlg);
    dlg.addEventListener('click', ev => { if (ev.target === dlg) dlg.close(); });
    return dlg;
  }
  function presentCustomer() {
    const s = quoteSnapshot();
    if (!s) return;
    activeContext = s;
    selectedLanguage = window.GTTLanguage?.get?.() || 'en';
    updateCustomerCard();
    $('gttLanguageDialog').showModal();
  }
  function updateCustomerCard() {
    const s = activeContext;
    if (!s) return;
    const t = strings[selectedLanguage];
    const facts = creditFacts(s);
    let explanation = t.retail(facts);
    if (s.r.state === 'promo') explanation = t.promo(facts);
    else if (s.r.state === 'nextup_promo') explanation = t.next(facts);
    else if (s.r.state === 'tiered_final') explanation = t.tier(facts);
    const d = $('gttLanguageDialog');
    d.innerHTML = `
      <div class="gtt-cust-head"><span>🌐 ${safe(t.title)}</span><button class="gtt-cust-x" type="button" data-cust-close aria-label="Close">×</button></div>
      <div class="gtt-cust-content"><p class="gtt-cust-overline">${safe(t.header)}</p>
        <h2 class="gtt-cust-device">${safe(s.deviceLabel)}</h2>
        <div class="gtt-cust-price"><span>${safe(t.price)}</span><strong>${money(s.m.monthly)}<small>${safe(t.period)}</small></strong></div>
        <p class="gtt-cust-sentence">${safe(explanation)}</p>
        <p class="gtt-cust-disclaimer">${safe(t.note)}</p>
        <div class="gtt-cust-language" role="group" aria-label="Customer language">
          ${[['en','English'],['es','Español'],['pt','Português'],['tr','Türkçe']].map(([code,label]) => `<button type="button" data-gtt-lang="${code}" aria-pressed="${String(selectedLanguage===code)}">${label}</button>`).join('')}
        </div>
      </div>`;
    d.querySelector('[data-cust-close]').onclick = () => d.close();
    d.querySelectorAll('[data-gtt-lang]').forEach(btn => btn.addEventListener('click', () => {
      selectedLanguage = btn.dataset.gttLang;
      window.GTTLanguage?.set?.(selectedLanguage);
      updateCustomerCard();
    }));
  }

  // The quote stores a pricing group. Only label a plan as exact when its
  // searchable plan name matches the selected quote group and segment.
  function tradeRecordPlan(s) {
    const raw=String($('planSearch')?.value || '').trim();
    let exact=null;
    try {
      const plans=window.GTTQuote?.catalog?.().plans || [];
      exact=plans.find(p=>String(p.name||'').toLowerCase()===raw.toLowerCase()
        && p.group===s.c.plan && (!p.cru || s.c.planSegment==='cru'));
    } catch (_) { /* A group label is safer than an invented exact plan. */ }
    if (exact) return exact.name;
    const labels={premium:'Premium / Elite',extra:'Extra',starter:'Starter',value:'Value 2.0',
      '55plus':'55+',valueplus_mobile:'Ineligible / Rerate'};
    const segment=s.c.planSegment==='cru'?'Business':s.c.planSegment==='firstnet'?'FirstNet':'Consumer';
    return (labels[s.c.plan] || String(s.c.plan || 'Unknown')) + ' (' + segment + ' plan group — confirm exact plan)';
  }

  function conditionText(value) {
    if (value === true || value === 'yes') return 'Yes';
    if (value === false || value === 'no') return 'No';
    return 'Not confirmed';
  }
  // The same record form is used from the Full Quote and independently from #3.
  // Customer data exists only in the form and the explicitly opened print window.
  const recordDate = () => {
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
    return [parts.year,parts.month,parts.day].join('-');
  };
  const tradeRows = () => {
    try {return window.GTTQuote?.catalog?.().trades?.filter(r=>r&&r.model&&r.brand)||[];}catch(_){return [];}
  };
  const planRows = () => {
    try {return window.GTTQuote?.catalog?.().plans?.filter(r=>r&&r.name)||[];}catch(_){return [];}
  };
  const normRecord = x => String(x||'').toLocaleLowerCase().trim().replace(/\s+/g,' ');
  const recordCurrencyValue = v => v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Math.round(Number(v)*100)/100;
  const usPhone = value => {
    let numbers=String(value||'').replace(/\D/g,'');
    if(numbers.length===11&&numbers.startsWith('1'))numbers=numbers.slice(1);
    return numbers.length===10?'('+numbers.slice(0,3)+') '+numbers.slice(3,6)+'-'+numbers.slice(6):null;
  };
  function recordFields(s){
    const ctx=s?.c||{},cond=ctx.tradeCondition||{};
    return {date:recordDate(),accountHolder:'',tradePhone:'',device:s?.tradeLabel||'',storage:ctx.tradeStorage||'',imei:'',
      plan:s?tradeRecordPlan(s):'',power:cond.power,lock:cond.lock,cracks:cond.cracks,
      promo:s&&['promo','nextup_promo'].includes(s.r.state)&&Number.isFinite(Number(s.r.credit))?String(s.r.credit):'',
      rep:'',notes:'',newPhone:s?.deviceLabel||''};
  }
  function conditionRadios(name,value,question){
    return `<fieldset class="gtt-record-condition"><legend>${safe(question)}</legend><label><input type="radio" name="${name}" value="yes" ${value===true?'checked':''} required> Yes</label><label><input type="radio" name="${name}" value="no" ${value===false?'checked':''} required> No</label></fieldset>`;
  }
  function recordFormHTML(s,standalone){
    const f=recordFields(s);
    return `<form class="gtt-record-form ${standalone?'gtt-record-standalone':''}" id="${standalone?'gttRecordStandaloneForm':'gttRecordForm'}" autocomplete="off">
      <p class="gtt-cust-intro">${standalone?'Create a print-only trade-in inspection record. Search a phone or enter one manually.':'Details from the completed quote are pre-filled. Confirm all information before printing.'} No customer details are stored in GTT.</p>
      <div class="gtt-record-grid">
        <label>Purchase / quote date<input name="date" type="date" required value="${safe(f.date)}"></label>
        <label>Account holder name<input name="accountHolder" maxlength="100" required placeholder="Name on AT&amp;T account" autocomplete="off"></label>
        <label>Trade-in phone number<input name="tradePhone" type="tel" inputmode="tel" maxlength="22" required placeholder="(555) 555-0123" autocomplete="off"></label>
        <label>Trade-in IMEI<input name="imei" inputmode="numeric" pattern="[0-9]{15}" maxlength="15" required placeholder="15 digits" autocomplete="off"></label>
        <label class="gtt-record-wide">Phone being traded in<input name="device" list="${standalone?'gttRecordDevicesStandalone':'gttRecordDevicesQuote'}" maxlength="120" required value="${safe(f.device)}" placeholder="Search phones or enter any model" autocomplete="off"><datalist id="${standalone?'gttRecordDevicesStandalone':'gttRecordDevicesQuote'}"></datalist><small class="gtt-plan-help">Choose from active trade-in devices or type an unlisted model.</small></label>
        <label>Storage / capacity<input name="storage" list="${standalone?'gttRecordStorageStandalone':'gttRecordStorageQuote'}" maxlength="50" value="${safe(f.storage)}" placeholder="e.g. 128 GB" autocomplete="off"><datalist id="${standalone?'gttRecordStorageStandalone':'gttRecordStorageQuote'}"></datalist></label>
        <label>AT&amp;T plan<input name="plan" list="${standalone?'gttRecordPlansStandalone':'gttRecordPlansQuote'}" maxlength="150" required value="${safe(f.plan)}" placeholder="Search or enter exact plan" autocomplete="off"><datalist id="${standalone?'gttRecordPlansStandalone':'gttRecordPlansQuote'}"></datalist></label>
      </div>
      <div class="gtt-record-conditions"><strong>Device condition — select Yes or No for each</strong>
        ${conditionRadios('power',f.power,'Powers on and functions?')}
        ${conditionRadios('lock',f.lock,'Activation Lock / Find My turned off?')}
        ${conditionRadios('cracks',f.cracks,'Free of cracks, chips and damage?')}
      </div>
      <div class="gtt-record-grid">
        <label>Promotional credit quoted ($)<input name="promo" type="text" inputmode="decimal" maxlength="11" required value="${safe(f.promo)}" placeholder="e.g. 930.00" autocomplete="off"><small class="gtt-plan-help">Amount actually quoted to the customer; may differ from today's offer.</small></label>
        <label>Rep / initials (optional)<input name="rep" maxlength="60" placeholder="Rep" autocomplete="off"></label>
      </div>
      <p class="gtt-record-value-note" data-record-value>Estimated device trade value: <strong>${s&&recordCurrencyValue(s.c.value)!==null?money(s.c.value):'Select a trade phone to check'}</strong></p>
      ${s?`<p class="gtt-record-original">New phone on original quote: <strong>${safe(f.newPhone)}</strong></p>`:''}
      <label class="gtt-record-notes">Additional notes (optional)<textarea name="notes" maxlength="350" rows="2" placeholder="Prior quote details, visible damage or other observations"></textarea></label>
      <div class="gtt-record-actions"><button type="button" class="gtt-cust-secondary" data-record-reset>${standalone?'Clear form':'Cancel'}</button><button type="submit" class="gtt-cust-primary">🖨️ Print Trade-In Record</button></div>
    </form>`;
  }
  function populateRecordCatalog(form){
    if(!form?.isConnected)return;
    const device=form.elements.namedItem('device'),storage=form.elements.namedItem('storage');
    const choices=new Map();tradeRows().forEach(r=>{const k=[r.brand,r.model].join(' ').trim();choices.set(k,true);});
    const dl=form.querySelector('datalist[id*=RecordDevices]');
    if(dl)dl.innerHTML=[...choices.keys()].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(k=>`<option value="${safe(k)}"></option>`).join('');
    const pdl=form.querySelector('datalist[id*=RecordPlans]');
    if(pdl)pdl.innerHTML=[...new Set(planRows().map(r=>r.name))].map(k=>`<option value="${safe(k)}"></option>`).join('');
    const applyStorage=()=>{
      const rows=tradeRows().filter(r=>normRecord(r.brand+' '+r.model)===normRecord(device.value));
      const dl=form.querySelector('datalist[id*=RecordStorage]');
      if(dl)dl.innerHTML=[...new Set(rows.map(r=>r.storage).filter(Boolean))].map(k=>`<option value="${safe(k)}"></option>`).join('');
      const row=rows.find(r=>normRecord(r.storage)===normRecord(storage.value));
      const estimated=row?recordCurrencyValue(row.value):rows.length===1?recordCurrencyValue(rows[0].value):null;
      const val=form.querySelector('[data-record-value] strong');
      if(val)val.textContent=estimated===null?'Not verified — check official trade-in tool':money(estimated);
    };
    if(!form.dataset.recordCatalogBound){
      device.addEventListener('input',()=>{storage.value='';applyStorage();});
      storage.addEventListener('input',applyStorage);
      form.dataset.recordCatalogBound='yes';
    }
    applyStorage();
  }
  function mountRecordForm(target,s,standalone=false){
    if(!target)return;
    target.innerHTML=recordFormHTML(s,standalone);
    const form=target.querySelector('form');
    form.addEventListener('submit',event=>{event.preventDefault();if(form.reportValidity())printTradeRecord(form,s,standalone);});
    form.elements.namedItem('tradePhone').addEventListener('input',e=>e.target.setCustomValidity(''));
    form.elements.namedItem('promo').addEventListener('input',e=>e.target.setCustomValidity(''));
    form.querySelector('[data-record-reset]').addEventListener('click',()=>{
      if(standalone) mountRecordForm(target,null,true);
      else {const dlg=$('gttTradeRecordDialog');dlg?.close();dlg?.replaceChildren();activeContext=null;}
    });
    populateRecordCatalog(form);
    window.GTTQuote?.ready?.then(()=>{if(form.isConnected)populateRecordCatalog(form);}).catch(()=>{});
  }
  function openTradeRecord(){
    const s=quoteSnapshot();
    if(!s||!s.c.tradeDevice||s.c.noTrade)return;
    activeContext=s;
    const d=$('gttTradeRecordDialog');
    d.innerHTML='<div class="gtt-cust-head"><span>🖨️ Trade-In Inspection Record</span><button class="gtt-cust-x" type="button" data-cust-close aria-label="Close">×</button></div><div id="gttQuoteRecordMount"></div>';
    mountRecordForm($('gttQuoteRecordMount'),s);
    d.querySelector('[data-cust-close]').onclick=()=>d.close();
    d.showModal();
    d.querySelector('[name=accountHolder]')?.focus();
  }
  function printTradeRecord(form,s,standalone){
    const values=new FormData(form);
    const tradePhone=usPhone(values.get('tradePhone'));
    if(!tradePhone){const field=form.elements.namedItem('tradePhone');field.setCustomValidity('Enter a valid 10-digit U.S. phone number.');field.reportValidity();return;}
    const promoRaw=String(values.get('promo')||'').trim().replace(/[$,]/g,'');
    if(!/^(?:\d{1,5})(?:\.\d{1,2})?$/.test(promoRaw) || Number(promoRaw)>99999.99){
      const field=form.elements.namedItem('promo');field.setCustomValidity('Enter a valid quoted dollar amount, such as 930 or 930.00.');field.reportValidity();return;
    }
    const device=String(values.get('device')||'').trim(),storage=String(values.get('storage')||'').trim();
    const plan=String(values.get('plan')||'').trim(),date=String(values.get('date')||'');
    const dateObj=new Date(date+'T12:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(dateObj.valueOf())){form.elements.namedItem('date').reportValidity();return;}
    const dateLabel=dateObj.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});
    const account=String(values.get('accountHolder')||'').trim(),imei=String(values.get('imei')||'').trim();
    if(!account||!plan||!device||!/^[0-9]{15}$/.test(imei))return;
    const row=tradeRows().find(r=>normRecord(r.brand+' '+r.model)===normRecord(device)&&normRecord(r.storage)===normRecord(storage));
    const sameTrade=!!s?.c?.tradeDevice && normRecord(s.c.tradeDevice.brand+' '+s.c.tradeDevice.model)===normRecord(device) && normRecord(s.c.tradeStorage)===normRecord(storage);
    const val=sameTrade?recordCurrencyValue(s.c.value):(row?recordCurrencyValue(row.value):null);
    const report=[
      ['Date',dateLabel],['Account holder name',account],['Trade-in phone number',tradePhone],
      ['Trade-in phone',[device,storage].filter(Boolean).join(' · ')],['IMEI',imei],['AT&T plan',plan],
      ['Powers on and functions',conditionText(values.get('power'))],
      ['Activation Lock / Find My off',conditionText(values.get('lock'))],
      ['Free of cracks, chips and damage',conditionText(values.get('cracks'))],
      ['Promotional credit quoted',money(Number(promoRaw))+' (customer quote; eligibility not guaranteed)'],
      ['Estimated trade-in value',val===null?'Not verified':money(val)],
      ['Rep / initials',String(values.get('rep')||'').trim()||'—']
    ];
    if(s?.deviceLabel) report.push(['New phone on original quote',s.deviceLabel]);
    report.push(['Notes',String(values.get('notes')||'').trim()||'—']);
    const table=report.map(([key,value])=>`<tr><th>${safe(key)}</th><td>${safe(value)}</td></tr>`).join('');
    // Open in direct response to submit so mobile browsers do not block printing.
    const page=window.open('','_blank');
    if(!page){alert('Your browser blocked the print window. Allow pop-ups for GTT and tap Print again.');return;}
    page.document.open();
    page.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GTT Trade-In Record</title><style>
      @page{size:letter;margin:.55in}body{font:13px/1.35 -apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#14253a;margin:24px auto;max-width:760px}h1{font-size:23px;color:#075d9b;margin:0 0 3px}.sub{margin:0 0 16px;color:#58718b}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #dbe3eb;padding:8px 10px;text-align:left;vertical-align:top}th{background:#f2f7fc;width:38%;font-weight:700}td{overflow-wrap:anywhere}.stamp{margin-top:20px;border:2px solid #075d9b;border-radius:9px;padding:13px;text-align:center;font-weight:800;letter-spacing:.01em}.disclaimer{font-size:10.5px;color:#50667d;margin-top:11px}.controls{display:flex;gap:8px;margin:0 0 22px}.controls button{padding:11px 17px;border:0;border-radius:8px;background:#075d9b;color:#fff;font-weight:bold;cursor:pointer}.controls button:last-child{background:#eaf1f8;color:#123e62}@media print{body{margin:0;max-width:none}.controls{display:none}h1{font-size:23px}th,td{padding:7px 9px}}
      </style></head><body><div class="controls"><button onclick="print()">Print</button><button onclick="close()">Close</button></div><h1>Trade-In Inspection Record</h1><p class="sub">Global Trade Tool · Internal store worksheet</p><table>${table}</table><div class="stamp">FILE IN THE DESIGNATED STORE TRADE-IN RECORDS AREA</div><p class="disclaimer">Internal reference only. This document is not an official AT&T trade-in receipt, proof of acceptance, or guarantee of promotional eligibility. The promotional amount above is the amount quoted to the customer, not an AT&T-approved promise. Verify final values, condition and eligibility in approved systems. Handle and dispose of printed customer records according to company policy.</p></body></html>`);
    page.document.close();
    // Clear customer identifiers immediately after launching the print sheet.
    if(standalone)mountRecordForm($('gttStandaloneRecordMount'),null,true);
    else $('gttTradeRecordDialog')?.close();
  }

  document.addEventListener('gtt-language-change', ev=>{
    const lang=ev.detail?.language;
    if(lang && strings[lang]){selectedLanguage=lang;if($('gttLanguageDialog')?.open)updateCustomerCard();}
  });

  function syncActions() {
    const actions = $('gttCustomerActions');
    if (!actions) return;
    const open = !!$('quoteDialog')?.open;
    const s = open ? quoteSnapshot() : null;
    actions.hidden = !s;
    $('gttPrintTradeBtn').hidden = !s?.c?.tradeDevice || !!s?.c?.noTrade;
  }
  function init() {
    const dialog = $('quoteDialog');
    const mount = $('quoteMount');
    if (!dialog || !mount) return;
    if ($('gttCustomerActions')) return;
    const actions = document.createElement('div');
    actions.id = 'gttCustomerActions';
    actions.hidden = true;
    actions.innerHTML = '<button type="button" id="gttShowCustomerBtn">🌐 Customer language</button><button type="button" id="gttPrintTradeBtn">🖨️ Print trade record</button>';
    mount.after(actions);
    createDialog('gttLanguageDialog','Customer quote translation');
    const tradeDialog=createDialog('gttTradeRecordDialog','Trade-in record printing');
    tradeDialog.addEventListener('close',()=>{tradeDialog.replaceChildren();activeContext=null;});
    window.addEventListener('gtt-page-change',event=>{
      const mount=$('gttStandaloneRecordMount');
      if(!mount)return;
      if(event.detail?.page==='record')mountRecordForm(mount,null,true);
      else if(mount.childElementCount)mount.replaceChildren();
    });
    if($('v4Record')?.classList.contains('active'))mountRecordForm($('gttStandaloneRecordMount'),null,true);
    $('gttShowCustomerBtn').addEventListener('click',presentCustomer);
    $('gttPrintTradeBtn').addEventListener('click',openTradeRecord);
    new MutationObserver(syncActions).observe(dialog,{attributes:true,attributeFilter:['open']});
    const view=$('viewQuote');
    if (view) new MutationObserver(syncActions).observe(view,{attributes:true,attributeFilter:['hidden']});
    dialog.addEventListener('close',syncActions);
    syncActions();
  }

  const style=document.createElement('style');
  style.textContent=`
    #gttCustomerActions{display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin:8px 2px 0;padding:9px 0 0;border-top:1px solid #dbe3ea}
    #gttCustomerActions[hidden],#gttPrintTradeBtn[hidden]{display:none!important}
    #gttCustomerActions button{font:600 12px/1.3 -apple-system,BlinkMacSystemFont,Arial,sans-serif;border:1px solid #c7d9e8;border-radius:9px;padding:8px 10px;color:#245d86;background:#f3f9ff;cursor:pointer;box-shadow:none;min-height:35px}
    #gttCustomerActions button:hover{background:#e6f3ff}
    .gtt-cust-dialog{box-sizing:border-box;border:1px solid #d9e3ec;border-radius:18px;padding:0;color:#172a3a;background:#fff;width:min(94vw,515px);max-width:515px;max-height:min(90dvh,800px);overflow-y:auto;box-shadow:0 20px 75px #0006;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;line-height:1.45}
    .gtt-cust-dialog::backdrop{background:rgba(4,15,25,.72)}
    .gtt-cust-dialog *{box-sizing:border-box}
    .gtt-cust-head{display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #e2eaf2;padding:13px 18px;font-weight:750;font-size:14px;color:#1a526f;background:#f8fbff}
    .gtt-cust-x{color:#536f86;border:0;background:transparent;font-size:29px;line-height:1;cursor:pointer}
    .gtt-cust-content{padding:20px 21px 22px}
    .gtt-cust-overline{font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#62788c;font-size:11px;margin:0 0 4px}
    .gtt-cust-device{font-size:24px;line-height:1.2;margin:0 0 20px;color:#142e45}
    .gtt-cust-price{padding:15px 16px;background:#eaf6fc;border:1px solid #cbe5f5;border-radius:14px;margin-bottom:16px}
    .gtt-cust-price>span{display:block;color:#335c76;font-size:12px;font-weight:650}
    .gtt-cust-price strong{display:block;font-size:35px;letter-spacing:-.03em;margin-top:4px;color:#095b8e}
    .gtt-cust-price small{font-size:15px;letter-spacing:0;color:#426b83;margin-left:5px}
    .gtt-cust-sentence{font-size:15px;line-height:1.6;color:#243d52;margin:0 0 17px}
    .gtt-cust-disclaimer{border-top:1px solid #e0e7ef;padding-top:12px;margin:0 0 15px;font-size:11.5px;color:#506777;line-height:1.5}
    .gtt-cust-language{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}
    .gtt-cust-language button{border:1px solid #c5d4e1;background:#fff;border-radius:8px;padding:10px 4px;font:650 11.5px -apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#345875;cursor:pointer;white-space:nowrap}
    .gtt-cust-language button[aria-pressed="true"]{background:#0667a5;color:#fff;border-color:#0667a5}
    .gtt-record-form{padding:18px 21px 20px}
    .gtt-cust-intro{font-size:12px;color:#557083;margin:0 0 15px}
    .gtt-record-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}
    .gtt-record-grid label,.gtt-record-notes{display:flex;flex-direction:column;gap:5px;color:#334e61;font-size:12px;font-weight:750}
    .gtt-record-wide{grid-column:1/-1}
    .gtt-record-grid input,.gtt-record-notes textarea{width:100%;min-width:0;border:1px solid #becfdc;border-radius:8px;padding:11px;background:#fff;color:#132d3f;font:500 14px -apple-system,BlinkMacSystemFont,Arial,sans-serif}
    .gtt-record-grid .gtt-plan-help{font-size:11px;line-height:1.4;color:#5d7688;font-weight:500}
    .gtt-record-preview{display:flex;flex-direction:column;gap:7px;background:#f5f9fd;border:1px solid #dce9f3;padding:13px;border-radius:10px;margin:17px 0;font-size:12px;color:#344e60}
    .gtt-record-preview b{font-size:13px;color:#173b55;margin-bottom:2px}
    .gtt-record-notes textarea{resize:vertical}
    .gtt-record-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:16px}
    .gtt-record-actions button{border-radius:9px;font-weight:750;border:1px solid #bdd0e0;padding:10px 13px;cursor:pointer}
    .gtt-cust-secondary{background:#f1f6fa;color:#294c68}
    .gtt-cust-primary{background:#0668a7;color:#fff;border-color:#0668a7!important}
    #gttStandaloneRecordMount{max-width:790px;margin:0 auto 50px;border:1px solid var(--v4-line,#d5e5ec);background:var(--v4-surface,#fff);border-radius:16px;overflow:hidden}
    #gttStandaloneRecordMount .gtt-record-form{padding:22px}
    .gtt-record-form{color:#193d53}.gtt-record-grid input{color-scheme:light}
    .gtt-record-conditions{margin:17px 0 14px;padding:12px 14px;background:#f4f9fd;border:1px solid #dae8f1;border-radius:10px}
    .gtt-record-conditions>strong{display:block;font-size:13px;color:#173b55;margin:0 0 12px}
    .gtt-record-condition{border:0;border-top:1px solid #dbe7f0;padding:10px 0 4px;margin:0;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
    .gtt-record-condition legend{padding:0;color:#334e61;font-size:12px;font-weight:700}
    .gtt-record-condition label{display:inline-flex;gap:6px;align-items:center;font-size:12px;color:#294b60;font-weight:600;cursor:pointer}
    .gtt-record-condition input{width:17px;height:17px;accent-color:#007ac3}
    .gtt-record-value-note,.gtt-record-original{font:500 12px/1.4 -apple-system,BlinkMacSystemFont,Arial,sans-serif;background:#f3f8fc;color:#47647c;border:1px solid #dce9f1;padding:10px 12px;border-radius:8px;margin:12px 0}
    .gtt-record-value-note strong,.gtt-record-original strong{color:#184c6f}
    #gttStandaloneRecordMount .gtt-record-actions button{min-height:44px}
    .gtt-record-grid input:focus-visible,.gtt-record-notes textarea:focus-visible{outline:2px solid #0780c0;outline-offset:2px}
    @media(max-width:440px){.gtt-cust-content,.gtt-record-form{padding:16px}.gtt-cust-device{font-size:21px}.gtt-cust-price strong{font-size:30px}.gtt-cust-language{grid-template-columns:repeat(2,minmax(0,1fr))}.gtt-record-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
