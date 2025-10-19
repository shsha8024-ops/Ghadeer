const STORAGE_KEY = 'accounts';
const SNAPSHOT_KEY = 'accounts:lastTotals';

const elements = {
  tableBody: document.getElementById('clients'),
  resultMeta: document.getElementById('resultMeta'),
  search: document.getElementById('search'),
  form: document.getElementById('clientForm'),
  clientName: document.getElementById('clientName'),
  toast: document.getElementById('toast'),
  inlineFeedback: document.getElementById('inlineFeedback'),
  editDialog: document.getElementById('editDialog'),
  editForm: document.getElementById('editForm'),
  editName: document.getElementById('editName'),
  editHint: document.getElementById('editHint'),
  deleteDialog: document.getElementById('deleteDialog'),
  deleteForm: document.getElementById('deleteForm'),
  deleteMessage: document.getElementById('deleteMessage'),
  importButton: document.getElementById('importData'),
  exportButton: document.getElementById('exportData'),
  importInput: document.getElementById('importInput'),
  seedButton: document.getElementById('seedDemo'),
  syncButton: document.getElementById('syncNow'),
  clearButton: document.getElementById('clearAll'),
  stats: {
    clients: document.querySelector('[data-stat="clients"]'),
    clientsDelta: document.querySelector('[data-stat="clientsDelta"]'),
    invoices: document.querySelector('[data-stat="invoices"]'),
    invoicesDelta: document.querySelector('[data-stat="invoicesDelta"]'),
    balance: document.querySelector('[data-stat="balance"]'),
    balanceDelta: document.querySelector('[data-stat="balanceDelta"]'),
    topClient: document.querySelector('[data-stat="topClient"]'),
    topClientTotal: document.querySelector('[data-stat="topClientTotal"]'),
  },
};

const state = {
  accounts: loadAccounts(),
  filter: '',
  selection: null,
  deleteMode: 'single',
};

let previousTotals = loadSnapshot();
let toastTimeout;

const numberFormatter = new Intl.NumberFormat('ar-EG', {
  maximumFractionDigits: 0,
});

const demoAccounts = {
  'شركة الرافدين للنقل': [
    { reference: 'INV-2024-019', price: 2250000, status: 'مستحق' },
    { reference: 'INV-2024-031', price: 1875000, status: 'مدفوع' },
  ],
  'مجموعة دجلة الدولية': [
    { reference: 'INV-2024-008', price: 3150000, status: 'تحت المراجعة' },
    { reference: 'INV-2024-024', price: 2640000, status: 'مستحق' },
    { reference: 'INV-2024-037', price: 2925000, status: 'مدفوع جزئياً' },
  ],
  'United Gulf Logistics': [
    { reference: 'INV-2024-010', price: 4200000, status: 'مستحق' },
    { reference: 'INV-2024-029', price: 1980000, status: 'مدفوع' },
  ],
};

attachEventListeners();
renderAll({ saveSnapshot: true });

function attachEventListeners() {
  elements.tableBody?.addEventListener('click', handleActionClick);
  elements.search?.addEventListener('input', handleSearch);
  elements.form?.addEventListener('submit', handleAddClient);
  elements.editForm?.addEventListener('submit', handleEditSubmit);
  elements.deleteForm?.addEventListener('submit', handleDeleteSubmit);
  elements.importButton?.addEventListener('click', () => elements.importInput?.click());
  elements.exportButton?.addEventListener('click', exportData);
  elements.importInput?.addEventListener('change', handleImport);
  elements.seedButton?.addEventListener('click', seedDemoData);
  elements.syncButton?.addEventListener('click', syncNow);
  elements.clearButton?.addEventListener('click', requestClearAll);

  document.querySelectorAll('[data-close]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const dialogId = button.getAttribute('data-close');
        const dialog = dialogId ? document.getElementById(dialogId) : null;
        if (dialog && typeof dialog.close === 'function') {
          dialog.close();
        }
      });
    });

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      state.accounts = loadAccounts();
      renderAll();
    }
    if (event.key === SNAPSHOT_KEY) {
      previousTotals = loadSnapshot();
      renderAll();
    }
  });

  if (elements.inlineFeedback) {
    elements.inlineFeedback.setAttribute('hidden', '');
  }
}

function handleSearch(event) {
  state.filter = (event.target?.value || '').trim().toLowerCase();
  renderTable();
}

