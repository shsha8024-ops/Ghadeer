/* file: assets/js/invoice-page.js
 *
 * Requires HTML ids:
 * - invSearch, listFrom, listTo, btnListClear
 * - invSelect, invList, invCount
 * - btnNewInv, btnRenameInv, btnDeleteInv
 * - invPill, curPill, invDate, subtitle
 * - t1/t2 + toolbar buttons + sum1/sum2 + f1/f2/f3
 * - pdfFrom/pdfTo + btnPdfRange/btnPdfAll
 * - btnPrintTab/btnPrintAll + btnXlsxTab/btnXlsxAll + btnExportClientXlsx
 *
 * Optional: SheetJS (window.XLSX) for real .xlsx exports.
 */

const QS = new URLSearchParams(location.search);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ui = {
  clientLine: $("#clientLine"),
  subtitle: $("#subtitle"),

  invCount: $("#invCount"),
  invSelect: $("#invSelect"),
  invList: $("#invList"),

  invSearch: $("#invSearch"),
  listFrom: $("#listFrom"),
  listTo: $("#listTo"),
  btnListClear: $("#btnListClear"),

  invPill: $("#invPill"),
  curPill: $("#curPill"),
  invDate: $("#invDate"),

  btnNewInv: $("#btnNewInv"),
  btnRenameInv: $("#btnRenameInv"),
  btnDeleteInv: $("#btnDeleteInv"),

  pdfFrom: $("#pdfFrom"),
  pdfTo: $("#pdfTo"),
  btnPdfRange: $("#btnPdfRange"),
  btnPdfAll: $("#btnPdfAll"),

  btnExportClientXlsx: $("#btnExportClientXlsx"),

  btnPrintTab: $("#btnPrintTab"),
  btnPrintAll: $("#btnPrintAll"),
  btnXlsxTab: $("#btnXlsxTab"),
  btnXlsxAll: $("#btnXlsxAll"),

  tabBtns: $$(".tabBtn"),
  tabs: $$(".tab"),
  pdfDoc: $("#pdfDoc"),

  t1: $("#t1"),
  t2: $("#t2"),
  sum1: $("#sum1"),
  sum2: $("#sum2"),

  f1: $("#f1"),
  f2: $("#f2"),
  f3: $("#f3"),

  t1AddRow: $("#t1AddRow"),
  t1DelRow: $("#t1DelRow"),
  t1AddCol: $("#t1AddCol"),
  t1AddColAfter: $("#t1AddColAfter"),
  t1DelCol: $("#t1DelCol"),

  t2AddRow: $("#t2AddRow"),
  t2DelRow: $("#t2DelRow"),
  t2AddCol: $("#t2AddCol"),
  t2AddColAfter: $("#t2AddColAfter"),
  t2DelCol: $("#t2DelCol"),
};

const clientId = (QS.get("clientId") || QS.get("id") || QS.get("client") || "").trim();
const clientName = (QS.get("clientName") || QS.get("name") || "").trim();
const storageKey = `agd_invoices::${clientId || "unknown"}`;

const PINNED_AMOUNT_HEADER = "المبلغ";

const state = {
  invoices: [],
  currentId: null,
  selected: {
    t1: { rowIndex: null, colIndex: null },
    t2: { rowIndex: null, colIndex: null },
  },
  activeTab: "ops",
  saveTimer: null,
  filter: {
    term: "",
    from: "",
    to: "",
  },
};

function nowIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeJsonParse(s, fallback) {
  try {
    const v = JSON.parse(s);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeForSearch(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toDateNum(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function invoiceInRange(inv, fromIso, toIso) {
  const d = toDateNum(inv.date);
  if (d == null) return false;

  const f = toDateNum(fromIso);
  const t = toDateNum(toIso);

  if (f != null && d < f) return false;
  if (t != null && d > t) return false;
  return true;
}

/* =========================
 * Storage
 * ========================= */

function loadAll() {
  const raw = localStorage.getItem(storageKey);
  const data = safeJsonParse(raw, null);
  if (Array.isArray(data) && data.length) {
    state.invoices = data.map(normalizeInvoice);
  } else {
    state.invoices = [createDefaultInvoice("فاتورة 1")];
  }
  state.currentId = state.invoices[0]?.id ?? null;
}

function saveAll() {
  localStorage.setItem(storageKey, JSON.stringify(state.invoices));
}

function requestSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    saveCurrentFromDom();
    saveAll();
    renderHeaderAndSums();
    renderInvoicePickers();
  }, 200);
}

/* =========================
 * Data normalize
 * ========================= */

function normalizeInvoice(inv) {
  const base = {
    id: String(inv?.id || uid()),
    name: String(inv?.name || "فاتورة"),
    date: String(inv?.date || nowIsoDate()),
    currency: String(inv?.currency || "$"),
    t1: inv?.t1 ?? null,
    t2: inv?.t2 ?? null,
  };

  base.t1 = normalizeTable(base.t1, 6, [
    "رقم",
    "التاريخ",
    "اسم السائق",
    "رقم السيارة",
    "ملاحظة",
    PINNED_AMOUNT_HEADER,
  ]);

  base.t2 = normalizeTable(base.t2, 6, [
    "رقم",
    "التاريخ",
    "اسم السائق",
    "رقم السيارة",
    "ملاحظة",
    PINNED_AMOUNT_HEADER,
  ]);

  base.t1 = pinAmountLast(base.t1);
  base.t2 = pinAmountLast(base.t2);

  return base;
}

function normalizeTable(t, minCols, defaultHeaders) {
  const headers = Array.isArray(t?.headers) && t.headers.length ? t.headers : defaultHeaders;
  const rows = Array.isArray(t?.rows) && t.rows.length ? t.rows : [defaultRow(headers.length)];

  const normalizedRows = rows.map((r, i) => {
    const cells = Array.isArray(r) ? r.slice(0) : [];
    while (cells.length < headers.length) cells.push("");
    cells[0] = String(i + 1);
    return cells;
  });

  const min = Number.isFinite(Number(t?.minCols)) ? Number(t.minCols) : minCols;
  return { headers, rows: normalizedRows, minCols: Math.max(min, minCols) };
}

function pinAmountLast(tData) {
  const headers = tData.headers.slice(0);
  const amountIdx = headers.findIndex((h) => String(h).trim() === PINNED_AMOUNT_HEADER);

  if (amountIdx === -1) {
    headers.push(PINNED_AMOUNT_HEADER);
    const rows = tData.rows.map((r) => {
      const out = r.slice(0);
      out.push("");
      return out;
    });
    return { ...tData, headers, rows };
  }

  if (amountIdx === headers.length - 1) return tData;

  headers.splice(amountIdx, 1);
  headers.push(PINNED_AMOUNT_HEADER);

  const rows = tData.rows.map((r) => {
    const out = r.slice(0);
    const amountCell = out.splice(amountIdx, 1)[0] ?? "";
    out.push(amountCell);
    return out;
  });

  return { ...tData, headers, rows };
}

function defaultRow(cols) {
  const r = Array.from({ length: cols }, () => "");
  r[0] = "1";
  return r;
}

function createDefaultInvoice(name) {
  const inv = normalizeInvoice({
    id: uid(),
    name,
    date: nowIsoDate(),
    currency: "$",
  });

  inv.t1.rows = [["1", "", "", "", "", `0${inv.currency}`]];
  inv.t2.rows = [["1", "", "", "", "", `0${inv.currency}`]];
  return inv;
}

/* =========================
 * Current invoice
 * ========================= */

function getCurrentInvoice() {
  return state.invoices.find((x) => x.id === state.currentId) || null;
}

function setCurrentInvoice(id) {
  saveCurrentFromDom();
  state.currentId = id;
  renderInvoiceIntoDom();
  renderHeaderAndSums();
  renderInvoicePickers();
}

function renderClientHeader() {
  const line = clientName
    ? `العميل: ${clientName}${clientId ? ` (${clientId})` : ""}`
    : clientId
      ? `العميل: ${clientId}`
      : "—";
  ui.clientLine.textContent = line;
}

/* =========================
 * Filters (from HTML controls)
 * ========================= */

function syncFiltersFromControls() {
  state.filter.term = ui.invSearch?.value ?? "";
  state.filter.from = ui.listFrom?.value ?? "";
  state.filter.to = ui.listTo?.value ?? "";
}

function invoiceMatches(inv) {
  const term = normalizeForSearch(state.filter.term);
  const fromIso = state.filter.from || "";
  const toIso = state.filter.to || "";

  const termOk = (() => {
    if (!term) return true;
    const hay = normalizeForSearch([inv.name, inv.date, inv.currency].filter(Boolean).join(" "));
    return hay.includes(term);
  })();

  const rangeOk = (() => {
    if (!fromIso && !toIso) return true;
    return invoiceInRange(inv, fromIso, toIso);
  })();

  return termOk && rangeOk;
}

function getFilteredInvoices() {
  const list = state.invoices.filter(invoiceMatches);

  // keep current visible
  const cur = getCurrentInvoice();
  if (cur && !list.some((x) => x.id === cur.id)) list.unshift(cur);

  const seen = new Set();
  return list.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}

/* =========================
 * Pickers render
 * ========================= */

function renderInvoicePickers() {
  syncFiltersFromControls();

  const total = state.invoices.length;
  const filtered = getFilteredInvoices();
  ui.invCount.textContent = `${filtered.length}/${total}`;

  ui.invSelect.innerHTML = "";
  for (const inv of filtered) {
    const opt = document.createElement("option");
    opt.value = inv.id;
    opt.textContent = `${inv.name} — ${inv.date || "بدون تاريخ"}`;
    if (inv.id === state.currentId) opt.selected = true;
    ui.invSelect.appendChild(opt);
  }

  ui.invList.innerHTML = "";
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "muted small";
    empty.style.padding = "10px 0";
    empty.textContent = "لا توجد نتائج.";
    ui.invList.appendChild(empty);
    return;
  }

  for (const inv of filtered) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `invItem ${inv.id === state.currentId ? "active" : ""}`;
    item.textContent = `${inv.name} • ${inv.date || "—"}`;
    item.addEventListener("click", () => setCurrentInvoice(inv.id));
    ui.invList.appendChild(item);
  }
}

