/* Global Trade Tool — 40-day store Trade Tracker.
   UI-only integration: sensitive records are not stored in this browser.
   Public lists are masked on the Supabase Edge Function, not in DOM code.
   Production use with real customer PII requires staff authentication. */
(() => {
'use strict';
const API='https://uwomiirfvllcafijmkmk.supabase.co/functions/v1/gtt-trade-tracker';
const STORES=['Bordentown','Browns Mills','Cinnaminson','East Windsor','Hamilton','Lawrenceville','Medford','Monmouth','Mount Laurel','Quaker Bridge','Skillman'];
// Remember only the chosen store on this browser. Never store customer details.
const STORE_PREF_KEY='gtt-trade-preferred-store-v1';
function rememberedStore(){try{const v=window.localStorage.getItem(STORE_PREF_KEY);return STORES.includes(v)?v:'';}catch(_){return '';}}
function rememberStore(store){if(!STORES.includes(store))return;try{window.localStorage.setItem(STORE_PREF_KEY,store);}catch(_){/* Storage can be disabled. The current selection still works. */}}

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency=v=>v===null||v===undefined||v===''?'—':Number(v).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const shortDate=s=>s?new Date(s.length===10?s+'T12:00:00':s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—';
const state={mode:'create',store:rememberedStore(),filter:'pending',query:'',rows:[],token:null,unlocked:false,loading:false,savedForm:null};
let root,createPane,listPane,storeInput,listContent,listStatus,lockButton;
async function api(action,params={}){
 const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...params}),cache:'no-store'});
 let result;try{result=await response.json();}catch(_){throw Error('Tracker connection unavailable. Try again.');}
 if(!response.ok)throw Error(result?.error||'Could not complete your request');
 return result;
}
function setMessage(value,isError=false){const el=$('gttTrackerNotice');if(!el)return;el.textContent=value;el.classList.toggle('is-error',isError);el.hidden=!value;}
function setListStatus(msg,isError=false){if(!listStatus)return;listStatus.textContent=msg;listStatus.classList.toggle('is-error',isError);}
function getFormData(form){
 const v=new FormData(form),get=k=>String(v.get(k)||'').trim();
 const cv=k=>get(k)==='yes'?true:get(k)==='no'?false:null;
 const val=form.querySelector('[data-record-value] strong')?.textContent?.trim()||'';
 return {store:state.store,record_date:get('date'),customer_name:get('accountHolder'),trade_phone:get('tradePhone'),imei:get('imei'),trade_device:get('device'),storage:get('storage'),plan:get('plan'),promo_quoted:get('promo'),trade_value:/^\$[\d,]+(\.\d{2})?$/.test(val)?val.replace(/[$,]/g,''):null,new_phone:get('newPhone'),power_ok:cv('power'),lock_off:cv('lock'),damage_free:cv('cracks'),rep:get('rep'),notes:get('notes')};
}
function injectSave(form,quote=false){
 if(!form||form.dataset.trackerSaveBound)return;
 form.dataset.trackerSaveBound='true';
 const actions=form.querySelector('.gtt-record-actions');if(!actions)return;
 const btn=document.createElement('button');btn.type='button';btn.className='gtt-tracker-save';btn.textContent='Save Trade';btn.dataset.trackerSave='';
 actions.prepend(btn);
 const info=document.createElement('div');info.className='gtt-tracker-save-status';info.setAttribute('role','status');actions.after(info);
 let storeSelect=null;
 if(quote){
   const field=document.createElement('div');field.className='gtt-tracker-quote-store';
   const label=document.createElement('label');label.textContent='Store required to save';label.htmlFor='gttQuoteRecordStore';
   storeSelect=document.createElement('select');storeSelect.id='gttQuoteRecordStore';
   storeSelect.innerHTML='<option value="">Choose store…</option>'+STORES.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
   storeSelect.value=state.store;
   storeSelect.required=true;
   const tip=document.createElement('small');
   tip.textContent='Choose the store first. GTT remembers your choice on this browser.';
   field.append(label,storeSelect,tip);
   // From Full Quote, store choice must be made before entering, printing or sharing a record.
   form.prepend(field);
   const syncQuoteGate=()=>{
     form.classList.toggle('gtt-trk-quote-awaiting-store',!storeSelect.value);
     label.textContent=storeSelect.value?'Store · Required — '+storeSelect.value:'Store · Required to create a trade';
   };
   storeSelect.addEventListener('change',()=>{
     const value=STORES.includes(storeSelect.value)?storeSelect.value:'';
     state.store=value;
     if(storeInput)storeInput.value=value;
     if(value)rememberStore(value);
     updateStoreGate();
     syncQuoteGate();
     if(state.mode==='list')refresh();
   });
   syncQuoteGate();
 }
 const reset=form.querySelector('[data-record-reset]');reset?.addEventListener('click',()=>{form.dataset.trackerSaved='';}, {capture:true});
 btn.addEventListener('click',async()=>{
   const selected=quote?storeSelect?.value:state.store;
   if(!selected){info.textContent='Choose a store before saving.';info.classList.add('is-error');(quote?storeSelect:storeInput)?.focus();return;}
   if(form.dataset.trackerSaved==='true'){info.textContent='Already saved. Use Clear Form to start another record.';return;}
   const data=getFormData(form);data.store=selected;
   info.classList.remove('is-error');info.textContent='Saving…';btn.disabled=true;
   try{await api('create',{record:data});form.dataset.trackerSaved='true';info.textContent=`Saved to ${selected}. The record is available in View All.`;btn.textContent='Saved ✓';setMessage('Trade saved. Open View All to find and update it.');
     const another=document.createElement('button');
     another.type='button';
     another.textContent='Create another for this customer';
     another.onclick=()=>{
       if(quote && storeSelect.value!==selected){storeSelect.value=selected;storeSelect.dispatchEvent(new Event('change'));}
       if(!quote){state.store=selected;storeInput.value=selected;rememberStore(selected);updateStoreGate();}
       const next=window.GTTRecordActions.startAnother(form.parentElement,!quote,data);
       injectSave(next,quote);
       next.elements.tradePhone.focus();
     };
     actions.append(another);}
   catch(e){info.textContent=e.message;info.classList.add('is-error');btn.disabled=false;}
 });
}
function watchForms(){
 const mount=$('gttStandaloneRecordMount');
 if(mount){const attach=()=>injectSave(mount.querySelector('form'));
   new MutationObserver(attach).observe(mount,{childList:true,subtree:false});attach();}
 const quote=$('gttTradeRecordDialog');
 if(quote){const attach=()=>injectSave(quote.querySelector('form'),true);
   new MutationObserver(attach).observe(quote,{childList:true,subtree:true});attach();}
}
function updateStoreGate(){
 const creating=state.mode==='create';
 const selected=!!state.store;
 const mount=$('gttStandaloneRecordMount');
 let gate=$('gttTrackerStoreGate');
 if(!gate){
   gate=document.createElement('div');gate.id='gttTrackerStoreGate';gate.className='gtt-trk-store-gate';
   gate.innerHTML='<strong>Choose a store to start a trade</strong><p>Store selection is required before you can fill out and save a trade record.</p><button type="button">Select Store ↑</button>';
   gate.querySelector('button').addEventListener('click',()=>storeInput.focus());
   createPane.prepend(gate);
 }
 let banner=$('gttTrackerStoreSelected');
 if(!banner){
   banner=document.createElement('div');banner.id='gttTrackerStoreSelected';banner.className='gtt-trk-store-selected';
   createPane.insertBefore(banner,mount);
 }
 gate.hidden=!creating||selected;
 banner.hidden=!creating||!selected;
 banner.textContent=selected?'Creating trade for '+state.store:'';
 if(mount)mount.hidden=creating&&!selected;
 const storeLabel=storeInput.closest('.gtt-trk-store-row')?.querySelector('label');
 if(storeLabel)storeLabel.textContent=creating?'Store · Required for new trades':'Store · Optional filter';
 storeInput.options[0].textContent=creating?'Choose a store to create trade…':'All stores';
 storeInput.required=creating;
 storeInput.setAttribute('aria-required',String(creating));
 storeInput.classList.toggle('gtt-trk-store-missing',creating&&!selected);
}
function switchMode(next){state.mode=next;const isList=next==='list';createPane.hidden=isList;listPane.hidden=!isList;
 $('gttTrackerCreateTab').setAttribute('aria-pressed',String(!isList));$('gttTrackerListTab').setAttribute('aria-pressed',String(isList));setMessage('');
 updateStoreGate();
 if(isList)refresh();else {injectSave($('gttStandaloneRecordMount')?.querySelector('form'));}
}
async function refresh(){
 if(state.loading)return;state.loading=true;listContent.innerHTML='';setListStatus('Loading trade records…');
 try{let res=await api('list',{store:state.store||undefined,token:state.token});
   state.rows=res.rows||[];state.unlocked=!!res.unlocked;
   if(state.token&&!state.unlocked)state.token=null;
   lockButton.textContent=state.unlocked?'🔒 Lock details':'🔓 Unlock details';
   renderList();setListStatus('');
 }catch(e){setListStatus(e.message,true);}
 finally{state.loading=false;}
}
// Use calendar days in the store's NJ timezone, not completed 24-hour periods.
// The original timer starts on purchase date; explicit resets start a fresh clock.
function njCalendarDate(value){
 if(typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value))return value;
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return '';
 const parts=new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const part=k=>parts.find(p=>p.type===k)?.value||'';
 return `${part('year')}-${part('month')}-${part('day')}`;
}
function ageOf(row){
 const start=njCalendarDate(row.timer_reset_at||row.record_date||row.created_at);
 const today=njCalendarDate(new Date());
 const startTime=Date.parse(start+'T00:00:00Z'),todayTime=Date.parse(today+'T00:00:00Z');
 return Number.isFinite(startTime)&&Number.isFinite(todayTime)?Math.max(0,Math.round((todayTime-startTime)/86400000)):0;
}
function labelOf(row){
 if(row.received)return 'Received';
 const age=ageOf(row),remaining=30-age;
 const timing=remaining>0?remaining+' day'+(remaining===1?'':'s')+' left':remaining===0?'Due today':(-remaining)+' day'+(remaining===-1?'':'s')+' late';
 return (age>=30?'Urgent · ':age>=22?'Follow up · ':age>=15?'Attention · ':'Pending · ')+timing;
}
function gradeOf(row){if(row.received)return 'received';const age=ageOf(row);return age>=30?'red':age>=22?'orange':age>=15?'yellow':'normal';}
function conditionOf(row){const vals=[['Power',row.power_ok],['Find My off',row.lock_off],['Damage-free',row.damage_free]];return vals.map(([n,v])=>`${n} ${v===true?'✓':v===false?'✕':'—'}`).join(' · ');}
function renderList(){
 const all=state.rows;
 const counts={pending:all.filter(r=>!r.received).length,received:all.filter(r=>r.received).length,all:all.length};
 for(const k of ['pending','received','all']){const btn=$('gttTrackerFilter'+k[0].toUpperCase()+k.slice(1));if(btn){btn.textContent=(k==='all'?'All':k==='pending'?'Pending':'Received')+' '+counts[k];btn.setAttribute('aria-pressed',String(state.filter===k));}}
 let rows=all.filter(r=>state.filter==='all'||(state.filter==='received'?r.received:!r.received));
 const query=state.query.toLowerCase().trim();if(query)rows=rows.filter(r=>[r.customer_name,r.trade_phone,r.imei,r.store,r.trade_device,r.storage,r.plan,r.new_phone,r.rep].some(v=>String(v||'').toLowerCase().includes(query)));
 if(!rows.length){listContent.innerHTML='<div class="gtt-trk-empty">No matching trades in this list.</div>';return;}
 listContent.innerHTML=rows.map(r=>{
  const grade=gradeOf(r),age=ageOf(r);
  return `<article class="gtt-trk-card ${grade}" data-tracker-id="${esc(r.id)}">
  <div class="gtt-trk-card-main"><div class="gtt-trk-customer">${esc(r.customer_name||'Unnamed record')}<small>${esc(r.store)} · ${esc(shortDate(r.record_date))}</small></div>
  <div class="gtt-trk-promo">${currency(r.promo_quoted)}<small>Quoted</small></div></div>
  <div class="gtt-trk-card-meta"><span>${esc(r.trade_device||'Trade phone not entered')}${r.storage?' · '+esc(r.storage):''}</span><span>${esc(r.plan||'Plan not entered')}</span></div>
  <div class="gtt-trk-card-bottom"><span class="gtt-trk-status">${esc(labelOf(r))}</span><span class="gtt-trk-age">Day ${age} of 40</span><button type="button" class="gtt-trk-details" data-tracker-details="${esc(r.id)}">Details ▾</button></div>
  <div class="gtt-trk-card-expanded" hidden data-tracker-expanded="${esc(r.id)}">
    <div class="gtt-trk-detail-grid"><span>Trade number</span><b>${esc(r.trade_phone||'—')}</b><span>IMEI</span><b>${esc(r.imei||'—')}</b><span>New phone</span><b>${esc(r.new_phone||'—')}</b><span>Condition</span><b>${esc(conditionOf(r))}</b><span>Rep</span><b>${esc(r.rep||'—')}</b><span>Received on</span><b>${esc(shortDate(r.received_at))}</b>${r.timer_reset_at?`<span>Timer last reset</span><b>${esc(shortDate(r.timer_reset_at))}</b>`:''}${state.unlocked&&r.notes?`<span>Notes</span><b>${esc(r.notes)}</b>`:''}</div>
    <div class="gtt-trk-detail-actions"><label><input type="checkbox" data-tracker-received="${esc(r.id)}" ${r.received?'checked':''}> Trade received</label>
      <div class="gtt-trk-manage-actions">${state.unlocked?`<button type="button" data-saved-action="another">Create another for this customer</button><button type="button" data-saved-action="share">Share</button><button type="button" data-tracker-edit="${esc(r.id)}">Edit record</button><button type="button" class="gtt-trk-delete" data-tracker-delete="${esc(r.id)}" aria-label="Delete this trade record">Delete Trade</button>`:'<button type="button" data-tracker-unlock="yes">Unlock for record actions</button>'}</div></div>
    ${state.unlocked?`<div data-record-share-help hidden><button type="button" data-saved-action="copy">Copy record for Slack</button></div><p data-record-share-status role="status"></p>`:''}
  </div></article>`;
 }).join('');
 listContent.querySelectorAll('[data-tracker-details]').forEach(btn=>btn.addEventListener('click',()=>{
  const target=listContent.querySelector('[data-tracker-expanded="'+btn.dataset.trackerDetails+'"]');if(target){target.hidden=!target.hidden;btn.textContent=target.hidden?'Details ▾':'Details ▴';}}));
 listContent.querySelectorAll('[data-tracker-received]').forEach(el=>el.addEventListener('change',async()=>{
  const isReceived=el.checked;
  if(!isReceived&&!confirm('Move this trade back to Pending and clear its received date?')){el.checked=true;return;}
  el.disabled=true;
  try{await api('receive',{id:el.dataset.trackerReceived,received:isReceived});await refresh();}
  catch(e){alert(e.message);el.checked=!isReceived;el.disabled=false;}
 }));
 listContent.querySelectorAll('[data-saved-action]').forEach(button=>button.onclick=()=>{
  if(!state.unlocked)return showKeypad();
  const card=button.closest('[data-tracker-id]');
  const row=state.rows.find(item=>String(item.id)===card.dataset.trackerId);
  if(!row)return;
  const action=button.dataset.savedAction;
  if(action==='share')return window.GTTRecordActions.shareSaved(card,row);
  if(action==='copy')return window.GTTRecordActions.copySaved(card,row);
  const target=$('gttStandaloneRecordMount');
  const previous=target.querySelector('form');
  if(previous?.querySelector('[data-tracker-save]:disabled') && previous.dataset.trackerSaved!=='true')return;
  if(previous && previous.dataset.trackerSaved!=='true' &&
     Array.from(new FormData(previous)).some(([key,value])=>key!=='date' && String(value).trim()) &&
     !confirm('Replace the unsaved trade form with another trade for this customer?'))return;
  storeInput.value=STORES.includes(row.store)?row.store:(state.store||rememberedStore());
  switchMode('create');
  storeInput.dispatchEvent(new Event('change'));
  const next=window.GTTRecordActions.startAnother(target,true,row);
  injectSave(next);
  if(state.store)next.elements.tradePhone.focus();else storeInput.focus();
 });
 listContent.querySelectorAll('[data-tracker-edit]').forEach(el=>el.addEventListener('click',()=>openEdit(el.dataset.trackerEdit)));
 listContent.querySelectorAll('[data-tracker-delete]').forEach(el=>el.addEventListener('click',async()=>{
  const id=el.dataset.trackerDelete,row=state.rows.find(item=>item.id===id);
  if(!state.unlocked||!state.token||!row){showKeypad();return;}
  const who=row.customer_name||'this trade';
  if(!confirm(`Permanently delete the trade record for ${who}?\n\nThis removes it from every store list and cannot be undone.`))return;
  el.disabled=true;
  const originalText=el.textContent;el.textContent='Deleting…';
  try{await api('delete',{id,token:state.token});await refresh();setListStatus('Trade record permanently deleted.');}
  catch(error){setListStatus(error.message,true);el.textContent=originalText;el.disabled=false;}
 }));
 listContent.querySelectorAll('[data-tracker-unlock]').forEach(el=>el.addEventListener('click',showKeypad));
}
function showKeypad(){const d=$('gttTrackerPinDialog');d.showModal();const display=$('gttTrackerPinDots'),message=$('gttTrackerPinMessage');let pin='';message.textContent='';
 const update=()=>{display.textContent='●'.repeat(pin.length)+'○'.repeat(4-pin.length);};
 const submit=async()=>{if(pin.length!==4)return;message.textContent='Checking…';try{const result=await api('unlock',{pin});state.token=result.token;d.close();await refresh();}catch(e){message.textContent=e.message;pin='';update();}};
 d.querySelectorAll('[data-tracker-key]').forEach(b=>b.onclick=()=>{const key=b.dataset.trackerKey;if(key==='delete')pin=pin.slice(0,-1);else if(pin.length<4)pin+=key;update();if(pin.length===4)submit();});
 update();}