function handleAddClient(event) {
  event.preventDefault();
  const name = (elements.clientName?.value || '').trim();
  if (!name) {
    showInlineFeedback('يرجى إدخال اسم عميل صالح.', 'error');
    return;
  }

  const existing = findExistingName(name);
  if (existing) {
    showInlineFeedback('العميل موجود مسبقاً، تم تمييزه في الجدول.', 'warning');
    highlightRow(existing);
    return;
  }

  state.accounts[name] = [];
  persist();
  renderAll({ saveSnapshot: true });
  elements.form?.reset();
  elements.clientName?.focus();
  showInlineFeedback('تمت إضافة العميل بنجاح.', 'success');
  showToast('تم تسجيل العميل الجديد.', 'success');
  highlightRow(name);
}

function handleActionClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const encodedName = button.dataset.name || '';
  const name = decodeURIComponent(encodedName);

  if (!name) return;

  switch (action) {
    case 'view':
      window.location.href = `client.html?name=${encodeURIComponent(name)}`;
      break;
    case 'edit':
      openEditDialog(name);
      break;
    case 'delete':
      openDeleteDialog(name);
      break;
    default:
      break;
  }
}

function openEditDialog(name) {
  state.selection = name;
  if (!elements.editDialog) return;
  elements.editName.value = name;
  elements.editHint.textContent = '';
  elements.editHint.classList.remove('error');
  elements.editDialog.showModal();
  setTimeout(() => elements.editName?.focus(), 0);
}

function handleEditSubmit(event) {
  event.preventDefault();
  if (!state.selection) return;

  const newName = (elements.editName?.value || '').trim();
  if (!newName) {
    elements.editHint.textContent = 'يرجى إدخال اسم صالح.';
    elements.editHint.classList.add('error');
    return;
  }

  const existing = findExistingName(newName);
  if (existing && existing !== state.selection) {
    elements.editHint.textContent = 'يوجد عميل بنفس الاسم حالياً.';
    elements.editHint.classList.add('error');
    return;
  }

  if (newName !== state.selection) {
    state.accounts[newName] = state.accounts[state.selection] || [];
    delete state.accounts[state.selection];
    persist();
    renderAll({ saveSnapshot: true });
    showToast('تم تعديل اسم العميل.', 'success');
    highlightRow(newName);
  }

  elements.editDialog?.close();
  state.selection = null;
}

function openDeleteDialog(name) {
  state.selection = name;
  state.deleteMode = 'single';
  if (!elements.deleteDialog) return;
  elements.deleteMessage.textContent = `سيتم حذف العميل «${name}» وجميع فواتيره.`;
  elements.deleteDialog.dataset.mode = 'single';
  elements.deleteDialog.showModal();
}

function requestClearAll() {
  state.selection = null;
  state.deleteMode = 'all';
  if (!elements.deleteDialog) return;
  elements.deleteMessage.textContent = 'سيتم حذف جميع العملاء والسجلات المرتبطة بهم. هل أنت متأكد؟';
  elements.deleteDialog.dataset.mode = 'all';
  elements.deleteDialog.showModal();
}

function handleDeleteSubmit(event) {
  event.preventDefault();
  if (!elements.deleteDialog) return;

  const mode = elements.deleteDialog.dataset.mode || state.deleteMode;

  if (mode === 'all') {
    state.accounts = {};
    showToast('تم مسح جميع العملاء.', 'warning');
  } else if (state.selection) {
    delete state.accounts[state.selection];
    showToast(`تم حذف العميل «${state.selection}».`, 'warning');
  }

  state.selection = null;
  persist();
  renderAll({ saveSnapshot: true });
  elements.deleteDialog.close();
}

function handleImport(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  file.text()
    .then((text) => {
      try {
        const parsed = JSON.parse(text);
        const normalized = normalizeAccounts(parsed);
        state.accounts = normalized;
        persist();
        renderAll({ saveSnapshot: true });
        showToast('تم استيراد البيانات بنجاح.', 'success');
        showInlineFeedback('اكتملت عملية الاستيراد.', 'success');
      } catch (error) {
        console.error('Import failed:', error);
        showToast('تعذر قراءة ملف الاستيراد.', 'error');
        showInlineFeedback('صيغة الملف غير مدعومة.', 'error');
      }
    })
    .finally(() => {
      if (elements.importInput) {
        elements.importInput.value = '';
      }
    });
}