/* =========================
 * Invoice render / save
 * ========================= */

function renderInvoiceIntoDom() {
  const inv = getCurrentInvoice();
  if (!inv) return;

  ui.invPill.textContent = `فاتورة: ${inv.name}`;
  ui.curPill.textContent = inv.currency || "$";
  ui.invDate.value = inv.date || "";

  ui.subtitle.textContent = [
    clientName ? `العميل: ${clientName}` : clientId ? `العميل: ${clientId}` : "—",
    `الفاتورة: ${inv.name}`,
    inv.date ? `التاريخ: ${inv.date}` : null,
  ]
    .filter(Boolean)
    .join(" — ");

  inv.t1 = pinAmountLast(inv.t1);
  inv.t2 = pinAmountLast(inv.t2);

  renderTable(ui.t1, inv.t1, inv.currency);
  renderTable(ui.t2, inv.t2, inv.currency);

  updateSums(inv.currency);
}

function renderTable(tableEl, tData, currency) {
  const theadTr = tableEl.tHead?.rows?.[0];
  const tbody = tableEl.tBodies?.[0];
  if (!theadTr || !tbody) return;

  const pinned = pinAmountLast(tData);

  theadTr.innerHTML = "";
  for (const h of pinned.headers) {
    const th = document.createElement("th");
    th.textContent = h;
    theadTr.appendChild(th);
  }

  tbody.innerHTML = "";
  for (const row of pinned.rows) {
    const tr = document.createElement("tr");
    row.forEach((cell, idx) => {
      const td = document.createElement("td");

      if (idx === 0) {
        td.textContent = cell;
      } else {
        td.setAttribute("contenteditable", "true");
        td.textContent = String(cell ?? "");
      }

      const isAmountCol = idx === pinned.headers.length - 1;
      if (isAmountCol) {
        td.classList.add("amount");
        const n = parseAmount(td.textContent);
        td.textContent = formatAmount(n, currency);
      }

      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }

  syncFooterColspan(tableEl);
}

function syncFooterColspan(tableEl) {
  const headCols = tableEl.tHead?.rows?.[0]?.cells?.length ?? 0;
  const footRow = tableEl.tFoot?.rows?.[0];
  if (!footRow) return;
  const labelCell = footRow.cells?.[0];
  if (!labelCell) return;
  labelCell.colSpan = Math.max(1, headCols - 1);
}

function saveCurrentFromDom() {
  const inv = getCurrentInvoice();
  if (!inv) return;

  inv.date = ui.invDate.value || inv.date || "";
  inv.currency = String(ui.curPill.textContent || inv.currency || "$").trim() || "$";

  inv.t1 = readTable(ui.t1, inv.t1.minCols);
  inv.t2 = readTable(ui.t2, inv.t2.minCols);

  inv.t1 = pinAmountLast(inv.t1);
  inv.t2 = pinAmountLast(inv.t2);

  inv.t1.rows = renumberRows(inv.t1.rows);
  inv.t2.rows = renumberRows(inv.t2.rows);
}

function readTable(tableEl, minCols) {
  const headers = $$("#" + tableEl.id + " thead th").map((th) => th.textContent.trim());
  const rows = [];
  const trs = $$("#" + tableEl.id + " tbody tr");

  for (const tr of trs) {
    rows.push(Array.from(tr.cells).map((td) => td.textContent.trim()));
  }

  return normalizeTable({ headers, rows, minCols }, Number(minCols || 6), headers);
}

function renumberRows(rows) {
  return rows.map((r, i) => {
    const out = r.slice(0);
    out[0] = String(i + 1);
    return out;
  });
}

/* =========================
 * Amounts / sums
 * ========================= */

function parseAmount(s) {
  const raw = String(s ?? "").trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.,\-]/g, "").replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatAmount(n, currency) {
  const v = Number.isFinite(n) ? n : 0;
  const isInt = Math.abs(v - Math.round(v)) < 1e-9;
  const txt = isInt ? String(Math.round(v)) : v.toFixed(2);
  return `${txt}${currency}`;
}

function computeTableSum(tData) {
  const pinned = pinAmountLast(tData);
  const lastIdx = pinned.headers.length - 1;
  let sum = 0;
  for (const r of pinned.rows) sum += parseAmount(r[lastIdx]);
  return sum;
}

function updateSums(currency) {
  const inv = getCurrentInvoice();
  if (!inv) return;

  inv.t1 = pinAmountLast(inv.t1);
  inv.t2 = pinAmountLast(inv.t2);

  const s1 = computeTableSum(inv.t1);
  const s2 = computeTableSum(inv.t2);
  const bal = s1 - s2;

  ui.sum1.textContent = formatAmount(s1, currency);
  ui.sum2.textContent = formatAmount(s2, currency);

  ui.f1.textContent = formatAmount(s1, currency);
  ui.f2.textContent = formatAmount(s2, currency);
  ui.f3.textContent = formatAmount(bal, currency);
}

function renderHeaderAndSums() {
  const inv = getCurrentInvoice();
  if (!inv) return;

  ui.invPill.textContent = `فاتورة: ${inv.name}`;
  ui.curPill.textContent = inv.currency || "$";
  ui.subtitle.textContent = [
    clientName ? `العميل: ${clientName}` : clientId ? `العميل: ${clientId}` : "—",
    `الفاتورة: ${inv.name}`,
    inv.date ? `التاريخ: ${inv.date}` : null,
  ]
    .filter(Boolean)
    .join(" — ");

  updateSums(inv.currency || "$");
}

/* =========================
 * Tabs
 * ========================= */

function setupTabs() {
  ui.tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      ui.tabBtns.forEach((b) => b.classList.remove("active"));
      ui.tabs.forEach((t) => t.classList.remove("active"));

      btn.classList.add("active");
      const key = btn.dataset.tab;
      state.activeTab = key;
      $("#" + key)?.classList.add("active");
    });
  });
}

