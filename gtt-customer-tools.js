/* Global Trade Tool customer presentation, printable trade worksheet & native Slack sharing.
   No customer uploads or browser storage. Sharing uses the device's native share sheet.
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
    return '';
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
    return {date:recordDate(),accountHolder:'',tradePhone:'',device:ctx.tradeDevice?[ctx.tradeDevice.brand,ctx.tradeDevice.model].filter(Boolean).join(' '):'',storage:ctx.tradeStorage||'',imei:'',
      plan:s?tradeRecordPlan(s):'',power:cond.power,lock:cond.lock,cracks:cond.cracks,
      promo:s&&['promo','nextup_promo'].includes(s.r.state)&&Number.isFinite(Number(s.r.credit))?String(s.r.credit):'',
      rep:'',notes:'',newPhone:s?.deviceLabel||''};
  }
  function conditionRadios(name,value,question){
    const selected=value===true?'yes':value===false?'no':'';
    const id='gttRecCondition'+name;
    return `<div class="gtt-record-condition" role="group" aria-labelledby="${id}">
      <span id="${id}" class="gtt-record-condition-title">${safe(question)}</span>
      <div class="gtt-record-choices">
        <label><input type="radio" name="${name}" value="yes" ${selected==='yes'?'checked':''}><span>Yes</span></label>
        <label><input type="radio" name="${name}" value="no" ${selected==='no'?'checked':''}><span>No</span></label>
        <label class="gtt-record-skip"><input type="radio" name="${name}" value="" ${selected===''?'checked':''}><span>Blank</span></label>
      </div>
    </div>`;
  }
  function recordSearchField(name,label,value,hint,standalone,wide=false){
    const suffix=standalone?'Standalone':'Quote';
    const id='gttRec'+name+suffix;
    return `<div class="gtt-record-field${wide?' gtt-record-wide':''}">
      <label for="${id}">${safe(label)}</label>
      <div class="gtt-record-combobox" data-record-combo="${name}">
        <input id="${id}" name="${name}" maxlength="150" value="${safe(value)}" autocomplete="off" spellcheck="false"
          placeholder="${name==='device'?'Search or type any phone':name==='newPhone'?'Search or enter purchased phone':name==='plan'?'Search or enter plan':'e.g. 128 GB'}"
          role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}Menu">
        <div id="${id}Menu" class="gtt-record-suggestions" role="listbox" hidden></div>
      </div>
      ${hint?`<small class="gtt-plan-help">${safe(hint)}</small>`:''}
    </div>`;
  }
  function recordFormHTML(s,standalone,clearBlank=false){
    const f=recordFields(s);
    if(clearBlank)f.date='';
    return `<form class="gtt-record-form ${standalone?'gtt-record-standalone':''}" id="${standalone?'gttRecordStandaloneForm':'gttRecordForm'}" autocomplete="off">
      <div class="gtt-record-topline">
        <div class="gtt-rec-form-intro"><span class="gtt-rec-eyebrow">TRADE-IN WORKSHEET</span><strong>${standalone?'New trade record':'Trade details from quote'}</strong><p>Start with the quote. Add inspection details when available.</p></div>
        <span class="gtt-rec-optional">Fields optional</span>
      </div>
      <section class="gtt-rec-panel gtt-rec-panel-priority" aria-labelledby="gttRecEssentials">
        <div class="gtt-record-section-heading"><h3 id="gttRecEssentials">Customer &amp; quote</h3><span>Start here</span></div>
        <div class="gtt-record-grid gtt-rec-essentials-grid">
          <div class="gtt-record-field"><label for="gttRecAccount">Customer name</label><input id="gttRecAccount" name="accountHolder" maxlength="100" placeholder="First and last name" autocomplete="off"></div>
          <div class="gtt-record-field"><label for="gttRecDate">Purchase / quote date</label><input id="gttRecDate" name="date" type="date" value="${safe(f.date)}"></div>
          <div class="gtt-record-field gtt-rec-promo-field"><label for="gttRecPromo">Promotional credit quoted ($)</label><input id="gttRecPromo" name="promo" inputmode="decimal" maxlength="32" value="${safe(f.promo)}" placeholder="e.g. 1200.00"></div>
          ${recordSearchField('plan','AT&T plan',f.plan,'Search or enter plan',standalone)}
          <div class="gtt-record-field"><label for="gttRecTradePhone">Trade-in phone number</label><input id="gttRecTradePhone" name="tradePhone" type="tel" inputmode="tel" maxlength="22" placeholder="(555) 555-0123" autocomplete="off"></div>
          ${recordSearchField('newPhone','New phone purchased',f.newPhone,'Select from GTT phones or type a model.',standalone)}
        </div>
      </section>
      <section class="gtt-rec-panel gtt-rec-panel-trade" aria-labelledby="gttRecTradeDeviceTitle">
        <div class="gtt-record-section-heading"><h3 id="gttRecTradeDeviceTitle">Phone being traded in</h3><span>Device &amp; value</span></div>
        <div class="gtt-record-grid gtt-rec-device-grid">
          ${recordSearchField('device','Trade-in device',f.device,'Search the device list or type one manually.',standalone,true)}
          ${recordSearchField('storage','Storage / capacity',f.storage,'',standalone)}
          <div class="gtt-record-value-note" data-record-value><span>Reference trade value</span><strong>${s&&recordCurrencyValue(s.c.value)!==null?money(s.c.value):'Not verified'}</strong><small>Estimated from the device catalog</small></div>
        </div>
      </section>
      <section class="gtt-record-conditions" aria-label="Device inspection">
        <div class="gtt-record-section-heading"><h3>Device condition</h3><span>Yes / No / Blank</span></div>
        ${conditionRadios('power',f.power,'Powers on and functions')}
        ${conditionRadios('lock',f.lock,'Find My / Activation Lock off')}
        ${conditionRadios('cracks',f.cracks,'No cracks, chips, or damage')}
      </section>
      <details class="gtt-record-more"><summary>Additional details <span>IMEI, rep &amp; notes</span></summary>
        <div class="gtt-record-grid">
          <div class="gtt-record-field"><label for="gttRecIMEI">Trade-in IMEI</label><input id="gttRecIMEI" name="imei" inputmode="numeric" maxlength="25" placeholder="Only if available" autocomplete="off"></div>
          <div class="gtt-record-field"><label for="gttRecRep">Rep / initials</label><input id="gttRecRep" name="rep" maxlength="60" placeholder="Rep" autocomplete="off"></div>
          <div class="gtt-record-field gtt-record-wide"><label for="gttRecNotes">Additional notes</label><textarea id="gttRecNotes" name="notes" maxlength="350" rows="2" placeholder="Prior quote details or device observations"></textarea></div>
        </div>
      </details>
      <div class="gtt-record-actions">
        <button type="button" class="gtt-cust-secondary" data-record-copy>Copy</button>
        <button type="button" class="gtt-cust-primary gtt-record-slack" data-record-slack aria-label="Share record to a Slack DM or group">Share</button>
        <button type="submit" class="gtt-cust-secondary" data-record-print>Print</button>
        <button type="button" class="gtt-record-clear" data-record-reset>Clear Form</button>
      </div>
      <div class="gtt-record-share-help" data-record-share-help hidden aria-live="polite"><p>Share unavailable? Use Copy, then paste in the Slack conversation you choose.</p></div>
      <small class="gtt-record-share-status" data-record-share-status role="status" aria-live="polite"></small>
      <p class="gtt-record-privacy">Your entries stay here until you clear them or close the page. Sharing may retain a copy in Slack.</p>
    </form>`;
  }
  function populateRecordCatalog(form){
    if(!form?.isConnected)return;
    const device=form.elements.namedItem('device'),storage=form.elements.namedItem('storage');
    const deviceChoices=()=>[...new Set(tradeRows().map(r=>[r.brand,r.model].join(' ').trim()))].filter(Boolean).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    const newPhoneChoices=()=>{
      try {return [...new Set((window.GTTQuote?.phones?.()||[]).map(p=>[p.name,p.storage].filter(Boolean).join(' ').trim()))].filter(Boolean).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));}
      catch(_){return [];}
    };
    const plans=()=>[...new Set(planRows().map(r=>r.name))].filter(Boolean).sort((a,b)=>a.localeCompare(b));
    function storageChoices(){return [...new Set(tradeRows().filter(r=>normRecord(r.brand+' '+r.model)===normRecord(device.value)).map(r=>r.storage).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));}
    function applyStorage(){
      const rows=tradeRows().filter(r=>normRecord(r.brand+' '+r.model)===normRecord(device.value));
      const row=rows.find(r=>normRecord(r.storage)===normRecord(storage.value));
      const estimated=row?recordCurrencyValue(row.value):rows.length===1?recordCurrencyValue(rows[0].value):null;
      const val=form.querySelector('[data-record-value] strong');
      if(val)val.textContent=estimated===null?'Not verified':money(estimated);
    }
    // Native <datalist> menus are rendered by the browser and can be detached
    // from the input on iPads. Use in-form anchored, scrollable menus instead.
    for(const [name,getChoices] of [['device',deviceChoices],['newPhone',newPhoneChoices],['storage',storageChoices],['plan',plans]]){
      const input=form.elements.namedItem(name);
      const wrap=input.closest('.gtt-record-combobox'),menu=wrap?.querySelector('.gtt-record-suggestions');
      if(!menu||wrap.dataset.bound==='yes')continue;
      wrap.dataset.bound='yes';
      function hide(){menu.hidden=true;menu.replaceChildren();input.setAttribute('aria-expanded','false');}
      function show(){
        const search=normRecord(input.value);
        const choices=getChoices().filter(x=>!search||normRecord(x).includes(search)).slice(0,8);
        menu.replaceChildren();
        if(!choices.length){hide();return;}
        for(const choice of choices){
          const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.className='gtt-record-option';b.textContent=choice;
          b.addEventListener('pointerdown',e=>e.preventDefault());
          b.addEventListener('click',()=>{const changed=input.value!==choice;input.value=choice;hide();if(changed)input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();hide();});
          menu.appendChild(b);
        }
        menu.hidden=false;input.setAttribute('aria-expanded','true');
      }
      input.addEventListener('focus',show);
      input.addEventListener('input',show);
      input.addEventListener('blur',()=>setTimeout(()=>{if(document.activeElement!==input)hide();},120));
      input.addEventListener('keydown',e=>{
        if(e.key==='Escape'){hide();return;}
        if(e.key==='ArrowDown'&&!menu.hidden){e.preventDefault();menu.querySelector('button')?.focus();}
      });
      menu.addEventListener('keydown',e=>{
        if(e.key==='Escape'){hide();input.focus();}
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){
          e.preventDefault();const all=[...menu.querySelectorAll('button')];const i=all.indexOf(document.activeElement);all[(i+(e.key==='ArrowDown'?1:-1)+all.length)%all.length]?.focus();
        }
      });
    }
    if(!form.dataset.recordCatalogBound){
      device.addEventListener('input',()=>{storage.value='';applyStorage();});
      storage.addEventListener('input',applyStorage);
      form.dataset.recordCatalogBound='yes';
    }
    applyStorage();
  }
  function mountRecordForm(target,s,standalone=false,clearBlank=false){
    if(!target)return;
    target.innerHTML=recordFormHTML(s,standalone,clearBlank);
    const form=target.querySelector('form');
    form.addEventListener('submit',event=>{event.preventDefault();printTradeRecord(form,s);});
    form.querySelector('[data-record-slack]').addEventListener('click',()=>shareTradeRecord(form,s));
    form.querySelector('[data-record-copy]').addEventListener('click',()=>copyTradeRecord(form,s));
    form.querySelector('[data-record-reset]').addEventListener('click',()=>{
      if(window.confirm('Clear this trade-in record? Entered details cannot be recovered.')){
        // An explicit clear starts a truly blank record, including the date.
        mountRecordForm(target,null,standalone,true);
      }
    });
    populateRecordCatalog(form);
    window.GTTQuote?.ready?.then(()=>{if(form.isConnected)populateRecordCatalog(form);}).catch(()=>{});
  }
  function openTradeRecord(){
    const s=quoteSnapshot();
    if(!s||!s.c.tradeDevice||s.c.noTrade)return;
    const d=$('gttTradeRecordDialog');
    // Preserve the in-progress draft even if the dialog is closed and reopened.
    // Clearing or refreshing the page are the only ways to discard the draft.
    if(!d.querySelector('form')){
      d.innerHTML='<div class="gtt-cust-head"><span>Trade-In Inspection Record</span><button class="gtt-cust-x" type="button" data-cust-close aria-label="Close">×</button></div><div id="gttQuoteRecordMount"></div>';
      mountRecordForm($('gttQuoteRecordMount'),s);
      d.querySelector('[data-cust-close]').onclick=()=>d.close();
    }
    d.showModal();
  }
  function readTradeRecord(form,s,blankCopy=false){
    const values=new FormData(form);
    const input=(name)=>blankCopy?'':String(values.get(name)||'').trim();
    const phoneRaw=input('tradePhone');
    const tradePhone=phoneRaw?(usPhone(phoneRaw)||phoneRaw):'';
    const promoRaw=input('promo').replace(/[$,]/g,'');
    const promoNum=Number(promoRaw);
    const promo=promoRaw&&Number.isFinite(promoNum)&&promoNum>=0?money(promoNum):input('promo');
    const device=input('device'),storage=input('storage'),plan=input('plan'),date=input('date');
    const dateObj=date?new Date(date+'T12:00:00Z'):null;
    const dateLabel=dateObj&&!Number.isNaN(dateObj.valueOf())?dateObj.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}):date;
    const account=input('accountHolder'),imei=input('imei');
    const row=tradeRows().find(r=>normRecord(r.brand+' '+r.model)===normRecord(device)&&normRecord(r.storage)===normRecord(storage));
    const sameTrade=!blankCopy&&!!s?.c?.tradeDevice&&normRecord(s.c.tradeDevice.brand+' '+s.c.tradeDevice.model)===normRecord(device)&&normRecord(s.c.tradeStorage)===normRecord(storage);
    const val=blankCopy?null:sameTrade?recordCurrencyValue(s.c.value):(row?recordCurrencyValue(row.value):null);
    const report=[
      ['Purchase / quote date',dateLabel],['Account holder name',account],['Trade-in phone number',tradePhone],
      ['Phone being traded in',[device,storage].filter(Boolean).join(' · ')],['IMEI',imei],['AT&T plan',plan],
      ['Powers on and functions',conditionText(input('power')),'condition'],
      ['Activation Lock / Find My off',conditionText(input('lock')),'condition'],
      ['Free of cracks, chips and damage',conditionText(input('cracks')),'condition'],
      ['Promotional credit quoted',promo?(promo+' (amount quoted; eligibility not guaranteed)'):''],
      ['Estimated trade-in value',val===null?'':money(val)],
      ['Rep / initials',input('rep')],
      ['New phone on original quote',input('newPhone')],
      ['Notes',input('notes')]
    ];
    return {account, report};
  }
  function tradeRecordLastName(fullName){
    const name=String(fullName||'').trim().replace(/\s+/g,' ');
    if(!name)return '';
    // Handles "Last, First" and skips generational suffixes where present.
    if(name.includes(','))return name.split(',')[0].trim();
    const words=name.split(' ');
    while(words.length>1 && /^(?:jr\.?|sr\.?|ii|iii|iv|v)$/i.test(words[words.length-1]))words.pop();
    return (words[words.length-1]||'').replace(/\.$/,'');
  }
  function tradeRecordMessage(form,s){
    const {account,report}=readTradeRecord(form,s);
    const item=i=>String(report[i]?.[1]||'').trim();
    const subject=tradeRecordLastName(account)||'Trade-In Record';
    // Seven short lines in a fixed order. Blank fields never prevent sharing;
    // use a dash so the recipient can see exactly what is still missing.
    const date=item(0).replace(/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})$/,(_,month,day,year)=>{
      const n=['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(month)+1;
      return n+'/'+day+'/'+year;
    });
    const quoted=item(9).replace(/\s*\(amount quoted; eligibility not guaranteed\)$/i,'');
    const trade=[item(3),item(2)].filter(Boolean).join(' · ');
    const condition=[['Power',item(6)],['Find My off',item(7)],['Damage-free',item(8)]]
      .filter(([,answer])=>answer)
      .map(([label,answer])=>label+' '+(answer==='Yes'?'✓':answer==='No'?'✗':answer));
    const field=(label,value)=>label+': '+(value||'—');
    const body=[
      'TRADE-IN RECORD',
      field('Customer name',account),
      field('Date',date),
      field('Quoted price',quoted),
      field('Plan',item(5)),
      field('Trade phone',trade),
      field('Condition',condition.join(' · ')),
      field('New phone',item(12))
    ].join('\n');
    return {subject,body};
  }
  function slackShareText(form,s){return tradeRecordMessage(form,s).body;}
  function shareStatus(form,message){
    const output=form.querySelector('[data-record-share-status]');
    if(output)output.textContent=message;
  }
  function shareFallback(form,message){
    const area=form.querySelector('[data-record-share-help]');
    if(area)area.hidden=false;
    shareStatus(form,message||'Copy the record, open Slack, and paste it into the DM or group of your choice.');
  }
  async function shareTradeRecord(form,s){
    // Call Web Share directly inside the click callback: iOS requires a user gesture.
    // Sharing happens on the device; no customer information goes to a GTT endpoint.
    const {subject,body:text}=tradeRecordMessage(form,s);
    const area=form.querySelector('[data-record-share-help]');
    if(area)area.hidden=true;
    shareStatus(form,'');
    if(typeof navigator.share!=='function'){
      shareFallback(form,'Native sharing is not available here. Copy the record, then paste it into a Slack DM or group.');
      return;
    }
    try {
      await navigator.share({title:'Trade-In Record — '+subject,text});
      // The OS reports handoff, not confirmation that a Slack message was sent.
      shareStatus(form,'Share menu closed. Confirm the record appears in the intended Slack DM or group.');
    } catch(error) {
      if(error?.name==='AbortError'){
        // Cancelling the share sheet is not a send failure. Keep the form intact.
        shareFallback(form,'Sharing was cancelled. You can try again or copy the record for Slack.');
      } else {
        shareFallback(form,'Sharing was unavailable. Copy the record, open Slack, and paste it into the DM or group.');
      }
    }
  }
  async function copyTradeRecord(form,s){
    const text=slackShareText(form,s);
    if(navigator.clipboard?.writeText){
      try {
        await navigator.clipboard.writeText(text);
        shareStatus(form,'Record copied. Open Slack, choose a DM or group, paste, and tap Send.');
        return;
      } catch(_){ /* Some devices deny clipboard writes. Offer a manual select/copy fallback. */ }
    }
    const area=form.querySelector('[data-record-share-help]');
    if(area && !area.querySelector('[data-record-copy-text]')){
      const fallback=document.createElement('textarea');
      fallback.setAttribute('data-record-copy-text','');
      fallback.setAttribute('aria-label','Select and copy trade-in record');
      fallback.readOnly=true;
      fallback.className='gtt-record-copy-text';
      area.appendChild(fallback);
    }
    const fallback=area?.querySelector('[data-record-copy-text]');
    if(fallback){fallback.value=text;fallback.focus();fallback.select();}
    shareStatus(form,'Select and copy the highlighted text, then paste it into your Slack DM or group.');
  }
  function printTradeRecord(form,s){
    const entries=[...new FormData(form).entries()];
    const fieldsFilled=entries.some(([key,value])=>key!=='date'&&String(value||'').trim());
    const date=form.elements.namedItem('date')?.value||'';
    const blankCopy=!s&&!fieldsFilled&&(!date||date===recordDate());
    const {report}=readTradeRecord(form,s,blankCopy);
    const table=report.map(([key,value,type])=>`<tr><th>${safe(key)}</th><td>${blankCopy&&type==='condition'?'<span class="print-checkbox"></span> Yes&nbsp;&nbsp;&nbsp;<span class="print-checkbox"></span> No':(value?safe(value):'<span class="print-line"></span>')}</td></tr>`).join('');
    // Open synchronously from the user click so iOS/Safari allows printing.
    const page=window.open('','_blank');
    if(!page){alert('Your browser blocked the print window. Allow pop-ups for GTT and tap Print again.');return;}
    page.document.open();
    page.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GTT Trade-In Record</title><style>
      @page{size:letter;margin:.55in}body{font:13px/1.35 -apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#14253a;margin:24px auto;max-width:760px}h1{font-size:23px;color:#075d9b;margin:0 0 3px}.sub{margin:0 0 16px;color:#58718b}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #dbe3eb;padding:8px 10px;text-align:left;vertical-align:top}th{background:#f2f7fc;width:38%;font-weight:700}td{overflow-wrap:anywhere;height:19px}.print-line{display:block;min-height:14px}.print-checkbox{display:inline-block;vertical-align:middle;width:13px;height:13px;border:1px solid #536980;border-radius:2px}.stamp{margin-top:18px;border:2px solid #075d9b;border-radius:9px;padding:12px;text-align:center;font-weight:800;letter-spacing:.01em}.disclaimer{font-size:10px;color:#50667d;margin-top:10px}.controls{display:flex;gap:8px;margin:0 0 22px}.controls button{padding:11px 17px;border:0;border-radius:8px;background:#075d9b;color:#fff;font-weight:bold;cursor:pointer}.controls button:last-child{background:#eaf1f8;color:#123e62}@media print{body{margin:0;max-width:none}.controls{display:none}h1{font-size:23px}th,td{padding:7px 9px}}
      </style></head><body><div class="controls"><button onclick="print()">Print</button><button onclick="close()">Close</button></div><h1>Trade-In Inspection Record</h1><p class="sub">Global Trade Tool · ${blankCopy?'Blank store worksheet':'Internal store worksheet'}</p><table>${table}</table><div class="stamp">FILE IN THE DESIGNATED STORE TRADE-IN RECORDS AREA</div><p class="disclaimer">Internal reference only. Not an official AT&T trade-in receipt, proof of acceptance or guarantee of promotional eligibility. Quoted credits must be verified in AT&T-approved systems. Handle printed customer records according to company policy.</p></body></html>`);
    page.document.close();
    // Printing never clears, closes, or changes the editable record.
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
    // Closing a dialog must never erase an unfinished customer record.
    window.addEventListener('gtt-page-change',event=>{
      const mount=$('gttStandaloneRecordMount');
      // Hidden pages retain their form in memory; only Clear Form or a page reload removes it.
      if(mount&&event.detail?.page==='record'&&!mount.querySelector('form'))mountRecordForm(mount,null,true);
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

    /* Trade-In Record v2: consistent GTT surfaces, no oversized white fields.
       Both standalone and quote-popup record forms share these styles. */
    #v4Record{color:var(--v4-ink)}
    #gttStandaloneRecordMount{max-width:820px;margin:0 auto 60px;background:var(--v4-surface);color:var(--v4-ink);border:1px solid var(--v4-line);border-radius:16px;overflow:visible;box-shadow:0 12px 34px rgba(0,0,0,.07)}
    #gttTradeRecordDialog{max-width:730px;width:min(94vw,730px);background:var(--v4-surface);color:var(--v4-ink);border-color:var(--v4-line)}
    #gttTradeRecordDialog .gtt-cust-head{background:var(--v4-alt);border-color:var(--v4-line);color:var(--v4-ink)}
    #gttTradeRecordDialog .gtt-cust-x{color:var(--v4-muted)}
    .gtt-record-form{--r-surface:var(--v4-surface,#fff);--r-alt:var(--v4-alt,#f6f9fc);--r-text:var(--v4-ink,#17232c);--r-muted:var(--v4-muted,#6c7b86);--r-line:var(--v4-line,#d6e0e7);--r-accent:var(--v4-blue,#0075ae);background:var(--r-surface);color:var(--r-text);padding:23px 25px!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
    .gtt-record-form *{box-sizing:border-box}
    .gtt-record-topline{display:flex;justify-content:space-between;gap:14px;align-items:start;margin:0 0 24px}
    .gtt-record-topline p{margin:0;color:var(--r-muted);line-height:1.5;font-size:12px}
    .gtt-record-topline>span{border:1px solid var(--r-line);border-radius:50px;padding:4px 10px;white-space:nowrap;color:var(--r-accent);font-size:11px;font-weight:700;background:var(--r-alt)}
    .gtt-record-section-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:17px 0 12px}
    .gtt-record-section-heading h3{font-size:15px;font-weight:800;letter-spacing:-.01em;color:var(--r-text);margin:0}
    .gtt-record-section-heading span{font-size:11px;color:var(--r-muted)}
    .gtt-record-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px 16px;align-items:start}
    .gtt-record-field{display:flex;min-width:0;flex-direction:column;gap:6px;position:relative;color:var(--r-text)}
    .gtt-record-field>label{font-size:12px;font-weight:750;color:var(--r-text);line-height:1.3}
    .gtt-record-field>small,.gtt-record-form .gtt-plan-help{color:var(--r-muted)!important;font-size:11px!important;line-height:1.35;font-weight:500}
    .gtt-record-wide{grid-column:1/-1}
    .gtt-record-form .gtt-record-field input,.gtt-record-form .gtt-record-field textarea{
      display:block;width:100%;min-width:0;min-height:44px;border:1px solid var(--r-line);border-radius:10px;background:var(--r-alt);color:var(--r-text);font:500 14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;padding:10px 12px;box-shadow:none;color-scheme:light dark;outline:none}
    .gtt-record-form .gtt-record-field input::placeholder,.gtt-record-form .gtt-record-field textarea::placeholder{color:var(--r-muted);opacity:.75}
    .gtt-record-form .gtt-record-field textarea{resize:vertical;min-height:74px}
    .gtt-record-form .gtt-record-field input:focus,.gtt-record-form .gtt-record-field textarea:focus{border-color:var(--r-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--r-accent) 17%,transparent)}
    .gtt-record-combobox{position:relative;min-width:0}
    .gtt-record-combobox:focus-within{z-index:20}
    .gtt-record-suggestions{position:absolute;left:0;top:calc(100% + 4px);z-index:22;width:100%;max-height:205px;overflow-y:auto;overscroll-behavior:contain;border:1px solid var(--r-line);border-radius:10px;padding:4px;background:var(--r-surface);box-shadow:0 12px 25px #0003}
    .gtt-record-suggestions[hidden]{display:none!important}
    .gtt-record-option{display:block;width:100%;padding:10px 11px;border:0;border-radius:7px;text-align:left;background:transparent;color:var(--r-text);font-size:12px;font-family:inherit;min-height:38px;cursor:pointer}
    .gtt-record-option:hover,.gtt-record-option:focus-visible{background:var(--r-alt);outline:1px solid var(--r-accent)}
    .gtt-record-conditions{margin:22px 0 24px;padding:15px 17px 13px;background:var(--r-alt);border:1px solid var(--r-line);border-radius:12px;color:var(--r-text)}
    .gtt-record-conditions .gtt-record-section-heading{margin:0 0 7px}
    .gtt-record-condition{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;border:0;border-top:1px solid var(--r-line);padding:12px 0 10px;margin:0;min-width:0}
    .gtt-record-condition legend{float:left;width:58%;color:var(--r-text);padding:0;margin:3px 0 0;font-size:12px;line-height:1.35;font-weight:650}
    .gtt-record-choices{display:flex;align-items:center;gap:6px;justify-content:flex-end}
    .gtt-record-choices label{position:relative;display:inline-flex;cursor:pointer;align-items:center;gap:5px;margin:0;padding:6px 9px;border:1px solid var(--r-line);border-radius:8px;font-size:11px;font-weight:650;color:var(--r-muted);background:var(--r-surface);min-height:33px;white-space:nowrap}
    .gtt-record-choices input{width:14px;height:14px;margin:0;accent-color:var(--r-accent)}
    .gtt-record-choices label:has(input:checked){border-color:var(--r-accent);color:var(--r-text);background:color-mix(in srgb,var(--r-accent) 10%,var(--r-surface))}
    .gtt-record-value-note{display:flex;flex-direction:column;justify-content:center;gap:2px;min-height:85px;margin:0;background:var(--r-alt);border:1px solid var(--r-line);border-radius:10px;padding:10px 13px;color:var(--r-muted);font-size:11px}
    .gtt-record-value-note strong{font-size:17px;color:var(--r-text)}
    .gtt-record-value-note small{font-size:10px;color:var(--r-muted);line-height:1.3}
    .gtt-record-original{background:var(--r-alt);color:var(--r-muted);border-color:var(--r-line);margin:13px 0 0}
    .gtt-record-original strong{color:var(--r-text)}
    .gtt-record-new-phone{margin-top:13px}
    .gtt-record-more{margin:22px 0 0;padding:0;border:1px solid var(--r-line);border-radius:11px;background:var(--r-surface)}
    .gtt-record-more>summary{display:flex;justify-content:space-between;gap:10px;align-items:center;cursor:pointer;padding:13px 15px;color:var(--r-text);font-size:12px;font-weight:750;min-height:46px;list-style:none}
    .gtt-record-more>summary::-webkit-details-marker{display:none}
    .gtt-record-more>summary:before{content:'+';font-size:18px;color:var(--r-accent);margin-right:4px}
    .gtt-record-more[open]>summary:before{content:'−'}
    .gtt-record-more>summary span{font-size:11px;color:var(--r-muted);font-weight:500;margin-left:auto}
    .gtt-record-more>.gtt-record-grid{padding:6px 15px 16px}
    .gtt-record-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:9px;margin:21px 0 0}
    .gtt-record-actions button,.gtt-record-actions a{min-height:44px;font-size:12px;font-weight:800;padding:10px 15px;cursor:pointer;border-radius:9px;box-shadow:none}
    .gtt-record-actions a{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-family:inherit;line-height:1.3}
    .gtt-record-actions a:hover{text-decoration:none;filter:brightness(1.05)}
    .gtt-record-actions a:focus-visible{outline:2px solid var(--r-accent);outline-offset:2px}
    .gtt-record-actions .gtt-cust-primary{border:1px solid var(--r-accent)!important;background:var(--r-accent);color:var(--r-surface)}
    .gtt-record-actions .gtt-cust-secondary{border:1px solid var(--r-line);background:var(--r-alt);color:var(--r-text)}
    .gtt-record-actions .gtt-record-email{border-color:var(--r-accent);color:var(--r-accent);background:color-mix(in srgb,var(--r-accent) 9%,var(--r-surface))}
    .gtt-record-actions .gtt-record-clear{margin-left:auto;border:0;background:transparent;color:var(--r-muted)}
    .gtt-record-privacy{color:var(--r-muted);font-size:10px;line-height:1.4;margin:13px 0 0}
    .gtt-record-actions .gtt-record-slack{border:1px solid #668b9c;background:color-mix(in srgb,var(--r-accent) 10%,var(--r-alt));color:var(--r-text)}
    .gtt-record-share-help{border:1px solid var(--r-line);background:var(--r-alt);color:var(--r-text);padding:12px 14px;border-radius:10px;margin-top:12px;font-size:12px}
    .gtt-record-share-help[hidden]{display:none!important}
    .gtt-record-share-help p{font-size:12px;line-height:1.45;color:var(--r-muted);margin:0 0 10px}
    .gtt-record-share-help-actions{display:flex;flex-wrap:wrap;gap:9px}
    .gtt-record-share-help-actions button{font:700 12px/1.3 -apple-system,BlinkMacSystemFont,Arial,sans-serif;min-height:40px;cursor:pointer;border:1px solid var(--r-line);border-radius:8px;padding:8px 12px;background:var(--r-surface);color:var(--r-text)}
    .gtt-record-share-status{display:block;margin-top:10px;font-size:11px;color:var(--r-muted)}
    .gtt-record-share-status:empty{display:none}
    .gtt-record-copy-text{display:block;margin-top:10px;width:100%;min-height:110px;padding:9px;border:1px solid var(--r-line);border-radius:7px;background:var(--r-surface);color:var(--r-text)}
    @media(max-width:650px){.gtt-record-form{padding:17px!important}.gtt-record-grid{gap:11px}.gtt-record-conditions{padding:13px}.gtt-record-condition{grid-template-columns:1fr}.gtt-record-condition legend{float:none;width:100%;margin:0}.gtt-record-choices{justify-content:flex-start}.gtt-record-topline{flex-direction:column;gap:7px}}
    .gtt-record-actions button:not(.gtt-record-clear){flex:1 1 118px;min-width:0}
    .gtt-record-actions .gtt-record-clear{font-size:11px}
    @media(max-width:470px){.gtt-record-grid{grid-template-columns:1fr}.gtt-record-wide{grid-column:auto}.gtt-record-actions button:not(.gtt-record-clear){flex:1 1 90px}.gtt-record-actions .gtt-cust-primary{width:auto}.gtt-record-actions .gtt-record-clear{margin-left:0}.gtt-record-more>summary{align-items:flex-start}}

    /* Mobile-first trade-entry refresh. Deliberately scoped to record forms only. */
    .gtt-record-form{padding:18px 20px 22px!important}
    .gtt-record-topline{align-items:center;margin-bottom:16px;gap:10px}
    .gtt-rec-form-intro{min-width:0;display:flex;flex-direction:column;gap:3px}
    .gtt-rec-eyebrow{font-size:9px;letter-spacing:.12em;font-weight:850;color:var(--r-accent)}
    .gtt-rec-form-intro strong{font-size:18px;line-height:1.2;letter-spacing:-.03em;color:var(--r-text)}
    .gtt-rec-form-intro p{font-size:11px;line-height:1.35;margin:2px 0 0;color:var(--r-muted)}
    .gtt-record-topline>.gtt-rec-optional{font-size:10px;flex:none;padding:5px 9px}
    .gtt-rec-panel{border:1px solid var(--r-line);border-radius:13px;padding:15px 16px;margin:0 0 13px;background:var(--r-surface)}
    .gtt-rec-panel-priority{background:color-mix(in srgb,var(--r-accent) 4%,var(--r-surface));border-color:color-mix(in srgb,var(--r-accent) 23%,var(--r-line))}
    .gtt-rec-panel .gtt-record-section-heading{margin:0 0 13px}
    .gtt-rec-panel .gtt-record-section-heading h3{font-size:14px}
    .gtt-rec-panel .gtt-record-section-heading span{font-size:10px}
    .gtt-record-grid{gap:12px 14px}
    .gtt-record-field{gap:5px}
    .gtt-record-field>label{font-size:12px;font-weight:720}
    .gtt-record-form .gtt-record-field input,.gtt-record-form .gtt-record-field textarea{min-height:45px;padding:10px 12px;border-radius:9px;font-size:15px;background:var(--r-surface)}
    .gtt-record-form .gtt-record-field input:focus{background:var(--r-surface)}
    .gtt-rec-promo-field input{border-color:color-mix(in srgb,var(--r-accent) 42%,var(--r-line))!important;font-weight:750!important;font-size:17px!important}
    .gtt-record-suggestions{max-height:210px}
    .gtt-record-option{min-height:45px;font-size:13px}
    .gtt-rec-device-grid>.gtt-record-wide{grid-column:1/-1}
    .gtt-rec-device-grid .gtt-record-value-note{min-height:45px;padding:8px 12px;border-radius:9px;gap:0;margin:0;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:10px}
    .gtt-rec-device-grid .gtt-record-value-note span{font-size:10px}
    .gtt-rec-device-grid .gtt-record-value-note strong{font-size:15px;grid-column:2;grid-row:1 / span 2}
    .gtt-rec-device-grid .gtt-record-value-note small{font-size:9px;grid-column:1;line-height:1.25}
    .gtt-record-conditions{margin:0 0 13px;padding:12px 16px 4px;background:var(--r-surface);border-radius:13px}
    .gtt-record-conditions .gtt-record-section-heading{margin:0 0 8px}
    .gtt-record-condition{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 0;margin:0;border:0;border-top:1px solid var(--r-line)}
    .gtt-record-condition-title{flex:1;min-width:0;font-size:12px;line-height:1.35;font-weight:700;color:var(--r-text)}
    .gtt-record-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;flex:0 0 242px;align-items:center;justify-content:initial}
    .gtt-record-choices label{display:flex;align-items:center;justify-content:center;min-height:39px;gap:5px;padding:5px;border-radius:8px;font-size:11px}
    .gtt-record-choices input{width:15px;height:15px;flex:none}
    .gtt-record-more{margin:0;border-radius:12px}
    .gtt-record-more>summary{min-height:46px;padding:11px 15px}
    .gtt-record-actions{margin-top:15px;gap:8px}
    .gtt-record-actions button,.gtt-record-actions a{min-height:45px;padding:9px 12px}
    .gtt-record-actions .gtt-tracker-save{min-width:150px;border-radius:9px}
    .gtt-record-actions .gtt-record-clear{margin-left:auto}
    .gtt-record-privacy{margin-top:11px;font-size:10px}
    @media(max-width:700px){
      .gtt-record-form{padding:15px!important}
      .gtt-record-form .gtt-record-field input,.gtt-record-form .gtt-record-field textarea{font-size:16px}
      .gtt-rec-panel{padding:13px;margin-bottom:11px}
      .gtt-record-grid{grid-template-columns:minmax(0,1fr);gap:11px}
      .gtt-record-wide{grid-column:auto}
      .gtt-record-topline{align-items:flex-start}
      .gtt-record-topline>.gtt-rec-optional{margin-top:3px}
      .gtt-rec-device-grid .gtt-record-value-note{min-height:44px}
      .gtt-record-condition{display:flex;flex-direction:column;align-items:stretch;gap:8px;padding:11px 0}
      .gtt-record-condition-title{font-size:12px;flex:none}
      .gtt-record-choices{flex:none;width:100%;gap:7px}
      .gtt-record-choices label{min-height:44px;font-size:12px}
      .gtt-record-conditions{padding:11px 13px 2px}
      .gtt-record-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
      .gtt-record-actions .gtt-tracker-save{grid-column:1/-1;width:100%;min-height:50px}
      .gtt-record-actions button:not(.gtt-record-clear){min-width:0!important;flex:auto}
      .gtt-record-actions .gtt-record-clear{grid-column:1/-1;justify-self:center;margin:0;min-height:38px}
      #gttTradeRecordDialog .gtt-record-actions:not(:has(.gtt-tracker-save)) .gtt-cust-secondary,#gttTradeRecordDialog .gtt-record-actions:not(:has(.gtt-tracker-save)) .gtt-cust-primary{grid-column:auto}
    }
    @media(max-width:380px){
      .gtt-record-topline>.gtt-rec-optional{white-space:normal;max-width:95px;text-align:center}
      .gtt-record-choices label{font-size:11px;padding:4px}
      .gtt-record-actions .gtt-cust-secondary,.gtt-record-actions .gtt-cust-primary{font-size:11px;padding:9px 5px}
    }
  `;
  document.head.appendChild(style);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