async function lock(){const token=state.token;state.token=null;state.unlocked=false;if(token)api('lock',{token}).catch(()=>{});await refresh();}
const EDIT_FIELDS=[['record_date','Date','date'],['customer_name','Account holder','text'],['trade_phone','Trade-in phone number','tel'],['trade_device','Trade-in device','text'],['storage','Storage','text'],['plan','Plan','text'],['promo_quoted','Promotional credit quoted','number'],['new_phone','New phone','text'],['imei','IMEI','text'],['rep','Rep','text'],['notes','Notes','textarea']];
function openEdit(id){if(!state.unlocked)return showKeypad();const row=state.rows.find(r=>r.id===id);if(!row)return;
 const dlg=$('gttTrackerEditDialog');const form=$('gttTrackerEditForm');
 form.innerHTML='<div class="gtt-trk-edit-grid">'+EDIT_FIELDS.map(([key,label,type])=>`<label class="gtt-trk-edit-field">${esc(label)}${type==='textarea'?`<textarea name="${key}" rows="3">${esc(row[key]??'')}</textarea>`:`<input name="${key}" type="${type}" value="${esc(row[key]??'')}" ${type==='number'?'min="0" step="0.01"':''}>`}</label>`).join('')+'</div><fieldset class="gtt-trk-edit-condition"><legend>Condition</legend>'+[['power_ok','Powers on'],['lock_off','Find My off'],['damage_free','No damage']].map(([k,label])=>`<label>${esc(label)}<select name="${k}"><option value="">Blank</option><option value="yes" ${row[k]===true?'selected':''}>Yes</option><option value="no" ${row[k]===false?'selected':''}>No</option></select></label>`).join('')+'</fieldset><section class="gtt-trk-timer-panel"><div><strong>Follow-up timer</strong><small>30-day trade deadline · auto-removal after 40 days</small><small data-tracker-timer-status>Timer day '+ageOf(row)+' · Original purchase date '+esc(shortDate(row.record_date))+(row.timer_reset_at?' · Last reset '+esc(shortDate(row.timer_reset_at)):'')+'</small></div><button type="button" data-tracker-reset-timer>↻ Reset Timer</button></section><div class="gtt-trk-edit-actions"><button type="button" data-tracker-edit-cancel>Cancel</button><button type="submit">Save Changes</button></div><p class="gtt-trk-edit-status" aria-live="polite"></p>';
 form.querySelector('[data-tracker-edit-cancel]').onclick=()=>dlg.close();
 form.querySelector('[data-tracker-reset-timer]').onclick=async ev=>{
  if(!confirm('Reset this trade\'s 30-day deadline and 40-day removal timer to today?\n\nThe original purchase/quote date will NOT change. This reset cannot be undone.'))return;
  const button=ev.currentTarget,status=form.querySelector('.gtt-trk-edit-status');
  button.disabled=true;status.dataset.status='';status.textContent='Restarting timer…';
  try{
   const result=await api('reset_timer',{id,token:state.token});
   await refresh();
   const summary=form.querySelector('[data-tracker-timer-status]');
   if(summary)summary.textContent='Timer day 0 · Original purchase date '+shortDate(result.row.record_date)+' · Last reset '+shortDate(result.row.timer_reset_at);
   status.dataset.status='ok';
   status.textContent='Timer restarted: 30 days to deadline, 40 days to automatic removal. Any other edits still need Save Changes.';
  }catch(error){status.dataset.status='error';status.textContent=error.message;}
  finally{button.disabled=false;}
 };

 form.onsubmit=async ev=>{ev.preventDefault();const entries=new FormData(form);const record=Object.fromEntries(entries.entries());for(const k of ['power_ok','lock_off','damage_free'])record[k]=record[k]==='yes'?true:record[k]==='no'?false:null;const status=form.querySelector('.gtt-trk-edit-status');status.textContent='Saving…';try{await api('update',{id,token:state.token,record});dlg.close();await refresh();}catch(e){status.textContent=e.message;}};
 dlg.showModal();}