/* =========================
 * Table selection + editing
 * ========================= */

function setSelected(tableId, rowIndex, colIndex) {
  state.selected[tableId] = { rowIndex, colIndex };
}

function wireSelection(tableEl, tableId) {
  tableEl.addEventListener("click", (e) => {
    const td = e.target?.closest?.("td");
    if (!td) return;

    const tr = td.parentElement;
    const tbody = tableEl.tBodies?.[0];
    const rowIndex = Array.from(tbody.rows).indexOf(tr);
    const colIndex = Array.from(tr.cells).indexOf(td);

    setSelected(tableId, rowIndex, colIndex);
  });
}

function addRow(tableEl, tableId) {
  const inv = getCurrentInvoice();
  if (!inv) return;

  const tData = tableId === "t1" ? inv.t1 : inv.t2;
  const pinned = pinAmountLast(tData);

  const cols = pinned.headers.length;
  const newRow = Array.from({ length: cols }, () => "");
  newRow[0] = String(pinned.rows.length + 1);
  newRow[cols - 1] = formatAmount(0, inv.currency);

  pinned.rows.push(newRow);

  if (tableId === "t1") inv.t1 = pinned;
  else inv.t2 = pinned;

  renderTable(tableEl, pinned, inv.currency);
  requestSave();
}

function delRow(tableEl, tableId) {
  const inv = getCurrentInvoice();
  if (!inv) return;

  const tData = tableId === "t1" ? inv.t1 : inv.t2;
  const pinned = pinAmountLast(tData);

  const { rowIndex } = state.selected[tableId];
  if (rowIndex == null || rowIndex < 0 || rowIndex >= pinned.rows.length) return;
  if (pinned.rows.length <= 1) return;

  pinned.rows.splice(rowIndex, 1);
  pinned.rows = renumberRows(pinned.rows);
  setSelected(tableId, null, null);

  if (tableId === "t1") inv.t1 = pinned;
  else inv.t2 = pinned;

  renderTable(tableEl, pinned, inv.currency);
  requestSave();
}

function addColPinned(tableEl, tableId, afterSelected) {
  const inv = getCurrentInvoice();
  if (!inv) return;

  const tData = tableId === "t1" ? inv.t1 : inv.t2;
  const pinned = pinAmountLast(tData);
  const { colIndex } = state.selected[tableId];

  const cols = pinned.headers.length;
  const amountIdx = cols - 1;

  const insertAt = (() => {
    if (!afterSelected) return amountIdx;
    if (colIndex == null || colIndex < 0) return amountIdx;
    if (colIndex >= amountIdx) return amountIdx;
    return Math.min(amountIdx, colIndex + 1);
  })();

  const newHeader = `عمود ${cols}`;
  pinned.headers.splice(insertAt, 0, newHeader);
  for (const r of pinned.rows) r.splice(insertAt, 0, "");

  const repinned = pinAmountLast(pinned);

  if (tableId === "t1") inv.t1 = repinned;
  else inv.t2 = repinned;

  renderTable(tableEl, repinned, inv.currency);
  requestSave();
}

function delColPinned(tableEl, tableId) {
  const inv = getCurrentInvoice();
  if (!inv) return;

  const tData = tableId === "t1" ? inv.t1 : inv.t2;
  const pinned = pinAmountLast(tData);

  const { colIndex } = state.selected[tableId];
  const cols = pinned.headers.length;
  const minCols = pinned.minCols;
  const amountIdx = cols - 1;

  if (cols <= minCols) return;
  if (colIndex == null || colIndex < 0 || colIndex >= cols) return;
  if (colIndex === 0) return;
  if (colIndex === amountIdx) return;

  pinned.headers.splice(colIndex, 1);
  for (const r of pinned.rows) r.splice(colIndex, 1);

  const repinned = pinAmountLast(pinned);

  setSelected(tableId, null, null);

  if (tableId === "t1") inv.t1 = repinned;
  else inv.t2 = repinned;

  renderTable(tableEl, repinned, inv.currency);
  requestSave();
}