function exportData() {
  const data = JSON.stringify(state.accounts, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ghadeer-accounts-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast('تم تجهيز ملف التصدير.', 'info');
}

function seedDemoData() {
  let added = 0;
  Object.entries(demoAccounts).forEach(([name, invoices]) => {
    const existing = findExistingName(name);
    if (existing) {
      const target = existing;
      const list = state.accounts[target] || [];
      invoices.forEach((invoice) => list.push(normalizeInvoice(invoice)));
      state.accounts[target] = list;
    } else {
      state.accounts[name] = invoices.map(normalizeInvoice);
      added += 1;
    }
  });

  persist();
  renderAll({ saveSnapshot: true });
  const message = added
    ? `تمت إضافة ${formatNumber(added)} عميل من النموذج التجريبي.`
    : 'تم تحديث البيانات التجريبية الحالية.';
  showToast(message, 'success');
  showInlineFeedback('تم تحميل البيانات التجريبية.', 'success');
}

function syncNow() {
  persist();
  renderAll({ saveSnapshot: true });
  showToast('تمت مزامنة البيانات الحالية.', 'info');
  showInlineFeedback('المعلومات محدثة الآن.', 'success');
}

function handleSearchResults(rowsCount, totalClients) {
  if (elements.resultMeta) {
    if (totalClients === 0) {
      elements.resultMeta.textContent = 'لم يتم إضافة أي عملاء بعد.';
    } else {
      elements.resultMeta.textContent = `${formatNumber(rowsCount)} من أصل ${formatNumber(totalClients)} عميل`;
    }
  }

  if (rowsCount === 0 && totalClients > 0) {
    showInlineFeedback('لا توجد نتائج مطابقة لبحثك.', 'warning');
  } else if (elements.inlineFeedback && elements.inlineFeedback.dataset.state === 'warning') {
    elements.inlineFeedback.setAttribute('hidden', '');
  }
}

function renderAll(options = {}) {
  const totals = computeTotals(state.accounts);
  updateSummary(totals);
  renderTable();
  if (options.saveSnapshot) {
    saveSnapshot(totals);
    previousTotals = totals;
  }
}

function renderTable() {
  if (!elements.tableBody) return;

  const filter = state.filter;
  const rows = [];

  Object.keys(state.accounts)
    .sort((a, b) => a.localeCompare(b, 'ar', { sensitivity: 'base' }))
    .forEach((client) => {
      if (filter && !client.toLowerCase().includes(filter)) {
        return;
      }

      const invoices = Array.isArray(state.accounts[client])
        ? state.accounts[client]
        : [];
      const total = invoices.reduce((sum, invoice) => sum + Number(invoice.price || 0), 0);
      const encoded = encodeURIComponent(client);
      rows.push(`
        <tr data-client="${encoded}">
          <td>${escapeHtml(client)}</td>
          <td>${formatNumber(invoices.length)}</td>
          <td>${formatCurrency(total)}</td>
          <td>
            <div class="action-buttons">
              <button type="button" class="action-button view" data-action="view" data-name="${encoded}">👁️ عرض</button>
              <button type="button" class="action-button edit" data-action="edit" data-name="${encoded}">✏️ تعديل</button>
              <button type="button" class="action-button delete" data-action="delete" data-name="${encoded}">🗑️ حذف</button>
            </div>
          </td>
        </tr>`);
    });

  if (rows.length === 0) {
    elements.tableBody.innerHTML = '<tr class="empty-row"><td colspan="4">لا توجد بيانات مطابقة حالياً.</td></tr>';
  } else {
    elements.tableBody.innerHTML = rows.join('');
  }

  handleSearchResults(rows.length, Object.keys(state.accounts).length);
}

function updateSummary(totals) {
  const { clients, invoices, balance, topClient, topClientTotal } = totals;
  const stats = elements.stats;
  if (!stats.clients) return;

  stats.clients.textContent = formatNumber(clients);
  stats.clientsDelta.textContent = formatDelta(clients, previousTotals?.clients, 'count');

  stats.invoices.textContent = formatNumber(invoices);
  stats.invoicesDelta.textContent = formatDelta(invoices, previousTotals?.invoices, 'count');

  stats.balance.textContent = formatCurrency(balance);
  stats.balanceDelta.textContent = formatDelta(balance, previousTotals?.balance, 'currency');

  if (topClient) {
    stats.topClient.textContent = topClient;
    stats.topClientTotal.textContent = formatCurrency(topClientTotal);
  } else {
    stats.topClient.textContent = '—';
    stats.topClientTotal.textContent = '—';
  }
}

function computeTotals(accounts) {
  let invoices = 0;
  let balance = 0;
  let topClient = '';
  let topClientTotal = 0;

  const clients = Object.entries(accounts || {}).map(([name, rawInvoices]) => {
    const list = Array.isArray(rawInvoices) ? rawInvoices : [];
    const total = list.reduce((sum, invoice) => sum + Number(invoice.price || 0), 0);
    invoices += list.length;
    balance += total;
    if (total > topClientTotal) {
      topClientTotal = total;
      topClient = name;
    }
    return name;
  });

  return { clients: clients.length, invoices, balance, topClient, topClientTotal };
}

function normalizeAccounts(raw) {
  const normalized = {};

  if (!raw) {
    return normalized;
  }

  if (Array.isArray(raw)) {
    raw.forEach((entry) => {
      if (entry && typeof entry === 'object') {
        const name = entry.name || entry.client || entry.title;
        if (!name) return;
        const invoices = Array.isArray(entry.invoices)
          ? entry.invoices
          : Array.isArray(entry.entries)
            ? entry.entries
            : [];
        normalized[name] = invoices.map(normalizeInvoice);
      }
    });
    return normalized;
  }

  Object.entries(raw).forEach(([name, value]) => {
    if (!name) return;
    if (Array.isArray(value)) {
      normalized[name] = value.map(normalizeInvoice);
    } else if (value && typeof value === 'object' && Array.isArray(value.invoices)) {
      normalized[name] = value.invoices.map(normalizeInvoice);
    } else {
      normalized[name] = [];
    }
  });

  return normalized;
}

function normalizeInvoice(entry) {
  if (!entry || typeof entry !== 'object') {
    return { reference: '', price: 0, status: '' };
  }

  return {
    reference: typeof entry.reference === 'string' ? entry.reference : '',
    price: Number(entry.price ?? entry.amount ?? 0) || 0,
    status: typeof entry.status === 'string' ? entry.status : '',
    note: typeof entry.note === 'string' ? entry.note : '',
  };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.accounts));
}