function init(){root=$('v4Record');createPane=$('gttTrackerCreate');listPane=$('gttTrackerList');storeInput=$('gttTrackerStore');listContent=$('gttTrackerCards');listStatus=$('gttTrackerListStatus');lockButton=$('gttTrackerLock');if(!root||!storeInput||!listContent)return;
 storeInput.innerHTML='<option value="">All stores / choose for new trade</option>'+STORES.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
 storeInput.value=state.store; // Restore the last store before showing Create Trade.
 storeInput.addEventListener('change',()=>{
   state.store=STORES.includes(storeInput.value)?storeInput.value:'';
   if(state.store)rememberStore(state.store);
   const quoteStore=$('gttQuoteRecordStore');
   if(quoteStore){quoteStore.value=state.store;quoteStore.dispatchEvent(new Event('change'));}
   setMessage('');updateStoreGate();if(state.mode==='list')refresh();
 });
 $('gttTrackerCreateTab').onclick=()=>{switchMode('create');if(!state.store)storeInput.focus();};$('gttTrackerListTab').onclick=()=>switchMode('list');
 for(const name of ['pending','received','all'])$('gttTrackerFilter'+name[0].toUpperCase()+name.slice(1)).onclick=()=>{state.filter=name;renderList();};
 $('gttTrackerSearch').addEventListener('input',e=>{state.query=e.target.value;renderList();});
 lockButton.addEventListener('click',()=>state.unlocked?lock():showKeypad());
 $('gttTrackerPinClose').onclick=()=>$('gttTrackerPinDialog').close();
 $('gttTrackerEditClose').onclick=()=>$('gttTrackerEditDialog').close();
 watchForms();switchMode('create');
}
const style=document.createElement('style');style.textContent=`
 #v4Record [hidden]{display:none!important}
 .gtt-trk-top{max-width:820px;margin:13px auto 17px;padding:17px;border:1px solid var(--v4-line,#d7e3ec);border-radius:15px;background:var(--v4-surface,#fff);color:var(--v4-ink,#1a3345)}
 .gtt-trk-store-row{display:flex;align-items:center;gap:12px;margin-bottom:15px;flex-wrap:wrap}.gtt-trk-store-row label{font-size:12px;font-weight:800;white-space:nowrap}.gtt-trk-store-row select{flex:1;min-width:190px;border:1px solid var(--v4-line,#d7e3ec);background:var(--v4-alt,#f3f7fb);color:var(--v4-ink,#1a3345);border-radius:9px;min-height:42px;padding:8px 11px;font:600 13px inherit;color-scheme:light dark}
 .gtt-trk-store-row select.gtt-trk-store-missing{border:2px solid #d48a27;box-shadow:0 0 0 3px rgba(226,159,64,.10)}
 /* Full Quote entry: first-time reps see ONLY the store selector until they choose. */
 .gtt-record-form.gtt-trk-quote-awaiting-store > :not(.gtt-tracker-quote-store){display:none!important}
 .gtt-record-form .gtt-tracker-quote-store{padding:12px 14px;margin:0 0 14px;border:1px solid var(--r-line,var(--v4-line,#cad7e3));border-left:3px solid var(--r-accent,var(--v4-blue,#0781be));border-radius:10px;background:var(--r-alt,var(--v4-alt,#f5f7fa))}
 .gtt-record-form .gtt-tracker-quote-store label{font-size:13px;font-weight:800}
 .gtt-record-form .gtt-tracker-quote-store select{width:100%;font-size:16px;max-width:100%;min-height:46px}
 .gtt-record-form .gtt-tracker-quote-store small{color:var(--r-muted,var(--v4-muted,#73838d));font-size:11px;line-height:1.4}
 .gtt-record-form.gtt-trk-quote-awaiting-store .gtt-tracker-quote-store{margin:6px 0;padding:18px;border-left-color:#d48a27}
 .gtt-record-form.gtt-trk-quote-awaiting-store .gtt-tracker-quote-store select{border:2px solid #d48a27}
 .gtt-trk-store-gate{max-width:820px;margin:13px auto;padding:24px 18px;border:1px dashed #d39b43;border-radius:12px;background:var(--v4-surface,#fff);text-align:center;color:var(--v4-ink,#1a3345)}
 .gtt-trk-store-gate strong{font-size:17px;display:block;margin-bottom:6px}.gtt-trk-store-gate p{font-size:13px;color:var(--v4-muted,#70818f);line-height:1.5;margin:0 0 14px}.gtt-trk-store-gate button{min-height:40px;padding:8px 14px;border-radius:9px;border:1px solid var(--v4-blue,#0574b2);background:var(--v4-blue,#0574b2);color:#fff;font-size:13px;font-weight:800;cursor:pointer}
 .gtt-trk-store-selected{max-width:820px;margin:9px auto 4px;border:1px solid var(--v4-line,#d7e3ec);border-left:4px solid #168764;border-radius:9px;padding:10px 12px;color:var(--v4-ink,#1a3345);background:var(--v4-surface,#fff);font-size:12px;font-weight:800}
 .gtt-trk-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gtt-trk-tabs button{min-height:44px;border:1px solid var(--v4-line,#d7e3ec);border-radius:9px;color:var(--v4-ink,#1a3345);background:var(--v4-alt,#f4f7fa);font-size:13px;font-weight:800;cursor:pointer}.gtt-trk-tabs button[aria-pressed=true]{background:var(--v4-blue,#0574b2);color:#fff;border-color:var(--v4-blue,#0574b2)}
 .gtt-trk-notice{max-width:820px;margin:0 auto 10px;font-size:12px;color:#2d855f}.gtt-trk-notice.is-error,.gtt-tracker-save-status.is-error,.gtt-trk-edit-status{color:#d75b51}
 .gtt-tracker-save{border:1px solid #15986b!important;background:#138865!important;color:#fff!important;min-width:140px;font-weight:800}.gtt-tracker-save:disabled{opacity:.65;cursor:default}.gtt-tracker-save-status{font-size:12px;color:#14885c;margin-top:8px}.gtt-tracker-quote-store{margin:12px 0;display:flex;flex-direction:column;gap:7px}.gtt-tracker-quote-store label{font-size:12px;font-weight:700}.gtt-tracker-quote-store select{min-height:42px;padding:7px 10px;border:1px solid var(--v4-line,#d7e3ec);background:var(--v4-alt,#f5f8fa);color:var(--v4-ink,#172a3c);border-radius:8px}
 #gttTrackerList{max-width:940px;margin:0 auto 65px;color:var(--v4-ink,#1a3345)}.gtt-trk-list-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:14px 0}.gtt-trk-list-head h3{margin:0;font-size:17px;font-weight:800}
 #gttTrackerLock{padding:9px 12px;background:var(--v4-alt,#f4f7fa);color:var(--v4-ink,#1a3345);border:1px solid var(--v4-line,#d7e3ec);border-radius:9px;font-size:12px;font-weight:800;cursor:pointer}
 .gtt-trk-filter-row{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:10px 0}.gtt-trk-filter-row button{min-height:40px;border:1px solid var(--v4-line,#d7e3ec);border-radius:9px;background:var(--v4-alt,#f4f7fa);color:var(--v4-ink,#1a3345);font-size:12px;font-weight:800}.gtt-trk-filter-row button[aria-pressed=true]{border-color:var(--v4-blue,#0781be);color:var(--v4-blue,#0781be)}
 .gtt-trk-search{width:100%;min-height:45px;padding:10px 13px;border:1px solid var(--v4-line,#d7e3ec);border-radius:9px;margin:0 0 12px;background:var(--v4-surface,#fff);color:var(--v4-ink,#1a3345);font:500 13px inherit}
 .gtt-trk-list-status{font-size:12px;color:var(--v4-muted,#71808c)}.gtt-trk-list-status.is-error{color:#d75b51}.gtt-trk-cards{display:flex;flex-direction:column;gap:10px}
 .gtt-trk-card{background:var(--v4-surface,#fff);border:1px solid var(--v4-line,#d7e3ec);border-left:5px solid #7896a7;border-radius:13px;padding:13px 15px;box-shadow:0 4px 12px #0000000a}.gtt-trk-card.yellow{border-left-color:#e9b832}.gtt-trk-card.orange{border-left-color:#e69b31}.gtt-trk-card.red{border-left-color:#e15358}.gtt-trk-card.received{border-left-color:#23a36b}.gtt-trk-card-main{display:flex;justify-content:space-between;align-items:start;gap:14px}.gtt-trk-customer{font-size:15px;font-weight:800;display:flex;flex-direction:column;gap:3px}.gtt-trk-customer small{font-weight:500;font-size:11px;color:var(--v4-muted,#70818f)}.gtt-trk-promo{font-size:20px;font-weight:850;text-align:right;white-space:nowrap}.gtt-trk-promo small{display:block;font-size:10px;font-weight:500;color:var(--v4-muted,#70818f)}
 .gtt-trk-card-meta{display:flex;flex-wrap:wrap;gap:5px 14px;font-size:12px;color:var(--v4-muted,#70818f);margin:11px 0}.gtt-trk-card-bottom{display:flex;align-items:center;gap:10px;border-top:1px solid var(--v4-line,#d7e3ec);padding-top:10px;font-size:11px}.gtt-trk-status{font-weight:800}.gtt-trk-card.yellow .gtt-trk-status{color:#ae8209}.gtt-trk-card.orange .gtt-trk-status{color:#d78a20}.gtt-trk-card.red .gtt-trk-status{color:#e15358}.gtt-trk-card.received .gtt-trk-status{color:#20a46c}.gtt-trk-age{color:var(--v4-muted,#70818f)}.gtt-trk-details{margin-left:auto;border:0;background:transparent;color:var(--v4-blue,#0781be);cursor:pointer;font-weight:800}
 .gtt-trk-card-expanded{padding:13px 0 0;border-top:1px solid var(--v4-line,#d7e3ec);margin-top:11px}.gtt-trk-detail-grid{display:grid;grid-template-columns:120px minmax(0,1fr);gap:9px 12px;font-size:12px}.gtt-trk-detail-grid span{color:var(--v4-muted,#70818f)}.gtt-trk-detail-grid b{font-weight:650;overflow-wrap:anywhere}.gtt-trk-detail-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:17px}.gtt-trk-detail-actions label{font-size:12px;font-weight:800;display:flex;align-items:center;gap:8px}.gtt-trk-detail-actions input{width:18px;height:18px;accent-color:#128761}.gtt-trk-detail-actions button{border:1px solid var(--v4-line,#d7e3ec);border-radius:8px;padding:8px 11px;color:var(--v4-ink,#1a3345);background:var(--v4-alt,#f4f7fa);font-size:12px;font-weight:800;cursor:pointer}
 .gtt-trk-manage-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.gtt-trk-detail-actions .gtt-trk-delete{color:#b33b43;border-color:#cf777d;background:transparent}.gtt-trk-detail-actions .gtt-trk-delete:hover{background:rgba(205,60,74,.09)}.gtt-trk-detail-actions .gtt-trk-delete:disabled{opacity:.55;cursor:wait}
 .gtt-trk-empty{text-align:center;padding:45px 18px;color:var(--v4-muted,#71808c);font-size:13px;border:1px dashed var(--v4-line,#d7e3ec);border-radius:12px}
 .gtt-trk-dialog{background:var(--v4-surface,#fff);color:var(--v4-ink,#1a3345);border:1px solid var(--v4-line,#d7e3ec);border-radius:16px;max-height:88dvh;overflow-y:auto;box-shadow:0 20px 75px #0006;width:min(92vw,640px);padding:20px}.gtt-trk-dialog::backdrop{background:#071b30b8}.gtt-trk-dialog>div:first-child{display:flex;justify-content:space-between;align-items:center;margin-bottom:13px}.gtt-trk-dialog h3{margin:0;font-size:18px}.gtt-trk-close{border:0;background:none;color:var(--v4-ink,#1a3345);font-size:25px;cursor:pointer}
 .gtt-trk-keypad{width:236px;max-width:100%;margin:13px auto 0;display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.gtt-trk-keypad button{min-height:52px;border:1px solid var(--v4-line,#d7e3ec);background:var(--v4-alt,#f4f7fa);color:var(--v4-ink,#1a3345);border-radius:11px;font-size:20px;font-weight:800;cursor:pointer}.gtt-trk-pin-dots{text-align:center;font-size:27px;letter-spacing:8px;margin:8px}.gtt-trk-pin-note{text-align:center;font-size:12px;color:#d65a4c;min-height:20px}
 .gtt-trk-edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.gtt-trk-edit-field{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:750}.gtt-trk-edit-field input,.gtt-trk-edit-field textarea,.gtt-trk-edit-condition select{width:100%;padding:10px;border:1px solid var(--v4-line,#d7e3ec);border-radius:8px;background:var(--v4-alt,#f4f7fa);color:var(--v4-ink,#1a3345);font-size:13px}.gtt-trk-edit-condition{border:1px solid var(--v4-line,#d7e3ec);border-radius:10px;margin-top:15px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.gtt-trk-edit-condition legend{font-weight:800;font-size:12px}.gtt-trk-edit-condition label{font-size:11px}.gtt-trk-timer-panel{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-top:16px;border:1px solid var(--v4-line,#d7e3ec);border-radius:11px;padding:13px;background:var(--v4-alt,#f4f7fa)}
 .gtt-trk-timer-panel>div{display:flex;flex-direction:column;gap:4px;min-width:0}.gtt-trk-timer-panel strong{font-size:13px}.gtt-trk-timer-panel small{font-size:11px;color:var(--v4-muted,#70818f)}
 .gtt-trk-timer-panel button{flex-shrink:0;padding:9px 13px;border-radius:9px;border:1px solid #ad8539;background:transparent;color:var(--v4-ink,#1a3345);font-weight:800;font-size:12px;cursor:pointer}.gtt-trk-timer-panel button:disabled{opacity:.55}
 .gtt-trk-edit-status[data-status=ok]{color:#14835b}.gtt-trk-edit-status[data-status=error]{color:#d75b51}
 @media(max-width:540px){.gtt-trk-timer-panel{align-items:stretch;flex-direction:column}.gtt-trk-timer-panel button{width:100%;min-height:42px}}
 .gtt-trk-edit-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:15px}.gtt-trk-edit-actions button{min-height:42px;padding:9px 15px;border-radius:9px;border:1px solid var(--v4-line,#d7e3ec);background:var(--v4-alt,#f4f7fa);color:var(--v4-ink,#1a3345);font-weight:800}.gtt-trk-edit-actions button[type=submit]{background:var(--v4-blue,#0781be);color:white}
 @media(max-width:540px){.gtt-trk-top{padding:12px}.gtt-trk-store-row{align-items:stretch}.gtt-trk-store-row label{width:100%}.gtt-trk-store-row select{width:100%}.gtt-trk-detail-grid{grid-template-columns:100px 1fr}.gtt-trk-edit-grid{grid-template-columns:1fr}.gtt-trk-edit-condition{grid-template-columns:1fr}.gtt-trk-card{padding:12px}}
`;document.head.appendChild(style);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