function wireTableEditing(tableEl) {
  tableEl.addEventListener("input", () => {
    saveCurrentFromDom();
    renderHeaderAndSums();
    saveAll();
  });

  tableEl.addEventListener(
    "blur",
    (e) => {
      const td = e.target?.closest?.("td");
      if (!td) return;

      const inv = getCurrentInvoice();
      if (!inv) return;

      if (td.classList.contains("amount")) {
        const n = parseAmount(td.textContent);
        td.textContent = formatAmount(n, inv.currency);
      }

      requestSave();
    },
    true
  );
}

/* =========================
 * Invoice CRUD
 * ========================= */

function promptNonEmpty(msg, def = "") {
  const v = window.prompt(msg, def);
  if (v == null) return null;
  const t = String(v).trim();
  return t ? t : null;
}

function createInvoice() {
  const name = promptNonEmpty("اسم الفاتورة الجديدة:", `فاتورة ${state.invoices.length + 1}`);
  if (!name) return;

  saveCurrentFromDom();
  const inv = createDefaultInvoice(name);
  state.invoices.unshift(inv);
  state.currentId = inv.id;

  saveAll();
  renderInvoiceIntoDom();
  renderInvoicePickers();
  renderHeaderAndSums();
}

function renameInvoice() {
  const inv = getCurrentInvoice();
  if (!inv) return;
  const name = promptNonEmpty("الاسم الجديد:", inv.name);
  if (!name) return;

  inv.name = name;
  requestSave();
  renderInvoiceIntoDom();
  renderInvoicePickers();
}

function deleteInvoice() {
  const inv = getCurrentInvoice();
  if (!inv) return;
  const ok = window.confirm(`حذف الفاتورة "${inv.name}"؟`);
  if (!ok) return;

  const idx = state.invoices.findIndex((x) => x.id === inv.id);
  if (idx >= 0) state.invoices.splice(idx, 1);
  if (!state.invoices.length) state.invoices = [createDefaultInvoice("فاتورة 1")];

  state.currentId = state.invoices[0].id;
  saveAll();
  renderInvoiceIntoDom();
  renderInvoicePickers();
  renderHeaderAndSums();
}

/* =========================
 * Print / PDF
 * ========================= */

function buildPrintableHeader(inv, extra = "") {
  const currency = inv.currency || "$";
  const lineClient = clientName ? `العميل: ${clientName}` : clientId ? `العميل: ${clientId}` : "—";

  return `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px">
      <div>
        <div style="font-weight:800; font-size:18px">وصل قبض + كشف حساب</div>
        <div style="margin-top:4px; color:#555; font-size:12px">
          ${escapeHtml(lineClient)} — ${escapeHtml(`الفاتورة: ${inv.name}`)}
          ${inv.date ? `— ${escapeHtml(`التاريخ: ${inv.date}`)}` : ""}
          ${extra ? `— ${escapeHtml(extra)}` : ""}
        </div>
      </div>
      <div style="font-size:12px; color:#555">
        <div>${escapeHtml(`العملة: ${currency}`)}</div>
      </div>
    </div>
  `;
}

function tableDataToPrintableHtml(tData, currency, footLabel) {
  const pinned = pinAmountLast(tData);
  const head = `<tr>${pinned.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
  const body = pinned.rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(String(c ?? ""))}</td>`).join("")}</tr>`)
    .join("");

  const sum = computeTableSum(pinned);
  const colspan = Math.max(1, pinned.headers.length - 1);

  return `
    <table class="table">
      <thead>${head}</thead>
      <tbody>${body}</tbody>
      <tfoot>
        <tr>
          <td colspan="${colspan}" style="font-weight:700">${escapeHtml(footLabel)}</td>
          <td style="font-weight:700">${escapeHtml(formatAmount(sum, currency))}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

function buildPrintableFinal(inv) {
  const currency = inv.currency || "$";
  const s1 = computeTableSum(inv.t1);
  const s2 = computeTableSum(inv.t2);
  const bal = s1 - s2;

  return `
    <h3 style="margin:14px 0 6px">الحساب النهائي</h3>
    <table class="table">
      <tr><th>إجمالي العمليات</th><td>${escapeHtml(formatAmount(s1, currency))}</td></tr>
      <tr><th>مجموع القبوضات</th><td>${escapeHtml(formatAmount(s2, currency))}</td></tr>
      <tr><th>الرصيد النهائي</th><td>${escapeHtml(formatAmount(bal, currency))}</td></tr>
    </table>
    <div class="sign" style="margin-top:18px; display:flex; justify-content:space-between; gap:16px">
      <div style="flex:1; border-top:1px solid #bbb; padding-top:8px; text-align:center">توقيع المستلم</div>
      <div style="flex:1; border-top:1px solid #bbb; padding-top:8px; text-align:center">توقيع المحاسب</div>
    </div>
  `;
}