function loadAccounts() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored);
    return normalizeAccounts(parsed);
  } catch (error) {
    console.warn('Failed to parse stored accounts:', error);
    return {};
  }
}

function saveSnapshot(totals) {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ ...totals, timestamp: Date.now() }));
}

function loadSnapshot() {
  const stored = localStorage.getItem(SNAPSHOT_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn('Failed to parse snapshot:', error);
    return null;
  }
}

function showToast(message, type = 'info') {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.dataset.type = type;
  elements.toast.classList.add('is-visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    elements.toast?.classList.remove('is-visible');
  }, 4200);
}

function showInlineFeedback(message, stateValue = 'info') {
  if (!elements.inlineFeedback) return;
  if (!message) {
    elements.inlineFeedback.textContent = '';
    elements.inlineFeedback.setAttribute('hidden', '');
    return;
  }
  elements.inlineFeedback.textContent = message;
  elements.inlineFeedback.dataset.state = stateValue;
  elements.inlineFeedback.removeAttribute('hidden');
}

function findExistingName(name) {
  const target = name.toLowerCase();
  return Object.keys(state.accounts).find((client) => client.toLowerCase() === target) || null;
}

function highlightRow(name) {
  if (!elements.tableBody) return;
  const encoded = encodeURIComponent(name);
  const selector = `tr[data-client="${cssEscape(encoded)}"]`;
  const row = elements.tableBody.querySelector(selector);
  if (row) {
    row.classList.add('is-highlighted');
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => row.classList.remove('is-highlighted'), 1200);
  }
}

function formatNumber(value) {
  return numberFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatCurrency(amount) {
  return `${formatNumber(Math.round(amount))} د.ع`;
}

function formatDelta(current, previous, type = 'count') {
  if (previous == null || !Number.isFinite(previous)) {
    return '—';
  }
  const delta = current - previous;
  if (delta === 0) {
    return 'بدون تغيير';
  }
  const direction = delta > 0 ? '▲' : '▼';
  const magnitude = Math.abs(delta);
  if (type === 'currency') {
    return `${direction} ${formatCurrency(magnitude)}`;
  }
  return `${direction} ${formatNumber(magnitude)}`;
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(value);
  }
  return value.replace(/([\0-\x1F\x7F-\x9F!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
