import { todayISO, uid, escapeHtml, getCurrencySymbol } from './utils.js';
import { loadApp, saveApp, getClient, ensureClientHasFirstInvoice } from './storage.js';
import { sumAmountFromPayload } from './exports.js';

const els = {
  clientsCount: document.getElementById('clientsCount'),
  q: document.getElementById('q'),
  empty: document.getElementById('empty'),
  body: document.getElementById('clientsBody'),

  name: document.getElementById('name'),
  phone: document.getElementById('phone'),
  location: document.getElementById('location'),
  currency: document.getElementById('currency'),

  btnSave: document.getElementById('btnSave'),
  btnClear: document.getElementById('btnClear'),

  btnBackup: document.getElementById('btnBackup'),
  btnRestore: document.getElementById('btnRestore'),

  // edit sheet
  editOverlay: document.getElementById('editOverlay'),
  editSheet: document.getElementById('editSheet'),
  editMeta: document.getElementById('editMeta'),
  editName: document.getElementById('editName'),
  editPhone: document.getElementById('editPhone'),
  editLocation: document.getElementById('editLocation'),
  editCurrency: document.getElementById('editCurrency'),
  btnEditClose: document.getElementById('btnEditClose'),
  btnEditSave: document.getElementById('btnEditSave'),
  btnEditDelete: document.getElementById('btnEditDelete'),
};

let editingClientId = null;

function calcInvoiceBalance(stmt){
  const s1 = sumAmountFromPayload(stmt?.t1);
  const s2 = sumAmountFromPayload(stmt?.t2);
  return s1 - s2;
}

function clientTotalBalance(app, clientId){
  const invs = app.invoicesByClient[clientId] || [];
  let total = 0;
  for(const inv of invs){
    const stmt = app.statementsByInvoice[inv.id];
    total += calcInvoiceBalance(stmt);
  }
  return total;
}

function clearAddForm(){
  els.name.value = '';
  els.phone.value = '';
  els.location.value = '';
  els.currency.value = '$';
}

function render(){
  const app = loadApp();
  const q = (els.q.value || '').trim().toLowerCase();

  els.clientsCount.textContent = `العملاء: ${app.clients.length}`;
  els.body.innerHTML = '';
  els.empty.classList.toggle('hidden', app.clients.length !== 0);

  for(const c of app.clients){
    ensureClientHasFirstInvoice(app, c.id);

    const hay = `${c.name||''} ${c.phone||''} ${c.location||''}`.toLowerCase();
    if(q && !hay.includes(q)) continue;

    const invCount = (app.invoicesByClient[c.id] || []).length;
    const total = clientTotalBalance(app, c.id);
    const sym = getCurrencySymbol(c.currency || '$');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <button class="linkBtn" data-edit="${c.id}" title="تعديل">${escapeHtml(c.name)}</button>
      </td>
      <td>${escapeHtml(c.phone || '')}</td>
      <td>${escapeHtml(c.location || '')}</td>
      <td>${invCount}</td>
      <td>${escapeHtml(`${total}${sym}`)}</td>
      <td class="actionsCell">
        <button class="btn primary" data-open="${c.id}">معلومات العميل</button>
      </td>
    `;
    els.body.appendChild(tr);
  }

  saveApp(app);
}

function addClient(){
  const name = els.name.value.trim();
  if(!name){
    alert('اكتب اسم العميل.');
    return;
  }

  const app = loadApp();
  const id = uid('c');
  app.clients.push({
    id,
    name,
    phone: els.phone.value.trim(),
    location: els.location.value.trim(),
    currency: els.currency.value,
    createdAt: Date.now(),
  });
  ensureClientHasFirstInvoice(app, id);

  saveApp(app);
  clearAddForm();
  render();
}

function exportBackup(){
  const app = loadApp();
  const blob = new Blob([JSON.stringify(app, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `alghadeer_backup_${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importBackup(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if(!file) return;

    try{
      const text = await file.text();
      const data = JSON.parse(text);
      if(!data || data.v !== 2){
        alert('ملف غير صالح.');
        return;
      }
      if(!confirm('سيتم استبدال البيانات الحالية. موافق؟')) return;

      localStorage.setItem('alghadeer_app_v2', JSON.stringify(data));
      clearAddForm();
      closeEdit();
      render();
      alert('تم الاستيراد.');
    }catch{
      alert('فشل قراءة الملف.');
    }
  };
  input.click();
}

/* Edit sheet */
function openEdit(clientId){
  const app = loadApp();
  const c = getClient(app, clientId);
  if(!c) return;

  editingClientId = clientId;

  els.editMeta.textContent = `${c.name || ''} — ${c.phone || ''} — ${c.location || ''}`;
  els.editName.value = c.name || '';
  els.editPhone.value = c.phone || '';
  els.editLocation.value = c.location || '';
  els.editCurrency.value = c.currency || '$';

  els.editOverlay.classList.remove('hidden');
  requestAnimationFrame(() => els.editOverlay.classList.add('open'));
  els.editOverlay.setAttribute('aria-hidden', 'false');
}

function closeEdit(){
  editingClientId = null;
  els.editOverlay.classList.remove('open');
  els.editOverlay.setAttribute('aria-hidden', 'true');
  window.setTimeout(() => els.editOverlay.classList.add('hidden'), 180);
}

function saveEdit(){
  if(!editingClientId) return;
  const name = els.editName.value.trim();
  if(!name){
    alert('اكتب اسم العميل.');
    return;
  }

  const app = loadApp();
  const c = getClient(app, editingClientId);
  if(!c){
    closeEdit();
    render();
    return;
  }

  c.name = name;
  c.phone = els.editPhone.value.trim();
  c.location = els.editLocation.value.trim();
  c.currency = els.editCurrency.value;

  saveApp(app);
  closeEdit();
  render();
}

function deleteClientFromEdit(){
  if(!editingClientId) return;

  const app = loadApp();
  const c = getClient(app, editingClientId);
  if(!c) return;

  if(!confirm(`حذف العميل "${c.name}"؟ سيتم حذف كل فواتيره.`)) return;

  const invs = app.invoicesByClient[editingClientId] || [];
  for(const inv of invs){
    delete app.statementsByInvoice[inv.id];
  }
  delete app.invoicesByClient[editingClientId];
  app.clients = app.clients.filter(x => x.id !== editingClientId);

  saveApp(app);
  closeEdit();
  render();
}

/* Events */
els.q.addEventListener('input', render);
els.btnSave.addEventListener('click', addClient);
els.btnClear.addEventListener('click', clearAddForm);
els.btnBackup.addEventListener('click', exportBackup);
els.btnRestore.addEventListener('click', importBackup);

els.body.addEventListener('click', (e) => {
  const t = e.target;
  if(!(t instanceof HTMLElement)) return;

  const openId = t.getAttribute('data-open');
  const editId = t.getAttribute('data-edit');

  if(openId) window.location.href = `invoice.html?client=${encodeURIComponent(openId)}`;
  if(editId) openEdit(editId);
});

els.btnEditClose.addEventListener('click', closeEdit);
els.btnEditSave.addEventListener('click', saveEdit);
els.btnEditDelete.addEventListener('click', deleteClientFromEdit);

// click outside to close
els.editOverlay.addEventListener('click', (e) => {
  if(e.target === els.editOverlay) closeEdit();
});

// ESC to close
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' && !els.editOverlay.classList.contains('hidden')) closeEdit();
});

(function boot(){
  const app = loadApp();
  saveApp(app);
  clearAddForm();
  render();
})();