function buildPrintableInvoiceHtml(inv) {
  const currency = inv.currency || "$";
  return `
    <article class="pdfInv" style="break-inside:avoid; page-break-after:always;">
      ${buildPrintableHeader(inv)}
      <div style="margin-top:10px">
        <h3 style="margin:10px 0 6px">العمليات</h3>
        ${tableDataToPrintableHtml(inv.t1, currency, "إجمالي العمليات")}
        <h3 style="margin:10px 0 6px">القبوضات</h3>
        ${tableDataToPrintableHtml(inv.t2, currency, "مجموع القبوضات")}
        ${buildPrintableFinal(inv)}
      </div>
    </article>
  `;
}

function buildPrintableTabOnly(inv, tabKey) {
  const currency = inv.currency || "$";
  const title = tabKey === "ops" ? "العمليات" : tabKey === "pay" ? "القبوضات" : "الحساب النهائي";

  const inner = (() => {
    if (tabKey === "ops") {
      return `
        <h3 style="margin:10px 0 6px">العمليات</h3>
        ${tableDataToPrintableHtml(inv.t1, currency, "إجمالي العمليات")}
      `;
    }
    if (tabKey === "pay") {
      return `
        <h3 style="margin:10px 0 6px">القبوضات</h3>
        ${tableDataToPrintableHtml(inv.t2, currency, "مجموع القبوضات")}
      `;
    }
    return buildPrintableFinal(inv);
  })();

  return `
    <article class="pdfInv" style="page-break-after:auto;">
      ${buildPrintableHeader(inv, `التبويب: ${title}`)}
      <div style="margin-top:10px">${inner}</div>
    </article>
  `;
}

function printInvoices(invoices, mode) {
  ui.pdfDoc.innerHTML = "";

  const invs = invoices.map(normalizeInvoice);
  const html =
    mode === "tab"
      ? buildPrintableTabOnly(invs[0], state.activeTab)
      : invs.map(buildPrintableInvoiceHtml).join("");

  ui.pdfDoc.innerHTML = `
    <style>
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .pdfInv { page-break-after: always; }
        .pdfInv:last-child { page-break-after: auto; }
      }
    </style>
    ${html}
  `;

  window.print();
}

/* =========================
 * Excel export
 * ========================= */

function sanitizeSheetName(name) {
  const cleaned = String(name || "Sheet").replace(/[\[\]\*\/\\\?\:]/g, " ").trim();
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned || "Sheet";
}

function tableElToMatrix(tableEl) {
  const head = $$("#" + tableEl.id + " thead th").map((th) => th.textContent.trim());
  const rows = $$("#" + tableEl.id + " tbody tr").map((tr) =>
    Array.from(tr.cells).map((td) => td.textContent.trim())
  );
  const foot = $$("#" + tableEl.id + " tfoot td").map((td) => td.textContent.trim());
  const matrix = [head, ...rows];
  if (foot.length) matrix.push(foot);
  return matrix;
}

function exportXlsFallback(filename, htmlBody) {
  const doc = `
    <html dir="rtl" lang="ar">
      <head><meta charset="utf-8"/></head>
      <body>${htmlBody}</body>
    </html>
  `.trim();

  const blob = new Blob([doc], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportWorkbookXlsx(filename, sheets) {
  const XLSX = window.XLSX;
  if (!XLSX) return false;

  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sh.data);
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sh.name));
  }
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
  return true;
}

function exportTabExcel() {
  saveCurrentFromDom();
  const inv = getCurrentInvoice();
  if (!inv) return;

  const tabKey = state.activeTab;
  const title = tabKey === "ops" ? "العمليات" : tabKey === "pay" ? "القبوضات" : "الحساب النهائي";

  if (window.XLSX) {
    if (tabKey === "ops") return exportWorkbookXlsx(`${inv.name}-${title}`, [{ name: title, data: tableElToMatrix(ui.t1) }]);
    if (tabKey === "pay") return exportWorkbookXlsx(`${inv.name}-${title}`, [{ name: title, data: tableElToMatrix(ui.t2) }]);
    return exportWorkbookXlsx(`${inv.name}-${title}`, [{
      name: title,
      data: [
        ["إجمالي العمليات", ui.f1.textContent],
        ["مجموع القبوضات", ui.f2.textContent],
        ["الرصيد النهائي", ui.f3.textContent],
      ],
    }]);
  }

  let html = `<h2>${escapeHtml(clientName || clientId || "العميل")}</h2>`;
  html += `<div>الفاتورة: ${escapeHtml(inv.name)} — التاريخ: ${escapeHtml(inv.date || "—")} — العملة: ${escapeHtml(inv.currency)}</div>`;
  html += `<h3>${escapeHtml(title)}</h3>`;

  if (tabKey === "ops") html += ui.t1.cloneNode(true).outerHTML;
  else if (tabKey === "pay") html += ui.t2.cloneNode(true).outerHTML;
  else {
    html += `
      <table border="1">
        <tr><th>إجمالي العمليات</th><td>${escapeHtml(ui.f1.textContent)}</td></tr>
        <tr><th>مجموع القبوضات</th><td>${escapeHtml(ui.f2.textContent)}</td></tr>
        <tr><th>الرصيد النهائي</th><td>${escapeHtml(ui.f3.textContent)}</td></tr>
      </table>
    `;
  }

  exportXlsFallback(`${inv.name}-${title}`, html);
}

