/* Global Trade Tool customer presentation & print-only trade worksheet.
   No external translation API, no network calls, no storage of customer name or IMEI.
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
    selectedLanguage = 'en';
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
      updateCustomerCard();
    }));
  }

  function conditionText(value) {
    if (value === true || value === 'yes') return 'Yes';
    if (value === false || value === 'no') return 'No';
    return 'Not confirmed';
  }
  function openTradeRecord() {
    const s = quoteSnapshot();
    if (!s || !s.c.tradeDevice || s.c.noTrade) return;
    activeContext = s;
    const f = $('gttTradeRecordDialog');
    const hasCredit = ['promo','nextup_promo'].includes(s.r.state);
    f.innerHTML = `
      <div class="gtt-cust-head"><span>🖨️ Trade-in record</span><button class="gtt-cust-x" type="button" data-cust-close aria-label="Close">×</button></div>
      <form class="gtt-record-form" id="gttRecordForm" autocomplete="off">
        <p class="gtt-cust-intro">Print an internal worksheet for the designated store Trade-In Records area. Information is not saved in GTT.</p>
        <div class="gtt-record-grid">
          <label class="gtt-record-wide">Customer name <input name="customer" maxlength="100" required placeholder="Name matching the sale" autocomplete="off"></label>
          <label>Trade-in IMEI <input name="imei" inputmode="numeric" pattern="[0-9]{15}" maxlength="15" minlength="15" required placeholder="15 digits" autocomplete="off"></label>
          <label>Rep name / initials <input name="rep" maxlength="60" required placeholder="Rep" autocomplete="off"></label>
        </div>
        <div class="gtt-record-preview"><b>Auto-filled from completed quote</b>
          <span><strong>Trade-in:</strong> ${safe(s.tradeLabel)}</span>
          <span><strong>Estimated trade value:</strong> ${(s.c.value !== null && s.c.value !== undefined && Number.isFinite(Number(s.c.value))) ? money(s.c.value) : 'Not verified'}</span>
          <span><strong>Condition:</strong> Powers on ${conditionText(s.c.tradeCondition?.power)} · Find My/Activation Lock off ${conditionText(s.c.tradeCondition?.lock)} · No chips/cracks ${conditionText(s.c.tradeCondition?.cracks)}</span>
          <span><strong>New phone:</strong> ${safe(s.deviceLabel)}</span>
          <span><strong>Promotional credit:</strong> ${hasCredit ? money(s.r.credit) : 'Not applicable / confirm offer'}</span>
        </div>
        <label class="gtt-record-notes">Additional inspection notes (optional)<textarea name="notes" maxlength="350" rows="2" placeholder="Visible damage or other observations"></textarea></label>
        <div class="gtt-record-actions"><button type="button" class="gtt-cust-secondary" data-cust-cancel>Cancel</button><button type="submit" class="gtt-cust-primary">Print trade record</button></div>
      </form>`;
    f.querySelector('[data-cust-close]').onclick = () => {f.close();f.replaceChildren();activeContext=null;};
    f.querySelector('[data-cust-cancel]').onclick = () => {f.close();f.replaceChildren();activeContext=null;};
    f.querySelector('form').onsubmit = e => {e.preventDefault();printTradeRecord(s, new FormData(e.currentTarget));};
    f.showModal();
    f.querySelector('[name=customer]').focus();
  }

  function printTradeRecord(s, data) {
    const customer=String(data.get('customer')||'').trim();
    const imei=String(data.get('imei')||'').replace(/\s/g,'');
    const rep=String(data.get('rep')||'').trim();
    const notes=String(data.get('notes')||'').trim();
    if (!customer || !rep || !/^\d{15}$/.test(imei)) return;
    const page=window.open('','_blank');
    if (!page) { alert('Your browser blocked the print window. Allow pop-ups for GTT and tap Print again.'); return; }
    const printableDate=new Date().toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'});
    const hasCredit=['promo','nextup_promo'].includes(s.r.state);
    const rows=[
      ['Customer name',customer], ['Rep / initials',rep], ['Inspection date (Eastern)',printableDate],
      ['Trade-in phone',s.tradeLabel],['IMEI',imei],
      ['Powers on and off',conditionText(s.c.tradeCondition?.power)],
      ['Activation Lock / Find My off',conditionText(s.c.tradeCondition?.lock)],
      ['Free of chips / cracks',conditionText(s.c.tradeCondition?.cracks)],
      ['Estimated trade value',(s.c.value !== null && s.c.value !== undefined && Number.isFinite(Number(s.c.value))) ? money(s.c.value) : 'Not verified'],
      ['New phone',s.deviceLabel],
      ['Estimated promo bill credits',hasCredit ? money(s.r.credit)+' over 36 months (subject to eligibility)' : 'Not applicable / confirm offer'],
      ['Notes',notes||'—']
    ];
    const table=rows.map(([k,v])=>`<tr><th>${safe(k)}</th><td>${safe(v)}</td></tr>`).join('');
    page.document.open();
    page.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>GTT Trade-In Record</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      @page{size:letter;margin:.55in}body{font:14px/1.4 -apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#14253a;margin:24px auto;max-width:750px}h1{font-size:24px;margin:0 0 3px;color:#075d9b}.sub{margin:0 0 20px;color:#58718b}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #dbe3eb;padding:9px 10px;text-align:left;vertical-align:top}th{background:#f2f7fc;width:37%;font-weight:700}td{overflow-wrap:anywhere}.stamp{margin-top:23px;border:2px solid #075d9b;border-radius:9px;padding:15px;text-align:center;font-weight:800;letter-spacing:.02em}.disclaimer{font-size:11px;color:#50667d;margin-top:13px}.controls{display:flex;gap:8px;margin:0 0 22px}.controls button{padding:11px 17px;border:0;border-radius:8px;background:#075d9b;color:white;font-weight:bold;cursor:pointer}.controls button:last-child{background:#eaf1f8;color:#123e62}@media print{body{margin:0;max-width:none}.controls{display:none}h1{font-size:23px}th,td{padding:7px 9px}}
    </style></head><body><div class="controls"><button onclick="print()">Print</button><button onclick="close()">Close</button></div><h1>Trade-In Inspection Record</h1><p class="sub">Global Trade Tool · Internal store worksheet</p><table>${table}</table><div class="stamp">FILE IN THE DESIGNATED STORE TRADE-IN RECORDS AREA</div><p class="disclaimer">Internal reference only. This document is not an official AT&T trade-in receipt, proof of acceptance, or guarantee of promotional eligibility. Verify all final values and conditions in approved systems. Store and dispose of printed records according to company policy.</p></body></html>`);
    page.document.close();
    // Form values are only used to render the print window. Clear GTT immediately afterward.
    $('gttTradeRecordDialog').close();
    $('gttTradeRecordDialog').replaceChildren();
    activeContext=null;
  }

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
    createDialog('gttTradeRecordDialog','Trade-in record printing');
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
    .gtt-record-preview{display:flex;flex-direction:column;gap:7px;background:#f5f9fd;border:1px solid #dce9f3;padding:13px;border-radius:10px;margin:17px 0;font-size:12px;color:#344e60}
    .gtt-record-preview b{font-size:13px;color:#173b55;margin-bottom:2px}
    .gtt-record-notes textarea{resize:vertical}
    .gtt-record-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:16px}
    .gtt-record-actions button{border-radius:9px;font-weight:750;border:1px solid #bdd0e0;padding:10px 13px;cursor:pointer}
    .gtt-cust-secondary{background:#f1f6fa;color:#294c68}
    .gtt-cust-primary{background:#0668a7;color:#fff;border-color:#0668a7!important}
    @media(max-width:440px){.gtt-cust-content,.gtt-record-form{padding:16px}.gtt-cust-device{font-size:21px}.gtt-cust-price strong{font-size:30px}.gtt-cust-language{grid-template-columns:repeat(2,minmax(0,1fr))}.gtt-record-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