function exportInvoiceExcel() {
  saveCurrentFromDom();
  const inv = getCurrentInvoice();
  if (!inv) return;

  if (window.XLSX) {
    return exportWorkbookXlsx(`${inv.name}-كامل`, [
      { name: "العمليات", data: tableElToMatrix(ui.t1) },
      { name: "القبوضات", data: tableElToMatrix(ui.t2) },
      {
        name: "الحساب النهائي",
        data: [
          ["إجمالي العمليات", ui.f1.textContent],
          ["مجموع القبوضات", ui.f2.textContent],
          ["الرصيد النهائي", ui.f3.textContent],
        ],
      },
    ]);
  }

  const html = `
    <h2>${escapeHtml(clientName || clientId || "العميل")}</h2>
    <div>الفاتورة: ${escapeHtml(inv.name)} — التاريخ: ${escapeHtml(inv.date || "—")} — العملة: ${escapeHtml(inv.currency)}</div>
    <h3>العمليات</h3>
    ${ui.t1.cloneNode(true).outerHTML}
    <h3>القبوضات</h3>
    ${ui.t2.cloneNode(true).outerHTML}
    <h3>الحساب النهائي</h3>
    <table border="1">
      <tr><th>إجمالي العمليات</th><td>${escapeHtml(ui.f1.textContent)}</td></tr>
      <tr><th>مجموع القبوضات</th><td>${escapeHtml(ui.f2.textContent)}</td></tr>
      <tr><th>الرصيد النهائي</th><td>${escapeHtml(ui.f3.textContent)}</td></tr>
    </table>
  `;
  exportXlsFallback(`${inv.name}-كامل`, html);
}

function invoiceDataToMatrix(tData) {
  const pinned = pinAmountLast(tData);
  return [pinned.headers, ...pinned.rows];
}

function exportClientExcel() {
  saveCurrentFromDom();
  saveAll();

  const invs = state.invoices.map(normalizeInvoice);

  if (window.XLSX) {
    const sheets = [];
    const summary = [["الفاتورة", "التاريخ", "العملة", "إجمالي العمليات", "مجموع القبوضات", "الرصيد النهائي"]];
    for (const inv of invs) {
      const cur = inv.currency || "$";
      const s1 = computeTableSum(inv.t1);
      const s2 = computeTableSum(inv.t2);
      const bal = s1 - s2;
      summary.push([inv.name, inv.date || "", cur, s1, s2, bal]);

      sheets.push({ name: `${inv.name}-عمليات`, data: invoiceDataToMatrix(inv.t1) });
      sheets.push({ name: `${inv.name}-قبوضات`, data: invoiceDataToMatrix(inv.t2) });
      sheets.push({
        name: `${inv.name}-نهائي`,
        data: [
          ["إجمالي العمليات", formatAmount(s1, cur)],
          ["مجموع القبوضات", formatAmount(s2, cur)],
          ["الرصيد النهائي", formatAmount(bal, cur)],
        ],
      });
    }
    sheets.unshift({ name: "ملخص", data: summary });

    return exportWorkbookXlsx(`فواتير-${clientName || clientId || "العميل"}`, sheets);
  }

  let html = `<h2>فواتير العميل: ${escapeHtml(clientName || clientId || "—")}</h2>`;
  for (const inv of invs) {
    const cur = inv.currency || "$";
    const s1 = computeTableSum(inv.t1);
    const s2 = computeTableSum(inv.t2);
    const bal = s1 - s2;

    html += `
      <hr/>
      <h3>${escapeHtml(inv.name)}</h3>
      <div>التاريخ: ${escapeHtml(inv.date || "—")} — العملة: ${escapeHtml(cur)}</div>
      <h4>العمليات</h4>
      ${ui.t1.cloneNode(true).outerHTML}
      <h4>القبوضات</h4>
      ${ui.t2.cloneNode(true).outerHTML}
      <h4>الحساب النهائي</h4>
      <table border="1">
        <tr><th>إجمالي العمليات</th><td>${escapeHtml(formatAmount(s1, cur))}</td></tr>
        <tr><th>مجموع القبوضات</th><td>${escapeHtml(formatAmount(s2, cur))}</td></tr>
        <tr><th>الرصيد النهائي</th><td>${escapeHtml(formatAmount(bal, cur))}</td></tr>
      </table>
    `;
  }

  exportXlsFallback(`فواتير-${clientName || clientId || "العميل"}`, html);
}

/* =========================
 * Wiring (buttons + filters)
 * ========================= */

function wireFilters() {
  if (ui.invSearch) ui.invSearch.addEventListener("input", renderInvoicePickers);
  if (ui.listFrom) ui.listFrom.addEventListener("change", renderInvoicePickers);
  if (ui.listTo) ui.listTo.addEventListener("change", renderInvoicePickers);

  if (ui.btnListClear) {
    ui.btnListClear.addEventListener("click", () => {
      if (ui.invSearch) ui.invSearch.value = "";
      if (ui.listFrom) ui.listFrom.value = "";
      if (ui.listTo) ui.listTo.value = "";
      renderInvoicePickers();
    });
  }
}

function wireButtons() {
  ui.invSelect.addEventListener("change", () => setCurrentInvoice(ui.invSelect.value));

  ui.btnNewInv.addEventListener("click", createInvoice);
  ui.btnRenameInv.addEventListener("click", renameInvoice);
  ui.btnDeleteInv.addEventListener("click", deleteInvoice);

  ui.invDate.addEventListener("change", requestSave);

  // click currency to change
  ui.curPill.addEventListener("click", () => {
    const inv = getCurrentInvoice();
    if (!inv) return;
    const v = promptNonEmpty("رمز العملة لهذه الفاتورة (مثال: $, د.ع, IQD, AED):", inv.currency || "$");
    if (!v) return;
    inv.currency = v;
    ui.curPill.textContent = v;
    renderInvoiceIntoDom();
    requestSave();
  });

  ui.btnPrintTab.addEventListener("click", () => {
    saveCurrentFromDom();
    const inv = getCurrentInvoice();
    if (!inv) return;
    printInvoices([inv], "tab");
  });

  ui.btnPrintAll.addEventListener("click", () => {
    saveCurrentFromDom();
    const inv = getCurrentInvoice();
    if (!inv) return;
    printInvoices([inv], "all");
  });

  ui.btnPdfAll.addEventListener("click", () => {
    saveCurrentFromDom();
    saveAll();
    printInvoices(state.invoices, "all");
  });

  ui.btnPdfRange.addEventListener("click", () => {
    saveCurrentFromDom();
    saveAll();
    const fromIso = ui.pdfFrom.value || "";
    const toIso = ui.pdfTo.value || "";
    const filtered = state.invoices.filter((inv) => invoiceInRange(inv, fromIso, toIso));
    if (!filtered.length) {
      alert("لا توجد فواتير ضمن هذا المدى. سيتم طباعة كل الفواتير.");
      printInvoices(state.invoices, "all");
      return;
    }
    printInvoices(filtered, "all");
  });

  ui.btnXlsxTab.addEventListener("click", exportTabExcel);
  ui.btnXlsxAll.addEventListener("click", exportInvoiceExcel);
  ui.btnExportClientXlsx.addEventListener("click", exportClientExcel);

  ui.t1AddRow.addEventListener("click", () => addRow(ui.t1, "t1"));
  ui.t1DelRow.addEventListener("click", () => delRow(ui.t1, "t1"));
  ui.t1AddCol.addEventListener("click", () => addColPinned(ui.t1, "t1", false));
  ui.t1AddColAfter.addEventListener("click", () => addColPinned(ui.t1, "t1", true));
  ui.t1DelCol.addEventListener("click", () => delColPinned(ui.t1, "t1"));

  ui.t2AddRow.addEventListener("click", () => addRow(ui.t2, "t2"));
  ui.t2DelRow.addEventListener("click", () => delRow(ui.t2, "t2"));
  ui.t2AddCol.addEventListener("click", () => addColPinned(ui.t2, "t2", false));
  ui.t2AddColAfter.addEventListener("click", () => addColPinned(ui.t2, "t2", true));
  ui.t2DelCol.addEventListener("click", () => delColPinned(ui.t2, "t2"));
}

function wireSelection(tableEl, tableId) {
  tableEl.addEventListener("click", (e) => {
    const td = e.target?.closest?.("td");
    if (!td) return;
    const tr = td.parentElement;
    const tbody = tableEl.tBodies?.[0];
    const rowIndex = Array.from(tbody.rows).indexOf(tr);
    const colIndex = Array.from(tr.cells).indexOf(td);
    setSelected(tableId, rowIndex, colIndex);
  });
}

function setupTabs() {
  ui.tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      ui.tabBtns.forEach((b) => b.classList.remove("active"));
      ui.tabs.forEach((t) => t.classList.remove("active"));

      btn.classList.add("active");
      const key = btn.dataset.tab;
      state.activeTab = key;
      $("#" + key)?.classList.add("active");
    });
  });
}

function init() {
  renderClientHeader();
  loadAll();

  setupTabs();

  wireSelection(ui.t1, "t1");
  wireSelection(ui.t2, "t2");

  wireTableEditing(ui.t1);
  wireTableEditing(ui.t2);

  wireFilters();
  wireButtons();

  renderInvoicePickers();
  renderInvoiceIntoDom();
  renderHeaderAndSums();

  window.addEventListener("beforeunload", () => {
    saveCurrentFromDom();
    saveAll();
  });
}

init();